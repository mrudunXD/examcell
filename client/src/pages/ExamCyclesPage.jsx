import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, CalendarDays, Grid3x3, UserCog, ChevronDown, ChevronRight, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../lib/api.js';
import toast from 'react-hot-toast';
import { useAppStore } from '../store/index.js';

const CYCLE_EMPTY = { name: '', start_date: '', end_date: '' };
const STATUSES = ['draft', 'active', 'finalised', 'archived'];

function CycleModal({ cycle, onClose, onSave }) {
  const [form, setForm] = useState(cycle ? { name: cycle.name, start_date: cycle.start_date, end_date: cycle.end_date, status: cycle.status } : CYCLE_EMPTY);
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
        <div className="flex-between" style={{ marginBottom: 20 }}>
          <h2>{cycle?.id ? 'Edit Cycle' : 'New Exam Cycle'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Cycle Name *</label>
            <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="e.g. End Sem June 2026" />
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
          {cycle?.id && (
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                {STATUSES.map(s => <option key={s} value={s} style={{ textTransform: 'capitalize' }}>{s}</option>)}
              </select>
            </div>
          )}
          <div className="flex-row" style={{ justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <div className="spinner" /> : (cycle?.id ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SlotModal({ cycleId, slot, onClose, onSave }) {
  const [subjects, setSubjects] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState(slot ? {
    subject_id: slot.subject_id, date: slot.date, start_time: slot.start_time,
    duration_mins: slot.duration_mins, classroom_ids: slot.rooms?.map(r => r.classroom_id) || [],
    student_ids: []
  } : { subject_id: '', date: '', start_time: '', duration_mins: 180, classroom_ids: [], student_ids: [] });
  const [saving, setSaving] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/subjects'), api.get('/classrooms')]).then(([sr, cr]) => {
      setSubjects(sr.data); setClassrooms(cr.data);
    });
  }, []);

  // Load students when subject changes
  useEffect(() => {
    if (!form.subject_id) { setStudents([]); setForm(f => ({ ...f, student_ids: [] })); return; }
    const subj = subjects.find(s => s.id === form.subject_id);
    if (!subj) return;
    setLoadingStudents(true);
    api.get('/students', { params: { branch: subj.branch, year: subj.year } }).then(r => {
      setStudents(r.data);
      setForm(f => ({ ...f, student_ids: r.data.map(s => s.id) }));
    }).finally(() => setLoadingStudents(false));
  }, [form.subject_id, subjects]);

  const toggleClassroom = (id) => setForm(f => ({
    ...f, classroom_ids: f.classroom_ids.includes(id) ? f.classroom_ids.filter(x => x !== id) : [...f.classroom_ids, id]
  }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      slot?.id
        ? await api.put(`/exam-cycles/${cycleId}/slots/${slot.id}`, form)
        : await api.post(`/exam-cycles/${cycleId}/slots`, form);
      toast.success(slot?.id ? 'Slot updated' : 'Slot created');
      onSave(); onClose();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" style={{ maxWidth: 680 }}>
        <div className="flex-between" style={{ marginBottom: 20 }}>
          <h2>{slot?.id ? 'Edit Exam Slot' : 'New Exam Slot'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Subject */}
          <div className="form-group">
            <label className="form-label">Subject *</label>
            <select className="select" value={form.subject_id} onChange={e => setForm({ ...form, subject_id: e.target.value })} required>
              <option value="">Select subject…</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name} ({s.branch}, {s.year})</option>)}
            </select>
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

          {/* Classrooms */}
          <div className="form-group">
            <label className="form-label">Assign Classrooms</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
              {classrooms.map(c => (
                <button key={c.id} type="button" onClick={() => toggleClassroom(c.id)} className="btn btn-sm"
                  style={{
                    background: form.classroom_ids.includes(c.id) ? 'rgba(59,130,246,0.2)' : 'var(--color-surface)',
                    border: `1px solid ${form.classroom_ids.includes(c.id) ? 'rgba(59,130,246,0.5)' : 'var(--color-border)'}`,
                    color: form.classroom_ids.includes(c.id) ? '#60a5fa' : 'var(--color-text-muted)'
                  }}>
                  {c.room_no} ({c.capacity})
                </button>
              ))}
            </div>
          </div>

          {/* Students auto-loaded */}
          {form.subject_id && (
            <div className="form-group">
              <label className="form-label">
                Students
                {loadingStudents && <span style={{ marginLeft: 8 }}><div className="spinner" style={{ width: 12, height: 12, display: 'inline-block' }} /></span>}
              </label>
              {students.length === 0 && !loadingStudents && (
                <div className="alert alert-warning">No students found for this subject's branch/year. Add students first.</div>
              )}
              {students.length > 0 && (
                <div className="alert alert-success">
                  <Users size={14} /> {students.length} students auto-selected from {subjects.find(s => s.id === form.subject_id)?.branch} {subjects.find(s => s.id === form.subject_id)?.year}
                </div>
              )}
            </div>
          )}

          <div className="flex-row" style={{ justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <div className="spinner" /> : (slot?.id ? 'Update' : 'Create Slot')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const STATUS_COLORS = { draft: '#9ca3af', seating_generated: '#3b82f6', supervisors_assigned: '#f59e0b', finalised: '#10b981' };

export default function ExamCyclesPage() {
  const [cycles, setCycles] = useState([]);
  const [slotsMap, setSlotsMap] = useState({});
  const [expanded, setExpanded] = useState({});
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [editing, setEditing] = useState(null);
  const [slotCycleId, setSlotCycleId] = useState(null);
  const { setActiveCycle } = useAppStore();

  const fetchCycles = async () => {
    setLoading(true);
    try { const { data } = await api.get('/exam-cycles'); setCycles(data); }
    catch { toast.error('Failed'); }
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

  const delSlot = async (cycleId, slotId) => {
    if (!confirm('Delete this exam slot?')) return;
    await api.delete(`/exam-cycles/${cycleId}/slots/${slotId}`);
    toast.success('Slot deleted'); loadSlots(cycleId);
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div><h1>Exam Cycles</h1><p>Manage exam periods, slots, and room allocations</p></div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setModal('cycle'); }}>
          <Plus size={15} /> New Cycle
        </button>
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      : cycles.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <CalendarDays size={40} color="var(--color-text-muted)" style={{ margin: '0 auto 14px' }} />
          <h3>No Exam Cycles</h3>
          <p className="text-muted" style={{ fontSize: 13, margin: '8px 0 20px' }}>Create your first exam cycle to get started.</p>
          <button className="btn btn-primary" onClick={() => { setEditing(null); setModal('cycle'); }}>Create Cycle</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {cycles.map(cycle => (
            <div key={cycle.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* Cycle header */}
              <div style={{
                padding: '14px 18px',
                borderBottom: expanded[cycle.id] ? '1px solid var(--color-border)' : 'none',
                display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer'
              }} onClick={() => toggleExpanded(cycle.id)}>
                <div style={{ color: 'var(--color-text-muted)' }}>
                  {expanded[cycle.id] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="flex-row" style={{ gap: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{cycle.name}</span>
                    <span className={`badge`} style={{
                      background: `${STATUS_COLORS[cycle.status]}22`,
                      color: STATUS_COLORS[cycle.status],
                      border: `1px solid ${STATUS_COLORS[cycle.status]}44`,
                      textTransform: 'capitalize'
                    }}>{cycle.status}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
                    📅 {cycle.start_date} → {cycle.end_date}
                  </div>
                </div>
                <div className="flex-row" style={{ gap: 6 }} onClick={e => e.stopPropagation()}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setActiveCycle(cycle.id)}>
                    Set Active
                  </button>
                  <Link to={`/conflicts/${cycle.id}`} className="btn btn-warning btn-sm">Conflicts</Link>
                  <Link to={`/export/${cycle.id}`} className="btn btn-success btn-sm">Export</Link>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setEditing(cycle); setModal('cycle'); }}><Pencil size={13} /></button>
                  <button className="btn btn-danger btn-icon btn-sm" onClick={() => delCycle(cycle.id)}><Trash2 size={13} /></button>
                </div>
              </div>

              {/* Slots */}
              {expanded[cycle.id] && (
                <div style={{ padding: '14px 18px' }}>
                  <div className="flex-between" style={{ marginBottom: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Exam Slots</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setSlotCycleId(cycle.id); setEditing(null); setModal('slot'); }}>
                      <Plus size={13} /> Add Slot
                    </button>
                  </div>
                  {!slotsMap[cycle.id] ? (
                    <div className="spinner" style={{ margin: '0 auto' }} />
                  ) : slotsMap[cycle.id].length === 0 ? (
                    <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>No slots yet. Add an exam slot to get started.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {slotsMap[cycle.id].map(slot => (
                        <div key={slot.id} style={{
                          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                          borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 14
                        }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLORS[slot.status], flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 13 }}>{slot.subject_code} — {slot.subject_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                              📅 {slot.date} at {slot.start_time} · ⏱ {slot.duration_mins}min ·
                              🏫 {slot.rooms?.map(r => r.room_no).join(', ') || 'No rooms'} ·
                              👤 {slot.student_count} students
                            </div>
                          </div>
                          <div className="flex-row" style={{ gap: 6 }}>
                            <Link to={`/seating/${slot.id}`} className="btn btn-ghost btn-sm">
                              <Grid3x3 size={12} /> Seating
                            </Link>
                            <Link to={`/supervisors/${slot.id}`} className="btn btn-ghost btn-sm">
                              <UserCog size={12} /> Supervisors
                            </Link>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setSlotCycleId(cycle.id); setEditing(slot); setModal('slot'); }}><Pencil size={12} /></button>
                            <button className="btn btn-danger btn-icon btn-sm" onClick={() => delSlot(cycle.id, slot.id)}><Trash2 size={12} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modal === 'cycle' && <CycleModal cycle={editing} onClose={() => setModal(null)} onSave={fetchCycles} />}
      {modal === 'slot' && slotCycleId && (
        <SlotModal cycleId={slotCycleId} slot={editing} onClose={() => setModal(null)}
          onSave={() => loadSlots(slotCycleId)} />
      )}
    </div>
  );
}
