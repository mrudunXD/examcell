import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate, requireCoordinator } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();
router.use(authenticate, requireCoordinator);

// GET /api/audit — recent audit log entries
router.get('/', asyncHandler(async (req, res) => {
  const db = getDb();
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const logs = await db.prepare(`
    SELECT al.*, u.name as user_name
    FROM audit_log al
    LEFT JOIN users u ON u.id = al.user_id
    ORDER BY al.created_at DESC
    LIMIT ?
  `).all(limit);
  res.json(logs);
}));

// POST /api/audit/verify — Verify cryptographic integrity of audit logs chain
router.post('/verify', asyncHandler(async (req, res) => {
  const db = getDb();
  const { default: crypto } = await import('crypto');
  
  // Fetch all logs in chronological order
  const logs = await db.prepare('SELECT * FROM audit_log ORDER BY created_at ASC, id ASC').all();

  let prevHash = 'GENESIS_HASH';
  let verifiedCount = 0;

  for (const log of logs) {
    // Skip legacy unhashed records
    if (log.hash === null && log.prev_hash === null) {
      continue;
    }

    const expectedPrev = log.prev_hash === 'GENESIS_HASH' ? 'GENESIS_HASH' : prevHash;

    // 1. Verify prev_hash link
    if (log.prev_hash !== expectedPrev) {
      return res.json({
        success: false,
        error: 'Chain broken: prev_hash link mismatch',
        failedLog: log,
        expectedPrevHash: expectedPrev,
        actualPrevHash: log.prev_hash
      });
    }

    // 2. Verify block hash calculation
    const formattedTime = new Date(log.created_at).toISOString();
    const input = `${expectedPrev}-${log.user_id}-${log.action}-${log.entity}-${log.entity_id || ''}-${log.details || ''}-${formattedTime}`;
    const calculatedHash = crypto.createHash('sha256').update(input).digest('hex');

    if (log.hash !== calculatedHash) {
      return res.json({
        success: false,
        error: 'Data tampered: block hash mismatch',
        failedLog: log,
        expectedHash: calculatedHash,
        actualHash: log.hash
      });
    }

    prevHash = log.hash;
    verifiedCount++;
  }

  res.json({ success: true, verifiedCount });
}));

export default router;
