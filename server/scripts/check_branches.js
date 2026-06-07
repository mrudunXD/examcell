import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../data/exam_management.db');

const db = new Database(DB_PATH);
const branches = db.prepare("SELECT DISTINCT branch FROM subjects").all();
console.log("Branches in subjects:", branches.map(b => b.branch));
const studentCount = db.prepare("SELECT COUNT(*) as cnt FROM students").get();
console.log("Current student count:", studentCount.cnt);
db.close();
