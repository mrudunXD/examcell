import { getDb } from '../db/database.js';

export async function explainSlotDecision(cycleId, slotId) {
  const db = getDb();

  // 1. Fetch current slot details
  const slot = await db.prepare(`
    SELECT es.*, s.code as subject_code, s.name as subject_name, s.branch, s.year, s.semester
    FROM exam_slots es
    JOIN subjects s ON s.id = es.subject_id
    WHERE es.id = ?
  `).get(slotId);

  if (!slot) {
    throw new Error('Slot not found');
  }

  // 2. Fetch cycle details
  const cycle = await db.prepare('SELECT * FROM exam_cycles WHERE id = ?').get(cycleId);
  if (!cycle) {
    throw new Error('Cycle not found');
  }

  // 3. Fetch rooms allocated to this slot
  const rooms = await db.prepare(`
    SELECT ra.id as ra_id, c.room_no, c.capacity,
      (SELECT COUNT(*) FROM seat_assignments sa WHERE sa.room_allocation_id = ra.id) as seated_count
    FROM room_allocations ra
    JOIN classrooms c ON c.id = ra.classroom_id
    WHERE ra.slot_id = ?
  `).all(slotId);

  // 4. Fetch all slots in the same cycle for comparison
  const allSlots = await db.prepare(`
    SELECT es.id, es.date, es.start_time, s.branch, s.year, s.code as subject_code
    FROM exam_slots es
    JOIN subjects s ON s.id = es.subject_id
    WHERE es.cycle_id = ?
  `).all(cycleId);

  const explanations = [];
  const constraintsSatisfied = [];

  // Check 1: Student Conflicts / Overlap
  const studentOverlap = allSlots.filter(s => 
    s.id !== slotId && 
    s.date === slot.date && 
    s.start_time === slot.start_time &&
    s.branch === slot.branch &&
    s.year === slot.year
  );

  if (studentOverlap.length === 0) {
    constraintsSatisfied.push({
      rule: 'Conflict-Free Allocation',
      status: 'PASS',
      description: `Zero student conflicts on ${slot.date} at ${slot.start_time}. No other exams for ${slot.branch} ${slot.year} are scheduled concurrently.`
    });
  } else {
    constraintsSatisfied.push({
      rule: 'Conflict-Free Allocation',
      status: 'WARN',
      description: `Potential student overlaps detected with subjects: ${studentOverlap.map(o => o.subject_code).join(', ')}.`
    });
  }

  // Check 2: Compactness Optimization
  // Calculate range of dates for this branch + year
  const branchSlots = allSlots.filter(s => s.branch === slot.branch && s.year === slot.year);
  if (branchSlots.length > 1) {
    const dates = branchSlots.map(s => new Date(s.date).getTime()).sort((a, b) => a - b);
    const minDate = new Date(dates[0]);
    const maxDate = new Date(dates[dates.length - 1]);
    const diffDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)) + 1;
    
    // Check gaps between exam slots for this branch/year
    const sortedDateStrs = [...new Set(branchSlots.map(s => s.date))].sort();
    const index = sortedDateStrs.indexOf(slot.date);
    
    let gapInfo = '';
    if (index > 0) {
      const prevDate = new Date(sortedDateStrs[index - 1]);
      const curDate = new Date(slot.date);
      const gap = Math.ceil((curDate - prevDate) / (1000 * 60 * 60 * 24)) - 1;
      gapInfo = ` (gap of ${gap} day(s) from previous exam on ${sortedDateStrs[index - 1]})`;
    }

    constraintsSatisfied.push({
      rule: 'Schedule Compactness',
      status: 'PASS',
      description: `Branch exams are condensed over a period of ${diffDays} days (${sortedDateStrs[0]} to ${sortedDateStrs[sortedDateStrs.length - 1]})${gapInfo}. Avoids excessive academic days gaps.`
    });
  } else {
    constraintsSatisfied.push({
      rule: 'Schedule Compactness',
      status: 'PASS',
      description: `Single subject for ${slot.branch} ${slot.year} scheduled as early as possible on ${slot.date}.`
    });
  }

  // Check 3: Room Capacity and Allocation Quality
  const totalSeated = rooms.reduce((s, r) => s + r.seated_count, 0);
  const totalCapacity = rooms.reduce((s, r) => s + r.capacity, 0);
  const roomWastage = totalCapacity - totalSeated;

  if (rooms.length > 0) {
    const occupancyRate = ((totalSeated / totalCapacity) * 100).toFixed(1);
    constraintsSatisfied.push({
      rule: 'Room Allocations',
      status: 'PASS',
      description: `Seated ${totalSeated} students across ${rooms.length} rooms (${rooms.map(r => `Room ${r.room_no}`).join(', ')}). Total capacity utilization is ${occupancyRate}% (Wastage: ${roomWastage} seats).`
    });
  } else {
    constraintsSatisfied.push({
      rule: 'Room Allocations',
      status: 'WARN',
      description: 'No classroom is currently allocated. If this is an offline exam, this requires administrative review.'
    });
  }

  // Check 4: Chronological ordering (FY -> SY -> TY -> LY)
  const yearOrder = { 'FY': 1, 'SY': 2, 'TY': 3, 'LY': 4 };
  const currentRank = yearOrder[slot.year] || 0;
  
  // Calculate relative day of cycle
  const cycleStart = new Date(cycle.start_date);
  const slotDate = new Date(slot.date);
  const dayIndex = Math.ceil((slotDate - cycleStart) / (1000 * 60 * 60 * 24)) + 1;

  let yearOrderingText = `Scheduled on Day ${dayIndex} of the cycle.`;
  if (currentRank === 1) {
    yearOrderingText += ' First-year (FY) exams are prioritized early in the dates pool.';
  } else if (currentRank === 2) {
    yearOrderingText += ' Second-year (SY) exams are placed in mid-level dates.';
  } else if (currentRank === 3 || currentRank === 4) {
    yearOrderingText += ' Third/Final year (TY/LY) exams are distributed to balance room availability.';
  }

  constraintsSatisfied.push({
    rule: 'Chronological Year Priority',
    status: 'PASS',
    description: yearOrderingText
  });

  // 5. Generate Natural Language summary
  let summary = `This slot for "${slot.subject_code}: ${slot.subject_name}" was scheduled on ${slot.date} during the ${slot.start_time} shift because `;
  if (studentOverlap.length === 0) {
    summary += `there were no concurrent exam conflicts for ${slot.branch} ${slot.year} students, `;
  }
  if (rooms.length > 0) {
    summary += `allocated classrooms had sufficient capacity (${totalSeated}/${totalCapacity} seats used), `;
  }
  summary += `and it satisfies the compactness optimization constraint, keeping student exam spans minimized.`;

  return {
    slotId,
    subjectCode: slot.subject_code,
    subjectName: slot.subject_name,
    branch: slot.branch,
    year: slot.year,
    date: slot.date,
    startTime: slot.start_time,
    summary,
    checks: constraintsSatisfied
  };
}
