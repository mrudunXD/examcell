import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '../../data/exam_management.db');
const DATA_DIR = path.join(__dirname, '../../data');

let db;

export function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

export function initDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');

  createTables();

  // Run schema migration upgrades if tables exist but lack ON DELETE SET NULL
  try {
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='attendance'").get();
    if (tableInfo && !tableInfo.sql.includes('ON DELETE SET NULL')) {
      console.log('🔄 Upgrading attendance table schema to support ON DELETE SET NULL...');
      db.transaction(() => {
        db.prepare('ALTER TABLE attendance RENAME TO attendance_old').run();
        db.prepare(`
          CREATE TABLE attendance (
            id TEXT PRIMARY KEY,
            slot_id TEXT NOT NULL REFERENCES exam_slots(id) ON DELETE CASCADE,
            student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
            room_allocation_id TEXT REFERENCES room_allocations(id) ON DELETE SET NULL,
            status TEXT NOT NULL DEFAULT 'absent' CHECK(status IN ('present','absent','late')),
            marked_by TEXT REFERENCES users(id),
            marked_at TEXT DEFAULT (datetime('now')),
            notes TEXT,
            UNIQUE(slot_id, student_id)
          )
        `).run();
        db.prepare('INSERT OR IGNORE INTO attendance SELECT * FROM attendance_old').run();
        db.prepare('DROP TABLE attendance_old').run();
        console.log('✅ attendance table upgraded successfully.');
      })();
    }
  } catch (err) {
    console.error('Failed to migrate attendance table:', err);
  }

  try {
    const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='incidents'").get();
    if (tableInfo && !tableInfo.sql.includes('ON DELETE SET NULL')) {
      console.log('🔄 Upgrading incidents table schema to support ON DELETE SET NULL...');
      db.transaction(() => {
        db.prepare('ALTER TABLE incidents RENAME TO incidents_old').run();
        db.prepare(`
          CREATE TABLE incidents (
            id TEXT PRIMARY KEY,
            slot_id TEXT REFERENCES exam_slots(id) ON DELETE CASCADE,
            room_allocation_id TEXT REFERENCES room_allocations(id) ON DELETE SET NULL,
            reported_by TEXT REFERENCES users(id),
            type TEXT NOT NULL CHECK(type IN ('malpractice','disturbance','technical','medical','other')),
            description TEXT NOT NULL,
            student_prn TEXT,
            action_taken TEXT,
            severity TEXT DEFAULT 'low' CHECK(severity IN ('low','medium','high')),
            status TEXT DEFAULT 'open' CHECK(status IN ('open','resolved','escalated')),
            created_at TEXT DEFAULT (datetime('now')),
            resolved_at TEXT
          )
        `).run();
        db.prepare('INSERT OR IGNORE INTO incidents SELECT * FROM incidents_old').run();
        db.prepare('DROP TABLE incidents_old').run();
        console.log('✅ incidents table upgraded successfully.');
      })();
    }
  } catch (err) {
    console.error('Failed to migrate incidents table:', err);
  }

  seedInitialData();

  console.log('✅ Database initialized:', DB_PATH);
  return db;
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('coordinator', 'faculty')),
      department TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      prn TEXT UNIQUE NOT NULL,
      roll_no TEXT NOT NULL,
      branch TEXT NOT NULL,
      year TEXT NOT NULL CHECK(year IN ('FY', 'SY', 'TY', 'LY')),
      semester INTEGER NOT NULL,
      scheme TEXT DEFAULT 'K Scheme',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      branch TEXT NOT NULL DEFAULT 'CSE',
      year TEXT NOT NULL CHECK(year IN ('FY', 'SY', 'TY', 'LY')),
      semester INTEGER NOT NULL,
      abbreviation TEXT,
      course_type TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(code, branch)
    );

    CREATE TABLE IF NOT EXISTS classrooms (
      id TEXT PRIMARY KEY,
      room_no TEXT UNIQUE NOT NULL,
      block TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      bench_rows INTEGER NOT NULL,
      bench_cols INTEGER NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS faculty_subjects (
      faculty_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
      PRIMARY KEY (faculty_id, subject_id)
    );

    CREATE TABLE IF NOT EXISTS exam_cycles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      semester_type TEXT DEFAULT 'odd' CHECK(semester_type IN ('odd','even')),
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'active', 'finalised', 'archived')),
      created_by TEXT REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS exam_slots (
      id TEXT PRIMARY KEY,
      cycle_id TEXT NOT NULL REFERENCES exam_cycles(id) ON DELETE CASCADE,
      subject_id TEXT NOT NULL REFERENCES subjects(id),
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      duration_mins INTEGER DEFAULT 180,
      exam_type TEXT DEFAULT 'regular' CHECK(exam_type IN ('regular','backlog')),
      exam_mode TEXT DEFAULT 'offline' CHECK(exam_mode IN ('offline','online')),
      status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'seating_generated', 'supervisors_assigned', 'finalised')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS slot_students (
      slot_id TEXT NOT NULL REFERENCES exam_slots(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      PRIMARY KEY (slot_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS room_allocations (
      id TEXT PRIMARY KEY,
      slot_id TEXT NOT NULL REFERENCES exam_slots(id) ON DELETE CASCADE,
      classroom_id TEXT NOT NULL REFERENCES classrooms(id),
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(slot_id, classroom_id)
    );

    CREATE TABLE IF NOT EXISTS seat_assignments (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES students(id),
      room_allocation_id TEXT NOT NULL REFERENCES room_allocations(id) ON DELETE CASCADE,
      bench_row INTEGER NOT NULL,
      bench_col INTEGER NOT NULL,
      is_approved INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(student_id, room_allocation_id),
      UNIQUE(room_allocation_id, bench_row, bench_col)
    );

    CREATE TABLE IF NOT EXISTS supervisor_duties (
      id TEXT PRIMARY KEY,
      faculty_id TEXT NOT NULL REFERENCES users(id),
      room_allocation_id TEXT NOT NULL REFERENCES room_allocations(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('primary', 'co')),
      acknowledged INTEGER DEFAULT 0,
      acknowledged_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(faculty_id, room_allocation_id)
    );

    CREATE TABLE IF NOT EXISTS conflicts (
      id TEXT PRIMARY KEY,
      cycle_id TEXT REFERENCES exam_cycles(id) ON DELETE CASCADE,
      slot_id TEXT REFERENCES exam_slots(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      affected_entities TEXT,
      suggested_resolution TEXT,
      status TEXT DEFAULT 'open' CHECK(status IN ('open', 'resolved', 'ignored')),
      created_at TEXT DEFAULT (datetime('now')),
      resolved_at TEXT,
      resolved_by TEXT REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      slot_id TEXT NOT NULL REFERENCES exam_slots(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      room_allocation_id TEXT REFERENCES room_allocations(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'absent' CHECK(status IN ('present','absent','late')),
      marked_by TEXT REFERENCES users(id),
      marked_at TEXT DEFAULT (datetime('now')),
      notes TEXT,
      UNIQUE(slot_id, student_id)
    );

    CREATE INDEX IF NOT EXISTS idx_students_branch ON students(branch);
    CREATE INDEX IF NOT EXISTS idx_students_year ON students(year);
    CREATE INDEX IF NOT EXISTS idx_exam_slots_cycle ON exam_slots(cycle_id);
    CREATE INDEX IF NOT EXISTS idx_seat_assignments_room ON seat_assignments(room_allocation_id);
    CREATE INDEX IF NOT EXISTS idx_supervisor_duties_faculty ON supervisor_duties(faculty_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_attendance_slot ON attendance(slot_id);
    CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);

    CREATE TABLE IF NOT EXISTS broadcasts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      sent_by TEXT REFERENCES users(id),
      priority TEXT DEFAULT 'normal' CHECK(priority IN ('normal','urgent','critical')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS broadcast_reads (
      broadcast_id TEXT REFERENCES broadcasts(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      read_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (broadcast_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS incidents (
      id TEXT PRIMARY KEY,
      slot_id TEXT REFERENCES exam_slots(id) ON DELETE CASCADE,
      room_allocation_id TEXT REFERENCES room_allocations(id) ON DELETE SET NULL,
      reported_by TEXT REFERENCES users(id),
      type TEXT NOT NULL CHECK(type IN ('malpractice','disturbance','technical','medical','other')),
      description TEXT NOT NULL,
      student_prn TEXT,
      action_taken TEXT,
      severity TEXT DEFAULT 'low' CHECK(severity IN ('low','medium','high')),
      status TEXT DEFAULT 'open' CHECK(status IN ('open','resolved','escalated')),
      created_at TEXT DEFAULT (datetime('now')),
      resolved_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_incidents_slot ON incidents(slot_id);
    CREATE INDEX IF NOT EXISTS idx_broadcasts_created ON broadcasts(created_at);
  `);
}

function seedInitialData() {
  const existing = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
  if (existing.cnt > 0) return;

  const coordHash = bcrypt.hashSync('admin123', 10);
  const coordId = crypto.randomUUID();

  db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, department)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(coordId, 'Admin Coordinator', 'admin@mitwpu.edu.in', coordHash, 'coordinator', 'Examination Cell');

  console.log('✅ Seeded default coordinator: admin@mitwpu.edu.in / admin123');
}
