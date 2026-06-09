import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db/database.js';
import { authenticate, requireCoordinator } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();
router.use(authenticate);

// GET all faculty
router.get('/', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  const faculty = await db.prepare("SELECT id, name, email, role, department, is_active, created_at FROM users WHERE role='faculty' ORDER BY name").all();
  // Attach subjects for each faculty
  const subjectStmt = await db.prepare(`
    SELECT s.* FROM subjects s
    JOIN faculty_subjects fs ON fs.subject_id = s.id
    WHERE fs.faculty_id = ?
  `);
  res.json(faculty.map(f => ({ ...f, subjects: subjectStmt.all(f.id) })));
}));

// POST create faculty account
router.post('/', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  const { name, email, department, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' });
  const hash = bcrypt.hashSync(password, 10);
  const id = crypto.randomUUID();
  await db.prepare('INSERT INTO users (id, name, email, password_hash, role, department) VALUES (?, ?, ?, ?, ?, ?)').run(id, name.trim(), email.toLowerCase().trim(), hash, 'faculty', department?.trim() || '');
  res.status(201).json(await db.prepare("SELECT id, name, email, role, department, is_active FROM users WHERE id=?").get(id));
}));

// PUT update faculty
router.put('/:id', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  const { name, email, department, password } = req.body;
  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    await db.prepare("UPDATE users SET name=?, email=?, department=?, password_hash=?, updated_at=datetime('now') WHERE id=?").run(name, email, department, hash, req.params.id);
  } else {
    await db.prepare("UPDATE users SET name=?, email=?, department=?, updated_at=datetime('now') WHERE id=?").run(name, email, department, req.params.id);
  }
  res.json(await db.prepare("SELECT id, name, email, role, department FROM users WHERE id=?").get(req.params.id));
}));

// DELETE (deactivate) faculty
router.delete('/:id', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  // M8: Block deactivation if faculty has upcoming supervisor duties
  const upcomingDuties = await db.prepare(`
    SELECT COUNT(*) as cnt FROM supervisor_duties sd
    JOIN room_allocations ra ON ra.id = sd.room_allocation_id
    JOIN exam_slots es ON es.id = ra.slot_id
    WHERE sd.faculty_id = ? AND es.date >= CURRENT_DATE
  `).get(req.params.id);
  if (upcomingDuties && upcomingDuties.cnt > 0) {
    return res.status(400).json({
      error: `Cannot deactivate: faculty has ${upcomingDuties.cnt} upcoming supervisor duties. Reassign them first.`
    });
  }
  await db.prepare("UPDATE users SET is_active=0 WHERE id=? AND role='faculty'").run(req.params.id);
  res.json({ success: true });
}));

// GET faculty subjects
router.get('/:id/subjects', asyncHandler(async (req, res) => {
  // H6: Faculty can only view their own subjects; coordinators can view any
  if (req.user.role === 'faculty' && req.user.id !== req.params.id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const db = getDb();
  const subjects = await db.prepare(`
    SELECT s.* FROM subjects s
    JOIN faculty_subjects fs ON fs.subject_id = s.id
    WHERE fs.faculty_id = ?
  `).all(req.params.id);
  res.json(subjects);
}));

// PUT assign subjects to faculty
router.put('/:id/subjects', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  const { subject_ids } = req.body; // array of subject IDs
  if (!Array.isArray(subject_ids)) return res.status(400).json({ error: 'subject_ids must be array' });

  const updateSubjects = await db.transaction(async () => {
    await db.prepare('DELETE FROM faculty_subjects WHERE faculty_id=?').run(req.params.id);
    const stmt = db.prepare('INSERT INTO faculty_subjects (faculty_id, subject_id) VALUES (?, ?)');
    for (const sid of subject_ids) await stmt.run(req.params.id, sid);
  });
  await updateSubjects();
  res.json({ success: true });
}));

export default router;
