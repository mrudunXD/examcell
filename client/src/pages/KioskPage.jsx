import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { 
  Sun, 
  Moon, 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  Grid3x3, 
  X, 
  Clock, 
  CalendarDays 
} from 'lucide-react';
import api from '../lib/api.js';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad(n) { return String(n).padStart(2, '0'); }

// Determine the current phase of an exam slot
function getPhase(slot, now) {
  const [h, m] = (slot.start_time || '09:30').split(':').map(Number);
  const start = new Date(now.getTime()); start.setHours(h, m, 0, 0);
  const end = new Date(start.getTime() + (slot.duration_mins || 180) * 60000);
  if (now < start) return 'upcoming';
  if (now >= start && now <= end) return 'live';
  return 'done';
}

// Compute hours, minutes, seconds remaining
function getCountdown(slot, now) {
  const [h, m] = (slot.start_time || '09:30').split(':').map(Number);
  const start = new Date(now.getTime()); start.setHours(h, m, 0, 0);
  const end = new Date(start.getTime() + (slot.duration_mins || 180) * 60000);
  const phase = getPhase(slot, now);
  const target = phase === 'upcoming' ? start : end;
  const diff = Math.max(0, Math.floor((target - now) / 1000));
  const hh = Math.floor(diff / 3600);
  const mm = Math.floor((diff % 3600) / 60);
  const ss = diff % 60;
  return { diff, hh, mm, ss, phase };
}

// ISOLATED COMPONENT: Renders only the top bar clock. Updates every 1s without triggering parent re-render.
function TopBarClock({ isDark }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ 
        fontSize: '56px', 
        fontWeight: 800, 
        letterSpacing: '-0.03em', 
        lineHeight: 1, 
        fontVariantNumeric: 'tabular-nums',
        color: isDark ? '#ffffff' : '#0f172a' 
      }}>
        {pad(time.getHours())}:{pad(time.getMinutes())}
        <span style={{ fontSize: '26px', opacity: 0.5, marginLeft: 6, fontWeight: 500 }}>{pad(time.getSeconds())}</span>
      </div>
      <div style={{ 
        fontSize: '13px', 
        color: isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(15, 23, 42, 0.55)', 
        letterSpacing: '0.12em', 
        marginTop: 6, 
        fontWeight: 700 
      }}>
        {DAYS[time.getDay()].toUpperCase()}, {time.getDate()} {MONTHS[time.getMonth()].toUpperCase()} {time.getFullYear()}
      </div>
    </div>
  );
}

// ISOLATED COMPONENT: Renders slot details & updates its local countdown timer every 1s.
function ExamCard({ slot, isDark, classroomId, onSelectRoom }) {
  const [localNow, setLocalNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setLocalNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const cd = getCountdown(slot, localNow);
  const isLive = cd.phase === 'live';
  const isCritical = isLive && cd.diff < 1800; // Under 30 minutes

  // Premium active/upcoming glow configurations
  const glowShadow = isLive 
    ? (isCritical 
        ? '0 25px 60px rgba(239, 68, 68, 0.12), 0 0 40px rgba(239, 68, 68, 0.15)' 
        : '0 25px 60px rgba(16, 185, 129, 0.12), 0 0 40px rgba(16, 185, 129, 0.15)')
    : '0 25px 60px rgba(59, 130, 246, 0.1), 0 0 45px rgba(59, 130, 246, 0.08)';

  const cardBorderColor = isLive
    ? (isCritical ? 'rgba(239, 68, 68, 0.5)' : 'rgba(16, 185, 129, 0.4)')
    : 'rgba(59, 130, 246, 0.35)';

  const timerColor = isLive 
    ? (isCritical ? '#f87171' : '#34d399') 
    : '#60a5fa';

  const textShadowGlow = isLive 
    ? (isCritical ? '0 0 20px rgba(239, 68, 68, 0.45)' : '0 0 20px rgba(16, 185, 129, 0.45)')
    : '0 0 20px rgba(59, 130, 246, 0.35)';

  return (
    <div style={{ 
      background: isDark ? 'rgba(11, 19, 38, 0.7)' : '#ffffff', 
      border: `2px solid ${cardBorderColor}`,
      borderRadius: '28px',
      padding: '44px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      boxShadow: isDark ? glowShadow : '0 20px 40px rgba(0, 0, 0, 0.03)',
      boxSizing: 'border-box',
      height: '100%',
      backdropFilter: 'blur(16px)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Decorative ambient light bar inside card */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: 4,
        background: isLive ? (isCritical ? '#ef4444' : '#10b981') : '#3b82f6',
        boxShadow: isLive ? (isCritical ? '0 0 10px #ef4444' : '0 0 10px #10b981') : 'none'
      }} />

      {/* Card Header: Status & Quick Room info */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          {/* Status badge */}
          <div style={{
            display: 'flex', 
            alignItems: 'center', 
            gap: 10,
            padding: '10px 22px',
            borderRadius: '40px',
            background: isLive 
              ? (isCritical ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)') 
              : 'rgba(59, 130, 246, 0.08)',
            border: `1.5px solid ${isLive ? (isCritical ? '#ef4444' : '#10b981') : '#3b82f6'}`,
          }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: isLive ? (isCritical ? '#ef4444' : '#10b981') : '#3b82f6',
              animation: isLive ? 'pulse 2s infinite' : 'none',
            }} />
            <span style={{ 
              fontSize: '13px', 
              letterSpacing: '0.1em', 
              textTransform: 'uppercase', 
              fontWeight: 900,
              color: isLive ? (isCritical ? '#ef4444' : '#10b981') : '#3b82f6' 
            }}>
              {isLive ? (isCritical ? 'CRITICAL TIME' : 'Exam In Progress') : 'Starting Soon'}
            </span>
          </div>

          {/* Time indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(15,23,42,0.55)', fontSize: '16px', fontWeight: 700 }}>
            <Clock size={16} />
            <span>{slot.start_time} ({slot.duration_mins} min)</span>
          </div>
        </div>

        {/* Room badges grid */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {slot.rooms && slot.rooms.map(room => {
            const isCurrentKioskRoom = String(room.classroom_id) === String(classroomId);
            
            return (
              <button
                key={room.room_allocation_id}
                onClick={() => onSelectRoom(room)}
                className="room-badge-interactive"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 24px',
                  borderRadius: '16px',
                  background: isCurrentKioskRoom 
                    ? '#f59e0b' 
                    : (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.04)'),
                  border: isCurrentKioskRoom
                    ? '2px solid #d97706'
                    : `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15, 23, 42, 0.08)'}`,
                  color: isCurrentKioskRoom ? '#000000' : (isDark ? '#ffffff' : '#1e293b'),
                  fontSize: '22px',
                  fontWeight: 900,
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: isCurrentKioskRoom ? '0 8px 20px rgba(245, 158, 11, 0.3)' : 'none',
                  fontFamily: "'Outfit', sans-serif",
                }}
                title="Click to view seating arrangement"
              >
                <Grid3x3 size={20} />
                <span>Room {room.room_no}</span>
                {room.block && (
                  <span style={{ fontSize: '14px', opacity: 0.8, fontWeight: 600 }}>
                    ({room.block})
                  </span>
                )}
                {isCurrentKioskRoom && (
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 950,
                    padding: '3px 8px',
                    background: '#000',
                    color: '#FFF',
                    borderRadius: '5px',
                    marginLeft: 6,
                    letterSpacing: '0.05em'
                  }}>
                    HERE
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Middle section: Subject Detail */}
      <div style={{ margin: '20px 0' }}>
        <div style={{ fontSize: '13px', letterSpacing: '0.15em', textTransform: 'uppercase', color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(15,23,42,0.45)', marginBottom: 8, fontWeight: 800 }}>
          {isLive ? 'Active Subject' : 'Next Scheduled'}
        </div>
        <div style={{ 
          fontSize: '48px', 
          fontWeight: 900, 
          lineHeight: 1.15, 
          color: isDark ? '#ffffff' : '#0f172a', 
          letterSpacing: '-0.02em',
          fontFamily: "'Outfit', sans-serif"
        }}>
          {slot.subject_name}
        </div>
        <div style={{ fontSize: '20px', fontWeight: 700, color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(15,23,42,0.65)', marginTop: 10, letterSpacing: '0.02em' }}>
          {slot.subject_code} · <span style={{ color: '#D6001C', fontWeight: 900 }}>{slot.branch}</span> · {slot.year} Year
        </div>
      </div>

      {/* Countdown Timers */}
      <div>
        <div style={{ fontSize: '13px', letterSpacing: '0.15em', textTransform: 'uppercase', color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(15,23,42,0.45)', marginBottom: 14, fontWeight: 800 }}>
          {isLive ? 'Time Remaining' : 'Countdown'}
        </div>
        
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {[
            { v: pad(cd.hh), l: 'HRS' }, 
            { v: pad(cd.mm), l: 'MIN' }, 
            { v: pad(cd.ss), l: 'SEC' }
          ].map(({ v, l }) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '84px', 
                fontWeight: 900, 
                lineHeight: 1, 
                fontVariantNumeric: 'tabular-nums',
                color: timerColor,
                textShadow: textShadowGlow,
                letterSpacing: '-0.03em',
                background: isDark ? 'rgba(9, 15, 30, 0.85)' : '#f8fafc',
                border: `1.5px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)'}`,
                padding: '16px 24px',
                borderRadius: '18px',
                boxShadow: isDark ? 'inset 0 4px 12px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.4)' : 'inset 0 2px 4px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.02)',
                fontFamily: "'Outfit', sans-serif"
              }}>
                {v}
              </div>
              <div style={{ fontSize: '11px', letterSpacing: '0.15em', fontWeight: 900, color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(15,23,42,0.45)', marginTop: 8 }}>
                {l}
              </div>
            </div>
          ))}
        </div>
        
        {/* Under 30 minutes alert */}
        {isLive && isCritical && (
          <div style={{ 
            marginTop: 16, 
            color: '#ef4444', 
            fontSize: '15px', 
            letterSpacing: '0.05em', 
            textTransform: 'uppercase', 
            fontWeight: 900,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            animation: 'pulse 1.5s infinite',
          }}>
            <AlertTriangle size={18} />
            <span>Under 30 Minutes Remaining</span>
          </div>
        )}
      </div>

      {/* Metadata Row */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(4, 1fr)', 
        gap: 12,
        borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15, 23, 42, 0.08)'}`, 
        paddingTop: 24 
      }}>
        {[
          { label: 'Start Time', value: slot.start_time },
          { label: 'Duration', value: `${slot.duration_mins}m` },
          { label: 'Exam Mode', value: slot.exam_mode?.toUpperCase() },
          { label: 'Exam Type', value: slot.exam_type?.toUpperCase() },
        ].map(({ label, value }) => (
          <div key={label}>
            <div style={{ fontSize: '11px', letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(15,23,42,0.45)', marginBottom: 4, fontWeight: 800 }}>
              {label}
            </div>
            <div style={{ fontSize: '17px', fontWeight: 800, color: isDark ? '#ffffff' : '#1e293b' }}>
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function KioskPage() {
  const { cycleId } = useParams();
  const [searchParams] = useSearchParams();
  const classroomId = searchParams.get('classroomId');

  // Core Data State
  const [slots, setSlots] = useState([]);
  const [cycle, setCycle] = useState(null);
  const [broadcasts, setBroadcasts] = useState([]);
  const [broadcastIdx, setBroadcastIdx] = useState(0);
  const [isOffline, setIsOffline] = useState(false);

  // Layout Theme & Carousel
  const [theme, setTheme] = useState(() => localStorage.getItem('kiosk_theme') || 'dark');
  const [currentCarouselPage, setCurrentCarouselPage] = useState(0);
  const [selectedAllocation, setSelectedAllocation] = useState(null); // { roomAllocationId, roomNo, block }

  // Seating overlay data
  const [seatingData, setSeatingData] = useState(null);
  const [loadingSeating, setLoadingSeating] = useState(false);

  // Request screen wake lock to prevent TV/Smartboard from going to sleep
  useEffect(() => {
    let wakeLock = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
          console.log('Screen Wake Lock acquired successfully');
        }
      } catch (err) {
        console.warn('Failed to acquire screen wake lock:', err);
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (wakeLock !== null && document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (wakeLock !== null) {
        wakeLock.release().then(() => {
          wakeLock = null;
          console.log('Screen Wake Lock released');
        });
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Root updates every 30 seconds to filter active slots and handle carousel re-indexing.
  const [rootTick, setRootTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setRootTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  // Fetch Kiosk data from endpoint
  const loadData = useCallback(async () => {
    try {
      const params = {};
      if (classroomId) params.classroomId = classroomId;
      const { data } = await api.get(`/public/kiosk/${cycleId}`, { params });
      
      setCycle(data.cycle);
      setSlots(data.slots || []);
      setBroadcasts((data.broadcasts || []).slice(0, 5));
      setIsOffline(false);

      // Cache data
      localStorage.setItem(
        `kiosk_cache_${cycleId}_${classroomId || ''}`,
        JSON.stringify({ cycle: data.cycle, slots: data.slots, broadcasts: data.broadcasts })
      );
    } catch (err) {
      console.warn("Connection lost. Reading cache.", err);
      setIsOffline(true);
      const cached = localStorage.getItem(`kiosk_cache_${cycleId}_${classroomId || ''}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        setCycle(parsed.cycle);
        setSlots(parsed.slots || []);
        setBroadcasts((parsed.broadcasts || []).slice(0, 5));
      }
    }
  }, [cycleId, classroomId]);

  // Initial and Polling load (Every 3 minutes / 180s)
  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const id = setInterval(() => {
      loadData();
    }, 180000);
    return () => clearInterval(id);
  }, [loadData]);

  // Sync theme selection
  useEffect(() => {
    localStorage.setItem('kiosk_theme', theme);
  }, [theme]);

  // Notice rotator
  useEffect(() => {
    if (!broadcasts.length) return;
    const id = setInterval(() => {
      setBroadcastIdx(i => (i + 1) % broadcasts.length);
    }, 6000);
    return () => clearInterval(id);
  }, [broadcasts]);

  // Seating fetcher
  useEffect(() => {
    if (!selectedAllocation) {
      setSeatingData(null);
      return;
    }
    setLoadingSeating(true);
    api.get(`/public/seating/${selectedAllocation.roomAllocationId}`)
      .then(res => {
        setSeatingData(res.data);
        setLoadingSeating(false);
      })
      .catch(err => {
        console.error(err);
        setLoadingSeating(false);
      });
  }, [selectedAllocation]);

  // Evaluate slots filter with fixed local reference
  const getFilteredSlots = () => {
    const referenceNow = new Date();
    const live = slots.filter(s => getPhase(s, referenceNow) === 'live');
    const upcoming = slots.filter(s => getPhase(s, referenceNow) === 'upcoming');
    const done = slots.filter(s => getPhase(s, referenceNow) === 'done');
    const active = [...live, ...upcoming];
    return { live, upcoming, done, active };
  };

  const { live, upcoming, done, active } = getFilteredSlots();

  // Group active slots for carousel pages
  const activeSlotsPages = [];
  for (let i = 0; i < active.length; i += 2) {
    activeSlotsPages.push(active.slice(i, i + 2));
  }

  // Auto rotate carousel pages
  useEffect(() => {
    if (activeSlotsPages.length <= 1) {
      setCurrentCarouselPage(0);
      return;
    }
    const id = setInterval(() => {
      setCurrentCarouselPage(prev => (prev + 1) % activeSlotsPages.length);
    }, 8000);
    return () => clearInterval(id);
  }, [activeSlotsPages.length]);

  const isDark = theme === 'dark';
  const colors = {
    bgGradient: isDark 
      ? 'radial-gradient(circle at 10% 20%, rgba(99, 102, 241, 0.15) 0%, transparent 40%), radial-gradient(circle at 90% 10%, rgba(214, 0, 28, 0.12) 0%, transparent 40%), radial-gradient(circle at 50% 90%, rgba(79, 70, 229, 0.15) 0%, transparent 45%), #05080e'
      : 'radial-gradient(circle at 10% 20%, rgba(99, 102, 241, 0.08) 0%, transparent 40%), radial-gradient(circle at 90% 10%, rgba(214, 0, 28, 0.06) 0%, transparent 40%), radial-gradient(circle at 50% 90%, rgba(79, 70, 229, 0.08) 0%, transparent 45%), #f5f7fa',
    text: isDark ? '#f8fafc' : '#0f172a',
    textMuted: isDark ? 'rgba(248, 250, 252, 0.7)' : 'rgba(15, 23, 42, 0.75)',
    textDim: isDark ? 'rgba(248, 250, 252, 0.45)' : 'rgba(15, 23, 42, 0.55)',
    cardBg: isDark ? 'rgba(15, 22, 42, 0.45)' : 'rgba(255, 255, 255, 0.9)',
    cardBorder: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)',
    border: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)',
    glassBg: isDark ? 'rgba(255, 255, 255, 0.015)' : 'rgba(255, 255, 255, 0.45)',
    shadow: isDark ? '0 10px 40px rgba(0, 0, 0, 0.5)' : '0 10px 40px rgba(15, 23, 42, 0.04)',
    modalOverlayBg: isDark ? 'rgba(4, 7, 12, 0.8)' : 'rgba(240, 242, 245, 0.8)',
    modalContentBg: isDark ? '#090d16' : '#ffffff',
  };

  const currentPageIndex = Math.min(currentCarouselPage, Math.max(0, activeSlotsPages.length - 1));
  const visibleSlots = activeSlotsPages[currentPageIndex] || [];

  return (
    <div style={{
      height: '100vh',
      maxHeight: '100vh',
      width: '100vw',
      overflow: 'hidden',
      position: 'relative',
      background: colors.bgGradient,
      color: colors.text,
      fontFamily: "'Plus Jakarta Sans', 'Outfit', system-ui, sans-serif",
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
      transition: 'background 0.5s ease, color 0.5s ease',
    }}>
      {/* Dynamic Font Import */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Outfit:wght@200;300;400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* Top Header Row */}
      <div style={{
        position: 'relative',
        zIndex: 5,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px 48px',
        borderBottom: `1px solid ${colors.border}`,
        background: colors.glassBg,
        backdropFilter: 'blur(12px)',
        height: '96px',
        boxSizing: 'border-box',
      }}>
        {/* Logo and details */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ width: 5, height: 42, background: '#D6001C', borderRadius: 4 }} />
          <div>
            <div style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.text }}>
              MIT World Peace University
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
              <span style={{ fontSize: '14px', color: colors.textMuted, letterSpacing: '0.05em', fontWeight: 600 }}>
                EXAMINATION CELL · {cycle?.name || 'EXAM CYCLE'}
              </span>
              
              {/* Online/Offline network state */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 8px',
                borderRadius: '5px',
                background: isOffline ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                border: `1px solid ${isOffline ? '#ef4444' : '#10b981'}`,
                color: isOffline ? '#ef4444' : '#10b981',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}>
                {isOffline ? (
                  <>
                    <WifiOff size={11} />
                    <span>Offline</span>
                  </>
                ) : (
                  <>
                    <Wifi size={11} />
                    <span>Live</span>
                  </>
                )}
              </div>

              {isOffline && (
                <button
                  onClick={loadData}
                  style={{
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: colors.cardBg,
                    border: `1px solid ${colors.cardBorder}`,
                    color: colors.text,
                    fontSize: '10px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Retry Sync
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Clock & Mode switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          {/* Isolated clock component to prevent general page lagging */}
          <TopBarClock isDark={isDark} />

          {/* Theme switcher toggle */}
          <button 
            onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
            style={{
              background: colors.cardBg,
              border: `1px solid ${colors.cardBorder}`,
              cursor: 'pointer',
              color: colors.text,
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '10px',
              width: 44,
              height: 44,
              boxShadow: colors.shadow,
              transition: 'transform 0.2s, background-color 0.2s',
            }}
            title="Toggle Light/Dark Theme"
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </div>

      {/* Main Body Workspace */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        flex: 1,
        display: 'flex',
        padding: '24px 48px',
        gap: '32px',
        overflow: 'hidden',
        minHeight: 0,
        boxSizing: 'border-box',
      }}>
        {/* Left Side: Slider pages of active exams */}
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'space-between',
          minHeight: 0,
          boxSizing: 'border-box',
        }}>
          {active.length > 0 ? (
            <div style={{ 
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: 0,
            }}>
              {/* Carousel transition wrapper */}
              <div 
                key={currentPageIndex}
                style={{
                  display: 'grid',
                  gridTemplateColumns: visibleSlots.length === 1 ? '1fr' : '1fr 1fr',
                  gap: '24px',
                  flex: 1,
                  minHeight: 0,
                  animation: 'fadeIn 0.4s ease-out',
                }}
              >
                {visibleSlots.map(slot => (
                  <ExamCard 
                    key={slot.id} 
                    slot={slot} 
                    isDark={isDark} 
                    classroomId={classroomId}
                    onSelectRoom={setSelectedAllocation}
                  />
                ))}
              </div>

              {/* Carousel Pagination bullets */}
              {activeSlotsPages.length > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: '16px' }}>
                  {activeSlotsPages.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentCarouselPage(idx)}
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        border: 'none',
                        background: currentPageIndex === idx ? (isDark ? '#ffffff' : '#0f172a') : 'rgba(128,128,128,0.4)',
                        cursor: 'pointer',
                        transform: currentPageIndex === idx ? 'scale(1.2)' : 'scale(1)',
                        transition: 'all 0.2s ease',
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Idle page if no current slots */
            <div style={{ 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'center', 
              alignItems: 'center',
              background: colors.cardBg,
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: '24px',
              padding: '48px',
              textAlign: 'center',
              boxShadow: colors.shadow,
            }}>
              <CalendarDays size={72} style={{ color: colors.textDim, marginBottom: 16 }} />
              <div style={{ fontSize: '28px', fontWeight: 800, color: colors.text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {done.length > 0 ? 'Today\'s exam sessions completed' : 'No active sessions scheduled'}
              </div>
              <div style={{ fontSize: '16px', color: colors.textMuted, marginTop: 8 }}>
                Check the daily schedule sidebar or request coordination desk support.
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Flat sidebar list of the day's schedule */}
        <div style={{ 
          width: '400px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 16,
          background: colors.cardBg, 
          border: `1px solid ${colors.cardBorder}`,
          borderRadius: '24px',
          padding: '28px',
          boxShadow: colors.shadow,
          minHeight: 0,
          boxSizing: 'border-box',
          backdropFilter: 'blur(10px)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '16px', letterSpacing: '0.12em', textTransform: 'uppercase', color: colors.textMuted, fontWeight: 800 }}>
              Daily Schedule
            </div>
            <div style={{ fontSize: '13px', color: colors.textDim, fontWeight: 700 }}>
              {slots.length} Total Slot{slots.length !== 1 ? 's' : ''}
            </div>
          </div>
          
          <div style={{ 
            flex: 1, 
            overflowY: 'auto',
            paddingRight: '2px',
          }} className="custom-scrollbar">
            {slots.length === 0 ? (
              <div style={{ color: colors.textDim, fontStyle: 'italic', fontSize: '15px', padding: '16px 0' }}>
                No slots found for today.
              </div>
            ) : (
              slots.map(slot => {
                const phase = getPhase(slot, new Date());
                const isActive = active.some(x => x.id === slot.id);
                
                let indicatorColor = '#3b82f6';
                if (phase === 'live') indicatorColor = '#10b981';
                if (phase === 'done') indicatorColor = 'rgba(128,128,128,0.4)';

                return (
                  <div 
                    key={slot.id} 
                    style={{
                      display: 'flex', 
                      gap: 14, 
                      padding: '14px 18px', 
                      marginBottom: '10px',
                      background: isActive ? (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15, 23, 42, 0.03)') : 'transparent',
                      border: `1.5px solid ${isActive ? (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(15, 23, 42, 0.12)') : 'transparent'}`,
                      borderRadius: '14px',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ width: 4, alignSelf: 'stretch', flexShrink: 0, background: indicatorColor, borderRadius: '4px' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '17px', fontWeight: 800, color: phase === 'done' ? colors.textDim : colors.text }}>
                        {slot.subject_code}
                      </div>
                      <div style={{ 
                        fontSize: '14px', 
                        color: phase === 'done' ? colors.textDim : colors.textMuted, 
                        marginTop: 2, 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: 'nowrap',
                        fontWeight: 500,
                      }}>
                        {slot.subject_name}
                      </div>
                      <div style={{ fontSize: '12px', color: colors.textDim, marginTop: 4, fontWeight: 600 }}>
                        {slot.start_time} · {slot.branch} · {slot.year} Yr
                      </div>
                    </div>
                    
                    <div style={{ 
                      fontSize: '11px', 
                      letterSpacing: '0.05em', 
                      textTransform: 'uppercase', 
                      color: indicatorColor, 
                      alignSelf: 'center',
                      fontWeight: 800,
                      padding: '3px 6px',
                      borderRadius: '5px',
                      background: phase === 'live' ? 'rgba(16,185,129,0.08)' : 'transparent',
                    }}>
                      {phase}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Notice Board Banner Ticker */}
      <div style={{
        position: 'relative',
        zIndex: 5,
        borderTop: `1px solid ${colors.border}`,
        background: colors.glassBg,
        backdropFilter: 'blur(12px)',
        padding: '12px 48px',
        display: 'flex', 
        alignItems: 'center', 
        gap: 20, 
        height: '64px',
        boxSizing: 'border-box',
      }}>
        <div style={{
          fontSize: '13px', 
          letterSpacing: '0.15em', 
          textTransform: 'uppercase',
          color: broadcasts.length ? '#ef4444' : colors.textDim,
          fontWeight: 900, 
          flexShrink: 0,
          padding: '5px 12px', 
          background: broadcasts.length ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
          border: `1.5px solid ${broadcasts.length ? '#ef4444' : colors.cardBorder}`,
          borderRadius: '5px',
        }}>
          {broadcasts.length ? 'NOTICE' : 'INFO'}
        </div>
        
        {/* Fade notice slide */}
        <div 
          key={broadcastIdx}
          style={{ 
            fontSize: '20px', 
            fontWeight: 700, 
            color: broadcasts.length ? colors.text : colors.textMuted, 
            flex: 1, 
            overflow: 'hidden', 
            textOverflow: 'ellipsis', 
            whiteSpace: 'nowrap',
            animation: 'slideNotice 0.3s ease-out',
            letterSpacing: '0.01em',
          }}
        >
          {broadcasts.length
            ? broadcasts[broadcastIdx]?.message
            : 'Welcome to MIT World Peace University Examination Lobby'}
        </div>
        
        <div style={{ fontSize: '13px', color: colors.textDim, flexShrink: 0, letterSpacing: '0.05em', fontWeight: 700 }}>
          EXAM CELL
        </div>
      </div>

      {/* Seating Grid Modal overlay */}
      {selectedAllocation && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: colors.modalOverlayBg,
          backdropFilter: 'blur(8px)',
          animation: 'fadeIn 0.25s ease-out',
        }}>
          <div style={{
            background: colors.modalContentBg,
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: '24px',
            width: '80vw',
            maxHeight: '84vh',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxSizing: 'border-box',
            animation: 'scaleIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '20px 32px',
              borderBottom: `1px solid ${colors.border}`,
            }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.15em', color: '#D6001C', textTransform: 'uppercase' }}>
                  DOOR ARRANGEMENT SLIP
                </span>
                <h2 style={{ fontSize: '32px', fontWeight: 800, margin: '2px 0 0 0', color: colors.text }}>
                  Room {selectedAllocation.roomNo} {selectedAllocation.block ? `(${selectedAllocation.block})` : ''}
                </h2>
              </div>
              
              <button 
                onClick={() => setSelectedAllocation(null)}
                style={{
                  background: colors.glassBg,
                  border: `1px solid ${colors.cardBorder}`,
                  color: colors.text,
                  borderRadius: '50%',
                  width: 44,
                  height: 44,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ 
              padding: '24px 32px', 
              overflowY: 'auto', 
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
            }} className="custom-scrollbar">
              
              {loadingSeating ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0', gap: 12 }}>
                  <div className="spinner" style={{
                    width: 40, height: 40,
                    border: `3px solid ${colors.border}`,
                    borderTop: '3px solid #D6001C',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }} />
                  <div style={{ fontSize: '16px', color: colors.textMuted, fontWeight: 600 }}>Fetching assignments...</div>
                </div>
              ) : seatingData ? (
                <>
                  {/* Blackboard position */}
                  <div style={{
                    background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                    border: `1.5px dashed ${colors.cardBorder}`,
                    borderRadius: '10px',
                    padding: '12px',
                    textAlign: 'center',
                    fontWeight: 800,
                    fontSize: '16px',
                    letterSpacing: '0.2em',
                    color: colors.textMuted,
                    textTransform: 'uppercase',
                  }}>
                    ▲ FRONT / BLACKBOARD ▲
                  </div>

                  {/* Visual grid */}
                  {(() => {
                    const { classroom, assignments } = seatingData;
                    const rows = classroom?.bench_rows || 6;
                    const cols = classroom?.bench_cols || 4;

                    const gridMap = {};
                    assignments.forEach(a => {
                      gridMap[`${a.bench_row}-${a.bench_col}`] = a;
                    });

                    const seats = [];
                    for (let r = 1; r <= rows; r++) {
                      for (let c = 1; c <= cols; c++) {
                        const seat = gridMap[`${r}-${c}`];
                        seats.push({ r, c, seat });
                      }
                    }

                    if (assignments.length === 0) {
                      return (
                        <div style={{ textAlign: 'center', padding: '36px 0', color: colors.textDim, fontSize: '16px' }}>
                          No candidates seated for today's slots.
                        </div>
                      );
                    }

                    return (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${cols}, 1fr)`,
                        gap: '12px',
                        padding: '4px',
                      }}>
                        {seats.map(({ r, c, seat }) => (
                          <div 
                            key={`${r}-${c}`} 
                            style={{
                              position: 'relative',
                              padding: '20px 12px',
                              borderRadius: '12px',
                              background: seat 
                                ? (isDark ? 'rgba(99, 102, 241, 0.1)' : 'rgba(79, 70, 229, 0.05)') 
                                : (isDark ? 'rgba(255, 255, 255, 0.01)' : 'rgba(0, 0, 0, 0.01)'),
                              border: seat
                                ? `1.5px solid ${isDark ? '#6366f1' : '#4f46e5'}`
                                : `1px solid ${colors.cardBorder}`,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minHeight: '96px',
                              boxSizing: 'border-box',
                            }}
                          >
                            <span style={{ 
                              position: 'absolute', 
                              top: 6, 
                              left: 8, 
                              fontSize: '10px', 
                              fontWeight: 700, 
                              color: colors.textDim,
                            }}>
                              R{r}-C{c}
                            </span>
                            
                            {seat ? (
                              <>
                                <span style={{ 
                                  fontSize: '24px', 
                                  fontWeight: 800, 
                                  color: colors.text, 
                                  letterSpacing: '0.05em',
                                }}>
                                  {seat.prn}
                                </span>
                                <span style={{ 
                                  fontSize: '12px', 
                                  color: colors.textMuted, 
                                  marginTop: 4,
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                                  padding: '1px 6px',
                                  borderRadius: '3px',
                                }}>
                                  {seat.branch} {seat.year}
                                </span>
                              </>
                            ) : (
                              <span style={{ 
                                fontSize: '13px', 
                                color: colors.textDim, 
                                fontStyle: 'italic',
                              }}>
                                Empty
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '36px 0', color: colors.textDim, fontSize: '16px' }}>
                  Unable to view arrangement.
                </div>
              )}
            </div>
            
            {/* Modal Footer */}
            <div style={{
              padding: '16px 32px',
              borderTop: `1px solid ${colors.border}`,
              background: isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '13px',
              color: colors.textDim,
              fontWeight: 600,
            }}>
              <span>MIT WPU Examination Cell</span>
              <span>Press close or tap background to exit.</span>
            </div>
          </div>
        </div>
      )}

      {/* Styles */}
      <style>{`
        @keyframes pulse { 
          0%, 100% { opacity: 1; transform: scale(1); } 
          50% { opacity: 0.4; transform: scale(1.02); } 
        }
        @keyframes spin { 
          from { transform: rotate(0deg); } 
          to { transform: rotate(360deg); } 
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes slideNotice {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'};
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'};
        }
      `}</style>
    </div>
  );
}
