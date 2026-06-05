import { useState, useEffect } from 'react';
import { ClipboardList } from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';

const ACTION_COLOR = {
  INSERT: '#166534', UPDATE: '#1d4ed8', DELETE: '#CC0000',
  GENERATE: '#92400e', APPROVE: '#166534', UNLOCK: '#92400e',
};

export default function AuditPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/exam-cycles').then(async r => {
      if (r.data.length > 0) {
        const d = await api.get(`/dashboard/${r.data[0].id}`);
        setLogs(d.data.recentAudit || []);
      }
    }).catch(() => toast.error('Could not load audit log'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="accent-bar" />
          <h1 className="page-title">Audit Log</h1>
          <p className="page-subtitle">Recent system activity</p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : logs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 64 }}>
          <div style={{ border: '1px solid #E5E5E0', display: 'inline-flex', padding: 14, marginBottom: 16 }}>
            <ClipboardList size={28} strokeWidth={1} color="#A3A3A3" />
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>No Audit Entries</div>
          <p style={{ fontFamily: 'var(--font-body)', fontStyle: 'italic', color: 'var(--np-n500)', fontSize: 14 }}>
            System actions will appear here once operations begin.
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
              {logs.map(log => (
                <tr key={log.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10, whiteSpace: 'nowrap', color: 'var(--np-n500)' }}>
                    {new Date(log.created_at).toLocaleString('en-IN')}
                  </td>
                  <td style={{ fontWeight: 600, fontSize: 12 }}>{log.user_name || '—'}</td>
                  <td>
                    <span className="badge" style={{
                      color: ACTION_COLOR[log.action] || 'var(--np-n600)',
                      borderColor: ACTION_COLOR[log.action] || '#E5E5E0',
                      background: `${ACTION_COLOR[log.action] || '#525252'}11`,
                    }}>
                      {log.action}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{log.entity}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--np-n500)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.details || log.entity_id}
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
