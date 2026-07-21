/**
 * Supervisor Assignment Engine v3
 *
 * Rules:
 * 1. At least 1 supervisor per room (primary)
 * 2. Co-supervisor added if room has > coSupervisorThreshold students
 * 3. Standby supervisors assigned to the slot (role = 'standby')
 * 4. Faculty cannot supervise a subject they personally teach
 * 5. Faculty cannot be in 2 rooms at the same time
 * 6. Min gap days between consecutive duties enforced
 * 7. Max duties per cycle constraint enforced
 * 8. Workload distributed GLOBALLY — caller passes in existing duty counts.
 */

import crypto from 'crypto';

export function assignSupervisors(slots, allFaculty, globalWorkload = {}, existingDuties = [], config = {}) {
  const duties = [];
  const conflicts = [];

  const coSupervisorThreshold = config.coSupervisorThreshold ?? 30;
  const minGapDays = config.minGapDays ?? 0;
  const maxDuties = config.maxDuties ?? 999;
  const reliefCount = config.reliefCount ?? 0;

  // Clone global workload
  const workload = {};
  for (const f of allFaculty) {
    workload[f.id] = Number(globalWorkload[f.id] ?? 0);
  }

  // Time-conflict tracker: facultyId -> Set<"date_startTime">
  // Date-conflict tracker: facultyId -> Set<"YYYY-MM-DD">
  const facultyTimeMap = {};
  const facultyDateMap = {};
  
  for (const f of allFaculty) {
    facultyTimeMap[f.id] = new Set();
    facultyDateMap[f.id] = new Set();
  }

  // Pre-fill from already-processed duties in this batch
  for (const d of existingDuties) {
    if (facultyTimeMap[d.faculty_id]) facultyTimeMap[d.faculty_id].add(d.time_key);
    if (facultyDateMap[d.faculty_id] && d.date) facultyDateMap[d.faculty_id].add(d.date);
    if (workload[d.faculty_id] !== undefined) workload[d.faculty_id]++;
  }

  // Check gap conflict helper
  const hasGapConflict = (facultyId, targetDateStr) => {
    if (minGapDays <= 0) return false;
    const targetDate = new Date(targetDateStr + 'T00:00:00');
    for (const dStr of facultyDateMap[facultyId]) {
      const existingDate = new Date(dStr + 'T00:00:00');
      const diffTime = Math.abs(targetDate - existingDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays <= minGapDays) return true;
    }
    return false;
  };

  for (const slot of slots) {
    const slotTimeKey = `${slot.date}_${slot.start_time}`;
    const subjectId = slot.subject_id;
    const slotDate = slot.date;

    const assignedInSlot = new Set();

    // 1. Assign room supervisors
    for (const room of slot.rooms) {
      const studentCount = room.seated_count || 0;
      const needCo = studentCount > coSupervisorThreshold;

      // Filter eligible for Primary
      let eligible = allFaculty.filter(f => {
        if (f.subject_ids?.includes(subjectId)) return false; // teaches subject
        if (facultyTimeMap[f.id]?.has(slotTimeKey)) return false; // busy in slot
        if (workload[f.id] >= maxDuties) return false; // max workload reached
        if (hasGapConflict(f.id, slotDate)) return false; // gap days conflict
        return true;
      });

      if (eligible.length === 0) {
        // Fallback: relax gap conflict first
        eligible = allFaculty.filter(f => {
          if (f.subject_ids?.includes(subjectId)) return false;
          if (facultyTimeMap[f.id]?.has(slotTimeKey)) return false;
          if (workload[f.id] >= maxDuties) return false;
          return true;
        });
      }

      if (eligible.length === 0) {
        conflicts.push({
          type: 'NO_SUPERVISOR_AVAILABLE',
          description: `No eligible supervisor for Room ${room.room_no} on ${slot.date} at ${slot.start_time} — subject: ${slot.subject_name}.`,
          suggested_resolution: 'Add more faculty or relax constraints.',
          slot_id: slot.id,
        });
        continue;
      }

      const sorted = fairSort(eligible, workload);
      const primary = sorted[0];
      
      duties.push({
        id: crypto.randomUUID(),
        faculty_id: primary.id,
        room_allocation_id: room.id,
        slot_id: slot.id,
        role: 'primary'
      });
      workload[primary.id]++;
      facultyTimeMap[primary.id].add(slotTimeKey);
      facultyDateMap[primary.id].add(slotDate);
      assignedInSlot.add(primary.id);

      // Assign co-supervisor if needed
      if (needCo) {
        let remaining = sorted.filter(f => f.id !== primary.id);
        if (remaining.length === 0) {
          // If no remaining in sorted (meaning we ran out of strictly eligible),
          // search without gap constraint
          remaining = allFaculty.filter(f => {
            if (f.id === primary.id) return false;
            if (f.subject_ids?.includes(subjectId)) return false;
            if (facultyTimeMap[f.id]?.has(slotTimeKey)) return false;
            if (workload[f.id] >= maxDuties) return false;
            return true;
          });
        }

        if (remaining.length === 0) {
          conflicts.push({
            type: 'NO_CO_SUPERVISOR_AVAILABLE',
            description: `Could not assign co-supervisor for Room ${room.room_no} on ${slot.date} (${studentCount} students).`,
            suggested_resolution: 'Add more faculty or relax co-supervisor threshold.',
            slot_id: slot.id,
          });
        } else {
          const coSorted = fairSort(remaining, workload);
          const co = coSorted[0];
          duties.push({
            id: crypto.randomUUID(),
            faculty_id: co.id,
            room_allocation_id: room.id,
            slot_id: slot.id,
            role: 'co'
          });
          workload[co.id]++;
          facultyTimeMap[co.id].add(slotTimeKey);
          facultyDateMap[co.id].add(slotDate);
          assignedInSlot.add(co.id);
        }
      }
    }

    // 2. Assign standby supervisors for the slot
    for (let r = 0; r < reliefCount; r++) {
      const eligibleStandby = allFaculty.filter(f => {
        if (assignedInSlot.has(f.id)) return false;
        if (f.subject_ids?.includes(subjectId)) return false;
        if (facultyTimeMap[f.id]?.has(slotTimeKey)) return false;
        if (workload[f.id] >= maxDuties) return false;
        if (hasGapConflict(f.id, slotDate)) return false;
        return true;
      });

      if (eligibleStandby.length > 0) {
        const standbySorted = fairSort(eligibleStandby, workload);
        const standby = standbySorted[0];
        duties.push({
          id: crypto.randomUUID(),
          faculty_id: standby.id,
          room_allocation_id: null,
          slot_id: slot.id,
          role: 'standby'
        });
        workload[standby.id]++;
        facultyTimeMap[standby.id].add(slotTimeKey);
        facultyDateMap[standby.id].add(slotDate);
        assignedInSlot.add(standby.id);
      } else {
        conflicts.push({
          type: 'NO_STANDBY_AVAILABLE',
          description: `Could not assign standby supervisor #${r+1} on ${slot.date} at ${slot.start_time}.`,
          suggested_resolution: 'Add more faculty or reduce requested standby count.',
          slot_id: slot.id,
        });
      }
    }
  }

  return { duties, conflicts, workload };
}

function fairSort(faculty, workload) {
  if (faculty.length === 0) return [];
  const minLoad = Math.min(...faculty.map(f => workload[f.id] ?? 0));
  const atMin   = faculty.filter(f => (workload[f.id] ?? 0) === minLoad);
  const rest    = faculty.filter(f => (workload[f.id] ?? 0) >  minLoad);

  for (let i = atMin.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [atMin[i], atMin[j]] = [atMin[j], atMin[i]];
  }

  return [...atMin, ...(rest.length > 1 ? fairSort(rest, workload) : rest)];
}
