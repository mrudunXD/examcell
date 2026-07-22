import sys
import json
from ortools.sat.python import cp_model

def solve():
    try:
        input_data = json.load(sys.stdin)
    except Exception as e:
        print(json.dumps({"error": f"Failed to parse stdin JSON: {str(e)}"}))
        return

    # Extract data
    cycle = input_data.get("cycle", {})
    subjects = input_data.get("subjects", [])
    students = input_data.get("students", [])
    classrooms = input_data.get("classrooms", [])
    faculty = input_data.get("faculty", [])
    teaches = input_data.get("teaches", [])
    settings = input_data.get("settings", {})
    faculty_leaves = input_data.get("faculty_leaves", [])
    subject_constraints = input_data.get("subject_constraints", [])

    time_limit = settings.get("time_limit_seconds", 30)
    shifts = settings.get("shifts", [
        {"id": "1", "name": "Shift 1", "start_time": "09:30", "duration_mins": 180},
        {"id": "2", "name": "Shift 2", "start_time": "13:30", "duration_mins": 180}
    ])
    dates = settings.get("dates", [])

    if not dates:
        print(json.dumps({"error": "No exam dates provided for scheduling."}))
        return
    if not subjects:
        print(json.dumps({"error": "No subjects provided for scheduling."}))
        return
    if not classrooms:
        print(json.dumps({"error": "No classrooms provided for scheduling."}))
        return

    # Automatically infer branch from subject codes
    def infer_branch_from_code(code, current_branch):
        if not code:
            return current_branch
        code_upper = code.upper().strip()
        if code_upper.startswith("AID"):
            return "CSE (AIDS)"
        if code_upper.startswith("AIML"):
            return "ECE (AI&ML)"
        if code_upper.startswith("AI"):
            return "AI"
        if code_upper.startswith("DS"):
            return "DS"
        if code_upper.startswith("CSE"):
            return "CSE"
        if code_upper.startswith("CYB") or code_upper.startswith("CS"):
            return "Cyber Security"
        if code_upper.startswith("IOT"):
            return "IoT"
        if code_upper.startswith("MEC"):
            return "ME"
        if code_upper.startswith("MRA"):
            return "MRA"
        if code_upper.startswith("CIV"):
            return "CE"
        if code_upper.startswith("ECE"):
            return "ECE"
        return current_branch

    for s in subjects:
        s["branch"] = infer_branch_from_code(s.get("code", ""), s.get("branch", "CSE"))

    # Differentiate between CCA and Final examinations
    is_cca = False
    cycle_name = cycle.get("name", "").lower()
    if any(k in cycle_name for k in ["cca", "midterm", "mid-term", "test", "continuous", "assessment"]):
        is_cca = True
    for shift in shifts:
        if int(shift.get("duration_mins", 180)) < 120:
            is_cca = True
            break

    # Map teachers to subject IDs they teach
    teaches_map = {}
    for t in teaches:
        fid = t["faculty_id"]
        sid = t["subject_id"]
        if fid not in teaches_map:
            teaches_map[fid] = set()
        teaches_map[fid].add(sid)

    # Group students by branch, year, semester
    student_groups = {}
    for st in students:
        key = (st["branch"], st["year"], st["semester"])
        if key not in student_groups:
            student_groups[key] = []
        student_groups[key].append(st["id"])

    # Map subject ID to group key
    subject_group_map = {}
    for s in subjects:
        key = (s["branch"], s["year"], s["semester"])
        subject_group_map[s["id"]] = key

    # Group subjects by their student groups
    group_subjects = {}
    for s in subjects:
        key = subject_group_map[s["id"]]
        if key not in group_subjects:
            group_subjects[key] = []
        group_subjects[key].append(s["id"])

    # Get student count for each subject
    subject_student_count = {}
    for s in subjects:
        key = subject_group_map[s["id"]]
        subject_student_count[s["id"]] = len(student_groups.get(key, []))

    # Slots details: T = Dates x Shifts
    slots = []
    slot_id = 0
    for d_idx, d_val in enumerate(dates):
        for s_idx, s_val in enumerate(shifts):
            slots.append({
                "id": slot_id,
                "date": d_val,
                "date_idx": d_idx,
                "shift": s_val["id"],
                "shift_idx": s_idx,
                "start_time": s_val["start_time"],
                "duration_mins": s_val["duration_mins"]
            })
            slot_id += 1

    # ==========================================================
    # Pre-processing: Pre-split subjects exceeding classroom size
    # ==========================================================
    max_cap = max(r["capacity"] for r in classrooms)
    virtual_subjects = []
    subject_parts_map = {} # maps original subject_id -> list of virtual subject dicts

    for s in subjects:
        num_stud = subject_student_count[s["id"]]
        if num_stud == 0:
            continue
        
        if num_stud <= max_cap:
            v_sub = {
                "id": s["id"],
                "orig_id": s["id"],
                "code": s["code"],
                "name": s["name"],
                "branch": s["branch"],
                "year": s["year"],
                "semester": s["semester"],
                "student_count": num_stud,
                "exam_type": s.get("exam_type", "regular"),
                "exam_mode": s.get("exam_mode", "offline")
            }
            virtual_subjects.append(v_sub)
            subject_parts_map[s["id"]] = [v_sub]
        else:
            parts = []
            rem = num_stud
            part_idx = 1
            while rem > 0:
                part_size = min(rem, max_cap)
                v_id = f"{s['id']}_part{part_idx}"
                v_sub = {
                    "id": v_id,
                    "orig_id": s["id"],
                    "code": s["code"],
                    "name": s["name"],
                    "branch": s["branch"],
                    "year": s["year"],
                    "semester": s["semester"],
                    "student_count": part_size,
                    "exam_type": s.get("exam_type", "regular"),
                    "exam_mode": s.get("exam_mode", "offline")
                }
                virtual_subjects.append(v_sub)
                parts.append(v_sub)
                rem -= part_size
                part_idx += 1
            subject_parts_map[s["id"]] = parts

    # ==========================================================
    # PHASE 1: Solve Scheduling and Room Allocation
    # ==========================================================
    model1 = cp_model.CpModel()

    # Variables:
    # x[v, t] - virtual subject v scheduled in slot t
    x = {}
    for v in virtual_subjects:
        for t in slots:
            x[v["id"], t["id"]] = model1.NewBoolVar(f"x_{v['id']}_{t['id']}")

    # y[v, r] - classroom r allocated to virtual subject v
    y = {}
    for v in virtual_subjects:
        for r in classrooms:
            y[v["id"], r["id"]] = model1.NewBoolVar(f"y_{v['id']}_{r['id']}")

    # z[v, r, t] - room r assigned to virtual subject v in slot t (z = x and y)
    z = {}
    for v in virtual_subjects:
        for r in classrooms:
            for t in slots:
                z[v["id"], r["id"], t["id"]] = model1.NewBoolVar(f"z_{v['id']}_{r['id']}_{t['id']}")
                model1.AddBoolAnd([x[v["id"], t["id"]], y[v["id"], r["id"]]]).OnlyEnforceIf(z[v["id"], r["id"], t["id"]])
                model1.AddBoolOr([x[v["id"], t["id"]].Not(), y[v["id"], r["id"]].Not()]).OnlyEnforceIf(z[v["id"], r["id"], t["id"]].Not())

    # Constraints:
    # 1. Each virtual subject scheduled exactly once
    for v in virtual_subjects:
        model1.Add(sum(x[v["id"], t["id"]] for t in slots) == 1)

    # 2. Each virtual subject assigned to exactly one room
    for v in virtual_subjects:
        model1.Add(sum(y[v["id"], r["id"]] for r in classrooms) == 1)

    # 3. Subject parts synchronization (all parts of a subject must be in the same slot)
    for orig_id, parts in subject_parts_map.items():
        if len(parts) > 1:
            for t in slots:
                for idx in range(1, len(parts)):
                    model1.Add(x[parts[0]["id"], t["id"]] == x[parts[idx]["id"], t["id"]])

    # 4. Branch & Semester Parity: A student group can have at most one exam in a slot
    for g, g_subjs in group_subjects.items():
        for t in slots:
            # Sum over all subjects in the group
            model1.Add(sum(x[subject_parts_map[sid][0]["id"], t["id"]] for sid in g_subjs if sid in subject_parts_map) <= 1)

    # 5. Maximum exams per day per student group (CCA = 2, Final = 1)
    max_exams_per_day = 2 if is_cca else 1
    for g, g_subjs in group_subjects.items():
        for d_idx in range(len(dates)):
            day_slots = [t for t in slots if t["date_idx"] == d_idx]
            model1.Add(sum(x[subject_parts_map[sid][0]["id"], t["id"]] for sid in g_subjs for t in day_slots if sid in subject_parts_map) <= max_exams_per_day)

    # 5b. Minimum 1 hour gap between exams on the same day for CCA cycles
    if is_cca:
        def to_mins(time_str):
            parts = time_str.split(':')
            if len(parts) >= 2:
                return int(parts[0]) * 60 + int(parts[1])
            return 0

        for d_idx in range(len(dates)):
            day_slots = [t for t in slots if t["date_idx"] == d_idx]
            for idx1, t1 in enumerate(day_slots):
                for idx2, t2 in enumerate(day_slots):
                    if idx1 < idx2:
                        t1_start = to_mins(t1["start_time"])
                        t1_end = t1_start + t1["duration_mins"]
                        t2_start = to_mins(t2["start_time"])
                        t2_end = t2_start + t2["duration_mins"]
                        
                        if t1_start > t2_start:
                            t1_start, t2_start = t2_start, t1_start
                            t1_end, t2_end = t2_end, t1_end
                            
                        gap = t2_start - t1_end
                        if gap < 60:
                            for g, g_subjs in group_subjects.items():
                                reps_t1 = [x[subject_parts_map[sid][0]["id"], t1["id"]] for sid in g_subjs if sid in subject_parts_map]
                                reps_t2 = [x[subject_parts_map[sid][0]["id"], t2["id"]] for sid in g_subjs if sid in subject_parts_map]
                                if reps_t1 and reps_t2:
                                    model1.Add(sum(reps_t1) + sum(reps_t2) <= 1)

    # 6. Online Room Compatibility
    for v in virtual_subjects:
        is_subj_online = v.get("exam_mode") == "online"
        for r in classrooms:
            is_room_online = r.get("is_online", 0) == 1
            if is_subj_online and not is_room_online:
                model1.Add(y[v["id"], r["id"]] == 0)

    # 7. Room capacity limit per slot
    for r in classrooms:
        for t in slots:
            model1.Add(sum(v["student_count"] * z[v["id"], r["id"], t["id"]] for v in virtual_subjects) <= r["capacity"])

    # 8. Room Sharing constraints: Limit number of virtual subjects sharing a room at slot t to 2
    for r in classrooms:
        for t in slots:
            model1.Add(sum(z[v["id"], r["id"], t["id"]] for v in virtual_subjects) <= 2)

    # 9. Same-branch room sharing forbidden (except if they are parts of the same subject)
    for r in classrooms:
        for t in slots:
            for idx1, v1 in enumerate(virtual_subjects):
                for idx2, v2 in enumerate(virtual_subjects):
                    if idx1 < idx2 and v1["branch"] == v2["branch"]:
                        if v1["code"] != v2["code"]: # different subjects
                            model1.Add(z[v1["id"], r["id"], t["id"]] + z[v2["id"], r["id"], t["id"]] <= 1)

    # 10. Subject scheduling constraints (lockout or fixed slots)
    for v in virtual_subjects:
        for t in slots:
            for c in subject_constraints:
                if c["subject_id"] == v["orig_id"]:
                    if c["type"] == "excluded_date" and c["date"] == t["date"]:
                        model1.Add(x[v["id"], t["id"]] == 0)
                    elif c["type"] == "fixed_slot" and c["date"] == t["date"]:
                        if c.get("shift_id") is None or str(c["shift_id"]) == str(t["shift"]):
                            model1.Add(x[v["id"], t["id"]] == 1)

    # --- Soft Constraints & Penalties ---
    penalties = []

    # 1. Maximize gaps (days apart) between student exams
    # Heuristic: only apply gap penalties if the number of subjects for a student group is <= 6.
    # If a group has > 6 subjects, they must take exams on almost every day/shift, so gap optimization is counterproductive.
    for g, g_subjs in group_subjects.items():
        if 1 < len(g_subjs) <= 6:
            for i in range(len(g_subjs)):
                for j in range(i + 1, len(g_subjs)):
                    s1, s2 = g_subjs[i], g_subjs[j]
                    if s1 not in subject_parts_map or s2 not in subject_parts_map:
                        continue
                    v1_id = subject_parts_map[s1][0]["id"]
                    v2_id = subject_parts_map[s2][0]["id"]
                    
                    d1 = model1.NewIntVar(0, len(dates), f"d1_{s1}_{s2}")
                    d2 = model1.NewIntVar(0, len(dates), f"d2_{s1}_{s2}")
                    model1.Add(d1 == sum(t["date_idx"] * x[v1_id, t["id"]] for t in slots))
                    model1.Add(d2 == sum(t["date_idx"] * x[v2_id, t["id"]] for t in slots))

                    diff = model1.NewIntVar(0, len(dates), f"diff_{s1}_{s2}")
                    model1.AddAbsEquality(diff, d1 - d2)

                    is_gap_0 = model1.NewBoolVar(f"gap0_{s1}_{s2}")
                    model1.Add(diff == 0).OnlyEnforceIf(is_gap_0)
                    model1.Add(diff != 0).OnlyEnforceIf(is_gap_0.Not())

                    is_gap_1 = model1.NewBoolVar(f"gap1_{s1}_{s2}")
                    model1.Add(diff == 1).OnlyEnforceIf(is_gap_1)
                    model1.Add(diff != 1).OnlyEnforceIf(is_gap_1.Not())

                    penalties.append(100 * is_gap_0)
                    penalties.append(20 * is_gap_1)

    # 2. Minimize room wastage (unused capacity)
    for r in classrooms:
        for t in slots:
            used_r_t = model1.NewBoolVar(f"used_{r['id']}_{t['id']}")
            model1.AddMaxEquality(used_r_t, [z[v["id"], r["id"], t["id"]] for v in virtual_subjects])

            total_students_in_room = sum(v["student_count"] * z[v["id"], r["id"], t["id"]] for v in virtual_subjects)
            wastage = model1.NewIntVar(0, r["capacity"], f"wastage_{r['id']}_{t['id']}")
            model1.Add(wastage == r["capacity"] * used_r_t - total_students_in_room)
            penalties.append(20 * wastage)

    # 3. Minimize room switching for student groups
    for g, g_subjs in group_subjects.items():
        for r in classrooms:
            uses_room = model1.NewBoolVar(f"uses_room_{g}_{r['id']}")
            # Uses room if any virtual subject part of the group is in that room
            group_v_subjs = []
            for sid in g_subjs:
                if sid in subject_parts_map:
                    for v in subject_parts_map[sid]:
                        group_v_subjs.append(y[v["id"], r["id"]])
            if group_v_subjs:
                model1.AddMaxEquality(uses_room, group_v_subjs)
                penalties.append(15 * uses_room)

    # 4. Order chronologically by year: FY -> SY -> TY
    order_by_year = settings.get("order_by_year", True)
    if order_by_year:
        year_ranks = {"FY": 1, "SY": 2, "TY": 3}
        for v in virtual_subjects:
            rank = year_ranks.get(v["year"], 0)
            if rank > 0:
                for t in slots:
                    d = t["date_idx"]
                    if rank == 1: # FY
                        coeff = 50 * d
                    elif rank == 2: # SY
                        coeff = 25 * d
                    else: # TY (rank == 3)
                        coeff = 50 * (len(dates) - 1 - d)
                    
                    penalties.append(coeff * x[v["id"], t["id"]])

    # 5. Compact schedule optimization & sparse scheduling penalty
    for g, g_subjs in group_subjects.items():
        if len(g_subjs) > 0:
            active_subjs = [sid for sid in g_subjs if sid in subject_parts_map]
            if not active_subjs:
                continue
            
            start_day_g = model1.NewIntVar(0, len(dates) - 1, f"start_day_{g}")
            end_day_g = model1.NewIntVar(0, len(dates) - 1, f"end_day_{g}")
            
            for sid in active_subjs:
                v_id = subject_parts_map[sid][0]["id"]
                date_var = model1.NewIntVar(0, len(dates) - 1, f"date_var_{sid}")
                model1.Add(date_var == sum(t["date_idx"] * x[v_id, t["id"]] for t in slots))
                
                model1.Add(start_day_g <= date_var)
                model1.Add(end_day_g >= date_var)
                
                # Penalty for date index (pulls exam as early as possible)
                penalties.append(10 * date_var)
            
            # Span penalty (forces exams of the branch to be compact)
            span_g = model1.NewIntVar(0, len(dates) - 1, f"span_{g}")
            model1.Add(span_g == end_day_g - start_day_g)
            penalties.append(30 * span_g)

    model1.Minimize(sum(penalties))

    # Solve Phase 1
    solver1 = cp_model.CpSolver()
    solver1.parameters.max_time_in_seconds = time_limit
    status1 = solver1.Solve(model1)

    if status1 not in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
        # Fail safe: Run relaxed solver to analyze conflicts
        run_relaxed_solver(virtual_subjects, student_groups, group_subjects, subject_group_map, teaches_map, classrooms, slots, dates, is_cca, faculty_leaves, subject_constraints)
        return

    # Extract solved schedule
    x_sol = {}
    y_sol = {}
    z_sol = {}
    for v in virtual_subjects:
        for t in slots:
            x_sol[v["id"], t["id"]] = solver1.Value(x[v["id"], t["id"]])
        for r in classrooms:
            y_sol[v["id"], r["id"]] = solver1.Value(y[v["id"], r["id"]])
            for t in slots:
                z_sol[v["id"], r["id"], t["id"]] = solver1.Value(z[v["id"], r["id"], t["id"]])

    # ==========================================================
    # PHASE 2: Solve Supervisor Duty Assignment
    # ==========================================================
    model2 = cp_model.CpModel()

    # inv[f, r, t] - faculty f invigilating room r in slot t
    inv = {}
    for f in faculty:
        for r in classrooms:
            for t in slots:
                inv[f["id"], r["id"], t["id"]] = model2.NewBoolVar(f"inv_{f['id']}_{r['id']}_{t['id']}")

    # Determine active rooms and mixed rooms from Phase 1 solution
    used_r_t = {}
    is_mixed_r_t = {}
    for r in classrooms:
        for t in slots:
            virtuals_in_room = [v for v in virtual_subjects if z_sol[v["id"], r["id"], t["id"]] == 1]
            used_r_t[r["id"], t["id"]] = len(virtuals_in_room) > 0
            # A room is mixed if it contains >= 2 different subject codes
            unique_codes = set(v["code"] for v in virtuals_in_room)
            is_mixed_r_t[r["id"], t["id"]] = len(unique_codes) >= 2

    # Constraints:
    # 1. Single room restriction: Faculty can be in at most 1 room per slot
    for f in faculty:
        for t in slots:
            model2.Add(sum(inv[f["id"], r["id"], t["id"]] for r in classrooms) <= 1)

    # 1b. Faculty availability leaves restriction
    for f in faculty:
        for t in slots:
            for l in faculty_leaves:
                if l["faculty_id"] == f["id"] and l["date"] == t["date"]:
                    if l.get("shift_id") is None or str(l["shift_id"]) == str(t["shift"]):
                        for r in classrooms:
                            model2.Add(inv[f["id"], r["id"], t["id"]] == 0)

    # 2. Subject restriction: Faculty cannot invigilate subjects they teach
    for f in faculty:
        taught_subjs = teaches_map.get(f["id"], set())
        for r in classrooms:
            for t in slots:
                virtuals_in_room = [v for v in virtual_subjects if z_sol[v["id"], r["id"], t["id"]] == 1]
                for v in virtuals_in_room:
                    # If this room contains an original subject they teach, forbid invigilation
                    if v["orig_id"] in taught_subjs:
                        model2.Add(inv[f["id"], r["id"], t["id"]] == 0)

    # 3. Invigilator counts per active room:
    # 0 if room not used, >= 1 if used, >= 2 if mixed subjects
    for r in classrooms:
        for t in slots:
            num_inv = sum(inv[f["id"], r["id"], t["id"]] for f in faculty)
            if not used_r_t[r["id"], t["id"]]:
                model2.Add(num_inv == 0)
            else:
                if is_mixed_r_t[r["id"], t["id"]]:
                    model2.Add(num_inv == 2)
                else:
                    model2.Add(num_inv == 1)

    # Supervisor Load Balancing Penalties
    penalties2 = []
    if faculty:
        faculty_duties = {}
        for f in faculty:
            faculty_duties[f["id"]] = sum(inv[f["id"], r["id"], t["id"]] for r in classrooms for t in slots)

        max_duties = model2.NewIntVar(0, len(slots), "max_duties")
        min_duties = model2.NewIntVar(0, len(slots), "min_duties")
        model2.AddMaxEquality(max_duties, list(faculty_duties.values()))
        model2.AddMinEquality(min_duties, list(faculty_duties.values()))
        penalties2.append(15 * (max_duties - min_duties))

    model2.Minimize(sum(penalties2))

    # Solve Phase 2
    solver2 = cp_model.CpSolver()
    solver2.parameters.max_time_in_seconds = 10
    status2 = solver2.Solve(model2)

    # Build success output structure (merging virtual parts back into their original subjects)
    output_slots_map = {}
    for s in subjects:
        # Find which slot they are scheduled in (by checking any of their parts)
        parts = subject_parts_map.get(s["id"], [])
        if not parts:
            continue
        
        assigned_slot = None
        for t in slots:
            if solver1.Value(x[parts[0]["id"], t["id"]]) == 1:
                assigned_slot = t
                break
        
        if not assigned_slot:
            continue
        
        assigned_rooms = []
        for v in parts:
            for r in classrooms:
                if solver1.Value(y[v["id"], r["id"]]) == 1:
                    assigned_rooms.append({
                        "classroom_id": r["id"],
                        "room_no": r["room_no"],
                        "students_count": v["student_count"]
                    })
        
        output_slots_map[s["id"]] = {
            "subject_id": s["id"],
            "subject_code": s["code"],
            "date": assigned_slot["date"],
            "start_time": assigned_slot["start_time"],
            "duration_mins": assigned_slot["duration_mins"],
            "exam_type": s.get("exam_type", "regular"),
            "exam_mode": s.get("exam_mode", "offline"),
            "rooms": assigned_rooms
        }

    # Invigilator assignments output
    output_invigilators = []
    if status2 in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
        for f in faculty:
            for r in classrooms:
                for t in slots:
                    if solver2.Value(inv[f["id"], r["id"], t["id"]]) == 1:
                        output_invigilators.append({
                            "faculty_id": f["id"],
                            "classroom_id": r["id"],
                            "date": t["date"],
                            "shift": t["shift"],
                            "start_time": t["start_time"]
                        })

    print(json.dumps({
        "status": "SUCCESS",
        "slots": list(output_slots_map.values()),
        "invigilators": output_invigilators,
        "objective_value": int(solver1.ObjectiveValue()),
        "constraints_count": len(model1.Proto().constraints)
    }))

def run_relaxed_solver(virtual_subjects, student_groups, group_subjects, subject_group_map, teaches_map, classrooms, slots, dates, is_cca, faculty_leaves, subject_constraints):
    model = cp_model.CpModel()

    # Variables
    x = {}
    for v in virtual_subjects:
        for t in slots:
            x[v["id"], t["id"]] = model.NewBoolVar(f"x_{v['id']}_{t['id']}")

    y = {}
    for v in virtual_subjects:
        for r in classrooms:
            y[v["id"], r["id"]] = model.NewBoolVar(f"y_{v['id']}_{r['id']}")

    z = {}
    for v in virtual_subjects:
        for r in classrooms:
            for t in slots:
                z[v["id"], r["id"], t["id"]] = model.NewBoolVar(f"z_{v['id']}_{r['id']}_{t['id']}")
                model.AddBoolAnd([x[v["id"], t["id"]], y[v["id"], r["id"]]]).OnlyEnforceIf(z[v["id"], r["id"], t["id"]])
                model.AddBoolOr([x[v["id"], t["id"]].Not(), y[v["id"], r["id"]].Not()]).OnlyEnforceIf(z[v["id"], r["id"], t["id"]].Not())

    # Violation slacks
    slack_branch_overlap = []
    slack_room_overflow = []
    slack_backlog = []

    # 1. Subject scheduled once (Hard)
    for v in virtual_subjects:
        model.Add(sum(x[v["id"], t["id"]] for t in slots) == 1)

    # 2. Subject assigned to exactly one room (Hard)
    for v in virtual_subjects:
        model.Add(sum(y[v["id"], r["id"]] for r in classrooms) == 1)

    # Subject scheduling constraints (lockout or fixed slots)
    for v in virtual_subjects:
        for t in slots:
            for c in subject_constraints:
                if c["subject_id"] == v["orig_id"]:
                    if c["type"] == "excluded_date" and c["date"] == t["date"]:
                        model.Add(x[v["id"], t["id"]] == 0)
                    elif c["type"] == "fixed_slot" and c["date"] == t["date"]:
                        if c.get("shift_id") is None or str(c["shift_id"]) == str(t["shift"]):
                            model.Add(x[v["id"], t["id"]] == 1)

    # 3. Branch & Semester Parity (Relaxed)
    for g, g_subjs in group_subjects.items():
        for t in slots:
            slack = model.NewBoolVar(f"slack_parity_{g}_{t['id']}")
            # Sum of parts (using the first part as representative of the subject slot assignment)
            subjs_scheduled = [x[v_subjs[0]["id"], t["id"]] for sid in g_subjs for v_subjs in [v_subjs for orig_id, v_subjs in {}.items() if orig_id == sid] if v_subjs]
            # In relaxed solver we sum virtual representative parts
            # Let's map orig subject ID to virtual parts in a dictionary
            subj_parts = {}
            for v in virtual_subjects:
                if v["orig_id"] not in subj_parts:
                    subj_parts[v["orig_id"]] = []
                subj_parts[v["orig_id"]].append(v)
            
            reps = [x[subj_parts[sid][0]["id"], t["id"]] for sid in g_subjs if sid in subj_parts]
            if reps:
                model.Add(sum(reps) <= 1 + len(g_subjs) * slack)
                slack_branch_overlap.append((slack, g, t["date"], t["start_time"]))

    # 4. Max 2 exams/day (Hard)
    subj_parts = {}
    for v in virtual_subjects:
        if v["orig_id"] not in subj_parts:
            subj_parts[v["orig_id"]] = []
        subj_parts[v["orig_id"]].append(v)
        
    max_exams_per_day = 2 if is_cca else 1
    for g, g_subjs in group_subjects.items():
        for d_idx in range(len(dates)):
            day_slots = [t for t in slots if t["date_idx"] == d_idx]
            reps = [x[subj_parts[sid][0]["id"], t["id"]] for sid in g_subjs if sid in subj_parts for t in day_slots]
            if reps:
                model.Add(sum(reps) <= max_exams_per_day)

    # 4b. Minimum 1 hour gap between exams on the same day for CCA cycles
    if is_cca:
        def to_mins(time_str):
            parts = time_str.split(':')
            if len(parts) >= 2:
                return int(parts[0]) * 60 + int(parts[1])
            return 0

        for d_idx in range(len(dates)):
            day_slots = [t for t in slots if t["date_idx"] == d_idx]
            for idx1, t1 in enumerate(day_slots):
                for idx2, t2 in enumerate(day_slots):
                    if idx1 < idx2:
                        t1_start = to_mins(t1["start_time"])
                        t1_end = t1_start + t1["duration_mins"]
                        t2_start = to_mins(t2["start_time"])
                        t2_end = t2_start + t2["duration_mins"]
                        
                        if t1_start > t2_start:
                            t1_start, t2_start = t2_start, t1_start
                            t1_end, t2_end = t2_end, t1_end
                            
                        gap = t2_start - t1_end
                        if gap < 60:
                            for g, g_subjs in group_subjects.items():
                                reps_t1 = [x[subj_parts[sid][0]["id"], t1["id"]] for sid in g_subjs if sid in subj_parts]
                                reps_t2 = [x[subj_parts[sid][0]["id"], t2["id"]] for sid in g_subjs if sid in subj_parts]
                                if reps_t1 and reps_t2:
                                    model.Add(sum(reps_t1) + sum(reps_t2) <= 1)

    # 5. Backlog Separation (Relaxed)
    backlog_subjects = [v for v in virtual_subjects if v.get("exam_type") == "backlog"]
    regular_subjects = [v for v in virtual_subjects if v.get("exam_type") == "regular"]
    if backlog_subjects and regular_subjects:
        for bs in backlog_subjects:
            bs_date = model.NewIntVar(0, len(dates), f"date_bs_{bs['id']}")
            model.Add(bs_date == sum(t["date_idx"] * x[bs["id"], t["id"]] for t in slots))
            for rs in regular_subjects:
                rs_date = model.NewIntVar(0, len(dates), f"date_rs_{rs['id']}")
                model.Add(rs_date == sum(t["date_idx"] * x[rs["id"], t["id"]] for t in slots))
                
                is_violation = model.NewBoolVar(f"slack_backlog_{bs['id']}_{rs['id']}")
                model.Add(bs_date < rs_date).OnlyEnforceIf(is_violation.Not())
                model.Add(bs_date >= rs_date).OnlyEnforceIf(is_violation)
                slack_backlog.append((is_violation, bs["code"], rs["code"]))

    # 6. Online Room Compatibility (Hard)
    for v in virtual_subjects:
        is_subj_online = v.get("exam_mode") == "online"
        for r in classrooms:
            is_room_online = r.get("is_online", 0) == 1
            if is_subj_online and not is_room_online:
                model.Add(y[v["id"], r["id"]] == 0)

    # 7. Room capacity limit per slot (Relaxed)
    for r in classrooms:
        for t in slots:
            excess = model.NewIntVar(0, 500, f"excess_capacity_{r['id']}_{t['id']}")
            model.Add(sum(v["student_count"] * z[v["id"], r["id"], t["id"]] for v in virtual_subjects) <= r["capacity"] + excess)
            
            is_overflow = model.NewBoolVar(f"slack_overflow_{r['id']}_{t['id']}")
            model.Add(excess == 0).OnlyEnforceIf(is_overflow.Not())
            model.Add(excess > 0).OnlyEnforceIf(is_overflow)
            slack_room_overflow.append((is_overflow, r["room_no"], t["date"], t["start_time"]))

    # Minimize slack violations
    model.Minimize(
        sum(1000 * slack[0] for slack in slack_branch_overlap) +
        sum(1000 * slack[0] for slack in slack_room_overflow) +
        sum(1000 * slack[0] for slack in slack_backlog)
    )

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 10
    status = solver.Solve(model)

    conflicts = []

    if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
        for slack, g, date, start_time in slack_branch_overlap:
            if solver.Value(slack) == 1:
                conflicts.append({
                    "type": "BRANCH_CLASH",
                    "description": f"Student group '{g[0]} {g[1]} Year (Sem {g[2]})' has overlapping exams scheduled on {date} at {start_time}.",
                    "suggested_resolution": "Extend cycle dates or reduce number of subjects scheduled."
                })

        for slack, room_no, date, start_time in slack_room_overflow:
            if solver.Value(slack) == 1:
                conflicts.append({
                    "type": "ROOM_OVERFLOW",
                    "description": f"Room {room_no} capacity exceeded on {date} at {start_time}.",
                    "suggested_resolution": "Assign additional classrooms or adjust student distributions."
                })

        for slack, bs_code, rs_code in slack_backlog:
            if solver.Value(slack) == 1:
                conflicts.append({
                    "type": "BACKLOG_OVERLAP",
                    "description": f"Backlog subject {bs_code} is scheduled on or after final subject {rs_code}.",
                    "suggested_resolution": "Extend the start date of the exam cycle or clear backlog dates."
                })

    if not conflicts:
        conflicts.append({
            "type": "SCHEDULING_IMPOSSIBLE",
            "description": "No valid schedule satisfies the institutional constraints.",
            "suggested_resolution": "Please check dates ranges, student enrollments, or classroom counts."
        })

    print(json.dumps({
        "status": "FAIL",
        "conflicts": conflicts,
        "constraints_count": len(model.Proto().constraints) if 'model' in locals() else 0,
        "objective_value": 0
    }))

if __name__ == "__main__":
    solve()
