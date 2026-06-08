import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate, requireCoordinator } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { auditLog } from '../middleware/auditLog.js';
import { generateSeating } from '../services/seatingEngine.js';

const router = Router();
router.use(authenticate);

// GET seating for a slot
router.get('/:slotId', asyncHandler(async (req, res) => {
  const db = getDb();
  const slot = await db.prepare(`
    SELECT es.*, s.code as subject_code, s.name as subject_name
    FROM exam_slots es JOIN subjects s ON s.id = es.subject_id
    WHERE es.id = ?
  `).get(req.params.slotId);
  if (!slot) return res.status(404).json({ error: 'Slot not found' });

  const rooms = await db.prepare(`
    SELECT ra.*, c.room_no, c.block, c.capacity, c.bench_rows, c.bench_cols
    FROM room_allocations ra JOIN classrooms c ON c.id = ra.classroom_id
    WHERE ra.slot_id = ?
    ORDER BY c.room_no
  `).all(req.params.slotId);

  const assignmentsByRoom = {};
  for (const room of rooms) {
    const assignments = await db.prepare(`
      SELECT sa.*, st.name as student_name, st.prn, st.roll_no, st.branch, st.year
      FROM seat_assignments sa
      JOIN students st ON st.id = sa.student_id
      WHERE sa.room_allocation_id = ?
      ORDER BY sa.bench_row, sa.bench_col
    `).all(room.id);
    assignmentsByRoom[room.id] = { room, assignments };
  }

  res.json({ slot, rooms: Object.values(assignmentsByRoom) });
}));

// POST generate seating for a slot
router.post('/generate/:slotId', requireCoordinator, auditLog('GENERATE_SEATING', 'seating', (req) => req.params.slotId, (req, data) => `Generated seating for ${data?.assigned || 0} students for slot ID: ${req.params.slotId}`), asyncHandler(async (req, res) => {
  const db = getDb();

  const slot = await db.prepare('SELECT * FROM exam_slots WHERE id=?').get(req.params.slotId);
  if (!slot) return res.status(404).json({ error: 'Slot not found' });

  // Get students for this slot
  const students = await db.prepare(`
    SELECT st.* FROM students st
    JOIN slot_students ss ON ss.student_id = st.id
    WHERE ss.slot_id = ?
  `).all(req.params.slotId);

  // Get rooms for this slot
  const rooms = await db.prepare(`
    SELECT ra.id, ra.classroom_id, c.room_no, c.block, c.capacity, c.bench_rows, c.bench_cols
    FROM room_allocations ra JOIN classrooms c ON c.id = ra.classroom_id
    WHERE ra.slot_id = ?
    ORDER BY c.room_no
  `).all(req.params.slotId);

  if (!students.length) return res.status(400).json({ error: 'No students assigned to this slot' });
  if (!rooms.length) return res.status(400).json({ error: 'No rooms allocated to this slot' });

  const { assignments, conflicts } = generateSeating(students, rooms);

  // Save assignments (replace existing)
  const saveSeating = await db.transaction(async () => {
    // Delete existing assignments for these rooms
    const raIds = rooms.map(r => r.id);
    for (const raId of raIds) {
      await db.prepare('DELETE FROM seat_assignments WHERE room_allocation_id=?').run(raId);
    }
    // Delete old conflicts for this slot
    await db.prepare("DELETE FROM conflicts WHERE slot_id=? AND type IN ('CAPACITY_OVERFLOW','BRANCH_MIXING_FAILED','INSUFFICIENT_ROOM_CAPACITY','NO_STUDENTS','NO_ROOMS')").run(req.params.slotId);

    // Insert new assignments
    const stmt = await db.prepare('INSERT INTO seat_assignments (id, student_id, room_allocation_id, bench_row, bench_col) VALUES (?, ?, ?, ?, ?)');
    for (const a of assignments) {
      await stmt.run(crypto.randomUUID(), a.student_id, a.room_allocation_id, a.bench_row, a.bench_col);
    }

    // Insert conflicts
    const cStmt = await db.prepare('INSERT INTO conflicts (id, slot_id, cycle_id, type, description, affected_entities, suggested_resolution) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (const c of conflicts) {
      await cStmt.run(crypto.randomUUID(), req.params.slotId, slot.cycle_id, c.type, c.description, c.affected_entities || null, c.suggested_resolution || null);
    }

    // Update slot status
    await db.prepare("UPDATE exam_slots SET status='seating_generated' WHERE id=?").run(req.params.slotId);
  });

  await saveSeating();

  res.json({ assigned: assignments.length, conflicts, message: `Seating generated for ${assignments.length} students across ${rooms.length} room(s).` });
}));

// PUT override a single seat
router.put('/override', requireCoordinator, auditLog('OVERRIDE_SEATING', 'seating', (req) => req.body.assignment_id, (req) => `Moved seating assignment ${req.body.assignment_id} to Row ${req.body.bench_row}, Col ${req.body.bench_col}`), asyncHandler(async (req, res) => {
  const db = getDb();
  const { assignment_id, bench_row, bench_col } = req.body;

  const assignment = await db.prepare("SELECT * FROM seat_assignments WHERE id=?").get(assignment_id);
  if (!assignment) return res.status(404).json({ error: 'Seating assignment not found' });

  const occupied = await db.prepare(`
    SELECT s.name
    FROM seat_assignments sa
    JOIN students s ON s.id = sa.student_id
    WHERE sa.room_allocation_id = ? AND sa.bench_row = ? AND sa.bench_col = ? AND sa.id != ?
  `).get(assignment.room_allocation_id, bench_row, bench_col, assignment_id);

  if (occupied) {
    return res.status(400).json({ error: `Seat Row ${bench_row}, Col ${bench_col} is already occupied by ${occupied.name}.` });
  }

  await db.prepare("UPDATE seat_assignments SET bench_row=?, bench_col=?, updated_at=datetime('now') WHERE id=?").run(bench_row, bench_col, assignment_id);
  res.json({ success: true });
}));

// PUT swap two students' seats
router.put('/swap', requireCoordinator, auditLog('SWAP_SEATING', 'seating', (req) => req.body.assignment_id_1, (req) => `Swapped seating assignments ${req.body.assignment_id_1} and ${req.body.assignment_id_2}`), asyncHandler(async (req, res) => {
  const db = getDb();
  const { assignment_id_1, assignment_id_2 } = req.body;

  const a1 = await db.prepare('SELECT * FROM seat_assignments WHERE id=?').get(assignment_id_1);
  const a2 = await db.prepare('SELECT * FROM seat_assignments WHERE id=?').get(assignment_id_2);
  if (!a1 || !a2) return res.status(404).json({ error: 'Assignment not found' });

  const swap = await db.transaction(async () => {
    // Use temporary position to avoid unique constraint
    await db.prepare("UPDATE seat_assignments SET bench_row=-1, bench_col=-1 WHERE id=?").run(a1.id);
    await db.prepare("UPDATE seat_assignments SET room_allocation_id=?, bench_row=?, bench_col=? WHERE id=?").run(a1.room_allocation_id, a1.bench_row, a1.bench_col, a2.id);
    await db.prepare("UPDATE seat_assignments SET room_allocation_id=?, bench_row=?, bench_col=? WHERE id=?").run(a2.room_allocation_id, a2.bench_row, a2.bench_col, a1.id);
  });
  await swap();
  res.json({ success: true });
}));

// POST approve/finalise seating for a slot
router.post('/approve/:slotId', requireCoordinator, auditLog('APPROVE_SEATING', 'seating', (req) => req.params.slotId, (req) => `Approved and finalized seating plan for slot ID: ${req.params.slotId}`), asyncHandler(async (req, res) => {
  const db = getDb();

  // Check for open conflicts
  const openConflicts = await db.prepare("SELECT COUNT(*) as cnt FROM conflicts WHERE slot_id=? AND status='open'").get(req.params.slotId);
  if (openConflicts.cnt > 0) {
    return res.status(409).json({ error: `Cannot approve: ${openConflicts.cnt} unresolved conflict(s) remain.` });
  }

  await db.prepare('UPDATE seat_assignments SET is_approved=1 WHERE room_allocation_id IN (SELECT id FROM room_allocations WHERE slot_id=?)').run(req.params.slotId);
  await db.prepare("UPDATE exam_slots SET status='finalised' WHERE id=?").run(req.params.slotId);
  res.json({ success: true, message: 'Seating plan approved and finalised.' });
}));

// POST unlock seating (reopen for editing)
router.post('/unlock/:slotId', requireCoordinator, auditLog('UNLOCK_SEATING', 'seating', (req) => req.params.slotId, (req) => `Unlocked seating plan for slot ID: ${req.params.slotId}`), asyncHandler(async (req, res) => {
  const db = getDb();
  await db.prepare('UPDATE seat_assignments SET is_approved=0 WHERE room_allocation_id IN (SELECT id FROM room_allocations WHERE slot_id=?)').run(req.params.slotId);
  await db.prepare("UPDATE exam_slots SET status='seating_generated' WHERE id=?").run(req.params.slotId);
  res.json({ success: true, message: 'Seating plan unlocked for editing.' });
}));

export default router;
