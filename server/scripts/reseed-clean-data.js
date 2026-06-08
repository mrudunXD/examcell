import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, '../data/exam_management.db');

console.log(`Connecting to database at ${DB_PATH}...`);
const db = new Database(DB_PATH);

// Helper to normalize branch
function mapProgramToBranches(program) {
  const p = program.toUpperCase();
  if (p.includes('COMMON TO ALL') || p.includes('COMMON FOR ALL') || p === 'ALL') {
    return ['CE', 'CSE', 'CSE (AIDS)', 'ECE', 'ME', 'MRA'];
  }
  const branches = [];
  if (p.includes('CIVIL') || (p.includes('CE') && !p.includes('ECE'))) branches.push('CE');
  if (p.includes('CSE') || p.includes('AIDS') || p.includes('DATA ANALYTICS') || p.includes('JAVA')) {
    if (p.includes('AIDS')) {
      branches.push('CSE (AIDS)');
    } else {
      branches.push('CSE');
    }
  }
  if (p.includes('ECE') || p.includes('ANALOG')) branches.push('ECE');
  if (p.includes('MRA') || p.includes('ROBO')) {
    branches.push('MRA');
  } else if ((p.includes('ME') && !p.includes('SEMESTER') && !p.includes('SCHEME') && !p.includes('MEASUREMENT')) || p.includes('MECH') || p.includes('HVAC')) {
    branches.push('ME');
  }
  
  if (branches.length === 0) {
    if (p.includes('COMMON')) return ['CE', 'CSE', 'CSE (AIDS)', 'ECE', 'ME', 'MRA'];
    branches.push('CSE');
  }
  return [...new Set(branches)];
}

const facultyList = [
  { id: 1, name: "Prof. Vijaya Vijaykumar Pangave" },
  { id: 2, name: "Prof. Manjushri Sanjay Joshi" },
  { id: 3, name: "Prof. Manisha Rajendra Kuveskar" },
  { id: 4, name: "Prof. Asha Rajendra Sanap" },
  { id: 5, name: "Dr. S.H.Kulkarni" },
  { id: 6, name: "Prof. Farhadeeba Ilyas Shaikh" },
  { id: 7, name: "Prof. Hemlata Sandip Ohal" },
  { id: 8, name: "Prof. Prerana Patil" },
  { id: 9, name: "Prof. Megha Dhotay" },
  { id: 10, name: "Prof. Shilpa Jeevan Budhavale(Shitole)" },
  { id: 11, name: "Prof. Vaishali Bandu Langote" },
  { id: 12, name: "Prof. Sulakshana Sagar Malwade" },
  { id: 13, name: "Prof. Nita Ganesh Dongre(Jaybhaye)" },
  { id: 14, name: "Prof. Vilas Chensing Rathod" },
  { id: 15, name: "Prof. Pallavi Utkarsh Nehete" },
  { id: 16, name: "Prof. Mr. Y. J.Gaikwad" },
  { id: 17, name: "Prof. I. R. Awate" },
  { id: 18, name: "Prof. Swati U Kavale" },
  { id: 19, name: "Prof. Priti Chavhan" },
  { id: 20, name: "Prof. Priti Komathi" },
  { id: 21, name: "Prof. Dr. N. K.Patil" },
  { id: 22, name: "Prof. Dhiresh Someshrao Shastri" },
  { id: 23, name: "Prof. N. B. Choudhari" },
  { id: 24, name: "Prof. Vaibhav Kamaldas Rangari" },
  { id: 25, name: "Prof. Rajesh Damodar Kale" },
  { id: 26, name: "Prof. Jyoti Mangesh Avhad" },
  { id: 27, name: "Prof. Sachin Nana Patil" },
  { id: 28, name: "Prof. K. L. Bawadekar" },
  { id: 29, name: "Prof. S. B. Kashid" },
  { id: 30, name: "Prof. Ratankumar Ashok Patil" },
  { id: 31, name: "Prof. Swati Wagh" },
  { id: 32, name: "Dr. Vinayak Kishan Nirmale" },
  { id: 33, name: "Dr. Mayuri Waghmare" },
  { id: 34, name: "Dr. Kashmiri Ashish Khamkar" },
  { id: 35, name: "Prof. Sampada Kambale" },
  { id: 36, name: "Mrs. U.H. Patil *" },
  { id: 37, name: "Mrs.Dipali Shilimkar *" },
  { id: 39, name: "Mr. Prashant Kale *" },
  { id: 42, name: "Mr. Suresh Patil *" }
];

const evenSubjectsRaw = [
  { year: "Second", program: "Common to all", semester: 4, code: "MST00040", name: "Integral Calculus" },
  { year: "Second", program: "CE (SI&C)", semester: 4, code: "CIV00090", name: "Introduction to Concrete TechNology" },
  { year: "Second", program: "CE (SI&C)", semester: 4, code: "CIV00100", name: "Hydraulics" },
  { year: "Second", program: "CE (SI&C)", semester: 4, code: "CIV00110", name: "Introduction to Geotechnical Engineering" },
  { year: "Second", program: "CE (SI&C)", semester: 4, code: "CIV00080", name: "Theory of Structure" },
  { year: "Second", program: "CSE/CSE (AIDS)", semester: 4, code: "CSE00080/ AID00060", name: "Fundamentals of Computer Networks" },
  { year: "Second", program: "CSE", semester: 4, code: "CSE00100", name: "Digital Techniques" },
  { year: "Second", program: "CSE", semester: 4, code: "CSE00110", name: "Python Programming" },
  { year: "Second", program: "CSE (AIDS)", semester: 4, code: "AID00080", name: "Basics of Machine Learning" },
  { year: "Second", program: "CSE (AIDS)", semester: 4, code: "AID00090", name: "Foundation of Data ware housing and Data Mining" },
  { year: "Second", program: "ME", semester: 4, code: "MEC00100", name: "Manufacturing Processes" },
  { year: "Second", program: "ME", semester: 4, code: "MEC00090", name: "Fluid Mechanics & Hydraulic Machines" },
  { year: "Second", program: "ME", semester: 4, code: "MEC00110", name: "Mechanics of Machines" },
  { year: "Second", program: "ME", semester: 4, code: "MEC00120", name: "Power Engineering & HVAC" },
  { year: "Second", program: "ME (R&A)", semester: 4, code: "MRA00100", name: "Manufacturing Processes" },
  { year: "Second", program: "ME (R&A)", semester: 4, code: "MRA00070", name: "Fluid Mechanics & Hydraulic Machines" },
  { year: "Second", program: "ME (R&A)", semester: 4, code: "MRA00090", name: "Internet of Things" },
  { year: "Second", program: "ME (R&A)", semester: 4, code: "MRA00080", name: "Industrial Robotics & Applications" },
  { year: "Second", program: "ECE (AI&ML)", semester: 4, code: "ECE00080", name: "Linear Integrated Circuits" },
  { year: "Second", program: "ECE (AI&ML)", semester: 4, code: "ECE00090", name: "Basics of Analog & Digital communication" },
  { year: "Second", program: "ECE (AI&ML)", semester: 4, code: "ECE00100", name: "Microcontroller & Interfacing" },
  { year: "Third", program: "CE (SI&C)", semester: 6, code: "CIV0PM16A", name: "Highway Engineering" },
  { year: "Third", program: "CE (SI&C)", semester: 6, code: "CIV0PM17A", name: "Design of Steel Structure" },
  { year: "Third", program: "CE (SI&C)", semester: 6, code: "CIV0PE22A", name: "Maintenance & Repair Structure" },
  { year: "Third", program: "CSE/CSE (AIDS)", semester: 6, code: "CSE0PM15A/AID0PM15A", name: "Fundamentals of Cloud Computing" },
  { year: "Third", program: "CSE/CSE (AIDS)", semester: 6, code: "CSE0PM16A /AID0PM16A", name: "Software Engineering" },
  { year: "Third", program: "CSE", semester: 6, code: "CSE0PE22A", name: "Applied Machine Learning" },
  { year: "Third", program: "CSE (AIDS)", semester: 6, code: "AID0PE22A", name: "Big Data Analytics using Tableau" },
  { year: "Third", program: "ME", semester: 6, code: "MEC0PM16A", name: "Automotive Engineering" },
  { year: "Third", program: "ME", semester: 6, code: "MEC0PM18A", name: "Machine Design" },
  { year: "Third", program: "ME, ME (R&A)", semester: 6, code: "MEC0PE12A /MRA0PE22A", name: "Hybrid Vehicles" },
  { year: "Third", program: "ME, ME (R&A)", semester: 6, code: "MEC0PE32A /MRA0PE32A", name: "Renewable Energy Sources" },
  { year: "Third", program: "ME (R&A)", semester: 6, code: "MRA0PM16A", name: "Automotive Engineering" },
  { year: "Third", program: "ME (R&A)", semester: 6, code: "MRA0PM18A", name: "Machine Design" },
  { year: "Third", program: "ECE(AI & ML)", semester: 6, code: "ECE0PM15A", name: "Introduction to IOT" },
  { year: "Third", program: "ECE(AI & ML)", semester: 6, code: "ECE0PM16A", name: "Data Communication & Networking" },
  { year: "Third", program: "ECE(AI & ML)", semester: 6, code: "ECE0PE12A", name: "Embedded System Design" },
  { year: "Third", program: "ECE(AI & ML)", semester: 6, code: "ECE0PE32A", name: "Industrial Automation" }
];

const oddSubjectsRaw = [
  { year: "First", program: "CE (SI&C). CSE, CSE-(AIDS), ME, ME (Robitics),ECE", semester: 1, code: "MST00050", name: "Basic Mathematics" },
  { year: "First", program: "All", semester: 1, code: "PHY00030", name: "Basic Physics" },
  { year: "First", program: "ECE, ME, ROBO, CIVIL", semester: 1, code: "CHM00030", name: "Basic Chemistry" },
  { year: "First", program: "All", semester: 1, code: "ENG00020", name: "Communicative Competance" },
  { year: "Second", program: "Common for ALL", semester: 3, code: "MST00030", name: "Linear algebra and Differential Calculus" },
  { year: "Second", program: "CE (SI&C)", semester: 3, code: "CIV00030", name: "Mechanics of Structure" },
  { year: "Second", program: "CE (SI&C)", semester: 3, code: "CIV00040", name: "Basic of Survey" },
  { year: "Second", program: "CE (SI&C)", semester: 3, code: "CIV00050", name: "Building Construction" },
  { year: "Second", program: "CE (SI&C)", semester: 3, code: "CIV00060", name: "Mode of Transportation" },
  { year: "Second", program: "CSE (AIDS)", semester: 3, code: "CSE00030 / AID00010", name: "Algorithms and Data Structures Concept" },
  { year: "Second", program: "CSE (AIDS)", semester: 3, code: "CSE00040 / AID00020", name: "Object Oriented Programming Concepts" },
  { year: "Second", program: "CSE (AIDS)", semester: 3, code: "CSE00050 / AID00030", name: "Relational Database Management System Concepts" },
  { year: "Second", program: "ME / MRA", semester: 3, code: "MEC00030 / MRA00010", name: "Basics Thermodynamics" },
  { year: "Second", program: "ME / MRA", semester: 3, code: "MEC00040 / MRA00020", name: "Basics of Mechatronics" },
  { year: "Second", program: "MRA", semester: 3, code: "MRA0030", name: "Basics of Robotics" },
  { year: "Second", program: "ME / MRA", semester: 3, code: "MEC00070 / MRA00050", name: "Mechanics of Materials" },
  { year: "Second", program: "ME", semester: 3, code: "MEC00060", name: "Materials and Matallurgy" },
  { year: "Second", program: "ECE", semester: 3, code: "ECE00030", name: "Electronic Devices and Circuits" },
  { year: "Second", program: "ECE", semester: 3, code: "ECE00040", name: "Electronic Measurement & Instruments" },
  { year: "Second", program: "ECE", semester: 3, code: "ECE00050", name: "Digital Electronics" },
  { year: "Second", program: "ECE", semester: 3, code: "ECE00060", name: "Electrical Engineering" },
  { year: "Third", program: "CE (SI&C)", semester: 5, code: "CIV0PM12A", name: "Estimation & Costing" },
  { year: "Third", program: "CE (SI&C)", semester: 5, code: "CIV0PM13A", name: "Water Resource Engineering" },
  { year: "Third", program: "CE (SI&C)", semester: 5, code: "CIV0PM15A", name: "Public Health Engineering" },
  { year: "Third", program: "CE (SI&C)", semester: 5, code: "CIV0PM14A", name: "Design of RCC Structure" },
  { year: "Third", program: "CE (SI&C)", semester: 5, code: "CIV0PE12A", name: "Traffic Engineering  (Elective-I)" },
  { year: "Third", program: "CSE,AIDS", semester: 5, code: "CSE0PM20A/ AID0PM20A", name: "Java Programming" },
  { year: "Third", program: "CSE", semester: 5, code: "CSE0PM14A/ AID0PM13A", name: "Concepts of Operating Systems" },
  { year: "Third", program: "AIDS", semester: 5, code: "AID0PM14A", name: "Fundamentals of Data Analytics" },
  { year: "Third", program: "CSE", semester: 5, code: "CSE0PE21A", name: "Basics of Machine Learning" },
  { year: "Third", program: "CSE,AIDS", semester: 5, code: "CSE0PM13A/AID0PE11A", name: "Foundations of Network Security" },
  { year: "Third", program: "AIDS", semester: 5, code: "AID0PE21A", name: "Applied Machine Learning" },
  { year: "Third", program: "ME / MRA", semester: 5, code: "MEC0PM11A / MRA0PM11A", name: "Engineering metrology" },
  { year: "Third", program: "ME / MRA", semester: 5, code: "MEC0PM12A/ MRA0PM12A", name: "Industrial Hydraulics & Pneumatics" },
  { year: "Third", program: "ME / MRA", semester: 5, code: "MEC0PM13A/ MRA0PM13A", name: "Materials and Matallurgy" },
  { year: "Third", program: "ME", semester: 5, code: "MEC0PM14A", name: "Modern Manufacturing Process" },
  { year: "Third", program: "ME/MRA", semester: 5, code: "MEC0PE11A/ MRA0PE21A", name: "Drone Technology (MEC0PE11A)" },
  { year: "Third", program: "MRA", semester: 5, code: "MRA0PM15A", name: "Robot Programming" },
  { year: "Third", program: "MRA", semester: 5, code: "MRA0PE11A", name: "Computer Integrated Manufacturing" },
  { year: "Third", program: "ECE", semester: 5, code: "ECE0PM12A", name: "Fundamentals of Control System" },
  { year: "Third", program: "ECE", semester: 5, code: "ECE0PM13A", name: "Power Electronics" },
  { year: "Third", program: "ECE", semester: 5, code: "ECE0PM14A", name: "Introduction to AIML" },
  { year: "Third", program: "ECE", semester: 5, code: "ECE0PE11A", name: "Embedded C Programming" },
  { year: "Third", program: "ECE", semester: 5, code: "ECE0PE31A", name: "Fundamentals of Mechatronics" }
];

try {
  console.log('🔒 Disabling foreign key constraints temporarily for seed transaction...');
  db.pragma('foreign_keys = OFF');
  
  db.transaction(() => {
    console.log('🗑️ Purging existing timetable, duties, seating, and subjects...');
    
    db.prepare('DELETE FROM faculty_subjects').run();
    db.prepare('DELETE FROM supervisor_duties').run();
    db.prepare('DELETE FROM seat_assignments').run();
    db.prepare('DELETE FROM room_allocations').run();
    db.prepare('DELETE FROM slot_students').run();
    db.prepare('DELETE FROM exam_slots').run();
    db.prepare('DELETE FROM attendance').run();
    db.prepare('DELETE FROM incidents').run();
    db.prepare('DELETE FROM conflicts').run();
    db.prepare('DELETE FROM subjects').run();
    db.prepare("DELETE FROM users WHERE role = 'faculty'").run();
    
    console.log('🌱 Seeding Faculty members (39 entries)...');
    
    const insertFaculty = db.prepare(`
      INSERT INTO users (id, name, email, password_hash, role, department, is_active)
      VALUES (?, ?, ?, ?, 'faculty', ?, 1)
    `);
    
    const defaultPasswordHash = bcrypt.hashSync('123456789', 10);
    const emailsUsed = new Set();
    const facultyIdsMapped = [];

    for (const f of facultyList) {
      const parts = f.name.replace(/Prof\.|Dr\.|Mr\.|Mrs\./g, '').trim().split(/\s+/);
      const first = parts[0]?.toLowerCase() || 'faculty';
      const last = parts[parts.length - 1]?.toLowerCase() || 'member';
      
      let email = `${first}.${last}@mitwpu.edu.in`;
      let counter = 1;
      while (emailsUsed.has(email)) {
        email = `${first}.${last}${counter}@mitwpu.edu.in`;
        counter++;
      }
      emailsUsed.add(email);
      
      const uuid = crypto.randomUUID();
      // Determine department loosely based on name or assign 'Common'
      const dept = 'Common';
      
      insertFaculty.run(uuid, f.name, email, defaultPasswordHash, dept);
      facultyIdsMapped.push(uuid);
      console.log(`  [+] Seeding Faculty: ${f.name} (${email})`);
    }
    
    console.log('📚 Seeding Subjects (Even & Odd)...');
    
    const insertSubject = db.prepare(`
      INSERT INTO subjects (id, code, name, branch, year, semester, abbreviation, course_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const allSubjectsRaw = [...evenSubjectsRaw, ...oddSubjectsRaw];
    const seededSubjectIds = [];
    
    for (const raw of allSubjectsRaw) {
      const yearCode = raw.year.toLowerCase().startsWith('first') ? 'FY' : 
                       raw.year.toLowerCase().startsWith('second') ? 'SY' : 
                       raw.year.toLowerCase().startsWith('third') ? 'TY' : 'LY';
      
      const branches = mapProgramToBranches(raw.program);
      
      // Parse codes, splitting on '/'
      const codes = raw.code.split('/').map(c => c.trim());
      
      for (let branch of branches) {
        for (const code of codes) {
          const codeUpper = code.toUpperCase().trim();
          if (codeUpper.startsWith('AID')) {
            branch = 'CSE (AIDS)';
          } else if (codeUpper.startsWith('AIML')) {
            branch = 'ECE (AI&ML)';
          } else if (codeUpper.startsWith('CYB') || codeUpper.startsWith('CS')) {
            branch = 'Cyber Security';
          } else if (codeUpper.startsWith('IOT')) {
            branch = 'IoT';
          } else if (codeUpper.startsWith('AI')) {
            branch = 'AI';
          } else if (codeUpper.startsWith('DS')) {
            branch = 'DS';
          } else if (codeUpper.startsWith('MEC')) {
            branch = 'ME';
          } else if (codeUpper.startsWith('MRA')) {
            branch = 'MRA';
          } else if (codeUpper.startsWith('CIV')) {
            branch = 'CE';
          } else if (codeUpper.startsWith('ECE')) {
            branch = 'ECE';
          } else if (codeUpper.startsWith('CSE')) {
            branch = 'CSE';
          }

          const uuid = crypto.randomUUID();
          // generate abbreviation
          const abbreviation = raw.name.split(/\s+/).map(w => w[0]).join('').toUpperCase().replace(/[^A-Z]/g, '');
          
          try {
            insertSubject.run(
              uuid,
              code,
              raw.name,
              branch,
              yearCode,
              raw.semester,
              abbreviation,
              'theory'
            );
            seededSubjectIds.push(uuid);
          } catch (err) {
            // Unique constraint might trigger if same code/branch exists
            console.warn(`  [!] Skipping duplicate/constraint subject: ${code} - ${branch}`);
          }
        }
      }
    }
    console.log(`  [+] Seeded ${seededSubjectIds.length} subjects in total.`);

    console.log('🔗 Generating teaches-mappings for OR-Tools compatibility...');
    const insertTeaches = db.prepare(`
      INSERT INTO faculty_subjects (faculty_id, subject_id)
      VALUES (?, ?)
    `);

    // Assign each faculty member to 2 subjects
    if (seededSubjectIds.length > 0) {
      for (let i = 0; i < facultyIdsMapped.length; i++) {
        const facId = facultyIdsMapped[i];
        
        // Deterministic mapping to make it stable
        const sub1 = seededSubjectIds[i % seededSubjectIds.length];
        const sub2 = seededSubjectIds[(i + 7) % seededSubjectIds.length];
        
        insertTeaches.run(facId, sub1);
        if (sub1 !== sub2) {
          insertTeaches.run(facId, sub2);
        }
      }
      console.log(`  [+] teaches-relations successfully created.`);
    }
  })();
  
  console.log('🔑 Re-enabling foreign key constraints...');
  db.pragma('foreign_keys = ON');
  
  console.log('🎉 Data reseeding completed successfully!');
} catch (err) {
  console.error('❌ Reseeding failed:', err.message);
  try {
    db.pragma('foreign_keys = ON');
  } catch (_) {}
  process.exit(1);
}
