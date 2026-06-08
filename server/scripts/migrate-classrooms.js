import Database from 'better-sqlite3';
import { initDb, getDb } from '../src/db/database.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sqliteDbPath = path.resolve(__dirname, '../data/exam_management.db');

async function migrate() {
  console.log('Reading classrooms from SQLite database...');
  const sqliteDb = new Database(sqliteDbPath);
  const classrooms = sqliteDb.prepare('SELECT * FROM classrooms').all();
  console.log(`Found ${classrooms.length} classrooms in SQLite.`);
  sqliteDb.close();

  if (classrooms.length === 0) {
    console.log('No classrooms found to migrate.');
    return;
  }

  console.log('Connecting to PostgreSQL database...');
  await initDb();
  const pgDb = getDb();

  console.log('Migrating classrooms to PostgreSQL...');
  const insertStmt = pgDb.prepare(`
    INSERT INTO classrooms (id, room_no, block, capacity, bench_rows, bench_cols, is_online, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT (id) DO UPDATE SET
      room_no = EXCLUDED.room_no,
      block = EXCLUDED.block,
      capacity = EXCLUDED.capacity,
      bench_rows = EXCLUDED.bench_rows,
      bench_cols = EXCLUDED.bench_cols,
      is_online = EXCLUDED.is_online,
      is_active = EXCLUDED.is_active
  `);

  await pgDb.transaction(async () => {
    for (const r of classrooms) {
      await insertStmt.run(r.id, r.room_no, r.block, r.capacity, r.bench_rows, r.bench_cols, r.is_online, r.is_active);
    }
  })();

  console.log('Classrooms migration complete!');
}

migrate().catch(console.error);
