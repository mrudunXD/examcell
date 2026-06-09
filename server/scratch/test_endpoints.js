import dotenv from 'dotenv';
dotenv.config();

import pg from 'pg';
import jwt from 'jsonwebtoken';
import axios from 'axios';

const JWT_SECRET = process.env.JWT_SECRET || 'mitwpu_exam_secret_2026_change_in_prod';
const PGHOST = process.env.PGHOST || 'localhost';
const PGPORT = parseInt(process.env.PGPORT || '5432');
const PGUSER = process.env.PGUSER || 'postgres';
const PGPASSWORD = process.env.PGPASSWORD || '1234';
const PGDATABASE = process.env.PGDATABASE || 'exam_management';

async function testAll() {
  console.log('🚀 Starting direct endpoint validation against http://localhost:5000...');

  // Connect directly to PG to fetch coordinator user
  const pool = new pg.Pool({
    host: PGHOST,
    port: PGPORT,
    user: PGUSER,
    password: PGPASSWORD,
    database: PGDATABASE
  });

  let client;
  let coordinatorId;
  try {
    client = await pool.connect();
    const res = await client.query("SELECT id FROM users WHERE role = 'coordinator' LIMIT 1");
    if (res.rows.length === 0) {
      console.error('❌ Failed: Coordinator user not found in database.');
      process.exit(1);
    }
    coordinatorId = res.rows[0].id;
  } catch (err) {
    console.error('❌ Failed to connect to database:', err.message);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }

  // Sign JWT
  const token = jwt.sign({ userId: coordinatorId }, JWT_SECRET, { expiresIn: '8h' });
  console.log(`✓ Generated Coordinator JWT token for user ID: ${coordinatorId}`);

  let failed = false;

  // 1. Test Prometheus /metrics endpoint
  try {
    const res = await axios.get('http://localhost:5000/metrics');
    console.log('✓ GET /metrics: OK (HTTP ' + res.status + ')');
    const hasDbLatency = res.data.includes('db_query_latency_ms');
    const hasWsConnections = res.data.includes('websocket_connections_active');
    const hasCpuMetrics = res.data.includes('process_cpu_user_seconds_total');
    
    if (hasDbLatency && hasWsConnections && hasCpuMetrics) {
      console.log('  ✓ PASS: Prometheus metrics formatting verified.');
    } else {
      console.error('  ❌ FAIL: Missing metrics in scraper output.');
      failed = true;
    }
  } catch (err) {
    console.error('❌ FAIL: GET /metrics failed with error:', err.message);
    failed = true;
  }

  // 2. Test Swagger API Docs /api-docs endpoint
  try {
    const res = await axios.get('http://localhost:5000/api-docs/');
    console.log('✓ GET /api-docs/: OK (HTTP ' + res.status + ')');
    if (res.data.includes('swagger') || res.data.includes('Swagger')) {
      console.log('  ✓ PASS: Swagger UI documentation wrapper verified.');
    } else {
      console.error('  ❌ FAIL: Swagger html content invalid.');
      failed = true;
    }
  } catch (err) {
    console.error('❌ FAIL: GET /api-docs/ failed with error:', err.message);
    failed = true;
  }

  // 3. Test Historical Analytics endpoint
  try {
    const res = await axios.get('http://localhost:5000/api/analytics/historical', {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('✓ GET /api/analytics/historical: OK (HTTP ' + res.status + ')');
    
    const hasCycles = Array.isArray(res.data.cycles);
    const hasOverall = typeof res.data.overall === 'object';
    
    if (hasCycles && hasOverall) {
      console.log(`  ✓ PASS: Analytics payload verified. Found ${res.data.cycles.length} cycles.`);
    } else {
      console.error('  ❌ FAIL: Invalid analytics response structure.');
      failed = true;
    }
  } catch (err) {
    console.error('❌ FAIL: GET /api/analytics/historical failed with error:', err.message);
    failed = true;
  }

  if (failed) {
    console.error('❌ Some endpoint validations FAILED.');
    process.exit(1);
  } else {
    console.log('🎉 All endpoint validations PASSED successfully!');
    process.exit(0);
  }
}

testAll().catch(err => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
