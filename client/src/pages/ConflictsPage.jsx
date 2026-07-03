import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle, X, RefreshCw, AlertTriangle, Zap, ShieldAlert, Info, Scale, Activity } from 'lucide-react';
import api from '../lib/api.js';
import { formatDate, formatTime } from '../lib/format.js';
import toast from 'react-hot-toast';

const TYPE_META = {
  FACULTY_CLASH:   { label: 'Faculty Clash',   color: '#FF453A', bg: 'rgba(255, 69, 58, 0.05)', icon: ShieldAlert },
  ROOM_OVERFLOW:   { label: 'Room Overflow',   color: '#FFD60A', bg: 'rgba(255, 214, 10, 0.05)', icon: AlertTriangle },
  STUDENT_CLASH:   { label: 'Student Clash',   color: '#BF5AF2', bg: 'rgba(191, 90, 242, 0.05)', icon: AlertTriangle },
  BRANCH_MIXING_FAILED: { label: 'Branch Mix', color: '#0A84FF', bg: 'rgba(10, 132, 255, 0.05)', icon: Info },
  INSUFFICIENT_ROOM_CAPACITY: { label: 'Room Capacity', color: '#FF9F0A', bg: 'rgba(255, 159, 10, 0.05)', icon: ShieldAlert },
  NO_STUDENTS:     { label: 'No Students',     color: 'var(--text-secondary)', bg: 'rgba(255, 255, 255, 0.02)', icon: Info },
  NO_ROOMS:        { label: 'No Rooms',        color: 'var(--text-secondary)', bg: 'rgba(255, 255, 255, 0.02)', icon: Info },
};

function getMeta(type) {
  return TYPE_META[type] || { label: type.replace(/_/g, ' '), color: 'var(--text-secondary)', bg: 'rgba(255,255,255,0.02)', icon: Info };
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

  // Compute Metrics
  const totalConflicts = conflicts.length;
  const openConflictsCount = open.length;
  const resolvedConflictsCount = resolved.length;
  
  let resolutionRate = 100;
  if (totalConflicts > 0) {
    resolutionRate = Math.round((resolvedConflictsCount / totalConflicts) * 100);
  }

  // Count by conflict type
  const typeCounts = {};
  open.forEach(c => {
    typeCounts[c.type] = (typeCounts[c.type] || 0) + 1;
  });

  const groupedOpen = {};
  for (const c of open) {
    const meta = getMeta(c.type);
    if (!groupedOpen[c.type]) groupedOpen[c.type] = { meta, items: [] };
    groupedOpen[c.type].items.push(c);
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: 0 }}>
        <div>
          <div className="flex-row" style={{ gap: 6, marginBottom: 8 }}>
            <Link to="/exam-cycles" className="btn btn-ghost btn-sm" style={{ borderRadius: 8 }}>
              <ArrowLeft size={12} strokeWidth={1.5} style={{ marginRight: 4 }} /> Back to Cycles
            </Link>
          </div>
          <h1 className="page-title">Conflict Validation Control</h1>
          <p className="page-subtitle">Scan exam slots for invigilator overlaps, classroom capacity limits, and candidate timetable crashes.</p>
        </div>
        <div className="flex-row" style={{ gap: 8 }}>
          <button
            className="btn btn-primary"
            onClick={runDetection}
            disabled={detecting}
          >
            {detecting ? (
              <div className="spinner spinner-invert" style={{ width: 14, height: 14 }} />
            ) : (
              <Zap size={13} strokeWidth={1.5} />
            )}
            Run Scan Engine
          </button>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={fetchConflicts} disabled={loading}>
            <RefreshCw size={13} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Row 1: KPI Summary Row */}
      <div className="kpi-grid">
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>Detected Conflicts</span>
            <AlertTriangle size={14} color="#FFD60A" strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{totalConflicts}</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>Total identified issues</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>Open Interrupts</span>
            <ShieldAlert size={14} color="#FF453A" strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: openConflictsCount > 0 ? '#FF453A' : 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{openConflictsCount}</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>Action required before export</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>Exceptions Resolved</span>
            <CheckCircle size={14} color="#30D158" strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#30D158', fontFamily: 'var(--font-mono)' }}>{resolvedConflictsCount} <span style={{ fontSize: 16, color: 'var(--text-secondary)' }}>({resolutionRate}%)</span></div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>Exceptions verified & marked</div>
          </div>
        </div>
      </div>

      {/* Row 2: Conflict Exceptions & Resolution (Primary Content Area) */}
      <div className="card" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 32 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : conflicts.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <div style={{ color: '#30D158', display: 'inline-flex', padding: 12, marginBottom: 12, background: 'rgba(48,209,88,0.1)', borderRadius: '50%' }}>
            <CheckCircle size={28} strokeWidth={1.5} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>All Clear & Integrity Validated</div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 12, maxWidth: 360, margin: '0 auto' }}>
            No conflicts found. Run a new scan, or verify other timetable sessions.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Open conflicts grouped by type */}
          {Object.values(groupedOpen).map(({ meta, items }) => {
            const Icon = meta.icon;
            return (
              <div key={items[0].type} style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--bg-elevated)' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
                  background: meta.bg, borderBottom: '1px solid var(--border)',
                }}>
                  <Icon size={14} color={meta.color} strokeWidth={2} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {meta.label} — {items.length} active issue{items.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {items.map((c, i) => (
                    <div key={c.id} style={{
                      display: 'flex', alignItems: 'center', gap: 16, padding: '14px 18px',
                      borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
                    }}>
                      <div style={{ flex: 1 }}>
                        {(c.date || c.subject_name) && (
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: meta.color, marginBottom: 4, fontWeight: 600 }}>
                            {formatDate(c.date)} {c.start_time && `· ${formatTime(c.start_time)}`} {c.subject_name && `· ${c.subject_name}`}
                          </div>
                        )}
                        <p style={{ fontSize: 12, color: 'var(--text-primary)', margin: 0 }}>{c.description}</p>
                        {c.suggested_resolution && (
                          <div style={{ fontSize: 10, color: '#FF9F0A', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                            ↳ Resolution Tip: {c.suggested_resolution}
                          </div>
                        )}
                        {c.affected_entities && (
                          <div style={{ fontSize: 9, color: 'var(--text-tertiary)', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                            Target: {c.affected_entities}
                          </div>
                        )}
                      </div>
                      <div className="flex-row" style={{ gap: 6, flexShrink: 0 }}>
                        <button className="btn btn-success btn-sm" style={{ borderRadius: 8, fontSize: 10 }} onClick={() => resolve(c.id)}>
                          <CheckCircle size={10} strokeWidth={2} /> Resolve
                        </button>
                        <button className="btn btn-ghost btn-sm" style={{ borderRadius: 8, fontSize: 10 }} onClick={() => ignore(c.id)}>
                          <X size={10} strokeWidth={2} /> Ignore
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Resolved/Ignored list */}
          {resolved.length > 0 && (
            <div className="card" style={{ padding: 20, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
                Resolved / Ignored Exceptions ({resolved.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {resolved.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-surface)', opacity: 0.65 }}>
                    <div style={{ color: c.status === 'resolved' ? '#30D158' : 'var(--text-tertiary)' }}>
                      {c.status === 'resolved' ? <CheckCircle size={13} strokeWidth={1.5} /> : <X size={13} strokeWidth={1.5} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 9, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginRight: 8, border: '1px solid var(--border)', padding: '1px 4px', borderRadius: 4 }}>
                        {c.type.replace(/_/g, ' ')}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{c.description}</span>
                    </div>
                    <span className={`badge ${c.status === 'resolved' ? 'badge-success' : 'badge-ghost'}`} style={{ fontSize: 8 }}>
                      {c.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
