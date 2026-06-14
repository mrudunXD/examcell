import { useState, useEffect, useCallback } from 'react';
import { ClipboardList, RefreshCw, Filter } from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';
import { formatDateTime } from '../lib/format.js';

const ACTION_COLOR = {
  INSERT: '#166534', UPDATE: '#1d4ed8', DELETE: '#FF453A',
  GENERATE: '#92400e', APPROVE: '#166534', UNLOCK: '#92400e',
  ACTIVATE: '#7c3aed', DUPLICATE: '#0e7490',
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

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="accent-bar" />
          <h1 className="page-title">Audit Log</h1>
          <p className="page-subtitle">{filtered.length} of {logs.length} entries</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={fetchLogs} disabled={loading}>
          <RefreshCw size={12} strokeWidth={1.5} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex-row" style={{ gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="flex-row" style={{ gap: 6, alignItems: 'center' }}>
          <Filter size={11} strokeWidth={1.5} color="var(--np-n500)" />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--np-n500)' }}>Filters:</span>
        </div>
        <select
          className="select"
          style={{ padding: '4px 8px', fontSize: 11, minWidth: 130 }}
          value={filterEntity}
          onChange={e => setFilterEntity(e.target.value)}
        >
          {ENTITIES.map(e => <option key={e} value={e}>{e === 'All' ? 'All Entities' : e}</option>)}
        </select>
        <select
          className="select"
          style={{ padding: '4px 8px', fontSize: 11, minWidth: 120 }}
          value={filterAction}
          onChange={e => setFilterAction(e.target.value)}
        >
          {actions.map(a => <option key={a} value={a}>{a === 'All' ? 'All Actions' : a}</option>)}
        </select>
        <input
          className="input"
          placeholder="Search details, user…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '4px 10px', fontSize: 11, width: 200 }}
        />
        {(filterEntity !== 'All' || filterAction !== 'All' || search) && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => { setFilterEntity('All'); setFilterAction('All'); setSearch(''); }}
          >
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 64 }}>
          <div style={{ border: '1px solid #222225', display: 'inline-flex', padding: 14, marginBottom: 16 }}>
            <ClipboardList size={28} strokeWidth={1} color="#767680" />
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            {logs.length === 0 ? 'No Audit Entries' : 'No Matching Entries'}
          </div>
          <p style={{ fontFamily: 'var(--font-body)', fontStyle: 'italic', color: 'var(--np-n500)', fontSize: 14 }}>
            {logs.length === 0
              ? 'System actions will appear here once operations begin.'
              : 'Try adjusting your filters.'}
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(log => (
                <tr key={log.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10, whiteSpace: 'nowrap', color: 'var(--np-n500)' }}>
                    {formatDateTime(log.created_at)}
                  </td>
                  <td style={{ fontWeight: 600, fontSize: 12 }}>{log.user_name || <span style={{ color: 'var(--np-n400)', fontStyle: 'italic' }}>system</span>}</td>
                  <td>
                    <span className="badge" style={{
                      color: ACTION_COLOR[log.action] || 'var(--np-n600)',
                      borderColor: ACTION_COLOR[log.action] || '#222225',
                      background: `${ACTION_COLOR[log.action] || '#A3A3AC'}11`,
                    }}>
                      {log.action}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{log.entity}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--np-n500)', maxWidth: 300 }} title={log.details || log.entity_id}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.details || log.entity_id || '—'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}






