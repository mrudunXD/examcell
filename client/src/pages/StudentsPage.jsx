import { useState, useEffect, useRef } from 'react';
import { Users, Plus, Pencil, Trash2, Upload, Download, Search, X } from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';

const YEARS = ['FY', 'SY', 'TY', 'LY'];
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

const EMPTY = { name: '', prn: '', roll_no: '', branch: '', year: 'FY', semester: 1, scheme: 'K Scheme' };

function StudentModal({ student, onClose, onSave }) {
  const [form, setForm] = useState(student || EMPTY);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (student?.id) {
        await api.put(`/students/${student.id}`, form);
        toast.success('Student updated');
      } else {
        await api.post('/students', form);
        toast.success('Student added');
      }
      onSave();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="flex-between" style={{ marginBottom: 20 }}>
          <h2>{student?.id ? 'Edit Student' : 'Add Student'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="e.g. Rahul Sharma" />
            </div>
            <div className="form-group">
              <label className="form-label">PRN (Permanent) *</label>
              <input className="input" value={form.prn} onChange={e => setForm({ ...form, prn: e.target.value })} required placeholder="e.g. 2023010100001" />
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Roll No (Class) *</label>
              <input className="input" value={form.roll_no} onChange={e => setForm({ ...form, roll_no: e.target.value })} required placeholder="e.g. 23BCE001" />
            </div>
            <div className="form-group">
              <label className="form-label">Branch *</label>
              <input className="input" value={form.branch} onChange={e => setForm({ ...form, branch: e.target.value })} required placeholder="e.g. CSE, Mechanical, Civil" />
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Year *</label>
              <select className="select" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })}>
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Semester *</label>
              <select className="select" value={form.semester} onChange={e => setForm({ ...form, semester: parseInt(e.target.value) })}>
                {SEMESTERS.map(s => <option key={s} value={s}>Sem {s}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Scheme</label>
            <input className="input" value={form.scheme} onChange={e => setForm({ ...form, scheme: e.target.value })} placeholder="K Scheme" />
          </div>
          <div className="flex-row" style={{ justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <div className="spinner" /> : (student?.id ? 'Update' : 'Add Student')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CSVImportModal({ onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/students/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult(data);
      if (data.inserted > 0) { toast.success(`${data.inserted} student(s) imported`); onDone(); }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Import failed');
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    const csv = 'name,prn,roll_no,branch,year,semester,scheme\nRahul Sharma,2023010100001,23BCE001,CSE,FY,1,K Scheme\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'students_template.csv'; a.click();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="flex-between" style={{ marginBottom: 20 }}>
          <h2>Import Students via CSV</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="alert alert-info" style={{ marginBottom: 16 }}>
          CSV must have headers: <code style={{ fontSize: 11, background: 'rgba(0,0,0,0.3)', padding: '1px 4px', borderRadius: 3 }}>name, prn, roll_no, branch, year, semester, scheme</code>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={downloadTemplate} style={{ marginBottom: 16 }}>
          <Download size={14} /> Download Template
        </button>
        <div
          onClick={() => fileRef.current.click()}
          style={{
            border: '2px dashed var(--color-border)', borderRadius: 10,
            padding: 32, textAlign: 'center', cursor: 'pointer',
            transition: 'border-color 0.2s', marginBottom: 16
          }}
          onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--color-accent)'; }}
          onDragLeave={e => e.currentTarget.style.borderColor = 'var(--color-border)'}
          onDrop={e => { e.preventDefault(); setFile(e.dataTransfer.files[0]); e.currentTarget.style.borderColor = 'var(--color-border)'; }}
        >
          <Upload size={28} color="var(--color-text-muted)" style={{ margin: '0 auto 10px' }} />
          <p style={{ fontSize: 13 }}>{file ? <strong>{file.name}</strong> : 'Click or drag & drop a CSV file'}</p>
          <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => setFile(e.target.files[0])} />
        </div>
        {result && (
          <div style={{ marginBottom: 16 }}>
            <div className="alert alert-success">✅ {result.inserted} inserted out of {result.total} rows</div>
            {result.failed.length > 0 && (
              <details>
                <summary style={{ fontSize: 12, cursor: 'pointer', color: 'var(--color-text-muted)' }}>{result.failed.length} failed rows</summary>
                <div style={{ marginTop: 8, maxHeight: 120, overflowY: 'auto', fontSize: 11 }}>
                  {result.failed.map((f, i) => <div key={i} style={{ color: '#f87171', padding: '2px 0' }}>{f.reason} — {JSON.stringify(f.row)}</div>)}
                </div>
              </details>
            )}
          </div>
        )}
        <div className="flex-row" style={{ justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Importing…</> : <><Upload size={14} /> Import</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [modal, setModal] = useState(null); // null | 'add' | 'edit' | 'import'
  const [editing, setEditing] = useState(null);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (filterBranch) params.branch = filterBranch;
      if (filterYear) params.year = filterYear;
      const { data } = await api.get('/students', { params });
      setStudents(data);
    } catch { toast.error('Failed to load students'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchStudents(); }, [search, filterBranch, filterYear]);

  const deleteStudent = async (id, name) => {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/students/${id}`);
      toast.success('Student deleted');
      fetchStudents();
    } catch { toast.error('Delete failed'); }
  };

  const branches = [...new Set(students.map(s => s.branch))].sort();

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1>Students</h1>
          <p>{students.length} student(s) in database</p>
        </div>
        <div className="flex-row">
          <button className="btn btn-ghost" onClick={() => setModal('import')}>
            <Upload size={15} /> Import CSV
          </button>
          <button className="btn btn-primary" id="add-student-btn" onClick={() => { setEditing(null); setModal('add'); }}>
            <Plus size={15} /> Add Student
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 20, padding: 14 }}>
        <div className="flex-row" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div style={{ position: 'relative', flex: '1 1 200px' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input className="input" style={{ paddingLeft: 32 }} placeholder="Search name, PRN, roll no…"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="select" style={{ width: 160 }} value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
            <option value="">All Branches</option>
            {branches.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <select className="select" style={{ width: 120 }} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
            <option value="">All Years</option>
            {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {(search || filterBranch || filterYear) && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setFilterBranch(''); setFilterYear(''); }}>
              <X size={13} /> Clear
            </button>
          )}
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>PRN</th>
              <th>Roll No</th>
              <th>Branch</th>
              <th>Year</th>
              <th>Sem</th>
              <th>Scheme</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32 }}><div className="spinner" style={{ margin: '0 auto' }} /></td></tr>
            ) : students.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>No students found</td></tr>
            ) : students.map((s, i) => (
              <tr key={s.id}>
                <td style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{i + 1}</td>
                <td style={{ fontWeight: 600 }}>{s.name}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{s.prn}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--color-accent)' }}>{s.roll_no}</td>
                <td>{s.branch}</td>
                <td>
                  <span className={`badge badge-${s.year.toLowerCase()}`}>{s.year}</span>
                </td>
                <td>Sem {s.semester}</td>
                <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{s.scheme}</td>
                <td>
                  <div className="flex-row" style={{ gap: 6 }}>
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setEditing(s); setModal('edit'); }} title="Edit">
                      <Pencil size={13} />
                    </button>
                    <button className="btn btn-danger btn-icon btn-sm" onClick={() => deleteStudent(s.id, s.name)} title="Delete">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(modal === 'add' || modal === 'edit') && (
        <StudentModal student={modal === 'edit' ? editing : null} onClose={() => setModal(null)} onSave={fetchStudents} />
      )}
      {modal === 'import' && <CSVImportModal onClose={() => setModal(null)} onDone={fetchStudents} />}
    </div>
  );
}
