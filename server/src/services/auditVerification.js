import { getDb } from '../db/database.js';
import crypto from 'crypto';

export async function verifyAuditLogChain() {
  const db = getDb();
  // Fetch logs in chronological order
  const logs = await db.prepare('SELECT * FROM audit_log ORDER BY created_at ASC, id ASC').all();
  
  let expectedPrevHash = 'GENESIS_HASH';
  let isTampered = false;
  const tamperedIds = [];

  for (const log of logs) {
    // Skip older entries migrated before cryptographic hashes were introduced
    if (!log.hash || !log.prev_hash) {
      continue;
    }

    // 1. Check link to previous hash
    if (log.prev_hash !== expectedPrevHash) {
      isTampered = true;
      tamperedIds.push(log.id);
    }

    // 2. Recompute current hash
    // Standardize timestamp representation to match ISO format
    const dateObj = new Date(log.created_at);
    const timestampStr = log.created_at instanceof Date 
      ? log.created_at.toISOString() 
      : (isNaN(dateObj.getTime()) ? log.created_at : dateObj.toISOString());

    const input = `${log.prev_hash}-${log.user_id}-${log.action}-${log.entity}-${log.entity_id || ''}-${log.details || ''}-${timestampStr}`;
    const calculatedHash = crypto.createHash('sha256').update(input).digest('hex');

    if (log.hash !== calculatedHash) {
      console.log(`⚠️ Audit log verification mismatch on entry ID ${log.id}:`);
      console.log(`  Calculated Input: "${input}"`);
      console.log(`  Calculated Hash:  ${calculatedHash}`);
      console.log(`  Database Hash:    ${log.hash}`);
      
      isTampered = true;
      tamperedIds.push(log.id);
    }

    expectedPrevHash = log.hash;
  }

  return {
    valid: !isTampered,
    tamperedCount: tamperedIds.length,
    tamperedIds
  };
}
