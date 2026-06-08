import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Play, UserCog, RefreshCw } from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';
import { formatDate, formatTime } from '../lib/format.js';

export default function SupervisorsPage() {
  const { slotId } = useParams();
  const [duties, setDuties] = useState([]);
  const [slotInfo, setSlotInfo] = useState(null);
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try {
      const [dr, fr, sr] = await Promise.all([
        api.get(`/supervisors/${slotId}`),
        api.get('/faculty'),
        api.get(`/seating/${slotId}`),
      ]);
      setDuties(dr.data); setFaculty(fr.data); setSlotInfo(sr.data.slot);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetch(); }, [slotId]);

  const generate = async () => {
    setGenerating(true);
    try {
      const { data } = await api.post(`/supervisors/generate/${slotId}`);
      toast.success(data.message); fetch();
    } catch (err) { toast.error(err.response?.data?.error || 'Generation failed'); }
    finally { setGenerating(false); }
  };

  const reassign = async (dutyId, newFacultyId) => {
    try {
      await api.put('/supervisors/reassign', { duty_id: dutyId, new_faculty_id: newFacultyId });
      toast.success('Reassigned'); fetch();
    } catch { toast.error('Reassignment failed'); }
  };

  // Group by room
  const grouped = {};
  for (const d of duties) {
    if (!grouped[d.room_no]) grouped[d.room_no] = { room_no: d.room_no, block: d.block, duties: [] };
    grouped[d.room_no].duties.push(d);
  }

  return (
    <div className="fade-in">
      <div className="page-header" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="flex-row" style={{ gap: 6, marginBottom: 8 }}>
            <Link to="/exam-cycles" className="btn btn-ghost btn-sm">
              <ArrowLeft size={12} strokeWidth={1.5} /> Cycles
            </Link>
          </div>
          <div className="accent-bar" />
          <h1 className="page-title">Supervisor Assignment</h1>
          {slotInfo && (
            <p className="page-subtitle">{slotInfo.subject_code} — {slotInfo.subject_name} · {formatDate(slotInfo.date)} · {formatTime(slotInfo.start_time)}</p>
          )}
        </div>
        <div className="flex-row" style={{ gap: 6 }}>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={fetch} aria-label="Refresh">
            <RefreshCw size={13} strokeWidth={1.5} />
          </button>
          <button className="btn btn-primary" onClick={generate} disabled={generating}>
            {generating
              ? <><div className="spinner spinner-invert" style={{ width: 14, height: 14 }} /> Generating…</>
              : <><Play size={13} strokeWidth={1.5} /> Auto-Assign</>}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : duties.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 64 }}>
          <div style={{ border: '1px solid #E5E5E0', display: 'inline-flex', padding: 14, marginBottom: 16 }}>
            <UserCog size={28} strokeWidth={1} color="#A3A3A3" />
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            No Supervisors Assigned
          </div>
          <p style={{ fontFamily: 'var(--font-body)', fontStyle: 'italic', color: 'var(--np-n500)', marginBottom: 24, fontSize: 14 }}>
            Click "Auto-Assign" to generate supervisor duties respecting all constraints.
          </p>
          <button className="btn btn-primary" onClick={generate} disabled={generating}>
            <Play size={13} strokeWidth={1.5} /> Auto-Assign Supervisors
          </button>
        </div>
      ) : (
        <div style={{ border: '1px solid #111' }}>
          {Object.values(grouped).map((room, ri) => (
            <div key={room.room_no} style={{ borderBottom: ri < Object.values(grouped).length - 1 ? '1px solid #E5E5E0' : 'none' }}>
              {/* Room header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                background: '#111111',
                color: '#F9F9F7',
              }}>
                <div>
                  <span style={{ fontFamily: 'var(--font-serif)', fontSize: 15, fontWeight: 700 }}>
                    Room {room.room_no}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.4)', marginLeft: 12 }}>
                    {room.block}
                  </span>
                </div>
                <span className="badge" style={{ color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.2)', fontSize: 9 }}>
                  {room.duties.length} assigned
                </span>
              </div>

              {/* Duties */}
              {room.duties.map((d, di) => (
                <div
                  key={d.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '12px 16px',
                    borderBottom: di < room.duties.length - 1 ? '1px solid #E5E5E0' : 'none',
                  }}
                >
                  {/* Role badge */}
                  <div style={{
                    width: 70, flexShrink: 0,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    padding: '3px 0',
                    textAlign: 'center',
                    border: `1px solid ${d.role === 'primary' ? '#111111' : '#E5E5E0'}`,
                    background: d.role === 'primary' ? '#111111' : 'transparent',
                    color: d.role === 'primary' ? '#F9F9F7' : 'var(--np-n500)',
                  }}>
                    {d.role}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{d.faculty_name}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--np-n500)', marginTop: 2 }}>{d.department}</div>
                  </div>

                  {/* Inline reassign */}
                  <select
                    className="select"
                    style={{ width: 220, fontSize: 11 }}
                    value={d.faculty_id}
                    onChange={e => reassign(d.id, e.target.value)}
                  >
                    {faculty.map(f => (
                      <option key={f.id} value={f.id}>{f.name} ({f.department})</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
