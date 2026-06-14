import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/index.js';

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
                <span style={{ marginLeft: 8, color: '#92400e' }}> — differs from capacity field</span>}
            </div>
          )}
          <div className="flex-row" style={{ justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid #222225' }}>
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
  const [modal, setModal] = useState(null);
  const [editing, setEditing] = useState(null);
  const { user } = useAuthStore();
  const isCoord = user?.role === 'coordinator';

  const fetch = async () => {
    setLoading(true);
    try { const { data } = await api.get('/classrooms'); setRooms(data); }
    catch { toast.error('Failed to load classrooms'); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetch(); }, []);

  const del = async (id) => {
    if (!confirm('Remove this classroom?')) return;
    await api.delete(`/classrooms/${id}`); toast.success('Removed'); fetch();
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          
          <h1 className="page-title">Classrooms</h1>
          <p className="page-subtitle">{rooms.length} rooms configured</p>
        </div>
        {isCoord && (
          <button className="btn btn-primary" onClick={() => { setEditing(null); setModal('form'); }}>
            <Plus size={13} strokeWidth={1.5} /> Add Room
          </button>
        )}
      </div>

      {loading
        ? <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        : rooms.length === 0
        ? (
          <div className="card" style={{ textAlign: 'center', padding: 64 }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No Classrooms Yet</div>
            <p style={{ fontFamily: 'var(--font-body)', fontStyle: 'italic', color: 'var(--np-n500)', marginBottom: 20 }}>
              Add classroom configurations to begin seating allocation.
            </p>
            {isCoord && (
              <button className="btn btn-primary" onClick={() => { setEditing(null); setModal('form'); }}>
                <Plus size={13} strokeWidth={1.5} /> Add First Room
              </button>
            )}
          </div>
        )
        : (
          <FloorGroupedRooms rooms={rooms} isCoord={isCoord}
            onEdit={(r) => { setEditing(r); setModal('form'); }}
            onDel={del} />
        )
      }

      {isCoord && modal === 'form' && <RoomModal room={editing} onClose={() => setModal(null)} onSave={fetch} />}
    </div>
  );
}

function FloorGroupedRooms({ rooms, isCoord, onEdit, onDel }) {
  // Group by first character/digit of room_no (floor indicator)
  const floors = {};
  for (const r of rooms) {
    const firstChar = String(r.room_no)[0] || '?';
    // If first char is a digit, it's a floor number; otherwise treat as letter block
    const floorKey = /\d/.test(firstChar) ? `Floor ${firstChar}` : `Block ${firstChar}`;
    if (!floors[floorKey]) floors[floorKey] = [];
    floors[floorKey].push(r);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Object.entries(floors).sort(([a],[b]) => a.localeCompare(b)).map(([floor, floorRooms]) => (
        <div key={floor} style={{ border: '1px solid #222225' }}>
          {/* Floor header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 16px', background: '#F5F5F7', color: '#0C0C0E',
          }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 14, fontWeight: 700 }}>{floor}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
              {floorRooms.length} room(s) · {floorRooms.reduce((s, r) => s + (r.capacity || 0), 0)} total seats
            </span>
          </div>

          {/* Room cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', border: 'none' }}>
            {floorRooms.sort((a, b) => String(a.room_no).localeCompare(String(b.room_no))).map((r, i) => (
              <div key={r.id} style={{
                borderRight: '1px solid #222225',
                borderBottom: '1px solid #222225',
                padding: '16px 14px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                  <div style={{ fontFamily: 'var(--font-serif)', fontSize: 26, fontWeight: 900, lineHeight: 1, color: '#F5F5F7' }}>
                    {r.room_no}
                  </div>
                  {!!r.is_online && (
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '9px',
                      fontWeight: 'bold',
                      background: '#F5F5F7',
                      color: '#0C0C0E',
                      padding: '2px 6px',
                      border: '1.5px solid var(--np-ink)',
                    }}>
                      ONLINE LAB
                    </span>
                  )}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#8E8E93', marginBottom: 12 }}>
                  {r.block}
                </div>

                <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                  {[
                    { label: 'Capacity', val: r.capacity },
                    { label: 'Layout', val: `${r.bench_rows}×${r.bench_cols}` },
                  ].map(({ label, val }) => (
                    <div key={label}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#767680' }}>{label}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: '#F5F5F7', marginTop: 2 }}>{val}</div>
                    </div>
                  ))}
                </div>

                {/* Mini bench visualization */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${Math.min(r.bench_cols, 6)}, 1fr)`,
                  gap: 2, marginBottom: 12, opacity: 0.4,
                }}>
                  {Array.from({ length: Math.min(r.bench_rows * r.bench_cols, 24) }).map((_, j) => (
                    <div key={j} style={{ height: 4, background: '#F5F5F7' }} />
                  ))}
                </div>

                {isCoord && (
                  <div className="flex-row" style={{ gap: 4 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => onEdit(r)}>
                      <Pencil size={11} strokeWidth={1.5} /> Edit
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => onDel(r.id)}>
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









