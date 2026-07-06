import jwt from 'jsonwebtoken';
import { getDb } from '../db/database.js';
import { ROLE_PERMISSIONS, mapLegacyRole } from '../config/permissions.js';

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

export function parseUserAgent(userAgent) {
  let browser = 'Unknown Browser';
  let os = 'Unknown OS';
  let device = 'Desktop';

  if (!userAgent) return { browser, os, device };

  if (userAgent.includes('Firefox/')) {
    browser = 'Firefox';
  } else if (userAgent.includes('Chrome/') && !userAgent.includes('Chromium/') && !userAgent.includes('Edg/')) {
    browser = 'Chrome';
  } else if (userAgent.includes('Safari/') && !userAgent.includes('Chrome/') && !userAgent.includes('Chromium/')) {
    browser = 'Safari';
  } else if (userAgent.includes('Edg/')) {
    browser = 'Edge';
  } else if (userAgent.includes('MSIE') || userAgent.includes('Trident/')) {
    browser = 'Internet Explorer';
  }

  if (userAgent.includes('Windows NT')) {
    os = 'Windows';
  } else if (userAgent.includes('Macintosh') || userAgent.includes('Mac OS X')) {
    os = 'macOS';
  } else if (userAgent.includes('Linux') && !userAgent.includes('Android')) {
    os = 'Linux';
  } else if (userAgent.includes('Android')) {
    os = 'Android';
    device = 'Mobile';
  } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    os = 'iOS';
    device = 'Mobile';
  }

  return { browser, os, device };
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

    // 1. Verify token session exists and is not revoked
    const session = await db.prepare(
      'SELECT * FROM user_sessions WHERE id = ? AND is_revoked = 0'
    ).get(payload.sessionId || payload.jti || '');

    // Allow backward compatibility for old tokens generated before user_sessions table
    if (!session && (payload.sessionId || payload.jti)) {
      return res.status(401).json({ error: 'Session expired or revoked' });
    }

    // 2. Load user details
    const user = await db.prepare(
      'SELECT id, name, email, role, department, employee_id, username, phone, profile_picture, designation, status, updated_at, must_change_password, last_password_change FROM users WHERE id = ?'
    ).get(payload.userId);

    if (!user) return res.status(401).json({ error: 'User not found' });
    
    // Check password age policy expiry
    let passwordExpired = false;
    if (user.last_password_change) {
      const maxAgeSetting = await db.prepare("SELECT value FROM system_settings WHERE key = 'security.passwordPolicyMaxAgeDays'").get();
      const maxAgeDays = maxAgeSetting ? parseInt(maxAgeSetting.value, 10) : 90;
      const lastChange = new Date(user.last_password_change).getTime();
      const ageInDays = (Date.now() - lastChange) / (1000 * 60 * 60 * 24);
      if (ageInDays > maxAgeDays) {
        passwordExpired = true;
      }
    }
    
    // Check account status (Active, Suspended, Locked, Disabled)
    const status = user.status || 'active';
    if (status !== 'active') {
      return res.status(403).json({ error: `Account is ${status}. Access denied.` });
    }

    // Block if password expired
    const isBypassPath = req.path.endsWith('/change-password') || req.path.endsWith('/logout') || req.path.includes('/auth/reset-password');
    if (passwordExpired && !isBypassPath) {
      return res.status(403).json({ 
        error: 'Password expired. You must change your password to continue.', 
        passwordExpired: true 
      });
    }

    // Update session last activity
    if (session) {
      await db.prepare('UPDATE user_sessions SET last_activity = CURRENT_TIMESTAMP WHERE id = ?').run(session.id);
    }

    // 3. Load user roles and permissions
    const rolesDb = await db.prepare('SELECT role FROM user_roles WHERE user_id = ?').all(user.id);
    let roles = rolesDb.map(r => r.role);
    if (roles.length === 0) {
      // Fallback to legacy single role column
      roles = mapLegacyRole(user.role);
    }

    const permissionsDb = await db.prepare('SELECT permission FROM user_permissions WHERE user_id = ?').all(user.id);
    let permissions = permissionsDb.map(p => p.permission);

    // Merge role permissions
    for (const r of roles) {
      const rp = ROLE_PERMISSIONS[r] || [];
      for (const p of rp) {
        if (!permissions.includes(p)) {
          permissions.push(p);
        }
      }
    }

    // Verify token was generated after the last password/profile update
    if (payload.uAt) {
      const tokenTime = payload.uAt;
      const dbTime = new Date(user.updated_at).getTime();
      if (tokenTime < dbTime - 2000) {
        return res.status(401).json({ error: 'Session expired due to password change. Please log in again.' });
      }
    }

    // Attach to request
    req.user = {
      ...user,
      roles,
      permissions
    };
    req.sessionId = session?.id || null;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireCoordinator(req, res, next) {
  if (req.user?.role !== 'coordinator' && !req.user?.roles?.includes('Exam Coordinator') && !req.user?.roles?.includes('Super Admin')) {
    return res.status(403).json({ error: 'Coordinator access required' });
  }
  next();
}

export function generateToken(userId, updatedAt, sessionId) {
  const uAt = updatedAt ? new Date(updatedAt).getTime() : Date.now();
  return jwt.sign({ userId, uAt, sessionId }, JWT_SECRET, { expiresIn: '8h', algorithm: 'HS256' });
}

