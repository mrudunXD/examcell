import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Play, UserCog, RefreshCw, Users, ShieldAlert, Award, CheckCircle } from 'lucide-react';
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

  // Calculate metrics
  const totalDutiesCount = duties.length;
  const primaryCount = duties.filter(d => d.role === 'primary').length;
  const reliefCount = duties.filter(d => d.role === 'relief').length;
  const acknowledgedCount = duties.filter(d => d.acknowledged).length;

  let ackRate = 100;
  if (totalDutiesCount > 0) {
    ackRate = Math.round((acknowledgedCount / totalDutiesCount) * 100);
  }

  // Group by department
  const deptCounts = {};
  duties.forEach(d => {
    const dep = d.department || 'Other';
    deptCounts[dep] = (deptCounts[dep] || 0) + 1;
  });

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: 0, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="flex-row" style={{ gap: 6, marginBottom: 8 }}>
            <Link to="/exam-cycles" className="btn btn-ghost btn-sm" style={{ borderRadius: 8 }}>
              <ArrowLeft size={12} strokeWidth={1.5} style={{ marginRight: 4 }} /> Back to Cycles
            </Link>
          </div>
          <h1 className="page-title">Invigilator Allocator</h1>
          {slotInfo && (
            <p className="page-subtitle">
              {slotInfo.subject_code} — {slotInfo.subject_name} · {formatDate(slotInfo.date)} · {formatTime(slotInfo.start_time)}
            </p>
          )}
        </div>
        <div className="flex-row" style={{ gap: 6 }}>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={fetch} aria-label="Refresh" style={{ borderRadius: 8 }}>
            <RefreshCw size={13} strokeWidth={1.5} />
          </button>
          <button className="btn btn-primary" onClick={generate} disabled={generating} style={{ borderRadius: 8 }}>
            {generating ? (
              <><div className="spinner spinner-invert" style={{ width: 14, height: 14 }} /> Scheduling…</>
            ) : (
              <><Play size={13} strokeWidth={1.5} style={{ marginRight: 4 }} /> Auto-Assign duties</>
            )}
          </button>
        </div>
      </div>

      {/* Row 1: KPI Summary Row */}
      <div className="kpi-grid">
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>Duties Allocated</span>
            <Users size={14} color="#0A84FF" strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{totalDutiesCount}</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>Staff assigned to slot rooms</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>Confirmed Duties</span>
            <CheckCircle size={14} color="#30D158" strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#30D158', fontFamily: 'var(--font-mono)' }}>{acknowledgedCount}</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>Acknowledged assignments</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>Response Rate</span>
            <Award size={14} color="#FFD60A" strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#FFD60A', fontFamily: 'var(--font-mono)' }}>{ackRate}%</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>Shift confirmations pace</div>
          </div>
        </div>
      </div>

      {/* Row 2: Classroom supervisor allocation (Primary Content Area) */}
      <div className="card" style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16 }}>Classroom supervisor allocation</h3>
        
        {loading ? (
          <div style={{ textAlign: 'center', padding: 24 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : duties.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ border: '1px solid var(--border)', display: 'inline-flex', padding: 14, marginBottom: 16, borderRadius: '50%', background: 'rgba(255,255,255,0.02)' }}>
              <UserCog size={28} strokeWidth={1.5} color="var(--text-secondary)" />
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>No Staff Assigned</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12, maxWidth: 360, margin: '0 auto', marginBottom: 20 }}>
              Auto-assign primary and relief supervisors to this slot respecting conflict boundaries.
            </p>
            <button className="btn btn-primary" onClick={generate} disabled={generating} style={{ borderRadius: 8 }}>
              <Play size={13} strokeWidth={1.5} style={{ marginRight: 4 }} /> Auto-Assign Supervisors
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {Object.values(grouped).map((room) => (
              <div key={room.room_no} style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', background: 'var(--bg-surface)' }}>
                {/* Room Header Strip */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 18px',
                  background: 'rgba(255,255,255,0.02)',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                      Room {room.room_no}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)', marginLeft: 12 }}>
                      {room.block}
                    </span>
                  </div>
                  <span className="badge badge-success" style={{ fontSize: 9 }}>
                    {room.duties.length} Assigned
                  </span>
                </div>

                {/* Duties list */}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {room.duties.map((d, di) => (
                    <div
                      key={d.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                        padding: '14px 18px',
                        borderBottom: di < room.duties.length - 1 ? '1px solid var(--border)' : 'none',
                      }}
                    >
                      {/* Role Badge */}
                      <div style={{
                        width: 70, flexShrink: 0,
                        fontFamily: 'var(--font-mono)',
                        fontSize: 9,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        padding: '4px 0',
                        textAlign: 'center',
                        borderRadius: 6,
                        border: `1px solid ${d.role === 'primary' ? 'rgba(48,209,88,0.2)' : 'var(--border)'}`,
                        background: d.role === 'primary' ? 'rgba(48,209,88,0.1)' : 'transparent',
                        color: d.role === 'primary' ? '#30D158' : 'var(--text-secondary)',
                      }}>
                        {d.role}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{d.faculty_name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>{d.department}</div>
                      </div>

                      {/* Inline reassign dropdown */}
                      <div className="flex-row" style={{ gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>REASSIGN:</span>
                        <select
                          className="select"
                          style={{ width: 200, fontSize: 11, padding: '4px 8px' }}
                          value={d.faculty_id}
                          onChange={e => reassign(d.id, e.target.value)}
                        >
                          {faculty.map(f => (
                            <option key={f.id} value={f.id}>{f.name} ({f.department})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
