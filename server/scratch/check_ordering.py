import json
import sys
from ortools.sat.python import cp_model
# Reuse code from scheduler.py to solve and print results
import sys
sys.path.append('src/services')
import scheduler

def test_ordering():
    with open("scratch_input.json", "r") as f:
        input_data = json.load(f)

    # We can invoke solve directly or simulate it
    # Let's run the solver process
    import subprocess
    t0 = subprocess.time.time()
    p = subprocess.Popen(['python', 'src/services/scheduler.py'], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    stdout, stderr = p.communicate(input=json.dumps(input_data))
    
    try:
        res = json.loads(stdout)
    except Exception as e:
        print("Failed to parse stdout:", stdout)
        print("Stderr:", stderr)
        return

    if res["status"] == "SUCCESS":
        print("Schedule solved successfully!")
        slots = res["slots"]
        # Group slot dates by year
        year_dates = {"FY": [], "SY": [], "TY": []}
        
        # We need to find the year of each subject.
        # Let's build a map from subject_code to year
        subj_year = {}
        for s in input_data["subjects"]:
            subj_year[s["code"]] = s["year"]

        for s in slots:
            code = s["subject_code"]
            yr = subj_year.get(code)
            if yr in year_dates:
                year_dates[yr].append((s["date"], s["start_time"]))

        for yr in ["FY", "SY", "TY"]:
            print(f"\n{yr} Exams ({len(year_dates[yr])}):")
            # Sort chronologically
            sorted_slots = sorted(year_dates[yr])
            for d, t in sorted_slots:
                print(f"  {d} at {t}")
    else:
        print("Solver failed. Conflicts:", res.get("conflicts"))

if __name__ == "__main__":
    test_ordering()
