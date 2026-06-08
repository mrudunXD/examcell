import json
import time
from ortools.sat.python import cp_model

def solve_decoupled():
    with open("scratch_input.json", "r") as f:
        input_data = json.load(f)

    subjects = input_data.get("subjects", [])
    students = input_data.get("students", [])
    classrooms = input_data.get("classrooms", [])
    faculty = input_data.get("faculty", [])
    teaches = input_data.get("teaches", [])
    settings = input_data.get("settings", {})

    shifts = settings.get("shifts", [])
    dates = settings.get("dates", [])

    print(f"Loaded {len(subjects)} subjects, {len(students)} students, {len(classrooms)} classrooms, {len(faculty)} faculty.")

    teaches_map = {}
    for t in teaches:
        fid = t["faculty_id"]
        sid = t["subject_id"]
        if fid not in teaches_map:
            teaches_map[fid] = set()
        teaches_map[fid].add(sid)

    student_groups = {}
    for st in students:
        key = (st["branch"], st["year"], st["semester"])
        if key not in student_groups:
            student_groups[key] = []
        student_groups[key].append(st["id"])

    subject_group_map = {}
    for s in subjects:
        key = (s["branch"], s["year"], s["semester"])
        subject_group_map[s["id"]] = key

    group_subjects = {}
    for s in subjects:
        key = subject_group_map[s["id"]]
        if key not in group_subjects:
            group_subjects[key] = []
        group_subjects[key].append(s["id"])

    subject_student_count = {}
    for s in subjects:
        key = subject_group_map[s["id"]]
        subject_student_count[s["id"]] = len(student_groups.get(key, []))

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

    t0 = time.time()

    # ==========================================
    # PHASE 1: Solve Scheduling & Room Allocation
    # ==========================================
    print("--- Phase 1: Solving Schedule and Room Allocations ---")
    model1 = cp_model.CpModel()

    x = {}
    for s in subjects:
        for t in slots:
            x[s["id"], t["id"]] = model1.NewBoolVar(f"x_{s['id']}_{t['id']}")

    y = {}
    for s in subjects:
        for r in classrooms:
            y[s["id"], r["id"]] = model1.NewBoolVar(f"y_{s['id']}_{r['id']}")

    C = {}
    for s in subjects:
        num_stud = subject_student_count[s["id"]]
        for r in classrooms:
            C[s["id"], r["id"]] = model1.NewIntVar(0, max(num_stud, r["capacity"]), f"C_{s['id']}_{r['id']}")

    z = {}
    for s in subjects:
        for r in classrooms:
            for t in slots:
                z[s["id"], r["id"], t["id"]] = model1.NewBoolVar(f"z_{s['id']}_{r['id']}_{t['id']}")
                model1.AddBoolAnd([x[s["id"], t["id"]], y[s["id"], r["id"]]]).OnlyEnforceIf(z[s["id"], r["id"], t["id"]])
                model1.AddBoolOr([x[s["id"], t["id"]].Not(), y[s["id"], r["id"]].Not()]).OnlyEnforceIf(z[s["id"], r["id"], t["id"]].Not())

    # Constraints
    for s in subjects:
        model1.Add(sum(x[s["id"], t["id"]] for t in slots) == 1)

    for g, g_subjs in group_subjects.items():
        for t in slots:
            model1.Add(sum(x[sid, t["id"]] for sid in g_subjs) <= 1)

    for g, g_subjs in group_subjects.items():
        for d_idx in range(len(dates)):
            day_slots = [t for t in slots if t["date_idx"] == d_idx]
            model1.Add(sum(x[sid, t["id"]] for sid in g_subjs for t in day_slots) <= 2)

    for s in subjects:
        is_subj_online = s.get("exam_mode") == "online"
        for r in classrooms:
            is_room_online = r.get("is_online", 0) == 1
            if is_subj_online and not is_room_online:
                model1.Add(y[s["id"], r["id"]] == 0)

    for s in subjects:
        num_stud = subject_student_count[s["id"]]
        for r in classrooms:
            model1.Add(C[s["id"], r["id"]] == 0).OnlyEnforceIf(y[s["id"], r["id"]].Not())
            model1.Add(C[s["id"], r["id"]] > 0).OnlyEnforceIf(y[s["id"], r["id"]])
        model1.Add(sum(C[s["id"], r["id"]] for r in classrooms) == num_stud)

    c_slot = {}
    for s in subjects:
        for r in classrooms:
            for t in slots:
                c_slot[s["id"], r["id"], t["id"]] = model1.NewIntVar(0, r["capacity"], f"c_slot_{s['id']}_{r['id']}_{t['id']}")
                model1.Add(c_slot[s["id"], r["id"], t["id"]] == 0).OnlyEnforceIf(x[s["id"], t["id"]].Not())
                model1.Add(c_slot[s["id"], r["id"], t["id"]] == C[s["id"], r["id"]]).OnlyEnforceIf(x[s["id"], t["id"]])

    for r in classrooms:
        for t in slots:
            model1.Add(sum(c_slot[s["id"], r["id"], t["id"]] for s in subjects) <= r["capacity"])

    for r in classrooms:
        for t in slots:
            model1.Add(sum(z[s["id"], r["id"], t["id"]] for s in subjects) <= 2)

    for r in classrooms:
        for t in slots:
            for idx1, s1 in enumerate(subjects):
                for idx2, s2 in enumerate(subjects):
                    if idx1 < idx2 and s1["branch"] == s2["branch"]:
                        model1.Add(z[s1["id"], r["id"], t["id"]] + z[s2["id"], r["id"], t["id"]] <= 1)

    # Penalties
    penalties = []
    for g, g_subjs in group_subjects.items():
        if len(g_subjs) > 1:
            for i in range(len(g_subjs)):
                for j in range(i + 1, len(g_subjs)):
                    s1, s2 = g_subjs[i], g_subjs[j]
                    d1 = model1.NewIntVar(0, len(dates), f"d1_{s1}_{s2}")
                    d2 = model1.NewIntVar(0, len(dates), f"d2_{s1}_{s2}")
                    model1.Add(d1 == sum(t["date_idx"] * x[s1, t["id"]] for t in slots))
                    model1.Add(d2 == sum(t["date_idx"] * x[s2, t["id"]] for t in slots))

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

    for r in classrooms:
        for t in slots:
            used_r_t = model1.NewBoolVar(f"used_{r['id']}_{t['id']}")
            model1.AddMaxEquality(used_r_t, [z[s["id"], r["id"], t["id"]] for s in subjects])

            total_students_in_room = sum(c_slot[s["id"], r["id"], t["id"]] for s in subjects)
            wastage = model1.NewIntVar(0, r["capacity"], f"wastage_{r['id']}_{t['id']}")
            model1.Add(wastage == r["capacity"] * used_r_t - total_students_in_room)
            penalties.append(20 * wastage)

    for g, g_subjs in group_subjects.items():
        for r in classrooms:
            uses_room = model1.NewBoolVar(f"uses_room_{g}_{r['id']}")
            model1.AddMaxEquality(uses_room, [y[sid, r["id"]] for sid in g_subjs])
            penalties.append(15 * uses_room)

    model1.Minimize(sum(penalties))

    solver1 = cp_model.CpSolver()
    solver1.parameters.max_time_in_seconds = 20
    status1 = solver1.Solve(model1)

    print(f"Phase 1 Status: {solver1.StatusName(status1)} (Time: {time.time() - t0:.2f}s)")
    if status1 not in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
        print("Phase 1 failed to find a schedule.")
        return

    # Extract solved values for slots and rooms
    z_sol = {}
    x_sol = {}
    y_sol = {}
    C_sol = {}
    for s in subjects:
        for t in slots:
            x_sol[s["id"], t["id"]] = solver1.Value(x[s["id"], t["id"]])
        for r in classrooms:
            y_sol[s["id"], r["id"]] = solver1.Value(y[s["id"], r["id"]])
            C_sol[s["id"], r["id"]] = solver1.Value(C[s["id"], r["id"]])
            for t in slots:
                z_sol[s["id"], r["id"], t["id"]] = solver1.Value(z[s["id"], r["id"], t["id"]])

    # ==========================================
    # PHASE 2: Solve Invigilator Assignment
    # ==========================================
    print("\n--- Phase 2: Solving Supervisor Assignment ---")
    t1 = time.time()
    model2 = cp_model.CpModel()

    inv = {}
    for f in faculty:
        for r in classrooms:
            for t in slots:
                inv[f["id"], r["id"], t["id"]] = model2.NewBoolVar(f"inv_{f['id']}_{r['id']}_{t['id']}")

    # Active rooms and mixed rooms determined by Phase 1 solution
    used_r_t = {}
    is_mixed_r_t = {}
    for r in classrooms:
        for t in slots:
            # Active if any subject is scheduled in room r at slot t
            subjects_in_room = [s["id"] for s in subjects if z_sol[s["id"], r["id"], t["id"]] == 1]
            used_r_t[r["id"], t["id"]] = len(subjects_in_room) > 0
            is_mixed_r_t[r["id"], t["id"]] = len(subjects_in_room) >= 2

    # Supervisor constraints
    # 1. Single room per slot
    for f in faculty:
        for t in slots:
            model2.Add(sum(inv[f["id"], r["id"], t["id"]] for r in classrooms) <= 1)

    # 2. Cannot invigilate subjects they teach
    for f in faculty:
        taught_subjs = teaches_map.get(f["id"], set())
        for r in classrooms:
            for t in slots:
                # Get subjects actually scheduled in room r at slot t
                subjects_in_room = [s["id"] for s in subjects if z_sol[s["id"], r["id"], t["id"]] == 1]
                for sid in subjects_in_room:
                    if sid in taught_subjs:
                        model2.Add(inv[f["id"], r["id"], t["id"]] == 0)

    # 3. Invigilator counts per active room
    for r in classrooms:
        for t in slots:
            num_inv = sum(inv[f["id"], r["id"], t["id"]] for f in faculty)
            if not used_r_t[r["id"], t["id"]]:
                model2.Add(num_inv == 0)
            else:
                if is_mixed_r_t[r["id"], t["id"]]:
                    model2.Add(num_inv >= 2)
                else:
                    model2.Add(num_inv >= 1)

    # Penalties for supervisor load balancing
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

    solver2 = cp_model.CpSolver()
    solver2.parameters.max_time_in_seconds = 10
    status2 = solver2.Solve(model2)

    print(f"Phase 2 Status: {solver2.StatusName(status2)} (Time: {time.time() - t1:.2f}s)")
    print(f"Total time elapsed: {time.time() - t0:.2f}s")

    if status2 in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
        print("Success! Decoupled scheduling and supervisor assignment works.")
        # Print a sample of duty counts
        duties = {f["name"]: 0 for f in faculty}
        for f in faculty:
            for r in classrooms:
                for t in slots:
                    if solver2.Value(inv[f["id"], r["id"], t["id"]]) == 1:
                        duties[f["name"]] += 1
        print("Sample duty counts:", list(duties.items())[:10])

if __name__ == "__main__":
    solve_decoupled()
