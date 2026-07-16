import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate, requireCoordinator } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { auditLog } from '../middleware/auditLog.js';
import { assignSupervisors } from '../services/supervisorEngine.js';
import crypto from 'crypto';

const router = Router();
router.use(authenticate);

// GET /api/supervisors/live-rooms — today's active/completed exam slots and rooms
router.get('/live-rooms', asyncHandler(async (req, res) => {
  const db = getDb();
  // H11: Use IST consistently (UTC+5:30) to match the kiosk endpoint
  const today = new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().split('T')[0];
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

// GET /api/supervisors/room-details/:roomAllocationId — details of a classroom allocation
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

// GET /api/supervisors/:slotId — coordinator only
router.get('/:slotId', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  const duties = await db.prepare(`
    SELECT sd.*, u.name as faculty_name, u.department,
      c.room_no, c.block,
      es.date, es.start_time,
      s.name as subject_name, s.code as subject_code
    FROM supervisor_duties sd
    JOIN users u ON u.id = sd.faculty_id
    LEFT JOIN room_allocations ra ON ra.id = sd.room_allocation_id
    LEFT JOIN classrooms c ON c.id = ra.classroom_id
    JOIN exam_slots es ON es.id = sd.slot_id
    JOIN subjects s ON s.id = es.subject_id
    WHERE sd.slot_id = ?
    ORDER BY c.room_no NULLS LAST, sd.role
  `).all(req.params.slotId);
  res.json(duties);
}));

// GET /api/supervisors/availability/:slotId — availability diagnostics
router.get('/availability/:slotId', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  const slotId = req.params.slotId;
  const min_gap = parseInt(req.query.min_gap || 0);

  const slot = await db.prepare(`
    SELECT es.*, s.id as subject_id, s.name as subject_name
    FROM exam_slots es JOIN subjects s ON s.id = es.subject_id
    WHERE es.id = ?
  `).get(slotId);
  if (!slot) return res.status(404).json({ error: 'Slot not found' });

  // 1. Fetch active faculty
  const faculty = await db.prepare("SELECT id, name, department FROM users WHERE role='faculty' AND is_active=1 ORDER BY name").all();

  // 2. Fetch subject teaching mapping
  const teaches = await db.prepare('SELECT faculty_id, subject_id FROM faculty_subjects').all();
  const teachesMap = {};
  for (const t of teaches) {
    if (!teachesMap[t.faculty_id]) teachesMap[t.faculty_id] = new Set();
    teachesMap[t.faculty_id].add(t.subject_id);
  }

  // 3. Fetch approved leaves on slot date
  const leaves = await db.prepare(`
    SELECT faculty_id FROM faculty_leaves 
    WHERE date = ?
  `).all(slot.date);
  const leavesSet = new Set(leaves.map(l => l.faculty_id));

  // 4. Fetch all active duties for busy checks and gap checks
  const busyDuties = await db.prepare(`
    SELECT sd.faculty_id, es.date, es.start_time, c.room_no, sd.role, es.id as slot_id, es.cycle_id
    FROM supervisor_duties sd
    LEFT JOIN room_allocations ra ON ra.id = sd.room_allocation_id
    LEFT JOIN classrooms c ON c.id = ra.classroom_id
    JOIN exam_slots es ON es.id = sd.slot_id
  `).all();

  const busyMap = {};
  for (const bd of busyDuties) {
    if (!busyMap[bd.faculty_id]) busyMap[bd.faculty_id] = [];
    busyMap[bd.faculty_id].push(bd);
  }

  const availability = faculty.map(f => {
    const subjectIds = teachesMap[f.id] || new Set();
    const fBusy = busyMap[f.id] || [];

    const teachesSubject = subjectIds.has(slot.subject_id);
    const busyInSlot = fBusy.find(bd => bd.date === slot.date && bd.start_time === slot.start_time);
    const onLeave = leavesSet.has(f.id);

    // Calculate gap conflict
    let gapConflict = false;
    let gapClashingDate = null;
    if (min_gap > 0) {
      const targetDate = new Date(slot.date + 'T00:00:00');
      for (const bd of fBusy) {
        const existingDate = new Date(bd.date + 'T00:00:00');
        const diffTime = Math.abs(targetDate - existingDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays <= min_gap && bd.slot_id !== slotId) {
          gapConflict = true;
          gapClashingDate = bd.date;
          break;
        }
      }
    }

    // Workload count for this cycle
    const workloadCount = fBusy.filter(bd => bd.cycle_id === slot.cycle_id).length;

    let status = 'available';
    let reason = null;

    if (onLeave) {
      status = 'leave';
      reason = 'Approved Leave';
    } else if (teachesSubject) {
      status = 'teaches';
      reason = `Teaches subject (${slot.subject_name})`;
    } else if (busyInSlot) {
      status = 'busy';
      reason = `Assigned in slot (${busyInSlot.role === 'standby' ? 'Standby' : 'Room ' + busyInSlot.room_no})`;
    } else if (gapConflict) {
      status = 'gap';
      reason = `Gap conflict (duty on ${gapClashingDate})`;
    }

    return {
      id: f.id,
      name: f.name,
      department: f.department,
      status,
      reason,
      workload: workloadCount,
      is_available: status === 'available'
    };
  });

  res.json(availability);
}));

// POST /api/supervisors/generate/:slotId
router.post('/generate/:slotId', requireCoordinator, auditLog('GENERATE_SUPERVISORS', 'supervisors', (req) => req.params.slotId, (req, data) => `Generated ${data?.assigned || 0} supervisor duties for slot: ${req.params.slotId}`), asyncHandler(async (req, res) => {
  const db = getDb();
  const { coSupervisorThreshold = 30, minGapDays = 0, maxDuties = 999, reliefCount = 0 } = req.body;

  const slot = await db.prepare(`
    SELECT es.*, s.id as subject_id, s.name as subject_name
    FROM exam_slots es JOIN subjects s ON s.id = es.subject_id
    WHERE es.id = ?
  `).get(req.params.slotId);
  if (!slot) return res.status(404).json({ error: 'Slot not found' });

  const rooms = await db.prepare(`
    SELECT ra.id, ra.classroom_id, c.room_no,
      (SELECT COUNT(*) FROM seat_assignments sa WHERE sa.room_allocation_id = ra.id) as seated_count
    FROM room_allocations ra JOIN classrooms c ON c.id = ra.classroom_id
    WHERE ra.slot_id = ?
  `).all(req.params.slotId);

  // Get active faculty
  const faculty = await db.prepare("SELECT id, name, department FROM users WHERE role='faculty' AND is_active=1").all();
  const subjectStmt = await db.prepare('SELECT subject_id FROM faculty_subjects WHERE faculty_id=?');
  
  // Filter out faculty on approved leave for this date
  const leaves = await db.prepare("SELECT faculty_id FROM faculty_leaves WHERE date = ?").all(slot.date);
  const leavesSet = new Set(leaves.map(l => l.faculty_id));

  const allFaculty = faculty
    .filter(f => !leavesSet.has(f.id))
    .map(f => ({
      ...f,
      subject_ids: subjectStmt.all(f.id).map(r => r.subject_id)
    }));

  // Build workload for cycle
  const globalWorkload = {};
  for (const f of faculty) globalWorkload[f.id] = 0;
  const allDutyCounts = await db.prepare(`
    SELECT sd.faculty_id, COUNT(*) as cnt
    FROM supervisor_duties sd
    JOIN exam_slots es ON es.id = sd.slot_id
    WHERE es.cycle_id = ? AND es.id != ?
    GROUP BY sd.faculty_id
  `).all(slot.cycle_id, slot.id);
  for (const row of allDutyCounts) {
    if (globalWorkload[row.faculty_id] !== undefined) globalWorkload[row.faculty_id] = row.cnt;
  }

  const slotWithRooms = [{ ...slot, rooms }];
  const { duties, conflicts } = assignSupervisors(slotWithRooms, allFaculty, globalWorkload, [], {
    coSupervisorThreshold,
    minGapDays,
    maxDuties,
    reliefCount
  });

  // Save
  await db.transaction(async () => {
    // Delete existing duties and conflicts for slot
    await db.prepare('DELETE FROM supervisor_duties WHERE slot_id = ?').run(slot.id);
    await db.prepare("DELETE FROM conflicts WHERE slot_id = ? AND type IN ('NO_SUPERVISOR_AVAILABLE', 'NO_CO_SUPERVISOR_AVAILABLE', 'NO_STANDBY_AVAILABLE')").run(slot.id);

    const insertStmt = await db.prepare(`
      INSERT INTO supervisor_duties (id, faculty_id, room_allocation_id, slot_id, role)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const d of duties) {
      await insertStmt.run(d.id, d.faculty_id, d.room_allocation_id, slot.id, d.role);
    }

    const cStmt = await db.prepare('INSERT INTO conflicts (id, slot_id, cycle_id, type, description, suggested_resolution) VALUES (?, ?, ?, ?, ?, ?)');
    for (const c of conflicts) {
      await cStmt.run(crypto.randomUUID(), slot.id, slot.cycle_id, c.type, c.description, c.suggested_resolution || null);
    }

    await db.prepare("UPDATE exam_slots SET status = 'supervisors_assigned' WHERE id = ? AND status != 'finalised'").run(slot.id);
  })();

  res.json({ assigned: duties.length, conflicts, message: `Assigned ${duties.length} supervisor duties successfully.` });
}));

// POST /api/supervisors/assign — manual assign/override
router.post('/assign', requireCoordinator, auditLog('MANUAL_ASSIGN_SUPERVISOR', 'supervisors', (req) => req.body.slot_id, (req) => `Manually assigned faculty ID: ${req.body.faculty_id} as ${req.body.role} in slot ID: ${req.body.slot_id}`), asyncHandler(async (req, res) => {
  const db = getDb();
  const { slot_id, room_allocation_id, faculty_id, role, force = false } = req.body;

  if (!slot_id || !faculty_id || !role) {
    return res.status(400).json({ error: 'slot_id, faculty_id and role are required.' });
  }

  // 1. Fetch faculty, confirm active
  const faculty = await db.prepare("SELECT * FROM users WHERE id=? AND role='faculty' AND is_active=1").get(faculty_id);
  if (!faculty) return res.status(400).json({ error: 'Selected user is not an active faculty member' });

  // 2. Fetch slot info
  const slot = await db.prepare("SELECT es.*, s.name as subject_name FROM exam_slots es JOIN subjects s ON s.id = es.subject_id WHERE es.id = ?").get(slot_id);
  if (!slot) return res.status(404).json({ error: 'Slot not found' });

  // 3. Conflict checks
  if (!force) {
    // Teaching check
    const teaches = await db.prepare('SELECT 1 FROM faculty_subjects WHERE faculty_id=? AND subject_id=?').get(faculty_id, slot.subject_id);
    if (teaches) return res.status(400).json({ error: `${faculty.name} teaches this subject (${slot.subject_name}) and cannot supervise it.` });

    // Busy check
    const busy = await db.prepare(`
      SELECT c.room_no, sd.role
      FROM supervisor_duties sd
      LEFT JOIN room_allocations ra ON ra.id = sd.room_allocation_id
      LEFT JOIN classrooms c ON c.id = ra.classroom_id
      JOIN exam_slots es ON es.id = sd.slot_id
      WHERE sd.faculty_id = ? AND es.date = ? AND es.start_time = ?
    `).get(faculty_id, slot.date, slot.start_time);
    if (busy) {
      return res.status(400).json({ 
        error: `${faculty.name} is already assigned as ${busy.role} in ${busy.room_no ? 'Room ' + busy.room_no : 'Standby'} at this time.` 
      });
    }

    // Leave check
    const leave = await db.prepare(`
      SELECT 1 FROM faculty_leaves WHERE faculty_id = ? AND date = ?
    `).get(faculty_id, slot.date);
    if (leave) return res.status(400).json({ error: `${faculty.name} has approved leave on this date.` });
  }

  // 4. Save manually assigned duty
  const id = crypto.randomUUID();
  
  await db.transaction(async () => {
    // If room allocation and role are specified, clear existing supervisor for that room and role
    if (room_allocation_id && role !== 'standby') {
      await db.prepare('DELETE FROM supervisor_duties WHERE room_allocation_id = ? AND role = ?').run(room_allocation_id, role);
    }
    
    await db.prepare(`
      INSERT INTO supervisor_duties (id, faculty_id, room_allocation_id, slot_id, role)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, faculty_id, room_allocation_id || null, slot_id, role);
  })();

  res.json({ success: true, message: 'Supervisor assigned successfully.' });
}));

// DELETE /api/supervisors/:dutyId — manual delete
router.delete('/:dutyId', requireCoordinator, auditLog('DELETE_SUPERVISOR_DUTY', 'supervisors', (req) => req.params.dutyId, (req) => `Deleted supervisor duty ID: ${req.params.dutyId}`), asyncHandler(async (req, res) => {
  const db = getDb();
  await db.prepare('DELETE FROM supervisor_duties WHERE id = ?').run(req.params.dutyId);
  res.json({ success: true, message: 'Supervisor duty removed.' });
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
    SELECT es.*, s.name as subject_name, sd.slot_id
    FROM supervisor_duties sd
    JOIN exam_slots es ON es.id = sd.slot_id
    JOIN subjects s ON s.id = es.subject_id
    WHERE sd.id = ?
  `).get(duty_id);
  if (!slot) return res.status(404).json({ error: 'Duty assignment not found' });

  // 3. Check if faculty teaches the subject
  const teaches = await db.prepare('SELECT 1 FROM faculty_subjects WHERE faculty_id=? AND subject_id=?').get(new_faculty_id, slot.subject_id);
  if (teaches) return res.status(400).json({ error: `${faculty.name} teaches the subject (${slot.subject_name}) and cannot supervise it.` });

  // 4. Check if faculty is already busy in another room at this slot time
  const busy = await db.prepare(`
    SELECT c.room_no, sd.role
    FROM supervisor_duties sd
    LEFT JOIN room_allocations ra ON ra.id = sd.room_allocation_id
    LEFT JOIN classrooms c ON c.id = ra.classroom_id
    JOIN exam_slots es ON es.id = sd.slot_id
    WHERE sd.faculty_id = ? AND es.date = ? AND es.start_time = ? AND sd.id != ?
  `).get(new_faculty_id, slot.date, slot.start_time, duty_id);
  if (busy) {
    return res.status(400).json({ 
      error: `${faculty.name} is already assigned as ${busy.role} in ${busy.room_no ? 'Room ' + busy.room_no : 'Standby'} at this slot (${slot.date} ${slot.start_time}).` 
    });
  }

  if (version === undefined) {
    return res.status(400).json({ error: 'version is required for optimistic concurrency control.' });
  }

  const result = await db.prepare('UPDATE supervisor_duties SET faculty_id=?, version = version + 1 WHERE id=? AND version=?').run(new_faculty_id, duty_id, parseInt(version));
  if (result.changes === 0) {
    return res.status(409).json({ error: 'Conflict: Supervisor duty assignment was modified by another coordinator. Please refresh.' });
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
    SELECT sd.id, sd.role, sd.acknowledged, sd.acknowledged_at, sd.room_allocation_id, sd.slot_id,
      c.room_no, c.block,
      es.date, es.start_time, es.duration_mins,
      s.name as subject_name, s.code as subject_code,
      (SELECT u2.name FROM supervisor_duties sd2 JOIN users u2 ON u2.id = sd2.faculty_id
       WHERE sd2.room_allocation_id = sd.room_allocation_id AND sd2.id != sd.id LIMIT 1) as co_supervisor_name
    FROM supervisor_duties sd
    LEFT JOIN room_allocations ra ON ra.id = sd.room_allocation_id
    LEFT JOIN classrooms c ON c.id = ra.classroom_id
    JOIN exam_slots es ON es.id = sd.slot_id
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
