import { getDb, initDb } from '../src/db/database.js';

async function main() {
  await initDb();
  const db = getDb();
  
  const cycles = await db.pool.query('SELECT * FROM exam_cycles');
  console.log('Cycles count:', cycles.rows.length);
  console.log('Cycles:', cycles.rows);

  const students = await db.pool.query('SELECT COUNT(*) as cnt FROM students');
  console.log('Students:', students.rows[0].cnt);

  const subjects = await db.pool.query('SELECT COUNT(*) as cnt FROM subjects');
  console.log('Subjects:', subjects.rows[0].cnt);

  const classrooms = await db.pool.query('SELECT COUNT(*) as cnt FROM classrooms');
  console.log('Classrooms:', classrooms.rows[0].cnt);
}

main().catch(console.error);
