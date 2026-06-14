import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import io from 'socket.io-client';
import { 
  Sun, 
  Moon, 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  Grid3x3, 
  X, 
  Clock, 
  CalendarDays,
  Volume2,
  VolumeX,
  RefreshCw,
  Maximize,
  Minimize
} from 'lucide-react';
import api from '../lib/api.js';
import { formatDate, formatTime } from '../lib/format.js';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad(n) { return String(n).padStart(2, '0'); }

let serverTimeSkew = 0;
function getSyncDate() {
  return new Date(Date.now() + serverTimeSkew);
}


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

// Synthesizes chimes via browser Web Audio API
function playChime(type) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    const playTone = (freq, duration, startTime) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.25, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    if (type === 'start') {
      // Starting: double high tone C5 -> G5
      playTone(523.25, 0.18, now);
      playTone(783.99, 0.45, now + 0.18);
    } else if (type === 'hour') {
      // Hour completed: chime progression E5 -> C5 -> G4
      playTone(659.25, 0.25, now);
      playTone(523.25, 0.25, now + 0.25);
      playTone(392.00, 0.5, now + 0.5);
    } else if (type === '30m') {
      // 30 mins remaining: warning double chime A4 -> F4
      playTone(440.00, 0.3, now);
      playTone(349.23, 0.6, now + 0.35);
    } else if (type === '10m') {
      // 10 mins remaining: rapid alert double-double chime B4 -> G4 -> B4 -> G4
      playTone(493.88, 0.15, now);
      playTone(392.00, 0.15, now + 0.18);
      playTone(493.88, 0.15, now + 0.36);
      playTone(392.00, 0.5, now + 0.54);
    } else if (type === 'end') {
      // Exam ended: low double chime C4 -> G3
      playTone(261.63, 0.35, now);
      playTone(196.00, 0.7, now + 0.35);
    } else if (type === 'alert') {
      // Emergency/Targeted broadcast warning chime
      playTone(587.33, 0.25, now);
      playTone(880.00, 0.6, now + 0.28);
    }
  } catch (e) {
    console.warn("Failed to play synthesized chime:", e);
  }
}

// ISOLATED COMPONENT: Renders only the top bar clock. Updates every 1s without triggering parent re-render.
function TopBarClock({ isDark }) {
  const [time, setTime] = useState(getSyncDate());

  useEffect(() => {
    const id = setInterval(() => setTime(getSyncDate()), 1000);

    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ 
        fontSize: '48px', 
        fontWeight: 'bold', 
        lineHeight: 1, 
        fontVariantNumeric: 'tabular-nums',
        fontFamily: 'var(--font-mono)',
        color: isDark ? '#ffffff' : '#111111' 
      }}>
        {((time.getHours() % 12) || 12)}:{pad(time.getMinutes())}
        <span style={{ fontSize: '20px', opacity: 0.5, marginLeft: 6, fontWeight: 'normal' }}>{pad(time.getSeconds())}</span>
        <span style={{ fontSize: '20px', opacity: 0.5, marginLeft: 6, fontWeight: 'normal' }}>{time.getHours() >= 12 ? 'PM' : 'AM'}</span>
      </div>
      <div style={{ 
        fontSize: '11px', 
        color: isDark ? '#A3A3A3' : '#525252', 
        letterSpacing: '0.12em', 
        marginTop: 6, 
        fontFamily: 'var(--font-serif)',
        fontStyle: 'italic',
      }}>
        {DAYS[time.getDay()].toUpperCase()}, {pad(time.getDate())}/{pad(time.getMonth() + 1)}/{time.getFullYear()}
      </div>
    </div>
  );
}

// ISOLATED COMPONENT: Renders slot details & updates its local countdown timer every 1s.
function ExamCard({ slot, isDark, classroomId, onSelectRoom, chimesEnabled }) {
  const [localNow, setLocalNow] = useState(getSyncDate());

  useEffect(() => {
    const id = setInterval(() => setLocalNow(getSyncDate()), 1000);
    return () => clearInterval(id);
  }, []);

  const playedMilestonesRef = useRef(null);
  if (playedMilestonesRef.current === null || playedMilestonesRef.current.slotId !== slot.id) {
    const past = new Set();
    const initialCd = getCountdown(slot, getSyncDate());
    if (initialCd.phase === 'done') {
      past.add('start');
      past.add('end');
      past.add('30m');
      past.add('10m');
      for (let h = 1; h <= 10; h++) past.add(`hour_${h}`);
    } else if (initialCd.phase === 'live') {
      past.add('start');
      const elapsed = (slot.duration_mins || 180) * 60 - initialCd.diff;
      const hrs = Math.floor(elapsed / 3600);
      for (let h = 1; h <= hrs; h++) past.add(`hour_${h}`);
      if (initialCd.diff <= 1800) past.add('30m');
      if (initialCd.diff <= 600) past.add('10m');
    }
    playedMilestonesRef.current = { slotId: slot.id, set: past };
  }

  useEffect(() => {
    if (!chimesEnabled) return;
    const currentCd = getCountdown(slot, localNow);
    const set = playedMilestonesRef.current.set;
    
    if (currentCd.phase === 'live') {
      // 1. Check start
      if (!set.has('start')) {
        playChime('start');
        set.add('start');
      }
      
      // 2. Check hourly
      const elapsed = (slot.duration_mins || 180) * 60 - currentCd.diff;
      const hrs = Math.floor(elapsed / 3600);
      for (let h = 1; h <= hrs; h++) {
        if (!set.has(`hour_${h}`)) {
          playChime('hour');
          set.add(`hour_${h}`);
        }
      }
      
      // 3. Check 30m remaining
      if (currentCd.diff <= 1800 && !set.has('30m')) {
        playChime('30m');
        set.add('30m');
      }
      
      // 4. Check 10m remaining
      if (currentCd.diff <= 600 && !set.has('10m')) {
        playChime('10m');
        set.add('10m');
      }
    } else if (currentCd.phase === 'done') {
      // Check end
      if (!set.has('end')) {
        playChime('end');
        set.add('end');
      }
    }
  }, [localNow, slot, chimesEnabled]);

  const cd = getCountdown(slot, localNow);
  const isLive = cd.phase === 'live';
  const isCritical = isLive && cd.diff < 1800; // Under 30 minutes

  const cardBorderColor = isDark ? '#ffffff' : '#111111';
  const timerColor = isDark ? '#ffffff' : '#111111';

  return (
    <div style={{ 
      background: isDark ? '#111111' : '#F9F9F7', 
      border: `4px solid ${cardBorderColor}`,
      borderRadius: 0,
      padding: 'clamp(16px, 3vh, 44px) clamp(16px, 3vw, 44px)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      boxShadow: isDark ? '8px 8px 0 0 #ffffff' : '8px 8px 0 0 #111111',
      boxSizing: 'border-box',
      height: '100%',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Editorial top line */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: '8px',
        background: isLive ? (isCritical ? 'var(--np-red)' : '#166534') : '#1d4ed8',
      }} />

      {/* Card Header: Status & Quick Room info */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(10px, 2vh, 24px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          {/* Status badge */}
          <div style={{
            display: 'flex', 
            alignItems: 'center', 
            gap: 10,
            padding: '8px 16px',
            background: isLive 
              ? (isCritical ? 'rgba(204, 0, 0, 0.1)' : 'rgba(22, 101, 52, 0.1)') 
              : 'rgba(29, 78, 216, 0.1)',
            border: `2px solid ${isLive ? (isCritical ? 'var(--np-red)' : '#166534') : '#1d4ed8'}`,
            color: isLive ? (isCritical ? 'var(--np-red)' : '#166534') : '#1d4ed8',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            textTransform: 'uppercase',
            fontWeight: 'bold',
          }}>
            <div style={{
              width: 8, height: 8,
              background: isLive ? (isCritical ? 'var(--np-red)' : '#166534') : '#1d4ed8',
              animation: isLive ? 'pulse 2s infinite' : 'none',
            }} />
            <span>
              {isLive ? (isCritical ? 'CRITICAL TIME' : 'Exam In Progress') : 'Starting Soon'}
            </span>
          </div>

          {/* Time indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: isDark ? '#A3A3A3' : '#525252', fontSize: '15px', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
            <Clock size={14} />
            <span>{formatTime(slot.start_time)} ({slot.duration_mins} min)</span>
          </div>
        </div>

        {/* Room badges grid */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {slot.rooms && slot.rooms
            .filter(room => !classroomId || String(room.classroom_id) === String(classroomId))
            .map(room => {
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
                    padding: 'clamp(6px, 1.2vh, 12px) clamp(10px, 1.8vw, 20px)',
                    background: isCurrentKioskRoom ? 'var(--np-red)' : 'transparent',
                    border: `2px solid ${cardBorderColor}`,
                    color: isCurrentKioskRoom ? '#ffffff' : (isDark ? '#ffffff' : '#111111'),
                    fontSize: 'clamp(14px, 2.2vh, 20px)',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-mono)',
                    boxShadow: isCurrentKioskRoom 
                      ? (isDark ? '4px 4px 0 0 #fff' : '4px 4px 0 0 #111') 
                      : 'none',
                    transition: 'transform 0.1s',
                  }}
                  title="Click to view seating arrangement"
                >
                  <Grid3x3 size={18} />
                  <span>Room {room.room_no}</span>
                  {room.block && (
                    <span style={{ fontSize: '13px', opacity: 0.8, fontWeight: 'normal' }}>
                      ({room.block})
                    </span>
                  )}
                  {isCurrentKioskRoom && (
                    <span style={{
                      fontSize: '9px',
                      fontWeight: 'bold',
                      padding: '2px 6px',
                      background: '#000',
                      color: '#FFF',
                      marginLeft: 6,
                      letterSpacing: '0.05em',
                      border: '1px solid #fff',
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
      <div style={{ margin: 'clamp(10px, 2vh, 24px) 0' }}>
        <div style={{ fontSize: 'clamp(9px, 1.2vh, 12px)', letterSpacing: '0.15em', textTransform: 'uppercase', color: isDark ? '#A3A3A3' : '#525252', marginBottom: 'clamp(4px, 0.8vh, 8px)', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
          {isLive ? 'Active Subject' : 'Next Scheduled'}
        </div>
        <div style={{ 
          fontSize: 'clamp(20px, 4.2vh, 44px)', 
          fontWeight: 'bold', 
          lineHeight: 1.15, 
          color: isDark ? '#ffffff' : '#111111', 
          letterSpacing: '-0.02em',
          fontFamily: "var(--font-serif)"
        }}>
          {slot.subject_name}
        </div>
        <div style={{ fontSize: 'clamp(12px, 1.8vh, 18px)', fontWeight: 'bold', color: isDark ? '#cbd5e1' : '#334155', marginTop: 'clamp(4px, 1vh, 10px)', letterSpacing: '0.02em', fontFamily: 'var(--font-body)', fontStyle: 'italic' }}>
          {slot.subject_code} · <span style={{ color: 'var(--np-red)', fontWeight: 'bold', fontStyle: 'normal' }}>{slot.branch}</span> · {slot.year} Year
        </div>
      </div>

      {/* Countdown Timers */}
      <div>
        <div style={{ fontSize: 'clamp(9px, 1.2vh, 12px)', letterSpacing: '0.15em', textTransform: 'uppercase', color: isDark ? '#A3A3A3' : '#525252', marginBottom: 'clamp(6px, 1vh, 14px)', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
          {isLive ? 'Time Remaining' : 'Countdown'}
        </div>
        
        <div style={{ display: 'flex', gap: 'clamp(8px, 1.5vw, 16px)', alignItems: 'center' }}>
          {[
            { v: pad(cd.hh), l: 'HRS' }, 
            { v: pad(cd.mm), l: 'MIN' }, 
            { v: pad(cd.ss), l: 'SEC' }
          ].map(({ v, l }) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: 'clamp(32px, 7vh, 72px)', 
                fontWeight: 'bold', 
                lineHeight: 1.1, 
                fontVariantNumeric: 'tabular-nums',
                color: timerColor,
                letterSpacing: '-0.03em',
                background: isDark ? '#262626' : '#E5E5E0',
                border: `2px solid ${cardBorderColor}`,
                padding: 'clamp(6px, 1.2vh, 12px) clamp(10px, 1.8vw, 20px)',
                boxShadow: isDark ? '4px 4px 0 0 #525252' : '4px 4px 0 0 #888888',
                fontFamily: "var(--font-mono)"
              }}>
                {v}
              </div>
              <div style={{ fontSize: '9px', letterSpacing: '0.15em', fontWeight: 'bold', color: isDark ? '#A3A3A3' : '#525252', marginTop: 'clamp(4px, 0.8vh, 8px)', fontFamily: 'var(--font-mono)' }}>
                {l}
              </div>
            </div>
          ))}
        </div>
        
        {/* Under 30 minutes alert */}
        {isLive && isCritical && (
          <div style={{ 
            marginTop: 16, 
            color: 'var(--np-red)', 
            fontSize: '14px', 
            letterSpacing: '0.05em', 
            textTransform: 'uppercase', 
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            animation: 'pulse 1.5s infinite',
            fontFamily: 'var(--font-mono)'
          }}>
            <AlertTriangle size={16} />
            <span>Under 30 Minutes Remaining</span>
          </div>
        )}
      </div>

      {/* Metadata Row */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(4, 1fr)', 
        gap: 12,
        borderTop: `2px solid ${cardBorderColor}`, 
        paddingTop: 'clamp(12px, 2vh, 24px)' 
      }}>
        {[
          { label: 'Start Time', value: formatTime(slot.start_time) },
          { label: 'Duration', value: `${slot.duration_mins}m` },
          { label: 'Exam Mode', value: slot.exam_mode?.toUpperCase() },
          { label: 'Exam Type', value: slot.exam_type?.toUpperCase() },
        ].map(({ label, value }) => (
          <div key={label}>
            <div style={{ fontSize: '9px', letterSpacing: '0.05em', textTransform: 'uppercase', color: isDark ? '#A3A3A3' : '#525252', marginBottom: 4, fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
              {label}
            </div>
            <div style={{ fontSize: 'clamp(11px, 1.8vh, 16px)', fontWeight: 'bold', color: isDark ? '#ffffff' : '#111111', fontFamily: 'var(--font-mono)' }}>
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

  useEffect(() => {
    const syncTime = async () => {
      try {
        const t0 = Date.now();
        const { data } = await api.get('/public/server-time');
        const t1 = Date.now();
        const latency = (t1 - t0) / 2;
        const serverMs = new Date(data.serverTime).getTime();
        serverTimeSkew = (serverMs + latency) - t1;
        console.log(`Time synchronized. Skew: ${serverTimeSkew}ms`);
      } catch (err) {
        console.warn('Failed to synchronize time with server:', err);
      }
    };
    syncTime();
    const interval = setInterval(syncTime, 300000);
    return () => clearInterval(interval);
  }, []);


  // Core Data State
  const [slots, setSlots] = useState([]);
  const [cycle, setCycle] = useState(null);
  const [broadcasts, setBroadcasts] = useState([]);
  const [broadcastIdx, setBroadcastIdx] = useState(0);
  const [isOffline, setIsOffline] = useState(false);

  // Fullscreen State
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const triggerAutoFullscreen = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {
          console.log("Automatic fullscreen blocked by browser policies, waiting for interaction.");
        });
      }
    };
    // Try immediately on load
    triggerAutoFullscreen();
    
    // Fallback: trigger on the very first mouse/tap click anywhere on screen
    const handleInteraction = () => {
      triggerAutoFullscreen();
      document.removeEventListener('click', handleInteraction);
    };
    document.addEventListener('click', handleInteraction);
    return () => document.removeEventListener('click', handleInteraction);
  }, []);

  // Layout Theme & Carousel
  const [theme, setTheme] = useState(() => localStorage.getItem('kiosk_theme') || 'dark');
  const [currentCarouselPage, setCurrentCarouselPage] = useState(0);
  const [selectedAllocation, setSelectedAllocation] = useState(null); // { room_allocation_id, room_no, block }
  const [chimesEnabled, setChimesEnabled] = useState(true);

  // Seating overlay data
  const [seatingData, setSeatingData] = useState(null);
  const [loadingSeating, setLoadingSeating] = useState(false);

  const [currentRoom, setCurrentRoom] = useState(null);
  const [activeAlert, setActiveAlert] = useState(null);
  const socketRef = useRef(null);

  // WebSocket Connection State
  const [socketConnected, setSocketConnected] = useState(false);

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

      // Extract classroom info
      const allRooms = (data.slots || []).flatMap(s => s.rooms || []);
      const matchedRoom = allRooms.find(r => String(r.classroom_id) === String(classroomId));
      if (matchedRoom) {
        setCurrentRoom(matchedRoom);
      }

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
    }, 30000);
    return () => clearInterval(id);
  }, [loadData]);

  useEffect(() => {
    const socketUrl = window.location.origin.includes('5173')
      ? 'http://localhost:5000'
      : window.location.origin;

    console.log(`Connecting to WebSocket server at: ${socketUrl}`);
    const socket = io(socketUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('📡 WebSocket connected successfully');
      setSocketConnected(true);
      if (classroomId) {
        socket.emit('register_kiosk', {
          classroomId,
          roomNo: currentRoom?.room_no || `Room ${classroomId}`
        });
      }
    });

    socket.on('disconnect', () => {
      console.warn('🔌 WebSocket disconnected');
      setSocketConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('⚠️ WebSocket connection error:', err);
      setSocketConnected(false);
    });

    // Listen for events
    socket.on('EMERGENCY_BROADCAST', (broadcast) => {
      console.log('📣 EMERGENCY_BROADCAST received:', broadcast);
      
      const isTargeted = classroomId && String(broadcast.classroom_id) === String(classroomId);
      const isGlobalUrgent = !broadcast.classroom_id && (broadcast.priority === 'urgent' || broadcast.priority === 'critical');
      
      if (isTargeted || isGlobalUrgent) {
        setActiveAlert(broadcast);
        playChime('alert');
      }

      loadData();
    });

    socket.on('SCHEDULE_REGENERATED', (data) => {
      console.log('📣 SCHEDULE_REGENERATED received:', data);
      if (data.cycleId === cycleId) {
        loadData();
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [cycleId, classroomId, currentRoom, loadData]);

  // Sync kiosk registration when room info resolves
  useEffect(() => {
    if (socketConnected && socketRef.current && classroomId) {
      socketRef.current.emit('register_kiosk', {
        classroomId,
        roomNo: currentRoom?.room_no || `Room ${classroomId}`
      });
    }
  }, [socketConnected, currentRoom, classroomId]);

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
    api.get(`/public/seating/${selectedAllocation.room_allocation_id}`)
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
    const referenceNow = getSyncDate();
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
    bg: isDark ? '#111111' : '#F9F9F7',
    text: isDark ? '#F9F9F7' : '#111111',
    textMuted: isDark ? '#A3A3A3' : '#525252',
    textDim: isDark ? '#737373' : '#737373',
    cardBg: isDark ? '#111111' : '#F9F9F7',
    cardBorder: isDark ? '#ffffff' : '#111111',
    border: isDark ? '#333333' : '#111111',
    glassBg: isDark ? '#111111' : '#F9F9F7',
    shadow: isDark ? '8px 8px 0 0 #ffffff' : '8px 8px 0 0 #111111',
    modalOverlayBg: isDark ? 'rgba(17, 17, 17, 0.8)' : 'rgba(17, 17, 17, 0.6)',
    modalContentBg: isDark ? '#111111' : '#F9F9F7',
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
      background: colors.bg,
      backgroundImage: isDark
        ? "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4' viewBox='0 0 4 4'%3E%3Cpath fill='%23ffffff' fill-opacity='0.04' d='M1 3h1v1H1V3zm2-2h1v1H3V1z'%3E%3C/path%3E%3C/svg%3E\")"
        : "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4' viewBox='0 0 4 4'%3E%3Cpath fill='%23111111' fill-opacity='0.04' d='M1 3h1v1H1V3zm2-2h1v1H3V1z'%3E%3C/path%3E%3C/svg%3E\")",
      color: colors.text,
      fontFamily: "var(--font-sans)",
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
      transition: 'background 0.3s ease, color 0.3s ease',
    }}>
      {/* Dynamic Font Import */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Lora:ital,wght@0,400;0,700;1,400&family=JetBrains+Mono:wght@400;750&display=swap" rel="stylesheet" />

      {/* Top Header Row */}
      <div style={{
        position: 'relative',
        zIndex: 5,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px 48px',
        borderBottom: `4px solid ${colors.border}`,
        background: colors.glassBg,
        height: '96px',
        boxSizing: 'border-box',
      }}>
        {/* Logo and details */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ width: 8, height: 42, background: 'var(--np-red)' }} />
          <div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', letterSpacing: '-0.02em', fontFamily: 'var(--font-serif)', textTransform: 'uppercase', color: colors.text }}>
              MIT World Peace University
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
              <span style={{ fontSize: '11px', color: colors.textMuted, letterSpacing: '0.08em', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
                EXAMINATION CELL · {cycle?.name || 'EXAM CYCLE'}
              </span>
              
              {/* Online/Offline network state */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 8px',
                background: isOffline ? 'rgba(204, 0, 0, 0.1)' : 'rgba(22, 101, 52, 0.1)',
                border: `1.5px solid ${isOffline ? 'var(--np-red)' : '#166534'}`,
                color: isOffline ? 'var(--np-red)' : '#166534',
                fontSize: '10px',
                fontWeight: 'bold',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
              }}>
                {isOffline ? (
                  <>
                    <WifiOff size={10} />
                    <span>Offline</span>
                  </>
                ) : (
                  <>
                    <Wifi size={10} />
                    <span>Live</span>
                  </>
                )}
              </div>

              {/* Socket.io connection state */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 8px',
                background: socketConnected ? 'rgba(22, 101, 52, 0.1)' : 'rgba(204, 0, 0, 0.1)',
                border: `1.5px solid ${socketConnected ? '#166534' : 'var(--np-red)'}`,
                color: socketConnected ? '#166534' : 'var(--np-red)',
                fontSize: '10px',
                fontWeight: 'bold',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
              }}>
                <div style={{
                  width: 6, height: 6,
                  borderRadius: '50%',
                  background: socketConnected ? '#166534' : 'var(--np-red)',
                }} />
                <span>{socketConnected ? 'Connected' : 'Disconnected'}</span>
              </div>

              {isOffline && (
                <button
                  onClick={loadData}
                  style={{
                    padding: '2px 6px',
                    background: colors.cardBg,
                    border: `1.5px solid ${colors.cardBorder}`,
                    color: colors.text,
                    fontSize: '10px',
                    fontWeight: 'bold',
                    fontFamily: 'var(--font-mono)',
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

          {/* Sound toggle button */}
          <button 
            onClick={() => {
              const nextVal = !chimesEnabled;
              setChimesEnabled(nextVal);
              if (nextVal) {
                // Unlock Web Audio API context
                try {
                  const AudioContext = window.AudioContext || window.webkitAudioContext;
                  const ctx = new AudioContext();
                  const osc = ctx.createOscillator();
                  const gain = ctx.createGain();
                  gain.gain.setValueAtTime(0, ctx.currentTime);
                  osc.connect(gain);
                  gain.connect(ctx.destination);
                  osc.start(0);
                  osc.stop(0.01);
                } catch (e) {}
              }
            }}
            style={{
              background: chimesEnabled ? 'var(--np-red)' : colors.cardBg,
              border: `2px solid ${colors.cardBorder}`,
              cursor: 'pointer',
              color: chimesEnabled ? '#ffffff' : colors.text,
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              boxShadow: colors.shadow,
              transition: 'transform 0.1s',
            }}
            title={chimesEnabled ? "Mute Chimes" : "Enable Chimes"}
          >
            {chimesEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>

          {/* Theme switcher toggle */}
          <button 
            onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
            style={{
              background: colors.cardBg,
              border: `2px solid ${colors.cardBorder}`,
              cursor: 'pointer',
              color: colors.text,
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              boxShadow: colors.shadow,
              transition: 'transform 0.1s',
            }}
            title="Toggle Light/Dark Theme"
          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          {/* Refresh button */}
          <button 
            onClick={loadData}
            style={{
              background: colors.cardBg,
              border: `2px solid ${colors.cardBorder}`,
              cursor: 'pointer',
              color: colors.text,
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              boxShadow: colors.shadow,
              transition: 'transform 0.1s',
            }}
            title="Refresh Data"
          >
            <RefreshCw size={20} />
          </button>

          {/* Fullscreen button */}
          <button 
            onClick={toggleFullscreen}
            style={{
              background: colors.cardBg,
              border: `2px solid ${colors.cardBorder}`,
              cursor: 'pointer',
              color: colors.text,
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44,
              height: 44,
              boxShadow: colors.shadow,
              transition: 'transform 0.1s',
            }}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
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
                    chimesEnabled={chimesEnabled}
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
                        border: `2px solid ${colors.cardBorder}`,
                        background: currentPageIndex === idx ? colors.text : 'transparent',
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
              border: `4px solid ${colors.cardBorder}`,
              padding: '48px',
              textAlign: 'center',
              boxShadow: colors.shadow,
            }}>
              <CalendarDays size={72} style={{ color: colors.textMuted, marginBottom: 16 }} />
              <div style={{ fontSize: '28px', fontWeight: 'bold', fontFamily: 'var(--font-serif)', color: colors.text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {done.length > 0 ? "Today's exam sessions completed" : "No active sessions scheduled"}
              </div>
              <div style={{ fontSize: '14px', color: colors.textMuted, marginTop: 8, fontFamily: 'var(--font-body)', fontStyle: 'italic' }}>
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
          border: `4px solid ${colors.border}`,
          padding: '28px',
          boxShadow: colors.shadow,
          minHeight: 0,
          boxSizing: 'border-box',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `2px solid ${colors.border}`, paddingBottom: 10 }}>
            <div style={{ fontSize: '13px', letterSpacing: '0.12em', textTransform: 'uppercase', color: colors.text, fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
              Daily Schedule
            </div>
            <div style={{ fontSize: '11px', color: colors.textMuted, fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
              {slots.length} Total Slot{slots.length !== 1 ? 's' : ''}
            </div>
          </div>
          
          <div style={{ 
            flex: 1, 
            overflowY: 'auto',
            paddingRight: '2px',
          }} className="custom-scrollbar">
            {slots.length === 0 ? (
              <div style={{ color: colors.textMuted, fontStyle: 'italic', fontSize: '14px', padding: '16px 0', fontFamily: 'var(--font-body)' }}>
                No slots found for today.
              </div>
            ) : (
              slots.map(slot => {
                const phase = getPhase(slot, getSyncDate());
                const isActive = active.some(x => x.id === slot.id);
                
                let indicatorColor = '#3b82f6';
                if (phase === 'live') indicatorColor = '#166534';
                if (phase === 'done') indicatorColor = 'rgba(128,128,128,0.4)';

                return (
                  <div 
                    key={slot.id} 
                    style={{
                      display: 'flex', 
                      gap: 14, 
                      padding: '14px 18px', 
                      marginBottom: '10px',
                      background: isActive ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0, 0, 0, 0.03)') : 'transparent',
                      border: `2px solid ${isActive ? colors.cardBorder : 'transparent'}`,
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ width: 4, alignSelf: 'stretch', flexShrink: 0, background: indicatorColor }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '16px', fontWeight: 'bold', color: phase === 'done' ? colors.textMuted : colors.text, fontFamily: 'var(--font-mono)' }}>
                        {slot.subject_code}
                      </div>
                      <div style={{ 
                        fontSize: '13px', 
                        color: phase === 'done' ? colors.textDim : colors.textMuted, 
                        marginTop: 2, 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: 'nowrap',
                        fontWeight: 'bold',
                        fontFamily: 'var(--font-serif)'
                      }}>
                        {slot.subject_name}
                      </div>
                      <div style={{ fontSize: '11px', color: colors.textDim, marginTop: 4, fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
                        {formatTime(slot.start_time)} · {slot.branch} · {slot.year} Yr
                      </div>
                    </div>
                    
                    <div style={{ 
                      fontSize: '10px', 
                      letterSpacing: '0.05em', 
                      textTransform: 'uppercase', 
                      color: indicatorColor, 
                      alignSelf: 'center',
                      fontWeight: 'bold',
                      fontFamily: 'var(--font-mono)',
                      padding: '3px 6px',
                      border: `1.5px solid ${indicatorColor}`,
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
        borderTop: `4px solid ${colors.border}`,
        background: colors.glassBg,
        padding: '12px 48px',
        display: 'flex', 
        alignItems: 'center', 
        gap: 20, 
        height: '64px',
        boxSizing: 'border-box',
      }}>
        <div style={{
          fontSize: '11px', 
          letterSpacing: '0.15em', 
          textTransform: 'uppercase',
          color: broadcasts.length ? 'var(--np-red)' : colors.textMuted,
          fontWeight: 'bold', 
          flexShrink: 0,
          padding: '4px 10px', 
          background: broadcasts.length ? 'rgba(204,0,0,0.1)' : 'transparent',
          border: `2px solid ${broadcasts.length ? 'var(--np-red)' : colors.cardBorder}`,
          fontFamily: 'var(--font-mono)',
        }}>
          {broadcasts.length ? 'NOTICE' : 'INFO'}
        </div>
        
        {/* Fade notice slide */}
        <div 
          key={broadcastIdx}
          style={{ 
            fontSize: '18px', 
            fontWeight: 'bold', 
            color: broadcasts.length ? colors.text : colors.textMuted, 
            flex: 1, 
            overflow: 'hidden', 
            textOverflow: 'ellipsis', 
            whiteSpace: 'nowrap',
            animation: 'slideNotice 0.3s ease-out',
            fontFamily: 'var(--font-body)',
            fontStyle: 'italic',
          }}
        >
          {broadcasts.length
            ? broadcasts[broadcastIdx]?.message
            : 'Welcome to MIT World Peace University Examination Lobby'}
        </div>
        
        <div style={{ fontSize: '11px', color: colors.textDim, flexShrink: 0, letterSpacing: '0.08em', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>
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
          animation: 'fadeIn 0.2s ease-out',
        }}>
          <div style={{
            background: colors.modalContentBg,
            border: `4px solid ${colors.border}`,
            width: '80vw',
            maxHeight: '84vh',
            boxShadow: colors.shadow,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxSizing: 'border-box',
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '20px 32px',
              borderBottom: `4px solid ${colors.border}`,
            }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 'bold', letterSpacing: '0.15em', color: 'var(--np-red)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                  DOOR ARRANGEMENT SLIP
                </span>
                <h2 style={{ fontSize: '28px', fontWeight: 'bold', margin: '2px 0 0 0', color: colors.text, fontFamily: 'var(--font-serif)' }}>
                  Room {selectedAllocation.room_no} {selectedAllocation.block ? `(${selectedAllocation.block})` : ''}
                </h2>
              </div>
              
              <button 
                onClick={() => setSelectedAllocation(null)}
                style={{
                  background: 'transparent',
                  border: `2px solid ${colors.cardBorder}`,
                  color: colors.text,
                  width: 44,
                  height: 44,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                <X size={20} />
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
                    width: 32, height: 32,
                    border: `3px solid ${colors.border}`,
                    borderTop: '3px solid var(--np-red)',
                    animation: 'spin 0.6s linear infinite',
                  }} />
                  <div style={{ fontSize: '14px', color: colors.textMuted, fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>Fetching assignments...</div>
                </div>
              ) : seatingData ? (
                <>
                  {/* Blackboard position */}
                  <div style={{
                    background: isDark ? '#262626' : '#E5E5E0',
                    border: `2px solid ${colors.cardBorder}`,
                    padding: '12px',
                    textAlign: 'center',
                    fontWeight: 'bold',
                    fontSize: '14px',
                    letterSpacing: '0.2em',
                    color: colors.text,
                    textTransform: 'uppercase',
                    fontFamily: 'var(--font-mono)',
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
                        <div style={{ textAlign: 'center', padding: '36px 0', color: colors.textMuted, fontSize: '15px', fontStyle: 'italic', fontFamily: 'var(--font-body)' }}>
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
                              background: seat 
                                ? (isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)') 
                                : 'transparent',
                              border: seat
                                ? `2.5px solid ${colors.cardBorder}`
                                : `1px dashed ${colors.border}`,
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
                              fontSize: '9px', 
                              fontWeight: 'bold', 
                              color: colors.textMuted,
                              fontFamily: 'var(--font-mono)'
                            }}>
                              R{r}-C{c}
                            </span>
                            
                            {seat ? (
                              <>
                                <span style={{ 
                                  fontSize: '22px', 
                                  fontWeight: 'bold', 
                                  color: colors.text, 
                                  letterSpacing: '0.05em',
                                  fontFamily: 'var(--font-mono)'
                                }}>
                                  {seat.prn}
                                </span>
                                <span style={{ 
                                  fontSize: '11px', 
                                  color: colors.textMuted, 
                                  marginTop: 4,
                                  fontWeight: 'bold',
                                  textTransform: 'uppercase',
                                  background: isDark ? '#262626' : '#E5E5E0',
                                  padding: '2px 8px',
                                  border: `1px solid ${colors.cardBorder}`,
                                  fontFamily: 'var(--font-mono)',
                                }}>
                                  {seat.branch} {seat.year}
                                </span>
                              </>
                            ) : (
                              <span style={{ 
                                fontSize: '11px', 
                                color: colors.textDim, 
                                fontStyle: 'italic',
                                fontFamily: 'var(--font-body)'
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

      {/* Target Emergency Alert Overlay */}
      {activeAlert && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0, 0, 0, 0.95)',
          boxSizing: 'border-box',
          padding: '40px',
        }}>
          <div style={{
            background: '#F9F9F7',
            border: '24px solid #CC0000',
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
            padding: '40px',
            animation: 'pulse-border 1.5s infinite alternate',
            color: '#111111',
            textAlign: 'center',
          }}>
            <span style={{ 
              fontSize: '24px', 
              fontWeight: 900, 
              letterSpacing: '0.2em', 
              color: '#CC0000', 
              textTransform: 'uppercase', 
              fontFamily: 'var(--font-mono)',
              marginBottom: 20
            }}>
              🚨 EMERGENCY BROADCAST ALERT 🚨
            </span>

            <h1 style={{ 
              fontSize: '42px', 
              fontWeight: '900', 
              lineHeight: 1.2, 
              color: '#111111', 
              fontFamily: 'var(--font-serif)',
              margin: '20px 0',
              textTransform: 'uppercase'
            }}>
              {activeAlert.title}
            </h1>

            <div style={{ 
              fontSize: '48px', 
              fontWeight: 'bold', 
              lineHeight: 1.3,
              fontFamily: 'var(--font-body)',
              color: '#111111',
              maxWidth: '85%',
              margin: '30px auto',
              wordBreak: 'break-word',
              background: '#E5E5E0',
              padding: '24px 36px',
              border: '4px solid #111111',
              boxShadow: '8px 8px 0 0 #111111',
            }}>
              {activeAlert.message}
            </div>

            <button 
              onClick={async () => {
                if (socketRef.current) {
                  socketRef.current.emit('kiosk_acknowledge', {
                    broadcastId: activeAlert.id,
                    classroomId: classroomId,
                    userId: null
                  });
                }
                try {
                  await api.post(`/broadcasts/${activeAlert.id}/acknowledge`, { classroom_id: classroomId });
                } catch (err) {
                  console.error('REST acknowledge failed:', err);
                }
                setActiveAlert(null);
              }}
              style={{
                background: '#166534',
                color: '#ffffff',
                border: '4px solid #111111',
                padding: '24px 48px',
                fontSize: '28px',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                textTransform: 'uppercase',
                boxShadow: '6px 6px 0 0 #111111',
                marginTop: '30px',
                transition: 'transform 0.1s, box-shadow 0.1s',
              }}
              onMouseDown={e => {
                e.currentTarget.style.transform = 'translate(2px, 2px)';
                e.currentTarget.style.boxShadow = '2px 2px 0 0 #111111';
              }}
              onMouseUp={e => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '6px 6px 0 0 #111111';
              }}
            >
              Confirm Acknowledgment
            </button>
          </div>
        </div>
      )}

      {/* Styles */}
      <style>{`
        @keyframes pulse-border {
          0% { border-color: #CC0000; }
          100% { border-color: #800000; }
        }
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
