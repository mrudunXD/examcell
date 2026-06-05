import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate, requireCoordinator } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();
router.use(authenticate);

// GET conflicts for a cycle
router.get('/:cycleId', asyncHandler(async (req, res) => {
  const db = getDb();
  const conflicts = db.prepare(`
    SELECT c.*,
      es.date, es.start_time,
      s.name as subject_name
    FROM conflicts c
    LEFT JOIN exam_slots es ON es.id = c.slot_id
    LEFT JOIN subjects s ON s.id = es.subject_id
    WHERE c.cycle_id = ?
    ORDER BY c.status, c.created_at DESC
  `).all(req.params.cycleId);
  res.json(conflicts);
}));

// POST resolve a conflict
router.post('/:id/resolve', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  db.prepare("UPDATE conflicts SET status='resolved', resolved_at=datetime('now'), resolved_by=? WHERE id=?").run(req.user.id, req.params.id);
  res.json({ success: true });
}));

// POST ignore a conflict
router.post('/:id/ignore', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  db.prepare("UPDATE conflicts SET status='ignored', resolved_at=datetime('now'), resolved_by=? WHERE id=?").run(req.user.id, req.params.id);
  res.json({ success: true });
}));

export default router;
