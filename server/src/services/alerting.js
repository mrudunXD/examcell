import { getDb, getDbLatencyMetrics } from '../db/database.js';
import { getActiveKiosksList, broadcastUpdate } from './socket.js';
import crypto from 'crypto';
import os from 'os';

let alertingTimer = null;

export async function createAlert(type, severity, message) {
  try {
    const db = getDb();
    
    // Check if an unresolved alert of the same type and message already exists
    const existing = await db.prepare('SELECT id FROM system_alerts WHERE type=? AND message=? AND resolved=0').get(type, message);
    if (existing) return existing.id; // Alert already open, avoid duplicate spam

    const id = crypto.randomUUID();
    await db.prepare(`
      INSERT INTO system_alerts (id, type, severity, message, resolved)
      VALUES (?, ?, ?, ?, 0)
    `).run(id, type, severity, message);
    
    console.log(`⚠️ ALERT: [${severity.toUpperCase()}] ${message}`);
    
    // Broadcast via WS
    broadcastUpdate('ALERT_TRIGGERED', { id, type, severity, message, created_at: new Date().toISOString() });
    
    return id;
  } catch (err) {
    console.error('⚠️ Failed to create alert:', err.message);
  }
}

export async function resolveAlert(id) {
  try {
    const db = getDb();
    await db.prepare('UPDATE system_alerts SET resolved=1 WHERE id=?').run(id);
    broadcastUpdate('ALERT_RESOLVED', { id });
  } catch (err) {
    console.error('⚠️ Failed to resolve alert:', err.message);
  }
}

export async function getActiveAlerts() {
  try {
    const db = getDb();
    return await db.prepare('SELECT * FROM system_alerts WHERE resolved=0 ORDER BY created_at DESC').all();
  } catch (err) {
    return [];
  }
}

export async function checkSystemThresholds() {
  // 1. Check Kiosk Disconnections (>120 seconds)
  const kiosks = getActiveKiosksList();
  for (const kiosk of kiosks) {
    if (kiosk.secondsAgo > 120 && kiosk.status === 'disconnected') {
      await createAlert(
        'kiosk_offline',
        'critical',
        `Classroom Room ${kiosk.roomNo} kiosk has been offline for ${kiosk.secondsAgo} seconds.`
      );
    }
  }

  // 2. Check Database Latency (>50ms)
  const dbLatency = getDbLatencyMetrics();
  if (dbLatency > 50) {
    await createAlert(
      'db_latency',
      'warning',
      `High average database query latency: ${dbLatency}ms.`
    );
  }

  // 3. Check Heap Memory usage (>450MB)
  const memoryUsage = process.memoryUsage();
  const heapUsedMb = Math.round(memoryUsage.heapUsed / 1024 / 1024);
  if (heapUsedMb > 450) {
    await createAlert(
      'memory_leak',
      'warning',
      `High Node.js Heap Memory utilization: ${heapUsedMb} MB.`
    );
  }
}

export function initAlertingMonitor() {
  if (alertingTimer) return;
  
  // Run threshold checks every 30 seconds
  alertingTimer = setInterval(checkSystemThresholds, 30000);
  console.log('⏰ Telemetry threshold alerting monitor initialized.');
}
