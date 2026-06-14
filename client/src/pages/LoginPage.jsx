import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Eye, EyeOff, Shield, BookOpen, Users, FileDown } from 'lucide-react';
import { useAuthStore } from '../store/index.js';
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

export default function LoginPage() {
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);

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
      background: '#080809',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-sans)',
      padding: '32px 20px',
    }}>
      {/* Background pattern */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(10,132,255,0.04) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(48,209,88,0.03) 0%, transparent 50%)',
      }} />

      <div style={{
        width: '100%', maxWidth: 960,
        display: 'grid',
        gridTemplateColumns: '1fr 420px',
        gap: 0,
        background: '#111113',
        border: '1px solid #222225',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        position: 'relative',
      }}>
        {/* Left panel — branding */}
        <div style={{
          padding: '52px 48px',
          background: '#0C0C0E',
          borderRight: '1px solid #1C1C1F',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          {/* Logo */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: 'rgba(10,132,255,0.15)',
                border: '1px solid rgba(10,132,255,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <GraduationCap size={18} strokeWidth={1.5} color="#0A84FF" />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.01em' }}>ExamCell</div>
                <div style={{ fontSize: 10, color: '#4A4A4F', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>MIT WPU</div>
              </div>
            </div>

            <h1 style={{
              fontSize: 36, fontWeight: 800,
              color: '#FFFFFF',
              letterSpacing: '-0.03em',
              lineHeight: 1.15,
              margin: '0 0 16px',
            }}>
              Examination<br />Management<br />System
            </h1>
            <p style={{ fontSize: 14, color: '#8E8E93', lineHeight: 1.6, maxWidth: 320, margin: '0 0 40px' }}>
              Internal operations platform for MIT WPU Examination Cell. Manage seating, supervisors, and exam logistics.
            </p>

            {/* Features */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {features.map(({ icon: Icon, text }) => (
                <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 6,
                    background: '#1C1C1F',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Icon size={13} strokeWidth={1.5} color="#8E8E93" />
                  </div>
                  <span style={{ fontSize: 13, color: '#8E8E93' }}>{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* System info */}
          <div style={{
            marginTop: 40,
            padding: '14px 16px',
            background: '#0A0A0C',
            border: '1px solid #1C1C1F',
            borderRadius: 8,
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#4A4A4F', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              System
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                ['Version', 'v1.0 · June 2026'],
                ['Status', 'Operational'],
                ['Scheme', 'MSBTE K Scheme'],
                ['Access', 'Internal Only'],
              ].map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#3A3A3C', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{k}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#767680', marginTop: 2 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right panel — login form */}
        <div style={{ padding: '52px 44px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ marginBottom: 36 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.02em', marginBottom: 6 }}>
              Sign in
            </div>
            <div style={{ fontSize: 13, color: '#8E8E93' }}>
              Use your institutional credentials
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                className="input"
                placeholder="you@mitwpu.edu.in"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  type={showPwd ? 'text' : 'password'}
                  className="input"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={{ paddingRight: 40 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  style={{
                    position: 'absolute', right: 10, top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none',
                    color: '#8E8E93', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', padding: 4,
                  }}
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                >
                  {showPwd ? <EyeOff size={14} strokeWidth={1.5} /> : <Eye size={14} strokeWidth={1.5} />}
                </button>
              </div>
            </div>

            {/* Default creds hint */}
            <div style={{
              padding: '10px 14px',
              background: 'rgba(10,132,255,0.06)',
              border: '1px solid rgba(10,132,255,0.15)',
              borderRadius: 8,
            }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#0A84FF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                Default Credentials
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#A3A3AC' }}>
                admin@mitwpu.edu.in<br />admin123
              </div>
            </div>

            <button
              id="login-submit"
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
              style={{ width: '100%', justifyContent: 'center', minHeight: 44, fontSize: 14, marginTop: 4 }}
            >
              {isLoading
                ? <><div className="spinner spinner-invert" style={{ width: 14, height: 14 }} /> Signing in…</>
                : 'Sign In to ExamCell'}
            </button>
          </form>

          {/* Kiosk launcher */}
          <div style={{ marginTop: 28, paddingTop: 24, borderTop: '1px solid #1C1C1F' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#E5E5EA', marginBottom: 4 }}>
              Smartboard Kiosk Mode
            </div>
            <div style={{ fontSize: 12, color: '#4A4A4F', marginBottom: 14 }}>
              Launch kiosk display for smartboards or door screens.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 10 }}>Exam Cycle</label>
                <select className="select" value={kioskCycle} onChange={e => setKioskCycle(e.target.value)} style={{ padding: '7px 10px', fontSize: 12 }}>
                  <option value="">Select Cycle...</option>
                  {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: 10 }}>Room (Optional)</label>
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
              style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}
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
        fontFamily: 'var(--font-mono)', fontSize: 10, color: '#2A2A2E',
        textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap',
      }}>
        MIT WPU Examination Cell · {today} · Restricted Access
      </div>
    </div>
  );
}

