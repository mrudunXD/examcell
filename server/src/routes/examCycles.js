import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate, requireCoordinator } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { auditLog } from '../middleware/auditLog.js';
import { generateSeating } from '../services/seatingEngine.js';
import { assignSupervisors } from '../services/supervisorEngine.js';
import { broadcastUpdate } from '../services/socket.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();
router.use(authenticate);

// Semester parity helper
function semParity(sem) { return sem % 2 === 1 ? 'odd' : 'even'; }

// Student list query helper for branch/section separation
async function getStudentsForSubject(db, subject) {
  if (subject.branch === 'CSE') {
    const codeUpper = subject.code.toUpperCase();
    if (codeUpper.startsWith('AID')) {
      // Section AIDS only
      return await db.prepare(`
        SELECT id FROM students WHERE is_active=1 AND year=? AND branch='CSE' AND semester=? AND section='AIDS'
      `).all(subject.year, subject.semester);
    } else if (codeUpper.startsWith('CSE') && !codeUpper.includes('AID')) {
      // Standard sections only (not AIDS)
      return await db.prepare(`
        SELECT id FROM students WHERE is_active=1 AND year=? AND branch='CSE' AND semester=? AND section != 'AIDS'
      `).all(subject.year, subject.semester);
    } else {
      // Common/all sections
      return await db.prepare(`
        SELECT id FROM students WHERE is_active=1 AND year=? AND branch='CSE' AND semester=?
      `).all(subject.year, subject.semester);
    }
  } else {
    // Standard branch grouping
    return await db.prepare(`
      SELECT id FROM students WHERE is_active=1 AND year=? AND branch=? AND semester=?
    `).all(subject.year, subject.branch, subject.semester);
  }
}

// Date helpers
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
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
  res.json(await db.prepare('SELECT * FROM exam_cycles ORDER BY created_at DESC').all());
}));

router.post('/', requireCoordinator, auditLog('CREATE_CYCLE', 'exam_cycles', (req, data) => data?.id, (req, data) => `Created cycle ${data?.name}`), asyncHandler(async (req, res) => {
  const db = getDb();
  const { name, start_date, end_date, semester_type } = req.body;
  if (!name || !start_date || !end_date) return res.status(400).json({ error: 'name, start_date, end_date required' });
  if (!['odd', 'even'].includes(semester_type)) return res.status(400).json({ error: 'semester_type must be odd or even' });
  const id = crypto.randomUUID();
  await db.prepare('INSERT INTO exam_cycles (id, name, start_date, end_date, semester_type, created_by) VALUES (?,?,?,?,?,?)')
    .run(id, name.trim(), start_date, end_date, semester_type, req.user.id);
  res.status(201).json(await db.prepare('SELECT * FROM exam_cycles WHERE id=?').get(id));
}));

router.put('/:id', requireCoordinator, auditLog('UPDATE_CYCLE', 'exam_cycles', (req) => req.params.id, (req, data) => `Updated cycle ${data?.name} (status: ${data?.status})`), asyncHandler(async (req, res) => {
  const db = getDb();
  const { name, start_date, end_date, status, semester_type } = req.body;
  await db.prepare("UPDATE exam_cycles SET name=?,start_date=?,end_date=?,status=?,semester_type=?,updated_at=datetime('now') WHERE id=?")
    .run(name, start_date, end_date, status, semester_type || 'odd', req.params.id);
  res.json(await db.prepare('SELECT * FROM exam_cycles WHERE id=?').get(req.params.id));
}));

router.delete('/:id', requireCoordinator, auditLog('DELETE_CYCLE', 'exam_cycles', (req) => req.params.id, (req) => `Deleted cycle ID: ${req.params.id}`), asyncHandler(async (req, res) => {
  const db = getDb();
  await db.prepare('DELETE FROM exam_cycles WHERE id=?').run(req.params.id);
  res.json({ success: true });
}));

// POST /:id/activate — make this cycle "active", demote others to "draft"
router.post('/:id/activate', requireCoordinator, auditLog('ACTIVATE_CYCLE', 'exam_cycles', (req) => req.params.id, (req, data) => `Activated cycle ${data?.name}`), asyncHandler(async (req, res) => {
  const db = getDb();
  const cycle = await db.prepare('SELECT * FROM exam_cycles WHERE id=?').get(req.params.id);
  if (!cycle) return res.status(404).json({ error: 'Cycle not found' });

  await db.transaction(async () => {
    // Demote all other active cycles to draft
    await db.prepare("UPDATE exam_cycles SET status='draft', updated_at=datetime('now') WHERE status='active' AND id != ?")
      .run(req.params.id);
    // Promote this one to active
    await db.prepare("UPDATE exam_cycles SET status='active', updated_at=datetime('now') WHERE id=?")
      .run(req.params.id);
  })();

  res.json(await db.prepare('SELECT * FROM exam_cycles WHERE id=?').get(req.params.id));
}));

// POST /:id/duplicate — clone a cycle with all its draft slots, dates shifted +6 months
router.post('/:id/duplicate', requireCoordinator, auditLog('DUPLICATE_CYCLE', 'exam_cycles', (req) => req.params.id, (req, data) => `Duplicated cycle ID: ${req.params.id} to new copy ID: ${data?.id}`), asyncHandler(async (req, res) => {
  const db = getDb();
  const src = await db.prepare('SELECT * FROM exam_cycles WHERE id=?').get(req.params.id);
  if (!src) return res.status(404).json({ error: 'Cycle not found' });

  function shiftDate(d, months) {
    const dt = new Date(d + 'T00:00:00');
    dt.setMonth(dt.getMonth() + months);
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  const newId = crypto.randomUUID();
  const newStart = shiftDate(src.start_date, 6);
  const newEnd   = shiftDate(src.end_date, 6);

  // Prepare OUTSIDE transaction
  const insertCycle = await db.prepare(
    `INSERT INTO exam_cycles (id, name, start_date, end_date, semester_type, status, created_by)
     VALUES (?,?,?,?,?,  'draft',?)`
  );
  const insertSlot = await db.prepare(
    `INSERT INTO exam_slots (id, cycle_id, subject_id, date, start_time, duration_mins, exam_type, exam_mode, status)
     VALUES (?,?,?,?,?,?,?,?,'draft')`
  );
  const slots = await db.prepare("SELECT * FROM exam_slots WHERE cycle_id=? AND status='draft'").all(src.id);

  await db.transaction(async () => {
    await insertCycle.run(newId, src.name + ' (Copy)', newStart, newEnd, src.semester_type || 'odd', req.user.id);
    for (const s of slots) {
      await insertSlot.run(
        crypto.randomUUID(), newId, s.subject_id,
        shiftDate(s.date, 6), s.start_time, s.duration_mins, s.exam_type, s.exam_mode
      );
    }
  })();

  res.status(201).json(await db.prepare('SELECT * FROM exam_cycles WHERE id=?').get(newId));
}));


// POST /:id/auto-schedule — full automatic scheduling pipeline
const runSolver = (inputData) => {
  return new Promise((resolve, reject) => {
    const pyPath = path.join(__dirname, '../services/scheduler.py');
    const solverProcess = spawn('python', [pyPath]);
    
    let stdout = '';
    let stderr = '';
    
    solverProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    solverProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    solverProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Solver process failed with code ${code}. Stderr: ${stderr}`));
        return;
      }
      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (err) {
        reject(new Error(`Failed to parse solver output: ${stdout}. Err: ${err.message}`));
      }
    });
    
    solverProcess.stdin.write(JSON.stringify(inputData));
    solverProcess.stdin.end();
  });
};

router.post('/:id/auto-schedule', requireCoordinator, auditLog('AUTO_SCHEDULE_CYCLE', 'exam_cycles', (req) => req.params.id, (req, data) => `Auto-scheduled ${data?.created || 0} exam slots for cycle ID: ${req.params.id}`), asyncHandler(async (req, res) => {
  const db = getDb();
  const cycle = await db.prepare('SELECT * FROM exam_cycles WHERE id=?').get(req.params.id);
  if (!cycle) return res.status(404).json({ error: 'Cycle not found' });

  const { start_date: custom_start, end_date: custom_end, duration_mins, shifts: custom_shifts, order_by_year } = req.body;
  const startDate = custom_start || cycle.start_date;
  const endDate = custom_end || cycle.end_date;

  if (startDate > endDate) {
    return res.status(400).json({ error: 'Start date must be on or before end date.' });
  }

  const { semester_type } = cycle;
  const parityFilter = semester_type === 'odd' ? 'semester % 2 = 1' : 'semester % 2 = 0';

  // 1. Get unique subjects (one slot per subject code)
  const subjects = await db.prepare(`SELECT * FROM subjects WHERE ${parityFilter} GROUP BY code ORDER BY code`).all();
  if (!subjects.length) return res.status(400).json({ error: `No subjects found for ${semester_type} semester cycle.` });
  if (subjects.length > 500) return res.status(400).json({ error: 'Too many subjects; please schedule manually.' });

  // 2. Build valid date pool (skip Sundays, cap at 100 dates)
  const validDates = [];
  let cur = startDate;
  while (cur <= endDate && validDates.length < 100) {
    if (!isSunday(cur)) validDates.push(cur);
    cur = addDays(cur, 1);
  }
  if (!validDates.length) return res.status(400).json({ error: 'No valid exam dates (excluding Sundays) in the specified range.' });

  // Gather required database sets for solver
  const teaches = await db.prepare("SELECT faculty_id, subject_id FROM faculty_subjects").all();
  const classrooms = await db.prepare("SELECT * FROM classrooms WHERE is_active=1").all();
  const faculty = await db.prepare("SELECT id, name, email, department FROM users WHERE role='faculty' AND is_active=1").all();
  const students = await db.prepare("SELECT id, name, prn, roll_no, branch, year, semester, section FROM students WHERE is_active=1").all();

  const solverShifts = custom_shifts || [
    { id: '1', name: 'Shift 1', start_time: '09:30', duration_mins: 180 },
    { id: '2', name: 'Shift 2', start_time: '13:30', duration_mins: 180 }
  ];

  if (duration_mins && !custom_shifts) {
    solverShifts.forEach(s => s.duration_mins = parseInt(duration_mins));
  }

  // Map branch of AIDS students and subjects to 'CSE (AIDS)' for the solver to keep them separated
  const solverStudents = students.map(s => {
    if (s.branch === 'CSE' && s.section === 'AIDS') {
      return { ...s, branch: 'CSE (AIDS)' };
    }
    return s;
  });

  const solverSubjects = subjects.map(s => {
    if (s.branch === 'CSE' && s.code.toUpperCase().trim().startsWith('AID')) {
      return { ...s, branch: 'CSE (AIDS)' };
    }
    return s;
  });

  const inputData = {
    cycle: {
      id: cycle.id,
      name: cycle.name,
      start_date: startDate,
      end_date: endDate,
      semester_type: cycle.semester_type
    },
    subjects: solverSubjects,
    students: solverStudents,
    classrooms,
    faculty,
    teaches,
    settings: {
      time_limit_seconds: 30,
      shifts: solverShifts,
      dates: validDates,
      order_by_year: order_by_year !== false
    }
  };

  try {
    const result = await runSolver(inputData);
    
    if (result.status === 'SUCCESS') {
      const createdCount = result.slots.length;
      
      await db.transaction(async () => {
        // Clear all previous slots and related seating/supervisor data for this cycle
        await db.prepare("DELETE FROM exam_slots WHERE cycle_id=?").run(cycle.id);
        await db.prepare("DELETE FROM conflicts WHERE cycle_id=?").run(cycle.id);

        const slotStmt = await db.prepare(`
          INSERT INTO exam_slots (id, cycle_id, subject_id, date, start_time, duration_mins, exam_type, exam_mode, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft')
        `);

        for (const s of result.slots) {
          const slotId = crypto.randomUUID();
          await slotStmt.run(slotId, cycle.id, s.subject_id, s.date, s.start_time, s.duration_mins, s.exam_type, s.exam_mode);

          // Link students to slot
          const subj = await db.prepare('SELECT * FROM subjects WHERE id=?').get(s.subject_id);
          const autoStudents = await getStudentsForSubject(db, subj);

          const ssStmt = await db.prepare('INSERT OR IGNORE INTO slot_students (slot_id, student_id) VALUES (?,?)');
          for (const stud of autoStudents) {
            await ssStmt.run(slotId, stud.id);
          }

          // Insert room allocations
          const raMap = {};
          const raStmt = await db.prepare('INSERT INTO room_allocations (id, slot_id, classroom_id) VALUES (?,?,?)');
          for (const room of s.rooms) {
            const raId = crypto.randomUUID();
            await raStmt.run(raId, slotId, room.classroom_id);
            raMap[room.classroom_id] = raId;
          }

          // Generate seating
          const studentsList = await db.prepare(`
            SELECT st.* FROM students st
            JOIN slot_students ss ON ss.student_id = st.id
            WHERE ss.slot_id = ?
          `).all(slotId);

          const roomsList = await db.prepare(`
            SELECT ra.id, ra.classroom_id, c.room_no, c.block, c.capacity, c.bench_rows, c.bench_cols
            FROM room_allocations ra JOIN classrooms c ON c.id = ra.classroom_id
            WHERE ra.slot_id = ?
          `).all(slotId);

          if (studentsList.length && roomsList.length) {
            const { assignments, conflicts: seatingConflicts } = generateSeating(studentsList, roomsList);
            const seatStmt = await db.prepare('INSERT INTO seat_assignments (id, student_id, room_allocation_id, bench_row, bench_col) VALUES (?, ?, ?, ?, ?)');
            for (const a of assignments) {
              await seatStmt.run(crypto.randomUUID(), a.student_id, a.room_allocation_id, a.bench_row, a.bench_col);
            }
            const cStmt = await db.prepare('INSERT INTO conflicts (id, slot_id, cycle_id, type, description, affected_entities, suggested_resolution) VALUES (?, ?, ?, ?, ?, ?, ?)');
            for (const c of seatingConflicts) {
              await cStmt.run(crypto.randomUUID(), slotId, cycle.id, c.type, c.description, c.affected_entities || null, c.suggested_resolution || null);
            }
          }

          // Insert invigilators
          const slotInvigilators = result.invigilators.filter(iv => iv.date === s.date && iv.start_time === s.start_time);
          const invStmt = await db.prepare(`
            INSERT INTO supervisor_duties (id, faculty_id, room_allocation_id, role, acknowledged)
            VALUES (?, ?, ?, ?, 0)
          `);
          for (const iv of slotInvigilators) {
            const raId = raMap[iv.classroom_id];
            if (raId) {
              const existingDuties = await db.prepare('SELECT COUNT(*) as cnt FROM supervisor_duties WHERE room_allocation_id=?').get(raId);
              const role = (existingDuties && existingDuties.cnt > 0) ? 'co' : 'primary';
              await invStmt.run(crypto.randomUUID(), iv.faculty_id, raId, role);
            }
          }
          
          await db.prepare("UPDATE exam_slots SET status='supervisors_assigned' WHERE id=?").run(slotId);
        }
      })();

      broadcastUpdate('SCHEDULE_REGENERATED', { cycleId: cycle.id });

      res.json({
        created: createdCount,
        message: `Auto-schedule complete: scheduled ${createdCount} slots, allocated rooms, generated seating layouts, and assigned supervisors successfully.`
      });
    } else {
      // SUCCESS status false, meaning solver failed or returned conflicts
      await db.transaction(async () => {
        await db.prepare("DELETE FROM conflicts WHERE cycle_id=?").run(cycle.id);
        const cStmt = await db.prepare('INSERT INTO conflicts (id, cycle_id, type, description, suggested_resolution) VALUES (?, ?, ?, ?, ?)');
        for (const c of result.conflicts) {
          await cStmt.run(crypto.randomUUID(), cycle.id, c.type, c.description, c.suggested_resolution || null);
        }
      })();

      res.status(422).json({
        error: "Scheduling constraints could not be satisfied.",
        conflicts: result.conflicts
      });
    }
  } catch (err) {
    console.error('❌ Auto-schedule error:', err.message);
    res.status(500).json({ error: `Solver failed: ${err.message}` });
  }
}));

// ── SLOTS ────────────────────────────────────────────────────────────────────


router.get('/:cycleId/slots', asyncHandler(async (req, res) => {
  const db = getDb();
  const slots = await db.prepare(`
    SELECT es.*,
      s.code AS subject_code, s.name AS subject_name,
      s.branch, s.year, s.semester AS subject_semester,
      s.abbreviation, s.course_type
    FROM exam_slots es
    JOIN subjects s ON s.id = es.subject_id
    WHERE es.cycle_id = ?
    ORDER BY es.exam_type DESC, es.date, es.start_time
  `).all(req.params.cycleId);

  const roomsStmt = await db.prepare(`
    SELECT ra.*, c.room_no, c.block, c.capacity,
      (SELECT COUNT(*) FROM seat_assignments sa WHERE sa.room_allocation_id = ra.id) AS seated_count
    FROM room_allocations ra
    JOIN classrooms c ON c.id = ra.classroom_id
    WHERE ra.slot_id = ?
  `);
  const studentCountStmt = await db.prepare('SELECT COUNT(*) AS cnt FROM slot_students WHERE slot_id=?');

  const formattedSlots = await Promise.all(slots.map(async slot => ({
    ...slot,
    rooms: await roomsStmt.all(slot.id),
    student_count: (await studentCountStmt.get(slot.id))?.cnt || 0,
    room_count: (await roomsStmt.all(slot.id)).length,
  })));

  res.json(formattedSlots);
}));

// Helper function to auto assign seating and supervisors immediately
async function autoAssignSeatingAndSupervisors(slotId, db, forceSeating = false) {
  const slot = await db.prepare('SELECT * FROM exam_slots WHERE id=?').get(slotId);
  if (!slot) return;

  // 1. Generate Seating Arrangement
  const students = await db.prepare(`
    SELECT st.* FROM students st
    JOIN slot_students ss ON ss.student_id = st.id
    WHERE ss.slot_id = ?
  `).all(slotId);

  const rooms = await db.prepare(`
    SELECT ra.id, ra.classroom_id, c.room_no, c.block, c.capacity, c.bench_rows, c.bench_cols
    FROM room_allocations ra JOIN classrooms c ON c.id = ra.classroom_id
    WHERE ra.slot_id = ?
    ORDER BY c.room_no
  `).all(slotId);

  if (!students.length || !rooms.length) return;

  const existingSeatingCount = (await db.prepare(`
    SELECT COUNT(*) as cnt FROM seat_assignments
    WHERE room_allocation_id IN (SELECT id FROM room_allocations WHERE slot_id = ?)
  `).get(slotId))?.cnt || 0;

  const shouldGenerateSeating = forceSeating || existingSeatingCount === 0;

  if (shouldGenerateSeating) {
    const { assignments, conflicts: seatingConflicts } = generateSeating(students, rooms);

    await db.transaction(async () => {
      const raIds = rooms.map(r => r.id);
      for (const raId of raIds) {
        await db.prepare('DELETE FROM seat_assignments WHERE room_allocation_id=?').run(raId);
      }
      await db.prepare("DELETE FROM conflicts WHERE slot_id=? AND type IN ('CAPACITY_OVERFLOW','BRANCH_MIXING_FAILED','INSUFFICIENT_ROOM_CAPACITY','NO_STUDENTS','NO_ROOMS')").run(slotId);

      const stmt = await db.prepare('INSERT INTO seat_assignments (id, student_id, room_allocation_id, bench_row, bench_col) VALUES (?, ?, ?, ?, ?)');
      for (const a of assignments) {
        await stmt.run(crypto.randomUUID(), a.student_id, a.room_allocation_id, a.bench_row, a.bench_col);
      }

      const cStmt = await db.prepare('INSERT INTO conflicts (id, slot_id, cycle_id, type, description, affected_entities, suggested_resolution) VALUES (?, ?, ?, ?, ?, ?, ?)');
      for (const c of seatingConflicts) {
        await cStmt.run(crypto.randomUUID(), slotId, slot.cycle_id, c.type, c.description, c.affected_entities || null, c.suggested_resolution || null);
      }

      await db.prepare("UPDATE exam_slots SET status='seating_generated' WHERE id=?").run(slotId);
    })();
  }

  // 2. Assign Supervisors
  const updatedRooms = await db.prepare(`
    SELECT ra.id, ra.classroom_id, c.room_no,
      (SELECT COUNT(*) FROM seat_assignments sa WHERE sa.room_allocation_id = ra.id) as seated_count
    FROM room_allocations ra JOIN classrooms c ON c.id = ra.classroom_id
    WHERE ra.slot_id = ?
  `).all(slotId);

  const faculty = await db.prepare("SELECT id, name, department FROM users WHERE role='faculty' AND is_active=1").all();
  const subjectStmt = await db.prepare('SELECT subject_id FROM faculty_subjects WHERE faculty_id=?');
  const allFaculty = faculty.map(f => ({
    ...f,
    subject_ids: subjectStmt.all(f.id).map(r => r.subject_id)
  }));

  const globalWorkload = {};
  for (const f of faculty) globalWorkload[f.id] = 0;
  const allDutyCounts = await db.prepare(`
    SELECT sd.faculty_id, COUNT(*) as cnt
    FROM supervisor_duties sd
    JOIN room_allocations ra ON ra.id = sd.room_allocation_id
    WHERE ra.slot_id != ?
    GROUP BY sd.faculty_id
  `).all(slotId);
  for (const row of allDutyCounts) {
    if (globalWorkload[row.faculty_id] !== undefined) globalWorkload[row.faculty_id] = row.cnt;
  }

  const slotWithRooms = [{ ...slot, rooms: updatedRooms }];
  const { duties, conflicts: supervisorConflicts } = assignSupervisors(slotWithRooms, allFaculty, globalWorkload);

  await db.transaction(async () => {
    const raIds = updatedRooms.map(r => r.id);
    for (const raId of raIds) {
      await db.prepare('DELETE FROM supervisor_duties WHERE room_allocation_id=?').run(raId);
    }
    await db.prepare("DELETE FROM conflicts WHERE slot_id=? AND type IN ('NO_SUPERVISOR_AVAILABLE','NO_CO_SUPERVISOR_AVAILABLE')").run(slotId);

    const stmt = await db.prepare('INSERT INTO supervisor_duties (id, faculty_id, room_allocation_id, role) VALUES (?, ?, ?, ?)');
    for (const d of duties) await stmt.run(d.id, d.faculty_id, d.room_allocation_id, d.role);

    const cStmt = await db.prepare('INSERT INTO conflicts (id, slot_id, cycle_id, type, description, suggested_resolution) VALUES (?, ?, ?, ?, ?, ?)');
    for (const c of supervisorConflicts) await cStmt.run(crypto.randomUUID(), slotId, slot.cycle_id, c.type, c.description, c.suggested_resolution || null);

    await db.prepare("UPDATE exam_slots SET status='supervisors_assigned' WHERE id=? AND status != 'finalised'").run(slotId);
  })();
}

router.post('/:cycleId/slots', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  const {
    subject_id, date, start_time, duration_mins,
    classroom_ids, exam_type = 'regular', exam_mode = 'offline',
  } = req.body;
  if (!subject_id || !date || !start_time)
    return res.status(400).json({ error: 'subject_id, date, start_time required' });

  // Validate subject exists
  const subject = await db.prepare('SELECT * FROM subjects WHERE id=?').get(subject_id);
  if (!subject) return res.status(404).json({ error: 'Subject not found' });

  // Validate semester parity matches cycle
  const cycle = await db.prepare('SELECT * FROM exam_cycles WHERE id=?').get(req.params.cycleId);
  if (!cycle) return res.status(404).json({ error: 'Cycle not found' });

  if (semParity(subject.semester) !== cycle.semester_type) {
    return res.status(400).json({
      error: `Semester mismatch: this cycle is ${cycle.semester_type}-semester but subject is Sem ${subject.semester} (${semParity(subject.semester)})`,
    });
  }

  // Backlog rule: if regular slots exist for this subject, backlog must be earlier
  if (exam_type === 'backlog') {
    const firstRegular = await db.prepare(`
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
  await db.transaction(async () => {
    await db.prepare('INSERT INTO exam_slots (id, cycle_id, subject_id, date, start_time, duration_mins, exam_type, exam_mode) VALUES (?,?,?,?,?,?,?,?)')
      .run(slotId, req.params.cycleId, subject_id, date, start_time, parseInt(duration_mins) || 180, exam_type, exam_mode);

    // Assign classrooms (for offline exams)
    if (exam_mode === 'offline' && Array.isArray(classroom_ids) && classroom_ids.length) {
      const raStmt = await db.prepare('INSERT OR IGNORE INTO room_allocations (id, slot_id, classroom_id) VALUES (?,?,?)');
      for (const cid of classroom_ids) await raStmt.run(crypto.randomUUID(), slotId, cid);
    }

    const autoStudents = await getStudentsForSubject(db, subject);

    const ssStmt = await db.prepare('INSERT OR IGNORE INTO slot_students (slot_id, student_id) VALUES (?,?)');
    for (const s of autoStudents) await ssStmt.run(slotId, s.id);
  })();

  // AUTO ALLOCATE SEATING AND SUPERVISORS IMMEDIATELY FOR OFFLINE EXAMS
  if (exam_mode === 'offline' && Array.isArray(classroom_ids) && classroom_ids.length) {
    try {
      await autoAssignSeatingAndSupervisors(slotId, db);
    } catch (err) {
      console.error("Auto allocation on slot creation failed:", err);
    }
  }

  const created = await db.prepare(`
    SELECT es.*, s.code AS subject_code, s.name AS subject_name, s.branch, s.year
    FROM exam_slots es JOIN subjects s ON s.id=es.subject_id WHERE es.id=?
  `).get(slotId);
  const studentCount = await db.prepare('SELECT COUNT(*) AS cnt FROM slot_students WHERE slot_id=?').get(slotId);
  res.status(201).json({ ...created, student_count: studentCount.cnt });
}));

router.put('/:cycleId/slots/:slotId', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  const { subject_id, date, start_time, duration_mins, classroom_ids, exam_type, exam_mode } = req.body;

  const subject = await db.prepare('SELECT * FROM subjects WHERE id=?').get(subject_id);
  if (!subject) return res.status(404).json({ error: 'Subject not found' });

  const cycle = await db.prepare('SELECT * FROM exam_cycles WHERE id=?').get(req.params.cycleId);
  if (semParity(subject.semester) !== cycle.semester_type) {
    return res.status(400).json({ error: `Semester parity mismatch for cycle type "${cycle.semester_type}"` });
  }

  const oldSlot = await db.prepare('SELECT * FROM exam_slots WHERE id=?').get(req.params.slotId);
  if (!oldSlot) return res.status(404).json({ error: 'Slot not found' });

  const oldRoomIds = await db.prepare('SELECT classroom_id FROM room_allocations WHERE slot_id=?').all(req.params.slotId).map(r => r.classroom_id);
  const subjectChanged = oldSlot.subject_id !== subject_id;
  const classroomsChanged = Array.isArray(classroom_ids) && (
    oldRoomIds.length !== classroom_ids.length ||
    !oldRoomIds.every(id => classroom_ids.includes(id))
  );

  await db.transaction(async () => {
    await db.prepare('UPDATE exam_slots SET subject_id=?,date=?,start_time=?,duration_mins=?,exam_type=?,exam_mode=? WHERE id=?')
      .run(subject_id, date, start_time, parseInt(duration_mins), exam_type || 'regular', exam_mode || 'offline', req.params.slotId);

    // Always sync/refresh the students in slot_students to match latest students in the database
    await db.prepare('DELETE FROM slot_students WHERE slot_id=?').run(req.params.slotId);
    const autoStudents = await getStudentsForSubject(db, subject);

    const ssStmt = await db.prepare('INSERT OR IGNORE INTO slot_students (slot_id, student_id) VALUES (?,?)');
    for (const s of autoStudents) await ssStmt.run(req.params.slotId, s.id);

    if (Array.isArray(classroom_ids) && classroomsChanged) {
      await db.prepare('DELETE FROM room_allocations WHERE slot_id=?').run(req.params.slotId);
      const raStmt = await db.prepare('INSERT INTO room_allocations (id, slot_id, classroom_id) VALUES (?,?,?)');
      for (const cid of classroom_ids) await raStmt.run(crypto.randomUUID(), req.params.slotId, cid);
    }
  })();

  // AUTO ALLOCATE SEATING AND SUPERVISORS IMMEDIATELY FOR OFFLINE EXAMS ON UPDATE
  if (exam_mode === 'offline' && Array.isArray(classroom_ids) && classroom_ids.length) {
    try {
      const forceSeatingRegen = subjectChanged || classroomsChanged;
      await autoAssignSeatingAndSupervisors(req.params.slotId, db, forceSeatingRegen);
    } catch (err) {
      console.error("Auto allocation on slot update failed:", err);
    }
  }

  res.json(await db.prepare('SELECT * FROM exam_slots WHERE id=?').get(req.params.slotId));
}));

router.delete('/:cycleId/slots/:slotId', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  await db.prepare('DELETE FROM exam_slots WHERE id=?').run(req.params.slotId);
  res.json({ success: true });
}));

router.get('/:cycleId/slots/:slotId/students', asyncHandler(async (req, res) => {
  const db = getDb();
  res.json(await db.prepare(`
    SELECT s.* FROM students s
    JOIN slot_students ss ON ss.student_id = s.id
    WHERE ss.slot_id = ?
    ORDER BY s.year, s.branch, s.section, s.roll_no
  `).all(req.params.slotId));
}));

// GET subjects valid for a cycle's semester_type
router.get('/:cycleId/valid-subjects', asyncHandler(async (req, res) => {
  const db = getDb();
  const cycle = await db.prepare('SELECT * FROM exam_cycles WHERE id=?').get(req.params.cycleId);
  if (!cycle) return res.status(404).json({ error: 'Cycle not found' });
  // semester_type = 'odd' → semesters 1,3,5,7; 'even' → 2,4,6,8
  const validSems = cycle.semester_type === 'odd' ? [1,3,5,7] : [2,4,6,8];
  const placeholders = validSems.map(() => '?').join(',');
  const subjects = await db.prepare(
    `SELECT * FROM subjects WHERE semester IN (${placeholders}) ORDER BY semester, code`
  ).all(...validSems);
  res.json(subjects);
}));

export default router;
