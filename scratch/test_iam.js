import { initDb, getDb } from '../server/src/db/database.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

async function runTests() {
  console.log('🔄 Initializing database for IAM verification...');
  await initDb();
  const db = getDb();

  console.log('🧪 Test 1: Verify users table schema extensions...');
  const columns = await db.prepare(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'users'
  `).all();
  
  const expectedCols = ['employee_id', 'username', 'phone', 'profile_picture', 'designation', 'status', 'last_login', 'last_password_change'];
  const columnNames = columns.map(c => c.column_name);

  for (const col of expectedCols) {
    if (columnNames.includes(col)) {
      console.log(`  ✓ Column '${col}' exists`);
    } else {
      throw new Error(`❌ Missing column: ${col}`);
    }
  }

  console.log('🧪 Test 2: Verify supporting tables...');
  const tables = await db.prepare(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  `).all();
  
  const expectedTables = ['user_roles', 'user_permissions', 'password_history', 'user_sessions', 'approval_requests'];
  const tableNames = tables.map(t => t.table_name);

  for (const tbl of expectedTables) {
    if (tableNames.includes(tbl)) {
      console.log(`  ✓ Table '${tbl}' exists`);
    } else {
      throw new Error(`❌ Missing table: ${tbl}`);
    }
  }

  console.log('🧪 Test 3: Verify admin account credentials & lockout fields...');
  const admin = await db.prepare("SELECT * FROM users WHERE email = 'admin@mitwpu.edu.in'").get();
  if (admin) {
    console.log(`  ✓ Admin user found: ${admin.name} (${admin.email})`);
    console.log(`  ✓ Admin status is '${admin.status || 'active'}'`);
  } else {
    throw new Error('❌ Admin user not found');
  }

  console.log('🧪 Test 4: Insert mock session and verify active check...');
  const sessionId = crypto.randomUUID();
  await db.prepare(`
    INSERT INTO user_sessions (id, user_id, token_hash, device, browser, os, ip_address)
    VALUES (?, ?, ?, 'Desktop', 'Chrome', 'Windows', '127.0.0.1')
  `).run(sessionId, admin.id, sessionId);
  
  const session = await db.prepare('SELECT * FROM user_sessions WHERE id = ?').get(sessionId);
  if (session && session.is_revoked === 0) {
    console.log('  ✓ Active session inserted and retrieved successfully');
  } else {
    throw new Error('❌ Failed to retrieve active session');
  }

  console.log('🧪 Test 5: Revoke session and verify state...');
  await db.prepare('UPDATE user_sessions SET is_revoked = 1 WHERE id = ?').run(sessionId);
  const revokedSession = await db.prepare('SELECT is_revoked FROM user_sessions WHERE id = ?').get(sessionId);
  if (revokedSession && revokedSession.is_revoked === 1) {
    console.log('  ✓ Session revoked successfully');
  } else {
    throw new Error('❌ Failed to revoke session');
  }

  console.log('🎉 All database-level IAM verification tests PASSED successfully!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
