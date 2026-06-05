/**
 * Migration: 
 * - students: add `section` column, drop `scheme`
 * - subjects:  drop `scheme`
 * Also seeds all 26 subjects from MSBTE K-Scheme Semesters 1–4 (CSE/Computer)
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH   = path.join(__dirname, '../data/exam_management.db');
const db        = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── 1. Schema migration ───────────────────────────────────────────────────────

console.log('Running schema migration…');

// students: add section if missing
const studentCols = db.prepare("PRAGMA table_info(students)").all().map(c => c.name);
if (!studentCols.includes('section')) {
  db.exec(`ALTER TABLE students ADD COLUMN section TEXT;`);
  console.log('  [+] students.section added');
}
if (studentCols.includes('scheme')) {
  try { db.exec(`ALTER TABLE students DROP COLUMN scheme;`); console.log('  [-] students.scheme dropped'); }
  catch (e) { console.log('  [!] Could not drop students.scheme (old SQLite):', e.message); }
}

// subjects: drop scheme if present
const subjectCols = db.prepare("PRAGMA table_info(subjects)").all().map(c => c.name);
if (subjectCols.includes('scheme')) {
  try { db.exec(`ALTER TABLE subjects DROP COLUMN scheme;`); console.log('  [-] subjects.scheme dropped'); }
  catch (e) { console.log('  [!] Could not drop subjects.scheme (old SQLite):', e.message); }
}

// Also add abbreviation + course_type columns to subjects if missing
const subjectCols2 = db.prepare("PRAGMA table_info(subjects)").all().map(c => c.name);
if (!subjectCols2.includes('abbreviation')) {
  db.exec(`ALTER TABLE subjects ADD COLUMN abbreviation TEXT;`);
  console.log('  [+] subjects.abbreviation added');
}
if (!subjectCols2.includes('course_type')) {
  db.exec(`ALTER TABLE subjects ADD COLUMN course_type TEXT;`);
  console.log('  [+] subjects.course_type added');
}

// ── 2. Seed subjects ─────────────────────────────────────────────────────────

const subjects = [
  // ── Semester 1 (FY) ────────────────────────────────────────────────────────
  { code:'311302', name:'Basic Mathematics',                                  abbr:'BMS', type:'AEC', year:'FY', sem:1 },
  { code:'311303', name:'Communication Skills (English)',                     abbr:'ENG', type:'AEC', year:'FY', sem:1 },
  { code:'311305', name:'Basic Science (Physics & Chemistry)',                abbr:'BSC', type:'DSC', year:'FY', sem:1 },
  { code:'311001', name:'Fundamentals of ICT',                               abbr:'ICT', type:'SEC', year:'FY', sem:1 },
  { code:'311002', name:'Engineering Workshop Practice (Computer Group)',     abbr:'WPC', type:'SEC', year:'FY', sem:1 },
  { code:'311003', name:'Yoga and Meditation',                               abbr:'YAM', type:'VEC', year:'FY', sem:1 },
  { code:'311008', name:'Engineering Graphics',                              abbr:'EGP', type:'DSC', year:'FY', sem:1 },

  // ── Semester 2 (FY) ────────────────────────────────────────────────────────
  { code:'312301', name:'Applied Mathematics',                               abbr:'AMS', type:'AEC', year:'FY', sem:2 },
  { code:'312302', name:'Basic Electrical & Electronics Engineering',        abbr:'BEE', type:'AEC', year:'FY', sem:2 },
  { code:'312303', name:'Programming in C',                                  abbr:'PIC', type:'AEC', year:'FY', sem:2 },
  { code:'312001', name:'Linux Basics',                                      abbr:'BLP', type:'DSC', year:'FY', sem:2 },
  { code:'312002', name:'Professional Communication',                        abbr:'PCO', type:'SEC', year:'FY', sem:2 },
  { code:'312003', name:'Social and Life Skills',                            abbr:'SFS', type:'VEC', year:'FY', sem:2 },
  { code:'312004', name:'Web Page Designing',                                abbr:'WPD', type:'SEC', year:'FY', sem:2 },

  // ── Semester 3 (SY) ────────────────────────────────────────────────────────
  { code:'313301', name:'Data Structure Using C',                            abbr:'DSU', type:'DSC', year:'SY', sem:3 },
  { code:'313302', name:'Database Management System',                        abbr:'DMS', type:'DSC', year:'SY', sem:3 },
  { code:'313303', name:'Digital Techniques',                                abbr:'DTE', type:'DSC', year:'SY', sem:3 },
  { code:'313304', name:'Object Oriented Programming Using C++',             abbr:'OOP', type:'SEC', year:'SY', sem:3 },
  { code:'313001', name:'Computer Graphics',                                 abbr:'CGR', type:'DSC', year:'SY', sem:3 },
  { code:'313002', name:'Essence of Indian Constitution',                    abbr:'EIC', type:'VEC', year:'SY', sem:3 },

  // ── Semester 4 (SY) ────────────────────────────────────────────────────────
  { code:'314301', name:'Environmental Education and Sustainability',        abbr:'EES', type:'VEC', year:'SY', sem:4 },
  { code:'314317', name:'Java Programming',                                  abbr:'JPR', type:'AEC', year:'SY', sem:4 },
  { code:'314318', name:'Data Communication and Computer Network',           abbr:'DCN', type:'DSC', year:'SY', sem:4 },
  { code:'314321', name:'Microprocessor Programming',                        abbr:'MIC', type:'DSC', year:'SY', sem:4 },
  { code:'314004', name:'Python Programming',                                abbr:'PWP', type:'AEC', year:'SY', sem:4 },
  { code:'314005', name:'UI/UX Design',                                      abbr:'UID', type:'SEC', year:'SY', sem:4 },
];

const upsert = db.prepare(`
  INSERT INTO subjects (id, code, name, branch, year, semester, abbreviation, course_type)
  VALUES (?, ?, ?, 'CSE', ?, ?, ?, ?)
  ON CONFLICT(code) DO UPDATE SET
    name         = excluded.name,
    year         = excluded.year,
    semester     = excluded.semester,
    abbreviation = excluded.abbreviation,
    course_type  = excluded.course_type
`);

const insertAll = db.transaction(() => {
  for (const s of subjects) {
    const id = crypto.randomUUID();
    upsert.run(id, s.code, s.name, s.year, s.sem, s.abbr, s.type);
    console.log(`  [+] Sem${s.sem} ${s.code} — ${s.name}`);
  }
});

console.log('\nSeeding subjects (MSBTE K-Scheme CSE Semesters 1–4)…');
insertAll();
console.log(`\nDone: ${subjects.length} subjects seeded.`);
db.close();
