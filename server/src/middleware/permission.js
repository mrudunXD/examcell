import { getDb } from '../db/database.js';
import crypto from 'crypto';

async function writeAuditEntry({ userId, action, entity, entityId, details }) {
  try {
    const db = getDb();
    const lastLog = await db.prepare('SELECT hash FROM audit_log WHERE hash IS NOT NULL ORDER BY created_at DESC, id DESC LIMIT 1').get();
    const prevHash = lastLog?.hash || 'GENESIS_HASH';
    const id = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const input = `${prevHash}-${userId}-${action}-${entity}-${entityId || ''}-${details || ''}-${timestamp}`;
    const hash = crypto.createHash('sha256').update(input).digest('hex');

    await db.prepare(`
      INSERT INTO audit_log (id, user_id, action, entity, entity_id, details, hash, prev_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, action, entity, entityId || null, details || null, hash, prevHash, timestamp);
  } catch (e) {
    console.error('Failed to write audit log in permission middleware:', e);
  }
}

export function requirePermission(permission) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!req.user.permissions || !req.user.permissions.includes(permission)) {
      // Log the unauthorized attempt to the audit log
      await writeAuditEntry({
        userId: req.user.id,
        action: 'UNAUTHORIZED_ATTEMPT',
        entity: 'system',
        entityId: permission,
        details: `Failed attempt to access permission: ${permission}`
      });

      return res.status(403).json({ error: `Forbidden: Missing required permission: ${permission}` });
    }
    next();
  };
}

export function requireApproval(action, getEntityId) {
  return async (req, res, next) => {
    // Super Admins override approval workflows and can do everything directly
    if (req.user?.roles?.includes('Super Admin')) {
      return next();
    }

    const db = getDb();
    
    // Check if workflow requires approval (check system settings first, default to true for sensitive operations)
    // Keys in settings: 'workflow.approval.PUBLISH_SCHEDULE' etc.
    const settingKey = `workflow.approval.${action}`;
    const setting = await db.prepare('SELECT value FROM system_settings WHERE key = ?').get(settingKey);
    const approvalRequired = setting ? setting.value === 'true' : true; // default to true for security

    if (!approvalRequired) {
      return next();
    }

    // Capture request details and require dual approval
    const entityId = typeof getEntityId === 'function' ? getEntityId(req) : req.params.id || null;
    
    // Check if there is already a pending request for this exact action and entity
    const existing = await db.prepare(
      "SELECT id FROM approval_requests WHERE action = ? AND (entity_id = ? OR (entity_id IS NULL AND ? IS NULL)) AND status = 'pending'"
    ).get(action, entityId, entityId);

    if (existing) {
      return res.status(409).json({ 
        error: 'A pending approval request already exists for this action.', 
        approvalRequestId: existing.id 
      });
    }

    // Create the approval request
    const id = crypto.randomUUID();
    const payload = JSON.stringify({
      body: req.body,
      params: req.params,
      query: req.query,
      method: req.method,
      url: req.originalUrl
    });

    await db.prepare(`
      INSERT INTO approval_requests (id, action, entity_id, payload, requested_by, requested_at, status)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'pending')
    `).run(id, action, entityId, payload, req.user.id);

    // Audit log the request creation
    await writeAuditEntry({
      userId: req.user.id,
      action: `CREATE_APPROVAL_REQUEST`,
      entity: 'approval_requests',
      entityId: id,
      details: `Created approval request for action: ${action}`
    });

    return res.status(202).json({
      message: 'Action requires dual-administrator approval. A request has been created.',
      approvalRequestId: id,
      pendingApproval: true
    });
  };
}
