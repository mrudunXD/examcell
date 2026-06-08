import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, '../server/data/exam_management.db');

const db = new Database(DB_PATH);

console.log('--- EXAM CYCLES ---');
const cycles = db.prepare('SELECT id, name, start_date, end_date, semester_type, status FROM exam_cycles').all();
console.log(cycles);

console.log('--- STUDENT COUNT BY BRANCH & YEAR ---');
const studentCounts = db.prepare('SELECT branch, year, count(*) as cnt FROM students WHERE is_active=1 GROUP BY branch, year').all();
console.log(studentCounts);

console.log('--- CLASSROOMS ---');
const classrooms = db.prepare('SELECT id, room_no, capacity FROM classrooms WHERE is_active=1').all();
console.log(classrooms);

console.log('--- TOTAL SUBJECTS ---');
const subjectCount = db.prepare('SELECT COUNT(*) as cnt FROM subjects').all();
console.log(subjectCount);

console.log('--- TOTAL FACULTY ---');
const facultyCount = db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role='faculty'").all();
console.log(facultyCount);
