import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Check, X, Clock, Save, Users, RefreshCw, CheckSquare } from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';

const STATUS_CONFIG = {
  present: { label: 'Present', color: '#166534', bg: '#f0fdf4', border: '#bbf7d0', icon: Check },
  absent:  { label: 'Absent',  color: '#CC0000', bg: '#fff5f5', border: '#fecaca', icon: X },
  late:    { label: 'Late',    color: '#92400e', bg: '#fffbeb', border: '#fde68a', icon: Clock },
};

export default function AttendancePage() {
  const { slotId } = useParams();
  const [slot, setSlot] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState({ total: 0, present: 0, absent: 0, late: 0, unmarked: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState({});

  const fetchSlot = async () => {
    try {
      const { data } = await api.get(`/seating/${slotId}`);
      setSlot(data.slot);
      setRooms(data.rooms || []);
      if (data.rooms?.length > 0 && !selectedRoom) {
        setSelectedRoom(data.rooms[0].id);
      }
    } catch { toast.error('Failed to load slot'); }
  };

  const fetchAttendance = useCallback(async (roomId) => {
    if (!roomId) return;
    setLoading(true);
    try {
      const [attRes, sumRes] = await Promise.all([
        api.get(`/attendance/${slotId}`, { params: { room_allocation_id: roomId } }),
        api.get(`/attendance/${slotId}/summary`),
      ]);
      setRecords(attRes.data);
      setSummary(sumRes.data);
    } catch { toast.error('Failed to load attendance'); }
    finally { setLoading(false); }
  }, [slotId]);

  useEffect(() => { fetchSlot(); }, [slotId]);
  useEffect(() => { if (selectedRoom) fetchAttendance(selectedRoom); }, [selectedRoom, fetchAttendance]);

  const markStatus = (studentId, status) => {
    setRecords(prev => prev.map(r => r.student_id === studentId ? { ...r, attendance_status: status } : r));
    setDirty(prev => ({ ...prev, [studentId]: true }));
  };

  const markAll = (status) => {
    setRecords(prev => prev.map(r => ({ ...r, attendance_status: status })));
    const newDirty = {};
    records.forEach(r => { newDirty[r.student_id] = true; });
    setDirty(newDirty);
  };

  const saveAttendance = async () => {
    setSaving(true);
    try {
      const toSave = records.filter(r => dirty[r.student_id] || r.attendance_status).map(r => ({
        student_id: r.student_id,
        room_allocation_id: r.seated_room || selectedRoom,
        status: r.attendance_status || 'absent',
        notes: r.notes || null,
      }));
      await api.post(`/attendance/${slotId}`, { records: toSave });
      setDirty({});
      toast.success(`Saved ${toSave.length} attendance records`);
      fetchAttendance(selectedRoom);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save attendance');
    } finally { setSaving(false); }
  };

  const hasDirty = Object.keys(dirty).length > 0;

  if (!slot && loading) return <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>;

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
          <h1 className="page-title">Attendance Marking</h1>
          <p className="page-subtitle">
            {slot?.subject_code} — {slot?.subject_name} · {slot?.date} · {slot?.start_time}
          </p>
        </div>
        <div className="flex-row" style={{ gap: 8 }}>
          {hasDirty && (
            <button className="btn btn-primary" onClick={saveAttendance} disabled={saving}>
              {saving ? <div className="spinner spinner-invert" style={{ width: 14, height: 14 }} /> : <Save size={13} strokeWidth={1.5} />}
              Save Changes
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => fetchAttendance(selectedRoom)}>
            <RefreshCw size={12} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0, border: '1px solid #111', marginBottom: 24 }}>
        {[
          { label: 'Total',    value: summary.total,    color: '#111' },
          { label: 'Present',  value: summary.present,  color: '#166534' },
          { label: 'Absent',   value: summary.absent,   color: '#CC0000' },
          { label: 'Late',     value: summary.late,     color: '#92400e' },
          { label: 'Unmarked', value: summary.unmarked, color: '#A3A3A3' },
        ].map((item, i) => (
          <div key={item.label} style={{ padding: '12px 16px', borderRight: i < 4 ? '1px solid #E5E5E0' : 'none', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: item.color, fontFamily: 'var(--font-mono)' }}>{item.value}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--np-n500)', marginTop: 2 }}>{item.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20 }}>
        {/* Room selector */}
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--np-n500)', marginBottom: 10, borderBottom: '1px solid #E5E5E0', paddingBottom: 6 }}>
            Rooms
          </div>
          {rooms.map(room => (
            <button
              key={room.id}
              onClick={() => setSelectedRoom(room.id)}
              style={{
                display: 'block', width: '100%', padding: '10px 14px', marginBottom: 4,
                border: `2px solid ${selectedRoom === room.id ? '#111' : '#E5E5E0'}`,
                background: selectedRoom === room.id ? '#111' : 'transparent',
                color: selectedRoom === room.id ? '#F9F9F7' : '#111',
                textAlign: 'left', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 11,
              }}
            >
              {room.room_no}
              <div style={{ fontSize: 9, opacity: 0.65, marginTop: 2 }}>{room.seated_count || 0} students</div>
            </button>
          ))}
        </div>

        {/* Student list */}
        <div>
          {/* Bulk actions */}
          <div className="flex-row" style={{ gap: 8, marginBottom: 12 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--np-n500)', marginRight: 4 }}>
              Bulk:
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => markAll('present')} style={{ color: '#166534', borderColor: '#166534' }}>
              <CheckSquare size={11} strokeWidth={1.5} /> All Present
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => markAll('absent')} style={{ color: '#CC0000', borderColor: '#CC0000' }}>
              <X size={11} strokeWidth={1.5} /> All Absent
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 32 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
          ) : records.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--np-n500)', fontStyle: 'italic', fontFamily: 'var(--font-body)' }}>
              No students in this room, or no seating generated yet.
            </div>
          ) : (
            <div style={{ border: '1px solid #E5E5E0' }}>
              {records.map((student, i) => {
                const status = student.attendance_status || null;
                const isDirty = dirty[student.student_id];
                return (
                  <div key={student.student_id} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                    borderBottom: i < records.length - 1 ? '1px solid #E5E5E0' : 'none',
                    background: isDirty ? '#FFFBF0' : 'transparent',
                  }}>
                    {/* Seat position */}
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--np-n400)', width: 36, textAlign: 'center', flexShrink: 0 }}>
                      R{student.bench_row}<br/>C{student.bench_col}
                    </div>
                    {/* Student info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 12 }}>{student.name}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--np-n500)', marginTop: 1 }}>
                        {student.prn} · {student.roll_no} · {student.branch} {student.year}
                      </div>
                    </div>
                    {/* Status buttons */}
                    <div className="flex-row" style={{ gap: 4, flexShrink: 0 }}>
                      {['present', 'late', 'absent'].map(s => {
                        const cfg = STATUS_CONFIG[s];
                        const Icon = cfg.icon;
                        const isActive = status === s;
                        return (
                          <button
                            key={s}
                            onClick={() => markStatus(student.student_id, s)}
                            title={cfg.label}
                            style={{
                              padding: '5px 10px', border: `1px solid ${isActive ? cfg.color : '#E5E5E0'}`,
                              background: isActive ? cfg.bg : 'transparent',
                              color: isActive ? cfg.color : '#A3A3A3',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                              fontFamily: 'var(--font-mono)', fontSize: 9,
                              transition: 'all 0.1s',
                            }}
                          >
                            <Icon size={10} strokeWidth={2} />
                            {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                    {/* Last marked by */}
                    {student.marked_by_name && (
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--np-n400)', flexShrink: 0 }}>
                        by {student.marked_by_name}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
