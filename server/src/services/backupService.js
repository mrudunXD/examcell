import { getDb } from '../db/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
  const db = getDb();
  const backup = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    tables: {}
  };

  for (const table of TABLES) {
    const rows = await db.prepare(`SELECT * FROM ${table}`).all();
    backup.tables[table] = rows;
  }

  const filename = `backup_${Date.now()}.json`;
  const filepath = path.join(BACKUP_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(backup, null, 2), 'utf-8');
  
  return { filename, filepath, timestamp: backup.timestamp };
}

export async function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  const files = fs.readdirSync(BACKUP_DIR);
  return files
    .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
    .map(f => {
      const stats = fs.statSync(path.join(BACKUP_DIR, f));
      const timestampStr = f.replace('backup_', '').replace('.json', '');
      const date = new Date(parseInt(timestampStr));
      return {
        filename: f,
        size: stats.size,
        createdAt: date.toISOString()
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function restoreBackup(backupData) {
  const db = getDb();
  if (!backupData || !backupData.tables) {
    throw new Error('Invalid backup data format');
  }

  // Deletion in reverse order of foreign key dependencies
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

  await db.transaction(async () => {
    // Delete all records from each table
    for (const table of deletionOrder) {
      await db.prepare(`DELETE FROM ${table}`).run();
    }

    // Insert records in correct order of dependency
    for (const table of TABLES) {
      const rows = backupData.tables[table];
      if (!rows || !rows.length) continue;

      const keys = Object.keys(rows[0]);
      const placeholders = keys.map(() => '?').join(', ');
      const cols = keys.join(', ');

      const stmt = await db.prepare(`INSERT INTO ${table} (${cols}) VALUES (${placeholders})`);
      for (const row of rows) {
        const vals = keys.map(k => row[k]);
        await stmt.run(...vals);
      }
    }
  })();

  return { success: true, timestamp: backupData.timestamp };
}
