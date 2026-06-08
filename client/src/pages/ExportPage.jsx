import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, FileDown, Users, UserCheck, Calendar, AlertTriangle } from 'lucide-react';
import api from '../lib/api.js';
import { formatDate, formatTime } from '../lib/format.js';
import toast from 'react-hot-toast';

export default function ExportPage() {
  const { cycleId } = useParams();
  const [cycle, setCycle]   = useState(null);
  const [slots, setSlots]   = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/exam-cycles'),
      api.get(`/exam-cycles/${cycleId}/slots`),
      api.get('/faculty'),
    ]).then(([cr, sr, fr]) => {
      setCycle(cr.data.find(c => c.id === cycleId));
      setSlots(sr.data); setFaculty(fr.data);
    }).catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
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
      try { toast.error(JSON.parse(errText).error || 'Export failed'); }
      catch { toast.error('Export failed'); }
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>;

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <div className="flex-row" style={{ gap: 6, marginBottom: 8 }}>
            <Link to="/exam-cycles" className="btn btn-ghost btn-sm">
              <ArrowLeft size={12} strokeWidth={1.5} /> Cycles
            </Link>
          </div>
          <div className="accent-bar" />
          <h1 className="page-title">Export Documents</h1>
          <p className="page-subtitle">{cycle?.name}</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => download(`/export/timetable/${cycleId}`, `timetable_${cycle?.name?.replace(/\s+/g,'_')}.pdf`)}
        >
          <Calendar size={13} strokeWidth={1.5} /> Timetable PDF
        </button>
      </div>

      <div className="alert alert-warning" style={{ marginBottom: 24 }}>
        <AlertTriangle size={13} strokeWidth={1.5} />
        Exports are blocked if open conflicts exist. Resolve all conflicts before generating PDFs.
      </div>

      {/* Seating & Attendance by slot */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--np-n500)', borderBottom: '1px solid #E5E5E0', paddingBottom: 8, marginBottom: 12 }}>
          Seating Charts & Attendance Sheets — Per Room
        </div>
        <div style={{ border: '1px solid #111' }}>
          {slots.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', fontFamily: 'var(--font-body)', fontStyle: 'italic', color: 'var(--np-n500)' }}>
              No exam slots in this cycle.
            </div>
          ) : slots.map((slot, si) => (
            <div key={slot.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '12px 16px',
              borderBottom: si < slots.length - 1 ? '1px solid #E5E5E0' : 'none',
              flexWrap: 'wrap',
            }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{slot.subject_code} — {slot.subject_name}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--np-n500)', marginTop: 2 }}>
                  {formatDate(slot.date)} · {formatTime(slot.start_time)}
                </div>
              </div>
              <div className="flex-row" style={{ flexWrap: 'wrap', gap: 6 }}>
                {slot.rooms?.map(room => (
                  <div key={room.id} className="flex-row" style={{ gap: 4 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--np-n500)', marginRight: 2 }}>
                      {room.room_no}:
                    </span>
                    <button className="btn btn-ghost btn-sm" onClick={() => download(`/export/seating/${room.id}`, `seating_${room.room_no}_${slot.date}.pdf`)}>
                      <FileDown size={11} strokeWidth={1.5} /> Seating
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => download(`/export/attendance/${room.id}`, `attendance_${room.room_no}_${slot.date}.pdf`)}>
                      <Users size={11} strokeWidth={1.5} /> Attendance
                    </button>
                  </div>
                ))}
                {(!slot.rooms || slot.rooms.length === 0) && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--np-n400)' }}>No rooms allocated</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Faculty duty sheets */}
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--np-n500)', borderBottom: '1px solid #E5E5E0', paddingBottom: 8, marginBottom: 12 }}>
          Faculty Duty Sheets — Individual
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', border: '1px solid #111' }}>
          {faculty.map((f, i) => (
            <div key={f.id} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRight: '1px solid #E5E5E0',
              borderBottom: '1px solid #E5E5E0',
              gap: 10,
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 12 }}>{f.name}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--np-n500)', marginTop: 2 }}>{f.department}</div>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => download(`/export/duty/${f.id}/${cycleId}`, `duty_${f.name.replace(/\s+/g,'_')}.pdf`)}
              >
                <UserCheck size={11} strokeWidth={1.5} /> PDF
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
