import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate, requireCoordinator } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { auditLog } from '../middleware/auditLog.js';

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const db = getDb();
  res.json(await db.prepare('SELECT * FROM classrooms WHERE is_active=1 ORDER BY block, room_no').all());
}));

router.post('/', requireCoordinator, auditLog('CREATE_CLASSROOM', 'classrooms', (req, data) => data?.id, (req, data) => `Created classroom Room ${data?.room_no} (block: ${data?.block}, capacity: ${data?.capacity})`), asyncHandler(async (req, res) => {
  const db = getDb();
  const { room_no, block, capacity, bench_rows, bench_cols, is_online } = req.body;
  if (!room_no || !block || !capacity || !bench_rows || !bench_cols) return res.status(400).json({ error: 'All fields required' });
  const id = crypto.randomUUID();
  await db.prepare('INSERT INTO classrooms (id, room_no, block, capacity, bench_rows, bench_cols, is_online) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, room_no.trim(), block.trim(), parseInt(capacity), parseInt(bench_rows), parseInt(bench_cols), is_online ? 1 : 0);
  res.status(201).json(await db.prepare('SELECT * FROM classrooms WHERE id = ?').get(id));
}));

router.put('/:id', requireCoordinator, auditLog('UPDATE_CLASSROOM', 'classrooms', (req) => req.params.id, (req, data) => `Updated classroom Room ${data?.room_no}`), asyncHandler(async (req, res) => {
  const db = getDb();
  const { room_no, block, capacity, bench_rows, bench_cols, is_online } = req.body;
  await db.prepare('UPDATE classrooms SET room_no=?, block=?, capacity=?, bench_rows=?, bench_cols=?, is_online=? WHERE id=?').run(room_no, block, parseInt(capacity), parseInt(bench_rows), parseInt(bench_cols), is_online ? 1 : 0, req.params.id);
  res.json(await db.prepare('SELECT * FROM classrooms WHERE id = ?').get(req.params.id));
}));

router.delete('/:id', requireCoordinator, auditLog('DELETE_CLASSROOM', 'classrooms', (req) => req.params.id, (req) => `Soft-deleted classroom ID: ${req.params.id}`), asyncHandler(async (req, res) => {
  const db = getDb();
  await db.prepare("UPDATE classrooms SET is_active=0 WHERE id=?").run(req.params.id);
  res.json({ success: true });
}));

export default router;
