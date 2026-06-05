import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate, requireCoordinator } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM subjects ORDER BY semester, code').all());
}));

router.post('/', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  const { code, name, branch, year, semester, abbreviation, course_type } = req.body;
  if (!code || !name || !branch || !year || !semester)
    return res.status(400).json({ error: 'code, name, branch, year, semester required' });
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO subjects (id, code, name, branch, year, semester, abbreviation, course_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, code.trim(), name.trim(), branch.trim(), year, parseInt(semester), abbreviation || null, course_type || null);
  res.status(201).json(db.prepare('SELECT * FROM subjects WHERE id = ?').get(id));
}));

router.put('/:id', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  const { code, name, branch, year, semester, abbreviation, course_type } = req.body;
  db.prepare(`
    UPDATE subjects SET code=?, name=?, branch=?, year=?, semester=?, abbreviation=?, course_type=?
    WHERE id=?
  `).run(code, name, branch, year, parseInt(semester), abbreviation || null, course_type || null, req.params.id);
  res.json(db.prepare('SELECT * FROM subjects WHERE id = ?').get(req.params.id));
}));

router.delete('/:id', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM subjects WHERE id=?').run(req.params.id);
  res.json({ success: true });
}));

export default router;
