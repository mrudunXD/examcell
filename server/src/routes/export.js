import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate, requireCoordinator } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { generateSeatingPDF, generateDutySheetPDF, generateTimetablePDF, generateAttendancePDF } from '../services/pdfGenerator.js';

const router = Router();
router.use(authenticate);

// Check conflicts before export
function checkConflicts(db, slotId) {
  return db.prepare("SELECT COUNT(*) as cnt FROM conflicts WHERE slot_id=? AND status='open'").get(slotId)?.cnt || 0;
}

// GET seating chart PDF for a room allocation
router.get('/seating/:roomAllocationId', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  const ra = db.prepare('SELECT * FROM room_allocations WHERE id=?').get(req.params.roomAllocationId);
  if (!ra) return res.status(404).json({ error: 'Room allocation not found' });

  const openConflicts = checkConflicts(db, ra.slot_id);
  if (openConflicts > 0) {
    return res.status(409).json({ error: `Cannot export: ${openConflicts} unresolved conflict(s). Resolve all conflicts first.` });
  }

  const slot = db.prepare(`
    SELECT es.*, s.name as subject_name, s.code as subject_code, ec.name as cycle_name
    FROM exam_slots es
    JOIN subjects s ON s.id=es.subject_id
    JOIN exam_cycles ec ON ec.id=es.cycle_id
    WHERE es.id=?
  `).get(ra.slot_id);

  const classroom = db.prepare('SELECT * FROM classrooms WHERE id=?').get(ra.classroom_id);

  const assignments = db.prepare(`
    SELECT sa.bench_row, sa.bench_col,
      st.name as student_name, st.prn, st.roll_no, st.branch, st.year
    FROM seat_assignments sa
    JOIN students st ON st.id=sa.student_id
    WHERE sa.room_allocation_id=?
    ORDER BY sa.bench_row, sa.bench_col
  `).all(req.params.roomAllocationId);

  const pdfBuffer = await generateSeatingPDF({ slot, classroom, assignments });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="seating_${classroom.room_no}_${slot.date}.pdf"`);
  res.send(pdfBuffer);
}));

// GET duty sheet PDF for a faculty member
router.get('/duty/:facultyId/:cycleId', asyncHandler(async (req, res) => {
  const db = getDb();
  // Faculty can only download their own duty sheet
  if (req.user.role === 'faculty' && req.user.id !== req.params.facultyId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const faculty = db.prepare("SELECT id, name, email, department FROM users WHERE id=?").get(req.params.facultyId);
  if (!faculty) return res.status(404).json({ error: 'Faculty not found' });

  const duties = db.prepare(`
    SELECT sd.role, sd.acknowledged,
      c.room_no, c.block,
      es.date, es.start_time, es.duration_mins,
      s.name as subject_name, s.code as subject_code,
      ec.name as cycle_name,
      (SELECT u2.name FROM supervisor_duties sd2 JOIN users u2 ON u2.id=sd2.faculty_id
       WHERE sd2.room_allocation_id=sd.room_allocation_id AND sd2.faculty_id != sd.faculty_id LIMIT 1) as co_supervisor_name
    FROM supervisor_duties sd
    JOIN room_allocations ra ON ra.id=sd.room_allocation_id
    JOIN classrooms c ON c.id=ra.classroom_id
    JOIN exam_slots es ON es.id=ra.slot_id
    JOIN subjects s ON s.id=es.subject_id
    JOIN exam_cycles ec ON ec.id=es.cycle_id
    WHERE sd.faculty_id=? AND es.cycle_id=?
    ORDER BY es.date, es.start_time
  `).all(req.params.facultyId, req.params.cycleId);

  const pdfBuffer = await generateDutySheetPDF({ faculty, duties });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="duty_${faculty.name.replace(/\s+/g,'_')}.pdf"`);
  res.send(pdfBuffer);
}));

// GET timetable PDF for a cycle
router.get('/timetable/:cycleId', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  const cycle = db.prepare('SELECT * FROM exam_cycles WHERE id=?').get(req.params.cycleId);
  if (!cycle) return res.status(404).json({ error: 'Cycle not found' });

  const slots = db.prepare(`
    SELECT es.date, es.start_time, es.duration_mins, es.status,
      s.name as subject_name, s.code as subject_code, s.branch, s.year,
      COUNT(DISTINCT ss.student_id) as student_count,
      COUNT(DISTINCT ra.id) as room_count
    FROM exam_slots es
    JOIN subjects s ON s.id=es.subject_id
    LEFT JOIN slot_students ss ON ss.slot_id=es.id
    LEFT JOIN room_allocations ra ON ra.slot_id=es.id
    WHERE es.cycle_id=?
    GROUP BY es.id
    ORDER BY es.date, es.start_time
  `).all(req.params.cycleId);

  const pdfBuffer = await generateTimetablePDF({ cycle, slots });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="timetable_${cycle.name.replace(/\s+/g,'_')}.pdf"`);
  res.send(pdfBuffer);
}));

// GET attendance sheet PDF for a room allocation
router.get('/attendance/:roomAllocationId', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  const ra = db.prepare('SELECT * FROM room_allocations WHERE id=?').get(req.params.roomAllocationId);
  if (!ra) return res.status(404).json({ error: 'Room allocation not found' });

  const slot = db.prepare(`
    SELECT es.*, s.name as subject_name, s.code as subject_code
    FROM exam_slots es JOIN subjects s ON s.id=es.subject_id
    WHERE es.id=?
  `).get(ra.slot_id);
  const classroom = db.prepare('SELECT * FROM classrooms WHERE id=?').get(ra.classroom_id);

  const students = db.prepare(`
    SELECT st.name, st.prn, st.roll_no, st.branch, st.year, sa.bench_row, sa.bench_col
    FROM seat_assignments sa
    JOIN students st ON st.id=sa.student_id
    WHERE sa.room_allocation_id=?
    ORDER BY st.roll_no
  `).all(req.params.roomAllocationId);

  const pdfBuffer = await generateAttendancePDF({ slot, classroom, students });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="attendance_${classroom.room_no}_${slot.date}.pdf"`);
  res.send(pdfBuffer);
}));

export default router;
