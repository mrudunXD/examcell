import { initDb, getDb, getSlowQueryLog } from '../src/db/database.js';
import { verifyAuditLogChain } from '../src/services/auditVerification.js';
import { runAutoBackup, getAutoBackupStatus } from '../src/services/autoBackup.js';
import crypto from 'crypto';

async function test() {
  console.log('🧪 Starting Stage 5 Operational Maturity Verification...');

  // Initialize DB
  await initDb();
  const db = getDb();

  // 1. Test Slow Query Logging
  console.log('\n1. Testing Database Slow Query profiling...');
  
  // We run a sleep query which takes ~60ms (>50ms threshold)
  console.log('Executing simulated slow query (pg_sleep)...');
  await db.prepare('SELECT pg_sleep(0.06)').execute([]);
  
  const slowLogs = getSlowQueryLog();
  console.log(`Slow logs captured count: ${slowLogs.length}`);
  if (slowLogs.length > 0 && slowLogs[slowLogs.length - 1].sql.includes('pg_sleep')) {
    console.log(`✓ SUCCESS: Slow query captured! Latency: ${slowLogs[slowLogs.length - 1].duration}ms`);
  } else {
    throw new Error('Slow query logging failed to capture pg_sleep statement');
  }

  // 2. Test Cryptographic Hash Chaining & Verification
  console.log('\n2. Testing Cryptographic Audit Chain Integrity...');
  
  // Write a dummy audit log
  const tempUser = crypto.randomUUID();
  await db.prepare("DELETE FROM audit_log WHERE user_id IN (SELECT id FROM users WHERE email = 'audit@mitwpu.edu.in')").run();
  await db.prepare("DELETE FROM users WHERE email = 'audit@mitwpu.edu.in'").run();
  await db.prepare("INSERT INTO users (id, name, email, password_hash, role, department) VALUES (?, 'Audit Tester', 'audit@mitwpu.edu.in', 'dummy_hash', 'coordinator', 'Admin')")
    .run(tempUser);

  // We simulate what auditLog middleware does:
  const lastLog = await db.prepare('SELECT hash FROM audit_log ORDER BY created_at DESC, id DESC LIMIT 1').get();
  const prevHash = lastLog?.hash || 'GENESIS_HASH';
  const action = 'TEST_ACTION';
  const entity = 'users';
  const entId = tempUser;
  const det = 'Cryptographic chain verification entry';
  const timestamp = new Date().toISOString();
  
  const input = `${prevHash}-${tempUser}-${action}-${entity}-${entId}-${det}-${timestamp}`;
  const hash = crypto.createHash('sha256').update(input).digest('hex');

  await db.prepare(`
    INSERT INTO audit_log (id, user_id, action, entity, entity_id, details, hash, prev_hash, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(crypto.randomUUID(), tempUser, action, entity, entId, det, hash, prevHash, timestamp);

  console.log('✓ Successfully wrote cryptographically chained audit log entry');

  // Verify log chain
  let verification = await verifyAuditLogChain();
  console.log(`Chain verification status: ${verification.valid ? 'SECURE' : 'COMPROMISED'}`);
  if (verification.valid) {
    console.log('✓ SUCCESS: Cryptographic verification passed on valid chain.');
  } else {
    throw new Error('Valid chain was incorrectly flagged as compromised');
  }

  // 3. Test Tamper Evidence detection
  console.log('\n3. Testing Tamper-Evidence Alert system...');
  
  // Insert a tampered entry (manually altered detail that breaks hash calculations)
  const badId = crypto.randomUUID();
  await db.prepare(`
    INSERT INTO audit_log (id, user_id, action, entity, entity_id, details, hash, prev_hash, created_at)
    VALUES (?, ?, 'MALICIOUS_EDIT', 'users', ?, 'Tampered entry details', 'fake_hash_value', ?, ?)
  `).run(badId, tempUser, tempUser, hash, new Date().toISOString());

  verification = await verifyAuditLogChain();
  console.log(`Tamper check status: ${verification.valid ? 'SECURE' : 'COMPROMISED'} (Tampered blocks: ${verification.tamperedCount})`);
  if (!verification.valid && verification.tamperedCount > 0) {
    console.log('✓ SUCCESS: Tampered blocks were correctly flagged by the verifier!');
  } else {
    throw new Error('Tamper check failed to identify compromised logs');
  }

  // Clean up tampered and test data
  await db.prepare('DELETE FROM audit_log WHERE user_id = ?').run(tempUser);
  await db.prepare('DELETE FROM users WHERE id = ?').run(tempUser);
  console.log('✓ Cleaned up test database records');

  // 4. Test Auto-Backup and Retention Scheduler
  console.log('\n4. Testing Auto-Backup & Retention policy...');
  await runAutoBackup();
  const status = getAutoBackupStatus();
  console.log(`Auto-backup status: ${status.status}`);
  if (status.status === 'success') {
    console.log('✓ SUCCESS: Auto-backup succeeded and retention limits were enforced.');
  } else {
    throw new Error(`Auto-backup failed with error: ${status.error}`);
  }

  console.log('\n🎉 All Stage 5 Operational Maturity tests PASSED!');
  process.exit(0);
}

test().catch(err => {
  console.error('\n❌ Stage 5 Verification failed:', err.message);
  process.exit(1);
});
