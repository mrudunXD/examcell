import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate, requireCoordinator } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();
router.use(authenticate);

// GET conflicts for a cycle — coordinator only (H14)
router.get('/:cycleId', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  const conflicts = await db.prepare(`
    SELECT c.*,
      es.date, es.start_time,
      s.name as subject_name
    FROM conflicts c
    LEFT JOIN exam_slots es ON es.id = c.slot_id
    LEFT JOIN subjects s ON s.id = es.subject_id
    WHERE c.cycle_id = ?
    ORDER BY c.status, c.created_at DESC
  `).all(req.params.cycleId);
  res.json(conflicts);
}));

// POST resolve a conflict
router.post('/:id/resolve', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  const now = new Date().toISOString();
  await db.prepare("UPDATE conflicts SET status='resolved', resolved_at=?, resolved_by=? WHERE id=?").run(now, req.user.id, req.params.id);
  res.json({ success: true });
}));

// POST ignore a conflict
router.post('/:id/ignore', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  const now = new Date().toISOString();
  await db.prepare("UPDATE conflicts SET status='ignored', resolved_at=?, resolved_by=? WHERE id=?").run(now, req.user.id, req.params.id);
  res.json({ success: true });
}));

// POST detect conflicts for a cycle
router.post('/detect/:cycleId', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  const cycle = await db.prepare('SELECT * FROM exam_cycles WHERE id=?').get(req.params.cycleId);
  if (!cycle) return res.status(404).json({ error: 'Cycle not found' });

  // Clear old auto-detected conflicts for this cycle
  await db.prepare("DELETE FROM conflicts WHERE cycle_id=? AND type IN ('FACULTY_CLASH','STUDENT_CLASH','ROOM_OVERFLOW')")
    .run(req.params.cycleId);

  // Prepare ALL statements OUTSIDE the transaction (better-sqlite3 requirement)
  const conflStmt = db.prepare(
    `INSERT INTO conflicts (id, slot_id, cycle_id, type, description, affected_entities, suggested_resolution)
     VALUES (?,?,?,?,?,?,?)`
  );

  const facultyClashStmt = db.prepare(`
    SELECT sd.faculty_id, es.date, es.start_time, u.name as faculty_name,
      GROUP_CONCAT(c.room_no, ', ') as rooms, MIN(es.id) as slot_id
    FROM supervisor_duties sd
    JOIN room_allocations ra ON ra.id = sd.room_allocation_id
    JOIN exam_slots es ON es.id = ra.slot_id
    JOIN classrooms c ON c.id = ra.classroom_id
    JOIN users u ON u.id = sd.faculty_id
    WHERE es.cycle_id = ?
    GROUP BY sd.faculty_id, es.date, es.start_time
    HAVING COUNT(DISTINCT ra.id) > 1
  `);

  const overflowStmt = db.prepare(`
    SELECT ra.id as ra_id, c.room_no, c.capacity,
      COUNT(sa.id) as seated, es.id as slot_id, es.date
    FROM room_allocations ra
    JOIN classrooms c ON c.id = ra.classroom_id
    JOIN exam_slots es ON es.id = ra.slot_id
    LEFT JOIN seat_assignments sa ON sa.room_allocation_id = ra.id
    WHERE es.cycle_id = ?
    GROUP BY ra.id
    HAVING seated > c.capacity
  `);

  const studentClashStmt = db.prepare(`
    SELECT ss.student_id, s.name as student_name, s.prn as student_prn,
      es.date, es.start_time, MIN(es.id) as slot_id,
      GROUP_CONCAT(sub.code) as subjects
    FROM slot_students ss
    JOIN exam_slots es ON es.id = ss.slot_id
    JOIN students s ON s.id = ss.student_id
    JOIN subjects sub ON sub.id = es.subject_id
    WHERE es.cycle_id = ?
    GROUP BY ss.student_id, es.date, es.start_time
    HAVING COUNT(DISTINCT es.id) > 1
  `);

  const facultyClashes = await facultyClashStmt.all(req.params.cycleId);
  const overflows = await overflowStmt.all(req.params.cycleId);
  const studentClashes = await studentClashStmt.all(req.params.cycleId);

  let detected = 0;
  const insertAll = await db.transaction(async () => {
    for (const clash of facultyClashes) {
      await conflStmt.run(
        crypto.randomUUID(), clash.slot_id, req.params.cycleId, 'FACULTY_CLASH',
        `${clash.faculty_name} is assigned to multiple rooms (${clash.rooms}) on ${clash.date} at ${clash.start_time}`,
        clash.faculty_name, 'Reassign one room to a different faculty member'
      );
      detected++;
    }
    for (const ov of overflows) {
      await conflStmt.run(
        crypto.randomUUID(), ov.slot_id, req.params.cycleId, 'ROOM_OVERFLOW',
        `Room ${ov.room_no} has ${ov.seated} students but capacity is ${ov.capacity} on ${ov.date}`,
        `Room ${ov.room_no}`, 'Add another room or reduce student count'
      );
      detected++;
    }
    for (const sc of studentClashes) {
      await conflStmt.run(
        crypto.randomUUID(), sc.slot_id, req.params.cycleId, 'STUDENT_CLASH',
        `Student ${sc.student_name} (${sc.student_prn}) is scheduled for multiple exams (${sc.subjects}) on ${sc.date} at ${sc.start_time}`,
        `${sc.student_name} (${sc.student_prn})`,
        'Reschedule one of the exams or assign a different slot'
      );
      detected++;
    }
  });

  await insertAll();
  res.json({ detected, message: `Detected ${detected} conflict(s)` });
}));

export default router;

