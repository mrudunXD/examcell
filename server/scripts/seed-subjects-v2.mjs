/**
 * Seed subjects v2:
 *  - CSE  : Semester 5, 6
 *  - CE   : Semester 1, 2, 3, 4, 5, 6
 *  - ECE  : Semester 1, 2, 3, 4, 5, 6
 *  - ME   : Semester 1, 2, 3, 4, 5, 6
 *
 * Uses ON CONFLICT(code) DO UPDATE so it is safe to run multiple times.
 * Subjects that already exist (same code) will have their details refreshed.
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';
import { randomUUID } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH   = path.join(__dirname, '../data/exam_management.db');
const db        = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = OFF'); // OFF during migration

// ── 0. Fix UNIQUE constraint: code → (code, branch) ──────────────────────────
console.log('\nChecking subjects table constraint…');

const tableInfo = db.prepare("PRAGMA table_info(subjects)").all();
const colNames  = tableInfo.map(c => c.name);
const indexInfo = db.prepare("PRAGMA index_list(subjects)").all();
const hasCompositeUnique = indexInfo.some(idx => {
  const cols = db.prepare(`PRAGMA index_info(${idx.name})`).all().map(c => c.name);
  return cols.includes('code') && cols.includes('branch');
});

if (!hasCompositeUnique) {
  console.log('  Migrating subjects to UNIQUE(code, branch)…');
  db.exec(`
    CREATE TABLE subjects_new (
      id           TEXT PRIMARY KEY,
      code         TEXT NOT NULL,
      name         TEXT NOT NULL,
      branch       TEXT NOT NULL DEFAULT 'CSE',
      year         TEXT NOT NULL,
      semester     INTEGER NOT NULL,
      abbreviation TEXT,
      course_type  TEXT,
      created_at   TEXT DEFAULT (datetime('now')),
      UNIQUE(code, branch)
    );

    INSERT OR IGNORE INTO subjects_new
      (id, code, name, branch, year, semester, abbreviation, course_type, created_at)
    SELECT id, code, name,
      COALESCE(branch, 'CSE'),
      year, semester,
      ${colNames.includes('abbreviation') ? 'abbreviation' : 'NULL'},
      ${colNames.includes('course_type')  ? 'course_type'  : 'NULL'},
      created_at
    FROM subjects;

    DROP TABLE subjects;
    ALTER TABLE subjects_new RENAME TO subjects;
  `);
  console.log('  [✓] subjects migrated — UNIQUE(code, branch) applied');
} else {
  console.log('  [✓] Already has UNIQUE(code, branch) — no migration needed');
}

// Add abbreviation / course_type columns if still missing (old DBs)
const cols2 = db.prepare("PRAGMA table_info(subjects)").all().map(c => c.name);
if (!cols2.includes('abbreviation')) { db.exec('ALTER TABLE subjects ADD COLUMN abbreviation TEXT'); }
if (!cols2.includes('course_type'))  { db.exec('ALTER TABLE subjects ADD COLUMN course_type TEXT');  }

db.pragma('foreign_keys = ON');

// year helper
const yr = sem => sem <= 2 ? 'FY' : sem <= 4 ? 'SY' : 'TY';

const subjects = [

  // ════════════════════════════════════════════════════════
  // CSE — Semester 5 (TY)
  // ════════════════════════════════════════════════════════
  { code:'315319', name:'Operating System',                                   abbr:'OSY',  type:'DSC', branch:'CSE', sem:5 },
  { code:'315323', name:'Software Engineering',                               abbr:'STE',  type:'DSC', branch:'CSE', sem:5 },
  { code:'315002', name:'Entrepreneurship Development and Startups',          abbr:'ENDS', type:'AEC', branch:'CSE', sem:5 },
  { code:'315003', name:'Seminar and Project Initiation Course',              abbr:'SPI',  type:'AEC', branch:'CSE', sem:5 },
  { code:'315004', name:'Internship (12 Weeks)',                              abbr:'ITR',  type:'INP', branch:'CSE', sem:5 },
  // Elective 1
  { code:'315321', name:'Advance Computer Network',                           abbr:'ACN',  type:'DSE', branch:'CSE', sem:5 },
  { code:'315325', name:'Cloud Computing',                                    abbr:'CLC',  type:'DSE', branch:'CSE', sem:5 },
  { code:'315326', name:'Data Analytics',                                     abbr:'DAN',  type:'DSE', branch:'CSE', sem:5 },

  // ════════════════════════════════════════════════════════
  // CSE — Semester 6 (TY)
  // ════════════════════════════════════════════════════════
  { code:'315301', name:'Management',                                         abbr:'MAN',  type:'AEC', branch:'CSE', sem:6 },
  { code:'316313', name:'Emerging Trends in Computer Engineering and IT',     abbr:'ETI',  type:'DSC', branch:'CSE', sem:6 },
  { code:'316314', name:'Software Testing',                                   abbr:'SFT',  type:'DSC', branch:'CSE', sem:6 },
  { code:'316005', name:'Client Side Scripting',                              abbr:'CSS',  type:'AEC', branch:'CSE', sem:6 },
  { code:'316006', name:'Mobile Application Development',                     abbr:'MAD',  type:'DSC', branch:'CSE', sem:6 },
  { code:'316004', name:'Capstone Project',                                   abbr:'CPE',  type:'INP', branch:'CSE', sem:6 },
  // Elective 2
  { code:'316315', name:'Digital Forensic and Hacking Techniques',            abbr:'DFH',  type:'DSE', branch:'CSE', sem:6 },
  { code:'316316', name:'Machine Learning',                                   abbr:'MAL',  type:'DSE', branch:'CSE', sem:6 },
  { code:'316317', name:'Network and Information Security',                   abbr:'NIS',  type:'DSE', branch:'CSE', sem:6 },

  // ════════════════════════════════════════════════════════
  // CE — Semester 1 (FY)
  // ════════════════════════════════════════════════════════
  { code:'311302', name:'Basic Mathematics',                                  abbr:'BMS',  type:'AEC', branch:'CE', sem:1 },
  { code:'311303', name:'Communication Skills (English)',                     abbr:'ENG',  type:'AEC', branch:'CE', sem:1 },
  { code:'311305', name:'Basic Science (Physics & Chemistry)',                abbr:'BSC',  type:'DSC', branch:'CE', sem:1 },
  { code:'311001', name:'Fundamentals of ICT',                               abbr:'ICT',  type:'SEC', branch:'CE', sem:1 },
  { code:'311003', name:'Yoga and Meditation',                               abbr:'YAM',  type:'VEC', branch:'CE', sem:1 },
  { code:'311006', name:'Engineering Graphics',                              abbr:'EGR',  type:'DSC', branch:'CE', sem:1 },
  { code:'311010', name:'Civil Engineering Workshop',                        abbr:'CEW',  type:'SEC', branch:'CE', sem:1 },

  // ════════════════════════════════════════════════════════
  // CE — Semester 2 (FY)
  // ════════════════════════════════════════════════════════
  // 312301 Applied Mathematics already seeded for CSE; upsert is safe per-branch
  { code:'312301', name:'Applied Mathematics',                               abbr:'AMS',  type:'AEC', branch:'CE', sem:2 },
  { code:'312308', name:'Applied Science (Physics & Chemistry)',             abbr:'ASC',  type:'DSC', branch:'CE', sem:2 },
  { code:'312312', name:'Engineering Mechanics',                             abbr:'EGM',  type:'DSC', branch:'CE', sem:2 },
  { code:'312338', name:'Building Material and Construction',                abbr:'BMC',  type:'DSC', branch:'CE', sem:2 },
  { code:'312339', name:'Surveying',                                         abbr:'SUY',  type:'SEC', branch:'CE', sem:2 },
  { code:'312002', name:'Professional Communication',                        abbr:'PCO',  type:'SEC', branch:'CE', sem:2 },
  { code:'312003', name:'Social and Life Skills',                            abbr:'SFS',  type:'VEC', branch:'CE', sem:2 },

  // ════════════════════════════════════════════════════════
  // CE — Semester 3 (SY)
  // ════════════════════════════════════════════════════════
  { code:'313308', name:'Strength of Materials',                             abbr:'SOM',  type:'DSC', branch:'CE', sem:3 },
  { code:'313321', name:'Advanced Surveying',                                abbr:'ASU',  type:'SEC', branch:'CE', sem:3 },
  { code:'313322', name:'Concrete Technology',                               abbr:'CTE',  type:'DSC', branch:'CE', sem:3 },
  { code:'313323', name:'Highway Engineering',                               abbr:'HEN',  type:'DSC', branch:'CE', sem:3 },
  { code:'313002', name:'Essence of Indian Constitution',                    abbr:'EIC',  type:'VEC', branch:'CE', sem:3 },
  { code:'313009', name:'Building Planning & Drawing with CAD',              abbr:'BDC',  type:'SEC', branch:'CE', sem:3 },
  { code:'313010', name:'Construction Management',                           abbr:'CMA',  type:'DSC', branch:'CE', sem:3 },

  // ════════════════════════════════════════════════════════
  // CE — Semester 4 (SY)
  // ════════════════════════════════════════════════════════
  { code:'314301', name:'Environmental Education and Sustainability',        abbr:'EES',  type:'VEC', branch:'CE', sem:4 },
  { code:'314312', name:'Railway, Bridge and Tunnel Engineering',            abbr:'RBT',  type:'DSC', branch:'CE', sem:4 },
  { code:'314303', name:'Hydraulics',                                        abbr:'HYD',  type:'DSC', branch:'CE', sem:4 },
  { code:'314313', name:'Estimating, Costing and Valuation',                 abbr:'ECV',  type:'DSC', branch:'CE', sem:4 },
  { code:'314314', name:'Water and Wastewater Engineering',                  abbr:'WWE',  type:'DSC', branch:'CE', sem:4 },
  { code:'314315', name:'Geotechnical Engineering',                          abbr:'GTE',  type:'DSC', branch:'CE', sem:4 },

  // ════════════════════════════════════════════════════════
  // CE — Semester 5 (TY)
  // ════════════════════════════════════════════════════════
  { code:'315313', name:'Theory of Structure',                               abbr:'TOS',  type:'DSC', branch:'CE', sem:5 },
  { code:'315314', name:'Water Resource Engineering',                        abbr:'WRE',  type:'DSC', branch:'CE', sem:5 },
  { code:'315315', name:'Emerging Trends in Civil Engineering',              abbr:'ETC',  type:'DSC', branch:'CE', sem:5 },
  { code:'315002', name:'Entrepreneurship Development and Startups',         abbr:'ENDS', type:'AEC', branch:'CE', sem:5 },
  { code:'315003', name:'Seminar and Project Initiation Course',             abbr:'SPI',  type:'AEC', branch:'CE', sem:5 },
  { code:'315004', name:'Internship (12 Weeks)',                             abbr:'ITR',  type:'INP', branch:'CE', sem:5 },
  // Elective 1
  { code:'315316', name:'Energy Conservation & Green Building',              abbr:'ECG',  type:'DSE', branch:'CE', sem:5 },
  { code:'315317', name:'Precast & Prestressed Concrete Structures',         abbr:'PPC',  type:'DSE', branch:'CE', sem:5 },
  { code:'315318', name:'Road Traffic Engineering',                          abbr:'TEN',  type:'DSE', branch:'CE', sem:5 },

  // ════════════════════════════════════════════════════════
  // CE — Semester 6 (TY)
  // ════════════════════════════════════════════════════════
  { code:'315301', name:'Management',                                        abbr:'MAN',  type:'AEC', branch:'CE', sem:6 },
  { code:'316307', name:'Contracts and Billing',                             abbr:'CAB',  type:'DSC', branch:'CE', sem:6 },
  { code:'316308', name:'Design of RCC and Steel Structures',                abbr:'DRS',  type:'DSC', branch:'CE', sem:6 },
  { code:'316309', name:'Maintenance and Repairs of Structures',             abbr:'MRS',  type:'DSC', branch:'CE', sem:6 },
  { code:'316004', name:'Capstone Project',                                  abbr:'CPE',  type:'INP', branch:'CE', sem:6 },
  // Elective 2
  { code:'316310', name:'Building Services',                                 abbr:'BSE',  type:'DSE', branch:'CE', sem:6 },
  { code:'316311', name:'Earthquake Resistant Building',                     abbr:'ERB',  type:'DSE', branch:'CE', sem:6 },
  { code:'316312', name:'Solid Waste Management',                            abbr:'SWM',  type:'DSE', branch:'CE', sem:6 },

  // ════════════════════════════════════════════════════════
  // ECE — Semester 1 (FY)
  // ════════════════════════════════════════════════════════
  { code:'311302', name:'Basic Mathematics',                                  abbr:'BMS',  type:'AEC', branch:'ECE', sem:1 },
  { code:'311303', name:'Communication Skills (English)',                     abbr:'ENG',  type:'AEC', branch:'ECE', sem:1 },
  { code:'311305', name:'Basic Science (Physics & Chemistry)',                abbr:'BSC',  type:'DSC', branch:'ECE', sem:1 },
  { code:'311001', name:'Fundamentals of ICT',                               abbr:'ICT',  type:'SEC', branch:'ECE', sem:1 },
  { code:'311003', name:'Yoga and Meditation',                               abbr:'YAM',  type:'VEC', branch:'ECE', sem:1 },
  { code:'311007', name:'Engineering Workshop Practice (Electronics Group)', abbr:'EWP',  type:'SEC', branch:'ECE', sem:1 },
  { code:'311008', name:'Engineering Graphics (Electronics & Computer)',     abbr:'EGP',  type:'DSC', branch:'ECE', sem:1 },

  // ════════════════════════════════════════════════════════
  // ECE — Semester 2 (FY)
  // ════════════════════════════════════════════════════════
  { code:'312301', name:'Applied Mathematics',                               abbr:'AMS',  type:'AEC', branch:'ECE', sem:2 },
  { code:'312314', name:'Basic Electronics',                                 abbr:'BEL',  type:'AEC', branch:'ECE', sem:2 },
  { code:'312315', name:'Elements of Electrical Engineering',                abbr:'EEE',  type:'SEC', branch:'ECE', sem:2 },
  { code:'312316', name:'Electronic Materials & Components',                 abbr:'EMC',  type:'DSC', branch:'ECE', sem:2 },
  { code:'312002', name:'Professional Communication',                        abbr:'PCO',  type:'SEC', branch:'ECE', sem:2 },
  { code:'312003', name:'Social and Life Skills',                            abbr:'SFS',  type:'VEC', branch:'ECE', sem:2 },
  { code:'312008', name:'Electronics Workshop Practice',                     abbr:'EWP',  type:'SEC', branch:'ECE', sem:2 },
  { code:'312009', name:"Programming in 'C' Language",                      abbr:'CPR',  type:'SEC', branch:'ECE', sem:2 },

  // ════════════════════════════════════════════════════════
  // ECE — Semester 3 (SY)
  // ════════════════════════════════════════════════════════
  { code:'313303', name:'Digital Techniques',                                abbr:'DTE',  type:'DSC', branch:'ECE', sem:3 },
  { code:'313324', name:'Analog Electronics',                                abbr:'ATE',  type:'DSC', branch:'ECE', sem:3 },
  { code:'313325', name:'Circuits & Networks',                               abbr:'CKN',  type:'DSC', branch:'ECE', sem:3 },
  { code:'313333', name:'Electrical Power Generation, Transmission & Distribution', abbr:'GTD', type:'DSC', branch:'ECE', sem:3 },
  { code:'313002', name:'Essence of Indian Constitution',                    abbr:'EIC',  type:'VEC', branch:'ECE', sem:3 },
  { code:'313011', name:'Basic Python Programming',                          abbr:'BPP',  type:'AEC', branch:'ECE', sem:3 },
  { code:'313027', name:'Electrical Measurement and Instrumentation',        abbr:'EMI',  type:'AEC', branch:'ECE', sem:3 },

  // ════════════════════════════════════════════════════════
  // ECE — Semester 4 (SY)
  // ════════════════════════════════════════════════════════
  { code:'314301', name:'Environmental Education and Sustainability',        abbr:'EES',  type:'VEC', branch:'ECE', sem:4 },
  { code:'314322', name:'D.C. Machines and Transformers',                   abbr:'DMT',  type:'DSC', branch:'ECE', sem:4 },
  { code:'314328', name:'Microcontroller & Applications',                    abbr:'MAA',  type:'DSE', branch:'ECE', sem:4 },
  { code:'314329', name:'Analog & Digital Communication',                    abbr:'ADC',  type:'DSC', branch:'ECE', sem:4 },
  { code:'314363', name:'Basic Power Electronics',                           abbr:'BPE',  type:'DSC', branch:'ECE', sem:4 },
  { code:'314026', name:'Maintenance of Electrical and Electronic Appliances', abbr:'MEEA', type:'AEC', branch:'ECE', sem:4 },

  // ════════════════════════════════════════════════════════
  // ECE — Semester 5 (TY)
  // ════════════════════════════════════════════════════════
  { code:'315333', name:'A.C. Machines Performance',                         abbr:'ACM',  type:'DSC', branch:'ECE', sem:5 },
  { code:'315338', name:'Embedded System',                                   abbr:'ESY',  type:'DSC', branch:'ECE', sem:5 },
  { code:'315002', name:'Entrepreneurship Development and Startups',         abbr:'ENDS', type:'AEC', branch:'ECE', sem:5 },
  { code:'315003', name:'Seminar and Project Initiation Course',             abbr:'SPI',  type:'AEC', branch:'ECE', sem:5 },
  { code:'315004', name:'Internship (12 Weeks)',                             abbr:'ITR',  type:'INP', branch:'ECE', sem:5 },
  // Elective
  { code:'315335', name:'Electric Vehicle Technology',                       abbr:'EVT',  type:'DSE', branch:'ECE', sem:5 },
  { code:'315337', name:'Renewable Energy Technology',                       abbr:'RET',  type:'DSE', branch:'ECE', sem:5 },
  { code:'315341', name:'IoT Applications',                                  abbr:'IAU',  type:'DSE', branch:'ECE', sem:5 },

  // ════════════════════════════════════════════════════════
  // ECE — Semester 6 (TY)
  // ════════════════════════════════════════════════════════
  { code:'315301', name:'Management',                                        abbr:'MAN',  type:'AEC', branch:'ECE', sem:6 },
  { code:'316326', name:'Emerging Trends in Electrical Engineering',         abbr:'ETE',  type:'DSC', branch:'ECE', sem:6 },
  { code:'316332', name:'Optical Network and Satellite Communication',       abbr:'ONS',  type:'DSC', branch:'ECE', sem:6 },
  { code:'316333', name:'Switchgear and Protection Systems',                 abbr:'SGPS', type:'DSC', branch:'ECE', sem:6 },
  { code:'316004', name:'Capstone Project',                                  abbr:'CPE',  type:'INP', branch:'ECE', sem:6 },
  // Elective
  { code:'316334', name:'Automation & PLC',                                  abbr:'ATP',  type:'DSE', branch:'ECE', sem:6 },
  { code:'316335', name:'Drone Technology',                                  abbr:'DRT',  type:'DSE', branch:'ECE', sem:6 },
  { code:'316336', name:'Wireless & Mobile Communication',                   abbr:'WMC',  type:'DSE', branch:'ECE', sem:6 },
  { code:'316374', name:'Solar Technology and Maintenance',                  abbr:'SOL',  type:'DSE', branch:'ECE', sem:6 },

  // ════════════════════════════════════════════════════════
  // ME — Semester 1 (FY)
  // ════════════════════════════════════════════════════════
  { code:'311302', name:'Basic Mathematics',                                  abbr:'BMS',  type:'AEC', branch:'ME', sem:1 },
  { code:'311303', name:'Communication Skills (English)',                     abbr:'ENG',  type:'AEC', branch:'ME', sem:1 },
  { code:'311305', name:'Basic Science (Physics & Chemistry)',                abbr:'BSC',  type:'DSC', branch:'ME', sem:1 },
  { code:'311001', name:'Fundamentals of ICT',                               abbr:'ICT',  type:'SEC', branch:'ME', sem:1 },
  { code:'311003', name:'Yoga and Meditation',                               abbr:'YAM',  type:'VEC', branch:'ME', sem:1 },
  { code:'311005', name:'Engineering Workshop Practices (Mechanical)',       abbr:'EWP',  type:'SEC', branch:'ME', sem:1 },
  { code:'311006', name:'Engineering Graphics',                              abbr:'EGR',  type:'DSC', branch:'ME', sem:1 },

  // ════════════════════════════════════════════════════════
  // ME — Semester 2 (FY)
  // ════════════════════════════════════════════════════════
  { code:'312301', name:'Applied Mathematics',                               abbr:'AMS',  type:'AEC', branch:'ME', sem:2 },
  { code:'312308', name:'Applied Science (Physics & Chemistry)',             abbr:'ASC',  type:'DSC', branch:'ME', sem:2 },
  { code:'312311', name:'Engineering Drawing',                               abbr:'EDG',  type:'SEC', branch:'ME', sem:2 },
  { code:'312312', name:'Engineering Mechanics',                             abbr:'EGM',  type:'DSC', branch:'ME', sem:2 },
  { code:'312313', name:'Manufacturing Technology',                          abbr:'MPR',  type:'DSC', branch:'ME', sem:2 },
  { code:'312002', name:'Professional Communication',                        abbr:'PCO',  type:'SEC', branch:'ME', sem:2 },
  { code:'312003', name:'Social and Life Skills',                            abbr:'SFS',  type:'VEC', branch:'ME', sem:2 },

  // ════════════════════════════════════════════════════════
  // ME — Semester 3 (SY)
  // ════════════════════════════════════════════════════════
  { code:'313308', name:'Strength of Materials',                             abbr:'SOM',  type:'DSC', branch:'ME', sem:3 },
  { code:'313309', name:'Fluid Mechanics and Machinery',                     abbr:'FMM',  type:'DSC', branch:'ME', sem:3 },
  { code:'313310', name:'Thermal Engineering',                               abbr:'TEG',  type:'DSC', branch:'ME', sem:3 },
  { code:'313311', name:'Production Drawing',                                abbr:'PDR',  type:'SEC', branch:'ME', sem:3 },
  { code:'312020', name:'Basic Electrical and Electronics',                  abbr:'BEE',  type:'AEC', branch:'ME', sem:3 },
  { code:'313002', name:'Essence of Indian Constitution',                    abbr:'EIC',  type:'VEC', branch:'ME', sem:3 },
  { code:'313006', name:'Computer Aided Drafting',                           abbr:'CAD',  type:'SEC', branch:'ME', sem:3 },
  { code:'313007', name:'Fundamentals of Python Programming',                abbr:'FPP',  type:'AEC', branch:'ME', sem:3 },

  // ════════════════════════════════════════════════════════
  // ME — Semester 4 (SY)
  // ════════════════════════════════════════════════════════
  { code:'314301', name:'Environmental Education and Sustainability',        abbr:'EES',  type:'VEC', branch:'ME', sem:4 },
  { code:'313313', name:'Theory of Machines',                                abbr:'TOM',  type:'DSC', branch:'ME', sem:4 },
  { code:'314308', name:'Heat Transfer',                                     abbr:'HET',  type:'DSC', branch:'ME', sem:4 },
  { code:'314309', name:'Machine Design',                                    abbr:'MDE',  type:'DSC', branch:'ME', sem:4 },
  { code:'314310', name:'Manufacturing Processes',                           abbr:'MPN',  type:'DSC', branch:'ME', sem:4 },
  { code:'314025', name:'CADD',                                              abbr:'CAD',  type:'SEC', branch:'ME', sem:4 },

  // ════════════════════════════════════════════════════════
  // ME — Semester 5 (TY)
  // ════════════════════════════════════════════════════════
  { code:'315319', name:'Industrial Automation and Robotics',                abbr:'IAR',  type:'DSC', branch:'ME', sem:5 },
  { code:'315320', name:'Refrigeration and Air Conditioning',                abbr:'RAC',  type:'DSC', branch:'ME', sem:5 },
  { code:'315002', name:'Entrepreneurship Development and Startups',         abbr:'ENDS', type:'AEC', branch:'ME', sem:5 },
  { code:'315003', name:'Seminar and Project Initiation Course',             abbr:'SPI',  type:'AEC', branch:'ME', sem:5 },
  { code:'315004', name:'Internship (12 Weeks)',                             abbr:'ITR',  type:'INP', branch:'ME', sem:5 },
  // Elective
  { code:'315322', name:'Advanced Manufacturing Technology',                 abbr:'AMT',  type:'DSE', branch:'ME', sem:5 },
  { code:'315324', name:'Product Design and Development',                    abbr:'PDD',  type:'DSE', branch:'ME', sem:5 },
  { code:'315327', name:'Maintenance Engineering',                           abbr:'MEN',  type:'DSE', branch:'ME', sem:5 },

  // ════════════════════════════════════════════════════════
  // ME — Semester 6 (TY)
  // ════════════════════════════════════════════════════════
  { code:'315301', name:'Management',                                        abbr:'MAN',  type:'AEC', branch:'ME', sem:6 },
  { code:'316318', name:'Emerging Trends in Mechanical Engineering',         abbr:'ETM',  type:'DSC', branch:'ME', sem:6 },
  { code:'316319', name:'Industrial Engineering and Management',             abbr:'IEM',  type:'DSC', branch:'ME', sem:6 },
  { code:'316320', name:'Non-Conventional Energy Resources',                 abbr:'NER',  type:'DSC', branch:'ME', sem:6 },
  { code:'316004', name:'Capstone Project',                                  abbr:'CPE',  type:'INP', branch:'ME', sem:6 },
  // Elective
  { code:'316321', name:'Mechatronics',                                      abbr:'MCT',  type:'DSE', branch:'ME', sem:6 },
  { code:'316322', name:'Finite Element Analysis',                           abbr:'FEA',  type:'DSE', branch:'ME', sem:6 },
  { code:'316323', name:'Composite Materials',                               abbr:'CMP',  type:'DSE', branch:'ME', sem:6 },
];

// ── Upsert per branch+code ────────────────────────────────────────────────────
// The subjects table has a unique constraint on `code` globally, but each
// branch needs its own row. We use code+branch as a logical composite key.
// If a row with same code AND branch exists, update it; otherwise insert.

const findExisting = db.prepare('SELECT id FROM subjects WHERE code=? AND branch=?');

const insertSubject = db.prepare(`
  INSERT INTO subjects (id, code, name, branch, year, semester, abbreviation, course_type)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const updateSubject = db.prepare(`
  UPDATE subjects
  SET name=?, year=?, semester=?, abbreviation=?, course_type=?
  WHERE code=? AND branch=?
`);

const seedAll = db.transaction(() => {
  let inserted = 0, updated = 0;
  for (const s of subjects) {
    const year = yr(s.sem);
    const existing = findExisting.get(s.code, s.branch);
    if (existing) {
      updateSubject.run(s.name, year, s.sem, s.abbr, s.type, s.code, s.branch);
      updated++;
    } else {
      insertSubject.run(randomUUID(), s.code, s.name, s.branch, year, s.sem, s.abbr, s.type);
      inserted++;
      console.log(`  [+] ${s.branch} Sem${s.sem} ${s.code} — ${s.name}`);
    }
  }
  console.log(`\nDone: ${inserted} inserted, ${updated} updated (${subjects.length} total).`);
});

console.log(`\nSeeding ${subjects.length} subjects across CSE/CE/ECE/ME…`);
seedAll();
db.close();
