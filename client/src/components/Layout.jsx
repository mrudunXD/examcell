import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import {
  LayoutDashboard, Users, BookOpen, Building2, UserCheck,
  CalendarDays, Grid3x3, UserCog, AlertTriangle, Download,
  ClipboardList, LogOut, GraduationCap, Search as SearchIcon, Calendar,
  ClipboardCheck, Copy, Radio, BarChart3, X, ArrowRight, Menu
} from 'lucide-react';
import { useAuthStore, useAppStore } from '../store/index.js';
import api from '../lib/api.js';
import { ICONS, LABELS, getResultLink, getResultSub } from '../pages/SearchPage.jsx';

const coordinatorNav = [
  { section: 'Overview' },
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/live-dashboard', icon: Radio,       label: 'Live Dashboard' },
  { section: 'Master Data' },
  { to: '/students',  icon: Users,      label: 'Students' },
  { to: '/subjects',  icon: BookOpen,   label: 'Subjects' },
  { to: '/classrooms',icon: Building2,  label: 'Classrooms' },
  { to: '/faculty',   icon: UserCheck,  label: 'Faculty' },
  { section: 'Exam Management' },
  { to: '/exam-cycles', icon: CalendarDays, label: 'Exam Cycles' },
  { to: '/heatmap',     icon: BarChart3,    label: 'Faculty Heatmap' },
  { section: 'System' },
  { to: '/search',    icon: SearchIcon,        label: 'Search', shortcut: '⌃K' },
  { to: '/audit',     icon: ClipboardList, label: 'Audit Log' },
];

const facultyNav = [
  { to: '/my-duties', icon: CalendarDays, label: 'My Duties', end: true },
  { to: '/search',    icon: SearchIcon, label: 'Search', shortcut: '⌃K' },
];

// Inline date for the edition strip
const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

function GlobalSearchModal({ onClose }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ students: [], subjects: [], faculty: [], cycles: [] });
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const debounceRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const search = async (q) => {
    if (q.trim().length < 2) {
      setResults({ students: [], subjects: [], faculty: [], cycles: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get(`/search?q=${encodeURIComponent(q)}`);
      setResults(data);
      setActiveIdx(-1);
    } catch {
      setResults({ students: [], subjects: [], faculty: [], cycles: [] });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 220);
  };

  const totalResults = Object.values(results).reduce((s, arr) => s + arr.length, 0);

  const flatResults = [];
  for (const type of ['students', 'subjects', 'faculty', 'cycles']) {
    for (const item of results[type]) {
      flatResults.push({ type, item });
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      const { type, item } = flatResults[activeIdx];
      navigate(getResultLink(type, item));
      onClose();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const selectItem = (type, item) => {
    navigate(getResultLink(type, item));
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()} style={{ zIndex: 9999 }}>
      <div className="modal modal-lg" style={{ padding: 0, overflow: 'hidden', maxWidth: 640, background: '#F9F9F7', border: '3px solid #111111' }}>
        <div style={{ position: 'relative', borderBottom: '2px solid #111111', background: '#FFFFFF' }}>
          <SearchIcon
            size={18} strokeWidth={1.5}
            style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#525252', pointerEvents: 'none' }}
          />
          <input
            ref={inputRef}
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Search students, subjects, faculty, exam cycles..."
            style={{
              width: '100%', padding: '18px 48px 18px 50px',
              border: 'none', outline: 'none',
              fontFamily: 'var(--font-sans)', fontSize: 16,
              background: 'transparent', color: '#111',
              boxSizing: 'border-box',
            }}
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setResults({ students: [], subjects: [], faculty: [], cycles: [] }); inputRef.current?.focus(); }}
              style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#525252', display: 'flex', alignItems: 'center', padding: 4 }}
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          )}
        </div>

        <div style={{ maxHeight: 400, overflowY: 'auto', padding: 16 }}>
          {!query && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--np-n500)' }}>
              <SearchIcon size={24} strokeWidth={1.5} style={{ marginBottom: 12, opacity: 0.3 }} />
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontStyle: 'italic' }}>
                Start typing to search across ExamCell records
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, marginTop: 4, opacity: 0.5 }}>
                Type student PRN, subject code, or supervisor name
              </div>
            </div>
          )}

          {query.length >= 2 && !loading && totalResults === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--np-n500)', fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: 13 }}>
              No results match "{query}"
            </div>
          )}

          {loading && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div className="spinner" style={{ margin: '0 auto', width: 20, height: 20 }} />
            </div>
          )}

          {query.length >= 2 && !loading && ['students', 'subjects', 'faculty', 'cycles'].map(type => {
            const items = results[type];
            if (!items.length) return null;
            const Icon = ICONS[type];

            return (
              <div key={type} style={{ marginBottom: 20 }}>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase',
                  letterSpacing: '0.1em', color: 'var(--np-n500)',
                  borderBottom: '1px solid #E5E5E0', paddingBottom: 4, marginBottom: 8,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <Icon size={10} strokeWidth={1.5} />
                  {LABELS[type]}
                </div>
                <div style={{ border: '1px solid #E5E5E0', background: '#FFFFFF' }}>
                  {items.map((item, i) => {
                    const globalIdx = flatResults.findIndex(r => r.type === type && r.item.id === item.id);
                    const isActive = activeIdx === globalIdx;
                    return (
                      <button
                        key={item.id}
                        onClick={() => selectItem(type, item)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                          padding: '10px 14px', border: 'none', textAlign: 'left', cursor: 'pointer',
                          background: isActive ? '#111' : 'transparent',
                          color: isActive ? '#F9F9F7' : '#111',
                          borderBottom: i < items.length - 1 ? '1px solid #E5E5E0' : 'none',
                          transition: 'background 0.05s',
                        }}
                      >
                        <Icon size={12} strokeWidth={1.5} style={{ flexShrink: 0, opacity: 0.5 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, opacity: isActive ? 0.7 : 0.5, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {getResultSub(type, item)}
                          </div>
                        </div>
                        <ArrowRight size={10} strokeWidth={1.5} style={{ opacity: 0.3 }} />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {query.length >= 2 && (
          <div style={{
            background: '#FFFFFF', borderTop: '1px solid #E5E5E0',
            padding: '8px 16px', display: 'flex', justifyContent: 'space-between',
            fontFamily: 'var(--font-mono)', fontSize: 8, color: '#A3A3A3',
            textTransform: 'uppercase', letterSpacing: '0.08em'
          }}>
            <span>Total Results: {totalResults}</span>
            <span>↑↓ Navigate · Enter Select · Esc Close</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const navItems = user?.role === 'coordinator' ? coordinatorNav : facultyNav;
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  // Global Ctrl+K shortcut → Search Modal
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="app-shell" style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column' }}>
      {/* Mobile Top Header (hidden on desktop via css) */}
      <header className="mobile-header" style={{
        display: 'none',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        background: '#111',
        color: '#fff',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        height: '56px',
        boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <GraduationCap size={20} strokeWidth={1.5} color="rgba(255,255,255,0.9)" />
          <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '0.05em' }}>ExamCell</span>
        </div>
        <button 
          onClick={() => setMobileMenuOpen(prev => !prev)}
          style={{
            background: 'none',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {/* Mobile Drawer menu content overlay */}
      {mobileMenuOpen && (
        <div className="mobile-drawer-overlay" style={{
          position: 'fixed',
          top: '56px',
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(17, 17, 17, 0.98)',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          padding: '24px',
          boxSizing: 'border-box',
          animation: 'slideInMenu 0.2s ease-out',
        }}>
          {/* User badge */}
          <div style={{ paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#fff' }}>{user?.name}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', marginTop: 4, fontWeight: 700, letterSpacing: '0.05em' }}>{user?.role}</div>
          </div>
          
          {/* Links list */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto' }}>
            {navItems.map((item, i) =>
              item.section ? (
                <div key={i} style={{ 
                  fontSize: 10, 
                  fontWeight: 900, 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.08em', 
                  color: 'rgba(255,255,255,0.35)', 
                  marginTop: 16,
                  marginBottom: 6 
                }}>{item.section}</div>
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    borderRadius: '8px',
                    color: isActive ? '#fff' : 'rgba(255,255,255,0.6)',
                    background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                    textDecoration: 'none',
                    fontWeight: 700,
                    fontSize: 14,
                  })}
                  onClick={(e) => {
                    setMobileMenuOpen(false);
                    if (item.to === '/search') {
                      e.preventDefault();
                      setSearchOpen(true);
                    }
                  }}
                >
                  <item.icon size={16} strokeWidth={1.5} />
                  <span>{item.label}</span>
                </NavLink>
              )
            )}
          </div>
          
          {/* Sign Out */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 16, marginTop: 16 }}>
            <button
              className="btn btn-ghost btn-sm"
              style={{
                width: '100%',
                justifyContent: 'center',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff',
                padding: '12px',
                fontSize: 13,
                fontWeight: 700,
              }}
              onClick={() => {
                setMobileMenuOpen(false);
                handleLogout();
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Main shell grid */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* ── Sidebar ───────────────────────────────────────────────────────── */}
        <nav className="sidebar">
          {/* Publication flag */}
          <div className="sidebar-flag">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <GraduationCap
                size={18}
                color="rgba(255,255,255,0.7)"
                style={{ marginTop: 2, flexShrink: 0 }}
                strokeWidth={1.5}
              />
              <div>
                <div className="sidebar-flag-title">ExamCell</div>
                <div className="sidebar-flag-sub">MIT WPU · Exam Cell</div>
              </div>
            </div>
          </div>

          {/* User info */}
          <div className="sidebar-user">
            <div className="sidebar-user-name">{user?.name}</div>
            <div className="sidebar-user-role">{user?.role}</div>
          </div>

          {/* Navigation */}
          <div className="sidebar-nav">
            {navItems.map((item, i) =>
              item.section ? (
                <div key={i} className="nav-section-label">{item.section}</div>
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                  onClick={(e) => {
                    if (item.to === '/search') {
                      e.preventDefault();
                      setSearchOpen(true);
                    }
                  }}
                >
                  <item.icon size={13} strokeWidth={1.5} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.shortcut && (
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 8,
                      opacity: 0.45, letterSpacing: '0.05em',
                      border: '1px solid rgba(255,255,255,0.2)',
                      padding: '1px 4px', borderRadius: 2,
                    }}>
                      {item.shortcut}
                    </span>
                  )}
                </NavLink>
              )
            )}
          </div>

          {/* Logout */}
          <div className="sidebar-footer">
            <button
              className="btn btn-ghost btn-sm"
              style={{
                width: '100%',
                justifyContent: 'flex-start',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.45)',
              }}
              onClick={handleLogout}
            >
              <LogOut size={12} strokeWidth={1.5} />
              Sign Out
            </button>
          </div>
        </nav>

        {/* ── Main area ─────────────────────────────────────────────────────── */}
        <div className="main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Edition strip */}
          <div className="edition-strip">
            <span>MIT WPU Examination Cell · Internal System</span>
            <span>Vol. 1 · {today} · Pune Edition</span>
          </div>

          <div className="main-inner" style={{ flex: 1, overflowY: 'auto' }}>
            <Outlet />
          </div>
        </div>
      </div>
      
      {searchOpen && (
        <GlobalSearchModal onClose={() => setSearchOpen(false)} />
      )}

      {/* Mobile-specific styling injections */}
      <style>{`
        @media (max-width: 768px) {
          .sidebar { 
            display: none !important; 
          }
          .mobile-header { 
            display: flex !important; 
          }
          .edition-strip { 
            display: none !important; 
          }
          .main-inner { 
            padding: 16px 12px !important; 
          }
          .app-shell {
            flex-direction: column !important;
          }
        }
        @keyframes slideInMenu {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
