import { useState, useEffect, useRef } from 'react';
import { Users, Plus, Pencil, Trash2, Upload, Download, Search, X } from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/index.js';
import CountUp from '../components/ReactBits/CountUp.jsx';
import SpotlightCard from '../components/ReactBits/SpotlightCard.jsx';

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
            <div className="form-group">
              <label className="form-label">Branch *</label>
              <input className="input" value={form.branch} onChange={e => setForm({ ...form, branch: e.target.value })} required placeholder="CSE, Mechanical…" />
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Section</label>
              <input className="input" value={form.section} onChange={e => setForm({ ...form, section: e.target.value })} placeholder="A, B, C…" />
            </div>
            <div className="form-group">
              <label className="form-label">Year *</label>
              <select className="select" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })}>
                {YEARS.map(y => <option key={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Semester *</label>
            <select className="select" value={form.semester} onChange={e => setForm({ ...form, semester: parseInt(e.target.value) })}>
              {SEMESTERS.map(s => <option key={s} value={s}>Sem {s}</option>)}
            </select>
          </div>
          <div className="flex-row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 6, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
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
          onDragLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          onDrop={e => { e.preventDefault(); setFile(e.dataTransfer.files[0]); e.currentTarget.style.borderColor = 'var(--border)'; }}
          style={{
            border: '2px dashed var(--border)',
            padding: 32,
            textAlign: 'center',
            cursor: 'pointer',
            marginBottom: 16,
            transition: 'border-color 0.15s',
          }}
        >
          <Upload size={24} strokeWidth={1.5} color="#767680" style={{ margin: '0 auto 10px' }} />
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text-secondary)' }}>
            {file ? <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{file.name}</strong> : 'Click or drag & drop a CSV file'}
          </p>
          <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={e => setFile(e.target.files[0])} />
        </div>

        {result && (
          <div style={{ marginBottom: 16 }}>
            <div className="alert alert-success">{result.inserted} inserted of {result.total} rows</div>
            {result.failed.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <AlertTriangle size={13} color="var(--accent-red)" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Failed to Import {result.failed.length} Row(s):
                  </span>
                </div>
                <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {result.failed.map((f, i) => (
                    <div key={i} style={{
                      background: 'rgba(239,68,68,0.04)',
                      border: '1px solid rgba(239,68,68,0.15)',
                      borderRadius: 8,
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10
                    }}>
                      <span style={{
                        background: 'var(--accent-red)',
                        color: '#fff',
                        fontSize: 9,
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: 4,
                        fontFamily: 'var(--font-mono)'
                      }}>ROW {f.rowIndex || '?'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{f.reason}</div>
                        {f.row && (
                          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 4, wordBreak: 'break-all' }}>
                            Data: {JSON.stringify(f.row)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex-row" style={{ justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
          <button className="btn className=btn btn-primary" onClick={handleUpload} disabled={!file || uploading}>
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
  const [searchQuery, setSearchQuery] = useState('');
  
  useEffect(() => {
    const handler = setTimeout(() => setSearch(searchQuery), 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);
  const [filterBranch, setFilterBranch] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [modal, setModal] = useState(null);
  const [editing, setEditing] = useState(null);
  const [showFiltersMenu, setShowFiltersMenu] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  
  const [branches, setBranches] = useState([]);
  const [sections, setSections] = useState([]);
  const [totalCount, setTotalCount] = useState(0);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const user = useAuthStore(state => state.user);
  const isCoord = user?.role === 'coordinator';

  const fetchMeta = async () => {
    try {
      const { data } = await api.get('/students/meta');
      setBranches(data.branches || []);
      setSections(data.sections || []);
    } catch (e) {
      console.error('Failed to load student meta', e);
    }
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const params = {
        limit: itemsPerPage,
        page: currentPage
      };
      if (search) params.search = search;
      if (filterBranch) params.branch = filterBranch;
      if (filterYear) params.year = filterYear;
      if (filterSection) params.section = filterSection;
      
      const response = await api.get('/students', { params });
      setStudents(response.data);
      const totalHeader = response.headers['x-total-count'];
      setTotalCount(parseInt(totalHeader || response.data.length, 10));
    } catch { toast.error('Failed to load students'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchMeta();
  }, []);

  useEffect(() => {
    fetchStudents();
    setSelectedIds(new Set());
  }, [currentPage, search, filterBranch, filterYear, filterSection]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterBranch, filterYear, filterSection]);

  const deleteStudent = async (id, name) => {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    try {
      await api.delete(`/students/${id}`);
      toast.success('Student deleted');
      fetchStudents();
      fetchMeta();
    } catch { toast.error('Delete failed'); }
  };

  const totalStudents = totalCount;
  const activeStudents = totalCount;
  const uniqueBranches = branches.length;

  // Pagination derived data
  const totalPages = Math.ceil(totalCount / itemsPerPage) || 1;
  const paginatedStudents = students;

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(new Set(paginatedStudents.map(s => s.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '24px 28px 40px' }}>
      {/* Top Section: Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            Student Registry
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Manage student enrollments, sections, and program details.</p>
        </div>
        {isCoord && (
          <div className="flex-row" style={{ gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => setModal('import')}>
              <Upload size={13} strokeWidth={1.5} /> Import CSV
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
        <SpotlightCard style={{ padding: 24, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Roster Size</span>
            <Users size={14} color="#a855f7" strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              <CountUp to={totalStudents} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Registered candidates</div>
          </div>
        </SpotlightCard>

        <SpotlightCard style={{ padding: 24, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Roster</span>
            <Users size={14} color="#10b981" strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#10b981', fontFamily: 'var(--font-mono)' }}>
              <CountUp to={activeStudents} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Active candidates in slots</div>
          </div>
        </SpotlightCard>

        <SpotlightCard style={{ padding: 24, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Academic Branches</span>
            <Users size={14} color="#3b82f6" strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#3b82f6', fontFamily: 'var(--font-mono)' }}>
              <CountUp to={uniqueBranches} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Distinct programs covered</div>
          </div>
        </SpotlightCard>
      </div>

      {/* Bottom Section: Primary Content Area (SaaS UI List Dashboard) */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* SaaS UI Header Bar */}
        <div className="saas-page-header-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Roster</span>
            
            {/* Year tabs */}
            <div className="saas-filter-tabs">
              <button className={`saas-filter-tab${filterYear === '' ? ' active' : ''}`} onClick={() => setFilterYear('')}>All</button>
              <button className={`saas-filter-tab${filterYear === 'FY' ? ' active' : ''}`} onClick={() => setFilterYear('FY')}>FY</button>
              <button className={`saas-filter-tab${filterYear === 'SY' ? ' active' : ''}`} onClick={() => setFilterYear('SY')}>SY</button>
              <button className={`saas-filter-tab${filterYear === 'TY' ? ' active' : ''}`} onClick={() => setFilterYear('TY')}>TY</button>
              <button className={`saas-filter-tab${filterYear === 'LY' ? ' active' : ''}`} onClick={() => setFilterYear('LY')}>LY</button>
            </div>

            {/* Filter button */}
            <button className={`btn btn-ghost btn-sm${showFiltersMenu ? ' active' : ''}`} onClick={() => setShowFiltersMenu(!showFiltersMenu)} style={{ borderRadius: 6, padding: '4px 10px' }}>
              <Users size={12} strokeWidth={1.5} style={{ marginRight: 4 }} /> Filter
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Search Input */}
            <div className="saas-search-input-wrapper" style={{ width: 220 }}>
              <Search size={12} color="var(--text-tertiary)" strokeWidth={1.5} />
              <input 
                placeholder="Search by name or email..." 
                className="saas-search-input" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && <X size={12} color="var(--text-tertiary)" style={{ cursor: 'pointer' }} onClick={() => setSearchQuery('')} />}
            </div>

            {/* Add student button */}
            {isCoord && (
              <button className="btn btn-primary" id="add-student-btn" onClick={() => { setEditing(null); setModal('add'); }} style={{ borderRadius: 6 }}>
                + Add student
              </button>
            )}
          </div>
        </div>

        {/* Filter Selection Panel (rendered if Filter button clicked) */}
        {showFiltersMenu && (
          <div style={{ padding: '12px 28px', background: 'var(--bg-base)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 16, alignItems: 'center' }}>
            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Branch:</span>
              <select className="select" style={{ fontSize: 12, minHeight: 28, height: 28, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-input)' }} value={filterBranch} onChange={e => setFilterBranch(e.target.value)}>
                <option value="">All Branches</option>
                {branches.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Section:</span>
              <select className="select" style={{ fontSize: 12, minHeight: 28, height: 28, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-input)' }} value={filterSection} onChange={e => setFilterSection(e.target.value)}>
                <option value="">All Sections</option>
                {sections.map(s => <option key={s} value={s}>Section {s}</option>)}
              </select>
            </div>

            {(filterBranch || filterSection) && (
              <button className="btn btn-ghost btn-sm" style={{ height: 28, minHeight: 28, borderRadius: 4, fontSize: 11, padding: '0 8px' }} onClick={() => { setFilterBranch(''); setFilterSection(''); }}>
                Clear Program Filters
              </button>
            )}
          </div>
        )}

        {/* Active Filter Chips */}
        {(filterBranch || filterSection) && (
          <div style={{ padding: '8px 28px', display: 'flex', gap: 8, flexWrap: 'wrap', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
            {filterBranch && (
              <div className="saas-filter-chip">
                <span>Branch is {filterBranch}</span>
                <button className="saas-filter-chip-close" onClick={() => setFilterBranch('')}>×</button>
              </div>
            )}
            {filterSection && (
              <div className="saas-filter-chip">
                <span>Section is {filterSection}</span>
                <button className="saas-filter-chip-close" onClick={() => setFilterSection('')}>×</button>
              </div>
            )}
          </div>
        )}

        {/* The List/Table */}
        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
          ) : paginatedStudents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: 13 }}>
              No student records match the search parameters.
            </div>
          ) : (
            <table style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: 40, paddingLeft: 28 }}>
                    <input 
                      type="checkbox" 
                      onChange={handleSelectAll} 
                      checked={paginatedStudents.length > 0 && paginatedStudents.every(s => selectedIds.has(s.id))}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th>Name</th>
                  <th>PRN</th>
                  <th>Roll No</th>
                  <th>Branch</th>
                  <th>Sec</th>
                  <th>Year</th>
                  <th>Sem</th>
                  <th>Status</th>
                  {isCoord && <th style={{ width: 60, paddingRight: 28, textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {paginatedStudents.map((s) => (
                  <tr key={s.id}>
                    <td style={{ paddingLeft: 28 }}>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.has(s.id)} 
                        onChange={() => handleSelectOne(s.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 10, color: 'var(--text-primary)' }}>
                          {s.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{s.prn}@mitwpu.edu.in</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>{s.prn}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>{s.roll_no}</td>
                    <td>{s.branch}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>{s.section || '—'}</td>
                    <td><span className={`badge badge-${s.year.toLowerCase()}`}>{s.year}</span></td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>Sem {s.semester}</td>
                    <td><span className="badge badge-success">Active</span></td>
                    {isCoord && (
                      <td style={{ paddingRight: 28, textAlign: 'right', position: 'relative' }}>
                        <button className="btn btn-ghost btn-icon btn-sm" style={{ border: 'none', background: 'transparent' }} onClick={() => setActiveMenuId(activeMenuId === s.id ? null : s.id)}>
                          <span style={{ fontSize: 16, fontWeight: 'bold' }}>···</span>
                        </button>
                        {activeMenuId === s.id && (
                          <>
                            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }} onClick={() => setActiveMenuId(null)} />
                            <div style={{
                              position: 'absolute', right: 28, top: 32, zIndex: 999,
                              background: 'var(--bg-surface)', border: '1px solid var(--border)',
                              borderRadius: 6, padding: '4px 0', minWidth: 110,
                              boxShadow: '0 4px 12px rgba(0,0,0,0.5)', textAlign: 'left'
                            }}>
                              <button onClick={() => { setEditing(s); setModal('edit'); setActiveMenuId(null); }} style={{ display: 'block', width: '100%', padding: '6px 12px', background: 'none', border: 'none', textAlign: 'left', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 12 }}>Edit Student</button>
                              <button onClick={() => { deleteStudent(s.id, s.name); setActiveMenuId(null); }} style={{ display: 'block', width: '100%', padding: '6px 12px', background: 'none', border: 'none', textAlign: 'left', color: 'var(--accent-red)', cursor: 'pointer', fontSize: 12 }}>Delete</button>
                            </div>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Footer */}
        <div className="saas-pagination-footer">
          <div>
            Page <input 
              type="text" 
              value={currentPage} 
              onChange={e => {
                const val = parseInt(e.target.value);
                if (!isNaN(val) && val >= 1 && val <= totalPages) setCurrentPage(val);
              }}
              style={{ width: 32, height: 22, textAlign: 'center', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 11, margin: '0 4px' }}
            /> of {totalPages}
          </div>
          
          <div style={{ display: 'flex', gap: 4 }}>
            <button 
              className="btn btn-ghost btn-sm" 
              style={{ padding: '0 8px', height: 24, minHeight: 24, borderRadius: 4 }} 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            >
              &lt;
            </button>
            <button 
              className="btn btn-ghost btn-sm" 
              style={{ padding: '0 8px', height: 24, minHeight: 24, borderRadius: 4 }} 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            >
              &gt;
            </button>
          </div>
        </div>
      </div>

      {isCoord && (modal === 'add' || modal === 'edit') && (
        <StudentModal student={modal === 'edit' ? editing : null} onClose={() => setModal(null)} onSave={fetchStudents} />
      )}
      {isCoord && modal === 'import' && <CSVImportModal onClose={() => setModal(null)} onDone={fetchStudents} />}
    </div>
  );
}
