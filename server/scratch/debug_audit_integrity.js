import dotenv from 'dotenv';
dotenv.config();

import pg from 'pg';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'mitwpu_exam_secret_2026_change_in_prod';
const PGHOST = process.env.PGHOST || 'localhost';
const PGPORT = parseInt(process.env.PGPORT || '5432');
const PGUSER = process.env.PGUSER || 'postgres';
const PGPASSWORD = process.env.PGPASSWORD || '1234';
const PGDATABASE = process.env.PGDATABASE || 'exam_management';

// Parse PostgreSQL TIMESTAMP (without time zone) (OID 1114) as UTC Date
pg.types.setTypeParser(1114, stringValue => {
  return new Date(stringValue.replace(' ', 'T') + 'Z');
});

async function main() {
  const pool = new pg.Pool({
    host: PGHOST,
    port: PGPORT,
    user: PGUSER,
    password: PGPASSWORD,
    database: PGDATABASE
  });

  const client = await pool.connect();
  try {
    const res = await client.query('SELECT * FROM audit_log ORDER BY created_at ASC, id ASC');
    const logs = res.rows;
    console.log(`Total audit logs fetched: ${logs.length}`);

    let expectedPrevHash = 'GENESIS_HASH';
    let tamperedCount = 0;

    for (const log of logs) {
      if (!log.hash || !log.prev_hash) {
        console.log(`Skipping entry ID ${log.id} due to missing hash/prev_hash`);
        continue;
      }

      // If log starts a new chain (e.g. after an unhashed migration entry), reset expected hash
      if (log.prev_hash === 'GENESIS_HASH') {
        expectedPrevHash = 'GENESIS_HASH';
      }

      // Check link
      if (log.prev_hash !== expectedPrevHash) {
        console.log(`❌ Link mismatch on entry ID ${log.id}:`);
        console.log(`   Log prev_hash:     ${log.prev_hash}`);
        console.log(`   Expected prev_hash: ${expectedPrevHash}`);
        tamperedCount++;
      }

      // Recompute hash
      const dateObj = new Date(log.created_at);
      const timestampStr = log.created_at instanceof Date 
        ? log.created_at.toISOString() 
        : (isNaN(dateObj.getTime()) ? log.created_at : dateObj.toISOString());

      const input = `${log.prev_hash}-${log.user_id}-${log.action}-${log.entity}-${log.entity_id || ''}-${log.details || ''}-${timestampStr}`;
      const calculatedHash = crypto.createHash('sha256').update(input).digest('hex');

      if (log.hash !== calculatedHash) {
        console.log(`❌ Hash mismatch on entry ID ${log.id}:`);
        console.log(`   Input generated: "${input}"`);
        console.log(`   Calculated Hash:  ${calculatedHash}`);
        console.log(`   Database Hash:    ${log.hash}`);
        tamperedCount++;
      }

      expectedPrevHash = log.hash;
    }

    console.log(`\nVerification finished. Tampered count: ${tamperedCount}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
