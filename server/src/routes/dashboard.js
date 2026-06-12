import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate, requireCoordinator } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();
router.use(authenticate, requireCoordinator);

// GET dashboard summary for a cycle
router.get('/:cycleId', asyncHandler(async (req, res) => {
  const db = getDb();
  const cycleId = req.params.cycleId;

  const cycle = await db.prepare('SELECT * FROM exam_cycles WHERE id=?').get(cycleId);
  if (!cycle) return res.status(404).json({ error: 'Cycle not found' });

  const statsRow = await db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM exam_slots WHERE cycle_id = ?) as total_slots,
      (SELECT COUNT(*) FROM exam_slots WHERE cycle_id = ? AND status = 'finalised') as finalised_slots,
      (SELECT COUNT(DISTINCT ss.student_id) FROM slot_students ss JOIN exam_slots es ON es.id = ss.slot_id WHERE es.cycle_id = ?) as total_students,
      (SELECT COUNT(DISTINCT sa.student_id) FROM seat_assignments sa JOIN room_allocations ra ON ra.id = sa.room_allocation_id JOIN exam_slots es ON es.id = ra.slot_id WHERE es.cycle_id = ?) as seated_students,
      (SELECT COUNT(*) FROM room_allocations ra JOIN exam_slots es ON es.id = ra.slot_id WHERE es.cycle_id = ?) as total_rooms,
      (SELECT COUNT(DISTINCT sd.room_allocation_id) FROM supervisor_duties sd JOIN room_allocations ra ON ra.id = sd.room_allocation_id JOIN exam_slots es ON es.id = ra.slot_id WHERE es.cycle_id = ?) as supervised_rooms,
      (SELECT COUNT(*) FROM conflicts WHERE cycle_id = ? AND status = 'open') as open_conflicts,
      (SELECT COUNT(*) FROM users WHERE role = 'faculty' AND is_active = 1) as total_faculty,
      (SELECT COUNT(*) FROM supervisor_duties sd JOIN room_allocations ra ON ra.id = sd.room_allocation_id JOIN exam_slots es ON es.id = ra.slot_id WHERE es.cycle_id = ? AND sd.acknowledged = 0) as unacknowledged_duties
  `).get(cycleId, cycleId, cycleId, cycleId, cycleId, cycleId, cycleId, cycleId);

  const totalSlots = parseInt(statsRow?.total_slots || 0);
  const finalisedSlots = parseInt(statsRow?.finalised_slots || 0);
  const totalStudents = parseInt(statsRow?.total_students || 0);
  const seatedStudents = parseInt(statsRow?.seated_students || 0);
  const totalRooms = parseInt(statsRow?.total_rooms || 0);
  const supervisedRooms = parseInt(statsRow?.supervised_rooms || 0);
  const openConflicts = parseInt(statsRow?.open_conflicts || 0);
  const totalFaculty = parseInt(statsRow?.total_faculty || 0);
  const unacknowledgedDuties = parseInt(statsRow?.unacknowledged_duties || 0);

  const recentAudit = await db.prepare(`
    SELECT al.*, u.name as user_name FROM audit_log al
    LEFT JOIN users u ON u.id = al.user_id
    ORDER BY al.created_at DESC LIMIT 10
  `).all();

  const upcomingSlots = await db.prepare(`
    SELECT es.*, s.name as subject_name, s.code as subject_code
    FROM exam_slots es JOIN subjects s ON s.id=es.subject_id
    WHERE es.cycle_id=? AND es.date >= CAST(CURRENT_DATE AS TEXT)
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
