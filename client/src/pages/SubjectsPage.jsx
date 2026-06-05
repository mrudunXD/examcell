import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';

const YEARS = ['FY', 'SY', 'TY', 'LY'];
const EMPTY = { code: '', name: '', branch: '', year: 'FY', semester: 1, scheme: 'K Scheme' };

function SubjectModal({ subject, onClose, onSave }) {
  const [form, setForm] = useState(subject || EMPTY);
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
        <div className="flex-between" style={{ marginBottom: 20 }}>
          <h2>{subject?.id ? 'Edit Subject' : 'Add Subject'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Subject Code *</label>
              <input className="input" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} required placeholder="e.g. 23CSE301" />
            </div>
            <div className="form-group">
              <label className="form-label">Subject Name *</label>
              <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Data Structures" />
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Branch *</label>
              <input className="input" value={form.branch} onChange={e => setForm({ ...form, branch: e.target.value })} required placeholder="e.g. CSE" />
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
              <label className="form-label">Scheme</label>
              <input className="input" value={form.scheme} onChange={e => setForm({ ...form, scheme: e.target.value })} />
            </div>
          </div>
          <div className="flex-row" style={{ justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <div className="spinner" /> : (subject?.id ? 'Update' : 'Add')}
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

  return (
    <div className="fade-in">
      <div className="page-header">
        <div><h1>Subjects</h1><p>{subjects.length} subjects</p></div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setModal('form'); }}>
          <Plus size={15} /> Add Subject
        </button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Code</th><th>Name</th><th>Branch</th><th>Year</th><th>Sem</th><th>Scheme</th><th>Actions</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32 }}><div className="spinner" style={{ margin: '0 auto' }} /></td></tr>
            : subjects.length === 0 ? <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>No subjects yet</td></tr>
            : subjects.map((s, i) => (
              <tr key={s.id}>
                <td style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{i + 1}</td>
                <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-accent)' }}>{s.code}</td>
                <td style={{ fontWeight: 600 }}>{s.name}</td>
                <td>{s.branch}</td>
                <td><span className={`badge badge-${s.year.toLowerCase()}`}>{s.year}</span></td>
                <td>Sem {s.semester}</td>
                <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{s.scheme}</td>
                <td>
                  <div className="flex-row" style={{ gap: 6 }}>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setEditing(s); setModal('form'); }}><Pencil size={13} /></button>
                    <button className="btn btn-danger btn-icon btn-sm" onClick={() => del(s.id)}><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal === 'form' && <SubjectModal subject={editing} onClose={() => setModal(null)} onSave={fetch} />}
    </div>
  );
}
