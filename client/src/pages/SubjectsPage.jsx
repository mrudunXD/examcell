import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Lock } from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/index.js';

const YEARS = ['FY', 'SY', 'TY', 'LY'];
const EMPTY = { code: '', name: '', branch: '', year: 'FY', semester: 1, abbreviation: '', course_type: '' };

function SubjectModal({ subject, onClose, onSave }) {
  const [form, setForm] = useState(subject
    ? { code: subject.code, name: subject.name, branch: subject.branch, year: subject.year, semester: subject.semester, abbreviation: subject.abbreviation || '', course_type: subject.course_type || '' }
    : EMPTY
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      subject?.id ? await api.put(`/subjects/${subject.id}`, form) : await api.post('/subjects', form);
      toast.success(subject?.id ? 'Subject updated' : 'Subject added');
      onSave(); onClose();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2 className="modal-title">{subject?.id ? 'Edit Subject' : 'Add Subject'}</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Subject Code *</label>
              <input className="input" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} required placeholder="311302" />
            </div>
            <div className="form-group">
              <label className="form-label">Subject Name *</label>
              <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="Data Structures" />
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Branch *</label>
              <input className="input" value={form.branch} onChange={e => setForm({ ...form, branch: e.target.value })} required placeholder="CSE" />
            </div>
            <div className="form-group">
              <label className="form-label">Year *</label>
              <select className="select" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })}>
                {YEARS.map(y => <option key={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Semester *</label>
              <select className="select" value={form.semester} onChange={e => setForm({ ...form, semester: parseInt(e.target.value) })}>
                {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Sem {s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Abbreviation</label>
              <input className="input" value={form.abbreviation} onChange={e => setForm({ ...form, abbreviation: e.target.value })} placeholder="BMS, ENG…" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Course Type</label>
            <select className="select" value={form.course_type} onChange={e => setForm({ ...form, course_type: e.target.value })}>
              <option value="">Select…</option>
              <option value="DSC">DSC — Discipline Specific Core</option>
              <option value="AEC">AEC — Ability Enhancement</option>
              <option value="SEC">SEC — Skill Enhancement</option>
              <option value="VEC">VEC — Value Education</option>
              <option value="DSE">DSE — Discipline Specific Elective</option>
              <option value="GE">GE — Generic Elective</option>
              <option value="INP">INP — Internship/Project</option>
            </select>
          </div>
          <div className="flex-row" style={{ justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid #E5E5E0' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <div className="spinner spinner-invert" style={{ width: 14, height: 14 }} /> : (subject?.id ? 'Update' : 'Add Subject')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SubjectConstraintsModal({ subject, onClose }) {
  const [constraints, setConstraints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('excluded_date');
  const [date, setDate] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchConstraints = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/subject-constraints');
      setConstraints(data.filter(c => c.subject_id === subject.id));
    } catch {
      toast.error('Failed to load constraints');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConstraints(); }, [subject.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!date) return;
    setSaving(true);
    try {
      const payload = {
        subject_id: subject.id,
        type,
        date,
        shift_id: shiftId || null
      };
      await api.post('/subject-constraints', payload);
      toast.success('Subject constraint added');
      setDate('');
      setShiftId('');
      fetchConstraints();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add constraint');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this scheduling constraint?')) return;
    try {
      await api.delete(`/subject-constraints/${id}`);
      toast.success('Constraint removed');
      fetchConstraints();
    } catch {
      toast.error('Failed to delete constraint');
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20, maxWidth: '800px', border: '4px solid #111111', boxShadow: '8px 8px 0 0 #111111' }}>
        
        {/* Left Panel: Active Constraints List */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: 'var(--np-red)', textTransform: 'uppercase' }}>
            {subject.code}
          </span>
          <h3 style={{ fontFamily: 'var(--font-serif)', margin: '2px 0 12px 0', borderBottom: '2px solid #111', paddingBottom: 6 }}>
            Constraints: {subject.name}
          </h3>

          <div style={{ flex: 1, maxHeight: '340px', overflowY: 'auto' }} className="custom-scrollbar">
            {loading ? (
              <div style={{ textAlign: 'center', padding: 20 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
            ) : constraints.length === 0 ? (
              <div style={{ fontStyle: 'italic', color: '#666', fontSize: 13, padding: 12 }}>
                No scheduling locks or lockout dates registered for this subject.
              </div>
            ) : (
              <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid #111', fontWeight: 'bold' }}>
                    <th style={{ padding: 4 }}>Type</th>
                    <th style={{ padding: 4 }}>Date</th>
                    <th style={{ padding: 4 }}>Shift</th>
                    <th style={{ padding: 4 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {constraints.map((c) => (
                    <tr key={c.id} style={{ borderBottom: '1px solid #E5E5E0' }}>
                      <td style={{ padding: '6px 4px' }}>
                        <span style={{ 
                          fontSize: 9, 
                          background: c.type === 'fixed_slot' ? '#dcfce7' : '#fee2e2', 
                          color: c.type === 'fixed_slot' ? '#166534' : '#991b1b', 
                          border: `1px solid ${c.type === 'fixed_slot' ? '#166534' : '#991b1b'}`, 
                          padding: '1px 4px', 
                          fontWeight: 'bold',
                          textTransform: 'uppercase'
                        }}>
                          {c.type === 'fixed_slot' ? 'Lock Date' : 'Lockout'}
                        </span>
                      </td>
                      <td style={{ padding: '6px 4px', fontFamily: 'var(--font-mono)' }}>{c.date}</td>
                      <td style={{ padding: '6px 4px' }}>
                        {c.shift_id ? `Shift ${c.shift_id}` : 'Full Day'}
                      </td>
                      <td style={{ padding: '6px 4px' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(c.id)} style={{ color: 'var(--np-red)', padding: '2px 4px' }}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Panel: Add Constraint Form */}
        <div>
          <h3 style={{ fontFamily: 'var(--font-serif)', margin: '0 0 12px 0', borderBottom: '2px solid #111', paddingBottom: 6 }}>
            Add Constraint Rule
          </h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Constraint Type *</label>
              <select 
                className="select" 
                value={type} 
                onChange={e => setType(e.target.value)}
                style={{ fontSize: 12 }}
              >
                <option value="excluded_date">Lockout Date (Avoid scheduling here)</option>
                <option value="fixed_slot">Lock to Slot (Force schedule on this slot)</option>
              </select>
            </div>
            
            <div className="form-group">
              <label className="form-label">Date *</label>
              <input 
                type="date" 
                className="input" 
                value={date} 
                onChange={e => setDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Shift Duration</label>
              <select 
                className="select" 
                value={shiftId} 
                onChange={e => setShiftId(e.target.value)}
                style={{ fontSize: 12 }}
              >
                <option value="">Full Day (All Shifts)</option>
                <option value="1">Shift 1 (Morning)</option>
                <option value="2">Shift 2 (Afternoon)</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? 'Saving...' : 'Add Constraint'}
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}

const ACCENT_COLORS = { FY: 'var(--np-red)', SY: '#166534', TY: '#b45309', LY: '#7c3aed' };

function SubjectStatCard({ label, value, sub, onClick, accent }) {
  const [hovered, setHovered] = useState(false);
  const ac = accent ? ACCENT_COLORS[accent] || 'var(--np-ink)' : 'var(--np-ink)';
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '24px 22px',
        cursor: 'pointer',
        border: '4px solid var(--np-ink)',
        background: hovered ? '#F5F5F2' : '#FDFDFB',
        boxShadow: hovered ? '8px 8px 0 0 var(--np-ink)' : '4px 4px 0 0 var(--np-ink)',
        transform: hovered ? 'translate(-4px, -4px)' : 'none',
        transition: 'transform 0.15s ease-out, box-shadow 0.15s ease-out, background 0.15s ease-out',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: '100%',
        minHeight: '140px',
      }}
    >
      {accent && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: ac }} />}
      <div>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 38, fontWeight: 900, color: 'var(--np-ink)', lineHeight: 1.1 }}>
          {value}
        </div>
        <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 16, marginTop: 8, color: 'var(--np-ink)' }}>
          {label}
        </div>
      </div>
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        {sub && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--np-n500)', letterSpacing: '0.02em' }}>
            {sub}
          </div>
        )}
        <div style={{ 
          fontFamily: 'var(--font-mono)', 
          fontSize: 10, 
          color: ac === 'var(--np-ink)' ? 'var(--np-red)' : ac, 
          fontWeight: 'bold',
          textTransform: 'uppercase', 
          letterSpacing: '0.08em',
          textDecoration: hovered ? 'underline' : 'none'
        }}>
          View →
        </div>
      </div>
    </div>
  );
}

function SubjectsBreadcrumb({ year, yearName, branch, sem, onHome, onYear, onBranch }) {
  const crumbs = [{ label: 'All Years', onClick: onHome }];
  if (year)      crumbs.push({ label: yearName, onClick: (branch != null || sem != null) ? onYear : null });
  if (branch)    crumbs.push({ label: branch, onClick: sem != null ? onBranch : null });
  if (sem != null) crumbs.push({ label: `Semester ${sem}`, onClick: null });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 2 }}>
      {crumbs.map((c, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center' }}>
          {i > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--np-n400)', padding: '0 5px' }}>/</span>}
          <button onClick={c.onClick} disabled={!c.onClick} style={{
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: c.onClick ? 'var(--np-red)' : 'var(--np-n600)',
            background: 'none', border: 'none', cursor: c.onClick ? 'pointer' : 'default',
            padding: '4px 0', fontWeight: c.onClick ? 400 : 600,
            textDecoration: c.onClick ? 'underline' : 'none',
          }}>{c.label}</button>
        </span>
      ))}
    </div>
  );
}

export default function SubjectsPage() {
  const [subjects,      setSubjects]    = useState([]);
  const [loading,       setLoading]     = useState(true);
  const [modal,         setModal]       = useState(null);
  const [editing,       setEditing]     = useState(null);
  const [drillYear,     setDrillYear]   = useState(null);
  const [drillBranch,   setDrillBranch] = useState(null);
  const [drillSem,      setDrillSem]    = useState(null);
  const { user }   = useAuthStore();
  const isCoord    = user?.role === 'coordinator';

  const loadSubjects = async () => {
    setLoading(true);
    try { const { data } = await api.get('/subjects'); setSubjects(data); }
    catch { toast.error('Failed to load subjects'); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadSubjects(); }, []);

  const del = async (id) => {
    if (!confirm('Delete this subject?')) return;
    await api.delete(`/subjects/${id}`); toast.success('Deleted'); loadSubjects();
  };

  const resetDrill = () => { setDrillYear(null); setDrillBranch(null); setDrillSem(null); };

  // Build groups: Year → Branch → Semester → subjects[]
  const YEAR_ORDER = ['FY', 'SY', 'TY', 'LY'];
  const YEAR_NAMES = { FY: 'First Year', SY: 'Second Year', TY: 'Third Year', LY: 'Last Year' };
  const grouped = {};
  for (const s of subjects) {
    if (!grouped[s.year])                        grouped[s.year]                        = {};
    if (!grouped[s.year][s.branch])              grouped[s.year][s.branch]              = {};
    if (!grouped[s.year][s.branch][s.semester])  grouped[s.year][s.branch][s.semester]  = [];
    grouped[s.year][s.branch][s.semester].push(s);
  }

  const SubjectTable = ({ subs }) => (
    <div className="table-wrap" style={{ marginTop: 12 }}>
      <table>
        <thead>
          <tr>
            <th>Code</th><th>Abbr.</th><th>Name</th><th>Type</th>
            {isCoord && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {subs.map(s => (
            <tr key={s.id}>
              <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--np-red)', fontSize: 12 }}>{s.code}</td>
              <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--np-n600)' }}>{s.abbreviation || '—'}</td>
              <td style={{ fontWeight: 600 }}>{s.name}</td>
              <td>{s.course_type && <span className="badge badge-neutral" style={{ fontSize: 9 }}>{s.course_type}</span>}</td>
              {isCoord && (
                <td>
                  <div className="flex-row" style={{ gap: 4 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(s); setModal('constraints'); }} title="Lock or Exclude scheduling slots">
                      <Lock size={12} strokeWidth={1.5} /> Lock
                    </button>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setEditing(s); setModal('form'); }}><Pencil size={12} strokeWidth={1.5} /></button>
                    <button className="btn btn-danger btn-icon btn-sm" onClick={() => del(s.id)}><Trash2 size={12} strokeWidth={1.5} /></button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="accent-bar" />
          <h1 className="page-title">Subjects</h1>
          <p className="page-subtitle">{subjects.length} subjects configured</p>
        </div>
        {isCoord && (
          <button className="btn btn-primary" onClick={() => { setEditing(null); setModal('form'); }}>
            <Plus size={13} strokeWidth={1.5} /> Add Subject
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : subjects.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <p style={{ fontFamily: 'var(--font-body)', fontStyle: 'italic', color: 'var(--np-n500)' }}>No subjects configured yet.</p>
        </div>
      ) : drillYear && drillBranch && drillSem != null ? (
        // ── Level 3: subject table ───────────────────────────
        <>
          <SubjectsBreadcrumb
            year={drillYear} yearName={YEAR_NAMES[drillYear]}
            branch={drillBranch} sem={drillSem}
            onHome={resetDrill}
            onYear={() => { setDrillBranch(null); setDrillSem(null); }}
            onBranch={() => setDrillSem(null)}
          />
          <SubjectTable subs={grouped[drillYear]?.[drillBranch]?.[drillSem] || []} />
        </>
      ) : drillYear && drillBranch ? (
        // ── Level 2: semester cards ──────────────────────────
        <>
          <SubjectsBreadcrumb
            year={drillYear} yearName={YEAR_NAMES[drillYear]}
            branch={drillBranch}
            onHome={resetDrill}
            onYear={() => { setDrillBranch(null); setDrillSem(null); }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px', marginTop: 16 }}>
            {Object.entries(grouped[drillYear][drillBranch]).sort(([a],[b]) => parseInt(a)-parseInt(b)).map(([sem, subs]) => (
              <SubjectStatCard key={sem}
                label={`Semester ${sem}`}
                sub={`${parseInt(sem) % 2 === 1 ? 'Odd' : 'Even'} · ${subs.length} subjects`}
                value={subs.length}
                onClick={() => setDrillSem(parseInt(sem))}
              />
            ))}
          </div>
        </>
      ) : drillYear ? (
        // ── Level 1: branch cards ────────────────────────────
        <>
          <SubjectsBreadcrumb
            year={drillYear} yearName={YEAR_NAMES[drillYear]}
            onHome={resetDrill}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px', marginTop: 16 }}>
            {Object.entries(grouped[drillYear]).sort(([a],[b]) => a.localeCompare(b)).map(([branch, semMap]) => {
              const total = Object.values(semMap).flat().length;
              const sems  = Object.keys(semMap).length;
              return (
                <SubjectStatCard key={branch}
                  label={branch}
                  value={total}
                  sub={`${sems} semester(s)`}
                  onClick={() => setDrillBranch(branch)}
                />
              );
            })}
          </div>
        </>
      ) : (
        // ── Level 0: year cards ──────────────────────────────
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '24px', marginTop: 12 }}>
          {YEAR_ORDER.filter(y => grouped[y]).map(year => {
            const total    = Object.values(grouped[year]).flatMap(b => Object.values(b)).flat().length;
            const branches = Object.keys(grouped[year]).length;
            return (
              <SubjectStatCard key={year}
                label={YEAR_NAMES[year]}
                value={total}
                sub={`${branches} branch(es)`}
                accent={year}
                onClick={() => setDrillYear(year)}
              />
            );
          })}
        </div>
      )}

      {isCoord && modal === 'form' && <SubjectModal subject={editing} onClose={() => setModal(null)} onSave={loadSubjects} />}
      {isCoord && modal === 'constraints' && editing && (
        <SubjectConstraintsModal subject={editing} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
