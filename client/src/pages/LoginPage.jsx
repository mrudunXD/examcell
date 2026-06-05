import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../store/index.js';
import toast from 'react-hot-toast';

const today = new Date().toLocaleDateString('en-GB', {
  weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
});

export default function LoginPage() {
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(email, password);
    if (result.success) { toast.success('Signed in'); navigate('/'); }
    else toast.error(result.error);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F9F9F7',
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4' viewBox='0 0 4 4'%3E%3Cpath fill='%23111111' fill-opacity='0.04' d='M1 3h1v1H1V3zm2-2h1v1H3V1z'%3E%3C/path%3E%3C/svg%3E")`,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Top rule */}
      <div style={{ height: 4, background: '#111111' }} />

      {/* Masthead */}
      <header style={{
        borderBottom: '4px solid #111111',
        padding: '24px 40px 20px',
        textAlign: 'center',
      }}>
        <div style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9,
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
          color: '#737373',
          marginBottom: 14,
        }}>
          MIT World Peace University · Examination Cell · {today}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <div style={{
            width: 1, height: 40,
            background: '#111111',
          }} />
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 48,
            fontWeight: 900,
            color: '#111111',
            letterSpacing: '-0.03em',
            lineHeight: 1,
            margin: 0,
          }}>
            Exam Management
          </h1>
          <div style={{ width: 1, height: 40, background: '#111111' }} />
        </div>

        <div style={{
          fontFamily: "'Playfair Display', serif",
          fontSize: 13,
          fontStyle: 'italic',
          color: '#525252',
          marginTop: 8,
        }}>
          "All the News That's Fit to Print" — Internal Operations System
        </div>
      </header>

      {/* Three-column layout */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 400px 1fr',
        borderBottom: '1px solid #111111',
        maxWidth: 1100,
        margin: '0 auto',
        width: '100%',
      }}>
        {/* Left column — system info */}
        <div style={{
          borderRight: '1px solid #111111',
          padding: '32px 28px',
        }}>
          <div className="section-label" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#737373', borderBottom: '1px solid #E5E5E0', paddingBottom: 8, marginBottom: 16 }}>
            System Info
          </div>

          {[
            ['Version', 'v1.0 — June 2026'],
            ['Scheme', 'MSBTE K Scheme'],
            ['Access', 'Internal Only'],
            ['Status', 'Operational'],
          ].map(([key, val]) => (
            <div key={key} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid #E5E5E0' }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#A3A3A3' }}>{key}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#111111', marginTop: 3 }}>{val}</div>
            </div>
          ))}

          <div style={{
            marginTop: 24,
            padding: '10px 12px',
            background: '#111111',
            color: '#F9F9F7',
          }}>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.45)', marginBottom: 6 }}>
              Default Credentials
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
              admin@mitwpu.edu.in<br />
              admin123
            </div>
          </div>
        </div>

        {/* Centre column — Login form */}
        <div style={{
          borderRight: '1px solid #111111',
          padding: '40px 36px',
        }}>
          <div style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 22,
            fontWeight: 700,
            color: '#111111',
            marginBottom: 6,
          }}>
            Sign In
          </div>
          <div style={{
            width: 32, height: 3,
            background: '#CC0000',
            marginBottom: 28,
          }} />

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
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
                  style={{ paddingRight: 36 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  style={{
                    position: 'absolute', right: 6, top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none',
                    color: '#737373', cursor: 'pointer',
                    display: 'flex', alignItems: 'center',
                    padding: 4,
                  }}
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                >
                  {showPwd ? <EyeOff size={14} strokeWidth={1.5} /> : <Eye size={14} strokeWidth={1.5} />}
                </button>
              </div>
            </div>

            <button
              id="login-submit"
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={isLoading}
              style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
            >
              {isLoading
                ? <><div className="spinner spinner-invert" style={{ width: 14, height: 14 }} /> Signing in…</>
                : 'Sign In to ExamCell'}
            </button>
          </form>
        </div>

        {/* Right column — notice / about */}
        <div style={{ padding: '32px 28px' }}>
          <div className="section-label" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#737373', borderBottom: '1px solid #E5E5E0', paddingBottom: 8, marginBottom: 16 }}>
            Features
          </div>

          {[
            'Seating arrangement generation',
            'Branch-interleaved bench allocation',
            'Supervisor duty assignment',
            'Conflict detection & resolution',
            'PDF export: seating, duty, timetable',
            'CSV bulk student import',
            'Audit trail on all changes',
            'Faculty duty acknowledgement',
          ].map((f, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 8,
              paddingBottom: 10, marginBottom: 10,
              borderBottom: '1px solid #E5E5E0',
              fontFamily: "'Inter', sans-serif",
              fontSize: 12, color: '#404040',
            }}>
              <div style={{ width: 4, height: 4, background: '#CC0000', flexShrink: 0, marginTop: 5 }} />
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Footer rule */}
      <div style={{
        borderTop: '1px solid #E5E5E0',
        padding: '12px 40px',
        display: 'flex',
        justifyContent: 'space-between',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 9,
        color: '#A3A3A3',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
      }}>
        <span>MIT WPU Examination Cell</span>
        <span>Restricted Access · Internal Use Only</span>
        <span>Pune, Maharashtra · India</span>
      </div>
    </div>
  );
}
