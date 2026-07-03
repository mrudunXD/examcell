import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Building2, Layers, ShieldAlert, Cpu, Monitor, Search, X } from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/index.js';
import CountUp from '../components/ReactBits/CountUp.jsx';
import SpotlightCard from '../components/ReactBits/SpotlightCard.jsx';
import DecryptedText from '../components/ReactBits/DecryptedText.jsx';

const EMPTY = { room_no: '', block: '', capacity: '', bench_rows: '', bench_cols: '', is_online: 0 };

function RoomModal({ room, onClose, onSave }) {
  const [form, setForm] = useState(room
    ? { room_no: room.room_no, block: room.block, capacity: room.capacity, bench_rows: room.bench_rows, bench_cols: room.bench_cols, is_online: room.is_online || 0 }
    : EMPTY
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      room?.id ? await api.put(`/classrooms/${room.id}`, form) : await api.post('/classrooms', form);
      toast.success(room?.id ? 'Room updated' : 'Room added'); onSave(); onClose();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  };

  const totalSeats = parseInt(form.bench_rows || 0) * parseInt(form.bench_cols || 0);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2 className="modal-title">{room?.id ? 'Edit Classroom' : 'Add Classroom'}</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Room Number *</label>
              <input className="input" value={form.room_no} onChange={e => setForm({ ...form, room_no: e.target.value })} required placeholder="A-101" />
            </div>
            <div className="form-group">
              <label className="form-label">Block / Building *</label>
              <input className="input" value={form.block} onChange={e => setForm({ ...form, block: e.target.value })} required placeholder="Block A" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Total Bench Capacity *</label>
            <input className="input" type="number" min={1} value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} required placeholder="60" />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Bench Rows *</label>
              <input className="input" type="number" min={1} value={form.bench_rows} onChange={e => setForm({ ...form, bench_rows: e.target.value })} required placeholder="10" />
            </div>
            <div className="form-group">
              <label className="form-label">Positions Per Row *</label>
              <input className="input" type="number" min={1} value={form.bench_cols} onChange={e => setForm({ ...form, bench_cols: e.target.value })} required placeholder="6" />
            </div>
          </div>
          <div className="form-group flex-row" style={{ alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              id="is_online"
              checked={!!form.is_online} 
              onChange={e => setForm({ ...form, is_online: e.target.checked ? 1 : 0 })}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
            />
            <label htmlFor="is_online" className="form-label" style={{ margin: 0, cursor: 'pointer', userSelect: 'none' }}>
              Online Compatible (Computer Lab)
            </label>
          </div>
          {totalSeats > 0 && (
            <div className="alert alert-info" style={{ margin: 0 }}>
              Layout: {form.bench_rows} rows x {form.bench_cols} cols = {totalSeats} positions
              {totalSeats !== parseInt(form.capacity || 0) && parseInt(form.capacity || 0) > 0 &&
                <span style={{ marginLeft: 8, color: '#FFD60A' }}> — differs from capacity field</span>}
            </div>
          )}
          <div className="flex-row" style={{ justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <div className="spinner spinner-invert" style={{ width: 14, height: 14 }} /> : (room?.id ? 'Update' : 'Add Room')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ClassroomsPage() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterBlock, setFilterBlock] = useState('');
  const [filterOnline, setFilterOnline] = useState('');
  const [modal, setModal] = useState(null);
  const [editing, setEditing] = useState(null);
  const [showFiltersMenu, setShowFiltersMenu] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { user } = useAuthStore();
  const isCoord = user?.role === 'coordinator';

  const fetchRooms = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/classrooms');
      setRooms(data);
    } catch {
      toast.error('Failed to load classrooms');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const del = async (id) => {
    if (!confirm('Remove this classroom?')) return;
    try {
      await api.delete(`/classrooms/${id}`);
      toast.success('Removed');
      fetchRooms();
    } catch {
      toast.error('Delete failed');
    }
  };

  const blocks = [...new Set(rooms.map(r => r.block))].sort();
  const totalRooms = rooms.length;
  const totalCapacity = rooms.reduce((s, r) => s + (r.capacity || 0), 0);
  const onlineRoomsCount = rooms.filter(r => r.is_online).length;

  // Local filtering
  const filteredRooms = rooms.filter(r => {
    const matchesSearch = !search || 
      r.room_no.toLowerCase().includes(search.toLowerCase()) ||
      r.block.toLowerCase().includes(search.toLowerCase());
    
    const matchesBlock = !filterBlock || r.block === filterBlock;
    
    const matchesOnline = filterOnline === '' || 
      (filterOnline === 'online' && r.is_online) || 
      (filterOnline === 'offline' && !r.is_online);

    return matchesSearch && matchesBlock && matchesOnline;
  });

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [search, filterBlock, filterOnline]);

  // Pagination derived data
  const totalPages = Math.ceil(filteredRooms.length / itemsPerPage) || 1;
  const paginatedRooms = filteredRooms.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(new Set(paginatedRooms.map(r => r.id)));
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
            <DecryptedText text="Classroom Directory" />
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Configure examination halls, supervise bench rows, and monitor computer labs.</p>
        </div>
      </div>

      {/* Middle Section: KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
        <SpotlightCard style={{ padding: 24, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Classrooms</span>
            <Building2 size={14} color="#3b82f6" strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
              <CountUp to={totalRooms} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Registered blocks</div>
          </div>
        </SpotlightCard>

        <SpotlightCard style={{ padding: 24, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Global Seating Capacity</span>
            <Layers size={14} color="#10b981" strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#10b981', fontFamily: 'var(--font-mono)' }}>
              <CountUp to={totalCapacity} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Total available candidate slots</div>
          </div>
        </SpotlightCard>

        <SpotlightCard style={{ padding: 24, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Online Labs</span>
            <Monitor size={14} color="#f59e0b" strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b', fontFamily: 'var(--font-mono)' }}>
              <CountUp to={onlineRoomsCount} /> / <CountUp to={totalRooms} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Rooms with PC kiosks</div>
          </div>
        </SpotlightCard>
      </div>

      {/* Bottom Section: Primary Content Area */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* SaaS UI Header Bar */}
        <div className="saas-page-header-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Rooms</span>
            
            {/* Block tabs */}
            <div className="saas-filter-tabs">
              <button className={`saas-filter-tab${filterBlock === '' ? ' active' : ''}`} onClick={() => setFilterBlock('')}>All</button>
              {blocks.slice(0, 4).map(b => (
                <button 
                  key={b} 
                  className={`saas-filter-tab${filterBlock === b ? ' active' : ''}`} 
                  onClick={() => setFilterBlock(b)}
                >
                  {b}
                </button>
              ))}
            </div>

            {/* Filter button */}
            <button className={`btn btn-ghost btn-sm${showFiltersMenu ? ' active' : ''}`} onClick={() => setShowFiltersMenu(!showFiltersMenu)} style={{ borderRadius: 6, padding: '4px 10px' }}>
              <Layers size={12} strokeWidth={1.5} style={{ marginRight: 4 }} /> Filter
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Search Input */}
            <div className="saas-search-input-wrapper" style={{ width: 220 }}>
              <Search size={12} color="var(--text-tertiary)" strokeWidth={1.5} />
              <input 
                placeholder="Search room no, block..." 
                className="saas-search-input" 
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && <X size={12} color="var(--text-tertiary)" style={{ cursor: 'pointer' }} onClick={() => setSearch('')} />}
            </div>

            {/* Add Room button */}
            {isCoord && (
              <button className="btn btn-primary" onClick={() => { setEditing(null); setModal('form'); }} style={{ borderRadius: 6 }}>
                + Add Room
              </button>
            )}
          </div>
        </div>

        {/* Filter Selection Panel */}
        {showFiltersMenu && (
          <div style={{ padding: '12px 28px', background: 'var(--bg-base)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 16, alignItems: 'center' }}>
            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Block:</span>
              <select className="select" style={{ fontSize: 12, minHeight: 28, height: 28, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-input)' }} value={filterBlock} onChange={e => setFilterBlock(e.target.value)}>
                <option value="">All Blocks</option>
                {blocks.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Type Compatibility:</span>
              <select className="select" style={{ fontSize: 12, minHeight: 28, height: 28, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-input)' }} value={filterOnline} onChange={e => setFilterOnline(e.target.value)}>
                <option value="">All Rooms</option>
                <option value="online">Online Labs Only</option>
                <option value="offline">Traditional Halls Only</option>
              </select>
            </div>

            {(filterBlock || filterOnline) && (
              <button className="btn btn-ghost btn-sm" style={{ height: 28, minHeight: 28, borderRadius: 4, fontSize: 11, padding: '0 8px' }} onClick={() => { setFilterBlock(''); setFilterOnline(''); }}>
                Clear Filters
              </button>
            )}
          </div>
        )}

        {/* Active Filter Chips */}
        {(filterBlock || filterOnline) && (
          <div style={{ padding: '8px 28px', display: 'flex', gap: 8, flexWrap: 'wrap', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
            {filterBlock && (
              <div className="saas-filter-chip">
                <span>Block is {filterBlock}</span>
                <button className="saas-filter-chip-close" onClick={() => setFilterBlock('')}>×</button>
              </div>
            )}
            {filterOnline && (
              <div className="saas-filter-chip">
                <span>Mode is {filterOnline === 'online' ? 'Online Lab' : 'Traditional'}</span>
                <button className="saas-filter-chip-close" onClick={() => setFilterOnline('')}>×</button>
              </div>
            )}
          </div>
        )}

        {/* Rooms Table */}
        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
          ) : paginatedRooms.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: 13 }}>
              No classrooms matched the filters.
            </div>
          ) : (
            <table style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: 40, paddingLeft: 28 }}>
                    <input 
                      type="checkbox" 
                      onChange={handleSelectAll} 
                      checked={paginatedRooms.length > 0 && paginatedRooms.every(r => selectedIds.has(r.id))}
                      style={{ cursor: 'pointer' }}
                    />
                  </th>
                  <th>Room Number</th>
                  <th>Building Block</th>
                  <th>Seat Capacity</th>
                  <th>Bench Grid Layout</th>
                  <th>Compatibility</th>
                  <th>Status</th>
                  {isCoord && <th style={{ width: 60, paddingRight: 28, textAlign: 'right' }}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {paginatedRooms.map((r) => (
                  <tr key={r.id}>
                    <td style={{ paddingLeft: 28 }}>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.has(r.id)} 
                        onChange={() => handleSelectOne(r.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{r.room_no}</td>
                    <td style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{r.block}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.capacity} seats</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
                      {r.bench_rows} rows × {r.bench_cols} cols
                    </td>
                    <td>
                      {r.is_online ? (
                        <span className="badge badge-ly" style={{ fontSize: 9 }}>ONLINE LAB</span>
                      ) : (
                        <span className="badge badge-neutral" style={{ fontSize: 9 }}>EXAM HALL</span>
                      )}
                    </td>
                    <td><span className="badge badge-success">Active</span></td>
                    {isCoord && (
                      <td style={{ paddingRight: 28, textAlign: 'right', position: 'relative' }}>
                        <button className="btn btn-ghost btn-icon btn-sm" style={{ border: 'none', background: 'transparent' }} onClick={() => setActiveMenuId(activeMenuId === r.id ? null : r.id)}>
                          <span style={{ fontSize: 16, fontWeight: 'bold' }}>···</span>
                        </button>
                        {activeMenuId === r.id && (
                          <>
                            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }} onClick={() => setActiveMenuId(null)} />
                            <div style={{
                              position: 'absolute', right: 28, top: 32, zIndex: 999,
                              background: 'var(--bg-surface)', border: '1px solid var(--border)',
                              borderRadius: 6, padding: '4px 0', minWidth: 110,
                              boxShadow: '0 4px 12px rgba(0,0,0,0.5)', textAlign: 'left'
                            }}>
                              <button onClick={() => { setEditing(r); setModal('form'); setActiveMenuId(null); }} style={{ display: 'block', width: '100%', padding: '6px 12px', background: 'none', border: 'none', textAlign: 'left', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 12 }}>Edit Room</button>
                              <button onClick={() => { del(r.id); setActiveMenuId(null); }} style={{ display: 'block', width: '100%', padding: '6px 12px', background: 'none', border: 'none', textAlign: 'left', color: 'var(--accent-red)', cursor: 'pointer', fontSize: 12 }}>Delete</button>
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

      {isCoord && modal === 'form' && <RoomModal room={editing} onClose={() => setModal(null)} onSave={fetchRooms} />}
    </div>
  );
}
