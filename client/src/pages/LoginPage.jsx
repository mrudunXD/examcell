import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../store/index.js';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(email, password);
    if (result.success) {
      toast.success('Welcome back!');
      navigate('/');
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a1628 0%, #0f2044 50%, #0d1b38 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden', padding: 20
    }}>
      {/* Background orbs */}
      <div style={{
        position: 'absolute', width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)',
        top: -100, right: -100, pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute', width: 300, height: 300, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)',
        bottom: -80, left: -80, pointerEvents: 'none'
      }} />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 60, height: 60, borderRadius: 16,
            background: 'linear-gradient(135deg, #3b82f6, #1e40af)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px', boxShadow: '0 0 30px rgba(59,130,246,0.35)'
          }}>
            <GraduationCap size={30} color="white" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'white', marginBottom: 4, letterSpacing: '-0.02em' }}>
            Exam Management System
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
            MIT World Peace University, Pune
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(31,41,55,0.7)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 20,
          padding: 32,
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)'
        }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 24 }}>Sign in to your account</h2>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                  style={{ paddingRight: 42 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--color-text-muted)',
                    cursor: 'pointer', display: 'flex', alignItems: 'center'
                  }}
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              id="login-submit"
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={isLoading}
              style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
            >
              {isLoading ? <><div className="spinner" style={{ width: 16, height: 16 }} /> Signing in…</> : 'Sign In'}
            </button>
          </form>

          <div style={{ marginTop: 20, padding: 12, background: 'rgba(59,130,246,0.08)', borderRadius: 8, border: '1px solid rgba(59,130,246,0.15)' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>Default credentials</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
              <span style={{ fontWeight: 600 }}>Coordinator:</span> admin@mitwpu.edu.in / admin123
            </div>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 20 }}>
          MIT WPU Examination Cell · Internal System · v1.0
        </p>
      </div>
    </div>
  );
}
