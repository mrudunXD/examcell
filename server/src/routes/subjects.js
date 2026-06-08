import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate, requireCoordinator } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { auditLog } from '../middleware/auditLog.js';

function inferBranchFromCode(code, currentBranch) {
  if (!code) return currentBranch;
  const c = code.toUpperCase().trim();
  if (c.startsWith('AID')) return 'CSE';
  if (c.startsWith('AIML')) return 'ECE (AI&ML)';
  if (c.startsWith('CYB') || c.startsWith('CS')) return 'Cyber Security';
  if (c.startsWith('IOT')) return 'IoT';
  if (c.startsWith('AI')) return 'AI';
  if (c.startsWith('DS')) return 'DS';
  if (c.startsWith('MEC')) return 'ME';
  if (c.startsWith('MRA')) return 'MRA';
  if (c.startsWith('CIV')) return 'CE';
  if (c.startsWith('ECE')) return 'ECE';
  if (c.startsWith('CSE')) return 'CSE';
  return currentBranch;
}

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const db = getDb();
  res.json(await db.prepare('SELECT * FROM subjects ORDER BY semester, code').all());
}));

router.post('/', requireCoordinator, auditLog('CREATE_SUBJECT', 'subjects', (req, data) => data?.id, (req, data) => `Created subject ${data?.name} (${data?.code})`), asyncHandler(async (req, res) => {
  const db = getDb();
  const { code, name, branch, year, semester, abbreviation, course_type } = req.body;
  if (!code || !name || !branch || !year || !semester)
    return res.status(400).json({ error: 'code, name, branch, year, semester required' });
  const finalBranch = inferBranchFromCode(code, branch);
  const id = crypto.randomUUID();
  await db.prepare(`
    INSERT INTO subjects (id, code, name, branch, year, semester, abbreviation, course_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, code.trim(), name.trim(), finalBranch.trim(), year, parseInt(semester), abbreviation || null, course_type || null);
  res.status(201).json(await db.prepare('SELECT * FROM subjects WHERE id = ?').get(id));
}));

router.put('/:id', requireCoordinator, auditLog('UPDATE_SUBJECT', 'subjects', (req) => req.params.id, (req, data) => `Updated subject ${data?.name} (${data?.code})`), asyncHandler(async (req, res) => {
  const db = getDb();
  const { code, name, branch, year, semester, abbreviation, course_type } = req.body;
  const finalBranch = inferBranchFromCode(code, branch);
  await db.prepare(`
    UPDATE subjects SET code=?, name=?, branch=?, year=?, semester=?, abbreviation=?, course_type=?
    WHERE id=?
  `).run(code, name, finalBranch, year, parseInt(semester), abbreviation || null, course_type || null, req.params.id);
  res.json(await db.prepare('SELECT * FROM subjects WHERE id = ?').get(req.params.id));
}));

router.delete('/:id', requireCoordinator, auditLog('DELETE_SUBJECT', 'subjects', (req) => req.params.id, (req) => `Deleted subject ID: ${req.params.id}`), asyncHandler(async (req, res) => {
  const db = getDb();
  await db.prepare('DELETE FROM subjects WHERE id=?').run(req.params.id);
  res.json({ success: true });
}));

export default router;
