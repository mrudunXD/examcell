/**
 * PDF Generator using pdfkit (pure JS — no browser/Chromium needed)
 * Replaces Puppeteer-based approach which produced corrupted files on Windows.
 */
import PDFDocument from 'pdfkit';

// ── Constants ───────────────────────────────────────────────────────────────
const BRAND     = 'MIT World Peace University — Polytechnic';
const CELL      = 'Examination Cell';
const NAVY      = '#1e3a5f';
const LIGHT_BG  = '#f8fafc';
const BORDER    = '#cbd5e1';
const RED_MARK  = '#cc0000';

const YEAR_CLR  = { FY: '#1e40af', SY: '#166534', TY: '#92400e', LY: '#9d174d' };

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Render a navy header block and return the Y position after it */
function header(doc, subtitle) {
  doc.rect(0, 0, doc.page.width, 54).fill(NAVY);
  doc.fillColor('white').font('Helvetica-Bold').fontSize(12)
    .text(BRAND, 30, 12, { lineBreak: false });
  doc.font('Helvetica').fontSize(9).fillColor('rgba(255,255,255,0.8)')
    .text(subtitle, 30, 28, { lineBreak: false });
  doc.text(`${CELL}  ·  Generated: ${new Date().toLocaleString('en-IN')}`, 30, 39, { lineBreak: false });
  doc.fillColor('#111111');
  return 66;
}

/** Small label + value pair, returns new y */
function metaRow(doc, y, pairs, x = 30) {
  const colW = (doc.page.width - 60) / pairs.length;
  pairs.forEach((p, i) => {
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#555555')
       .text(p[0].toUpperCase(), x + i * colW, y, { lineBreak: false });
    doc.font('Helvetica').fontSize(9).fillColor('#111111')
       .text(p[1] || '—', x + i * colW, y + 10, { lineBreak: false });
  });
  return y + 26;
}

/** Section heading with underline */
function sectionHead(doc, y, text) {
  doc.font('Helvetica-Bold').fontSize(10).fillColor(NAVY).text(text, 30, y);
  doc.moveTo(30, y + 14).lineTo(doc.page.width - 30, y + 14).stroke(NAVY);
  return y + 20;
}

/**
 * Draw a table. cols: [{ header, width, key, align? }]
 * Returns y after table
 */
function table(doc, startY, rows, cols, { rowH = 18, headerBg = NAVY, zebra = true } = {}) {
  const totalW = cols.reduce((s, c) => s + c.width, 0);
  const x0 = (doc.page.width - totalW) / 2;
  let y = startY;
  const maxY = doc.page.height - 50;

  // Header
  doc.rect(x0, y, totalW, rowH).fill(headerBg);
  let cx = x0;
  cols.forEach(col => {
    doc.font('Helvetica-Bold').fontSize(8).fillColor('white')
       .text(col.header, cx + 3, y + 5, { width: col.width - 6, align: col.align || 'left', lineBreak: false });
    cx += col.width;
  });
  y += rowH;

  rows.forEach((row, ri) => {
    // Page break
    if (y + rowH > maxY) {
      doc.addPage();
      y = header(doc, 'Continued…') + 4;
      // re-draw header row
      doc.rect(x0, y, totalW, rowH).fill(headerBg);
      let cx2 = x0;
      cols.forEach(col => {
        doc.font('Helvetica-Bold').fontSize(8).fillColor('white')
           .text(col.header, cx2 + 3, y + 5, { width: col.width - 6, align: col.align || 'left', lineBreak: false });
        cx2 += col.width;
      });
      y += rowH;
    }

    if (zebra && ri % 2 === 1) doc.rect(x0, y, totalW, rowH).fill(LIGHT_BG);
    doc.rect(x0, y, totalW, rowH).stroke(BORDER);
    cx = x0;
    cols.forEach(col => {
      const val = String(row[col.key] ?? '—');
      doc.font('Helvetica').fontSize(8).fillColor(col.color?.(row) || '#111111')
         .text(val, cx + 3, y + 5, { width: col.width - 6, align: col.align || 'left', lineBreak: false });
      cx += col.width;
    });
    y += rowH;
  });

  return y + 4;
}

/** Convert a PDFDocument to a Buffer */
function docToBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

// ── Exports ──────────────────────────────────────────────────────────────────

export async function generateSeatingPDF({ slot, classroom, assignments }) {
  const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });

  let y = header(doc, `Seating Arrangement — ${slot.cycle_name || slot.subject_code}`);

  y = metaRow(doc, y, [
    ['Room', `${classroom.room_no} (${classroom.block})`],
    ['Subject', `${slot.subject_code} — ${slot.subject_name}`],
    ['Date', slot.date],
    ['Time', `${slot.start_time}  (${slot.duration_mins} min)`],
    ['Seated / Cap.', `${assignments.length} / ${classroom.capacity}`],
  ]);

  y = sectionHead(doc, y, `Bench Layout  (${classroom.bench_rows} rows × ${classroom.bench_cols} columns)`);

  // Build grid
  const grid = {};
  for (const a of assignments) {
    if (!grid[a.bench_row]) grid[a.bench_row] = {};
    grid[a.bench_row][a.bench_col] = a;
  }

  const CELL_W = Math.min(88, Math.floor((doc.page.width - 60) / (classroom.bench_cols + 0.5)));
  const CELL_H = 38;
  const LABEL_W = 28;

  for (let row = 1; row <= classroom.bench_rows; row++) {
    // Page break check
    if (y + CELL_H + 4 > doc.page.height - 50) {
      doc.addPage();
      y = header(doc, 'Seating Layout (continued)') + 4;
    }

    // Row label
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#888888')
       .text(`R${row}`, 30, y + 13, { width: LABEL_W, align: 'right', lineBreak: false });

    for (let col = 1; col <= classroom.bench_cols; col++) {
      const seat = grid[row]?.[col];
      const sx = 30 + LABEL_W + 4 + (col - 1) * (CELL_W + 2);

      if (!seat) {
        doc.rect(sx, y, CELL_W, CELL_H).fill('#f8fafc').stroke(BORDER);
        doc.font('Helvetica').fontSize(7).fillColor('#aaaaaa')
           .text('empty', sx + 2, y + 14, { width: CELL_W - 4, align: 'center', lineBreak: false });
      } else {
        doc.rect(sx, y, CELL_W, CELL_H).fill('white').stroke('#94a3b8');
        doc.font('Helvetica-Bold').fontSize(7).fillColor('#111111')
           .text(seat.student_name?.substring(0, 18) || '', sx + 2, y + 3, { width: CELL_W - 4, lineBreak: false });
        doc.font('Helvetica').fontSize(6).fillColor('#555555')
           .text(`PRN: ${seat.prn}`, sx + 2, y + 13, { width: CELL_W - 4, lineBreak: false });
        doc.font('Helvetica').fontSize(6).fillColor(RED_MARK)
           .text(`Roll: ${seat.roll_no}`, sx + 2, y + 21, { width: CELL_W - 4, lineBreak: false });
        const yc = YEAR_CLR[seat.year] || '#555555';
        doc.font('Helvetica').fontSize(6).fillColor(yc)
           .text(`${seat.branch}  ${seat.year}`, sx + 2, y + 29, { width: CELL_W - 4, lineBreak: false });
      }
    }
    y += CELL_H + 3;
  }

  y = sectionHead(doc, y + 8, `Student Register  (${assignments.length} students)`);

  y = table(doc, y, assignments.sort((a, b) => a.bench_row - b.bench_row || a.bench_col - b.bench_col), [
    { header: 'Row', width: 35,  key: 'bench_row',    align: 'center' },
    { header: 'Col', width: 35,  key: 'bench_col',    align: 'center' },
    { header: 'Name',    width: 140, key: 'student_name' },
    { header: 'PRN',     width: 90,  key: 'prn',   color: () => '#555555' },
    { header: 'Roll No', width: 60,  key: 'roll_no', color: () => RED_MARK },
    { header: 'Branch',  width: 55,  key: 'branch' },
    { header: 'Year',    width: 35,  key: 'year',  color: r => YEAR_CLR[r.year] || '#111' },
    { header: 'Section', width: 45,  key: 'section', color: () => '#555555' },
  ]);

  // Footer
  doc.font('Helvetica').fontSize(8).fillColor('#9ca3af')
     .text('MIT WPU Examination Cell — Confidential', 30, doc.page.height - 30, { lineBreak: false })
     .text(`Room ${classroom.room_no}  ·  ${slot.date}`, doc.page.width - 180, doc.page.height - 30, { lineBreak: false });

  return docToBuffer(doc);
}

export async function generateAttendancePDF({ slot, classroom, students }) {
  const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });

  let y = header(doc, `Attendance Sheet — ${slot.subject_code} — ${slot.subject_name}`);

  y = metaRow(doc, y, [
    ['Room', `${classroom.room_no} (${classroom.block})`],
    ['Subject', `${slot.subject_code}`],
    ['Date', slot.date],
    ['Time', slot.start_time],
    ['Total Students', students.length],
  ]);

  y = sectionHead(doc, y, 'Student Attendance');

  y = table(doc, y, students.map((s, i) => ({ ...s, sno: i + 1, signature: '' })), [
    { header: '#',        width: 28,  key: 'sno',      align: 'center' },
    { header: 'PRN',      width: 85,  key: 'prn',      color: () => '#555555' },
    { header: 'Roll No',  width: 60,  key: 'roll_no',  color: () => RED_MARK },
    { header: 'Name',     width: 155, key: 'name' },
    { header: 'Branch',   width: 50,  key: 'branch' },
    { header: 'Year',     width: 30,  key: 'year', color: r => YEAR_CLR[r.year] || '#111' },
    { header: 'Row',      width: 30,  key: 'bench_row',  align: 'center' },
    { header: 'Col',      width: 30,  key: 'bench_col',  align: 'center' },
    { header: 'Signature', width: 72, key: 'signature' },
  ], { rowH: 20 });

  // Supervisor sign block
  if (y + 50 > doc.page.height - 40) { doc.addPage(); y = 40; }
  y += 12;
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#111111')
     .text('Supervisor Signature: ____________________________', 30, y)
     .text('Date: ______________________', 350, y);

  doc.font('Helvetica').fontSize(8).fillColor('#9ca3af')
     .text('MIT WPU Examination Cell — Confidential', 30, doc.page.height - 30, { lineBreak: false });

  return docToBuffer(doc);
}

export async function generateDutySheetPDF({ faculty, duties }) {
  const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });

  let y = header(doc, 'Supervisor Duty Sheet');

  y = metaRow(doc, y, [
    ['Faculty', faculty.name],
    ['Department', faculty.department || '—'],
    ['Email', faculty.email],
    ['Total Duties', duties.length],
  ]);

  if (duties.length === 0) {
    doc.rect(30, y, doc.page.width - 60, 30).fill('#fef3c7');
    doc.font('Helvetica').fontSize(9).fillColor('#92400e')
       .text('No duties assigned for this exam cycle.', 36, y + 10);
    y += 40;
  } else {
    y = sectionHead(doc, y, `Duty Schedule — ${duties.length} assignment(s)`);
    y = table(doc, y, duties, [
      { header: 'Date',        width: 62,  key: 'date' },
      { header: 'Time',        width: 50,  key: 'start_time' },
      { header: 'Duration',    width: 48,  key: 'duration_mins', color: () => '#555' },
      { header: 'Room',        width: 45,  key: 'room_no' },
      { header: 'Block',       width: 45,  key: 'block' },
      { header: 'Subject',     width: 140, key: 'subject_name' },
      { header: 'Role',        width: 50,  key: 'role',
        color: r => r.role === 'primary' ? '#1e40af' : '#166534' },
      { header: 'Status',      width: 60,  key: 'acknowledged',
        color: r => r.acknowledged ? '#166534' : '#92400e' },
    ]);
  }

  doc.font('Helvetica').fontSize(8).fillColor('#9ca3af')
     .text('MIT WPU Examination Cell — Confidential', 30, doc.page.height - 30, { lineBreak: false });

  return docToBuffer(doc);
}

export async function generateTimetablePDF({ cycle, slots }) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0, bufferPages: true });

  let y = header(doc, `Exam Timetable — ${cycle.name}`);

  y = metaRow(doc, y, [
    ['Cycle', cycle.name],
    ['Period', `${cycle.start_date}  →  ${cycle.end_date}`],
    ['Status', cycle.status],
    ['Total Slots', slots.length],
  ]);

  y = sectionHead(doc, y, 'Examination Schedule');

  y = table(doc, y, slots, [
    { header: 'Date',      width: 70,  key: 'date' },
    { header: 'Time',      width: 55,  key: 'start_time' },
    { header: 'Min',       width: 38,  key: 'duration_mins', align: 'center' },
    { header: 'Code',      width: 60,  key: 'subject_code', color: () => RED_MARK },
    { header: 'Subject',   width: 170, key: 'subject_name' },
    { header: 'Branch',    width: 55,  key: 'branch' },
    { header: 'Year',      width: 38,  key: 'year', color: r => YEAR_CLR[r.year] || '#111' },
    { header: 'Type',      width: 52,  key: 'exam_type', color: r => r.exam_type === 'backlog' ? RED_MARK : '#111' },
    { header: 'Mode',      width: 52,  key: 'exam_mode', color: r => r.exam_mode === 'online' ? '#1e40af' : '#111' },
    { header: 'Students',  width: 55,  key: 'student_count', align: 'center' },
    { header: 'Rooms',     width: 45,  key: 'room_count', align: 'center' },
    { header: 'Status',    width: 62,  key: 'status' },
  ]);

  doc.font('Helvetica').fontSize(8).fillColor('#9ca3af')
     .text('MIT WPU Examination Cell — Confidential', 30, doc.page.height - 30, { lineBreak: false });

  return docToBuffer(doc);
}
