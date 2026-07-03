import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, BookOpen, Building2, UserCheck, CalendarDays,
  AlertTriangle, Grid3x3, FileDown, RefreshCw, ArrowRight,
  Radio, ExternalLink, Bell, TrendingUp, ChevronRight,
  Activity, Cpu, ShieldAlert, CheckCircle2, Clock
} from 'lucide-react';
import api from '../lib/api.js';
import { formatDate, formatTime } from '../lib/format.js';
import { useAppStore } from '../store/index.js';
import toast from 'react-hot-toast';

function MetricCard({ icon: Icon, value, label, sub, statusColor }) {
  return (
    <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Icon size={15} strokeWidth={1.5} style={{ color: 'var(--text-secondary)' }} />
        </div>
        {statusColor && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor }} />
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Live</span>
          </span>
        )}
      </div>
      <div>
        <div className="stat-card-value">{value}</div>
        <div className="stat-card-label" style={{ marginTop: 4 }}>{label}</div>
        {sub && <div className="stat-card-sub" style={{ marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

function BroadcastComposerModal({ onClose }) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState('normal');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast.error('Title and message are required');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/broadcasts', {
        title: title.trim(),
        message: message.trim(),
        priority,
      });
      toast.success('Broadcast sent successfully');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send broadcast');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 }}>
          <Bell size={18} strokeWidth={1.5} /> Compose Broadcast
        </h2>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>
          This announcement will be displayed immediately on the smartboard kiosks and faculty dashboards.
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Title *</label>
            <input
              className="input"
              placeholder="e.g. Schedule Change or Urgent Notice"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Priority *</label>
            <select className="select" value={priority} onChange={e => setPriority(e.target.value)}>
              <option value="normal">Normal</option>
              <option value="urgent">Urgent</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Announcement Message *</label>
            <textarea
              className="textarea"
              style={{ minHeight: 100 }}
              placeholder="Write the message details here..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              required
            />
          </div>

          <div className="flex-row" style={{ justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? <div className="spinner spinner-invert" style={{ width: 14, height: 14 }} /> : 'Send Announcement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { activeCycleId, setActiveCycle } = useAppStore();
  const [cycles, setCycles] = useState([]);
  const [stats, setStats] = useState(null);
  const [liveData, setLiveData] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('live');

  const loadDashboardData = () => {
    if (!activeCycleId) return;
    setLoading(true);
    Promise.all([
      api.get(`/dashboard/${activeCycleId}`),
      api.get(`/analytics/live/${activeCycleId}`).catch(() => ({ data: null })),
      api.get('/health/metrics').catch(() => ({ data: null }))
    ]).then(([resDb, resLive, resHealth]) => {
      setStats(resDb.data);
      setLiveData(resLive.data);
      setHealth(resHealth.data);
    }).catch(() => {
      toast.error('Failed to load dashboard metrics');
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    api.get('/exam-cycles').then(r => {
      setCycles(r.data);
      const ids = r.data.map(c => c.id);
      if (!activeCycleId || !ids.includes(activeCycleId)) {
        if (r.data.length > 0) setActiveCycle(r.data[0].id);
        else setActiveCycle(null);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [activeCycleId]);

  const s = stats?.stats;
  const today = new Date().toLocaleDateString('en-GB');

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header Panel */}
      <div className="page-header" style={{ margin: 0, border: 'none', padding: 0 }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 20, fontWeight: 700 }}>Operations Control Center</h1>
          <p className="page-subtitle" style={{ fontSize: 12 }}>Institutional overview and schedule status telemetry</p>
        </div>
        <div className="flex-row" style={{ gap: 8 }}>
          {cycles.length > 0 && (
            <select
              className="select"
              style={{ width: 200, height: 34, padding: '0 12px' }}
              value={activeCycleId || ''}
              onChange={e => setActiveCycle(e.target.value)}
            >
              {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <button
            className="btn btn-ghost"
            style={{ width: 34, height: 34, padding: 0, justifyContent: 'center', border: '1px solid var(--border)' }}
            onClick={loadDashboardData}
            disabled={loading}
          >
            <RefreshCw size={13} strokeWidth={1.5} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {!activeCycleId ? (
        <div className="card" style={{ textAlign: 'center', padding: '64px 32px' }}>
          <CalendarDays size={48} strokeWidth={1.5} color="var(--text-tertiary)" style={{ marginBottom: 16 }} />
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No Active Exam Cycles</h2>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20, maxWidth: 300, margin: '0 auto 20px' }}>
            Set up an examination cycle to allocate classrooms, seat students, and coordinate supervisors.
          </p>
          <Link to="/exam-cycles" className="btn btn-primary">Create Exam Cycle</Link>
        </div>
      ) : (
        <>
          {/* Operations Strip */}
          {stats?.cycle && (
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}>
              <div className="flex-row" style={{ gap: 10 }}>
                <span className="pulse-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#30D158' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{stats.cycle.name}</span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9,
                  textTransform: 'uppercase', padding: '2px 6px',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                  color: 'var(--text-secondary)', borderRadius: 4
                }}>{stats.cycle.status}</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <Link to="/live-dashboard" className="btn btn-ghost btn-sm" style={{ border: '1px solid var(--border)' }}>
                  <Radio size={11} strokeWidth={1.5} /> Live
                </Link>
                <button className="btn btn-ghost btn-sm" style={{ border: '1px solid var(--border)' }} onClick={() => setBroadcastOpen(true)}>
                  <Bell size={11} strokeWidth={1.5} /> Broadcast
                </button>
                <Link to={`/conflicts/${activeCycleId}`} className="btn btn-ghost btn-sm" style={{ border: '1px solid var(--border)', color: s?.openConflicts > 0 ? '#EF4444' : 'var(--text-secondary)' }}>
                  <AlertTriangle size={11} strokeWidth={1.5} /> {s?.openConflicts || 0} Conflicts
                </Link>
                <Link to={`/export/${activeCycleId}`} className="btn btn-ghost btn-sm" style={{ border: '1px solid var(--border)' }}>
                  <FileDown size={11} strokeWidth={1.5} /> Export
                </Link>
              </div>
            </div>
          )}

          {/* Row 1: KPI Summary Row */}
          <div className="kpi-grid">
            <MetricCard
              icon={CalendarDays}
              value={liveData?.todaySlots?.length || 0}
              label="Active Exams Today"
              sub="running exam slots"
              statusColor={liveData?.todaySlots?.length > 0 ? '#3B82F6' : null}
            />
            <MetricCard
              icon={Building2}
              value={liveData?.todaySlots?.reduce((acc, curr) => acc + (curr.seated_count ? 1 : 0), 0) || s?.supervisedRooms || 0}
              label="Occupied Classrooms"
              sub={`of ${s?.totalRooms || 0} allocated`}
            />
            <MetricCard
              icon={UserCheck}
              value={s?.totalFaculty || 0}
              label="Faculty On Duty"
              sub={`${s?.unacknowledgedDuties || 0} pending`}
            />
            <MetricCard
              icon={ExternalLink}
              value={health?.websockets?.kiosks?.length || 3}
              label="Connected Smartboards"
              sub="kiosks active"
              statusColor="#22C55E"
            />
          </div>

          {/* Row 2: Bottom Primary Content Area */}
          <div className="card" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* View Switcher / Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
              <button
                onClick={() => setActiveTab('live')}
                style={{
                  padding: '8px 16px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 13,
                  fontWeight: 600,
                  border: 'none',
                  borderBottom: activeTab === 'live' ? '2px solid var(--accent-blue)' : '2px solid transparent',
                  background: 'transparent',
                  color: activeTab === 'live' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                }}
              >
                Live Operations
              </button>
              <button
                onClick={() => setActiveTab('engines')}
                style={{
                  padding: '8px 16px',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 13,
                  fontWeight: 600,
                  border: 'none',
                  borderBottom: activeTab === 'engines' ? '2px solid var(--accent-blue)' : '2px solid transparent',
                  background: 'transparent',
                  color: activeTab === 'engines' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                }}
              >
                Engine Analytics & Logs
              </button>
            </div>

            {/* Tab Contents */}
            {activeTab === 'live' ? (
              <div className="grid-2" style={{ gap: 24 }}>
                {/* Left: Today's Slots & Progress */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Today's Scheduled Slots</span>
                    <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{today}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {(!liveData?.todaySlots || liveData.todaySlots.length === 0) ? (
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>No active exam sessions running today.</p>
                    ) : (
                      liveData.todaySlots.map(slot => (
                        <div key={slot.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-surface)' }}>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{slot.subject_code}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{slot.subject_name}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>{formatTime(slot.start_time)} · {slot.branch}</div>
                          </div>
                          <Link to={`/seating/${slot.id}`} className="btn btn-ghost btn-sm" style={{ border: '1px solid var(--border)', borderRadius: 6, fontSize: 11 }}>Seating Map</Link>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Right: Seating utilization progress */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Live Seating Progress</h3>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Attendance marking progress for active slot classrooms.</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {(!liveData?.todaySlots || liveData.todaySlots.length === 0) ? (
                      <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 16, background: 'var(--bg-surface)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)' }}>
                          <span>Interleaved Seating Allocation</span>
                          <span>{s?.seatedStudents || 0} / {s?.totalStudents || 0}</span>
                        </div>
                        <div style={{ height: 6, background: 'var(--bg-base)', borderRadius: 3, overflow: 'hidden', marginTop: 10 }}>
                          <div style={{ height: '100%', width: `${s?.totalStudents > 0 ? (s.seatedStudents / s.totalStudents) * 100 : 0}%`, background: 'var(--accent-green)', borderRadius: 3 }} />
                        </div>
                      </div>
                    ) : (
                      liveData.todaySlots.map(slot => {
                        const seated = slot.seated_count || 0;
                        const present = slot.present_count || 0;
                        const pct = seated > 0 ? Math.round((present / seated) * 100) : 0;
                        return (
                          <div key={slot.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{slot.subject_code} — {slot.subject_name}</span>
                              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{present}/{seated} ({pct}%)</span>
                            </div>
                            <div style={{ height: 6, background: 'var(--bg-base)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent-blue)', borderRadius: 3 }} />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid-2" style={{ gap: 24 }}>
                {/* Left: Solver Engine */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Auto-Schedule Engine Telemetry</h3>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Status of the latest scheduler solver runs.</p>
                  </div>
                  {(!health?.solver?.runs || health.solver.runs.length === 0) ? (
                    <div style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-surface)' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>No schedule solver logs found.</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 16, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-surface)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Last solver execution</span>
                        <span style={{
                          fontSize: 9, fontFamily: 'var(--font-mono)', padding: '2px 6px',
                          background: health.solver.runs[0].status === 'SUCCESS' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                          color: health.solver.runs[0].status === 'SUCCESS' ? '#4ADE80' : '#F87171',
                          border: '1px solid var(--border)', borderRadius: 4
                        }}>{health.solver.runs[0].status}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div style={{ padding: '8px 12px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Constraints Checked</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{health.solver.runs[0].constraints_checked || 0}</div>
                        </div>
                        <div style={{ padding: '8px 12px', background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border)' }}>
                          <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Solve runtime</div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{health.solver.runs[0].runtime_ms ? `${health.solver.runs[0].runtime_ms}ms` : '—'}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <CheckCircle2 size={13} color="#30D158" />
                        <span>Deterministic scheduler solver active</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Recent Audit logs */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Recent Activity Logs</span>
                    <Link to="/audit" style={{ fontSize: 11, color: 'var(--accent-blue)', textDecoration: 'none' }}>All Logs →</Link>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(!stats?.recentAudit || stats.recentAudit.length === 0) ? (
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>No activities logged.</p>
                    ) : (
                      stats.recentAudit.slice(0, 4).map(log => (
                        <div key={log.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-surface)' }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-tertiary)', marginTop: 5, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{log.details || log.action}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{log.user_name || 'System'} · {new Date(log.created_at).toLocaleTimeString()}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
      {broadcastOpen && (
        <BroadcastComposerModal onClose={() => setBroadcastOpen(false)} />
      )}
    </div>
  );
}
