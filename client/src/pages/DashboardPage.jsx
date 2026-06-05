import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, BookOpen, Building2, UserCheck, CalendarDays,
  AlertTriangle, Grid3x3, FileDown, RefreshCw, ArrowRight
} from 'lucide-react';
import api from '../lib/api.js';
import { useAppStore } from '../store/index.js';
import toast from 'react-hot-toast';

function StatCard({ icon: Icon, value, label, sub, accent }) {
  return (
    <div className="stat-card hard-shadow-hover" style={{
      borderTop: `3px solid ${accent || '#111111'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="stat-card-value" style={{ color: accent || '#111111' }}>{value ?? '—'}</div>
          <div className="stat-card-label">{label}</div>
          {sub && <div className="stat-card-sub">{sub}</div>}
        </div>
        <div style={{
          border: `1px solid ${accent || '#111111'}`,
          padding: 8,
          color: accent || '#111111',
          opacity: 0.6,
        }}>
          <Icon size={16} strokeWidth={1.5} />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { activeCycleId, setActiveCycle } = useAppStore();
  const [cycles, setCycles] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/exam-cycles').then(r => {
      setCycles(r.data);
      if (!activeCycleId && r.data.length > 0) setActiveCycle(r.data[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!activeCycleId) return;
    setLoading(true);
    api.get(`/dashboard/${activeCycleId}`)
      .then(r => setStats(r.data))
      .catch(() => toast.error('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, [activeCycleId]);

  const s = stats?.stats;

  return (
    <div className="fade-in">
      {/* Page header */}
      <div className="page-header">
        <div>
          <div className="accent-bar" />
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Examination Coordinator Overview</p>
        </div>
        <div className="flex-row" style={{ gap: 8 }}>
          {cycles.length > 0 && (
            <select
              className="select"
              style={{ width: 220 }}
              value={activeCycleId || ''}
              onChange={e => setActiveCycle(e.target.value)}
            >
              {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => {
              if (!activeCycleId) return;
              setLoading(true);
              api.get(`/dashboard/${activeCycleId}`).then(r => setStats(r.data)).finally(() => setLoading(false));
            }}
            aria-label="Refresh"
          >
            <RefreshCw size={14} strokeWidth={1.5} className={loading ? 'spin' : ''} style={{ animation: loading ? 'spin 0.6s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {!activeCycleId ? (
        <div className="card" style={{ textAlign: 'center', padding: 64 }}>
          <div style={{ border: '1px solid #E5E5E0', display: 'inline-flex', padding: 12, marginBottom: 16 }}>
            <CalendarDays size={28} strokeWidth={1} color="#A3A3A3" />
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            No Exam Cycles Yet
          </div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--np-n500)', marginBottom: 24 }}>
            Create an exam cycle to begin managing seating and supervisors.
          </p>
          <Link to="/exam-cycles" className="btn btn-primary">
            Create First Cycle <ArrowRight size={13} strokeWidth={1.5} />
          </Link>
        </div>
      ) : (
        <>
          {/* Cycle info bar */}
          {stats?.cycle && (
            <div style={{
              background: '#111111',
              color: '#F9F9F7',
              padding: '10px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 10,
              marginBottom: 24,
            }}>
              <div className="flex-row" style={{ gap: 12 }}>
                <div style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#fff',
                }}>
                  {stats.cycle.name}
                </div>
                <span className="badge badge-ink" style={{ textTransform: 'capitalize', fontSize: 9 }}>
                  {stats.cycle.status}
                </span>
              </div>
              <div className="flex-row" style={{ gap: 6 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                  {stats.cycle.start_date} — {stats.cycle.end_date}
                </span>
                <Link to={`/conflicts/${activeCycleId}`} className="btn btn-sm" style={{ color: s?.openConflicts > 0 ? '#f87171' : 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.15)' }}>
                  <AlertTriangle size={11} strokeWidth={1.5} />
                  {s?.openConflicts || 0} Conflicts
                </Link>
                <Link to={`/export/${activeCycleId}`} className="btn btn-sm" style={{ color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.15)' }}>
                  <FileDown size={11} strokeWidth={1.5} /> Export
                </Link>
              </div>
            </div>
          )}

          {/* Stats grid */}
          {s && (
            <div className="grid-4" style={{ marginBottom: 28 }}>
              <StatCard icon={CalendarDays} value={`${s.finalisedSlots}/${s.totalSlots}`} label="Slots Finalised" sub="exam sessions" accent="#1d4ed8" />
              <StatCard icon={Users}        value={`${s.seatedStudents}/${s.totalStudents}`} label="Students Seated" sub="across all slots" accent="#166534" />
              <StatCard icon={Building2}    value={`${s.supervisedRooms}/${s.totalRooms}`} label="Rooms Covered"  sub="with supervisors" accent="#92400e" />
              <StatCard icon={AlertTriangle} value={s.openConflicts} label="Open Conflicts" sub={s.openConflicts > 0 ? 'action needed' : 'all clear'} accent={s.openConflicts > 0 ? '#CC0000' : '#166534'} />
            </div>
          )}

          {s && (
            <div className="grid-2" style={{ gap: 20 }}>
              {/* Upcoming slots */}
              <div className="card" style={{ padding: 0 }}>
                <div style={{
                  padding: '12px 18px',
                  borderBottom: '2px solid #111111',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: 14, fontWeight: 700 }}>
                    Upcoming Exam Slots
                  </span>
                  <Link to="/exam-cycles" style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: '#CC0000',
                    textDecoration: 'none',
                  }}>
                    View All
                  </Link>
                </div>
                <div style={{ padding: '0 18px' }}>
                  {stats.upcomingSlots.length === 0 ? (
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--np-n500)', padding: '20px 0' }}>
                      No upcoming slots scheduled.
                    </p>
                  ) : stats.upcomingSlots.map((slot, i) => (
                    <div key={slot.id} style={{
                      padding: '12px 0',
                      borderBottom: i < stats.upcomingSlots.length - 1 ? '1px solid #E5E5E0' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}>
                      <div>
                        <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13 }}>
                          {slot.subject_code} — {slot.subject_name}
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--np-n500)', marginTop: 3 }}>
                          {slot.date} · {slot.start_time}
                        </div>
                      </div>
                      <Link to={`/seating/${slot.id}`} className="btn btn-ghost btn-sm">
                        <Grid3x3 size={11} strokeWidth={1.5} /> Seating
                      </Link>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick actions */}
              <div className="card" style={{ padding: 0 }}>
                <div style={{
                  padding: '12px 18px',
                  borderBottom: '2px solid #111111',
                }}>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: 14, fontWeight: 700 }}>
                    Quick Actions
                  </span>
                </div>
                <div style={{ padding: '8px 0' }}>
                  {[
                    { to: '/students',             icon: Users,        label: 'Manage Students',   desc: 'Add, edit or import via CSV' },
                    { to: '/faculty',              icon: UserCheck,    label: 'Manage Faculty',    desc: 'Assign teaching subjects' },
                    { to: '/exam-cycles',          icon: CalendarDays, label: 'Exam Slots',        desc: 'Create slots & allocate rooms' },
                    { to: `/conflicts/${activeCycleId}`, icon: AlertTriangle, label: 'Resolve Conflicts', desc: s?.openConflicts > 0 ? `${s.openConflicts} conflict(s) pending` : 'No conflicts', danger: s?.openConflicts > 0 },
                    { to: `/export/${activeCycleId}`,   icon: FileDown,     label: 'Export Documents',  desc: 'Seating charts, duty sheets, timetable' },
                  ].map(a => (
                    <Link
                      key={a.to}
                      to={a.to}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        padding: '11px 18px',
                        borderBottom: '1px solid #E5E5E0',
                        textDecoration: 'none',
                        transition: 'background 0.12s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F5F5F5'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{
                        border: `1px solid ${a.danger ? '#CC0000' : '#E5E5E0'}`,
                        padding: 6,
                        color: a.danger ? '#CC0000' : '#525252',
                        flexShrink: 0,
                      }}>
                        <a.icon size={14} strokeWidth={1.5} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600, color: a.danger ? '#CC0000' : '#111111' }}>
                          {a.label}
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#737373', marginTop: 2 }}>
                          {a.desc}
                        </div>
                      </div>
                      <ArrowRight size={13} strokeWidth={1.5} color="#A3A3A3" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
