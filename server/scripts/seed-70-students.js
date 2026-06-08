import { initDb, getDb } from '../src/db/database.js';
import crypto from 'crypto';

console.log('Connecting to PostgreSQL database...');
await initDb();
const db = getDb();

console.log("Deleting all old students and related records...");
await db.transaction(async () => {
  await db.prepare("DELETE FROM seat_assignments").run();
  await db.prepare("DELETE FROM slot_students").run();
  await db.prepare("DELETE FROM attendance").run();
  await db.prepare("DELETE FROM students").run();
})();

const branches = ['CSE', 'CE', 'ECE', 'ME', 'MRA'];
const years = [
  { name: 'FY', sems: [1, 2] },
  { name: 'SY', sems: [3, 4] },
  { name: 'TY', sems: [5, 6] }
];

console.log("Seeding students...");
const insertStmt = db.prepare(`
  INSERT INTO students (id, name, prn, roll_no, branch, section, year, semester, is_active)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
`);

await db.transaction(async () => {
  let count = 0;
  for (const branch of branches) {
    for (const yr of years) {
      for (const sem of yr.sems) {
        if (branch === 'CSE') {
          // 1. Seed 70 standard CSE students (sections A & B)
          for (let i = 1; i <= 70; i++) {
            const id = crypto.randomUUID();
            const section = i <= 35 ? 'A' : 'B';
            const prn = `PRN_CSE_${sem}_${String(i).padStart(3, '0')}`;
            const roll_no = `${section}-${String(i).padStart(2, '0')}`;
            const name = `CSE ${yr.name} Student ${i}`;
            await insertStmt.run(id, name, prn, roll_no, 'CSE', section, yr.name, sem);
            count++;
          }
          // 2. Seed 70 CSE AIDS students (section AIDS)
          for (let i = 1; i <= 70; i++) {
            const id = crypto.randomUUID();
            const section = 'AIDS';
            const prn = `PRN_CSE_AIDS_${sem}_${String(i).padStart(3, '0')}`;
            const roll_no = `AIDS-${String(i).padStart(2, '0')}`;
            const name = `CSE ${yr.name} AIDS Student ${i}`;
            await insertStmt.run(id, name, prn, roll_no, 'CSE', section, yr.name, sem);
            count++;
          }
        } else {
          // Other branches: seed 70 students with sections A & B
          for (let i = 1; i <= 70; i++) {
            const id = crypto.randomUUID();
            const section = i <= 35 ? 'A' : 'B';
            const prn = `PRN_${branch}_${sem}_${String(i).padStart(3, '0')}`;
            const roll_no = `${section}-${String(i).padStart(2, '0')}`;
            const name = `${branch} ${yr.name} Student ${i}`;
            await insertStmt.run(id, name, prn, roll_no, branch, section, yr.name, sem);
            count++;
          }
        }
      }
    }
  }
  console.log(`Successfully seeded ${count} students!`);
})();

db.close();
