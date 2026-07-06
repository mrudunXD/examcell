import { getDb } from '../db/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKUP_DIR = path.join(__dirname, '../../backups');

// Make sure backups directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const TABLES = [
  'users',
  'students',
  'subjects',
  'classrooms',
  'faculty_subjects',
  'exam_cycles',
  'exam_slots',
  'slot_students',
  'room_allocations',
  'seat_assignments',
  'supervisor_duties',
  'replacement_requests',
  'conflicts',
  'audit_log',
  'attendance',
  'broadcasts',
  'broadcast_reads',
  'incidents',
  'solver_telemetry',
  'solver_runs',
  'system_alerts'
];

export async function createBackup() {
  const timestamp = new Date().toISOString();
  const filenameDump = `backup_${Date.now()}.dump`;
  const filepathDump = path.join(BACKUP_DIR, filenameDump);
  
  const host = process.env.PGHOST || 'localhost';
  const port = process.env.PGPORT || '5432';
  const user = process.env.PGUSER || 'postgres';
  const database = process.env.PGDATABASE || 'exam_management';
  const password = process.env.PGPASSWORD;

  try {
    console.log(`🚀 Attempting pg_dump backup to ${filenameDump}...`);
    const env = { ...process.env, PGPASSWORD: password };
    // -F c: custom compressed format, -b: include large objects, -v: verbose
    await execPromise(`pg_dump -h ${host} -p ${port} -U ${user} -F c -b -f "${filepathDump}" ${database}`, { env });
    
    // Set 0600 permissions
    fs.chmodSync(filepathDump, 0o600);
    console.log(`✓ pg_dump backup created successfully.`);
    return { filename: filenameDump, filepath: filepathDump, timestamp, format: 'dump' };
  } catch (err) {
    console.warn(`⚠️ pg_dump failed (${err.message}). Falling back to JSON backup...`);
    // Delete failed dump file if it was partially created
    if (fs.existsSync(filepathDump)) {
      try { fs.unlinkSync(filepathDump); } catch (e) {}
    }
    
    // JSON Fallback
    const db = getDb();
    const backup = {
      version: '1.0',
      timestamp,
      tables: {}
    };

    for (const table of TABLES) {
      const rows = await db.prepare(`SELECT * FROM ${table}`).all();
      backup.tables[table] = rows;
    }

    const filenameJson = `backup_${Date.now()}.json`;
    const filepathJson = path.join(BACKUP_DIR, filenameJson);
    fs.writeFileSync(filepathJson, JSON.stringify(backup, null, 2), { encoding: 'utf-8', mode: 0o600 });
    
    return { filename: filenameJson, filepath: filepathJson, timestamp, format: 'json' };
  }
}

export async function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  const files = fs.readdirSync(BACKUP_DIR);
  return files
    .filter(f => f.startsWith('backup_') && (f.endsWith('.json') || f.endsWith('.dump')))
    .map(f => {
      const stats = fs.statSync(path.join(BACKUP_DIR, f));
      const isJson = f.endsWith('.json');
      const timestampStr = f.replace('backup_', '').replace(isJson ? '.json' : '.dump', '');
      const date = new Date(parseInt(timestampStr));
      return {
        filename: f,
        size: stats.size,
        createdAt: date.toISOString(),
        format: isJson ? 'json' : 'dump'
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function restoreBackup(backupData, filename = null) {
  // If backupData is not an object or does not have tables, but we have a filename, check if it is a dump file
  if (filename && filename.endsWith('.dump')) {
    const filepath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(filepath)) {
      throw new Error(`Backup dump file not found: ${filename}`);
    }
    
    const host = process.env.PGHOST || 'localhost';
    const port = process.env.PGPORT || '5432';
    const user = process.env.PGUSER || 'postgres';
    const database = process.env.PGDATABASE || 'exam_management';
    const password = process.env.PGPASSWORD;

    console.log(`🚀 Restoring database from pg_dump archive ${filename}...`);
    const env = { ...process.env, PGPASSWORD: password };
    // -c: clean (drop database objects before recreating), -d: database
    await execPromise(`pg_restore -h ${host} -p ${port} -U ${user} -c -d ${database} "${filepath}"`, { env });
    console.log(`✓ pg_restore complete.`);
    return { success: true, format: 'dump' };
  }

  // JSON Restore Fallback
  const db = getDb();
  const data = typeof backupData === 'string' ? JSON.parse(backupData) : backupData;
  if (!data || !data.tables) {
    throw new Error('Invalid backup data format');
  }

  const ALLOWED_TABLES = new Set(TABLES);
  const deletionOrder = [
    'replacement_requests',
    'broadcast_reads',
    'broadcasts',
    'incidents',
    'attendance',
    'solver_telemetry',
    'solver_runs',
    'system_alerts',
    'audit_log',
    'conflicts',
    'supervisor_duties',
    'seat_assignments',
    'room_allocations',
    'slot_students',
    'exam_slots',
    'exam_cycles',
    'faculty_subjects',
    'classrooms',
    'subjects',
    'students',
    'users'
  ];

  for (const table of Object.keys(data.tables)) {
    if (!ALLOWED_TABLES.has(table)) {
      throw new Error(`Backup contains unknown table "${table}" — restore aborted.`);
    }
  }

  const executeTx = db.transaction(async () => {
    for (const table of deletionOrder) {
      await db.prepare(`DELETE FROM ${table}`).run();
    }

    for (const table of TABLES) {
      const rows = data.tables[table];
      if (!rows || !rows.length) continue;

      const keys = Object.keys(rows[0]);
      for (const col of keys) {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col)) {
          throw new Error(`Backup contains invalid column name "${col}" in table "${table}" — restore aborted.`);
        }
      }

      const placeholders = keys.map(() => '?').join(', ');
      const cols = keys.join(', ');

      const stmt = await db.prepare(`INSERT INTO ${table} (${cols}) VALUES (${placeholders})`);
      for (const row of rows) {
        const vals = keys.map(k => row[k]);
        await stmt.run(...vals);
      }
    }
  });

  await executeTx();
  return { success: true, timestamp: data.timestamp, format: 'json' };
}
