import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate, requireCoordinator } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

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

  // 1. Get unique subjects (one slot per subject code)
  const subjects = db.prepare(`SELECT * FROM subjects WHERE ${parityFilter} GROUP BY code ORDER BY code`).all();
  if (!subjects.length) return res.status(400).json({ error: `No subjects found for ${semester_type} semester cycle.` });
  if (subjects.length > 500) return res.status(400).json({ error: 'Too many subjects; please schedule manually.' });

  // 2. Build valid date pool (skip Sundays, cap at 100 dates)
  const validDates = [];
  let cur = start_date;
  while (cur <= end_date && validDates.length < 100) {
    if (!isSunday(cur)) validDates.push(cur);
    cur = addDays(cur, 1);
  }
  if (!validDates.length) return res.status(400).json({ error: 'No valid exam dates in the cycle range.' });

  // 3. Group subjects by semester — one slot per subject per day, spread across semesters
  const semQueues = {};
  for (const s of subjects) {
    const key = `sem_${s.semester}`;
    if (!semQueues[key]) semQueues[key] = [];
    semQueues[key].push(s);
  }

  // 4. Round-robin by semester: each day assigns one subject per semester
  const scheduled = [];
  let dateIdx = 0;
  const semKeys = Object.keys(semQueues).sort();
  let hasMore = true;
  while (hasMore) {
    hasMore = false;
    if (dateIdx >= validDates.length) dateIdx = validDates.length - 1;
    for (const key of semKeys) {
      if (semQueues[key].length === 0) continue;
      hasMore = true;
      scheduled.push({ subject: semQueues[key].shift(), date: validDates[dateIdx] });
    }
    if (hasMore) dateIdx++;
  }

  // 5. Create ONLY exam slots in a small, safe transaction (NO seating/supervisors here)
  const results = { created: 0, warnings: [] };
  try {
    db.transaction(() => {
      // Delete only draft slots — preserve any finalised/approved slots
      db.prepare("DELETE FROM exam_slots WHERE cycle_id=? AND status='draft'").run(cycle.id);

      const slotStmt = db.prepare(
        `INSERT OR IGNORE INTO exam_slots
           (id, cycle_id, subject_id, date, start_time, duration_mins, exam_type, exam_mode, status)
         VALUES (?, ?, ?, ?, '09:30', 180, 'regular', 'offline', 'draft')`
      );

      for (const { subject, date } of scheduled) {
        const slotId = crypto.randomUUID();
        const info = slotStmt.run(slotId, cycle.id, subject.id, date);
        if (info.changes > 0) results.created++;
      }
    })();
  } catch (err) {
    console.error('❌ Auto-schedule error:', err.message);
    return res.status(500).json({ error: `Auto-schedule failed: ${err.message}` });
  }

  res.json({
    ...results,
    message: `Auto-schedule complete: ${results.created} exam slots created. Open each slot to generate seating and assign supervisors.`,
  });
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
