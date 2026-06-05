import { useState, useEffect, useRef } from 'react';
import { Users, Plus, Pencil, Trash2, Upload, Download, Search, X, ChevronDown, ChevronRight } from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/index.js';

const YEARS = ['FY', 'SY', 'TY', 'LY'];
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];
const EMPTY = { name: '', prn: '', roll_no: '', branch: '', section: '', year: 'FY', semester: 1 };

function StudentModal({ student, onClose, onSave }) {
  const [form, setForm] = useState(student || EMPTY);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      student?.id ? await api.put(`/students/${student.id}`, form) : await api.post('/students', form);
      toast.success(student?.id ? 'Student updated' : 'Student added');
      onSave(); onClose();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to save'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2 className="modal-title">{student?.id ? 'Edit Student' : 'Add Student'}</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="Rahul Sharma" />
            </div>
            <div className="form-group">
              <label className="form-label">PRN (Permanent) *</label>
              <input className="input" value={form.prn} onChange={e => setForm({ ...form, prn: e.target.value })} required placeholder="2023010100001" />
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Roll No (Class) *</label>
              <input className="input" value={form.roll_no} onChange={e => setForm({ ...form, roll_no: e.target.value })} required placeholder="23BCE001" />
            </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Branch *</label>
              <input className="input" value={form.branch} onChange={e => setForm({ ...form, branch: e.target.value })} required placeholder="CSE, Mechanical…" />
            </div>
            <div className="form-group">
              <label className="form-label">Section</label>
              <input className="input" value={form.section} onChange={e => setForm({ ...form, section: e.target.value })} placeholder="A, B, C…" />
            </div>
          </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Year *</label>
              <select className="select" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })}>
                {YEARS.map(y => <option key={y}>{y}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Semester *</label>
              <select className="select" value={form.semester} onChange={e => setForm({ ...form, semester: parseInt(e.target.value) })}>
                {SEMESTERS.map(s => <option key={s} value={s}>Sem {s}</option>)}
              </select>
            </div>
          </div>
          <div className="flex-row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 6, paddingTop: 16, borderTop: '1px solid #E5E5E0' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <div className="spinner spinner-invert" style={{ width: 14, height: 14 }} /> : (student?.id ? 'Update Student' : 'Add Student')}
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
    } catch (err) { toast.error(err.response?.data?.error || 'Import failed'); }
    finally { setUploading(false); }
  };

  const downloadTemplate = () => {
    const csv = 'name,prn,roll_no,branch,section,year,semester\nRahul Sharma,2023010100001,23BCE001,CSE,A,FY,1\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'students_template.csv'; a.click();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2 className="modal-title">Import Students — CSV</h2>
        <div className="alert alert-info" style={{ marginBottom: 16 }}>
          Required columns: <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>name, prn, roll_no, branch, section (optional), year, semester</code>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={downloadTemplate} style={{ marginBottom: 16 }}>
          <Download size={13} strokeWidth={1.5} /> Download Template
        </button>

        <div
          onClick={() => fileRef.current.click()}
          onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#111111'; }}
          onDragLeave={e => e.currentTarget.style.borderColor = '#E5E5E0'}
          onDrop={e => { e.preventDefault(); setFile(e.dataTransfer.files[0]); e.currentTarget.style.borderColor = '#E5E5E0'; }}
          style={{
            border: '2px dashed #E5E5E0',
            padding: 32,
            textAlign: 'center',
            cursor: 'pointer',
            marginBottom: 16,
            transition: 'border-color 0.15s',
          }}
        >
          <Upload size={24} strokeWidth={1.5} color="#A3A3A3" style={{ margin: '0 auto 10px' }} />
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--np-n600)' }}>
            {file ? <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{file.name}</strong> : 'Click or drag & drop a CSV file'}
          </p>
          <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => setFile(e.target.files[0])} />
        </div>

        {result && (
          <div style={{ marginBottom: 16 }}>
            <div className="alert alert-success">{result.inserted} inserted of {result.total} rows</div>
            {result.failed.length > 0 && (
              <details style={{ marginTop: 8 }}>
                <summary style={{ fontSize: 11, cursor: 'pointer', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {result.failed.length} failed rows
                </summary>
                <div style={{ marginTop: 8, maxHeight: 100, overflowY: 'auto', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
                  {result.failed.map((f, i) => <div key={i} style={{ color: 'var(--np-red)', padding: '2px 0' }}>{f.reason}</div>)}
                </div>
              </details>
            )}
          </div>
        )}

        <div className="flex-row" style={{ justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid #E5E5E0' }}>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? <><div className="spinner spinner-invert" style={{ width: 14, height: 14 }} /> Importing…</> : <><Upload size={13} strokeWidth={1.5} /> Import</>}
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
  const [modal, setModal] = useState(null);
  const [editing, setEditing] = useState(null);
  const [collapsed, setCollapsed] = useState({});
  const { user } = useAuthStore();
  const isCoord = user?.role === 'coordinator';

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
      toast.success('Student deleted'); fetchStudents();
    } catch { toast.error('Delete failed'); }
  };

  const branches = [...new Set(students.map(s => s.branch))].sort();

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="accent-bar" />
          <h1 className="page-title">Students</h1>
          <p className="page-subtitle">{students.length} students in database</p>
        </div>
        {isCoord && (
          <div className="flex-row" style={{ gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => setModal('import')}>
              <Upload size={13} strokeWidth={1.5} /> Import CSV
            </button>
            <button className="btn btn-primary" id="add-student-btn" onClick={() => { setEditing(null); setModal('add'); }}>
              <Plus size={13} strokeWidth={1.5} /> Add Student
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 200px' }}>
          <Search size={12} strokeWidth={1.5} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#A3A3A3' }} />
          <input
            className="input"
            style={{ paddingLeft: 28, borderBottom: '2px solid #E5E5E0', paddingTop: 7, paddingBottom: 7 }}
            placeholder="Search name, PRN, roll no…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="select" style={{ width: 160 }} value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
          <option value="">All Branches</option>
          {branches.map(b => <option key={b}>{b}</option>)}
        </select>
        <select className="select" style={{ width: 120 }} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
          <option value="">All Years</option>
          {YEARS.map(y => <option key={y}>{y}</option>)}
        </select>
        {(search || filterBranch || filterYear) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setFilterBranch(''); setFilterYear(''); }}>
            <X size={12} strokeWidth={1.5} /> Clear
          </button>
        )}
      </div>

      {/* Grouped display: Year → Branch → Section */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : search || filterBranch || filterYear ? (
        // Flat table when filtering/searching
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>#</th><th>Name</th><th>PRN</th><th>Roll No</th>
              <th>Branch</th><th>Sec</th><th>Year</th><th>Sem</th>
              {isCoord && <th>Actions</th>}
            </tr></thead>
            <tbody>
              {students.length === 0
                ? <tr><td colSpan={isCoord ? 9 : 8} style={{ textAlign: 'center', padding: 32, color: 'var(--np-n500)', fontStyle: 'italic' }}>No students found</td></tr>
                : students.map((s, i) => <StudentRow key={s.id} s={s} i={i} isCoord={isCoord}
                    onEdit={() => { setEditing(s); setModal('edit'); }}
                    onDel={() => deleteStudent(s.id, s.name)} />)
              }
            </tbody>
          </table>
        </div>
      ) : (
        // Grouped view
        <GroupedStudents students={students} isCoord={isCoord}
          onEdit={(s) => { setEditing(s); setModal('edit'); }}
          onDel={(s) => deleteStudent(s.id, s.name)}
          collapsed={collapsed} setCollapsed={setCollapsed} />
      )}

      {isCoord && (modal === 'add' || modal === 'edit') && (
        <StudentModal student={modal === 'edit' ? editing : null} onClose={() => setModal(null)} onSave={fetchStudents} />
      )}
      {isCoord && modal === 'import' && <CSVImportModal onClose={() => setModal(null)} onDone={fetchStudents} />}
    </div>
  );
}

function StudentRow({ s, i, isCoord, onEdit, onDel }) {
  return (
    <tr key={s.id}>
      <td style={{ color: 'var(--np-n400)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>{i + 1}</td>
      <td style={{ fontWeight: 600 }}>{s.name}</td>
      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{s.prn}</td>
      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--np-red)' }}>{s.roll_no}</td>
      <td>{s.branch}</td>
      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--np-n500)' }}>{s.section || '—'}</td>
      <td><span className={`badge badge-${s.year.toLowerCase()}`}>{s.year}</span></td>
      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>Sem {s.semester}</td>
      {isCoord && (
        <td>
          <div className="flex-row" style={{ gap: 4 }}>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={onEdit}><Pencil size={12} strokeWidth={1.5} /></button>
            <button className="btn btn-danger btn-icon btn-sm" onClick={onDel}><Trash2 size={12} strokeWidth={1.5} /></button>
          </div>
        </td>
      )}
    </tr>
  );
}

const YEAR_ORDER = ['FY', 'SY', 'TY', 'LY'];

function GroupedStudents({ students, isCoord, onEdit, onDel, collapsed, setCollapsed }) {
  // Group: Year → Branch → Section → rows
  const yearGroups = {};
  for (const s of students) {
    const y = s.year;
    const b = s.branch;
    const sec = s.section || 'All';
    if (!yearGroups[y]) yearGroups[y] = {};
    if (!yearGroups[y][b]) yearGroups[y][b] = {};
    if (!yearGroups[y][b][sec]) yearGroups[y][b][sec] = [];
    yearGroups[y][b][sec].push(s);
  }

  const toggle = (key) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {YEAR_ORDER.filter(y => yearGroups[y]).map(year => {
        const yKey = `y-${year}`;
        const yOpen = !collapsed[yKey];
        const yTotal = Object.values(yearGroups[year]).flatMap(b => Object.values(b).flat()).length;
        return (
          <div key={year} style={{ border: '1px solid #111', marginBottom: 10 }}>
            {/* Year header */}
            <div
              onClick={() => toggle(yKey)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px',
                background: '#111111', color: '#F9F9F7', cursor: 'pointer' }}
            >
              {yOpen ? <ChevronDown size={14} strokeWidth={1.5} /> : <ChevronRight size={14} strokeWidth={1.5} />}
              <span className={`badge badge-${year.toLowerCase()}`} style={{ fontSize: 10, borderColor: 'rgba(255,255,255,0.2)' }}>{year}</span>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 700 }}>
                {year === 'FY' ? 'First Year' : year === 'SY' ? 'Second Year' : year === 'TY' ? 'Third Year' : 'Last Year'}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.4)', marginLeft: 'auto' }}>
                {yTotal} students · {Object.keys(yearGroups[year]).length} branches
              </span>
            </div>

            {yOpen && Object.entries(yearGroups[year]).sort(([a],[b]) => a.localeCompare(b)).map(([branch, secs]) => {
              const bKey = `b-${year}-${branch}`;
              const bOpen = !collapsed[bKey];
              const bTotal = Object.values(secs).flat().length;
              return (
                <div key={branch} style={{ borderTop: '1px solid #E5E5E0' }}>
                  {/* Branch header */}
                  <div onClick={() => toggle(bKey)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 18px',
                      background: '#F5F5F5', cursor: 'pointer', borderLeft: '4px solid #111' }}>
                    {bOpen ? <ChevronDown size={13} strokeWidth={1.5} color="#525252" /> : <ChevronRight size={13} strokeWidth={1.5} color="#525252" />}
                    <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13 }}>{branch}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--np-n500)', marginLeft: 'auto' }}>
                      {bTotal} students · {Object.keys(secs).length} section(s)
                    </span>
                  </div>

                  {bOpen && Object.entries(secs).sort(([a],[b]) => a.localeCompare(b)).map(([section, rows]) => {
                    const secKey = `s-${year}-${branch}-${section}`;
                    const secOpen = !collapsed[secKey];
                    return (
                      <div key={section}>
                        {/* Section sub-header */}
                        <div onClick={() => toggle(secKey)}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 28px',
                            borderTop: '1px solid #E5E5E0', background: '#FAFAF8', cursor: 'pointer' }}>
                          {secOpen ? <ChevronDown size={11} strokeWidth={1.5} color="#A3A3A3" /> : <ChevronRight size={11} strokeWidth={1.5} color="#A3A3A3" />}
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--np-n500)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                            Section {section}
                          </span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--np-n400)', marginLeft: 'auto' }}>{rows.length} students</span>
                        </div>
                        {secOpen && (
                          <div className="table-wrap" style={{ margin: 0, border: 'none' }}>
                            <table style={{ border: 'none' }}>
                              <thead><tr>
                                <th>#</th><th>Name</th><th>PRN</th><th>Roll No</th>
                                <th>Sem</th>
                                {isCoord && <th>Actions</th>}
                              </tr></thead>
                              <tbody>
                                {rows.map((s, i) => <StudentRow key={s.id} s={s} i={i} isCoord={isCoord}
                                  onEdit={() => onEdit(s)} onDel={() => onDel(s)} />)}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}
      {students.length === 0 && (
        <div style={{ textAlign: 'center', padding: 64, fontFamily: 'var(--font-body)', fontStyle: 'italic', color: 'var(--np-n500)' }}>
          No students in database yet.
        </div>
      )}
    </div>
  );
}
