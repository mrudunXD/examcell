import { getDb, initDb } from './src/db/database.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  await initDb();
  const db = getDb();
  
  // Find a cycle that exists
  const cycles = await db.prepare("SELECT * FROM exam_cycles WHERE id='5247a135-13a4-44c5-bf3a-3884f3f68313'").all();
  if (!cycles.length) {
    console.error('No cycles found to debug!');
    return;
  }
  const cycle = cycles[0];
  const cycleId = cycle.id;
  console.log(`Debugging solver for cycle: ${cycle.name} (${cycleId})`);

  function addDays(dateStr, n) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + n);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  function isSunday(dateStr) { return new Date(dateStr + 'T00:00:00').getDay() === 0; }

  const { start_date, end_date, semester_type } = cycle;
  const parityFilter = semester_type === 'odd' ? 'semester % 2 = 1' : 'semester % 2 = 0';

  const subjects = await db.prepare(`SELECT * FROM subjects WHERE ${parityFilter} GROUP BY code ORDER BY code`).all();
  const teaches = await db.prepare("SELECT faculty_id, subject_id FROM faculty_subjects").all();
  const classrooms = await db.prepare("SELECT * FROM classrooms WHERE is_active=1").all();
  const faculty = await db.prepare("SELECT id, name, email, department FROM users WHERE role='faculty' AND is_active=1").all();
  const students = await db.prepare("SELECT id, name, prn, roll_no, branch, year, semester, section FROM students WHERE is_active=1").all();
  const leaves = await db.prepare("SELECT * FROM faculty_leaves").all();
  const subjectConstraints = await db.prepare("SELECT * FROM subject_constraints").all();

  const validDates = [];
  let cur = start_date;
  while (cur <= end_date && validDates.length < 100) {
    if (!isSunday(cur)) validDates.push(cur);
    cur = addDays(cur, 1);
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
    cycle,
    subjects: solverSubjects,
    students: solverStudents,
    classrooms,
    faculty,
    teaches,
    faculty_leaves: leaves,
    subject_constraints: subjectConstraints,
    settings: {
      time_limit_seconds: 30,
      shifts: [
        { id: '1', name: 'Shift 1', start_time: '09:30', duration_mins: 180 },
        { id: '2', name: 'Shift 2', start_time: '13:30', duration_mins: 180 }
      ],
      dates: validDates
    }
  };

  fs.writeFileSync('scratch_input.json', JSON.stringify(inputData, null, 2));

  console.log('Classrooms count:', classrooms.length);
  console.log('Subjects count:', solverSubjects.length);
  console.log('Faculty count:', faculty.length);
  console.log('Students count:', solverStudents.length);
  console.log('Teaches count:', teaches.length);
  console.log('Dates:', validDates);

  // Group subjects by student group to see sizes
  const student_groups = {};
  for (const st of solverStudents) {
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
  for (const s of solverSubjects) {
    const key = `${s.branch}_${s.year}_${s.semester}`;
    if (!subject_group_map[key]) subject_group_map[key] = [];
    subject_group_map[key].push(s.code);
  }
  console.log('Subjects per group in solver input:');
  for (const [k, v] of Object.entries(subject_group_map)) {
    console.log(`  Group ${k}: ${v.length} subjects (${v.join(', ')})`);
  }

  const pyPath = path.join(__dirname, 'src/services/scheduler/solver.py');
  console.log('Spawning python solver:', pyPath);
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
        console.log('Conflicts:', JSON.stringify(res.conflicts, null, 2));
      } else {
        console.log('Success objective:', res.objective_value);
      }
    } catch (err) {
      console.log('Raw output:', stdout);
    }
  });

  solverProcess.stdin.write(JSON.stringify(inputData));
  solverProcess.stdin.end();
}

main().catch(err => {
  console.error('Error running main:', err);
});
