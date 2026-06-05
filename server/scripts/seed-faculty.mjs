// Faculty seeder — runs against the live API on localhost:5000
// Uses Node 24 built-in fetch (no imports needed)

const BASE = 'http://localhost:5000/api';
const PASSWORD = '123456789';
const DEPT = 'CSE';

// Deduplicate first names → use firstname.lastname when collision exists
const faculty = [
  { name: 'Narhar Krishnaji Patil',         designation: 'Lecturer (Sr. Scale)' },
  { name: 'Farhadeeba Ilyas Shaikh',         designation: 'Lecturer (Sr. Scale)' },
  { name: 'Anuradha Amar Bakare',            designation: 'Lecturer (Sr. Scale)' },
  { name: 'Hemlata Sandip Ohal',             designation: 'Lecturer (Sr. Scale)' },
  { name: 'Jyoti Ganesh Mante',              designation: 'Programme Head CSE and AI DS' },
  { name: 'Kavita Lalit Bawdekar',           designation: 'Lecturer (Sr. Scale)' },
  { name: 'Mrunal Pravinkumar Fatangare',    designation: 'Lecturer (Sr. Scale)' },
  { name: 'Sunil Shriram Karad',             designation: 'Programme Coordinator' },
  { name: 'Mayuri Laxman Waghmare',          designation: 'Lecturer' },
  { name: 'Kashmiri Ashish Khamkar',         designation: 'Lecturer' },
  { name: 'Ratankumar Ashok Patil',          designation: 'Lecturer' },
  { name: 'Shweta Baban Kashid',             designation: 'Lecturer' },
  { name: 'Mangesh Raghvendra Mahajan',      designation: 'Lecturer' },
  { name: 'Snehal Sayajirao Wagh',           designation: 'Lecturer' },
  { name: 'Vinayak Kishan Nirmale',          designation: 'Lecturer' },
  { name: 'Sagar Ramdas Sonawane',           designation: 'Program Coordinator' },
  { name: 'Vaishali Bandu Langote',          designation: 'Lecturer' },
  { name: 'Mrunal Swapnil Aware',            designation: 'Lecturer' },
  { name: 'Nita Ganesh Dongre',              designation: 'Lecturer' },
  { name: 'Sulakshana Sagar Malwade',        designation: 'Lecturer' },
  { name: 'Prerna Siddharth Patil',          designation: 'Lecturer' },
  { name: 'Shilpa Jeevan Budhavale',         designation: 'Lecturer' },
  { name: 'Sheetal Kiran Pawar',             designation: 'Lecturer' },
  { name: 'Asha Rajendra Sanap',             designation: 'Lecturer' },
  { name: 'Vilas Chensing Rathod',           designation: 'Lecturer' },
  { name: 'Yogesh Jayant Gaikwad',           designation: 'Lecturer' },
  { name: 'Pallavi Utkarsh Nehete',          designation: 'Lecturer in Computer Science & Engineering' },
  { name: 'Naresh Babanrao Chaudhari',       designation: 'Lecturer' },
  { name: 'Vaibhav Kamaldas Rangari',        designation: 'Lecturer' },
  { name: 'Tushar Santosh Nikumbh',          designation: 'Lecturer' },
  { name: 'Jyoti Mangesh Avhad',             designation: 'Lecturer' },
  { name: 'Sachin Nana Patil',               designation: 'Lecturer' },
  { name: 'Manjushri Sanjay Joshi',          designation: 'Lecturer' },
  { name: 'Swati Snehal Wagh',               designation: 'Lecturer in Physics' },
  { name: 'Dhiresh Someshrao Shastri',       designation: 'Lecturer' },
  { name: 'Sanjivani Hemant Kulkarni',       designation: 'Lecturer (Selection Grade)' },
  { name: 'Vijaya Vijaykumar Pangave',       designation: 'Lecturer (Selection Grade)' },
  { name: 'Manisha Rajendra Kuveskar',       designation: 'Lecturer (Selection Grade)' },
  { name: 'Rajesh Damodar Kale',             designation: 'Lecturer / Workshop Superintendent' },
];

// Build emails — firstname@gmail.com, dedup with firstname.lastname@gmail.com
const firstNameCount = {};
faculty.forEach(f => {
  const fn = f.name.split(' ')[0].toLowerCase();
  firstNameCount[fn] = (firstNameCount[fn] || 0) + 1;
});
const firstNameUsed = {};
faculty.forEach(f => {
  const parts = f.name.split(' ');
  const fn = parts[0].toLowerCase();
  const ln = parts[parts.length - 1].toLowerCase();
  if (firstNameCount[fn] > 1) {
    // deduplicate
    const used = firstNameUsed[fn] || 0;
    f.email = used === 0 ? `${fn}.${ln}@gmail.com` : `${fn}.${ln}${used}@gmail.com`;
    firstNameUsed[fn] = used + 1;
  } else {
    f.email = `${fn}@gmail.com`;
  }
});

async function seed() {
  // Login
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@mitwpu.edu.in', password: 'admin123' }),
  });
  const { token } = await loginRes.json();
  if (!token) { console.error('Login failed'); process.exit(1); }
  console.log('Logged in as coordinator');

  let inserted = 0, skipped = 0, failed = 0;

  for (const f of faculty) {
    try {
      const res = await fetch(`${BASE}/faculty`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: f.name,
          email: f.email,
          department: DEPT,
          password: PASSWORD,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        console.log(`  [+] ${f.name} → ${f.email}`);
        inserted++;
      } else if (res.status === 409 || data?.error?.includes('already')) {
        console.log(`  [=] SKIP (exists): ${f.email}`);
        skipped++;
      } else {
        console.error(`  [!] FAIL ${f.name}: ${data?.error}`);
        failed++;
      }
    } catch (err) {
      console.error(`  [!] ERROR ${f.name}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nDone: ${inserted} inserted, ${skipped} skipped, ${failed} failed`);
}

seed();
