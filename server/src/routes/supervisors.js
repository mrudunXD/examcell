import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate, requireCoordinator } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { auditLog } from '../middleware/auditLog.js';
import { assignSupervisors } from '../services/supervisorEngine.js';

const router = Router();
router.use(authenticate);

// GET /api/supervisors/live-rooms — today's active/completed exam slots and rooms
router.get('/live-rooms', asyncHandler(async (req, res) => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const rooms = await db.prepare(`
    SELECT ra.id as room_allocation_id, c.room_no, c.block,
      es.date, es.start_time, es.duration_mins, es.status as slot_status,
      s.name as subject_name, s.code as subject_code
    FROM room_allocations ra
    JOIN classrooms c ON c.id = ra.classroom_id
    JOIN exam_slots es ON es.id = ra.slot_id
    JOIN subjects s ON s.id = es.subject_id
    WHERE es.date = ?
    ORDER BY es.start_time, c.room_no
  `).all(today);
  res.json(rooms);
}));

// GET /api/supervisors/room-details/:roomAllocationId — details of a classroom allocation for faculty assistant mode
router.get('/room-details/:roomAllocationId', asyncHandler(async (req, res) => {
  const db = getDb();
  const roomAllocationId = req.params.roomAllocationId;

  // 1. Enforce access control for faculty
  if (req.user.role === 'faculty') {
    const assigned = await db.prepare(`
      SELECT 1 FROM supervisor_duties sd
      WHERE sd.faculty_id = ? AND sd.room_allocation_id = ?
    `).get(req.user.id, roomAllocationId);
    if (!assigned) {
      return res.status(403).json({ error: 'Access denied: You are not assigned to this classroom.' });
    }
  }

  // 2. Fetch room allocation & slot info
  const ra = await db.prepare(`
    SELECT ra.*, c.room_no, c.block, c.bench_rows, c.bench_cols, c.capacity,
      es.date, es.start_time, es.duration_mins, es.status as slot_status,
      s.id as subject_id, s.name as subject_name, s.code as subject_code, s.branch as subject_branch,
      (SELECT COUNT(DISTINCT student_id) FROM seat_assignments WHERE room_allocation_id = ra.id) as assigned_count
    FROM room_allocations ra
    JOIN classrooms c ON c.id = ra.classroom_id
    JOIN exam_slots es ON es.id = ra.slot_id
    JOIN subjects s ON s.id = es.subject_id
    WHERE ra.id = ?
  `).get(roomAllocationId);

  if (!ra) return res.status(404).json({ error: 'Room allocation not found' });

  // 3. Fetch co-supervisors
  const team = await db.prepare(`
    SELECT sd.id as duty_id, sd.role, sd.acknowledged, u.id as faculty_id, u.name as faculty_name, u.email, u.department
    FROM supervisor_duties sd
    JOIN users u ON u.id = sd.faculty_id
    WHERE sd.room_allocation_id = ?
  `).all(roomAllocationId);

  // 4. Fetch students and seating details
  const assignments = await db.prepare(`
    SELECT sa.student_id, sa.bench_row, sa.bench_col,
      s.name as student_name, s.prn, s.roll_no, s.branch, s.year, s.semester,
      a.status as attendance_status, a.notes as attendance_notes, a.marked_at
    FROM seat_assignments sa
    JOIN students s ON s.id = sa.student_id
    LEFT JOIN attendance a ON a.slot_id = ? AND a.student_id = sa.student_id
    WHERE sa.room_allocation_id = ?
    ORDER BY sa.bench_row, sa.bench_col
  `).all(ra.slot_id, roomAllocationId);

  // 5. Fetch incidents for this room
  const incidents = await db.prepare(`
    SELECT i.*, u.name as reported_by_name
    FROM incidents i
    LEFT JOIN users u ON u.id = i.reported_by
    WHERE i.room_allocation_id = ?
    ORDER BY i.created_at DESC
  `).all(roomAllocationId);

  res.json({
    roomAllocation: ra,
    team,
    assignments,
    incidents
  });
}));

// GET supervisors for a slot
router.get('/:slotId', asyncHandler(async (req, res) => {
  const db = getDb();
  const duties = await db.prepare(`
    SELECT sd.*, u.name as faculty_name, u.department,
      c.room_no, c.block,
      es.date, es.start_time,
      s.name as subject_name, s.code as subject_code
    FROM supervisor_duties sd
    JOIN users u ON u.id = sd.faculty_id
    JOIN room_allocations ra ON ra.id = sd.room_allocation_id
    JOIN classrooms c ON c.id = ra.classroom_id
    JOIN exam_slots es ON es.id = ra.slot_id
    JOIN subjects s ON s.id = es.subject_id
    WHERE ra.slot_id = ?
    ORDER BY c.room_no, sd.role
  `).all(req.params.slotId);
  res.json(duties);
}));

// POST generate supervisors for a slot
router.post('/generate/:slotId', requireCoordinator, auditLog('GENERATE_SUPERVISORS', 'supervisors', (req) => req.params.slotId, (req, data) => `Generated ${data?.assigned || 0} supervisor assignments for slot ID: ${req.params.slotId}`), asyncHandler(async (req, res) => {
  const db = getDb();

  const slot = await db.prepare(`
    SELECT es.*, s.id as subject_id, s.name as subject_name
    FROM exam_slots es JOIN subjects s ON s.id = es.subject_id
    WHERE es.id=?
  `).get(req.params.slotId);
  if (!slot) return res.status(404).json({ error: 'Slot not found' });

  const rooms = await db.prepare(`
    SELECT ra.id, ra.classroom_id, c.room_no,
      (SELECT COUNT(*) FROM seat_assignments sa WHERE sa.room_allocation_id = ra.id) as seated_count
    FROM room_allocations ra JOIN classrooms c ON c.id = ra.classroom_id
    WHERE ra.slot_id = ?
  `).all(req.params.slotId);

  if (!rooms.length) return res.status(400).json({ error: 'No rooms for this slot' });

  // Get all active faculty with their subject IDs
  const faculty = await db.prepare("SELECT id, name, department FROM users WHERE role='faculty' AND is_active=1").all();
  const subjectStmt = await db.prepare('SELECT subject_id FROM faculty_subjects WHERE faculty_id=?');
  const allFaculty = faculty.map(f => ({
    ...f,
    subject_ids: subjectStmt.all(f.id).map(r => r.subject_id)
  }));

  // Build GLOBAL workload from ALL existing supervisor duties (across all cycles)
  // This ensures truly fair rotation — whoever has done least overall gets picked first
  const globalWorkload = {};
  for (const f of faculty) globalWorkload[f.id] = 0;
  const allDutyCounts = await db.prepare(`
    SELECT sd.faculty_id, COUNT(*) as cnt
    FROM supervisor_duties sd
    -- Exclude duties for the current slot (we're re-generating those)
    JOIN room_allocations ra ON ra.id = sd.room_allocation_id
    WHERE ra.slot_id != ?
    GROUP BY sd.faculty_id
  `).all(req.params.slotId);
  for (const row of allDutyCounts) {
    if (globalWorkload[row.faculty_id] !== undefined) globalWorkload[row.faculty_id] = row.cnt;
  }

  const slotWithRooms = [{ ...slot, rooms }];
  const { duties, conflicts } = assignSupervisors(slotWithRooms, allFaculty, globalWorkload);

  // Save
  const saveDuties = await db.transaction(async () => {
    // Delete existing supervisor duties for rooms in this slot
    const raIds = rooms.map(r => r.id);
    for (const raId of raIds) {
      await db.prepare('DELETE FROM supervisor_duties WHERE room_allocation_id=?').run(raId);
    }
    // Clear old supervisor conflicts for this slot
    await db.prepare("DELETE FROM conflicts WHERE slot_id=? AND type IN ('NO_SUPERVISOR_AVAILABLE','NO_CO_SUPERVISOR_AVAILABLE')").run(req.params.slotId);

    const stmt = await db.prepare('INSERT INTO supervisor_duties (id, faculty_id, room_allocation_id, role) VALUES (?, ?, ?, ?)');
    for (const d of duties) await stmt.run(d.id, d.faculty_id, d.room_allocation_id, d.role);

    const cStmt = await db.prepare('INSERT INTO conflicts (id, slot_id, cycle_id, type, description, suggested_resolution) VALUES (?, ?, ?, ?, ?, ?)');
    for (const c of conflicts) await cStmt.run(crypto.randomUUID(), req.params.slotId, slot.cycle_id, c.type, c.description, c.suggested_resolution || null);

    await db.prepare("UPDATE exam_slots SET status='supervisors_assigned' WHERE id=? AND status != 'finalised'").run(req.params.slotId);
  });
  await saveDuties();

  res.json({ assigned: duties.length, conflicts, message: `Assigned ${duties.length} supervisor duties.` });
}));

// PUT reassign supervisor
router.put('/reassign', requireCoordinator, auditLog('REASSIGN_SUPERVISOR', 'supervisors', (req) => req.body.duty_id, (req) => `Reassigned duty ID: ${req.body.duty_id} to faculty ID: ${req.body.new_faculty_id}`), asyncHandler(async (req, res) => {
  const db = getDb();
  const { duty_id, new_faculty_id, version } = req.body;

  // 1. Verify faculty exists, is active
  const faculty = await db.prepare("SELECT * FROM users WHERE id=? AND role='faculty' AND is_active=1").get(new_faculty_id);
  if (!faculty) return res.status(400).json({ error: 'Selected user is not an active faculty member' });

  // 2. Get slot details for the duty
  const slot = await db.prepare(`
    SELECT es.*, s.name as subject_name, ra.id as room_allocation_id
    FROM supervisor_duties sd
    JOIN room_allocations ra ON ra.id = sd.room_allocation_id
    JOIN exam_slots es ON es.id = ra.slot_id
    JOIN subjects s ON s.id = es.subject_id
    WHERE sd.id = ?
  `).get(duty_id);
  if (!slot) return res.status(404).json({ error: 'Duty assignment not found' });

  // 3. Check if faculty teaches the subject
  const teaches = await db.prepare('SELECT 1 FROM faculty_subjects WHERE faculty_id=? AND subject_id=?').get(new_faculty_id, slot.subject_id);
  if (teaches) return res.status(400).json({ error: `${faculty.name} teaches the subject (${slot.subject_name}) and cannot supervise it.` });

  // 4. Check if faculty is already busy in another room at this slot time
  const busy = await db.prepare(`
    SELECT c.room_no
    FROM supervisor_duties sd
    JOIN room_allocations ra ON ra.id = sd.room_allocation_id
    JOIN classrooms c ON c.id = ra.classroom_id
    JOIN exam_slots es ON es.id = ra.slot_id
    WHERE sd.faculty_id = ? AND es.date = ? AND es.start_time = ? AND sd.id != ?
  `).get(new_faculty_id, slot.date, slot.start_time, duty_id);
  if (busy) return res.status(400).json({ error: `${faculty.name} is already assigned to Room ${busy.room_no} at this slot (${slot.date} ${slot.start_time}).` });

  if (version !== undefined) {
    const result = await db.prepare('UPDATE supervisor_duties SET faculty_id=?, version = version + 1 WHERE id=? AND version=?').run(new_faculty_id, duty_id, parseInt(version));
    if (result.changes === 0) {
      return res.status(409).json({ error: 'Conflict: Supervisor duty assignment was modified by another coordinator. Please refresh.' });
    }
  } else {
    await db.prepare('UPDATE supervisor_duties SET faculty_id=? WHERE id=?').run(new_faculty_id, duty_id);
  }
  res.json({ success: true });
}));

// GET my duties (faculty view) — only visible when cycle is ACTIVE
router.get('/my-duties/:cycleId', asyncHandler(async (req, res) => {
  const db = getDb();

  // Faculty can only see duties when cycle is active
  if (req.user.role === 'faculty') {
    const cycle = await db.prepare('SELECT status FROM exam_cycles WHERE id=?').get(req.params.cycleId);
    if (!cycle) return res.status(404).json({ error: 'Cycle not found' });
    if (cycle.status !== 'active') return res.status(403).json({ error: 'Duties are not visible until the exam cycle is set active.', cycle_status: cycle.status });
  }

  const duties = await db.prepare(`
    SELECT sd.id, sd.role, sd.acknowledged, sd.acknowledged_at, sd.room_allocation_id, ra.slot_id,
      c.room_no, c.block,
      es.date, es.start_time, es.duration_mins,
      s.name as subject_name, s.code as subject_code,
      (SELECT u2.name FROM supervisor_duties sd2 JOIN users u2 ON u2.id = sd2.faculty_id
       WHERE sd2.room_allocation_id = sd.room_allocation_id AND sd2.id != sd.id LIMIT 1) as co_supervisor_name
    FROM supervisor_duties sd
    JOIN room_allocations ra ON ra.id = sd.room_allocation_id
    JOIN classrooms c ON c.id = ra.classroom_id
    JOIN exam_slots es ON es.id = ra.slot_id
    JOIN subjects s ON s.id = es.subject_id
    WHERE sd.faculty_id = ? AND es.cycle_id = ?
    ORDER BY es.date, es.start_time
  `).all(req.user.id, req.params.cycleId);
  res.json(duties);
}));


// POST acknowledge duty
router.post('/acknowledge/:dutyId', auditLog('ACKNOWLEDGE_DUTY', 'supervisors', (req) => req.params.dutyId, (req) => `Faculty acknowledged duty ID: ${req.params.dutyId}`), asyncHandler(async (req, res) => {
  const db = getDb();
  const duty = await db.prepare('SELECT * FROM supervisor_duties WHERE id=?').get(req.params.dutyId);
  if (!duty) return res.status(404).json({ error: 'Duty not found' });
  if (duty.faculty_id !== req.user.id) return res.status(403).json({ error: 'Not your duty' });
  await db.prepare("UPDATE supervisor_duties SET acknowledged=1, acknowledged_at=datetime('now') WHERE id=?").run(req.params.dutyId);
  res.json({ success: true });
}));

export default router;
