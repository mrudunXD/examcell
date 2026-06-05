import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
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
              <input className="input" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} required placeholder="23CSE301" />
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

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [editing, setEditing] = useState(null);
  const { user } = useAuthStore();
  const isCoord = user?.role === 'coordinator';

  const fetch = async () => {
    setLoading(true);
    try { const { data } = await api.get('/subjects'); setSubjects(data); }
    catch { toast.error('Failed to load subjects'); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetch(); }, []);

  const del = async (id) => {
    if (!confirm('Delete this subject?')) return;
    await api.delete(`/subjects/${id}`); toast.success('Deleted'); fetch();
  };

  // Group: Year → Semester → subjects
  const YEAR_ORDER = ['FY', 'SY', 'TY', 'LY'];
  const YEAR_NAMES = { FY: 'First Year', SY: 'Second Year', TY: 'Third Year', LY: 'Last Year' };
  const grouped = {};
  for (const s of subjects) {
    const y = s.year;
    const sem = `Sem ${s.semester}`;
    if (!grouped[y]) grouped[y] = {};
    if (!grouped[y][sem]) grouped[y][sem] = [];
    grouped[y][sem].push(s);
  }

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
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {YEAR_ORDER.filter(y => grouped[y]).map(year => (
            <div key={year} style={{ border: '1px solid #111' }}>
              {/* Year header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#111111', color: '#F9F9F7' }}>
                <span className={`badge badge-${year.toLowerCase()}`} style={{ fontSize: 10, borderColor: 'rgba(255,255,255,0.2)' }}>{year}</span>
                <span style={{ fontFamily: 'var(--font-serif)', fontSize: 14, fontWeight: 700 }}>{YEAR_NAMES[year]}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.4)', marginLeft: 'auto' }}>
                  {Object.values(grouped[year]).flat().length} subjects
                </span>
              </div>

              {/* Semester sections */}
              {Object.entries(grouped[year]).sort(([a],[b]) => parseInt(a.split(' ')[1]) - parseInt(b.split(' ')[1])).map(([sem, subs], si, arr) => (
                <div key={sem} style={{ borderTop: si > 0 ? '1px solid #E5E5E0' : 'none' }}>
                  {/* Sem divider */}
                  <div style={{
                    padding: '6px 16px', background: '#F5F5F5',
                    fontFamily: 'var(--font-mono)', fontSize: 9,
                    textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--np-n500)',
                    borderLeft: '3px solid #CC0000',
                  }}>
                    {sem} — {subs[0]?.semester % 2 === 1 ? 'Odd Semester' : 'Even Semester'} · {subs.length} subjects
                  </div>

                  <div className="table-wrap" style={{ margin: 0, border: 'none' }}>
                    <table>
                      <thead>
                        <tr><th>Code</th><th>Abbr.</th><th>Name</th><th>Type</th><th>Branch</th>
                          {isCoord && <th>Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {subs.map(s => (
                          <tr key={s.id}>
                            <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--np-red)', fontSize: 12 }}>{s.code}</td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--np-n600)' }}>{s.abbreviation || '—'}</td>
                            <td style={{ fontWeight: 600 }}>{s.name}</td>
                            <td>
                              {s.course_type && (
                                <span className="badge badge-neutral" style={{ fontSize: 9 }}>{s.course_type}</span>
                              )}
                            </td>
                            <td>{s.branch}</td>
                            {isCoord && (
                              <td>
                                <div className="flex-row" style={{ gap: 4 }}>
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
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {isCoord && modal === 'form' && <SubjectModal subject={editing} onClose={() => setModal(null)} onSave={fetch} />}
    </div>
  );
}
