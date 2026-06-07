import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
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
  const [slots, setSlots] = useState([]);
  const [cycle, setCycle] = useState(null);
  const [now, setNow] = useState(new Date());
  const [tick, setTick] = useState(0);
  const [broadcasts, setBroadcasts] = useState([]);
  const [broadcastIdx, setBroadcastIdx] = useState(0);

  const loadData = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const [cyclesRes, slotsRes, bRes] = await Promise.all([
        api.get('/exam-cycles'),
        api.get(`/exam-cycles/${cycleId}/slots`),
        api.get('/broadcasts').catch(() => ({ data: [] })),
      ]);
      const c = cyclesRes.data.find(x => x.id === cycleId) || cyclesRes.data[0];
      setCycle(c);
      setSlots(slotsRes.data.filter(s => s.date === today));
      setBroadcasts(bRes.data.filter(b => b.priority === 'urgent' || b.priority === 'critical').slice(0, 5));
    } catch {}
  }, [cycleId]);

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
  const mainSlot = liveSlots[0] || upcomingSlots[0];
  const cd = mainSlot ? getCountdown(mainSlot) : null;

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
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>

          {mainSlot ? (
            <>
              {/* Status pill */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 16px',
                  background: cd?.phase === 'live' ? 'rgba(22, 101, 52, 0.3)' : 'rgba(29, 78, 216, 0.2)',
                  border: `1px solid ${cd?.phase === 'live' ? '#166534' : '#1d4ed8'}`,
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: cd?.phase === 'live' ? '#4ade80' : '#60a5fa',
                    animation: cd?.phase === 'live' ? 'pulse 1.5s infinite' : 'none',
                  }} />
                  <span style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 600,
                    color: cd?.phase === 'live' ? '#4ade80' : '#60a5fa' }}>
                    {cd?.phase === 'live' ? 'Exam In Progress' : 'Starting Soon'}
                  </span>
                </div>
              </div>

              {/* Subject name */}
              <div>
                <div style={{ fontSize: 13, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>
                  {cd?.phase === 'live' ? 'Currently Running' : 'Next Exam'}
                </div>
                <div style={{ fontSize: 52, fontWeight: 800, lineHeight: 1.1, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
                  {mainSlot.subject_name}
                </div>
                <div style={{ fontSize: 18, color: 'rgba(255,255,255,0.5)', marginTop: 8, letterSpacing: '0.05em' }}>
                  {mainSlot.subject_code} · {mainSlot.branch} · {mainSlot.year} Year
                </div>
              </div>

              {/* Countdown */}
              <div>
                <div style={{ fontSize: 12, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 12 }}>
                  {cd?.phase === 'live' ? 'Time Remaining' : 'Starts In'}
                </div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
                  {[{ v: pad(cd?.hh), l: 'HRS' }, { v: pad(cd?.mm), l: 'MIN' }, { v: pad(cd?.ss), l: 'SEC' }].map(({ v, l }) => (
                    <div key={l} style={{ textAlign: 'center' }}>
                      <div style={{
                        fontSize: 96, fontWeight: 200, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
                        color: cd?.phase === 'live' ? (cd.diff < 1800 ? '#f87171' : '#4ade80') : '#60a5fa',
                        letterSpacing: '-0.04em',
                      }}>
                        {v}
                      </div>
                      <div style={{ fontSize: 10, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.25)', marginTop: -8 }}>{l}</div>
                    </div>
                  ))}
                </div>
                {cd?.phase === 'live' && cd.diff < 1800 && (
                  <div style={{ marginTop: 12, color: '#f87171', fontSize: 12, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 600 }}>
                    ⚠ Less than 30 minutes remaining
                  </div>
                )}
              </div>

              {/* Exam details */}
              <div style={{ display: 'flex', gap: 24, marginTop: 8 }}>
                {[
                  { label: 'Start Time', value: mainSlot.start_time },
                  { label: 'Duration', value: `${mainSlot.duration_mins} minutes` },
                  { label: 'Mode', value: mainSlot.exam_mode?.toUpperCase() },
                  { label: 'Type', value: mainSlot.exam_type?.toUpperCase() },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>{value}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
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
              const isMain = slot.id === mainSlot?.id;
              return (
                <div key={slot.id} style={{
                  display: 'flex', gap: 12, padding: '12px 16px', marginBottom: 4,
                  background: isMain ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${isMain ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)'}`,
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
