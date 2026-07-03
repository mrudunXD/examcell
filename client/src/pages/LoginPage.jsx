import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Shield, BookOpen, Users, FileDown, Mail, Lock, Sun, Moon, ArrowLeft, Menu } from 'lucide-react';
import { useAuthStore, useAppStore } from '../store/index.js';
import api from '../lib/api.js';
import toast from 'react-hot-toast';
import WireframeCanvas from '../components/WireframeCanvas.jsx';

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const d = new Date();
const today = `${weekdays[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

export default function LoginPage() {
  const { login, isLoading } = useAuthStore();
  const { theme, toggleTheme } = useAppStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [activeTab, setActiveTab] = useState('operator');
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
        if (res.data.cycles?.length > 0) setKioskCycle(res.data.cycles[0].id);
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
      background: '#b9b3cc',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-sans)',
      padding: '24px',
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes radar-ripple {
          0%   { transform: scale(0.5); opacity: 0.9; }
          100% { transform: scale(2.8); opacity: 0; }
        }
        .radar-ring {
          position: absolute;
          inset: 0;
          border: 1px solid rgba(98, 0, 234, 0.35);
          border-radius: 50%;
          animation: radar-ripple 2.4s cubic-bezier(0.25,0.46,0.45,0.94) infinite;
        }
        .radar-ring:nth-child(2) { animation-delay: 0.8s; }
        .radar-ring:nth-child(3) { animation-delay: 1.6s; }
        @keyframes beacon-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(98,0,234,0.55); }
          50%       { box-shadow: 0 0 0 6px rgba(98,0,234,0); }
        }
        .scan-beacon {
          animation: beacon-pulse 2.4s ease-in-out infinite;
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── Main white card ─────────────────────────────────────────── */}
      <div style={{
        background: '#ffffff',
        borderRadius: 8,
        boxShadow: '0 28px 72px rgba(40,30,60,0.10)',
        border: '1px solid rgba(0,0,0,0.03)',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        width: '100%',
        maxWidth: 1020,
        height: 640,
        position: 'relative',
        zIndex: 1,
        overflow: 'hidden',
      }}>

        {/* ── LEFT: Three.js wireframe fill ───────────────────────── */}
        <div style={{
          background: '#fafafa',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Brand mark top-left */}
          <div style={{
            position: 'absolute', left: 32, top: 32,
            fontSize: 14, fontWeight: 800, color: '#1a1a1a',
            letterSpacing: '0.15em', zIndex: 2,
          }}>
            EXAMCELL
          </div>

          {/* Three.js canvas fills the entire left cell */}
          <WireframeCanvas style={{ position: 'absolute', inset: 0 }} />

          {/* Curved arrow pointing toward "Get Started" — only on overview state */}
          {!showLoginForm && (
            <svg
              style={{
                position: 'absolute', right: -32, bottom: 148,
                width: 130, height: 72,
                pointerEvents: 'none', overflow: 'visible', zIndex: 10,
              }}
            >
              <defs>
                <marker id="arrowhead" markerWidth="6" markerHeight="6"
                  refX="3" refY="3" orient="auto">
                  <polygon points="0 0, 6 3, 0 6" fill="#6200ea" />
                </marker>
              </defs>
              <path
                d="M 0,12 C 38,48 78,46 112,28"
                fill="none"
                stroke="#6200ea"
                strokeWidth="1.4"
                markerEnd="url(#arrowhead)"
              />
            </svg>
          )}
        </div>

        {/* ── RIGHT: cards / login form ───────────────────────────── */}
        <div style={{
          padding: '40px 44px 40px 28px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#ffffff',
        }}>

          {/* Top bar */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 14 }}>
            <button
              onClick={toggleTheme}
              style={{
                background: 'none', border: '1px solid #eef0f5',
                cursor: 'pointer', color: '#606060',
                padding: '5px 9px', display: 'flex', alignItems: 'center',
                borderRadius: 6,
              }}
            >
              {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
            </button>
            <button style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#1a1a1a', padding: 4,
              display: 'flex', alignItems: 'center',
            }}>
              <Menu size={20} strokeWidth={2.5} />
            </button>
          </div>

          {/* ── Content area ──────────────────────────────────────── */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', margin: '28px 0' }}>
            {!showLoginForm ? (

              /* ─── OVERVIEW STATE ─────────────────────────────── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 28, animation: 'fadeSlideIn 0.25s ease-out' }}>

                {/* Two cards side-by-side */}
                <div style={{ display: 'flex', gap: 18 }}>

                  {/* Card 1: Redefine Data */}
                  <div style={{
                    background: '#f8f9fa', borderRadius: 16,
                    padding: '22px 18px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.025)',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                    width: 175, height: 190,
                    border: '1px solid #f0f1f5',
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#6200ea' }}>Redefine</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#1a1a1a', marginTop: 1 }}>Data</div>
                      <div style={{ fontSize: 10, color: '#999', marginTop: 3 }}>in this month</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 26, fontWeight: 800, color: '#1a1a1a', lineHeight: 1 }}>
                        3.4<span style={{ fontSize: 13, fontWeight: 700 }}>PB</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: '#888', marginTop: 5 }}>
                        <span>Encrypted data</span>
                        <span style={{ color: '#6200ea', fontWeight: 700 }}>↗ 25.6%</span>
                      </div>
                      <div style={{ height: 3, background: '#e9ecef', borderRadius: 2, overflow: 'hidden', marginTop: 8 }}>
                        <div style={{ height: '100%', width: '75%', background: 'linear-gradient(90deg,#6200ea,#9b5cff)', borderRadius: 2 }} />
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Secure Scan */}
                  <div style={{
                    background: '#f8f9fa', borderRadius: 16,
                    padding: '22px 18px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.025)',
                    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                    width: 175, height: 190,
                    border: '1px solid #f0f1f5',
                    overflow: 'hidden',
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#6200ea' }}>Secure</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#1a1a1a', marginTop: 1 }}>Scan</div>
                    </div>

                    {/* Animated radar scan: 3 expanding rings + pulsing beacon */}
                    <div style={{
                      position: 'relative',
                      width: 56, height: 56,
                      margin: '0 auto',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {/* Three expanding ripple rings */}
                      <div className="radar-ring" />
                      <div className="radar-ring" />
                      <div className="radar-ring" />

                      {/* Purple beacon dot — sits above the rings */}
                      <div
                        className="scan-beacon"
                        style={{
                          position: 'relative',
                          zIndex: 2,
                          width: 18, height: 18,
                          borderRadius: '50%',
                          background: '#6200ea',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <div style={{ width: 7, height: 7, background: '#000', borderRadius: '50%' }} />
                      </div>
                    </div>

                    <div style={{ fontSize: 9, color: '#888', textAlign: 'center', fontWeight: 500, lineHeight: 1.5 }}>
                      Comprehensive<br />De-cryption
                    </div>
                  </div>
                </div>

                {/* Get Started pill */}
                <div>
                  <button
                    onClick={() => setShowLoginForm(true)}
                    style={{
                      background: '#6200ea',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 28,
                      padding: '12px 36px',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 8px 24px rgba(98,0,234,0.28)',
                      transition: 'transform 0.15s, box-shadow 0.15s',
                      letterSpacing: '0.01em',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 12px 30px rgba(98,0,234,0.35)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = '0 8px 24px rgba(98,0,234,0.28)';
                    }}
                  >
                    Get Started
                  </button>
                </div>
              </div>

            ) : (

              /* ─── LOGIN FORM STATE ────────────────────────────── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18, animation: 'fadeSlideIn 0.2s ease-out' }}>

                {/* Back link */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    onClick={() => setShowLoginForm(false)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#606060', padding: 4,
                      display: 'flex', alignItems: 'center',
                    }}
                  >
                    <ArrowLeft size={15} />
                  </button>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#888', letterSpacing: '0.06em' }}>
                    BACK TO OVERVIEW
                  </span>
                </div>

                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a', margin: '0 0 4px', letterSpacing: '-0.01em' }}>
                    Access Portal
                  </h2>
                  <p style={{ fontSize: 11, color: '#888', margin: 0 }}>
                    Sign in to manage scheduling, seating, and invigilation.
                  </p>
                </div>

                {/* Tab switcher */}
                <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #f1f3f7' }}>
                  {['operator', 'kiosk'].map(tab => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 10, fontWeight: 800, paddingBottom: 8, paddingRight: 16,
                        color: activeTab === tab ? '#6200ea' : '#aaa',
                        borderBottom: activeTab === tab ? '2px solid #6200ea' : '2px solid transparent',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {tab === 'operator' ? 'OPERATOR LOGIN' : 'SMARTBOARD KIOSK'}
                    </button>
                  ))}
                </div>

                {activeTab === 'operator' ? (
                  <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Email */}
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 10, color: '#606060', marginBottom: 4 }}>
                        Email Address
                      </label>
                      <div style={{ position: 'relative' }}>
                        <Mail size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#aaa' }} />
                        <input
                          type="email" className="input"
                          placeholder="you@mitwpu.edu.in"
                          value={email} onChange={e => setEmail(e.target.value)}
                          required autoFocus
                          style={{ paddingLeft: 36, background: '#f8f9fc', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, height: 38 }}
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div className="form-group">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <label className="form-label" style={{ fontSize: 10, color: '#606060', margin: 0 }}>Password</label>
                        <button
                          type="button"
                          onClick={() => { setEmail('admin@mitwpu.edu.in'); setPassword('admin123'); toast.success('Credentials filled'); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6200ea', fontSize: 10, fontWeight: 700, padding: 0 }}
                        >
                          Auto fill?
                        </button>
                      </div>
                      <div style={{ position: 'relative' }}>
                        <Lock size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#aaa' }} />
                        <input
                          type={showPwd ? 'text' : 'password'} className="input"
                          placeholder="••••••••"
                          value={password} onChange={e => setPassword(e.target.value)}
                          required
                          style={{ paddingLeft: 36, paddingRight: 40, background: '#f8f9fc', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, height: 38 }}
                        />
                        <button
                          type="button" onClick={() => setShowPwd(!showPwd)}
                          style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', display: 'flex', padding: 4 }}
                          aria-label={showPwd ? 'Hide' : 'Show'}
                        >
                          {showPwd ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit" className="btn" disabled={isLoading}
                      style={{ width: '100%', justifyContent: 'center', minHeight: 38, fontSize: 12, background: '#6200ea', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', marginTop: 4, boxShadow: '0 8px 20px rgba(98,0,234,0.18)' }}
                    >
                      {isLoading ? 'SIGNING IN…' : 'SIGN IN'}
                    </button>
                  </form>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 10, color: '#606060', marginBottom: 4 }}>Exam Cycle</label>
                      <select className="select" value={kioskCycle} onChange={e => setKioskCycle(e.target.value)}
                        style={{ width: '100%', background: '#f8f9fc', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, padding: '10px 12px', height: 38 }}>
                        <option value="">Select Cycle…</option>
                        {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: 10, color: '#606060', marginBottom: 4 }}>Classroom (Optional)</label>
                      <select className="select" value={kioskRoom} onChange={e => setKioskRoom(e.target.value)}
                        style={{ width: '100%', background: '#f8f9fc', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, padding: '10px 12px', height: 38 }}>
                        <option value="">All Classrooms</option>
                        {classrooms.map(r => <option key={r.id} value={r.id}>{r.room_no} ({r.block})</option>)}
                      </select>
                    </div>
                    <button
                      type="button" className="btn" onClick={handleLaunchKiosk} disabled={!kioskCycle}
                      style={{ width: '100%', justifyContent: 'center', minHeight: 38, fontSize: 12, background: '#6200ea', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', marginTop: 4, boxShadow: '0 8px 20px rgba(98,0,234,0.18)' }}
                    >
                      LAUNCH KIOSK DISPLAY
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f1f3f7', paddingTop: 18 }}>
            <span style={{ fontSize: 8, color: '#aaa', fontWeight: 700, letterSpacing: '0.05em' }}>SECURE AUTH</span>
            <span style={{ fontSize: 8, color: '#aaa', fontWeight: 700, letterSpacing: '0.05em' }}>RBAC ENABLED</span>
            <span style={{ fontSize: 8, color: '#aaa', fontWeight: 700, letterSpacing: '0.05em' }}>SSL ENCRYPTED</span>
          </div>
        </div>
      </div>
    </div>
  );
}
