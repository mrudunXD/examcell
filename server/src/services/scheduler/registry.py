from student_conflict import StudentConflictConstraint
from room_capacity import RoomCapacityConstraint

class ConstraintRegistry:
    def __init__(self):
        self._constraints = []
        # Pre-register built-in constraint plugins
        self.register(StudentConflictConstraint())
        self.register(RoomCapacityConstraint())

    def register(self, constraint_plugin):
        self._constraints.append(constraint_plugin)

    def apply_all(self, model, context, variables):
        applied_count = 0
        for constraint in self._constraints:
            if constraint.validate(context):
                constraint.apply(model, context, variables)
                applied_count += 1
            else:
                print(f"⚠️ Warning: Constraint '{constraint.name}' failed validation, skipping.")
        return applied_count
