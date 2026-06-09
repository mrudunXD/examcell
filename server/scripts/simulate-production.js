import { io } from 'socket.io-client';
import axios from 'axios';
import dotenv from 'dotenv';
import { initDb, getDb } from '../src/db/database.js';

dotenv.config();

const SERVER_URL = 'http://localhost:5000';
const NUM_KIOSKS = 50;

async function simulate() {
  console.log('🏁 Starting Advanced Production Simulation...');
  
  // 1. Initialize DB to query real seed data
  await initDb();
  const db = getDb();

  // Fetch a coordinator and a faculty member
  const coordinator = await db.prepare("SELECT * FROM users WHERE role='coordinator' AND is_active=1 LIMIT 1").get();
  const facultyList = await db.prepare("SELECT * FROM users WHERE role='faculty' AND is_active=1 LIMIT 5").all();
  const slot = await db.prepare("SELECT * FROM exam_slots LIMIT 1").get();

  if (!coordinator) {
    console.error('❌ Error: No coordinator found in database. Seed database first.');
    process.exit(1);
  }
  console.log(`✓ Loaded coordinator: ${coordinator.email}`);
  console.log(`✓ Loaded ${facultyList.length} faculty members for duty simulation`);

  // 2. Connect 50 kiosks via WebSockets
  console.log(`\n📡 Connecting ${NUM_KIOSKS} simulated kiosks via WebSocket...`);
  const sockets = [];
  for (let i = 1; i <= NUM_KIOSKS; i++) {
    const roomNo = `A${100 + i}`;
    const socket = io(SERVER_URL, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false
    });

    socket.on('connect', () => {
      socket.emit('register_kiosk', {
        classroomId: `room_uuid_${i}`,
        roomNo
      });
    });

    sockets.push(socket);
  }
  console.log(`✓ WebSocket kiosk instances initialized.`);

  // Set up ping interval
  const pingInterval = setInterval(() => {
    for (const socket of sockets) {
      if (socket.connected) {
        socket.emit('kiosk_ping');
      }
    }
  }, 5000);

  // 3. Authenticate and simulate operations
  try {
    console.log('\n🔐 Authenticating users...');
    // Admin login
    const adminLogin = await axios.post(`${SERVER_URL}/api/auth/login`, {
      email: 'admin@mitwpu.edu.in',
      password: 'admin123'
    });
    const adminToken = adminLogin.data.token;
    const adminHeaders = { headers: { Authorization: `Bearer ${adminToken}` } };

    // Faculty login and duty check
    if (facultyList.length > 0) {
      const fac = facultyList[0];
      console.log(`👤 Simulating login for faculty: ${fac.email}...`);
      
      // We assume faculty password is 'faculty123' or 'admin123' (fallback)
      let facToken;
      try {
        const facLogin = await axios.post(`${SERVER_URL}/api/auth/login`, {
          email: fac.email,
          password: 'faculty123'
        });
        facToken = facLogin.data.token;
      } catch {
        // Fallback to admin login for faculty if seed password is different
        console.log('   (Using admin bypass token for faculty endpoints)');
        facToken = adminToken;
      }
      
      const facHeaders = { headers: { Authorization: `Bearer ${facToken}` } };

      if (slot) {
        // Fetch seating
        console.log(`   Fetching seating assignment details for slot ID: ${slot.id}...`);
        const seatRes = await axios.get(`${SERVER_URL}/api/seating/${slot.id}`, facHeaders);
        console.log(`   Retrieved ${seatRes.data.length || 0} seating rows.`);

        // Mark random attendance
        console.log('   Submitting bulk attendance sheet updates...');
        const mockStudentId = await db.prepare('SELECT student_id FROM slot_students WHERE slot_id=? LIMIT 1').get(slot.id);
        if (mockStudentId) {
          await axios.post(`${SERVER_URL}/api/attendance/${slot.id}`, {
            records: [{
              student_id: mockStudentId.student_id,
              status: 'present',
              notes: 'Simulated present'
            }]
          }, facHeaders);
          console.log('   ✓ Attendance marked.');
        }

        // File malpractice incident report
        console.log('   Filing malpractice incident report...');
        await axios.post(`${SERVER_URL}/api/incidents`, {
          slot_id: slot.id,
          type: 'malpractice',
          description: 'Simulated load test malpractice warning',
          student_prn: '1032210001',
          severity: 'high'
        }, facHeaders);
        console.log('   ✓ Malpractice incident filed successfully.');
      }
    }

    // 4. Concurrency Locking Conflicts
    console.log('\n🤖 Simulating concurrent admin edits...');
    const cyclesRes = await axios.get(`${SERVER_URL}/api/exam-cycles`, adminHeaders);
    const cycle = cyclesRes.data[0];
    if (cycle) {
      console.log(`   Target Cycle: "${cycle.name}" (ID: ${cycle.id}, Version: ${cycle.version})`);
      const payloadA = { ...cycle, name: `${cycle.name} (Edit A)` };
      const payloadB = { ...cycle, name: `${cycle.name} (Edit B)` };

      const resA = await axios.put(`${SERVER_URL}/api/exam-cycles/${cycle.id}`, payloadA, adminHeaders);
      console.log(`   ✓ Admin A update succeeded. Version updated to: ${resA.data.version}`);

      try {
        await axios.put(`${SERVER_URL}/api/exam-cycles/${cycle.id}`, payloadB, adminHeaders);
        console.error('   ❌ Fail: Concurrent Admin B update succeeded without conflict.');
      } catch (err) {
        if (err.response && err.response.status === 409) {
          console.log('   ✓ Pass: Admin B update correctly blocked with 409 Conflict!');
        } else {
          console.error('   ❌ Fail: Unexpected error on concurrent edit:', err.message);
        }
      }
    }

    // 5. Query health telemetry metrics
    setTimeout(async () => {
      console.log('\n📊 Fetching telemetry metrics...');
      const healthRes = await axios.get(`${SERVER_URL}/api/health/metrics`, adminHeaders);
      console.log(`   Active WebSockets: ${healthRes.data.websockets.activeConnections}`);
      console.log(`   Kiosks connected: ${healthRes.data.websockets.kiosks.length}`);
      console.log(`   DB Latency: ${healthRes.data.database.dbLatency}ms`);
      console.log(`   Heap memory: ${(healthRes.data.system.memory.heapUsed / 1024 / 1024).toFixed(2)} MB`);

      // 6. Cleanup
      console.log('\n🛑 Tearing down simulation instances...');
      clearInterval(pingInterval);
      for (const socket of sockets) {
        socket.close();
      }
      console.log('🎉 Production simulation complete!');
      process.exit(0);
    }, 3000);

  } catch (err) {
    console.error('❌ Production simulation failed with error:', err.message);
    clearInterval(pingInterval);
    for (const socket of sockets) {
      socket.close();
    }
    process.exit(1);
  }
}

simulate();
