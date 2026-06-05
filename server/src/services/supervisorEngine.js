/**
 * Supervisor Assignment Engine v2
 *
 * Rules:
 * 1. At least 1 supervisor per room (primary)
 * 2. Co-supervisor added if room has > CO_SUPERVISOR_THRESHOLD students
 * 3. Faculty cannot supervise a subject they personally teach
 * 4. Faculty cannot be in 2 rooms at the same time
 * 5. Workload distributed GLOBALLY — caller passes in existing duty counts
 *    from the DB so the engine knows who has done the most across all slots.
 *    When workload is tied, candidates are shuffled randomly (no alphabetical bias).
 */

const CO_SUPERVISOR_THRESHOLD = 30;

/**
 * @param {Array}  slots          - Exam slots to assign, each with .rooms[]
 * @param {Array}  allFaculty     - All faculty with .subject_ids[]
 * @param {Object} globalWorkload - { facultyId: dutiesCount } from DB (can be empty {})
 * @param {Array}  existingDuties - Already-assigned duties for in-progress batch
 */
export function assignSupervisors(slots, allFaculty, globalWorkload = {}, existingDuties = []) {
  const duties    = [];
  const conflicts = [];

  // Clone the global workload so we don't mutate the caller's object
  const workload = {};
  for (const f of allFaculty) {
    workload[f.id] = globalWorkload[f.id] ?? 0;
  }

  // Time-conflict tracker: facultyId -> Set<"date_startTime">
  const facultyTimeMap = {};
  for (const f of allFaculty) facultyTimeMap[f.id] = new Set();

  // Pre-fill from already-processed duties in this batch
  for (const d of existingDuties) {
    if (facultyTimeMap[d.faculty_id]) facultyTimeMap[d.faculty_id].add(d.time_key);
    if (workload[d.faculty_id] !== undefined) workload[d.faculty_id]++;
  }

  for (const slot of slots) {
    const slotTimeKey = `${slot.date}_${slot.start_time}`;
    const subjectId   = slot.subject_id;

    for (const room of slot.rooms) {
      const studentCount = room.seated_count || 0;
      const needCo       = studentCount > CO_SUPERVISOR_THRESHOLD;

      // Eligible faculty for this room+slot
      const eligible = allFaculty.filter(f => {
        if (f.subject_ids?.includes(subjectId)) return false;          // teaches subject
        if (facultyTimeMap[f.id]?.has(slotTimeKey))  return false;     // already busy
        return true;
      });

      if (eligible.length === 0) {
        conflicts.push({
          type: 'NO_SUPERVISOR_AVAILABLE',
          description: `No eligible supervisor for Room ${room.room_no} on ${slot.date} at ${slot.start_time} — subject: ${slot.subject_name}.`,
          suggested_resolution: 'Add more faculty or review subject teaching assignments.',
          slot_id: slot.id,
        });
        continue;
      }

      // Sort by workload ASC, then shuffle within tied groups to eliminate bias
      const sorted = fairSort(eligible, workload);

      // Assign primary
      const primary = sorted[0];
      duties.push({ id: crypto.randomUUID(), faculty_id: primary.id, room_allocation_id: room.id, role: 'primary' });
      workload[primary.id]++;
      facultyTimeMap[primary.id].add(slotTimeKey);

      // Assign co-supervisor if needed
      if (needCo) {
        const remaining = sorted.filter(f => f.id !== primary.id);
        if (remaining.length === 0) {
          conflicts.push({
            type: 'NO_CO_SUPERVISOR_AVAILABLE',
            description: `Could not assign co-supervisor for Room ${room.room_no} on ${slot.date} (${studentCount} students).`,
            suggested_resolution: 'Add more faculty.',
            slot_id: slot.id,
          });
        } else {
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

/**
 * Sort faculty by ascending workload.
 * Within each tie-group, SHUFFLE randomly so the same person is never
 * deterministically chosen first (eliminates alphabetical/insertion-order bias).
 */
function fairSort(faculty, workload) {
  // Find minimum workload among eligible
  const minLoad = Math.min(...faculty.map(f => workload[f.id] ?? 0));
  const atMin   = faculty.filter(f => (workload[f.id] ?? 0) === minLoad);
  const rest    = faculty.filter(f => (workload[f.id] ?? 0) >  minLoad);

  // Shuffle the minimum-load group
  for (let i = atMin.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [atMin[i], atMin[j]] = [atMin[j], atMin[i]];
  }

  // Recurse on rest to apply same logic deeper
  return [...atMin, ...(rest.length > 1 ? fairSort(rest, workload) : rest)];
}
