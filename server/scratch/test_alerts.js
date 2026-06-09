import { initDb, getDb } from '../src/db/database.js';
import { createAlert, resolveAlert, getActiveAlerts } from '../src/services/alerting.js';
import { initSocket } from '../src/services/socket.js';
import http from 'http';

async function testAlerts() {
  console.log('🧪 Starting Task 6: Threshold-Based Alerting verification...');

  // 1. Initialize DB and Socket
  await initDb();
  const db = getDb();
  const server = http.createServer();
  initSocket(server);

  // Clear previous test alerts
  await db.prepare("DELETE FROM system_alerts WHERE message LIKE 'Test alert%'").run();

  // 2. Create alert
  console.log('Creating system alert...');
  const alertId = await createAlert('kiosk_offline', 'critical', 'Test alert: kiosk Room A101 offline');
  if (!alertId) {
    throw new Error('Failed to create alert: returned empty ID');
  }
  console.log(`✓ Alert created successfully with ID: ${alertId}`);

  // 3. Query active alerts
  console.log('Querying active unresolved alerts...');
  let activeAlerts = await getActiveAlerts();
  const testAlert = activeAlerts.find(a => a.id === alertId);
  if (!testAlert) {
    throw new Error('Active alerts list does not contain the newly created alert!');
  }
  if (testAlert.severity !== 'critical' || testAlert.resolved !== 0) {
    throw new Error('Retrieved alert properties are incorrect or it is already resolved!');
  }
  console.log('✓ Success: Active alert matches expected parameters.');

  // 4. Resolve alert
  console.log('Resolving alert...');
  await resolveAlert(alertId);

  // 5. Query active alerts again
  activeAlerts = await getActiveAlerts();
  const resolvedAlertExists = activeAlerts.some(a => a.id === alertId);
  if (resolvedAlertExists) {
    throw new Error('Alert is still listed in active alerts after resolution!');
  }

  // Check in DB directly
  const dbAlert = await db.prepare('SELECT resolved FROM system_alerts WHERE id=?').get(alertId);
  if (dbAlert.resolved !== 1) {
    throw new Error('Alert resolved column was not set to 1 in database!');
  }
  console.log('✓ Success: Alert was successfully updated to resolved=1 in DB.');

  // Clean up
  await db.prepare('DELETE FROM system_alerts WHERE id=?').run(alertId);
  console.log('✓ Cleaned up test records');

  console.log('\n🎉 Task 6 Threshold-Based Alerting tests PASSED!');
  process.exit(0);
}

testAlerts().catch(err => {
  console.error('\n❌ Task 6 Alerting test failed:', err.message);
  process.exit(1);
});
