import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Eye, EyeOff, Shield, BookOpen, Users, FileDown, Mail, Lock, Sun, Moon, ArrowLeft, Menu } from 'lucide-react';
import { useAuthStore, useAppStore } from '../store/index.js';
import api from '../lib/api.js';
import toast from 'react-hot-toast';

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const d = new Date();
const today = `${weekdays[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

const features = [
  { icon: BookOpen, text: 'Seating arrangement generation' },
  { icon: Users,    text: 'Branch-interleaved bench allocation' },
  { icon: Shield,   text: 'Conflict detection & resolution' },
  { icon: FileDown, text: 'PDF export: seating, duty, timetable' },
];

function WireframeVisual() {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      perspective: 1000,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* 3D Scene Wrapper */}
      <div style={{
        width: 320,
        height: 320,
        transformStyle: 'preserve-3d',
        animation: 'rotateStructure 24s linear infinite',
        position: 'relative',
      }}>
        {/* CSS Keyframes for structure rotation */}
        <style>{`
          @keyframes rotateStructure {
            0% { transform: rotateX(60deg) rotateY(0deg) rotateZ(0deg); }
            100% { transform: rotateX(60deg) rotateY(0deg) rotateZ(360deg); }
          }
        `}</style>

        {/* 1. Base Grid Plane */}
        <div style={{
          position: 'absolute',
          inset: '-40px',
          background: 'radial-gradient(circle, transparent 20%, #ffffff 80%), linear-gradient(rgba(98, 0, 234, 0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(98, 0, 234, 0.08) 1px, transparent 1px)',
          backgroundSize: '16px 16px',
          transform: 'translateZ(-40px)',
          opacity: 0.8,
        }} />

        {/* 2. Concentric Layered Tracks (Winding Figure-8 Loop) */}
        {Array.from({ length: 8 }).map((_, i) => {
          const z = i * 16;
          const scale = 1 - i * 0.02;
          return (
            <svg
              key={`track-${i}`}
              viewBox="0 0 400 400"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                transform: `translateZ(${z}px) scale(${scale})`,
                transformStyle: 'preserve-3d',
                overflow: 'visible',
              }}
            >
              <path
                d="M 60,200 C 60,100 150,100 200,200 C 250,300 340,300 340,200 C 340,100 250,100 200,200 C 150,300 60,300 60,200 Z"
                fill="none"
                stroke="#6200ea"
                strokeWidth={1.2}
                opacity={0.15 + (i / 8) * 0.45}
              />
            </svg>
          );
        })}

        {/* 3. Winding Ribbon Struts (Connecting Top & Bottom Tracks) */}
        <svg
          viewBox="0 0 400 400"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            transformStyle: 'preserve-3d',
            overflow: 'visible',
          }}
        >
          <g stroke="#6200ea" strokeWidth="0.8" opacity="0.3" fill="none">
            {Array.from({ length: 24 }).map((_, idx) => {
              const t = (idx / 24) * Math.PI * 2;
              const x = 200 + Math.sin(idx * 0.26) * 110;
              const y = 200 + Math.sin(idx * 0.52) * 80;
              return (
                <line
                  key={`strut-${idx}`}
                  x1={x}
                  y1={y}
                  x2={x}
                  y2={y + 110}
                  style={{
                    transform: `translateZ(0px) scaleZ(1.2)`,
                  }}
                />
              );
            })}
          </g>
        </svg>

        {/* 4. Center Pillars (Futuristic 3D cylinder terminals) */}
        {/* Left cylinder tower */}
        <div style={{
          position: 'absolute',
          left: '30%',
          top: '50%',
          width: '50px',
          height: '120px',
          transform: 'translate3d(-50%, -50%, 0px) rotateX(90deg)',
          transformStyle: 'preserve-3d',
        }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={`ring1-${i}`}
              style={{
                position: 'absolute',
                inset: 0,
                border: '1px solid rgba(98, 0, 234, 0.3)',
                borderRadius: '50%',
                transform: `translateZ(${i * 30}px)`,
              }}
            />
          ))}
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={`rib1-${i}`}
              style={{
                position: 'absolute',
                left: '50%',
                top: 0,
                bottom: 0,
                width: 1,
                background: 'rgba(98, 0, 234, 0.25)',
                transform: `rotateY(${i * 60}deg) translateZ(25px)`,
              }}
            />
          ))}
        </div>

        {/* Right cylinder tower */}
        <div style={{
          position: 'absolute',
          left: '70%',
          top: '50%',
          width: '50px',
          height: '120px',
          transform: 'translate3d(-50%, -50%, 0px) rotateX(90deg)',
          transformStyle: 'preserve-3d',
        }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={`ring2-${i}`}
              style={{
                position: 'absolute',
                inset: 0,
                border: '1px solid rgba(98, 0, 234, 0.3)',
                borderRadius: '50%',
                transform: `translateZ(${i * 30}px)`,
              }}
            />
          ))}
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={`rib2-${i}`}
              style={{
                position: 'absolute',
                left: '50%',
                top: 0,
                bottom: 0,
                width: 1,
                background: 'rgba(98, 0, 234, 0.25)',
                transform: `rotateY(${i * 60}deg) translateZ(25px)`,
              }}
            />
          ))}
        </div>

        {/* 5. Floating satellite/particles wireframe */}
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i / 12) * Math.PI * 2;
          const x = 160 + Math.cos(angle) * 130;
          const y = 160 + Math.sin(angle) * 100;
          const z = 80 + Math.sin(i) * 30;
          return (
            <div
              key={`part-${i}`}
              style={{
                position: 'absolute',
                left: x,
                top: y,
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                border: '1px solid #6200ea',
                background: '#ffffff',
                transform: `translateZ(${z}px)`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

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
      background: '#b9b3cc', // Lavender-gray outer background matching the user image
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-sans)',
      padding: '24px',
      overflow: 'hidden',
    }}>
      {/* 3D rotate and radar ripple CSS animations */}
      <style>{`
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

      {/* Centered canvas matching the mockup */}
      <div style={{
        background: '#ffffff',
        borderRadius: 8,
        boxShadow: '0 24px 64px rgba(40, 30, 60, 0.08)',
        border: '1px solid rgba(0, 0, 0, 0.03)',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        width: '100%',
        maxWidth: 1020,
        height: 640,
        position: 'relative',
        zIndex: 1,
        overflow: 'hidden',
      }}>
        {/* Left Side: Winding monorail 3D wireframe render video loop */}
        <div style={{
          background: '#ffffff',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 0 24px 24px',
          overflow: 'hidden',
        }}>
          {/* Logo brand placed top-left inside the white canvas */}
          <div style={{ position: 'absolute', left: 48, top: 48, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#1a1a1a', letterSpacing: '0.15em', fontFamily: 'var(--font-sans)' }}>
              EXAMCELL
            </span>
          </div>

          {/* Procedural 3D Wireframe Scene */}
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <WireframeVisual />
          </div>

          {/* Curved purple arrow overlay pointing to the Get Started button */}
          {!showLoginForm && (
            <svg style={{ position: 'absolute', right: '-40px', bottom: '150px', width: '140px', height: '80px', pointerEvents: 'none', overflow: 'visible', zIndex: 10 }}>
              <path d="M 0,10 C 40,45 80,45 110,25" fill="none" stroke="#6200ea" strokeWidth="1.2" />
              <polygon points="110,25 102,23 107,26 104,31" fill="#6200ea" />
            </svg>
          )}
        </div>

        {/* Right Side: Navigation header, floating cards, and sliding forms */}
        <div style={{
          padding: '48px 48px 48px 24px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#ffffff',
          position: 'relative',
        }}>
          {/* Top header row: Theme toggle & Hamburger menu icon */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16, zIndex: 10 }}>
            <button
              onClick={toggleTheme}
              style={{
                background: 'none',
                border: '1px solid #eef0f5',
                cursor: 'pointer',
                color: '#606060',
                padding: '6px 10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 6,
              }}
            >
              {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
            </button>
            <button
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#1a1a1a',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Menu size={20} strokeWidth={2.5} />
            </button>
          </div>

          {/* Main Content Area */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', margin: '40px 0' }}>
            {!showLoginForm ? (
              // OVERVIEW STATE: Matches the user's mockup image exactly
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingLeft: 24 }}>
                {/* Horizontal row of floating cards */}
                <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                  {/* Card 1: Redefine Data */}
                  <div style={{
                    background: '#f8f9fa',
                    borderRadius: 16,
                    padding: '24px 20px',
                    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.015)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    width: 175,
                    height: 180,
                    border: '1px solid #f1f3f7',
                  }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#6200ea' }}>Redefine</span>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#1a1a1a', marginTop: 1 }}>Data</div>
                      <div style={{ fontSize: 10, color: '#909090', marginTop: 2 }}>in this month</div>
                    </div>
                    <div style={{ margin: '16px 0 10px 0' }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1a1a' }}>3.4<span style={{ fontSize: 14, fontWeight: 700 }}>PB</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#808080', marginTop: 4 }}>
                        <span>Encrypted data</span>
                        <span style={{ color: '#6200ea', fontWeight: 700 }}>↗ 25.6%</span>
                      </div>
                    </div>
                    {/* Progress Bar */}
                    <div style={{ height: 4, background: '#e9ecef', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: '75%', background: '#6200ea', borderRadius: 2 }} />
                    </div>
                  </div>

                  {/* Card 2: Secure Scan */}
                  <div style={{
                    background: '#f8f9fa',
                    borderRadius: 16,
                    padding: '24px 20px',
                    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.015)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    width: 175,
                    height: 180,
                    border: '1px solid #f1f3f7',
                  }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#6200ea' }}>Secure</span>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#1a1a1a', marginTop: 1 }}>Scan</div>
                    </div>

                    {/* Concentric offset scanner circles vector graphic matching the mockup */}
                    <div style={{ position: 'relative', width: 64, height: 64, margin: '0 auto' }}>
                      <div style={{ position: 'absolute', inset: '0px', border: '1px solid #dedbea', borderRadius: '50%', transform: 'scale(1) translateY(4px)' }} />
                      <div style={{ position: 'absolute', inset: '5px', border: '1px solid #c4bfdd', borderRadius: '50%', transform: 'scale(1) translateY(7px)' }} />
                      <div style={{ position: 'absolute', inset: '10px', border: '1px solid #a89fcf', borderRadius: '50%', transform: 'scale(1) translateY(10px)' }} />
                      <div style={{
                        position: 'absolute', inset: '15px', background: '#6200ea', borderRadius: '50%', transform: 'scale(1) translateY(13px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(98, 0, 234, 0.3)'
                      }}>
                        <div style={{ width: 6, height: 6, background: '#000000', borderRadius: '50%' }} />
                      </div>
                    </div>

                    <div style={{ fontSize: 9, color: '#808080', textAlign: 'center', fontWeight: 500 }}>
                      Comprehensive<br />De-cryption
                    </div>
                  </div>
                </div>

                {/* Pill-shaped Get Started button */}
                <div style={{ paddingLeft: 4 }}>
                  <button
                    onClick={() => setShowLoginForm(true)}
                    style={{
                      background: '#6200ea',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 24,
                      padding: '11px 32px',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 8px 24px rgba(98, 0, 234, 0.25)',
                      transition: 'transform 0.15s, box-shadow 0.15s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 10px 28px rgba(98, 0, 234, 0.3)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = '0 8px 24px rgba(98, 0, 234, 0.25)';
                    }}
                  >
                    Get Started
                  </button>
                </div>
              </div>
            ) : (
              // FORM LOGIN STATE: operator sign-in and kiosk mode selector
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingLeft: 24, animation: 'fadeIn 0.2s ease-out' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    onClick={() => setShowLoginForm(false)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer', color: '#606060',
                      padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#808080', letterSpacing: '0.05em' }}>BACK TO OVERVIEW</span>
                </div>

                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a', margin: '0 0 4px', letterSpacing: '-0.01em' }}>
                    Access Portal
                  </h2>
                  <p style={{ fontSize: 11, color: '#808080', margin: 0 }}>
                    Sign in to manage scheduling, seating, and invigilation.
                  </p>
                </div>

                {/* Tabs selection inside form card */}
                <div style={{ display: 'flex', gap: 16, borderBottom: '1px solid #f1f3f7', paddingBottom: 0 }}>
                  <button
                    type="button"
                    onClick={() => setActiveTab('operator')}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 800, paddingBottom: 8,
                      color: activeTab === 'operator' ? '#6200ea' : '#909090',
                      borderBottom: activeTab === 'operator' ? '2px solid #6200ea' : '2px solid transparent',
                    }}
                  >
                    OPERATOR LOGIN
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('kiosk')}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 800, paddingBottom: 8,
                      color: activeTab === 'kiosk' ? '#6200ea' : '#909090',
                      borderBottom: activeTab === 'kiosk' ? '2px solid #6200ea' : '2px solid transparent',
                    }}
                  >
                    SMARTBOARD KIOSK
                  </button>
                </div>

                {activeTab === 'operator' ? (
                  <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 10, color: '#606060', marginBottom: 4 }}>Email Address</label>
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
                            height: 38,
                          }}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <label className="form-label" style={{ fontSize: 10, color: '#606060', margin: 0 }}>Password</label>
                        <button
                          type="button"
                          onClick={() => {
                            setEmail('admin@mitwpu.edu.in');
                            setPassword('admin123');
                            toast.success('Default credentials applied');
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6200ea', fontSize: 10, padding: 0, fontWeight: 700 }}
                        >
                          Auto fill?
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
                            height: 38,
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
                        minHeight: 38,
                        fontSize: 12,
                        background: '#6200ea',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 8,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        marginTop: 4,
                        boxShadow: '0 8px 20px rgba(98, 0, 234, 0.15)',
                      }}
                    >
                      {isLoading ? 'SIGNING IN...' : 'SIGN IN'}
                    </button>
                  </form>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 10, color: '#606060', marginBottom: 4 }}>Exam Cycle</label>
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
                          height: 38,
                        }}
                      >
                        <option value="">Select Cycle...</option>
                        {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 10, color: '#606060', marginBottom: 4 }}>Classroom (Optional)</label>
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
                          height: 38,
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
                        minHeight: 38,
                        fontSize: 12,
                        background: '#6200ea',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 8,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        marginTop: 4,
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
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f1f3f7', paddingTop: 20, zIndex: 10 }}>
            <span style={{ fontSize: 8, color: '#959598', fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>SECURE AUTH</span>
            <span style={{ fontSize: 8, color: '#959598', fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>RBAC ENABLED</span>
            <span style={{ fontSize: 8, color: '#959598', fontWeight: 700, fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>SSL ENCRYPTED</span>
          </div>
        </div>
      </div>
    </div>
  );
}
