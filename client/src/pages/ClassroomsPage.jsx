import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';

const EMPTY = { room_no: '', block: '', capacity: '', bench_rows: '', bench_cols: '' };

function RoomModal({ room, onClose, onSave }) {
  const [form, setForm] = useState(room
    ? { room_no: room.room_no, block: room.block, capacity: room.capacity, bench_rows: room.bench_rows, bench_cols: room.bench_cols }
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
          {totalSeats > 0 && (
            <div className="alert alert-info" style={{ margin: 0 }}>
              Layout: {form.bench_rows} rows x {form.bench_cols} cols = {totalSeats} positions
              {totalSeats !== parseInt(form.capacity || 0) && parseInt(form.capacity || 0) > 0 &&
                <span style={{ marginLeft: 8, color: '#92400e' }}> — differs from capacity field</span>}
            </div>
          )}
          <div className="flex-row" style={{ justifyContent: 'flex-end', gap: 8, paddingTop: 16, borderTop: '1px solid #E5E5E0' }}>
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
          <div className="accent-bar" />
          <h1 className="page-title">Classrooms</h1>
          <p className="page-subtitle">{rooms.length} rooms configured</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setModal('form'); }}>
          <Plus size={13} strokeWidth={1.5} /> Add Room
        </button>
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
            <button className="btn btn-primary" onClick={() => { setEditing(null); setModal('form'); }}>
              <Plus size={13} strokeWidth={1.5} /> Add First Room
            </button>
          </div>
        )
        : (
          /* Collapsed grid — newspaper column layout */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', border: '1px solid #111' }}>
            {rooms.map((r, i) => (
              <div key={r.id} style={{
                borderRight: '1px solid #111',
                borderBottom: '1px solid #111',
                padding: '18px 16px',
              }}>
                {/* Room number — display type */}
                <div style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 28,
                  fontWeight: 900,
                  lineHeight: 1,
                  color: '#111111',
                  marginBottom: 2,
                }}>
                  {r.room_no}
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: '#737373',
                  marginBottom: 14,
                }}>
                  {r.block}
                </div>

                {/* Stats row */}
                <div style={{ display: 'flex', gap: 18, marginBottom: 14 }}>
                  {[
                    { label: 'Capacity', val: r.capacity },
                    { label: 'Layout', val: `${r.bench_rows}x${r.bench_cols}` },
                  ].map(({ label, val }) => (
                    <div key={label}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#A3A3A3' }}>{label}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: '#111111', marginTop: 2 }}>{val}</div>
                    </div>
                  ))}
                </div>

                {/* Mini bench grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${Math.min(r.bench_cols, 6)}, 1fr)`,
                  gap: 2,
                  marginBottom: 14,
                  opacity: 0.5,
                }}>
                  {Array.from({ length: Math.min(r.bench_rows * r.bench_cols, 30) }).map((_, j) => (
                    <div key={j} style={{ height: 5, background: '#111111' }} />
                  ))}
                </div>

                <div className="flex-row" style={{ gap: 4 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(r); setModal('form'); }}>
                    <Pencil size={11} strokeWidth={1.5} /> Edit
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => del(r.id)}>
                    <Trash2 size={11} strokeWidth={1.5} /> Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      }

      {modal === 'form' && <RoomModal room={editing} onClose={() => setModal(null)} onSave={fetch} />}
    </div>
  );
}
