import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate, requireCoordinator } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();
router.use(authenticate);

// GET dashboard summary for a cycle
router.get('/:cycleId', asyncHandler(async (req, res) => {
  const db = getDb();
  const cycleId = req.params.cycleId;

  const cycle = db.prepare('SELECT * FROM exam_cycles WHERE id=?').get(cycleId);
  if (!cycle) return res.status(404).json({ error: 'Cycle not found' });

  const totalSlots = db.prepare('SELECT COUNT(*) as cnt FROM exam_slots WHERE cycle_id=?').get(cycleId).cnt;
  const finalisedSlots = db.prepare("SELECT COUNT(*) as cnt FROM exam_slots WHERE cycle_id=? AND status='finalised'").get(cycleId).cnt;
  const totalStudents = db.prepare('SELECT COUNT(DISTINCT ss.student_id) as cnt FROM slot_students ss JOIN exam_slots es ON es.id=ss.slot_id WHERE es.cycle_id=?').get(cycleId).cnt;
  const seatedStudents = db.prepare('SELECT COUNT(DISTINCT sa.student_id) as cnt FROM seat_assignments sa JOIN room_allocations ra ON ra.id=sa.room_allocation_id JOIN exam_slots es ON es.id=ra.slot_id WHERE es.cycle_id=?').get(cycleId).cnt;

  const totalRooms = db.prepare('SELECT COUNT(*) as cnt FROM room_allocations ra JOIN exam_slots es ON es.id=ra.slot_id WHERE es.cycle_id=?').get(cycleId).cnt;
  const supervisedRooms = db.prepare('SELECT COUNT(DISTINCT sd.room_allocation_id) as cnt FROM supervisor_duties sd JOIN room_allocations ra ON ra.id=sd.room_allocation_id JOIN exam_slots es ON es.id=ra.slot_id WHERE es.cycle_id=?').get(cycleId).cnt;

  const openConflicts = db.prepare("SELECT COUNT(*) as cnt FROM conflicts WHERE cycle_id=? AND status='open'").get(cycleId).cnt;
  const totalFaculty = db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role='faculty' AND is_active=1").get().cnt;

  const unacknowledgedDuties = db.prepare('SELECT COUNT(*) as cnt FROM supervisor_duties sd JOIN room_allocations ra ON ra.id=sd.room_allocation_id JOIN exam_slots es ON es.id=ra.slot_id WHERE es.cycle_id=? AND sd.acknowledged=0').get(cycleId).cnt;

  const recentAudit = db.prepare(`
    SELECT al.*, u.name as user_name FROM audit_log al
    LEFT JOIN users u ON u.id = al.user_id
    ORDER BY al.created_at DESC LIMIT 10
  `).all();

  const upcomingSlots = db.prepare(`
    SELECT es.*, s.name as subject_name, s.code as subject_code
    FROM exam_slots es JOIN subjects s ON s.id=es.subject_id
    WHERE es.cycle_id=? AND es.date >= date('now')
    ORDER BY es.date, es.start_time LIMIT 5
  `).all(cycleId);

  res.json({
    cycle,
    stats: {
      totalSlots, finalisedSlots,
      totalStudents, seatedStudents,
      totalRooms, supervisedRooms,
      openConflicts, totalFaculty,
      unacknowledgedDuties
    },
    upcomingSlots,
    recentAudit
  });
}));

export default router;
