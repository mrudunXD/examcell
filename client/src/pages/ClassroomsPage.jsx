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
              <input className="input" value={form.room_no} onChange={e => setForm({ ...form, room_no: e.target.value })} required placeholder="A-101" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            </div>
            <div className="form-group">
              <label className="form-label">Block / Building *</label>
              <input className="input" value={form.block} onChange={e => setForm({ ...form, block: e.target.value })} required placeholder="Block A" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Total Bench Capacity *</label>
            <input className="input" type="number" min={1} value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} required placeholder="60" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Bench Rows *</label>
              <input className="input" type="number" min={1} value={form.bench_rows} onChange={e => setForm({ ...form, bench_rows: e.target.value })} required placeholder="10" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            </div>
            <div className="form-group">
              <label className="form-label">Positions Per Row *</label>
              <input className="input" type="number" min={1} value={form.bench_cols} onChange={e => setForm({ ...form, bench_cols: e.target.value })} required placeholder="6" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
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
            <div className="alert alert-info" style={{ margin: 0, background: 'rgba(13,148,136,0.1)', border: '1px solid rgba(13,148,136,0.2)', color: 'var(--accent-cyan)' }}>
              Layout: {form.bench_rows} rows x {form.bench_cols} cols = {totalSeats} positions
              {totalSeats !== parseInt(form.capacity || 0) && parseInt(form.capacity || 0) > 0 &&
                <span style={{ marginLeft: 8, color: 'var(--accent-amber)' }}> — differs from capacity field</span>}
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
  const [modal, setModal] = useState(null);
  const [editing, setEditing] = useState(null);

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

  const totalRooms = rooms.length;
  const totalCapacity = rooms.reduce((s, r) => s + (r.capacity || 0), 0);
  const onlineRoomsCount = rooms.filter(r => r.is_online).length;

  const filteredRooms = rooms.filter(r => {
    return !search || 
      r.room_no.toLowerCase().includes(search.toLowerCase()) ||
      r.block.toLowerCase().includes(search.toLowerCase());
  });

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
          {isCoord && (
            <button className="btn btn-primary" onClick={() => { setEditing(null); setModal('form'); }} style={{ borderRadius: 6 }}>
              + Add Room
            </button>
          )}
        </div>
      </div>

      {/* Middle Section: KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
        <SpotlightCard style={{ padding: 24, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Classrooms</span>
            <Building2 size={14} color="var(--accent-cyan)" strokeWidth={1.5} />
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
            <Layers size={14} color="var(--accent-green)" strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>
              <CountUp to={totalCapacity} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Total available candidate slots</div>
          </div>
        </SpotlightCard>

        <SpotlightCard style={{ padding: 24, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Online Labs</span>
            <Monitor size={14} color="var(--accent-amber)" strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>
              <CountUp to={onlineRoomsCount} /> / <CountUp to={totalRooms} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Rooms with PC kiosks</div>
          </div>
        </SpotlightCard>
      </div>

      {/* Grouped rooms section */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : filteredRooms.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 64, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>No Classrooms Found</div>
          <p style={{ fontStyle: 'italic', color: 'var(--text-secondary)', marginBottom: 20 }}>
            Try adjusting your search queries.
          </p>
        </div>
      ) : (
        <FloorGroupedRooms 
          rooms={filteredRooms} 
          isCoord={isCoord}
          onEdit={(r) => { setEditing(r); setModal('form'); }}
          onDel={del} 
        />
      )}

      {isCoord && modal === 'form' && <RoomModal room={editing} onClose={() => setModal(null)} onSave={fetchRooms} />}
    </div>
  );
}

function FloorGroupedRooms({ rooms, isCoord, onEdit, onDel }) {
  // Group by floor key
  const floors = {};
  for (const r of rooms) {
    const firstChar = String(r.room_no)[0] || '?';
    const floorKey = /\d/.test(firstChar) ? `Floor ${firstChar}` : `Block ${firstChar}`;
    if (!floors[floorKey]) floors[floorKey] = [];
    floors[floorKey].push(r);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {Object.entries(floors).sort(([a],[b]) => a.localeCompare(b)).map(([floor, floorRooms]) => (
        <div key={floor} style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--bg-surface)' }}>
          {/* Floor header strip */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 18px', background: 'var(--bg-sidebar)', color: 'var(--text-primary)',
            borderBottom: '1px solid var(--border)'
          }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{floor}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)' }}>
              {floorRooms.length} room(s) · {floorRooms.reduce((s, r) => s + (r.capacity || 0), 0)} total seats
            </span>
          </div>

          {/* Cards grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
            {floorRooms.sort((a, b) => String(a.room_no).localeCompare(String(b.room_no))).map((r, i) => (
              <div key={r.id} style={{
                borderRight: '1px solid var(--border)',
                borderBottom: '1px solid var(--border)',
                padding: '18px 16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>
                      {r.room_no}
                    </div>
                    {!!r.is_online && (
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '9px',
                        fontWeight: 'bold',
                        background: 'rgba(20, 184, 166, 0.15)',
                        color: 'var(--accent-cyan)',
                        padding: '2px 6px',
                        borderRadius: 4,
                        border: '1.5px solid var(--border)',
                      }}>
                        ONLINE LAB
                      </span>
                    )}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 12 }}>
                    {r.block}
                  </div>

                  <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                    {[
                      { label: 'Capacity', val: `${r.capacity} seats` },
                      { label: 'Layout', val: `${r.bench_rows}×${r.bench_cols}` },
                    ].map(({ label, val }) => (
                      <div key={label}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{label}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>{val}</div>
                      </div>
                    ))}
                  </div>

                  {/* Mini bench visual grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${Math.min(r.bench_cols, 6)}, 1fr)`,
                    gap: 3, marginBottom: 16, opacity: 0.35,
                  }}>
                    {Array.from({ length: Math.min(r.bench_rows * r.bench_cols, 24) }).map((_, j) => (
                      <div key={j} style={{ height: 4, background: 'var(--accent-cyan)', borderRadius: 1 }} />
                    ))}
                  </div>
                </div>

                {isCoord && (
                  <div className="flex-row" style={{ gap: 6, borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => onEdit(r)} style={{ padding: '4px 8px', fontSize: 11 }}>
                      <Pencil size={11} strokeWidth={1.5} /> Edit
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => onDel(r.id)} style={{ padding: '4px 8px', fontSize: 11 }}>
                      <Trash2 size={11} strokeWidth={1.5} /> Remove
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
