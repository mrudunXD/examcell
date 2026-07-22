import sys
import json
import os
from ortools.sat.python import cp_model

# Ensure local directories are added to Python path for direct execution imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'constraints'))

from config import DEFAULT_SETTINGS, OPTIMIZATION_WEIGHTS
from preprocessor import run_preprocessor
from registry import ConstraintRegistry

def solve():
    try:
        input_data = json.load(sys.stdin)
    except Exception as e:
        print(json.dumps({"error": f"Failed to parse stdin JSON: {str(e)}"}))
        return

    # 1. Preprocess input parameters
    context = run_preprocessor(input_data)
    
    virtual_subjects = context["virtual_subjects"]
    classrooms = context["classrooms"]
    slots = context["slots"]
    subject_parts_map = context["subject_parts_map"]
    group_subjects = context["group_subjects"]
    dates = context["dates"]
    is_cca = context["is_cca"]
    faculty = context["faculty"]
    teaches_map = context["teaches_map"]
    faculty_leaves = context["faculty_leaves"]
    subject_constraints = context["subject_constraints"]
    time_limit = context["time_limit"]

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

    variables = {"x": x, "y": y, "z": z}

    # 2. Apply base hard scheduling rules
    # Each virtual subject scheduled exactly once
    for v in virtual_subjects:
        model1.Add(sum(x[v["id"], t["id"]] for t in slots) == 1)

    # Each virtual subject assigned to exactly one room
    for v in virtual_subjects:
        model1.Add(sum(y[v["id"], r["id"]] for r in classrooms) == 1)

    # Subject parts synchronization (all parts of a subject must be in the same slot)
    for orig_id, parts in subject_parts_map.items():
        if len(parts) > 1:
            for t in slots:
                for idx in range(1, len(parts)):
                    model1.Add(x[parts[0]["id"], t["id"]] == x[parts[idx]["id"], t["id"]])

    # Subject constraints (lockout or fixed slots)
    for v in virtual_subjects:
        for t in slots:
            for c in subject_constraints:
                if c["subject_id"] == v["orig_id"]:
                    if c["type"] == "excluded_date" and c["date"] == t["date"]:
                        model1.Add(x[v["id"], t["id"]] == 0)
                    elif c["type"] == "fixed_slot" and c["date"] == t["date"]:
                        if c.get("shift_id") is None or str(c["shift_id"]) == str(t["shift"]):
                            model1.Add(x[v["id"], t["id"]] == 1)

    # 3. Apply constraints registry (Student overlaps, Room capacity, online compatibility)
    registry = ConstraintRegistry()
    registry.apply_all(model1, context, variables)

    # 4. Soft Constraints & Penalties (using weights from config.py)
    penalties = []
    w = OPTIMIZATION_WEIGHTS

    # Pre-generate date_vars mapping to avoid redundant variables and constraints
    date_vars = {}
    for s in context["subjects"]:
        if s["id"] in subject_parts_map:
            v_id = subject_parts_map[s["id"]][0]["id"]
            d_var = model1.NewIntVar(0, len(dates) - 1, f"date_var_{s['id']}")
            model1.Add(d_var == sum(t["date_idx"] * x[v_id, t["id"]] for t in slots))
            date_vars[s["id"]] = d_var

    # A. Maximize gaps (days apart) between student exams
    for g, g_subjs in group_subjects.items():
        if 1 < len(g_subjs) <= DEFAULT_SETTINGS["max_subjects_for_gap_penalties"]:
            for i in range(len(g_subjs)):
                for j in range(i + 1, len(g_subjs)):
                    s1, s2 = g_subjs[i], g_subjs[j]
                    if s1 not in date_vars or s2 not in date_vars:
                        continue
                    d1 = date_vars[s1]
                    d2 = date_vars[s2]
                    
                    diff = model1.NewIntVar(0, len(dates), f"diff_{s1}_{s2}")
                    model1.AddAbsEquality(diff, d1 - d2)

                    is_gap_0 = model1.NewBoolVar(f"gap0_{s1}_{s2}")
                    model1.Add(diff == 0).OnlyEnforceIf(is_gap_0)
                    model1.Add(diff != 0).OnlyEnforceIf(is_gap_0.Not())

                    is_gap_1 = model1.NewBoolVar(f"gap1_{s1}_{s2}")
                    model1.Add(diff == 1).OnlyEnforceIf(is_gap_1)
                    model1.Add(diff != 1).OnlyEnforceIf(is_gap_1.Not())

                    penalties.append(w["gap_0_days"] * is_gap_0)
                    penalties.append(w["gap_1_days"] * is_gap_1)

    # B. Minimize room wastage (unused capacity)
    for r in classrooms:
        for t in slots:
            used_r_t = model1.NewBoolVar(f"used_{r['id']}_{t['id']}")
            model1.AddMaxEquality(used_r_t, [z[v["id"], r["id"], t["id"]] for v in virtual_subjects])

            total_students_in_room = sum(v["student_count"] * z[v["id"], r["id"], t["id"]] for v in virtual_subjects)
            wastage = model1.NewIntVar(0, r["capacity"], f"wastage_{r['id']}_{t['id']}")
            model1.Add(wastage == r["capacity"] * used_r_t - total_students_in_room)
            penalties.append(w["room_wastage_unit"] * wastage)

    # C. Minimize room switching for student groups
    for g, g_subjs in group_subjects.items():
        for r in classrooms:
            uses_room = model1.NewBoolVar(f"uses_room_{g}_{r['id']}")
            group_v_subjs = []
            for sid in g_subjs:
                if sid in subject_parts_map:
                    for v in subject_parts_map[sid]:
                        group_v_subjs.append(y[v["id"], r["id"]])
            if group_v_subjs:
                model1.AddMaxEquality(uses_room, group_v_subjs)
                penalties.append(w["room_switching"] * uses_room)

    # D. Order chronologically by year: FY -> SY -> TY
    year_ranks = {"FY": 1, "SY": 2, "TY": 3}
    for v in virtual_subjects:
        rank = year_ranks.get(v["year"], 0)
        if rank > 0:
            for t in slots:
                d = t["date_idx"]
                if rank == 1:
                    coeff = w["order_fy_coefficient"] * d
                elif rank == 2:
                    coeff = w["order_sy_coefficient"] * d
                else:
                    coeff = w["order_fy_coefficient"] * (len(dates) - 1 - d)
                penalties.append(coeff * x[v["id"], t["id"]])

    # E. Compact schedule optimization & span penalty
    for g, g_subjs in group_subjects.items():
        if len(g_subjs) > 0:
            active_subjs = [sid for sid in g_subjs if sid in subject_parts_map]
            if not active_subjs:
                continue
            
            start_day_g = model1.NewIntVar(0, len(dates) - 1, f"start_day_{g}")
            end_day_g = model1.NewIntVar(0, len(dates) - 1, f"end_day_{g}")
            
            for sid in active_subjs:
                date_var = date_vars[sid]
                
                model1.Add(start_day_g <= date_var)
                model1.Add(end_day_g >= date_var)
                
                penalties.append(w["early_date_preference"] * date_var)
            
            span_g = model1.NewIntVar(0, len(dates) - 1, f"span_{g}")
            model1.Add(span_g == end_day_g - start_day_g)
            penalties.append(w["span_compactness"] * span_g)

    model1.Minimize(sum(penalties))

    class TelemetryCallback(cp_model.CpSolverSolutionCallback):
        def __init__(self):
            cp_model.CpSolverSolutionCallback.__init__(self)
            self.__solution_count = 0

        def on_solution_callback(self):
            self.__solution_count += 1
            obj = self.ObjectiveValue()
            time_elapsed = self.WallTime()
            print(f"TELEMETRY:{json.dumps({'objective': int(obj), 'time_ms': int(time_elapsed * 1000), 'solutions': self.__solution_count})}", flush=True)

    # Solve Phase 1
    solver1 = cp_model.CpSolver()
    solver1.parameters.max_time_in_seconds = time_limit
    cb = TelemetryCallback()
    status1 = solver1.Solve(model1, cb)

    if status1 not in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
        # Fall back to relaxed model for conflicts detection
        run_relaxed_solver(virtual_subjects, group_subjects, teaches_map, classrooms, slots, dates, is_cca, faculty_leaves, subject_constraints)
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
                    if v["orig_id"] in taught_subjs:
                        model2.Add(inv[f["id"], r["id"], t["id"]] == 0)

    # 3. Invigilator counts per active room:
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

    # Supervisor Load Balancing Penalties & Custom Constraints
    penalties2 = []
    if faculty:
        faculty_duties = {}
        for f in faculty:
            faculty_duties[f["id"]] = sum(inv[f["id"], r["id"], t["id"]] for r in classrooms for t in slots)

            # A. Check Exemption Toggle
            if f.get("exempted") == 1:
                model2.Add(faculty_duties[f["id"]] == 0)
                continue

            # B. Check Custom Min / Max duties bounds
            f_min = f.get("min_duties")
            f_max = f.get("max_duties")
            if f_min is not None:
                model2.Add(faculty_duties[f["id"]] >= int(f_min))
            if f_max is not None:
                model2.Add(faculty_duties[f["id"]] <= int(f_max))

            # C. Check Assignment Priority (Soft bias)
            p = f.get("priority", "normal")
            if p == "high":
                penalties2.append(-10 * faculty_duties[f["id"]])
            elif p == "low":
                penalties2.append(10 * faculty_duties[f["id"]])

        # D. Consecutive Duties Constraint (sliding window on the same day)
        slots_by_date = {}
        for t in slots:
            d = t["date"]
            if d not in slots_by_date:
                slots_by_date[d] = []
            slots_by_date[d].append(t)
        
        for d in slots_by_date:
            slots_by_date[d].sort(key=lambda x: x["start_time"])

        for f in faculty:
            if f.get("exempted") == 1:
                continue
            max_con = f.get("max_consecutive", 2)
            if max_con is None:
                max_con = 2
            
            for d, day_slots in slots_by_date.items():
                if len(day_slots) > max_con:
                    for i in range(len(day_slots) - max_con):
                        window = day_slots[i : i + max_con + 1]
                        model2.Add(sum(inv[f["id"], r["id"], t["id"]] for r in classrooms for t in window) <= max_con)

        # E. Global load balancing (only applicable for non-exempted faculty)
        active_faculty_duties = [duties for fid, duties in faculty_duties.items() 
                                 if next((fac for fac in faculty if fac["id"] == fid), {}).get("exempted") != 1]
        
        if active_faculty_duties:
            max_duties = model2.NewIntVar(0, len(slots), "max_duties")
            min_duties = model2.NewIntVar(0, len(slots), "min_duties")
            model2.AddMaxEquality(max_duties, active_faculty_duties)
            model2.AddMinEquality(min_duties, active_faculty_duties)
            penalties2.append(w["supervisor_load_balance"] * (max_duties - min_duties))

    model2.Minimize(sum(penalties2))

    # Solve Phase 2
    solver2 = cp_model.CpSolver()
    solver2.parameters.max_time_in_seconds = 10
    status2 = solver2.Solve(model2)

    # Build success output structure (merging virtual parts back into their original subjects)
    output_slots_map = {}
    for s in context["subjects"]:
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

    # Invigilator duties output
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

def run_relaxed_solver(virtual_subjects, group_subjects, teaches_map, classrooms, slots, dates, is_cca, faculty_leaves, subject_constraints):
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

    # Subject constraints (lockout or fixed slots)
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
    subj_parts = {}
    for v in virtual_subjects:
        if v["orig_id"] not in subj_parts:
            subj_parts[v["orig_id"]] = []
        subj_parts[v["orig_id"]].append(v)

    for g, g_subjs in group_subjects.items():
        for t in slots:
            slack = model.NewBoolVar(f"slack_parity_{g}_{t['id']}")
            reps = [x[subj_parts[sid][0]["id"], t["id"]] for sid in g_subjs if sid in subj_parts]
            if reps:
                model.Add(sum(reps) <= 1 + len(g_subjs) * slack)
                slack_branch_overlap.append((slack, g, t["date"], t["start_time"]))

    # 4. Max 2 exams/day (Hard)
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
        backlog_date_vars = {}
        regular_date_vars = {}
        for bs in backlog_subjects:
            d = model.NewIntVar(0, len(dates), f"date_bs_{bs['id']}")
            model.Add(d == sum(t["date_idx"] * x[bs["id"], t["id"]] for t in slots))
            backlog_date_vars[bs["id"]] = d
        for rs in regular_subjects:
            d = model.NewIntVar(0, len(dates), f"date_rs_{rs['id']}")
            model.Add(d == sum(t["date_idx"] * x[rs["id"], t["id"]] for t in slots))
            regular_date_vars[rs["id"]] = d
        for bs in backlog_subjects:
            for rs in regular_subjects:
                is_violation = model.NewBoolVar(f"slack_backlog_{bs['id']}_{rs['id']}")
                model.Add(backlog_date_vars[bs["id"]] < regular_date_vars[rs["id"]]).OnlyEnforceIf(is_violation.Not())
                model.Add(backlog_date_vars[bs["id"]] >= regular_date_vars[rs["id"]]).OnlyEnforceIf(is_violation)
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
