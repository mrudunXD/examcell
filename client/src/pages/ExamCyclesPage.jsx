import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Grid3x3, UserCog, Wifi, Monitor, Users, AlertTriangle, Calendar, Loader, Copy, CalendarDays, Info, Activity, Search, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../lib/api.js';
import { formatDate, formatTime } from '../lib/format.js';
import toast from 'react-hot-toast';
import { useAppStore } from '../store/index.js';
import { useAuthStore } from '../store/index.js';
import CountUp from '../components/ReactBits/CountUp.jsx';
import SpotlightCard from '../components/ReactBits/SpotlightCard.jsx';
import DecryptedText from '../components/ReactBits/DecryptedText.jsx';

const STATUSES = ['draft', 'active', 'finalised', 'archived'];
const STATUS_ACCENT = { draft: '#767680', active: '#7c3aed', finalised: '#10b981', archived: 'var(--text-secondary)' };
const TYPE_ACCENT   = { regular: '#10b981', backlog: '#FF453A' };
const MODE_ACCENT   = { offline: '#A1A1AA', online: '#7c3aed' };

// ── Cycle Modal ──────────────────────────────────────────────────────────────
function CycleModal({ cycle, onClose, onSave }) {
  const [form, setForm] = useState(cycle
    ? { name: cycle.name, start_date: cycle.start_date, end_date: cycle.end_date, status: cycle.status, semester_type: cycle.semester_type || 'odd', version: cycle.version }
    : { name: '', start_date: '', end_date: '', semester_type: 'odd' }
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      cycle?.id ? await api.put(`/exam-cycles/${cycle.id}`, form) : await api.post('/exam-cycles', form);
      toast.success(cycle?.id ? 'Cycle updated' : 'Cycle created');
      onSave(); onClose();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2 className="modal-title">{cycle?.id ? 'Edit Exam Cycle' : 'New Exam Cycle'}</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Cycle Name *</label>
            <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="End Sem June 2026" />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Start Date *</label>
              <input className="input" type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">End Date *</label>
              <input className="input" type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} required />
            </div>
          </div>
          {/* Semester Type */}
          <div className="form-group">
            <label className="form-label">Semester Type *</label>
            <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)' }}>
              {['odd', 'even'].map(t => (
                <button key={t} type="button" onClick={() => setForm({ ...form, semester_type: t })}
                  style={{
                    flex: 1, padding: '8px 0', border: 'none',
                    background: form.semester_type === t ? 'var(--text-primary)' : 'transparent',
                    color: form.semester_type === t ? 'var(--bg-base)' : 'var(--text-secondary)',
                    fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em',
                    cursor: 'pointer',
                  }}>
                  {t === 'odd' ? 'Odd (Sem 1, 3, 5, 7)' : 'Even (Sem 2, 4, 6, 8)'}
                </button>
              ))}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-tertiary)', marginTop: 4 }}>
              Only subjects belonging to the selected semester parity can be added as slots.
            </div>
          </div>
          {cycle?.id && (
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                {STATUSES.map(s => <option key={s} value={s} style={{ textTransform: 'capitalize' }}>{s}</option>)}
              </select>
            </div>
          )}
          <div className="flex-row" style={{ justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <div className="spinner spinner-invert" style={{ width: 14, height: 14 }} /> : (cycle?.id ? 'Update' : 'Create Cycle')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Slot Modal ───────────────────────────────────────────────────────────────
function SlotModal({ cycleId, cycle, slot, onClose, onSave }) {
  const [subjects, setSubjects] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [form, setForm] = useState(slot ? {
    subject_id: slot.subject_id, date: slot.date, start_time: slot.start_time,
    duration_mins: slot.duration_mins, classroom_ids: slot.rooms?.map(r => r.classroom_id) || [],
    exam_type: slot.exam_type || 'regular', exam_mode: slot.exam_mode || 'offline',
    version: slot.version
  } : { subject_id: '', date: '', start_time: '10:00', duration_mins: 180, classroom_ids: [], exam_type: 'regular', exam_mode: 'offline' });
  const [saving, setSaving] = useState(false);
  const [autoCount, setAutoCount] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get(`/exam-cycles/${cycleId}/valid-subjects`),
      api.get('/classrooms'),
    ]).then(([sr, cr]) => { setSubjects(sr.data); setClassrooms(cr.data); });
  }, [cycleId]);

  useEffect(() => {
    if (!form.subject_id) { setAutoCount(null); return; }
    const subj = subjects.find(s => s.id === form.subject_id);
    if (!subj) return;
    api.get('/students', { params: { branch: subj.branch, year: subj.year } })
      .then(r => setAutoCount(r.data.length));
  }, [form.subject_id, subjects]);

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      slot?.id ? await api.put(`/exam-cycles/${cycleId}/slots/${slot.id}`, form) : await api.post(`/exam-cycles/${cycleId}/slots`, form);
      toast.success(slot?.id ? 'Slot updated' : 'Slot added to cycle');
      onSave(); onClose();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  };

  const handleRoomToggle = (roomId) => {
    setForm(prev => {
      const next = prev.classroom_ids.includes(roomId)
        ? prev.classroom_ids.filter(id => id !== roomId)
        : [...prev.classroom_ids, roomId];
      return { ...prev, classroom_ids: next };
    });
  };

  const totalCap = classrooms.filter(c => form.classroom_ids.includes(c.id)).reduce((s, r) => s + (r.capacity || 0), 0);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" style={{ maxWidth: 840 }}>
        <h2 className="modal-title">{slot?.id ? 'Edit Exam Slot' : 'Add Exam Slot'}</h2>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Cycle: {cycle?.name} ({cycle?.semester_type || 'odd'}-sem parity)
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24 }}>
          {/* Left panel: Info form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Subject *</label>
              <select className="select" value={form.subject_id} onChange={e => setForm({ ...form, subject_id: e.target.value })} required>
                <option value="">-- Choose Valid Subject --</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name} ({s.branch} · {s.year})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Date *</label>
                <input className="input" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Start Time *</label>
                <input className="input" type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} required />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Duration (Mins) *</label>
                <input className="input" type="number" min={30} value={form.duration_mins} onChange={e => setForm({ ...form, duration_mins: parseInt(e.target.value) })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Exam Mode *</label>
                <select className="select" value={form.exam_mode} onChange={e => setForm({ ...form, exam_mode: e.target.value })}>
                  <option value="offline">Offline (Halls Grid)</option>
                  <option value="online">Online (Computer Kiosks)</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Exam Classification *</label>
              <select className="select" value={form.exam_type} onChange={e => setForm({ ...form, exam_type: e.target.value })}>
                <option value="regular">Regular Curriculum Slot</option>
                <option value="backlog">Backlog Remedial Slot</option>
              </select>
            </div>

            {autoCount != null && (
              <div className="alert alert-info" style={{ marginTop: 8 }}>
                Expected student count: <strong>{autoCount}</strong> (enrolled in matching Branch + Year)
              </div>
            )}
          </div>

          {/* Right panel: Rooms grid */}
          <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border)', paddingLeft: 24, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
              <span className="form-label" style={{ margin: 0 }}>Classrooms Allocation</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: totalCap < (autoCount || 0) ? 'var(--accent-red)' : 'var(--accent-green)' }}>
                Allocated Capacity: {totalCap} / {autoCount || 0}
              </span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', maxHeight: '280px', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 4 }} className="custom-scrollbar">
              {classrooms.map(c => {
                const checked = form.classroom_ids.includes(c.id);
                return (
                  <label key={c.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                    border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer',
                    background: checked ? 'rgba(255,255,255,0.02)' : 'transparent',
                    transition: 'all 0.1s'
                  }}>
                    <input type="checkbox" checked={checked} onChange={() => handleRoomToggle(c.id)} style={{ cursor: 'pointer' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{c.room_no} ({c.block})</div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Capacity: {c.capacity} · {c.bench_rows}R × {c.bench_cols}C</div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div className="flex-row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : (slot?.id ? 'Update Slot' : 'Add Slot')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── SlotList Helper Component ───────────────────────────────────────────────
function SlotList({ slots, cycleId, isCoord, onEdit, onDel, onExplain }) {
  const [activeSlotMenuId, setActiveSlotMenuId] = useState(null);
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {slots.map((slot) => (
        <div key={slot.id} style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
          background: 'rgba(255, 255, 255, 0.01)', border: '1px solid var(--border)', borderRadius: 8,
          transition: 'background 0.1s'
        }}>
          {/* Accent block line */}
          <div style={{ width: 4, height: 32, flexShrink: 0, background: TYPE_ACCENT[slot.exam_type] || '#111', borderRadius: 2 }} />
          
          {/* Mode icon */}
          <div style={{ color: MODE_ACCENT[slot.exam_mode], flexShrink: 0 }}>
            {slot.exam_mode === 'online' ? <Wifi size={12} strokeWidth={1.5} /> : <Monitor size={12} strokeWidth={1.5} />}
          </div>
          
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {slot.subject_code} — {slot.subject_name}
              {slot.abbreviation && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-secondary)', marginLeft: 6 }}>({slot.abbreviation})</span>
              )}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {formatDate(slot.date)} · {formatTime(slot.start_time)} · {slot.duration_mins}min ·{' '}
              {slot.rooms?.map(r => r.room_no).join(', ') || (slot.exam_mode === 'online' ? 'Online' : 'No rooms')} ·{' '}
              {slot.student_count} students
              {slot.course_type && <span style={{ marginLeft: 6, color: 'var(--text-tertiary)' }}>{slot.course_type}</span>}
            </div>
          </div>
          
          <div className="flex-row" style={{ gap: 4, position: 'relative' }}>
            {slot.exam_mode === 'offline' && (
              <Link to={`/seating/${slot.id}`} className="btn btn-ghost btn-sm" style={{ fontSize: 10, height: 26, minHeight: 26 }}>
                <Grid3x3 size={11} strokeWidth={1.5} /> Seating
              </Link>
            )}
            <Link to={`/supervisors/${slot.id}`} className="btn btn-ghost btn-sm" style={{ fontSize: 10, height: 26, minHeight: 26 }}>
              <UserCog size={11} strokeWidth={1.5} /> Supervisors
            </Link>
            <Link to={`/attendance/${slot.id}`} className="btn btn-ghost btn-sm" style={{ fontSize: 10, height: 26, minHeight: 26 }}>
              <Users size={11} strokeWidth={1.5} /> Attendance
            </Link>
            <button className="btn btn-ghost btn-sm" onClick={() => onExplain(slot.id)} style={{ fontSize: 10, height: 26, minHeight: 26 }}>
              <Info size={11} strokeWidth={1.5} /> Explain
            </button>
            
            {isCoord && (
              <>
                <button className="btn btn-ghost btn-icon btn-sm" style={{ border: 'none', background: 'transparent' }} onClick={() => setActiveSlotMenuId(activeSlotMenuId === slot.id ? null : slot.id)}>
                  <span style={{ fontSize: 16, fontWeight: 'bold' }}>···</span>
                </button>
                {activeSlotMenuId === slot.id && (
                  <>
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }} onClick={() => setActiveSlotMenuId(null)} />
                    <div style={{
                      position: 'absolute', right: 0, top: 28, zIndex: 999,
                      background: 'var(--bg-surface)', border: '1px solid var(--border)',
                      borderRadius: 6, padding: '4px 0', minWidth: 100,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.5)', textAlign: 'left'
                    }}>
                      <button onClick={() => { onEdit(slot); setActiveSlotMenuId(null); }} style={{ display: 'block', width: '100%', padding: '6px 12px', background: 'none', border: 'none', textAlign: 'left', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 12 }}>Edit Slot</button>
                      <button onClick={() => { onDel(slot.id); setActiveSlotMenuId(null); }} style={{ display: 'block', width: '100%', padding: '6px 12px', background: 'none', border: 'none', textAlign: 'left', color: 'var(--accent-red)', cursor: 'pointer', fontSize: 12 }}>Delete</button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Explain Modal ────────────────────────────────────────────────────────────
function ExplainModal({ cycleId, slotId, onClose }) {
  const [explanation, setExplanation] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/exam-cycles/${cycleId}/slots/${slotId}/explain`)
      .then(r => {
        setExplanation(r.data);
        setLoading(false);
      })
      .catch(() => {
        toast.error('Failed to load decision explanation');
        onClose();
      });
  }, [cycleId, slotId]);

  if (loading) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" style={{ maxWidth: 450, display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: '100%', maxWidth: 500, padding: 24 }}>
        <h2 className="modal-title" style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 16 }}>
          Decision Explanation
        </h2>
        <div style={{ fontSize: 13, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: 'var(--text-primary)' }}>
            {explanation.subjectCode} — {explanation.subjectName}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Branch: {explanation.branch} · Year: {explanation.year} · Date: {explanation.date} · Time: {explanation.startTime}
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', borderLeft: '3px solid var(--accent-purple)', padding: 12, fontFamily: 'var(--font-body)', fontStyle: 'italic', lineHeight: 1.5, marginBottom: 20 }}>
            "{explanation.summary}"
          </div>

          <div style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 10, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', paddingBottom: 4, marginBottom: 10 }}>
            Rule & Soft Constraint Validations
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {explanation.checks.map((c, idx) => (
              <div key={idx} style={{ border: '1px solid var(--border)', padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-primary)' }}>{c.rule}</span>
                  <span style={{ 
                    fontSize: 8, 
                    fontWeight: 800, 
                    padding: '2px 6px', 
                    border: `1px solid ${c.status === 'PASS' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    background: c.status === 'PASS' ? 'rgba(16,185,129,0.05)' : 'rgba(239,68,68,0.05)',
                    color: c.status === 'PASS' ? '#34d399' : '#f87171',
                    borderRadius: 4
                  }}>
                    {c.status}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{c.description}</p>
              </div>
            ))}
          </div>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <button className="btn btn-primary btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── ExamCyclesPage Component ─────────────────────────────────────────────────
export default function ExamCyclesPage() {
  const [cycles, setCycles] = useState([]);
  const [slotsMap, setSlotsMap] = useState({});
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSemType, setFilterSemType] = useState('');
  const [modal, setModal] = useState(null);
  const [editing, setEditing] = useState(null);
  const [slotCycleId, setSlotCycleId] = useState(null);
  const [showFiltersMenu, setShowFiltersMenu] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const setActiveCycle = useAppStore(state => state.setActiveCycle);
  const user = useAuthStore(state => state.user);
  const isCoord = user?.role === 'coordinator';
  const [scheduling, setScheduling] = useState({});
  const [explainSlotId, setExplainSlotId] = useState(null);

  // Auto Schedule configurations
  const [autoScheduleModal, setAutoScheduleModal] = useState(null);
  const [schedStartDate, setSchedStartDate] = useState('');
  const [schedEndDate, setSchedEndDate] = useState('');
  const [schedDuration, setSchedDuration] = useState(180);
  const [schedShifts, setSchedShifts] = useState([
    { name: 'Morning Shift', start_time: '09:30' },
    { name: 'Afternoon Shift', start_time: '13:30' }
  ]);
  const [schedOrderYear, setSchedOrderYear] = useState(true);

  useEffect(() => {
    if (autoScheduleModal) {
      setSchedStartDate(autoScheduleModal.start_date);
      setSchedEndDate(autoScheduleModal.end_date);
      setSchedDuration(180);
      setSchedShifts([
        { name: 'Morning Shift', start_time: '09:30' },
        { name: 'Afternoon Shift', start_time: '13:30' }
      ]);
      setSchedOrderYear(true);
    }
  }, [autoScheduleModal]);

  const triggerAutoSchedule = async (cycleId) => {
    setScheduling(prev => ({ ...prev, [cycleId]: true }));
    try {
      const payload = {
        start_date: schedStartDate,
        end_date: schedEndDate,
        duration_mins: schedDuration,
        shifts: schedShifts.map((s, idx) => ({
          id: String(idx + 1),
          name: s.name,
          start_time: s.start_time,
          duration_mins: schedDuration
        })),
        order_by_year: schedOrderYear
      };
      const { data } = await api.post(`/exam-cycles/${cycleId}/auto-schedule`, payload);
      toast.success(data.message || 'Auto-scheduled!');
      if (data.warnings?.length) {
        data.warnings.slice(0, 3).forEach(w => toast.error(w, { duration: 5000 }));
      }
      loadSlots(cycleId);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Auto-schedule failed');
    } finally {
      setScheduling(prev => ({ ...prev, [cycleId]: false }));
    }
  };

  const fetchCycles = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/exam-cycles');
      setCycles(data);
    } catch {
      toast.error('Failed to load cycles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCycles();
  }, []);

  const loadSlots = async (cycleId) => {
    try {
      const { data } = await api.get(`/exam-cycles/${cycleId}/slots`);
      setSlotsMap(prev => ({ ...prev, [cycleId]: data }));
    } catch {
      toast.error('Failed to load slots');
    }
  };

  const toggleExpanded = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
    if (!slotsMap[id]) loadSlots(id);
  };

  const delCycle = async (id) => {
    if (!confirm('Delete this exam cycle and all its data?')) return;
    try {
      await api.delete(`/exam-cycles/${id}`);
      toast.success('Deleted');
      fetchCycles();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const dupCycle = async (id, name) => {
    if (!confirm(`Duplicate "${name}"?\n\nThis will create a copy with all draft slots shifted +6 months.`)) return;
    try {
      await api.post(`/exam-cycles/${id}/duplicate`);
      toast.success('Cycle duplicated');
      fetchCycles();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to duplicate');
    }
  };

  const delSlot = async (cycleId, slotId) => {
    if (!confirm('Delete this exam slot?')) return;
    try {
      await api.delete(`/exam-cycles/${cycleId}/slots/${slotId}`);
      toast.success('Slot deleted');
      loadSlots(cycleId);
    } catch {
      toast.error('Failed to delete slot');
    }
  };

  const splitSlots = (slots = []) => ({
    backlog:  slots.filter(s => s.exam_type === 'backlog'),
    regular:  slots.filter(s => s.exam_type === 'regular'),
  });

  // Calculate metrics
  const totalCycles = cycles.length;
  const activeCycleObj = cycles.find(c => c.status === 'active');
  const totalSlotsCount = Object.values(slotsMap).reduce((acc, list) => acc + (list?.length || 0), 0);

  // Local filtering
  const filteredCycles = cycles.filter(c => {
    const matchesSearch = !search || c.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !filterStatus || c.status === filterStatus;
    const matchesSemType = !filterSemType || c.semester_type === filterSemType;

    return matchesSearch && matchesStatus && matchesSemType;
  });

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [search, filterStatus, filterSemType]);

  // Pagination derived data
  const totalPages = Math.ceil(filteredCycles.length / itemsPerPage) || 1;
  const paginatedCycles = filteredCycles.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(new Set(paginatedCycles.map(c => c.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '24px 28px 40px' }}>
      {/* Top Section: Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            <DecryptedText text="Exam Cycles Manager" />
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Configure academic sessions, schedule timetables, and run CP-SAT optimizations.</p>
        </div>
      </div>

      {/* Middle Section: KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
        <SpotlightCard style={{ padding: 24, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Academic Cycles</span>
            <Calendar size={14} color="#3b82f6" strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              <CountUp to={totalCycles} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Archived & draft cycles</div>
          </div>
        </SpotlightCard>

        <SpotlightCard style={{ padding: 24, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Session</span>
            <Activity size={14} color="#10b981" strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: activeCycleObj ? '#10b981' : 'var(--text-tertiary)', fontFamily: 'var(--font-sans)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 8 }}>
              {activeCycleObj ? activeCycleObj.name : 'No Active Cycle'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>Currently active cycle</div>
          </div>
        </SpotlightCard>

        <SpotlightCard style={{ padding: 24, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Timetable Slots</span>
            <Grid3x3 size={14} color="#f59e0b" strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b', fontFamily: 'var(--font-mono)' }}>
              <CountUp to={totalSlotsCount} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Scheduled exams total</div>
          </div>
        </SpotlightCard>
      </div>

      {/* Bottom Section: Primary Content Area */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* SaaS UI Header Bar */}
        <div className="saas-page-header-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Cycles</span>
            
            {/* Status tabs */}
            <div className="saas-filter-tabs">
              <button className={`saas-filter-tab${filterStatus === '' ? ' active' : ''}`} onClick={() => setFilterStatus('')}>All</button>
              <button className={`saas-filter-tab${filterStatus === 'draft' ? ' active' : ''}`} onClick={() => setFilterStatus('draft')}>Draft</button>
              <button className={`saas-filter-tab${filterStatus === 'active' ? ' active' : ''}`} onClick={() => setFilterStatus('active')}>Active</button>
              <button className={`saas-filter-tab${filterStatus === 'finalised' ? ' active' : ''}`} onClick={() => setFilterStatus('finalised')}>Finalised</button>
              <button className={`saas-filter-tab${filterStatus === 'archived' ? ' active' : ''}`} onClick={() => setFilterStatus('archived')}>Archived</button>
            </div>

            {/* Filter button */}
            <button className={`btn btn-ghost btn-sm${showFiltersMenu ? ' active' : ''}`} onClick={() => setShowFiltersMenu(!showFiltersMenu)} style={{ borderRadius: 6, padding: '4px 10px' }}>
              <Grid3x3 size={12} strokeWidth={1.5} style={{ marginRight: 4 }} /> Filter
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Search Input */}
            <div className="saas-search-input-wrapper" style={{ width: 220 }}>
              <Search size={12} color="var(--text-tertiary)" strokeWidth={1.5} />
              <input 
                placeholder="Search cycles..." 
                className="saas-search-input" 
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && <X size={12} color="var(--text-tertiary)" style={{ cursor: 'pointer' }} onClick={() => setSearch('')} />}
            </div>

            {/* Add Cycle button */}
            {isCoord && (
              <button className="btn btn-primary" onClick={() => { setEditing(null); setModal('cycle'); }} style={{ borderRadius: 6 }}>
                + New Cycle
              </button>
            )}
          </div>
        </div>

        {/* Filter Selection Panel */}
        {showFiltersMenu && (
          <div style={{ padding: '12px 28px', background: 'var(--bg-base)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 16, alignItems: 'center' }}>
            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Semester Type:</span>
              <select className="select" style={{ fontSize: 12, minHeight: 28, height: 28, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-input)' }} value={filterSemType} onChange={e => setFilterSemType(e.target.value)}>
                <option value="">All Semesters</option>
                <option value="odd">Odd Parity Only</option>
                <option value="even">Even Parity Only</option>
              </select>
            </div>

            {filterSemType && (
              <button className="btn btn-ghost btn-sm" style={{ height: 28, minHeight: 28, borderRadius: 4, fontSize: 11, padding: '0 8px' }} onClick={() => { setFilterSemType(''); }}>
                Clear Filters
              </button>
            )}
          </div>
        )}

        {/* Active Filter Chips */}
        {filterSemType && (
          <div style={{ padding: '8px 28px', display: 'flex', gap: 8, flexWrap: 'wrap', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
            <div className="saas-filter-chip">
              <span>Semesters is {filterSemType} parity</span>
              <button className="saas-filter-chip-close" onClick={() => setFilterSemType('')}>×</button>
            </div>
          </div>
        )}

        {/* Cycles Table */}
        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
          ) : paginatedCycles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: 13 }}>
              No exam cycles matched the search parameters.
            </div>
          ) : (
            <table style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: 40, paddingLeft: 28 }}>
                    <input 
                      type="checkbox" 
                      onChange={handleSelectAll} 
                      checked={paginatedCycles.length > 0 && paginatedCycles.every(c => selectedIds.has(c.id))}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th style={{ width: 30 }} />
                  <th>Cycle Name</th>
                  <th>Status</th>
                  <th>Date Range</th>
                  <th>Semester Type</th>
                  <th>Slots Scheduled</th>
                  {isCoord && <th style={{ width: 60, paddingRight: 28, textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {paginatedCycles.map((cycle) => {
                  const slots = slotsMap[cycle.id] || [];
                  const isExpanded = !!expanded[cycle.id];
                  const { backlog, regular } = splitSlots(slots);
                  
                  return (
                    <>
                      {/* Main Cycle Row */}
                      <tr key={cycle.id}>
                        <td style={{ paddingLeft: 28 }}>
                          <input 
                            type="checkbox" 
                            checked={selectedIds.has(cycle.id)} 
                            onChange={() => handleSelectOne(cycle.id)}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                        <td>
                          <button 
                            className="btn btn-ghost btn-icon btn-sm" 
                            style={{ border: 'none', background: 'transparent' }} 
                            onClick={() => toggleExpanded(cycle.id)}
                          >
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{cycle.name}</div>
                        </td>
                        <td>
                          <span className="badge" style={{ color: STATUS_ACCENT[cycle.status], borderColor: STATUS_ACCENT[cycle.status], textTransform: 'capitalize', fontSize: 10 }}>
                            {cycle.status}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
                          {formatDate(cycle.start_date)} — {formatDate(cycle.end_date)}
                        </td>
                        <td>
                          <span className="badge badge-neutral" style={{ textTransform: 'uppercase', fontSize: 10 }}>
                            {cycle.semester_type || 'odd'}-sem
                          </span>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
                          {slots.length} slots
                        </td>
                        {isCoord && (
                          <td style={{ paddingRight: 28, textAlign: 'right', position: 'relative' }}>
                            <button className="btn btn-ghost btn-icon btn-sm" style={{ border: 'none', background: 'transparent' }} onClick={() => setActiveMenuId(activeMenuId === cycle.id ? null : cycle.id)}>
                              <span style={{ fontSize: 16, fontWeight: 'bold' }}>···</span>
                            </button>
                            {activeMenuId === cycle.id && (
                              <>
                                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }} onClick={() => setActiveMenuId(null)} />
                                <div style={{
                                  position: 'absolute', right: 28, top: 32, zIndex: 999,
                                  background: 'var(--bg-surface)', border: '1px solid var(--border)',
                                  borderRadius: 6, padding: '4px 0', minWidth: 150,
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.5)', textAlign: 'left'
                                }}>
                                  {cycle.status !== 'active' && (
                                    <button onClick={async () => {
                                      try {
                                        await api.post(`/exam-cycles/${cycle.id}/activate`);
                                        toast.success(`"${cycle.name}" set as active cycle`);
                                        fetchCycles();
                                      } catch (err) {
                                        toast.error(err.response?.data?.error || 'Could not activate cycle');
                                      }
                                      setActiveMenuId(null);
                                    }} style={{ display: 'block', width: '100%', padding: '6px 12px', background: 'none', border: 'none', textAlign: 'left', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 12 }}>Set Active</button>
                                  )}
                                  <Link to={`/calendar/${cycle.id}`} style={{ display: 'block', padding: '6px 12px', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 12 }}>Calendar View</Link>
                                  <Link to={`/planner/${cycle.id}`} style={{ display: 'block', padding: '6px 12px', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 12 }}>Interactive Planner</Link>
                                  <Link to={`/conflicts/${cycle.id}`} style={{ display: 'block', padding: '6px 12px', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 12 }}>Conflict Checker</Link>
                                  <Link to={`/export/${cycle.id}`} style={{ display: 'block', padding: '6px 12px', color: 'var(--text-primary)', textDecoration: 'none', fontSize: 12 }}>Export PDF/CSV</Link>
                                  <button onClick={() => { dupCycle(cycle.id, cycle.name); setActiveMenuId(null); }} style={{ display: 'block', width: '100%', padding: '6px 12px', background: 'none', border: 'none', textAlign: 'left', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 12 }}>Duplicate Copy</button>
                                  <button onClick={() => { setEditing(cycle); setModal('cycle'); setActiveMenuId(null); }} style={{ display: 'block', width: '100%', padding: '6px 12px', background: 'none', border: 'none', textAlign: 'left', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 12 }}>Edit Properties</button>
                                  <button onClick={() => { delCycle(cycle.id); setActiveMenuId(null); }} style={{ display: 'block', width: '100%', padding: '6px 12px', background: 'none', border: 'none', textAlign: 'left', color: 'var(--accent-red)', cursor: 'pointer', fontSize: 12 }}>Delete Cycle</button>
                                </div>
                              </>
                            )}
                          </td>
                        )}
                      </tr>

                      {/* Nested Slots Sub-List */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={isCoord ? 8 : 7} style={{ background: 'rgba(0,0,0,0.2)', padding: '16px 28px 24px 72px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Exam Slots Registry ({slots.length})</span>
                              {isCoord && (
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <button 
                                    className="btn btn-ghost btn-sm" 
                                    style={{ borderRadius: 6, borderColor: 'var(--accent-purple)', color: 'var(--accent-purple)' }}
                                    disabled={scheduling[cycle.id]} 
                                    onClick={() => setAutoScheduleModal(cycle)}
                                  >
                                    {scheduling[cycle.id] ? 'Running Solver...' : 'Auto-Generate Timetable'}
                                  </button>
                                  <button className="btn btn-primary btn-sm" style={{ borderRadius: 6 }} onClick={() => { setSlotCycleId(cycle.id); setEditing(null); setModal('slot'); }}>
                                    + Add Slot
                                  </button>
                                </div>
                              )}
                            </div>

                            {slots.length === 0 ? (
                              <p style={{ fontStyle: 'italic', color: 'var(--text-tertiary)', fontSize: 12, padding: '8px 0' }}>No slots scheduled for this cycle.</p>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {/* Backlog slots first */}
                                {backlog.length > 0 && (
                                  <div>
                                    <div style={{ fontSize: 9, color: '#FF453A', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, borderBottom: '1px solid rgba(255,69,58,0.15)', paddingBottom: 4 }}>
                                      Backlog Exams ({backlog.length})
                                    </div>
                                    <SlotList slots={backlog} cycleId={cycle.id} isCoord={isCoord}
                                      onEdit={(slot) => { setSlotCycleId(cycle.id); setEditing(slot); setModal('slot'); }}
                                      onDel={(slotId) => delSlot(cycle.id, slotId)}
                                      onExplain={(slotId) => { setSlotCycleId(cycle.id); setExplainSlotId(slotId); }} />
                                  </div>
                                )}
                                {/* Regular slots */}
                                {regular.length > 0 && (
                                  <div style={{ marginTop: backlog.length > 0 ? 12 : 0 }}>
                                    {backlog.length > 0 && (
                                      <div style={{ fontSize: 9, color: '#10b981', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, borderBottom: '1px solid rgba(16,185,129,0.15)', paddingBottom: 4 }}>
                                        Regular Exams ({regular.length})
                                      </div>
                                    )}
                                    <SlotList slots={regular} cycleId={cycle.id} isCoord={isCoord}
                                      onEdit={(slot) => { setSlotCycleId(cycle.id); setEditing(slot); setModal('slot'); }}
                                      onDel={(slotId) => delSlot(cycle.id, slotId)}
                                      onExplain={(slotId) => { setSlotCycleId(cycle.id); setExplainSlotId(slotId); }} />
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Footer */}
        <div className="saas-pagination-footer">
          <div>
            Page <input 
              type="text" 
              value={currentPage} 
              onChange={e => {
                const val = parseInt(e.target.value);
                if (!isNaN(val) && val >= 1 && val <= totalPages) setCurrentPage(val);
              }}
              style={{ width: 32, height: 22, textAlign: 'center', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 11, margin: '0 4px' }}
            /> of {totalPages}
          </div>
          
          <div style={{ display: 'flex', gap: 4 }}>
            <button 
              className="btn btn-ghost btn-sm" 
              style={{ padding: '0 8px', height: 24, minHeight: 24, borderRadius: 4 }} 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            >
              &lt;
            </button>
            <button 
              className="btn btn-ghost btn-sm" 
              style={{ padding: '0 8px', height: 24, minHeight: 24, borderRadius: 4 }} 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            >
              &gt;
            </button>
          </div>
        </div>
      </div>

      {modal === 'cycle' && <CycleModal cycle={editing} onClose={() => setModal(null)} onSave={fetchCycles} />}
      {modal === 'slot' && slotCycleId && (
        <SlotModal
          cycleId={slotCycleId}
          cycle={cycles.find(c => c.id === slotCycleId)}
          slot={editing}
          onClose={() => setModal(null)}
          onSave={() => loadSlots(slotCycleId)}
        />
      )}
      {explainSlotId && slotCycleId && (
        <ExplainModal
          cycleId={slotCycleId}
          slotId={explainSlotId}
          onClose={() => setExplainSlotId(null)}
        />
      )}
      {autoScheduleModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setAutoScheduleModal(null)}>
          <div className="modal" style={{ width: '100%', maxWidth: 500 }}>
            <h2 className="modal-title" style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 700, borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 16 }}>
              Auto-Schedule: {autoScheduleModal.name}
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Date Range */}
              <div className="form-group">
                <label className="form-label" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Exam Date Range
                </label>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>Start Date</span>
                    <input 
                      type="date" 
                      className="input" 
                      value={schedStartDate} 
                      onChange={(e) => setSchedStartDate(e.target.value)} 
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 2 }}>End Date</span>
                    <input 
                      type="date" 
                      className="input" 
                      value={schedEndDate} 
                      onChange={(e) => setSchedEndDate(e.target.value)} 
                    />
                  </div>
                </div>
              </div>

              {/* Duration */}
              <div className="form-group">
                <label className="form-label" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Exam Duration (Minutes)
                </label>
                <input 
                  type="number" 
                  className="input" 
                  value={schedDuration} 
                  onChange={(e) => setSchedDuration(parseInt(e.target.value) || 180)} 
                />
              </div>

              {/* Shifts */}
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label className="form-label" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                    Time Batches (Shifts)
                  </label>
                  <button 
                    type="button" 
                    className="btn btn-ghost btn-sm" 
                    style={{ padding: '2px 8px', fontSize: 10 }}
                    onClick={() => setSchedShifts([...schedShifts, { name: `Shift ${schedShifts.length + 1}`, start_time: '09:30' }])}
                  >
                    + Add Shift
                  </button>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {schedShifts.map((shift, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input 
                        type="text" 
                        className="input" 
                        placeholder="Shift Name"
                        value={shift.name} 
                        onChange={(e) => {
                          const newShifts = [...schedShifts];
                          newShifts[idx].name = e.target.value;
                          setSchedShifts(newShifts);
                        }} 
                        style={{ flex: 1, padding: '6px 10px', fontSize: 12 }}
                      />
                      <input 
                        type="time" 
                        className="input" 
                        value={shift.start_time} 
                        onChange={(e) => {
                          const newShifts = [...schedShifts];
                          newShifts[idx].start_time = e.target.value;
                          setSchedShifts(newShifts);
                        }} 
                        style={{ width: 120, padding: '6px 10px', fontSize: 12 }}
                      />
                      {schedShifts.length > 1 && (
                        <button 
                          type="button" 
                          className="btn btn-danger btn-icon btn-sm" 
                          style={{ padding: '6px 8px', height: 'auto' }}
                          onClick={() => setSchedShifts(schedShifts.filter((_, sIdx) => sIdx !== idx))}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Ordering Constraint */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0' }}>
                <input 
                  type="checkbox" 
                  id="schedOrderYear"
                  checked={schedOrderYear} 
                  onChange={(e) => setSchedOrderYear(e.target.checked)} 
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <label htmlFor="schedOrderYear" style={{ fontWeight: 500, fontSize: 12, cursor: 'pointer', userSelect: 'none' }}>
                  Schedule chronologically by year (FY ➔ SY ➔ TY)
                </label>
              </div>

              {/* Footer / Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 8 }}>
                <button 
                  className="btn btn-ghost" 
                  onClick={() => setAutoScheduleModal(null)}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-warning" 
                  disabled={scheduling[autoScheduleModal.id]}
                  onClick={() => {
                    const cycleId = autoScheduleModal.id;
                    setAutoScheduleModal(null);
                    triggerAutoSchedule(cycleId);
                  }}
                >
                  {scheduling[autoScheduleModal.id] ? 'Scheduling...' : 'Generate Timetable'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
