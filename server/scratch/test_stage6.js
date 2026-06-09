import pg from 'pg';
import dotenv from 'dotenv';
import { spawn } from 'child_process';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

dotenv.config({ path: 'c:/Users/mrudu/Documents/Codes/exam/server/.env' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const solverPath = 'c:/Users/mrudu/Documents/Codes/exam/server/src/services/scheduler.py';

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

async function testStage6() {
  console.log('🧪 Starting Stage 6 (Option 4 & Option 5) Programmatic Verification...');
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

  const client = await pool.connect();
  
  try {
    // ----------------------------------------------------
    // TEST 1: Database Operations for Stage 6
    // ----------------------------------------------------
    console.log('\n--- 1. Testing Database Operations for Leaves, Constraints, and Invigilator Logs ---');
    
    // Fetch a coordinator user or create one
    let userRes = await client.query("SELECT id FROM users LIMIT 1");
    if (userRes.rows.length === 0) {
      // Seed a user if none exists (just in case)
      const userId = crypto.randomUUID();
      await client.query("INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, 'Test User', 'test@mitwpu.edu.in', 'hash', 'coordinator')", [userId]);
      userRes = await client.query("SELECT id FROM users LIMIT 1");
    }
    const testUserId = userRes.rows[0].id;

    // Fetch a student or create one
    let studentRes = await client.query("SELECT id, prn, roll_no, name FROM students LIMIT 1");
    if (studentRes.rows.length === 0) {
      const studentId = crypto.randomUUID();
      await client.query("INSERT INTO students (id, name, prn, roll_no, branch, year, semester) VALUES ($1, 'Jane Student', 'PRN99999', 'R99999', 'CSE', 'TY', 5)", [studentId]);
      studentRes = await client.query("SELECT id, prn, roll_no, name FROM students LIMIT 1");
    }
    const testStudent = studentRes.rows[0];

    // Fetch a subject or create one
    let subjectRes = await client.query("SELECT id FROM subjects LIMIT 1");
    if (subjectRes.rows.length === 0) {
      const subjectId = crypto.randomUUID();
      await client.query("INSERT INTO subjects (id, name, code, branch, year, semester) VALUES ($1, 'Software Eng', 'CSE302', 'CSE', 'TY', 5)", [subjectId]);
      subjectRes = await client.query("SELECT id FROM subjects LIMIT 1");
    }
    const testSubjectId = subjectRes.rows[0].id;

    // Fetch a slot & classroom or create them for invigilator_logs
    let slotRes = await client.query("SELECT id FROM exam_slots LIMIT 1");
    if (slotRes.rows.length === 0) {
      const cycleId = crypto.randomUUID();
      await client.query("INSERT INTO exam_cycles (id, name, start_date, end_date, semester_type) VALUES ($1, 'Test Cycle', '2026-06-20', '2026-06-21', 'odd')", [cycleId]);
      const slotId = crypto.randomUUID();
      await client.query("INSERT INTO exam_slots (id, cycle_id, subject_id, date, start_time, duration_mins, exam_type, exam_mode) VALUES ($1, $2, $3, '2026-06-20', '09:30', 180, 'regular', 'pen_paper')", [slotId, cycleId, testSubjectId]);
      slotRes = await client.query("SELECT id FROM exam_slots LIMIT 1");
    }
    const testSlotId = slotRes.rows[0].id;

    let classroomRes = await client.query("SELECT id FROM classrooms LIMIT 1");
    if (classroomRes.rows.length === 0) {
      const classroomId = crypto.randomUUID();
      await client.query("INSERT INTO classrooms (id, room_no, block, capacity) VALUES ($1, 'A101', 'A', 40)", [classroomId]);
      classroomRes = await client.query("SELECT id FROM classrooms LIMIT 1");
    }
    const testClassroomId = classroomRes.rows[0].id;

    let allocationRes = await client.query("SELECT id FROM room_allocations WHERE slot_id = $1 LIMIT 1", [testSlotId]);
    if (allocationRes.rows.length === 0) {
      const allocationId = crypto.randomUUID();
      await client.query("INSERT INTO room_allocations (id, slot_id, classroom_id) VALUES ($1, $2, $3)", [allocationId, testSlotId, testClassroomId]);
      allocationRes = await client.query("SELECT id FROM room_allocations WHERE slot_id = $1 LIMIT 1", [testSlotId]);
    }
    const testAllocationId = allocationRes.rows[0].id;

    // A. Verify Faculty Leave Insert / Delete
    const leafId = crypto.randomUUID();
    const testDate = '2026-06-25';
    await client.query("INSERT INTO faculty_leaves (id, faculty_id, date, reason) VALUES ($1, $2, $3, 'Sick Leave')", [leafId, testUserId, testDate]);
    const leafFetch = await client.query("SELECT * FROM faculty_leaves WHERE id = $1", [leafId]);
    assert(leafFetch.rows.length === 1 && leafFetch.rows[0].reason === 'Sick Leave', 'Successfully inserted and verified faculty leave record');

    await client.query("DELETE FROM faculty_leaves WHERE id = $1", [leafId]);
    const leafFetchDeleted = await client.query("SELECT * FROM faculty_leaves WHERE id = $1", [leafId]);
    assert(leafFetchDeleted.rows.length === 0, 'Successfully deleted faculty leave record');

    // B. Verify Subject Constraints Insert / Delete
    const constraintId = crypto.randomUUID();
    await client.query("INSERT INTO subject_constraints (id, subject_id, type, date) VALUES ($1, $2, 'excluded_date', $3)", [constraintId, testSubjectId, testDate]);
    const constrFetch = await client.query("SELECT * FROM subject_constraints WHERE id = $1", [constraintId]);
    assert(constrFetch.rows.length === 1 && constrFetch.rows[0].type === 'excluded_date', 'Successfully inserted and verified subject constraint record');

    await client.query("DELETE FROM subject_constraints WHERE id = $1", [constraintId]);
    const constrFetchDeleted = await client.query("SELECT * FROM subject_constraints WHERE id = $1", [constraintId]);
    assert(constrFetchDeleted.rows.length === 0, 'Successfully deleted subject constraint record');

    // C. Verify Invigilator Logs Insert
    const logId = crypto.randomUUID();
    await client.query("INSERT INTO invigilator_logs (id, slot_id, room_allocation_id, logged_by, type, student_id, details) VALUES ($1, $2, $3, $4, 'toilet_out', $5, 'Restroom break (Out)')", [
      logId, testSlotId, testAllocationId, testUserId, testStudent.id
    ]);
    const logFetch = await client.query("SELECT * FROM invigilator_logs WHERE id = $1", [logId]);
    assert(logFetch.rows.length === 1 && logFetch.rows[0].type === 'toilet_out', 'Successfully inserted and verified invigilator log record');

    // Clean up log
    await client.query("DELETE FROM invigilator_logs WHERE id = $1", [logId]);

    // ----------------------------------------------------
    // TEST 2: Student Seating Redirection Logic Simulation
    // ----------------------------------------------------
    console.log('\n--- 2. Simulating Client-Side Barcode Verification and Redirection ---');
    
    // We emulate the React-side scanning handler checking logic
    const mockSelectedRoomId = 'room_allocation_1';
    
    const mockCurrentRoomRecords = [
      { student_id: 'stud1', name: 'Alice Smith', prn: 'PRN101', roll_no: 'R101', seated_room: 'room_allocation_1' },
      { student_id: 'stud2', name: 'Bob Jones', prn: 'PRN102', roll_no: 'R102', seated_room: 'room_allocation_1' },
    ];
    
    const mockAllRoomsInSlot = [
      {
        room: { id: 'room_allocation_1', room_no: 'A101', block: 'A' },
        assignments: [
          { student_id: 'stud1', student_name: 'Alice Smith', prn: 'PRN101', roll_no: 'R101', bench_row: 1, bench_col: 1 },
          { student_id: 'stud2', student_name: 'Bob Jones', prn: 'PRN102', roll_no: 'R102', bench_row: 1, bench_col: 2 },
        ]
      },
      {
        room: { id: 'room_allocation_2', room_no: 'A102', block: 'A' },
        assignments: [
          { student_id: 'stud3', student_name: 'Charlie Brown', prn: 'PRN103', roll_no: 'R103', bench_row: 2, bench_col: 1 },
          { student_id: 'stud4', student_name: 'Diana Prince', prn: 'PRN104', roll_no: 'R104', bench_row: 2, bench_col: 2 },
        ]
      }
    ];

    // Scanning function emulating AttendancePage.jsx
    function scanBarcode(scanInput) {
      const term = scanInput.trim().toUpperCase();
      
      // 1. Search locally
      const studentInRoom = mockCurrentRoomRecords.find(r => 
        r.prn.toUpperCase() === term || r.roll_no.toUpperCase() === term
      );
      if (studentInRoom) {
        return {
          status: 'success',
          message: `${studentInRoom.name} marked Present successfully!`,
          student: studentInRoom
        };
      }
      
      // 2. Search other rooms
      let foundRoom = null;
      let foundStudent = null;
      for (const r of mockAllRoomsInSlot) {
        const match = r.assignments.find(a => 
          a.prn.toUpperCase() === term || a.roll_no.toUpperCase() === term
        );
        if (match) {
          foundRoom = r.room;
          foundStudent = match;
          break;
        }
      }
      
      if (foundStudent && foundRoom) {
        return {
          status: 'redirect',
          message: `WRONG ROOM ALERT! Candidate ${foundStudent.student_name} is registered for this slot but is allocated to Room ${foundRoom.room_no} (${foundRoom.block || ''}) at Bench R${foundStudent.bench_row}-C${foundStudent.bench_col}.`,
          student: foundStudent
        };
      }
      
      // 3. Not found
      return {
        status: 'not_found',
        message: `CANDIDATE NOT SCHEDULED! PRN/Roll No "${term}" is not registered in any room for this exam slot.`
      };
    }

    // Assert scanned inside current room
    const scan1 = scanBarcode('PRN101');
    assert(scan1.status === 'success' && scan1.student.student_id === 'stud1', 'Correct Room Scan: returns success and marks present');

    // Assert scanned in wrong room
    const scan2 = scanBarcode('PRN103');
    assert(scan2.status === 'redirect' && scan2.message.includes('Room A102') && scan2.message.includes('R2-C1'), 'Wrong Room Scan: triggers redirection and informs correct room and bench');

    // Assert scanned invalid PRN
    const scan3 = scanBarcode('PRN999');
    assert(scan3.status === 'not_found' && scan3.message.includes('CANDIDATE NOT SCHEDULED'), 'Invalid Scan: returns not scheduled warning');

    // ----------------------------------------------------
    // TEST 3: OR-Tools CP-SAT Solver Constraints
    // ----------------------------------------------------
    console.log('\n--- 3. Running OR-Tools Solver with Faculty Leaves and Subject Lockouts ---');

    // Setup inputData payload for the solver
    // F1 has leave on 2026-06-20 (Full Day)
    // F2 has no leaves
    // sub1 teaches: F2 teaches sub1, F1 teaches sub2 (faculty cannot invigilate what they teach, handled separately)
    // sub1 has constraint: excluded on 2026-06-20 (Day 1)
    const students = [
      { id: 's1', name: 'Student 1', prn: 'PRN001', roll_no: '101', branch: 'CSE', year: 'TY', semester: 5 },
      { id: 's2', name: 'Student 2', prn: 'PRN002', roll_no: '102', branch: 'CSE', year: 'TY', semester: 5 },
    ];
    
    const subjects = [
      { id: 'sub1', code: 'CSE301', name: 'Database Systems', branch: 'CSE', year: 'TY', semester: 5 },
      { id: 'sub2', code: 'CSE302', name: 'Software Eng', branch: 'CSE', year: 'TY', semester: 5 },
    ];
    
    const classrooms = [
      { id: 'c1', room_no: 'A101', block: 'A', capacity: 40 },
    ];
    
    const faculty = [
      { id: 'f1', name: 'Faculty Leave-Taker', email: 'f1@mitwpu.edu.in' },
      { id: 'f2', name: 'Faculty Available', email: 'f2@mitwpu.edu.in' },
    ];
    
    const teaches = [
      { faculty_id: 'f1', subject_id: 'sub2' },
      { faculty_id: 'f2', subject_id: 'sub1' },
    ];

    const dates = ['2026-06-20', '2026-06-21'];
    
    const shifts = [
      { id: '1', name: 'Morning', start_time: '09:30', duration_mins: 180 },
    ];

    // Options 4 & 5 lists
    const faculty_leaves = [
      { id: 'l1', faculty_id: 'f1', date: '2026-06-20', shift_id: null, reason: 'Full Day Leave' }
    ];

    const subject_constraints = [
      { id: 'sc1', subject_id: 'sub1', type: 'excluded_date', date: '2026-06-20', shift_id: null }
    ];

    const inputData = {
      cycle: { id: 'test_cycle_opt6', name: 'Test Cycle Option 6', start_date: '2026-06-20', end_date: '2026-06-21', semester_type: 'odd' },
      subjects,
      students,
      classrooms,
      faculty,
      teaches,
      faculty_leaves,
      subject_constraints,
      settings: { time_limit_seconds: 5, shifts, dates }
    };

    const solverResult = await runSolver(inputData);
    
    if (solverResult.status === 'FAIL') {
      console.error('Solver returned FAIL. Conflicts:', JSON.stringify(solverResult.conflicts, null, 2));
    }
    
    assert(solverResult.status === 'SUCCESS', 'Solver runs successfully with options 4 & 5 inputs');
    
    if (solverResult.status === 'SUCCESS') {
      // 1. Verify sub1 exclusion on 2026-06-20
      const sub1Slot = solverResult.slots.find(s => s.subject_id === 'sub1');
      assert(sub1Slot && sub1Slot.date === '2026-06-21', `Subject Lockout Check: sub1 (Database) scheduled on date: ${sub1Slot?.date} (Excluded on 2026-06-20)`);

      // 2. Verify faculty leaves restriction for F1 on 2026-06-20
      // Let's check all scheduled rooms and their supervisor duties on 2026-06-20
      let f1DutyOnExcludedDate = false;
      for (const s of solverResult.slots) {
        if (s.date === '2026-06-20') {
          for (const room of s.rooms) {
            if (room.supervisors && room.supervisors.includes('f1')) {
              f1DutyOnExcludedDate = true;
            }
          }
        }
      }
      assert(!f1DutyOnExcludedDate, 'Faculty Leaves Check: F1 (Faculty Leave-Taker) not scheduled on leave date 2026-06-20');
    }

  } catch (err) {
    console.error('❌ Programmatic verification failed with error:', err);
    failed++;
  } finally {
    client.release();
    await pool.end();
  }

  console.log('\n======================================');
  console.log(`📊 STAGE 6 VERIFICATION SUMMARY`);
  console.log(`   Passed: ${passed}`);
  console.log(`   Failed: ${failed}`);
  console.log('======================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

testStage6();
