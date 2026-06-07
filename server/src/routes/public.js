import { Router } from 'express';
import { getDb } from '../db/database.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

// GET initialization data for Kiosk selector (cycles and classrooms)
router.get('/kiosk-init', asyncHandler(async (req, res) => {
  const db = getDb();
  
  const cycles = db.prepare('SELECT id, name, status FROM exam_cycles ORDER BY created_at DESC').all();
  const classrooms = db.prepare('SELECT id, room_no, block FROM classrooms WHERE is_active=1 ORDER BY room_no').all();
  
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
  const cycle = db.prepare('SELECT * FROM exam_cycles WHERE id=?').get(req.params.cycleId);
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

  const slots = db.prepare(query).all(...params);

  // For each slot, get allocated room numbers
  const roomStmt = db.prepare(`
    SELECT c.room_no FROM room_allocations ra
    JOIN classrooms c ON c.id = ra.classroom_id
    WHERE ra.slot_id = ?
  `);
  for (const s of slots) {
    const rooms = roomStmt.all(s.id);
    s.rooms = rooms.map(r => r.room_no).join(', ');
  }

  // Get broadcasts (urgent/critical)
  const broadcasts = db.prepare(`
    SELECT * FROM broadcasts 
    WHERE priority IN ('urgent', 'critical')
    ORDER BY created_at DESC 
    LIMIT 5
  `).all();

  res.json({ cycle, slots, broadcasts });
}));

export default router;
