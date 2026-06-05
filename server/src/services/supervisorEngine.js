/**
 * Supervisor Assignment Engine
 *
 * Rules:
 * 1. At least 1 supervisor per room (primary)
 * 2. Co-supervisor added if room has > CO_SUPERVISOR_THRESHOLD students
 * 3. Faculty cannot supervise a subject they personally teach
 * 4. Faculty cannot be in 2 rooms at the same time
 * 5. Workload distributed as evenly as possible
 */

const CO_SUPERVISOR_THRESHOLD = 30;

export function assignSupervisors(slots, allFaculty, existingDuties = []) {
  const duties = [];
  const conflicts = [];

  // Build workload tracker: facultyId -> count
  const workload = {};
  for (const f of allFaculty) workload[f.id] = 0;

  // Build existing assignment tracker for time-conflict detection
  // slotTimeKey: date_startTime
  const facultyTimeMap = {}; // facultyId -> Set of "date_startTime"
  for (const f of allFaculty) facultyTimeMap[f.id] = new Set();

  // Pre-fill with existing duties (from other slots already processed)
  for (const d of existingDuties) {
    if (facultyTimeMap[d.faculty_id]) {
      facultyTimeMap[d.faculty_id].add(d.time_key);
    }
    if (workload[d.faculty_id] !== undefined) workload[d.faculty_id]++;
  }

  for (const slot of slots) {
    const slotTimeKey = `${slot.date}_${slot.start_time}`;
    const subjectId = slot.subject_id;

    for (const room of slot.rooms) {
      const studentCount = room.seated_count || 0;
      const needCo = studentCount > CO_SUPERVISOR_THRESHOLD;

      // Get eligible faculty for this slot+subject
      const eligible = allFaculty.filter(f => {
        // Must not teach this subject
        const teachesSubject = f.subject_ids?.includes(subjectId);
        if (teachesSubject) return false;
        // Must not already be assigned at same time
        if (facultyTimeMap[f.id]?.has(slotTimeKey)) return false;
        return true;
      });

      if (eligible.length === 0) {
        conflicts.push({
          type: 'NO_SUPERVISOR_AVAILABLE',
          description: `No eligible supervisor found for Room ${room.room_no} on ${slot.date} at ${slot.start_time} (Subject: ${slot.subject_name}).`,
          suggested_resolution: 'Add more faculty or check subject teaching assignments.',
          slot_id: slot.id
        });
        continue;
      }

      // Sort by ascending workload for fair distribution
      eligible.sort((a, b) => (workload[a.id] || 0) - (workload[b.id] || 0));

      // Assign primary
      const primary = eligible[0];
      duties.push({ id: crypto.randomUUID(), faculty_id: primary.id, room_allocation_id: room.id, role: 'primary' });
      workload[primary.id]++;
      facultyTimeMap[primary.id].add(slotTimeKey);

      // Assign co-supervisor if needed
      if (needCo) {
        const remaining = eligible.filter(f => f.id !== primary.id);
        if (remaining.length === 0) {
          conflicts.push({
            type: 'NO_CO_SUPERVISOR_AVAILABLE',
            description: `Could not assign co-supervisor for Room ${room.room_no} on ${slot.date} (${studentCount} students).`,
            suggested_resolution: 'Add more faculty.',
            slot_id: slot.id
          });
        } else {
          remaining.sort((a, b) => (workload[a.id] || 0) - (workload[b.id] || 0));
          const co = remaining[0];
          duties.push({ id: crypto.randomUUID(), faculty_id: co.id, room_allocation_id: room.id, role: 'co' });
          workload[co.id]++;
          facultyTimeMap[co.id].add(slotTimeKey);
        }
      }
    }
  }

  return { duties, conflicts, workload };
}
