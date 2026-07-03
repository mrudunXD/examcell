import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, RefreshCw, Filter, Shield, Activity, FileText, Settings } from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';
import { formatDateTime } from '../lib/format.js';

const ACTION_COLOR = {
  INSERT: '#30D158', UPDATE: '#0A84FF', DELETE: '#FF453A',
  GENERATE: '#FFD60A', APPROVE: '#30D158', UNLOCK: '#FFD60A',
  ACTIVATE: '#BF5AF2', DUPLICATE: '#64D2FF',
};

const ENTITIES = ['All', 'exam_cycle', 'exam_slot', 'student', 'subject', 'user', 'seating', 'supervisor'];

export default function AuditPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterEntity, setFilterEntity] = useState('All');
  const [filterAction, setFilterAction] = useState('All');
  const [search, setSearch] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/audit?limit=200');
      setLogs(data || []);
    } catch { toast.error('Could not load audit log'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const actions = ['All', ...new Set(logs.map(l => l.action))];

  const filtered = logs.filter(l => {
    if (filterEntity !== 'All' && l.entity !== filterEntity) return false;
    if (filterAction !== 'All' && l.action !== filterAction) return false;
    if (search && !l.details?.toLowerCase().includes(search.toLowerCase()) &&
        !l.user_name?.toLowerCase().includes(search.toLowerCase()) &&
        !l.entity_id?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Statistics
  const totalLogsCount = logs.length;
  const insertsCount = logs.filter(l => l.action === 'INSERT').length;
  const updatesCount = logs.filter(l => l.action === 'UPDATE').length;
  const deletesCount = logs.filter(l => l.action === 'DELETE').length;

  // Group by Entity type for chart
  const entityCounts = {};
  logs.forEach(l => {
    entityCounts[l.entity] = (entityCounts[l.entity] || 0) + 1;
  });
  const topEntities = Object.entries(entityCounts)
    .sort((a,b) => b[1] - a[1])
    .slice(0, 5);

  // Action counts for SVG Bar
  const actionCounts = {};
  logs.forEach(l => {
    actionCounts[l.action] = (actionCounts[l.action] || 0) + 1;
  });

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="page-title">Operational Audit Log</h1>
          <p className="page-subtitle">Inspect coordinator actions, system alerts, and data revision trails.</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={fetchLogs} disabled={loading} style={{ borderRadius: 8 }}>
          <RefreshCw size={13} strokeWidth={1.5} style={{ marginRight: 4 }} /> Refresh Logs
        </button>
      </div>

      {/* Row 1: KPI Summary Row */}
      <div className="kpi-grid">
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>Audit Trail Volume</span>
            <FileText size={14} color="#0A84FF" strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{totalLogsCount}</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>Last 200 system events</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>Created Entities</span>
            <Activity size={14} color="#30D158" strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#30D158', fontFamily: 'var(--font-mono)' }}>{insertsCount}</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>New entities added</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>Updates / Deletions</span>
            <Settings size={14} color="#FFD60A" strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#FFD60A', fontFamily: 'var(--font-mono)' }}>{updatesCount} / {deletesCount}</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>Modifications & deletions logged</div>
          </div>
        </div>
      </div>

      {/* Row 2: Filter Controls & Logs Table (Primary Content Area) */}
      <div className="card" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div className="flex-row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="flex-row" style={{ gap: 6, alignItems: 'center' }}>
            <Filter size={12} strokeWidth={1.5} color="var(--text-secondary)" />
            <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-secondary)' }}>Filters:</span>
          </div>
          <select
            className="select"
            style={{ fontSize: 12, minWidth: 140 }}
            value={filterEntity}
            onChange={e => setFilterEntity(e.target.value)}
          >
            {ENTITIES.map(e => <option key={e} value={e}>{e === 'All' ? 'All Entities' : e}</option>)}
          </select>
          <select
            className="select"
            style={{ fontSize: 12, minWidth: 140 }}
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
          >
            {actions.map(a => <option key={a} value={a}>{a === 'All' ? 'All Actions' : a}</option>)}
          </select>
          <input
            className="input"
            placeholder="Search details, user..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ fontSize: 12, width: 220 }}
          />
          {(filterEntity !== 'All' || filterAction !== 'All' || search) && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ borderRadius: 8 }}
              onClick={() => { setFilterEntity('All'); setFilterAction('All'); setSearch(''); }}
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Row 4: Detailed Audit Table (LAST Component) */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 24 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, fontStyle: 'italic', color: 'var(--text-secondary)' }}>
            No audit logs matched the filters.
          </div>
        ) : (
          <div className="table-wrap" style={{ marginTop: 0 }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 150 }}>Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Change Description / Diff</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(log => {
                  const borderCol = ACTION_COLOR[log.action] || 'var(--border)';
                  return (
                    <tr key={log.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10, whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                        {formatDateTime(log.created_at)}
                      </td>
                      <td style={{ fontWeight: 600, fontSize: 12 }}>
                        {log.user_name || <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>system</span>}
                      </td>
                      <td>
                        <span className="badge" style={{
                          color: borderCol,
                          borderColor: borderCol,
                          background: `${borderCol}11`,
                          fontSize: 9
                        }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{log.entity}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', maxWidth: 400 }} title={log.details || log.entity_id}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {log.details || log.entity_id || '—'}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
