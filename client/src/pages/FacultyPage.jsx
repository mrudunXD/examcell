import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, UserCheck, BookOpen, Check } from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';

const EMPTY = { name: '', email: '', department: '', password: '' };

function FacultyModal({ faculty, onClose, onSave }) {
  const [form, setForm] = useState(faculty ? { name: faculty.name, email: faculty.email, department: faculty.department || '', password: '' } : EMPTY);
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
        <div className="flex-between" style={{ marginBottom: 20 }}>
          <h2>{faculty?.id ? 'Edit Faculty' : 'Add Faculty Account'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
          <div className="flex-row" style={{ justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <div className="spinner" /> : (faculty?.id ? 'Update' : 'Create Account')}
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

  const grouped = {};
  for (const s of allSubjects) {
    const k = `${s.year} — ${s.branch}`;
    if (!grouped[k]) grouped[k] = [];
    grouped[k].push(s);
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="flex-between" style={{ marginBottom: 20 }}>
          <h2>Subjects taught by {faculty.name}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="alert alert-info" style={{ marginBottom: 16 }}>
          <BookOpen size={14} /> Faculty will NOT be assigned as supervisor for subjects checked here.
        </div>
        <div style={{ maxHeight: 380, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
          {Object.entries(grouped).map(([group, subs]) => (
            <div key={group}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>{group}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {subs.map(s => (
                  <button key={s.id} onClick={() => toggle(s.id)} className="btn btn-sm"
                    style={{
                      background: selected.includes(s.id) ? 'rgba(59,130,246,0.2)' : 'var(--color-surface)',
                      border: `1px solid ${selected.includes(s.id) ? 'rgba(59,130,246,0.5)' : 'var(--color-border)'}`,
                      color: selected.includes(s.id) ? '#60a5fa' : 'var(--color-text-muted)'
                    }}>
                    {selected.includes(s.id) && <Check size={11} />} {s.code} — {s.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex-row" style={{ justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <div className="spinner" /> : 'Save Assignments'}
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
        <div><h1>Faculty</h1><p>{faculty.length} faculty accounts</p></div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setModal('form'); }}>
          <Plus size={15} /> Add Faculty
        </button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Name</th><th>Email</th><th>Department</th><th>Subjects Taught</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32 }}><div className="spinner" style={{ margin: '0 auto' }} /></td></tr>
            : faculty.length === 0 ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>No faculty yet</td></tr>
            : faculty.map((f, i) => (
              <tr key={f.id}>
                <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{i + 1}</td>
                <td style={{ fontWeight: 600 }}><div className="flex-row" style={{ gap: 8 }}><UserCheck size={14} color="var(--color-accent)" />{f.name}</div></td>
                <td style={{ fontSize: 12 }}>{f.email}</td>
                <td style={{ fontSize: 12 }}>{f.department || '—'}</td>
                <td>
                  <div className="flex-row" style={{ flexWrap: 'wrap', gap: 4 }}>
                    {f.subjects?.length === 0
                      ? <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>None assigned</span>
                      : f.subjects?.slice(0, 3).map(s => <span key={s.id} className="badge badge-neutral" style={{ fontSize: 10 }}>{s.code}</span>)}
                    {f.subjects?.length > 3 && <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>+{f.subjects.length - 3}</span>}
                  </div>
                </td>
                <td>
                  <div className="flex-row" style={{ gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(f); setModal('subjects'); }} title="Assign subjects">
                      <BookOpen size={13} /> Subjects
                    </button>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setEditing(f); setModal('form'); }}><Pencil size={13} /></button>
                    <button className="btn btn-danger btn-icon btn-sm" onClick={() => del(f.id)}><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal === 'form' && <FacultyModal faculty={editing} onClose={() => setModal(null)} onSave={fetch} />}
      {modal === 'subjects' && editing && <SubjectAssignModal faculty={editing} allSubjects={subjects} onClose={() => setModal(null)} onSave={fetch} />}
    </div>
  );
}
