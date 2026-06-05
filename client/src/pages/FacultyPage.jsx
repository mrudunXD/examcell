import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, BookOpen, Check, UserCheck } from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/index.js';

const EMPTY = { name: '', email: '', department: '', password: '' };

function FacultyModal({ faculty, onClose, onSave }) {
  const [form, setForm] = useState(faculty
    ? { name: faculty.name, email: faculty.email, department: faculty.department || '', password: '' }
    : EMPTY
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      faculty?.id ? await api.put(`/faculty/${faculty.id}`, form) : await api.post('/faculty', form);
      toast.success(faculty?.id ? 'Faculty updated' : 'Faculty account created');
      onSave(); onClose();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2 className="modal-title">{faculty?.id ? 'Edit Faculty' : 'Add Faculty Account'}</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="Prof. Rajesh Kumar" />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required placeholder="faculty@mitwpu.edu.in" />
            </div>
            <div className="form-group">
              <label className="form-label">Department</label>
              <input className="input" value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} placeholder="CSE, Mechanical…" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{faculty?.id ? 'New Password (leave blank to keep)' : 'Password *'}</label>
            <input className="input" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required={!faculty?.id} placeholder="••••••••" />
          </div>
          <div className="flex-row" style={{ justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid #E5E5E0' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <div className="spinner spinner-invert" style={{ width: 14, height: 14 }} /> : (faculty?.id ? 'Update' : 'Create Account')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SubjectAssignModal({ faculty, allSubjects, onClose, onSave }) {
  const [selected, setSelected] = useState(faculty.subjects?.map(s => s.id) || []);
  const [saving, setSaving] = useState(false);

  const toggle = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/faculty/${faculty.id}/subjects`, { subject_ids: selected });
      toast.success('Subject assignments updated');
      onSave(); onClose();
    } catch { toast.error('Failed to update subjects'); }
    finally { setSaving(false); }
  };

  // Group by year/branch
  const grouped = {};
  for (const s of allSubjects) {
    const k = `${s.year} — ${s.branch}`;
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(s);
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <h2 className="modal-title">Subjects — {faculty.name}</h2>
        <div className="alert alert-info" style={{ marginBottom: 16 }}>
          <BookOpen size={13} strokeWidth={1.5} />
          Faculty will NOT be assigned to supervise subjects checked here (conflict of interest rule).
        </div>
        <div style={{ maxHeight: 360, overflowY: 'auto', marginBottom: 16 }}>
          {Object.entries(grouped).map(([group, subs]) => (
            <div key={group} style={{ marginBottom: 16 }}>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--np-n500)',
                paddingBottom: 6,
                borderBottom: '1px solid #E5E5E0',
                marginBottom: 8,
              }}>{group}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {subs.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggle(s.id)}
                    className="btn btn-sm"
                    style={{
                      background: selected.includes(s.id) ? '#111111' : 'transparent',
                      color: selected.includes(s.id) ? '#F9F9F7' : 'var(--np-n600)',
                      borderColor: selected.includes(s.id) ? '#111111' : '#E5E5E0',
                    }}
                  >
                    {selected.includes(s.id) && <Check size={10} strokeWidth={2} />}
                    {s.code} — {s.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {Object.keys(grouped).length === 0 && (
            <p style={{ fontFamily: 'var(--font-body)', fontStyle: 'italic', color: 'var(--np-n500)', fontSize: 13 }}>
              No subjects configured yet. Add subjects first.
            </p>
          )}
        </div>
        <div className="flex-row" style={{ justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid #E5E5E0' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <div className="spinner spinner-invert" style={{ width: 14, height: 14 }} /> : 'Save Assignments'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FacultyPage() {
  const [faculty, setFaculty] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [editing, setEditing] = useState(null);
  const { user } = useAuthStore();
  const isCoord = user?.role === 'coordinator';

  const fetch = async () => {
    setLoading(true);
    try {
      const [fr, sr] = await Promise.all([api.get('/faculty'), api.get('/subjects')]);
      setFaculty(fr.data); setSubjects(sr.data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetch(); }, []);

  const del = async (id) => {
    if (!confirm('Deactivate this faculty account?')) return;
    await api.delete(`/faculty/${id}`); toast.success('Deactivated'); fetch();
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="accent-bar" />
          <h1 className="page-title">Faculty</h1>
          <p className="page-subtitle">{faculty.length} faculty accounts</p>
        </div>
        {isCoord && (
          <button className="btn btn-primary" onClick={() => { setEditing(null); setModal('form'); }}>
            <Plus size={13} strokeWidth={1.5} /> Add Faculty
          </button>
        )}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>#</th><th>Name</th><th>Email</th><th>Department</th><th>Subjects Taught</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {loading
              ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32 }}><div className="spinner" style={{ margin: '0 auto' }} /></td></tr>
              : faculty.length === 0
              ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, fontFamily: 'var(--font-body)', fontStyle: 'italic', color: 'var(--np-n500)' }}>No faculty yet</td></tr>
              : faculty.map((f, i) => (
                <tr key={f.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--np-n400)' }}>{i + 1}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{f.name}</div>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--np-n600)' }}>{f.email}</td>
                  <td style={{ fontSize: 12 }}>{f.department || '—'}</td>
                  <td>
                    <div className="flex-row" style={{ flexWrap: 'wrap', gap: 3 }}>
                      {!f.subjects?.length
                        ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--np-n400)' }}>None</span>
                        : f.subjects.slice(0, 3).map(s => (
                            <span key={s.id} className="badge badge-neutral" style={{ fontSize: 9 }}>{s.code}</span>
                          ))
                      }
                      {f.subjects?.length > 3 && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--np-n500)' }}>+{f.subjects.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="flex-row" style={{ gap: 4 }}>
                      {isCoord && (
                        <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(f); setModal('subjects'); }} title="Assign subjects">
                          <BookOpen size={11} strokeWidth={1.5} /> Subjects
                        </button>
                      )}
                      {isCoord && <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setEditing(f); setModal('form'); }}><Pencil size={12} strokeWidth={1.5} /></button>}
                      {isCoord && <button className="btn btn-danger btn-icon btn-sm" onClick={() => del(f.id)}><Trash2 size={12} strokeWidth={1.5} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {isCoord && modal === 'form' && <FacultyModal faculty={editing} onClose={() => setModal(null)} onSave={fetch} />}
      {isCoord && modal === 'subjects' && editing && (
        <SubjectAssignModal faculty={editing} allSubjects={subjects} onClose={() => setModal(null)} onSave={fetch} />
      )}
    </div>
  );
}
