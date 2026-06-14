import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, BookOpen, Building2, UserCheck, CalendarDays,
  AlertTriangle, Grid3x3, FileDown, RefreshCw, ArrowRight,
  Radio, ExternalLink, Bell, TrendingUp, ChevronRight
} from 'lucide-react';
import api from '../lib/api.js';
import { formatDate, formatTime } from '../lib/format.js';
import { useAppStore } from '../store/index.js';
import toast from 'react-hot-toast';

function StatCard({ icon: Icon, value, label, sub, accentColor }) {
  return (
    <div style={{
      background: '#111113',
      border: '1px solid #222225',
      borderRadius: 12,
      padding: '20px 22px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      transition: 'border-color 0.15s',
      cursor: 'default',
      position: 'relative',
      overflow: 'hidden',
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = '#3A3A3C'}
    onMouseLeave={e => e.currentTarget.style.borderColor = '#222225'}
    >
      {/* Accent dot */}
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: `${accentColor}18`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={16} strokeWidth={1.5} style={{ color: accentColor }} />
      </div>
      <div>
        <div style={{
          fontSize: 32, fontWeight: 700, lineHeight: 1.15,
          color: '#FFFFFF', fontFamily: 'var(--font-sans)',
          letterSpacing: '-0.02em',
        }}>
          {value ?? '—'}
        </div>
        <div style={{
          fontSize: 12, fontWeight: 600, color: '#8E8E93',
          fontFamily: 'var(--font-sans)', marginTop: 4,
          textTransform: 'none',
        }}>
          {label}
        </div>
        {sub && (
          <div style={{
            fontSize: 11, color: '#4A4A4F',
            fontFamily: 'var(--font-sans)', marginTop: 2,
          }}>
            {sub}
          </div>
        )}
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
        <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bell size={18} strokeWidth={1.5} /> Compose Broadcast
        </h2>
        <p style={{ fontSize: 13, color: '#8E8E93', marginBottom: 20 }}>
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
              className="input"
              style={{ minHeight: 100, resize: 'vertical' }}
              placeholder="Write the message details here..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              required
            />
          </div>

          <div className="flex-row" style={{ justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid #222225' }}>
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
  const [loading, setLoading] = useState(false);
  const [broadcastOpen, setBroadcastOpen] = useState(false);

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
            <RefreshCw size={14} strokeWidth={1.5} style={{ animation: loading ? 'spin 0.6s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {!activeCycleId ? (
        <div className="card" style={{ textAlign: 'center', padding: 64 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 12,
            background: '#1C1C1F', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center', marginBottom: 16,
          }}>
            <CalendarDays size={24} strokeWidth={1.5} color="#8E8E93" />
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: '#FFFFFF' }}>
            No Exam Cycles Yet
          </div>
          <p style={{ fontSize: 13, color: '#8E8E93', marginBottom: 24, maxWidth: 320, margin: '0 auto 24px' }}>
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
              background: '#111113',
              border: '1px solid #222225',
              borderRadius: 10,
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 10,
              marginBottom: 24,
            }}>
              <div className="flex-row" style={{ gap: 12 }}>
                <div style={{
                  fontSize: 14, fontWeight: 700, color: '#FFFFFF',
                  fontFamily: 'var(--font-sans)',
                }}>
                  {stats.cycle.name}
                </div>
                <span className={`badge ${stats.cycle.status === 'active' ? 'badge-success' : stats.cycle.status === 'finalised' ? 'badge-neutral' : 'badge-warning'}`} style={{ textTransform: 'capitalize' }}>
                  {stats.cycle.status}
                </span>
              </div>
              <div className="flex-row" style={{ gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#4A4A4F' }}>
                  {formatDate(stats.cycle.start_date)} — {formatDate(stats.cycle.end_date)}
                </span>
                <Link to="/live-dashboard" className="btn btn-ghost btn-sm">
                  <Radio size={11} strokeWidth={1.5} /> Live
                </Link>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => window.open(`/kiosk/${activeCycleId}`, '_blank')}
                >
                  <ExternalLink size={11} strokeWidth={1.5} /> Kiosk
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setBroadcastOpen(true)}>
                  <Bell size={11} strokeWidth={1.5} /> Broadcast
                </button>
                <Link
                  to={`/conflicts/${activeCycleId}`}
                  className="btn btn-sm"
                  style={{
                    color: s?.openConflicts > 0 ? '#FF453A' : '#8E8E93',
                    border: `1px solid ${s?.openConflicts > 0 ? 'rgba(255,69,58,0.3)' : '#2C2C2E'}`,
                    background: s?.openConflicts > 0 ? 'rgba(255,69,58,0.08)' : 'transparent',
                  }}
                >
                  <AlertTriangle size={11} strokeWidth={1.5} />
                  {s?.openConflicts || 0} Conflicts
                </Link>
                <Link to={`/export/${activeCycleId}`} className="btn btn-ghost btn-sm">
                  <FileDown size={11} strokeWidth={1.5} /> Export
                </Link>
              </div>
            </div>
          )}

          {/* Stats grid */}
          {s && (
            <div className="grid-4" style={{ marginBottom: 28 }}>
              <StatCard
                icon={CalendarDays}
                value={`${s.finalisedSlots}/${s.totalSlots}`}
                label="Slots Finalised"
                sub="exam sessions"
                accentColor="#0A84FF"
              />
              <StatCard
                icon={Users}
                value={`${s.seatedStudents}/${s.totalStudents}`}
                label="Students Seated"
                sub="across all slots"
                accentColor="#30D158"
              />
              <StatCard
                icon={Building2}
                value={`${s.supervisedRooms}/${s.totalRooms}`}
                label="Rooms Covered"
                sub="with supervisors"
                accentColor="#FF9F0A"
              />
              <StatCard
                icon={AlertTriangle}
                value={s.openConflicts}
                label="Open Conflicts"
                sub={s.openConflicts > 0 ? 'action needed' : 'all clear'}
                accentColor={s.openConflicts > 0 ? '#FF453A' : '#30D158'}
              />
            </div>
          )}

          {s && (
            <div className="grid-2" style={{ gap: 20 }}>
              {/* Upcoming slots */}
              <div style={{
                background: '#111113',
                border: '1px solid #222225',
                borderRadius: 12,
                overflow: 'hidden',
              }}>
                <div style={{
                  padding: '14px 18px',
                  borderBottom: '1px solid #222225',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#FFFFFF' }}>
                    Upcoming Exam Slots
                  </span>
                  <Link to="/exam-cycles" style={{
                    fontSize: 11, color: '#0A84FF',
                    textDecoration: 'none', fontWeight: 500,
                  }}>
                    View All
                  </Link>
                </div>
                <div style={{ padding: '4px 0' }}>
                  {stats.upcomingSlots.length === 0 ? (
                    <p style={{ fontSize: 13, color: '#4A4A4F', padding: '20px 18px' }}>
                      No upcoming slots scheduled.
                    </p>
                  ) : stats.upcomingSlots.map((slot, i) => (
                    <div key={slot.id} style={{
                      padding: '11px 18px',
                      borderBottom: i < stats.upcomingSlots.length - 1 ? '1px solid #222225' : 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#1C1C1F'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#E5E5EA' }}>
                          {slot.subject_code} — {slot.subject_name}
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#4A4A4F', marginTop: 3 }}>
                          {formatDate(slot.date)} · {formatTime(slot.start_time)}
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
              <div style={{
                background: '#111113',
                border: '1px solid #222225',
                borderRadius: 12,
                overflow: 'hidden',
              }}>
                <div style={{
                  padding: '14px 18px',
                  borderBottom: '1px solid #222225',
                }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#FFFFFF' }}>
                    Quick Actions
                  </span>
                </div>
                <div>
                  {[
                    { to: '/students',                    icon: Users,         label: 'Manage Students',    desc: 'Add, edit or import via CSV' },
                    { to: '/faculty',                     icon: UserCheck,     label: 'Manage Faculty',     desc: 'Assign teaching subjects' },
                    { to: '/exam-cycles',                 icon: CalendarDays,  label: 'Exam Slots',         desc: 'Create slots & allocate rooms' },
                    { to: `/conflicts/${activeCycleId}`,  icon: AlertTriangle, label: 'Resolve Conflicts',  desc: s?.openConflicts > 0 ? `${s.openConflicts} conflict(s) pending` : 'No conflicts', danger: s?.openConflicts > 0 },
                    { to: `/export/${activeCycleId}`,     icon: FileDown,      label: 'Export Documents',   desc: 'Seating charts, duty sheets, timetable' },
                  ].map(a => (
                    <Link
                      key={a.to}
                      to={a.to}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 18px',
                        borderBottom: '1px solid #222225',
                        textDecoration: 'none',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#1C1C1F'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: 8,
                        background: a.danger ? 'rgba(255,69,58,0.12)' : '#1C1C1F',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <a.icon size={14} strokeWidth={1.5} color={a.danger ? '#FF453A' : '#8E8E93'} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: a.danger ? '#FF453A' : '#E5E5EA' }}>
                          {a.label}
                        </div>
                        <div style={{ fontSize: 11, color: '#4A4A4F', marginTop: 2 }}>
                          {a.desc}
                        </div>
                      </div>
                      <ChevronRight size={14} strokeWidth={1.5} color="#3A3A3C" />
                    </Link>
                  ))}
                  {/* Broadcast */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 18px',
                      cursor: 'pointer',
                      transition: 'background 0.1s',
                    }}
                    onClick={() => setBroadcastOpen(true)}
                    onMouseEnter={e => e.currentTarget.style.background = '#1C1C1F'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: '#1C1C1F',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Bell size={14} strokeWidth={1.5} color="#8E8E93" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#E5E5EA' }}>
                        Send Broadcast Notice
                      </div>
                      <div style={{ fontSize: 11, color: '#4A4A4F', marginTop: 2 }}>
                        Announce notices to smartboard & faculty
                      </div>
                    </div>
                    <ChevronRight size={14} strokeWidth={1.5} color="#3A3A3C" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      {broadcastOpen && (
        <BroadcastComposerModal onClose={() => setBroadcastOpen(false)} />
      )}
    </div>
  );
}




