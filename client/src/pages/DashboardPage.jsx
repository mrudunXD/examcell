import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, BookOpen, Building2, UserCheck, CalendarDays,
  AlertTriangle, CheckCircle, Clock, BarChart3, RefreshCw,
  ArrowRight, Grid3x3, FileDown
} from 'lucide-react';
import api from '../lib/api.js';
import { useAppStore } from '../store/index.js';
import toast from 'react-hot-toast';
import { format, parseISO } from 'date-fns';

function StatCard({ icon: Icon, value, label, color, subtext }) {
  return (
    <div className="stat-card" style={{ borderTop: `3px solid ${color}` }}>
      <div className="icon" style={{ background: `${color}22` }}>
        <Icon size={20} color={color} />
      </div>
      <div className="value" style={{ color }}>{value ?? '—'}</div>
      <div className="label">{label}</div>
      {subtext && <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>{subtext}</div>}
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

  const statusColor = (status) => ({
    draft: '#9ca3af', active: '#3b82f6', finalised: '#10b981', archived: '#6b7280'
  })[status] || '#9ca3af';

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1>📋 Exam Coordinator Dashboard</h1>
          <p>MIT World Peace University — Examination Cell</p>
        </div>
        <div className="flex-row">
          {cycles.length > 0 && (
            <select
              className="select"
              style={{ width: 220 }}
              value={activeCycleId || ''}
              onChange={e => setActiveCycle(e.target.value)}
            >
              {cycles.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          <button className="btn btn-ghost btn-icon" onClick={() => setLoading(true) || api.get(`/dashboard/${activeCycleId}`).then(r => { setStats(r.data); setLoading(false); })}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {!activeCycleId ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <CalendarDays size={40} color="var(--color-text-muted)" style={{ margin: '0 auto 14px' }} />
          <h3 style={{ marginBottom: 8 }}>No Exam Cycles Yet</h3>
          <p className="text-muted" style={{ marginBottom: 20, fontSize: 13 }}>Create an exam cycle to get started.</p>
          <Link to="/exam-cycles" className="btn btn-primary">Create Exam Cycle <ArrowRight size={14} /></Link>
        </div>
      ) : (
        <>
          {/* Cycle info strip */}
          {stats?.cycle && (
            <div style={{
              background: 'var(--color-navy-mid)',
              border: '1px solid var(--color-border)',
              borderRadius: 12, padding: '12px 18px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 24, flexWrap: 'wrap', gap: 12
            }}>
              <div className="flex-row">
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: statusColor(stats.cycle.status),
                  boxShadow: `0 0 8px ${statusColor(stats.cycle.status)}`
                }} />
                <span style={{ fontWeight: 700, fontSize: 15 }}>{stats.cycle.name}</span>
                <span className={`badge badge-${stats.cycle.status === 'finalised' ? 'success' : stats.cycle.status === 'active' ? 'neutral' : 'neutral'}`}
                  style={{ textTransform: 'capitalize' }}>
                  {stats.cycle.status}
                </span>
              </div>
              <div className="flex-row" style={{ fontSize: 12, color: 'var(--color-text-muted)', gap: 20 }}>
                <span>📅 {stats.cycle.start_date} → {stats.cycle.end_date}</span>
                <Link to={`/exam-cycles`} className="btn btn-ghost btn-sm">Manage</Link>
                <Link to={`/conflicts/${activeCycleId}`} className="btn btn-warning btn-sm">
                  <AlertTriangle size={13} /> {s?.openConflicts || 0} Conflicts
                </Link>
                <Link to={`/export/${activeCycleId}`} className="btn btn-success btn-sm">
                  <FileDown size={13} /> Export PDFs
                </Link>
              </div>
            </div>
          )}

          {/* Stats grid */}
          {s && (
            <div className="grid-4" style={{ marginBottom: 24 }}>
              <StatCard icon={CalendarDays} value={`${s.finalisedSlots}/${s.totalSlots}`} label="Slots Finalised" color="#3b82f6" subtext="exam slots" />
              <StatCard icon={Users} value={`${s.seatedStudents}/${s.totalStudents}`} label="Students Seated" color="#10b981" subtext="across all slots" />
              <StatCard icon={Building2} value={`${s.supervisedRooms}/${s.totalRooms}`} label="Rooms Supervised" color="#f59e0b" subtext="with assigned faculty" />
              <StatCard icon={AlertTriangle} value={s.openConflicts} label="Open Conflicts" color={s.openConflicts > 0 ? '#ef4444' : '#10b981'} subtext={s.openConflicts > 0 ? 'needs resolution' : 'all clear!'} />
            </div>
          )}

          {s && (
            <div className="grid-2" style={{ gap: 20 }}>
              {/* Upcoming slots */}
              <div className="card">
                <div className="flex-between" style={{ marginBottom: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700 }}>Upcoming Exam Slots</h3>
                  <Link to="/exam-cycles" style={{ fontSize: 12, color: 'var(--color-accent)' }}>View all →</Link>
                </div>
                {stats.upcomingSlots.length === 0 ? (
                  <p className="text-muted" style={{ fontSize: 13 }}>No upcoming slots.</p>
                ) : (
                  stats.upcomingSlots.map(slot => (
                    <div key={slot.id} style={{
                      padding: '10px 0', borderBottom: '1px solid var(--color-border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{slot.subject_code} — {slot.subject_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                          📅 {slot.date} at {slot.start_time}
                        </div>
                      </div>
                      <div className="flex-row" style={{ gap: 8 }}>
                        <Link to={`/seating/${slot.id}`} className="btn btn-ghost btn-sm">
                          <Grid3x3 size={12} /> Seating
                        </Link>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Quick actions */}
              <div className="card">
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Quick Actions</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { to: '/students', icon: Users, label: 'Manage Students', desc: 'Add, edit or import via CSV' },
                    { to: '/faculty', icon: UserCheck, label: 'Manage Faculty', desc: 'Assign subjects to faculty' },
                    { to: '/exam-cycles', icon: CalendarDays, label: 'Exam Slots', desc: 'Create slots & allocate rooms' },
                    { to: `/conflicts/${activeCycleId}`, icon: AlertTriangle, label: 'Resolve Conflicts', desc: s?.openConflicts > 0 ? `${s.openConflicts} conflict(s) need attention` : 'No conflicts', danger: s?.openConflicts > 0 },
                    { to: `/export/${activeCycleId}`, icon: FileDown, label: 'Export Documents', desc: 'Download seating charts & duty sheets' },
                  ].map(a => (
                    <Link key={a.to} to={a.to} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 12px', borderRadius: 8,
                      background: a.danger ? 'rgba(239,68,68,0.07)' : 'var(--color-surface)',
                      border: `1px solid ${a.danger ? 'rgba(239,68,68,0.2)' : 'var(--color-border)'}`,
                      textDecoration: 'none', transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateX(3px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'translateX(0)'}
                    >
                      <a.icon size={16} color={a.danger ? '#f87171' : 'var(--color-accent)'} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: a.danger ? '#f87171' : 'var(--color-text)' }}>{a.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{a.desc}</div>
                      </div>
                      <ArrowRight size={14} color="var(--color-text-muted)" />
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
