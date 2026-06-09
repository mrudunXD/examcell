import { getDb } from '../db/database.js';
import crypto from 'crypto';

export function auditLog(action, entity, entityId, details) {
  return (req, res, next) => {
    const original = res.json.bind(res);
    res.json = async (data) => {
      if (res.statusCode < 400 && req.user) {
        try {
          const db = getDb();
          
          // 1. Fetch the hash of the latest audit log entry that was hashed
          const lastLog = await db.prepare('SELECT hash FROM audit_log WHERE hash IS NOT NULL ORDER BY created_at DESC, id DESC LIMIT 1').get();
          const prevHash = lastLog?.hash || 'GENESIS_HASH';
          
          const id = crypto.randomUUID();
          const entId = typeof entityId === 'function' ? entityId(req, data) : entityId;
          const det = typeof details === 'function' ? details(req, data) : details;
          const timestamp = new Date().toISOString();
          
          // 2. Compute SHA-256 hash of the block
          const input = `${prevHash}-${req.user.id}-${action}-${entity}-${entId || ''}-${det || ''}-${timestamp}`;
          const hash = crypto.createHash('sha256').update(input).digest('hex');

          // 3. Save the cryptographically chained audit log
          await db.prepare(`
            INSERT INTO audit_log (id, user_id, action, entity, entity_id, details, hash, prev_hash, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            id,
            req.user.id,
            action,
            entity,
            entId || null,
            det || null,
            hash,
            prevHash,
            timestamp
          );
        } catch (e) {
          console.error('Audit log failed:', e.message);
        }
      }
      return original(data);
    };
    next();
  };
}
