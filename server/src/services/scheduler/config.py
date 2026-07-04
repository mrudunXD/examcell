# Scheduler configuration parameters and optimization weights
# Moves institutional policies outside the solver logic.

DEFAULT_SETTINGS = {
    "time_limit_seconds": 30,
    "max_exams_per_day_cca": 2,
    "max_exams_per_day_final": 1,
    "min_gap_minutes_cca": 60,
    "max_subjects_for_gap_penalties": 6
}

# Optimization penalty weights (Minimization Objective)
OPTIMIZATION_WEIGHTS = {
    # Phase 1: Scheduling & Seating
    "gap_0_days": 100,        # Penalty if student has 0-day gap between exams
    "gap_1_days": 20,         # Penalty if student has 1-day gap between exams
    "room_wastage_unit": 20,  # Penalty per unused seat in allocated classrooms
    "room_switching": 15,     # Penalty if student group changes classrooms between slots
    
    # Chronological ordering preferences
    "order_fy_coefficient": 50,
    "order_sy_coefficient": 25,
    
    # Schedule span & compactness
    "early_date_preference": 10,
    "span_compactness": 30,
    
    # Phase 2: Invigilator Load Balance
    "supervisor_load_balance": 15
}
