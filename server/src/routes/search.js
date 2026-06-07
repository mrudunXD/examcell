import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) return res.json({ students: [], subjects: [], faculty: [], cycles: [] });

  const db = getDb();
  const term = `%${q.trim()}%`;

  const students = db.prepare(`
    SELECT id, name, prn, roll_no, branch, year, semester
    FROM students WHERE is_active=1 AND (name LIKE ? OR prn LIKE ? OR roll_no LIKE ?)
    LIMIT 10
  `).all(term, term, term);

  const subjects = db.prepare(`
    SELECT id, name, code, branch, year, semester, abbreviation
    FROM subjects WHERE name LIKE ? OR code LIKE ? OR abbreviation LIKE ?
    LIMIT 10
  `).all(term, term, term);

  const faculty = db.prepare(`
    SELECT id, name, email, department, role
    FROM users WHERE is_active=1 AND (name LIKE ? OR email LIKE ? OR department LIKE ?)
    LIMIT 10
  `).all(term, term, term);

  const cycles = db.prepare(`
    SELECT id, name, start_date, end_date, status, semester_type
    FROM exam_cycles WHERE name LIKE ?
    LIMIT 5
  `).all(term);

  res.json({ students, subjects, faculty, cycles });
}));

export default router;
