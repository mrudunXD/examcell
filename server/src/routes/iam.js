import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getDb } from '../db/database.js';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permission.js';
import { PERMISSIONS } from '../config/permissions.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { auditLog } from '../middleware/auditLog.js';
import { parseUserAgent } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

// ── USER PROFILE ENDPOINTS ───────────────────────────────────────────────────

// GET own profile info
router.get('/profile', asyncHandler(async (req, res) => {
  const db = getDb();
  
  // Fetch active sessions
  const sessions = await db.prepare(
    'SELECT id, device, browser, os, ip_address, login_time, last_activity FROM user_sessions WHERE user_id = ? AND is_revoked = 0 ORDER BY last_activity DESC'
  ).all(req.user.id);

  // Fetch recent audit logs for this user
  const auditLogs = await db.prepare(
    'SELECT action, entity, details, created_at FROM audit_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
  ).all(req.user.id);

  // Fetch role and permission details
  res.json({
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      roles: req.user.roles,
      permissions: req.user.permissions,
      department: req.user.department,
      employee_id: req.user.employee_id,
      username: req.user.username,
      phone: req.user.phone,
      profile_picture: req.user.profile_picture,
      designation: req.user.designation,
      status: req.user.status || 'active',
      must_change_password: req.user.must_change_password === 1
    },
    sessions: sessions.map(s => ({
      ...s,
      isCurrent: s.id === req.sessionId
    })),
    auditLogs
  });
}));

// PUT update profile info (personal details only)
router.put('/profile', auditLog('UPDATE_PROFILE', 'users', (req) => req.user.id, 'Updated personal profile details'), asyncHandler(async (req, res) => {
  const { name, phone, department, designation } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const db = getDb();
  await db.prepare(
    'UPDATE users SET name = ?, phone = ?, department = ?, designation = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(name.trim(), phone || null, department || null, designation || null, req.user.id);

  res.json({ success: true, message: 'Profile updated successfully' });
}));

// POST upload profile picture
router.post('/profile-picture', auditLog('UPLOAD_PROFILE_PICTURE', 'users', (req) => req.user.id, 'Updated profile picture'), asyncHandler(async (req, res) => {
  const { image } = req.body; // base64 string expected
  if (!image) return res.status(400).json({ error: 'Image data is required' });

  if (!image.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Invalid image format. Base64 Data URL expected.' });
  }

  const db = getDb();
  await db.prepare('UPDATE users SET profile_picture = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(image, req.user.id);
  res.json({ success: true, profile_picture: image });
}));

// POST change password with history checking and complexity policy
router.post('/change-password', asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password required' });
  }

  // 1. Password Complexity
  if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long and contain uppercase, lowercase, numeric, and special characters.' });
  }

  const db = getDb();
  const user = await db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // 2. Validate current password
  const valid = bcrypt.compareSync(currentPassword, user.password_hash);
  if (!valid) return res.status(400).json({ error: 'Invalid current password' });

  // 3. Prevent immediate reuse of the current password
  if (bcrypt.compareSync(newPassword, user.password_hash)) {
    return res.status(400).json({ error: 'New password cannot be the same as your current password' });
  }

  // 4. Enforce Password History (check last 5 passwords)
  const history = await db.prepare('SELECT password_hash FROM password_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 5').all(req.user.id);
  for (const entry of history) {
    if (bcrypt.compareSync(newPassword, entry.password_hash)) {
      return res.status(400).json({ error: 'Cannot reuse any of your last 5 passwords.' });
    }
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  
  // 5. Update user password
  await db.transaction(async () => {
    await db.prepare(
      'UPDATE users SET password_hash = ?, must_change_password = 0, last_password_change = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(hash, req.user.id);

    // Save in history
    await db.prepare(
      'INSERT INTO password_history (id, user_id, password_hash) VALUES (?, ?, ?)'
    ).run(crypto.randomUUID(), req.user.id, hash);

    // Clean history older than 5 entries
    await db.prepare(`
      DELETE FROM password_history WHERE id IN (
        SELECT id FROM password_history WHERE user_id = ? ORDER BY created_at DESC OFFSET 5
      )
    `).run(req.user.id);

    // Revoke all other sessions for this user
    await db.prepare(
      'UPDATE user_sessions SET is_revoked = 1 WHERE user_id = ? AND id != ?'
    ).run(req.user.id, req.sessionId || '');
  })();

  res.json({ success: true, message: 'Password changed successfully. Other active sessions have been signed out.' });
}));

// GET active sessions
router.get('/sessions', asyncHandler(async (req, res) => {
  const db = getDb();
  const sessions = await db.prepare(
    'SELECT id, device, browser, os, ip_address, login_time, last_activity FROM user_sessions WHERE user_id = ? AND is_revoked = 0 ORDER BY last_activity DESC'
  ).all(req.user.id);

  res.json(sessions.map(s => ({
    ...s,
    isCurrent: s.id === req.sessionId
  })));
}));

// DELETE revoke a session
router.delete('/sessions/:id', auditLog('REVOKE_SESSION', 'user_sessions', (req) => req.params.id, 'Revoked active session'), asyncHandler(async (req, res) => {
  const db = getDb();
  const session = await db.prepare('SELECT user_id FROM user_sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  // Access check: users can revoke own sessions, admins can revoke any
  if (session.user_id !== req.user.id && !req.user.permissions.includes(PERMISSIONS.MANAGE_USERS)) {
    return res.status(403).json({ error: 'Forbidden: Cannot revoke other users sessions' });
  }

  await db.prepare('UPDATE user_sessions SET is_revoked = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true, message: 'Session revoked successfully' });
}));

// DELETE revoke all other sessions
router.delete('/sessions', auditLog('REVOKE_ALL_OTHER_SESSIONS', 'user_sessions', null, 'Revoked all other active sessions'), asyncHandler(async (req, res) => {
  const db = getDb();
  await db.prepare(
    'UPDATE user_sessions SET is_revoked = 1 WHERE user_id = ? AND id != ?'
  ).run(req.user.id, req.sessionId || '');

  res.json({ success: true, message: 'All other sessions revoked successfully' });
}));

// POST /mfa/setup - Generate secret and return otpauth url
router.post('/mfa/setup', asyncHandler(async (req, res) => {
  const { generateSecret, getOTPAuthURL } = await import('../utils/totp.js');
  const secret = generateSecret();
  const otpauthUrl = getOTPAuthURL(req.user.email, secret);
  res.json({ secret, otpauthUrl });
}));

// POST /mfa/enable - Enable MFA for user
router.post('/mfa/enable', auditLog('ENABLE_MFA', 'users', (req) => req.user.id, 'Enabled Multi-Factor Authentication (MFA)'), asyncHandler(async (req, res) => {
  const { token, secret } = req.body;
  if (!token || !secret) {
    return res.status(400).json({ error: 'Verification token and secret are required' });
  }

  const { verifyTOTP } = await import('../utils/totp.js');
  const isValid = verifyTOTP(token, secret);
  if (!isValid) {
    return res.status(400).json({ error: 'Invalid verification code. Please check your authenticator app.' });
  }

  const db = getDb();
  await db.prepare('UPDATE users SET mfa_secret = ?, mfa_enabled = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(secret, req.user.id);
  res.json({ success: true, message: 'Multi-Factor Authentication enabled successfully.' });
}));

// POST /mfa/disable - Disable MFA for user
router.post('/mfa/disable', auditLog('DISABLE_MFA', 'users', (req) => req.user.id, 'Disabled Multi-Factor Authentication (MFA)'), asyncHandler(async (req, res) => {
  const { token } = req.body;
  
  const db = getDb();
  const user = await db.prepare('SELECT mfa_secret, mfa_enabled FROM users WHERE id = ?').get(req.user.id);
  
  if (!user || user.mfa_enabled !== 1) {
    return res.status(400).json({ error: 'MFA is not enabled.' });
  }

  if (!token) {
    return res.status(400).json({ error: 'Verification token is required to disable MFA.' });
  }

  const { verifyTOTP } = await import('../utils/totp.js');
  const isValid = verifyTOTP(token, user.mfa_secret);
  if (!isValid) {
    return res.status(400).json({ error: 'Invalid verification code. Could not disable MFA.' });
  }

  await db.prepare('UPDATE users SET mfa_secret = NULL, mfa_enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.user.id);
  res.json({ success: true, message: 'Multi-Factor Authentication disabled successfully.' });
}));

// ── ADMINISTRATOR IAM ENDPOINTS ──────────────────────────────────────────────

// GET admin dashboard stats
router.get('/admin/dashboard', requirePermission(PERMISSIONS.MANAGE_USERS), asyncHandler(async (req, res) => {
  const db = getDb();

  const totalUsers = await db.prepare('SELECT COUNT(*) as cnt FROM users').get();
  const activeUsers = await db.prepare("SELECT COUNT(*) as cnt FROM users WHERE status = 'active'").get();
  const lockedUsers = await db.prepare("SELECT COUNT(*) as cnt FROM users WHERE status = 'locked'").get();
  const failedLogins = await db.prepare('SELECT SUM(failed_login_attempts) as cnt FROM users').get();
  
  // Count active sessions in the last 15 minutes as online users
  const onlineUsers = await db.prepare(`
    SELECT COUNT(DISTINCT user_id) as cnt FROM user_sessions 
    WHERE is_revoked = 0 AND last_activity >= NOW() - INTERVAL '15 minutes'
  `).get();

  // Fetch recent logins
  const recentLogins = await db.prepare(`
    SELECT al.created_at, u.name, u.email, al.details 
    FROM audit_log al
    JOIN users u ON u.id = al.user_id
    WHERE al.action = 'LOGIN'
    ORDER BY al.created_at DESC LIMIT 10
  `).all();

  // Recent security warnings (failed login limits / locks)
  const securityAlerts = await db.prepare(`
    SELECT * FROM system_alerts WHERE type IN ('auth_failure', 'brute_force', 'lockout') 
    ORDER BY created_at DESC LIMIT 10
  `).all();

  res.json({
    stats: {
      totalUsers: totalUsers?.cnt || 0,
      activeUsers: activeUsers?.cnt || 0,
      lockedUsers: lockedUsers?.cnt || 0,
      failedLogins: failedLogins?.cnt || 0,
      onlineUsers: onlineUsers?.cnt || 0
    },
    recentLogins,
    securityAlerts
  });
}));

// GET list of all system users
router.get('/admin/users', requirePermission(PERMISSIONS.MANAGE_USERS), asyncHandler(async (req, res) => {
  const db = getDb();
  
  const users = await db.prepare(`
    SELECT id, name, email, role, department, employee_id, username, phone, designation, status, created_at, last_login, must_change_password 
    FROM users 
    ORDER BY created_at DESC
  `).all();

  // Load roles for each user
  const rolesStmt = db.prepare('SELECT role FROM user_roles WHERE user_id = ?');
  for (const u of users) {
    const rolesDb = rolesStmt.all(u.id);
    u.roles = rolesDb.map(r => r.role);
    if (u.roles.length === 0) {
      u.roles = mapLegacyRole(u.role);
    }
  }

  res.json(users);
}));

// POST create/invite a new user
router.post('/admin/users', requirePermission(PERMISSIONS.MANAGE_USERS), auditLog('ADMIN_CREATE_USER', 'users', (req, data) => data?.id, (req) => `Created user ${req.body.email}`), asyncHandler(async (req, res) => {
  const { name, email, username, employeeId, phone, designation, department, roles, password } = req.body;
  if (!name || !email || !username || !password) {
    return res.status(400).json({ error: 'Name, email, username, and password are required' });
  }

  const db = getDb();

  // Check email and username uniqueness
  const existingEmail = await db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (existingEmail) return res.status(400).json({ error: 'Email already exists' });

  const existingUsername = await db.prepare('SELECT id FROM users WHERE username = ?').get(username.toLowerCase().trim());
  if (existingUsername) return res.status(400).json({ error: 'Username already exists' });

  const id = crypto.randomUUID();
  const hash = bcrypt.hashSync(password, 10);

  await db.transaction(async () => {
    // Insert user
    await db.prepare(`
      INSERT INTO users (id, name, email, username, employee_id, phone, designation, department, password_hash, role, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `).run(
      id, name.trim(), email.toLowerCase().trim(), username.toLowerCase().trim(),
      employeeId || null, phone || null, designation || null, department || null,
      hash, Array.isArray(roles) && roles.length > 0 ? roles[0] : 'faculty', req.user.id
    );

    // Save initial password in history
    await db.prepare(
      'INSERT INTO password_history (id, user_id, password_hash) VALUES (?, ?, ?)'
    ).run(crypto.randomUUID(), id, hash);

    // Insert user roles
    if (Array.isArray(roles)) {
      const roleInsert = db.prepare('INSERT INTO user_roles (user_id, role) VALUES (?, ?)');
      for (const r of roles) {
        roleInsert.run(id, r);
      }
    }
  });

  res.status(201).json({ id, name, email, username, roles });
}));

// POST update user account status (Suspend, Lock, Unlock, Activate, Archive)
router.post('/admin/users/:id/status', requirePermission(PERMISSIONS.MANAGE_USERS), auditLog('ADMIN_CHANGE_USER_STATUS', 'users', (req) => req.params.id, (req) => `Changed status of user ID ${req.params.id} to ${req.body.status}`), asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!status || !['active', 'suspended', 'locked', 'disabled', 'archived'].includes(status)) {
    return res.status(400).json({ error: 'Valid status required' });
  }

  const db = getDb();
  
  // Enforce soft-deletes/archives
  const is_active = status === 'archived' || status === 'disabled' ? 0 : 1;

  await db.transaction(async () => {
    await db.prepare(
      'UPDATE users SET status = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = ?'
    ).run(status, is_active, req.user.id, req.params.id);

    // If locked/suspended/archived, revoke all active sessions immediately
    if (status !== 'active') {
      await db.prepare('UPDATE user_sessions SET is_revoked = 1 WHERE user_id = ?').run(req.params.id);
    } else {
      // If unlocking, reset failed login attempts
      await db.prepare('UPDATE users SET failed_login_attempts = 0, lockout_until = NULL WHERE id = ?').run(req.params.id);
    }
  });

  res.json({ success: true, status });
}));

// PUT update user roles
router.put('/admin/users/:id/roles', requirePermission(PERMISSIONS.MANAGE_USERS), auditLog('ADMIN_ASSIGN_ROLES', 'users', (req) => req.params.id, (req) => `Assigned roles [${req.body.roles?.join(', ')}] to user ID ${req.params.id}`), asyncHandler(async (req, res) => {
  const { roles } = req.body;
  if (!Array.isArray(roles) || roles.length === 0) {
    return res.status(400).json({ error: 'Roles array required' });
  }

  const db = getDb();
  await db.transaction(async () => {
    // Delete current roles
    await db.prepare('DELETE FROM user_roles WHERE user_id = ?').run(req.params.id);
    
    // Insert new roles
    const stmt = db.prepare('INSERT INTO user_roles (user_id, role) VALUES (?, ?)');
    for (const r of roles) {
      stmt.run(req.params.id, r);
    }

    // Update main role column to match first role for backward compatibility
    await db.prepare('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = ?')
      .run(roles[0], req.user.id, req.params.id);
  });

  res.json({ success: true, roles });
}));

// DELETE soft delete user
router.delete('/admin/users/:id', requirePermission(PERMISSIONS.MANAGE_USERS), auditLog('ADMIN_DELETE_USER', 'users', (req) => req.params.id, 'Soft deleted user'), asyncHandler(async (req, res) => {
  const db = getDb();
  
  await db.transaction(async () => {
    await db.prepare(
      "UPDATE users SET status = 'archived', is_active = 0, updated_at = CURRENT_TIMESTAMP, updated_by = ? WHERE id = ?"
    ).run(req.user.id, req.params.id);

    // Revoke all sessions
    await db.prepare('UPDATE user_sessions SET is_revoked = 1 WHERE user_id = ?').run(req.params.id);
  });

  res.json({ success: true, message: 'User soft-deleted successfully' });
}));

// ── APPROVAL WORKFLOW ENDPOINTS ──────────────────────────────────────────────

// GET pending approval requests
router.get('/approvals', requirePermission(PERMISSIONS.MANAGE_USERS), asyncHandler(async (req, res) => {
  const db = getDb();
  const requests = await db.prepare(`
    SELECT ar.*, u.name as requested_by_name, u.email as requested_by_email
    FROM approval_requests ar
    JOIN users u ON u.id = ar.requested_by
    WHERE ar.status = 'pending'
    ORDER BY ar.requested_at DESC
  `).all();

  res.json(requests.map(r => ({
    ...r,
    payload: JSON.parse(r.payload)
  })));
}));

// POST approve or reject workflow request
router.post('/approvals/:id/resolve', requirePermission(PERMISSIONS.MANAGE_USERS), auditLog('RESOLVE_APPROVAL_REQUEST', 'approval_requests', (req) => req.params.id, (req) => `Resolved approval request ID ${req.params.id} as ${req.body.status}`), asyncHandler(async (req, res) => {
  const { status, notes } = req.body;
  if (!status || !['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Valid status (approved/rejected) required' });
  }

  const db = getDb();
  const request = await db.prepare('SELECT * FROM approval_requests WHERE id = ?').get(req.params.id);
  if (!request) return res.status(404).json({ error: 'Approval request not found' });
  if (request.status !== 'pending') return res.status(400).json({ error: 'Request already resolved' });

  // Dual control rule: Requested user cannot approve their own request!
  if (status === 'approved' && request.requested_by === req.user.id) {
    return res.status(403).json({ error: 'Dual-control error: You cannot approve your own request.' });
  }

  await db.transaction(async () => {
    // Update request state
    await db.prepare(
      'UPDATE approval_requests SET status = ?, resolved_by = ?, resolved_at = CURRENT_TIMESTAMP, notes = ? WHERE id = ?'
    ).run(status, req.user.id, notes || null, req.params.id);

    // If approved, execute action dynamically
    if (status === 'approved') {
      const payload = JSON.parse(request.payload);
      
      if (request.action === 'PUBLISH_SCHEDULE') {
        const cycleId = request.entity_id;
        await db.prepare("UPDATE exam_cycles SET status = 'finalised', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(cycleId);
        await db.prepare("UPDATE exam_slots SET status = 'finalised' WHERE cycle_id = ?").run(cycleId);
      } 
      
      else if (request.action === 'RESTORE_BACKUP') {
        // Trigger database restore from the backup service
        const filename = request.entity_id;
        // Since we are running in the transaction of this call, we can't block. We run it asynchronously.
        setTimeout(async () => {
          try {
            const fs = await import('fs');
            const path = await import('path');
            const { fileURLToPath } = await import('url');
            const { restoreBackup } = await import('../services/backupService.js');
            
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = path.dirname(__filename);
            const BACKUP_DIR = path.join(__dirname, '../../backups');
            const safeFilename = path.basename(filename);
            const filepath = path.join(BACKUP_DIR, safeFilename);

            if (!fs.existsSync(filepath)) {
              console.error(`Restore failed: Backup file ${filename} not found`);
              return;
            }
            
            const backupData = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
            await restoreBackup(backupData);
            console.log(`✓ Dual-approved backup restore of ${filename} complete.`);
          } catch (e) {
            console.error(`Failed to restore backup ${filename} after approval:`, e);
          }
        }, 100);
      } 
      
      else if (request.action === 'DELETE_USER') {
        const userId = request.entity_id;
        await db.prepare("UPDATE users SET status = 'archived', is_active = 0 WHERE id = ?").run(userId);
        await db.prepare("UPDATE user_sessions SET is_revoked = 1 WHERE user_id = ?").run(userId);
      }
      
      else if (request.action === 'DELETE_ACADEMIC_DATA') {
        // Soft delete all cycles, slots, etc.
        const cycleId = request.entity_id;
        await db.prepare("UPDATE exam_cycles SET status = 'archived' WHERE id = ?").run(cycleId);
      }
      
      else if (request.action === 'MODIFY_SOLVER_SETTINGS') {
        // Save the settings payload
        const settingsBody = payload.body; // e.g. settings map
        const updateStmt = db.prepare('UPDATE system_settings SET value = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?');
        for (const [k, v] of Object.entries(settingsBody)) {
          updateStmt.run(String(v), req.user.id, k);
        }
      }
    }
  });

  res.json({ success: true, status });
}));

export default router;
