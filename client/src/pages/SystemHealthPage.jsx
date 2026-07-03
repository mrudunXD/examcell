import { useState, useEffect } from 'react';
import { 
  Activity, 
  Cpu, 
  Database, 
  Radio, 
  RefreshCw, 
  Download, 
  Upload, 
  Trash2, 
  Play, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  DatabaseZap, 
  ServerCrash,
  Lock,
  CheckCircle2
} from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';

export default function SystemHealthPage() {
  const [metrics, setMetrics] = useState(null);
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [fileRestoreData, setFileRestoreData] = useState(null);

  const fetchHealthData = async () => {
    try {
      const { data } = await api.get('/health/metrics');
      setMetrics(data);
    } catch (err) {
      toast.error('Failed to fetch system metrics');
    }
  };

  const fetchBackups = async () => {
    try {
      const { data } = await api.get('/backups');
      setBackups(data);
    } catch (err) {
      toast.error('Failed to fetch backups list');
    }
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([fetchHealthData(), fetchBackups()]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    // Poll metrics every 10 seconds
    const interval = setInterval(fetchHealthData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
    toast.success('Metrics updated');
  };

  const handleCreateBackup = async () => {
    setBackingUp(true);
    try {
      await api.post('/backups');
      toast.success('Database backup created successfully');
      fetchBackups();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create backup');
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestoreBackup = async (filename) => {
    if (!window.confirm(`Are you absolutely sure you want to restore backup "${filename}"? This will overwrite ALL current data.`)) {
      return;
    }
    setRestoring(true);
    try {
      const { data } = await api.post('/backups/restore', { filename });
      toast.success(data.message || 'Database restored successfully');
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to restore database');
    } finally {
      setRestoring(false);
    }
  };

  const handleDeleteBackup = async (filename) => {
    if (!window.confirm(`Delete backup file "${filename}"?`)) return;
    try {
      await api.delete(`/backups/${filename}`);
      toast.success('Backup file deleted');
      fetchBackups();
    } catch (err) {
      toast.error('Failed to delete backup file');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target.result);
        if (!json.tables) {
          toast.error('Invalid backup format: tables property is missing');
          return;
        }
        setFileRestoreData(json);
      } catch (err) {
        toast.error('Failed to parse JSON file');
      }
    };
    reader.readAsText(file);
  };

  const handleRestoreUploaded = async () => {
    if (!fileRestoreData) return;
    if (!window.confirm('Restore database from uploaded file? This will overwrite all existing data.')) return;
    
    setRestoring(true);
    try {
      const { data } = await api.post('/backups/restore-upload', fileRestoreData);
      toast.success(data.message || 'Database restored successfully');
      setFileRestoreData(null);
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to restore database');
    } finally {
      setRestoring(false);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs}h ${mins}m ${secs}s`;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '4px solid var(--np-ink)', paddingBottom: 16, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '32px', fontWeight: 800, margin: 0, textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
            System Health & Telemetry
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--np-n500)', margin: '4px 0 0 0', textTransform: 'uppercase' }}>
            Internal Operations Operations Control Panel
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleRefresh} disabled={refreshing} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing...' : 'Force Refresh'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20, marginBottom: 24 }}>
        {/* WebSocket and Kiosk Connections */}
        <div style={{ border: '1px solid var(--border)', background: '#fff', padding: 20, boxShadow: '4px 4px 0 0 var(--np-ink)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 16 }}>
            <Radio size={18} />
            <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, margin: 0 }}>WebSocket & Kiosks</h3>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--np-n600)' }}>Active Sockets</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14 }}>
              {metrics?.websockets?.activeConnections || 0}
            </span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--np-n500)', borderBottom: '1px solid var(--np-muted)', paddingBottom: 6, marginBottom: 10 }}>
            Active Classroom Kiosks ({metrics?.websockets?.kiosks?.length || 0})
          </div>
          <div style={{ maxHeight: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }} className="custom-scrollbar">
            {metrics?.websockets?.kiosks?.length === 0 ? (
              <span style={{ fontStyle: 'italic', color: 'var(--np-n500)', fontSize: 12 }}>No classrooms are currently connected as active display kiosks.</span>
            ) : (
              metrics?.websockets?.kiosks?.map((k, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, border: '1px solid var(--np-muted)', padding: '6px 10px', background: 'var(--bg-base)' }}>
                  <span style={{ fontWeight: 600 }}>Room {k.roomNo}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--np-n500)' }}>
                      Ping: {k.secondsAgo}s ago
                    </span>
                    <span style={{ 
                      fontSize: 9, 
                      fontWeight: 800, 
                      textTransform: 'uppercase', 
                      background: k.status === 'online' ? '#dcfce7' : '#fee2e2',
                      color: k.status === 'online' ? '#166534' : '#991b1b',
                      padding: '2px 6px',
                      border: `1px solid ${k.status === 'online' ? '#166534' : '#991b1b'}`
                    }}>
                      {k.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Database performance */}
        <div style={{ border: '1px solid var(--border)', background: '#fff', padding: 20, boxShadow: '4px 4px 0 0 var(--np-ink)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 16 }}>
            <Database size={18} />
            <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, margin: 0 }}>DB performance</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0' }}>
            <span style={{ fontSize: '42px', fontWeight: 800, fontFamily: 'var(--font-mono)', letterSpacing: '-0.05em' }}>
              {metrics?.database?.dbLatency || 0}
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--np-n500)', marginLeft: 4 }}>ms</span>
            </span>
            <span style={{ fontSize: 11, color: 'var(--np-n500)', textTransform: 'uppercase', marginTop: 4, letterSpacing: '0.05em' }}>
              Avg query response latency (last 100 queries)
            </span>
          </div>
        </div>

        {/* System & Server Stats */}
        <div style={{ border: '1px solid var(--border)', background: '#fff', padding: 20, boxShadow: '4px 4px 0 0 var(--np-ink)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 16 }}>
            <Cpu size={18} />
            <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, margin: 0 }}>Server Resources</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--np-n600)' }}>Node Heap Memory</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                {formatBytes(metrics?.system?.memory?.heapUsed || 0)} / {formatBytes(metrics?.system?.memory?.heapTotal || 0)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--np-n600)' }}>Server RSS Memory</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                {formatBytes(metrics?.system?.memory?.rss || 0)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--np-n600)' }}>System Uptime</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                {formatDuration(metrics?.system?.uptime?.server || 0)}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--np-n600)' }}>System CPU Load (1m, 5m, 15m)</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                {metrics?.system?.cpuLoad?.map(x => x.toFixed(2)).join(', ') || 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 24, alignItems: 'start' }}>
        {/* Solver Telemetry history */}
        <div style={{ border: '1px solid var(--border)', background: '#fff', padding: 20, boxShadow: '4px 4px 0 0 var(--np-ink)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Activity size={18} />
              <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, margin: 0 }}>Solver Telemetry Logs</h3>
            </div>
            {metrics?.solver?.failedSchedules > 0 && (
              <span style={{ 
                fontSize: 10, 
                fontWeight: 800, 
                background: '#fee2e2', 
                color: '#991b1b', 
                border: '1px solid #991b1b', 
                padding: '2px 8px',
                textTransform: 'uppercase'
              }}>
                {metrics?.solver?.failedSchedules} Failed runs
              </span>
            )}
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }} className="custom-scrollbar">
            {metrics?.solver?.runs?.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', fontStyle: 'italic', color: 'var(--np-n500)' }}>
                No solver runs recorded yet. Run auto-scheduler to trigger solver.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', fontWeight: 700 }}>
                    <th style={{ padding: '8px 4px' }}>Cycle</th>
                    <th style={{ padding: '8px 4px' }}>Status</th>
                    <th style={{ padding: '8px 4px' }}>Duration</th>
                    <th style={{ padding: '8px 4px' }}>Constraints</th>
                    <th style={{ padding: '8px 4px' }}>Score</th>
                    <th style={{ padding: '8px 4px' }}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics?.solver?.runs?.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--np-muted)', background: r.status === 'FAIL' ? '#fff5f5' : 'transparent' }}>
                      <td style={{ padding: '8px 4px', fontWeight: 600 }}>{r.cycle_name || 'Deleted Cycle'}</td>
                      <td style={{ padding: '8px 4px' }}>
                        <span style={{ 
                          fontSize: 8, 
                          fontWeight: 800, 
                          padding: '1px 4px', 
                          border: `1px solid ${r.status === 'SUCCESS' ? '#166534' : '#991b1b'}`,
                          background: r.status === 'SUCCESS' ? '#dcfce7' : '#fee2e2',
                          color: r.status === 'SUCCESS' ? '#166534' : '#991b1b',
                          textTransform: 'uppercase'
                        }}>
                          {r.status}
                        </span>
                        {r.status === 'FAIL' && r.infeasible_causes && (
                          <div style={{ fontSize: 9, color: '#FF453A', marginTop: 4, fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
                            {r.infeasible_causes.length > 100 ? r.infeasible_causes.slice(0, 100) + '...' : r.infeasible_causes}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '8px 4px', fontFamily: 'var(--font-mono)' }}>{(r.solve_duration_ms / 1000).toFixed(2)}s</td>
                      <td style={{ padding: '8px 4px', fontFamily: 'var(--font-mono)' }}>{r.constraints_count}</td>
                      <td style={{ padding: '8px 4px', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{r.optimization_score}</td>
                      <td style={{ padding: '8px 4px', color: 'var(--np-n500)' }}>{new Date(r.created_at).toLocaleString('en-IN', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Database Backups Panel */}
        <div style={{ border: '1px solid var(--border)', background: '#fff', padding: 20, boxShadow: '4px 4px 0 0 var(--np-ink)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <DatabaseZap size={18} />
              <h3 style={{ fontFamily: 'var(--font-serif)', fontWeight: 700, margin: 0 }}>Database Backups</h3>
            </div>
            <button className="btn btn-primary btn-sm" onClick={handleCreateBackup} disabled={backingUp || restoring}>
              {backingUp ? 'Saving...' : 'Backup Now'}
            </button>
          </div>

          {/* Direct upload Restore */}
          <div style={{ border: '2px dashed var(--np-ink)', background: 'var(--bg-base)', padding: 12, marginBottom: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Upload size={12} />
              Upload & Restore Database JSON
            </div>
            <input 
              type="file" 
              accept=".json" 
              onChange={handleFileUpload} 
              style={{ fontSize: 11, width: '100%', maxWidth: '240px', margin: '0 auto 8px auto' }} 
              disabled={restoring}
            />
            {fileRestoreData && (
              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: 11, color: '#166534', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  ✓ JSON parsed. Backup date: {new Date(fileRestoreData.timestamp).toLocaleString()}
                </span>
                <button className="btn btn-primary btn-sm" onClick={handleRestoreUploaded} disabled={restoring}>
                  {restoring ? 'Restoring...' : 'Execute Overwrite Restore'}
                </button>
              </div>
            )}
          </div>

          <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--np-n500)', borderBottom: '1px solid var(--np-muted)', paddingBottom: 6, marginBottom: 10 }}>
            Available Backup Files ({backups.length})
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 250, overflowY: 'auto' }} className="custom-scrollbar">
            {backups.length === 0 ? (
              <div style={{ fontStyle: 'italic', color: 'var(--np-n500)', fontSize: 12, padding: '12px 0', textAlign: 'center' }}>
                No backup files found. Create one above.
              </div>
            ) : (
              backups.map((b, i) => (
                <div key={i} style={{ border: '1px solid var(--np-ink)', padding: 12, background: 'var(--bg-base)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {b.filename}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--np-n500)', marginTop: 4 }}>
                      Date: {new Date(b.createdAt).toLocaleString()} · Size: {(b.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <a 
                      href={`/api/backups/download/${b.filename}?token=${localStorage.getItem('token')}`} 
                      className="btn btn-ghost btn-sm" 
                      style={{ padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Download Backup"
                    >
                      <Download size={14} />
                    </a>
                    <button 
                      className="btn btn-ghost btn-sm" 
                      onClick={() => handleRestoreBackup(b.filename)} 
                      disabled={restoring || backingUp}
                      style={{ padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Restore Backup"
                    >
                      <RefreshCw size={14} />
                    </button>
                    <button 
                      className="btn btn-ghost btn-sm" 
                      onClick={() => handleDeleteBackup(b.filename)} 
                      disabled={restoring || backingUp}
                      style={{ padding: 4, color: '#FF453A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Delete Backup File"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── STAGE 5: OPERATIONAL MATURITY SERVICES ── */}
      <div style={{ marginTop: 24, border: '1px solid var(--border)', background: '#fff', padding: 24, boxShadow: '4px 4px 0 0 var(--np-ink)' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 800, margin: '0 0 4px 0', textTransform: 'uppercase' }}>
          Stage 5: Operational Maturity & Security Audit
        </h2>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--np-n500)', margin: '0 0 20px 0', textTransform: 'uppercase' }}>
          Real-Time Cryptographical Integrity Checks & DB Slow Query Profiling
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 20 }}>
          {/* Cryptographic Hash Chain Audit */}
          <div style={{ border: '1px solid var(--border)', padding: 16, background: metrics?.security?.auditLogSecurity?.valid ? '#f0fdf4' : '#fff5f5' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 12 }}>
              <Lock size={16} style={{ color: 'var(--text-primary)' }} />
              <h4 style={{ margin: 0, fontWeight: 700 }}>Cryptographic Audit Chain Integrity</h4>
            </div>
            {metrics?.security?.auditLogSecurity?.valid ? (
              <div>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#166534', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <CheckCircle2 size={13} style={{ color: '#16a34a' }} /> SECURE (Chain verified)
                </span>
                <span style={{ fontSize: '12px', color: 'var(--np-n600)' }}>
                  All database transaction audit logs are cryptographically linked using SHA-256 hash chaining. Tamper check passed.
                </span>
              </div>
            ) : (
              <div>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#991b1b', display: 'block', marginBottom: 4 }} className="animate-pulse">
                  ⚠️ TAMPER DETECTED!
                </span>
                <span style={{ fontSize: '12px', color: '#991b1b', fontWeight: 600 }}>
                  Audit log history integrity check failed! {metrics?.security?.auditLogSecurity?.tamperedCount || 0} compromised entry block(s) detected.
                </span>
              </div>
            )}
          </div>

          {/* Background Auto-Backup Monitor */}
          <div style={{ border: '1px solid var(--border)', padding: 16, background: 'var(--bg-base)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 16 }}>⏰</span>
              <h4 style={{ margin: 0, fontWeight: 700 }}>Automated Snapshots Scheduler</h4>
            </div>
            <div style={{ fontSize: '12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div><strong>Schedule:</strong> Backups run every 6 hours (Retention: 5 snapshots)</div>
              <div>
                <strong>Status:</strong>{' '}
                <span style={{
                  fontWeight: 800,
                  color: metrics?.backups?.autoBackup?.status === 'success' ? '#166534' : (metrics?.backups?.autoBackup?.status === 'fail' ? '#991b1b' : 'inherit')
                }}>
                  {metrics?.backups?.autoBackup?.status?.toUpperCase() || 'NEVER'}
                </span>
              </div>
              {metrics?.backups?.autoBackup?.lastRun && (
                <div><strong>Last execution:</strong> {new Date(metrics.backups.autoBackup.lastRun).toLocaleString('en-IN')}</div>
              )}
              {metrics?.backups?.autoBackup?.error && (
                <div style={{ color: '#FF453A', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                  Error: {metrics.backups.autoBackup.error}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Slow Queries Log Table */}
        <div style={{ border: '1px solid var(--border)', padding: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12, borderBottom: '1.5px solid var(--np-ink)', paddingBottom: 6 }}>
            Database slow statements log (&gt;50ms statement latency profiling)
          </div>
          {metrics?.database?.slowQueries?.length === 0 ? (
            <div style={{ fontSize: 12, fontStyle: 'italic', color: '#166534', fontWeight: 600 }}>
              ✓ All query statements executed within the sub-50ms performance baseline.
            </div>
          ) : (
            <div style={{ maxHeight: 150, overflowY: 'auto' }} className="custom-scrollbar">
              <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--np-ink)', fontWeight: 700 }}>
                    <th style={{ padding: '6px 4px' }}>Statement Query</th>
                    <th style={{ padding: '6px 4px' }}>Latency</th>
                    <th style={{ padding: '6px 4px' }}>Execution Time</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics?.database?.slowQueries?.map((q, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--np-muted)' }}>
                      <td style={{ padding: '6px 4px', fontFamily: 'var(--font-mono)', fontSize: '10px', wordBreak: 'break-all' }}>{q.sql}</td>
                      <td style={{ padding: '6px 4px', color: '#FF453A', fontWeight: 700 }}>{q.duration}ms</td>
                      <td style={{ padding: '6px 4px', color: 'var(--np-n500)' }}>{new Date(q.timestamp).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}









