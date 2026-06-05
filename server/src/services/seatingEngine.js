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

  let studentIdx = 0;
  const totalStudents = orderedStudents.length;

  for (const room of rooms) {
    if (studentIdx >= totalStudents) break;

    const { id: roomAllocId, bench_rows, bench_cols, capacity } = room;
    const roomAssignments = [];

    if (isMultiBranch) {
      // Multi-branch: 2 students per bench (left = col 1, right = col 2)
      // bench_cols here represents number of benches per row
      // Each physical bench has 2 seats
      const benchesPerRow = Math.max(1, Math.floor(bench_cols / 2)) || bench_cols;
      const totalBenches = bench_rows * benchesPerRow;

      for (let bench = 0; bench < totalBenches && studentIdx < totalStudents; bench++) {
        const row = Math.floor(bench / benchesPerRow) + 1;
        const benchInRow = (bench % benchesPerRow) + 1;

        // Left seat (col = benchInRow * 2 - 1)
        if (studentIdx < totalStudents) {
          const leftCol = benchInRow * 2 - 1;
          if (leftCol <= bench_cols) {
            roomAssignments.push({ student_id: orderedStudents[studentIdx].id, room_allocation_id: roomAllocId, bench_row: row, bench_col: leftCol });
            studentIdx++;
          }
        }

        // Right seat (col = benchInRow * 2)
        if (studentIdx < totalStudents) {
          const rightCol = benchInRow * 2;
          if (rightCol <= bench_cols) {
            // Validate: right-seat student must be from different branch than left-seat student
            const leftStudent = orderedStudents[studentIdx - 1];
            const rightStudent = orderedStudents[studentIdx];
            if (leftStudent.branch === rightStudent.branch && leftStudent.year === rightStudent.year) {
              conflicts.push({
                type: 'BRANCH_MIXING_FAILED',
                description: `Could not mix branches at Room ${room.room_no}, Row ${row}, Bench ${benchInRow} — numerical imbalance between branch groups.`,
                affected_entities: `${leftStudent.name} (${leftStudent.branch} ${leftStudent.year}) & ${rightStudent.name} (${rightStudent.branch} ${rightStudent.year})`
              });
            }
            roomAssignments.push({ student_id: rightStudent.id, room_allocation_id: roomAllocId, bench_row: row, bench_col: rightCol });
            studentIdx++;
          }
        }
      }
    } else {
      // Single branch: 1 student per bench position
      for (let row = 1; row <= bench_rows && studentIdx < totalStudents; row++) {
        for (let col = 1; col <= bench_cols && studentIdx < totalStudents; col++) {
          roomAssignments.push({ student_id: orderedStudents[studentIdx].id, room_allocation_id: roomAllocId, bench_row: row, bench_col: col });
          studentIdx++;
        }
      }
    }

    // Check capacity overflow
    if (roomAssignments.length > capacity) {
      conflicts.push({
        type: 'CAPACITY_OVERFLOW',
        description: `Room ${room.room_no} has ${roomAssignments.length} students assigned but capacity is ${capacity}.`,
        suggested_resolution: `Add another room or reduce students in this slot.`
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
      suggested_resolution: 'Allocate additional rooms to this exam slot.'
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
