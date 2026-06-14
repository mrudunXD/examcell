import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Grid3x3, UserCog, Wifi, Monitor, Users, AlertTriangle, Calendar, Loader, Copy, CalendarDays, Info } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../lib/api.js';
import { formatDate, formatTime } from '../lib/format.js';
import toast from 'react-hot-toast';
import { useAppStore } from '../store/index.js';
import { useAuthStore } from '../store/index.js';

const STATUSES = ['draft', 'active', 'finalised', 'archived'];
const STATUS_ACCENT = { draft: '#767680', active: '#1d4ed8', finalised: '#166534', archived: '#A3A3AC' };
const TYPE_ACCENT   = { regular: '#166534', backlog: '#FF453A' };
const MODE_ACCENT   = { offline: '#F5F5F7', online: '#1d4ed8' };

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
            <div style={{ display: 'flex', gap: 0, border: '1px solid #222225' }}>
              {['odd', 'even'].map(t => (
                <button key={t} type="button" onClick={() => setForm({ ...form, semester_type: t })}
                  style={{
                    flex: 1, padding: '8px 0', border: 'none',
                    background: form.semester_type === t ? '#F5F5F7' : 'transparent',
                    color: form.semester_type === t ? '#0C0C0E' : '#A3A3AC',
                    fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em',
                    cursor: 'pointer',
                  }}>
                  {t === 'odd' ? 'Odd (Sem 1, 3, 5, 7)' : 'Even (Sem 2, 4, 6, 8)'}
                </button>
              ))}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--np-n500)', marginTop: 4 }}>
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
          <div className="flex-row" style={{ justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid #222225' }}>
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

  // Preview student count when subject changes
  useEffect(() => {
    if (!form.subject_id) { setAutoCount(null); return; }
    const subj = subjects.find(s => s.id === form.subject_id);
    if (!subj) return;
    api.get('/students', { params: { branch: subj.branch, year: subj.year } })
      .then(r => setAutoCount(r.data.length));
  }, [form.subject_id, subjects]);

  const toggleClassroom = id => setForm(f => ({
    ...f, classroom_ids: f.classroom_ids.includes(id) ? f.classroom_ids.filter(x => x !== id) : [...f.classroom_ids, id]
  }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      slot?.id
        ? await api.put(`/exam-cycles/${cycleId}/slots/${slot.id}`, form)
        : await api.post(`/exam-cycles/${cycleId}/slots`, form);
      toast.success(slot?.id ? 'Slot updated' : 'Slot created — students auto-assigned');
      onSave(); onClose();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  };

  const groupedSubjects = {};
  for (const s of subjects) {
    const k = `Sem ${s.semester} — ${s.year} — ${s.branch}`;
    if (!groupedSubjects[k]) groupedSubjects[k] = [];
    groupedSubjects[k].push(s);
  }

  // Group classrooms by floor
  const floorMap = {};
  for (const c of classrooms) {
    const floor = String(c.room_no)[0] || '?';
    if (!floorMap[floor]) floorMap[floor] = [];
    floorMap[floor].push(c);
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <h2 className="modal-title">{slot?.id ? 'Edit Exam Slot' : 'New Exam Slot'}</h2>
        {subjects.length === 0 && (
          <div className="alert alert-warning" style={{ marginBottom: 16 }}>
            <AlertTriangle size={13} strokeWidth={1.5} />
            No subjects found for {cycle?.semester_type}-semester cycle. Add subjects with matching semester numbers first.
          </div>
        )}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Exam Type + Mode toggles */}
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Exam Type</label>
              <div style={{ display: 'flex', gap: 0, border: '1px solid #222225' }}>
                {['regular', 'backlog'].map(t => (
                  <button key={t} type="button" onClick={() => setForm({ ...form, exam_type: t })}
                    style={{
                      flex: 1, padding: '7px 0', border: 'none',
                      background: form.exam_type === t ? TYPE_ACCENT[t] : 'transparent',
                      color: form.exam_type === t ? '#0C0C0E' : '#A3A3AC',
                      fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase',
                      letterSpacing: '0.08em', cursor: 'pointer',
                    }}>
                    {t}
                  </button>
                ))}
              </div>
              {form.exam_type === 'backlog' && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#FF453A', marginTop: 3 }}>
                  Backlog slots must be scheduled before the regular exam date
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Exam Mode</label>
              <div style={{ display: 'flex', gap: 0, border: '1px solid #222225' }}>
                {['offline', 'online'].map(m => (
                  <button key={m} type="button" onClick={() => setForm({ ...form, exam_mode: m })}
                    style={{
                      flex: 1, padding: '7px 0', border: 'none',
                      background: form.exam_mode === m ? MODE_ACCENT[m] : 'transparent',
                      color: form.exam_mode === m ? '#0C0C0E' : '#A3A3AC',
                      fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase',
                      letterSpacing: '0.08em', cursor: 'pointer',
                    }}>
                    {m === 'online' ? <><Wifi size={10} strokeWidth={1.5} /> Online</> : <><Monitor size={10} strokeWidth={1.5} /> Offline</>}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Subject */}
          <div className="form-group">
            <label className="form-label">Subject *
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--np-n500)', marginLeft: 6 }}>
                showing only {cycle?.semester_type}-semester subjects
              </span>
            </label>
            <select className="select" value={form.subject_id} onChange={e => setForm({ ...form, subject_id: e.target.value })} required>
              <option value="">Select subject…</option>
              {Object.entries(groupedSubjects).map(([group, subs]) => (
                <optgroup key={group} label={group}>
                  {subs.map(s => (
                    <option key={s.id} value={s.id}>{s.code} — {s.name} ({s.abbreviation})</option>
                  ))}
                </optgroup>
              ))}
            </select>
            {autoCount !== null && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#166534', marginTop: 4 }}>
                <Users size={10} strokeWidth={1.5} style={{ display: 'inline', marginRight: 3 }} />
                {autoCount} students will be auto-assigned from this branch/year
              </div>
            )}
          </div>

          <div className="grid-3">
            <div className="form-group">
              <label className="form-label">Date *</label>
              <input className="input" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Start Time *</label>
              <input className="input" type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} required />
            </div>
            <div className="form-group">
              <label className="form-label">Duration (min)</label>
              <input className="input" type="number" value={form.duration_mins} onChange={e => setForm({ ...form, duration_mins: parseInt(e.target.value) })} min={30} />
            </div>
          </div>

          {/* Classrooms — only for offline */}
          {form.exam_mode === 'offline' && (
            <div className="form-group">
              <label className="form-label">Assign Classrooms</label>
              {Object.entries(floorMap).sort().map(([floor, rooms]) => (
                <div key={floor} style={{ marginBottom: 8 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--np-n500)', marginBottom: 4 }}>
                    Floor {floor}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {rooms.map(c => (
                      <button key={c.id} type="button" onClick={() => toggleClassroom(c.id)} className="btn btn-sm"
                        style={{
                          background: form.classroom_ids.includes(c.id) ? '#F5F5F7' : 'transparent',
                          color: form.classroom_ids.includes(c.id) ? '#0C0C0E' : 'var(--np-n600)',
                          borderColor: form.classroom_ids.includes(c.id) ? '#F5F5F7' : '#222225',
                        }}>
                        {c.room_no} (cap. {c.capacity})
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {classrooms.length === 0 && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--np-n400)' }}>No classrooms configured yet</span>
              )}
            </div>
          )}
          {form.exam_mode === 'online' && (
            <div className="alert alert-info">
              <Wifi size={13} strokeWidth={1.5} />
              Online exam — no room allocation needed. Students will be registered but no physical seating assigned.
            </div>
          )}

          <div className="flex-row" style={{ justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid #222225' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <div className="spinner spinner-invert" style={{ width: 14, height: 14 }} /> : (slot?.id ? 'Update Slot' : 'Create & Auto-Assign')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function ExamCyclesPage() {
  const [cycles, setCycles] = useState([]);
  const [slotsMap, setSlotsMap] = useState({});
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [editing, setEditing] = useState(null);
  const [slotCycleId, setSlotCycleId] = useState(null);
  const { setActiveCycle } = useAppStore();
  const { user } = useAuthStore();
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
    try { const { data } = await api.get('/exam-cycles'); setCycles(data); }
    catch { toast.error('Failed to load cycles'); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchCycles(); }, []);

  const loadSlots = async (cycleId) => {
    try {
      const { data } = await api.get(`/exam-cycles/${cycleId}/slots`);
      setSlotsMap(prev => ({ ...prev, [cycleId]: data }));
    } catch { toast.error('Failed to load slots'); }
  };

  const toggleExpanded = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
    if (!slotsMap[id]) loadSlots(id);
  };

  const delCycle = async (id) => {
    if (!confirm('Delete this exam cycle and all its data?')) return;
    await api.delete(`/exam-cycles/${id}`); toast.success('Deleted'); fetchCycles();
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
    await api.delete(`/exam-cycles/${cycleId}/slots/${slotId}`);
    toast.success('Slot deleted'); loadSlots(cycleId);
  };

  // Group slots by backlog first then regular
  const splitSlots = (slots = []) => ({
    backlog:  slots.filter(s => s.exam_type === 'backlog'),
    regular:  slots.filter(s => s.exam_type === 'regular'),
  });

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          
          <h1 className="page-title">Exam Cycles</h1>
          <p className="page-subtitle">Periods, slots, and room allocations</p>
        </div>
        {isCoord && (
          <button className="btn btn-primary" onClick={() => { setEditing(null); setModal('cycle'); }}>
            <Plus size={13} strokeWidth={1.5} /> New Cycle
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : cycles.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 64 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>No Exam Cycles</div>
          <p style={{ fontFamily: 'var(--font-body)', fontStyle: 'italic', color: 'var(--np-n500)', marginBottom: 20, fontSize: 14 }}>
            Create your first exam cycle to begin managing exams.
          </p>
          {isCoord && (
            <button className="btn btn-primary" onClick={() => { setEditing(null); setModal('cycle'); }}>
              <Plus size={13} strokeWidth={1.5} /> Create First Cycle
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid #222225' }}>
          {cycles.map((cycle, ci) => {
            const { backlog, regular } = splitSlots(slotsMap[cycle.id]);
            return (
              <div key={cycle.id} style={{ borderBottom: ci < cycles.length - 1 ? '1px solid #222225' : 'none' }}>
                {/* Cycle header */}
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer',
                    background: expanded[cycle.id] ? '#1C1C1F' : '#0C0C0E',
                    borderBottom: expanded[cycle.id] ? '1px solid #222225' : 'none',
                  }}
                  onClick={() => toggleExpanded(cycle.id)}
                >
                  <div style={{ color: 'var(--np-n500)', flexShrink: 0 }}>
                    {expanded[cycle.id] ? <ChevronDown size={15} strokeWidth={1.5} /> : <ChevronRight size={15} strokeWidth={1.5} />}
                  </div>
                  <div style={{ width: 6, height: 6, flexShrink: 0, background: STATUS_ACCENT[cycle.status] || '#767680' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 700 }}>{cycle.name}</span>
                      <span className="badge" style={{ color: STATUS_ACCENT[cycle.status], borderColor: STATUS_ACCENT[cycle.status], textTransform: 'capitalize' }}>{cycle.status}</span>
                      <span className="badge" style={{ color: '#A3A3AC', borderColor: '#222225', textTransform: 'capitalize', fontSize: 9 }}>
                        {cycle.semester_type || 'odd'}-sem
                      </span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--np-n500)', marginTop: 2 }}>
                      {formatDate(cycle.start_date)} — {formatDate(cycle.end_date)}
                    </div>
                  </div>
                  <div className="flex-row" style={{ gap: 4 }} onClick={e => e.stopPropagation()}>
                    {cycle.status !== 'active' && (
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }} onClick={async () => {
                        try {
                          await api.post(`/exam-cycles/${cycle.id}/activate`);
                          setActiveCycle(cycle.id);
                          toast.success(`"${cycle.name}" set as active cycle`);
                          fetchCycles();
                        } catch (err) {
                          toast.error(err.response?.data?.error || 'Could not activate cycle');
                        }
                      }}>Set Active</button>
                    )}
                    <Link to={`/calendar/${cycle.id}`} className="btn btn-ghost btn-sm" style={{ fontSize: 10 }}>
                      <CalendarDays size={11} strokeWidth={1.5} /> Calendar
                    </Link>
                    <Link to={`/planner/${cycle.id}`} className="btn btn-ghost btn-sm" style={{ fontSize: 10 }}>
                      Interactive Planner
                    </Link>
                    <Link to={`/conflicts/${cycle.id}`} className="btn btn-warning btn-sm" style={{ fontSize: 10 }}>Conflicts</Link>
                    <Link to={`/export/${cycle.id}`} className="btn btn-success btn-sm" style={{ fontSize: 10 }}>Export</Link>
                    {isCoord && <>
                      <button className="btn btn-ghost btn-sm btn-sm" style={{ fontSize: 10 }} onClick={() => dupCycle(cycle.id, cycle.name)}>
                        <Copy size={11} strokeWidth={1.5} /> Duplicate
                      </button>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setEditing(cycle); setModal('cycle'); }}><Pencil size={12} strokeWidth={1.5} /></button>
                      <button className="btn btn-danger btn-icon btn-sm" onClick={() => delCycle(cycle.id)}><Trash2 size={12} strokeWidth={1.5} /></button>
                    </>}
                  </div>
                </div>

                {/* Slots panel */}
                {expanded[cycle.id] && (
                  <div style={{ padding: '16px 18px', background: '#FDFDFB' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--np-n500)' }}>Exam Slots</span>
                      {isCoord && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button 
                            className="btn btn-warning btn-sm" 
                            disabled={scheduling[cycle.id]} 
                            onClick={() => setAutoScheduleModal(cycle)}
                          >
                            {scheduling[cycle.id] ? 'Scheduling...' : 'Auto-Schedule Cycle'}
                          </button>
                          <button className="btn btn-ghost btn-sm" onClick={() => { setSlotCycleId(cycle.id); setEditing(null); setModal('slot'); }}>
                            <Plus size={12} strokeWidth={1.5} /> Add Slot
                          </button>
                        </div>
                      )}
                    </div>

                    {!slotsMap[cycle.id] ? (
                      <div className="spinner" style={{ margin: '0 auto' }} />
                    ) : slotsMap[cycle.id].length === 0 ? (
                      <p style={{ fontFamily: 'var(--font-body)', fontStyle: 'italic', color: 'var(--np-n500)', fontSize: 13 }}>No slots yet.</p>
                    ) : (
                      <>
                        {/* Backlog slots first */}
                        {backlog.length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#FF453A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, borderBottom: '1px solid #fecaca', paddingBottom: 4 }}>
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
                          <div>
                            {backlog.length > 0 && (
                              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, borderBottom: '1px solid #bbf7d0', paddingBottom: 4 }}>
                                Regular Exams ({regular.length})
                              </div>
                            )}
                            <SlotList slots={regular} cycleId={cycle.id} isCoord={isCoord}
                              onEdit={(slot) => { setSlotCycleId(cycle.id); setEditing(slot); setModal('slot'); }}
                              onDel={(slotId) => delSlot(cycle.id, slotId)}
                              onExplain={(slotId) => { setSlotCycleId(cycle.id); setExplainSlotId(slotId); }} />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

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
            <h2 className="modal-title" style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 700, borderBottom: '1px solid #222225', paddingBottom: 8, marginBottom: 16 }}>
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
                    <span style={{ fontSize: 11, color: 'var(--np-n500)', display: 'block', marginBottom: 2 }}>Start Date</span>
                    <input 
                      type="date" 
                      className="input" 
                      value={schedStartDate} 
                      onChange={(e) => setSchedStartDate(e.target.value)} 
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 11, color: 'var(--np-n500)', display: 'block', marginBottom: 2 }}>End Date</span>
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
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, borderTop: '1px solid #222225', paddingTop: 16, marginTop: 8 }}>
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

function SlotList({ slots, cycleId, isCoord, onEdit, onDel, onExplain }) {
  return (
    <div style={{ border: '1px solid #222225' }}>
      {slots.map((slot, si) => (
        <div key={slot.id} style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
          borderBottom: si < slots.length - 1 ? '1px solid #222225' : 'none',
        }}>
          {/* Type indicator */}
          <div style={{ width: 4, height: 32, flexShrink: 0, background: TYPE_ACCENT[slot.exam_type] || '#111' }} />
          {/* Mode icon */}
          <div style={{ color: MODE_ACCENT[slot.exam_mode], flexShrink: 0 }}>
            {slot.exam_mode === 'online' ? <Wifi size={12} strokeWidth={1.5} /> : <Monitor size={12} strokeWidth={1.5} />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13 }}>
              {slot.subject_code} — {slot.subject_name}
              {slot.abbreviation && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--np-n500)', marginLeft: 6 }}>({slot.abbreviation})</span>
              )}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--np-n500)', marginTop: 2 }}>
              {formatDate(slot.date)} · {formatTime(slot.start_time)} · {slot.duration_mins}min ·{' '}
              {slot.rooms?.map(r => r.room_no).join(', ') || (slot.exam_mode === 'online' ? 'Online' : 'No rooms')} ·{' '}
              {slot.student_count} students
              {slot.course_type && <span style={{ marginLeft: 6, color: '#767680' }}>{slot.course_type}</span>}
            </div>
          </div>
          <div className="flex-row" style={{ gap: 4 }}>
            {slot.exam_mode === 'offline' && (
              <Link to={`/seating/${slot.id}`} className="btn btn-ghost btn-sm" style={{ fontSize: 10 }}>
                <Grid3x3 size={11} strokeWidth={1.5} /> Seating
              </Link>
            )}
            <Link to={`/supervisors/${slot.id}`} className="btn btn-ghost btn-sm" style={{ fontSize: 10 }}>
              <UserCog size={11} strokeWidth={1.5} /> Supervisors
            </Link>
            <Link to={`/attendance/${slot.id}`} className="btn btn-ghost btn-sm" style={{ fontSize: 10 }}>
              <Users size={11} strokeWidth={1.5} /> Attendance
            </Link>
            <button className="btn btn-ghost btn-sm" onClick={() => onExplain(slot.id)} style={{ fontSize: 10 }}>
              <Info size={11} strokeWidth={1.5} /> Explain
            </button>
            {isCoord && <>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => onEdit(slot)}><Pencil size={11} strokeWidth={1.5} /></button>
              <button className="btn btn-danger btn-icon btn-sm" onClick={() => onDel(slot.id)}><Trash2 size={11} strokeWidth={1.5} /></button>
            </>}

          </div>
        </div>
      ))}
    </div>
  );
}

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
        <h2 className="modal-title" style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', borderBottom: '1px solid #222225', paddingBottom: 8, marginBottom: 16 }}>
          Decision Explanation
        </h2>
        <div style={{ fontSize: 13, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
            {explanation.subjectCode} — {explanation.subjectName}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--np-n500)', marginBottom: 12 }}>
            Branch: {explanation.branch} · Year: {explanation.year} · Date: {explanation.date} · Time: {explanation.startTime}
          </div>
          <div style={{ background: '#f5f5f4', borderLeft: '3px solid var(--np-ink)', padding: 12, fontFamily: 'var(--font-body)', fontStyle: 'italic', lineHeight: 1.5, marginBottom: 20 }}>
            "{explanation.summary}"
          </div>

          <div style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 10, color: 'var(--np-n500)', borderBottom: '1px solid var(--np-muted)', paddingBottom: 4, marginBottom: 10 }}>
            Rule & Soft Constraint Validations
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {explanation.checks.map((c, idx) => (
              <div key={idx} style={{ border: '1px solid var(--np-muted)', padding: '10px 12px', background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 12 }}>{c.rule}</span>
                  <span style={{ 
                    fontSize: 8, 
                    fontWeight: 800, 
                    padding: '2px 6px', 
                    border: `1px solid ${c.status === 'PASS' ? '#166534' : '#991b1b'}`,
                    background: c.status === 'PASS' ? '#dcfce7' : '#fee2e2',
                    color: c.status === 'PASS' ? '#166534' : '#991b1b',
                  }}>
                    {c.status}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 11, color: 'var(--np-n600)', lineHeight: 1.4 }}>{c.description}</p>
              </div>
            ))}
          </div>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--np-muted)', paddingTop: 16 }}>
          <button className="btn btn-primary btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}









