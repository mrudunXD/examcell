import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Eye, EyeOff, Shield, BookOpen, Users, FileDown, Mail, Lock, Sun, Moon, ArrowLeft, Menu } from 'lucide-react';
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
  const [showLoginForm, setShowLoginForm] = useState(false);

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
      background: '#c8c2d5', // Light purple/lavender background matching the video backdrop
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-sans)',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* 3D rotate and radar ripple CSS animations */}
      <style>{`
        @keyframes rotate3d {
          0% { transform: rotateX(60deg) rotateY(0deg) rotateZ(0deg); }
          100% { transform: rotateX(60deg) rotateY(0deg) rotateZ(360deg); }
        }
        @keyframes radar-ripple {
          0% { transform: scale(0.6); opacity: 1; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        .radar-ring {
          position: absolute;
          border: 1px solid rgba(98, 0, 234, 0.2);
          border-radius: 50%;
          animation: radar-ripple 2.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite;
        }
        .radar-ring:nth-child(2) {
          animation-delay: 0.8s;
        }
        .radar-ring:nth-child(3) {
          animation-delay: 1.6s;
        }
      `}</style>

      {/* Centered browser mock frame container */}
      <div style={{
        background: '#ffffff',
        borderRadius: 24,
        boxShadow: '0 24px 64px rgba(40, 30, 60, 0.12)',
        border: '1px solid rgba(0, 0, 0, 0.04)',
        display: 'grid',
        gridTemplateColumns: '1.1fr 1fr',
        width: '100%',
        maxWidth: 1060,
        minHeight: 620,
        position: 'relative',
        zIndex: 2,
        overflow: 'hidden',
      }}>
        {/* Left Side: Animated wireframe visual (rotating 3D loop) */}
        <div style={{
          background: '#f8f9fc',
          borderRight: '1px solid #f1f3f7',
          padding: '48px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Top Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, zIndex: 2 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6,
              background: 'rgba(98, 0, 234, 0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <GraduationCap size={15} color="#6200ea" strokeWidth={2} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#1a1a1a', letterSpacing: '0.12em' }}>EXAMCELL</span>
          </div>

          {/* Centered rotating 3D wireframe ribbon */}
          <div style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            perspective: 800,
            zIndex: 1,
            position: 'relative',
            margin: '40px 0',
          }}>
            <div style={{ width: 340, height: 340, transformStyle: 'preserve-3d', position: 'relative' }}>
              <svg width="340" height="340" viewBox="0 0 400 400" style={{ transformStyle: 'preserve-3d', animation: 'rotate3d 28s linear infinite', width: '100%', height: '100%', overflow: 'visible' }}>
                <g stroke="#6200ea" strokeWidth="1.5" fill="none" opacity="0.5">
                  {/* Outer layered tracks */}
                  {Array.from({ length: 8 }).map((_, i) => (
                    <path
                      key={`layer-${i}`}
                      d="M 50 200 C 50 100, 150 100, 200 200 C 250 300, 350 300, 350 200 C 350 100, 250 100, 200 200 C 150 300, 50 300, 50 200 Z"
                      style={{ transform: `translateZ(${i * 14}px) scale(${1 - i * 0.025})` }}
                    />
                  ))}
                  {/* Connector pillars / lines linking the layered curves */}
                  {Array.from({ length: 16 }).map((_, i) => {
                    const angle = (i / 16) * Math.PI * 2;
                    const x = 200 + Math.cos(angle) * 120;
                    const y = 200 + Math.sin(angle) * 90;
                    return (
                      <line
                        key={`pillar-${i}`}
                        x1={x}
                        y1={y}
                        x2={x}
                        y2={y}
                        style={{ transform: `translateZ(0px) scale(${0.9})`, stroke: '#6200ea', opacity: 0.25 }}
                      />
                    );
                  })}
                </g>
              </svg>
            </div>
          </div>

          {/* Left footer details */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 2 }}>
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: '#909090', letterSpacing: '0.05em' }}>
              Restricted Access · MIT WPU
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#6200ea' }} />
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#6200ea', opacity: 0.5 }} />
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#6200ea', opacity: 0.2 }} />
            </div>
          </div>
        </div>

        {/* Right Side: Cards Slider / Login Forms */}
        <div style={{
          padding: '48px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#ffffff',
          position: 'relative',
        }}>
          {/* Top header row: Theme toggle & Hamburger menu */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              onClick={toggleTheme}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', color: '#606060',
                padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: 8, border: '1px solid #f1f3f7',
              }}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button
              style={{
                background: 'none', border: 'none', cursor: 'pointer', color: '#1a1a1a',
                padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Menu size={16} />
            </button>
          </div>

          {/* Core Content Area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', margin: '32px 0' }}>
            {!showLoginForm ? (
              // OVERVIEW STATE: Video Mockup UI
              <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                <div>
                  <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1a1a1a', letterSpacing: '-0.02em', margin: '0 0 8px' }}>
                    Redefine Operations
                  </h1>
                  <p style={{ fontSize: 13, color: '#808080', margin: 0 }}>
                    Automated conflict-free scheduling and real-time exam telemetry.
                  </p>
                </div>

                {/* Grid layout containing two floating stats cards */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {/* Card 1: Redefine Data */}
                  <div style={{
                    background: '#ffffff',
                    border: '1px solid #f0f0f0',
                    borderRadius: 16,
                    padding: '20px',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: 150,
                  }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a' }}>Redefine Data</div>
                      <div style={{ fontSize: 10, color: '#909090', marginTop: 2 }}>in this semester</div>
                    </div>
                    <div style={{ margin: '16px 0' }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: '#6200ea' }}>1.4K</div>
                      <div style={{ fontSize: 10, color: '#606060', marginTop: 2 }}>Seated students</div>
                    </div>
                    {/* Progress Bar */}
                    <div style={{ height: 4, background: '#f0f0f0', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: '72%', background: '#6200ea', borderRadius: 2 }} />
                    </div>
                  </div>

                  {/* Card 2: Secure Scan (Expanding ripple effect) */}
                  <div style={{
                    background: '#ffffff',
                    border: '1px solid #f0f0f0',
                    borderRadius: 16,
                    padding: '20px',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: 150,
                    position: 'relative',
                    overflow: 'hidden',
                  }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a' }}>Secure Scan</div>
                      <div style={{ fontSize: 10, color: '#909090', marginTop: 2 }}>System status</div>
                    </div>

                    {/* Radar wave animation container */}
                    <div style={{
                      height: 48,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      margin: '12px 0',
                    }}>
                      <div className="radar-ring" style={{ width: 40, height: 40 }} />
                      <div className="radar-ring" style={{ width: 40, height: 40 }} />
                      <div className="radar-ring" style={{ width: 40, height: 40 }} />
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#6200ea', zIndex: 2 }} />
                    </div>

                    <div style={{ fontSize: 10, color: '#808080', textAlign: 'center', zIndex: 2 }}>
                      Conflict-free active
                    </div>
                  </div>
                </div>

                {/* Primary purple action button */}
                <button
                  onClick={() => setShowLoginForm(true)}
                  style={{
                    background: '#6200ea',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '12px 24px',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 8px 20px rgba(98, 0, 234, 0.15)',
                    transition: 'all 0.15s',
                    width: '100%',
                    maxWidth: 160,
                    textAlign: 'center',
                  }}
                >
                  Get Started
                </button>
              </div>
            ) : (
              // FORM LOGIN STATE: operator sign-in and kiosk mode selector
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24, animation: 'fadeIn 0.25s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={() => setShowLoginForm(false)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', color: '#606060',
                      padding: 4, display: 'flex', alignItems: 'center',
                    }}
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#808080' }}>Overview</span>
                </div>

                <div>
                  <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1a1a1a', margin: '0 0 6px' }}>
                    Access Portal
                  </h2>
                  <p style={{ fontSize: 12, color: '#808080', margin: 0 }}>
                    Select credential type to launch session.
                  </p>
                </div>

                {/* Tabs selection inside form card */}
                <div style={{ display: 'flex', gap: 16, borderBottom: '1px solid #f1f3f7', paddingBottom: 0 }}>
                  <button
                    type="button"
                    onClick={() => setActiveTab('operator')}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 11, fontWeight: 700, paddingBottom: 8,
                      color: activeTab === 'operator' ? '#6200ea' : '#909090',
                      borderBottom: activeTab === 'operator' ? '2px solid #6200ea' : '2px solid transparent',
                    }}
                  >
                    Operator Login
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('kiosk')}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 11, fontWeight: 700, paddingBottom: 8,
                      color: activeTab === 'kiosk' ? '#6200ea' : '#909090',
                      borderBottom: activeTab === 'kiosk' ? '2px solid #6200ea' : '2px solid transparent',
                    }}
                  >
                    Smartboard Kiosk
                  </button>
                </div>

                {activeTab === 'operator' ? (
                  <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 10, color: '#606060', marginBottom: 6 }}>Email Address</label>
                      <div style={{ position: 'relative' }}>
                        <Mail size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#909090' }} />
                        <input
                          type="email"
                          className="input"
                          placeholder="you@mitwpu.edu.in"
                          value={email}
                          onChange={e => setEmail(e.target.value)}
                          required
                          autoFocus
                          style={{
                            paddingLeft: 36,
                            background: '#f8f9fc',
                            border: '1px solid #e2e8f0',
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <label className="form-label" style={{ fontSize: 10, color: '#606060', margin: 0 }}>Password</label>
                        <button
                          type="button"
                          onClick={() => {
                            setEmail('admin@mitwpu.edu.in');
                            setPassword('admin123');
                            toast.success('Default credentials applied');
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6200ea', fontSize: 10, padding: 0, fontWeight: 600 }}
                        >
                          Auto fill credentials?
                        </button>
                      </div>
                      <div style={{ position: 'relative' }}>
                        <Lock size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#909090' }} />
                        <input
                          type={showPwd ? 'text' : 'password'}
                          className="input"
                          placeholder="••••••••"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          required
                          style={{
                            paddingLeft: 36,
                            paddingRight: 40,
                            background: '#f8f9fc',
                            border: '1px solid #e2e8f0',
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPwd(!showPwd)}
                          style={{
                            position: 'absolute', right: 10, top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none', border: 'none',
                            color: '#909090', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', padding: 4,
                          }}
                          aria-label={showPwd ? 'Hide password' : 'Show password'}
                        >
                          {showPwd ? <EyeOff size={13} /> : <Eye size={13} />}
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
                        background: '#6200ea',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 8,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        marginTop: 8,
                        boxShadow: '0 8px 20px rgba(98, 0, 234, 0.15)',
                      }}
                    >
                      {isLoading ? 'SIGNING IN...' : 'SIGN IN'}
                    </button>
                  </form>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 10, color: '#606060', marginBottom: 6 }}>Exam Cycle</label>
                      <select
                        className="select"
                        value={kioskCycle}
                        onChange={e => setKioskCycle(e.target.value)}
                        style={{
                          width: '100%',
                          background: '#f8f9fc',
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          fontSize: 12,
                          padding: '10px 12px',
                        }}
                      >
                        <option value="">Select Cycle...</option>
                        {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 10, color: '#606060', marginBottom: 6 }}>Classroom (Optional)</label>
                      <select
                        className="select"
                        value={kioskRoom}
                        onChange={e => setKioskRoom(e.target.value)}
                        style={{
                          width: '100%',
                          background: '#f8f9fc',
                          border: '1px solid #e2e8f0',
                          borderRadius: 8,
                          fontSize: 12,
                          padding: '10px 12px',
                        }}
                      >
                        <option value="">All Classrooms</option>
                        {classrooms.map(r => <option key={r.id} value={r.id}>{r.room_no} ({r.block})</option>)}
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
                        background: '#6200ea',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 8,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        marginTop: 8,
                        boxShadow: '0 8px 20px rgba(98, 0, 234, 0.15)',
                      }}
                    >
                      LAUNCH KIOSK DISPLAY
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Footer list */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f1f3f7', paddingTop: 20 }}>
            <span style={{ fontSize: 9, color: '#909090', fontWeight: 600 }}>SECURE AUTH</span>
            <span style={{ fontSize: 9, color: '#909090', fontWeight: 600 }}>RBAC</span>
            <span style={{ fontSize: 9, color: '#909090', fontWeight: 600 }}>SSL ENCRYPTION</span>
          </div>
        </div>
      </div>
    </div>
  );
}




