/**
 * PDF Generator using pdfkit (pure JS — no browser/Chromium needed)
 * Replaces Puppeteer-based approach which produced corrupted files on Windows.
 */
import PDFDocument from 'pdfkit';
import { getDb } from '../db/database.js';

async function getLogoBuffer() {
  try {
    const db = getDb();
    const logoSetting = await db.prepare("SELECT value FROM system_settings WHERE key = 'general.logo'").get();
    const logo = logoSetting?.value;
    if (logo && logo.startsWith('data:image/')) {
      const base64Data = logo.replace(/^data:image\/\w+;base64,/, "");
      return Buffer.from(base64Data, 'base64');
    }
  } catch (e) {
    console.error('Failed to retrieve custom logo buffer:', e);
  }
  return null;
}

function formatDate(dateVal) {
  if (!dateVal) return '';
  let dateStr = typeof dateVal === 'string' ? dateVal : new Date(dateVal).toISOString();
  if (dateStr.includes('T')) dateStr = dateStr.split('T')[0];
  if (dateStr.includes(' ')) dateStr = dateStr.split(' ')[0];
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const timePart = typeof timeStr === 'string' && timeStr.includes('T') 
    ? timeStr.split('T')[1].substring(0, 5) 
    : timeStr;
  const parts = timePart.split(':');
  if (parts.length >= 2) {
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1].substring(0, 2);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${minutes} ${ampm}`;
  }
  return timeStr;
}

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
function header(doc, subtitle, logoBuffer = null) {
  doc.rect(0, 0, doc.page.width, 54).fill(NAVY);
  
  let leftOffset = 30;
  doc.fillColor('white').font('Helvetica-Bold').fontSize(12)
    .text(BRAND, leftOffset, 12, { lineBreak: false });
  doc.font('Helvetica').fontSize(9).fillColor('rgba(255,255,255,0.8)')
    .text(subtitle, leftOffset, 28, { lineBreak: false });
  const generatedDate = new Date();
  const formattedGen = `${String(generatedDate.getDate()).padStart(2, '0')}/${String(generatedDate.getMonth() + 1).padStart(2, '0')}/${generatedDate.getFullYear()} ` +
    `${(generatedDate.getHours() % 12) || 12}:${String(generatedDate.getMinutes()).padStart(2, '0')} ${generatedDate.getHours() >= 12 ? 'PM' : 'AM'}`;
  doc.text(`${CELL}  ·  Generated: ${formattedGen}`, leftOffset, 39, { lineBreak: false });
  
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, doc.page.width - 70, 7, { width: 40, height: 40 });
    } catch (err) {
      console.error('Failed to stamp custom logo on PDF:', err);
    }
  }

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
  const logoBuffer = await getLogoBuffer();

  let y = header(doc, `Seating Arrangement — ${slot.cycle_name || slot.subject_code}`, logoBuffer);

  y = metaRow(doc, y, [
    ['Room', `${classroom.room_no} (${classroom.block})`],
    ['Subject', `${slot.subject_code} — ${slot.subject_name}`],
    ['Date', formatDate(slot.date)],
    ['Time', `${formatTime(slot.start_time)}  (${slot.duration_mins} min)`],
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
      y = header(doc, 'Seating Layout (continued)', logoBuffer) + 4;
    }

    // Row label
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#888888')
       .text(`R${row}`, 30, y + 13, { width: LABEL_W, align: 'right', lineBreak: false });

    for (let col = 1; col <= classroom.bench_cols; col++) {
      const benchIndex = (row - 1) * Math.floor(classroom.bench_cols / 2) + Math.floor((col - 1) / 2);
      const actualBenches = Math.floor(classroom.capacity / 2);
      if (benchIndex >= actualBenches) {
        continue;
      }

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
     .text(`Room ${classroom.room_no}  ·  ${formatDate(slot.date)}`, doc.page.width - 180, doc.page.height - 30, { lineBreak: false });

  return docToBuffer(doc);
}

export async function generateAttendancePDF({ slot, classroom, students }) {
  const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });
  const logoBuffer = await getLogoBuffer();

  let y = header(doc, `Attendance Sheet — ${slot.subject_code} — ${slot.subject_name}`, logoBuffer);

  y = metaRow(doc, y, [
    ['Room', `${classroom.room_no} (${classroom.block})`],
    ['Subject', `${slot.subject_code}`],
    ['Date', formatDate(slot.date)],
    ['Time', formatTime(slot.start_time)],
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
  const logoBuffer = await getLogoBuffer();

  let y = header(doc, 'Supervisor Duty Sheet', logoBuffer);

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
    const formattedDuties = duties.map(d => ({
      ...d,
      date: formatDate(d.date),
      start_time: formatTime(d.start_time)
    }));
    y = sectionHead(doc, y, `Duty Schedule — ${duties.length} assignment(s)`);
    y = table(doc, y, formattedDuties, [
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

  // Group slots by semester
  const semestersMap = {};
  for (const slot of slots) {
    const sem = slot.semester || 1;
    if (!semestersMap[sem]) semestersMap[sem] = [];
    semestersMap[sem].push(slot);
  }

  const sortedSemesters = Object.keys(semestersMap).sort((a, b) => Number(a) - Number(b));

  if (sortedSemesters.length === 0) {
    // If no slots exist, output a blank page with message
    doc.addPage();
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#111111')
       .text('MIT WORLD PEACE UNIVERSITY', 30, 30, { align: 'center', width: 781.89 });
    doc.font('Helvetica').fontSize(11).fillColor('#555555')
       .text('No examination schedule available for this cycle.', 30, 100, { align: 'center', width: 781.89 });
    return docToBuffer(doc);
  }

  function getSemesterTitle(sem) {
    const ROMAN = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI' };
    const r = ROMAN[sem] || sem;
    const yearPart = sem === 1 || sem === 2 ? 'First Year Diploma' :
                     sem === 3 || sem === 4 ? 'Second Year Diploma' :
                     sem === 5 || sem === 6 ? 'Third Year Diploma' : '';
    const oddEvenPart = sem % 2 === 1 ? 'Odd Semester' : 'Even Semester';
    return `${yearPart} ${oddEvenPart} — All Program's\n(Semester-${r})`;
  }

  function formatPdfDate(dateStr) {
    if (!dateStr) return '';
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const stdMonths = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    const dayName = weekdays[d.getDay()];
    const dayDate = String(d.getDate()).padStart(2, '0');
    const monthName = stdMonths[d.getMonth()];
    const year = d.getFullYear();
    return `${dayName}, ${dayDate} ${monthName} ${year}`;
  }

  function formatTimeRange(startTimeStr, durationMins) {
    const parts = startTimeStr.split(':');
    if (parts.length < 2) return startTimeStr;
    let startHours = parseInt(parts[0], 10);
    const startMinutes = parts[1].substring(0, 2);
    const startAMPM = startHours >= 12 ? 'pm' : 'am';
    let startH12 = startHours % 12;
    startH12 = startH12 ? startH12 : 12;
    const startFormatted = `${String(startH12).padStart(2, '0')}.${startMinutes} ${startAMPM}`;

    // Calculate end time
    const startDate = new Date();
    startDate.setHours(startHours, parseInt(parts[1], 10), 0, 0);
    const endDate = new Date(startDate.getTime() + durationMins * 60000);
    let endHours = endDate.getHours();
    const endMinutes = String(endDate.getMinutes()).padStart(2, '0');
    const endAMPM = endHours >= 12 ? 'pm' : 'am';
    let endH12 = endHours % 12;
    endH12 = endH12 ? endH12 : 12;
    const endFormatted = `${String(endH12).padStart(2, '0')}.${endMinutes} ${endAMPM}`;

    return `${startFormatted} to ${endFormatted}`;
  }

  sortedSemesters.forEach((sem, pageIdx) => {
    if (pageIdx > 0) {
      doc.addPage();
    }

    const semesterSlots = semestersMap[sem];
    // Unique branches for this semester
    const branches = [...new Set(semesterSlots.map(s => s.branch))].sort();
    
    // Group slots by date & time
    const rowGroupsMap = {};
    for (const slot of semesterSlots) {
      const key = `${slot.date}_${slot.start_time}_${slot.duration_mins}`;
      if (!rowGroupsMap[key]) {
        rowGroupsMap[key] = {
          date: slot.date,
          start_time: slot.start_time,
          duration_mins: slot.duration_mins,
          slotsByBranch: {}
        };
      }
      rowGroupsMap[key].slotsByBranch[slot.branch] = slot;
    }

    const sortedRowGroups = Object.values(rowGroupsMap).sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.start_time.localeCompare(b.start_time);
    });

    const startX = 30;
    const totalTableW = 781.89;
    const dateColW = 110;
    const timeColW = 120;
    const remainingW = totalTableW - dateColW - timeColW;
    const colW = Math.floor(remainingW / branches.length);
    const totalBranchW = colW * branches.length;
    const actualTableW = dateColW + timeColW + totalBranchW;
    const adjustX = startX + Math.floor((totalTableW - actualTableW) / 2); // Center the table horizontally

    function drawHeader() {
      // Header Text
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#111111')
         .text('MIT WORLD PEACE UNIVERSITY', 30, 25, { align: 'center', width: 781.89 });
      doc.fontSize(9)
         .text('DEPARTMENT OF POLYTECHNIC AND SKILL DEVELOPMENT, PUNE', 30, 41, { align: 'center', width: 781.89 });
      
      const cycleTitle = `TIME TABLE MIDTERM (${cycle.name.toUpperCase()})`;
      doc.fontSize(10)
         .text(cycleTitle, 30, 56, { align: 'center', width: 781.89 });
      
      const semTitle = getSemesterTitle(Number(sem));
      doc.fontSize(10)
         .text(semTitle, 30, 71, { align: 'center', width: 781.89 });

      // Double Line under title block
      doc.moveTo(30, 92).lineTo(811.89, 92).lineWidth(0.8).stroke('#111111');
      doc.moveTo(30, 95).lineTo(811.89, 95).lineWidth(0.8).stroke('#111111');
    }

    function drawTableHeader() {
      const headerY = 105;
      
      // Draw Header Background
      doc.rect(adjustX, headerY, actualTableW, 30).fill('#f8fafc');
      doc.rect(adjustX, headerY, actualTableW, 30).lineWidth(0.8).stroke('#111111');
      
      // Divider lines
      doc.moveTo(adjustX + dateColW, headerY).lineTo(adjustX + dateColW, headerY + 30).stroke('#111111');
      doc.moveTo(adjustX + dateColW + timeColW, headerY).lineTo(adjustX + dateColW + timeColW, headerY + 30).stroke('#111111');
      
      // Header Labels
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#111111');
      doc.text('DAY / DATE', adjustX, headerY + 11, { width: dateColW, align: 'center' });
      doc.text('TIME', adjustX + dateColW, headerY + 11, { width: timeColW, align: 'center' });
      
      // Programme Header spanning across branches
      doc.text('Name of Programme', adjustX + dateColW + timeColW, headerY + 3, { width: totalBranchW, align: 'center' });
      doc.moveTo(adjustX + dateColW + timeColW, headerY + 15).lineTo(adjustX + dateColW + timeColW + totalBranchW, headerY + 15).stroke('#111111');
      
      // Draw Individual Branch headers
      branches.forEach((branch, idx) => {
        const bx = adjustX + dateColW + timeColW + idx * colW;
        doc.text(branch, bx + 2, headerY + 18, { width: colW - 4, align: 'center' });
        if (idx > 0) {
          doc.moveTo(bx, headerY + 15).lineTo(bx, headerY + 30).stroke('#111111');
        }
      });
    }

    function drawSignatures() {
      const sigY = 515;
      const sigColW = 180;
      const spacing = Math.floor((totalTableW - sigColW * 3) / 2);
      
      const sigs = [
        { name: 'Prof. Mrs. M. P. Fatangare', role: 'FEO', x: startX },
        { name: 'Prof. (Dr.) S.S.Karad', role: 'Program Coordinator', x: startX + sigColW + spacing },
        { name: 'Prof. (Dr.) Rohini S. Kale', role: 'Program Director', x: startX + (sigColW + spacing) * 2 }
      ];

      sigs.forEach(sig => {
        doc.moveTo(sig.x, sigY).lineTo(sig.x + sigColW, sigY).lineWidth(0.5).stroke('#111111');
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#111111')
           .text(sig.name, sig.x, sigY + 5, { width: sigColW, align: 'center' });
        doc.font('Helvetica').fontSize(7.5).fillColor('#444444')
           .text(sig.role, sig.x, sigY + 14, { width: sigColW, align: 'center' });
      });
    }

    // Initial draw for this page
    drawHeader();
    drawTableHeader();

    let y = 135;
    const bottomLimit = 495; // Leave space for signatures

    sortedRowGroups.forEach(rowGroup => {
      const dateText = formatPdfDate(rowGroup.date);
      const timeText = formatTimeRange(rowGroup.start_time, rowGroup.duration_mins);

      // Calculate row height dynamically
      let rowH = 32;
      const dateH = doc.heightOfString(dateText, { width: dateColW - 6, font: 'Helvetica-Bold', fontSize: 7.5 }) + 10;
      if (dateH > rowH) rowH = dateH;

      const timeH = doc.heightOfString(timeText, { width: timeColW - 6, font: 'Helvetica', fontSize: 7.5 }) + 10;
      if (timeH > rowH) rowH = timeH;

      branches.forEach(branch => {
        const slot = rowGroup.slotsByBranch[branch];
        if (slot) {
          const subText = `${slot.subject_name}\n(${slot.subject_code})`;
          const subH = doc.heightOfString(subText, { width: colW - 6, font: 'Helvetica', fontSize: 7 }) + 12;
          if (subH > rowH) rowH = subH;
        }
      });

      // Page break check
      if (y + rowH > bottomLimit) {
        // Draw signatures on current page before adding a new one
        drawSignatures();
        
        doc.addPage();
        drawHeader();
        drawTableHeader();
        y = 135;
      }

      // Draw Row Box
      doc.rect(adjustX, y, actualTableW, rowH).lineWidth(0.8).stroke('#111111');
      doc.moveTo(adjustX + dateColW, y).lineTo(adjustX + dateColW, y + rowH).stroke('#111111');
      doc.moveTo(adjustX + dateColW + timeColW, y).lineTo(adjustX + dateColW + timeColW, y + rowH).stroke('#111111');

      // Date Text (bold)
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#111111');
      doc.text(dateText, adjustX + 3, y + (rowH - dateH + 8) / 2, { width: dateColW - 6, align: 'center' });

      // Time Text
      doc.font('Helvetica').fontSize(7.5);
      doc.text(timeText, adjustX + 3 + dateColW, y + (rowH - timeH + 8) / 2, { width: timeColW - 6, align: 'center' });

      // Branch Subjects
      branches.forEach((branch, idx) => {
        const bx = adjustX + dateColW + timeColW + idx * colW;
        if (idx > 0) {
          doc.moveTo(bx, y).lineTo(bx, y + rowH).stroke('#111111');
        }

        const slot = rowGroup.slotsByBranch[branch];
        if (slot) {
          const subText = `${slot.subject_name}\n(${slot.subject_code})`;
          const textH = doc.heightOfString(subText, { width: colW - 6, font: 'Helvetica', fontSize: 7 });
          doc.font('Helvetica').fontSize(7);
          doc.text(subText, bx + 3, y + (rowH - textH) / 2, { width: colW - 6, align: 'center' });
        } else {
          doc.font('Helvetica').fontSize(9).fillColor('#888888');
          doc.text('-', bx + 3, y + (rowH - 9) / 2, { width: colW - 6, align: 'center' });
          doc.fillColor('#111111');
        }
      });

      y += rowH;
    });

    // Draw signatures at bottom of the page
    drawSignatures();
  });

  return docToBuffer(doc);
}
