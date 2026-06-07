import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate, requireCoordinator } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();
router.use(authenticate, requireCoordinator);

// GET faculty duty heatmap: faculty x cycles matrix
router.get('/heatmap', asyncHandler(async (req, res) => {
  const db = getDb();

  const faculty = db.prepare(`
    SELECT id, name, department FROM users WHERE role='faculty' AND is_active=1 ORDER BY name
  `).all();

  const cycles = db.prepare(`
    SELECT id, name, start_date, status FROM exam_cycles ORDER BY start_date DESC LIMIT 10
  `).all();

  // Duty counts per faculty per cycle
  const duties = db.prepare(`
    SELECT sd.faculty_id, es.cycle_id, COUNT(*) as duty_count
    FROM supervisor_duties sd
    JOIN room_allocations ra ON ra.id = sd.room_allocation_id
    JOIN exam_slots es ON es.id = ra.slot_id
    GROUP BY sd.faculty_id, es.cycle_id
  `).all();

  // Build matrix
  const matrix = {};
  for (const d of duties) {
    if (!matrix[d.faculty_id]) matrix[d.faculty_id] = {};
    matrix[d.faculty_id][d.cycle_id] = d.duty_count;
  }

  // Total per faculty
  const totals = db.prepare(`
    SELECT sd.faculty_id, COUNT(*) as total
    FROM supervisor_duties sd
    GROUP BY sd.faculty_id
  `).all();
  const totalMap = {};
  for (const t of totals) totalMap[t.faculty_id] = t.total;

  res.json({ faculty, cycles, matrix, totals: totalMap });
}));

// GET faculty load for a specific cycle
router.get('/load/:cycleId', asyncHandler(async (req, res) => {
  const db = getDb();
  const loads = db.prepare(`
    SELECT u.id, u.name, u.department,
      COUNT(DISTINCT sd.id) as duty_count,
      COUNT(DISTINCT es.date) as exam_days,
      GROUP_CONCAT(DISTINCT es.date || ' ' || c.room_no) as assignments
    FROM users u
    LEFT JOIN supervisor_duties sd ON sd.faculty_id = u.id
    LEFT JOIN room_allocations ra ON ra.id = sd.room_allocation_id
    LEFT JOIN exam_slots es ON es.id = ra.slot_id AND es.cycle_id = ?
    LEFT JOIN classrooms c ON c.id = ra.classroom_id
    WHERE u.role = 'faculty' AND u.is_active = 1
    GROUP BY u.id
    ORDER BY duty_count DESC
  `).all(req.params.cycleId);

  const avg = loads.length ? loads.reduce((s, l) => s + l.duty_count, 0) / loads.length : 0;
  res.json({ loads, avg: Math.round(avg * 10) / 10 });
}));

// GET live exam dashboard for a cycle
router.get('/live/:cycleId', asyncHandler(async (req, res) => {
  const db = getDb();
  const todayDate = new Date();
  const today = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;
  const now = new Date().toTimeString().slice(0, 5); // HH:MM

  const cycle = db.prepare('SELECT * FROM exam_cycles WHERE id=?').get(req.params.cycleId);
  if (!cycle) return res.status(404).json({ error: 'Cycle not found' });

  // Today's slots
  const todaySlots = db.prepare(`
    SELECT es.*, s.name as subject_name, s.code as subject_code,
      s.branch, s.year, s.semester,
      COUNT(DISTINCT sa.id) as seated_count,
      COUNT(DISTINCT a_present.id) as present_count,
      COUNT(DISTINCT a_absent.id) as absent_count,
      COUNT(DISTINCT sd.id) as supervisor_count,
      COUNT(DISTINCT sd_ack.id) as ack_count
    FROM exam_slots es
    JOIN subjects s ON s.id = es.subject_id
    LEFT JOIN room_allocations ra ON ra.slot_id = es.id
    LEFT JOIN seat_assignments sa ON sa.room_allocation_id = ra.id
    LEFT JOIN attendance a_present ON a_present.slot_id = es.id AND a_present.status = 'present'
    LEFT JOIN attendance a_absent ON a_absent.slot_id = es.id AND a_absent.status = 'absent'
    LEFT JOIN supervisor_duties sd ON sd.room_allocation_id = ra.id
    LEFT JOIN supervisor_duties sd_ack ON sd_ack.room_allocation_id = ra.id AND sd_ack.acknowledged = 1
    WHERE es.cycle_id = ? AND es.date = ?
    GROUP BY es.id
    ORDER BY es.start_time
  `).all(req.params.cycleId, today);

  // Upcoming slots (next 3 days)
  const upcomingSlots = db.prepare(`
    SELECT es.date, COUNT(*) as slot_count,
      GROUP_CONCAT(DISTINCT s.code) as subjects
    FROM exam_slots es
    JOIN subjects s ON s.id = es.subject_id
    WHERE es.cycle_id = ? AND es.date > ?
    GROUP BY es.date
    ORDER BY es.date
    LIMIT 3
  `).all(req.params.cycleId, today);

  // Open incidents today
  const openIncidents = db.prepare(`
    SELECT i.*, u.name as reported_by_name, c.room_no
    FROM incidents i
    LEFT JOIN users u ON u.id = i.reported_by
    LEFT JOIN room_allocations ra ON ra.id = i.room_allocation_id
    LEFT JOIN classrooms c ON c.id = ra.classroom_id
    LEFT JOIN exam_slots es ON es.id = i.slot_id
    WHERE es.cycle_id = ? AND es.date = ? AND i.status = 'open'
    ORDER BY i.created_at DESC
  `).all(req.params.cycleId, today);

  res.json({ cycle, today, now, todaySlots, upcomingSlots, openIncidents });
}));

export default router;
