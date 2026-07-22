import { useState, useEffect, useCallback, useRef } from 'react';
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
  Calendar,
  Search,
  QrCode,
  Upload,
  X,
  Camera,
  CornerDownRight,
  RefreshCw,
  Plus,
  Zap,
  TrendingUp
} from 'lucide-react';
import io from 'socket.io-client';
import api from '../lib/api.js';
import { formatDate, formatTime, formatDateTime } from '../lib/format.js';
import { useAppStore, useAuthStore } from '../store/index.js';
import toast from 'react-hot-toast';

// ── QR Scanner Modal (Simulated) ───────────────────────────────────────────
function QrScannerModal({ roomStudents, onScanSuccess, onClose }) {
  const [selectedPrn, setSelectedPrn] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const scanTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    };
  }, []);

  const handleSimulateScan = () => {
    let prnToScan = selectedPrn;
    if (manualInput.trim()) {
      prnToScan = manualInput.trim();
    }
    
    if (!prnToScan) {
      toast.error('Please select a student or enter a PRN');
      return;
    }

    setScanning(true);
    scanTimerRef.current = setTimeout(() => {
      setScanning(false);
      const student = roomStudents.find(s => s.prn === prnToScan || s.roll_no === prnToScan);
      if (student) {
        onScanSuccess(student.student_id);
        toast.success(`Scan Success: ${student.student_name} marked Present!`, { icon: '🎯' });
        setManualInput('');
        onClose();
      } else {
        toast.error(`PRN/Roll No "${prnToScan}" not found in this classroom.`);
      }
    }, 800);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '450px' }}>
        <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <QrCode size={20} /> Simulated Hall Ticket QR Scanner
        </h2>
        
        {/* Viewfinder box */}
        <div style={{
          height: 180,
          border: '3px dashed var(--np-ink)',
          background: '#111',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          overflow: 'hidden',
          marginBottom: 16
        }}>
          <Camera size={32} style={{ opacity: 0.5, marginBottom: 8 }} />
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', opacity: 0.8 }}>
            {scanning ? 'Decoding barcode...' : 'Viewfinder Active'}
          </span>
          {/* Laser line effect */}
          <div style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: '2px',
            background: '#FF453A',
            boxShadow: '0 0 8px var(--np-red)',
            animation: 'scannerLaser 2s infinite linear'
          }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Select Student to Simulate QR Scan</label>
            <select className="select" value={selectedPrn} onChange={e => { setSelectedPrn(e.target.value); setManualInput(''); }}>
              <option value="">-- Choose Student --</option>
              {roomStudents.map(s => (
                <option key={s.student_id} value={s.prn}>
                  {s.student_name} ({s.roll_no} - {s.prn})
                </option>
              ))}
            </select>
          </div>

          <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 11, fontFamily: 'var(--font-mono)', opacity: 0.5 }}>- OR ENTER MANUALLY -</div>

          <div className="form-group">
            <label className="form-label">Type Student PRN / Roll No</label>
            <input 
              className="input" 
              placeholder="e.g. 1032210123" 
              value={manualInput} 
              onChange={e => { setManualInput(e.target.value); setSelectedPrn(''); }}
            />
          </div>

          <div className="flex-row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={scanning}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={handleSimulateScan} disabled={scanning}>
              {scanning ? 'Scanning...' : 'Simulate Scan'}
            </button>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes scannerLaser {
          0% { top: 0%; }
          50% { top: 100%; }
          100% { top: 0%; }
        }
      `}</style>
    </div>
  );
}

// ── Replacement Request Modal ─────────────────────────────────────────────
function ReplacementRequestModal({ duties, onClose, onSubmitSuccess }) {
  const [dutyId, setDutyId] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!dutyId) {
      toast.error('Please select a duty to substitute');
      return;
    }
    if (!reason.trim()) {
      toast.error('Please provide a reason');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/replacements', { duty_id: dutyId, reason: reason.trim() });
      toast.success('Replacement request submitted successfully');
      if (onSubmitSuccess) onSubmitSuccess();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldAlert size={20} color="#FF453A" /> Request Invigilator Replacement
        </h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Select Duty to Replace *</label>
            <select className="select" value={dutyId} onChange={e => setDutyId(e.target.value)} required>
              <option value="">-- Choose Duty --</option>
              {duties.map(d => (
                <option key={d.id} value={d.id}>
                  {formatDate(d.date)} | Room {d.room_no} - {d.subject_code} ({formatTime(d.start_time)})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Reason for Absence / Inability to Attend *</label>
            <textarea 
              className="textarea" 
              style={{ minHeight: 100 }}
              placeholder="Detail why you require replacement (medical, personal, clash, etc.)"
              value={reason} 
              onChange={e => setReason(e.target.value)}
              required
            />
          </div>

          <div className="alert alert-warning" style={{ fontSize: 11 }}>
            <Info size={14} /> Submitted requests are forwarded to the Exam Coordinators immediately. You are still legally responsible for the duty until replaced.
          </div>

          <div className="flex-row" style={{ justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid var(--np-muted)' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
            <button type="submit" className="btn btn-danger" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Request Replacement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Incident Modal with Malpractice Evidence ───────────────────────────────────────────
function IncidentModal({ duty, studentPrnPrefill, onClose, onReported }) {
  const [type, setType] = useState('malpractice');
  const [severity, setSeverity] = useState('low');
  const [description, setDescription] = useState('');
  const [studentPrn, setStudentPrn] = useState(studentPrnPrefill || '');
  const [actionTaken, setActionTaken] = useState('');
  const [evidenceImage, setEvidenceImage] = useState(null); // base64 string
  const [submitting, setSubmitting] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setEvidenceImage(reader.result); // Base64 data URI
    };
    reader.readAsDataURL(file);
  };

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
        evidence_image: evidenceImage
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
        <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#FF453A' }}>
          <AlertTriangle size={20} /> Report Exam Incident / Malpractice
        </h2>
        <p style={{ fontSize: 13, color: 'var(--np-n600)', marginBottom: 16 }}>
          Room: Room {duty.room_no} | {duty.subject_code} — {duty.subject_name}
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
            <label className="form-label">Student PRN / Roll No (Optional)</label>
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
              className="textarea" 
              style={{ minHeight: 80 }}
              placeholder="Provide exact details of the incident (e.g. what materials were found, what occurred)..." 
              value={description} 
              onChange={e => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Action Taken (Optional)</label>
            <input 
              className="input" 
              placeholder="e.g. Confiscated paper, warned student, changed seat" 
              value={actionTaken} 
              onChange={e => setActionTaken(e.target.value)} 
            />
          </div>

          {/* Evidence photo upload */}
          <div className="form-group" style={{ border: '1px dashed var(--np-muted)', padding: 12 }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Upload size={12} /> Malpractice Evidence Upload (Optional)
            </label>
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleFileChange} 
              style={{ fontSize: 11, marginTop: 4 }} 
            />
            {evidenceImage && (
              <div style={{ marginTop: 10, position: 'relative', width: 'fit-content' }}>
                <img 
                  src={evidenceImage} 
                  alt="Evidence Preview" 
                  style={{ maxHeight: 120, border: '1px solid var(--np-ink)', display: 'block' }} 
                />
                <button 
                  type="button" 
                  onClick={() => setEvidenceImage(null)}
                  style={{
                    position: 'absolute', top: -6, right: -6, background: '#FF453A', color: '#fff',
                    border: '1.5px solid var(--np-ink)', padding: 2, display: 'flex', alignItems: 'center'
                  }}
                >
                  <X size={10} />
                </button>
              </div>
            )}
          </div>

          <div className="flex-row" style={{ justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid var(--np-muted)' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>Cancel</button>
            <button type="submit" className="btn btn-danger" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Report Incident'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Visual duty calendar component ───────────────────────────────────────────
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
                  ? `1.5px solid ${dayDuties.some(d => d.role === 'primary') ? '#111' : '#767680'}` 
                  : (isToday ? '1.5px solid #3b82f6' : '1px solid var(--border)'),
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
                  background: dayDuties.some(d => d.role === 'primary') ? '#FF453A' : '#3b82f6',
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

// ── Main Page Component ───────────────────────────────────────────────────
export default function FacultyDutyPage() {
  const activeCycleId = useAppStore(state => state.activeCycleId);
  const user = useAuthStore(state => state.user);
  
  // Dashboard lists
  const [duties, setDuties] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [selectedCycle, setSelectedCycle] = useState(activeCycleId || '');
  const [loading, setLoading] = useState(false);
  
  // Reported Incidents & Broadcast states
  const [broadcasts, setBroadcasts] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [replacements, setReplacements] = useState([]);
  const [liveRooms, setLiveRooms] = useState([]);
  
  // View states
  const [activeTab, setActiveTab] = useState('duties'); // 'duties' | 'live_status' | 'broadcasts' | 'incidents' | 'assistant'
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'calendar'
  
  // Modals
  const [reportingDuty, setReportingDuty] = useState(null);
  const [replacementPrefillStudent, setReplacementPrefillStudent] = useState('');
  const [showReplacementModal, setShowReplacementModal] = useState(false);

  // ── Exam Assistant Console States ────────────────────────────────────────
  const [assistantRoomAllocationId, setAssistantRoomAllocationId] = useState(null);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantData, setAssistantData] = useState(null);
  const [localRecords, setLocalRecords] = useState([]); // local mutable attendance list
  const [searchPRN, setSearchPRN] = useState('');
  const [selectedSeatStudent, setSelectedSeatStudent] = useState(null);
  const [assistantModeTab, setAssistantModeTab] = useState('grid'); // 'grid' | 'list'
  const [showQrModal, setShowQrModal] = useState(false);
  
  // Live Timer states
  const [timerText, setTimerText] = useState('Exam Countdown Loading...');
  const [timerProgress, setTimerProgress] = useState(0);

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
    } catch (err) {
      console.error('Failed to fetch broadcasts:', err);
    }
  }, []);

  const fetchIncidents = useCallback(async () => {
    try {
      const { data } = await api.get('/incidents');
      setIncidents(data);
    } catch (err) {
      console.error('Failed to fetch incidents:', err);
    }
  }, []);

  const fetchReplacements = useCallback(async () => {
    try {
      const { data } = await api.get('/replacements/my-requests');
      setReplacements(data);
    } catch (err) {
      console.error('Failed to fetch replacements:', err);
    }
  }, []);

  const fetchLiveRooms = useCallback(async () => {
    try {
      const { data } = await api.get('/supervisors/live-rooms');
      setLiveRooms(data);
    } catch (err) {
      console.error('Failed to fetch live rooms:', err);
    }
  }, []);

  // Initialize
  useEffect(() => {
    api.get('/exam-cycles').then(r => {
      setCycles(r.data);
      const active = r.data.find(c => c.status === 'active') || r.data[0];
      const currentObj = r.data.find(c => c.id === selectedCycle);
      if (!selectedCycle || (active && active.status === 'active' && currentObj?.status !== 'active')) {
        if (active) setSelectedCycle(active.id);
      }
    });
    fetchBroadcasts();
    fetchIncidents();
    fetchReplacements();
    fetchLiveRooms();
  }, [fetchBroadcasts, fetchIncidents, fetchReplacements, fetchLiveRooms, selectedCycle]);

  useEffect(() => {
    fetchDuties();
  }, [selectedCycle, fetchDuties]);

  // Real-time sockets integration
  useEffect(() => {
    const socketUrl = window.location.origin.includes('5173')
      ? 'http://localhost:5000'
      : window.location.origin;
    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      randomizationFactor: 0.5
    });

    socket.on('connect', () => {
      console.log('📡 Faculty Portal WebSocket connected');
    });

    socket.on('reconnect_attempt', (attempt) => {
      console.log(`🔌 Faculty Portal Socket reconnect attempt #${attempt} with backoff`);
    });

    socket.on('reconnect_failed', () => {
      console.error('❌ Faculty Portal Socket connection completely failed.');
    });

    socket.on('EMERGENCY_BROADCAST', (broadcast) => {
      toast((t) => (
        <div style={{ cursor: 'pointer' }} onClick={() => { toast.dismiss(t.id); setActiveTab('broadcasts'); }}>
          <div style={{ fontWeight: 800, color: broadcast.priority === 'critical' ? '#dc2626' : '#1e3a8a' }}>
            🚨 Emergency Notice: {broadcast.title}
          </div>
          <div style={{ fontSize: '11px', marginTop: 4 }}>{broadcast.message}</div>
        </div>
      ), { duration: 8000 });
      fetchBroadcasts();
    });

    socket.on('INCIDENT_UPDATED', () => {
      fetchIncidents();
    });

    return () => {
      socket.disconnect();
    };
  }, [fetchBroadcasts, fetchIncidents]);

  // Launch Active Invigilation console
  const launchAssistant = async (roomAllocationId) => {
    setAssistantLoading(true);
    setAssistantRoomAllocationId(roomAllocationId);
    try {
      const { data } = await api.get(`/supervisors/room-details/${roomAllocationId}`);
      setAssistantData(data);
      setLocalRecords(data.assignments);
      setActiveTab('assistant');
      toast.success('Exam Assistant Console loaded');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load Exam Assistant Mode');
    } finally {
      setAssistantLoading(false);
    }
  };

  // Timer Tick implementation
  useEffect(() => {
    if (activeTab !== 'assistant' || !assistantData?.roomAllocation) return;

    const tick = () => {
      const ra = assistantData.roomAllocation;
      const start = new Date(`${ra.date}T${ra.start_time}`);
      const duration = ra.duration_mins || 120;
      const end = new Date(start.getTime() + duration * 60000);
      const now = new Date();

      if (now < start) {
        const diffMs = start - now;
        const hrs = Math.floor(diffMs / 3600000);
        const mins = Math.floor((diffMs % 3600000) / 60000);
        const secs = Math.floor((diffMs % 60000) / 1000);
        setTimerText(`Starts in ${hrs}h ${mins}m ${secs}s`);
        setTimerProgress(0);
      } else if (now >= start && now <= end) {
        const total = end - start;
        const elapsed = now - start;
        const percent = Math.min(100, Math.round((elapsed / total) * 100));
        
        const diffMs = end - now;
        const hrs = Math.floor(diffMs / 3600000);
        const mins = Math.floor((diffMs % 3600000) / 60000);
        const secs = Math.floor((diffMs % 60000) / 1000);
        setTimerText(`Ends in ${hrs}h ${mins}m ${secs}s`);
        setTimerProgress(percent);
      } else {
        setTimerText('Exam Completed');
        setTimerProgress(100);
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeTab, assistantData]);

  // Mark Acknowledge Duty
  const acknowledge = async (dutyId) => {
    try {
      await api.post(`/supervisors/acknowledge/${dutyId}`);
      toast.success('Duty assignment accepted');
      setDuties(prev => prev.map(d => d.id === dutyId ? { ...d, acknowledged: 1 } : d));
    } catch (err) { 
      toast.error(err.response?.data?.error || 'Failed to acknowledge duty'); 
    }
  };

  // Mark single attendance in Real-time
  const handleMarkAttendance = async (studentId, status, notes = '') => {
    const prevRecords = localRecords;
    const prevData = assistantData;
    setLocalRecords(prev => prev.map(r => r.student_id === studentId ? { ...r, attendance_status: status, attendance_notes: notes } : r));
    setAssistantData(prev => ({
      ...prev,
      assignments: prev.assignments.map(r => r.student_id === studentId ? { ...r, attendance_status: status, attendance_notes: notes } : r)
    }));

    try {
      await api.post(`/attendance/${assistantData.roomAllocation.slot_id}`, {
        records: [{
          student_id: studentId,
          room_allocation_id: assistantRoomAllocationId,
          status,
          notes: notes || null
        }]
      });
    } catch (err) {
      setLocalRecords(prevRecords);
      setAssistantData(prevData);
      toast.error('Failed to sync attendance in real-time');
    }
  };

  // Distress signal to coordinator
  const sendDistressAlert = async () => {
    if (!window.confirm('⚠️ Send immediate Technical/Distress emergency call to the exam coordinator?')) return;
    try {
      await api.post('/incidents', {
        slot_id: assistantData.roomAllocation.slot_id,
        room_allocation_id: assistantRoomAllocationId,
        type: 'technical',
        description: '🚨 DISTRESS CALL: Invigilator requested urgent technical/administrative assistance in the room.',
        severity: 'high'
      });
      toast.success('Distress signal broadcasted to Exam Cell');
      fetchIncidents();
      if (assistantData) {
        // Refresh local incidents list
        const res = await api.get(`/supervisors/room-details/${assistantRoomAllocationId}`);
        setAssistantData(prev => ({ ...prev, incidents: res.data.incidents }));
      }
    } catch {
      toast.error('Failed to send distress alert');
    }
  };

  const markBroadcastRead = async (id) => {
    try {
      await api.post(`/broadcasts/${id}/read`);
      setBroadcasts(prev => prev.map(b => b.id === id ? { ...b, is_read: 1 } : b));
      toast.success('Notice read');
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

  // Math counts for badges & analytics
  const todayStr = new Date().toISOString().split('T')[0];
  const pendingAckCount = duties.filter(d => !d.acknowledged).length;
  const unreadBroadcastCount = broadcasts.filter(b => !b.is_read).length;

  const completedDutiesCount = duties.filter(d => d.date < todayStr).length;
  const upcomingDutiesCount = duties.filter(d => d.date >= todayStr).length;
  const activeDutyToday = duties.find(d => d.date === todayStr);

  return (
    <div className="fade-in" style={{ maxWidth: activeTab === 'assistant' ? '1200px' : '900px', margin: '0 auto', paddingBottom: 48 }}>
      
      {/* ── Active Banner Bulletin 🚨 ── */}
      {activeDutyToday && activeTab !== 'assistant' && (
        <div style={{
          border: '3px solid var(--np-red)',
          background: '#fff1f1',
          padding: '16px 24px',
          marginBottom: 24,
          boxShadow: '4px 4px 0 0 var(--np-ink)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: '#FF453A', color: '#fff', padding: 8, display: 'flex', alignItems: 'center' }}>
              <QrCode size={24} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 800, color: '#F5F5F7' }}>
                Active Invigilation Console Available Today!
              </h4>
              <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--np-n600)', fontFamily: 'var(--font-mono)' }}>
                Room {activeDutyToday.room_no} | {activeDutyToday.subject_code} ({formatTime(activeDutyToday.start_time)})
              </p>
            </div>
          </div>
          <button 
            onClick={() => launchAssistant(activeDutyToday.room_allocation_id)} 
            className="btn btn-primary animate-pulse"
            style={{ backgroundColor: '#FF453A', borderColor: '#F5F5F7', color: '#fff' }}
          >
            Launch Exam Assistant Console
          </button>
        </div>
      )}

      {/* ── PROFILE & ANALYTICS PANELS (only show outside assistant mode) ── */}
      {activeTab !== 'assistant' && (
        <div className="card" style={{ padding: 24, marginBottom: 28, border: '1px solid var(--border)', boxShadow: '4px 4px 0 0 var(--np-ink)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ 
                width: 56, height: 56, background: '#F5F5F7', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF' 
              }}>
                <User size={28} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 800 }}>
                  {user?.name || 'Faculty Member'}
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: 13, color: 'var(--np-n600)', fontFamily: 'var(--font-mono)' }}>
                  {user?.email} · <span style={{ textTransform: 'uppercase', fontWeight: 700 }}>{user?.department}</span>
                </p>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                onClick={() => setShowReplacementModal(true)} 
                className="btn btn-warning"
                disabled={duties.length === 0}
              >
                Request Replacement
              </button>
              <button 
                className="btn btn-ghost" 
                onClick={downloadDutySheet} 
                style={{ border: '1px solid var(--np-ink)' }} 
                disabled={!selectedCycle}
              >
                Duty Slip PDF
              </button>
            </div>
          </div>

          {/* Neobrutalist Analytics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
            {[
              { label: 'Assigned Duties', val: duties.length, sub: 'Total cycle load', icon: CalendarDays },
              { label: 'Upcoming Duties', val: upcomingDutiesCount, sub: 'Future schedule list', icon: Clock },
              { label: 'Completed Duties', val: completedDutiesCount, sub: 'Archive classroom history', icon: CheckCircle },
              { label: 'Substitute Alerts', val: replacements.length, sub: 'Inability requests submitted', icon: ShieldAlert }
            ].map((stat, i) => (
              <div key={i} style={{ 
                background: 'var(--bg-base)', 
                padding: 16, 
                border: '1px solid var(--np-ink)',
                boxShadow: '2px 2px 0 0 var(--np-ink)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '28px', fontWeight: 900, fontFamily: 'var(--font-mono)' }}>{stat.val}</span>
                  <stat.icon size={16} style={{ color: 'var(--np-n500)' }} />
                </div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginTop: 6 }}>
                  {stat.label}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--np-n500)', marginTop: 2 }}>
                  {stat.sub}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TABS BAR (outside assistant mode) ── */}
      {activeTab !== 'assistant' && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          {/* Nav Tabs */}
          <div style={{ display: 'flex', gap: 6, background: 'var(--border)', padding: 4 }}>
            {[
              { id: 'duties', label: 'Duty timetable', badge: pendingAckCount },
              { id: 'live_status', label: 'Live campus status', badge: null },
              { id: 'broadcasts', label: 'Notices Board', badge: unreadBroadcastCount },
              { id: 'incidents', label: 'Incidents log', badge: null }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  background: activeTab === tab.id ? '#F5F5F7' : 'transparent',
                  color: activeTab === tab.id ? 'var(--bg-base)' : 'var(--np-n600)',
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.1s'
                }}
              >
                <span>{tab.label}</span>
                {tab.badge ? (
                  <span style={{ 
                    background: tab.id === 'broadcasts' ? '#FF453A' : '#d97706',
                    color: '#fff', 
                    fontSize: 10, 
                    fontWeight: 800, 
                    padding: '1px 6px'
                  }}>
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {/* Cycle selector (relevant for duties tab) */}
          {activeTab === 'duties' && cycles.length > 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select 
                className="select" 
                value={selectedCycle} 
                onChange={e => setSelectedCycle(e.target.value)}
                style={{ padding: '6px 12px', fontSize: 13, width: 220 }}
              >
                {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>

              {/* Toggle Calendar/List View */}
              <div style={{ display: 'flex', gap: 2, background: 'var(--border)', padding: 2 }}>
                <button 
                  onClick={() => setViewMode('list')}
                  className="btn btn-sm"
                  style={{ 
                    background: viewMode === 'list' ? '#F5F5F7' : 'transparent',
                    color: viewMode === 'list' ? 'var(--bg-base)' : 'var(--np-n600)',
                    border: 'none',
                    minHeight: 24
                  }}
                >
                  List
                </button>
                <button 
                  onClick={() => setViewMode('calendar')}
                  className="btn btn-sm"
                  style={{ 
                    background: viewMode === 'calendar' ? '#F5F5F7' : 'transparent',
                    color: viewMode === 'calendar' ? 'var(--bg-base)' : 'var(--np-n600)',
                    border: 'none',
                    minHeight: 24
                  }}
                >
                  Calendar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB CONTENT: DUTY TIMETABLE ── */}
      {activeTab === 'duties' && (
        <>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
          ) : duties.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 64, border: '1px solid var(--border)' }}>
              <CalendarDays size={40} strokeWidth={1} color="var(--np-n400)" style={{ marginBottom: 12 }} />
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 700, marginBottom: 8 }}>No Duties Allocated</div>
              <p style={{ fontStyle: 'italic', color: 'var(--np-n500)', fontSize: 14 }}>
                You have no scheduled duties in this cycle.
              </p>
            </div>
          ) : viewMode === 'calendar' ? (
            <DutyCalendar 
              duties={duties} 
              onSelectDuty={(duty) => {
                toast(`Subject: ${duty.subject_name}\nRoom: Room ${duty.room_no} (${duty.block})\nDate: ${formatDate(duty.date)}\nTime: ${formatTime(duty.start_time)}`, { icon: '📝', duration: 4000 });
              }}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {duties.map((duty) => (
                <div
                  key={duty.id}
                  className="card"
                  style={{
                    border: '1px solid var(--border)',
                    borderLeft: `8px solid ${duty.role === 'primary' ? '#F5F5F7' : 'var(--np-n400)'}`,
                    boxShadow: '4px 4px 0 0 var(--np-ink)',
                    background: '#fff',
                    padding: 24
                  }}
                >
                  {/* Duty Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span className="badge badge-ink" style={{ fontSize: 10 }}>
                        {duty.role === 'primary' ? 'Primary Supervisor' : 'Co-Supervisor'}
                      </span>
                      {duty.acknowledged ? (
                        <span className="badge badge-success" style={{ fontSize: 10 }}>Acknowledge Accepted</span>
                      ) : (
                        <span className="badge badge-warning" style={{ fontSize: 10 }}>Awaiting Acceptance</span>
                      )}
                    </div>
                    
                    <div style={{ display: 'flex', gap: 8 }}>
                      {!duty.acknowledged && (
                        <button className="btn btn-success btn-sm" onClick={() => acknowledge(duty.id)}>
                          Accept Duty
                        </button>
                      )}
                      
                      {duty.date === todayStr ? (
                        <button 
                          onClick={() => launchAssistant(duty.room_allocation_id)} 
                          className="btn btn-primary btn-sm"
                          style={{ background: '#FF453A', color: '#fff' }}
                        >
                          Launch Console
                        </button>
                      ) : (
                        <Link 
                          to={`/attendance/${duty.slot_id}?roomAllocationId=${duty.room_allocation_id}`}
                          className="btn btn-ghost btn-sm" 
                          style={{ border: '1px solid var(--np-ink)' }}
                        >
                          Attendance
                        </Link>
                      )}

                      <button className="btn btn-danger btn-sm" onClick={() => setReportingDuty(duty)}>
                        Report Incident
                      </button>
                    </div>
                  </div>

                  {/* Subject Name */}
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 800, marginBottom: 16 }}>
                    {duty.subject_code} — {duty.subject_name}
                  </div>

                  {/* Specs Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                    {[
                      { icon: CalendarDays, label: 'Date', val: formatDate(duty.date) },
                      { icon: Clock,        label: 'Timings', val: `${formatTime(duty.start_time)} (${duty.duration_mins} mins)` },
                      { icon: MapPin,       label: 'Room', val: `Room ${duty.room_no} (${duty.block || 'Main Block'})` },
                      duty.co_supervisor_name
                        ? { icon: UserCheck, label: 'Co-invigilator', val: duty.co_supervisor_name }
                        : null
                    ].filter(Boolean).map(({ icon: Icon, label, val }) => (
                      <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ border: '1px solid var(--np-ink)', padding: 6, background: 'var(--bg-base)' }}>
                          <Icon size={14} color="#F5F5F7" />
                        </div>
                        <div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', color: 'var(--np-n500)', fontWeight: 700 }}>{label}</div>
                          <div style={{ fontWeight: 700, fontSize: 13, marginTop: 2 }}>{val}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Replacement Log Panel */}
          {replacements.length > 0 && (
            <div className="card" style={{ marginTop: 32, border: '1px solid var(--border)', boxShadow: '4px 4px 0 0 var(--np-ink)', background: '#fff' }}>
              <h3 style={{ margin: '0 0 16px 0', fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700 }}>
                My Replacement Requests Log
              </h3>
              <table style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Room</th>
                    <th>Reason / Detail</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {replacements.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{formatDate(r.date)} {formatTime(r.start_time)}</td>
                      <td>Room {r.room_no}</td>
                      <td>{r.reason}</td>
                      <td>
                        <span className={`badge ${
                          r.status === 'approved' ? 'badge-success' : (r.status === 'rejected' ? 'badge-danger' : 'badge-warning')
                        }`}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── TAB CONTENT: LIVE CAMPUS STATUS ── */}
      {activeTab === 'live_status' && (
        <div className="card" style={{ padding: 24, border: '1px solid var(--border)', boxShadow: '4px 4px 0 0 var(--np-ink)', background: '#fff' }}>
          <h3 style={{ margin: '0 0 16px 0', fontFamily: 'var(--font-serif)', fontSize: 20 }}>
            Live Classroom Status Board (Active Today)
          </h3>
          <p style={{ fontSize: 12, color: 'var(--np-n500)', marginBottom: 20, fontFamily: 'var(--font-mono)' }}>
            Institution-wide real-time invigilation state tracker
          </p>

          {liveRooms.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--np-n500)', fontStyle: 'italic' }}>
              No active exams scheduled today across the campus.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              {liveRooms.map((room) => (
                <div key={room.room_allocation_id || room.room_no} style={{
                  border: '1.5px solid var(--np-ink)',
                  padding: 16,
                  background: 'var(--bg-base)',
                  boxShadow: '2px 2px 0 0 var(--np-ink)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontWeight: 800, fontSize: 16 }}>Room {room.room_no}</span>
                    <span className={`badge ${
                      room.slot_status === 'finalised' 
                        ? 'badge-success' 
                        : (room.slot_status === 'draft' ? 'badge-neutral' : 'badge-ink')
                    }`}>
                      {room.slot_status === 'finalised' ? 'Completed' : 'Active / In Progress'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{room.subject_code} — {room.subject_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--np-n500)', fontFamily: 'var(--font-mono)', marginTop: 8 }}>
                    Block: {room.block || 'Main Block'} | Start: {formatTime(room.start_time)} ({room.duration_mins}m)
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB CONTENT: BROADCAST NOTICES ── */}
      {activeTab === 'broadcasts' && (
        <div className="card" style={{ padding: 24, border: '1px solid var(--border)', boxShadow: '4px 4px 0 0 var(--np-ink)', background: '#fff' }}>
          <h3 style={{ margin: '0 0 16px 0', fontFamily: 'var(--font-serif)', fontSize: 20 }}>
            Announcements & Emergency Banners
          </h3>
          {broadcasts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--np-n500)', fontStyle: 'italic' }}>
              <Bell size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
              <div>No broadcasts from the Exam Coordinator.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {broadcasts.map(b => (
                <div key={b.id} style={{
                  padding: 20,
                  border: `1.5px solid var(--np-ink)`,
                  background: b.priority === 'critical' ? '#fff1f1' : (b.priority === 'urgent' ? '#fffbeb' : '#fff'),
                  borderLeft: `8px solid ${b.priority === 'critical' ? '#FF453A' : (b.priority === 'urgent' ? '#f59e0b' : '#3b82f6')}`,
                  position: 'relative'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{b.title}</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span className={`badge ${
                        b.priority === 'critical' ? 'badge-danger' : (b.priority === 'urgent' ? 'badge-warning' : 'badge-neutral')
                      }`}>{b.priority}</span>
                      
                      {!b.is_read ? (
                        <button 
                          onClick={() => markBroadcastRead(b.id)}
                          className="btn btn-sm btn-ghost" 
                          style={{ padding: '2px 8px', fontSize: 10, height: 'auto', border: '1px solid var(--np-ink)' }}
                        >
                          Mark Read
                        </button>
                      ) : (
                        <span style={{ fontSize: 10, color: '#166534', fontWeight: 700 }}>✓ Read</span>
                      )}
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: 14, color: '#333', lineHeight: 1.5, fontFamily: 'var(--font-body)' }}>{b.message}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#777', marginTop: 12, borderTop: '1px solid var(--np-muted)', paddingTop: 10 }}>
                    <span>Sent by: <strong>{b.sent_by_name || 'Exam Coordinator'}</strong></span>
                    <span>{formatDateTime(b.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB CONTENT: INCIDENTS LOG ── */}
      {activeTab === 'incidents' && (
        <div className="card" style={{ padding: 24, border: '1px solid var(--border)', boxShadow: '4px 4px 0 0 var(--np-ink)', background: '#fff' }}>
          <h3 style={{ margin: '0 0 16px 0', fontFamily: 'var(--font-serif)', fontSize: 20 }}>
            Incident Logging Log
          </h3>
          {incidents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--np-n500)', fontStyle: 'italic' }}>
              <ShieldAlert size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
              <div>No incidents filed by you.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {incidents.map(inc => (
                <div key={inc.id} style={{
                  padding: 20,
                  border: '1.5px solid var(--np-ink)',
                  background: '#fff'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span className={`badge ${
                      inc.status === 'resolved' ? 'badge-success' : (inc.status === 'escalated' ? 'badge-danger' : 'badge-warning')
                    }`}>{inc.status}</span>
                    <span style={{ fontSize: 12, color: '#666', fontWeight: 500 }}>
                      {formatDate(inc.created_at)}
                    </span>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>
                    {inc.type.toUpperCase()} · Severity: <span style={{ color: inc.severity === 'high' ? '#FF453A' : 'inherit' }}>{inc.severity.toUpperCase()}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 14, color: '#333', lineHeight: 1.4 }}>{inc.description}</p>
                  
                  {inc.student_prn && (
                    <div style={{ fontSize: 11, color: '#111', marginTop: 10, background: 'var(--border)', padding: '4px 8px', display: 'inline-block', fontFamily: 'var(--font-mono)' }}>
                      Affected PRN: <strong>{inc.student_prn}</strong>
                    </div>
                  )}

                  {/* Malpractice photo representation */}
                  {inc.evidence_image && (
                    <div style={{ marginTop: 12 }}>
                      <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--np-n600)', marginBottom: 4 }}>Evidence Attachment:</span>
                      <img 
                        src={inc.evidence_image} 
                        alt="Evidence photo" 
                        style={{ maxHeight: 150, border: '1px solid var(--border)' }} 
                      />
                    </div>
                  )}

                  {inc.action_taken && (
                    <div style={{ marginTop: 14, padding: '12px 16px', background: 'var(--bg-base)', borderLeft: '4px solid var(--np-ink)', fontSize: 13 }}>
                      <strong>Coordinator Remarks:</strong>
                      <div style={{ marginTop: 4, color: 'var(--np-n700)' }}>{inc.action_taken}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ACTIVE INVIGILATION PANEL (Faculty Exam Assistant Mode Console) ── */}
      {activeTab === 'assistant' && assistantData && (
        <div className="fade-in">
          {/* Back Header Strip */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
            <button className="btn btn-ghost" onClick={() => { setActiveTab('duties'); setSelectedSeatStudent(null); }} style={{ border: '1px solid var(--np-ink)' }}>
              ← Return Dashboard
            </button>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-warning" onClick={() => setShowQrModal(true)}>
                <QrCode size={13} /> QR Attendance Scan
              </button>
              <button className="btn btn-danger" onClick={sendDistressAlert}>
                🚨 Call Coordinator / SOS
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24, alignItems: 'start' }}>
            
            {/* Left Console: Controls & Timer */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* Active Timer Card */}
              <div className="card-invert" style={{ border: '1px solid var(--border)', boxShadow: '4px 4px 0 0 var(--np-ink)', padding: 20 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', opacity: 0.7 }}>Invigilation Assistant Mode</div>
                <div style={{ fontSize: 28, fontWeight: 900, margin: '8px 0', fontFamily: 'var(--font-mono)' }}>{timerText}</div>
                {/* Progress bar */}
                <div style={{ width: '100%', height: 12, background: 'rgba(255,255,255,0.2)', border: '1px solid #fff' }}>
                  <div style={{ height: '100%', width: `${timerProgress}%`, background: '#FF453A', transition: 'width 1s ease' }} />
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 8 }}>
                  Room {assistantData.roomAllocation.room_no} | Timings: {formatTime(assistantData.roomAllocation.start_time)} ({assistantData.roomAllocation.duration_mins}m)
                </div>
              </div>

              {/* Occupancy Analytics */}
              <div className="card" style={{ padding: 20, border: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12, borderBottom: '1.5px solid var(--np-ink)', paddingBottom: 6 }}>
                  Room Occupancy Stats
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--np-n500)' }}>Assigned Capacity</span>
                    <span style={{ fontWeight: 700 }}>{assistantData.roomAllocation.assigned_count} students</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--np-n500)' }}>Present</span>
                    <span style={{ fontWeight: 700, color: '#166534' }}>
                      {localRecords.filter(r => r.attendance_status === 'present').length}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--np-n500)' }}>Late Entries</span>
                    <span style={{ fontWeight: 700, color: '#b45309' }}>
                      {localRecords.filter(r => r.attendance_status === 'late').length}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--np-n500)' }}>Absent</span>
                    <span style={{ fontWeight: 700, color: '#FF453A' }}>
                      {localRecords.filter(r => r.attendance_status === 'absent' || !r.attendance_status).length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Invigilation Team */}
              <div className="card" style={{ padding: 20, border: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 12, borderBottom: '1.5px solid var(--np-ink)', paddingBottom: 6 }}>
                  Invigilation Team
                </div>
                {assistantData.team.map((t, idx) => (
                  <div key={t.faculty_id || t.faculty_name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: idx < assistantData.team.length - 1 ? '1px solid var(--np-muted)' : 'none' }}>
                    <div style={{ width: 30, height: 30, background: '#F5F5F7', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>
                      {t.faculty_name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 12 }}>{t.faculty_name}</div>
                      <div style={{ fontSize: 10, color: 'var(--np-n500)' }}>{t.role === 'primary' ? 'Primary' : 'Co-supervisor'} · {t.department}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Local Incident Board */}
              <div className="card" style={{ padding: 20, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1.5px solid var(--np-ink)', paddingBottom: 6 }}>
                  <span style={{ fontWeight: 800, fontSize: 14 }}>Incidents Filed Today</span>
                  <button 
                    onClick={() => setReportingDuty({
                      slot_id: assistantData.roomAllocation.slot_id,
                      room_allocation_id: assistantRoomAllocationId,
                      room_no: assistantData.roomAllocation.room_no,
                      subject_code: assistantData.roomAllocation.subject_code,
                      subject_name: assistantData.roomAllocation.subject_name
                    })}
                    className="btn btn-danger btn-sm"
                    style={{ minHeight: 22 }}
                  >
                    + File Case
                  </button>
                </div>
                {assistantData.incidents.length === 0 ? (
                  <span style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--np-n500)' }}>No incidents logged for this room today.</span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 150, overflowY: 'auto' }}>
                    {assistantData.incidents.map(inc => (
                      <div key={inc.id} style={{ border: '1px solid var(--np-muted)', padding: '6px 10px', background: '#fff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 700 }}>
                          <span style={{ color: '#FF453A' }}>{inc.type.toUpperCase()}</span>
                          <span>{inc.status}</span>
                        </div>
                        <p style={{ fontSize: 11, margin: '4px 0 0 0', color: 'var(--np-n600)' }}>{inc.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Console: Seating Grid, Lists & Filters */}
            <div>
              {/* Filter and View toggles */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', gap: 8, background: 'var(--border)', padding: 2 }}>
                  <button 
                    onClick={() => setAssistantModeTab('grid')} 
                    className="btn btn-sm"
                    style={{
                      background: assistantModeTab === 'grid' ? '#F5F5F7' : 'transparent',
                      color: assistantModeTab === 'grid' ? 'var(--bg-base)' : 'var(--np-n600)',
                      border: 'none', minHeight: 26
                    }}
                  >
                    Seating Layout Map
                  </button>
                  <button 
                    onClick={() => setAssistantModeTab('list')} 
                    className="btn btn-sm"
                    style={{
                      background: assistantModeTab === 'list' ? '#F5F5F7' : 'transparent',
                      color: assistantModeTab === 'list' ? 'var(--bg-base)' : 'var(--np-n600)',
                      border: 'none', minHeight: 26
                    }}
                  >
                    Student Attendance List
                  </button>
                </div>

                <div className="flex-row" style={{ minWidth: 260 }}>
                  <Search size={14} style={{ color: 'var(--np-n400)', marginRight: -24, zIndex: 1 }} />
                  <input 
                    className="input"
                    placeholder="Search PRN, roll, or student name..."
                    style={{ paddingLeft: 28, fontSize: 12, minHeight: 32 }}
                    value={searchPRN}
                    onChange={e => setSearchPRN(e.target.value)}
                  />
                  {searchPRN && (
                    <button onClick={() => setSearchPRN('')} style={{ border: 'none', background: 'transparent', marginLeft: -24, cursor: 'pointer' }}>
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Seating Grid View */}
              {assistantModeTab === 'grid' && (
                <>
                  {/* Seating Grid Render */}
                  {(() => {
                    const rows = assistantData.roomAllocation.bench_rows || 6;
                    const cols = assistantData.roomAllocation.bench_cols || 4;
                    const grid = [];
                    const seatMap = {};

                    localRecords.forEach(a => {
                      if (!seatMap[a.bench_row]) seatMap[a.bench_row] = {};
                      seatMap[a.bench_row][a.bench_col] = a;
                    });

                    for (let r = 1; r <= rows; r++) {
                      const rowSeats = [];
                      for (let c = 1; c <= cols; c++) {
                        const student = seatMap[r]?.[c];
                        const isSearched = searchPRN && student && (
                          student.prn.toLowerCase().includes(searchPRN.toLowerCase()) ||
                          student.roll_no.toLowerCase().includes(searchPRN.toLowerCase()) ||
                          student.student_name.toLowerCase().includes(searchPRN.toLowerCase())
                        );

                        const benchIndex = (r - 1) * Math.floor(cols / 2) + Math.floor((c - 1) / 2);
                        const actualBenches = Math.floor(assistantData.roomAllocation.capacity / 2);
                        if (benchIndex >= actualBenches) {
                          rowSeats.push(<div key={`${r}-${c}`} style={{ minHeight: 74, visibility: 'hidden' }} />);
                          continue;
                        }
                        
                        rowSeats.push(
                          <div 
                            key={`${r}-${c}`}
                            onClick={() => student && setSelectedSeatStudent(student)}
                            style={{
                              border: isSearched ? '3px solid var(--np-red)' : '1px solid var(--np-ink)',
                              background: !student 
                                ? '#f5f5f0' 
                                : (student.attendance_status === 'present' 
                                    ? '#dcfce7' 
                                    : (student.attendance_status === 'late' ? '#fef3c7' : '#fee2e2')),
                              padding: '8px 10px',
                              minHeight: 74,
                              cursor: student ? 'pointer' : 'default',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              position: 'relative',
                              transition: 'all 0.15s'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: 'var(--np-n500)', fontFamily: 'var(--font-mono)' }}>
                              <span>R{r}-C{c}</span>
                              {student && (
                                <span style={{ 
                                  fontWeight: 800, 
                                  color: student.attendance_status === 'present' ? '#166534' : (student.attendance_status === 'late' ? '#b45309' : '#b91c1c') 
                                }}>
                                  {student.attendance_status?.toUpperCase() || 'ABSENT'}
                                </span>
                              )}
                            </div>
                            {student ? (
                              <div>
                                <div style={{ fontWeight: 800, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {student.student_name}
                                </div>
                                <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--np-n600)', marginTop: 2 }}>
                                  PRN: {student.prn}
                                </div>
                                <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#FF453A', fontWeight: 600 }}>
                                  Roll: {student.roll_no}
                                </div>
                              </div>
                            ) : (
                              <div style={{ textAlign: 'center', color: 'var(--np-n400)', fontSize: 10, margin: 'auto 0' }}>—</div>
                            )}
                          </div>
                        );
                      }
                      grid.push(
                        <div key={r} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 10, marginBottom: 10 }}>
                          {rowSeats}
                        </div>
                      );
                    }

                    return (
                      <div style={{ background: '#fff', border: '1px solid var(--border)', padding: 20, overflowX: 'auto', boxShadow: '4px 4px 0 0 var(--np-ink)' }}>
                        <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 16, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--np-n500)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          📢 FRONT OF CLASSROOM (BLACKBOARD)
                        </div>
                        {grid}
                      </div>
                    );
                  })()}
                </>
              )}

              {/* Student Attendance List View */}
              {assistantModeTab === 'list' && (
                <div style={{ border: '1px solid var(--border)', background: '#fff', boxShadow: '4px 4px 0 0 var(--np-ink)' }}>
                  <table style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>Seat</th>
                        <th>Roll No</th>
                        <th>Student Name & PRN</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {localRecords
                        .filter(r => !searchPRN || 
                          r.prn.toLowerCase().includes(searchPRN.toLowerCase()) ||
                          r.roll_no.toLowerCase().includes(searchPRN.toLowerCase()) ||
                          r.student_name.toLowerCase().includes(searchPRN.toLowerCase())
                        )
                        .map(r => (
                          <tr key={r.student_id}>
                            <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>R{r.bench_row}-C{r.bench_col}</td>
                            <td style={{ fontWeight: 600 }}>{r.roll_no}</td>
                            <td>
                              <div style={{ fontWeight: 800 }}>{r.student_name}</div>
                              <div style={{ fontSize: 10, color: 'var(--np-n500)', fontFamily: 'var(--font-mono)' }}>PRN: {r.prn}</div>
                            </td>
                            <td>
                              <span className={`badge ${
                                r.attendance_status === 'present' ? 'badge-success' : (r.attendance_status === 'late' ? 'badge-warning' : 'badge-danger')
                              }`}>
                                {r.attendance_status || 'absent'}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button className="btn btn-sm btn-success" onClick={() => handleMarkAttendance(r.student_id, 'present')} style={{ padding: '2px 6px', minHeight: 22 }}>P</button>
                                <button className="btn btn-sm btn-warning" onClick={() => handleMarkAttendance(r.student_id, 'late')} style={{ padding: '2px 6px', minHeight: 22 }}>L</button>
                                <button className="btn btn-sm btn-danger" onClick={() => handleMarkAttendance(r.student_id, 'absent')} style={{ padding: '2px 6px', minHeight: 22 }}>A</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── SEAT DETAILS QUICK ACTION DRAWER ── */}
      {selectedSeatStudent && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelectedSeatStudent(null)}>
          <div className="modal" style={{ maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 800 }}>Student Seat Details</h3>
              <button onClick={() => setSelectedSeatStudent(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, marginBottom: 20 }}>
              <div>
                <strong>Name:</strong> {selectedSeatStudent.student_name}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div><strong>PRN:</strong> {selectedSeatStudent.prn}</div>
                <div><strong>Roll No:</strong> {selectedSeatStudent.roll_no}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div><strong>Branch:</strong> {selectedSeatStudent.branch}</div>
                <div><strong>Year:</strong> {selectedSeatStudent.year} ({selectedSeatStudent.semester} sem)</div>
              </div>
              <div>
                <strong>Seat Location:</strong> Row {selectedSeatStudent.bench_row}, Column {selectedSeatStudent.bench_col}
              </div>
              <div>
                <strong>Current Status:</strong>{' '}
                <span className={`badge ${
                  selectedSeatStudent.attendance_status === 'present' ? 'badge-success' : (selectedSeatStudent.attendance_status === 'late' ? 'badge-warning' : 'badge-danger')
                }`}>
                  {selectedSeatStudent.attendance_status || 'absent'}
                </span>
              </div>
            </div>

            {/* Actions block */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--np-n500)' }}>Quick Mark Attendance</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                <button 
                  className="btn btn-success" 
                  onClick={() => { handleMarkAttendance(selectedSeatStudent.student_id, 'present'); setSelectedSeatStudent(null); }}
                  style={{ minHeight: 30 }}
                >
                  Present
                </button>
                <button 
                  className="btn btn-warning" 
                  onClick={() => { handleMarkAttendance(selectedSeatStudent.student_id, 'late'); setSelectedSeatStudent(null); }}
                  style={{ minHeight: 30 }}
                >
                  Late
                </button>
                <button 
                  className="btn btn-danger" 
                  onClick={() => { handleMarkAttendance(selectedSeatStudent.student_id, 'absent'); setSelectedSeatStudent(null); }}
                  style={{ minHeight: 30 }}
                >
                  Absent
                </button>
              </div>

              <button 
                onClick={() => {
                  setReportingDuty({
                    slot_id: assistantData.roomAllocation.slot_id,
                    room_allocation_id: assistantRoomAllocationId,
                    room_no: assistantData.roomAllocation.room_no,
                    subject_code: assistantData.roomAllocation.subject_code,
                    subject_name: assistantData.roomAllocation.subject_name
                  });
                  setReplacementPrefillStudent(selectedSeatStudent.prn);
                  setSelectedSeatStudent(null);
                }}
                className="btn btn-danger"
                style={{ marginTop: 8, background: '#FF453A', color: '#fff' }}
              >
                ⚠️ File Malpractice Incident
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODALS INTEGRATION ── */}
      {reportingDuty && (
        <IncidentModal 
          duty={reportingDuty} 
          studentPrnPrefill={replacementPrefillStudent}
          onClose={() => { setReportingDuty(null); setReplacementPrefillStudent(''); }} 
          onReported={async () => {
            fetchIncidents();
            if (assistantData) {
              const res = await api.get(`/supervisors/room-details/${assistantRoomAllocationId}`);
              setAssistantData(prev => ({ ...prev, incidents: res.data.incidents }));
            }
          }}
        />
      )}

      {showQrModal && assistantData && (
        <QrScannerModal 
          roomStudents={localRecords}
          onScanSuccess={(studentId) => handleMarkAttendance(studentId, 'present')}
          onClose={() => setShowQrModal(false)}
        />
      )}

      {showReplacementModal && (
        <ReplacementRequestModal 
          duties={duties.filter(d => d.date >= todayStr)}
          onClose={() => setShowReplacementModal(false)}
          onSubmitSuccess={fetchReplacements}
        />
      )}
    </div>
  );
}









