import { initDb, getDb } from '../src/db/database.js';
import { triggerChaos, getChaosState } from '../src/services/chaosEngine.js';
import { initSocket } from '../src/services/socket.js';
import http from 'http';

async function testChaos() {
  console.log('🧪 Starting Task 3: Chaos Engineering Injector verification...');

  // 1. Initialize DB and socket server context
  await initDb();
  const db = getDb();
  
  const server = http.createServer();
  initSocket(server);

  // 2. Test DB Drop Chaos Injection
  console.log('\nStep 1: Testing DB drop chaos injection...');
  
  // Normal DB query should succeed
  const testQuery = await db.prepare('SELECT 1 as val').get();
  if (testQuery.val !== 1) {
    throw new Error('Pre-chaos query failed to return expected result');
  }
  console.log('✓ Normal database query executed successfully');

  // Trigger DB chaos mode
  triggerChaos('db_drop', true);
  
  let dbFailedAsExpected = false;
  try {
    await db.prepare('SELECT 1 as val').get();
  } catch (err) {
    dbFailedAsExpected = true;
    console.log(`✓ Catch block successfully caught expected chaos DB error: ${err.message}`);
  }

  if (!dbFailedAsExpected) {
    throw new Error('Database query succeeded when DB drop chaos was active!');
  }

  // Deactivate DB chaos mode
  triggerChaos('db_drop', false);
  
  const recoveryQuery = await db.prepare('SELECT 1 as val').get();
  if (recoveryQuery.val !== 1) {
    throw new Error('Post-chaos recovery query failed to execute');
  }
  console.log('✓ Database queries recovered and execute normally after deactivation.');

  // 3. Test Solver Timeout Chaos Injection
  console.log('\nStep 2: Testing solver timeout chaos injection...');
  
  // Check solver state before chaos
  let chaosState = getChaosState();
  if (chaosState.solverChaosMode) {
    throw new Error('Solver chaos mode was active prematurely');
  }

  // Trigger solver chaos mode
  triggerChaos('solver_timeout', true);
  chaosState = getChaosState();
  if (!chaosState.solverChaosMode) {
    throw new Error('Failed to enable solver chaos mode flag');
  }
  console.log('✓ Solver chaos mode flag successfully enabled');

  // Deactivate solver chaos mode
  triggerChaos('solver_timeout', false);
  chaosState = getChaosState();
  if (chaosState.solverChaosMode) {
    throw new Error('Failed to disable solver chaos mode flag');
  }
  console.log('✓ Solver chaos mode flag successfully disabled');

  // 4. Test WebSocket Storm Chaos Injection
  console.log('\nStep 3: Testing WebSocket disconnect storm simulation...');
  const stormResult = triggerChaos('socket_storm');
  if (!stormResult.success) {
    throw new Error('WebSocket disconnect storm trigger failed');
  }
  console.log('✓ Success: Kiosk disconnect storm triggered successfully');

  console.log('\n🎉 Task 3 Chaos Engineering Injector tests PASSED!');
  process.exit(0);
}

testChaos().catch(err => {
  console.error('\n❌ Task 3 Chaos Injection test failed:', err.message);
  process.exit(1);
});
