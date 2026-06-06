import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate, requireCoordinator } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { generateSeating } from '../services/seatingEngine.js';
import { assignSupervisors } from '../services/supervisorEngine.js';

const router = Router();
router.use(authenticate);

// Semester parity helper
function semParity(sem) { return sem % 2 === 1 ? 'odd' : 'even'; }

// Date helpers
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}
function isSunday(dateStr) { return new Date(dateStr + 'T00:00:00').getDay() === 0; }
function nextValidDate(dateStr, endDate) {
  let d = dateStr;
  while (isSunday(d) && d <= endDate) d = addDays(d, 1);
  return d;
}


// ── CYCLES ───────────────────────────────────────────────────────────────────

router.get('/', asyncHandler(async (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM exam_cycles ORDER BY created_at DESC').all());
}));

router.post('/', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  const { name, start_date, end_date, semester_type } = req.body;
  if (!name || !start_date || !end_date) return res.status(400).json({ error: 'name, start_date, end_date required' });
  if (!['odd', 'even'].includes(semester_type)) return res.status(400).json({ error: 'semester_type must be odd or even' });
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO exam_cycles (id, name, start_date, end_date, semester_type, created_by) VALUES (?,?,?,?,?,?)')
    .run(id, name.trim(), start_date, end_date, semester_type, req.user.id);
  res.status(201).json(db.prepare('SELECT * FROM exam_cycles WHERE id=?').get(id));
}));

router.put('/:id', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  const { name, start_date, end_date, status, semester_type } = req.body;
  db.prepare("UPDATE exam_cycles SET name=?,start_date=?,end_date=?,status=?,semester_type=?,updated_at=datetime('now') WHERE id=?")
    .run(name, start_date, end_date, status, semester_type || 'odd', req.params.id);
  res.json(db.prepare('SELECT * FROM exam_cycles WHERE id=?').get(req.params.id));
}));

router.delete('/:id', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM exam_cycles WHERE id=?').run(req.params.id);
  res.json({ success: true });
}));

// POST /:id/activate — make this cycle "active", demote others to "draft"
router.post('/:id/activate', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  const cycle = db.prepare('SELECT * FROM exam_cycles WHERE id=?').get(req.params.id);
  if (!cycle) return res.status(404).json({ error: 'Cycle not found' });

  db.transaction(() => {
    // Demote all other active cycles to draft
    db.prepare("UPDATE exam_cycles SET status='draft', updated_at=datetime('now') WHERE status='active' AND id != ?")
      .run(req.params.id);
    // Promote this one to active
    db.prepare("UPDATE exam_cycles SET status='active', updated_at=datetime('now') WHERE id=?")
      .run(req.params.id);
  })();

  res.json(db.prepare('SELECT * FROM exam_cycles WHERE id=?').get(req.params.id));
}));

// POST /:id/auto-schedule — full automatic scheduling pipeline
router.post('/:id/auto-schedule', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  const cycle = db.prepare('SELECT * FROM exam_cycles WHERE id=?').get(req.params.id);
  if (!cycle) return res.status(404).json({ error: 'Cycle not found' });

  const { start_date, end_date, semester_type } = cycle;
  const parityFilter = semester_type === 'odd' ? 'semester % 2 = 1' : 'semester % 2 = 0';

  // 1. Get eligible subjects (matching semester parity)
  const subjects = db.prepare(`SELECT * FROM subjects WHERE ${parityFilter} ORDER BY branch, year, semester, code`).all();
  if (!subjects.length) return res.status(400).json({ error: `No subjects found for ${semester_type} semester cycle.` });

  // 2. Build valid date pool (skip Sundays)
  const validDates = [];
  let cur = start_date;
  while (cur <= end_date) {
    if (!isSunday(cur)) validDates.push(cur);
    cur = addDays(cur, 1);
  }
  if (!validDates.length) return res.status(400).json({ error: 'No valid exam dates in the cycle range.' });

  // 3. Group subjects by branch+year — one per branch per day
  const branchQueues = {};
  for (const s of subjects) {
    const key = `${s.branch}_${s.year}`;
    if (!branchQueues[key]) branchQueues[key] = [];
    branchQueues[key].push(s);
  }

  // 4. Schedule round-robin: each day assigns one subject per branch queue
  const scheduled = [];
  let dateIdx = 0;
  const branchKeys = Object.keys(branchQueues);
  while (branchKeys.some(k => branchQueues[k].length > 0)) {
    if (dateIdx >= validDates.length) dateIdx = validDates.length - 1; // clamp at last valid date
    for (const key of branchKeys) {
      if (branchQueues[key].length === 0) continue;
      scheduled.push({ subject: branchQueues[key].shift(), date: validDates[dateIdx] });
    }
    dateIdx++;
  }

  // 5. Get classrooms (largest first)
  const classrooms = db.prepare('SELECT * FROM classrooms WHERE is_active=1 ORDER BY capacity DESC').all();
  function pickRooms(studentCount) {
    const picked = []; let rem = Math.max(studentCount, 1);
    for (const c of classrooms) { if (rem <= 0) break; picked.push(c); rem -= c.capacity; }
    return picked;
  }

  // 6. Get faculty + global workload
  const faculty = db.prepare("SELECT id, name, department FROM users WHERE role='faculty' AND is_active=1").all();
  const subjectStmt2 = db.prepare('SELECT subject_id FROM faculty_subjects WHERE faculty_id=?');
  const allFaculty = faculty.map(f => ({ ...f, subject_ids: subjectStmt2.all(f.id).map(r => r.subject_id) }));
  const globalWorkload = {};
  for (const f of faculty) globalWorkload[f.id] = 0;
  const dutyCounts = db.prepare(`
    SELECT sd.faculty_id, COUNT(*) as cnt FROM supervisor_duties sd
    JOIN room_allocations ra ON ra.id=sd.room_allocation_id
    JOIN exam_slots es ON es.id=ra.slot_id
    WHERE es.cycle_id != ? GROUP BY sd.faculty_id
  `).all(cycle.id);
  for (const r of dutyCounts) { if (globalWorkload[r.faculty_id] !== undefined) globalWorkload[r.faculty_id] = r.cnt; }

  // 7. Execute all in one transaction
  const results = { created: 0, seated: 0, supervisors: 0, warnings: [] };
  db.transaction(() => {
    db.prepare('DELETE FROM exam_slots WHERE cycle_id=?').run(cycle.id);
    const slotStmt     = db.prepare(`INSERT INTO exam_slots (id, cycle_id, subject_id, date, start_time, duration_mins, exam_type, exam_mode, status) VALUES (?, ?, ?, ?, '09:30', 180, 'regular', 'offline', 'draft')`);
    const ssStmt       = db.prepare('INSERT OR IGNORE INTO slot_students (slot_id, student_id) VALUES (?, ?)');
    const raStmt       = db.prepare('INSERT OR IGNORE INTO room_allocations (id, slot_id, classroom_id) VALUES (?, ?, ?)');
    const seatStmt     = db.prepare('INSERT INTO seat_assignments (id, student_id, room_allocation_id, bench_row, bench_col) VALUES (?, ?, ?, ?, ?)');
    const dutyStmt     = db.prepare('INSERT INTO supervisor_duties (id, faculty_id, room_allocation_id, role) VALUES (?, ?, ?, ?)');
    const conflStmt    = db.prepare('INSERT INTO conflicts (id, slot_id, cycle_id, type, description, affected_entities, suggested_resolution) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const statusStmt   = db.prepare("UPDATE exam_slots SET status=? WHERE id=?");
    let batchDuties    = [];

    for (const { subject, date } of scheduled) {
      const students = db.prepare(`SELECT * FROM students WHERE branch=? AND year=? AND semester=? AND is_active=1`).all(subject.branch, subject.year, subject.semester);
      const slotId   = crypto.randomUUID();
      slotStmt.run(slotId, cycle.id, subject.id, date);
      results.created++;
      for (const st of students) ssStmt.run(slotId, st.id);
      if (!students.length || !classrooms.length) {
        if (!students.length) results.warnings.push(`No students for ${subject.code} (${subject.branch} ${subject.year} Sem${subject.semester})`);
        if (!classrooms.length) results.warnings.push('No classrooms configured');
        continue;
      }
      // Rooms
      const rooms = pickRooms(students.length);
      const roomAllocs = [];
      for (const c of rooms) {
        const raId = crypto.randomUUID();
        raStmt.run(raId, slotId, c.id);
        roomAllocs.push({ id: raId, classroom_id: c.id, room_no: c.room_no, capacity: c.capacity, bench_rows: c.bench_rows, bench_cols: c.bench_cols });
      }
      // Seating
      const { assignments, conflicts: sc } = generateSeating(students, roomAllocs);
      for (const a of assignments) seatStmt.run(crypto.randomUUID(), a.student_id, a.room_allocation_id, a.bench_row, a.bench_col);
      for (const c of sc) { conflStmt.run(crypto.randomUUID(), slotId, cycle.id, c.type, c.description, c.affected_entities || null, c.suggested_resolution || null); results.warnings.push(c.description); }
      results.seated += assignments.length;
      // Supervisors
      const slotRooms = roomAllocs.map(ra => ({ id: ra.id, classroom_id: ra.classroom_id, room_no: ra.room_no, seated_count: assignments.filter(a => a.room_allocation_id === ra.id).length }));
      const { duties, conflicts: dc } = assignSupervisors([{ id: slotId, subject_id: subject.id, subject_name: subject.name, date, start_time: '09:30', rooms: slotRooms }], allFaculty, globalWorkload, batchDuties);
      for (const d of duties) { dutyStmt.run(d.id, d.faculty_id, d.room_allocation_id, d.role); globalWorkload[d.faculty_id] = (globalWorkload[d.faculty_id] || 0) + 1; batchDuties.push({ ...d, time_key: `${date}_09:30` }); }
      for (const c of dc) { conflStmt.run(crypto.randomUUID(), slotId, cycle.id, c.type, c.description, null, c.suggested_resolution || null); results.warnings.push(c.description); }
      results.supervisors += duties.length;
      statusStmt.run(duties.length ? 'supervisors_assigned' : (assignments.length ? 'seating_generated' : 'draft'), slotId);
    }
  })();

  res.json({ ...results, message: `Auto-schedule complete: ${results.created} slots, ${results.seated} students seated, ${results.supervisors} duties assigned.` });
}));

// ── SLOTS ────────────────────────────────────────────────────────────────────


router.get('/:cycleId/slots', asyncHandler(async (req, res) => {
  const db = getDb();
  const slots = db.prepare(`
    SELECT es.*,
      s.code AS subject_code, s.name AS subject_name,
      s.branch, s.year, s.semester AS subject_semester,
      s.abbreviation, s.course_type
    FROM exam_slots es
    JOIN subjects s ON s.id = es.subject_id
    WHERE es.cycle_id = ?
    ORDER BY es.exam_type DESC, es.date, es.start_time
  `).all(req.params.cycleId);

  const roomsStmt = db.prepare(`
    SELECT ra.*, c.room_no, c.block, c.capacity,
      (SELECT COUNT(*) FROM seat_assignments sa WHERE sa.room_allocation_id = ra.id) AS seated_count
    FROM room_allocations ra
    JOIN classrooms c ON c.id = ra.classroom_id
    WHERE ra.slot_id = ?
  `);
  const studentCountStmt = db.prepare('SELECT COUNT(*) AS cnt FROM slot_students WHERE slot_id=?');

  res.json(slots.map(slot => ({
    ...slot,
    rooms: roomsStmt.all(slot.id),
    student_count: studentCountStmt.get(slot.id)?.cnt || 0,
    room_count: roomsStmt.all(slot.id).length,
  })));
}));

router.post('/:cycleId/slots', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  const {
    subject_id, date, start_time, duration_mins,
    classroom_ids, exam_type = 'regular', exam_mode = 'offline',
  } = req.body;
  if (!subject_id || !date || !start_time)
    return res.status(400).json({ error: 'subject_id, date, start_time required' });

  // Validate subject exists
  const subject = db.prepare('SELECT * FROM subjects WHERE id=?').get(subject_id);
  if (!subject) return res.status(404).json({ error: 'Subject not found' });

  // Validate semester parity matches cycle
  const cycle = db.prepare('SELECT * FROM exam_cycles WHERE id=?').get(req.params.cycleId);
  if (!cycle) return res.status(404).json({ error: 'Cycle not found' });

  if (semParity(subject.semester) !== cycle.semester_type) {
    return res.status(400).json({
      error: `Semester mismatch: this cycle is ${cycle.semester_type}-semester but subject is Sem ${subject.semester} (${semParity(subject.semester)})`,
    });
  }

  // Backlog rule: if regular slots exist for this subject, backlog must be earlier
  if (exam_type === 'backlog') {
    const firstRegular = db.prepare(`
      SELECT MIN(date) AS min_date FROM exam_slots
      WHERE cycle_id=? AND subject_id=? AND exam_type='regular'
    `).get(req.params.cycleId, subject_id);
    if (firstRegular?.min_date && date >= firstRegular.min_date) {
      return res.status(400).json({
        error: `Backlog exam must be scheduled before the regular exam (${firstRegular.min_date})`,
      });
    }
  }

  const slotId = crypto.randomUUID();
  db.transaction(() => {
    db.prepare('INSERT INTO exam_slots (id, cycle_id, subject_id, date, start_time, duration_mins, exam_type, exam_mode) VALUES (?,?,?,?,?,?,?,?)')
      .run(slotId, req.params.cycleId, subject_id, date, start_time, parseInt(duration_mins) || 180, exam_type, exam_mode);

    // Assign classrooms (for offline exams)
    if (exam_mode === 'offline' && Array.isArray(classroom_ids) && classroom_ids.length) {
      const raStmt = db.prepare('INSERT OR IGNORE INTO room_allocations (id, slot_id, classroom_id) VALUES (?,?,?)');
      for (const cid of classroom_ids) raStmt.run(crypto.randomUUID(), slotId, cid);
    }

    // AUTO-ASSIGN STUDENTS: all active students in this year+branch+semester
    // For backlog: only students not already in a regular slot for this subject
    const autoStudents = db.prepare(`
      SELECT id FROM students
      WHERE is_active=1 AND year=? AND branch=? AND semester=?
    `).all(subject.year, subject.branch, subject.semester);

    const ssStmt = db.prepare('INSERT OR IGNORE INTO slot_students (slot_id, student_id) VALUES (?,?)');
    for (const s of autoStudents) ssStmt.run(slotId, s.id);
  })();

  const created = db.prepare(`
    SELECT es.*, s.code AS subject_code, s.name AS subject_name, s.branch, s.year
    FROM exam_slots es JOIN subjects s ON s.id=es.subject_id WHERE es.id=?
  `).get(slotId);
  const studentCount = db.prepare('SELECT COUNT(*) AS cnt FROM slot_students WHERE slot_id=?').get(slotId);
  res.status(201).json({ ...created, student_count: studentCount.cnt });
}));

router.put('/:cycleId/slots/:slotId', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  const { subject_id, date, start_time, duration_mins, classroom_ids, exam_type, exam_mode } = req.body;

  const subject = db.prepare('SELECT * FROM subjects WHERE id=?').get(subject_id);
  if (!subject) return res.status(404).json({ error: 'Subject not found' });

  const cycle = db.prepare('SELECT * FROM exam_cycles WHERE id=?').get(req.params.cycleId);
  if (semParity(subject.semester) !== cycle.semester_type) {
    return res.status(400).json({ error: `Semester parity mismatch for cycle type "${cycle.semester_type}"` });
  }

  db.transaction(() => {
    db.prepare('UPDATE exam_slots SET subject_id=?,date=?,start_time=?,duration_mins=?,exam_type=?,exam_mode=? WHERE id=?')
      .run(subject_id, date, start_time, parseInt(duration_mins), exam_type || 'regular', exam_mode || 'offline', req.params.slotId);

    if (Array.isArray(classroom_ids)) {
      db.prepare('DELETE FROM room_allocations WHERE slot_id=?').run(req.params.slotId);
      const raStmt = db.prepare('INSERT INTO room_allocations (id, slot_id, classroom_id) VALUES (?,?,?)');
      for (const cid of classroom_ids) raStmt.run(crypto.randomUUID(), req.params.slotId, cid);
    }
  })();

  res.json(db.prepare('SELECT * FROM exam_slots WHERE id=?').get(req.params.slotId));
}));

router.delete('/:cycleId/slots/:slotId', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM exam_slots WHERE id=?').run(req.params.slotId);
  res.json({ success: true });
}));

router.get('/:cycleId/slots/:slotId/students', asyncHandler(async (req, res) => {
  const db = getDb();
  res.json(db.prepare(`
    SELECT s.* FROM students s
    JOIN slot_students ss ON ss.student_id = s.id
    WHERE ss.slot_id = ?
    ORDER BY s.year, s.branch, s.section, s.roll_no
  `).all(req.params.slotId));
}));

// GET subjects valid for a cycle's semester_type
router.get('/:cycleId/valid-subjects', asyncHandler(async (req, res) => {
  const db = getDb();
  const cycle = db.prepare('SELECT * FROM exam_cycles WHERE id=?').get(req.params.cycleId);
  if (!cycle) return res.status(404).json({ error: 'Cycle not found' });
  // semester_type = 'odd' → semesters 1,3,5,7; 'even' → 2,4,6,8
  const validSems = cycle.semester_type === 'odd' ? [1,3,5,7] : [2,4,6,8];
  const placeholders = validSems.map(() => '?').join(',');
  const subjects = db.prepare(
    `SELECT * FROM subjects WHERE semester IN (${placeholders}) ORDER BY semester, code`
  ).all(...validSems);
  res.json(subjects);
}));

export default router;
