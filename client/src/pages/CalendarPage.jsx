import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import api from '../lib/api.js';
import { formatDate, formatTime } from '../lib/format.js';
import toast from 'react-hot-toast';
import { useAppStore } from '../store/index.js';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const SEM_COLORS = {
  1: '#1e40af', 2: '#0e7490', 3: '#166534', 4: '#92400e',
  5: '#7c3aed', 6: '#be185d', 7: '#c2410c', 8: '#374151',
};

function getMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid = [];
  let week = Array(firstDay).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) { grid.push(week); week = []; }
  }
  if (week.length) { while (week.length < 7) week.push(null); grid.push(week); }
  return grid;
}

export default function CalendarPage() {
  const { cycleId } = useParams();
  const activeCycleId = useAppStore(state => state.activeCycleId);
  const [cycle, setCycle] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.get('/exam-cycles').then(async (cr) => {
      const targetId = cycleId || activeCycleId || cr.data[0]?.id;
      if (!targetId) {
        setLoading(false);
        return;
      }
      
      const c = cr.data.find(x => x.id === targetId);
      setCycle(c);

      try {
        const sr = await api.get(`/exam-cycles/${targetId}/slots`);
        setSlots(sr.data);
      } catch (err) {
        toast.error('Failed to load slots');
      }

      if (c?.start_date) {
        const d = new Date(c.start_date + 'T00:00:00');
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }).catch(() => toast.error('Failed to load calendar'))
      .finally(() => setLoading(false));
  }, [cycleId, activeCycleId]);

  // Build a map of date → slots
  const slotsByDate = {};
  for (const slot of slots) {
    if (!slotsByDate[slot.date]) slotsByDate[slot.date] = [];
    slotsByDate[slot.date].push(slot);
  }

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const grid = getMonthGrid(viewYear, viewMonth);

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
          
          <h1 className="page-title">Exam Calendar</h1>
          <p className="page-subtitle">{cycle?.name} · {slots.length} scheduled exams</p>
        </div>
        <div className="flex-row" style={{ gap: 8, alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={prevMonth}><ChevronLeft size={14} strokeWidth={1.5} /></button>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.08em', minWidth: 120, textAlign: 'center' }}>
            {MONTHS[viewMonth]} {viewYear}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={nextMonth}><ChevronRight size={14} strokeWidth={1.5} /></button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex-row" style={{ gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        {Object.entries(SEM_COLORS).map(([sem, color]) => (
          <div key={sem} className="flex-row" style={{ gap: 5, alignItems: 'center' }}>
            <div style={{ width: 10, height: 10, background: color, flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--np-n500)' }}>Sem {sem}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ border: '2px solid #111', overflow: 'hidden' }}>
        {/* Day headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '2px solid #111' }}>
          {DAYS.map(d => (
            <div key={d} style={{
              textAlign: 'center', padding: '8px 0',
              fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: d === 'Sun' ? '#FF453A' : 'var(--np-n500)',
              background: '#111', color: d === 'Sun' ? '#fca5a5' : 'rgba(255,255,255,0.6)',
              borderRight: '1px solid rgba(255,255,255,0.1)',
            }}>
              {d}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {grid.map((week, wi) => (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: wi < grid.length - 1 ? '1px solid var(--border)' : 'none' }}>
            {week.map((day, di) => {
              const isSun = di === 0;
              const dateStr = day ? `${viewYear}-${String(viewMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}` : null;
              const daySlots = dateStr ? (slotsByDate[dateStr] || []) : [];
              const isToday = dateStr === new Date().toISOString().split('T')[0];
              const isInCycle = cycle && dateStr >= cycle.start_date && dateStr <= cycle.end_date;

              return (
                <div
                  key={di}
                  style={{
                    minHeight: 90, padding: '6px 8px',
                    borderRight: di < 6 ? '1px solid var(--border)' : 'none',
                    background: !day ? 'var(--text-primary)' : isSun ? '#FFF5F5' : isInCycle ? '#FEFEFE' : 'var(--text-primary)',
                    cursor: daySlots.length ? 'pointer' : 'default',
                    position: 'relative',
                  }}
                  onClick={() => daySlots.length && setSelected(selected?.date === dateStr ? null : { date: dateStr, slots: daySlots })}
                >
                  {day && (
                    <>
                      <div style={{
                        fontFamily: 'var(--font-mono)', fontSize: 11,
                        color: isSun ? '#FF453A' : !isInCycle ? '#CCCCCC' : '#111',
                        fontWeight: isToday ? 700 : 400,
                        marginBottom: 4,
                        ...(isToday ? { background: '#111', color: 'var(--bg-base)', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontSize: 10 } : {}),
                      }}>
                        {day}
                      </div>
                      {daySlots.slice(0, 3).map((slot, si) => (
                        <div key={slot.id} style={{
                          background: SEM_COLORS[slot.subject_semester] || '#374151',
                          color: 'white', padding: '2px 5px', marginBottom: 2,
                          fontFamily: 'var(--font-mono)', fontSize: 8, lineHeight: 1.3,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {slot.subject_code || slot.abbreviation}
                        </div>
                      ))}
                      {daySlots.length > 3 && (
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--np-n400)', marginTop: 1 }}>
                          +{daySlots.length - 3} more
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Selected day detail panel */}
      {selected && (
        <div style={{ marginTop: 24, border: '2px solid #111', padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--np-n500)', marginBottom: 4 }}>
                {new Date(selected.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long' })}, {formatDate(selected.date)}
              </div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{selected.slots.length} Exam{selected.slots.length > 1 ? 's' : ''} Scheduled</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>Close</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {selected.slots.map(slot => (
              <div key={slot.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: '1px solid var(--border)', background: '#FEFEFE' }}>
                <div style={{ width: 4, alignSelf: 'stretch', background: SEM_COLORS[slot.subject_semester] || '#374151', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{slot.subject_code} — {slot.subject_name}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--np-n500)', marginTop: 2 }}>
                    {slot.branch} · {slot.year} · Sem {slot.subject_semester} · {formatTime(slot.start_time)} · {slot.student_count} students
                  </div>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', padding: '2px 8px', border: '1px solid var(--border)', color: 'var(--np-n500)' }}>
                  {slot.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}









