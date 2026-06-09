import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate, requireCoordinator } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { auditLog } from '../middleware/auditLog.js';
import { broadcastUpdate } from '../services/socket.js';

const router = Router();
router.use(authenticate);

// GET all incidents (optionally filtered by slot or cycle)
router.get('/', asyncHandler(async (req, res) => {
  const db = getDb();
  const { slot_id, cycle_id } = req.query;

  let query = `
    SELECT i.*,
      u.name as reported_by_name,
      es.date as exam_date, es.start_time,
      s.name as subject_name, s.code as subject_code,
      c.room_no,
      ec.name as cycle_name
    FROM incidents i
    LEFT JOIN users u ON u.id = i.reported_by
    LEFT JOIN exam_slots es ON es.id = i.slot_id
    LEFT JOIN subjects s ON s.id = es.subject_id
    LEFT JOIN room_allocations ra ON ra.id = i.room_allocation_id
    LEFT JOIN classrooms c ON c.id = ra.classroom_id
    LEFT JOIN exam_cycles ec ON ec.id = es.cycle_id
    WHERE 1=1
  `;
  const params = [];
  if (slot_id) { query += ' AND i.slot_id = ?'; params.push(slot_id); }
  if (cycle_id) { query += ' AND es.cycle_id = ?'; params.push(cycle_id); }

  if (req.user.role !== 'coordinator') {
    query += ` AND (i.reported_by = ? OR i.slot_id IN (
      SELECT ra2.slot_id FROM supervisor_duties sd2
      JOIN room_allocations ra2 ON ra2.id = sd2.room_allocation_id
      WHERE sd2.faculty_id = ?
    ))`;
    params.push(req.user.id, req.user.id);
  }

  query += ' ORDER BY i.created_at DESC';

  res.json(await db.prepare(query).all(...params));
}));

// POST report a new incident
router.post('/', auditLog('REPORT_INCIDENT', 'incidents', (req, data) => data?.id, (req, data) => `Reported incident ${data?.type} (severity: ${data?.severity}) for slot ID: ${data?.slot_id}`), asyncHandler(async (req, res) => {
  const db = getDb();
  const { slot_id, room_allocation_id, type, description, student_prn, action_taken, severity, evidence_image } = req.body;
  if (!slot_id || !type || !description) return res.status(400).json({ error: 'slot_id, type, description required' });

  const id = crypto.randomUUID();
  await db.prepare(`
    INSERT INTO incidents (id, slot_id, room_allocation_id, reported_by, type, description, student_prn, action_taken, severity, evidence_image)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(id, slot_id, room_allocation_id || null, req.user.id, type, description, student_prn || null, action_taken || null, severity || 'low', evidence_image || null);

  const incident = await db.prepare('SELECT * FROM incidents WHERE id=?').get(id);
  broadcastUpdate('INCIDENT_REPORTED', incident);
  res.status(201).json(incident);
}));

// PATCH update status/resolution
router.patch('/:id', requireCoordinator, auditLog('RESOLVE_INCIDENT', 'incidents', (req) => req.params.id, (req, data) => `Updated incident ID: ${req.params.id} (status: ${data?.status})`), asyncHandler(async (req, res) => {
  const db = getDb();
  const { status, action_taken } = req.body;
  const now = new Date().toISOString();
  await db.prepare(`
    UPDATE incidents SET 
      status = COALESCE(?, status),
      action_taken = COALESCE(?, action_taken),
      resolved_at = CASE WHEN ? = 'resolved' THEN ? ELSE resolved_at END
    WHERE id = ?
  `).run(status, action_taken, status, now, req.params.id);
  const incident = await db.prepare('SELECT * FROM incidents WHERE id=?').get(req.params.id);
  broadcastUpdate('INCIDENT_UPDATED', incident);
  res.json(incident);
}));

export default router;
