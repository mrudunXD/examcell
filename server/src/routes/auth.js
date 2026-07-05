import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { authenticate, generateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { UserRepository } from '../modules/auth/userRepository.js';

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

  const user = await UserRepository.findById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const valid = bcrypt.compareSync(currentPassword, user.password_hash);
  if (!valid) return res.status(400).json({ error: 'Invalid current password' });

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
    user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department }
  });
}));

export default router;
