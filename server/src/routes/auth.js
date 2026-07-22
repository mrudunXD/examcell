import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { authenticate, generateToken, parseUserAgent } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { UserRepository } from '../modules/auth/userRepository.js';
import { getDb } from '../db/database.js';
import crypto from 'crypto';

const router = Router();

// H3: Strict brute-force protection on login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' }
});

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Authenticate user and return JWT
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *                     department:
 *                       type: string
 *       400:
 *         description: Missing fields
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = await UserRepository.findByEmail(email.toLowerCase().trim());
  if (!user || user.is_active !== 1) return res.status(401).json({ error: 'Invalid credentials' });

  // Check lockout status
  if (user.lockout_until && new Date(user.lockout_until) > new Date()) {
    const minutesLeft = Math.ceil((new Date(user.lockout_until) - new Date()) / (60 * 1000));
    return res.status(403).json({ error: `Account temporarily locked. Please try again in ${minutesLeft} minute(s).` });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    const attempts = (user.failed_login_attempts || 0) + 1;
    if (attempts >= 5) {
      const lockoutUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins
      await UserRepository.updateLockout(user.id, attempts, lockoutUntil);
      return res.status(401).json({ error: 'Invalid credentials. Account locked for 15 minutes.' });
    } else {
      await UserRepository.updateLockout(user.id, attempts, null);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
  }

  // Clear failed login attempts and lockout on success
  await UserRepository.resetLockout(user.id);

  const db = getDb();

  // MFA Check
  if (user.mfa_enabled === 1) {
    const { totpToken } = req.body;
    if (!totpToken) {
      return res.json({ mfaRequired: true, userId: user.id });
    }
    
    const { verifyTOTP } = await import('../utils/totp.js');
    const isValid = verifyTOTP(totpToken, user.mfa_secret);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid MFA verification code' });
    }
  } else {
    // Check if MFA is globally required for coordinators
    const mfaRequiredSetting = await db.prepare("SELECT value FROM system_settings WHERE key = 'security.mfaRequired'").get();
    const isMfaRequired = mfaRequiredSetting?.value === 'true';
    if (isMfaRequired && (user.role === 'coordinator')) {
      const { totpToken } = req.body;
      if (!totpToken) {
        const { generateSecret, getOTPAuthURL } = await import('../utils/totp.js');
        const secret = user.mfa_secret || generateSecret();
        await db.prepare('UPDATE users SET mfa_secret = ? WHERE id = ?').run(secret, user.id);
        const otpauthUrl = getOTPAuthURL(user.email, secret);
        return res.json({ mfaEnrollmentRequired: true, userId: user.id, secret, otpauthUrl });
      }
      
      const { verifyTOTP } = await import('../utils/totp.js');
      const isValid = verifyTOTP(totpToken, user.mfa_secret);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid MFA verification code' });
      }
      
      // Auto-enable MFA since they verified the code!
      await db.prepare('UPDATE users SET mfa_enabled = 1 WHERE id = ?').run(user.id);
    }
  }

  // Create session tracking record
  const sessionId = crypto.randomUUID();
  const ua = parseUserAgent(req.headers['user-agent']);
  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '::1';

  await db.prepare(`
    INSERT INTO user_sessions (id, user_id, token_hash, device, browser, os, ip_address)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(sessionId, user.id, sessionId, ua.device, ua.browser, ua.os, ip);

  // Update last_login in users
  await db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

  // Query previous session of the user to check for suspicious logins
  const lastSession = await db.prepare(`
    SELECT ip_address, device, browser, os 
    FROM user_sessions 
    WHERE user_id = ? AND id != ? AND is_revoked = 0 
    ORDER BY login_time DESC 
    LIMIT 1
  `).get(user.id, sessionId);

  if (lastSession) {
    const ipChanged = lastSession.ip_address !== ip;
    const uaChanged = lastSession.device !== ua.device || lastSession.browser !== ua.browser || lastSession.os !== ua.os;
    if (ipChanged || uaChanged) {
      const { createAlert } = await import('../services/alerting.js');
      const details = [];
      if (ipChanged) details.push(`IP changed from ${lastSession.ip_address} to ${ip}`);
      if (uaChanged) details.push(`browser/OS changed from ${lastSession.browser}/${lastSession.os} to ${ua.browser}/${ua.os}`);
      await createAlert(
        'suspicious_login',
        'warning',
        `Suspicious login detected for user ${user.name} (${user.email}): ${details.join(', ')}`
      );
    }
  }

  const token = generateToken(user.id, user.updated_at, sessionId);
  
  // Set HttpOnly, Secure (in production), SameSite cookie
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 8 * 60 * 60 * 1000 // 8 hours
  });

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department, profile_picture: user.profile_picture },
    mustChangePassword: user.must_change_password === 1
  });
}));

// POST /auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Logged out successfully' });
});

// POST /auth/change-password
router.post('/change-password', authenticate, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password required' });
  }

  // Enforce password complexity
  if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long and contain uppercase, lowercase, numeric, and special characters.' });
  }
  const user = await UserRepository.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const valid = bcrypt.compareSync(currentPassword, user.password_hash);
  if (!valid) return res.status(400).json({ error: 'Invalid current password' });

  // Check password history (prevent reuse of last 5 passwords)
  const db = getDb();
  const history = await db.prepare(
    'SELECT password_hash FROM password_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 5'
  ).all(req.user.id);
  
  for (const record of history) {
    if (bcrypt.compareSync(newPassword, record.password_hash)) {
      return res.status(400).json({ error: 'You cannot reuse any of your last 5 passwords.' });
    }
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  await UserRepository.updatePassword(req.user.id, hash);
  res.clearCookie('token');
  res.json({ success: true, message: 'Password updated. Please log in again.' });
}));

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Get current authenticated user details
 *     tags:
 *       - Authentication
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Return user object
 *       401:
 *         description: Unauthorized
 */
router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// PUT /auth/profile — update own profile info
router.put('/profile', authenticate, asyncHandler(async (req, res) => {
  const { name, email, department } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email required' });
  }
  await UserRepository.updateProfile(req.user.id, { name: name.trim(), email: email.toLowerCase().trim(), department });
  const user = await UserRepository.findActiveById(req.user.id);
  const token = generateToken(user.id, user.updated_at);
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 8 * 60 * 60 * 1000
  });
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department, profile_picture: user.profile_picture }
  });
}));

export default router;
