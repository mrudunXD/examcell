import pg from 'pg';
import dotenv from 'dotenv';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const solverPath = path.resolve(__dirname, '../src/services/scheduler.py');

const pool = new pg.Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || '1234',
  database: process.env.PGDATABASE || 'exam_management',
});

// Helper to execute Python solver
function runSolver(inputData) {
  return new Promise((resolve, reject) => {
    const solverProcess = spawn('python', [solverPath]);
    let stdout = '';
    let stderr = '';
    
    solverProcess.stdout.on('data', (data) => stdout += data.toString());
    solverProcess.stderr.on('data', (data) => stderr += data.toString());
    
    solverProcess.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`Solver failed with code ${code}. Stderr: ${stderr}`));
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (err) {
        reject(new Error(`Failed to parse solver stdout: ${stdout}. Err: ${err.message}`));
      }
    });
    
    solverProcess.stdin.write(JSON.stringify(inputData));
    solverProcess.stdin.end();
  });
}

async function runTests() {
  console.log('🤖 Running Production Regression Tests...');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // --- TEST CASE 1: ME vs MRA Branch Separation ---
  try {
    console.log('\nTest Case 1: ME and MRA Branch Inference and Separation');
    // Seed 1 ME student, 1 MRA student, and subjects for each.
    // They must NOT have student overlaps because they are distinct branches.
    const students = [
      { id: 's1', name: 'ME Student', prn: 'PRN001', roll_no: '101', branch: 'ME', year: 'TY', semester: 5 },
      { id: 's2', name: 'MRA Student', prn: 'PRN002', roll_no: '102', branch: 'MRA', year: 'TY', semester: 5 },
    ];
    const subjects = [
      { id: 'sub1', code: 'ME301', name: 'Thermodynamics', branch: 'ME', year: 'TY', semester: 5 },
      { id: 'sub2', code: 'MRA301', name: 'Robotics Design', branch: 'MRA', year: 'TY', semester: 5 },
    ];
    const classrooms = [{ id: 'c1', room_no: 'A101', block: 'A', capacity: 40 }];
    const faculty = [{ id: 'f1', name: 'Faculty 1', email: 'f1@mitwpu.edu.in' }];
    const teaches = [{ faculty_id: 'f1', subject_id: 'sub1' }, { faculty_id: 'f1', subject_id: 'sub2' }];
    const dates = ['2026-06-08', '2026-06-09'];
    const shifts = [
      { id: '1', name: 'Morning', start_time: '09:30', duration_mins: 180 },
    ];

    const inputData = {
      cycle: { id: 'test_cycle_1', name: 'Test Cycle 1', start_date: '2026-06-08', end_date: '2026-06-09', semester_type: 'odd' },
      subjects,
      students,
      classrooms,
      faculty,
      teaches,
      settings: { time_limit_seconds: 5, shifts, dates }
    };

    const result = await runSolver(inputData);
    assert(result.status === 'SUCCESS', 'Solver successfully scheduled ME and MRA subjects');
    
    // Check if they are scheduled without conflict
    const meSlot = result.slots.find(s => s.subject_id === 'sub1');
    const mraSlot = result.slots.find(s => s.subject_id === 'sub2');
    
    assert(meSlot && mraSlot, 'Both slots scheduled');
    // If they are separate branches with different student groups, they CAN be scheduled on the same date/shift (or different)
    // but they shouldn't conflict with student groups
    console.log(`    ME scheduled on: ${meSlot?.date} ${meSlot?.start_time}`);
    console.log(`    MRA scheduled on: ${mraSlot?.date} ${mraSlot?.start_time}`);

  } catch (err) {
    console.error('Test Case 1 Error:', err.message);
    failed++;
  }

  // --- TEST CASE 2: Schedule Compactness Optimization ---
  try {
    console.log('\nTest Case 2: Schedule Compactness (Sparse Scheduling Minimization)');
    const students = [
      { id: 's1', name: 'CSE Student', prn: 'PRN003', roll_no: '201', branch: 'CSE', year: 'TY', semester: 5 },
    ];
    const subjects = [
      { id: 'sub1', code: 'CSE301', name: 'Database Systems', branch: 'CSE', year: 'TY', semester: 5 },
      { id: 'sub2', code: 'CSE302', name: 'Software Eng', branch: 'CSE', year: 'TY', semester: 5 },
      { id: 'sub3', code: 'CSE303', name: 'Computer Networks', branch: 'CSE', year: 'TY', semester: 5 },
    ];
    const classrooms = [{ id: 'c1', room_no: 'A101', block: 'A', capacity: 40 }];
    const faculty = [{ id: 'f1', name: 'Faculty 1', email: 'f1@mitwpu.edu.in' }];
    const teaches = [{ faculty_id: 'f1', subject_id: 'sub1' }, { faculty_id: 'f1', subject_id: 'sub2' }, { faculty_id: 'f1', subject_id: 'sub3' }];
    
    // 5 valid exam dates pool
    const dates = ['2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12'];
    const shifts = [
      { id: '1', name: 'Morning', start_time: '09:30', duration_mins: 180 },
    ];

    const inputData = {
      cycle: { id: 'test_cycle_2', name: 'Test Cycle 2', start_date: '2026-06-08', end_date: '2026-06-12', semester_type: 'odd' },
      subjects,
      students,
      classrooms,
      faculty,
      teaches,
      settings: { time_limit_seconds: 5, shifts, dates }
    };

    const result = await runSolver(inputData);
    if (result.status === 'FAIL') {
      console.error('Solver returned FAIL. Conflicts:', JSON.stringify(result.conflicts, null, 2));
    }
    assert(result.status === 'SUCCESS', 'Solver scheduled CSE subjects');
    
    const datesAssigned = result.slots.map(s => s.date).sort();
    const spanDays = Math.round((new Date(datesAssigned[2]) - new Date(datesAssigned[0])) / (1000 * 60 * 60 * 24));
    const isCompact = spanDays === 2;
    assert(isCompact, `Exams scheduled compactly with consecutive date span of 2 days: [${datesAssigned.join(', ')}]`);

  } catch (err) {
    console.error('Test Case 2 Error:', err.message);
    failed++;
  }

  // --- SUMMARY ---
  console.log(`\n======================================`);
  console.log(`📊 REGRESSION TEST SUMMARY`);
  console.log(`   Passed: ${passed}`);
  console.log(`   Failed: ${failed}`);
  console.log(`======================================`);
  
  await pool.end();
  
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
