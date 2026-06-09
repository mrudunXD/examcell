import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate, requireCoordinator } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { auditLog } from '../middleware/auditLog.js';
import { broadcastUpdate } from '../services/socket.js';

const router = Router();
router.use(authenticate);

// GET all replacement requests (coordinators only)
router.get('/', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  const list = await db.prepare(`
    SELECT rr.*, u.name as faculty_name, u.department,
      es.date, es.start_time, c.room_no, s.code as subject_code
    FROM replacement_requests rr
    JOIN users u ON u.id = rr.faculty_id
    JOIN supervisor_duties sd ON sd.id = rr.duty_id
    JOIN room_allocations ra ON ra.id = sd.room_allocation_id
    JOIN classrooms c ON c.id = ra.classroom_id
    JOIN exam_slots es ON es.id = ra.slot_id
    JOIN subjects s ON s.id = es.subject_id
    ORDER BY rr.created_at DESC
  `).all();
  res.json(list);
}));

// GET my replacement requests (faculty)
router.get('/my-requests', asyncHandler(async (req, res) => {
  const db = getDb();
  const list = await db.prepare(`
    SELECT rr.*, es.date, es.start_time, c.room_no, s.code as subject_code
    FROM replacement_requests rr
    JOIN supervisor_duties sd ON sd.id = rr.duty_id
    JOIN room_allocations ra ON ra.id = sd.room_allocation_id
    JOIN classrooms c ON c.id = ra.classroom_id
    JOIN exam_slots es ON es.id = ra.slot_id
    JOIN subjects s ON s.id = es.subject_id
    WHERE rr.faculty_id = ?
    ORDER BY rr.created_at DESC
  `).all(req.user.id);
  res.json(list);
}));

// POST submit a replacement request (faculty)
router.post('/', auditLog('REQUEST_REPLACEMENT', 'replacement_requests', (req, data) => data?.id, (req, data) => `Requested replacement for duty ID: ${req.body.duty_id}`), asyncHandler(async (req, res) => {
  const db = getDb();
  const { duty_id, reason } = req.body;
  if (!duty_id || !reason) return res.status(400).json({ error: 'duty_id and reason are required' });

  // Verify duty belongs to faculty
  const duty = await db.prepare('SELECT id FROM supervisor_duties WHERE id = ? AND faculty_id = ?').get(duty_id, req.user.id);
  if (!duty) return res.status(404).json({ error: 'Duty not found or not assigned to you' });

  // Check if a pending request already exists
  const existing = await db.prepare('SELECT id FROM replacement_requests WHERE duty_id = ? AND status = \'pending\'').get(duty_id);
  if (existing) return res.status(400).json({ error: 'A pending replacement request already exists for this duty' });

  const id = crypto.randomUUID();
  await db.prepare(`
    INSERT INTO replacement_requests (id, duty_id, faculty_id, reason, status)
    VALUES (?, ?, ?, ?, 'pending')
  `).run(id, duty_id, req.user.id, reason);

  const request = await db.prepare('SELECT * FROM replacement_requests WHERE id = ?').get(id);
  
  // Realtime notification to coordinators
  broadcastUpdate('REPLACEMENT_REQUESTED', {
    ...request,
    faculty_name: req.user.name,
    department: req.user.department
  });

  res.status(201).json(request);
}));

// POST resolve a replacement request (coordinator only)
router.post('/:id/resolve', requireCoordinator, auditLog('RESOLVE_REPLACEMENT', 'replacement_requests', (req) => req.params.id, (req) => `Resolved replacement request ID: ${req.params.id} to status: ${req.body.status}`), asyncHandler(async (req, res) => {
  const db = getDb();
  const { status } = req.body; // 'approved' or 'rejected'
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'status must be approved or rejected' });
  }

  const rr = await db.prepare('SELECT * FROM replacement_requests WHERE id = ?').get(req.params.id);
  if (!rr) return res.status(404).json({ error: 'Replacement request not found' });

  const now = new Date().toISOString();
  await db.prepare(`
    UPDATE replacement_requests
    SET status = ?, resolved_at = ?, resolved_by = ?
    WHERE id = ?
  `).run(status, now, req.user.id, req.params.id);

  const updated = await db.prepare('SELECT * FROM replacement_requests WHERE id = ?').get(req.params.id);
  
  broadcastUpdate('REPLACEMENT_RESOLVED', updated);

  res.json(updated);
}));

export default router;
