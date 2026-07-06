import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Eye, EyeOff, Shield, BookOpen, Users, FileDown, Mail, Lock } from 'lucide-react';
import { useAuthStore } from '../store/index.js';
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
  const login = useAuthStore(state => state.login);
  const isLoading = useAuthStore(state => state.isLoading);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  // MFA States
  const [totpToken, setTotpToken] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaEnrollRequired, setMfaEnrollRequired] = useState(false);
  const [mfaEnrollData, setMfaEnrollData] = useState(null);

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
    const result = await login(email, password, totpToken || null);
    if (result.success) {
      if (result.mfaRequired) {
        setMfaRequired(true);
        setTotpToken('');
        toast.success('Please enter your 2FA verification code');
      } else if (result.mfaEnrollmentRequired) {
        setMfaEnrollRequired(true);
        setMfaEnrollData({ secret: result.secret, otpauthUrl: result.otpauthUrl });
        setTotpToken('');
        toast.success('Please enroll in Multi-Factor Authentication');
      } else {
        toast.success('Signed in successfully');
        navigate('/');
      }
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-sans)',
      padding: 0,
    }}>
      {/* Background line waves animation */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, opacity: 0.25 }}>
        <LineWaves
          speed={0.4}
          innerLineCount={40}
          outerLineCount={45}
          warpIntensity={1.2}
          rotation={-35}
          edgeFadeWidth={0.0}
          colorCycleSpeed={0.8}
          brightness={0.3}
          color1="#8b5cf6"
          color2="#3b82f6"
          color3="#a78bfa"
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
        boxShadow: 'none',
        position: 'relative',
      }}>
        {/* Left panel — branding */}
        <div style={{
          padding: '64px',
          background: 'rgba(5, 5, 5, 0.45)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderRight: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: '100vh',
          overflowY: 'auto',
        }}>
          {/* Logo */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: 'rgba(59,130,246,0.1)',
                border: '1px solid rgba(59,130,246,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <GraduationCap size={18} strokeWidth={1.5} color="var(--accent-blue)" />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>ExamCell</div>
                <div style={{ fontSize: 9, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>MIT WPU</div>
              </div>
            </div>

            <h1 style={{
              fontSize: 32, fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.03em',
              lineHeight: 1.2,
              margin: '0 0 16px',
            }}>
              Examination<br />Management<br />System
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 320, margin: '0 0 40px' }}>
              Internal operations platform for MIT WPU Examination Cell. Manage seating, supervisors, and exam logistics.
            </p>

            {/* Features */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {features.map(({ icon: Icon, text }) => (
                <div key={text} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '14px 18px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.04)',
                  borderRadius: 12,
                  transition: 'all 0.2s',
                }} className="hover-card">
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon size={15} strokeWidth={1.5} color="var(--accent-blue)" />
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* System info */}
          <div style={{
            marginTop: 40,
            padding: '14px 16px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 12,
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              System Status
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                ['Version', 'v1.0 · June 2026'],
                ['Status', 'Operational'],
                ['Scheme', 'MSBTE K Scheme'],
                ['Access', 'Internal Only'],
              ].map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{k}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right panel — login form */}
        <div style={{
          padding: '64px 48px',
          background: 'rgba(11, 11, 14, 0.65)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          height: '100vh',
          overflowY: 'auto',
        }}>
          <div style={{ marginBottom: 36 }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: 6 }}>
              Sign in
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Use your credentials to access your dashboard.
            </div>
          </div>

          {mfaEnrollRequired && mfaEnrollData ? (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ background: '#FFF', padding: 10, borderRadius: 8, display: 'flex', justifyContent: 'center', alignSelf: 'center', marginBottom: 10 }}>
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(mfaEnrollData.otpauthUrl)}`} 
                  alt="MFA QR Code" 
                  style={{ display: 'block', width: 150, height: 150 }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12.5 }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>1. Scan QR Code or enter manual key</span>
                <span style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>Scan the QR code with Google Authenticator or enter the manual setup secret:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '8px 12px', borderRadius: 8, color: 'var(--accent-purple)', fontWeight: 600, textAlign: 'center', letterSpacing: '0.05em' }}>
                  {mfaEnrollData.secret}
                </span>
              </div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid var(--border-faint)', paddingTop: 18 }}>
                <label className="form-label" htmlFor="mfaTokenEnroll">2. Enter 6-Digit Verification Code</label>
                <input
                  id="mfaTokenEnroll"
                  type="text"
                  className="input"
                  placeholder="000000"
                  value={totpToken}
                  onChange={e => setTotpToken(e.target.value)}
                  required
                  maxLength={6}
                  autoFocus
                  style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', letterSpacing: '0.2em', fontSize: 16 }}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', minHeight: 44, fontSize: 13, marginTop: 4, background: 'linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%)', border: 'none', fontWeight: 600 }}>
                {isLoading ? 'Verifying & Activating...' : 'Verify and Activate 2FA'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => { setMfaEnrollRequired(false); setMfaEnrollData(null); setTotpToken(''); }} style={{ width: '100%', justifyContent: 'center' }}>
                Cancel
              </button>
            </form>
          ) : mfaRequired ? (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.25)', padding: '14px 18px', borderRadius: 10, marginBottom: 10 }}>
                <Shield size={20} color="var(--accent-purple)" />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>MFA Verification Required</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Enter the code generated by your authenticator app.</div>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="mfaToken">6-Digit Verification Code</label>
                <input
                  id="mfaToken"
                  type="text"
                  className="input"
                  placeholder="000000"
                  value={totpToken}
                  onChange={e => setTotpToken(e.target.value)}
                  required
                  maxLength={6}
                  autoFocus
                  style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', letterSpacing: '0.2em', fontSize: 16 }}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', minHeight: 44, fontSize: 13, marginTop: 4, background: 'linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%)', border: 'none', fontWeight: 600 }}>
                {isLoading ? 'Verifying...' : 'Verify Code'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => { setMfaRequired(false); setTotpToken(''); }} style={{ width: '100%', justifyContent: 'center' }}>
                Cancel
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="form-group">
                <label className="form-label" htmlFor="email">Email Address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', zIndex: 2 }} />
                  <input
                    id="email"
                    type="email"
                    className="input"
                    placeholder="you@mitwpu.edu.in"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoFocus
                    style={{ paddingLeft: 38 }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="password">Password</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', zIndex: 2 }} />
                  <input
                    id="password"
                    type={showPwd ? 'text' : 'password'}
                    className="input"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    style={{ paddingLeft: 38, paddingRight: 40 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    style={{
                      position: 'absolute', right: 10, top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none', border: 'none',
                      color: 'var(--text-secondary)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', padding: 4,
                      zIndex: 2
                    }}
                    aria-label={showPwd ? 'Hide password' : 'Show password'}
                  >
                    {showPwd ? <EyeOff size={14} strokeWidth={1.5} /> : <Eye size={14} strokeWidth={1.5} />}
                  </button>
                </div>
              </div>

              {/* Default creds hint */}
              <div style={{
                padding: '12px 16px',
                background: 'rgba(0, 0, 0, 0.2)',
                border: '1px solid var(--border)',
                borderRadius: 12,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
                    Default Credentials
                  </div>
                  <button
                    type="button"
                    onClick={() => { setEmail('admin@mitwpu.edu.in'); setPassword('admin123'); }}
                    style={{
                      fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
                      background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)',
                      color: '#c084fc', cursor: 'pointer', padding: '2px 8px',
                      letterSpacing: '0.05em',
                    }}
                  >
                    AUTO-FILL
                  </button>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  admin@mitwpu.edu.in<br />admin123
                </div>
              </div>

              <button
                id="login-submit"
                type="submit"
                className="btn btn-primary"
                disabled={isLoading}
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  minHeight: 44,
                  fontSize: 13,
                  marginTop: 4,
                  background: 'linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%)',
                  border: 'none',
                  boxShadow: '0 4px 12px rgba(124, 58, 237, 0.2)',
                  fontWeight: 600
                }}
              >
                {isLoading
                  ? <><div className="spinner spinner-invert" style={{ width: 14, height: 14 }} /> Signing in…</>
                  : 'Sign In to ExamCell'}
              </button>
            </form>
          )}

          {/* Kiosk launcher */}
          <div style={{
            marginTop: 32,
            padding: '20px',
            background: 'rgba(255, 255, 255, 0.01)',
            border: '1px solid rgba(255, 255, 255, 0.04)',
            borderRadius: 12,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
              Smartboard Kiosk Mode
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16 }}>
              Launch kiosk display for smartboards or door screens.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>Exam Cycle</label>
                <select className="select" value={kioskCycle} onChange={e => setKioskCycle(e.target.value)} style={{ padding: '7px 10px', fontSize: 12 }}>
                  <option value="">Select Cycle...</option>
                  {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>Room (Optional)</label>
                <select className="select" value={kioskRoom} onChange={e => setKioskRoom(e.target.value)} style={{ padding: '7px 10px', fontSize: 12 }}>
                  <option value="">All Rooms</option>
                  {classrooms.map(r => <option key={r.id} value={r.id}>{r.room_no} ({r.block})</option>)}
                </select>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleLaunchKiosk}
              style={{ width: '100%', justifyContent: 'center', fontSize: 12, border: '1px solid var(--border)', fontWeight: 500 }}
              disabled={!kioskCycle}
            >
              Launch Kiosk Display
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
        fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)',
        textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap',
      }}>
        MIT WPU Examination Cell · {today} · Restricted Access
      </div>
    </div>
  );
}




