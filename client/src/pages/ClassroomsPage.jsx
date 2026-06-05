import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, X, Grid3x3 } from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';

const EMPTY = { room_no: '', block: '', capacity: '', bench_rows: '', bench_cols: '' };

function RoomModal({ room, onClose, onSave }) {
  const [form, setForm] = useState(room ? { room_no: room.room_no, block: room.block, capacity: room.capacity, bench_rows: room.bench_rows, bench_cols: room.bench_cols } : EMPTY);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      room?.id ? await api.put(`/classrooms/${room.id}`, form) : await api.post('/classrooms', form);
      toast.success(room?.id ? 'Room updated' : 'Room added');
      onSave(); onClose();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setSaving(false); }
  };

  const totalSeats = parseInt(form.bench_rows || 0) * parseInt(form.bench_cols || 0);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="flex-between" style={{ marginBottom: 20 }}>
          <h2>{room?.id ? 'Edit Classroom' : 'Add Classroom'}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Room Number *</label>
              <input className="input" value={form.room_no} onChange={e => setForm({ ...form, room_no: e.target.value })} required placeholder="e.g. A-101" />
            </div>
            <div className="form-group">
              <label className="form-label">Block / Building *</label>
              <input className="input" value={form.block} onChange={e => setForm({ ...form, block: e.target.value })} required placeholder="e.g. Block A" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Total Bench Capacity *</label>
            <input className="input" type="number" min={1} value={form.capacity} onChange={e => setForm({ ...form, capacity: e.target.value })} required placeholder="e.g. 60" />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Bench Rows *</label>
              <input className="input" type="number" min={1} value={form.bench_rows} onChange={e => setForm({ ...form, bench_rows: e.target.value })} required placeholder="e.g. 10" />
            </div>
            <div className="form-group">
              <label className="form-label">Positions Per Row *</label>
              <input className="input" type="number" min={1} value={form.bench_cols} onChange={e => setForm({ ...form, bench_cols: e.target.value })} required placeholder="e.g. 6" />
            </div>
          </div>
          {totalSeats > 0 && (
            <div className="alert alert-info">
              Layout: {form.bench_rows} rows × {form.bench_cols} cols = {totalSeats} positions
              {totalSeats !== parseInt(form.capacity || 0) && parseInt(form.capacity || 0) > 0 &&
                <span style={{ marginLeft: 8, color: '#fbbf24' }}>⚠ Differs from capacity ({form.capacity})</span>}
            </div>
          )}
          <div className="flex-row" style={{ justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <div className="spinner" /> : (room?.id ? 'Update' : 'Add Room')}
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
        <div><h1>Classrooms</h1><p>{rooms.length} rooms configured</p></div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setModal('form'); }}>
          <Plus size={15} /> Add Room
        </button>
      </div>
      <div className="grid-3" style={{ marginBottom: 20 }}>
        {!loading && rooms.map(r => (
          <div key={r.id} className="card" style={{ position: 'relative' }}>
            <div className="flex-between" style={{ marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 18 }}>{r.room_no}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{r.block}</div>
              </div>
              <Grid3x3 size={24} color="var(--color-accent)" />
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12, marginBottom: 12 }}>
              <div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: 10, textTransform: 'uppercase', fontWeight: 700 }}>Capacity</div>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{r.capacity}</div>
              </div>
              <div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: 10, textTransform: 'uppercase', fontWeight: 700 }}>Layout</div>
                <div style={{ fontWeight: 600 }}>{r.bench_rows} × {r.bench_cols}</div>
              </div>
            </div>
            {/* Mini grid preview */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(r.bench_cols, 6)}, 1fr)`, gap: 2, marginBottom: 12 }}>
              {Array.from({ length: Math.min(r.bench_rows * r.bench_cols, 24) }).map((_, i) => (
                <div key={i} style={{ height: 6, borderRadius: 1, background: 'var(--color-accent)', opacity: 0.4 }} />
              ))}
              {r.bench_rows * r.bench_cols > 24 && <div style={{ fontSize: 9, color: 'var(--color-text-muted)', gridColumn: '1/-1' }}>…{r.bench_rows * r.bench_cols - 24} more</div>}
            </div>
            <div className="flex-row" style={{ gap: 6 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(r); setModal('form'); }}><Pencil size={12} /> Edit</button>
              <button className="btn btn-danger btn-sm" onClick={() => del(r.id)}><Trash2 size={12} /> Remove</button>
            </div>
          </div>
        ))}
        {loading && <div style={{ padding: 32, textAlign: 'center', gridColumn: '1/-1' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>}
        {!loading && rooms.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 48, color: 'var(--color-text-muted)' }}>No classrooms configured yet</div>
        )}
      </div>
      {modal === 'form' && <RoomModal room={editing} onClose={() => setModal(null)} onSave={fetch} />}
    </div>
  );
}
