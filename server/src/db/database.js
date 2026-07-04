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
      END $$;

      CREATE TABLE IF NOT EXISTS broadcast_acknowledgments (
        broadcast_id TEXT REFERENCES broadcasts(id) ON DELETE CASCADE,
        classroom_id TEXT REFERENCES classrooms(id) ON DELETE CASCADE,
        acknowledged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        acknowledged_by TEXT REFERENCES users(id),
        PRIMARY KEY (broadcast_id, classroom_id)
      );
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
  const existing = await db.prepare('SELECT COUNT(*) as cnt FROM users').get();
  if (existing.cnt > 0) return;

  const coordHash = bcrypt.hashSync('admin123', 10);
  const coordId = crypto.randomUUID();

  await db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, department, must_change_password)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).run(coordId, 'Admin Coordinator', 'admin@mitwpu.edu.in', coordHash, 'coordinator', 'Examination Cell');

  console.log('✅ Seeded default coordinator: admin@mitwpu.edu.in / admin123');
}
