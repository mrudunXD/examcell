import { initDb } from '../src/db/database.js';
import { initSocket } from '../src/services/socket.js';
import http from 'http';
import { io } from 'socket.io-client';

async function testMemoryLeak() {
  console.log('🧪 Starting Task 8: Memory Leak Profiling...');

  await initDb();
  const server = http.createServer();
  initSocket(server);
  
  // Start server on random local port for socket simulation
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const SERVER_URL = `http://localhost:${port}`;

  const initialMemory = process.memoryUsage().heapUsed;
  console.log(`Initial Heap Memory: ${(initialMemory / 1024 / 1024).toFixed(2)} MB`);

  // Simulate multiple connection storm cycles
  const stormCycles = 5;
  const connectionsPerCycle = 20;

  for (let cycle = 1; cycle <= stormCycles; cycle++) {
    console.log(`\nRunning connection storm cycle ${cycle}/${stormCycles}...`);
    const sockets = [];

    // Connect clients
    await new Promise(resolve => {
      let connectedCount = 0;
      for (let i = 0; i < connectionsPerCycle; i++) {
        const socket = io(SERVER_URL, {
          transports: ['websocket'],
          forceNew: true,
          reconnection: false
        });

        socket.on('connect', () => {
          socket.emit('register_kiosk', { classroomId: `room_${cycle}_${i}`, roomNo: `A${100 + i}` });
          connectedCount++;
          if (connectedCount === connectionsPerCycle) {
            resolve();
          }
        });

        sockets.push(socket);
      }
    });

    // Disconnect all
    for (const socket of sockets) {
      socket.close();
    }
    
    // Brief pause to allow garbage collection and socket teardown processing
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Final check
  const finalMemory = process.memoryUsage().heapUsed;
  const growth = finalMemory - initialMemory;
  const growthMb = growth / 1024 / 1024;
  console.log(`\nFinal Heap Memory: ${(finalMemory / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Heap growth: ${growthMb.toFixed(2)} MB`);

  // We set a safe bound threshold of 35MB growth limit for this brief storm test
  const heapBoundMb = 35;
  if (growthMb > heapBoundMb) {
    throw new Error(`Memory leak suspected: Heap growth is ${growthMb.toFixed(2)} MB, which exceeds the threshold of ${heapBoundMb} MB.`);
  }

  console.log('✓ Success: Memory usage remains stable and bounded under stress!');
  
  // Close socket server
  server.close();
  
  console.log('\n🎉 Task 8 Memory Leak Profiling tests PASSED!');
  process.exit(0);
}

testMemoryLeak().catch(err => {
  console.error('\n❌ Task 8 Memory Leak Profiling failed:', err.message);
  process.exit(1);
});
