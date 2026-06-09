import { initDb, getDb } from '../src/db/database.js';
import crypto from 'crypto';

async function test() {
  console.log('🧪 Starting Faculty Portal Backend Verification...');

  // Initialize DB
  await initDb();
  const db = getDb();

  // 1. Verify replacement_requests table
  console.log('1. Testing replacement_requests table...');
  
  // Find a supervisor duty to test with
  const duty = await db.prepare('SELECT id, faculty_id FROM supervisor_duties LIMIT 1').get();
  if (!duty) {
    console.log('⚠️ No supervisor duty found. Seeding a temporary user, room allocation, and supervisor duty...');
    // Seed temporary records
    const tempUser = crypto.randomUUID();
    const tempRa = crypto.randomUUID();
    const tempSlot = crypto.randomUUID();
    const tempSubj = crypto.randomUUID();
    const tempRoom = crypto.randomUUID();
    const tempCycle = crypto.randomUUID();

    await db.prepare('INSERT INTO users (id, name, email, role, department) VALUES (?, ?, ?, \'faculty\', \'CSE\')')
      .run(tempUser, 'Temp Faculty', `temp_${tempUser}@mitwpu.edu.in`);
    await db.prepare('INSERT INTO exam_cycles (id, name, start_date, end_date, status) VALUES (?, \'Temp Cycle\', \'2026-06-09\', \'2026-06-12\', \'active\')')
      .run(tempCycle);
    await db.prepare('INSERT INTO subjects (id, name, code, branch, year, semester) VALUES (?, \'Temp Subject\', \'TEMP101\', \'CSE\', \'FY\', 1)')
      .run(tempSubj);
    await db.prepare('INSERT INTO exam_slots (id, cycle_id, subject_id, date, start_time, duration_mins) VALUES (?, ?, ?, \'2026-06-09\', \'09:30:00\', 180)')
      .run(tempSlot, tempCycle, tempSubj);
    await db.prepare('INSERT INTO classrooms (id, room_no, capacity, bench_rows, bench_cols) VALUES (?, \'TEMP_R1\', 30, 6, 5)')
      .run(tempRoom);
    await db.prepare('INSERT INTO room_allocations (id, slot_id, classroom_id) VALUES (?, ?, ?)')
      .run(tempRa, tempSlot, tempRoom);
    await db.prepare('INSERT INTO supervisor_duties (id, faculty_id, room_allocation_id, role) VALUES (?, ?, ?, \'primary\')')
      .run('temp_duty_id', tempUser, tempRa);
    
    duty = { id: 'temp_duty_id', faculty_id: tempUser };
  }

  const reqId = crypto.randomUUID();
  // Insert request
  await db.prepare(`
    INSERT INTO replacement_requests (id, duty_id, faculty_id, reason, status)
    VALUES (?, ?, ?, 'Sickness emergency', 'pending')
  `).run(reqId, duty.id, duty.faculty_id);

  console.log('✓ Inserted pending replacement request');

  // Query request
  const fetchedReq = await db.prepare('SELECT * FROM replacement_requests WHERE id = ?').get(reqId);
  if (fetchedReq && fetchedReq.reason === 'Sickness emergency') {
    console.log('✓ Successfully retrieved replacement request');
  } else {
    throw new Error('Failed to retrieve replacement request correctly');
  }

  // Resolve request
  await db.prepare(`
    UPDATE replacement_requests
    SET status = 'approved', resolved_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(reqId);

  const resolvedReq = await db.prepare('SELECT status FROM replacement_requests WHERE id = ?').get(reqId);
  if (resolvedReq && resolvedReq.status === 'approved') {
    console.log('✓ Successfully updated replacement request status to approved');
  } else {
    throw new Error('Failed to update replacement request status');
  }

  // Clean up
  await db.prepare('DELETE FROM replacement_requests WHERE id = ?').run(reqId);
  console.log('✓ Cleaned up replacement request test data');

  // 2. Verify incidents evidence_image column
  console.log('2. Testing incidents.evidence_image column...');
  
  // Find a slot and room allocation to test with
  const ra = await db.prepare('SELECT id, slot_id FROM room_allocations LIMIT 1').get();
  if (ra) {
    const incId = crypto.randomUUID();
    const mockBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANS';
    
    await db.prepare(`
      INSERT INTO incidents (id, slot_id, room_allocation_id, reported_by, type, description, severity, evidence_image)
      VALUES (?, ?, ?, ?, 'malpractice', 'Cheat sheet found under desk', 'high', ?)
    `).run(incId, ra.slot_id, ra.id, duty ? duty.faculty_id : 'temp_user_id', mockBase64);

    console.log('✓ Inserted incident with base64 evidence image');

    const fetchedInc = await db.prepare('SELECT * FROM incidents WHERE id = ?').get(incId);
    if (fetchedInc && fetchedInc.evidence_image === mockBase64) {
      console.log('✓ Successfully retrieved incident with correct base64 evidence image');
    } else {
      throw new Error('Evidence image column was not saved/retrieved correctly');
    }

    // Clean up
    await db.prepare('DELETE FROM incidents WHERE id = ?').run(incId);
    console.log('✓ Cleaned up incident test data');
  } else {
    console.log('⚠️ Skipping incidents test: no room allocation available');
  }

  console.log('🎉 All Faculty Portal Backend tests PASSED!');
  process.exit(0);
}

test().catch(err => {
  console.error('❌ Test failed with error:', err.message);
  process.exit(1);
});
