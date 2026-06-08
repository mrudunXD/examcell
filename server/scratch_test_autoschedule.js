const BASE = 'http://localhost:5000/api';
const cycleId = '34b46180-107b-4e38-9be1-d8ffd4297aec'; // Active cycle ID

async function run() {
  console.log('Logging in as coordinator...');
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@mitwpu.edu.in', password: 'admin123' })
  });
  
  if (!loginRes.ok) {
    console.error('Login failed:', await loginRes.text());
    process.exit(1);
  }
  
  const { token } = await loginRes.json();
  console.log('Logged in successfully! Token acquired.');
  
  console.log(`Triggering auto-schedule for cycle ID ${cycleId}...`);
  const scheduleRes = await fetch(`${BASE}/exam-cycles/${cycleId}/auto-schedule`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
  
  const scheduleData = await scheduleRes.json();
  console.log('Status code:', scheduleRes.status);
  console.log('Response:', scheduleData);
}

run().catch(console.error);
