import { getDb } from '../db/database.js';

export function auditLog(action, entity, entityId, details) {
  return (req, res, next) => {
    const original = res.json.bind(res);
    res.json = (data) => {
      if (res.statusCode < 400 && req.user) {
        try {
          const db = getDb();
          db.prepare(`
            INSERT INTO audit_log (id, user_id, action, entity, entity_id, details)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            crypto.randomUUID(),
            req.user.id,
            action,
            entity,
            typeof entityId === 'function' ? entityId(req, data) : entityId,
            typeof details === 'function' ? details(req, data) : details
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
