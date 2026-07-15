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
  },
  {
    name: '003_iam_module_tables',
    up: async (db) => {
      // 1. Relax/drop old role check constraint
      await db.prepare('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check').run();

      // 2. Add extra profile, account state, and tracking fields
      await db.prepare(`
        DO $$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='employee_id') THEN
            ALTER TABLE users ADD COLUMN employee_id TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='username') THEN
            ALTER TABLE users ADD COLUMN username TEXT UNIQUE;
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
            ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'locked', 'disabled', 'archived'));
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='last_login') THEN
            ALTER TABLE users ADD COLUMN last_login TIMESTAMP;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='last_password_change') THEN
            ALTER TABLE users ADD COLUMN last_password_change TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='created_by') THEN
            ALTER TABLE users ADD COLUMN created_by TEXT;
          END IF;
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='updated_by') THEN
            ALTER TABLE users ADD COLUMN updated_by TEXT;
          END IF;
        END $$
      `).run();

      // 3. Create user_roles table
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS user_roles (
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role TEXT NOT NULL,
          PRIMARY KEY (user_id, role)
        )
      `).run();

      // 4. Create user_permissions table
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS user_permissions (
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          permission TEXT NOT NULL,
          PRIMARY KEY (user_id, permission)
        )
      `).run();

      // 5. Create password_history table
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS password_history (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          password_hash TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `).run();

      // 6. Create user_sessions table
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS user_sessions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash TEXT UNIQUE NOT NULL,
          device TEXT,
          browser TEXT,
          os TEXT,
          ip_address TEXT,
          login_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          is_revoked INTEGER DEFAULT 0
        )
      `).run();

      // 7. Create approval_requests table
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS approval_requests (
          id TEXT PRIMARY KEY,
          action TEXT NOT NULL,
          entity_id TEXT,
          payload TEXT,
          requested_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
          resolved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
          resolved_at TIMESTAMP,
          notes TEXT
        )
      `).run();

      await db.prepare('CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id)').run();
      await db.prepare('CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id)').run();
    },
    down: async (db) => {
      await db.prepare('DROP TABLE IF EXISTS approval_requests').run();
      await db.prepare('DROP TABLE IF EXISTS user_sessions').run();
      await db.prepare('DROP TABLE IF EXISTS password_history').run();
      await db.prepare('DROP TABLE IF EXISTS user_permissions').run();
      await db.prepare('DROP TABLE IF EXISTS user_roles').run();
      await db.prepare('ALTER TABLE users DROP COLUMN IF EXISTS employee_id').run();
      await db.prepare('ALTER TABLE users DROP COLUMN IF EXISTS username').run();
      await db.prepare('ALTER TABLE users DROP COLUMN IF EXISTS phone').run();
      await db.prepare('ALTER TABLE users DROP COLUMN IF EXISTS profile_picture').run();
      await db.prepare('ALTER TABLE users DROP COLUMN IF EXISTS designation').run();
      await db.prepare('ALTER TABLE users DROP COLUMN IF EXISTS status').run();
      await db.prepare('ALTER TABLE users DROP COLUMN IF EXISTS last_login').run();
      await db.prepare('ALTER TABLE users DROP COLUMN IF EXISTS last_password_change').run();
      await db.prepare('ALTER TABLE users DROP COLUMN IF EXISTS created_by').run();
      await db.prepare('ALTER TABLE users DROP COLUMN IF EXISTS updated_by').run();
    }
  },
  {
    name: '004_background_settings',
    up: async (db) => {
      await db.prepare(`
        INSERT INTO system_settings (key, value, default_value, category, description)
        VALUES 
          ('general.backgroundImage', '', '', 'general', 'Custom application background image (base64 or URL)'),
          ('general.backgroundOpacity', '75', '75', 'general', 'Custom background overlay opacity percentage (0-100)')
        ON CONFLICT (key) DO NOTHING
      `).run();
    },
    down: async (db) => {
      await db.prepare("DELETE FROM system_settings WHERE key IN ('general.backgroundImage', 'general.backgroundOpacity')").run();
    }
  },
  {
    name: '005_sidebar_banner_setting',
    up: async (db) => {
      await db.prepare(`
        INSERT INTO system_settings (key, value, default_value, category, description)
        VALUES 
          ('general.sidebarBanner', '', '', 'general', 'Custom sidebar header banner image (base64 or URL)')
        ON CONFLICT (key) DO NOTHING
      `).run();
    },
    down: async (db) => {
      await db.prepare("DELETE FROM system_settings WHERE key = 'general.sidebarBanner'").run();
    }
  },
  {
    name: '006_extra_security_settings',
    up: async (db) => {
      await db.prepare('ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret TEXT').run();
      await db.prepare('ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled INTEGER DEFAULT 0').run();
      await db.prepare(`
        INSERT INTO system_settings (key, value, default_value, category, description)
        VALUES 
          ('security.passwordPolicyMaxAgeDays', '90', '90', 'security', 'Maximum age of password in days before forced change'),
          ('security.mfaRequired', 'false', 'false', 'security', 'Force multi-factor authentication for all coordinator accounts')
        ON CONFLICT (key) DO NOTHING
      `).run();
    },
    down: async (db) => {
      await db.prepare("DELETE FROM system_settings WHERE key IN ('security.passwordPolicyMaxAgeDays', 'security.mfaRequired')").run();
      await db.prepare('ALTER TABLE users DROP COLUMN IF EXISTS mfa_secret').run();
      await db.prepare('ALTER TABLE users DROP COLUMN IF EXISTS mfa_enabled').run();
    }
  },
  {
    name: '007_ai_resolver_settings',
    up: async (db) => {
      await db.prepare(`
        INSERT INTO system_settings (key, value, default_value, category, description)
        VALUES 
          ('ai.geminiApiKey', '', '', 'ai', 'Google Gemini Pro API key used for automatic bug diagnostics and code resolution'),
          ('ai.geminiModel', 'gemini-1.5-flash', 'gemini-1.5-flash', 'ai', 'AI Model name to use for bug analysis (e.g. gemini-1.5-flash)')
        ON CONFLICT (key) DO NOTHING
      `).run();
    },
    down: async (db) => {
      await db.prepare("DELETE FROM system_settings WHERE key IN ('ai.geminiApiKey', 'ai.geminiModel')").run();
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
