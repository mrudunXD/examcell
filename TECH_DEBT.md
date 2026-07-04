# ExamCell Production Readiness & Architecture Audit (TECH_DEBT.md)

This document contains a prioritized audit of technical debt, architectural non-compliance, security vulnerabilities, database weaknesses, and performance bottlenecks identified in the ExamCell repository.

---

## 🔴 CRITICAL SEVERITY DEBT

### 1. Missing Repository Layer Integration in Controllers
* **Domain**: Architecture / Persistency Layer
* **Affected Files**: All files inside [routes/](file:///c:/Users/mrudu/Documents/Codes/exam/server/src/routes/) (e.g., `students.js`, `subjects.js`, `classrooms.js`, `supervisors.js`, `seating.js`, `attendance.js`, `incidents.js`)
* **Problem**: Although clean repositories (e.g. `UserRepository`, `StudentRepository`, `ClassroomRepository`, `SchedulingRepository`) exist in the `modules/` folder, they are **completely bypassed**. The controllers write raw PostgreSQL statements via `db.prepare(sql)` inline.
* **Technical Impact**: Tight coupling between API handlers and SQL query implementations. Inability to mock databases for unit testing. High risk of query duplication.
* **Business Impact**: Slower feature delivery and high risk of regression bugs during database structural changes.
* **Recommended Fix**: Import module repositories into corresponding routers and replace all inline `db.prepare` statements with repository methods.
* **Estimated Implementation Effort**: 12 hours (Medium risk).

### 2. Redundant Variables and CP-SAT Constraints in Scheduler
* **Domain**: Solver Performance / Math Correctness
* **Affected Files**: [solver.py](file:///c:/Users/mrudu/Documents/Codes/exam/server/src/services/scheduler/solver.py#L112-L115) and [preprocessor.py](file:///c:/Users/mrudu/Documents/Codes/exam/server/src/services/scheduler/preprocessor.py)
* **Problem**: The scheduler creates fresh integer variables `d1 = model1.NewIntVar()` and `d2 = model1.NewIntVar()` and adds mapping constraints (`d1 == sum(...)`) for **every pairwise subject gap check** for a student group.
* **Technical Impact**: If a student group has 6 subjects, it creates 15 redundant pairs where the same subject's date is mapped over and over again. This balloons the variable and constraint count inside CP-SAT, increasing solve time and memory usage.
* **Business Impact**: Potential solver time-out for large cohorts, leading to scheduling failures during cycles.
* **Recommended Fix**: Define a single `date_var` variable per subject once (and reuse it for both gap objective checks and span checks).
* **Estimated Implementation Effort**: 3 hours (Low risk).

### 3. Lack of Database Pagination on Student and Subject List Routes
* **Domain**: Backend & Client Performance
* **Affected Files**: [students.js](file:///c:/Users/mrudu/Documents/Codes/exam/server/src/routes/students.js#L46) and [subjects.js](file:///c:/Users/mrudu/Documents/Codes/exam/server/src/routes/subjects.js)
* **Problem**: The list endpoints execute unbounded queries (`SELECT * FROM students WHERE is_active=1`) without `LIMIT` or offset pagination.
* **Technical Impact**: Large datasets (e.g., 10,000+ students) cause high database read times, large JSON payload sizes, memory spikes in Node.js, and browser page freeze on rendering.
* **Business Impact**: System crashes during cycle preparation when loading student lists.
* **Recommended Fix**: Implement cursor-based or limit-offset pagination (`LIMIT ? OFFSET ?`) with filtering at the database layer.
* **Estimated Implementation Effort**: 4 hours (Low risk).

---

## 🟠 HIGH SEVERITY DEBT

### 1. Inconsistent Transactions on Multi-Write Endpoints
* **Domain**: Database Integrity
* **Affected Files**: [examCycles.js](file:///c:/Users/mrudu/Documents/Codes/exam/server/src/routes/examCycles.js) (creating/editing cycles), [supervisors.js](file:///c:/Users/mrudu/Documents/Codes/exam/server/src/routes/supervisors.js)
* **Problem**: Multiple database modifications (such as updating duty roles and recording logs) are executed sequentially without being wrapped inside a database Transaction (`db.transaction`).
* **Technical Impact**: Partial writes on network error or server crash, resulting in corrupted database relations (e.g., rooms allocated without seating maps, supervisors assigned without duties).
* **Business Impact**: Operational desynchronization where the live dashboard conflicts with classroom allocations.
* **Recommended Fix**: Wrap all multi-query writes inside Express controllers in `db.transaction()` callbacks.
* **Estimated Implementation Effort**: 6 hours (Medium risk).

### 2. Rate Limiter Redundancy and Missing UI Integration
* **Domain**: Security & API Design
* **Affected Files**: [index.js](file:///c:/Users/mrudu/Documents/Codes/exam/server/src/index.js#L78) and [auth.js](file:///c:/Users/mrudu/Documents/Codes/exam/server/src/routes/auth.js#L11)
* **Problem**: `loginLimiter` is defined twice: once globally in `index.js` (where it is unused) and once in `routes/auth.js` (where it is used).
* **Technical Impact**: Dead code cluttering main server configuration files.
* **Business Impact**: Confusing codebase setup for junior developers.
* **Recommended Fix**: Clean up the unused rate limiter instantiation in `index.js`.
* **Estimated Implementation Effort**: 0.5 hours (Negligible risk).

---

## 🟡 MEDIUM SEVERITY DEBT

### 1. Hardcoded Socket.IO Broadcasts inside Controllers
* **Domain**: Architecture / Domain Decoupling
* **Affected Files**: [attendance.js](file:///c:/Users/mrudu/Documents/Codes/exam/server/src/routes/attendance.js), [incidents.js](file:///c:/Users/mrudu/Documents/Codes/exam/server/src/routes/incidents.js), [examCycles.js](file:///c:/Users/mrudu/Documents/Codes/exam/server/src/routes/examCycles.js)
* **Problem**: Controllers directly import `broadcastUpdate` from Socket service to notify clients of event triggers (e.g., `ATTENDANCE_MARKED`, `INCIDENT_REPORTED`).
* **Technical Impact**: High coupling between the HTTP layer and the WebSocket delivery layer.
* **Recommended Fix**: Introduce an internal Event Bus (`EventEmitter`) so controllers emit events, and a dedicated Socket handler listens and delivers real-time notifications.
* **Estimated Implementation Effort**: 3 hours (Low risk).

### 2. Missing Optimistic Concurrency Checks on Cycle Updates
* **Domain**: Database Concurrency
* **Affected Files**: [examCycles.js](file:///c:/Users/mrudu/Documents/Codes/exam/server/src/routes/examCycles.js)
* **Problem**: Although `version` column is added to the cycle and slots table schema, the endpoints do not verify the version parameter when editing or scheduling a cycle.
* **Technical Impact**: Two coordinators modifying the same schedule slot simultaneously can overwrite each other's changes.
* **Recommended Fix**: Add a version matching clause (`WHERE id = ? AND version = ?`) during updates, matching the optimistic lock pattern of classrooms.
* **Estimated Implementation Effort**: 4 hours (Low risk).

---

## 🟢 LOW SEVERITY DEBT

### 1. Inconsistent Date and Time String Formatting Helpers
* **Domain**: Maintainability
* **Affected Files**: [export.js](file:///c:/Users/mrudu/Documents/Codes/exam/server/src/routes/export.js#L7)
* **Problem**: Formatting helper functions like `formatDate` and `formatTime` are defined inline inside the route file instead of a shared utility file.
* **Technical Impact**: Code duplication if other exports or routes need formatted date strings.
* **Recommended Fix**: Move formatting utilities into `server/src/utils/format.js`.
* **Estimated Implementation Effort**: 1 hour (Negligible risk).
