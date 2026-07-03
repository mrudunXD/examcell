import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import {
  Users, BookOpen, Building2, UserCheck, CalendarDays,
  AlertTriangle, Grid3x3, FileDown, RefreshCw, ArrowRight,
  Radio, ExternalLink, Bell, TrendingUp, ChevronRight,
  Activity, Cpu, ShieldAlert, CheckCircle2, Clock, CheckCircle
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

function getSlotPhase(slot) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  if (!slot.date || slot.date !== today) return 'scheduled';
  const [h, m] = slot.start_time.split(':').map(Number);
  const start = new Date(); start.setHours(h, m, 0);
  const end = new Date(start.getTime() + slot.duration_mins * 60000);
  if (now < start) return 'upcoming';
  if (now >= start && now <= end) return 'live';
  return 'done';
}

function AttendancePct({ present, total }) {
  const pct = total > 0 ? Math.round((present / total) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
      <div style={{ flex: 1, height: 4, background: 'var(--border)', position: 'relative', borderRadius: 2 }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: pct > 75 ? '#10b981' : pct > 40 ? '#f59e0b' : '#ef4444', transition: 'width 0.5s', borderRadius: 2 }} />
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, minWidth: 32, textAlign: 'right', color: 'var(--text-secondary)' }}>{pct}%</span>
    </div>
  );
}

function IncidentResolveModal({ incident, onClose, onSave }) {
  const [actionTaken, setActionTaken] = useState(incident.action_taken || '');
  const [submitting, setSubmitting] = useState(false);

  const handleUpdate = async (newStatus) => {
    setSubmitting(true);
    try {
      await api.patch(`/incidents/${incident.id}`, {
        status: newStatus,
        action_taken: actionTaken.trim() || null
      });
      toast.success(`Incident marked as ${newStatus}`);
      onSave();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update incident');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <h2 className="modal-title" style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: 8, fontSize: 16 }}>
          <AlertTriangle size={18} /> Resolve Exam Incident
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: '12px 0 20px 0', fontSize: 13, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
          <div className="grid-2">
            <div>
              <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Type</strong>
              <div style={{ fontWeight: 600, textTransform: 'capitalize', color: 'var(--text-primary)', marginTop: 2 }}>{incident.type}</div>
            </div>
            <div>
              <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Room</strong>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>{incident.room_no}</div>
            </div>
          </div>
          <div className="grid-2">
            <div>
              <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Severity</strong>
              <div style={{ fontWeight: 600, textTransform: 'capitalize', color: incident.severity === 'high' ? '#ef4444' : incident.severity === 'medium' ? '#f59e0b' : '#10b981', marginTop: 2 }}>{incident.severity}</div>
            </div>
            <div>
              <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Reported By</strong>
              <div style={{ color: 'var(--text-primary)', marginTop: 2 }}>{incident.reported_by_name}</div>
            </div>
          </div>
          {incident.student_prn && (
            <div>
              <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Student PRN</strong>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)', marginTop: 2 }}>{incident.student_prn}</div>
            </div>
          )}
          <div>
            <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Incident Description</strong>
            <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px', marginTop: 6, fontStyle: 'italic', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {incident.description}
            </div>
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 20 }}>
          <label className="form-label">Action Taken / Resolution Notes</label>
          <textarea 
            className="textarea" 
            style={{ minHeight: 80, resize: 'vertical' }}
            placeholder="Describe action taken by the Exam Cell..." 
            value={actionTaken} 
            onChange={e => setActionTaken(e.target.value)}
          />
        </div>

        <div className="flex-row" style={{ justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
          <button type="button" className="btn btn-ghost" style={{ color: '#ef4444' }} onClick={() => handleUpdate('escalated')} disabled={submitting}>Escalate</button>
          <button type="button" className="btn btn-primary" onClick={() => handleUpdate('resolved')} disabled={submitting}>Resolve Incident</button>
        </div>
      </div>
    </div>
  );
}

function SlotCard({ slot, phase, isLast }) {
  const colors = { live: '#10b981', upcoming: '#3b82f6', done: 'var(--text-tertiary)' };
  const color = colors[phase];

  return (
    <div style={{ display: 'flex', gap: 12, padding: '14px 16px', borderBottom: !isLast ? '1px solid var(--border)' : 'none', alignItems: 'flex-start' }}>
      <div style={{ width: 3, alignSelf: 'stretch', background: color, flexShrink: 0, borderRadius: 1.5 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{slot.subject_code} — {slot.subject_name}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
              {slot.branch} · {slot.year} · Sem {slot.semester} · {formatTime(slot.start_time)} ({slot.duration_mins}min)
            </div>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.10em', color, border: `1px solid ${color}`, padding: '2px 6px', borderRadius: 4, flexShrink: 0 }}>
            {phase}
          </span>
        </div>
        {phase !== 'done' && slot.seated_count > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 8 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-tertiary)', marginBottom: 4 }}>Attendance {slot.present_count}/{slot.seated_count}</div>
              <AttendancePct present={slot.present_count} total={slot.seated_count} />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-tertiary)', marginBottom: 4 }}>Supervisors Acknowledged</div>
              <AttendancePct present={slot.ack_count} total={slot.supervisor_count} />
            </div>
          </div>
        )}
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

  // New merged states from LiveDashboardPage
  const [lastRefresh, setLastRefresh] = useState(null);
  const [tick, setTick] = useState(0);
  const [resolvingIncident, setResolvingIncident] = useState(null);
  const [broadcasts, setBroadcasts] = useState([]);
  const [acknowledgments, setAcknowledgments] = useState({});
  const [onlineKiosks, setOnlineKiosks] = useState([]);
  
  // Composer Form state
  const [targetRoomId, setTargetRoomId] = useState('');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastPriority, setBroadcastPriority] = useState('normal');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  const navigate = useNavigate();

  const fetchBroadcastsData = useCallback(async () => {
    try {
      const [brRes, ackRes] = await Promise.all([
        api.get('/broadcasts'),
        api.get('/broadcasts/acknowledgments')
      ]);
      setBroadcasts(brRes.data);
      
      const ackMap = {};
      for (const a of ackRes.data) {
        ackMap[`${a.broadcast_id}_${a.classroom_id}`] = a.acknowledged_at;
      }
      setAcknowledgments(ackMap);
    } catch (err) {
      console.error('Failed to load broadcasts telemetry:', err);
    }
  }, []);

  const loadDashboardData = useCallback(() => {
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
      setLastRefresh(new Date());
    }).catch(() => {
      toast.error('Failed to load dashboard metrics');
    }).finally(() => setLoading(false));
  }, [activeCycleId]);

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
    fetchBroadcastsData();
  }, [activeCycleId, loadDashboardData, fetchBroadcastsData]);

  // WebSocket live synchronization
  useEffect(() => {
    if (!activeCycleId) return;

    const socketUrl = window.location.origin.includes('5173')
      ? 'http://localhost:5000'
      : window.location.origin;

    console.log(`Connecting ControlCenter to WebSocket server at: ${socketUrl}`);
    const socket = io(socketUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('📡 ControlCenter WebSocket connected successfully');
    });

    socket.on('ATTENDANCE_MARKED', () => {
      loadDashboardData();
    });

    socket.on('INCIDENT_REPORTED', (incident) => {
      toast.error(`New Incident: ${incident.type} severity ${incident.severity} - ${incident.description}`);
      loadDashboardData();
    });

    socket.on('INCIDENT_UPDATED', () => {
      loadDashboardData();
    });

    socket.on('KIOSKS_UPDATED', (kioskList) => {
      setOnlineKiosks(kioskList);
    });

    socket.on('BROADCAST_ACKNOWLEDGED', (ack) => {
      setAcknowledgments(prev => ({
        ...prev,
        [`${ack.broadcastId}_${ack.classroomId}`]: ack.acknowledgedAt
      }));
      toast.success(`Kiosk acknowledged broadcast!`);
    });

    socket.on('EMERGENCY_BROADCAST', () => {
      fetchBroadcastsData();
    });

    return () => {
      socket.disconnect();
    };
  }, [activeCycleId, loadDashboardData, fetchBroadcastsData]);

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(() => { setTick(t => t + 1); }, 30000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { if (activeCycleId) { loadDashboardData(); fetchBroadcastsData(); } }, [tick, activeCycleId, loadDashboardData, fetchBroadcastsData]);

  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMsg.trim()) {
      toast.error('Title and message are required.');
      return;
    }
    setSendingBroadcast(true);
    try {
      await api.post('/broadcasts', {
        title: broadcastTitle.trim(),
        message: broadcastMsg.trim(),
        priority: broadcastPriority,
        classroom_id: targetRoomId || null
      });
      toast.success('Broadcast sent successfully');
      setBroadcastTitle('');
      setBroadcastMsg('');
      setTargetRoomId('');
      setBroadcastPriority('normal');
      fetchBroadcastsData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send broadcast');
    } finally {
      setSendingBroadcast(false);
    }
  };

  const activeClassrooms = useMemo(() => {
    if (!liveData?.todaySlots) return [];
    const roomsMap = {};
    for (const slot of liveData.todaySlots) {
      for (const r of slot.rooms || []) {
        roomsMap[r.classroom_id] = {
          classroomId: r.classroom_id,
          roomNo: r.room_no,
          block: r.block,
          slotId: slot.id,
          slotName: `${slot.subject_code} - ${slot.subject_name}`
        };
      }
    }
    return Object.values(roomsMap);
  }, [liveData]);

  const liveSlots = liveData?.todaySlots?.filter(s => getSlotPhase(s) === 'live') || [];
  const upcomingToday = liveData?.todaySlots?.filter(s => getSlotPhase(s) === 'upcoming') || [];
  const doneToday = liveData?.todaySlots?.filter(s => getSlotPhase(s) === 'done') || [];

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
                {/* Left Column: Today's Scheduled Slots & Live Progress */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {/* Live Now Slots */}
                  {liveSlots.length > 0 && (
                    <div>
                      <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid #10b981', color: '#10b981', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, borderRadius: 6, marginBottom: 8 }}>
                        <Radio size={12} strokeWidth={2} style={{ animation: 'pulse 1.5s infinite' }} />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>
                          Live Now — {liveSlots.length} Active Session{liveSlots.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-surface)' }}>
                        {liveSlots.map((slot, i) => (
                          <SlotCard key={slot.id} slot={slot} phase="live" isLast={i === liveSlots.length - 1} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Upcoming Today */}
                  {upcomingToday.length > 0 && (
                    <div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#3b82f6', borderBottom: '1px solid var(--border)', paddingBottom: 6, marginBottom: 8, fontWeight: 700 }}>
                        Upcoming Today ({upcomingToday.length})
                      </div>
                      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-surface)' }}>
                        {upcomingToday.map((slot, i) => (
                          <SlotCard key={slot.id} slot={slot} phase="upcoming" isLast={i === upcomingToday.length - 1} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Done Today */}
                  {doneToday.length > 0 && (
                    <div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border)', paddingBottom: 6, marginBottom: 8, fontWeight: 700 }}>
                        Completed Today ({doneToday.length})
                      </div>
                      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-surface)', opacity: 0.7 }}>
                        {doneToday.map((slot, i) => (
                          <SlotCard key={slot.id} slot={slot} phase="done" isLast={i === doneToday.length - 1} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty state */}
                  {(!liveData?.todaySlots || liveData.todaySlots.length === 0) && (
                    <div style={{ textAlign: 'center', padding: '48px 24px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-surface)' }}>
                      <Clock size={32} strokeWidth={1} style={{ opacity: 0.3, marginBottom: 12, color: 'var(--text-tertiary)' }} />
                      <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--text-secondary)' }}>No exams scheduled for today</div>
                    </div>
                  )}

                  {/* Active Incidents log block */}
                  <div style={{ marginTop: 8 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: liveData?.openIncidents?.length ? '#ef4444' : 'var(--text-tertiary)', borderBottom: '1px solid var(--border)', paddingBottom: 6, marginBottom: 12, fontWeight: 700 }}>
                      Active Incidents Today ({liveData?.openIncidents?.length || 0})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {liveData?.openIncidents?.length ? liveData.openIncidents.map(inc => (
                        <div 
                          key={inc.id} 
                          style={{ 
                            padding: '12px 14px', 
                            border: '1px solid rgba(239, 68, 68, 0.2)', 
                            background: 'rgba(239, 68, 68, 0.02)',
                            borderRadius: 8,
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                          onClick={() => setResolvingIncident(inc)}
                          className="hover-card"
                        >
                          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                            <AlertTriangle size={14} strokeWidth={1.5} color="#ef4444" style={{ marginTop: 2, flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', color: '#ef4444', fontWeight: 700 }}>
                                  {inc.type} · Room {inc.room_no}
                                </span>
                                <span style={{ fontSize: 9, textTransform: 'uppercase', background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', padding: '1px 5px', borderRadius: 4, fontWeight: 600 }}>{inc.severity}</span>
                              </div>
                              <div style={{ fontSize: 12, marginTop: 4, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{inc.description}</div>
                              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 8 }}>
                                Reported by {inc.reported_by_name} · Click to resolve
                              </div>
                            </div>
                          </div>
                        </div>
                      )) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#10b981', padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-surface)' }}>
                          <CheckCircle size={14} strokeWidth={1.5} />
                          <span style={{ fontStyle: 'italic', fontSize: 12 }}>All clear, no active incidents</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column: Classroom Broadcast & Tracker */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {/* Classroom Broadcast Console */}
                  <div style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)', padding: 20, borderRadius: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Radio size={14} color="#ef4444" />
                      <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Classroom Broadcast Console</h3>
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 16 }}>Dispatch real-time emergency text notices to room smartboard terminals.</p>
                    
                    <form onSubmit={handleSendBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.02em', color: 'var(--text-secondary)' }}>Target Room</label>
                        <select
                          className="select"
                          value={targetRoomId}
                          onChange={e => setTargetRoomId(e.target.value)}
                          style={{ width: '100%' }}
                        >
                          <option value="">Broadcast to All Rooms</option>
                          {activeClassrooms.map(c => {
                            const isOnline = onlineKiosks.some(k => String(k.classroomId) === String(c.classroomId) && k.status === 'online');
                            return (
                              <option key={c.classroomId} value={c.classroomId}>
                                Room {c.roomNo} {c.block ? `(${c.block})` : ''} {isOnline ? '🟢 Online' : '🔴 Offline'}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.02em', color: 'var(--text-secondary)' }}>Severity Priority</label>
                        <select
                          className="select"
                          value={broadcastPriority}
                          onChange={e => setBroadcastPriority(e.target.value)}
                          style={{ width: '100%' }}
                        >
                          <option value="normal">Normal</option>
                          <option value="urgent">Urgent</option>
                          <option value="critical">Critical</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.02em', color: 'var(--text-secondary)' }}>Title</label>
                        <input
                          type="text"
                          className="input"
                          value={broadcastTitle}
                          onChange={e => setBroadcastTitle(e.target.value)}
                          placeholder="e.g. Q4 Correction or Typo alert"
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.02em', color: 'var(--text-secondary)' }}>Notice Message</label>
                        <textarea
                          className="textarea"
                          value={broadcastMsg}
                          onChange={e => setBroadcastMsg(e.target.value)}
                          placeholder="Enter details to display on screen..."
                          style={{ minHeight: 60 }}
                        />
                      </div>

                      <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', marginTop: 8 }}
                        disabled={sendingBroadcast}
                      >
                        {sendingBroadcast ? 'Publishing...' : 'Publish Announcement'}
                      </button>
                    </form>
                  </div>

                  {/* Targeted Acknowledgment Tracker */}
                  <div style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)', padding: 20, borderRadius: 12 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-tertiary)', marginBottom: 12, fontWeight: 700 }}>
                      Kiosk Acknowledgment Tracker
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 180, overflowY: 'auto' }}>
                      {broadcasts.filter(b => b.classroom_id).length === 0 ? (
                        <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                          No targeted broadcasts sent.
                        </div>
                      ) : (
                        broadcasts.filter(b => b.classroom_id).map(b => {
                          const targetRoom = activeClassrooms.find(c => String(c.classroomId) === String(b.classroom_id));
                          const isAcked = acknowledgments[`${b.id}_${b.classroom_id}`];
                          
                          return (
                            <div key={b.id} style={{ fontSize: 12, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <strong style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%' }}>
                                  {b.title}
                                </strong>
                                {isAcked ? (
                                  <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: 9 }}>
                                    🟢 ACK
                                  </span>
                                ) : (
                                  <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: 9 }}>
                                    🔴 PENDING
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                                <span>Room {targetRoom ? targetRoom.roomNo : b.classroom_id}</span>
                                <span>{new Date(b.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
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

                {/* Right: Recent Audit logs & Online Smartboards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
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

                  {/* Connected Smartboards Status List */}
                  <div style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)', padding: 16, borderRadius: 12 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-tertiary)', marginBottom: 12, fontWeight: 700 }}>
                      Connected Smartboard Kiosks
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {onlineKiosks.length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>No smartboard terminals currently online.</div>
                      ) : (
                        onlineKiosks.map(kiosk => (
                          <div key={kiosk.classroomId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-base)' }}>
                            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>Room {kiosk.roomNo || kiosk.classroomId}</span>
                            <span style={{ fontSize: 10, color: '#10b981', fontWeight: 600 }}>● Online</span>
                          </div>
                        ))
                      )}
                    </div>
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
      {resolvingIncident && (
        <IncidentResolveModal 
          incident={resolvingIncident} 
          onClose={() => setResolvingIncident(null)} 
          onSave={loadDashboardData} 
        />
      )}
    </div>
  );
}
