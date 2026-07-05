import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate, requireCoordinator } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { auditLog } from '../middleware/auditLog.js';
import { broadcastTargetedUpdate } from '../services/socket.js';
import eventBus, { Events } from '../services/eventBus.js';

const router = Router();
router.use(authenticate);

// GET all broadcasts (with read status for current user, excluding expired)
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
    WHERE b.expires_at IS NULL OR b.expires_at > datetime('now')
    GROUP BY b.id
    ORDER BY b.created_at DESC
    LIMIT 50
  `).all(req.user.id);
  res.json(broadcasts);
}));

function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// POST send a broadcast
router.post('/', requireCoordinator, auditLog('SEND_BROADCAST', 'broadcasts', (req, data) => data?.id, (req, data) => `Sent broadcast: ${data?.title} (priority: ${data?.priority})`), asyncHandler(async (req, res) => {
  const db = getDb();
  const { title, message, priority = 'normal', classroom_id = null, expires_at = null } = req.body;
  if (!title || !message) return res.status(400).json({ error: 'title and message required' });
  // M5: Enforce length limits to prevent memory exhaustion
  if (title.length > 200) return res.status(400).json({ error: 'title must be 200 characters or fewer' });
  if (message.length > 2000) return res.status(400).json({ error: 'message must be 2000 characters or fewer' });

  const cleanTitle = escapeHtml(title.trim());
  const cleanMessage = escapeHtml(message.trim());

  const id = crypto.randomUUID();
  await db.prepare('INSERT INTO broadcasts (id, title, message, sent_by, priority, classroom_id, expires_at) VALUES (?,?,?,?,?,?,?)')
    .run(id, cleanTitle, cleanMessage, req.user.id, priority, classroom_id, expires_at || null);

  const broadcast = await db.prepare(`
    SELECT b.*, u.name as sent_by_name FROM broadcasts b
    LEFT JOIN users u ON u.id=b.sent_by WHERE b.id=?
  `).get(id);

  if (classroom_id) {
    broadcastTargetedUpdate(classroom_id, 'EMERGENCY_BROADCAST', broadcast);
  } else {
    eventBus.emit(Events.EMERGENCY_BROADCAST, broadcast);
  }

  res.status(201).json(broadcast);
}));

// GET all broadcast acknowledgments
router.get('/acknowledgments', asyncHandler(async (req, res) => {
  const db = getDb();
  const acks = await db.prepare(`
    SELECT ba.*, c.room_no FROM broadcast_acknowledgments ba
    JOIN classrooms c ON c.id = ba.classroom_id
  `).all();
  res.json(acks);
}));

// POST mark as read
router.post('/:id/read', asyncHandler(async (req, res) => {
  const db = getDb();
  await db.prepare('INSERT OR IGNORE INTO broadcast_reads (broadcast_id, user_id) VALUES (?,?)')
    .run(req.params.id, req.user.id);
  res.json({ success: true });
}));

// POST mark broadcast as acknowledged by kiosk / supervisor
router.post('/:id/acknowledge', asyncHandler(async (req, res) => {
  const db = getDb();
  const { classroom_id } = req.body;
  if (!classroom_id) {
    return res.status(400).json({ error: 'classroom_id is required' });
  }
  
  await db.prepare(`
    INSERT INTO broadcast_acknowledgments (broadcast_id, classroom_id, acknowledged_by)
    VALUES (?, ?, ?)
    ON CONFLICT (broadcast_id, classroom_id) DO NOTHING
  `).run(req.params.id, classroom_id, req.user?.id || null);

  const { getIo } = await import('../services/socket.js');
  const ioInstance = getIo();
  if (ioInstance) {
    ioInstance.emit('BROADCAST_ACKNOWLEDGED', {
      broadcastId: req.params.id,
      classroomId: classroom_id,
      acknowledgedAt: new Date().toISOString()
    });
  }

  res.json({ success: true });
}));

// GET unread count for current user
router.get('/unread-count', asyncHandler(async (req, res) => {
  const db = getDb();
  const count = (await db.prepare(`
    SELECT COUNT(*) as cnt FROM broadcasts b
    WHERE (b.expires_at IS NULL OR b.expires_at > datetime('now'))
    AND NOT EXISTS (SELECT 1 FROM broadcast_reads WHERE broadcast_id=b.id AND user_id=?)
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
