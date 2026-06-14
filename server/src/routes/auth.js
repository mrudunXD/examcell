import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { getDb } from '../db/database.js';
import { authenticate, generateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

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

  const db = getDb();
  const user = await db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email.toLowerCase().trim());
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

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
      await db.prepare('UPDATE users SET failed_login_attempts = ?, lockout_until = ? WHERE id = ?').run(attempts, lockoutUntil, user.id);
      return res.status(401).json({ error: 'Invalid credentials. Account locked for 15 minutes.' });
    } else {
      await db.prepare('UPDATE users SET failed_login_attempts = ? WHERE id = ?').run(attempts, user.id);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
  }

  // Clear failed login attempts and lockout on success
  await db.prepare('UPDATE users SET failed_login_attempts = 0, lockout_until = NULL WHERE id = ?').run(user.id);

  const token = generateToken(user.id, user.updated_at);
  
  // Set HttpOnly, Secure (in production), SameSite cookie
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 8 * 60 * 60 * 1000 // 8 hours
  });

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department },
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
  if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long, contain an uppercase letter, lowercase letter, and a number.' });
  }

  const db = getDb();
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const valid = bcrypt.compareSync(currentPassword, user.password_hash);
  if (!valid) return res.status(400).json({ error: 'Invalid current password' });

  const hash = bcrypt.hashSync(newPassword, 10);
  const now = new Date().toISOString();
  await db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = ?, failed_login_attempts = 0, lockout_until = NULL WHERE id = ?')
    .run(hash, now, req.user.id);

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

export default router;
