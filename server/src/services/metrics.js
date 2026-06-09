import client from 'prom-client';
import { getDbLatencyMetrics } from '../db/database.js';
import { getActiveConnectionsCount } from './socket.js';

// Enable default metrics collection (CPU, Memory, etc.)
client.collectDefaultMetrics();

// Define custom Prometheus metrics
const dbLatencyGauge = new client.Gauge({
  name: 'db_query_latency_ms',
  help: 'Average database query response latency in milliseconds'
});

const websocketConnectionsGauge = new client.Gauge({
  name: 'websocket_connections_active',
  help: 'Count of active WebSocket kiosk and user connections'
});

export async function getPrometheusMetrics() {
  // Update Gauges with latest telemetry
  dbLatencyGauge.set(getDbLatencyMetrics());
  websocketConnectionsGauge.set(getActiveConnectionsCount());

  return await client.register.metrics();
}

export function getMetricsContentType() {
  return client.register.contentType;
}
