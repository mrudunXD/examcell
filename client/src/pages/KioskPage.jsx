import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import api from '../lib/api.js';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad(n) { return String(n).padStart(2, '0'); }

function getPhase(slot) {
  const now = new Date();
  const [h, m] = (slot.start_time || '09:30').split(':').map(Number);
  const start = new Date(); start.setHours(h, m, 0, 0);
  const end = new Date(start.getTime() + (slot.duration_mins || 180) * 60000);
  if (now < start) return 'upcoming';
  if (now >= start && now <= end) return 'live';
  return 'done';
}

function getCountdown(slot) {
  const now = new Date();
  const [h, m] = (slot.start_time || '09:30').split(':').map(Number);
  const start = new Date(); start.setHours(h, m, 0, 0);
  const end = new Date(start.getTime() + (slot.duration_mins || 180) * 60000);
  const phase = getPhase(slot);
  const target = phase === 'upcoming' ? start : end;
  const diff = Math.max(0, Math.floor((target - now) / 1000));
  const hh = Math.floor(diff / 3600);
  const mm = Math.floor((diff % 3600) / 60);
  const ss = diff % 60;
  return { diff, hh, mm, ss, phase };
}

export default function KioskPage() {
  const { cycleId } = useParams();
  const [searchParams] = useSearchParams();
  const classroomId = searchParams.get('classroomId');

  const [slots, setSlots] = useState([]);
  const [cycle, setCycle] = useState(null);
  const [now, setNow] = useState(new Date());
  const [tick, setTick] = useState(0);
  const [broadcasts, setBroadcasts] = useState([]);
  const [broadcastIdx, setBroadcastIdx] = useState(0);

  const loadData = useCallback(async () => {
    try {
      const params = {};
      if (classroomId) params.classroomId = classroomId;
      const { data } = await api.get(`/public/kiosk/${cycleId}`, { params });
      setCycle(data.cycle);
      setSlots(data.slots || []);
      setBroadcasts((data.broadcasts || []).slice(0, 5));
    } catch {}
  }, [cycleId, classroomId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Refresh data every 60s
  useEffect(() => {
    const id = setInterval(() => { setTick(t => t + 1); }, 60000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => { loadData(); }, [tick]);

  // Clock tick every second
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Rotate broadcasts
  useEffect(() => {
    if (!broadcasts.length) return;
    const id = setInterval(() => setBroadcastIdx(i => (i + 1) % broadcasts.length), 5000);
    return () => clearInterval(id);
  }, [broadcasts]);

  const liveSlots = slots.filter(s => getPhase(s) === 'live');
  const upcomingSlots = slots.filter(s => getPhase(s) === 'upcoming');
  const doneSlots = slots.filter(s => getPhase(s) === 'done');
  const activeSlots = [...liveSlots, ...upcomingSlots];

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0a0a', color: '#F9F9F7',
      fontFamily: "'Inter', 'Helvetica Neue', sans-serif",
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '20px 48px', borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.03)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 4, height: 32, background: '#CC0000' }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.9)' }}>
              MIT World Peace University
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.12em', marginTop: 2 }}>
              EXAMINATION CELL · {cycle?.name || 'EXAM CYCLE'}
            </div>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 48, fontWeight: 200, letterSpacing: '0.05em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {pad(now.getHours())}:{pad(now.getMinutes())}
            <span style={{ fontSize: 24, color: 'rgba(255,255,255,0.4)', marginLeft: 4 }}>{pad(now.getSeconds())}</span>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.12em', marginTop: 4 }}>
            {DAYS[now.getDay()].toUpperCase()}, {now.getDate()} {MONTHS[now.getMonth()].toUpperCase()} {now.getFullYear()}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', padding: '0 48px', gap: 32, overflow: 'hidden', paddingTop: 32, paddingBottom: 24 }}>

        {/* Left: Main exam + countdown */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24, overflowY: 'auto' }}>

          {activeSlots.length > 0 ? (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: activeSlots.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(420px, 1fr))', 
              gap: 24,
              width: '100%'
            }}>
              {activeSlots.map(slot => {
                const cd = getCountdown(slot);
                const isLive = cd.phase === 'live';
                const roomText = Array.isArray(slot.rooms) 
                  ? slot.rooms.map(r => r.room_no).join(', ') 
                  : slot.rooms;
                return (
                  <div 
                    key={slot.id} 
                    style={{ 
                      background: 'rgba(255,255,255,0.02)', 
                      border: '1px solid rgba(255,255,255,0.08)',
                      padding: 32,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: 24,
                    }}
                  >
                    {/* Status pill */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 16px',
                        background: isLive ? 'rgba(22, 101, 52, 0.2)' : 'rgba(29, 78, 216, 0.15)',
                        border: `1px solid ${isLive ? '#166534' : '#1d4ed8'}`,
                      }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%',
                          background: isLive ? '#4ade80' : '#60a5fa',
                          animation: isLive ? 'pulse 1.5s infinite' : 'none',
                        }} />
                        <span style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 600,
                          color: isLive ? '#4ade80' : '#60a5fa' }}>
                          {isLive ? 'Exam In Progress' : 'Starting Soon'}
                        </span>
                      </div>

                      {roomText && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#f59e0b', fontWeight: 700 }}>
                          Rooms: {roomText}
                        </span>
                      )}
                    </div>

                    {/* Subject info */}
                    <div>
                      <div style={{ fontSize: 10, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>
                        {isLive ? 'Currently Running' : 'Next Exam'}
                      </div>
                      <div style={{ 
                        fontSize: activeSlots.length === 1 ? 42 : 26, 
                        fontWeight: 800, 
                        lineHeight: 1.2, 
                        color: '#FFFFFF', 
                        letterSpacing: '-0.02em' 
                      }}>
                        {slot.subject_name}
                      </div>
                      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 6, letterSpacing: '0.05em' }}>
                        {slot.subject_code} · {slot.branch} · {slot.year} Year
                      </div>
                    </div>

                    {/* Countdown clock */}
                    <div>
                      <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>
                        {isLive ? 'Time Remaining' : 'Starts In'}
                      </div>
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                        {[{ v: pad(cd.hh), l: 'HRS' }, { v: pad(cd.mm), l: 'MIN' }, { v: pad(cd.ss), l: 'SEC' }].map(({ v, l }) => (
                          <div key={l} style={{ textAlign: 'center' }}>
                            <div style={{
                              fontSize: activeSlots.length === 1 ? 84 : 48, 
                              fontWeight: 200, 
                              lineHeight: 1, 
                              fontVariantNumeric: 'tabular-nums',
                              color: isLive ? (cd.diff < 1800 ? '#f87171' : '#4ade80') : '#60a5fa',
                              letterSpacing: '-0.04em',
                            }}>
                              {v}
                            </div>
                            <div style={{ fontSize: 8, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>{l}</div>
                          </div>
                        ))}
                      </div>
                      {isLive && cd.diff < 1800 && (
                        <div style={{ marginTop: 8, color: '#f87171', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600 }}>
                          ⚠ Less than 30 minutes remaining
                        </div>
                      )}
                    </div>

                    {/* Metadata footer */}
                    <div style={{ display: 'flex', gap: 16, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12 }}>
                      {[
                        { label: 'Start Time', value: slot.start_time },
                        { label: 'Duration', value: `${slot.duration_mins} min` },
                        { label: 'Mode', value: slot.exam_mode?.toUpperCase() },
                        { label: 'Type', value: slot.exam_type?.toUpperCase() },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <div style={{ fontSize: 8, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>{label}</div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', alignItems: 'center' }}>
              <div style={{ fontSize: 18, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                {doneSlots.length > 0 ? 'All exams for today completed' : 'No exams scheduled today'}
              </div>
            </div>
          )}
        </div>

        {/* Right: Schedule table */}
        <div style={{ width: 380, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>
            Today's Schedule
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {slots.length === 0 ? (
              <div style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', fontSize: 14 }}>No exams today</div>
            ) : slots.map(slot => {
              const phase = getPhase(slot);
              const isActive = activeSlots.some(x => x.id === slot.id);
              return (
                <div key={slot.id} style={{
                  display: 'flex', gap: 12, padding: '12px 16px', marginBottom: 4,
                  background: isActive ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${isActive ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)'}`,
                  transition: 'all 0.3s',
                }}>
                  <div style={{ width: 3, alignSelf: 'stretch', flexShrink: 0, background: phase === 'live' ? '#4ade80' : phase === 'done' ? 'rgba(255,255,255,0.15)' : '#60a5fa' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: phase === 'done' ? 'rgba(255,255,255,0.35)' : '#FFF' }}>
                      {slot.subject_code}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {slot.subject_name}
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>
                      {slot.start_time} · {slot.branch} {slot.year}
                    </div>
                  </div>
                  <div style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: phase === 'live' ? '#4ade80' : phase === 'done' ? 'rgba(255,255,255,0.25)' : '#60a5fa', alignSelf: 'center' }}>
                    {phase}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom: Broadcast ticker */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.03)',
        padding: '12px 48px',
        display: 'flex', alignItems: 'center', gap: 16, minHeight: 52,
      }}>
        <div style={{
          fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase',
          color: broadcasts.length ? '#f87171' : 'rgba(255,255,255,0.2)',
          fontWeight: 700, flexShrink: 0,
          padding: '4px 10px', border: `1px solid ${broadcasts.length ? '#f87171' : 'rgba(255,255,255,0.1)'}`,
        }}>
          {broadcasts.length ? 'NOTICE' : 'MIT WPU EXAM CELL'}
        </div>
        <div style={{ fontSize: 13, color: broadcasts.length ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {broadcasts.length
            ? broadcasts[broadcastIdx]?.message
            : 'All students must carry their hall ticket and college ID card. Mobile phones are strictly prohibited inside examination halls.'}
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', flexShrink: 0, letterSpacing: '0.1em' }}>
          MIT WPU · PUNE
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
