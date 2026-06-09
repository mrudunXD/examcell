import { Router } from 'express';
import { getDb, getDbLatencyMetrics, getSlowQueryLog } from '../db/database.js';
import { getActiveConnectionsCount, getActiveKiosksList } from '../services/socket.js';
import { getAutoBackupStatus } from '../services/autoBackup.js';
import { verifyAuditLogChain } from '../services/auditVerification.js';
import { authenticate, requireCoordinator } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { triggerChaos } from '../services/chaosEngine.js';
import { getActiveAlerts, resolveAlert } from '../services/alerting.js';
import os from 'os';

const router = Router();
router.use(authenticate, requireCoordinator);

// GET /api/health/metrics
router.get('/metrics', asyncHandler(async (req, res) => {
  const db = getDb();

  // 1. WebSocket & Kiosk metrics
  const activeConnections = getActiveConnectionsCount();
  const kiosks = getActiveKiosksList();

  // 2. Database performance
  const dbLatency = getDbLatencyMetrics();

  // 3. Solver telemetry runs
  const solverRuns = await db.prepare(`
    SELECT st.*, ec.name as cycle_name
    FROM solver_telemetry st
    LEFT JOIN exam_cycles ec ON ec.id = st.cycle_id
    ORDER BY st.created_at DESC
    LIMIT 50
  `).all();

  // 4. Failed schedules count
  const failedRunsRow = await db.prepare("SELECT COUNT(*) as cnt FROM solver_telemetry WHERE status='FAIL'").get();
  const failedSchedules = failedRunsRow?.cnt || 0;

  // 5. System stats
  const memoryUsage = process.memoryUsage();
  const cpuLoad = os.loadavg();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const systemUptime = os.uptime();
  const serverUptime = process.uptime();

  const slowQueries = getSlowQueryLog();
  const autoBackup = getAutoBackupStatus();
  const auditLogSecurity = await verifyAuditLogChain();

  res.json({
    websockets: {
      activeConnections,
      kiosks
    },
    database: {
      dbLatency,
      slowQueries
    },
    solver: {
      runs: solverRuns,
      failedSchedules
    },
    security: {
      auditLogSecurity
    },
    backups: {
      autoBackup
    },
    system: {
      cpuLoad,
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
        systemTotal: totalMem,
        systemFree: freeMem
      },
      uptime: {
        system: systemUptime,
        server: serverUptime
      }
    }
  });
}));

// POST /api/health/chaos/trigger
router.post('/chaos/trigger', asyncHandler(async (req, res) => {
  const { type, enabled } = req.body;
  if (!type) return res.status(400).json({ error: 'chaos type required' });
  const result = triggerChaos(type, enabled);
  res.json(result);
}));

// GET /api/health/alerts — fetch active unresolved system alerts
router.get('/alerts', asyncHandler(async (req, res) => {
  const alerts = await getActiveAlerts();
  res.json(alerts);
}));

// POST /api/health/alerts/resolve/:id — resolve system alert
router.post('/alerts/resolve/:id', asyncHandler(async (req, res) => {
  await resolveAlert(req.params.id);
  res.json({ success: true });
}));

export default router;
