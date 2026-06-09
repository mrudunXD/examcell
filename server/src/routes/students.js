import { Router } from 'express';
import multer from 'multer';
import Papa from 'papaparse';
import { getDb } from '../db/database.js';
import { authenticate, requireCoordinator } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { auditLog } from '../middleware/auditLog.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.use(authenticate);

/**
 * @openapi
 * /students:
 *   get:
 *     summary: Retrieve list of active students
 *     tags:
 *       - Students
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: branch
 *         schema:
 *           type: string
 *       - in: query
 *         name: year
 *         schema:
 *           type: string
 *           enum: [FY, SY, TY, LY]
 *       - in: query
 *         name: section
 *         schema:
 *           type: string
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search query matching name, PRN, or roll number
 *     responses:
 *       200:
 *         description: Array of student objects
 */
router.get('/', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  const { branch, year, search, section } = req.query;
  let query = 'SELECT * FROM students WHERE is_active = 1';
  const params = [];
  if (branch)   { query += ' AND branch = ?';   params.push(branch); }
  if (year)     { query += ' AND year = ?';     params.push(year); }
  if (section)  { query += ' AND section = ?';  params.push(section); }
  if (search)   {
    query += ' AND (name LIKE ? OR prn LIKE ? OR roll_no LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  query += ' ORDER BY year, branch, section, roll_no';
  res.json(await db.prepare(query).all(...params));
}));

/**
 * @openapi
 * /students:
 *   post:
 *     summary: Create a new student
 *     tags:
 *       - Students
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - prn
 *               - roll_no
 *               - branch
 *               - year
 *               - semester
 *             properties:
 *               name:
 *                 type: string
 *               prn:
 *                 type: string
 *               roll_no:
 *                 type: string
 *               branch:
 *                 type: string
 *               section:
 *                 type: string
 *               year:
 *                 type: string
 *                 enum: [FY, SY, TY, LY]
 *               semester:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Student created successfully
 */
router.post('/', requireCoordinator, auditLog('CREATE_STUDENT', 'students', (req, data) => data?.id, (req, data) => `Created student ${data?.name} (${data?.prn})`), asyncHandler(async (req, res) => {
  const db = getDb();
  const { name, prn, roll_no, branch, section, year, semester } = req.body;
  if (!name || !prn || !roll_no || !branch || !year || !semester)
    return res.status(400).json({ error: 'name, prn, roll_no, branch, year, semester are required' });
  const id = crypto.randomUUID();
  await db.prepare(`
    INSERT INTO students (id, name, prn, roll_no, branch, section, year, semester)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name.trim(), prn.trim(), roll_no.trim(), branch.trim(), (section || '').trim() || null, year, parseInt(semester));
  res.status(201).json(await db.prepare('SELECT * FROM students WHERE id = ?').get(id));
}));

/**
 * @openapi
 * /students/{id}:
 *   put:
 *     summary: Update an existing student
 *     tags:
 *       - Students
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - prn
 *               - roll_no
 *               - branch
 *               - year
 *               - semester
 *     responses:
 *       200:
 *         description: Student updated successfully
 */
router.put('/:id', requireCoordinator, auditLog('UPDATE_STUDENT', 'students', (req) => req.params.id, (req, data) => `Updated student ${data?.name} (${data?.prn})`), asyncHandler(async (req, res) => {
  const db = getDb();
  const { name, prn, roll_no, branch, section, year, semester } = req.body;
  await db.prepare(`
    UPDATE students
    SET name=?, prn=?, roll_no=?, branch=?, section=?, year=?, semester=?, updated_at=datetime('now')
    WHERE id=? AND is_active=1
  `).run(name, prn, roll_no, branch, (section || '').trim() || null, year, parseInt(semester), req.params.id);
  res.json(await db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id));
}));

/**
 * @openapi
 * /students/{id}:
 *   delete:
 *     summary: Soft delete a student
 *     tags:
 *       - Students
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Student deleted successfully
 */
router.delete('/:id', requireCoordinator, auditLog('DELETE_STUDENT', 'students', (req) => req.params.id, (req) => `Soft-deleted student ID: ${req.params.id}`), asyncHandler(async (req, res) => {
  const db = getDb();
  await db.prepare("UPDATE students SET is_active=0 WHERE id=?").run(req.params.id);
  res.json({ success: true });
}));

// POST /api/students/import (CSV)
router.post('/import', requireCoordinator, upload.single('file'), auditLog('IMPORT_STUDENTS', 'students', null, (req, data) => `Imported ${data?.inserted || 0} students from CSV (failed: ${data?.failed?.length || 0})`), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const csv = req.file.buffer.toString('utf-8');
  const { data } = Papa.parse(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: h => h.trim().toLowerCase().replace(/\s+/g, '_'),
  });

  const db = getDb();
  const inserted = [];
  const failed = [];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO students (id, name, prn, roll_no, branch, section, year, semester)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = await db.transaction(async (rows) => {
    for (const row of rows) {
      try {
        const required = ['name', 'prn', 'roll_no', 'branch', 'year', 'semester'];
        const missing = required.filter(f => !row[f]);
        if (missing.length) { failed.push({ row, reason: `Missing: ${missing.join(', ')}` }); continue; }
        const validYears = ['FY', 'SY', 'TY', 'LY'];
        if (!validYears.includes(row.year?.toUpperCase())) {
          failed.push({ row, reason: 'year must be FY/SY/TY/LY' }); continue;
        }
        await stmt.run(
          crypto.randomUUID(),
          row.name.trim(), row.prn.trim(), row.roll_no.trim(),
          row.branch.trim(), (row.section || '').trim() || null,
          row.year.toUpperCase(), parseInt(row.semester),
        );
        inserted.push(row.prn);
      } catch (e) {
        failed.push({ row, reason: e.message });
      }
    }
  });

  await insertMany(data);
  res.json({ inserted: inserted.length, failed, total: data.length });
}));

export default router;
