/**
 * MIT WPU Seating Engine
 *
 * Rules:
 * 1. Single branch/year in slot → 1 student per bench, ordered by roll_no
 * 2. Multiple branches in slot → 2 students per bench, each from a different branch
 *    - Students are interleaved using round-robin across branch groups
 *    - Within each branch group, students ordered by roll_no
 * 3. Rooms filled sequentially (fill one room before starting next)
 * 4. Bench positions: row (1-indexed), col (1-indexed)
 *    - bench_cols = number of "seats" per row
 *    - With multi-branch: treat each bench as 2 cols (left/right seat)
 *    - With single-branch: one student per bench position
 */

export function generateSeating(students, rooms) {
  const conflicts = [];
  const assignments = [];

  if (!students.length) return { assignments, conflicts: [{ type: 'NO_STUDENTS', description: 'No students assigned to this slot.' }] };
  if (!rooms.length) return { assignments, conflicts: [{ type: 'NO_ROOMS', description: 'No rooms allocated for this slot.' }] };

  // Group students by branch+year, sort within group by roll_no
  const groups = groupByBranchYear(students);
  const groupKeys = Object.keys(groups).sort();

  const isMultiBranch = groupKeys.length > 1;

  // Create interleaved student sequence
  let orderedStudents;
  if (isMultiBranch) {
    orderedStudents = interleaveBranches(groups, groupKeys);
  } else {
    // Single branch: sort by roll_no
    orderedStudents = [...students].sort((a, b) => naturalSort(a.roll_no, b.roll_no));
  }

  let studentIdx       = 0;
  const totalStudents  = orderedStudents.length;

  // ── Determine if rooms have "similar" capacity (within 20% of each other)
  //    If so, distribute students proportionally rather than sequentially.
  const maxCap = Math.max(...rooms.map(r => r.capacity));
  const minCap = Math.min(...rooms.map(r => r.capacity));
  const similarCapacity = rooms.length > 1 && (minCap / maxCap) >= 0.80;

  // Calculate how many students each room should receive
  let roomQuotas;
  if (similarCapacity) {
    const totalCap = rooms.reduce((s, r) => s + r.capacity, 0);
    let remaining  = orderedStudents.length;
    roomQuotas     = rooms.map((r, i) => {
      if (i === rooms.length - 1) return remaining; // last room gets the rest
      const share = Math.round((r.capacity / totalCap) * orderedStudents.length);
      remaining  -= share;
      return Math.min(share, r.capacity);
    });
  } else {
    // Sequential fill: each room gets as many as it can hold
    roomQuotas = rooms.map(r => r.capacity);
  }

  for (let ri = 0; ri < rooms.length; ri++) {
    if (studentIdx >= totalStudents) break;
    const room     = rooms[ri];
    const quota    = roomQuotas[ri];
    const { id: roomAllocId, bench_rows, bench_cols, capacity } = room;
    const roomAssignments = [];

    const roomStudents = orderedStudents.slice(studentIdx, studentIdx + quota);
    let   localIdx     = 0;

    if (isMultiBranch) {
      const benchesPerRow = Math.max(1, Math.floor(bench_cols / 2)) || bench_cols;
      const actualBenches = Math.floor(capacity / 2);

      for (let bench = 0; bench < actualBenches && localIdx < roomStudents.length; bench++) {
        const row        = Math.floor(bench / benchesPerRow) + 1;
        const benchInRow = (bench % benchesPerRow) + 1;

        // Left seat
        if (localIdx < roomStudents.length) {
          const leftCol = benchInRow * 2 - 1;
          if (leftCol <= bench_cols) {
            roomAssignments.push({ student_id: roomStudents[localIdx].id, room_allocation_id: roomAllocId, bench_row: row, bench_col: leftCol });
            localIdx++;
          }
        }

        // Right seat — must be different branch
        if (localIdx < roomStudents.length) {
          const rightCol = benchInRow * 2;
          if (rightCol <= bench_cols) {
            const leftS  = roomStudents[localIdx - 1];
            const rightS = roomStudents[localIdx];
            if (leftS.branch === rightS.branch && leftS.year === rightS.year) {
              conflicts.push({
                type: 'BRANCH_MIXING_FAILED',
                description: `Could not mix branches at Room ${room.room_no}, Row ${row}, Bench ${benchInRow} — numerical imbalance between branch groups.`,
                affected_entities: `${leftS.name} (${leftS.branch} ${leftS.year}) & ${rightS.name} (${rightS.branch} ${rightS.year})`,
              });
            }
            roomAssignments.push({ student_id: rightS.id, room_allocation_id: roomAllocId, bench_row: row, bench_col: rightCol });
            localIdx++;
          }
        }
      }
    } else {
      // Single branch: 1 student per bench position
      outer: for (let row = 1; row <= bench_rows; row++) {
        for (let col = 1; col <= bench_cols && localIdx < roomStudents.length; col++) {
          roomAssignments.push({ student_id: roomStudents[localIdx].id, room_allocation_id: roomAllocId, bench_row: row, bench_col: col });
          localIdx++;
        }
        if (localIdx >= roomStudents.length) break outer;
      }
    }

    studentIdx += localIdx;

    // Capacity overflow check
    if (roomAssignments.length > capacity) {
      conflicts.push({
        type: 'CAPACITY_OVERFLOW',
        description: `Room ${room.room_no} has ${roomAssignments.length} students but capacity is ${capacity}.`,
        suggested_resolution: 'Add another room or reduce students in this slot.',
      });
    }

    assignments.push(...roomAssignments);
  }

  // Students left unassigned
  if (studentIdx < totalStudents) {
    const unassigned = totalStudents - studentIdx;
    conflicts.push({
      type: 'INSUFFICIENT_ROOM_CAPACITY',
      description: `${unassigned} student(s) could not be seated — rooms are full.`,
      suggested_resolution: 'Allocate additional rooms to this exam slot.',
    });
  }

  return { assignments, conflicts };
}

function groupByBranchYear(students) {
  const groups = {};
  for (const s of students) {
    const key = `${s.year}_${s.branch}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(s);
  }
  // Sort within each group by roll_no
  for (const key of Object.keys(groups)) {
    groups[key].sort((a, b) => naturalSort(a.roll_no, b.roll_no));
  }
  return groups;
}

function interleaveBranches(groups, keys) {
  // Round-robin interleave: take one from each group in turn
  const queues = keys.map(k => [...groups[k]]);
  const result = [];
  let hasMore = true;
  while (hasMore) {
    hasMore = false;
    for (const q of queues) {
      if (q.length) {
        result.push(q.shift());
        hasMore = true;
      }
    }
  }
  return result;
}

function naturalSort(a, b) {
  // Natural sort for roll numbers like "23BCE001", "23BCE002", etc.
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}
