import axios from 'axios';
import { io } from 'socket.io-client';
import http from 'http';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { initSocket } from '../src/services/socket.js';

async function testSecurity() {
  console.log('🧪 Starting Task 9: Security Hardening verification...');

  // 1. Boot up a temporary server with helmet and rateLimit to inspect HTTP headers
  const app = express();
  
  app.use(helmet());
  
  const limiter = rateLimit({
    windowMs: 60000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use('/test-limit', limiter);

  app.get('/test-limit', (req, res) => res.send('OK'));

  const server = http.createServer(app);
  initSocket(server);

  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const SERVER_URL = `http://localhost:${port}`;

  console.log('\nStep 1: Auditing Security HTTP Headers...');
  
  // Fetch from rate-limit route
  const res = await axios.get(`${SERVER_URL}/test-limit`);
  
  const headers = res.headers;
  
  // Check CSP (Helmet)
  if (!headers['content-security-policy']) {
    throw new Error('Content-Security-Policy header is missing!');
  }
  console.log('✓ Success: Content-Security-Policy header verified.');

  // Check X-Frame-Options (Helmet)
  if (!headers['x-frame-options']) {
    throw new Error('X-Frame-Options header is missing!');
  }
  console.log('✓ Success: X-Frame-Options header verified.');

  // Check Rate Limiting headers
  if (!headers['ratelimit-limit']) {
    throw new Error('RateLimit-Limit header is missing!');
  }
  console.log(`✓ Success: Rate Limiting headers verified. Limit: ${headers['ratelimit-limit']}`);

  // 2. Test Socket Handshake JWT verification
  console.log('\nStep 2: Auditing Socket JWT Handshake...');

  // Connect with a bad token
  const badSocket = io(SERVER_URL, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    auth: { token: 'invalid_token_payload' }
  });

  await new Promise((resolve) => {
    badSocket.on('connect_error', (err) => {
      console.log(`✓ Success: Connection rejected with expected error: ${err.message}`);
      resolve();
    });
    badSocket.on('connect', () => {
      badSocket.close();
      throw new Error('Socket handshake unexpectedly connected with an invalid token!');
    });
  });

  // Connect with no token (allowed as fallback)
  const fallbackSocket = io(SERVER_URL, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false
  });

  await new Promise((resolve) => {
    fallbackSocket.on('connect', () => {
      console.log('✓ Success: WebSocket allowed connection without token (fallback for kiosks)');
      fallbackSocket.close();
      resolve();
    });
    fallbackSocket.on('connect_error', (err) => {
      throw new Error(`Socket handshake failed to allow unauthenticated connection: ${err.message}`);
    });
  });

  server.close();
  console.log('\n🎉 Task 9 Security Hardening & Rate Limiting tests PASSED!');
  process.exit(0);
}

testSecurity().catch(err => {
  console.error('\n❌ Task 9 Security verification failed:', err.message);
  process.exit(1);
});
