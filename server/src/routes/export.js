import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate, requireCoordinator } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { generateSeatingPDF, generateDutySheetPDF, generateTimetablePDF, generateAttendancePDF } from '../services/pdfGenerator.js';
import { formatDate, formatTime } from '../utils/format.js';

const router = Router();
router.use(authenticate);

// Check conflicts before export
async function checkConflicts(db, slotId) {
  return (await db.prepare("SELECT COUNT(*) as cnt FROM conflicts WHERE slot_id=? AND status='open'").get(slotId))?.cnt || 0;
}

// GET seating chart PDF for a room allocation
router.get('/seating/:roomAllocationId', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  const ra = await db.prepare('SELECT * FROM room_allocations WHERE id=?').get(req.params.roomAllocationId);
  if (!ra) return res.status(404).json({ error: 'Room allocation not found' });

  const openConflicts = await checkConflicts(db, ra.slot_id);
  if (openConflicts > 0) {
    return res.status(409).json({ error: `Cannot export: ${openConflicts} unresolved conflict(s). Resolve all conflicts first.` });
  }

  const slot = await db.prepare(`
    SELECT es.*, s.name as subject_name, s.code as subject_code, ec.name as cycle_name
    FROM exam_slots es
    JOIN subjects s ON s.id=es.subject_id
    JOIN exam_cycles ec ON ec.id=es.cycle_id
    WHERE es.id=?
  `).get(ra.slot_id);

  const classroom = await db.prepare('SELECT * FROM classrooms WHERE id=?').get(ra.classroom_id);

  const assignments = await db.prepare(`
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
  if (req.user.role === 'faculty') {
    if (req.user.id !== req.params.facultyId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const cycle = await db.prepare('SELECT status FROM exam_cycles WHERE id=?').get(req.params.cycleId);
    if (!cycle || cycle.status !== 'active') {
      return res.status(403).json({ error: 'Duties are not visible until the exam cycle is set active.' });
    }
  }

  const faculty = await db.prepare("SELECT id, name, email, department FROM users WHERE id=?").get(req.params.facultyId);
  if (!faculty) return res.status(404).json({ error: 'Faculty not found' });

  const duties = await db.prepare(`
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
  const cycle = await db.prepare('SELECT * FROM exam_cycles WHERE id=?').get(req.params.cycleId);
  if (!cycle) return res.status(404).json({ error: 'Cycle not found' });

  const slots = await db.prepare(`
    SELECT es.date, es.start_time, es.duration_mins, es.status,
      s.name as subject_name, s.code as subject_code, s.branch, s.year, s.semester,
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
  const ra = await db.prepare('SELECT * FROM room_allocations WHERE id=?').get(req.params.roomAllocationId);
  if (!ra) return res.status(404).json({ error: 'Room allocation not found' });

  const slot = await db.prepare(`
    SELECT es.*, s.name as subject_name, s.code as subject_code
    FROM exam_slots es JOIN subjects s ON s.id=es.subject_id
    WHERE es.id=?
  `).get(ra.slot_id);
  const classroom = await db.prepare('SELECT * FROM classrooms WHERE id=?').get(ra.classroom_id);

  const students = await db.prepare(`
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

// GET door notice — PRN-only seating map for classroom door
router.get('/door-notice/:roomAllocationId', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  const ra = await db.prepare('SELECT * FROM room_allocations WHERE id=?').get(req.params.roomAllocationId);
  if (!ra) return res.status(404).json({ error: 'Room allocation not found' });

  const slot = await db.prepare(`
    SELECT es.*, s.name as subject_name, s.code as subject_code, s.branch, s.year
    FROM exam_slots es JOIN subjects s ON s.id=es.subject_id WHERE es.id=?
  `).get(ra.slot_id);
  const classroom = await db.prepare('SELECT * FROM classrooms WHERE id=?').get(ra.classroom_id);

  const assignments = await db.prepare(`
    SELECT sa.bench_row, sa.bench_col, st.prn, st.roll_no, st.branch, st.year
    FROM seat_assignments sa
    JOIN students st ON st.id=sa.student_id
    WHERE sa.room_allocation_id=?
    ORDER BY sa.bench_row, sa.bench_col
  `).all(req.params.roomAllocationId);

  // Generate PDF with PDFKit — PRN only grid
  const PDFDocument = (await import('pdfkit')).default;
  const pdfBuffer = await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Navy header
    doc.rect(0, 0, doc.page.width, 60).fill('#1e3a5f');
    doc.fillColor('white').font('Helvetica-Bold').fontSize(14)
       .text('SEATING ARRANGEMENT', 0, 10, { align: 'center', width: doc.page.width });
    doc.font('Helvetica').fontSize(10).fillColor('rgba(255,255,255,0.8)')
       .text(`Room ${classroom.room_no} (${classroom.block || ''}) · ${slot.subject_code} — ${slot.subject_name}`, 0, 28, { align: 'center', width: doc.page.width });
    doc.fillColor('rgba(255,255,255,0.7)').fontSize(9)
       .text(`Date: ${formatDate(slot.date)}  ·  Time: ${formatTime(slot.start_time)}  ·  ${slot.branch} ${slot.year}`, 0, 44, { align: 'center', width: doc.page.width });

    // Build grid
    const grid = {};
    for (const a of assignments) {
      if (!grid[a.bench_row]) grid[a.bench_row] = {};
      grid[a.bench_row][a.bench_col] = a;
    }

    const cols = classroom.bench_cols || 4;
    const rows = classroom.bench_rows || 8;
    const cellW = Math.floor((doc.page.width - 40) / cols);
    const cellH = Math.floor((doc.page.height - 100) / rows);
    let y = 70;

    for (let r = 1; r <= rows; r++) {
      let x = 20;
      for (let c = 1; c <= cols; c++) {
        const seat = grid[r]?.[c];
        doc.rect(x, y, cellW - 2, cellH - 2).fill(seat ? '#f8fafc' : '#e2e8f0').stroke('#94a3b8');
        if (seat) {
          doc.font('Helvetica-Bold').fontSize(11).fillColor('#1e3a5f')
             .text(seat.prn, x + 2, y + (cellH - 22) / 2, { width: cellW - 6, align: 'center', lineBreak: false });
          doc.font('Helvetica').fontSize(7).fillColor('#64748b')
             .text(`${seat.branch} ${seat.year}`, x + 2, y + (cellH - 22) / 2 + 13, { width: cellW - 6, align: 'center', lineBreak: false });
        } else {
          doc.font('Helvetica').fontSize(8).fillColor('#94a3b8')
             .text('—', x, y + cellH / 2 - 6, { width: cellW, align: 'center', lineBreak: false });
        }
        // Row/col labels
        doc.font('Helvetica').fontSize(6).fillColor('#94a3b8')
           .text(`R${r}C${c}`, x + 2, y + 2, { lineBreak: false });
        x += cellW;
      }
      y += cellH;
    }

    doc.font('Helvetica').fontSize(7).fillColor('#94a3b8')
       .text('MIT WPU Examination Cell — Post on classroom door before exam', 20, doc.page.height - 20, { lineBreak: false });

    doc.end();
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="door_${classroom.room_no}_${slot.date}.pdf"`);
  res.send(pdfBuffer);
}));

export default router;
