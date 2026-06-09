import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { broadcastUpdate } from '../services/socket.js';
import crypto from 'crypto';

const router = Router();
router.use(authenticate);

async function verifyAttendanceAccess(req, res, next) {
  try {
    if (req.user.role === 'coordinator') return next();
    const db = getDb();
    const isAssigned = await db.prepare(`
      SELECT 1 FROM supervisor_duties sd
      JOIN room_allocations ra ON ra.id = sd.room_allocation_id
      WHERE sd.faculty_id = ? AND ra.slot_id = ?
      LIMIT 1
    `).get(req.user.id, req.params.slotId);

    if (!isAssigned) {
      return res.status(403).json({ error: 'Access denied: You are not assigned to this exam slot.' });
    }
    next();
  } catch (err) {
    next(err);
  }
}

// GET /api/attendance-logs/:slotId - Retrieve logs
router.get('/:slotId', verifyAttendanceAccess, asyncHandler(async (req, res) => {
  const db = getDb();
  const { room_allocation_id } = req.query;

  let query = `
    SELECT il.*, u.name as logged_by_name, s.name as student_name, s.prn as student_prn, s.roll_no as student_roll
    FROM invigilator_logs il
    LEFT JOIN users u ON u.id = il.logged_by
    LEFT JOIN students s ON s.id = il.student_id
    WHERE il.slot_id = ?
  `;
  const params = [req.params.slotId];

  if (room_allocation_id) {
    query += ' AND il.room_allocation_id = ?';
    params.push(room_allocation_id);
  }
  query += ' ORDER BY il.created_at DESC';

  const records = await db.prepare(query).all(...params);
  res.json(records);
}));

// POST /api/attendance-logs/:slotId - Add a new log entry
router.post('/:slotId', verifyAttendanceAccess, asyncHandler(async (req, res) => {
  const db = getDb();
  const { room_allocation_id, type, student_id, details } = req.body;

  if (!room_allocation_id || !type || !details) {
    return res.status(400).json({ error: 'room_allocation_id, type, and details are required' });
  }

  // H18: Verify the room_allocation_id actually belongs to this slot — prevent cross-slot log injection
  const validRoom = await db.prepare(
    'SELECT 1 FROM room_allocations WHERE id = ? AND slot_id = ?'
  ).get(room_allocation_id, req.params.slotId);
  if (!validRoom) {
    return res.status(400).json({ error: 'room_allocation_id does not belong to this slot.' });
  }

  // H20: Cap details length to prevent DoS via oversized log entries
  if (details.length > 1000) {
    return res.status(400).json({ error: 'details must be 1000 characters or fewer.' });
  }

  const id = crypto.randomUUID();
  await db.prepare(`
    INSERT INTO invigilator_logs (id, slot_id, room_allocation_id, logged_by, type, student_id, details)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.params.slotId, room_allocation_id, req.user.id, type, student_id || null, details);

  const newLog = await db.prepare(`
    SELECT il.*, u.name as logged_by_name, s.name as student_name, s.prn as student_prn, s.roll_no as student_roll
    FROM invigilator_logs il
    LEFT JOIN users u ON u.id = il.logged_by
    LEFT JOIN students s ON s.id = il.student_id
    WHERE il.id = ?
  `).get(id);

  // Notify other connections (e.g. coordinators) in real-time
  broadcastUpdate('INVIGILATOR_LOG_ADDED', newLog);

  res.status(201).json(newLog);
}));

export default router;
