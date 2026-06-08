import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../data/exam_management.db');
const db = new Database(DB_PATH);

console.log("Deleting all old students and related records...");
db.transaction(() => {
  db.prepare("DELETE FROM seat_assignments").run();
  db.prepare("DELETE FROM slot_students").run();
  db.prepare("DELETE FROM attendance").run();
  db.prepare("DELETE FROM students").run();
})();

const branches = ['CSE', 'CSE (AIDS)', 'CE', 'ECE', 'ME'];
const years = [
  { name: 'FY', sems: [1, 2] },
  { name: 'SY', sems: [3, 4] },
  { name: 'TY', sems: [5, 6] }
];
const sections = ['A', 'B', 'C'];

console.log("Seeding 70 students per branch/semester...");
const insertStmt = db.prepare(`
  INSERT INTO students (id, name, prn, roll_no, branch, section, year, semester, is_active)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
`);

db.transaction(() => {
  let count = 0;
  for (const branch of branches) {
    for (const yr of years) {
      for (const sem of yr.sems) {
        for (let i = 1; i <= 70; i++) {
          const id = crypto.randomUUID();
          const section = sections[(i - 1) % sections.length];
          const prn = `PRN_${branch}_${sem}_${String(i).padStart(3, '0')}`;
          const roll_no = `${section}-${String(i).padStart(2, '0')}`;
          const name = `${branch} ${yr.name} Student ${i}`;
          insertStmt.run(id, name, prn, roll_no, branch, section, yr.name, sem);
          count++;
        }
      }
    }
  }
  console.log(`Successfully seeded ${count} students!`);
})();

db.close();
