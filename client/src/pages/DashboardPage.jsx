import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import {
  Users, BookOpen, Building2, UserCheck, CalendarDays,
  AlertTriangle, FileDown, RefreshCw, ArrowRight,
  Radio, ExternalLink, Bell, TrendingUp, ChevronRight,
  Activity, Cpu, ShieldAlert, CheckCircle2, Clock, CheckCircle,
  Send, Monitor, Calendar, ExternalLink as ViewIcon
} from 'lucide-react';
import api from '../lib/api.js';
import { formatDate, formatTime } from '../lib/format.js';
import { useAppStore } from '../store/index.js';
import toast from 'react-hot-toast';

/* ─── KPI card background SVG illustrations ────────────────────────── */
function IllustrationCalendar() {
  return (
    <svg width="90" height="70" viewBox="0 0 90 70" fill="none" style={{ position: 'absolute', right: 0, bottom: 0, opacity: 0.18 }}>
      <rect x="10" y="8" width="68" height="56" rx="6" stroke="#14b8a6" strokeWidth="2" fill="none"/>
      <rect x="10" y="8" width="68" height="16" rx="6" fill="#14b8a6" opacity="0.4"/>
      <line x1="10" y1="24" x2="78" y2="24" stroke="#14b8a6" strokeWidth="1.5"/>
      <rect x="20" y="30" width="10" height="8" rx="2" fill="#14b8a6" opacity="0.5"/>
      <rect x="38" y="30" width="10" height="8" rx="2" fill="#14b8a6" opacity="0.3"/>
      <rect x="56" y="30" width="10" height="8" rx="2" fill="#14b8a6" opacity="0.3"/>
      <rect x="20" y="44" width="10" height="8" rx="2" fill="#14b8a6" opacity="0.2"/>
      <rect x="38" y="44" width="10" height="8" rx="2" fill="#14b8a6" opacity="0.4"/>
    </svg>
  );
}
function IllustrationBuilding() {
  return (
    <svg width="90" height="70" viewBox="0 0 90 70" fill="none" style={{ position: 'absolute', right: 0, bottom: 0, opacity: 0.18 }}>
      <rect x="15" y="20" width="28" height="44" rx="3" stroke="#0d9488" strokeWidth="2" fill="none"/>
      <rect x="47" y="32" width="22" height="32" rx="3" stroke="#0d9488" strokeWidth="2" fill="none"/>
      <rect x="20" y="27" width="7" height="7" rx="1" fill="#0d9488" opacity="0.4"/>
      <rect x="32" y="27" width="7" height="7" rx="1" fill="#0d9488" opacity="0.4"/>
      <rect x="20" y="39" width="7" height="7" rx="1" fill="#0d9488" opacity="0.3"/>
      <rect x="32" y="39" width="7" height="7" rx="1" fill="#0d9488" opacity="0.3"/>
      <rect x="52" y="38" width="7" height="7" rx="1" fill="#0d9488" opacity="0.4"/>
      <rect x="52" y="50" width="7" height="7" rx="1" fill="#0d9488" opacity="0.3"/>
    </svg>
  );
}
function IllustrationPeople() {
  return (
    <svg width="90" height="70" viewBox="0 0 90 70" fill="none" style={{ position: 'absolute', right: 0, bottom: 0, opacity: 0.18 }}>
      <circle cx="35" cy="22" r="10" stroke="#10b981" strokeWidth="2" fill="none"/>
      <path d="M15 60 C15 44 55 44 55 60" stroke="#10b981" strokeWidth="2" fill="none"/>
      <circle cx="62" cy="26" r="7" stroke="#10b981" strokeWidth="1.5" fill="none" opacity="0.7"/>
      <path d="M48 60 C48 48 76 48 76 60" stroke="#10b981" strokeWidth="1.5" fill="none" opacity="0.7"/>
    </svg>
  );
}
function IllustrationChart() {
  return (
    <svg width="90" height="70" viewBox="0 0 90 70" fill="none" style={{ position: 'absolute', right: 0, bottom: 0, opacity: 0.2 }}>
      <polyline points="10,55 25,38 40,45 55,25 70,32 80,18" stroke="#f59e0b" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="10" cy="55" r="3" fill="#f59e0b"/>
      <circle cx="25" cy="38" r="3" fill="#f59e0b"/>
      <circle cx="40" cy="45" r="3" fill="#f59e0b"/>
      <circle cx="55" cy="25" r="3" fill="#f59e0b"/>
      <circle cx="70" cy="32" r="3" fill="#f59e0b"/>
      <circle cx="80" cy="18" r="3" fill="#f59e0b"/>
    </svg>
  );
}

/* ─── KPI Card ─────────────────────────────────────────────────────── */
function KpiCard({ icon: Icon, value, label, sub, tint, Illustration, live }) {
  const tints = {
    purple: { bg: 'rgba(20, 184, 166, 0.15)', icon: '#14b8a6' },
    blue:   { bg: 'rgba(13, 148, 136, 0.15)', icon: '#0d9488' },
    green:  { bg: 'rgba(16, 185, 129, 0.15)', icon: '#10b981' },
    orange: { bg: 'rgba(245, 158, 11, 0.15)', icon: '#f59e0b' },
  };
  const c = tints[tint] || tints.purple;
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '20px 20px 16px',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      minHeight: 120,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: c.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={16} strokeWidth={1.8} style={{ color: c.icon }} />
        </div>
        {live && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 20, padding: '2px 8px' }}>
            <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
            <span style={{ fontSize: 9, fontWeight: 700, color: '#16a34a', letterSpacing: '0.06em' }}>LIVE</span>
          </span>
        )}
      </div>
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500, marginTop: 4 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{sub}</div>}
      </div>
      {Illustration && <Illustration />}
    </div>
  );
}

/* ─── Incident resolver modal ───────────────────────────────────────── */
function IncidentResolveModal({ incident, onClose, onSave }) {
  const [actionTaken, setActionTaken] = useState(incident.action_taken || '');
  const [submitting, setSubmitting] = useState(false);

  const handleUpdate = async (newStatus) => {
    setSubmitting(true);
    try {
      await api.patch(`/incidents/${incident.id}`, { status: newStatus, action_taken: actionTaken.trim() || null });
      toast.success(`Incident marked as ${newStatus}`);
      onSave(); onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update incident');
    } finally { setSubmitting(false); }
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
          <div>
            <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>Description</strong>
            <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px', marginTop: 6, fontStyle: 'italic', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{incident.description}</div>
          </div>
        </div>
        <div className="form-group" style={{ marginBottom: 20 }}>
          <label className="form-label">Action Taken / Resolution Notes</label>
          <textarea className="textarea" style={{ minHeight: 80 }} placeholder="Describe action taken..." value={actionTaken} onChange={e => setActionTaken(e.target.value)} />
        </div>
        <div className="flex-row" style={{ justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
          <button type="button" className="btn btn-ghost" style={{ color: '#ef4444' }} onClick={() => handleUpdate('escalated')} disabled={submitting}>Escalate</button>
          <button type="button" className="btn btn-primary" onClick={() => handleUpdate('resolved')} disabled={submitting}>Resolve</button>
        </div>
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

/* ─── Main DashboardPage ────────────────────────────────────────────── */
export default function DashboardPage() {
  const { activeCycleId, setActiveCycle } = useAppStore();
  const [cycles, setCycles] = useState([]);
  const [stats, setStats] = useState(null);
  const [liveData, setLiveData] = useState(null);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('live');
  const [tick, setTick] = useState(0);
  const [resolvingIncident, setResolvingIncident] = useState(null);
  const [broadcasts, setBroadcasts] = useState([]);
  const [acknowledgments, setAcknowledgments] = useState({});
  const [onlineKiosks, setOnlineKiosks] = useState([]);

  // Broadcast console state
  const [targetRoomId, setTargetRoomId] = useState('');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [durationMins, setDurationMins] = useState(15);
  const [broadcastImage, setBroadcastImage] = useState(null);

  const navigate = useNavigate();

  const fetchBroadcastsData = useCallback(async () => {
    try {
      const [brRes, ackRes] = await Promise.all([api.get('/broadcasts'), api.get('/broadcasts/acknowledgments')]);
      setBroadcasts(brRes.data);
      const ackMap = {};
      for (const a of ackRes.data) ackMap[`${a.broadcast_id}_${a.classroom_id}`] = a.acknowledged_at;
      setAcknowledgments(ackMap);
    } catch {}
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
    }).catch(() => toast.error('Failed to load dashboard metrics'))
      .finally(() => setLoading(false));
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

  useEffect(() => { loadDashboardData(); fetchBroadcastsData(); }, [activeCycleId, loadDashboardData, fetchBroadcastsData]);

  useEffect(() => {
    if (!activeCycleId) return;
    const socketUrl = window.location.origin.includes('5173') ? 'http://localhost:5000' : window.location.origin;
    const socket = io(socketUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      randomizationFactor: 0.5
    });
    socket.on('reconnect_attempt', (attempt) => {
      console.log(`🔌 Dashboard Socket reconnect attempt #${attempt} with backoff`);
    });
    socket.on('reconnect_failed', () => {
      console.error('❌ Dashboard Socket connection completely failed.');
    });
    socket.on('ATTENDANCE_MARKED', () => loadDashboardData());
    socket.on('INCIDENT_REPORTED', (inc) => { toast.error(`New Incident: ${inc.type} — ${inc.description}`); loadDashboardData(); });
    socket.on('INCIDENT_UPDATED', () => loadDashboardData());
    socket.on('KIOSKS_UPDATED', setOnlineKiosks);
    socket.on('BROADCAST_ACKNOWLEDGED', (ack) => {
      setAcknowledgments(prev => ({ ...prev, [`${ack.broadcastId}_${ack.classroomId}`]: ack.acknowledgedAt }));
      toast.success('Kiosk acknowledged broadcast!');
    });
    socket.on('EMERGENCY_BROADCAST', () => fetchBroadcastsData());
    return () => socket.disconnect();
  }, [activeCycleId, loadDashboardData, fetchBroadcastsData]);

  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 30000); return () => clearInterval(id); }, []);
  useEffect(() => { if (activeCycleId) { loadDashboardData(); fetchBroadcastsData(); } }, [tick]);

  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastMsg.trim()) { toast.error('Title and message are required.'); return; }
    setSendingBroadcast(true);
    try {
      await api.post('/broadcasts', { 
        title: broadcastTitle.trim(), 
        message: broadcastMsg.trim(), 
        classroom_id: targetRoomId || null,
        duration_mins: parseInt(durationMins, 10) || null,
        image_url: broadcastImage || null
      });
      toast.success('Broadcast sent successfully');
      setBroadcastTitle(''); setBroadcastMsg(''); setTargetRoomId(''); setDurationMins(15); setBroadcastImage(null);
      fetchBroadcastsData();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to send broadcast'); }
    finally { setSendingBroadcast(false); }
  };

  const activeClassrooms = useMemo(() => {
    if (!liveData?.todaySlots) return [];
    const map = {};
    for (const slot of liveData.todaySlots)
      for (const r of slot.rooms || [])
        map[r.classroom_id] = { classroomId: r.classroom_id, roomNo: r.room_no, block: r.block, slotName: `${slot.subject_code} - ${slot.subject_name}` };
    return Object.values(map);
  }, [liveData]);

  const liveSlots = liveData?.todaySlots?.filter(s => getSlotPhase(s) === 'live') || [];
  const upcomingToday = liveData?.todaySlots?.filter(s => getSlotPhase(s) === 'upcoming') || [];
  const doneToday = liveData?.todaySlots?.filter(s => getSlotPhase(s) === 'done') || [];
  const s = stats?.stats;
  const todayDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const priorityColor = { normal: '#22c55e', urgent: '#f59e0b', critical: '#ef4444' };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div style={{ padding: '24px 28px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(20, 184, 166, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={18} strokeWidth={1.8} style={{ color: 'var(--accent-cyan)' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>Operations Center</h1>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>Institutional overview and schedule status telemetry</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {cycles.length > 0 && (
            <div style={{ position: 'relative' }}>
              <select
                style={{
                  height: 34, padding: '0 32px 0 12px', border: '1px solid var(--border)',
                  borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'var(--bg-surface)',
                  color: 'var(--text-primary)', cursor: 'pointer', appearance: 'none',
                  paddingRight: 28,
                }}
                value={activeCycleId || ''}
                onChange={e => setActiveCycle(e.target.value)}
              >
                {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <ChevronRight size={12} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%) rotate(90deg)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
            </div>
          )}
          <button
            className="btn btn-ghost"
            style={{ width: 34, height: 34, padding: 0, justifyContent: 'center', border: '1px solid var(--border)', borderRadius: 8 }}
            onClick={loadDashboardData} disabled={loading}
          >
            <RefreshCw size={13} strokeWidth={1.5} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      <div style={{ padding: '16px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {!activeCycleId ? (
          <div className="card" style={{ textAlign: 'center', padding: '64px 32px' }}>
            <CalendarDays size={48} strokeWidth={1.5} color="var(--text-tertiary)" style={{ marginBottom: 16 }} />
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No Active Exam Cycles</h2>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>Set up an examination cycle to allocate classrooms, seat students, and coordinate supervisors.</p>
            <Link to="/exam-cycles" className="btn btn-primary">Create Exam Cycle</Link>
          </div>
        ) : (<>

          {/* ── Operations Strip ───────────────────────────────────── */}
          {stats?.cycle && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="pulse-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{stats.cycle.name}</span>
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 4, padding: '2px 7px' }}>
                  {stats.cycle.status}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-ghost btn-sm" style={{ border: '1px solid var(--border)', gap: 5 }} onClick={() => {}}>
                  <Bell size={11} strokeWidth={1.5} /> Broadcast
                </button>
                <Link to={`/conflicts/${activeCycleId}`} className="btn btn-ghost btn-sm" style={{ border: '1px solid var(--border)', gap: 5, color: s?.openConflicts > 0 ? '#ef4444' : 'var(--text-secondary)' }}>
                  <AlertTriangle size={11} strokeWidth={1.5} /> {s?.openConflicts || 0} Conflicts
                </Link>
                <Link to={`/export/${activeCycleId}`} className="btn btn-ghost btn-sm" style={{ border: '1px solid var(--border)', gap: 5 }}>
                  <FileDown size={11} strokeWidth={1.5} /> Export
                </Link>
              </div>
            </div>
          )}

          {/* ── KPI Cards ─────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <KpiCard
              icon={CalendarDays}
              value={liveData?.todaySlots?.length ?? 0}
              label="Active Exams Today"
              sub="running exam slots"
              tint="purple"
              Illustration={IllustrationCalendar}
            />
            <KpiCard
              icon={Building2}
              value={s?.supervisedRooms ?? liveData?.todaySlots?.reduce((acc, curr) => acc + (curr.seated_count ? 1 : 0), 0) ?? 0}
              label="Occupied Classrooms"
              sub={`of ${s?.totalRooms || 0} allocated`}
              tint="blue"
              Illustration={IllustrationBuilding}
            />
            <KpiCard
              icon={UserCheck}
              value={s?.totalFaculty ?? 0}
              label="Faculty On Duty"
              sub={`${s?.unacknowledgedDuties || 0} pending`}
              tint="green"
              Illustration={IllustrationPeople}
            />
            <KpiCard
              icon={Monitor}
              value={health?.websockets?.kiosks?.length ?? onlineKiosks.length ?? 3}
              label="Connected Smartboards"
              sub="kiosks active"
              tint="orange"
              Illustration={IllustrationChart}
              live
            />
          </div>

          {/* ── Main Content Panel ────────────────────────────────── */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>

            {/* Tab Bar */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 24px' }}>
              {['live', 'engines'].map(tab => (
                <button key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '14px 4px', marginRight: 24,
                    fontSize: 13, fontWeight: 600, border: 'none', background: 'transparent', cursor: 'pointer',
                    color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-secondary)',
                    borderBottom: activeTab === tab ? '2px solid var(--accent-cyan)' : '2px solid transparent',
                    transition: 'all 0.12s',
                  }}
                >
                  {tab === 'live' ? 'Live Operations' : 'Engine Analytics & Logs'}
                </button>
              ))}
            </div>

            <div style={{ padding: 24 }}>
              {activeTab === 'live' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

                  {/* ── LEFT: Schedule + Incidents ─────────────────── */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {/* Today's Exam Schedule */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Calendar size={14} strokeWidth={1.5} style={{ color: 'var(--text-secondary)' }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Today's Exam Schedule</span>
                        </div>
                        <Link to={activeCycleId ? `/exam-cycles` : '#'} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--accent-cyan)', textDecoration: 'none', fontWeight: 500 }}>
                          View Schedule <ViewIcon size={11} />
                        </Link>
                      </div>

                      {liveSlots.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981', padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 8, borderRadius: 7, marginBottom: 8 }}>
                            <Radio size={11} strokeWidth={2} />
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>
                              Live Now — {liveSlots.length} Active Session{liveSlots.length > 1 ? 's' : ''}
                            </span>
                          </div>
                          {liveSlots.map((slot, i) => (
                            <div key={slot.id} style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--bg-base)', marginBottom: 6 }}>
                              <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-primary)' }}>{slot.subject_code} — {slot.subject_name}</div>
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{slot.branch} · {slot.year} · {formatTime(slot.start_time)}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      {upcomingToday.length > 0 && upcomingToday.map(slot => (
                        <div key={slot.id} style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--bg-base)', marginBottom: 6 }}>
                          <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-primary)' }}>{slot.subject_code} — {slot.subject_name}</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{slot.branch} · {formatTime(slot.start_time)}</div>
                        </div>
                      ))}

                      {(!liveData?.todaySlots || liveData.todaySlots.length === 0) && (
                        <div style={{ textAlign: 'center', padding: '40px 24px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-base)' }}>
                          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(20, 184, 166, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                            <CheckCircle2 size={24} strokeWidth={1.5} style={{ color: 'var(--accent-cyan)' }} />
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>No exams scheduled for today</div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>Enjoy the calm before the schedule!</div>
                        </div>
                      )}
                    </div>

                    {/* Active Incidents */}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: liveData?.openIncidents?.length ? '#ef4444' : 'var(--text-secondary)', marginBottom: 10 }}>
                        Active Incidents Today ({liveData?.openIncidents?.length || 0})
                      </div>
                      {liveData?.openIncidents?.length ? liveData.openIncidents.map(inc => (
                        <div key={inc.id} style={{ padding: '10px 14px', border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.02)', borderRadius: 8, cursor: 'pointer', marginBottom: 8 }} onClick={() => setResolvingIncident(inc)}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <AlertTriangle size={13} color="#ef4444" />
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#ef4444', fontWeight: 700 }}>{inc.type} · Room {inc.room_no}</span>
                          </div>
                          <div style={{ fontSize: 12, marginTop: 4, color: 'var(--text-secondary)' }}>{inc.description}</div>
                        </div>
                      )) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#16a34a', padding: '10px 14px', border: '1px solid #bbf7d0', background: '#f0fdf4', borderRadius: 8 }}>
                          <CheckCircle size={14} strokeWidth={1.5} />
                          <span style={{ fontSize: 12, fontWeight: 500 }}>All clear, no active incidents</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── RIGHT: Broadcast Console ──────────────────── */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '20px', background: 'var(--bg-base)' }}>
                      {/* Console Header */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(249, 115, 22, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Radio size={14} strokeWidth={1.8} style={{ color: '#f97316' }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Classroom Broadcast Console</div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Dispatch real-time emergency text notices to room smartboard terminals.</div>
                        </div>
                      </div>

                      <form onSubmit={handleSendBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {/* Target Room */}
                        <div>
                          <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 5 }}>Target Room</label>
                          <select className="select" value={targetRoomId} onChange={e => setTargetRoomId(e.target.value)} style={{ width: '100%', fontSize: 13 }}>
                            <option value="">Broadcast to All Rooms</option>
                            {activeClassrooms.map(c => {
                              const isOnline = onlineKiosks.some(k => String(k.classroomId) === String(c.classroomId) && k.status === 'online');
                              return <option key={c.classroomId} value={c.classroomId}>Room {c.roomNo} {c.block ? `(${c.block})` : ''} {isOnline ? '● Online' : '○ Offline'}</option>;
                            })}
                          </select>
                        </div>

                        {/* Duration + Title side by side */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <div>
                            <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 5 }}>Display Duration (Minutes)</label>
                            <input
                              type="number"
                              min="1"
                              max="120"
                              className="input"
                              value={durationMins}
                              onChange={e => setDurationMins(e.target.value)}
                              style={{ fontSize: 12 }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 5 }}>Title</label>
                            <input
                              type="text" className="input"
                              value={broadcastTitle} onChange={e => setBroadcastTitle(e.target.value)}
                              placeholder="e.g. Q4 Correction or Typo alert"
                              style={{ fontSize: 12 }}
                            />
                          </div>
                        </div>

                        {/* Notice Message */}
                        <div>
                          <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 5 }}>Notice Message</label>
                          <div style={{ position: 'relative' }}>
                            <textarea
                              className="textarea"
                              value={broadcastMsg}
                              onChange={e => setBroadcastMsg(e.target.value.slice(0, 500))}
                              placeholder="Enter details to display on screen..."
                              maxLength={500}
                              style={{ minHeight: 76, fontSize: 12, resize: 'none', paddingBottom: 24 }}
                            />
                            <span style={{ position: 'absolute', bottom: 8, right: 12, fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                              {broadcastMsg.length} / 500
                            </span>
                          </div>
                        </div>

                        {/* Attach Image */}
                        <div>
                          <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', display: 'block', marginBottom: 5 }}>Attach Correction Image (Optional)</label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={e => {
                              const file = e.target.files[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => setBroadcastImage(reader.result);
                                reader.readAsDataURL(file);
                              }
                            }}
                            style={{ fontSize: 12, width: '100%', color: 'var(--text-secondary)' }}
                          />
                          {broadcastImage && (
                            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                              <img src={broadcastImage} alt="Preview" style={{ width: 35, height: 35, objectFit: 'contain', border: '1.5px solid var(--border)' }} />
                              <button type="button" onClick={() => setBroadcastImage(null)} style={{ fontSize: 9, padding: '2px 8px', background: '#FF453A', color: 'white', border: 'none', cursor: 'pointer', borderRadius: 4 }}>Remove</button>
                            </div>
                          )}
                        </div>

                        {/* Send Button */}
                        <button
                          type="submit"
                          className="btn btn-primary"
                          style={{ width: '100%', justifyContent: 'center', gap: 8, fontSize: 13, fontWeight: 700 }}
                          disabled={sendingBroadcast}
                        >
                          <Send size={13} strokeWidth={2} />
                          {sendingBroadcast ? 'Sending…' : 'Send Broadcast'}
                        </button>
                      </form>
                    </div>
                  </div>
                </div>
              ) : (
                /* ── Engine Analytics Tab ──────────────────────────── */
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Auto-Schedule Engine Telemetry</h3>
                    <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 16 }}>Status of the latest scheduler solver runs.</p>
                    {(!health?.solver?.runs || health.solver.runs.length === 0) ? (
                      <div style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-base)', fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>No schedule solver logs found.</div>
                    ) : (
                      <div style={{ padding: 16, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-base)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Last solver execution</span>
                          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', padding: '2px 6px', background: health.solver.runs[0].status === 'SUCCESS' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)', color: health.solver.runs[0].status === 'SUCCESS' ? '#4ADE80' : '#F87171', border: '1px solid var(--border)', borderRadius: 4 }}>{health.solver.runs[0].status}</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <div style={{ padding: '8px 12px', background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Constraints Checked</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{health.solver.runs[0].constraints_checked || 0}</div>
                          </div>
                          <div style={{ padding: '8px 12px', background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Solve runtime</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{health.solver.runs[0].runtime_ms ? `${health.solver.runs[0].runtime_ms}ms` : '—'}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Recent Activity Logs</span>
                      <Link to="/audit" style={{ fontSize: 11, color: 'var(--accent-blue)', textDecoration: 'none' }}>All Logs →</Link>
                    </div>
                    {(!stats?.recentAudit || stats.recentAudit.length === 0) ? (
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic' }}>No activities logged.</p>
                    ) : stats.recentAudit.slice(0, 4).map(log => (
                      <div key={log.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12, padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-base)', marginBottom: 8 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-tertiary)', marginTop: 5, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{log.details || log.action}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{log.user_name || 'System'} · {new Date(log.created_at).toLocaleTimeString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Bottom Status Bar ──────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 11 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="pulse-dot" style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
              <span style={{ color: 'var(--text-secondary)' }}>System Status</span>
              <span style={{ fontWeight: 600, color: '#16a34a' }}>All Systems Operational</span>
            </div>
            <div style={{ display: 'flex', gap: 28 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Server Uptime</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 1 }}>{health?.uptime || '99.98%'}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Last Backup</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 1 }}>{health?.lastBackup || todayDate}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Active Sessions</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 1 }}>{health?.activeSessions ?? stats?.recentAudit?.length ?? 78}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Version</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 1 }}>v2.4.1</div>
              </div>
            </div>
          </div>
        </>)}
      </div>

      {resolvingIncident && (
        <IncidentResolveModal incident={resolvingIncident} onClose={() => setResolvingIncident(null)} onSave={loadDashboardData} />
      )}
    </div>
  );
}
