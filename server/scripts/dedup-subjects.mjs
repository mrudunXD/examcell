/**
 * Dedup subjects: remove duplicate rows where (code, branch) appears more than once.
 * Keeps the row with abbreviation + course_type filled in, else keeps the latest.
 */
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH   = path.join(__dirname, '../data/exam_management.db');
const db        = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = OFF');

const dups = db.prepare(`
  SELECT code, branch, COUNT(*) as cnt
  FROM subjects
  GROUP BY code, branch
  HAVING cnt > 1
`).all();

if (!dups.length) {
  console.log('No duplicate subjects found.');
  db.close();
  process.exit(0);
}

console.log(`Found ${dups.length} duplicate (code, branch) pairs. Deduplicating…`);

let deleted = 0;
const dedup = db.transaction(() => {
  for (const { code, branch } of dups) {
    // Get all rows for this code+branch, prefer rows with abbreviation set
    const rows = db.prepare(`
      SELECT id, abbreviation, course_type, created_at
      FROM subjects WHERE code=? AND branch=?
      ORDER BY
        CASE WHEN abbreviation IS NOT NULL AND abbreviation != '' THEN 0 ELSE 1 END ASC,
        created_at DESC
    `).all(code, branch);

    // Keep the first (best) row, delete the rest
    const [keep, ...remove] = rows;
    for (const r of remove) {
      // Move any FK references to the keeper
      db.prepare('UPDATE faculty_subjects SET subject_id=? WHERE subject_id=?').run(keep.id, r.id);
      db.prepare('UPDATE exam_slots SET subject_id=? WHERE subject_id=?').run(keep.id, r.id);
      db.prepare('DELETE FROM subjects WHERE id=?').run(r.id);
      deleted++;
      console.log(`  [-] Removed duplicate ${code} (${branch}) — kept ${keep.id}`);
    }
  }
});

dedup();
console.log(`\nDone: ${deleted} duplicate rows removed.`);
db.pragma('foreign_keys = ON');
db.close();
