import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Eye, EyeOff, Shield, BookOpen, Users, FileDown, Mail, Lock, Sun, Moon } from 'lucide-react';
import { useAuthStore, useAppStore } from '../store/index.js';
import api from '../lib/api.js';
import toast from 'react-hot-toast';
import LineWaves from '../components/ReactBits/LineWaves.jsx';

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const d = new Date();
const today = `${weekdays[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

const features = [
  { icon: BookOpen, text: 'Seating arrangement generation' },
  { icon: Users,    text: 'Branch-interleaved bench allocation' },
  { icon: Shield,   text: 'Conflict detection & resolution' },
  { icon: FileDown, text: 'PDF export: seating, duty, timetable' },
];

export default function LoginPage() {
  const { login, isLoading } = useAuthStore();
  const { theme, toggleTheme } = useAppStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [activeTab, setActiveTab] = useState('operator'); // 'operator' or 'kiosk'

  const [cycles, setCycles] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [kioskCycle, setKioskCycle] = useState('');
  const [kioskRoom, setKioskRoom] = useState('');

  useEffect(() => {
    api.get('/public/kiosk-init')
      .then(res => {
        setCycles(res.data.cycles || []);
        setClassrooms(res.data.classrooms || []);
        if (res.data.cycles?.length > 0) {
          setKioskCycle(res.data.cycles[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const handleLaunchKiosk = () => {
    if (!kioskCycle) return;
    const url = `/kiosk/${kioskCycle}${kioskRoom ? `?classroomId=${kioskRoom}` : ''}`;
    window.open(url, '_blank');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(email, password);
    if (result.success) { toast.success('Signed in successfully'); navigate('/'); }
    else toast.error(result.error);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#191916',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-sans)',
      padding: 0,
      overflow: 'hidden',
    }}>
      {/* Background line waves animation */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, opacity: 0.15 }}>
        <LineWaves
          speed={0.3}
          innerLineCount={36}
          outerLineCount={40}
          warpIntensity={1.0}
          rotation={-45}
          edgeFadeWidth={0.0}
          colorCycleSpeed={0.5}
          brightness={0.2}
          color1="#a7c98c"
          color2="#3b82f6"
          color3="#8b5cf6"
          enableMouseInteraction={true}
          mouseInfluence={2.0}
        />
      </div>

      <div style={{
        width: '100vw',
        height: '100vh',
        maxWidth: 'none',
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr',
        gap: 0,
        background: 'transparent',
        border: 'none',
        borderRadius: 0,
        overflow: 'hidden',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Left panel — Cover art branding */}
        <div style={{
          padding: '64px',
          background: 'linear-gradient(135deg, rgba(27, 61, 43, 0.5) 0%, rgba(12, 26, 18, 0.95) 70%, rgba(5, 11, 8, 1) 100%), radial-gradient(circle at 30% 20%, rgba(167, 201, 140, 0.08), transparent 50%)',
          borderRight: '1px solid rgba(255, 255, 255, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: '100vh',
          overflowY: 'auto',
          position: 'relative',
        }}>
          {/* Top Logo */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'rgba(167, 201, 140, 0.1)',
                border: '1px solid rgba(167, 201, 140, 0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <GraduationCap size={16} strokeWidth={1.5} color="#a7c98c" />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#f5f5f3', letterSpacing: '-0.01em' }}>ExamCell</div>
                <div style={{ fontSize: 9, color: '#73736f', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>MIT WPU</div>
              </div>
            </div>

            <h1 style={{
              fontSize: 38, fontWeight: 800,
              color: '#ffffff',
              letterSpacing: '-0.03em',
              lineHeight: 1.15,
              margin: '120px 0 20px',
              fontFamily: 'var(--font-sans)',
            }}>
              Welcome to<br />ExamCell Operations
            </h1>
            <p style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.6, maxWidth: 420, margin: '0 0 48px' }}>
              Coordinate seat interleaving, invigilator duty allocations, and smartboard kiosk schedules from a single secure control room.
            </p>

            {/* Features checkmarks */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 360 }}>
              {features.map(({ icon: Icon, text }) => (
                <div key={text} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 16px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.04)',
                  borderRadius: 12,
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 6,
                    background: 'rgba(167, 201, 140, 0.08)',
                    border: '1px solid rgba(167, 201, 140, 0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon size={12} strokeWidth={1.5} color="#a7c98c" />
                  </div>
                  <span style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.8)', fontWeight: 500 }}>{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Institutional footer line */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 40 }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255, 255, 255, 0.5)',
              textTransform: 'uppercase', letterSpacing: '0.1em'
            }}>
              DESIGNED FOR • MIT WPU EXAMINATIONS
            </span>
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              background: 'linear-gradient(135deg, #a7c98c, #3b82f6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontWeight: 900, color: '#191916',
            }}>
              E
            </div>
          </div>
        </div>

        {/* Right panel — Login Card & Status */}
        <div style={{
          padding: '64px 64px 40px',
          background: '#232320',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: '100vh',
          overflowY: 'auto',
          position: 'relative',
        }}>
          {/* Header row: Status & Theme Toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 40 }}>
            {/* Logo placeholder to match ReNova mock */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>Re<span style={{ color: '#a7c98c' }}>Nova</span></span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: '#73736f', letterSpacing: '0.08em', fontWeight: 700 }}>SYSTEM STATUS</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#a7c98c', display: 'inline-block' }} />
                  <span style={{ fontSize: 10, color: '#a7c98c', fontWeight: 600 }}>All Services Operational</span>
                </div>
              </div>
              <button
                onClick={toggleTheme}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', color: '#a5a5a1',
                  padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 6, border: '1px solid rgba(255, 255, 255, 0.04)',
                }}
              >
                {theme === 'dark' ? <Sun size={14} strokeWidth={1.5} /> : <Moon size={14} strokeWidth={1.5} />}
              </button>
            </div>
          </div>

          {/* Centralized Card Form */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, margin: '20px 0' }}>
            <div style={{
              width: '100%',
              maxWidth: 440,
              background: 'rgba(34, 34, 31, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: 12,
              padding: 24,
              boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
            }}>
              {/* Card Header Widget */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: 16, marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: 'rgba(167, 201, 140, 0.08)',
                    border: '1px solid rgba(167, 201, 140, 0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Shield size={14} color="#a7c98c" strokeWidth={1.5} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: '#73736f', letterSpacing: '0.05em', fontWeight: 700 }}>ENTERPRISE ACCESS</div>
                    <div style={{ fontSize: 12, color: '#f5f5f3', fontWeight: 600, marginTop: 1 }}>Secure Sign In</div>
                  </div>
                </div>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#73736f', border: '1px solid rgba(255, 255, 255, 0.05)', padding: '2px 8px', borderRadius: 6 }}>
                  ExamCell v1.0
                </span>
              </div>

              {/* Tab Switcher inside Card */}
              <div style={{ display: 'flex', gap: 16, borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: 0, marginBottom: 20 }}>
                <button
                  type="button"
                  onClick={() => setActiveTab('operator')}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.05em',
                    paddingBottom: 8,
                    color: activeTab === 'operator' ? '#a7c98c' : '#73736f',
                    borderBottom: activeTab === 'operator' ? '2.5px solid #a7c98c' : '2.5px solid transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  OPERATOR ACCESS
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('kiosk')}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.05em',
                    paddingBottom: 8,
                    color: activeTab === 'kiosk' ? '#a7c98c' : '#73736f',
                    borderBottom: activeTab === 'kiosk' ? '2.5px solid #a7c98c' : '2.5px solid transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  SMARTBOARD ACCESS
                </button>
              </div>

              {activeTab === 'operator' ? (
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#73736f', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>
                      USER EMAIL
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#73736f', zIndex: 2 }} />
                      <input
                        type="email"
                        className="input"
                        placeholder="Enter your email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        autoFocus
                        style={{
                          paddingLeft: 38,
                          background: 'rgba(0, 0, 0, 0.12)',
                          border: '1.5px solid rgba(255,255,255,0.06)',
                          borderRadius: 8,
                          color: '#f5f5f3',
                        }}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <label className="form-label" style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#73736f', letterSpacing: '0.05em', textTransform: 'uppercase', margin: 0 }}>
                        PASSWORD
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setEmail('admin@mitwpu.edu.in');
                          setPassword('admin123');
                          toast.success('Default credentials applied!');
                        }}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: 9, fontFamily: 'var(--font-mono)', color: '#a7c98c', letterSpacing: '0.05em', fontWeight: 700, padding: 0
                        }}
                      >
                        DEFAULT CREDENTIALS?
                      </button>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <Lock size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#73736f', zIndex: 2 }} />
                      <input
                        type={showPwd ? 'text' : 'password'}
                        className="input"
                        placeholder="Enter password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        style={{
                          paddingLeft: 38,
                          paddingRight: 40,
                          background: 'rgba(0, 0, 0, 0.12)',
                          border: '1.5px solid rgba(255,255,255,0.06)',
                          borderRadius: 8,
                          color: '#f5f5f3',
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd(!showPwd)}
                        style={{
                          position: 'absolute', right: 12, top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none', border: 'none',
                          color: '#73736f', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', padding: 4,
                          zIndex: 2
                        }}
                        aria-label={showPwd ? 'Hide password' : 'Show password'}
                      >
                        {showPwd ? <EyeOff size={14} strokeWidth={1.5} /> : <Eye size={14} strokeWidth={1.5} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn"
                    disabled={isLoading}
                    style={{
                      width: '100%',
                      justifyContent: 'center',
                      minHeight: 40,
                      fontSize: 12,
                      marginTop: 12,
                      background: '#a7c98c',
                      color: '#1c1c19',
                      border: 'none',
                      borderRadius: 8,
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {isLoading
                      ? <><div className="spinner spinner-invert" style={{ width: 14, height: 14, marginRight: 8 }} /> SIGNING IN…</>
                      : 'SIGN IN'}
                  </button>
                </form>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#73736f', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>
                      EXAM CYCLE
                    </label>
                    <select
                      className="select"
                      value={kioskCycle}
                      onChange={e => setKioskCycle(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'rgba(0, 0, 0, 0.12)',
                        border: '1.5px solid rgba(255,255,255,0.06)',
                        borderRadius: 8,
                        color: '#f5f5f3',
                        padding: '10px 12px',
                        fontSize: 12,
                      }}
                    >
                      <option value="" style={{ background: '#232320' }}>Select Exam Cycle...</option>
                      {cycles.map(c => <option key={c.id} value={c.id} style={{ background: '#232320' }}>{c.name}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#73736f', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>
                      ROOM SELECT (OPTIONAL)
                    </label>
                    <select
                      className="select"
                      value={kioskRoom}
                      onChange={e => setKioskRoom(e.target.value)}
                      style={{
                        width: '100%',
                        background: 'rgba(0, 0, 0, 0.12)',
                        border: '1.5px solid rgba(255,255,255,0.06)',
                        borderRadius: 8,
                        color: '#f5f5f3',
                        padding: '10px 12px',
                        fontSize: 12,
                      }}
                    >
                      <option value="" style={{ background: '#232320' }}>All Rooms (Entrance Telemetry)</option>
                      {classrooms.map(r => <option key={r.id} value={r.id} style={{ background: '#232320' }}>Room {r.room_no} ({r.block})</option>)}
                    </select>
                  </div>

                  <button
                    type="button"
                    className="btn"
                    onClick={handleLaunchKiosk}
                    disabled={!kioskCycle}
                    style={{
                      width: '100%',
                      justifyContent: 'center',
                      minHeight: 40,
                      fontSize: 12,
                      marginTop: 12,
                      background: '#a7c98c',
                      color: '#1c1c19',
                      border: 'none',
                      borderRadius: 8,
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    LAUNCH KIOSK DISPLAY
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Footer Info Checklist */}
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: 20 }}>
            <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: '#73736f', letterSpacing: '0.08em' }}>SECURE AUTHENTICATION</span>
            <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: '#73736f', letterSpacing: '0.08em' }}>ROLE BASED ACCESS CONTROL</span>
            <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', color: '#73736f', letterSpacing: '0.08em' }}>ENCRYPTED CONNECTION</span>
          </div>
        </div>
      </div>
    </div>
  );
}




