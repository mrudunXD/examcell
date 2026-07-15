import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate, requireCoordinator } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { auditLog } from '../middleware/auditLog.js';
import crypto from 'crypto';

const router = Router();
router.use(authenticate, requireCoordinator);

// GET /api/faculty-leaves - List all leaves
router.get('/', asyncHandler(async (req, res) => {
  const db = getDb();
  const leaves = await db.prepare(`
    SELECT fl.*, u.name as faculty_name, u.email as faculty_email, u.department as faculty_department
    FROM faculty_leaves fl
    JOIN users u ON u.id = fl.faculty_id
    ORDER BY fl.date DESC, u.name ASC
  `).all();
  res.json(leaves);
}));

// POST /api/faculty-leaves - Add a leaf
router.post('/', auditLog('ADD_FACULTY_LEAVE', 'faculty_leaves', (req, data) => data?.id, (req) => `Added leave for faculty ID: ${req.body.faculty_id} on ${req.body.date}`), asyncHandler(async (req, res) => {
  const db = getDb();
  const { faculty_id, date, shift_id, reason } = req.body;

  if (!faculty_id || !date) {
    return res.status(400).json({ error: 'faculty_id and date are required' });
  }

  // Check unique leaf constraint
  let checkQuery = `
    SELECT 1 FROM faculty_leaves
    WHERE faculty_id = ? AND date = ?
  `;
  const checkParams = [faculty_id, date];
  if (shift_id) {
    checkQuery += ' AND shift_id = ?';
    checkParams.push(shift_id);
  } else {
    checkQuery += ' AND shift_id IS NULL';
  }
  const existing = await db.prepare(checkQuery).get(...checkParams);

  if (existing) {
    return res.status(400).json({ error: 'Faculty leave already exists for this date/shift' });
  }

  const id = crypto.randomUUID();
  await db.prepare(`
    INSERT INTO faculty_leaves (id, faculty_id, date, shift_id, reason)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, faculty_id, date, shift_id || null, reason || null);

  const newLeave = await db.prepare(`
    SELECT fl.*, u.name as faculty_name, u.email as faculty_email
    FROM faculty_leaves fl
    JOIN users u ON u.id = fl.faculty_id
    WHERE fl.id = ?
  `).get(id);

  res.status(201).json(newLeave);
}));

// DELETE /api/faculty-leaves/:id - Delete a leaf
router.delete('/:id', auditLog('DELETE_FACULTY_LEAVE', 'faculty_leaves', (req) => req.params.id, (req) => `Deleted leave ID: ${req.params.id}`), asyncHandler(async (req, res) => {
  const db = getDb();
  await db.prepare('DELETE FROM faculty_leaves WHERE id=?').run(req.params.id);
  res.json({ success: true });
}));

export default router;
