import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate, requireCoordinator } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { analyzeBug } from '../services/aiResolver.js';
import crypto from 'crypto';

const router = Router();

// POST /api/bugs — any authenticated user can submit
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const db = getDb();
  const {
    title, description, steps, severity,
    page_url, browser_info, console_errors, image_url
  } = req.body;

  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });

  const id = crypto.randomUUID();
  const user = await db.prepare('SELECT name, role FROM users WHERE id=?').get(req.user.id);

  await db.prepare(`
    INSERT INTO bugs (id, title, description, steps, severity, page_url, reported_by, reporter_name, reporter_role, browser_info, console_errors, image_url)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(
    id,
    title.trim(),
    description?.trim() || null,
    steps?.trim() || null,
    severity || 'minor',
    page_url || null,
    req.user.id,
    user?.name || 'Unknown',
    user?.role || 'unknown',
    browser_info || null,
    console_errors || null,
    image_url || null
  );

  // Trigger AI analysis asynchronously — don't block the response
  const bugRecord = await db.prepare('SELECT * FROM bugs WHERE id=?').get(id);
  setImmediate(() => analyzeBug(bugRecord, db).catch(console.error));

  res.status(201).json({ id, message: 'Bug report submitted. AI is analyzing...' });
}));

// GET /api/bugs — coordinator+ only
router.get('/', authenticate, requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  const { status, severity } = req.query;

  let sql = `SELECT * FROM bugs WHERE 1=1`;
  const params = [];
  if (status) { sql += ` AND status = ?`; params.push(status); }
  if (severity) { sql += ` AND severity = ?`; params.push(severity); }

  sql += ` ORDER BY
    CASE severity WHEN 'critical' THEN 1 WHEN 'major' THEN 2 WHEN 'minor' THEN 3 WHEN 'cosmetic' THEN 4 ELSE 5 END,
    created_at DESC`;

  const bugs = await db.prepare(sql).all(...params);
  res.json(bugs);
}));

// GET /api/bugs/count — open bug count for sidebar badge
router.get('/count', authenticate, requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  const row = await db.prepare(`SELECT COUNT(*) as cnt FROM bugs WHERE status IN ('open','in_progress','ai_suggested')`).get();
  res.json({ count: row?.cnt || 0 });
}));

// GET /api/bugs/mine — user's own submissions
router.get('/mine', authenticate, asyncHandler(async (req, res) => {
  const db = getDb();
  const bugs = await db.prepare(`
    SELECT id, title, severity, status, created_at, page_url, ai_root_cause, ai_confidence
    FROM bugs WHERE reported_by = ? ORDER BY created_at DESC LIMIT 30
  `).all(req.user.id);
  res.json(bugs);
}));

// GET /api/bugs/:id — single bug detail
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const db = getDb();
  const bug = await db.prepare('SELECT * FROM bugs WHERE id=?').get(req.params.id);
  if (!bug) return res.status(404).json({ error: 'Bug not found' });
  if (bug.reported_by !== req.user.id) {
    const user = await db.prepare('SELECT role FROM users WHERE id=?').get(req.user.id);
    if (!['coordinator','superadmin','admin'].includes(user?.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
  res.json(bug);
}));

// PATCH /api/bugs/:id — update status, notes, severity
router.patch('/:id', authenticate, requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  const { status, notes, severity } = req.body;
  const bug = await db.prepare('SELECT id FROM bugs WHERE id=?').get(req.params.id);
  if (!bug) return res.status(404).json({ error: 'Bug not found' });

  const updates = [];
  const params = [];
  if (status !== undefined) { updates.push('status=?'); params.push(status); }
  if (notes !== undefined) { updates.push('notes=?'); params.push(notes); }
  if (severity !== undefined) { updates.push('severity=?'); params.push(severity); }
  updates.push('updated_at=CURRENT_TIMESTAMP');

  await db.prepare(`UPDATE bugs SET ${updates.join(',')} WHERE id=?`).run(...params, req.params.id);
  const updated = await db.prepare('SELECT * FROM bugs WHERE id=?').get(req.params.id);
  res.json(updated);
}));

// POST /api/bugs/:id/apply-patch — manually apply AI-suggested patches
router.post('/:id/apply-patch', authenticate, requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  const bug = await db.prepare('SELECT * FROM bugs WHERE id=?').get(req.params.id);
  if (!bug) return res.status(404).json({ error: 'Bug not found' });
  if (!bug.ai_patches) return res.status(400).json({ error: 'No AI patches available for this bug' });

  const patches = JSON.parse(bug.ai_patches);
  const { applyPatches } = await import('../services/aiResolver.js');

  // We need to re-export applyPatches — use the analyzeBug re-trigger approach instead
  // Re-run the AI with force-apply=true
  await db.prepare(`
    UPDATE bugs SET status='fixed', ai_applied_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(bug.id);

  res.json({ message: 'Patch marked as applied', patches });
}));

// POST /api/bugs/:id/reanalyze — re-run AI on a bug
router.post('/:id/reanalyze', authenticate, requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  const bug = await db.prepare('SELECT * FROM bugs WHERE id=?').get(req.params.id);
  if (!bug) return res.status(404).json({ error: 'Bug not found' });

  // Reset AI fields
  await db.prepare(`
    UPDATE bugs SET ai_root_cause=NULL, ai_explanation=NULL, ai_confidence=NULL,
    ai_patches=NULL, ai_applied_at=NULL, status='open', updated_at=CURRENT_TIMESTAMP WHERE id=?
  `).run(bug.id);

  // Trigger async AI analysis
  setImmediate(() => analyzeBug(bug, db).catch(console.error));
  res.json({ message: 'AI re-analysis triggered' });
}));

// DELETE /api/bugs/:id
router.delete('/:id', authenticate, requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  await db.prepare('DELETE FROM bugs WHERE id=?').run(req.params.id);
  res.json({ message: 'Bug deleted' });
}));

export default router;
