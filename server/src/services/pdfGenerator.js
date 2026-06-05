import puppeteer from 'puppeteer';

async function renderPDF(html) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: { top: '15mm', right: '12mm', bottom: '15mm', left: '12mm' }
  });
  await browser.close();
  return pdf;
}

const baseStyles = `
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1a1a1a; }
    .header { background: #1e3a5f; color: white; padding: 12px 16px; margin-bottom: 12px; }
    .header h1 { font-size: 15px; font-weight: 700; }
    .header .sub { font-size: 10px; opacity: 0.85; margin-top: 2px; }
    .meta { display: flex; gap: 24px; margin-bottom: 10px; font-size: 10px; color: #555; }
    .meta strong { color: #1a1a1a; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th { background: #1e3a5f; color: white; padding: 5px 7px; text-align: left; font-weight: 600; }
    td { padding: 4px 7px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    tr:nth-child(even) td { background: #f8fafc; }
    .badge { display: inline-block; padding: 1px 5px; border-radius: 3px; font-size: 9px; font-weight: 600; }
    .badge-fy { background: #dbeafe; color: #1e40af; }
    .badge-sy { background: #dcfce7; color: #166534; }
    .badge-ty { background: #fef3c7; color: #92400e; }
    .badge-ly { background: #fce7f3; color: #9d174d; }
    .footer { margin-top: 12px; font-size: 9px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 6px; display: flex; justify-content: space-between; }
    .page-title { font-size: 13px; font-weight: 700; margin-bottom: 8px; color: #1e3a5f; }
    .grid-bench { display: grid; gap: 3px; margin-bottom: 16px; }
    .bench-row { display: flex; gap: 3px; align-items: center; }
    .bench-label { width: 28px; font-size: 9px; color: #888; text-align: right; padding-right: 4px; flex-shrink: 0; }
    .bench-cell { border: 1px solid #d1d5db; padding: 3px 4px; border-radius: 3px; font-size: 8px; min-width: 70px; line-height: 1.3; }
    .bench-cell.empty { background: #f9fafb; border-style: dashed; }
    .bench-cell .student-name { font-weight: 600; color: #1a1a1a; }
    .bench-cell .student-prn { color: #6b7280; font-size: 7px; }
    .bench-cell .student-roll { color: #3b82f6; font-size: 7px; }
    .bench-cell .student-branch { font-size: 7px; }
    .section-title { font-size: 11px; font-weight: 700; color: #1e3a5f; margin: 10px 0 6px; border-bottom: 2px solid #1e3a5f; padding-bottom: 3px; }
    .warn { background: #fef3c7; border-left: 3px solid #f59e0b; padding: 6px 8px; margin: 8px 0; font-size: 10px; }
  </style>
`;

function yearBadge(year) {
  const cls = { FY: 'badge-fy', SY: 'badge-sy', TY: 'badge-ty', LY: 'badge-ly' }[year] || '';
  return `<span class="badge ${cls}">${year}</span>`;
}

export async function generateSeatingPDF({ slot, classroom, assignments }) {
  // Build bench grid
  const grid = {};
  for (const a of assignments) {
    if (!grid[a.bench_row]) grid[a.bench_row] = {};
    grid[a.bench_row][a.bench_col] = a;
  }

  const rows = Array.from({ length: classroom.bench_rows }, (_, i) => i + 1);
  const cols = Array.from({ length: classroom.bench_cols }, (_, i) => i + 1);

  const gridHtml = rows.map(row => `
    <div class="bench-row">
      <div class="bench-label">Row ${row}</div>
      ${cols.map(col => {
        const seat = grid[row]?.[col];
        if (!seat) return `<div class="bench-cell empty">—</div>`;
        return `
          <div class="bench-cell">
            <div class="student-name">${seat.student_name}</div>
            <div class="student-prn">PRN: ${seat.prn}</div>
            <div class="student-roll">Roll: ${seat.roll_no}</div>
            <div class="student-branch">${seat.branch} ${yearBadge(seat.year)}</div>
          </div>`;
      }).join('')}
    </div>
  `).join('');

  const listHtml = `
    <div class="section-title">Student List (${assignments.length} students)</div>
    <table>
      <thead><tr>
        <th>Bench Row</th><th>Bench Col</th><th>Name</th><th>PRN</th><th>Roll No</th><th>Branch</th><th>Year</th>
      </tr></thead>
      <tbody>
        ${assignments.map(a => `<tr>
          <td>${a.bench_row}</td><td>${a.bench_col}</td>
          <td>${a.student_name}</td><td>${a.prn}</td><td>${a.roll_no}</td>
          <td>${a.branch}</td><td>${yearBadge(a.year)}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">${baseStyles}</head>
  <body>
    <div class="header">
      <h1>MIT World Peace University — Examination Cell</h1>
      <div class="sub">Seating Arrangement — ${slot.cycle_name || ''}</div>
    </div>
    <div class="meta">
      <div><strong>Room:</strong> ${classroom.room_no} (${classroom.block})</div>
      <div><strong>Subject:</strong> ${slot.subject_code} — ${slot.subject_name}</div>
      <div><strong>Date:</strong> ${slot.date}</div>
      <div><strong>Time:</strong> ${slot.start_time} (${slot.duration_mins} min)</div>
      <div><strong>Capacity:</strong> ${classroom.capacity} | <strong>Seated:</strong> ${assignments.length}</div>
    </div>
    <div class="section-title">Bench Layout (${classroom.bench_rows} rows × ${classroom.bench_cols} positions)</div>
    <div class="grid-bench">${gridHtml}</div>
    ${listHtml}
    <div class="footer">
      <span>MIT WPU Examination Cell — Confidential</span>
      <span>Generated: ${new Date().toLocaleString('en-IN')}</span>
    </div>
  </body></html>`;

  return renderPDF(html);
}

export async function generateDutySheetPDF({ faculty, duties }) {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">${baseStyles}</head>
  <body>
    <div class="header">
      <h1>MIT World Peace University — Examination Cell</h1>
      <div class="sub">Supervisor Duty Sheet</div>
    </div>
    <div class="meta">
      <div><strong>Faculty:</strong> ${faculty.name}</div>
      <div><strong>Department:</strong> ${faculty.department || '—'}</div>
      <div><strong>Email:</strong> ${faculty.email}</div>
    </div>
    <div class="section-title">Duty Schedule (${duties.length} duty/duties)</div>
    ${duties.length === 0 ? '<div class="warn">No duties assigned for this cycle.</div>' : ''}
    <table>
      <thead><tr>
        <th>Date</th><th>Time</th><th>Duration</th><th>Room</th><th>Block</th><th>Subject</th><th>Role</th><th>Co-Supervisor</th><th>Status</th>
      </tr></thead>
      <tbody>
        ${duties.map(d => `<tr>
          <td>${d.date}</td>
          <td>${d.start_time}</td>
          <td>${d.duration_mins} min</td>
          <td><strong>${d.room_no}</strong></td>
          <td>${d.block}</td>
          <td>${d.subject_code} — ${d.subject_name}</td>
          <td><span class="badge ${d.role === 'primary' ? 'badge-fy' : 'badge-sy'}">${d.role}</span></td>
          <td>${d.co_supervisor_name || '—'}</td>
          <td>${d.acknowledged ? '✅ Acknowledged' : '⏳ Pending'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div class="footer">
      <span>MIT WPU Examination Cell — Confidential</span>
      <span>Generated: ${new Date().toLocaleString('en-IN')}</span>
    </div>
  </body></html>`;

  return renderPDF(html);
}

export async function generateTimetablePDF({ cycle, slots }) {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">${baseStyles}</head>
  <body>
    <div class="header">
      <h1>MIT World Peace University — Examination Cell</h1>
      <div class="sub">Exam Timetable — ${cycle.name}</div>
    </div>
    <div class="meta">
      <div><strong>Cycle:</strong> ${cycle.name}</div>
      <div><strong>Period:</strong> ${cycle.start_date} to ${cycle.end_date}</div>
      <div><strong>Status:</strong> ${cycle.status}</div>
    </div>
    <div class="section-title">Exam Schedule</div>
    <table>
      <thead><tr>
        <th>Date</th><th>Time</th><th>Duration</th><th>Subject Code</th><th>Subject</th><th>Branch</th><th>Year</th><th>Students</th><th>Rooms</th><th>Status</th>
      </tr></thead>
      <tbody>
        ${slots.map(s => `<tr>
          <td>${s.date}</td>
          <td>${s.start_time}</td>
          <td>${s.duration_mins} min</td>
          <td>${s.subject_code}</td>
          <td>${s.subject_name}</td>
          <td>${s.branch}</td>
          <td>${yearBadge(s.year)}</td>
          <td>${s.student_count}</td>
          <td>${s.room_count}</td>
          <td>${s.status}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div class="footer">
      <span>MIT WPU Examination Cell — Confidential</span>
      <span>Generated: ${new Date().toLocaleString('en-IN')}</span>
    </div>
  </body></html>`;

  return renderPDF(html);
}

export async function generateAttendancePDF({ slot, classroom, students }) {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">${baseStyles}</head>
  <body>
    <div class="header">
      <h1>MIT World Peace University — Examination Cell</h1>
      <div class="sub">Attendance Sheet</div>
    </div>
    <div class="meta">
      <div><strong>Room:</strong> ${classroom.room_no} (${classroom.block})</div>
      <div><strong>Subject:</strong> ${slot.subject_code} — ${slot.subject_name}</div>
      <div><strong>Date:</strong> ${slot.date}</div>
      <div><strong>Time:</strong> ${slot.start_time}</div>
    </div>
    <table>
      <thead><tr>
        <th>#</th><th>PRN</th><th>Roll No</th><th>Student Name</th><th>Branch</th><th>Year</th><th>Bench Row</th><th>Bench Col</th><th>Signature</th>
      </tr></thead>
      <tbody>
        ${students.map((s, i) => `<tr>
          <td>${i + 1}</td>
          <td>${s.prn}</td>
          <td>${s.roll_no}</td>
          <td>${s.name}</td>
          <td>${s.branch}</td>
          <td>${yearBadge(s.year)}</td>
          <td>${s.bench_row}</td>
          <td>${s.bench_col}</td>
          <td style="width:120px;">&nbsp;</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div style="margin-top:16px; font-size:10px;">
      <strong>Supervisor Signature:</strong> ______________________ &nbsp;&nbsp;
      <strong>Date:</strong> ______________________
    </div>
    <div class="footer">
      <span>MIT WPU Examination Cell — Confidential</span>
      <span>Generated: ${new Date().toLocaleString('en-IN')}</span>
    </div>
  </body></html>`;

  return renderPDF(html);
}
