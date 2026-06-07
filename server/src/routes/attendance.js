import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();
router.use(authenticate);

// GET attendance for a slot (with room filter optional)
router.get('/:slotId', asyncHandler(async (req, res) => {
  const db = getDb();
  const { room_allocation_id } = req.query;

  // Get slot students with their attendance status
  let query = `
    SELECT ss.student_id, s.name, s.prn, s.roll_no, s.branch, s.year, s.semester,
      sa.bench_row, sa.bench_col, sa.room_allocation_id as seated_room,
      a.status as attendance_status, a.marked_at, a.notes,
      u.name as marked_by_name
    FROM slot_students ss
    JOIN students s ON s.id = ss.student_id
    LEFT JOIN seat_assignments sa ON sa.student_id = ss.student_id
      AND sa.room_allocation_id IN (SELECT id FROM room_allocations WHERE slot_id = ss.slot_id)
    LEFT JOIN attendance a ON a.slot_id = ss.slot_id AND a.student_id = ss.student_id
    LEFT JOIN users u ON u.id = a.marked_by
    WHERE ss.slot_id = ?
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
router.get('/:slotId/summary', asyncHandler(async (req, res) => {
  const db = getDb();
  const total = db.prepare('SELECT COUNT(*) as cnt FROM slot_students WHERE slot_id=?').get(req.params.slotId)?.cnt || 0;
  const present = db.prepare("SELECT COUNT(*) as cnt FROM attendance WHERE slot_id=? AND status='present'").get(req.params.slotId)?.cnt || 0;
  const absent = db.prepare("SELECT COUNT(*) as cnt FROM attendance WHERE slot_id=? AND status='absent'").get(req.params.slotId)?.cnt || 0;
  const late = db.prepare("SELECT COUNT(*) as cnt FROM attendance WHERE slot_id=? AND status='late'").get(req.params.slotId)?.cnt || 0;
  const marked = db.prepare('SELECT COUNT(*) as cnt FROM attendance WHERE slot_id=?').get(req.params.slotId)?.cnt || 0;
  res.json({ total, present, absent, late, marked, unmarked: total - marked });
}));

// POST bulk upsert attendance
router.post('/:slotId', asyncHandler(async (req, res) => {
  const db = getDb();
  const { records } = req.body; // [{ student_id, status, room_allocation_id, notes }]
  if (!Array.isArray(records) || !records.length) return res.status(400).json({ error: 'records array required' });

  const stmt = db.prepare(`
    INSERT INTO attendance (id, slot_id, student_id, room_allocation_id, status, marked_by, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(slot_id, student_id) DO UPDATE SET
      status=excluded.status, marked_by=excluded.marked_by,
      marked_at=datetime('now'), notes=excluded.notes
  `);

  const upsert = db.transaction(() => {
    let count = 0;
    for (const r of records) {
      stmt.run(crypto.randomUUID(), req.params.slotId, r.student_id, r.room_allocation_id || null, r.status || 'present', req.user.id, r.notes || null);
      count++;
    }
    return count;
  });

  const count = upsert();
  res.json({ updated: count });
}));

export default router;
