import jwt from 'jsonwebtoken';
import { getDb } from '../db/database.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('FATAL: JWT_SECRET environment variable is not set.');

export async function authenticate(req, res, next) {
  let token;
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    token = header.slice(7);
  }

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const db = getDb();
    const user = await db.prepare('SELECT id, name, email, role, department FROM users WHERE id = ? AND is_active = 1').get(payload.userId);
    if (!user) return res.status(401).json({ error: 'User not found or deactivated' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireCoordinator(req, res, next) {
  if (req.user?.role !== 'coordinator') {
    return res.status(403).json({ error: 'Coordinator access required' });
  }
  next();
}

export function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '8h' });
}
