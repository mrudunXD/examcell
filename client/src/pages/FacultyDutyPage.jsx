import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  CalendarDays, 
  MapPin, 
  Clock, 
  CheckCircle, 
  UserCheck, 
  AlertTriangle, 
  Bell, 
  Info, 
  User, 
  ShieldAlert, 
  CheckSquare, 
  ChevronLeft, 
  ChevronRight, 
  Calendar 
} from 'lucide-react';
import api from '../lib/api.js';
import { useAppStore, useAuthStore } from '../store/index.js';
import toast from 'react-hot-toast';

function IncidentModal({ duty, onClose, onReported }) {
  const [type, setType] = useState('malpractice');
  const [severity, setSeverity] = useState('low');
  const [description, setDescription] = useState('');
  const [studentPrn, setStudentPrn] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) {
      toast.error('Description is required');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/incidents', {
        slot_id: duty.slot_id,
        room_allocation_id: duty.room_allocation_id,
        type,
        description,
        student_prn: studentPrn.trim() || null,
        action_taken: actionTaken.trim() || null,
        severity,
      });
      toast.success('Incident reported successfully');
      if (onReported) onReported();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to report incident');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#dc2626' }}>
          <AlertTriangle size={20} /> Report Exam Incident
        </h2>
        <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
          Room: {duty.room_no} | {duty.subject_code} — {duty.subject_name}
        </p>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Incident Type *</label>
              <select className="select" value={type} onChange={e => setType(e.target.value)}>
                <option value="malpractice">Malpractice / Cheating</option>
                <option value="disturbance">Disturbance / Noise</option>
                <option value="technical">Technical Issue</option>
                <option value="medical">Medical Emergency</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Severity *</label>
              <select className="select" value={severity} onChange={e => setSeverity(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Student PRN (Optional)</label>
            <input 
              className="input" 
              placeholder="e.g. 1032210123" 
              value={studentPrn} 
              onChange={e => setStudentPrn(e.target.value)} 
            />
          </div>

          <div className="form-group">
            <label className="form-label">Description / Details *</label>
            <textarea 
              className="input" 
              style={{ minHeight: 80, resize: 'vertical' }}
              placeholder="Provide exact details of the incident..." 
              value={description} 
              onChange={e => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Action Taken (Optional)</label>
            <input 
              className="input" 
              placeholder="e.g. Confiscated paper, moved seat, warned" 
              value={actionTaken} 
              onChange={e => setActionTaken(e.target.value)} 
            />
          </div>

          <div className="flex-row" style={{ justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid #E5E5E0' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
            <button type="submit" className="btn className=btn-danger" disabled={submitting} style={{ backgroundColor: '#dc2626', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 4, cursor: 'pointer' }}>
              {submitting ? <div className="spinner spinner-invert" style={{ width: 14, height: 14 }} /> : 'Report Incident'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Visual calendar layout component mapping duties
function DutyCalendar({ duties, onSelectDuty }) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (duties.length > 0) {
      const parts = duties[0].date.split('-');
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
    }
    return new Date();
  });

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  const daysArray = [];
  for (let i = 0; i < firstDayIndex; i++) daysArray.push(null);
  for (let i = 1; i <= totalDays; i++) daysArray.push(new Date(year, month, i));

  const getDutiesForDay = (dateObj) => {
    if (!dateObj) return [];
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    return duties.filter(d => d.date === dateStr);
  };

  return (
    <div className="duty-calendar-card card" style={{ padding: 24, marginBottom: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>
          <ChevronLeft size={16} />
        </button>
        <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700 }}>
          {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </h3>
        <button className="btn btn-ghost btn-sm" onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="duty-calendar-weekdays" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 8,
        textAlign: 'center',
        fontSize: 11,
        fontWeight: 800,
        marginBottom: 10,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        opacity: 0.6
      }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d}>{d}</div>)}
      </div>

      <div className="duty-calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
        {daysArray.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} className="duty-calendar-cell empty" style={{ height: 48 }} />;
          const dayDuties = getDutiesForDay(day);
          const isToday = new Date().toDateString() === day.toDateString();
          const hasDuties = dayDuties.length > 0;

          return (
            <div 
              key={day.getTime()} 
              onClick={() => hasDuties && onSelectDuty(dayDuties[0])}
              style={{
                height: 48,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: hasDuties 
                  ? (dayDuties.some(d => d.role === 'primary') ? 'rgba(17, 17, 17, 0.05)' : 'rgba(163, 163, 163, 0.1)') 
                  : (isToday ? 'rgba(59, 130, 246, 0.08)' : 'transparent'),
                border: hasDuties 
                  ? `1.5px solid ${dayDuties.some(d => d.role === 'primary') ? '#111' : '#a3a3a3'}` 
                  : (isToday ? '1.5px solid #3b82f6' : '1px solid #E5E5E0'),
                borderRadius: '8px',
                position: 'relative',
                cursor: hasDuties ? 'pointer' : 'default',
                transition: 'all 0.2s',
              }}
              className={`duty-calendar-cell ${hasDuties ? 'calendar-day-duty' : ''}`}
            >
              <span style={{ fontSize: 13, fontWeight: hasDuties ? 800 : 500, color: hasDuties ? '#111' : 'inherit' }}>
                {day.getDate()}
              </span>
              {hasDuties && (
                <div style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: dayDuties.some(d => d.role === 'primary') ? '#D6001C' : '#3b82f6',
                  marginTop: 2,
                }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function FacultyDutyPage() {
  const { activeCycleId } = useAppStore();
  const { user } = useAuthStore();
  
  // Dashboard states
  const [duties, setDuties] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [selectedCycle, setSelectedCycle] = useState(activeCycleId || '');
  const [loading, setLoading] = useState(false);
  
  // Reported Incidents & Broadcast states
  const [broadcasts, setBroadcasts] = useState([]);
  const [incidents, setIncidents] = useState([]);
  
  // View states
  const [activeTab, setActiveTab] = useState('duties'); // 'duties' | 'broadcasts' | 'incidents'
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'calendar'
  
  // Modals
  const [reportingDuty, setReportingDuty] = useState(null);

  const fetchDuties = useCallback(() => {
    if (!selectedCycle) return;
    setLoading(true);
    api.get(`/supervisors/my-duties/${selectedCycle}`)
      .then(r => setDuties(r.data))
      .catch(() => toast.error('Failed to load duties'))
      .finally(() => setLoading(false));
  }, [selectedCycle]);

  const fetchBroadcasts = useCallback(async () => {
    try {
      const { data } = await api.get('/broadcasts');
      setBroadcasts(data);
    } catch {}
  }, []);

  const fetchIncidents = useCallback(async () => {
    try {
      const { data } = await api.get('/incidents');
      setIncidents(data);
    } catch {}
  }, []);

  useEffect(() => {
    api.get('/exam-cycles').then(r => {
      setCycles(r.data);
      if (!selectedCycle && r.data.length > 0) setSelectedCycle(r.data[0].id);
    });
    fetchBroadcasts();
    fetchIncidents();
  }, [fetchBroadcasts, fetchIncidents, selectedCycle]);

  useEffect(() => {
    fetchDuties();
  }, [selectedCycle, fetchDuties]);

  const acknowledge = async (dutyId) => {
    try {
      await api.post(`/supervisors/acknowledge/${dutyId}`);
      toast.success('Duty acknowledged');
      setDuties(prev => prev.map(d => d.id === dutyId ? { ...d, acknowledged: 1 } : d));
    } catch (err) { 
      toast.error(err.response?.data?.error || 'Failed to acknowledge duty'); 
    }
  };

  const markBroadcastRead = async (id) => {
    try {
      await api.post(`/broadcasts/${id}/read`);
      setBroadcasts(prev => prev.map(b => b.id === id ? { ...b, is_read: 1 } : b));
      toast.success('Notice marked as read');
    } catch { 
      toast.error('Failed to mark read'); 
    }
  };

  const downloadDutySheet = async () => {
    try {
      const res = await api.get(`/export/duty/${user.id}/${selectedCycle}`, { responseType: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(res.data);
      a.download = `my_duty_sheet_${selectedCycle}.pdf`; 
      a.click();
      toast.success('Duty sheet PDF downloaded');
    } catch { 
      toast.error('Download failed'); 
    }
  };

  // Math counts for badges
  const pendingAckCount = duties.filter(d => !d.acknowledged).length;
  const unreadBroadcastCount = broadcasts.filter(b => !b.is_read).length;

  return (
    <div className="fade-in" style={{ maxWidth: 850, margin: '0 auto', paddingBottom: 48 }}>
      
      {/* Profile & Workload Header Summary Card */}
      <div className="faculty-profile-card card">
        <div className="faculty-profile-meta">
          <div className="faculty-profile-details" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ 
              width: 52, height: 52, borderRadius: '50%', background: '#111', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF' 
            }}>
              <User size={26} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 800 }}>
                {user?.name || 'Faculty Member'}
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: 13, color: '#666', fontWeight: 500 }}>
                {user?.email} · <strong style={{ color: '#111' }}>{user?.department}</strong>
              </p>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-ghost btn-sm" onClick={downloadDutySheet} style={{ border: '1px solid #e5e5e0' }} disabled={!selectedCycle}>
              <UserCheck size={13} strokeWidth={1.5} /> Duty Slip PDF
            </button>
          </div>
        </div>

        {/* Stats grid section */}
        <div className="faculty-stats-grid">
          {[
            { label: 'Assigned Duties', val: duties.length, color: '#111' },
            { label: 'Pending Ack', val: pendingAckCount, color: pendingAckCount > 0 ? '#d97706' : '#16a34a' },
            { label: 'Unread Notices', val: unreadBroadcastCount, color: unreadBroadcastCount > 0 ? '#ef4444' : '#16a34a' },
            { label: 'Reported Cases', val: incidents.length, color: '#6b7280' }
          ].map((stat, i) => (
            <div key={i} style={{ 
              background: '#fff', 
              padding: '14px 16px', 
              borderRadius: 8, 
              border: '1px solid #E5E5E0',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '26px', fontWeight: 900, color: stat.color }}>{stat.val}</div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#666', marginTop: 4, fontWeight: 700 }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Selector and Tab row */}
      <div className="faculty-tab-nav-row">
        {/* Navigation Tabs */}
        <div className="faculty-tabs-list flex-row">
          {[
            { id: 'duties', label: 'My Duties', badge: pendingAckCount },
            { id: 'broadcasts', label: 'Announcements', badge: unreadBroadcastCount },
            { id: 'incidents', label: 'My Incidents', badge: null }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: 6,
                background: activeTab === tab.id ? '#fff' : 'transparent',
                color: activeTab === tab.id ? '#111' : '#666',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              <span>{tab.label}</span>
              {tab.badge ? (
                <span style={{ 
                  background: tab.id === 'broadcasts' ? '#ef4444' : '#d97706',
                  color: '#fff', 
                  fontSize: 10, 
                  fontWeight: 800, 
                  padding: '2px 6px', 
                  borderRadius: 10 
                }}>
                  {tab.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {/* Cycle selector (Only relevant for duties tab) */}
        {activeTab === 'duties' && cycles.length > 0 && (
          <div className="faculty-selectors flex-row">
            <select 
              className="select" 
              value={selectedCycle} 
              onChange={e => setSelectedCycle(e.target.value)}
              style={{ padding: '6px 12px', fontSize: 13, width: 200 }}
            >
              {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            {/* Toggle Calendar View */}
            <div className="flex-row" style={{ gap: 2, background: '#F4F4F0', padding: 2, borderRadius: 6 }}>
              <button 
                onClick={() => setViewMode('list')}
                className={`btn btn-sm ${viewMode === 'list' ? 'btn-ink' : 'btn-ghost'}`}
                style={{ padding: '6px 10px', fontSize: 11 }}
              >
                List
              </button>
              <button 
                onClick={() => setViewMode('calendar')}
                className={`btn btn-sm ${viewMode === 'calendar' ? 'btn-ink' : 'btn-ghost'}`}
                style={{ padding: '6px 10px', fontSize: 11 }}
              >
                Calendar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Tab Contents */}
      {activeTab === 'duties' && (
        <>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
          ) : duties.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 64 }}>
              <CalendarDays size={36} strokeWidth={1} color="#A3A3A3" style={{ marginBottom: 12 }} />
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>No Duties Assigned</div>
              <p style={{ fontFamily: 'var(--font-body)', fontStyle: 'italic', color: 'var(--np-n500)', fontSize: 14 }}>
                You have no supervisor duties assigned for this cycle.
              </p>
            </div>
          ) : viewMode === 'calendar' ? (
            <DutyCalendar 
              duties={duties} 
              onSelectDuty={(duty) => {
                toast(`Assigned to ${duty.subject_code} in Room ${duty.room_no}`, { icon: '📝' });
              }}
            />
          ) : (
            <div className="faculty-duties-list">
              {duties.map((duty) => (
                <div
                  key={duty.id}
                  className={`faculty-duty-card ${duty.role === 'primary' ? 'primary' : 'co'}`}
                >
                  {/* Duty Header */}
                  <div className="faculty-duty-card-header">
                    <div className="faculty-duty-badges flex-row">
                      <span className="badge badge-ink" style={{
                        background: duty.role === 'primary' ? '#111111' : 'transparent',
                        color: duty.role === 'primary' ? '#F9F9F7' : '#525252',
                        borderColor: duty.role === 'primary' ? '#111111' : '#E5E5E0',
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '4px 10px'
                      }}>
                        {duty.role === 'primary' ? 'Primary Invigilator' : 'Co-Supervisor'}
                      </span>
                      {duty.acknowledged ? (
                        <span className="badge badge-success" style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px' }}>Acknowledged</span>
                      ) : (
                        <span className="badge badge-warning" style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', background: '#fffbeb', color: '#b45309', borderColor: '#fde68a' }}>Awaiting Ack</span>
                      )}
                    </div>
                    
                    <div className="faculty-duty-actions flex-row">
                      {!duty.acknowledged && (
                        <button className="btn btn-success btn-sm" onClick={() => acknowledge(duty.id)}>
                          <CheckCircle size={12} strokeWidth={1.5} /> Acknowledge
                        </button>
                      )}
                      
                      {/* Interactive Mark Attendance button */}
                      <Link 
                        to={`/attendance/${duty.slot_id}?roomAllocationId=${duty.room_allocation_id}`}
                        className="btn btn-ink btn-sm" 
                        style={{ gap: 4, display: 'inline-flex', alignItems: 'center', fontSize: 11 }}
                      >
                        <CheckSquare size={12} /> Mark Attendance
                      </Link>

                      <button className="btn btn-danger btn-sm" onClick={() => setReportingDuty(duty)}>
                        Report Incident
                      </button>
                    </div>
                  </div>

                  {/* Subject Details */}
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 19, fontWeight: 800, marginBottom: 16, lineHeight: 1.25 }}>
                    {duty.subject_code} — {duty.subject_name}
                  </div>

                  {/* Specifications grid */}
                  <div className="faculty-specs-grid">
                    {[
                      { icon: CalendarDays, label: 'Date', val: duty.date },
                      { icon: Clock,        label: 'Duration', val: `${duty.start_time} · ${duty.duration_mins} mins` },
                      { icon: MapPin,       label: 'Room Allocation', val: `Room ${duty.room_no} (${duty.block || 'Main Block'})` },
                      duty.co_supervisor_name
                        ? { icon: UserCheck, label: 'Invigilation Team', val: `${duty.co_supervisor_name} (Co)` }
                        : null,
                    ].filter(Boolean).map(({ icon: Icon, label, val }) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ border: '1px solid #E5E5E0', padding: 6, flexShrink: 0, borderRadius: 4, background: '#fcfcf9' }}>
                          <Icon size={14} strokeWidth={1.5} color="#525252" />
                        </div>
                        <div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--np-n500)', fontWeight: 700 }}>{label}</div>
                          <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14, marginTop: 2 }}>{val}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'broadcasts' && (
        <div className="card" style={{ padding: 28 }}>
          <h3 style={{ margin: '0 0 16px 0', fontFamily: 'var(--font-serif)', fontSize: 20 }}>
            Announcements & Alerts
          </h3>
          {broadcasts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--np-n500)', fontStyle: 'italic' }}>
              <Bell size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
              <div>No announcements from the Exam Cell.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {broadcasts.map(b => (
                <div key={b.id} style={{
                  padding: 20,
                  border: `1.5px solid ${b.priority === 'critical' ? '#fecaca' : (b.priority === 'urgent' ? '#fde68a' : '#E5E5E0')}`,
                  background: b.priority === 'critical' ? '#fff5f5' : (b.priority === 'urgent' ? '#fffbeb' : '#fff'),
                  borderLeft: `5px solid ${b.priority === 'critical' ? '#ef4444' : (b.priority === 'urgent' ? '#f59e0b' : '#3b82f6')}`,
                  borderRadius: 12,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.01)',
                  position: 'relative',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: '#111' }}>{b.title}</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{
                        fontSize: 9,
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        padding: '3px 8px',
                        borderRadius: 4,
                        background: b.priority === 'critical' ? '#ef4444' : (b.priority === 'urgent' ? '#f59e0b' : '#3b82f6'),
                        color: '#fff',
                        letterSpacing: '0.05em'
                      }}>{b.priority}</span>
                      
                      {!b.is_read ? (
                        <button 
                          onClick={() => markBroadcastRead(b.id)}
                          className="btn btn-ink btn-sm" 
                          style={{ padding: '2px 8px', fontSize: 10, height: 'auto', borderRadius: 4 }}
                        >
                          Mark Read
                        </button>
                      ) : (
                        <span style={{ fontSize: 10, color: '#15803d', fontWeight: 700 }}>✓ Read</span>
                      )}
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: 14, color: '#333', lineHeight: 1.5 }}>{b.message}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#777', marginTop: 12, borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: 10 }}>
                    <span>Sent by: <strong>{b.sent_by_name || 'Exam Coordinator'}</strong></span>
                    <span>{new Date(b.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'incidents' && (
        <div className="card" style={{ padding: 28 }}>
          <h3 style={{ margin: '0 0 16px 0', fontFamily: 'var(--font-serif)', fontSize: 20 }}>
            Incident Reporting Log
          </h3>
          {incidents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--np-n500)', fontStyle: 'italic' }}>
              <ShieldAlert size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
              <div>You have not filed any incidents for this cycle.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {incidents.map(inc => (
                <div key={inc.id} style={{
                  padding: 20,
                  border: '1.5px solid #E5E5E0',
                  borderRadius: 12,
                  background: '#fff',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.01)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      padding: '4px 10px',
                      borderRadius: 12,
                      background: inc.status === 'resolved' ? '#d1fae5' : (inc.status === 'escalated' ? '#fee2e2' : '#fef3c7'),
                      color: inc.status === 'resolved' ? '#065f46' : (inc.status === 'escalated' ? '#991b1b' : '#92400e'),
                      letterSpacing: '0.05em'
                    }}>{inc.status}</span>
                    <span style={{ fontSize: 12, color: '#666', fontWeight: 500 }}>
                      {new Date(inc.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6, color: '#111' }}>
                    {inc.type.toUpperCase()} · Severity: <span style={{ color: inc.severity === 'high' ? '#ef4444' : '#111' }}>{inc.severity.toUpperCase()}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 14, color: '#444', lineHeight: 1.5 }}>{inc.description}</p>
                  
                  {inc.student_prn && (
                    <div style={{ fontSize: 12, color: '#555', marginTop: 10, background: '#f4f4f0', padding: '4px 8px', borderRadius: 4, display: 'inline-block' }}>
                      Affected Student PRN: <strong>{inc.student_prn}</strong>
                    </div>
                  )}
                  {inc.action_taken && (
                    <div style={{ marginTop: 14, padding: '12px 16px', background: '#f9fafb', borderRadius: 8, fontSize: 13, borderLeft: '4px solid #6b7280' }}>
                      <strong>Coordinator Actions / Resolution:</strong>
                      <div style={{ marginTop: 4, color: '#374151', lineHeight: 1.4 }}>{inc.action_taken}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {reportingDuty && (
        <IncidentModal 
          duty={reportingDuty} 
          onClose={() => setReportingDuty(null)} 
          onReported={fetchIncidents}
        />
      )}

      <style>{`
        .faculty-profile-card {
          padding: 24px 32px;
          margin-bottom: 28px;
          background: #fcfcf9;
          border: 1.5px solid #111;
          border-radius: 16px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.03);
        }
        .faculty-profile-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
        }
        .faculty-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          gap: 16px;
          margin-top: 24px;
          border-top: 1px solid #E5E5E0;
          padding-top: 20px;
        }
        .faculty-tab-nav-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 12px;
        }
        .faculty-tabs-list {
          gap: 6px;
          background: #F4F4F0;
          padding: 4px;
          border-radius: 8px;
        }
        .faculty-duties-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .faculty-duty-card {
          border: 1.5px solid #E5E5E0;
          padding: 24px 28px;
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.02);
        }
        .faculty-duty-card.primary {
          border-left: 5px solid #111111;
        }
        .faculty-duty-card.co {
          border-left: 5px solid #c2c2bc;
        }
        .faculty-duty-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
          gap: 12px;
        }
        .faculty-duty-badges {
          gap: 8px;
          flex-wrap: wrap;
        }
        .faculty-duty-actions {
          gap: 8px;
          flex-wrap: wrap;
        }
        .faculty-specs-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }

        @media (max-width: 768px) {
          .faculty-profile-card {
            padding: 16px 20px;
            margin-bottom: 20px;
          }
          .faculty-profile-meta {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
          }
          .faculty-tab-nav-row {
            flex-direction: column;
            align-items: stretch;
          }
          .faculty-selectors {
            width: 100%;
            justify-content: space-between;
          }
          .faculty-selectors select {
            flex: 1;
            max-width: none !important;
          }
          .faculty-duty-card {
            padding: 16px 20px;
          }
          .faculty-duty-card-header {
            flex-direction: column;
            align-items: stretch;
          }
          .faculty-duty-actions {
            width: 100%;
            justify-content: flex-start;
          }
          .faculty-specs-grid {
            grid-template-columns: 1fr;
            gap: 12px;
          }
        }

        @media (max-width: 480px) {
          .faculty-stats-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
          }
          .faculty-tabs-list {
            width: 100%;
            justify-content: space-between;
          }
          .faculty-tabs-list button {
            flex: 1;
            font-size: 11px !important;
            padding: 8px 10px !important;
            justify-content: center;
          }
          .faculty-duty-actions {
            justify-content: stretch;
          }
          .faculty-duty-actions button, .faculty-duty-actions a {
            flex: 1;
            justify-content: center;
            font-size: 10px !important;
            padding: 6px 10px !important;
          }
          .duty-calendar-card {
            padding: 16px !important;
          }
          .duty-calendar-grid {
            gap: 4px !important;
          }
          .duty-calendar-cell {
            height: 38px !important;
          }
          .duty-calendar-cell span {
            font-size: 11px !important;
          }
        }
      `}</style>
    </div>
  );
}
