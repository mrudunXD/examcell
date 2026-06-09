import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate, requireCoordinator } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { auditLog } from '../middleware/auditLog.js';
import { broadcastUpdate } from '../services/socket.js';

const router = Router();
router.use(authenticate);

// GET all broadcasts (with read status for current user)
router.get('/', asyncHandler(async (req, res) => {
  const db = getDb();
  const broadcasts = await db.prepare(`
    SELECT b.*, u.name as sent_by_name,
      COUNT(DISTINCT br.user_id) as read_count,
      (SELECT COUNT(*) FROM users WHERE is_active=1 AND role='faculty') as faculty_count,
      EXISTS(SELECT 1 FROM broadcast_reads WHERE broadcast_id=b.id AND user_id=?) as is_read
    FROM broadcasts b
    LEFT JOIN users u ON u.id = b.sent_by
    LEFT JOIN broadcast_reads br ON br.broadcast_id = b.id
    GROUP BY b.id
    ORDER BY b.created_at DESC
    LIMIT 50
  `).all(req.user.id);
  res.json(broadcasts);
}));

// POST send a broadcast
router.post('/', requireCoordinator, auditLog('SEND_BROADCAST', 'broadcasts', (req, data) => data?.id, (req, data) => `Sent broadcast: ${data?.title} (priority: ${data?.priority})`), asyncHandler(async (req, res) => {
  const db = getDb();
  const { title, message, priority = 'normal' } = req.body;
  if (!title || !message) return res.status(400).json({ error: 'title and message required' });
  // M5: Enforce length limits to prevent memory exhaustion
  if (title.length > 200) return res.status(400).json({ error: 'title must be 200 characters or fewer' });
  if (message.length > 2000) return res.status(400).json({ error: 'message must be 2000 characters or fewer' });

  const id = crypto.randomUUID();
  await db.prepare('INSERT INTO broadcasts (id, title, message, sent_by, priority) VALUES (?,?,?,?,?)')
    .run(id, title, message, req.user.id, priority);

  const broadcast = await db.prepare(`
    SELECT b.*, u.name as sent_by_name FROM broadcasts b
    LEFT JOIN users u ON u.id=b.sent_by WHERE b.id=?
  `).get(id);
  broadcastUpdate('EMERGENCY_BROADCAST', broadcast);
  res.status(201).json(broadcast);
}));

// POST mark as read
router.post('/:id/read', asyncHandler(async (req, res) => {
  const db = getDb();
  await db.prepare('INSERT OR IGNORE INTO broadcast_reads (broadcast_id, user_id) VALUES (?,?)')
    .run(req.params.id, req.user.id);
  res.json({ success: true });
}));

// GET unread count for current user
router.get('/unread-count', asyncHandler(async (req, res) => {
  const db = getDb();
  const count = (await db.prepare(`
    SELECT COUNT(*) as cnt FROM broadcasts b
    WHERE NOT EXISTS (SELECT 1 FROM broadcast_reads WHERE broadcast_id=b.id AND user_id=?)
  `).get(req.user.id))?.cnt || 0;
  res.json({ count });
}));

// DELETE a broadcast
router.delete('/:id', requireCoordinator, auditLog('DELETE_BROADCAST', 'broadcasts', (req) => req.params.id, (req) => `Deleted broadcast ID: ${req.params.id}`), asyncHandler(async (req, res) => {
  const db = getDb();
  await db.prepare('DELETE FROM broadcasts WHERE id=?').run(req.params.id);
  res.json({ success: true });
}));

export default router;
