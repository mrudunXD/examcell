import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate, requireCoordinator } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();
router.use(authenticate, requireCoordinator);

// GET /api/audit — recent audit log entries
router.get('/', asyncHandler(async (req, res) => {
  const db = getDb();
  const limit = parseInt(req.query.limit) || 50;
  const logs = await db.prepare(`
    SELECT al.*, u.name as user_name
    FROM audit_log al
    LEFT JOIN users u ON u.id = al.user_id
    ORDER BY al.created_at DESC
    LIMIT ?
  `).all(limit);
  res.json(logs);
}));

export default router;
