import { Router } from 'express';
import { SettingsRepository } from '../modules/settings/settingsRepository.js';
import { authenticate, requireCoordinator } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getDb } from '../db/database.js';

const router = Router();
router.use(authenticate);

// Middleware to enforce Super Admin role (admin@mitwpu.edu.in)
function requireSuperAdmin(req, res, next) {
  if (req.user?.role === 'coordinator' && req.user?.email === 'admin@mitwpu.edu.in') {
    next();
  } else {
    res.status(403).json({ error: 'Super Admin access required for this action' });
  }
}

// GET /api/settings - retrieve all settings and categories
router.get('/', asyncHandler(async (req, res) => {
  const allSettings = await SettingsRepository.findAll();
  res.json(allSettings);
}));

// GET /api/settings/audit - retrieve settings audit trail logs
router.get('/audit', requireSuperAdmin, asyncHandler(async (req, res) => {
  const history = await SettingsRepository.getHistory();
  res.json(history);
}));

// POST /api/settings - update system settings (with category-level authorization checks)
router.post('/', requireCoordinator, asyncHandler(async (req, res) => {
  const settingsMap = req.body;
  if (!settingsMap || typeof settingsMap !== 'object') {
    return res.status(400).json({ error: 'Invalid settings update payload' });
  }

  const isSuper = req.user?.email === 'admin@mitwpu.edu.in';

  // Check if any restricted settings categories are being updated by a non-super-admin
  const restrictedCategories = ['database', 'security', 'flags', 'backup'];
  
  for (const key of Object.keys(settingsMap)) {
    const setting = await SettingsRepository.findByKey(key);
    if (setting) {
      if (restrictedCategories.includes(setting.category) && !isSuper) {
        return res.status(403).json({ 
          error: `Only the Super Admin can update settings in the '${setting.category}' category.` 
        });
      }
    }
  }

  // Validate values (e.g. numeric types must be positive)
  for (const [key, value] of Object.entries(settingsMap)) {
    const strVal = String(value);
    if (key.includes('Expiry') && !/^\d+[hmd]$/.test(strVal)) {
      return res.status(400).json({ error: `Setting '${key}' must be a duration like '1h', '7d', '30m'.` });
    }
    if (key.includes('Limit') || key.includes('Threshold') || key.includes('Count') || key.includes('Threads')) {
      const num = parseInt(strVal, 10);
      if (isNaN(num) || num < 0) {
        return res.status(400).json({ error: `Setting '${key}' must be a non-negative integer.` });
      }
    }
  }

  const updated = await SettingsRepository.updateSettings(settingsMap, req.user.id);
  res.json({ success: true, updated });
}));

// POST /api/settings/reset - reset system settings to defaults
router.post('/reset', requireSuperAdmin, asyncHandler(async (req, res) => {
  const resetCount = await SettingsRepository.resetToDefaults(req.user.id);
  res.json({ success: true, reset: resetCount });
}));

// POST /api/settings/optimize - database VACUUM & REINDEX (Super Admin only)
router.post('/optimize', requireSuperAdmin, asyncHandler(async (req, res) => {
  const db = getDb();
  
  try {
    // Note: VACUUM cannot run inside a transaction blocks in some PostgreSQL versions,
    // so we execute VACUUM and REINDEX directly on client connection if possible
    await db.pool.query('VACUUM');
    await db.pool.query('REINDEX SCHEMA public');
    res.json({ success: true, message: 'Database optimized successfully (VACUUM and REINDEX completed).' });
  } catch (err) {
    res.status(500).json({ error: `Database optimization failed: ${err.message}` });
  }
}));

// POST /api/settings/playground - Developer SQL Playground terminal (Super Admin only)
router.post('/playground', requireSuperAdmin, asyncHandler(async (req, res) => {
  const { query } = req.body;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'SQL query string required.' });
  }

  // Safety sanitization: block write operations that could corrupt critical structural metadata
  const blockedKeywords = ['DROP', 'TRUNCATE', 'ALTER', 'CREATE TABLE', 'DELETE FROM users', 'UPDATE users'];
  const upperQuery = query.toUpperCase();
  for (const block of blockedKeywords) {
    if (upperQuery.includes(block)) {
      return res.status(403).json({ error: `Security Block: '${block}' commands are forbidden in SQL Playground.` });
    }
  }

  const db = getDb();
  const startTime = Date.now();
  try {
    const result = await db.pool.query(query);
    const duration = Date.now() - startTime;
    res.json({
      success: true,
      rows: result.rows || [],
      fields: result.fields ? result.fields.map(f => f.name) : [],
      duration,
      rowCount: result.rowCount || 0
    });
  } catch (err) {
    const duration = Date.now() - startTime;
    res.status(400).json({ error: err.message, duration });
  }
}));

export default router;
