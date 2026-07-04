import json

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

def run_preprocessor(input_data):
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

    # Segment subjects exceeding classroom capacity
    max_cap = max(r["capacity"] for r in classrooms) if classrooms else 1
    virtual_subjects = []
    subject_parts_map = {}

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

    return {
        "cycle": cycle,
        "subjects": subjects,
        "classrooms": classrooms,
        "faculty": faculty,
        "teaches_map": teaches_map,
        "student_groups": student_groups,
        "subject_group_map": subject_group_map,
        "group_subjects": group_subjects,
        "slots": slots,
        "virtual_subjects": virtual_subjects,
        "subject_parts_map": subject_parts_map,
        "dates": dates,
        "is_cca": is_cca,
        "faculty_leaves": faculty_leaves,
        "subject_constraints": subject_constraints,
        "time_limit": time_limit
    }
