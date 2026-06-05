/**
 * Schema migration v2:
 * - exam_cycles: add semester_type (odd/even)
 * - exam_slots:  add exam_type (regular/backlog), exam_mode (online/offline)
 */
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH   = path.join(__dirname, '../data/exam_management.db');
const db        = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

console.log('Running schema migration v2…');

const cycleCols = db.prepare("PRAGMA table_info(exam_cycles)").all().map(c => c.name);
if (!cycleCols.includes('semester_type')) {
  db.exec(`ALTER TABLE exam_cycles ADD COLUMN semester_type TEXT DEFAULT 'odd'`);
  console.log('  [+] exam_cycles.semester_type');
}

const slotCols = db.prepare("PRAGMA table_info(exam_slots)").all().map(c => c.name);
if (!slotCols.includes('exam_type')) {
  db.exec(`ALTER TABLE exam_slots ADD COLUMN exam_type TEXT DEFAULT 'regular'`);
  console.log('  [+] exam_slots.exam_type');
}
if (!slotCols.includes('exam_mode')) {
  db.exec(`ALTER TABLE exam_slots ADD COLUMN exam_mode TEXT DEFAULT 'offline'`);
  console.log('  [+] exam_slots.exam_mode');
}

console.log('Migration v2 complete.');
db.close();
