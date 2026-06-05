import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate, requireCoordinator } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();
router.use(authenticate);

// GET all cycles
router.get('/', asyncHandler(async (req, res) => {
  const db = getDb();
  const cycles = db.prepare('SELECT * FROM exam_cycles ORDER BY created_at DESC').all();
  res.json(cycles);
}));

// POST create cycle
router.post('/', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  const { name, start_date, end_date } = req.body;
  if (!name || !start_date || !end_date) return res.status(400).json({ error: 'name, start_date, end_date required' });
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO exam_cycles (id, name, start_date, end_date, created_by) VALUES (?, ?, ?, ?, ?)').run(id, name.trim(), start_date, end_date, req.user.id);
  res.status(201).json(db.prepare('SELECT * FROM exam_cycles WHERE id=?').get(id));
}));

// PUT update cycle
router.put('/:id', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  const { name, start_date, end_date, status } = req.body;
  db.prepare("UPDATE exam_cycles SET name=?, start_date=?, end_date=?, status=?, updated_at=datetime('now') WHERE id=?").run(name, start_date, end_date, status, req.params.id);
  res.json(db.prepare('SELECT * FROM exam_cycles WHERE id=?').get(req.params.id));
}));

// DELETE cycle
router.delete('/:id', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM exam_cycles WHERE id=?').run(req.params.id);
  res.json({ success: true });
}));

// --- EXAM SLOTS ---

// GET slots for a cycle
router.get('/:cycleId/slots', asyncHandler(async (req, res) => {
  const db = getDb();
  const slots = db.prepare(`
    SELECT es.*, s.code as subject_code, s.name as subject_name, s.branch, s.year
    FROM exam_slots es
    JOIN subjects s ON s.id = es.subject_id
    WHERE es.cycle_id = ?
    ORDER BY es.date, es.start_time
  `).all(req.params.cycleId);

  // Attach room allocations and student count
  const roomsStmt = db.prepare(`
    SELECT ra.*, c.room_no, c.block, c.capacity,
      (SELECT COUNT(*) FROM seat_assignments sa WHERE sa.room_allocation_id = ra.id) as seated_count
    FROM room_allocations ra
    JOIN classrooms c ON c.id = ra.classroom_id
    WHERE ra.slot_id = ?
  `);
  const studentCountStmt = db.prepare('SELECT COUNT(*) as cnt FROM slot_students WHERE slot_id=?');

  res.json(slots.map(slot => ({
    ...slot,
    rooms: roomsStmt.all(slot.id),
    student_count: studentCountStmt.get(slot.id)?.cnt || 0
  })));
}));

// POST create slot
router.post('/:cycleId/slots', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  const { subject_id, date, start_time, duration_mins, classroom_ids, student_ids } = req.body;
  if (!subject_id || !date || !start_time) return res.status(400).json({ error: 'subject_id, date, start_time required' });

  const slotId = crypto.randomUUID();
  const createSlot = db.transaction(() => {
    db.prepare('INSERT INTO exam_slots (id, cycle_id, subject_id, date, start_time, duration_mins) VALUES (?, ?, ?, ?, ?, ?)').run(slotId, req.params.cycleId, subject_id, date, start_time, parseInt(duration_mins) || 180);

    // Assign classrooms
    if (Array.isArray(classroom_ids)) {
      const raStmt = db.prepare('INSERT INTO room_allocations (id, slot_id, classroom_id) VALUES (?, ?, ?)');
      for (const cid of classroom_ids) raStmt.run(crypto.randomUUID(), slotId, cid);
    }

    // Assign students
    if (Array.isArray(student_ids)) {
      const ssStmt = db.prepare('INSERT OR IGNORE INTO slot_students (slot_id, student_id) VALUES (?, ?)');
      for (const sid of student_ids) ssStmt.run(slotId, sid);
    }
  });
  createSlot();
  res.status(201).json(db.prepare('SELECT * FROM exam_slots WHERE id=?').get(slotId));
}));

// PUT update slot
router.put('/:cycleId/slots/:slotId', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  const { subject_id, date, start_time, duration_mins, classroom_ids, student_ids } = req.body;

  const updateSlot = db.transaction(() => {
    db.prepare('UPDATE exam_slots SET subject_id=?, date=?, start_time=?, duration_mins=? WHERE id=?').run(subject_id, date, start_time, parseInt(duration_mins), req.params.slotId);

    if (Array.isArray(classroom_ids)) {
      db.prepare('DELETE FROM room_allocations WHERE slot_id=?').run(req.params.slotId);
      const raStmt = db.prepare('INSERT INTO room_allocations (id, slot_id, classroom_id) VALUES (?, ?, ?)');
      for (const cid of classroom_ids) raStmt.run(crypto.randomUUID(), req.params.slotId, cid);
    }

    if (Array.isArray(student_ids)) {
      db.prepare('DELETE FROM slot_students WHERE slot_id=?').run(req.params.slotId);
      const ssStmt = db.prepare('INSERT OR IGNORE INTO slot_students (slot_id, student_id) VALUES (?, ?)');
      for (const sid of student_ids) ssStmt.run(req.params.slotId, sid);
    }
  });
  updateSlot();
  res.json(db.prepare('SELECT * FROM exam_slots WHERE id=?').get(req.params.slotId));
}));

// DELETE slot
router.delete('/:cycleId/slots/:slotId', requireCoordinator, asyncHandler(async (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM exam_slots WHERE id=?').run(req.params.slotId);
  res.json({ success: true });
}));

// GET students assigned to a slot
router.get('/:cycleId/slots/:slotId/students', asyncHandler(async (req, res) => {
  const db = getDb();
  const students = db.prepare(`
    SELECT s.* FROM students s
    JOIN slot_students ss ON ss.student_id = s.id
    WHERE ss.slot_id = ?
    ORDER BY s.year, s.branch, s.roll_no
  `).all(req.params.slotId);
  res.json(students);
}));

export default router;
