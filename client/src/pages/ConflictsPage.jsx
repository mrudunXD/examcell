import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle, X, RefreshCw, AlertTriangle, Zap, ShieldAlert, Info } from 'lucide-react';
import api from '../lib/api.js';
import { formatDate, formatTime } from '../lib/format.js';
import toast from 'react-hot-toast';

const TYPE_META = {
  FACULTY_CLASH:   { label: 'Faculty Clash',   color: '#FF453A', bg: '#FFF5F5', icon: ShieldAlert },
  ROOM_OVERFLOW:   { label: 'Room Overflow',   color: '#92400e', bg: '#FFFBEB', icon: AlertTriangle },
  STUDENT_CLASH:   { label: 'Student Clash',   color: '#7c3aed', bg: '#F5F3FF', icon: AlertTriangle },
  BRANCH_MIXING_FAILED: { label: 'Branch Mix', color: '#0e7490', bg: '#F0F9FF', icon: Info },
  INSUFFICIENT_ROOM_CAPACITY: { label: 'Room Capacity', color: '#92400e', bg: '#FFFBEB', icon: ShieldAlert },
  NO_STUDENTS:     { label: 'No Students',     color: '#A3A3AC', bg: '#FAFAFA', icon: Info },
  NO_ROOMS:        { label: 'No Rooms',        color: '#A3A3AC', bg: '#FAFAFA', icon: Info },
};

function getMeta(type) {
  return TYPE_META[type] || { label: type.replace(/_/g, ' '), color: '#A3A3AC', bg: '#FAFAFA', icon: Info };
}

export default function ConflictsPage() {
  const { cycleId } = useParams();
  const [conflicts, setConflicts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);

  const fetchConflicts = useCallback(async () => {
    setLoading(true);
    try { const { data } = await api.get(`/conflicts/${cycleId}`); setConflicts(data); }
    catch { toast.error('Failed to load conflicts'); }
    finally { setLoading(false); }
  }, [cycleId]);

  useEffect(() => { fetchConflicts(); }, [fetchConflicts]);

  const runDetection = async () => {
    setDetecting(true);
    try {
      const { data } = await api.post(`/conflicts/detect/${cycleId}`);
      toast.success(data.message || 'Detection complete');
      fetchConflicts();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Detection failed');
    } finally { setDetecting(false); }
  };

  const resolve = async (id) => {
    await api.post(`/conflicts/${id}/resolve`);
    toast.success('Marked as resolved');
    fetchConflicts();
  };
  const ignore = async (id) => {
    await api.post(`/conflicts/${id}/ignore`);
    toast('Conflict ignored');
    fetchConflicts();
  };

  const open     = conflicts.filter(c => c.status === 'open');
  const resolved = conflicts.filter(c => c.status !== 'open');

  const groupedOpen = {};
  for (const c of open) {
    const meta = getMeta(c.type);
    if (!groupedOpen[c.type]) groupedOpen[c.type] = { meta, items: [] };
    groupedOpen[c.type].items.push(c);
  }

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
          <p className="page-subtitle">
            {open.length > 0 ? (
              <span style={{ color: '#FF453A' }}>{open.length} open conflict{open.length > 1 ? 's' : ''}</span>
            ) : (
              <span style={{ color: '#166534' }}>No open conflicts</span>
            )}
            {resolved.length > 0 && <> · {resolved.length} resolved</>}
          </p>
        </div>
        <div className="flex-row" style={{ gap: 8 }}>
          <button
            className="btn btn-primary"
            onClick={runDetection}
            disabled={detecting}
          >
            {detecting
              ? <div className="spinner spinner-invert" style={{ width: 14, height: 14 }} />
              : <Zap size={13} strokeWidth={1.5} />
            }
            Run Detection
          </button>
          <button className="btn btn-ghost btn-sm" onClick={fetchConflicts} disabled={loading}>
            <RefreshCw size={12} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', padding: '10px 14px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <Info size={13} strokeWidth={1.5} color="#0e7490" style={{ marginTop: 1, flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#0e7490', lineHeight: 1.6 }}>
          Click "Run Detection" to scan all slots in this cycle for faculty clashes, room overflow, and student conflicts. Exports are blocked while open conflicts exist.
        </span>
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
            No conflicts found. Run Detection to scan for issues, or this cycle is conflict-free.
          </p>
        </div>
      ) : (
        <>
          {/* Open conflicts — grouped by type */}
          {Object.values(groupedOpen).map(({ meta, items }) => {
            const Icon = meta.icon;
            return (
              <div key={items[0].type} style={{ marginBottom: 24 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px',
                  background: meta.color, color: '#FFF', marginBottom: 0,
                }}>
                  <Icon size={13} strokeWidth={1.5} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {meta.label} — {items.length} issue{items.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div style={{ border: `1px solid ${meta.color}`, borderTop: 'none' }}>
                  {items.map((c, i) => (
                    <div key={c.id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px',
                      background: meta.bg, borderBottom: i < items.length - 1 ? `1px solid ${meta.color}33` : 'none',
                    }}>
                      <div style={{ flex: 1 }}>
                        {(c.date || c.subject_name) && (
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: meta.color, marginBottom: 4, opacity: 0.75 }}>
                            {formatDate(c.date)} {c.start_time && `· ${formatTime(c.start_time)}`} {c.subject_name && `· ${c.subject_name}`}
                          </div>
                        )}
                        <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#111', marginBottom: c.suggested_resolution ? 4 : 0 }}>{c.description}</p>
                        {c.suggested_resolution && (
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#92400e' }}>
                            ↳ {c.suggested_resolution}
                          </div>
                        )}
                        {c.affected_entities && (
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--np-n500)', marginTop: 4 }}>
                            Affected: {c.affected_entities}
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
                  ))}
                </div>
              </div>
            );
          })}

          {/* Resolved */}
          {resolved.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--np-n500)', marginBottom: 10, borderBottom: '1px solid #222225', paddingBottom: 6 }}>
                Resolved / Ignored ({resolved.length})
              </div>
              {resolved.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 4, border: '1px solid #222225', opacity: 0.7 }}>
                  <div style={{ color: c.status === 'resolved' ? '#166534' : '#767680' }}>
                    {c.status === 'resolved' ? <CheckCircle size={12} strokeWidth={1.5} /> : <X size={12} strokeWidth={1.5} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--np-n500)', textTransform: 'uppercase', marginRight: 8 }}>
                      {c.type.replace(/_/g, ' ')}
                    </span>
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 12 }}>{c.description}</span>
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--np-n400)', textTransform: 'uppercase' }}>
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}






