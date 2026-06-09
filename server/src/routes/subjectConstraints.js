import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate, requireCoordinator } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { auditLog } from '../middleware/auditLog.js';
import crypto from 'crypto';

const router = Router();
router.use(authenticate, requireCoordinator);

// GET /api/subject-constraints - List constraints
router.get('/', asyncHandler(async (req, res) => {
  const db = getDb();
  const constraints = await db.prepare(`
    SELECT sc.*, s.name as subject_name, s.code as subject_code, s.branch, s.year, s.semester
    FROM subject_constraints sc
    JOIN subjects s ON s.id = sc.subject_id
    ORDER BY s.code ASC, sc.date ASC
  `).all();
  res.json(constraints);
}));

// POST /api/subject-constraints - Add a constraint
router.post('/', auditLog('ADD_SUBJECT_CONSTRAINT', 'subject_constraints', (req, data) => data?.id, (req) => `Added constraint for subject ID: ${req.body.subject_id} (${req.body.type} on ${req.body.date})`), asyncHandler(async (req, res) => {
  const db = getDb();
  const { subject_id, type, date, shift_id } = req.body;

  if (!subject_id || !type || !date) {
    return res.status(400).json({ error: 'subject_id, type, and date are required' });
  }

  // Check unique constraint
  const existing = await db.prepare(`
    SELECT 1 FROM subject_constraints
    WHERE subject_id = ? AND type = ? AND date = ? AND (shift_id = ? OR (shift_id IS NULL AND ? IS NULL))
  `).get(subject_id, type, date, shift_id || null, shift_id || null);

  if (existing) {
    return res.status(400).json({ error: 'Subject constraint already exists for this date/shift' });
  }

  const id = crypto.randomUUID();
  await db.prepare(`
    INSERT INTO subject_constraints (id, subject_id, type, date, shift_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, subject_id, type, date, shift_id || null);

  const newConstraint = await db.prepare(`
    SELECT sc.*, s.name as subject_name, s.code as subject_code
    FROM subject_constraints sc
    JOIN subjects s ON s.id = sc.subject_id
    WHERE sc.id = ?
  `).get(id);

  res.status(201).json(newConstraint);
}));

// DELETE /api/subject-constraints/:id - Delete a constraint
router.delete('/:id', auditLog('DELETE_SUBJECT_CONSTRAINT', 'subject_constraints', (req) => req.params.id, (req) => `Deleted constraint ID: ${req.params.id}`), asyncHandler(async (req, res) => {
  const db = getDb();
  await db.prepare('DELETE FROM subject_constraints WHERE id=?').run(req.params.id);
  res.json({ success: true });
}));

export default router;
