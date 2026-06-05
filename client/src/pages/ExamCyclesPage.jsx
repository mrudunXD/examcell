import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Grid3x3, UserCog, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../lib/api.js';
import toast from 'react-hot-toast';
import { useAppStore } from '../store/index.js';

const CYCLE_EMPTY = { name: '', start_date: '', end_date: '' };
const STATUSES = ['draft', 'active', 'finalised', 'archived'];

const STATUS_ACCENT = {
  draft: '#A3A3A3',
  active: '#1d4ed8',
  finalised: '#166534',
  archived: '#525252',
};

function CycleModal({ cycle, onClose, onSave }) {
  const [form, setForm] = useState(cycle
    ? { name: cycle.name, start_date: cycle.start_date, end_date: cycle.end_date, status: cycle.status }
    : CYCLE_EMPTY
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
          {cycle?.id && (
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                {STATUSES.map(s => <option key={s} value={s} style={{ textTransform: 'capitalize' }}>{s}</option>)}
              </select>
            </div>
          )}
          <div className="flex-row" style={{ justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid #E5E5E0' }}>
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

function SlotModal({ cycleId, slot, onClose, onSave }) {
  const [subjects, setSubjects] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [students, setStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [form, setForm] = useState(slot ? {
    subject_id: slot.subject_id, date: slot.date, start_time: slot.start_time,
    duration_mins: slot.duration_mins,
    classroom_ids: slot.rooms?.map(r => r.classroom_id) || [],
    student_ids: [],
  } : { subject_id: '', date: '', start_time: '', duration_mins: 180, classroom_ids: [], student_ids: [] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/subjects'), api.get('/classrooms')]).then(([sr, cr]) => {
      setSubjects(sr.data); setClassrooms(cr.data);
    });
  }, []);

  useEffect(() => {
    if (!form.subject_id) { setStudents([]); return; }
    const subj = subjects.find(s => s.id === form.subject_id);
    if (!subj) return;
    setLoadingStudents(true);
    api.get('/students', { params: { branch: subj.branch, year: subj.year } }).then(r => {
      setStudents(r.data);
      setForm(f => ({ ...f, student_ids: r.data.map(s => s.id) }));
    }).finally(() => setLoadingStudents(false));
  }, [form.subject_id, subjects]);

  const toggleClassroom = (id) => setForm(f => ({
    ...f, classroom_ids: f.classroom_ids.includes(id)
      ? f.classroom_ids.filter(x => x !== id)
      : [...f.classroom_ids, id]
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
      <div className="modal modal-lg">
        <h2 className="modal-title">{slot?.id ? 'Edit Exam Slot' : 'New Exam Slot'}</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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

          <div className="form-group">
            <label className="form-label">Assign Classrooms</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {classrooms.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleClassroom(c.id)}
                  className="btn btn-sm"
                  style={{
                    background: form.classroom_ids.includes(c.id) ? '#111111' : 'transparent',
                    color: form.classroom_ids.includes(c.id) ? '#F9F9F7' : 'var(--np-n600)',
                    borderColor: form.classroom_ids.includes(c.id) ? '#111111' : '#E5E5E0',
                  }}
                >
                  {c.room_no} (cap. {c.capacity})
                </button>
              ))}
              {classrooms.length === 0 && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--np-n400)' }}>
                  No classrooms configured yet
                </span>
              )}
            </div>
          </div>

          {form.subject_id && (
            <div className="alert alert-info" style={{ margin: 0 }}>
              <Users size={13} strokeWidth={1.5} />
              {loadingStudents
                ? 'Loading students…'
                : `${students.length} students auto-selected from subject branch/year`}
            </div>
          )}

          <div className="flex-row" style={{ justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid #E5E5E0' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <div className="spinner spinner-invert" style={{ width: 14, height: 14 }} /> : (slot?.id ? 'Update Slot' : 'Create Slot')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

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

  const delSlot = async (cycleId, slotId) => {
    if (!confirm('Delete this exam slot?')) return;
    await api.delete(`/exam-cycles/${cycleId}/slots/${slotId}`);
    toast.success('Slot deleted'); loadSlots(cycleId);
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="accent-bar" />
          <h1 className="page-title">Exam Cycles</h1>
          <p className="page-subtitle">Periods, slots, and room allocations</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setModal('cycle'); }}>
          <Plus size={13} strokeWidth={1.5} /> New Cycle
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : cycles.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 64 }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>No Exam Cycles</div>
          <p style={{ fontFamily: 'var(--font-body)', fontStyle: 'italic', color: 'var(--np-n500)', marginBottom: 20, fontSize: 14 }}>
            Create your first exam cycle to begin managing exams.
          </p>
          <button className="btn btn-primary" onClick={() => { setEditing(null); setModal('cycle'); }}>
            <Plus size={13} strokeWidth={1.5} /> Create First Cycle
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid #111' }}>
          {cycles.map((cycle, ci) => (
            <div key={cycle.id} style={{ borderBottom: ci < cycles.length - 1 ? '1px solid #111' : 'none' }}>
              {/* Cycle header row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 16px',
                  cursor: 'pointer',
                  background: expanded[cycle.id] ? '#F5F5F5' : '#F9F9F7',
                  borderBottom: expanded[cycle.id] ? '1px solid #E5E5E0' : 'none',
                  transition: 'background 0.12s',
                }}
                onClick={() => toggleExpanded(cycle.id)}
              >
                <div style={{ color: 'var(--np-n500)', flexShrink: 0 }}>
                  {expanded[cycle.id]
                    ? <ChevronDown size={15} strokeWidth={1.5} />
                    : <ChevronRight size={15} strokeWidth={1.5} />}
                </div>

                {/* Status indicator */}
                <div style={{
                  width: 6, height: 6, flexShrink: 0,
                  background: STATUS_ACCENT[cycle.status] || '#A3A3A3',
                }} />

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 700 }}>{cycle.name}</span>
                    <span className="badge" style={{
                      color: STATUS_ACCENT[cycle.status] || '#A3A3A3',
                      borderColor: STATUS_ACCENT[cycle.status] || '#A3A3A3',
                      textTransform: 'capitalize',
                    }}>{cycle.status}</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--np-n500)', marginTop: 2 }}>
                    {cycle.start_date} — {cycle.end_date}
                  </div>
                </div>

                <div className="flex-row" style={{ gap: 4 }} onClick={e => e.stopPropagation()}>
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }} onClick={() => setActiveCycle(cycle.id)}>
                    Set Active
                  </button>
                  <Link to={`/conflicts/${cycle.id}`} className="btn btn-warning btn-sm" style={{ fontSize: 10 }}>Conflicts</Link>
                  <Link to={`/export/${cycle.id}`} className="btn btn-success btn-sm" style={{ fontSize: 10 }}>Export</Link>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setEditing(cycle); setModal('cycle'); }} aria-label="Edit">
                    <Pencil size={12} strokeWidth={1.5} />
                  </button>
                  <button className="btn btn-danger btn-icon btn-sm" onClick={() => delCycle(cycle.id)} aria-label="Delete">
                    <Trash2 size={12} strokeWidth={1.5} />
                  </button>
                </div>
              </div>

              {/* Expanded slots panel */}
              {expanded[cycle.id] && (
                <div style={{ padding: '16px 18px', background: '#FDFDFB' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--np-n500)' }}>
                      Exam Slots
                    </span>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setSlotCycleId(cycle.id); setEditing(null); setModal('slot'); }}>
                      <Plus size={12} strokeWidth={1.5} /> Add Slot
                    </button>
                  </div>

                  {!slotsMap[cycle.id] ? (
                    <div className="spinner" style={{ margin: '0 auto' }} />
                  ) : slotsMap[cycle.id].length === 0 ? (
                    <p style={{ fontFamily: 'var(--font-body)', fontStyle: 'italic', color: 'var(--np-n500)', fontSize: 13 }}>
                      No slots yet. Add an exam slot to allocate rooms and students.
                    </p>
                  ) : (
                    <div style={{ border: '1px solid #E5E5E0' }}>
                      {slotsMap[cycle.id].map((slot, si) => (
                        <div
                          key={slot.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '10px 14px',
                            borderBottom: si < slotsMap[cycle.id].length - 1 ? '1px solid #E5E5E0' : 'none',
                            background: '#F9F9F7',
                          }}
                        >
                          {/* Status dot */}
                          <div style={{
                            width: 5, height: 5, flexShrink: 0,
                            background: STATUS_ACCENT[slot.status] || '#A3A3A3',
                          }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13 }}>
                              {slot.subject_code} — {slot.subject_name}
                            </div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--np-n500)', marginTop: 2 }}>
                              {slot.date} · {slot.start_time} · {slot.duration_mins}min ·{' '}
                              {slot.rooms?.map(r => r.room_no).join(', ') || 'No rooms'} ·{' '}
                              {slot.student_count} students
                            </div>
                          </div>
                          <div className="flex-row" style={{ gap: 4 }}>
                            <Link to={`/seating/${slot.id}`} className="btn btn-ghost btn-sm" style={{ fontSize: 10 }}>
                              <Grid3x3 size={11} strokeWidth={1.5} /> Seating
                            </Link>
                            <Link to={`/supervisors/${slot.id}`} className="btn btn-ghost btn-sm" style={{ fontSize: 10 }}>
                              <UserCog size={11} strokeWidth={1.5} /> Supervisors
                            </Link>
                            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setSlotCycleId(cycle.id); setEditing(slot); setModal('slot'); }} aria-label="Edit">
                              <Pencil size={11} strokeWidth={1.5} />
                            </button>
                            <button className="btn btn-danger btn-icon btn-sm" onClick={() => delSlot(cycle.id, slot.id)} aria-label="Delete">
                              <Trash2 size={11} strokeWidth={1.5} />
                            </button>
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
        <SlotModal cycleId={slotCycleId} slot={editing} onClose={() => setModal(null)} onSave={() => loadSlots(slotCycleId)} />
      )}
    </div>
  );
}
