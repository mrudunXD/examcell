import { Router } from 'express';
import { getDb } from '../db/database.js';
import { authenticate, requireCoordinator } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();
router.use(authenticate, requireCoordinator);

// GET faculty duty heatmap: faculty x cycles matrix
router.get('/heatmap', asyncHandler(async (req, res) => {
  const db = getDb();

  const faculty = await db.prepare(`
    SELECT id, name, department FROM users WHERE role='faculty' AND is_active=1 ORDER BY name
  `).all();

  const cycles = await db.prepare(`
    SELECT id, name, start_date, status FROM exam_cycles ORDER BY start_date DESC LIMIT 10
  `).all();

  // Duty counts per faculty per cycle
  const duties = await db.prepare(`
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
  const totals = await db.prepare(`
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
  const loads = await db.prepare(`
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

  const cycle = await db.prepare('SELECT * FROM exam_cycles WHERE id=?').get(req.params.cycleId);
  if (!cycle) return res.status(404).json({ error: 'Cycle not found' });

  // Today's slots
  const todaySlots = await db.prepare(`
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
  const upcomingSlots = await db.prepare(`
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
  const openIncidents = await db.prepare(`
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

// GET /api/analytics/historical — Aggregated historical trends and optimization metrics
router.get('/historical', asyncHandler(async (req, res) => {
  const db = getDb();
  
  // Get all cycles
  const cycles = await db.prepare(`
    SELECT id, name, status, start_date, end_date 
    FROM exam_cycles 
    ORDER BY start_date DESC
  `).all();

  const cycleMetrics = [];
  
  for (const cycle of cycles) {
    // 1. Slots count
    const slotsRow = await db.prepare('SELECT COUNT(*) as cnt FROM exam_slots WHERE cycle_id = ?').get(cycle.id);
    const totalSlots = parseInt(slotsRow?.cnt || 0);

    // 2. Seated students count
    const seatedRow = await db.prepare(`
      SELECT COUNT(sa.id) as cnt 
      FROM seat_assignments sa 
      JOIN room_allocations ra ON sa.room_allocation_id = ra.id 
      JOIN exam_slots es ON ra.slot_id = es.id 
      WHERE es.cycle_id = ?
    `).get(cycle.id);
    const totalSeated = parseInt(seatedRow?.cnt || 0);

    // 3. Classrooms count
    const roomsRow = await db.prepare(`
      SELECT COUNT(DISTINCT classroom_id) as cnt 
      FROM room_allocations ra 
      JOIN exam_slots es ON ra.slot_id = es.id 
      WHERE es.cycle_id = ?
    `).get(cycle.id);
    const totalRooms = parseInt(roomsRow?.cnt || 0);

    // 4. Conflicts count
    const conflictsRow = await db.prepare('SELECT COUNT(*) as cnt FROM conflicts WHERE cycle_id = ?').get(cycle.id);
    const totalConflicts = parseInt(conflictsRow?.cnt || 0);

    // 5. Incidents count
    const incidentsRow = await db.prepare(`
      SELECT COUNT(i.id) as cnt 
      FROM incidents i 
      JOIN exam_slots es ON i.slot_id = es.id 
      WHERE es.cycle_id = ?
    `).get(cycle.id);
    const totalIncidents = parseInt(incidentsRow?.cnt || 0);

    // 6. Solver telemetry metrics
    const telemetryRow = await db.prepare(`
      SELECT 
        AVG(solve_duration_ms) as avg_duration, 
        AVG(constraints_count) as avg_constraints, 
        AVG(optimization_score) as avg_score, 
        COUNT(*) as runs_count 
      FROM solver_telemetry 
      WHERE cycle_id = ? AND status = 'SUCCESS'
    `).get(cycle.id);

    // 7. Duties metrics
    const dutiesRows = await db.prepare(`
      SELECT sd.faculty_id, COUNT(*) as duty_count 
      FROM supervisor_duties sd 
      JOIN room_allocations ra ON sd.room_allocation_id = ra.id 
      JOIN exam_slots es ON ra.slot_id = es.id 
      WHERE es.cycle_id = ?
      GROUP BY sd.faculty_id
    `).all(cycle.id);

    const totalDuties = dutiesRows.reduce((sum, row) => sum + parseInt(row.duty_count), 0);
    const assignedFacultyCount = dutiesRows.length;
    
    let avgDuties = 0;
    let maxDuties = 0;
    let minDuties = 0;
    if (assignedFacultyCount > 0) {
      const counts = dutiesRows.map(r => parseInt(r.duty_count));
      avgDuties = Math.round((totalDuties / assignedFacultyCount) * 10) / 10;
      maxDuties = Math.max(...counts);
      minDuties = Math.min(...counts);
    }

    cycleMetrics.push({
      id: cycle.id,
      name: cycle.name,
      status: cycle.status,
      startDate: cycle.start_date,
      endDate: cycle.end_date,
      totalSlots,
      totalSeated,
      totalRooms,
      totalConflicts,
      totalIncidents,
      solverRuns: parseInt(telemetryRow?.runs_count || 0),
      avgSolveDurationMs: Math.round(parseFloat(telemetryRow?.avg_duration || 0)),
      avgConstraints: Math.round(parseFloat(telemetryRow?.avg_constraints || 0)),
      avgOptimizationScore: Math.round(parseFloat(telemetryRow?.avg_score || 0)),
      totalDuties,
      assignedFacultyCount,
      avgDuties,
      maxDuties,
      minDuties
    });
  }

  // Overall system telemetry summary
  const allTimeTelemetry = await db.prepare(`
    SELECT 
      COUNT(*) as total_runs,
      SUM(CASE WHEN status = 'SUCCESS' THEN 1 ELSE 0 END) as success_runs,
      SUM(CASE WHEN status = 'FAIL' THEN 1 ELSE 0 END) as fail_runs,
      AVG(solve_duration_ms) as avg_duration
    FROM solver_telemetry
  `).get();

  const allTimeIncidents = await db.prepare('SELECT COUNT(*) as cnt FROM incidents').get();

  res.json({
    cycles: cycleMetrics,
    overall: {
      totalRuns: parseInt(allTimeTelemetry?.total_runs || 0),
      successRuns: parseInt(allTimeTelemetry?.success_runs || 0),
      failRuns: parseInt(allTimeTelemetry?.fail_runs || 0),
      avgDuration: Math.round(parseFloat(allTimeTelemetry?.avg_duration || 0)),
      totalIncidents: parseInt(allTimeIncidents?.cnt || 0)
    }
  });
}));

export default router;
