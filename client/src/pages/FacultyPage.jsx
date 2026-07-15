import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, BookOpen, Check, CalendarDays, Users, UserCheck, Activity, GraduationCap, Search, X } from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/index.js';
import CountUp from '../components/ReactBits/CountUp.jsx';
import SpotlightCard from '../components/ReactBits/SpotlightCard.jsx';

const EMPTY = { 
  name: '', 
  email: '', 
  department: '', 
  password: '', 
  min_duties: '', 
  max_duties: '', 
  max_consecutive: 2, 
  exempted: false, 
  priority: 'normal' 
};

function FacultyModal({ faculty, onClose, onSave }) {
  const [form, setForm] = useState(faculty
    ? { 
        name: faculty.name, 
        email: faculty.email, 
        department: faculty.department || '', 
        password: '',
        min_duties: faculty.min_duties !== null && faculty.min_duties !== undefined ? faculty.min_duties : '',
        max_duties: faculty.max_duties !== null && faculty.max_duties !== undefined ? faculty.max_duties : '',
        max_consecutive: faculty.max_consecutive !== undefined && faculty.max_consecutive !== null ? faculty.max_consecutive : 2,
        exempted: faculty.exempted === 1 || faculty.exempted === true,
        priority: faculty.priority || 'normal'
      }
    : EMPTY
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    const payload = {
      ...form,
      min_duties: form.min_duties === '' ? null : parseInt(form.min_duties, 10),
      max_duties: form.max_duties === '' ? null : parseInt(form.max_duties, 10),
      max_consecutive: parseInt(form.max_consecutive, 10),
      exempted: form.exempted ? 1 : 0
    };
    try {
      faculty?.id ? await api.put(`/faculty/${faculty.id}`, payload) : await api.post('/faculty', payload);
      toast.success(faculty?.id ? 'Faculty updated' : 'Faculty account created');
      onSave(); onClose();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 540 }}>
        <h2 className="modal-title">{faculty?.id ? 'Edit Faculty Settings' : 'Add Faculty Account'}</h2>
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

          <div style={{ padding: '12px 0', borderTop: '1px solid var(--border-faint)', marginTop: 8 }}>
            <h4 style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginBottom: 12 }}>Custom Supervision Assignment Rules</h4>
            
            <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 11 }}>Min Duties (Bounds)</label>
                <input className="input" type="number" min="0" value={form.min_duties} onChange={e => setForm({ ...form, min_duties: e.target.value })} placeholder="Default (2)" />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 11 }}>Max Duties (Bounds)</label>
                <input className="input" type="number" min="0" value={form.max_duties} onChange={e => setForm({ ...form, max_duties: e.target.value })} placeholder="Default (6)" />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 11 }}>Max Consecutive</label>
                <select className="select" value={form.max_consecutive} onChange={e => setForm({ ...form, max_consecutive: e.target.value })}>
                  <option value={1}>1 Duty</option>
                  <option value={2}>2 Duties</option>
                  <option value={3}>3 Duties</option>
                  <option value={4}>4 Duties</option>
                </select>
              </div>
            </div>

            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'center' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 11 }}>Assignment Priority</label>
                <select className="select" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                  <option value="low">Low Priority</option>
                  <option value="normal">Normal Priority</option>
                  <option value="high">High Priority</option>
                </select>
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
                <input type="checkbox" id="exempted" checked={form.exempted} onChange={e => setForm({ ...form, exempted: e.target.checked })} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                <label htmlFor="exempted" className="form-label" style={{ margin: 0, cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>Exempt from Duties</label>
              </div>
            </div>
          </div>

          <div className="flex-row" style={{ justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <div className="spinner spinner-invert" style={{ width: 14, height: 14 }} /> : (faculty?.id ? 'Update Settings' : 'Create Account')}
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
      <div className="modal modal-lg" style={{ borderRadius: 16 }}>
        <h2 className="modal-title">Conflict Subjects — {faculty.name}</h2>
        <div className="alert alert-info" style={{ marginBottom: 16 }}>
          <BookOpen size={13} strokeWidth={1.5} />
          Faculty will NOT be assigned to supervise subjects checked here (conflict of interest rule).
        </div>
        <div style={{ maxHeight: 360, overflowY: 'auto', marginBottom: 16 }} className="custom-scrollbar">
          {Object.entries(grouped).map(([group, subs]) => (
            <div key={group} style={{ marginBottom: 16 }}>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--text-secondary)',
                paddingBottom: 6,
                borderBottom: '1px solid var(--border)',
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
                      background: selected.includes(s.id) ? 'var(--text-primary)' : 'transparent',
                      color: selected.includes(s.id) ? 'var(--bg-base)' : 'var(--text-secondary)',
                      borderColor: selected.includes(s.id) ? 'var(--text-primary)' : 'var(--border)',
                      borderRadius: 8
                    }}
                  >
                    {selected.includes(s.id) && <Check size={10} strokeWidth={2} style={{ marginRight: 4 }} />}
                    {s.code} — {s.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {Object.keys(grouped).length === 0 && (
            <p style={{ fontStyle: 'italic', color: 'var(--text-secondary)', fontSize: 13 }}>
              No subjects configured yet. Add subjects first.
            </p>
          )}
        </div>
        <div className="flex-row" style={{ justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <div className="spinner spinner-invert" style={{ width: 14, height: 14 }} /> : 'Save Assignments'}
          </button>
        </div>
      </div>
    </div>
  );
}

function LeavesModal({ facultyList, onClose }) {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ faculty_id: '', date: '', shift_id: '', reason: '' });
  const [saving, setSaving] = useState(false);

  const fetchLeaves = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/faculty-leaves');
      setLeaves(data);
    } catch { toast.error('Failed to load leaves'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchLeaves(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.faculty_id || !form.date) return;
    setSaving(true);
    try {
      const payload = {
        faculty_id: form.faculty_id,
        date: form.date,
        shift_id: form.shift_id || null,
        reason: form.reason || null
      };
      await api.post('/faculty-leaves', payload);
      toast.success('Faculty leave added successfully');
      setForm({ faculty_id: '', date: '', shift_id: '', reason: '' });
      fetchLeaves();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add leave');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this leave record?')) return;
    try {
      await api.delete(`/faculty-leaves/${id}`);
      toast.success('Leave record removed');
      fetchLeaves();
    } catch {
      toast.error('Failed to delete leave record');
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: '800px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', borderRadius: 16 }}>
        
        {/* Left Side: View Leaves List */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 12px 0', borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
            Active Leaves & Absences
          </h3>

          <div style={{ flex: 1, maxHeight: '340px', overflowY: 'auto' }} className="custom-scrollbar">
            {loading ? (
              <div style={{ textAlign: 'center', padding: 20 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
            ) : leaves.length === 0 ? (
              <div style={{ fontStyle: 'italic', color: 'var(--text-secondary)', fontSize: 12, padding: 12 }}>
                No active leaves registered for this cycle.
              </div>
            ) : (
              <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: 6 }}>Faculty</th>
                    <th style={{ padding: 6 }}>Date</th>
                    <th style={{ padding: 6 }}>Shift</th>
                    <th style={{ padding: 6 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {leaves.map((l) => (
                    <tr key={l.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '6px', fontWeight: 600 }}>{l.faculty_name}</td>
                      <td style={{ padding: '6px', fontFamily: 'var(--font-mono)' }}>{l.date}</td>
                      <td style={{ padding: '6px' }}>
                        {l.shift_id ? `Shift ${l.shift_id}` : 'Full Day'}
                      </td>
                      <td style={{ padding: '6px' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(l.id)} style={{ color: '#FF453A', padding: '2px 4px' }}>
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

        {/* Right Side: Add Leave Form */}
        <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Register Faculty Absence</h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            
            <div className="form-group">
              <label className="form-label">Faculty Member *</label>
              <select 
                className="select" 
                value={form.faculty_id} 
                onChange={e => setForm({ ...form, faculty_id: e.target.value })}
                required
                style={{ fontSize: 12 }}
              >
                <option value="">-- Choose Faculty --</option>
                {facultyList.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            
            <div className="form-group">
              <label className="form-label">Leave Date *</label>
              <input 
                type="date" 
                className="input" 
                value={form.date} 
                onChange={e => setForm({ ...form, date: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Shift Duration</label>
              <select 
                className="select" 
                value={form.shift_id} 
                onChange={e => setForm({ ...form, shift_id: e.target.value })}
                style={{ fontSize: 12 }}
              >
                <option value="">Full Day (Unavailable completely)</option>
                <option value="1">Shift 1 Only (Morning)</option>
                <option value="2">Shift 2 Only (Afternoon)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Reason / Notes</label>
              <input 
                type="text" 
                className="input" 
                placeholder="e.g. Medical leave, seminar..." 
                value={form.reason} 
                onChange={e => setForm({ ...form, reason: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                {saving ? 'Saving...' : 'Add Leave'}
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}

export default function FacultyPage() {
  const [faculty, setFaculty] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterExclusions, setFilterExclusions] = useState('');
  const [modal, setModal] = useState(null);
  const [editing, setEditing] = useState(null);
  const [showFiltersMenu, setShowFiltersMenu] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const user = useAuthStore(state => state.user);
  const isCoord = user?.role === 'coordinator';

  const fetchFaculty = async () => {
    setLoading(true);
    try {
      const [fr, sr] = await Promise.all([api.get('/faculty'), api.get('/subjects')]);
      setFaculty(fr.data); 
      setSubjects(sr.data);
    } catch {
      toast.error('Failed to load faculty');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFaculty();
  }, []);

  const del = async (id) => {
    if (!confirm('Deactivate this faculty account?')) return;
    try {
      await api.delete(`/faculty/${id}`);
      toast.success('Deactivated');
      fetchFaculty();
    } catch {
      toast.error('Failed to deactivate');
    }
  };

  const departments = [...new Set(faculty.map(f => f.department).filter(Boolean))].sort();
  const totalFaculty = faculty.length;
  const activeFacultyCount = faculty.filter(f => f.is_active !== 0).length;
  const conflictMappedCount = faculty.filter(f => f.subjects?.length > 0).length;

  // Local filtering
  const filteredFaculty = faculty.filter(f => {
    const matchesSearch = !search || 
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.email.toLowerCase().includes(search.toLowerCase());
    
    const matchesDept = !filterDept || f.department === filterDept;

    const matchesExclusions = !filterExclusions || 
      (filterExclusions === 'mapped' && f.subjects?.length > 0) || 
      (filterExclusions === 'none' && (!f.subjects || f.subjects.length === 0));

    return matchesSearch && matchesDept && matchesExclusions;
  });

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [search, filterDept, filterExclusions]);

  // Pagination derived data
  const totalPages = Math.ceil(filteredFaculty.length / itemsPerPage) || 1;
  const paginatedFaculty = filteredFaculty.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(new Set(paginatedFaculty.map(f => f.id)));
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
            Faculty Roster
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Configure invigilator accounts, leaves, and subject conflict maps.</p>
        </div>
        {isCoord && (
          <div className="flex-row" style={{ gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => setModal('leaves')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CalendarDays size={13} strokeWidth={1.5} /> Leaves & Availability
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
        <SpotlightCard style={{ padding: 24, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Invigilators</span>
            <Users size={14} color="#3b82f6" strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              <CountUp to={totalFaculty} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Registered staff</div>
          </div>
        </SpotlightCard>

        <SpotlightCard style={{ padding: 24, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Invigilators</span>
            <UserCheck size={14} color="#10b981" strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#10b981', fontFamily: 'var(--font-mono)' }}>
              <CountUp to={activeFacultyCount} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Staff available for scheduling</div>
          </div>
        </SpotlightCard>

        <SpotlightCard style={{ padding: 24, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Exclusion Maps</span>
            <BookOpen size={14} color="#f59e0b" strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b', fontFamily: 'var(--font-mono)' }}>
              <CountUp to={conflictMappedCount} /> / <CountUp to={totalFaculty} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Staff with conflict exclusions</div>
          </div>
        </SpotlightCard>
      </div>

      {/* Bottom Section: Primary Content Area */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* SaaS UI Header Bar */}
        <div className="saas-page-header-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Invigilators</span>
            
            {/* Department tabs */}
            <div className="saas-filter-tabs">
              <button className={`saas-filter-tab${filterDept === '' ? ' active' : ''}`} onClick={() => setFilterDept('')}>All</button>
              {departments.slice(0, 4).map(d => (
                <button 
                  key={d} 
                  className={`saas-filter-tab${filterDept === d ? ' active' : ''}`} 
                  onClick={() => setFilterDept(d)}
                >
                  {d}
                </button>
              ))}
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
                placeholder="Search name, email..." 
                className="saas-search-input" 
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && <X size={12} color="var(--text-tertiary)" style={{ cursor: 'pointer' }} onClick={() => setSearch('')} />}
            </div>

            {/* Add Faculty button */}
            {isCoord && (
              <button className="btn btn-primary" onClick={() => { setEditing(null); setModal('form'); }} style={{ borderRadius: 6 }}>
                + Add Faculty
              </button>
            )}
          </div>
        </div>

        {/* Filter Selection Panel */}
        {showFiltersMenu && (
          <div style={{ padding: '12px 28px', background: 'var(--bg-base)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 16, alignItems: 'center' }}>
            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Department:</span>
              <select className="select" style={{ fontSize: 12, minHeight: 28, height: 28, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-input)' }} value={filterDept} onChange={e => setFilterDept(e.target.value)}>
                <option value="">All Departments</option>
                {departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Conflict Exclusion Map:</span>
              <select className="select" style={{ fontSize: 12, minHeight: 28, height: 28, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-input)' }} value={filterExclusions} onChange={e => setFilterExclusions(e.target.value)}>
                <option value="">All Staff</option>
                <option value="mapped">Mapped Exclusions</option>
                <option value="none">No Restrictions</option>
              </select>
            </div>

            {(filterDept || filterExclusions) && (
              <button className="btn btn-ghost btn-sm" style={{ height: 28, minHeight: 28, borderRadius: 4, fontSize: 11, padding: '0 8px' }} onClick={() => { setFilterDept(''); setFilterExclusions(''); }}>
                Clear Filters
              </button>
            )}
          </div>
        )}

        {/* Active Filter Chips */}
        {(filterDept || filterExclusions) && (
          <div style={{ padding: '8px 28px', display: 'flex', gap: 8, flexWrap: 'wrap', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
            {filterDept && (
              <div className="saas-filter-chip">
                <span>Dept is {filterDept}</span>
                <button className="saas-filter-chip-close" onClick={() => setFilterDept('')}>×</button>
              </div>
            )}
            {filterExclusions && (
              <div className="saas-filter-chip">
                <span>Exclusions is {filterExclusions === 'mapped' ? 'Mapped' : 'None'}</span>
                <button className="saas-filter-chip-close" onClick={() => setFilterExclusions('')}>×</button>
              </div>
            )}
          </div>
        )}

        {/* Invigilators Table */}
        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
          ) : paginatedFaculty.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: 13 }}>
              No faculty records matched the filters.
            </div>
          ) : (
            <table style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: 40, paddingLeft: 28 }}>
                    <input 
                      type="checkbox" 
                      onChange={handleSelectAll} 
                      checked={paginatedFaculty.length > 0 && paginatedFaculty.every(f => selectedIds.has(f.id))}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Department</th>
                  <th>Conflict Restrictions</th>
                  <th>Custom Rules</th>
                  <th>Status</th>
                  {isCoord && <th style={{ width: 60, paddingRight: 28, textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {paginatedFaculty.map((f) => (
                  <tr key={f.id}>
                    <td style={{ paddingLeft: 28 }}>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.has(f.id)} 
                        onChange={() => handleSelectOne(f.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 10, color: 'var(--text-primary)' }}>
                          {f.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{f.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{f.department || 'Invigilator'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>{f.email}</td>
                    <td style={{ fontSize: 12, fontWeight: 500 }}>{f.department || '—'}</td>
                    <td>
                      <div className="flex-row" style={{ flexWrap: 'wrap', gap: 4 }}>
                        {!f.subjects?.length ? (
                          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>No exclusions mapped</span>
                        ) : (
                          <>
                            {f.subjects.slice(0, 3).map(s => (
                              <span key={s.id} className="badge badge-neutral" style={{ fontSize: 9 }}>{s.code}</span>
                            ))}
                            {f.subjects.length > 3 && (
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-secondary)' }}>+{f.subjects.length - 3}</span>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="flex-row" style={{ flexWrap: 'wrap', gap: 4 }}>
                        {f.exempted === 1 && <span className="badge badge-danger" style={{ fontSize: 9 }}>Exempted</span>}
                        {f.exempted !== 1 && (
                          <>
                            {(f.min_duties !== null || f.max_duties !== null) && (
                              <span className="badge badge-neutral" style={{ fontSize: 9, fontFamily: 'var(--font-mono)' }}>
                                Load: {f.min_duties !== null ? f.min_duties : '0'}-{f.max_duties !== null ? f.max_duties : '∞'}
                              </span>
                            )}
                            {f.max_consecutive !== undefined && f.max_consecutive !== null && (
                              <span className="badge badge-neutral" style={{ fontSize: 9 }}>
                                Max Consec: {f.max_consecutive}
                              </span>
                            )}
                            {f.priority !== 'normal' && f.priority !== undefined && (
                              <span className={`badge ${f.priority === 'high' ? 'badge-primary' : 'badge-amber'}`} style={{ fontSize: 9 }}>
                                {f.priority === 'high' ? 'High' : 'Low'}
                              </span>
                            )}
                            {f.min_duties === null && f.max_duties === null && (f.priority === 'normal' || !f.priority) && (
                              <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Default limits</span>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                    <td>
                      {f.is_active !== 0 ? (
                        <span className="badge badge-success">Active</span>
                      ) : (
                        <span className="badge badge-danger">Inactive</span>
                      )}
                    </td>
                    {isCoord && (
                      <td style={{ paddingRight: 28, textAlign: 'right', position: 'relative' }}>
                        <button className="btn btn-ghost btn-icon btn-sm" style={{ border: 'none', background: 'transparent' }} onClick={() => setActiveMenuId(activeMenuId === f.id ? null : f.id)}>
                          <span style={{ fontSize: 16, fontWeight: 'bold' }}>···</span>
                        </button>
                        {activeMenuId === f.id && (
                          <>
                            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }} onClick={() => setActiveMenuId(null)} />
                            <div style={{
                              position: 'absolute', right: 28, top: 32, zIndex: 999,
                              background: 'var(--bg-surface)', border: '1px solid var(--border)',
                              borderRadius: 6, padding: '4px 0', minWidth: 120,
                              boxShadow: '0 4px 12px rgba(0,0,0,0.5)', textAlign: 'left'
                            }}>
                              <button onClick={() => { setEditing(f); setModal('subjects'); setActiveMenuId(null); }} style={{ display: 'block', width: '100%', padding: '6px 12px', background: 'none', border: 'none', textAlign: 'left', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 12 }}>Exclusions</button>
                              <button onClick={() => { setEditing(f); setModal('form'); setActiveMenuId(null); }} style={{ display: 'block', width: '100%', padding: '6px 12px', background: 'none', border: 'none', textAlign: 'left', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 12 }}>Edit Faculty</button>
                              <button onClick={() => { del(f.id); setActiveMenuId(null); }} style={{ display: 'block', width: '100%', padding: '6px 12px', background: 'none', border: 'none', textAlign: 'left', color: 'var(--accent-red)', cursor: 'pointer', fontSize: 12 }}>Deactivate</button>
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

      {isCoord && modal === 'form' && <FacultyModal faculty={editing} onClose={() => setModal(null)} onSave={fetchFaculty} />}
      {isCoord && modal === 'subjects' && editing && (
        <SubjectAssignModal faculty={editing} allSubjects={subjects} onClose={() => setModal(null)} onSave={fetchFaculty} />
      )}
      {isCoord && modal === 'leaves' && (
        <LeavesModal facultyList={faculty} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
