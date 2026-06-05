import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle, X, RefreshCw, AlertTriangle } from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';

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

  const resolve = async (id) => { await api.post(`/conflicts/${id}/resolve`); toast.success('Marked as resolved'); fetch(); };
  const ignore  = async (id) => { await api.post(`/conflicts/${id}/ignore`);  toast('Conflict ignored'); fetch(); };

  const open     = conflicts.filter(c => c.status === 'open');
  const resolved = conflicts.filter(c => c.status !== 'open');

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="flex-row" style={{ gap: 6, marginBottom: 8 }}>
            <Link to="/exam-cycles" className="btn btn-ghost btn-sm">
              <ArrowLeft size={12} strokeWidth={1.5} /> Cycles
            </Link>
          </div>
          <div className="accent-bar" />
          <h1 className="page-title">Conflict Detection</h1>
          <p className="page-subtitle">{open.length} open · {resolved.length} resolved</p>
        </div>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={fetch} aria-label="Refresh">
          <RefreshCw size={13} strokeWidth={1.5} />
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : conflicts.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 64 }}>
          <div style={{ border: '1px solid #166534', display: 'inline-flex', padding: 14, marginBottom: 16, color: '#166534' }}>
            <CheckCircle size={28} strokeWidth={1} />
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 700, color: '#166534', marginBottom: 8 }}>All Clear</div>
          <p style={{ fontFamily: 'var(--font-body)', fontStyle: 'italic', color: 'var(--np-n500)', fontSize: 14 }}>
            No conflicts detected in this exam cycle. Safe to export.
          </p>
        </div>
      ) : (
        <>
          {open.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              {/* Section header */}
              <div style={{
                background: '#111111',
                color: '#F9F9F7',
                padding: '8px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 0,
              }}>
                <AlertTriangle size={13} strokeWidth={1.5} color="#fca5a5" />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {open.length} Open Conflict{open.length > 1 ? 's' : ''} — Must Resolve Before Export
                </span>
              </div>
              <div style={{ border: '1px solid #111', borderTop: 'none' }}>
                {open.map((c, i) => (
                  <div
                    key={c.id}
                    className="conflict-item"
                    style={{
                      border: 'none',
                      borderBottom: i < open.length - 1 ? '1px solid #fecaca' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--np-red)', fontWeight: 600, marginBottom: 4 }}>
                          {c.type.replace(/_/g, ' ')}
                        </div>
                        {c.date && (
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--np-n500)', marginBottom: 6 }}>
                            {c.date} · {c.start_time} — {c.subject_name}
                          </div>
                        )}
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#7f1d1d', marginBottom: 4 }}>{c.description}</p>
                        {c.suggested_resolution && (
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#92400e' }}>
                            Suggested: {c.suggested_resolution}
                          </div>
                        )}
                      </div>
                      <div className="flex-row" style={{ gap: 6, flexShrink: 0 }}>
                        <button className="btn btn-success btn-sm" onClick={() => resolve(c.id)}>
                          <CheckCircle size={11} strokeWidth={1.5} /> Resolve
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => ignore(c.id)}>
                          <X size={11} strokeWidth={1.5} /> Ignore
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {resolved.length > 0 && (
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--np-n500)', marginBottom: 10, borderBottom: '1px solid #E5E5E0', paddingBottom: 6 }}>
                Resolved / Ignored ({resolved.length})
              </div>
              {resolved.map((c, i) => (
                <div key={c.id} className="conflict-item resolved" style={{ marginBottom: 4 }}>
                  <div className="flex-row" style={{ gap: 10 }}>
                    <div style={{
                      border: '1px solid #166534',
                      color: '#166534',
                      padding: 4,
                    }}>
                      {c.status === 'resolved' ? <CheckCircle size={12} strokeWidth={1.5} /> : <X size={12} strokeWidth={1.5} />}
                    </div>
                    <div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--np-n500)' }}>{c.type.replace(/_/g, ' ')}</div>
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--np-n600)' }}>{c.description}</div>
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
