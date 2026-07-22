from base import BaseConstraint

class RoomCapacityConstraint(BaseConstraint):
    def __init__(self):
        super().__init__("RoomCapacity", "hard")

    def validate(self, context) -> bool:
        return "classrooms" in context and "virtual_subjects" in context

    def apply(self, model, context, variables):
        x = variables["x"]
        y = variables["y"]
        z = variables["z"]
        classrooms = context["classrooms"]
        virtual_subjects = context["virtual_subjects"]
        slots = context["slots"]

        # 1. Online Room Compatibility
        for v in virtual_subjects:
            is_subj_online = v.get("exam_mode") == "online"
            for r in classrooms:
                is_room_online = r.get("is_online", 0) == 1
                if is_subj_online and not is_room_online:
                    model.Add(y[v["id"], r["id"]] == 0)

        # 2. Room capacity limit per slot
        for r in classrooms:
            for t in slots:
                model.Add(sum(v["student_count"] * z[v["id"], r["id"], t["id"]] for v in virtual_subjects) <= r["capacity"])

        # 3. Room Sharing constraints: Limit number of virtual subjects sharing a room at slot t to 2
        for r in classrooms:
            for t in slots:
                model.Add(sum(z[v["id"], r["id"], t["id"]] for v in virtual_subjects) <= 2)

        # 4. Same-branch room sharing forbidden (different subjects of the same branch cannot share the same room at slot t)
        # Linear formulation (O(R * T * Branches) instead of O(R * T * V^2))
        branch_code_vsubjects = {}
        for v in virtual_subjects:
            key = (v["branch"], v["code"])
            if key not in branch_code_vsubjects:
                branch_code_vsubjects[key] = []
            branch_code_vsubjects[key].append(v["id"])

        branch_groups = {}
        for (b, code), v_ids in branch_code_vsubjects.items():
            if b not in branch_groups:
                branch_groups[b] = []
            branch_groups[b].append((code, v_ids))

        for b, codes_list in branch_groups.items():
            if len(codes_list) > 1:
                for r in classrooms:
                    for t in slots:
                        code_used_vars = []
                        for code, v_ids in codes_list:
                            code_used = model.NewBoolVar(f"br_{b}_cd_{code}_r_{r['id']}_t_{t['id']}")
                            model.AddMaxEquality(code_used, [z[vid, r["id"], t["id"]] for vid in v_ids])
                            code_used_vars.append(code_used)
                        model.Add(sum(code_used_vars) <= 1)
