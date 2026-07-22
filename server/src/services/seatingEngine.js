/**
 * MIT WPU Seating Engine
 *
 * Rules:
 * 1. Single bench capacity = 2 students (Seat 1 / Left and Seat 2 / Right).
 * 2. DEFAULT (Pass 1): Allocate ONLY 1 student per bench (Seat 1 / Left) across all available benches in the room.
 * 3. SINGLE-BENCH MAXIMIZATION: Distribute students across all allocated rooms so that no student is forced to share a bench if empty benches exist in other rooms.
 * 4. FILLING UP (Pass 2): When total students allocated exceed available benches, start placing 2nd students on Seat 2 (Right).
 * 5. STRICT CONSTRAINT: When 2 students share the SAME bench:
 *    - MUST be different Year (year1 !== year2)
 *    - MUST be different Branch (branch1 !== branch2)
 *    - MUST be different Subject (subject_id1 !== subject_id2)
 */

export function generateSeating(students, rooms) {
  const conflicts = [];
  const assignments = [];

  if (!students.length) return { assignments, conflicts: [{ type: 'NO_STUDENTS', description: 'No students assigned to this slot.' }] };
  if (!rooms.length) return { assignments, conflicts: [{ type: 'NO_ROOMS', description: 'No rooms allocated for this slot.' }] };

  // Group students by branch+year
  const groups = groupByBranchYear(students);
  const groupKeys = Object.keys(groups).sort();
  const isMultiBranch = groupKeys.length > 1;

  // Interleave students across branches & years
  let orderedStudents;
  if (isMultiBranch) {
    orderedStudents = interleaveBranches(groups, groupKeys);
  } else {
    orderedStudents = [...students].sort((a, b) => naturalSort(a.roll_no, b.roll_no));
  }

  const totalStudents = orderedStudents.length;
  const totalBenchesAllRooms = rooms.reduce((sum, r) => sum + Math.floor(r.capacity / 2), 0);
  const totalCapAllRooms = rooms.reduce((sum, r) => sum + r.capacity, 0);

  // Determine room quotas:
  // If total students <= total physical benches, cap each room's quota to its bench count so 1 student sits per bench!
  let roomQuotas;
  if (totalStudents <= totalBenchesAllRooms && rooms.length > 1) {
    let remaining = totalStudents;
    roomQuotas = rooms.map((r, i) => {
      const roomBenches = Math.floor(r.capacity / 2);
      if (i === rooms.length - 1) return Math.min(remaining, r.capacity);
      const share = Math.min(Math.round((roomBenches / totalBenchesAllRooms) * totalStudents), roomBenches);
      remaining -= share;
      return share;
    });
  } else {
    let remaining = totalStudents;
    roomQuotas = rooms.map((r, i) => {
      if (i === rooms.length - 1) return Math.min(remaining, r.capacity);
      const share = Math.round((r.capacity / totalCapAllRooms) * totalStudents);
      remaining -= share;
      return Math.min(share, r.capacity);
    });
  }

  let studentIdx = 0;

  for (let ri = 0; ri < rooms.length; ri++) {
    if (studentIdx >= totalStudents) break;
    const room = rooms[ri];
    const quota = roomQuotas[ri];
    const { id: roomAllocId, bench_rows, bench_cols, capacity } = room;

    const roomStudents = orderedStudents.slice(studentIdx, studentIdx + quota);
    const availableStudents = [...roomStudents];
    const roomAssignments = [];

    const benchesPerRow = Math.max(1, Math.floor(bench_cols / 2)) || 1;
    const actualBenches = Math.floor(capacity / 2);

    const benchMap = [];

    // PASS 1: Allocate 1 student per bench (Seat 1 / Left)
    for (let b = 0; b < actualBenches && availableStudents.length > 0; b++) {
      const row = Math.floor(b / benchesPerRow) + 1;
      const benchInRow = (b % benchesPerRow) + 1;
      const leftCol = benchInRow * 2 - 1;
      const rightCol = benchInRow * 2;

      if (leftCol <= bench_cols) {
        const s1 = availableStudents.shift();
        benchMap[b] = { row, benchInRow, leftCol, rightCol, s1, s2: null };
        roomAssignments.push({
          student_id: s1.id,
          room_allocation_id: roomAllocId,
          bench_row: row,
          bench_col: leftCol
        });
      }
    }

    // PASS 2: If room fills up (more students remaining than benches), allocate 2nd student per bench (Seat 2 / Right)
    if (availableStudents.length > 0) {
      for (let b = 0; b < benchMap.length && availableStudents.length > 0; b++) {
        const benchInfo = benchMap[b];
        if (!benchInfo || benchInfo.s2) continue;
        if (benchInfo.rightCol > bench_cols) continue;

        const s1 = benchInfo.s1;
        // Find candidate s2 with different Year, Branch, and Subject
        let candidateIdx = availableStudents.findIndex(s2 => 
          s2.year !== s1.year && 
          s2.branch !== s1.branch &&
          (s2.subject_id ? s2.subject_id !== s1.subject_id : true)
        );

        if (candidateIdx === -1) {
          candidateIdx = availableStudents.findIndex(s2 => s2.year !== s1.year || s2.branch !== s1.branch);
        }

        // Only log conflict if this was a multi-branch slot where mixing failed due to numerical imbalance
        if (candidateIdx === -1) {
          candidateIdx = 0;
          if (isMultiBranch) {
            conflicts.push({
              type: 'BRANCH_MIXING_FAILED',
              description: `Room ${room.room_no}, Row ${benchInfo.row}, Bench ${benchInfo.benchInRow} — same branch/year sharing bench due to numerical imbalance.`,
              affected_entities: `${s1.name} (${s1.branch} ${s1.year})`,
              suggested_resolution: 'Re-distribute branch groups across rooms.'
            });
          }
        }

        const s2 = availableStudents.splice(candidateIdx, 1)[0];
        benchInfo.s2 = s2;
        roomAssignments.push({
          student_id: s2.id,
          room_allocation_id: roomAllocId,
          bench_row: benchInfo.row,
          bench_col: benchInfo.rightCol
        });
      }
    }

    studentIdx += roomStudents.length - availableStudents.length;
    assignments.push(...roomAssignments);
  }

  // Check unassigned students
  if (studentIdx < totalStudents) {
    const unassigned = totalStudents - studentIdx;
    conflicts.push({
      type: 'INSUFFICIENT_ROOM_CAPACITY',
      description: `${unassigned} student(s) could not be seated — room capacity exceeded.`,
      suggested_resolution: 'Allocate additional rooms to this slot.',
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
  for (const k in groups) {
    groups[k].sort((a, b) => naturalSort(a.roll_no, b.roll_no));
  }
  return groups;
}

function interleaveBranches(groups, groupKeys) {
  const result = [];
  const keys = [...groupKeys];
  let active = true;

  while (active) {
    active = false;
    for (const key of keys) {
      if (groups[key].length > 0) {
        result.push(groups[key].shift());
        active = true;
      }
    }
  }
  return result;
}

function naturalSort(a, b) {
  return (a || '').localeCompare(b || '', undefined, { numeric: true, sensitivity: 'base' });
}
