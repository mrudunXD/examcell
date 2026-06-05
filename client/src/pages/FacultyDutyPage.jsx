import { useState, useEffect } from 'react';
import { CalendarDays, MapPin, Clock, CheckCircle, UserCheck } from 'lucide-react';
import api from '../lib/api.js';
import { useAppStore } from '../store/index.js';
import toast from 'react-hot-toast';

export default function FacultyDutyPage() {
  const { activeCycleId } = useAppStore();
  const [duties, setDuties] = useState([]);
  const [cycles, setCycles] = useState([]);
  const [selectedCycle, setSelectedCycle] = useState(activeCycleId || '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/exam-cycles').then(r => {
      setCycles(r.data);
      if (!selectedCycle && r.data.length > 0) setSelectedCycle(r.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedCycle) return;
    setLoading(true);
    api.get(`/supervisors/my-duties/${selectedCycle}`)
      .then(r => setDuties(r.data))
      .catch(() => toast.error('Failed to load duties'))
      .finally(() => setLoading(false));
  }, [selectedCycle]);

  const acknowledge = async (dutyId) => {
    try {
      await api.post(`/supervisors/acknowledge/${dutyId}`);
      toast.success('Duty acknowledged!');
      setDuties(prev => prev.map(d => d.id === dutyId ? { ...d, acknowledged: 1, acknowledged_at: new Date().toISOString() } : d));
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const downloadDutySheet = async () => {
    try {
      // Get current user from localStorage
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const res = await api.get(`/export/duty/${user.id}/${selectedCycle}`, { responseType: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(res.data);
      a.download = `my_duty_sheet.pdf`; a.click();
      toast.success('Duty sheet downloaded');
    } catch { toast.error('Download failed'); }
  };

  return (
    <div className="fade-in" style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1>My Duty Schedule</h1>
          <p>{duties.length} assignment(s)</p>
        </div>
        <div className="flex-row" style={{ gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={downloadDutySheet}>
            📄 Download PDF
          </button>
        </div>
      </div>

      {/* Cycle selector */}
      {cycles.length > 1 && (
        <div className="form-group" style={{ marginBottom: 20 }}>
          <label className="form-label">Exam Cycle</label>
          <select className="select" value={selectedCycle} onChange={e => setSelectedCycle(e.target.value)}>
            {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      {loading ? <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      : duties.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <CalendarDays size={40} color="var(--color-text-muted)" style={{ margin: '0 auto 14px' }} />
          <h3>No Duties Assigned</h3>
          <p className="text-muted" style={{ fontSize: 13, marginTop: 8 }}>You have no supervisor duties for this exam cycle.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {duties.map(duty => (
            <div key={duty.id} className="card" style={{
              borderLeft: `4px solid ${duty.role === 'primary' ? 'var(--color-accent)' : 'var(--color-success)'}`,
              opacity: duty.acknowledged ? 0.85 : 1
            }}>
              <div className="flex-between" style={{ marginBottom: 12 }}>
                <div className="flex-row" style={{ gap: 8 }}>
                  <span className={`badge ${duty.role === 'primary' ? 'badge-fy' : 'badge-sy'}`}>
                    {duty.role === 'primary' ? '⭐ Primary' : 'Co-Supervisor'}
                  </span>
                  {duty.acknowledged && <span className="badge badge-success">✅ Acknowledged</span>}
                </div>
                {!duty.acknowledged && (
                  <button className="btn btn-success btn-sm" onClick={() => acknowledge(duty.id)}>
                    <CheckCircle size={13} /> Acknowledge
                  </button>
                )}
              </div>

              <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 10 }}>
                {duty.subject_code} — {duty.subject_name}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="flex-row" style={{ gap: 8, fontSize: 13 }}>
                  <CalendarDays size={15} color="var(--color-text-muted)" />
                  <div>
                    <div style={{ fontWeight: 600 }}>{duty.date}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Date</div>
                  </div>
                </div>
                <div className="flex-row" style={{ gap: 8, fontSize: 13 }}>
                  <Clock size={15} color="var(--color-text-muted)" />
                  <div>
                    <div style={{ fontWeight: 600 }}>{duty.start_time} · {duty.duration_mins} min</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Time</div>
                  </div>
                </div>
                <div className="flex-row" style={{ gap: 8, fontSize: 13 }}>
                  <MapPin size={15} color="var(--color-text-muted)" />
                  <div>
                    <div style={{ fontWeight: 600 }}>Room {duty.room_no}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{duty.block}</div>
                  </div>
                </div>
                {duty.co_supervisor_name && (
                  <div className="flex-row" style={{ gap: 8, fontSize: 13 }}>
                    <UserCheck size={15} color="var(--color-text-muted)" />
                    <div>
                      <div style={{ fontWeight: 600 }}>{duty.co_supervisor_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Co-supervisor</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
