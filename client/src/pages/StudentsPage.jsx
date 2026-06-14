import { useState, useEffect, useRef } from 'react';
import { Users, Plus, Pencil, Trash2, Upload, Download, Search, X } from 'lucide-react';
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
          <div className="flex-row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 6, paddingTop: 16, borderTop: '1px solid #222225' }}>
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
          onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = '#F5F5F7'; }}
          onDragLeave={e => e.currentTarget.style.borderColor = '#222225'}
          onDrop={e => { e.preventDefault(); setFile(e.dataTransfer.files[0]); e.currentTarget.style.borderColor = '#222225'; }}
          style={{
            border: '2px dashed #222225',
            padding: 32,
            textAlign: 'center',
            cursor: 'pointer',
            marginBottom: 16,
            transition: 'border-color 0.15s',
          }}
        >
          <Upload size={24} strokeWidth={1.5} color="#767680" style={{ margin: '0 auto 10px' }} />
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

        <div className="flex-row" style={{ justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid #222225' }}>
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
          <Search size={12} strokeWidth={1.5} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#767680' }} />
          <input
            className="input"
            style={{ paddingLeft: 28, borderBottom: '2px solid #222225', paddingTop: 7, paddingBottom: 7 }}
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
          onDel={(s) => deleteStudent(s.id, s.name)} />
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
    <tr>
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
const YEAR_NAMES = { FY: 'First Year', SY: 'Second Year', TY: 'Third Year', LY: 'Last Year' };

function GroupedStudents({ students, isCoord, onEdit, onDel }) {
  const [drillYear,    setDrillYear]    = useState(null);
  const [drillBranch,  setDrillBranch]  = useState(null);
  const [drillSection, setDrillSection] = useState(null);

  // Build groups
  const yearGroups = {};
  for (const s of students) {
    const y   = s.year;
    const b   = s.branch;
    const sec = s.section || 'All';
    if (!yearGroups[y])        yearGroups[y]        = {};
    if (!yearGroups[y][b])     yearGroups[y][b]     = {};
    if (!yearGroups[y][b][sec]) yearGroups[y][b][sec] = [];
    yearGroups[y][b][sec].push(s);
  }

  // ── Level 3: section table ──────────────────────────────
  if (drillYear && drillBranch && drillSection) {
    const rows = yearGroups[drillYear]?.[drillBranch]?.[drillSection] || [];
    return (
      <div>
        <Breadcrumb crumbs={[
          { label: 'All Years', onClick: () => { setDrillYear(null); setDrillBranch(null); setDrillSection(null); } },
          { label: `${drillYear} — ${drillBranch}`, onClick: () => setDrillSection(null) },
          { label: `Section ${drillSection}` },
        ]} />
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead><tr>
              <th>#</th><th>Name</th><th>PRN</th><th>Roll No</th>
              <th>Sec</th><th>Sem</th>
              {isCoord && <th>Actions</th>}
            </tr></thead>
            <tbody>
              {rows.map((s, i) => <StudentRow key={s.id} s={s} i={i} isCoord={isCoord} onEdit={() => onEdit(s)} onDel={() => onDel(s)} />)}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ── Level 2: branch/section cards ──────────────────────
  if (drillYear && drillBranch) {
    const secs = yearGroups[drillYear][drillBranch];
    return (
      <div>
        <Breadcrumb crumbs={[
          { label: 'All Years', onClick: () => { setDrillYear(null); setDrillBranch(null); } },
          { label: YEAR_NAMES[drillYear], onClick: () => setDrillBranch(null) },
          { label: drillBranch },
        ]} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px', marginTop: 16 }}>
          {Object.entries(secs).sort(([a],[b]) => a.localeCompare(b)).map(([sec, rows]) => (
            <StatCard key={sec}
              label={`Section ${sec}`}
              value={rows.length}
              sub="students"
              onClick={() => setDrillSection(sec)}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Level 1: branch cards for a year ───────────────────
  if (drillYear) {
    const branches = yearGroups[drillYear] || {};
    return (
      <div>
        <Breadcrumb crumbs={[
          { label: 'All Years', onClick: () => setDrillYear(null) },
          { label: YEAR_NAMES[drillYear] },
        ]} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px', marginTop: 16 }}>
          {Object.entries(branches).sort(([a],[b]) => a.localeCompare(b)).map(([branch, secs]) => {
            const total = Object.values(secs).flat().length;
            return (
              <StatCard key={branch}
                label={branch}
                value={total}
                sub={`${Object.keys(secs).length} section(s)`}
                onClick={() => setDrillBranch(branch)}
              />
            );
          })}
        </div>
      </div>
    );
  }

  // ── Level 0: year cards ────────────────────────────────
  if (students.length === 0) {
    return <div style={{ textAlign: 'center', padding: 64, fontFamily: 'var(--font-body)', fontStyle: 'italic', color: 'var(--np-n500)' }}>No students yet.</div>;
  }
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '24px', marginTop: 12 }}>
        {YEAR_ORDER.filter(y => yearGroups[y]).map(year => {
          const total    = Object.values(yearGroups[year]).flatMap(b => Object.values(b).flat()).length;
          const branches = Object.keys(yearGroups[year]).length;
          return (
            <StatCard key={year}
              label={YEAR_NAMES[year]}
              value={total}
              sub={`${branches} branch(es)`}
              accent={year}
              onClick={() => setDrillYear(year)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Shared minimal components ─────────────────────────────────────────────────

function StatCard({ label, value, sub, onClick, accent }) {
  const [hovered, setHovered] = useState(false);
  const accentColors = { FY: 'var(--np-red)', SY: '#166534', TY: '#b45309', LY: '#7c3aed' };
  const ac = accent ? accentColors[accent] || 'var(--np-ink)' : 'var(--np-ink)';
  
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: '24px 22px',
        cursor: onClick ? 'pointer' : 'default',
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
        {onClick && (
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
        )}
      </div>
    </div>
  );
}

function Breadcrumb({ crumbs }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 2, flexWrap: 'wrap' }}>
      {crumbs.map((c, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {i > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--np-n400)', padding: '0 5px' }}>/</span>}
          <button
            onClick={c.onClick}
            disabled={!c.onClick}
            style={{
              fontFamily: 'var(--font-mono)', fontSize: 11,
              color: c.onClick ? 'var(--np-red)' : 'var(--np-n600)',
              background: 'none', border: 'none', cursor: c.onClick ? 'pointer' : 'default',
              padding: '4px 0', fontWeight: c.onClick ? 400 : 600,
              textDecoration: c.onClick ? 'underline' : 'none',
            }}
          >{c.label}</button>
        </span>
      ))}
    </div>
  );
}






