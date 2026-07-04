from base import BaseConstraint

class StudentConflictConstraint(BaseConstraint):
    def __init__(self):
        super().__init__("StudentConflict", "hard")

    def validate(self, context) -> bool:
        return "group_subjects" in context and "slots" in context

    def apply(self, model, context, variables):
        x = variables["x"]
        group_subjects = context["group_subjects"]
        subject_parts_map = context["subject_parts_map"]
        slots = context["slots"]
        is_cca = context["is_cca"]
        dates = context["dates"]

        # 1. Branch & Semester Parity: A student group can have at most one exam in a slot
        for g, g_subjs in group_subjects.items():
            for t in slots:
                reps = [x[subject_parts_map[sid][0]["id"], t["id"]] for sid in g_subjs if sid in subject_parts_map]
                if reps:
                    model.Add(sum(reps) <= 1)

        # 2. Maximum exams per day per student group (CCA = 2, Final = 1)
        max_exams_per_day = 2 if is_cca else 1
        for g, g_subjs in group_subjects.items():
            for d_idx in range(len(dates)):
                day_slots = [t for t in slots if t["date_idx"] == d_idx]
                reps = [x[subject_parts_map[sid][0]["id"], t["id"]] for sid in g_subjs if sid in subject_parts_map]
                day_reps = [r for r in reps for t in day_slots]
                # Filter variables actually present
                valid_day_reps = []
                for sid in g_subjs:
                    if sid in subject_parts_map:
                        v_id = subject_parts_map[sid][0]["id"]
                        for t in day_slots:
                            valid_day_reps.append(x[v_id, t["id"]])
                if valid_day_reps:
                    model.Add(sum(valid_day_reps) <= max_exams_per_day)

        # 3. Minimum 1 hour gap between exams on the same day for CCA cycles
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
                                        model.Add(sum(reps_t1) + sum(reps_t2) <= 1)
