import json
from ortools.sat.python import cp_model

def test():
    with open("scratch_input.json", "r") as f:
        input_data = json.load(f)

    cycle = input_data.get("cycle", {})
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

    model = cp_model.CpModel()

    # Variables
    x = {}
    for s in subjects:
        for t in slots:
            x[s["id"], t["id"]] = model.NewBoolVar(f"x_{s['id']}_{t['id']}")

    y = {}
    for s in subjects:
        for r in classrooms:
            y[s["id"], r["id"]] = model.NewBoolVar(f"y_{s['id']}_{r['id']}")

    C = {}
    for s in subjects:
        num_stud = subject_student_count[s["id"]]
        for r in classrooms:
            C[s["id"], r["id"]] = model.NewIntVar(0, max(num_stud, r["capacity"]), f"C_{s['id']}_{r['id']}")

    z = {}
    for s in subjects:
        for r in classrooms:
            for t in slots:
                z[s["id"], r["id"], t["id"]] = model.NewBoolVar(f"z_{s['id']}_{r['id']}_{t['id']}")
                model.AddBoolAnd([x[s["id"], t["id"]], y[s["id"], r["id"]]]).OnlyEnforceIf(z[s["id"], r["id"], t["id"]])
                model.AddBoolOr([x[s["id"], t["id"]].Not(), y[s["id"], r["id"]].Not()]).OnlyEnforceIf(z[s["id"], r["id"], t["id"]].Not())

    inv = {}
    for f in faculty:
        for r in classrooms:
            for t in slots:
                inv[f["id"], r["id"], t["id"]] = model.NewBoolVar(f"inv_{f['id']}_{r['id']}_{t['id']}")

    # 1. Each subject scheduled exactly once
    for s in subjects:
        model.Add(sum(x[s["id"], t["id"]] for t in slots) == 1)

    # 2. Branch & Semester Parity
    for g, g_subjs in group_subjects.items():
        for t in slots:
            model.Add(sum(x[sid, t["id"]] for sid in g_subjs) <= 1)

    # 3. Maximum 2 exams per day
    for g, g_subjs in group_subjects.items():
        for d_idx in range(len(dates)):
            day_slots = [t for t in slots if t["date_idx"] == d_idx]
            model.Add(sum(x[sid, t["id"]] for sid in g_subjs for t in day_slots) <= 2)

    # 5. Online Room Compatibility
    for s in subjects:
        is_subj_online = s.get("exam_mode") == "online"
        for r in classrooms:
            is_room_online = r.get("is_online", 0) == 1
            if is_subj_online and not is_room_online:
                model.Add(y[s["id"], r["id"]] == 0)

    # 6. Room student capacities and mapping
    for s in subjects:
        num_stud = subject_student_count[s["id"]]
        for r in classrooms:
            model.Add(C[s["id"], r["id"]] == 0).OnlyEnforceIf(y[s["id"], r["id"]].Not())
            model.Add(C[s["id"], r["id"]] > 0).OnlyEnforceIf(y[s["id"], r["id"]])
        model.Add(sum(C[s["id"], r["id"]] for r in classrooms) == num_stud)

    # 7. Room capacity limit per slot
    c_slot = {}
    for s in subjects:
        for r in classrooms:
            for t in slots:
                c_slot[s["id"], r["id"], t["id"]] = model.NewIntVar(0, r["capacity"], f"c_slot_{s['id']}_{r['id']}_{t['id']}")
                model.Add(c_slot[s["id"], r["id"], t["id"]] == 0).OnlyEnforceIf(x[s["id"], t["id"]].Not())
                model.Add(c_slot[s["id"], r["id"], t["id"]] == C[s["id"], r["id"]]).OnlyEnforceIf(x[s["id"], t["id"]])

    for r in classrooms:
        for t in slots:
            model.Add(sum(c_slot[s["id"], r["id"], t["id"]] for s in subjects) <= r["capacity"])

    # 8. Room Sharing constraints
    for r in classrooms:
        for t in slots:
            model.Add(sum(z[s["id"], r["id"], t["id"]] for s in subjects) <= 2)

    for r in classrooms:
        for t in slots:
            for idx1, s1 in enumerate(subjects):
                for idx2, s2 in enumerate(subjects):
                    if idx1 < idx2 and s1["branch"] == s2["branch"]:
                        model.Add(z[s1["id"], r["id"], t["id"]] + z[s2["id"], r["id"], t["id"]] <= 1)

    # 9. Invigilator constraints
    for f in faculty:
        taught_subjs = teaches_map.get(f["id"], set())
        for r in classrooms:
            for t in slots:
                for s in subjects:
                    if s["id"] in taught_subjs:
                        model.Add(inv[f["id"], r["id"], t["id"]] <= 1 - z[s["id"], r["id"], t["id"]])

    for f in faculty:
        for t in slots:
            model.Add(sum(inv[f["id"], r["id"], t["id"]] for r in classrooms) <= 1)

    used_r_t = {}
    is_mixed_r_t = {}
    for r in classrooms:
        for t in slots:
            used_r_t[r["id"], t["id"]] = model.NewBoolVar(f"used_{r['id']}_{t['id']}")
            model.AddMaxEquality(used_r_t[r["id"], t["id"]], [z[s["id"], r["id"], t["id"]] for s in subjects])

            is_mixed_r_t[r["id"], t["id"]] = model.NewBoolVar(f"mixed_{r['id']}_{t['id']}")
            model.Add(sum(z[s["id"], r["id"], t["id"]] for s in subjects) >= 2).OnlyEnforceIf(is_mixed_r_t[r["id"], t["id"]])
            model.Add(sum(z[s["id"], r["id"], t["id"]] for s in subjects) <= 1).OnlyEnforceIf(is_mixed_r_t[r["id"], t["id"]].Not())

            num_inv = sum(inv[f["id"], r["id"], t["id"]] for f in faculty)
            model.Add(num_inv == 0).OnlyEnforceIf(used_r_t[r["id"], t["id"]].Not())
            model.Add(num_inv >= 1).OnlyEnforceIf(used_r_t[r["id"], t["id"]])
            model.Add(num_inv >= 2).OnlyEnforceIf(is_mixed_r_t[r["id"], t["id"]])

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 10
    status = solver.Solve(model)
    print("Feasibility status:", solver.StatusName(status))

if __name__ == "__main__":
    test()
