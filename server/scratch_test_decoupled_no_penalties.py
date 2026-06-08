import json
import time
from ortools.sat.python import cp_model

def solve_decoupled_no_penalties():
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
    # PHASE 1: Solve Scheduling & Room Allocation (NO PENALTIES)
    # ==========================================
    print("--- Phase 1: Solving Schedule and Room Allocations (No Penalties) ---")
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

    solver1 = cp_model.CpSolver()
    solver1.parameters.max_time_in_seconds = 60
    status1 = solver1.Solve(model1)

    print(f"Phase 1 Status: {solver1.StatusName(status1)} (Time: {time.time() - t0:.2f}s)")
    if status1 not in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
        print("Phase 1 failed to find a schedule.")
        return
    else:
        print("Feasible schedule found successfully!")

if __name__ == "__main__":
    solve_decoupled_no_penalties()
