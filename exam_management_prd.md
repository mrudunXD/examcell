# Product Requirements Document
## Exam Management System — MIT World Peace University, Pune
**Version:** 1.0  
**Author:** Mrudun (CSE, MIT WPU)  
**Supervisor:** HOD / Exam Coordinator, MIT WPU  
**Date:** June 2026  
**Status:** Draft — pending HOD review

---

## 1. Problem Statement

The examination department at MIT WPU currently manages all exam logistics — seating arrangements, supervisor assignments, timetable scheduling, and room allocation — entirely through manual processes. This involves multiple people working from disconnected spreadsheets, printed lists, and verbal coordination, with no single authoritative source of information. The result is a high risk of errors (double-booked rooms, missing supervisor assignments, students placed in wrong halls), significant time overhead for the exam coordinator before every examination cycle, and no reliable audit trail when something goes wrong.

With hundreds of students and dozens of faculty across multiple branches and semesters, the cost of even a single coordination failure on exam day — a supervisor not showing up, a student at the wrong bench, a room overfilled — falls on students who have no recourse and on faculty who must improvise under pressure.

---

## 2. Goals

| # | Goal | How success is measured |
|---|------|------------------------|
| G1 | Eliminate manual seating chart generation | Coordinator generates a complete seating plan in under 5 minutes, down from several hours |
| G2 | Ensure every exam slot has supervisors assigned with zero conflicts | Zero instances of a room without a supervisor or a faculty member double-assigned |
| G3 | Provide a single source of truth accessible on any device | All faculty can view their duty sheet on a mobile browser without installing anything |
| G4 | Enable human review and override before anything is finalised | Every generated plan is explicitly approved by the coordinator before export or distribution |
| G5 | Produce printable documents that work even if the system is offline | PDFs exported before exam day are the operational fallback |

---

## 3. Non-Goals (v1)

| Non-goal | Reason out of scope |
|----------|-------------------|
| Student-facing login or personalised seat lookup | Seating info is posted physically at exam halls; a student portal adds auth complexity without proportional benefit in v1 |
| Automated SMS or email to students | Faculty communication is the priority; mass student notification is a separate system |
| Integration with MSBTE or university ERP | No API access to external systems; data will be entered manually |
| Attendance marking during the exam | Out of scope for scheduling; a separate concern with its own workflow |
| Timetable publishing to a public website | The coordinator controls when and how information is shared; auto-publishing is premature |
| Multi-university or multi-campus support | Built specifically for MIT WPU's structure and MSBTE K Scheme |

---

## 4. User Personas

### Persona A — Exam Coordinator (HOD)
**Name:** Prof. / HOD, Examination Cell  
**Device:** Laptop (primary), occasionally mobile  
**Technical comfort:** Moderate — comfortable with forms and spreadsheets, not a developer  
**Goal:** Run a complete exam cycle with correct seating, assigned supervisors, and printed documents — with minimal back-and-forth  
**Pain today:** Manually creates Excel sheets, calls faculty to confirm availability, reprints seating charts every time a change is made

### Persona B — Supervisor Faculty
**Name:** Any faculty member assigned exam duty  
**Device:** Mobile (primary)  
**Technical comfort:** Low to moderate — uses WhatsApp, can open a link  
**Goal:** Know which room they're in, on which date, for which exam, alongside whom  
**Pain today:** Receives duty information on paper or via WhatsApp forwarded message; changes are not always communicated

### Persona C — System Administrator (builder, v1)
**Name:** Mrudun (developer)  
**Goal:** Maintain and update the system, fix data errors, manage deployments  
**Access:** Full database and backend access

---

## 5. User Stories

### Coordinator (Persona A)

- As a coordinator, I want to import or enter the list of students appearing for each subject, so that the system has accurate data to allocate seats.
- As a coordinator, I want the system to automatically generate a seating arrangement that mixes students from different branches on the same bench row, so that students sitting adjacent are not from the same subject or branch.
- As a coordinator, I want to review the generated seating plan before it is finalised, so that I can catch and correct any errors before printing.
- As a coordinator, I want to override or manually reassign any student's seat, so that special cases (differently-abled students, late additions) are handled without regenerating the entire plan.
- As a coordinator, I want the system to automatically assign supervisors to rooms for each exam slot, respecting the rule that a faculty member may not supervise a subject they teach.
- As a coordinator, I want to see a conflict alert if any room is double-booked, any faculty member is assigned to two rooms simultaneously, or any student appears in two concurrent exams.
- As a coordinator, I want to export a printable seating chart PDF per room, showing bench positions with student names and roll numbers.
- As a coordinator, I want to export a duty sheet PDF per faculty member, showing their full schedule for the exam cycle.
- As a coordinator, I want a dashboard showing exam cycle status — how many rooms are filled, how many supervisors are assigned, and how many conflicts remain unresolved.

### Supervisor Faculty (Persona B)

- As a faculty supervisor, I want to log in and see only my duty assignments for the current exam cycle, so that I know exactly where I need to be and when.
- As a faculty supervisor, I want to view my duty sheet on my phone without needing to install an app, so that I can check it anywhere.
- As a faculty supervisor, I want to see the name of my co-supervisor for each room, so that I can coordinate with them if needed.

---

## 6. Functional Requirements

### P0 — Must Have (system cannot go live without these)

#### 6.1 Master Data Management
- **Students:** Add, edit, delete students with fields: name, roll number, branch, semester, year, scheme (K Scheme). Bulk import via CSV.
- **Subjects:** Add/edit subjects with: subject code, name, branch, semester, scheme. Link subjects to student groups.
- **Classrooms:** Add/edit rooms with: room number, block/building, total bench capacity, bench layout (rows × columns).
- **Faculty:** Add/edit faculty with: name, department, email, subjects they teach.
- **Exam Slots:** Define slots with: date, start time, duration, subject(s) being examined in that slot.

*Acceptance criteria:*
- Given a coordinator is logged in, when they submit a student entry form with all required fields, then the student appears in the master list immediately.
- Given a coordinator uploads a CSV file in the specified format, when the import completes, then all valid rows are added and invalid rows are listed with reasons.

#### 6.2 Seating Arrangement Engine
- System takes as input: a list of students registered for a subject, a list of rooms allocated for that exam slot, and room capacities.
- System distributes students across rooms, filling to capacity before moving to the next room.
- Within each room, students are sorted so that adjacent bench-mates (same row) are from different branches wherever possible.
- System assigns a specific bench position (row, column) to each student.
- Output is a per-room seating map with: student name, roll number, branch, bench row, bench column.

*Acceptance criteria:*
- Given 120 students from 3 branches in a room with 40 benches, when seating is generated, then no two adjacent students in the same row share the same branch (best-effort, flagged if impossible due to numerical imbalance).
- Given a room has capacity 40 and 45 students are assigned to it, when generation runs, then a conflict warning is raised before finalisation.

#### 6.3 Supervisor Assignment Engine
- System takes as input: list of exam slots, rooms per slot, faculty availability.
- System assigns at least one supervisor per room per slot, and a co-supervisor for rooms above a configurable threshold (default: 30 students).
- Constraint: a faculty member cannot supervise a subject they are listed as teaching.
- Constraint: a faculty member cannot be assigned to two rooms at the same time.
- Constraint: supervisor workload should be distributed as evenly as possible across all available faculty.

*Acceptance criteria:*
- Given faculty member X teaches Subject A, when supervisor assignment runs for Subject A's exam, then faculty X is not assigned to any room for that slot.
- Given faculty member Y is assigned to Room 101 at 10:00 AM, when assignment runs, then faculty Y is not simultaneously assigned to Room 102 at 10:00 AM.

#### 6.4 Conflict Detection
- Detects and displays: room capacity overflow, faculty double-assignment, student registered for two concurrent exams, exam slot with no supervisor assigned, room assigned to two different exam slots simultaneously.
- Conflicts are shown before the coordinator can export or finalise any document.
- Each conflict shows: conflict type, affected entities, suggested resolution.

*Acceptance criteria:*
- Given a conflict exists, when the coordinator attempts to export a seating chart, then the system blocks export and displays all unresolved conflicts.
- Given all conflicts are resolved, when the coordinator exports, then the export proceeds without warning.

#### 6.5 Human Review and Override
- Before any generated plan is finalised, coordinator sees a review screen showing the full plan.
- Coordinator can drag-and-drop or form-edit any student's seat assignment.
- Coordinator can reassign or swap supervisors on any room.
- Coordinator explicitly presses "Approve and finalise" before PDFs become available.
- Once finalised, changes require a coordinator to "unlock" the plan and re-approve.

#### 6.6 PDF Export
- Seating chart per room: room number, exam date/time, subject, list of students by bench position, printable layout matching physical bench arrangement.
- Duty sheet per faculty: faculty name, list of duties (date, time, room, subject, co-supervisor name).
- Consolidated timetable: all exam slots by date, with subject, rooms used, and student count per room.
- PDFs are generated server-side and available for download without requiring a live internet connection at the time of printing.

#### 6.7 Authentication and Role Access
- Login with email and password (hashed, salted).
- Two roles: Coordinator (full access) and Faculty (read-only, own duty sheet only).
- Session expires after 8 hours of inactivity.
- Coordinator can create and deactivate faculty accounts.

---

### P1 — Should Have (high priority, fast follow if not in v1)

- **Exam cycle management:** Group all data (slots, seating, supervisors) into a named cycle (e.g. "End Sem June 2026") so previous cycles are preserved and browsable.
- **Faculty confirmation:** Faculty can mark their duty as "acknowledged" so the coordinator can see who has seen their assignment.
- **Attendance placeholder:** A printable attendance sheet per room derived from the seating chart (roll number, name, signature column) — no digital capture, just a print output.
- **Change log:** Every change to a finalised plan is logged with timestamp and user, so there is an audit trail.
- **Dashboard notifications:** Inline alerts when: the exam cycle is approaching and supervisors are not fully assigned, or when a conflict is introduced by a data edit.

---

### P2 — Future Considerations (design should accommodate, not build now)

- Bulk student import from MSBTE-format hall ticket data.
- Student-facing seat lookup (enter roll number, get room + bench number).
- Invigilator mobile check-in on exam day.
- Analytics: average supervisor load per cycle, rooms used vs available over time.
- Multi-session exams (morning + afternoon slots with same room).

---

## 7. Non-Functional Requirements

| Requirement | Target |
|------------|--------|
| **Availability** | 99% uptime during exam preparation period (2 weeks before exam); graceful offline fallback via pre-exported PDFs |
| **Performance** | Seating generation for 1,000 students across 20 rooms completes in under 10 seconds |
| **Mobile usability** | Faculty duty sheet fully usable on a 375px-wide screen without horizontal scrolling |
| **Data integrity** | No student can be assigned two seats in the same exam slot; enforced at database level with unique constraints |
| **Security** | Passwords hashed with bcrypt; no plain-text credentials stored; faculty cannot access other faculty's data |
| **Printability** | All PDFs render correctly on A4 at standard print margins; tested before go-live |
| **Recoverability** | Daily database backups; coordinator can re-export any finalised plan at any time |

---

## 8. Technical Architecture (overview)

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | React + Tailwind CSS | Responsive, component-based, mobile-first |
| Backend | Node.js + Express | JavaScript throughout, lightweight, easy to deploy |
| Database | PostgreSQL | Relational model fits tightly; strong constraint enforcement |
| PDF generation | Puppeteer (server-side) | Renders seating charts with bench-grid layout accurately |
| Auth | JWT + bcrypt | Stateless sessions, standard and well-documented |
| Hosting | Railway / Render (VPS) | Free tier sufficient for internal university use; accessible on any device |
| Version control | GitHub (private repo) | Code backup and change history |

### Core Database Tables

```
students          id, name, roll_no, branch, semester, year, scheme
subjects          id, code, name, branch, semester, scheme
classrooms        id, room_no, block, capacity, bench_rows, bench_cols
faculty           id, name, department, email, password_hash, role
faculty_subjects  faculty_id, subject_id  (many-to-many: who teaches what)
exam_cycles       id, name, start_date, end_date, status
exam_slots        id, cycle_id, subject_id, date, start_time, duration_mins
room_allocations  id, exam_slot_id, classroom_id
seat_assignments  id, student_id, room_allocation_id, bench_row, bench_col
supervisor_duty   id, faculty_id, room_allocation_id, role (primary/co)
conflicts         id, cycle_id, type, description, status, created_at
audit_log         id, user_id, action, entity, entity_id, timestamp
```

---

## 9. Success Metrics

### Leading indicators (measurable within first exam cycle)
- Time to generate a complete seating plan: target < 5 minutes (from data entry complete to PDF ready)
- Coordinator-reported conflicts caught before exam day: target 100% (zero surprises on exam day)
- Faculty who can locate their duty sheet without calling the coordinator: target > 95%

### Lagging indicators (measured after 2–3 exam cycles)
- Reduction in coordinator time spent on exam logistics per cycle
- Number of on-day corrections needed (student at wrong bench, supervisor missing): target zero
- HOD satisfaction — qualitative review after first live cycle

---

## 10. Open Questions

| # | Question | Owner | Blocking? |
|---|---------|-------|-----------|
| OQ1 | What is the exact seating mixing rule? (alternate by bench, by row, by room?) | HOD | Yes — needed before seating engine is built |
| OQ2 | Does a supervisor's own department subject count as "their subject" or only subjects they personally teach? | HOD | Yes — needed before supervisor engine is built |
| OQ3 | How many supervisors are required per room? Is it capacity-based or fixed? | HOD | Yes |
| OQ4 | Are there rooms that are always reserved for differently-abled students? | HOD | No — can handle as manual override for v1 |
| OQ5 | Does the system need to handle re-exams / backlog students in the same cycle? | HOD | No — can scope to regular exam cycle for v1 |
| OQ6 | What is the server hosting situation — university-provided server, or external hosting? | HOD / IT | No — can develop locally and migrate |
| OQ7 | Will faculty receive their login credentials by email, or will coordinator distribute them? | HOD | No |

---

## 11. Timeline

| Phase | Scope | Target duration |
|-------|-------|----------------|
| Phase 1 — Foundation | Auth, all master data CRUD, CSV import | 2 weeks |
| Phase 2 — Seating engine | Generation algorithm, conflict detection, review/override UI | 1.5 weeks |
| Phase 3 — Supervisor engine | Assignment logic, conflict rules, faculty duty view | 1 week |
| Phase 4 — Outputs | PDF export (seating charts, duty sheets, timetable), dashboard | 1 week |
| Phase 5 — Testing & dry run | Full cycle dry run with HOD, bug fixes, mobile testing | 1 week |
| **Total** | | **~6.5 weeks** |

**Hard deadline:** System must be tested and approved before the next examination cycle begins. Dry run must happen at least 2 weeks before the first live use.

---

## 12. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Data entry errors in student/room data cause bad seating | Medium | High | Conflict detector + human review gate before any export |
| System unavailable on exam day | Low | High | All documents exported as PDF in advance; system is a planning tool, not an on-day dependency |
| Seating algorithm edge cases (uneven branch distribution) | Medium | Medium | Algorithm flags when perfect mixing is impossible; coordinator reviews and accepts |
| Scope creep extending timeline past exam date | Medium | High | Strict P0/P1 separation; P1 features deferred unless Phase 1–4 complete early |
| HOD requirements change mid-build | Medium | Medium | OQ1–OQ3 answered before engine coding begins; changes after that are v2 |

---

## 13. Approval

| Role | Name | Sign-off |
|------|------|---------|
| Developer | Mrudun | — |
| Exam Coordinator / HOD | Prof. [Name], MIT WPU | Pending |

---

*This document should be reviewed and signed off by the HOD before development of Phase 2 begins. Open questions OQ1, OQ2, and OQ3 are blocking and must be resolved before the seating and supervisor engines are coded.*
