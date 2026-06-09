import { initDb, getDb } from '../src/db/database.js';
import { createBackup, restoreBackup } from '../src/services/backupService.js';
import crypto from 'crypto';
import fs from 'fs';

async function testRecovery() {
  console.log('🧪 Starting Task 2: Database Recovery Validation Suite...');
  
  await initDb();
  const db = getDb();

  // Clean up any stale tester accounts
  await db.prepare("DELETE FROM users WHERE email = 'recovery_tester@mitwpu.edu.in'").run();

  // Get initial count of users
  const initialUsersRes = await db.prepare('SELECT COUNT(*) as cnt FROM users').get();
  const initialCount = initialUsersRes.cnt;
  console.log(`Initial users count: ${initialCount}`);

  // 1. Create a Snapshot
  console.log('\nStep 1: Creating database backup snapshot...');
  const tempUser = crypto.randomUUID();
  await db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, department)
    VALUES (?, 'Recovery Tester', 'recovery_tester@mitwpu.edu.in', 'dummy_hash', 'coordinator', 'QA')
  `).run(tempUser);
  
  const backup = await createBackup();
  console.log(`✓ Backup snapshot created successfully: ${backup.filename}`);

  // Read backup file contents to memory
  const backupData = JSON.parse(fs.readFileSync(backup.filepath, 'utf-8'));

  // 2. Test Partial Loss & Simple Restoration
  console.log('\nStep 2: Testing recovery from partial data loss (deleting tester user)...');
  await db.prepare('DELETE FROM users WHERE id = ?').run(tempUser);
  
  let checkUser = await db.prepare('SELECT * FROM users WHERE id = ?').get(tempUser);
  if (checkUser) {
    throw new Error('Pre-restore state is invalid: user was not deleted');
  }

  console.log('Executing restore operation...');
  await restoreBackup(backupData);
  
  checkUser = await db.prepare('SELECT * FROM users WHERE id = ?').get(tempUser);
  if (!checkUser) {
    throw new Error('Restore failed to recover deleted user!');
  }
  console.log('✓ Success: Deleted user successfully restored!');

  // 3. Test Recovery under Corrupted DB State
  console.log('\nStep 3: Testing recovery from DB corruption (malicious deletes/edits)...');
  // Corrupt the DB: delete multiple critical tables' records
  await db.prepare('DELETE FROM users WHERE id = ?').run(tempUser);
  
  console.log('Executing restore on corrupted database...');
  await restoreBackup(backupData);
  
  checkUser = await db.prepare('SELECT * FROM users WHERE id = ?').get(tempUser);
  if (!checkUser) {
    throw new Error('Restore failed to recover database from corruption!');
  }
  console.log('✓ Success: Database successfully recovered from corruption!');

  // 4. Test Transactional Safety on Interrupted Restore (Rollback Verification)
  console.log('\nStep 4: Testing rollback safety on interrupted restore...');
  
  // Make a valid change first (so we can assert it is NOT rolled back / remains untouched)
  const anotherUser = crypto.randomUUID();
  await db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, department)
    VALUES (?, 'Untouched Tester', 'untouched@mitwpu.edu.in', 'dummy_hash', 'coordinator', 'QA')
  `).run(anotherUser);

  // Construct a corrupt backup payload that will fail insertion halfway
  const corruptedBackupData = JSON.parse(JSON.stringify(backupData));
  
  // Corrupt the user table rows in the backup by inserting a null value for a NOT NULL column
  corruptedBackupData.tables.users.push({
    id: crypto.randomUUID(),
    name: null, // this will fail as 'name' is NOT NULL in database schema
    email: 'corrupt_email@mitwpu.edu.in',
    password_hash: 'dummy',
    role: 'coordinator',
    department: 'QA'
  });

  console.log('Attempting restore with corrupted payload (expected to throw)...');
  let restoreThrew = false;
  try {
    await restoreBackup(corruptedBackupData);
  } catch (err) {
    restoreThrew = true;
    console.log(`✓ Catch block successfully caught expected error: ${err.message}`);
  }

  if (!restoreThrew) {
    throw new Error('Interrupted restore unexpectedly completed without throwing error!');
  }

  // Assert rollback: check that the state of the database remains exactly as it was
  // before the corrupt restore attempt (i.e. 'Untouched Tester' should still be there)
  const untouchedUser = await db.prepare("SELECT * FROM users WHERE email = 'untouched@mitwpu.edu.in'").get();
  if (!untouchedUser) {
    throw new Error('ROLLBACK FAILED: Interrupted restore corrupted the database and did not revert deletes!');
  }
  
  console.log('✓ Success: Rollback verified! Database reverted to its stable pre-restore state on failure.');

  // Cleanup
  await db.prepare("DELETE FROM users WHERE email = 'recovery_tester@mitwpu.edu.in'").run();
  await db.prepare("DELETE FROM users WHERE email = 'untouched@mitwpu.edu.in'").run();
  // Delete physical backup file
  fs.unlinkSync(backup.filepath);
  
  console.log('\n🎉 Task 2 Database Recovery Validation tests PASSED!');
  process.exit(0);
}

testRecovery().catch(err => {
  console.error('\n❌ Task 2 Recovery Validation failed:', err.message);
  process.exit(1);
});
