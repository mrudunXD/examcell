import { Router } from 'express';
import multer from 'multer';
import Papa from 'papaparse';
import { getDb } from '../db/database.js';
import { authenticate, requireCoordinator } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { auditLog } from '../middleware/auditLog.js';
import { StudentRepository } from '../modules/students/studentRepository.js';
import { validate } from '../middleware/validate.js';

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
// GET /students/meta — retrieve unique branches and sections for filtering
router.get('/meta', requireCoordinator, asyncHandler(async (req, res) => {
  const meta = await StudentRepository.getUniqueBranchesAndSections();
  res.json(meta);
}));

router.get('/', requireCoordinator, asyncHandler(async (req, res) => {
  const { branch, year, search, section, page, limit } = req.query;
  
  let paginationOptions = {};
  if (limit) {
    const parsedLimit = parseInt(limit, 10);
    const parsedPage = parseInt(page || 1, 10);
    paginationOptions = {
      limit: parsedLimit,
      offset: (parsedPage - 1) * parsedLimit
    };
  }

  const students = await StudentRepository.findPaginatedActive({
    branch,
    year,
    section,
    search,
    ...paginationOptions
  });
  
  const total = await StudentRepository.countActive({ branch, year, section, search });
  res.setHeader('X-Total-Count', total);
  res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count');
  res.json(students);
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
router.post('/', requireCoordinator, validate({
  name: [{ required: true, type: 'string', minLength: 1 }],
  prn: [{ required: true, type: 'string', minLength: 1 }],
  roll_no: [{ required: true, type: 'string', minLength: 1 }],
  branch: [{ required: true, type: 'string', minLength: 1 }],
  year: [{ required: true, oneOf: ['FY', 'SY', 'TY', 'LY'] }],
  semester: [{ required: true, type: 'number', min: 1 }],
}), auditLog('CREATE_STUDENT', 'students', (req, data) => data?.id, (req, data) => `Created student ${data?.name} (${data?.prn})`), asyncHandler(async (req, res) => {
  const { name, prn, roll_no, branch, section, year, semester } = req.body;
  const fieldsToCheck = [name, prn, roll_no, branch, section, year];
  if (fieldsToCheck.some(val => val && /^[=+\-@\t\r]/.test(String(val)))) {
    return res.status(400).json({ error: 'Input fields cannot start with =, +, -, @ to prevent formula injection.' });
  }

  const id = crypto.randomUUID();
  await StudentRepository.create({
    id,
    name: name.trim(),
    prn: prn.trim(),
    roll_no: roll_no.trim(),
    branch: branch.trim(),
    section: (section || '').trim() || null,
    year,
    semester: parseInt(semester, 10)
  });
  res.status(201).json(await StudentRepository.findById(id));
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
  const { name, prn, roll_no, branch, section, year, semester } = req.body;
  const fieldsToCheck = [name, prn, roll_no, branch, section, year];
  if (fieldsToCheck.some(val => val && /^[=+\-@\t\r]/.test(String(val)))) {
    return res.status(400).json({ error: 'Input fields cannot start with =, +, -, @ to prevent formula injection.' });
  }

  await StudentRepository.updateFull(req.params.id, {
    name,
    prn,
    roll_no,
    branch,
    section: (section || '').trim() || null,
    year,
    semester: parseInt(semester, 10)
  });
  res.json(await StudentRepository.findById(req.params.id));
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
  await StudentRepository.softDelete(req.params.id);
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

  if (data.length > 5000) {
    return res.status(400).json({ error: 'Bulk student import limit exceeded (maximum 5000 rows allowed).' });
  }

  const db = getDb();
  const inserted = [];
  const failed = [];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO students (id, name, prn, roll_no, branch, section, year, semester)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = await db.transaction(async (rows) => {
    let rowIndex = 2;
    for (const row of rows) {
      try {
        const required = ['name', 'prn', 'roll_no', 'branch', 'year', 'semester'];
        const missing = required.filter(f => !row[f]);
        if (missing.length) { failed.push({ row, rowIndex, reason: `Row ${rowIndex}: Missing: ${missing.join(', ')}` }); rowIndex++; continue; }

        // Prevent formula / CSV injection
        let hasFormula = false;
        for (const key of required) {
          const val = String(row[key] || '');
          if (/^[=+\-@\t\r]/.test(val)) {
            hasFormula = true;
            break;
          }
        }
        if (hasFormula) {
          failed.push({ row, rowIndex, reason: `Row ${rowIndex}: CSV injection threat detected: values cannot start with =, +, -, @` });
          rowIndex++;
          continue;
        }

        const validYears = ['FY', 'SY', 'TY', 'LY'];
        if (!validYears.includes(row.year?.toUpperCase())) {
          failed.push({ row, rowIndex, reason: `Row ${rowIndex}: year must be FY/SY/TY/LY` });
          rowIndex++;
          continue;
        }
        await stmt.run(
          crypto.randomUUID(),
          row.name.trim(), row.prn.trim(), row.roll_no.trim(),
          row.branch.trim(), (row.section || '').trim() || null,
          row.year.toUpperCase(), parseInt(row.semester),
        );
        inserted.push(row.prn);
      } catch (e) {
        failed.push({ row, rowIndex, reason: `Row ${rowIndex}: ${e.message}` });
      }
      rowIndex++;
    }
  });

  await insertMany(data);
  res.json({ inserted: inserted.length, failed, total: data.length });
}));

export default router;
