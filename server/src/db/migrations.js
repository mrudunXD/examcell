import { getDb } from './database.js';

const MIGRATIONS = [
  {
    name: '001_create_solver_runs_and_alerts',
    up: async (db) => {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS solver_runs (
          id TEXT PRIMARY KEY,
          cycle_id TEXT REFERENCES exam_cycles(id) ON DELETE CASCADE,
          input_payload TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `).run();
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS system_alerts (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          severity TEXT NOT NULL CHECK(severity IN ('info', 'warning', 'critical')),
          message TEXT NOT NULL,
          resolved INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `).run();
    },
    down: async (db) => {
      await db.prepare('DROP TABLE IF EXISTS solver_runs').run();
      await db.prepare('DROP TABLE IF EXISTS system_alerts').run();
    }
  },
  {
    name: '002_add_version_columns_for_locking',
    up: async (db) => {
      await db.prepare(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='classrooms' AND column_name='version') THEN
            ALTER TABLE classrooms ADD COLUMN version INTEGER DEFAULT 1;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='supervisor_duties' AND column_name='version') THEN
            ALTER TABLE supervisor_duties ADD COLUMN version INTEGER DEFAULT 1;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='seat_assignments' AND column_name='version') THEN
            ALTER TABLE seat_assignments ADD COLUMN version INTEGER DEFAULT 1;
          END IF;
        END $$
      `).run();
    },
    down: async (db) => {
      await db.prepare('ALTER TABLE classrooms DROP COLUMN IF EXISTS version').run();
      await db.prepare('ALTER TABLE supervisor_duties DROP COLUMN IF EXISTS version').run();
      await db.prepare('ALTER TABLE seat_assignments DROP COLUMN IF EXISTS version').run();
    }
  }
];

export async function runMigrations() {
  const db = getDb();
  
  // Create migration history table if not exists
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS migration_history (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  const executed = await db.prepare('SELECT name FROM migration_history').all();
  const executedNames = new Set(executed.map(r => r.name));

  for (const migration of MIGRATIONS) {
    if (!executedNames.has(migration.name)) {
      console.log(`🚀 Running database migration: ${migration.name}...`);
      await db.transaction(async () => {
        await migration.up(db);
        await db.prepare('INSERT INTO migration_history (name) VALUES (?)').run(migration.name);
      })();
      console.log(`✓ Migration complete: ${migration.name}`);
    }
  }
}

export async function rollbackMigration(count = 1) {
  const db = getDb();
  
  // Check if history table exists
  const tableCheck = await db.prepare(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables WHERE table_name = 'migration_history'
    )
  `).get();
  
  if (!tableCheck.exists) return;

  const executed = await db.prepare('SELECT name FROM migration_history ORDER BY id DESC LIMIT ?').all(count);

  for (const record of executed) {
    const migration = MIGRATIONS.find(m => m.name === record.name);
    if (migration) {
      console.log(`⏪ Rolling back database migration: ${migration.name}...`);
      await db.transaction(async () => {
        await migration.down(db);
        await db.prepare('DELETE FROM migration_history WHERE name = ?').run(migration.name);
      })();
      console.log(`✓ Rollback complete: ${migration.name}`);
    }
  }
}
