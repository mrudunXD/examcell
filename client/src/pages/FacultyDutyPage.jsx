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
      toast.success('Duty acknowledged');
      setDuties(prev => prev.map(d => d.id === dutyId ? { ...d, acknowledged: 1 } : d));
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const downloadDutySheet = async () => {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const res = await api.get(`/export/duty/${user.id}/${selectedCycle}`, { responseType: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(res.data);
      a.download = 'my_duty_sheet.pdf'; a.click();
      toast.success('Duty sheet downloaded');
    } catch { toast.error('Download failed'); }
  };

  return (
    <div className="fade-in" style={{ maxWidth: 600, margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <div className="accent-bar" />
          <h1 className="page-title">My Duties</h1>
          <p className="page-subtitle">{duties.length} assignment{duties.length !== 1 ? 's' : ''} this cycle</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={downloadDutySheet}>
          <UserCheck size={13} strokeWidth={1.5} /> Download PDF
        </button>
      </div>

      {cycles.length > 1 && (
        <div className="form-group" style={{ marginBottom: 20 }}>
          <label className="form-label">Exam Cycle</label>
          <select className="select" value={selectedCycle} onChange={e => setSelectedCycle(e.target.value)}>
            {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : duties.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 64 }}>
          <div style={{ border: '1px solid #E5E5E0', display: 'inline-flex', padding: 14, marginBottom: 16 }}>
            <CalendarDays size={28} strokeWidth={1} color="#A3A3A3" />
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>No Duties Assigned</div>
          <p style={{ fontFamily: 'var(--font-body)', fontStyle: 'italic', color: 'var(--np-n500)', fontSize: 14 }}>
            You have no supervisor duties assigned for this exam cycle.
          </p>
        </div>
      ) : (
        <div style={{ border: '1px solid #111' }}>
          {duties.map((duty, i) => (
            <div
              key={duty.id}
              style={{
                borderBottom: i < duties.length - 1 ? '1px solid #E5E5E0' : 'none',
                borderLeft: `4px solid ${duty.role === 'primary' ? '#111111' : '#A3A3A3'}`,
                padding: '16px 18px',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div className="flex-row" style={{ gap: 8 }}>
                  <span className="badge badge-ink" style={{
                    background: duty.role === 'primary' ? '#111111' : 'transparent',
                    color: duty.role === 'primary' ? '#F9F9F7' : '#525252',
                    borderColor: duty.role === 'primary' ? '#111111' : '#E5E5E0',
                    fontSize: 9,
                  }}>
                    {duty.role === 'primary' ? 'Primary Supervisor' : 'Co-Supervisor'}
                  </span>
                  {duty.acknowledged ? (
                    <span className="badge badge-success" style={{ fontSize: 9 }}>Acknowledged</span>
                  ) : null}
                </div>
                {!duty.acknowledged && (
                  <button className="btn btn-success btn-sm" onClick={() => acknowledge(duty.id)}>
                    <CheckCircle size={11} strokeWidth={1.5} /> Acknowledge
                  </button>
                )}
              </div>

              {/* Subject */}
              <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, fontWeight: 700, marginBottom: 14, lineHeight: 1.2 }}>
                {duty.subject_code} — {duty.subject_name}
              </div>

              {/* Info grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  { icon: CalendarDays, label: 'Date', val: duty.date },
                  { icon: Clock,        label: 'Time', val: `${duty.start_time} · ${duty.duration_mins} min` },
                  { icon: MapPin,       label: 'Room', val: `${duty.room_no} — ${duty.block}` },
                  duty.co_supervisor_name
                    ? { icon: UserCheck, label: 'Co-Supervisor', val: duty.co_supervisor_name }
                    : null,
                ].filter(Boolean).map(({ icon: Icon, label, val }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ border: '1px solid #E5E5E0', padding: 5, flexShrink: 0 }}>
                      <Icon size={13} strokeWidth={1.5} color="#525252" />
                    </div>
                    <div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--np-n500)' }}>{label}</div>
                      <div style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 13, marginTop: 2 }}>{val}</div>
                    </div>
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
