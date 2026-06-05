import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, CheckCircle, X, RefreshCw } from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';

const CONFLICT_ICONS = {
  CAPACITY_OVERFLOW: '🏫',
  BRANCH_MIXING_FAILED: '🔀',
  INSUFFICIENT_ROOM_CAPACITY: '👥',
  NO_SUPERVISOR_AVAILABLE: '👤',
  NO_CO_SUPERVISOR_AVAILABLE: '👤',
  NO_STUDENTS: '📋',
  NO_ROOMS: '🏠',
};

export default function ConflictsPage() {
  const { cycleId } = useParams();
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    setLoading(true);
    try { const { data } = await api.get(`/conflicts/${cycleId}`); setConflicts(data); }
    catch { toast.error('Failed to load conflicts'); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetch(); }, [cycleId]);

  const resolve = async (id) => {
    await api.post(`/conflicts/${id}/resolve`); toast.success('Marked as resolved'); fetch();
  };
  const ignore = async (id) => {
    await api.post(`/conflicts/${id}/ignore`); toast('Conflict ignored', { icon: '🙈' }); fetch();
  };

  const open = conflicts.filter(c => c.status === 'open');
  const resolved = conflicts.filter(c => c.status !== 'open');

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="flex-row" style={{ gap: 8, marginBottom: 6 }}>
            <Link to="/exam-cycles" className="btn btn-ghost btn-sm"><ArrowLeft size={13} /></Link>
          </div>
          <h1>Conflict Detection</h1>
          <p>{open.length} open · {resolved.length} resolved</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={fetch}><RefreshCw size={14} /></button>
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      : conflicts.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <CheckCircle size={40} color="var(--color-success)" style={{ margin: '0 auto 14px' }} />
          <h3 style={{ color: 'var(--color-success)' }}>All Clear!</h3>
          <p className="text-muted" style={{ fontSize: 13, marginTop: 8 }}>No conflicts detected in this cycle.</p>
        </div>
      ) : (
        <>
          {open.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#f87171', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={16} /> {open.length} Open Conflict(s) — Must Resolve Before Export
              </div>
              {open.map(c => (
                <div key={c.id} className="conflict-item">
                  <div className="flex-between" style={{ marginBottom: 8 }}>
                    <div className="flex-row" style={{ gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{CONFLICT_ICONS[c.type] || '⚠️'}</span>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{c.type.replace(/_/g, ' ')}</div>
                        {c.date && <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{c.date} at {c.start_time} — {c.subject_name}</div>}
                      </div>
                    </div>
                    <div className="flex-row" style={{ gap: 6 }}>
                      <button className="btn btn-success btn-sm" onClick={() => resolve(c.id)}>
                        <CheckCircle size={12} /> Resolve
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => ignore(c.id)}>
                        <X size={12} /> Ignore
                      </button>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--color-text)', marginBottom: 4 }}>{c.description}</p>
                  {c.affected_entities && <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Affected: {c.affected_entities}</div>}
                  {c.suggested_resolution && (
                    <div style={{ fontSize: 11, color: 'var(--color-accent)', marginTop: 4 }}>
                      💡 {c.suggested_resolution}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {resolved.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 12 }}>
                Resolved / Ignored ({resolved.length})
              </div>
              {resolved.map(c => (
                <div key={c.id} className="conflict-item resolved" style={{ opacity: 0.6 }}>
                  <div className="flex-row" style={{ gap: 8 }}>
                    <span>{c.status === 'resolved' ? '✅' : '🙈'}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{c.type.replace(/_/g, ' ')}</div>
                      <div style={{ fontSize: 12 }}>{c.description}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
