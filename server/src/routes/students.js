import { Router } from 'express';
import multer from 'multer';
import Papa from 'papaparse';
import { getDb } from '../db/database.js';
import { authenticate, requireCoordinator } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.use(authenticate);

// GET /api/students
router.get('/', asyncHandler(async (req, res) => {
  const db = getDb();
  const { branch, year, search } = req.query;
  let query = 'SELECT * FROM students WHERE is_active = 1';
  const params = [];
  if (branch) { query += ' AND branch = ?'; params.push(branch); }
  if (year) { query += ' AND year = ?'; params.push(year); }
  if (search) { query += ' AND (name LIKE ? OR prn LIKE ? OR roll_no LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  query += ' ORDER BY year, branch, roll_no';
  res.json(db.prepare(query).all(...params));
}));

// POST /api/students
router.post('/', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  const { name, prn, roll_no, branch, year, semester, scheme } = req.body;
  if (!name || !prn || !roll_no || !branch || !year || !semester) {
    return res.status(400).json({ error: 'name, prn, roll_no, branch, year, semester are required' });
  }
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO students (id, name, prn, roll_no, branch, year, semester, scheme)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name.trim(), prn.trim(), roll_no.trim(), branch.trim(), year, parseInt(semester), scheme || 'K Scheme');
  res.status(201).json(db.prepare('SELECT * FROM students WHERE id = ?').get(id));
}));

// PUT /api/students/:id
router.put('/:id', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  const { name, prn, roll_no, branch, year, semester, scheme } = req.body;
  db.prepare(`
    UPDATE students SET name=?, prn=?, roll_no=?, branch=?, year=?, semester=?, scheme=?, updated_at=datetime('now')
    WHERE id=? AND is_active=1
  `).run(name, prn, roll_no, branch, year, parseInt(semester), scheme, req.params.id);
  res.json(db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id));
}));

// DELETE /api/students/:id
router.delete('/:id', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  db.prepare("UPDATE students SET is_active=0 WHERE id=?").run(req.params.id);
  res.json({ success: true });
}));

// POST /api/students/import (CSV)
router.post('/import', requireCoordinator, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const csv = req.file.buffer.toString('utf-8');
  const { data, errors } = Papa.parse(csv, { header: true, skipEmptyLines: true, transformHeader: h => h.trim().toLowerCase().replace(/\s+/g, '_') });

  const db = getDb();
  const inserted = [];
  const failed = [];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO students (id, name, prn, roll_no, branch, year, semester, scheme)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((rows) => {
    for (const row of rows) {
      try {
        const required = ['name', 'prn', 'roll_no', 'branch', 'year', 'semester'];
        const missing = required.filter(f => !row[f]);
        if (missing.length) { failed.push({ row, reason: `Missing: ${missing.join(', ')}` }); continue; }
        const validYears = ['FY', 'SY', 'TY', 'LY'];
        if (!validYears.includes(row.year?.toUpperCase())) { failed.push({ row, reason: 'year must be FY/SY/TY/LY' }); continue; }
        stmt.run(crypto.randomUUID(), row.name.trim(), row.prn.trim(), row.roll_no.trim(), row.branch.trim(), row.year.toUpperCase(), parseInt(row.semester), row.scheme || 'K Scheme');
        inserted.push(row.prn);
      } catch (e) {
        failed.push({ row, reason: e.message });
      }
    }
  });

  insertMany(data);
  res.json({ inserted: inserted.length, failed, total: data.length });
}));

export default router;
