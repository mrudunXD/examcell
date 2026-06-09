import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, X, Clock, Save, Users, RefreshCw, CheckSquare, Camera, AlertTriangle, FileText, Plus } from 'lucide-react';
import api from '../lib/api.js';
import { formatDate, formatTime } from '../lib/format.js';
import toast from 'react-hot-toast';
import io from 'socket.io-client';

const STATUS_CONFIG = {
  present: { label: 'Present', color: '#166534', bg: '#f0fdf4', border: '#bbf7d0', icon: Check },
  absent:  { label: 'Absent',  color: '#CC0000', bg: '#fff5f5', border: '#fecaca', icon: X },
  late:    { label: 'Late',    color: '#92400e', bg: '#fffbeb', border: '#fde68a', icon: Clock },
};

// Web Audio API Synthesizer helpers
const playSuccessSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.2);
  } catch (e) {
    console.warn('Failed to play success chime:', e);
  }
};

const playFailureSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(196.00, now); // G3
    osc.frequency.setValueAtTime(196.00, now + 0.12); // G3
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.35);
  } catch (e) {
    console.warn('Failed to play failure buzz:', e);
  }
};

export default function AttendancePage() {
  const { slotId } = useParams();
  const [searchParams] = useSearchParams();
  const queryRoomId = searchParams.get('roomAllocationId');

  const [slot, setSlot] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState({ total: 0, present: 0, absent: 0, late: 0, unmarked: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState({});

  // Additional states for extra features
  const [activeTab, setActiveTab] = useState('attendance'); // 'attendance' | 'logs'
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  
  // Barcode scanner modal states
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [scanResult, setScanResult] = useState(null); // { status, message, student }

  // Activity Log Form states
  const [logType, setLogType] = useState('toilet_out');
  const [logStudent, setLogStudent] = useState('');
  const [logDetails, setLogDetails] = useState('');
  const [submittingLog, setSubmittingLog] = useState(false);

  const fetchSlot = async () => {
    try {
      const { data } = await api.get(`/seating/${slotId}`);
      setSlot(data.slot);
      setRooms(data.rooms || []);
      if (data.rooms?.length > 0 && !selectedRoom) {
        const matched = data.rooms.find(r => String(r.room.id) === String(queryRoomId));
        setSelectedRoom(matched ? matched.room.id : data.rooms[0].room.id);
      }
    } catch { toast.error('Failed to load slot'); }
  };

  const fetchAttendance = useCallback(async (roomId) => {
    if (!roomId) return;
    setLoading(true);
    try {
      const [attRes, sumRes] = await Promise.all([
        api.get(`/attendance/${slotId}`, { params: { room_allocation_id: roomId } }),
        api.get(`/attendance/${slotId}/summary`),
      ]);
      setRecords(attRes.data);
      setSummary(sumRes.data);
    } catch { toast.error('Failed to load attendance'); }
    finally { setLoading(false); }
  }, [slotId]);

  const fetchLogs = useCallback(async (roomId) => {
    if (!roomId) return;
    setLoadingLogs(true);
    try {
      const { data } = await api.get(`/attendance-logs/${slotId}`, {
        params: { room_allocation_id: roomId }
      });
      setLogs(data);
    } catch {
      toast.error('Failed to load activity logs');
    } finally {
      setLoadingLogs(false);
    }
  }, [slotId]);

  useEffect(() => { fetchSlot(); }, [slotId]);
  useEffect(() => { 
    if (selectedRoom) {
      fetchAttendance(selectedRoom);
      if (activeTab === 'logs') {
        fetchLogs(selectedRoom);
      }
    }
  }, [selectedRoom, activeTab, fetchAttendance, fetchLogs]);

  // Real-time socket events for invigilator logs
  useEffect(() => {
    if (!selectedRoom) return;

    const socketUrl = window.location.origin.includes('5173')
      ? 'http://localhost:5000'
      : window.location.origin;

    const socket = io(socketUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    socket.on('INVIGILATOR_LOG_ADDED', (newLog) => {
      if (String(newLog.room_allocation_id) === String(selectedRoom)) {
        setLogs(prev => {
          if (prev.some(l => l.id === newLog.id)) return prev;
          return [newLog, ...prev];
        });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedRoom]);

  const markStatus = (studentId, status) => {
    setRecords(prev => prev.map(r => r.student_id === studentId ? { ...r, attendance_status: status } : r));
    setDirty(prev => ({ ...prev, [studentId]: true }));
  };

  const markAll = (status) => {
    setRecords(prev => prev.map(r => ({ ...r, attendance_status: status })));
    const newDirty = {};
    records.forEach(r => { newDirty[r.student_id] = true; });
    setDirty(newDirty);
  };

  const saveAttendance = async () => {
    setSaving(true);
    try {
      const toSave = records.filter(r => dirty[r.student_id] || r.attendance_status).map(r => ({
        student_id: r.student_id,
        room_allocation_id: r.seated_room || selectedRoom,
        status: r.attendance_status || 'absent',
        notes: r.notes || null,
      }));
      await api.post(`/attendance/${slotId}`, { records: toSave });
      setDirty({});
      toast.success(`Saved ${toSave.length} attendance records`);
      fetchAttendance(selectedRoom);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save attendance');
    } finally { setSaving(false); }
  };

  const handleScanSubmit = async (e) => {
    if (e) e.preventDefault();
    const term = scanInput.trim().toUpperCase();
    if (!term) return;

    // 1. Search locally in this room
    const studentInRoom = records.find(r => 
      r.prn.toUpperCase() === term || 
      r.roll_no.toUpperCase() === term
    );

    if (studentInRoom) {
      markStatus(studentInRoom.student_id, 'present');
      setScanResult({
        status: 'success',
        message: `${studentInRoom.name} (${studentInRoom.roll_no}) marked Present successfully!`,
        student: studentInRoom
      });
      playSuccessSound();
      setScanInput('');

      // Auto-save this record to the server instantly
      try {
        await api.post(`/attendance/${slotId}`, {
          records: [{
            student_id: studentInRoom.student_id,
            room_allocation_id: selectedRoom,
            status: 'present',
            notes: 'Verified via Barcode Scanner'
          }]
        });
        setDirty(prev => {
          const next = { ...prev };
          delete next[studentInRoom.student_id];
          return next;
        });
        // Refresh summary count
        const sumRes = await api.get(`/attendance/${slotId}/summary`);
        setSummary(sumRes.data);
      } catch (err) {
        console.error('Auto-save failed:', err);
      }
      return;
    }

    // 2. Search in other rooms for this slot
    let foundRoom = null;
    let foundStudent = null;

    for (const r of rooms) {
      const match = r.assignments.find(a => 
        a.prn.toUpperCase() === term || 
        a.roll_no.toUpperCase() === term
      );
      if (match) {
        foundRoom = r.room;
        foundStudent = match;
        break;
      }
    }

    if (foundStudent && foundRoom) {
      setScanResult({
        status: 'redirect',
        message: `WRONG ROOM ALERT! Candidate ${foundStudent.student_name} is registered for this slot but is allocated to Room ${foundRoom.room_no} (${foundRoom.block || ''}) at Bench R${foundStudent.bench_row}-C${foundStudent.bench_col}.`,
        student: foundStudent
      });
      playFailureSound();
      return;
    }

    // 3. Candidate not registered in this slot at all
    setScanResult({
      status: 'not_found',
      message: `CANDIDATE NOT SCHEDULED! PRN/Roll No "${term}" is not registered in any room for this exam slot.`
    });
    playFailureSound();
  };

  const handleAddLog = async (e) => {
    e.preventDefault();
    if (!selectedRoom) return;

    setSubmittingLog(true);
    try {
      const typeLabel = logType === 'toilet_out' ? 'Restroom (Out)' :
                        logType === 'toilet_in' ? 'Restroom (In)' :
                        logType === 'extra_booklet' ? 'Extra Booklet Issued' :
                        logType === 'relief_handover' ? 'Supervisor Handover' : 'Other Activity';

      const details = logDetails.trim() || `${typeLabel} logged by invigilator.`;
      
      const payload = {
        room_allocation_id: selectedRoom,
        type: logType,
        student_id: logStudent || null,
        details
      };

      const { data } = await api.post(`/attendance-logs/${slotId}`, payload);
      setLogs(prev => [data, ...prev]);
      toast.success('Activity logged successfully');
      setLogStudent('');
      setLogDetails('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit log');
    } finally {
      setSubmittingLog(false);
    }
  };

  const hasDirty = Object.keys(dirty).length > 0;

  if (!slot && loading) return <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>;

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="flex-row" style={{ gap: 6, marginBottom: 8 }}>
            <Link to="/exam-cycles" className="btn btn-ghost btn-sm">
              <ArrowLeft size={12} strokeWidth={1.5} /> Cycles
            </Link>
          </div>
          <div className="accent-bar" />
          <h1 className="page-title">Attendance Marking</h1>
          <p className="page-subtitle">
            {slot?.subject_code} — {slot?.subject_name} · {formatDate(slot?.date)} · {formatTime(slot?.start_time)}
          </p>
        </div>
        <div className="flex-row" style={{ gap: 8 }}>
          <button 
            className="btn btn-warning" 
            onClick={() => { setScannerOpen(true); setScanResult(null); setScanInput(''); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Camera size={13} strokeWidth={1.5} /> Launch Barcode Scanner
          </button>
          {hasDirty && (
            <button className="btn btn-primary" onClick={saveAttendance} disabled={saving}>
              {saving ? <div className="spinner spinner-invert" style={{ width: 14, height: 14 }} /> : <Save size={13} strokeWidth={1.5} />}
              Save Changes
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => { fetchAttendance(selectedRoom); if (activeTab === 'logs') fetchLogs(selectedRoom); }}>
            <RefreshCw size={12} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="attendance-summary-bar">
        {[
          { label: 'Total',    value: summary.total,    color: '#111' },
          { label: 'Present',  value: summary.present,  color: '#166534' },
          { label: 'Absent',   value: summary.absent,   color: '#CC0000' },
          { label: 'Late',     value: summary.late,     color: '#92400e' },
          { label: 'Unmarked', value: summary.unmarked, color: '#A3A3A3' },
        ].map((item) => (
          <div key={item.label} className="attendance-summary-item">
            <div style={{ fontSize: 22, fontWeight: 700, color: item.color, fontFamily: 'var(--font-mono)' }}>{item.value}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--np-n500)', marginTop: 2 }}>{item.label}</div>
          </div>
        ))}
      </div>

      <div className="attendance-main-layout">
        {/* Room selector */}
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--np-n500)', marginBottom: 10, borderBottom: '1px solid #E5E5E0', paddingBottom: 6 }}>
            Rooms
          </div>
          <div className="attendance-rooms-container">
            {rooms.map(item => (
              <button
                key={item.room.id}
                onClick={() => setSelectedRoom(item.room.id)}
                className={`attendance-room-btn ${selectedRoom === item.room.id ? 'active' : ''}`}
              >
                {item.room.room_no}
                <div className="btn-subtext" style={{ fontSize: 9, opacity: 0.65, marginTop: 2 }}>{item.assignments?.length || 0} students</div>
              </button>
            ))}
          </div>
        </div>

        {/* Right side: Tabs & Panels */}
        <div>
          {/* Tab buttons */}
          <div style={{ display: 'flex', borderBottom: '2px solid #111111', marginBottom: 16 }}>
            <button
              onClick={() => setActiveTab('attendance')}
              style={{
                padding: '8px 16px',
                fontFamily: 'var(--font-serif)',
                fontSize: 14,
                fontWeight: 700,
                border: 'none',
                borderBottom: activeTab === 'attendance' ? '4px solid #111111' : 'none',
                background: activeTab === 'attendance' ? '#111111' : 'transparent',
                color: activeTab === 'attendance' ? '#F9F9F7' : '#525252',
                cursor: 'pointer',
                transition: 'all 0.12s',
              }}
            >
              Student Attendance Register
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              style={{
                padding: '8px 16px',
                fontFamily: 'var(--font-serif)',
                fontSize: 14,
                fontWeight: 700,
                border: 'none',
                borderBottom: activeTab === 'logs' ? '4px solid #111111' : 'none',
                background: activeTab === 'logs' ? '#111111' : 'transparent',
                color: activeTab === 'logs' ? '#F9F9F7' : '#525252',
                cursor: 'pointer',
                transition: 'all 0.12s',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <FileText size={14} /> Invigilator Activity Log
            </button>
          </div>

          {/* TAB 1: Attendance marking register */}
          {activeTab === 'attendance' && (
            <div>
              {/* Bulk actions */}
              <div className="flex-row" style={{ gap: 8, marginBottom: 12 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--np-n500)', marginRight: 4 }}>
                  Bulk:
                </span>
                <button className="btn btn-ghost btn-sm" onClick={() => markAll('present')} style={{ color: '#166534', borderColor: '#166534' }}>
                  <CheckSquare size={11} strokeWidth={1.5} /> All Present
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => markAll('absent')} style={{ color: '#CC0000', borderColor: '#CC0000' }}>
                  <X size={11} strokeWidth={1.5} /> All Absent
                </button>
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: 32 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
              ) : records.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--np-n500)', fontStyle: 'italic', fontFamily: 'var(--font-body)' }}>
                  No students in this room, or no seating generated yet.
                </div>
              ) : (
                <div style={{ border: '1px solid #E5E5E0' }}>
                  {records.map((student, i) => {
                    const status = student.attendance_status || null;
                    const isDirty = dirty[student.student_id];
                    return (
                      <div key={student.student_id} className={`attendance-student-row ${isDirty ? 'dirty' : ''}`} style={{
                        borderBottom: i < records.length - 1 ? '1px solid #E5E5E0' : 'none',
                      }}>
                      <div className="attendance-student-header">
                        <div className="attendance-student-seat">
                          R{student.bench_row}<br/>C{student.bench_col}
                        </div>
                        <div className="attendance-student-info">
                          <div style={{ fontWeight: 600, fontSize: 12 }}>{student.name}</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--np-n500)', marginTop: 1 }}>
                            {student.prn} · {student.roll_no} · {student.branch} {student.year}
                          </div>
                        </div>
                      </div>
                      
                      <div className="attendance-student-actions">
                        <div className="attendance-status-container">
                          {['present', 'late', 'absent'].map(s => {
                            const cfg = STATUS_CONFIG[s];
                            const Icon = cfg.icon;
                            const isActive = status === s;
                            return (
                              <button
                                key={s}
                                onClick={() => markStatus(student.student_id, s)}
                                title={cfg.label}
                                style={{
                                  padding: '5px 10px', border: `1px solid ${isActive ? cfg.color : '#E5E5E0'}`,
                                  background: isActive ? cfg.bg : 'transparent',
                                  color: isActive ? cfg.color : '#A3A3A3',
                                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                                  fontFamily: 'var(--font-mono)', fontSize: 9,
                                  transition: 'all 0.1s',
                                }}
                              >
                                <Icon size={10} strokeWidth={2} />
                                {cfg.label}
                              </button>
                            );
                          })}
                        </div>
                        {student.marked_by_name && (
                          <div className="attendance-marked-by">
                            by {student.marked_by_name}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            </div>
          )}

          {/* TAB 2: Invigilator Log */}
          {activeTab === 'logs' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
              {/* Timeline panel */}
              <div style={{ border: '2px solid #111111', background: '#FFF', padding: 20, boxShadow: '4px 4px 0 0 #111111' }}>
                <h3 style={{ fontFamily: 'var(--font-serif)', margin: '0 0 16px 0', borderBottom: '2px solid #111111', paddingBottom: 8 }}>
                  Room Activity Timeline
                </h3>
                
                {loadingLogs ? (
                  <div style={{ textAlign: 'center', padding: 24 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
                ) : logs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 32, color: 'var(--np-n500)', fontStyle: 'italic', fontFamily: 'var(--font-body)', fontSize: 13 }}>
                    No activities logged for this classroom yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '420px', overflowY: 'auto' }} className="custom-scrollbar">
                    {logs.map((log) => {
                      let typeColor = '#525252';
                      if (log.type === 'toilet_out') typeColor = '#92400e';
                      if (log.type === 'toilet_in') typeColor = '#166534';
                      if (log.type === 'extra_booklet') typeColor = '#1d4ed8';

                      return (
                        <div key={log.id} style={{ display: 'flex', gap: 10, borderBottom: '1px solid #E5E5E0', paddingBottom: 10 }}>
                          <div style={{
                            width: 6, alignSelf: 'stretch', background: typeColor, flexShrink: 0
                          }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{
                                fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
                                color: typeColor, border: `1px solid ${typeColor}`, padding: '1px 6px'
                              }}>
                                {log.type.replace('_', ' ')}
                              </span>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--np-n500)' }}>
                                {new Date(log.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                            </div>
                            
                            <div style={{ fontSize: 12, marginTop: 4, fontWeight: 600, color: '#111' }}>
                              {log.details}
                            </div>
                            
                            {log.student_name && (
                              <div style={{ fontSize: 9, color: 'var(--np-n500)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
                                Candidate: {log.student_name} ({log.student_roll}) · PRN: {log.student_prn}
                              </div>
                            )}
                            
                            <div style={{ fontSize: 9, color: 'var(--np-n400)', marginTop: 2, fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
                              Logged by: {log.logged_by_name}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Log entry composer */}
              <div style={{ border: '2px solid #111111', background: '#F9F9F7', padding: 20, boxShadow: '4px 4px 0 0 #111111', position: 'sticky', top: 10 }}>
                <h4 style={{ fontFamily: 'var(--font-serif)', margin: '0 0 16px 0', borderBottom: '2px solid #111111', paddingBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Plus size={16} /> Add Log Entry
                </h4>
                
                <form onSubmit={handleAddLog} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Activity Type</label>
                    <select className="select" value={logType} onChange={e => { setLogType(e.target.value); setLogDetails(''); }} style={{ fontSize: 12 }}>
                      <option value="toilet_out">Restroom OUT</option>
                      <option value="toilet_in">Restroom IN</option>
                      <option value="extra_booklet">Extra Answer Booklet</option>
                      <option value="relief_handover">Supervisor Handover</option>
                      <option value="other">General Activity / Note</option>
                    </select>
                  </div>

                  {['toilet_out', 'toilet_in', 'extra_booklet'].includes(logType) && (
                    <div className="form-group">
                      <label className="form-label">Target Student</label>
                      <select 
                        className="select" 
                        value={logStudent} 
                        onChange={e => setLogStudent(e.target.value)} 
                        required
                        style={{ fontSize: 12 }}
                      >
                        <option value="">-- Select Student --</option>
                        {records.map(r => (
                          <option key={r.student_id} value={r.student_id}>
                            {r.roll_no} - {r.name.slice(0, 18)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Details / Notes</label>
                    <textarea
                      className="input"
                      placeholder={
                        logType === 'toilet_out' ? 'e.g. Restroom log (leaving room)' :
                        logType === 'toilet_in' ? 'e.g. Returned to desk' :
                        logType === 'extra_booklet' ? 'Enter booklet serial number...' :
                        'Enter handover details or event description...'
                      }
                      style={{ minHeight: 60, resize: 'vertical', fontSize: 12 }}
                      value={logDetails}
                      onChange={e => setLogDetails(e.target.value)}
                      required={logType === 'extra_booklet' || logType === 'other' || logType === 'relief_handover'}
                    />
                  </div>

                  <button type="submit" className="btn btn-primary" disabled={submittingLog} style={{ width: '100%', justifyContent: 'center' }}>
                    {submittingLog ? 'Logging...' : 'Submit Log Entry'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Barcode scanner dialog */}
      {scannerOpen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setScannerOpen(false)}>
          <div className="modal" style={{ maxWidth: '480px', border: '4px solid #111111', boxShadow: '8px 8px 0 0 #111111' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '2px solid #111111', paddingBottom: 10 }}>
              <h2 className="modal-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                📷 Ticket scanner
              </h2>
              <button className="btn btn-ghost btn-sm" onClick={() => setScannerOpen(false)} style={{ padding: 4 }}>
                <X size={16} />
              </button>
            </div>

            {/* Canvas laser animated area */}
            <div style={{
              background: '#000',
              height: '180px',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              border: '2px solid #111',
              marginBottom: 16
            }}>
              {/* Laser animation */}
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0,
                height: '3px',
                background: 'red',
                boxShadow: '0 0 8px 2px red',
                animation: 'scanLaser 2s infinite ease-in-out'
              }} />

              {/* Aiming square */}
              <div style={{ width: '100px', height: '100px', border: '2px dashed rgba(255,255,255,0.6)', position: 'relative' }}>
                <div style={{ position: 'absolute', top: -3, left: -3, width: 15, height: 15, borderTop: '3px solid red', borderLeft: '3px solid red' }} />
                <div style={{ position: 'absolute', top: -3, right: -3, width: 15, height: 15, borderTop: '3px solid red', borderRight: '3px solid red' }} />
                <div style={{ position: 'absolute', bottom: -3, left: -3, width: 15, height: 15, borderBottom: '3px solid red', borderLeft: '3px solid red' }} />
                <div style={{ position: 'absolute', bottom: -3, right: -3, width: 15, height: 15, borderBottom: '3px solid red', borderRight: '3px solid red' }} />
              </div>
              
              <div style={{ color: '#fff', fontSize: 10, position: 'absolute', bottom: 8, fontFamily: 'var(--font-mono)', opacity: 0.8 }}>
                VERIFICATION CAMERA STATUS: ACTIVE
              </div>
            </div>

            {/* Manual scan input */}
            <form onSubmit={handleScanSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span>Scan or Type PRN / Roll Number</span>
                  <span style={{ fontSize: 9, opacity: 0.6 }}>Emulates hardware laser scanner</span>
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    className="input"
                    placeholder="Scan barcode or type PRN..."
                    value={scanInput}
                    onChange={e => setScanInput(e.target.value)}
                    autoFocus
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
                  />
                  <button type="submit" className="btn btn-primary btn-sm">Verify</button>
                </div>
              </div>
            </form>

            {/* Results validation panel */}
            {scanResult && (
              <div style={{
                marginTop: 16,
                padding: 14,
                border: '2px solid #111111',
                background: scanResult.status === 'success' ? '#f0fdf4' : scanResult.status === 'redirect' ? '#fff5f5' : '#f8fafc',
                color: scanResult.status === 'success' ? '#166534' : scanResult.status === 'redirect' ? '#991b1b' : '#334155',
                animation: 'fadeIn 0.2s ease-out',
                boxShadow: '4px 4px 0 0 #111111'
              }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  {scanResult.status === 'success' ? (
                    <Check size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                  ) : (
                    <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2, color: scanResult.status === 'redirect' ? '#991b1b' : '#334155' }} />
                  )}
                  <div>
                    <div style={{ fontWeight: 800, textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.05em' }}>
                      {scanResult.status === 'success' ? 'Verification Passed' : scanResult.status === 'redirect' ? 'Wrong Room Redirection!' : 'Warning: Entry Denied'}
                    </div>
                    <div style={{ fontSize: 12, marginTop: 4, fontWeight: 600, lineHeight: 1.3 }}>
                      {scanResult.message}
                    </div>
                    {scanResult.student && (
                      <div style={{ fontSize: 10, marginTop: 8, fontFamily: 'var(--font-mono)', background: 'rgba(0,0,0,0.05)', padding: '6px 10px', border: '1px solid rgba(0,0,0,0.1)' }}>
                        Candidate Name: {scanResult.student.student_name || scanResult.student.name} <br/>
                        PRN: {scanResult.student.prn} · Roll No: {scanResult.student.roll_no}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            <div style={{ marginTop: 16, fontSize: 10, color: '#666', fontStyle: 'italic', textAlign: 'center' }}>
              Press ESC or click outside to exit scan window.
            </div>
          </div>
        </div>
      )}

      <style>{`
        .attendance-summary-bar {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 0;
          border: 1px solid #111;
          margin-bottom: 24px;
        }
        .attendance-summary-item {
          padding: 12px 16px;
          border-right: 1px solid #E5E5E0;
          text-align: center;
        }
        .attendance-summary-item:last-child {
          border-right: none;
        }

        .attendance-main-layout {
          display: grid;
          grid-template-columns: 200px 1fr;
          gap: 20px;
        }
        .attendance-rooms-container {
          display: flex;
          flex-direction: column;
        }
        .attendance-room-btn {
          display: block;
          width: 100%;
          padding: 10px 14px;
          margin-bottom: 4px;
          border: 2px solid #E5E5E0;
          background: transparent;
          color: #111;
          text-align: left;
          cursor: pointer;
          font-family: var(--font-mono);
          font-size: 11px;
        }
        .attendance-room-btn.active {
          border-color: #111;
          background: #111;
          color: #F9F9F7;
        }

        .attendance-student-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 14px;
          background: transparent;
        }
        .attendance-student-row.dirty {
          background: #FFFBF0;
        }
        .attendance-student-header {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
          min-width: 0;
        }
        .attendance-student-seat {
          font-family: var(--font-mono);
          font-size: 9px;
          color: var(--np-n400);
          width: 36px;
          text-align: center;
          flex-shrink: 0;
        }
        .attendance-student-info {
          flex: 1;
          min-width: 0;
        }
        .attendance-student-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
        }
        .attendance-status-container {
          display: flex;
          gap: 4px;
        }
        .attendance-marked-by {
          font-family: var(--font-mono);
          font-size: 9px;
          color: var(--np-n400);
          flex-shrink: 0;
        }

        @keyframes scanLaser {
          0%, 100% { top: 0%; }
          50% { top: 100%; }
        }

        @media (max-width: 768px) {
          .attendance-summary-bar {
            grid-template-columns: repeat(3, 1fr);
          }
          .attendance-summary-item {
            padding: 8px 12px;
          }
          .attendance-summary-item:nth-child(3) {
            border-right: none;
          }
          .attendance-summary-item:nth-child(4) {
            border-bottom: none;
          }
          .attendance-summary-item:nth-child(5) {
            border-right: none;
            border-bottom: none;
          }

          .attendance-main-layout {
            grid-template-columns: 1fr;
            gap: 16px;
          }
          .attendance-rooms-container {
            flex-direction: row;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 12px;
          }
          .attendance-room-btn {
            width: auto;
            margin-bottom: 0;
            padding: 8px 12px;
          }

          .attendance-student-row {
            flex-direction: column;
            align-items: stretch;
            padding: 12px;
            gap: 10px;
          }
          .attendance-student-header {
            width: 100%;
          }
          .attendance-student-actions {
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
            border-top: 1px dashed #E5E5E0;
            padding-top: 8px;
          }
          .attendance-status-container {
            flex: 1;
          }
          .attendance-status-container button {
            flex: 1;
            justify-content: center;
          }
        }

        @media (max-width: 480px) {
          .attendance-summary-bar {
            grid-template-columns: repeat(2, 1fr);
          }
          .attendance-summary-item {
            border-right: 1px solid #E5E5E0;
            border-bottom: 1px solid #E5E5E0;
          }
          .attendance-summary-item:nth-child(even) {
            border-right: none;
          }
          .attendance-summary-item:nth-child(5) {
            grid-column: span 2;
            border-right: none;
            border-bottom: none;
          }
        }
      `}</style>
    </div>
  );
}
