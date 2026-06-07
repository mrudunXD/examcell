import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { auditLog } from '../middleware/auditLog.js';

const router = Router();
router.use(authenticate);

function verifyAttendanceAccess(req, res, next) {
  if (req.user.role === 'coordinator') return next();
  const db = getDb();
  const isAssigned = db.prepare(`
    SELECT 1 FROM supervisor_duties sd
    JOIN room_allocations ra ON ra.id = sd.room_allocation_id
    WHERE sd.faculty_id = ? AND ra.slot_id = ?
    LIMIT 1
  `).get(req.user.id, req.params.slotId);

  if (!isAssigned) {
    return res.status(403).json({ error: 'Access denied: You are not assigned to this exam slot.' });
  }
  next();
}

// Prepared outside transaction — safe for better-sqlite3
let _stmtGet = null;
let _stmtSummary = null;

// GET attendance for a slot (with optional room filter)
router.get('/:slotId', verifyAttendanceAccess, asyncHandler(async (req, res) => {
  const db = getDb();
  const { room_allocation_id } = req.query;

  // Use seat_assignments as the source of truth for who is in a slot
  // (students who have been seated ARE in the slot)
  let query = `
    SELECT sa.student_id, s.name, s.prn, s.roll_no, s.branch, s.year, s.semester,
      sa.bench_row, sa.bench_col, sa.room_allocation_id as seated_room,
      a.status as attendance_status, a.marked_at, a.notes,
      u.name as marked_by_name,
      ra.slot_id
    FROM seat_assignments sa
    JOIN room_allocations ra ON ra.id = sa.room_allocation_id
    JOIN students s ON s.id = sa.student_id
    LEFT JOIN attendance a ON a.slot_id = ra.slot_id AND a.student_id = sa.student_id
    LEFT JOIN users u ON u.id = a.marked_by
    WHERE ra.slot_id = ?
  `;
  const params = [req.params.slotId];
  if (room_allocation_id) {
    query += ' AND sa.room_allocation_id = ?';
    params.push(room_allocation_id);
  }
  query += ' ORDER BY sa.bench_row, sa.bench_col, s.roll_no';

  const records = db.prepare(query).all(...params);
  res.json(records);
}));

// GET summary for a slot
router.get('/:slotId/summary', verifyAttendanceAccess, asyncHandler(async (req, res) => {
  const db = getDb();
  // Count total seated students in this slot
  const total = db.prepare(`
    SELECT COUNT(DISTINCT sa.student_id) as cnt
    FROM seat_assignments sa
    JOIN room_allocations ra ON ra.id = sa.room_allocation_id
    WHERE ra.slot_id = ?
  `).get(req.params.slotId)?.cnt || 0;

  const present  = db.prepare("SELECT COUNT(*) as cnt FROM attendance WHERE slot_id=? AND status='present'").get(req.params.slotId)?.cnt || 0;
  const absent   = db.prepare("SELECT COUNT(*) as cnt FROM attendance WHERE slot_id=? AND status='absent'").get(req.params.slotId)?.cnt || 0;
  const late     = db.prepare("SELECT COUNT(*) as cnt FROM attendance WHERE slot_id=? AND status='late'").get(req.params.slotId)?.cnt || 0;
  const marked   = db.prepare('SELECT COUNT(*) as cnt FROM attendance WHERE slot_id=?').get(req.params.slotId)?.cnt || 0;
  res.json({ total, present, absent, late, marked, unmarked: total - marked });
}));

// POST bulk upsert attendance — prepare stmt OUTSIDE transaction
router.post('/:slotId', verifyAttendanceAccess, auditLog('SAVE_ATTENDANCE', 'attendance', (req) => req.params.slotId, (req, data) => `Saved ${data?.updated || 0} student attendance records for slot ID: ${req.params.slotId}`), asyncHandler(async (req, res) => {
  const db = getDb();
  const { records } = req.body;
  if (!Array.isArray(records) || !records.length) {
    return res.status(400).json({ error: 'records array required' });
  }

  // Prepare outside transaction (required by better-sqlite3)
  const stmt = db.prepare(`
    INSERT INTO attendance (id, slot_id, student_id, room_allocation_id, status, marked_by, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(slot_id, student_id) DO UPDATE SET
      status=excluded.status, marked_by=excluded.marked_by,
      marked_at=datetime('now'), notes=excluded.notes
  `);

  let count = 0;
  const upsert = db.transaction((recs) => {
    for (const r of recs) {
      stmt.run(
        crypto.randomUUID(),
        req.params.slotId,
        r.student_id,
        r.room_allocation_id || null,
        r.status || 'present',
        req.user.id,
        r.notes || null
      );
      count++;
    }
  });

  upsert(records);
  res.json({ updated: count });
}));

export default router;
