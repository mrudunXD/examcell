import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileDown, Users, UserCheck, Calendar } from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';

export default function ExportPage() {
  const { cycleId } = useParams();
  const [cycle, setCycle] = useState(null);
  const [slots, setSlots] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/exam-cycles'),
      api.get(`/exam-cycles/${cycleId}/slots`),
      api.get('/faculty')
    ]).then(([cr, sr, fr]) => {
      setCycle(cr.data.find(c => c.id === cycleId));
      setSlots(sr.data); setFaculty(fr.data);
    }).catch(() => toast.error('Failed to load')).finally(() => setLoading(false));
  }, [cycleId]);

  const download = async (url, filename) => {
    try {
      const res = await api.get(url, { responseType: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(res.data);
      a.download = filename; a.click();
      toast.success(`Downloaded: ${filename}`);
    } catch (err) {
      const errText = err.response?.data ? await err.response.data.text() : '';
      try {
        const parsed = JSON.parse(errText);
        toast.error(parsed.error || 'Export failed');
      } catch { toast.error('Export failed'); }
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>;

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="flex-row" style={{ gap: 8, marginBottom: 6 }}>
            <Link to="/exam-cycles" className="btn btn-ghost btn-sm"><ArrowLeft size={13} /></Link>
          </div>
          <h1>Export Documents</h1>
          <p>{cycle?.name}</p>
        </div>
        <button className="btn btn-success" onClick={() => download(`/export/timetable/${cycleId}`, `timetable_${cycle?.name}.pdf`)}>
          <Calendar size={14} /> Timetable PDF
        </button>
      </div>

      <div className="alert alert-warning" style={{ marginBottom: 24 }}>
        <AlertTriangle size={14} />
        <span>PDFs are blocked if open conflicts exist. Resolve all conflicts before exporting.</span>
      </div>

      {/* Per-slot exports */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Seating Charts & Attendance Sheets</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {slots.map(slot => (
            <div key={slot.id} className="card" style={{ padding: '14px 18px' }}>
              <div className="flex-between" style={{ flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{slot.subject_code} — {slot.subject_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>📅 {slot.date} at {slot.start_time}</div>
                </div>
                <div className="flex-row" style={{ flexWrap: 'wrap', gap: 8 }}>
                  {slot.rooms?.map(room => (
                    <div key={room.id} className="flex-row" style={{ gap: 6 }}>
                      <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{room.room_no}:</span>
                      <button className="btn btn-ghost btn-sm"
                        onClick={() => download(`/export/seating/${room.id}`, `seating_${room.room_no}_${slot.date}.pdf`)}>
                        <FileDown size={12} /> Seating
                      </button>
                      <button className="btn btn-ghost btn-sm"
                        onClick={() => download(`/export/attendance/${room.id}`, `attendance_${room.room_no}_${slot.date}.pdf`)}>
                        <Users size={12} /> Attendance
                      </button>
                    </div>
                  ))}
                  {(!slot.rooms || slot.rooms.length === 0) && (
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>No rooms allocated</span>
                  )}
                </div>
              </div>
            </div>
          ))}
          {slots.length === 0 && <p className="text-muted" style={{ fontSize: 13 }}>No exam slots in this cycle.</p>}
        </div>
      </div>

      {/* Per-faculty duty sheets */}
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Faculty Duty Sheets</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
          {faculty.map(f => (
            <div key={f.id} className="card" style={{ padding: '12px 14px' }}>
              <div className="flex-between">
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{f.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{f.department}</div>
                </div>
                <button className="btn btn-ghost btn-sm"
                  onClick={() => download(`/export/duty/${f.id}/${cycleId}`, `duty_${f.name.replace(/\s+/g,'_')}.pdf`)}>
                  <UserCheck size={12} /> PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AlertTriangle({ size, ...props }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
}
