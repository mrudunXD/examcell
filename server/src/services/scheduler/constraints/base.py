class BaseConstraint:
    """
    Abstract base class for all scheduling constraint plugins.
    Each constraint owns its validation and CP-SAT CP model application.
    """
    def __init__(self, name, priority_level="hard"):
        self.name = name
        self.priority_level = priority_level

    def validate(self, context) -> bool:
        """
        Check if the input datasets contain necessary attributes to apply this constraint.
        """
        return True

    def apply(self, model, context, variables):
        """
        Apply the constraint to the OR-Tools SAT model.
        """
        raise NotImplementedError("Constraints must implement apply()")

    def explain(self) -> str:
        """
        Return user-facing explanation of the constraint.
        """
        return f"Constraint rule: {self.name}"

    def priority(self) -> str:
        return self.priority_level
