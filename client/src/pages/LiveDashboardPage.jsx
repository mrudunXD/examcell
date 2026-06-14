import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import {
  Activity, AlertTriangle, CheckCircle, Clock, Users, Shield,
  Zap, RefreshCw, ChevronRight, Eye, Radio
} from 'lucide-react';
import api from '../lib/api.js';
import { formatDate, formatTime, formatDateTime } from '../lib/format.js';
import toast from 'react-hot-toast';

function statusColor(slot) {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  if (!slot.date || slot.date !== today) return '#525252';
  const [h, m] = slot.start_time.split(':').map(Number);
  const start = new Date(); start.setHours(h, m, 0);
  const end = new Date(start.getTime() + slot.duration_mins * 60000);
  if (now < start) return '#1d4ed8';     // upcoming
  if (now >= start && now <= end) return '#166534';  // live
  return '#525252';                                   // done
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 4, background: '#E5E5E0', position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: pct > 75 ? '#166534' : pct > 40 ? '#92400e' : '#CC0000', transition: 'width 0.5s' }} />
      </div>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, minWidth: 36 }}>{pct}%</span>
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
      <div className="modal">
        <h2 className="modal-title" style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={20} /> Resolve Exam Incident
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: '12px 0 20px 0', fontSize: 13, borderBottom: '1px solid #E5E5E0', paddingBottom: 16 }}>
          <div className="grid-2">
            <div>
              <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', color: 'var(--np-n500)' }}>Type</strong>
              <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>{incident.type}</div>
            </div>
            <div>
              <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', color: 'var(--np-n500)' }}>Room</strong>
              <div style={{ fontWeight: 600 }}>{incident.room_no}</div>
            </div>
          </div>
          <div className="grid-2">
            <div>
              <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', color: 'var(--np-n500)' }}>Severity</strong>
              <div style={{ fontWeight: 600, textTransform: 'capitalize', color: incident.severity === 'high' ? '#dc2626' : incident.severity === 'medium' ? '#b45309' : '#16a34a' }}>{incident.severity}</div>
            </div>
            <div>
              <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', color: 'var(--np-n500)' }}>Reported By</strong>
              <div>{incident.reported_by_name}</div>
            </div>
          </div>
          {incident.student_prn && (
            <div>
              <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', color: 'var(--np-n500)' }}>Student PRN</strong>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{incident.student_prn}</div>
            </div>
          )}
          <div>
            <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', color: 'var(--np-n500)' }}>Incident Description</strong>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: 10, marginTop: 4, fontStyle: 'italic', color: '#334155' }}>
              {incident.description}
            </div>
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 20 }}>
          <label className="form-label">Action Taken / Resolution Notes</label>
          <textarea 
            className="input" 
            style={{ minHeight: 80, resize: 'vertical' }}
            placeholder="Describe action taken by the Exam Cell..." 
            value={actionTaken} 
            onChange={e => setActionTaken(e.target.value)}
          />
        </div>

        <div className="flex-row" style={{ justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid #E5E5E0' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>Close</button>
          <button type="button" className="btn btn-warning" onClick={() => handleUpdate('escalated')} disabled={submitting}>
            Escalate
          </button>
          <button type="button" className="btn btn-success" onClick={() => handleUpdate('resolved')} disabled={submitting}>
            Resolve Incident
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LiveDashboardPage() {
  const [cycles, setCycles] = useState([]);
  const [selectedCycle, setSelectedCycle] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [tick, setTick] = useState(0);
  const [resolvingIncident, setResolvingIncident] = useState(null);
  const navigate = useNavigate();

  // Option 2 Targeted announcements state
  const [broadcasts, setBroadcasts] = useState([]);
  const [acknowledgments, setAcknowledgments] = useState({});
  const [onlineKiosks, setOnlineKiosks] = useState([]);
  
  // Composer Form state
  const [targetRoomId, setTargetRoomId] = useState('');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastPriority, setBroadcastPriority] = useState('normal');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  useEffect(() => {
    api.get('/exam-cycles').then(r => {
      const active = r.data.find(c => c.status === 'active') || r.data[0];
      setCycles(r.data);
      if (active) setSelectedCycle(active.id);
    });
  }, []);

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

  const fetchLive = useCallback(async (cycleId) => {
    if (!cycleId) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/analytics/live/${cycleId}`);
      setData(data);
      setLastRefresh(new Date());
    } catch { toast.error('Failed to load live data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (selectedCycle) {
      fetchLive(selectedCycle);
      fetchBroadcastsData();
    }
  }, [selectedCycle, fetchLive, fetchBroadcastsData]);

  // WebSocket live synchronization
  useEffect(() => {
    if (!selectedCycle) return;

    const socketUrl = window.location.origin.includes('5173')
      ? 'http://localhost:5000'
      : window.location.origin;

    console.log(`Connecting LiveDashboard to WebSocket server at: ${socketUrl}`);
    const socket = io(socketUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('📡 LiveDashboard WebSocket connected successfully');
    });

    socket.on('disconnect', () => {
      console.warn('🔌 LiveDashboard WebSocket disconnected');
    });

    // Listen for events
    socket.on('ATTENDANCE_MARKED', (data) => {
      console.log('📣 WebSocket ATTENDANCE_MARKED received:', data);
      fetchLive(selectedCycle);
    });

    socket.on('INCIDENT_REPORTED', (incident) => {
      console.log('📣 WebSocket INCIDENT_REPORTED received:', incident);
      toast.error(`New Incident: ${incident.type} severity ${incident.severity} - ${incident.description}`);
      fetchLive(selectedCycle);
    });

    socket.on('INCIDENT_UPDATED', (incident) => {
      console.log('📣 WebSocket INCIDENT_UPDATED received:', incident);
      fetchLive(selectedCycle);
    });

    socket.on('KIOSKS_UPDATED', (kioskList) => {
      console.log('📣 WebSocket KIOSKS_UPDATED received:', kioskList);
      setOnlineKiosks(kioskList);
    });

    socket.on('BROADCAST_ACKNOWLEDGED', (ack) => {
      console.log('📣 WebSocket BROADCAST_ACKNOWLEDGED received:', ack);
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
  }, [selectedCycle, fetchLive, fetchBroadcastsData]);

  // Auto-refresh every 30s
  useEffect(() => {
    const id = setInterval(() => { setTick(t => t + 1); }, 30000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { if (selectedCycle) fetchLive(selectedCycle); }, [tick]);

  // Clock
  const [now, setNow] = useState(new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);

  // Compute active classrooms for today
  const activeClassrooms = useMemo(() => {
    if (!data?.todaySlots) return [];
    const roomsMap = {};
    for (const slot of data.todaySlots) {
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
  }, [data]);

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

  const liveSlots = data?.todaySlots?.filter(s => getSlotPhase(s) === 'live') || [];
  const upcomingToday = data?.todaySlots?.filter(s => getSlotPhase(s) === 'upcoming') || [];
  const doneToday = data?.todaySlots?.filter(s => getSlotPhase(s) === 'done') || [];

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="accent-bar" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 className="page-title">Live Dashboard</h1>
            {liveSlots.length > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#166534', color: '#FFF', padding: '3px 10px', fontSize: 10, fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>
                <Radio size={10} strokeWidth={2} style={{ animation: 'pulse 1.5s infinite' }} />
                {liveSlots.length} LIVE
              </span>
            )}
          </div>
          <p className="page-subtitle">
            {now.toLocaleDateString('en-IN', { weekday: 'long' })}, {formatDate(now)} ·{' '}
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
              {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
            </span>
          </p>
        </div>
        <div className="flex-row" style={{ gap: 8 }}>
          <select
            className="select"
            value={selectedCycle || ''}
            onChange={e => setSelectedCycle(e.target.value)}
            style={{ fontSize: 12, padding: '6px 10px' }}
          >
            {cycles.map(c => <option key={c.id} value={c.id}>{c.name} ({c.status})</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={() => fetchLive(selectedCycle)} disabled={loading}>
            <RefreshCw size={12} strokeWidth={1.5} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
          </button>
          <button
            className="btn btn-primary btn-sm"
            style={{ fontSize: 11, padding: '6px 12px' }}
            onClick={() => window.open(`/kiosk/${selectedCycle}`, '_blank')}
            disabled={!selectedCycle}
          >
            Launch Kiosk
          </button>
        </div>
      </div>

      {/* Quick stats */}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0, border: '1px solid #111', marginBottom: 24 }}>
          {[
            { label: "Today's Exams", value: data.todaySlots?.length || 0, icon: Activity, color: '#111' },
            { label: 'Currently Live', value: liveSlots.length, icon: Radio, color: liveSlots.length ? '#166534' : '#A3A3A3' },
            { label: 'Open Incidents', value: data.openIncidents?.length || 0, icon: AlertTriangle, color: data.openIncidents?.length ? '#CC0000' : '#A3A3A3' },
            { label: 'Next Exam Days', value: data.upcomingSlots?.length || 0, icon: Clock, color: '#1d4ed8' },
          ].map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={s.label} style={{ padding: '16px 20px', borderRight: i < 3 ? '1px solid #E5E5E0' : 'none', display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ color: s.color, flexShrink: 0 }}><Icon size={20} strokeWidth={1.5} /></div>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: s.color, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--np-n500)', marginTop: 3 }}>{s.label}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
        {/* Main: Today's exams */}
        <div>
          {/* Live now */}
          {liveSlots.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ background: '#166534', color: '#FFF', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 0 }}>
                <Radio size={12} strokeWidth={2} style={{ animation: 'pulse 1.5s infinite' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                  Live Now — {liveSlots.length} Exam{liveSlots.length > 1 ? 's' : ''} in Progress
                </span>
              </div>
              <div style={{ border: '2px solid #166534', borderTop: 'none' }}>
                {liveSlots.map((slot, i) => (
                  <SlotCard key={slot.id} slot={slot} phase="live" isLast={i === liveSlots.length - 1} navigate={navigate} />
                ))}
              </div>
            </div>
          )}

          {/* Upcoming today */}
          {upcomingToday.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#1d4ed8', borderBottom: '1px solid #BFDBFE', paddingBottom: 6, marginBottom: 0 }}>
                Upcoming Today ({upcomingToday.length})
              </div>
              <div style={{ border: '1px solid #BFDBFE', borderTop: 'none' }}>
                {upcomingToday.map((slot, i) => (
                  <SlotCard key={slot.id} slot={slot} phase="upcoming" isLast={i === upcomingToday.length - 1} navigate={navigate} />
                ))}
              </div>
            </div>
          )}

          {/* Done */}
          {doneToday.length > 0 && (
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--np-n400)', borderBottom: '1px solid #E5E5E0', paddingBottom: 6 }}>
                Completed Today ({doneToday.length})
              </div>
              <div style={{ border: '1px solid #E5E5E0', borderTop: 'none', opacity: 0.7 }}>
                {doneToday.map((slot, i) => (
                  <SlotCard key={slot.id} slot={slot} phase="done" isLast={i === doneToday.length - 1} navigate={navigate} />
                ))}
              </div>
            </div>
          )}

          {data && data.todaySlots?.length === 0 && (
            <div style={{ textAlign: 'center', padding: 48, border: '1px solid #E5E5E0', color: 'var(--np-n500)' }}>
              <Clock size={32} strokeWidth={1} style={{ opacity: 0.3, marginBottom: 12 }} />
              <div style={{ fontFamily: 'var(--font-body)', fontStyle: 'italic' }}>No exams scheduled for today</div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Upcoming days */}
          <div style={{ border: '1px solid #E5E5E0', padding: 16 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--np-n500)', marginBottom: 12 }}>Next Exam Days</div>
            {data?.upcomingSlots?.length ? data.upcomingSlots.map(d => (
              <div key={d.date} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #E5E5E0' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>{new Date(d.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short' })}, {formatDate(d.date)}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--np-n500)', marginTop: 2 }}>{d.subjects?.slice(0, 40)}{d.subjects?.length > 40 ? '…' : ''}</div>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700 }}>{d.slot_count}</span>
              </div>
            )) : <div style={{ fontFamily: 'var(--font-body)', fontStyle: 'italic', color: 'var(--np-n500)', fontSize: 13 }}>No upcoming exams</div>}
          </div>

          {/* Open incidents */}
          <div style={{ border: '1px solid #E5E5E0', padding: 16 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: data?.openIncidents?.length ? '#CC0000' : 'var(--np-n500)', marginBottom: 12 }}>
              Open Incidents
            </div>
            {data?.openIncidents?.length ? data.openIncidents.map(inc => (
              <div 
                key={inc.id} 
                style={{ 
                  padding: '10px', 
                  border: '1px solid #fecaca', 
                  background: '#fff5f5',
                  marginBottom: 8,
                  cursor: 'pointer',
                  transition: 'transform 0.1s, box-shadow 0.1s'
                }}
                onClick={() => setResolvingIncident(inc)}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(239, 68, 68, 0.1)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <AlertTriangle size={12} strokeWidth={1.5} color="#CC0000" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', color: '#CC0000', fontWeight: 700 }}>
                      {inc.type} · Room {inc.room_no}
                    </div>
                    <div style={{ fontSize: 12, marginTop: 2, color: '#111' }}>{inc.description.slice(0, 80)}{inc.description.length > 80 ? '…' : ''}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--np-n500)', marginTop: 4 }}>
                      by {inc.reported_by_name} · <span style={{ textTransform: 'uppercase', fontWeight: 600 }}>{inc.severity} severity</span>
                    </div>
                  </div>
                </div>
              </div>
            )) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#166534' }}>
                <CheckCircle size={14} strokeWidth={1.5} />
                <span style={{ fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: 13 }}>All clear, no incidents</span>
              </div>
            )}
          </div>

          {/* Classroom Broadcast Console */}
          <div style={{ border: '2px solid #111111', background: '#ffffff', padding: 16, boxShadow: '4px 4px 0 0 #111111' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--np-red)', fontWeight: 'bold', marginBottom: 12 }}>
              Classroom Broadcast Console
            </div>
            
            <form onSubmit={handleSendBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="form-group" style={{ marginBottom: 4 }}>
                <label className="form-label" style={{ fontSize: 9, textTransform: 'uppercase', color: 'var(--np-n600)', marginBottom: 2 }}>Target Classroom</label>
                <select
                  className="select"
                  value={targetRoomId}
                  onChange={e => setTargetRoomId(e.target.value)}
                  style={{ fontSize: 11, padding: '4px 6px', border: '1.5px solid #111111', width: '100%', outline: 'none' }}
                >
                  <option value="">Global Broadcast (All Rooms)</option>
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

              <div className="form-group" style={{ marginBottom: 4 }}>
                <label className="form-label" style={{ fontSize: 9, textTransform: 'uppercase', color: 'var(--np-n600)', marginBottom: 2 }}>Priority</label>
                <select
                  className="select"
                  value={broadcastPriority}
                  onChange={e => setBroadcastPriority(e.target.value)}
                  style={{ fontSize: 11, padding: '4px 6px', border: '1.5px solid #111111', width: '100%', outline: 'none' }}
                >
                  <option value="normal">Normal Priority</option>
                  <option value="urgent">Urgent Priority</option>
                  <option value="critical">Critical Priority</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 4 }}>
                <label className="form-label" style={{ fontSize: 9, textTransform: 'uppercase', color: 'var(--np-n600)', marginBottom: 2 }}>Title</label>
                <input
                  type="text"
                  className="input"
                  value={broadcastTitle}
                  onChange={e => setBroadcastTitle(e.target.value)}
                  placeholder="e.g. Q4 Page 2 Correction"
                  style={{ fontSize: 11, padding: '6px', border: '1.5px solid #111111', width: '100%', outline: 'none' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 4 }}>
                <label className="form-label" style={{ fontSize: 9, textTransform: 'uppercase', color: 'var(--np-n600)', marginBottom: 2 }}>Message</label>
                <textarea
                  className="input"
                  value={broadcastMsg}
                  onChange={e => setBroadcastMsg(e.target.value)}
                  placeholder="Enter correction details..."
                  style={{ minHeight: 50, fontSize: 11, padding: '6px', border: '1.5px solid #111111', width: '100%', outline: 'none', resize: 'vertical' }}
                />
              </div>

              <button
                type="submit"
                className="btn btn-danger btn-sm"
                style={{ fontSize: 10, fontWeight: 'bold', border: '2px solid #111111', boxShadow: '2px 2px 0 0 #111111', textTransform: 'uppercase', width: '100%', cursor: 'pointer', padding: '6px' }}
                disabled={sendingBroadcast}
              >
                {sendingBroadcast ? 'Sending...' : 'Publish Announcement'}
              </button>
            </form>
          </div>

          {/* Broadcast Acknowledgment status card */}
          <div style={{ border: '2px solid #111111', background: '#ffffff', padding: 16, boxShadow: '4px 4px 0 0 #111111' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--np-n500)', marginBottom: 12 }}>
              Targeted Acknowledgment Tracker
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 180, overflowY: 'auto' }} className="custom-scrollbar">
              {broadcasts.filter(b => b.classroom_id).length === 0 ? (
                <div style={{ fontSize: 11, fontStyle: 'italic', color: 'var(--np-n500)' }}>
                  No targeted broadcasts sent yet.
                </div>
              ) : (
                broadcasts.filter(b => b.classroom_id).map(b => {
                  const targetRoom = activeClassrooms.find(c => String(c.classroomId) === String(b.classroom_id));
                  const isAcked = acknowledgments[`${b.id}_${b.classroom_id}`];
                  
                  return (
                    <div key={b.id} style={{ fontSize: 11, borderBottom: '1px solid #E5E5E0', paddingBottom: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontFamily: 'var(--font-sans)', color: '#111111', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%' }}>
                          {b.title}
                        </strong>
                        {isAcked ? (
                          <span style={{ color: '#166534', fontWeight: 'bold', fontSize: 9, display: 'flex', alignItems: 'center', gap: 2 }}>
                            🟢 ACK
                          </span>
                        ) : (
                          <span style={{ color: '#CC0000', fontWeight: 'bold', fontSize: 9, display: 'flex', alignItems: 'center', gap: 2 }}>
                            🔴 UNACK
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--np-n500)', marginTop: 2, display: 'flex', justifyContent: 'space-between' }}>
                        <span>Room: {targetRoom ? targetRoom.roomNo : 'Room ' + b.classroom_id}</span>
                        <span>{new Date(b.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {lastRefresh && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--np-n400)', textAlign: 'center' }}>
              Auto-refreshes every 30s · Last: {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
            </div>
          )}
        </div>
      </div>
      {resolvingIncident && (
        <IncidentResolveModal 
          incident={resolvingIncident} 
          onClose={() => setResolvingIncident(null)} 
          onSave={() => fetchLive(selectedCycle)} 
        />
      )}
    </div>
  );
}

function SlotCard({ slot, phase, isLast, navigate }) {
  const colors = { live: '#166534', upcoming: '#1d4ed8', done: '#A3A3A3' };
  const color = colors[phase];
  const pct = slot.seated_count > 0 ? Math.round((slot.present_count / slot.seated_count) * 100) : 0;
  const ackPct = slot.supervisor_count > 0 ? Math.round((slot.ack_count / slot.supervisor_count) * 100) : 0;

  return (
    <div style={{ display: 'flex', gap: 12, padding: '14px 16px', borderBottom: !isLast ? '1px solid #E5E5E0' : 'none', alignItems: 'flex-start' }}>
      <div style={{ width: 3, alignSelf: 'stretch', background: color, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{slot.subject_code} — {slot.subject_name}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--np-n500)', marginTop: 2 }}>
              {slot.branch} · {slot.year} · Sem {slot.semester} · {formatTime(slot.start_time)} ({slot.duration_mins}min)
            </div>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.1em', color, border: `1px solid ${color}`, padding: '2px 6px', flexShrink: 0 }}>
            {phase}
          </span>
        </div>
        {phase !== 'done' && slot.seated_count > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--np-n500)', marginBottom: 3 }}>Attendance {slot.present_count}/{slot.seated_count}</div>
              <AttendancePct present={slot.present_count} total={slot.seated_count} />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--np-n500)', marginBottom: 3 }}>Supervisors Acknowledged</div>
              <AttendancePct present={slot.ack_count} total={slot.supervisor_count} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
