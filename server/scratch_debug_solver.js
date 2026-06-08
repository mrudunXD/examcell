import { getDb, initDb } from './src/db/database.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DB first
initDb();

const db = getDb();
const cycleId = '34b46180-107b-4e38-9be1-d8ffd4297aec'; // Active cycle

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
function isSunday(dateStr) { return new Date(dateStr + 'T00:00:00').getDay() === 0; }

const cycle = db.prepare('SELECT * FROM exam_cycles WHERE id=?').get(cycleId);
const { start_date, end_date, semester_type } = cycle;
const parityFilter = semester_type === 'odd' ? 'semester % 2 = 1' : 'semester % 2 = 0';

const subjects = db.prepare(`SELECT * FROM subjects WHERE ${parityFilter} GROUP BY code ORDER BY code`).all();
const teaches = db.prepare("SELECT faculty_id, subject_id FROM faculty_subjects").all();
const classrooms = db.prepare("SELECT * FROM classrooms WHERE is_active=1").all();
const faculty = db.prepare("SELECT id, name, email, department FROM users WHERE role='faculty' AND is_active=1").all();
const students = db.prepare("SELECT id, name, prn, roll_no, branch, year, semester FROM students WHERE is_active=1").all();

const validDates = [];
let cur = start_date;
while (cur <= end_date && validDates.length < 100) {
  if (!isSunday(cur)) validDates.push(cur);
  cur = addDays(cur, 1);
}

const inputData = {
  cycle,
  subjects,
  students,
  classrooms,
  faculty,
  teaches,
  settings: {
    time_limit_seconds: 10,
    shifts: [
      { id: '1', name: 'Shift 1', start_time: '09:30', duration_mins: 180 },
      { id: '2', name: 'Shift 2', start_time: '13:30', duration_mins: 180 }
    ],
    dates: validDates
  }
};

fs.writeFileSync('scratch_input.json', JSON.stringify(inputData, null, 2));

console.log('Classrooms count:', classrooms.length);
console.log('Subjects count:', subjects.length);
console.log('Faculty count:', faculty.length);
console.log('Students count:', students.length);
console.log('Teaches count:', teaches.length);
console.log('Dates:', validDates);

// Group subjects by student group to see sizes
const student_groups = {};
for (const st of students) {
  const key = `${st.branch}_${st.year}_${st.semester}`;
  if (!student_groups[key]) student_groups[key] = [];
  student_groups[key].push(st.id);
}
console.log('Student group sizes:');
for (const [k, v] of Object.entries(student_groups)) {
  console.log(`  Group ${k}: ${v.length} students`);
}

// Subject mappings
const subject_group_map = {};
for (const s of subjects) {
  const key = `${s.branch}_${s.year}_${s.semester}`;
  if (!subject_group_map[key]) subject_group_map[key] = [];
  subject_group_map[key].push(s.code);
}
console.log('Subjects per group in solver input:');
for (const [k, v] of Object.entries(subject_group_map)) {
  console.log(`  Group ${k}: ${v.length} subjects (${v.join(', ')})`);
}

// Check solver subprocess
const pyPath = path.join(__dirname, 'src/services/scheduler.py');
const solverProcess = spawn('python', [pyPath]);

let stdout = '';
let stderr = '';
solverProcess.stdout.on('data', (d) => stdout += d.toString());
solverProcess.stderr.on('data', (d) => stderr += d.toString());
solverProcess.on('close', (code) => {
  console.log('Solver finished with code:', code);
  if (stderr) console.error('Stderr:', stderr);
  try {
    const res = JSON.parse(stdout);
    console.log('Solver status:', res.status);
    if (res.status === 'FAIL') {
      console.log('Conflicts:', res.conflicts);
    } else {
      console.log('Success objective:', res.objective_value);
    }
  } catch (err) {
    console.log('Raw output:', stdout);
  }
});

solverProcess.stdin.write(JSON.stringify(inputData));
solverProcess.stdin.end();
