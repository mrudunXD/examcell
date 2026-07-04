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

        # 4. Same-branch room sharing forbidden (except if they are parts of the same subject code)
        for r in classrooms:
            for t in slots:
                for idx1, v1 in enumerate(virtual_subjects):
                    for idx2, v2 in enumerate(virtual_subjects):
                        if idx1 < idx2 and v1["branch"] == v2["branch"]:
                            if v1["code"] != v2["code"]: # different subjects
                                model.Add(z[v1["id"], r["id"], t["id"]] + z[v2["id"], r["id"], t["id"]] <= 1)
