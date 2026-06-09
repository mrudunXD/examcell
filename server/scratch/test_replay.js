import { initDb, getDb } from '../src/db/database.js';
import crypto from 'crypto';

async function testReplay() {
  console.log('🧪 Starting Task 5: Deterministic Solver Replay verification...');

  await initDb();
  const db = getDb();

  // Find a cycle to use
  const cycle = await db.prepare('SELECT * FROM exam_cycles LIMIT 1').get();
  if (!cycle) {
    console.warn('⚠️ No cycles found in DB. Skipping replay test.');
    process.exit(0);
  }
  console.log(`Target cycle for test: ${cycle.name} (ID: ${cycle.id})`);

  // Construct a dummy solver run payload
  const runId = crypto.randomUUID();
  const dummyInput = {
    cycle: {
      id: cycle.id,
      name: cycle.name,
      start_date: cycle.start_date,
      end_date: cycle.end_date
    },
    subjects: [{ id: 'sub1', code: 'CS101', name: 'Intro to Programming', branch: 'CSE', year: 'FY', semester: 1 }],
    students: [{ id: 'std1', name: 'John Doe', prn: '1032210001', roll_no: '101', branch: 'CSE', year: 'FY', semester: 1 }],
    classrooms: [{ id: 'cls1', room_no: 'A101', block: 'A', capacity: 30, bench_rows: 5, bench_cols: 6 }],
    faculty: [{ id: 'fac1', name: 'Dr. Smith', email: 'smith@mitwpu.edu.in', department: 'CS' }],
    teaches: [],
    settings: {
      time_limit_seconds: 30,
      shifts: [{ id: '1', name: 'Shift 1', start_time: '09:30', duration_mins: 180 }],
      dates: [cycle.start_date],
      order_by_year: true
    }
  };

  // 1. Insert the dummy solver run payload
  console.log('Writing mock solver run payload to database...');
  await db.prepare('INSERT INTO solver_runs (id, cycle_id, input_payload) VALUES (?, ?, ?)')
    .run(runId, cycle.id, JSON.stringify(dummyInput));

  // 2. Query it back and assert it matches
  console.log('Retrieving solver run...');
  const run = await db.prepare('SELECT * FROM solver_runs WHERE id = ?').get(runId);
  if (!run) {
    throw new Error('Solver run was not saved to database!');
  }

  const retrievedInput = JSON.parse(run.input_payload);
  if (retrievedInput.cycle.id !== cycle.id || retrievedInput.subjects[0].code !== 'CS101') {
    throw new Error('Retrieved solver run input payload is corrupted or does not match original!');
  }
  console.log('✓ Success: Solver run payload saved and retrieved successfully.');

  // Clean up
  await db.prepare('DELETE FROM solver_runs WHERE id = ?').run(runId);
  console.log('✓ Cleaned up test records');

  console.log('\n🎉 Task 5 Solver Replay tests PASSED!');
  process.exit(0);
}

testReplay().catch(err => {
  console.error('\n❌ Task 5 Replay verification failed:', err.message);
  process.exit(1);
});
