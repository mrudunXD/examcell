import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import api from '../lib/api.js';
import { formatDate, formatTime } from '../lib/format.js';
import toast from 'react-hot-toast';
import { useAppStore } from '../store/index.js';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const YEAR_COLORS = {
  'FY': '#3b82f6', // First Year (Blue)
  'SY': '#06b6d4', // Second Year (Cyan)
  'TY': '#10b981', // Third Year (Green)
  'LY': '#a855f7', // Last/Fourth Year (Purple)
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
      const activeObj = cr.data.find(x => x.status === 'active');
      const targetId = cycleId || (activeCycleId && cr.data.find(x => x.id === activeCycleId)?.status === 'active' ? activeCycleId : (activeObj?.id || cr.data[0]?.id));
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
        {Object.entries(YEAR_COLORS).map(([year, color]) => (
          <div key={year} className="flex-row" style={{ gap: 5, alignItems: 'center' }}>
            <div style={{ width: 10, height: 10, borderRadius: '3px', background: color, flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)' }}>{year}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ 
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
        marginBottom: '24px'
      }}>
        {/* Day headers */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(7, 1fr)', 
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg-elevated)'
        }}>
          {DAYS.map(d => (
            <div key={d} style={{
              textAlign: 'center', 
              padding: '12px 0',
              fontFamily: 'var(--font-serif)', 
              fontSize: '11px', 
              fontWeight: '600',
              letterSpacing: '0.05em',
              textTransform: 'uppercase', 
              color: d === 'Sun' ? 'var(--accent-red)' : 'var(--text-secondary)',
              borderRight: d !== 'Sat' ? '1px solid var(--border)' : 'none'
            }}>
              {d}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {grid.map((week, wi) => (
          <div key={wi} style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(7, 1fr)', 
            borderBottom: wi < grid.length - 1 ? '1px solid var(--border)' : 'none' 
          }}>
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
                    minHeight: '110px', 
                    padding: '8px 10px',
                    borderRight: di < 6 ? '1px solid var(--border)' : 'none',
                    background: !day ? 'var(--bg-base)' : isInCycle ? 'var(--bg-surface)' : 'var(--bg-base)',
                    opacity: !day ? 0.4 : 1,
                    cursor: daySlots.length ? 'pointer' : 'default',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    borderTop: isInCycle ? '2px solid var(--accent-purple)' : 'none',
                  }}
                  className="calendar-day-cell"
                  onClick={() => daySlots.length && setSelected(selected?.date === dateStr ? null : { date: dateStr, slots: daySlots })}
                >
                  {day && (
                    <>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '6px'
                      }}>
                        <div style={{
                          fontFamily: 'var(--font-mono)', 
                          fontSize: '12px',
                          color: isToday ? '#ffffff' : isSun ? 'var(--accent-red)' : isInCycle ? 'var(--text-primary)' : 'var(--text-tertiary)',
                          fontWeight: isToday || isInCycle ? '700' : '400',
                          backgroundColor: isToday ? 'var(--accent-purple)' : 'transparent',
                          borderRadius: '50%',
                          width: isToday ? '22px' : 'auto',
                          height: isToday ? '22px' : 'auto',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: isToday ? '0 0 10px rgba(168, 85, 247, 0.5)' : 'none'
                        }}>
                          {day}
                        </div>
                        {isInCycle && daySlots.length > 0 && (
                          <span style={{
                            fontSize: '9px',
                            color: 'var(--accent-purple)',
                            backgroundColor: 'rgba(168, 85, 247, 0.1)',
                            padding: '1px 4px',
                            borderRadius: '3px',
                            fontWeight: '600'
                          }}>
                            {daySlots.length}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {daySlots.slice(0, 3).map((slot, si) => (
                          <div key={slot.id} style={{
                            background: YEAR_COLORS[slot.year] || '#374151',
                            color: '#ffffff', 
                            padding: '3px 6px', 
                            borderRadius: '4px',
                            fontFamily: 'var(--font-sans)', 
                            fontSize: '9px', 
                            fontWeight: '600',
                            lineHeight: '1.2',
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis', 
                            whiteSpace: 'nowrap',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                          }}
                          title={`${slot.subject_code} - ${slot.subject_name} (${slot.branch} ${slot.year})`}>
                            {slot.abbreviation || (slot.subject_name && slot.subject_name.length > 12 ? slot.subject_name.slice(0, 12) + '...' : slot.subject_name) || slot.subject_code}
                          </div>
                        ))}
                      </div>
                      {daySlots.length > 3 && (
                        <div style={{ 
                          fontFamily: 'var(--font-sans)', 
                          fontSize: '10px', 
                          color: 'var(--text-secondary)', 
                          fontWeight: '600',
                          marginTop: '4px',
                          textAlign: 'right'
                        }}>
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
        <div style={{ 
          marginTop: '24px', 
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)', 
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
        }} className="fade-in">
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '20px',
            borderBottom: '1px solid var(--border)',
            paddingBottom: '12px'
          }}>
            <div>
              <div style={{ 
                fontFamily: 'var(--font-mono)', 
                fontSize: '10px', 
                textTransform: 'uppercase', 
                letterSpacing: '0.15em', 
                color: 'var(--text-tertiary)', 
                marginBottom: '4px' 
              }}>
                {new Date(selected.date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long' })}, {formatDate(selected.date)}
              </div>
              <h3 style={{ 
                fontWeight: '700', 
                fontSize: '18px',
                color: 'var(--text-primary)',
                margin: 0
              }}>
                {selected.slots.length} Scheduled {selected.slots.length > 1 ? 'Exams' : 'Exam'}
              </h3>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>Close</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {selected.slots.map(slot => (
              <div key={slot.id} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '16px', 
                padding: '14px 18px', 
                borderRadius: '10px',
                border: '1px solid var(--border)', 
                background: 'var(--bg-elevated)' 
              }}>
                <div style={{ 
                  width: '4px', 
                  alignSelf: 'stretch', 
                  background: YEAR_COLORS[slot.year] || '#374151', 
                  borderRadius: '2px',
                  flexShrink: 0 
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>
                    {slot.subject_code} — {slot.subject_name}
                  </div>
                  <div style={{ 
                    fontFamily: 'var(--font-sans)', 
                    fontSize: '11px', 
                    color: 'var(--text-secondary)', 
                    marginTop: '4px',
                    display: 'flex',
                    gap: '12px',
                    flexWrap: 'wrap'
                  }}>
                    <span><strong>Branch:</strong> {slot.branch}</span>
                    <span><strong>Year:</strong> {slot.year}</span>
                    <span><strong>Semester:</strong> {slot.subject_semester}</span>
                    <span><strong>Time:</strong> {formatTime(slot.start_time)} ({slot.duration_mins} mins)</span>
                    <span><strong>Students:</strong> {slot.student_count}</span>
                  </div>
                </div>
                <span className={`badge ${slot.status === 'draft' ? 'badge-amber' : 'badge-green'}`}>
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









