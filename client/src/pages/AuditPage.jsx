import { useState, useEffect } from 'react';
import { ClipboardList } from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';

const ACTION_COLORS = {
  INSERT: '#10b981', UPDATE: '#3b82f6', DELETE: '#ef4444',
  GENERATE: '#f59e0b', APPROVE: '#10b981', UNLOCK: '#f59e0b'
};

export default function AuditPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/dashboard/audit').catch(() => {
      // Fetch from a direct query fallback
    });
    // Use dashboard stats audit_log
    api.get('/exam-cycles').then(async r => {
      if (r.data.length > 0) {
        const d = await api.get(`/dashboard/${r.data[0].id}`);
        setLogs(d.data.recentAudit || []);
      }
    }).catch(() => toast.error('Could not load audit log')).finally(() => setLoading(false));
  }, []);

  return (
    <div className="fade-in">
      <div className="page-header">
        <div><h1>Audit Log</h1><p>Recent system activity</p></div>
      </div>
      <div className="card">
        {loading ? <div style={{ textAlign: 'center', padding: 32 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        : logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
            <ClipboardList size={32} style={{ margin: '0 auto 10px' }} />
            <p>No audit entries yet</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
              <tbody>
                {logs.map(log => (
                  <tr key={log.id}>
                    <td style={{ fontSize: 11, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(log.created_at).toLocaleString('en-IN')}
                    </td>
                    <td style={{ fontWeight: 600 }}>{log.user_name || '—'}</td>
                    <td>
                      <span className="badge" style={{
                        background: `${ACTION_COLORS[log.action] || '#9ca3af'}22`,
                        color: ACTION_COLORS[log.action] || '#9ca3af'
                      }}>{log.action}</span>
                    </td>
                    <td style={{ fontSize: 12 }}>{log.entity}</td>
                    <td style={{ fontSize: 12, color: 'var(--color-text-muted)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.details || log.entity_id}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
