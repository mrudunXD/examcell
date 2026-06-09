import { Router } from 'express';
import { getDb } from '../db/database.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

// GET initialization data for Kiosk selector (cycles and classrooms)
router.get('/kiosk-init', asyncHandler(async (req, res) => {
  const db = getDb();
  
  const cycles = await db.prepare('SELECT id, name, status FROM exam_cycles ORDER BY created_at DESC').all();
  const classrooms = await db.prepare('SELECT id, room_no, block FROM classrooms WHERE is_active=1 ORDER BY room_no').all();
  
  res.json({ cycles, classrooms });
}));

// GET kiosk data for a cycle and optional room
router.get('/kiosk/:cycleId', asyncHandler(async (req, res) => {
  const db = getDb();
  const { classroomId } = req.query;
  
  // Format today's date in YYYY-MM-DD local format
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const todayLocal = `${yyyy}-${mm}-${dd}`;

  // Get cycle info
  const cycle = await db.prepare('SELECT * FROM exam_cycles WHERE id=?').get(req.params.cycleId);
  if (!cycle) return res.status(404).json({ error: 'Cycle not found' });

  // Get slots for today in this cycle
  let query = `
    SELECT es.*, s.code as subject_code, s.name as subject_name, s.branch, s.year
    FROM exam_slots es
    JOIN subjects s ON s.id = es.subject_id
    WHERE es.cycle_id = ? AND es.date = ?
  `;
  const params = [req.params.cycleId, todayLocal];

  if (classroomId) {
    query = `
      SELECT es.*, s.code as subject_code, s.name as subject_name, s.branch, s.year
      FROM exam_slots es
      JOIN subjects s ON s.id = es.subject_id
      JOIN room_allocations ra ON ra.slot_id = es.id
      WHERE es.cycle_id = ? AND es.date = ? AND ra.classroom_id = ?
    `;
    params.push(classroomId);
  }

  const slots = await db.prepare(query).all(...params);

  // For each slot, get allocated room info with IDs
  const roomStmt = await db.prepare(`
    SELECT ra.id as room_allocation_id, ra.classroom_id, c.room_no, c.block FROM room_allocations ra
    JOIN classrooms c ON c.id = ra.classroom_id
    WHERE ra.slot_id = ?
  `);
  for (const s of slots) {
    s.rooms = await roomStmt.all(s.id);
  }

  // Get broadcasts (urgent/critical)
  const broadcasts = await db.prepare(`
    SELECT * FROM broadcasts 
    WHERE priority IN ('urgent', 'critical')
    ORDER BY created_at DESC 
    LIMIT 5
  `).all();

  res.json({ cycle, slots, broadcasts });
}));

// GET seat assignments for visual mapping in Kiosk Mode
router.get('/seating/:roomAllocationId', asyncHandler(async (req, res) => {
  const db = getDb();
  const ra = await db.prepare('SELECT * FROM room_allocations WHERE id=?').get(req.params.roomAllocationId);
  if (!ra) return res.status(404).json({ error: 'Room allocation not found' });

  const classroom = await db.prepare('SELECT * FROM classrooms WHERE id=?').get(ra.classroom_id);
  const assignments = await db.prepare(`
    SELECT sa.bench_row, sa.bench_col, st.prn, st.roll_no, st.branch, st.year
    FROM seat_assignments sa
    JOIN students st ON st.id = sa.student_id
    WHERE sa.room_allocation_id = ?
    ORDER BY sa.bench_row, sa.bench_col
  `).all(req.params.roomAllocationId);

  res.json({ classroom, assignments });
}));

// GET /api/public/server-time
router.get('/server-time', asyncHandler(async (req, res) => {
  res.json({
    serverTime: new Date().toISOString(),
    timezoneOffset: new Date().getTimezoneOffset()
  });
}));

export default router;
