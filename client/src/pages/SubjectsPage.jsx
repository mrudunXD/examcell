import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Lock, BookOpen, Layers, Award, ShieldAlert, Activity, Search, X } from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/index.js';
import CountUp from '../components/ReactBits/CountUp.jsx';
import SpotlightCard from '../components/ReactBits/SpotlightCard.jsx';
import DecryptedText from '../components/ReactBits/DecryptedText.jsx';

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
          <div className="flex-row" style={{ justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
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
      <div className="modal modal-lg" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20, maxWidth: '800px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', borderRadius: 16 }}>
        
        {/* Left Panel: Active Constraints List */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: '#FF453A', textTransform: 'uppercase' }}>
            {subject.code}
          </span>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '4px 0 12px 0', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
            Constraints: {subject.name}
          </h3>

          <div style={{ flex: 1, maxHeight: '340px', overflowY: 'auto' }} className="custom-scrollbar">
            {loading ? (
              <div style={{ textAlign: 'center', padding: 20 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
            ) : constraints.length === 0 ? (
              <div style={{ fontStyle: 'italic', color: 'var(--text-secondary)', fontSize: 12, padding: 12 }}>
                No scheduling locks or lockout dates registered.
              </div>
            ) : (
              <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: 6 }}>Type</th>
                    <th style={{ padding: 6 }}>Date</th>
                    <th style={{ padding: 6 }}>Shift</th>
                    <th style={{ padding: 6 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {constraints.map((c) => (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '6px' }}>
                        <span style={{ 
                          fontSize: 9, 
                          background: c.type === 'fixed_slot' ? 'rgba(48,209,88,0.15)' : 'rgba(255,69,58,0.15)', 
                          color: c.type === 'fixed_slot' ? '#30D158' : '#FF453A', 
                          border: `1px solid ${c.type === 'fixed_slot' ? '#30D158' : '#FF453A'}`, 
                          padding: '2px 6px', 
                          borderRadius: 4,
                          fontWeight: 'bold',
                          textTransform: 'uppercase'
                        }}>
                          {c.type === 'fixed_slot' ? 'Lock Date' : 'Lockout'}
                        </span>
                      </td>
                      <td style={{ padding: '6px', fontFamily: 'var(--font-mono)' }}>{c.date}</td>
                      <td style={{ padding: '6px', color: 'var(--text-secondary)' }}>
                        {c.shift_id ? `Shift ${c.shift_id}` : 'Full Day'}
                      </td>
                      <td style={{ padding: '6px' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(c.id)} style={{ color: '#FF453A', padding: '2px 4px' }}>
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
        <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Register Schedule Rule</h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Rule Mode</label>
              <select className="select" value={type} onChange={e => setType(e.target.value)}>
                <option value="excluded_date">Excluded Date (Lockout)</option>
                <option value="fixed_slot">Fixed Target Slot (Strict Pin)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Target Date</label>
              <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} required />
            </div>

            <div className="form-group">
              <label className="form-label">Target Shift (Optional)</label>
              <select className="select" value={shiftId} onChange={e => setShiftId(e.target.value)}>
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

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => setSearch(searchQuery), 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);
  const [filterYear, setFilterYear] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterCourseType, setFilterCourseType] = useState('');
  const [modal, setModal] = useState(null);
  const [editing, setEditing] = useState(null);
  const [showFiltersMenu, setShowFiltersMenu] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  
  const [branches, setBranches] = useState([]);
  const [courseTypes, setCourseTypes] = useState([]);
  const [totalCount, setTotalCount] = useState(0);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const user = useAuthStore(state => state.user);
  const isCoord = user?.role === 'coordinator';

  const fetchMeta = async () => {
    try {
      const { data } = await api.get('/subjects/meta');
      setBranches(data.branches || []);
      setCourseTypes(data.courseTypes || []);
    } catch (e) {
      console.error('Failed to load subjects meta', e);
    }
  };

  const loadSubjects = async () => {
    setLoading(true);
    try {
      const params = {
        limit: itemsPerPage,
        page: currentPage
      };
      if (search) params.search = search;
      if (filterYear) params.year = filterYear;
      if (filterBranch) params.branch = filterBranch;
      if (filterCourseType) params.course_type = filterCourseType;

      const response = await api.get('/subjects', { params });
      setSubjects(response.data);
      const totalHeader = response.headers['x-total-count'];
      setTotalCount(parseInt(totalHeader || response.data.length, 10));
    } catch {
      toast.error('Failed to load subjects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeta();
  }, []);

  useEffect(() => {
    loadSubjects();
    setSelectedIds(new Set());
  }, [currentPage, search, filterYear, filterBranch, filterCourseType]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterYear, filterBranch, filterCourseType]);

  const del = async (id) => {
    if (!confirm('Delete this subject?')) return;
    try {
      await api.delete(`/subjects/${id}`);
      toast.success('Deleted');
      loadSubjects();
      fetchMeta();
    } catch {
      toast.error('Delete failed');
    }
  };

  // Statistics
  const totalSubjects = totalCount;
  const uniqueBranches = branches.length;
  const dscCount = subjects.filter(s => s.course_type === 'DSC').length;
  const electiveCount = subjects.filter(s => s.course_type === 'DSE' || s.course_type === 'GE').length;

  // Pagination derived data
  const totalPages = Math.ceil(totalCount / itemsPerPage) || 1;
  const paginatedSubjects = subjects;

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(new Set(paginatedSubjects.map(s => s.id)));
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
            <DecryptedText text="Curriculum Registry" />
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Academic program courses, credit counts, and schedule blackouts.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
        <SpotlightCard style={{ padding: 24, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Subjects</span>
            <BookOpen size={14} color="#3b82f6" strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              <CountUp to={totalSubjects} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Registered courses</div>
          </div>
        </SpotlightCard>

        <SpotlightCard style={{ padding: 24, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Covered Branches</span>
            <Layers size={14} color="#10b981" strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#10b981', fontFamily: 'var(--font-mono)' }}>
              <CountUp to={uniqueBranches} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Different academic branches</div>
          </div>
        </SpotlightCard>

        <SpotlightCard style={{ padding: 24, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Core vs Elective</span>
            <Award size={14} color="#f59e0b" strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b', fontFamily: 'var(--font-mono)' }}>
              <CountUp to={dscCount} /> / <CountUp to={electiveCount} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Discipline Core vs Elective courses</div>
          </div>
        </SpotlightCard>
      </div>

      {/* Bottom Section: Primary Content Area */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* SaaS UI Header Bar */}
        <div className="saas-page-header-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Subjects</span>
            
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
              <Layers size={12} strokeWidth={1.5} style={{ marginRight: 4 }} /> Filter
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Search Input */}
            <div className="saas-search-input-wrapper" style={{ width: 240 }}>
              <Search size={12} color="var(--text-tertiary)" strokeWidth={1.5} />
              <input 
                placeholder="Search code, title..." 
                className="saas-search-input" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && <X size={12} color="var(--text-tertiary)" style={{ cursor: 'pointer' }} onClick={() => setSearchQuery('')} />}
            </div>

            {/* Add Subject button */}
            {isCoord && (
              <button className="btn btn-primary" onClick={() => { setEditing(null); setModal('form'); }} style={{ borderRadius: 6 }}>
                + Add Subject
              </button>
            )}
          </div>
        </div>

        {/* Filter Selection Panel */}
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
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Course Type:</span>
              <select className="select" style={{ fontSize: 12, minHeight: 28, height: 28, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-input)' }} value={filterCourseType} onChange={e => setFilterCourseType(e.target.value)}>
                <option value="">All Types</option>
                {courseTypes.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {(filterBranch || filterCourseType) && (
              <button className="btn btn-ghost btn-sm" style={{ height: 28, minHeight: 28, borderRadius: 4, fontSize: 11, padding: '0 8px' }} onClick={() => { setFilterBranch(''); setFilterCourseType(''); }}>
                Clear Program Filters
              </button>
            )}
          </div>
        )}

        {/* Active Filter Chips */}
        {(filterBranch || filterCourseType) && (
          <div style={{ padding: '8px 28px', display: 'flex', gap: 8, flexWrap: 'wrap', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
            {filterBranch && (
              <div className="saas-filter-chip">
                <span>Branch is {filterBranch}</span>
                <button className="saas-filter-chip-close" onClick={() => setFilterBranch('')}>×</button>
              </div>
            )}
            {filterCourseType && (
              <div className="saas-filter-chip">
                <span>Type is {filterCourseType}</span>
                <button className="saas-filter-chip-close" onClick={() => setFilterCourseType('')}>×</button>
              </div>
            )}
          </div>
        )}

        {/* Subjects Table */}
        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
          ) : paginatedSubjects.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: 13 }}>
              No subjects matched the filters.
            </div>
          ) : (
            <table style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: 40, paddingLeft: 28 }}>
                    <input 
                      type="checkbox" 
                      onChange={handleSelectAll} 
                      checked={paginatedSubjects.length > 0 && paginatedSubjects.every(s => selectedIds.has(s.id))}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th>Code</th>
                  <th>Abbreviation</th>
                  <th>Subject Title</th>
                  <th>Branch</th>
                  <th>Year</th>
                  <th>Sem</th>
                  <th>Type</th>
                  <th>Status</th>
                  {isCoord && <th style={{ width: 60, paddingRight: 28, textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {paginatedSubjects.map((s) => (
                  <tr key={s.id}>
                    <td style={{ paddingLeft: 28 }}>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.has(s.id)} 
                        onChange={() => handleSelectOne(s.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-purple)' }}>{s.code}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>{s.abbreviation || '—'}</td>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td>{s.branch}</td>
                    <td><span className={`badge badge-${s.year.toLowerCase()}`}>{s.year}</span></td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>Sem {s.semester}</td>
                    <td>
                      {s.course_type ? (
                        <span className="badge badge-neutral" style={{ fontSize: 10 }}>{s.course_type}</span>
                      ) : (
                        <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                      )}
                    </td>
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
                              borderRadius: 6, padding: '4px 0', minWidth: 120,
                              boxShadow: '0 4px 12px rgba(0,0,0,0.5)', textAlign: 'left'
                            }}>
                              <button onClick={() => { setEditing(s); setModal('constraints'); setActiveMenuId(null); }} style={{ display: 'block', width: '100%', padding: '6px 12px', background: 'none', border: 'none', textAlign: 'left', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 12 }}>Constraints</button>
                              <button onClick={() => { setEditing(s); setModal('form'); setActiveMenuId(null); }} style={{ display: 'block', width: '100%', padding: '6px 12px', background: 'none', border: 'none', textAlign: 'left', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 12 }}>Edit Subject</button>
                              <button onClick={() => { del(s.id); setActiveMenuId(null); }} style={{ display: 'block', width: '100%', padding: '6px 12px', background: 'none', border: 'none', textAlign: 'left', color: 'var(--accent-red)', cursor: 'pointer', fontSize: 12 }}>Delete</button>
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

      {isCoord && modal === 'form' && <SubjectModal subject={editing} onClose={() => setModal(null)} onSave={loadSubjects} />}
      {isCoord && modal === 'constraints' && editing && (
        <SubjectConstraintsModal subject={editing} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
