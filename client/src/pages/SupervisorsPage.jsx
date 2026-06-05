import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Play, UserCog, RefreshCw } from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';

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
        api.get(`/seating/${slotId}`)
      ]);
      setDuties(dr.data);
      setFaculty(fr.data);
      setSlotInfo(sr.data.slot);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetch(); }, [slotId]);

  const generate = async () => {
    setGenerating(true);
    try {
      const { data } = await api.post(`/supervisors/generate/${slotId}`);
      toast.success(data.message);
      fetch();
    } catch (err) { toast.error(err.response?.data?.error || 'Generation failed'); }
    finally { setGenerating(false); }
  };

  const reassign = async (dutyId, newFacultyId) => {
    try {
      await api.put('/supervisors/reassign', { duty_id: dutyId, new_faculty_id: newFacultyId });
      toast.success('Reassigned'); fetch();
    } catch { toast.error('Reassignment failed'); }
  };

  // Group duties by room
  const grouped = {};
  for (const d of duties) {
    const key = d.room_no;
    if (!grouped[key]) grouped[key] = { room_no: d.room_no, block: d.block, duties: [] };
    grouped[key].duties.push(d);
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="flex-row" style={{ gap: 8, marginBottom: 6 }}>
            <Link to="/exam-cycles" className="btn btn-ghost btn-sm"><ArrowLeft size={13} /></Link>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Exam Cycles</span>
          </div>
          <h1>Supervisor Assignment</h1>
          {slotInfo && <p>{slotInfo.subject_code} — {slotInfo.subject_name} · {slotInfo.date} at {slotInfo.start_time}</p>}
        </div>
        <div className="flex-row">
          <button className="btn btn-ghost btn-sm" onClick={fetch}><RefreshCw size={14} /></button>
          <button className="btn btn-primary" onClick={generate} disabled={generating}>
            {generating ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Generating…</> : <><Play size={14} /> Auto-Assign</>}
          </button>
        </div>
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      : duties.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <UserCog size={40} color="var(--color-text-muted)" style={{ margin: '0 auto 14px' }} />
          <h3>No Supervisors Assigned</h3>
          <p className="text-muted" style={{ fontSize: 13, margin: '8px 0 20px' }}>
            Click "Auto-Assign" to generate supervisor assignments respecting all constraints.
          </p>
          <button className="btn btn-primary" onClick={generate}>Auto-Assign Supervisors</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {Object.values(grouped).map(room => (
            <div key={room.room_no} className="card">
              <div className="flex-between" style={{ marginBottom: 14 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>Room {room.room_no}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{room.block}</div>
                </div>
                <span className="badge badge-success">{room.duties.length} assigned</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {room.duties.map(d => (
                  <div key={d.id} style={{
                    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                    borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12
                  }}>
                    <span className={`badge ${d.role === 'primary' ? 'badge-fy' : 'badge-sy'}`} style={{ width: 70, justifyContent: 'center' }}>
                      {d.role}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>{d.faculty_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{d.department}</div>
                    </div>
                    <select className="select" style={{ width: 220, fontSize: 12 }}
                      value={d.faculty_id}
                      onChange={e => reassign(d.id, e.target.value)}>
                      {faculty.map(f => <option key={f.id} value={f.id}>{f.name} ({f.department})</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
