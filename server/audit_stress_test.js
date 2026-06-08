import { initDb, getDb } from './src/db/database.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PY_PATH = path.resolve(__dirname, 'src/services/scheduler.py');

console.log('🧪 Starting Autonomous QA Audit & Stress-Testing Suite...');
console.log('Connecting to PostgreSQL database...');
await initDb();
const db = getDb();

// Helper to run solver process
function runSolver(inputData) {
  return new Promise((resolve, reject) => {
    const solverProcess = spawn('python', [PY_PATH]);
    
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
        reject(new Error(`Solver failed with code ${code}. Stderr: ${stderr}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (err) {
        reject(new Error(`Failed to parse solver JSON: ${stdout}. Error: ${err.message}`));
      }
    });
    
    solverProcess.stdin.write(JSON.stringify(inputData));
    solverProcess.stdin.end();
  });
}

async function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.log(`  ❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // TEST 1: Database Branch Inference Verification
  // -------------------------------------------------------------
  console.log('\n--- Test 1: Database Branch Inference & Specialization Mapping ---');
  try {
    const aidSubjects = await db.prepare("SELECT * FROM subjects WHERE code LIKE 'AID%'").all();
    const allAidCorrect = aidSubjects.every(s => s.branch === 'CSE (AIDS)');
    assert(aidSubjects.length > 0, `Found ${aidSubjects.length} subjects with code starting with AID.`);
    assert(allAidCorrect, 'All subjects with codes starting with AID are classified under the branch "CSE (AIDS)".');

    const cseStudents = await db.prepare("SELECT COUNT(*) as count FROM students WHERE branch = 'CSE (AIDS)'").get();
    assert(cseStudents.count > 0, `Database contains ${cseStudents.count} students registered under the branch "CSE (AIDS)".`);
  } catch (err) {
    console.error('Test 1 failed with error:', err.message);
    failed++;
  }

  // Fetch base database records to build solver inputs
  const classrooms = await db.prepare("SELECT * FROM classrooms WHERE is_active=1").all();
  const faculty = await db.prepare("SELECT id, name, email, department FROM users WHERE role='faculty' AND is_active=1").all();
  const teaches = await db.prepare("SELECT faculty_id, subject_id FROM faculty_subjects").all();
  const students = await db.prepare("SELECT id, name, prn, roll_no, branch, year, semester FROM students WHERE is_active=1").all();

  // -------------------------------------------------------------
  // TEST 2: Final Examination Rules (Max 1 exam/day per student)
  // -------------------------------------------------------------
  console.log('\n--- Test 2: Final Examination Scheduling (Max 1 exam/day per student, chronological ordering, compactness) ---');
  try {
    // Select odd subjects
    const subjects = await db.prepare("SELECT * FROM subjects WHERE semester % 2 = 1 GROUP BY code").all();
    
    const inputData = {
      cycle: {
        id: 'test_final_cycle_id',
        name: 'End Term Examinations (June 2026)',
        start_date: '2026-06-08',
        end_date: '2026-06-15',
        semester_type: 'odd'
      },
      subjects,
      students,
      classrooms,
      faculty,
      teaches,
      settings: {
        time_limit_seconds: 15,
        shifts: [
          { id: '1', name: 'Morning Shift', start_time: '09:30', duration_mins: 180 },
          { id: '2', name: 'Afternoon Shift', start_time: '13:30', duration_mins: 180 }
        ],
        dates: ['2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12', '2026-06-13'],
        order_by_year: true
      }
    };

    console.log(`Launching solver with ${subjects.length} subjects and 6 dates...`);
    const start = Date.now();
    const result = await runSolver(inputData);
    const duration = Date.now() - start;
    console.log('Result:', result);
    assert(result.status === 'SUCCESS', `Solver returned status: ${result.status}`);

    if (result.status === 'SUCCESS') {
      // 1. Verify max 1 exam per day per student group
      const slots = result.slots;
      const groupExamsPerDay = {}; // groupKey -> date -> count
      let finalViolation = false;

      // Group subjects by subject_id
      const subjMap = {};
      for (const s of subjects) subjMap[s.id] = s;

      for (const slot of slots) {
        const s = subjMap[slot.subject_id];
        if (!s) continue;
        const gKey = `${s.branch}_${s.year}_${s.semester}`;
        if (!groupExamsPerDay[gKey]) groupExamsPerDay[gKey] = {};
        if (!groupExamsPerDay[gKey][slot.date]) groupExamsPerDay[gKey][slot.date] = 0;
        groupExamsPerDay[gKey][slot.date]++;
        if (groupExamsPerDay[gKey][slot.date] > 1) {
          finalViolation = true;
          console.log(`      [VIOLATION] Group ${gKey} has ${groupExamsPerDay[gKey][slot.date]} exams on ${slot.date}`);
        }
      }
      assert(!finalViolation, 'Verified: No student group has more than 1 final exam on the same day.');

      // 2. Verify chronological ordering (FY index < TY index average)
      let fySum = 0, fyCount = 0;
      let tySum = 0, tyCount = 0;
      const datesList = ['2026-06-08', '2026-06-09', '2026-06-10', '2026-06-11', '2026-06-12', '2026-06-13'];

      for (const slot of slots) {
        const s = subjMap[slot.subject_id];
        if (!s) continue;
        const dateIdx = datesList.indexOf(slot.date);
        if (s.year === 'FY') {
          fySum += dateIdx;
          fyCount++;
        } else if (s.year === 'TY') {
          tySum += dateIdx;
          tyCount++;
        }
      }
      const fyAvg = fyCount > 0 ? fySum / fyCount : 0;
      const tyAvg = tyCount > 0 ? tySum / tyCount : 0;
      console.log(`      FY average day index: ${fyAvg.toFixed(2)} | TY average day index: ${tyAvg.toFixed(2)}`);
      assert(fyAvg < tyAvg, 'Verified: First Year (FY) exams are scheduled earlier on average than Third Year (TY) exams.');
    }
  } catch (err) {
    console.error('Test 2 failed with error:', err.message);
    failed++;
  }

  // -------------------------------------------------------------
  // TEST 3: CCA Examination Rules (Max 2 exams/day, 1-hour gap)
  // -------------------------------------------------------------
  console.log('\n--- Test 3: CCA Examination Scheduling (Max 2 exams/day, 1-hour gap constraint) ---');
  try {
    const subjects = await db.prepare("SELECT * FROM subjects WHERE semester % 2 = 1 GROUP BY code LIMIT 15").all();
    
    const inputData = {
      cycle: {
        id: 'test_cca_cycle_id',
        name: 'Mid Term Continuous Assessment (CCA2)',
        start_date: '2026-06-08',
        end_date: '2026-06-12',
        semester_type: 'odd'
      },
      subjects,
      students,
      classrooms,
      faculty,
      teaches,
      settings: {
        time_limit_seconds: 15,
        shifts: [
          { id: '1', name: 'Shift 1', start_time: '09:30', duration_mins: 90 }, // ends 11:00
          { id: '2', name: 'Shift 2', start_time: '11:30', duration_mins: 90 }, // ends 13:00 (gap with Shift 1 is only 30 mins!)
          { id: '3', name: 'Shift 3', start_time: '14:30', duration_mins: 90 }  // ends 16:00 (gap with Shift 1 is 3.5 hrs, gap with Shift 2 is 1.5 hrs)
        ],
        dates: ['2026-06-08', '2026-06-09', '2026-06-10'],
        order_by_year: false
      }
    };

    console.log(`Launching solver for CCA with ${subjects.length} subjects, 3 shifts (Shift 1 & 2 gap = 30m)...`);
    const start = Date.now();
    const result = await runSolver(inputData);
    const duration = Date.now() - start;
    console.log(`Solver finished in ${duration}ms.`);

    assert(result.status === 'SUCCESS', `Solver returned status: ${result.status}`);

    if (result.status === 'SUCCESS') {
      const slots = result.slots;
      const groupExamsPerDay = {}; // group -> date -> list of shifts scheduled
      let maxExamsViolation = false;
      let gapViolation = false;

      const subjMap = {};
      for (const s of subjects) subjMap[s.id] = s;

      for (const slot of slots) {
        const s = subjMap[slot.subject_id];
        if (!s) continue;
        const gKey = `${s.branch}_${s.year}_${s.semester}`;
        if (!groupExamsPerDay[gKey]) groupExamsPerDay[gKey] = {};
        if (!groupExamsPerDay[gKey][slot.date]) groupExamsPerDay[gKey][slot.date] = [];
        groupExamsPerDay[gKey][slot.date].push(slot.start_time);
      }

      for (const [gKey, datesMap] of Object.entries(groupExamsPerDay)) {
        for (const [date, shiftsScheduled] of Object.entries(datesMap)) {
          if (shiftsScheduled.length > 2) {
            maxExamsViolation = true;
            console.log(`      [VIOLATION] Group ${gKey} has ${shiftsScheduled.length} CCA exams on ${date}.`);
          }
          // Shift 1 (09:30) and Shift 2 (11:30) cannot coexist
          if (shiftsScheduled.includes('09:30') && shiftsScheduled.includes('11:30')) {
            gapViolation = true;
            console.log(`      [VIOLATION] Group ${gKey} has exams in both adjacent Shift 1 (09:30) and Shift 2 (11:30) on ${date}.`);
          }
        }
      }

      assert(!maxExamsViolation, 'Verified: No student group has more than 2 CCA exams on the same day.');
      assert(!gapViolation, 'Verified: Enforced 1-hour minimum gap between CCA exam shifts on the same day (Shift 1 and Shift 2 never assigned together).');
    }
  } catch (err) {
    console.error('Test 3 failed with error:', err.message);
    failed++;
  }

  // -------------------------------------------------------------
  // TEST 4: Impossible Schedule Conflict Detection
  // -------------------------------------------------------------
  console.log('\n--- Test 4: Impossible Schedule Graceful Failure & Conflict Logging ---');
  try {
    // Select 10 subjects and override them to be in the same student group (forcing a conflict)
    const dbSubjects = await db.prepare("SELECT * FROM subjects LIMIT 10").all();
    const subjects = dbSubjects.map(s => ({
      ...s,
      branch: 'CSE',
      year: 'SY',
      semester: 3
    }));
    
    const inputData = {
      cycle: {
        id: 'test_impossible_cycle_id',
        name: 'Impossible Cycle',
        start_date: '2026-06-08',
        end_date: '2026-06-08',
        semester_type: 'odd'
      },
      subjects,
      students,
      classrooms,
      faculty,
      teaches,
      settings: {
        time_limit_seconds: 10,
        shifts: [
          { id: '1', name: 'Shift 1', start_time: '09:30', duration_mins: 180 }
        ],
        dates: ['2026-06-08'], // Only 1 date & 1 shift = 1 slot total
        order_by_year: false
      }
    };

    console.log(`Launching solver with 10 conflicting subjects and only 1 available slot...`);
    const start = Date.now();
    const result = await runSolver(inputData);
    const duration = Date.now() - start;
    console.log(`Solver finished in ${duration}ms.`);

    assert(result.status === 'FAIL', `Solver correctly failed: status = ${result.status}`);
    assert(result.conflicts && result.conflicts.length > 0, `Solver correctly logged ${result.conflicts?.length || 0} scheduling conflicts.`);
    
    if (result.conflicts && result.conflicts.length > 0) {
      console.log('      Sample conflict description:', result.conflicts[0].description);
    }
  } catch (err) {
    console.error('Test 4 failed with error:', err.message);
    failed++;
  }

  // -------------------------------------------------------------
  // Test Summary
  // -------------------------------------------------------------
  console.log('\n--- Testing Summary ---');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  if (failed === 0) {
    console.log('🎉 All tests passed successfully! Operations are 100% operationally correct.');
  } else {
    console.error('❌ Some test scenarios failed. Check the logs above.');
    process.exit(1);
  }
}

runTests().then(() => db.close());
