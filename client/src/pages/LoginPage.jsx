import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Shield, BookOpen, Users, FileDown, Mail, Lock, Sun, Moon, ArrowLeft, Menu, X, ArrowRight, CheckCircle2, ChevronRight, Play, Check, AlertTriangle, Radio } from 'lucide-react';
import { useAuthStore, useAppStore } from '../store/index.js';
import api from '../lib/api.js';
import toast from 'react-hot-toast';
import WireframeCanvas from '../components/WireframeCanvas.jsx';

/* ─── Helper: Animated Counter ─────────────────────────────────────── */
function AnimatedCounter({ to, suffix = '', duration = 1500 }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = parseFloat(to);
    if (start === end) return;

    const totalMiliseconds = duration;
    const incrementTime = Math.max(Math.floor(totalMiliseconds / end), 20);
    
    const timer = setInterval(() => {
      start += Math.ceil(end / (totalMiliseconds / incrementTime));
      if (start >= end) {
        clearInterval(timer);
        setCount(end);
      } else {
        setCount(start);
      }
    }, incrementTime);

    return () => clearInterval(timer);
  }, [to, duration]);

  const formatted = typeof to === 'number' && to % 1 !== 0 
    ? count.toFixed(2) 
    : count;

  return <span>{formatted}{suffix}</span>;
}

/* ─── Helper: Interactive Background Canvas ────────────────────────── */
function LandingBackground() {
  const canvasRef = useRef(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    // Create particles
    const particles = [];
    const particleCount = 40;
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 2 + 1,
        d: Math.random() * 0.4 + 0.1,
        dx: (Math.random() - 0.5) * 0.3,
        dy: (Math.random() - 0.5) * 0.3,
      });
    }

    const handleMouseMove = (e) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handleMouseMove);

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw grid with low opacity
      ctx.strokeStyle = 'rgba(22, 184, 151, 0.03)';
      ctx.lineWidth = 1;
      const gridSize = 60;
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Mouse Spotlight Glow
      const mouse = mouseRef.current;
      const glowGrad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 350);
      glowGrad.addColorStop(0, 'rgba(22, 184, 151, 0.05)');
      glowGrad.addColorStop(1, 'rgba(22, 184, 151, 0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw and update particles
      ctx.fillStyle = 'rgba(22, 184, 151, 0.12)';
      particles.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();

        p.x += p.dx;
        p.y += p.dy;

        // Wrap boundaries
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
      });

      animationFrameId = requestAnimationFrame(render);
    };
    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}

/* ─── Main Landing Page / LoginPage ───────────────────────────────── */
export default function LoginPage() {
  const { login, isLoading } = useAuthStore();
  const { theme, toggleTheme } = useAppStore();
  const navigate = useNavigate();
  
  // Login Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [activeTab, setActiveTab] = useState('operator');
  const [showLoginForm, setShowLoginForm] = useState(false);

  // Kiosk Initial states
  const [cycles, setCycles] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [kioskCycle, setKioskCycle] = useState('');
  const [kioskRoom, setKioskRoom] = useState('');

  // Scroll Position for sticky nav size reduction
  const [scrolled, setScrolled] = useState(false);

  // Heatmap Demo Interaction States
  const [hoveredFaculty, setHoveredFaculty] = useState(null);

  // Testimonials slider state
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  const testimonials = [
    {
      quote: "ExamCell completely streamlined our scheduling process. Conflict detection that used to take days now finishes in minutes.",
      author: "Dr. Rajesh Patil",
      role: "Dean of Academics, MIT WPU"
    },
    {
      quote: "The smartboard kiosk integration is brilliant. Students can see their seat maps instantly as they enter the exam blocks.",
      author: "Prof. Sunita Deshmukh",
      role: "Controller of Examinations"
    },
    {
      quote: "Invigilator duties are balanced perfectly now. The load heatmap ensures fair allocation across all departments.",
      author: "Dr. Amit Shinde",
      role: "Registrar"
    }
  ];

  useEffect(() => {
    api.get('/public/kiosk-init')
      .then(res => {
        setCycles(res.data.cycles || []);
        setClassrooms(res.data.classrooms || []);
        if (res.data.cycles?.length > 0) setKioskCycle(res.data.cycles[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto scroll testimonials
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLaunchKiosk = () => {
    if (!kioskCycle) return;
    const url = `/kiosk/${kioskCycle}${kioskRoom ? `?classroomId=${kioskRoom}` : ''}`;
    window.open(url, '_blank');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(email, password);
    if (result.success) {
      toast.success('Signed in successfully');
      navigate('/');
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#FAFAFA',
      color: '#111111',
      fontFamily: 'var(--font-sans)',
      position: 'relative',
      overflowX: 'hidden',
    }}>
      {/* Premium Background Layer */}
      <LandingBackground />

      <style>{`
        /* Smooth Scrolling */
        html { scroll-behavior: smooth; }

        /* Aurora Blurred Blobs */
        .aurora-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(120px);
          opacity: 0.25;
          z-index: 0;
          pointer-events: none;
          animation: floatBlob 16s ease-in-out infinite alternate;
        }
        @keyframes floatBlob {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(40px, 60px) scale(1.1); }
        }

        /* Glassmorphism Navigation */
        .nav-glass {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(20px) saturate(180%);
          border-bottom: 1px solid rgba(22, 184, 151, 0.08);
          box-shadow: 0 4px 30px rgba(0, 0, 0, 0.02);
        }

        /* Stagger animations */
        .hover-lift {
          transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease, border-color 0.25s ease;
        }
        .hover-lift:hover {
          transform: translateY(-4px) scale(1.01);
          border-color: rgba(22, 184, 151, 0.3);
          box-shadow: 0 12px 30px rgba(22, 184, 151, 0.06);
        }

        /* Spring animation classes */
        .spring-btn {
          transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.3s ease;
        }
        .spring-btn:hover {
          transform: scale(1.04);
        }
        .spring-btn:active {
          transform: scale(0.97);
        }

        /* Faculty workload heatmap grid cells */
        .heatmap-cell {
          transition: background-color 0.3s ease, transform 0.2s ease;
          cursor: pointer;
        }
        .heatmap-cell:hover {
          transform: scale(1.15);
          z-index: 10;
          box-shadow: 0 4px 10px rgba(22, 184, 151, 0.2);
        }

        /* Timeline path dashes animation */
        @keyframes dash {
          to { stroke-dashoffset: -40; }
        }
        .anim-dash {
          stroke-dasharray: 8;
          animation: dash 2s linear infinite;
        }
      `}</style>

      {/* Aurora Lighting Effects */}
      <div className="aurora-blob" style={{ top: '10%', left: '15%', width: '450px', height: '450px', background: '#16B897' }} />
      <div className="aurora-blob" style={{ top: '35%', right: '10%', width: '400px', height: '400px', background: '#10B981', animationDelay: '-4s' }} />
      <div className="aurora-blob" style={{ bottom: '15%', left: '20%', width: '500px', height: '500px', background: '#0d9488', animationDelay: '-8s' }} />

      {/* ─── NAVIGATION BAR ─────────────────────────────────────────── */}
      <nav className={`nav-glass`} style={{
        position: 'sticky',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        height: scrolled ? 60 : 76,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 40px',
        transition: 'height 0.3s cubic-bezier(0.16, 1, 0.3, 1), background 0.3s',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => window.scrollTo(0, 0)}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'linear-gradient(135deg, #16B897, #10B981)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: 13
          }}>
            EC
          </div>
          <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em', color: '#111111' }}>
            ExamCell
          </span>
        </div>

        {/* Links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, fontSize: 13, fontWeight: 600 }}>
          {['Features', 'Solutions', 'Pricing', 'Documentation', 'Contact'].map(link => (
            <a key={link} href={`#${link.toLowerCase()}`} style={{ color: '#555555', textDecoration: 'none', transition: 'color 0.2s' }}
               onMouseEnter={e => e.target.style.color = '#16B897'}
               onMouseLeave={e => e.target.style.color = '#555555'}>
              {link}
            </a>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button 
            onClick={() => setShowLoginForm(true)}
            className="spring-btn"
            style={{
              background: 'transparent', border: 'none', color: '#111111',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: '8px 16px'
            }}
          >
            Sign In
          </button>
          <button 
            onClick={() => setShowLoginForm(true)}
            className="spring-btn"
            style={{
              background: '#16B897', color: '#ffffff', border: 'none',
              borderRadius: 20, padding: '8px 20px', fontSize: 13, fontWeight: 700,
              cursor: 'pointer', boxShadow: '0 4px 12px rgba(22, 184, 151, 0.2)',
            }}
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* ─── HERO SECTION ───────────────────────────────────────────── */}
      <section style={{
        padding: '100px 40px 60px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Mini tag */}
        <div style={{
          background: 'rgba(22, 184, 151, 0.08)',
          border: '1px solid rgba(22, 184, 151, 0.15)',
          borderRadius: 20,
          padding: '6px 16px',
          fontSize: 11,
          fontWeight: 700,
          color: '#16B897',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 24,
        }}>
          <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#16B897' }} />
          Introducing AI-Driven Timetabling 2.0
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: '72px',
          fontWeight: 900,
          letterSpacing: '-0.04em',
          lineHeight: 1.05,
          color: '#111111',
          maxWidth: 900,
          margin: 0,
        }}>
          Examinations.<br />
          <span style={{
            background: 'linear-gradient(90deg, #16B897, #10B981)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>Reimagined.</span>
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: '18px',
          color: '#555555',
          maxWidth: 620,
          lineHeight: 1.6,
          marginTop: 24,
          marginBottom: 36,
          fontWeight: 500,
        }}>
          AI-powered examination management that automates scheduling, faculty allocation, seating plans, classroom broadcasts and institutional analytics.
        </p>

        {/* CTA Buttons */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 80 }}>
          <button 
            onClick={() => setShowLoginForm(true)}
            className="spring-btn"
            style={{
              background: '#16B897', color: '#ffffff', border: 'none',
              borderRadius: 24, padding: '14px 36px', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', boxShadow: '0 8px 24px rgba(22, 184, 151, 0.25)',
              display: 'flex', alignItems: 'center', gap: 8
            }}
          >
            Generate Schedule <ArrowRight size={16} />
          </button>
          <a 
            href="#preview"
            className="spring-btn"
            style={{
              background: '#ffffff', color: '#111111', border: '1px solid rgba(22, 184, 151, 0.15)',
              borderRadius: 24, padding: '14px 36px', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: '0 4px 12px rgba(0,0,0,0.02)'
            }}
          >
            Explore Dashboard
          </a>
        </div>

        {/* ─── Hero interactive showcase block ─── */}
        <div style={{
          width: '100%',
          maxWidth: 1100,
          position: 'relative',
          display: 'grid',
          gridTemplateColumns: '1.2fr 1fr',
          gap: 40,
          textAlign: 'left',
          alignItems: 'center',
          background: 'rgba(255, 255, 255, 0.65)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(22, 184, 151, 0.08)',
          borderRadius: 24,
          padding: 40,
          boxShadow: '0 32px 80px rgba(0, 0, 0, 0.03)',
        }}>
          {/* Left: Three.js Wireframe Visualizer */}
          <div style={{
            height: 400,
            background: '#050a0a',
            borderRadius: 16,
            overflow: 'hidden',
            position: 'relative',
            border: '1px solid rgba(22, 184, 151, 0.1)',
          }}>
            {/* Visualizer header */}
            <div style={{
              position: 'absolute', top: 16, left: 16, zIndex: 10,
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(5, 12, 12, 0.6)', padding: '6px 12px', borderRadius: 8,
              border: '1px solid rgba(22, 184, 151, 0.1)'
            }}>
              <Radio size={12} style={{ color: '#16B897' }} className="animate-pulse" />
              <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontWeight: 700 }}>
                SCHEDULER ENGINE TELEMETRY
              </span>
            </div>
            
            <WireframeCanvas style={{ width: '100%', height: '100%' }} />
          </div>

          {/* Right: Floating dynamic widgets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <h3 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
              Autonomous Constraint Solver
            </h3>
            <p style={{ fontSize: 14, color: '#555555', lineHeight: 1.6, margin: 0 }}>
              The core engine leverages recursive graph coloring to guarantee conflict-free bench layout allocations and optimized invigilator rotas instantly.
            </p>

            {/* Simulated Live Broadcast Event */}
            <div style={{
              background: 'rgba(22, 184, 151, 0.05)',
              border: '1px solid rgba(22, 184, 151, 0.15)',
              borderRadius: 12,
              padding: 16,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', background: 'rgba(22,184,151,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <Radio size={13} style={{ color: '#16B897' }} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#111111' }}>Live Smartboard Telemetry Broadcast</div>
                <div style={{ fontSize: 11, color: '#555555', marginTop: 2 }}>Room B-203 has successfully marked all seating layout templates active.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── METRICS SECTION ─────────────────────────────────────────── */}
      <section style={{
        padding: '60px 40px',
        background: 'rgba(255, 255, 255, 0.4)',
        borderTop: '1px solid rgba(22, 184, 151, 0.05)',
        borderBottom: '1px solid rgba(22, 184, 151, 0.05)',
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{
          maxWidth: 1100,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 20,
          textAlign: 'center',
        }}>
          {[
            { value: 84, label: 'Faculty Active', suffix: '' },
            { value: 3500, label: 'Students Seated', suffix: '+' },
            { value: 512, label: 'Exams Run', suffix: '' },
            { value: 50, label: 'Classrooms Configured', suffix: '' },
            { value: 99.98, label: 'Uptime SLA', suffix: '%' }
          ].map((metric, i) => (
            <div key={i}>
              <div style={{ fontSize: '36px', fontWeight: 900, color: '#16B897', letterSpacing: '-0.02em', fontFamily: 'var(--font-mono)' }}>
                <AnimatedCounter to={metric.value} suffix={metric.suffix} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#555555', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>
                {metric.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FEATURES SECTION ────────────────────────────────────────── */}
      <section id="features" style={{
        padding: '100px 40px',
        maxWidth: 1100,
        margin: '0 auto',
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 60 }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', margin: 0 }}>
            Designed for Modern Institutions
          </h2>
          <p style={{ fontSize: 14, color: '#555555', marginTop: 8 }}>
            Ditch the legacy spreadsheets. Welcome to autonomous administrative planning.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 24,
        }}>
          {[
            { icon: Cpu, title: 'AI Timetable Generator', desc: 'Optimize schedule slots based on student registration and classroom availability automatically.' },
            { icon: Users, title: 'Smart Seating & Layouts', desc: 'Configure rows, columns, and spacing rules to seat students without conflicts.' },
            { icon: Radio, title: 'Classroom Broadcasts', desc: 'Dispatch instant updates, notices, and exam corrections directly to smartboard kiosk screens.' },
            { icon: Shield, title: 'Conflict Detection', desc: 'Catch duplicate seating assignments, classroom overflow, and faculty clashes prior to execution.' },
            { icon: FileDown, title: 'Export & Print Slips', desc: 'One-click exports for seating charts, invigilator timetables, and print-ready PDFs.' },
            { icon: Monitor, title: 'Smartboard Kiosk Mode', desc: 'Standalone full-screen display terminal for students to search room allocations on exam days.' }
          ].map((feat, i) => (
            <div key={i} className="hover-lift" style={{
              background: '#ffffff',
              border: '1px solid rgba(22, 184, 151, 0.08)',
              borderRadius: 20,
              padding: 32,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              boxShadow: '0 4px 20px rgba(0,0,0,0.01)',
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: 'rgba(22, 184, 151, 0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#16B897'
              }}>
                <feat.icon size={18} strokeWidth={1.8} />
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111111', margin: 0 }}>{feat.title}</h3>
              <p style={{ fontSize: 13, color: '#555555', lineHeight: 1.5, margin: 0 }}>{feat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── INTERACTIVE DASHBOARD PREVIEW ──────────────────────────── */}
      <section id="preview" style={{
        padding: '80px 40px',
        background: 'rgba(22, 184, 151, 0.02)',
        borderTop: '1px solid rgba(22, 184, 151, 0.05)',
        borderBottom: '1px solid rgba(22, 184, 151, 0.05)',
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40 }}>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', margin: 0 }}>Interactive Control Preview</h2>
            <p style={{ fontSize: 14, color: '#555555', marginTop: 8 }}>Explore the layout controls and real-time operations dashboard.</p>
          </div>

          {/* Laptop Frame Mockup */}
          <div style={{
            width: '100%',
            maxWidth: 960,
            background: '#cbd5e1',
            border: '12px solid #1e293b',
            borderRadius: '24px 24px 0 0',
            boxShadow: '0 32px 80px rgba(0, 0, 0, 0.12)',
            position: 'relative',
          }}>
            {/* Camera dot */}
            <div style={{ position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)', width: 6, height: 6, borderRadius: '50%', background: '#0f172a' }} />

            {/* Dashboard Inner Screen Mockup */}
            <div style={{
              background: '#f8fafc',
              padding: 24,
              minHeight: 480,
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              fontFamily: 'var(--font-sans)',
            }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(22, 184, 151, 0.08)', paddingBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111111' }}>Operations Control Center</div>
                  <div style={{ fontSize: 10, color: '#475569', marginTop: 2 }}>MIT WPU Campus Overview</div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, background: 'rgba(22, 184, 166, 0.15)', color: '#0d9488', borderRadius: 4, padding: '2px 8px', border: '1px solid rgba(22, 184, 151, 0.08)' }}>ACTIVE</span>
                </div>
              </div>

              {/* Grid 4 Columns */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                {[
                  { label: 'Exams Scheduled', val: '8 Slots', sub: 'running today' },
                  { label: 'Occupied Classrooms', val: '38 Rooms', sub: 'of 45 total h' },
                  { label: 'Faculty on Duty', val: '56 Members', sub: '4 alerts pending' },
                  { label: 'Smartboard Terminals', val: '3 Online', sub: 'kiosks broadcast' },
                ].map((wid, idx) => (
                  <div key={idx} style={{ background: '#ffffff', border: '1px solid rgba(22, 184, 151, 0.08)', borderRadius: 10, padding: 14 }}>
                    <div style={{ fontSize: 9, textTransform: 'uppercase', color: '#64748b' }}>{wid.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#111111', marginTop: 4 }}>{wid.val}</div>
                    <div style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>{wid.sub}</div>
                  </div>
                ))}
              </div>

              {/* Main row */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.3fr', gap: 20 }}>
                {/* Seating map preview */}
                <div style={{ background: '#ffffff', border: '1px solid rgba(22, 184, 151, 0.08)', borderRadius: 12, padding: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 12 }}>Room Allocation Layout Mapping</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
                    {Array.from({ length: 24 }).map((_, j) => (
                      <div key={j} style={{
                        height: 24, borderRadius: 4,
                        background: j % 5 === 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(22, 184, 151, 0.12)',
                        border: '1px solid rgba(22, 184, 151, 0.08)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 8, color: j % 5 === 0 ? '#ef4444' : '#16B897', fontWeight: 700
                      }}>
                        {j % 5 === 0 ? 'ABS' : `S-${j+1}`}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Broadcast Composer */}
                <div style={{ background: '#ffffff', border: '1px solid rgba(22, 184, 151, 0.08)', borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>Immediate Alert Notice</div>
                  <input className="input" placeholder="Title" value="Room Correction" disabled style={{ background: '#f8fafc', border: '1px solid rgba(22, 184, 151, 0.1)', fontSize: 11, padding: '6px 10px', height: 28 }} />
                  <textarea className="textarea" placeholder="Message details..." disabled style={{ background: '#f8fafc', border: '1px solid rgba(22, 184, 151, 0.1)', fontSize: 10, minHeight: 48, resize: 'none', padding: '6px 10px' }}>Notice: Q4 has a typo. Correct 'x' to 'y'.</textarea>
                  <button className="btn btn-primary btn-sm" disabled style={{ background: '#16B897', borderColor: '#16B897', cursor: 'not-allowed', justifyContent: 'center' }}>Dispatch Broadcast</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FACULTY HEATMAP DEMO ────────────────────────────────────── */}
      <section style={{
        padding: '100px 40px',
        maxWidth: 1100,
        margin: '0 auto',
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 60, alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', margin: 0 }}>
              Faculty Workload Heatmap
            </h2>
            <p style={{ fontSize: 14, color: '#555555', marginTop: 12, lineHeight: 1.6 }}>
              Prevent admin fatigue. View invigilation load distribution across your academic departments interactively. Hover over cells to see availability status.
            </p>

            {/* Live workload details card */}
            <div style={{
              background: 'rgba(22, 184, 151, 0.05)',
              border: '1px solid rgba(22, 184, 151, 0.15)',
              borderRadius: 16,
              padding: 24,
              marginTop: 28,
              minHeight: 120,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}>
              {hoveredFaculty ? (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#16B897', letterSpacing: '0.05em' }}>
                    Faculty Telemetry Block
                  </div>
                  <h4 style={{ fontSize: 16, fontWeight: 800, color: '#111111', margin: '4px 0' }}>{hoveredFaculty.name}</h4>
                  <div style={{ fontSize: 12, color: '#555555' }}>
                    Department: {hoveredFaculty.dept} | Current Assigned Load: {hoveredFaculty.load} hrs | Status: <span style={{ color: '#10B981', fontWeight: 700 }}>AVAILABLE</span>
                  </div>
                </div>
              ) : (
                <div style={{ color: '#555555', fontStyle: 'italic', fontSize: 13, textAlign: 'center' }}>
                  Hover over the heatmap cells to inspect invigilator status parameters.
                </div>
              )}
            </div>
          </div>

          {/* Interactive Heatmap Matrix */}
          <div style={{
            background: '#ffffff',
            border: '1px solid rgba(22, 184, 151, 0.08)',
            borderRadius: 16,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>INVIGILATOR ALLOCATION ROTAS</span>
              <span style={{ fontSize: 10, color: '#94a3b8' }}>9 departments loaded</span>
            </div>

            {/* Matrix grids */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { name: 'Dr. Amit Patil', dept: 'Computer Science', load: 12, cells: [3, 4, 2, 1, 0, 5] },
                { name: 'Prof. Sunita Rao', dept: 'Mechanical Eng.', load: 8, cells: [1, 2, 0, 4, 3, 2] },
                { name: 'Dr. John Miller', dept: 'Electrical Eng.', load: 16, cells: [5, 4, 5, 2, 1, 3] },
                { name: 'Prof. Rita Sen', dept: 'Civil Engineering', load: 6, cells: [0, 1, 2, 1, 0, 2] },
                { name: 'Dr. Sanjay Kelkar', dept: 'Physics Dept', load: 10, cells: [2, 3, 3, 4, 1, 0] },
              ].map((fac, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 120, fontSize: 12, fontWeight: 700, color: '#111111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {fac.name}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                    {fac.cells.map((c, cellIdx) => {
                      // Determine background color based on load severity (0-5 scale)
                      const colors = [
                        '#f1f5f9',
                        'rgba(22, 184, 151, 0.15)',
                        'rgba(22, 184, 151, 0.35)',
                        'rgba(22, 184, 151, 0.55)',
                        'rgba(22, 184, 151, 0.75)',
                        'rgba(22, 184, 151, 0.95)',
                      ];
                      return (
                        <div
                          key={cellIdx}
                          className="heatmap-cell"
                          onMouseEnter={() => setHoveredFaculty(fac)}
                          onMouseLeave={() => setHoveredFaculty(null)}
                          style={{
                            flex: 1,
                            height: 24,
                            background: colors[c],
                            border: '1px solid rgba(22, 184, 151, 0.08)',
                            borderRadius: 4,
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── AI SCHEDULING ANIMATION ────────────────────────────────── */}
      <section style={{
        padding: '80px 40px',
        background: 'rgba(22, 184, 151, 0.02)',
        borderTop: '1px solid rgba(22, 184, 151, 0.05)',
        borderBottom: '1px solid rgba(22, 184, 151, 0.05)',
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 60 }}>
            End-to-End Scheduling Pipeline
          </h2>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20, position: 'relative' }}>
            {/* SVG line linking them */}
            <svg style={{ position: 'absolute', top: 30, left: 50, right: 50, height: 4, zIndex: 0, pointerEvents: 'none' }}>
              <line x1="0" y1="2" x2="100%" y2="2" stroke="rgba(22, 184, 151, 0.2)" strokeWidth="2" />
              <line x1="0" y1="2" x2="100%" y2="2" stroke="#16B897" strokeWidth="2" className="anim-dash" />
            </svg>

            {[
              { step: '01', title: 'Import Datasets', desc: 'Sync candidate enrollments' },
              { step: '02', title: 'Generate Slots', desc: 'Construct timetable maps' },
              { step: '03', title: 'De-conflict', desc: 'Verify clash checks' },
              { step: '04', title: 'Assign Duties', desc: 'Allocate invigilators' },
              { step: '05', title: 'Smart Seating', desc: 'Map classroom benches' },
            ].map((st, i) => (
              <div key={i} style={{
                position: 'relative', zIndex: 1,
                background: '#ffffff', border: '1px solid rgba(22, 184, 151, 0.08)',
                borderRadius: 16, padding: '20px 16px', width: 180,
                boxShadow: '0 8px 24px rgba(0,0,0,0.02)',
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #16B897, #10B981)',
                  color: '#fff', fontSize: 12, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 12px'
                }}>
                  {st.step}
                </div>
                <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0, color: '#111111' }}>{st.title}</h4>
                <p style={{ fontSize: 10, color: '#475569', marginTop: 4, margin: 0 }}>{st.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ───────────────────────────────────────────── */}
      <section style={{
        padding: '100px 40px',
        maxWidth: 720,
        margin: '0 auto',
        textAlign: 'center',
        position: 'relative',
        zIndex: 1,
      }}>
        <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 40 }}>
          Loved by Controllers of Exams
        </h2>

        {/* Sliding Testimonial glass card */}
        <div style={{
          background: 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(22, 184, 151, 0.1)',
          borderRadius: 20,
          padding: '40px 32px',
          boxShadow: '0 16px 40px rgba(0,0,0,0.02)',
          minHeight: 180,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}>
          <p style={{ fontSize: 16, fontStyle: 'italic', color: '#333333', lineHeight: 1.6, margin: 0 }}>
            "{testimonials[currentTestimonial].quote}"
          </p>
          <div style={{ marginTop: 24 }}>
            <h4 style={{ fontSize: 14, fontWeight: 800, color: '#111111', margin: 0 }}>
              {testimonials[currentTestimonial].author}
            </h4>
            <span style={{ fontSize: 11, color: '#666666', marginTop: 2, display: 'inline-block' }}>
              {testimonials[currentTestimonial].role}
            </span>
          </div>
        </div>
      </section>

      {/* ─── CTA SECTION ────────────────────────────────────────────── */}
      <section style={{
        padding: '100px 40px',
        textAlign: 'center',
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{
          maxWidth: 900,
          margin: '0 auto',
          background: 'linear-gradient(135deg, rgba(22, 184, 151, 0.08) 0%, rgba(16, 185, 129, 0.04) 100%)',
          border: '1px solid rgba(22, 184, 151, 0.12)',
          borderRadius: 28,
          padding: '80px 40px',
          boxShadow: '0 24px 64px rgba(22, 184, 151, 0.03)',
        }}>
          <h2 style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-0.03em', color: '#111111', margin: 0 }}>
            Ready to transform examination management?
          </h2>
          <p style={{ fontSize: 15, color: '#555555', marginTop: 16, marginBottom: 32, maxWidth: 450, marginLeft: 'auto', marginRight: 'auto' }}>
            Set up your institution block configurations, generate timetable allocations, and broadcast seat schedules instantly.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
            <button
              onClick={() => setShowLoginForm(true)}
              className="spring-btn"
              style={{
                background: '#16B897', color: '#ffffff', border: 'none',
                borderRadius: 24, padding: '14px 36px', fontSize: 14, fontWeight: 700,
                cursor: 'pointer', boxShadow: '0 8px 24px rgba(22, 184, 151, 0.2)',
              }}
            >
              Start Free
            </button>
            <button
              onClick={() => setShowLoginForm(true)}
              className="spring-btn"
              style={{
                background: '#ffffff', color: '#111111', border: '1px solid rgba(22, 184, 151, 0.15)',
                borderRadius: 24, padding: '14px 36px', fontSize: 14, fontWeight: 700,
                cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.01)',
              }}
            >
              Schedule Demo
            </button>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─────────────────────────────────────────────────── */}
      <footer style={{
        padding: '40px',
        borderTop: '1px solid rgba(22, 184, 151, 0.05)',
        background: '#ffffff',
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{
          maxWidth: 1100,
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 20, height: 20, borderRadius: 4, background: '#16B897', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 800 }}>E</div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#111111' }}>ExamCell</span>
          </div>

          <div style={{ display: 'flex', gap: 24, fontSize: 12, fontWeight: 600 }}>
            {['Documentation', 'API', 'GitHub', 'Contact', 'Privacy'].map(link => (
              <a key={link} href="#" style={{ color: '#666666', textDecoration: 'none', transition: 'color 0.2s' }}
                 onMouseEnter={e => e.target.style.color = '#16B897'}
                 onMouseLeave={e => e.target.style.color = '#666666'}>
                {link}
              </a>
            ))}
          </div>

          <span style={{ fontSize: 11, color: '#999999', fontFamily: 'var(--font-mono)' }}>
            © {new Date().getFullYear()} ExamCell Inc. All rights reserved.
          </span>
        </div>
      </footer>


      {/* ─── FROSTED GLASS LOGIN MODAL OVERLAY ──────────────────────── */}
      {showLoginForm && (
        <div 
          className="modal-overlay" 
          onClick={e => e.target === e.currentTarget && setShowLoginForm(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 12, 12, 0.4)',
            backdropFilter: 'blur(16px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          {/* Main login card container */}
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            width: '100%',
            maxWidth: 480,
            boxShadow: '0 24px 64px rgba(5,12,12,0.4)',
            position: 'relative',
            overflow: 'hidden',
            animation: 'fadeSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          }}>
            {/* Close button top right */}
            <button 
              onClick={() => setShowLoginForm(false)}
              style={{
                position: 'absolute', right: 16, top: 16,
                background: 'none', border: 'none', color: 'var(--text-secondary)',
                cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center'
              }}
            >
              <X size={18} />
            </button>

            {/* Inner modal content wrapper */}
            <div style={{ padding: '36px 40px' }}>
              
              {/* Heading */}
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                  Access Portal
                </h2>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, margin: 0 }}>
                  Sign in to manage scheduling, seating, and invigilation.
                </p>
              </div>

              {/* Tab selector */}
              <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
                {['operator', 'kiosk'].map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 11, fontWeight: 800, paddingBottom: 10, paddingRight: 20,
                      color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-tertiary)',
                      borderBottom: activeTab === tab ? '2px solid var(--accent-purple)' : '2px solid transparent',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {tab === 'operator' ? 'OPERATOR LOGIN' : 'SMARTBOARD KIOSK'}
                  </button>
                ))}
              </div>

              {activeTab === 'operator' ? (
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Email */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
                      Email Address
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                      <input
                        type="email" className="input"
                        placeholder="you@mitwpu.edu.in"
                        value={email} onChange={e => setEmail(e.target.value)}
                        required autoFocus
                        style={{ paddingLeft: 38, background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 8, fontSize: 12, height: 40 }}
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <label className="form-label" style={{ fontSize: 11, color: 'var(--text-secondary)', margin: 0 }}>Password</label>
                      <button
                        type="button"
                        onClick={() => { setEmail('admin@mitwpu.edu.in'); setPassword('admin123'); toast.success('Credentials filled'); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-purple)', fontSize: 11, fontWeight: 700, padding: 0 }}
                      >
                        Auto fill?
                      </button>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <Lock size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                      <input
                        type={showPwd ? 'text' : 'password'} className="input"
                        placeholder="••••••••"
                        value={password} onChange={e => setPassword(e.target.value)}
                        required
                        style={{ paddingLeft: 38, paddingRight: 40, background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 8, fontSize: 12, height: 40 }}
                      />
                      <button
                        type="button" onClick={() => setShowPwd(!showPwd)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', padding: 4 }}
                        aria-label={showPwd ? 'Hide' : 'Show'}
                      >
                        {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit" className="btn btn-primary" disabled={isLoading}
                    style={{ width: '100%', justifyContent: 'center', minHeight: 40, fontSize: 13, background: 'var(--accent-purple)', borderColor: 'var(--accent-purple)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', marginTop: 8, boxShadow: '0 8px 20px rgba(13,148,136,0.2)' }}
                  >
                    {isLoading ? 'SIGNING IN…' : 'SIGN IN'}
                  </button>
                </form>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>Exam Cycle</label>
                    <select className="select" value={kioskCycle} onChange={e => setKioskCycle(e.target.value)}
                      style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 8, fontSize: 12, padding: '10px 12px', height: 40 }}>
                      <option value="">Select Cycle…</option>
                      {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>Classroom (Optional)</label>
                    <select className="select" value={kioskRoom} onChange={e => setKioskRoom(e.target.value)}
                      style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 8, fontSize: 12, padding: '10px 12px', height: 40 }}>
                      <option value="">All Classrooms</option>
                      {classrooms.map(r => <option key={r.id} value={r.id}>{r.room_no} ({r.block})</option>)}
                    </select>
                  </div>
                  <button
                    type="button" className="btn btn-primary" onClick={handleLaunchKiosk} disabled={!kioskCycle}
                    style={{ width: '100%', justifyContent: 'center', minHeight: 40, fontSize: 13, background: 'var(--accent-purple)', borderColor: 'var(--accent-purple)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', marginTop: 8, boxShadow: '0 8px 20px rgba(13,148,136,0.2)' }}
                  >
                    LAUNCH KIOSK DISPLAY
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', padding: '16px 40px', background: 'var(--bg-sidebar)' }}>
              <span style={{ fontSize: 8, color: 'var(--text-tertiary)', fontWeight: 700, letterSpacing: '0.05em' }}>SECURE AUTH</span>
              <span style={{ fontSize: 8, color: 'var(--text-tertiary)', fontWeight: 700, letterSpacing: '0.05em' }}>RBAC ENABLED</span>
              <span style={{ fontSize: 8, color: 'var(--text-tertiary)', fontWeight: 700, letterSpacing: '0.05em' }}>SSL ENCRYPTED</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
