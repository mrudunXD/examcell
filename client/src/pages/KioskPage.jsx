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

function getPhase(slot, now) {
  const [h, m] = (slot.start_time || '09:30').split(':').map(Number);
  const start = new Date(now.getTime()); start.setHours(h, m, 0, 0);
  const end = new Date(start.getTime() + (slot.duration_mins || 180) * 60000);
  if (now < start) return 'upcoming';
  if (now >= start && now <= end) return 'live';
  return 'done';
}

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

export default function KioskPage() {
  const { cycleId } = useParams();
  const [searchParams] = useSearchParams();
  const classroomId = searchParams.get('classroomId');

  // Core State
  const [slots, setSlots] = useState([]);
  const [cycle, setCycle] = useState(null);
  const [now, setNow] = useState(new Date());
  const [broadcasts, setBroadcasts] = useState([]);
  const [broadcastIdx, setBroadcastIdx] = useState(0);
  const [isOffline, setIsOffline] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  // UI Theme & Carousel States
  const [theme, setTheme] = useState(() => localStorage.getItem('kiosk_theme') || 'dark');
  const [currentCarouselPage, setCurrentCarouselPage] = useState(0);
  const [selectedAllocation, setSelectedAllocation] = useState(null); // { roomAllocationId, roomNo, block }

  // Seating Map Overlay state
  const [seatingData, setSeatingData] = useState(null);
  const [loadingSeating, setLoadingSeating] = useState(false);

  // Load Kiosk data
  const loadData = useCallback(async () => {
    try {
      const params = {};
      if (classroomId) params.classroomId = classroomId;
      const { data } = await api.get(`/public/kiosk/${cycleId}`, { params });
      
      // Update state and cache successfully
      setCycle(data.cycle);
      setSlots(data.slots || []);
      setBroadcasts((data.broadcasts || []).slice(0, 5));
      setIsOffline(false);
      setLastRefreshed(new Date());

      // Store in localStorage for offline continuity
      localStorage.setItem(
        `kiosk_cache_${cycleId}_${classroomId || ''}`,
        JSON.stringify({ cycle: data.cycle, slots: data.slots, broadcasts: data.broadcasts })
      );
    } catch (err) {
      console.warn("Kiosk connection failed. Reading from local cache if available.", err);
      setIsOffline(true);
      // Retrieve from cache
      const cached = localStorage.getItem(`kiosk_cache_${cycleId}_${classroomId || ''}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        setCycle(parsed.cycle);
        setSlots(parsed.slots || []);
        setBroadcasts((parsed.broadcasts || []).slice(0, 5));
      }
    }
  }, [cycleId, classroomId]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Polling every 3 minutes (180000ms) to sync
  useEffect(() => {
    const id = setInterval(() => {
      loadData();
    }, 180000);
    return () => clearInterval(id);
  }, [loadData]);

  // Local clock ticking every 1 second
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Theme storage sync
  useEffect(() => {
    localStorage.setItem('kiosk_theme', theme);
  }, [theme]);

  // Rotate notice broadcasts every 6s
  useEffect(() => {
    if (!broadcasts.length) return;
    const id = setInterval(() => {
      setBroadcastIdx(i => (i + 1) % broadcasts.length);
    }, 6000);
    return () => clearInterval(id);
  }, [broadcasts]);

  // Fetch seating assignments when selectedRoomAllocationId changes
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
        console.error("Error loading seating map", err);
        setLoadingSeating(false);
      });
  }, [selectedAllocation]);

  // Filter slots for carousel processing
  const liveSlots = slots.filter(s => getPhase(s, now) === 'live');
  const upcomingSlots = slots.filter(s => getPhase(s, now) === 'upcoming');
  const doneSlots = slots.filter(s => getPhase(s, now) === 'done');
  const activeSlots = [...liveSlots, ...upcomingSlots];

  // Group active slots into pages of size up to 2
  const activeSlotsPages = [];
  for (let i = 0; i < activeSlots.length; i += 2) {
    activeSlotsPages.push(activeSlots.slice(i, i + 2));
  }

  // Auto-rotating carousel every 8 seconds for high-load concurrent exams
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

  // Theme styling definitions
  const isDark = theme === 'dark';
  const colors = {
    bg: isDark ? '#030306' : '#f4f6fa',
    text: isDark ? '#f8fafc' : '#0f172a',
    textMuted: isDark ? 'rgba(248, 250, 252, 0.7)' : 'rgba(15, 23, 42, 0.75)',
    textDim: isDark ? 'rgba(248, 250, 252, 0.45)' : 'rgba(15, 23, 42, 0.55)',
    cardBg: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.85)',
    cardBorder: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.08)',
    glassBg: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.45)',
    border: isDark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(15, 23, 42, 0.09)',
    activeBg: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(15, 23, 42, 0.05)',
    shadow: isDark ? '0 10px 40px rgba(0, 0, 0, 0.6)' : '0 10px 40px rgba(0, 0, 0, 0.06)',
    modalOverlayBg: isDark ? 'rgba(3, 3, 6, 0.85)' : 'rgba(244, 246, 250, 0.85)',
    modalContentBg: isDark ? '#0b0c10' : '#ffffff',
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
      color: colors.text,
      fontFamily: "'Outfit', 'Inter', system-ui, sans-serif",
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
      transition: 'background-color 0.5s ease, color 0.5s ease',
    }}>
      {/* Ambient Mesh Gradient Circles */}
      <div className="mesh-gradient-container" style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 0, overflow: 'hidden', pointerEvents: 'none',
      }}>
        <div style={{
          position: 'absolute', width: '70vw', height: '70vw',
          background: isDark ? 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 70%)',
          top: '-15%', left: '-10%',
          borderRadius: '50%',
          animation: 'mesh-float 22s infinite alternate ease-in-out',
        }} />
        <div style={{
          position: 'absolute', width: '80vw', height: '80vw',
          background: isDark ? 'radial-gradient(circle, rgba(20, 184, 166, 0.12) 0%, transparent 75%)' : 'radial-gradient(circle, rgba(20, 184, 166, 0.06) 0%, transparent 75%)',
          bottom: '-25%', right: '-15%',
          borderRadius: '50%',
          animation: 'mesh-float 28s infinite alternate-reverse ease-in-out',
        }} />
        <div style={{
          position: 'absolute', width: '65vw', height: '65vw',
          background: isDark ? 'radial-gradient(circle, rgba(217, 70, 239, 0.1) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(217, 70, 239, 0.05) 0%, transparent 70%)',
          top: '25%', left: '35%',
          borderRadius: '50%',
          animation: 'mesh-float 32s infinite alternate ease-in-out',
        }} />
      </div>

      {/* Top Header Bar */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '24px 64px',
        borderBottom: `1px solid ${colors.border}`,
        background: colors.glassBg,
        backdropFilter: 'blur(20px)',
        height: '110px',
        boxSizing: 'border-box',
      }}>
        {/* Left side: Logo and Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ width: 6, height: 50, background: '#D6001C', borderRadius: 4 }} />
          <div>
            <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: colors.text }}>
              MIT World Peace University
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
              <span style={{ fontSize: '16px', color: colors.textMuted, letterSpacing: '0.08em', fontWeight: 600 }}>
                EXAMINATION CELL · {cycle?.name || 'EXAM CYCLE'}
              </span>
              
              {/* Online/Offline status badge */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: '6px',
                background: isOffline ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                border: `1px solid ${isOffline ? '#ef4444' : '#22c55e'}`,
                color: isOffline ? '#ef4444' : '#22c55e',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}>
                {isOffline ? (
                  <>
                    <WifiOff size={13} />
                    <span>Offline Mode</span>
                  </>
                ) : (
                  <>
                    <Wifi size={13} />
                    <span>Live</span>
                  </>
                )}
              </div>

              {isOffline && (
                <button
                  onClick={loadData}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: colors.cardBg,
                    border: `1px solid ${colors.cardBorder}`,
                    color: colors.text,
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right side: Clock & Mode Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '64px', fontWeight: 200, letterSpacing: '0.02em', lineHeight: 1, fontVariantNumeric: 'tabular-nums', color: colors.text }}>
              {pad(now.getHours())}:{pad(now.getMinutes())}
              <span style={{ fontSize: '32px', color: colors.textDim, marginLeft: 6 }}>{pad(now.getSeconds())}</span>
            </div>
            <div style={{ fontSize: '15px', color: colors.textMuted, letterSpacing: '0.12em', marginTop: 6, fontWeight: 500 }}>
              {DAYS[now.getDay()].toUpperCase()}, {now.getDate()} {MONTHS[now.getMonth()].toUpperCase()} {now.getFullYear()}
            </div>
          </div>

          {/* Theme Toggle Button */}
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
              borderRadius: '12px',
              width: 52,
              height: 52,
              boxShadow: colors.shadow,
              transition: 'transform 0.2s, background-color 0.2s',
            }}
            title="Toggle Dark/Light Mode"
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            {isDark ? <Sun size={24} /> : <Moon size={24} />}
          </button>
        </div>
      </div>

      {/* Main Body Workspace */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        flex: 1,
        display: 'flex',
        padding: '32px 64px 24px 64px',
        gap: '40px',
        overflow: 'hidden',
        minHeight: 0,
        boxSizing: 'border-box',
      }}>
        {/* Left Panel: Carousel of Active Exams */}
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'space-between',
          minHeight: 0,
          boxSizing: 'border-box',
        }}>
          {activeSlots.length > 0 ? (
            <div style={{ 
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              minHeight: 0,
            }}>
              {/* Carousel Page Wrapper */}
              <div 
                key={currentPageIndex} // Triggers fadeIn keyframe on page change
                style={{
                  display: 'grid',
                  gridTemplateColumns: visibleSlots.length === 1 ? '1fr' : '1fr 1fr',
                  gap: '32px',
                  flex: 1,
                  minHeight: 0,
                  animation: 'fadeIn 0.5s ease-in-out',
                }}
              >
                {visibleSlots.map(slot => {
                  const cd = getCountdown(slot, now);
                  const isLive = cd.phase === 'live';
                  
                  return (
                    <div 
                      key={slot.id} 
                      style={{ 
                        background: colors.cardBg, 
                        border: `1.5px solid ${colors.cardBorder}`,
                        borderRadius: '24px',
                        padding: '40px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '24px',
                        boxShadow: colors.shadow,
                        backdropFilter: 'blur(20px)',
                        boxSizing: 'border-box',
                        minHeight: 0,
                      }}
                    >
                      {/* Top Row: Status Indicator & Room Badges */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                          {/* Live/Upcoming Alert Pill */}
                          <div style={{
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 10,
                            padding: '10px 24px',
                            borderRadius: '30px',
                            background: isLive ? 'rgba(34, 197, 94, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                            border: `1.5px solid ${isLive ? '#22c55e' : '#3b82f6'}`,
                          }}>
                            <div style={{
                              width: 12, height: 12, borderRadius: '50%',
                              background: isLive ? '#22c55e' : '#3b82f6',
                              animation: isLive ? 'pulse 1.8s infinite' : 'none',
                            }} />
                            <span style={{ 
                              fontSize: '16px', 
                              letterSpacing: '0.12em', 
                              textTransform: 'uppercase', 
                              fontWeight: 800,
                              color: isLive ? '#22c55e' : '#3b82f6' 
                            }}>
                              {isLive ? 'Exam In Progress' : 'Starting Soon'}
                            </span>
                          </div>

                          {/* Time & Duration Brief */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: colors.textMuted, fontSize: '18px', fontWeight: 600 }}>
                            <Clock size={18} />
                            <span>{slot.start_time} ({slot.duration_mins}m)</span>
                          </div>
                        </div>

                        {/* Interactive Room Badges */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                          {slot.rooms && slot.rooms.map(room => {
                            const isCurrentKioskRoom = String(room.classroom_id) === String(classroomId);
                            
                            return (
                              <button
                                key={room.room_allocation_id}
                                onClick={() => setSelectedAllocation({ 
                                  roomAllocationId: room.room_allocation_id, 
                                  roomNo: room.room_no,
                                  block: room.block 
                                })}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 10,
                                  padding: '12px 24px',
                                  borderRadius: '12px',
                                  background: isCurrentKioskRoom 
                                    ? '#eab308' // stand out highlight for the current room
                                    : (isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.05)'),
                                  border: isCurrentKioskRoom
                                    ? '2px solid #ca8a04'
                                    : `1px solid ${colors.cardBorder}`,
                                  color: isCurrentKioskRoom ? '#000000' : colors.text,
                                  fontSize: '24px',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  boxShadow: isCurrentKioskRoom ? '0 4px 20px rgba(234, 179, 8, 0.4)' : 'none',
                                  transition: 'transform 0.2s, background-color 0.2s',
                                }}
                                title="Click to view seating plan"
                                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                              >
                                <Grid3x3 size={24} />
                                <span>Room {room.room_no}</span>
                                {room.block && (
                                  <span style={{ fontSize: '16px', opacity: 0.8, fontWeight: 500 }}>
                                    ({room.block})
                                  </span>
                                )}
                                {isCurrentKioskRoom && (
                                  <span style={{
                                    fontSize: '12px',
                                    fontWeight: 900,
                                    padding: '3px 8px',
                                    background: '#000',
                                    color: '#FFF',
                                    borderRadius: '6px',
                                    marginLeft: 6
                                  }}>
                                    THIS ROOM
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Subject Information (Really big and legible) */}
                      <div>
                        <div style={{ fontSize: '16px', letterSpacing: '0.2em', textTransform: 'uppercase', color: colors.textDim, marginBottom: 8, fontWeight: 700 }}>
                          {isLive ? 'Currently Conducting' : 'Upcoming Exam'}
                        </div>
                        <div style={{ 
                          fontSize: visibleSlots.length === 1 ? '56px' : '40px', 
                          fontWeight: 900, 
                          lineHeight: 1.15, 
                          color: colors.text, 
                          letterSpacing: '-0.03em',
                        }}>
                          {slot.subject_name}
                        </div>
                        <div style={{ fontSize: '24px', fontWeight: 600, color: colors.textMuted, marginTop: 10, letterSpacing: '0.02em' }}>
                          {slot.subject_code} · <span style={{ color: '#D6001C', fontWeight: 800 }}>{slot.branch}</span> · {slot.year} Year
                        </div>
                      </div>

                      {/* Countdown Clock (Massive font for readability from 15ft) */}
                      <div>
                        <div style={{ fontSize: '15px', letterSpacing: '0.2em', textTransform: 'uppercase', color: colors.textDim, marginBottom: 12, fontWeight: 700 }}>
                          {isLive ? 'Time Remaining' : 'Begins In'}
                        </div>
                        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end' }}>
                          {[
                            { v: pad(cd.hh), l: 'HOURS' }, 
                            { v: pad(cd.mm), l: 'MINUTES' }, 
                            { v: pad(cd.ss), l: 'SECONDS' }
                          ].map(({ v, l }) => (
                            <div key={l} style={{ textAlign: 'center' }}>
                              <div style={{
                                fontSize: visibleSlots.length === 1 ? '110px' : '82px', 
                                fontWeight: 200, 
                                lineHeight: 0.95, 
                                fontVariantNumeric: 'tabular-nums',
                                color: isLive ? (cd.diff < 1800 ? '#ef4444' : '#22c55e') : '#3b82f6',
                                letterSpacing: '-0.04em',
                                background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                                border: `1px solid ${colors.cardBorder}`,
                                padding: '16px 24px',
                                borderRadius: '16px',
                              }}>
                                {v}
                              </div>
                              <div style={{ fontSize: '13px', letterSpacing: '0.15em', fontWeight: 700, color: colors.textDim, marginTop: 8 }}>
                                {l}
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {/* Urgent Alert banner inside card */}
                        {isLive && cd.diff < 1800 && (
                          <div style={{ 
                            marginTop: 18, 
                            color: '#ef4444', 
                            fontSize: '18px', 
                            letterSpacing: '0.05em', 
                            textTransform: 'uppercase', 
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            animation: 'pulse 1.5s infinite',
                          }}>
                            <AlertTriangle size={20} />
                            <span>Warning: Less than 30 minutes remaining</span>
                          </div>
                        )}
                      </div>

                      {/* Detail Footer Grid */}
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(4, 1fr)', 
                        gap: 20,
                        borderTop: `1px solid ${colors.border}`, 
                        paddingTop: 24 
                      }}>
                        {[
                          { label: 'Start Time', value: slot.start_time },
                          { label: 'Duration', value: `${slot.duration_mins} min` },
                          { label: 'Exam Mode', value: slot.exam_mode?.toUpperCase() },
                          { label: 'Exam Type', value: slot.exam_type?.toUpperCase() },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <div style={{ fontSize: '13px', letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.textDim, marginBottom: 4, fontWeight: 700 }}>
                              {label}
                            </div>
                            <div style={{ fontSize: '20px', fontWeight: 800, color: colors.text }}>
                              {value}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Carousel Pagination Dots */}
              {activeSlotsPages.length > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: '24px' }}>
                  {activeSlotsPages.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentCarouselPage(idx)}
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        border: 'none',
                        background: currentPageIndex === idx ? (isDark ? '#FFF' : '#000') : 'rgba(128,128,128,0.4)',
                        cursor: 'pointer',
                        transform: currentPageIndex === idx ? 'scale(1.25)' : 'scale(1)',
                        transition: 'all 0.3s ease',
                      }}
                      title={`Go to page ${idx + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Empty Active Slots State */
            <div style={{ 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column', 
              justifyContent: 'center', 
              alignItems: 'center',
              background: colors.cardBg,
              border: `1.5px solid ${colors.cardBorder}`,
              borderRadius: '24px',
              padding: '64px',
              textAlign: 'center',
              backdropFilter: 'blur(20px)',
              boxShadow: colors.shadow,
            }}>
              <CalendarDays size={84} style={{ color: colors.textDim, marginBottom: 24 }} />
              <div style={{ fontSize: '32px', fontWeight: 800, color: colors.text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {doneSlots.length > 0 ? 'All exams for today completed' : 'No active exams scheduled today'}
              </div>
              <div style={{ fontSize: '18px', color: colors.textMuted, marginTop: 12 }}>
                Please review the full schedule sidebar or consult the exam coordinators.
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: Side schedule board */}
        <div style={{ 
          width: '460px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 20,
          background: colors.cardBg, 
          border: `1.5px solid ${colors.cardBorder}`,
          borderRadius: '24px',
          padding: '32px',
          boxShadow: colors.shadow,
          backdropFilter: 'blur(20px)',
          minHeight: 0,
          boxSizing: 'border-box',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '18px', letterSpacing: '0.15em', textTransform: 'uppercase', color: colors.textMuted, fontWeight: 800 }}>
              Today's Schedule
            </div>
            <div style={{ fontSize: '14px', color: colors.textDim, fontWeight: 600 }}>
              {slots.length} Exam{slots.length !== 1 ? 's' : ''}
            </div>
          </div>
          
          <div style={{ 
            flex: 1, 
            overflowY: 'auto',
            paddingRight: '4px',
          }} className="custom-scrollbar">
            {slots.length === 0 ? (
              <div style={{ color: colors.textDim, fontStyle: 'italic', fontSize: '18px', padding: '24px 0' }}>
                No slots allocated for today.
              </div>
            ) : (
              slots.map(slot => {
                const phase = getPhase(slot, now);
                const isActive = activeSlots.some(x => x.id === slot.id);
                
                let phaseColor = '#3b82f6';
                if (phase === 'live') phaseColor = '#22c55e';
                if (phase === 'done') phaseColor = 'rgba(128,128,128,0.5)';

                return (
                  <div 
                    key={slot.id} 
                    style={{
                      display: 'flex', 
                      gap: 16, 
                      padding: '16px 20px', 
                      marginBottom: '12px',
                      background: isActive ? colors.activeBg : 'transparent',
                      border: `1px solid ${isActive ? colors.textMuted : 'transparent'}`,
                      borderRadius: '12px',
                      transition: 'all 0.3s',
                    }}
                  >
                    <div style={{ width: 5, alignSelf: 'stretch', flexShrink: 0, background: phaseColor, borderRadius: '4px' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: phase === 'done' ? colors.textDim : colors.text }}>
                        {slot.subject_code}
                      </div>
                      <div style={{ 
                        fontSize: '15px', 
                        color: phase === 'done' ? colors.textDim : colors.textMuted, 
                        marginTop: 4, 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: 'nowrap',
                        fontWeight: 500,
                      }}>
                        {slot.subject_name}
                      </div>
                      <div style={{ fontSize: '13px', color: colors.textDim, marginTop: 4, fontWeight: 600 }}>
                        {slot.start_time} · {slot.branch} · {slot.year} Year
                      </div>
                    </div>
                    
                    <div style={{ 
                      fontSize: '12px', 
                      letterSpacing: '0.08em', 
                      textTransform: 'uppercase', 
                      color: phaseColor, 
                      alignSelf: 'center',
                      fontWeight: 800,
                      padding: '4px 8px',
                      borderRadius: '6px',
                      background: phase === 'live' ? 'rgba(34,197,94,0.1)' : 'transparent',
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

      {/* Bottom Ticker: Alert notice banner */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        borderTop: `1px solid ${colors.border}`,
        background: colors.glassBg,
        backdropFilter: 'blur(20px)',
        padding: '16px 64px',
        display: 'flex', 
        alignItems: 'center', 
        gap: 24, 
        height: '75px',
        boxSizing: 'border-box',
      }}>
        <div style={{
          fontSize: '15px', 
          letterSpacing: '0.2em', 
          textTransform: 'uppercase',
          color: broadcasts.length ? '#ef4444' : colors.textDim,
          fontWeight: 900, 
          flexShrink: 0,
          padding: '6px 16px', 
          background: broadcasts.length ? 'rgba(239, 68, 68, 0.12)' : 'transparent',
          border: `1.5px solid ${broadcasts.length ? '#ef4444' : colors.cardBorder}`,
          borderRadius: '6px',
        }}>
          {broadcasts.length ? 'CRITICAL NOTICE' : 'INFO'}
        </div>
        
        {/* Animated slide notice */}
        <div 
          key={broadcastIdx}
          style={{ 
            fontSize: '22px', 
            fontWeight: 700, 
            color: broadcasts.length ? colors.text : colors.textMuted, 
            flex: 1, 
            overflow: 'hidden', 
            textOverflow: 'ellipsis', 
            whiteSpace: 'nowrap',
            animation: 'slideNotice 0.4s ease-out',
            letterSpacing: '0.01em',
          }}
        >
          {broadcasts.length
            ? broadcasts[broadcastIdx]?.message
            : 'All candidates must strictly report 30 minutes before the session starts. Carrying digital devices, smartphones or smartwatches inside the exam rooms is a punishable offense.'}
        </div>
        
        <div style={{ fontSize: '15px', color: colors.textDim, flexShrink: 0, letterSpacing: '0.05em', fontWeight: 700 }}>
          MIT-WPU CAMPUS
        </div>
      </div>

      {/* Quick-View Seating Map Overlay (PRN only modal) */}
      {selectedAllocation && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: colors.modalOverlayBg,
          backdropFilter: 'blur(12px)',
          animation: 'fadeIn 0.3s ease-out',
        }}>
          <div style={{
            background: colors.modalContentBg,
            border: `1.5px solid ${colors.cardBorder}`,
            borderRadius: '24px',
            width: '85vw',
            maxHeight: '88vh',
            boxShadow: '0 25px 60px rgba(0,0,0,0.8)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxSizing: 'border-box',
            animation: 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '24px 40px',
              borderBottom: `1px solid ${colors.border}`,
            }}>
              <div>
                <span style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '0.2em', color: '#D6001C', textTransform: 'uppercase' }}>
                  DOOR NOTIFICATION PLAN
                </span>
                <h2 style={{ fontSize: '36px', fontWeight: 900, margin: '4px 0 0 0', color: colors.text }}>
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
                  width: 52,
                  height: 52,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <X size={28} />
              </button>
            </div>

            {/* Modal Body Container */}
            <div style={{ 
              padding: '32px 40px', 
              overflowY: 'auto', 
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
            }} className="custom-scrollbar">
              
              {loadingSeating ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', gap: 16 }}>
                  <div className="spinner" style={{
                    width: 48, height: 48,
                    border: `4px solid ${colors.border}`,
                    borderTop: '4px solid #D6001C',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }} />
                  <div style={{ fontSize: '18px', color: colors.textMuted, fontWeight: 600 }}>Loading seating assignments...</div>
                </div>
              ) : seatingData ? (
                <>
                  {/* Orientation Indicator (Front of Room/Blackboard) */}
                  <div style={{
                    background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.03)',
                    border: `2px dashed ${colors.cardBorder}`,
                    borderRadius: '12px',
                    padding: '16px',
                    textAlign: 'center',
                    fontWeight: 800,
                    fontSize: '18px',
                    letterSpacing: '0.25em',
                    color: colors.textMuted,
                    textTransform: 'uppercase',
                  }}>
                    ▲ ▲ ▲ FRONT OF THE CLASSROOM / BLACKBOARD ▲ ▲ ▲
                  </div>

                  {/* Seat Grid */}
                  {(() => {
                    const { classroom, assignments } = seatingData;
                    const rows = classroom?.bench_rows || 6;
                    const cols = classroom?.bench_cols || 4;

                    // Map assignments by row-col index
                    const gridMap = {};
                    assignments.forEach(a => {
                      gridMap[`${a.bench_row}-${a.bench_col}`] = a;
                    });

                    // Build array of grid elements
                    const seats = [];
                    for (let r = 1; r <= rows; r++) {
                      for (let c = 1; c <= cols; c++) {
                        const seat = gridMap[`${r}-${c}`];
                        seats.push({ r, c, seat });
                      }
                    }

                    if (assignments.length === 0) {
                      return (
                        <div style={{ textAlign: 'center', padding: '48px 0', color: colors.textDim, fontSize: '18px' }}>
                          No students are seated in this room for today's slots.
                        </div>
                      );
                    }

                    return (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(${cols}, 1fr)`,
                        gap: '16px',
                        padding: '8px',
                      }}>
                        {seats.map(({ r, c, seat }) => (
                          <div 
                            key={`${r}-${c}`} 
                            style={{
                              position: 'relative',
                              padding: '24px 16px',
                              borderRadius: '14px',
                              background: seat 
                                ? (isDark ? 'rgba(99, 102, 241, 0.12)' : 'rgba(79, 70, 229, 0.06)') 
                                : (isDark ? 'rgba(255, 255, 255, 0.01)' : 'rgba(0, 0, 0, 0.015)'),
                              border: seat
                                ? `2px solid ${isDark ? '#6366f1' : '#4f46e5'}`
                                : `1px solid ${colors.cardBorder}`,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minHeight: '110px',
                              boxSizing: 'border-box',
                            }}
                          >
                            {/* Seat Row-Col Tag */}
                            <span style={{ 
                              position: 'absolute', 
                              top: 8, 
                              left: 10, 
                              fontSize: '11px', 
                              fontWeight: 700, 
                              color: colors.textDim,
                              letterSpacing: '0.05em'
                            }}>
                              Row {r} - Col {c}
                            </span>
                            
                            {seat ? (
                              <>
                                {/* PRN Text - bold and large */}
                                <span style={{ 
                                  fontSize: '28px', 
                                  fontWeight: 900, 
                                  color: colors.text, 
                                  letterSpacing: '0.08em',
                                }}>
                                  {seat.prn}
                                </span>
                                {/* Branch & Year tag */}
                                <span style={{ 
                                  fontSize: '14px', 
                                  color: colors.textMuted, 
                                  marginTop: 6,
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                }}>
                                  {seat.branch} {seat.year}
                                </span>
                              </>
                            ) : (
                              <span style={{ 
                                fontSize: '15px', 
                                color: colors.textDim, 
                                fontStyle: 'italic',
                                fontWeight: 500
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
                <div style={{ textAlign: 'center', padding: '48px 0', color: colors.textDim, fontSize: '18px' }}>
                  Unable to load seating arrangement.
                </div>
              )}
            </div>
            
            {/* Modal Footer Notice */}
            <div style={{
              padding: '20px 40px',
              borderTop: `1px solid ${colors.border}`,
              background: isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: '14px', color: colors.textDim, fontWeight: 700 }}>
                MIT WPU Examination Cell · Door Seating notice
              </span>
              <span style={{ fontSize: '13px', color: colors.textDim }}>
                Press ESC or click close to return to Kiosk board.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Global CSS Style declarations */}
      <style>{`
        @keyframes pulse { 
          0%, 100% { opacity: 1; transform: scale(1); } 
          50% { opacity: 0.4; transform: scale(1.02); } 
        }
        @keyframes spin { 
          from { transform: rotate(0deg); } 
          to { transform: rotate(360deg); } 
        }
        @keyframes mesh-float {
          0% { transform: translate(0px, 0px) rotate(0deg) scale(1); }
          50% { transform: translate(4vw, -4vh) rotate(180deg) scale(1.08); }
          100% { transform: translate(-3vw, 5vh) rotate(360deg) scale(0.95); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes slideNotice {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'};
        }
      `}</style>
    </div>
  );
}
