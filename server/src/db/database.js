import pg from 'pg';

// Parse PostgreSQL TIMESTAMP (without time zone) (OID 1114) as UTC Date
pg.types.setTypeParser(1114, stringValue => {
  return new Date(stringValue.replace(' ', 'T') + 'Z');
});
import { AsyncLocalStorage } from 'async_hooks';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

let dbLatencySamples = [];
let dbSlowQueryLog = [];
let dbChaosModeEnabled = false;

export function setDbChaosMode(enabled) {
  dbChaosModeEnabled = enabled;
  console.log(`⚠️ Database Chaos Mode: ${enabled ? 'ENABLED' : 'DISABLED'}`);
}

export function getDbChaosMode() {
  return dbChaosModeEnabled;
}

export function getDbLatencyMetrics() {
  if (dbLatencySamples.length === 0) return 0;
  const sum = dbLatencySamples.reduce((s, x) => s + x, 0);
  return Math.round(sum / dbLatencySamples.length);
}

export function getSlowQueryLog() {
  return dbSlowQueryLog;
}

let lastOptimizationTime = 0;
let isOptimizing = false;

export async function triggerDbAutoOptimization() {
  const now = Date.now();
  if (isOptimizing || (now - lastOptimizationTime < 60 * 60 * 1000)) {
    return;
  }
  isOptimizing = true;
  lastOptimizationTime = now;
  console.log('⚠️ DATABASE LATENCY CRITICAL (avg > 200ms). Triggering auto-optimization...');
  setTimeout(async () => {
    try {
      const client = await pool.connect();
      try {
        console.log('🚀 Running database auto-optimization (VACUUM and REINDEX)...');
        await client.query('VACUUM');
        await client.query('REINDEX SCHEMA public');
        console.log('✓ Database auto-optimization complete.');
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('Failed to execute database auto-optimization:', err);
    } finally {
      isOptimizing = false;
    }
  }, 0);
}

dotenv.config();

const pgPassword = process.env.PGPASSWORD;
if (!pgPassword || pgPassword === 'REPLACE_WITH_STRONG_DB_PASSWORD') {
  console.error('FATAL: PGPASSWORD environment variable must be set to a strong password.');
  process.exit(1);
}

const pool = new pg.Pool({
  host: process.env.PGHOST || 'localhost',
  port: parseInt(process.env.PGPORT || '5432'),
  user: process.env.PGUSER || 'postgres',
  password: pgPassword,
  database: process.env.PGDATABASE || 'exam_management',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err, client) => {
  console.error('⚠️ Unexpected PostgreSQL pool error on idle client:', err.message);
});

const transactionContext = new AsyncLocalStorage();
let dbInstance = null;

export function getDb() {
  if (!dbInstance) throw new Error('Database not initialized');
  return dbInstance;
}

export async function initDb() {
  // Test connection
  const client = await pool.connect();
  try {
    console.log('Connected to PostgreSQL database successfully.');
  } finally {
    client.release();
  }

  dbInstance = new PgDatabase(pool);
  await dbInstance.initSchema();
  const { runMigrations } = await import('./migrations.js');
  await runMigrations();
  await seedInitialData();
  return dbInstance;
}

class PgDatabase {
  constructor(pool) {
    this.pool = pool;
  }

  pragma(str) {
    // Stub pragma calls since PostgreSQL doesn't use pragmas
    return null;
  }

  async close() {
    await this.pool.end();
  }

  prepare(sql) {
    return new PgStatement(this.pool, sql);
  }

  transaction(fn) {
    return async (...args) => {
      // Check if we are already in a transaction context
      const existingClient = transactionContext.getStore();
      if (existingClient) {
        return await fn(...args);
      }

      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        const result = await transactionContext.run(client, async () => {
          return await fn(...args);
        });
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    };
  }

  async initSchema() {
    const client = transactionContext.getStore() || this.pool;
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('coordinator', 'faculty')),
        department TEXT,
        is_active INTEGER DEFAULT 1,
        must_change_password INTEGER DEFAULT 0,
        failed_login_attempts INTEGER DEFAULT 0,
        lockout_until TIMESTAMP,
        min_duties INTEGER DEFAULT NULL,
        max_duties INTEGER DEFAULT NULL,
        max_consecutive INTEGER DEFAULT 2,
        exempted INTEGER DEFAULT 0,
        priority TEXT DEFAULT 'normal',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS students (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        prn TEXT UNIQUE NOT NULL,
        roll_no TEXT NOT NULL,
        branch TEXT NOT NULL,
        section TEXT,
        year TEXT NOT NULL CHECK(year IN ('FY', 'SY', 'TY', 'LY')),
        semester INTEGER NOT NULL,
        scheme TEXT DEFAULT 'K Scheme',
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(code, branch)
      );

      CREATE TABLE IF NOT EXISTS classrooms (
        id TEXT PRIMARY KEY,
        room_no TEXT UNIQUE NOT NULL,
        block TEXT NOT NULL,
        capacity INTEGER NOT NULL,
        bench_rows INTEGER NOT NULL,
        bench_cols INTEGER NOT NULL,
        is_online INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        version INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        version INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(slot_id, classroom_id)
      );

      CREATE TABLE IF NOT EXISTS seat_assignments (
        id TEXT PRIMARY KEY,
        student_id TEXT NOT NULL REFERENCES students(id),
        room_allocation_id TEXT NOT NULL REFERENCES room_allocations(id) ON DELETE CASCADE,
        bench_row INTEGER NOT NULL,
        bench_col INTEGER NOT NULL,
        is_approved INTEGER DEFAULT 0,
        version INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
        hash TEXT,
        prev_hash TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS attendance (
        id TEXT PRIMARY KEY,
        slot_id TEXT NOT NULL REFERENCES exam_slots(id) ON DELETE CASCADE,
        student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
        room_allocation_id TEXT REFERENCES room_allocations(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'absent' CHECK(status IN ('present','absent','late')),
        marked_by TEXT REFERENCES users(id),
        marked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        notes TEXT,
        UNIQUE(slot_id, student_id)
      );

      CREATE TABLE IF NOT EXISTS broadcasts (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        sent_by TEXT REFERENCES users(id),
        priority TEXT DEFAULT 'normal' CHECK(priority IN ('normal','urgent','critical')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS broadcast_reads (
        broadcast_id TEXT REFERENCES broadcasts(id) ON DELETE CASCADE,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
        evidence_image TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TEXT
      );

      CREATE TABLE IF NOT EXISTS replacement_requests (
        id TEXT PRIMARY KEY,
        duty_id TEXT NOT NULL REFERENCES supervisor_duties(id) ON DELETE CASCADE,
        faculty_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reason TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        resolved_at TEXT,
        resolved_by TEXT REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS invigilator_logs (
        id TEXT PRIMARY KEY,
        slot_id TEXT NOT NULL REFERENCES exam_slots(id) ON DELETE CASCADE,
        room_allocation_id TEXT NOT NULL REFERENCES room_allocations(id) ON DELETE CASCADE,
        logged_by TEXT REFERENCES users(id),
        type TEXT NOT NULL CHECK(type IN ('toilet_out', 'toilet_in', 'extra_booklet', 'relief_handover', 'other')),
        student_id TEXT REFERENCES students(id) ON DELETE SET NULL,
        details TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS faculty_leaves (
        id TEXT PRIMARY KEY,
        faculty_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        shift_id TEXT,
        reason TEXT,
        UNIQUE(faculty_id, date, shift_id)
      );

      CREATE TABLE IF NOT EXISTS subject_constraints (
        id TEXT PRIMARY KEY,
        subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        type TEXT NOT NULL CHECK(type IN ('excluded_date', 'fixed_slot')),
        date TEXT NOT NULL,
        shift_id TEXT,
        UNIQUE(subject_id, type, date, shift_id)
      );

      CREATE TABLE IF NOT EXISTS schedule_versions (
        id TEXT PRIMARY KEY,
        cycle_id TEXT REFERENCES exam_cycles(id) ON DELETE CASCADE,
        version_number INTEGER NOT NULL,
        snapshot_payload TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT,
        device TEXT,
        browser TEXT,
        os TEXT,
        ip_address TEXT,
        login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_revoked INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS user_roles (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        PRIMARY KEY (user_id, role)
      );

      CREATE TABLE IF NOT EXISTS user_permissions (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        permission TEXT NOT NULL,
        PRIMARY KEY (user_id, permission)
      );

      CREATE TABLE IF NOT EXISTS password_history (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS solver_runs (
        id TEXT PRIMARY KEY,
        cycle_id TEXT REFERENCES exam_cycles(id) ON DELETE CASCADE,
        input_payload TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_students_branch ON students(branch);
      CREATE INDEX IF NOT EXISTS idx_students_year ON students(year);
      CREATE INDEX IF NOT EXISTS idx_exam_slots_cycle ON exam_slots(cycle_id);
      CREATE INDEX IF NOT EXISTS idx_seat_assignments_room ON seat_assignments(room_allocation_id);
      CREATE INDEX IF NOT EXISTS idx_supervisor_duties_faculty ON supervisor_duties(faculty_id);
      CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
      CREATE INDEX IF NOT EXISTS idx_attendance_slot ON attendance(slot_id);
      CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
      CREATE INDEX IF NOT EXISTS idx_incidents_slot ON incidents(slot_id);
      CREATE INDEX IF NOT EXISTS idx_broadcasts_created ON broadcasts(created_at);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id);
    `);

    // Run dynamic migrations to add columns if they don't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS solver_telemetry (
        id TEXT PRIMARY KEY,
        cycle_id TEXT REFERENCES exam_cycles(id) ON DELETE CASCADE,
        solve_duration_ms INTEGER,
        status TEXT,
        constraints_count INTEGER,
        optimization_score INTEGER,
        infeasible_causes TEXT,
        soft_penalties TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='exam_cycles' AND column_name='version') THEN
          ALTER TABLE exam_cycles ADD COLUMN version INTEGER DEFAULT 1;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='exam_slots' AND column_name='version') THEN
          ALTER TABLE exam_slots ADD COLUMN version INTEGER DEFAULT 1;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='incidents' AND column_name='evidence_image') THEN
          ALTER TABLE incidents ADD COLUMN evidence_image TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_log' AND column_name='hash') THEN
          ALTER TABLE audit_log ADD COLUMN hash TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_log' AND column_name='prev_hash') THEN
          ALTER TABLE audit_log ADD COLUMN prev_hash TEXT;
        END IF;
        -- M10: Add version column to seat_assignments if missing (needed for optimistic concurrency)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='seat_assignments' AND column_name='version') THEN
          ALTER TABLE seat_assignments ADD COLUMN version INTEGER DEFAULT 1;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='must_change_password') THEN
          ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='failed_login_attempts') THEN
          ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='lockout_until') THEN
          ALTER TABLE users ADD COLUMN lockout_until TIMESTAMP;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='broadcasts' AND column_name='classroom_id') THEN
          ALTER TABLE broadcasts ADD COLUMN classroom_id TEXT REFERENCES classrooms(id) ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='broadcasts' AND column_name='expires_at') THEN
          ALTER TABLE broadcasts ADD COLUMN expires_at TIMESTAMP;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='broadcasts' AND column_name='image_url') THEN
          ALTER TABLE broadcasts ADD COLUMN image_url TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subjects' AND column_name='is_common') THEN
          ALTER TABLE subjects ADD COLUMN is_common INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subjects' AND column_name='branches') THEN
          ALTER TABLE subjects ADD COLUMN branches TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='min_duties') THEN
          ALTER TABLE users ADD COLUMN min_duties INTEGER DEFAULT NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='max_duties') THEN
          ALTER TABLE users ADD COLUMN max_duties INTEGER DEFAULT NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='max_consecutive') THEN
          ALTER TABLE users ADD COLUMN max_consecutive INTEGER DEFAULT 2;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='exempted') THEN
          ALTER TABLE users ADD COLUMN exempted INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='priority') THEN
          ALTER TABLE users ADD COLUMN priority TEXT DEFAULT 'normal';
        END IF;
        -- Missing user fields for auth and sessions
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='mfa_enabled') THEN
          ALTER TABLE users ADD COLUMN mfa_enabled INTEGER DEFAULT 0;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='mfa_secret') THEN
          ALTER TABLE users ADD COLUMN mfa_secret TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='last_login') THEN
          ALTER TABLE users ADD COLUMN last_login TIMESTAMP;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='last_password_change') THEN
          ALTER TABLE users ADD COLUMN last_password_change TIMESTAMP;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='employee_id') THEN
          ALTER TABLE users ADD COLUMN employee_id TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='username') THEN
          ALTER TABLE users ADD COLUMN username TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='phone') THEN
          ALTER TABLE users ADD COLUMN phone TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='profile_picture') THEN
          ALTER TABLE users ADD COLUMN profile_picture TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='designation') THEN
          ALTER TABLE users ADD COLUMN designation TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='status') THEN
          ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active';
        END IF;
        -- Missing slot_id on supervisor_duties
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='supervisor_duties' AND column_name='slot_id') THEN
          ALTER TABLE supervisor_duties ADD COLUMN slot_id TEXT REFERENCES exam_slots(id) ON DELETE CASCADE;
        END IF;
      END $$;

      CREATE INDEX IF NOT EXISTS idx_supervisor_duties_slot ON supervisor_duties(slot_id);

      CREATE TABLE IF NOT EXISTS broadcast_acknowledgments (
        broadcast_id TEXT REFERENCES broadcasts(id) ON DELETE CASCADE,
        classroom_id TEXT REFERENCES classrooms(id) ON DELETE CASCADE,
        acknowledged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        acknowledged_by TEXT REFERENCES users(id),
        PRIMARY KEY (broadcast_id, classroom_id)
      );

      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        default_value TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        validation_rules TEXT,
        updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS system_settings_history (
        id TEXT PRIMARY KEY,
        setting_key TEXT NOT NULL,
        old_value TEXT,
        new_value TEXT NOT NULL,
        updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS bugs (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        steps TEXT,
        severity TEXT DEFAULT 'minor' CHECK(severity IN ('cosmetic','minor','major','critical')),
        status TEXT DEFAULT 'open' CHECK(status IN ('open','in_progress','ai_suggested','fixed','closed')),
        page_url TEXT,
        reported_by TEXT REFERENCES users(id) ON DELETE SET NULL,
        reporter_name TEXT,
        reporter_role TEXT,
        browser_info TEXT,
        console_errors TEXT,
        image_url TEXT,
        notes TEXT,
        ai_root_cause TEXT,
        ai_explanation TEXT,
        ai_confidence INTEGER,
        ai_patches TEXT,
        ai_applied_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_bugs_status ON bugs(status);
      CREATE INDEX IF NOT EXISTS idx_bugs_severity ON bugs(severity);
    `);
  }
}

class PgStatement {
  constructor(pool, sql) {
    this.pool = pool;
    this.sql = sql;
    this.formatSql();
  }

  formatSql() {
    // Convert SQLite ? placeholders to PG $1, $2, $3...
    let index = 1;
    this.sql = this.sql.replace(/\?/g, () => `$${index++}`);

    // Convert SQLite INSERT OR IGNORE INTO to standard INSERT ... ON CONFLICT DO NOTHING
    if (this.sql.toUpperCase().includes('INSERT OR IGNORE INTO')) {
      this.sql = this.sql.replace(/INSERT OR IGNORE INTO/i, 'INSERT INTO');
      if (!this.sql.toUpperCase().includes('ON CONFLICT')) {
        this.sql += ' ON CONFLICT DO NOTHING';
      }
    }

    // Convert SQLite datetime('now') to PG CURRENT_TIMESTAMP
    this.sql = this.sql.replace(/datetime\('now'\)/ig, 'CURRENT_TIMESTAMP');

    // Convert SQLite GROUP_CONCAT to STRING_AGG
    this.sql = this.sql.replace(/GROUP_CONCAT\s*\(\s*DISTINCT\s+([^)]+)\)/ig, "STRING_AGG(DISTINCT $1, ',')");
    this.sql = this.sql.replace(/GROUP_CONCAT\s*\(\s*([^,)]+)\)/ig, "STRING_AGG($1, ',')");
    this.sql = this.sql.replace(/GROUP_CONCAT\s*\(\s*([\s\S]*?)\s*,\s*([\s\S]*?)\)/ig, "STRING_AGG($1, $2)");

    // PostgreSQL specific GROUP BY adaptations to satisfy strict column listing:
    // 1. subjects unique query
    this.sql = this.sql.replace(
      /SELECT\s+\*\s+FROM\s+subjects\s+WHERE\s+([\s\S]+?)\s+GROUP\s+BY\s+code(?:\s+ORDER\s+BY\s+code)?(?:\s+LIMIT\s+(\d+))?/i,
      (match, whereClause, limit) => {
        let replacement = `SELECT DISTINCT ON (code) * FROM subjects WHERE ${whereClause.trim()} ORDER BY code`;
        if (limit) {
          replacement += ` LIMIT ${limit}`;
        }
        return replacement;
      }
    );

    // 2. broadcasts grouping
    if (this.sql.includes('GROUP BY b.id') && !this.sql.includes('GROUP BY b.id, u.name')) {
      this.sql = this.sql.replace('GROUP BY b.id', 'GROUP BY b.id, u.name');
    }

    // 3. conflicts: facultyClashStmt
    if (this.sql.includes('GROUP BY sd.faculty_id, es.date, es.start_time') && !this.sql.includes('GROUP BY sd.faculty_id, es.date, es.start_time, u.name')) {
      this.sql = this.sql.replace('GROUP BY sd.faculty_id, es.date, es.start_time', 'GROUP BY sd.faculty_id, es.date, es.start_time, u.name');
    }

    // 4. conflicts: overflowStmt
    if (this.sql.includes('GROUP BY ra.id') && !this.sql.includes('GROUP BY ra.id, c.room_no, c.capacity, es.id, es.date')) {
      this.sql = this.sql.replace('GROUP BY ra.id', 'GROUP BY ra.id, c.room_no, c.capacity, es.id, es.date');
    }

    // 5. conflicts: studentClashStmt
    if (this.sql.includes('GROUP BY ss.student_id, es.date, es.start_time') && !this.sql.includes('GROUP BY ss.student_id, es.date, es.start_time, s.name, s.prn')) {
      this.sql = this.sql.replace('GROUP BY ss.student_id, es.date, es.start_time', 'GROUP BY ss.student_id, es.date, es.start_time, s.name, s.prn');
    }

    // 6. todaySlots / export: GROUP BY es.id
    if (this.sql.includes('GROUP BY es.id') && !this.sql.includes('GROUP BY es.id, s.id, s.name, s.code, s.branch, s.year, s.semester')) {
      this.sql = this.sql.replace('GROUP BY es.id', 'GROUP BY es.id, s.id, s.name, s.code, s.branch, s.year, s.semester');
    }
  }

  async execute(params) {
    if (dbChaosModeEnabled) {
      throw new Error('PostgreSQL database connection timed out (Simulated Chaos)');
    }
    const client = transactionContext.getStore() || this.pool;
    // Map params: convert JS Date objects to ISO strings if needed, and clean values
    const cleanParams = params.map(p => {
      if (p instanceof Date) return p.toISOString();
      return p;
    });
    const start = Date.now();
    try {
      return await client.query(this.sql, cleanParams);
    } finally {
      const duration = Date.now() - start;
      dbLatencySamples.push(duration);
      if (dbLatencySamples.length > 100) {
        dbLatencySamples.shift();
      }
      const avgLatency = getDbLatencyMetrics();
      if (avgLatency > 200) {
        triggerDbAutoOptimization();
      }
      if (duration > 50) {
        dbSlowQueryLog.push({
          sql: this.sql,
          duration,
          timestamp: new Date().toISOString()
        });
        if (dbSlowQueryLog.length > 50) {
          dbSlowQueryLog.shift();
        }
      }
    }
  }

  async all(...params) {
    const result = await this.execute(params);
    return result.rows;
  }

  async get(...params) {
    const result = await this.execute(params);
    return result.rows[0];
  }

  async run(...params) {
    const result = await this.execute(params);
    return {
      changes: result.rowCount,
      lastInsertRowid: null
    };
  }
}

async function seedInitialData() {
  const db = getDb();
  await seedDefaultSettings();

  const existing = await db.prepare('SELECT COUNT(*) as cnt FROM users').get();
  if (existing.cnt > 0) {
    // If the database is already seeded, check if the admin coordinator has the default password "admin123"
    // and upgrade it to "@Admin123" to match the updated autofill.
    const adminUser = await db.prepare("SELECT * FROM users WHERE email = 'admin@mitwpu.edu.in'").get();
    if (adminUser && bcrypt.compareSync('admin123', adminUser.password_hash)) {
      const upgradedHash = bcrypt.hashSync('@Admin123', 10);
      await db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(upgradedHash, adminUser.id);
      console.log('✅ Upgraded default coordinator password to @Admin123');
    }
    return;
  }

  const coordHash = bcrypt.hashSync('@Admin123', 10);
  const coordId = crypto.randomUUID();

  await db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, department, must_change_password)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).run(coordId, 'Admin Coordinator', 'admin@mitwpu.edu.in', coordHash, 'coordinator', 'Examination Cell');

  console.log('✅ Seeded default coordinator: admin@mitwpu.edu.in / @Admin123');
}

async function seedDefaultSettings() {
  const db = getDb();
  const existing = await db.prepare('SELECT COUNT(*) as cnt FROM system_settings').get();
  if (existing?.cnt > 0) return;

  const defaults = [
    // General
    { key: 'general.institutionName', value: 'MIT WPU', default_value: 'MIT WPU', category: 'general', description: 'Name of the university or institution' },
    { key: 'general.shortName', value: 'MIT WPU', default_value: 'MIT WPU', category: 'general', description: 'Short abbreviation' },
    { key: 'general.logo', value: '/logo.png', default_value: '/logo.png', category: 'general', description: 'Institutional logo image path' },
    { key: 'general.address', value: 'Kothrud, Pune, Maharashtra', default_value: 'Kothrud, Pune, Maharashtra', category: 'general', description: 'Postal address' },
    { key: 'general.timezone', value: 'Asia/Kolkata', default_value: 'Asia/Kolkata', category: 'general', description: 'System timezone' },
    { key: 'general.language', value: 'en', default_value: 'en', category: 'general', description: 'Interface language' },
    { key: 'general.dateFormat', value: 'DD/MM/YYYY', default_value: 'DD/MM/YYYY', category: 'general', description: 'Display date format' },
    { key: 'general.timeFormat', value: '12h', default_value: '12h', category: 'general', description: 'Display time format' },
    { key: 'general.theme', value: 'dark', default_value: 'dark', category: 'general', description: 'Default system theme' },
    { key: 'general.accentColor', value: '#a855f7', default_value: '#a855f7', category: 'general', description: 'Theme accent color' },
    { key: 'general.defaultLandingPage', value: '/dashboard', default_value: '/dashboard', category: 'general', description: 'Landing page route' },

    // Security
    { key: 'security.jwtExpiry', value: '1h', default_value: '1h', category: 'security', description: 'JWT Authentication Token expiry period' },
    { key: 'security.refreshTokenExpiry', value: '7d', default_value: '7d', category: 'security', description: 'Refresh token validity duration' },
    { key: 'security.passwordPolicyMinLength', value: '8', default_value: '8', category: 'security', description: 'Minimum characters for user passwords' },
    { key: 'security.passwordPolicyRequireSymbols', value: 'true', default_value: 'true', category: 'security', description: 'Require symbols in password strength check' },
    { key: 'security.loginAttemptLimit', value: '5', default_value: '5', category: 'security', description: 'Failed login attempts before account lock' },
    { key: 'security.accountLockoutDurationMins', value: '15', default_value: '15', category: 'security', description: 'Duration of account lockout in minutes' },
    { key: 'security.rateLimitWindowMins', value: '15', default_value: '15', category: 'security', description: 'Rate limit time window in minutes' },
    { key: 'security.rateLimitMaxRequests', value: '100', default_value: '100', category: 'security', description: 'Maximum requests allowed per window per client' },
    { key: 'security.allowedOrigins', value: '*', default_value: '*', category: 'security', description: 'CORS allowed origins list' },
    { key: 'security.trustedNetworks', value: '0.0.0.0/0', default_value: '0.0.0.0/0', category: 'security', description: 'Allowed CIDR subnets' },
    { key: 'security.auditLoggingEnabled', value: 'true', default_value: 'true', category: 'security', description: 'Enable system modification logging' },
    { key: 'security.sessionTimeoutMins', value: '30', default_value: '30', category: 'security', description: 'Inactivity session timeout duration' },

    // Database
    { key: 'database.connectionPoolMax', value: '20', default_value: '20', category: 'database', description: 'Max client connections in pool' },
    { key: 'database.idleTimeoutMillis', value: '30000', default_value: '30000', category: 'database', description: 'Connection idle retention period' },

    // Scheduling (Solver)
    { key: 'scheduling.solverMaxSolveTimeSecs', value: '60', default_value: '60', category: 'scheduling', description: 'Maximum search runtime before returning current best solution' },
    { key: 'scheduling.solverWorkerThreads', value: '8', default_value: '8', category: 'scheduling', description: 'CP-SAT search thread worker parallelism count' },
    { key: 'scheduling.solverRandomSeed', value: '42', default_value: '42', category: 'scheduling', description: 'Deterministic seed value for scheduler randomness' },
    { key: 'scheduling.solverLogSearch', value: 'true', default_value: 'true', category: 'scheduling', description: 'Output search log indicators during runtime' },
    { key: 'scheduling.solverParallelSearch', value: 'true', default_value: 'true', category: 'scheduling', description: 'Execute thread searching concurrently' },
    { key: 'scheduling.solverRestartStrategy', value: 'automatic', default_value: 'automatic', category: 'scheduling', description: 'Search restart frequency parameter' },
    { key: 'scheduling.solverMemoryLimitMb', value: '4096', default_value: '4096', category: 'scheduling', description: 'RAM usage ceiling during model compilation' },

    // Objective weights
    { key: 'weights.studentGap', value: '10', default_value: '10', category: 'scheduling', description: 'Weight penalty for consecutive student exams' },
    { key: 'weights.roomUtilization', value: '8', default_value: '8', category: 'scheduling', description: 'Weight reward for compact room assignments' },
    { key: 'weights.facultyBalance', value: '5', default_value: '5', category: 'scheduling', description: 'Weight penalty for skewed supervisor assignments' },
    { key: 'weights.morningPreference', value: '3', default_value: '3', category: 'scheduling', description: 'Weight preference for morning slot allocations' },
    { key: 'weights.preferredRoom', value: '4', default_value: '4', category: 'scheduling', description: 'Weight preference to assign designated home rooms' },
    { key: 'weights.examSpread', value: '7', default_value: '7', category: 'scheduling', description: 'Weight reward to maximize gap spacing between branch subjects' },
    { key: 'weights.roomSwitching', value: '2', default_value: '2', category: 'scheduling', description: 'Weight penalty for scheduling students in multiple rooms' },
    { key: 'weights.departmentPreference', value: '6', default_value: '6', category: 'scheduling', description: 'Weight reward to allocate matching department staff' },

    // Constraints toggles & details
    { key: 'scheduling.constraints.studentConflict.enabled', value: 'true', default_value: 'true', category: 'scheduling', description: 'Prevent students from having overlapping exams in the same slot' },
    { key: 'scheduling.constraints.studentConflict.priority', value: 'critical', default_value: 'critical', category: 'scheduling', description: 'Student Conflict constraint priority' },
    { key: 'scheduling.constraints.studentConflict.weight', value: '1000', default_value: '1000', category: 'scheduling', description: 'Student Conflict constraint penalty weight' },

    { key: 'scheduling.constraints.facultyConflict.enabled', value: 'true', default_value: 'true', category: 'scheduling', description: 'Prevent faculty from being assigned to multiple rooms simultaneously' },
    { key: 'scheduling.constraints.facultyConflict.priority', value: 'critical', default_value: 'critical', category: 'scheduling', description: 'Faculty Conflict constraint priority' },
    { key: 'scheduling.constraints.facultyConflict.weight', value: '1000', default_value: '1000', category: 'scheduling', description: 'Faculty Conflict constraint penalty weight' },

    { key: 'scheduling.constraints.roomConflict.enabled', value: 'true', default_value: 'true', category: 'scheduling', description: 'Prevent classrooms from double bookings in any single slot' },
    { key: 'scheduling.constraints.roomConflict.priority', value: 'critical', default_value: 'critical', category: 'scheduling', description: 'Room Conflict constraint priority' },
    { key: 'scheduling.constraints.roomConflict.weight', value: '1000', default_value: '1000', category: 'scheduling', description: 'Room Conflict constraint penalty weight' },

    { key: 'scheduling.constraints.capacity.enabled', value: 'true', default_value: 'true', category: 'scheduling', description: 'Prevent room assignments from exceeding student bench capacity limits' },
    { key: 'scheduling.constraints.capacity.priority', value: 'critical', default_value: 'critical', category: 'scheduling', description: 'Room capacity constraint priority' },
    { key: 'scheduling.constraints.capacity.weight', value: '1000', default_value: '1000', category: 'scheduling', description: 'Room capacity constraint penalty weight' },

    { key: 'scheduling.constraints.fixedSlot.enabled', value: 'true', default_value: 'true', category: 'scheduling', description: 'Pin subject exams to pre-allocated slots when requested' },
    { key: 'scheduling.constraints.fixedSlot.priority', value: 'high', default_value: 'high', category: 'scheduling', description: 'Fixed Slot constraint priority' },
    { key: 'scheduling.constraints.fixedSlot.weight', value: '500', default_value: '500', category: 'scheduling', description: 'Fixed Slot constraint penalty weight' },

    { key: 'scheduling.constraints.holiday.enabled', value: 'true', default_value: 'true', category: 'scheduling', description: 'Prevent scheduling exams on designated calendar holidays' },
    { key: 'scheduling.constraints.holiday.priority', value: 'critical', default_value: 'critical', category: 'scheduling', description: 'Holiday constraint priority' },
    { key: 'scheduling.constraints.holiday.weight', value: '1000', default_value: '1000', category: 'scheduling', description: 'Holiday constraint penalty weight' },

    { key: 'scheduling.constraints.facultyLeave.enabled', value: 'true', default_value: 'true', category: 'scheduling', description: 'Prevent duty assignments on days when faculty is on approved leave' },
    { key: 'scheduling.constraints.facultyLeave.priority', value: 'high', default_value: 'high', category: 'scheduling', description: 'Faculty Leave constraint priority' },
    { key: 'scheduling.constraints.facultyLeave.weight', value: '800', default_value: '800', category: 'scheduling', description: 'Faculty Leave constraint penalty weight' },

    { key: 'scheduling.constraints.maxExamsPerDay.enabled', value: 'true', default_value: 'true', category: 'scheduling', description: 'Enforce maximum exams a student can write in a single calendar day' },
    { key: 'scheduling.constraints.maxExamsPerDay.priority', value: 'high', default_value: 'high', category: 'scheduling', description: 'Max Exams Per Day constraint priority' },
    { key: 'scheduling.constraints.maxExamsPerDay.weight', value: '700', default_value: '700', category: 'scheduling', description: 'Max Exams Per Day constraint penalty weight' },

    { key: 'scheduling.constraints.morningPreference.enabled', value: 'true', default_value: 'true', category: 'scheduling', description: 'Distribute exams preferring morning shifts where possible' },
    { key: 'scheduling.constraints.morningPreference.priority', value: 'low', default_value: 'low', category: 'scheduling', description: 'Morning Shift Preference priority' },
    { key: 'scheduling.constraints.morningPreference.weight', value: '100', default_value: '100', category: 'scheduling', description: 'Morning Shift Preference penalty weight' },

    { key: 'scheduling.constraints.gapPreference.enabled', value: 'true', default_value: 'true', category: 'scheduling', description: 'Encourage minimum gap days between consecutive subject exams' },
    { key: 'scheduling.constraints.gapPreference.priority', value: 'medium', default_value: 'medium', category: 'scheduling', description: 'Gap spacing constraint priority' },
    { key: 'scheduling.constraints.gapPreference.weight', value: '300', default_value: '300', category: 'scheduling', description: 'Gap spacing constraint penalty weight' },

    { key: 'scheduling.constraints.departmentIsolation.enabled', value: 'true', default_value: 'true', category: 'scheduling', description: 'Isolate branches to distinct room clusters where possible' },
    { key: 'scheduling.constraints.departmentIsolation.priority', value: 'low', default_value: 'low', category: 'scheduling', description: 'Department Isolation constraint priority' },
    { key: 'scheduling.constraints.departmentIsolation.weight', value: '50', default_value: '50', category: 'scheduling', description: 'Department Isolation constraint penalty weight' },

    // Seating
    { key: 'seating.benchCapacity', value: '2', default_value: '2', category: 'seating', description: 'Default seating density count per bench' },
    { key: 'seating.alternateSeating', value: 'true', default_value: 'true', category: 'seating', description: 'Enforce branch-alternating arrangements' },
    { key: 'seating.mixedBranchSeating', value: 'true', default_value: 'true', category: 'seating', description: 'Allow seating multi-branch candidates in a classroom' },
    { key: 'seating.accessibleSeating', value: 'true', default_value: 'true', category: 'seating', description: 'Reserve ground-floor allocations for disabled candidates' },
    { key: 'seating.vipSeating', value: 'false', default_value: 'false', category: 'seating', description: 'Designated isolated room blocks' },
    { key: 'seating.reservedSeatsCount', value: '2', default_value: '2', category: 'seating', description: 'Buffer seating nodes to allocate late entries' },

    // Faculty
    { key: 'faculty.maxDuties', value: '6', default_value: '6', category: 'faculty', description: 'Ceiling duty cap allowed for faculty per cycle' },
    { key: 'faculty.minDuties', value: '2', default_value: '2', category: 'faculty', description: 'Minimum baseline duty target per faculty member' },
    { key: 'faculty.availabilityRules', value: 'weekday_only', default_value: 'weekday_only', category: 'faculty', description: 'Scope parameters for duty schedules' },
    { key: 'faculty.holidayRules', value: 'no_duties_on_holidays', default_value: 'no_duties_on_holidays', category: 'faculty', description: 'Restrict duties on holidays' },
    { key: 'faculty.departmentPreference', value: 'true', default_value: 'true', category: 'faculty', description: 'Assign faculty matching the branch department of exam' },
    { key: 'faculty.automaticBalancing', value: 'true', default_value: 'true', category: 'faculty', description: 'Balance duties count distribution automatically' },

    // Classrooms
    { key: 'classrooms.roomPriority', value: 'capacity_desc', default_value: 'capacity_desc', category: 'classrooms', description: 'Classroom selection sorting priority rules' },
    { key: 'classrooms.capacityBuffer', value: '10', default_value: '10', category: 'classrooms', description: 'Seat allocation safety buffer percentage' },
    { key: 'classrooms.smartClassroomPreference', value: 'true', default_value: 'true', category: 'classrooms', description: 'Prioritize rooms equipped with digital projection systems' },
    { key: 'classrooms.labRestrictions', value: 'true', default_value: 'true', category: 'classrooms', description: 'Prevent regular exams from being mapped to technical laboratories' },
    { key: 'classrooms.accessibility', value: 'true', default_value: 'true', category: 'classrooms', description: 'Ensure accessibility settings are applied' },

    // Notifications
    { key: 'notifications.emailEnabled', value: 'true', default_value: 'true', category: 'notifications', description: 'Send automated email briefs to faculty and students' },
    { key: 'notifications.smsEnabled', value: 'false', default_value: 'false', category: 'notifications', description: 'Relay notifications over SMS integrations' },
    { key: 'notifications.pushEnabled', value: 'true', default_value: 'true', category: 'notifications', description: 'Trigger web browser push indicator events' },
    { key: 'notifications.socketNotificationsEnabled', value: 'true', default_value: 'true', category: 'notifications', description: 'Push real-time warnings over WebSockets' },
    { key: 'notifications.emergencyBroadcastEnabled', value: 'true', default_value: 'true', category: 'notifications', description: 'Allow broadcast priority notifications' },

    // AI settings
    { key: 'ai.provider', value: 'gemini', default_value: 'gemini', category: 'ai', description: 'Primary Large Language Model engine supplier' },
    { key: 'ai.apiKey', value: 'REPLACE_WITH_API_KEY', default_value: 'REPLACE_WITH_API_KEY', category: 'ai', description: 'Credential token parameter' },
    { key: 'ai.model', value: 'gemini-1.5-pro', default_value: 'gemini-1.5-pro', category: 'ai', description: 'Model identifier value' },
    { key: 'ai.temperature', value: '0.2', default_value: '0.2', category: 'ai', description: 'Generative temperature setting (creativity limit)' },
    { key: 'ai.maxTokens', value: '2048', default_value: '2048', category: 'ai', description: 'Maximum token output length limit' },
    { key: 'ai.timeoutMs', value: '10000', default_value: '10000', category: 'ai', description: 'API timeout period' },
    { key: 'ai.dailyUsageLimit', value: '100', default_value: '100', category: 'ai', description: 'API rate limits daily call limit' },
    { key: 'ai.enableScheduleExplanation', value: 'true', default_value: 'true', category: 'ai', description: 'Allow explanation summarizations' },
    { key: 'ai.enableConflictExplanation', value: 'true', default_value: 'true', category: 'ai', description: 'Allow detail breakdown of clash vectors' },
    { key: 'ai.enableRiskAnalysis', value: 'true', default_value: 'true', category: 'ai', description: 'Expose telemetry risk checks' },
    { key: 'ai.enableNaturalLanguageScheduling', value: 'true', default_value: 'true', category: 'ai', description: 'Enable conversation schedules' },
    { key: 'ai.enableReportGeneration', value: 'true', default_value: 'true', category: 'ai', description: 'Enable natural language reports' },
    { key: 'ai.enableConstraintSuggestions', value: 'true', default_value: 'true', category: 'ai', description: 'Enable smart suggestions' },

    // Monitoring
    { key: 'monitoring.cpuThreshold', value: '80', default_value: '80', category: 'monitoring', description: 'Maximum allowed CPU utilization percent warning limit' },
    { key: 'monitoring.ramThreshold', value: '85', default_value: '85', category: 'monitoring', description: 'Maximum allowed RAM utilization percent warning limit' },
    { key: 'monitoring.diskThreshold', value: '90', default_value: '90', category: 'monitoring', description: 'Maximum disk write limit ceiling before warnings' },
    { key: 'monitoring.solverRuntimeThresholdSecs', value: '120', default_value: '120', category: 'monitoring', description: 'Timeout alerts threshold limit for solver computations' },
    { key: 'monitoring.prometheusEnabled', value: 'false', default_value: 'false', category: 'monitoring', description: 'Expose scraper metric payloads' },

    // Logging
    { key: 'logging.level', value: 'info', default_value: 'info', category: 'logging', description: 'Console diagnostics depth filter' },
    { key: 'logging.accessLogsEnabled', value: 'true', default_value: 'true', category: 'logging', description: 'Log incoming REST payload metadata' },
    { key: 'logging.errorLogsEnabled', value: 'true', default_value: 'true', category: 'logging', description: 'Trace error exception dumps' },
    { key: 'logging.accessLogsEnabled', value: 'true', default_value: 'true', category: 'logging', description: 'Enforce secure operation tracking' },
    { key: 'logging.solverLogsEnabled', value: 'true', default_value: 'true', category: 'logging', description: 'Record OR-Tools engine stdout' },
    { key: 'logging.socketLogsEnabled', value: 'true', default_value: 'true', category: 'logging', description: 'Record WebSocket event payloads' },
    { key: 'logging.retentionPeriodDays', value: '30', default_value: '30', category: 'logging', description: 'Log database row retention period limit' },

    // Performance
    { key: 'performance.cacheDurationSecs', value: '300', default_value: '300', category: 'performance', description: 'Response caching duration' },
    { key: 'performance.compressionEnabled', value: 'true', default_value: 'true', category: 'performance', description: 'Gzip compress response buffers' },
    { key: 'performance.workerThreads', value: '4', default_value: '4', category: 'performance', description: 'HTTP node event threads parallelism' },
    { key: 'performance.socketHeartbeatSecs', value: '25', default_value: '25', category: 'performance', description: 'Ping interval to maintain persistent connections' },
    { key: 'performance.apiTimeoutMs', value: '30000', default_value: '30000', category: 'performance', description: 'Global API call response timeout threshold' },

    // Backup
    { key: 'backup.manualBackupEnabled', value: 'true', default_value: 'true', category: 'backup', description: 'Allow manually executing data backup requests' },
    { key: 'backup.autoBackupEnabled', value: 'true', default_value: 'true', category: 'backup', description: 'Trigger automatic backups' },
    { key: 'backup.schedule', value: '0 0 * * *', default_value: '0 0 * * *', category: 'backup', description: 'Cron schedule expression for auto backups' },
    { key: 'backup.cloudBackupEnabled', value: 'false', default_value: 'false', category: 'backup', description: 'Relay backup archives to cloud object stores' },
    { key: 'backup.retentionCount', value: '10', default_value: '10', category: 'backup', description: 'Maximum backup copies to keep before cleaning up' },
    { key: 'backup.verificationEnabled', value: 'true', default_value: 'true', category: 'backup', description: 'Run integrity checks on created database snapshots' },

    // Feature flags
    { key: 'flags.enableExperimentalSolver', value: 'false', default_value: 'false', category: 'flags', description: 'Activate new ML-based constraint search optimizations' },
    { key: 'flags.enableConflictHotReload', value: 'false', default_value: 'false', category: 'flags', description: 'Re-detect conflicts instantly when data shifts in seating' },
    { key: 'flags.enableAdvancedAnalytics', value: 'true', default_value: 'true', category: 'flags', description: 'Show forecasting charts in dashboards' },
    { key: 'flags.enableParallelScheduling', value: 'false', default_value: 'false', category: 'flags', description: 'Solve multiple exam slots simultaneously using separate workers' },

    // Academic Policies
    { key: 'academic.workingDays', value: 'Mon,Tue,Wed,Thu,Fri,Sat', default_value: 'Mon,Tue,Wed,Thu,Fri,Sat', category: 'academic', description: 'Scheduled institute working days list' },
    { key: 'academic.examTypes', value: 'regular,backlog', default_value: 'regular,backlog', category: 'academic', description: 'Allowed exam type tags' },
    { key: 'academic.semesterStructure', value: '1-8', default_value: '1-8', category: 'academic', description: 'Semester scope parameters' },
    { key: 'academic.shiftTimings', value: '09:00-12:00,14:00-17:00', default_value: '09:00-12:00,14:00-17:00', category: 'academic', description: 'Daily slot shift hours (comma-separated)' },
    { key: 'academic.branchAliases', value: 'CSE,ECE,MECH,CIVIL', default_value: 'CSE,ECE,MECH,CIVIL', category: 'academic', description: 'Branch short name references' },
    { key: 'academic.departmentCodes', value: '101,102,103', default_value: '101,102,103', category: 'academic', description: 'Department code identifiers' },
    { key: 'academic.maxExamsPerDay', value: '1', default_value: '1', category: 'academic', description: 'Enforced daily exam limit per student candidate' },
    { key: 'academic.minGapDays', value: '1', default_value: '1', category: 'academic', description: 'Desired spacing between consecutive subject exams' },
    { key: 'academic.maxGapDays', value: '4', default_value: '4', category: 'academic', description: 'Ceiling gap spacing limit' }
  ];

  const stmt = db.prepare(`
    INSERT INTO system_settings (key, value, default_value, category, description)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(key) DO NOTHING
  `);

  for (const d of defaults) {
    stmt.run(d.key, d.value, d.default_value, d.category, d.description);
  }

  console.log('✅ Seeded default system configuration settings.');
}
