import jwt from 'jsonwebtoken';
import { getDb } from '../db/database.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is not set.');
}
if (JWT_SECRET.includes('change') || JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET must be at least 32 characters long and not contain the word "change".');
  process.exit(1);
}

export function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    list[parts.shift().trim()] = decodeURIComponent(parts.join('='));
  });
  return list;
}

export async function authenticate(req, res, next) {
  let token;
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    token = header.slice(7);
  } else {
    const cookies = parseCookies(req.headers.cookie);
    token = cookies.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    const db = getDb();
    const user = await db.prepare('SELECT id, name, email, role, department, updated_at, must_change_password FROM users WHERE id = ? AND is_active = 1').get(payload.userId);
    if (!user) return res.status(401).json({ error: 'User not found or deactivated' });

    // Verify token was generated after the last password/profile update
    if (payload.uAt) {
      const tokenTime = payload.uAt;
      const dbTime = new Date(user.updated_at).getTime();
      // Allow 2 seconds clock drift
      if (tokenTime < dbTime - 2000) {
        return res.status(401).json({ error: 'Session expired due to password change. Please log in again.' });
      }
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireCoordinator(req, res, next) {
  if (req.user?.role !== 'coordinator') {
    return res.status(403).json({ error: 'Coordinator access required' });
  }
  next();
}

export function generateToken(userId, updatedAt) {
  const uAt = updatedAt ? new Date(updatedAt).getTime() : Date.now();
  return jwt.sign({ userId, uAt }, JWT_SECRET, { expiresIn: '8h', algorithm: 'HS256' });
}
