import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import {
  LayoutDashboard, Users, BookOpen, Building2, UserCheck,
  CalendarDays, Grid3x3, UserCog, AlertTriangle, Download,
  ClipboardList, LogOut, GraduationCap, Search as SearchIcon, Calendar,
  ClipboardCheck, Copy, Radio, BarChart3, X, ArrowRight, Menu, Activity, TrendingUp,
  Sun, Moon, ChevronDown, ChevronRight, HelpCircle, Bug
} from 'lucide-react';
import { useAuthStore, useAppStore, useSettingsStore } from '../store/index.js';
import api from '../lib/api.js';
import { ICONS, LABELS, getResultLink, getResultSub } from '../pages/SearchPage.jsx';
import ShinyText from './ReactBits/ShinyText.jsx';
import toast from 'react-hot-toast';
import BugReporter from './BugReporter.jsx';

const coordinatorNav = [
  { section: 'Overview' },
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard', end: true },
  { section: 'Master Data' },
  { to: '/students',  icon: Users,      label: 'Students' },
  { to: '/subjects',  icon: BookOpen,   label: 'Subjects' },
  { to: '/classrooms',icon: Building2,  label: 'Classrooms' },
  { to: '/faculty',   icon: UserCheck,  label: 'Faculty' },
  { to: '/calendar',  icon: CalendarDays, label: 'Calendar' },
  { section: 'Exam Management' },
  { to: '/exam-cycles', icon: CalendarDays, label: 'Exam Cycles' },
  { to: '/analytics',   icon: TrendingUp,   label: 'Analytics & Heatmap' },
  { section: 'System' },
  { to: '/audit',     icon: ClipboardList, label: 'Audit Log' },
  { to: '/health',    icon: Activity,      label: 'System Health' },
  { to: '/settings',  icon: UserCog,       label: 'Settings' },
  { to: '/bugs',      icon: Bug,           label: 'Bug Tracker' },
];

const facultyNav = [
  { to: '/my-duties', icon: CalendarDays, label: 'My Duties', end: true },
];

// Inline date for the edition strip
const d = new Date();
const today = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;


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
      <div className="modal modal-lg" style={{ padding: 0, overflow: 'hidden', maxWidth: 640, background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <div style={{ position: 'relative', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
          <SearchIcon
            size={18} strokeWidth={1.5}
            style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }}
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
              background: 'transparent', color: 'var(--text-primary)',
              boxSizing: 'border-box',
            }}
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setResults({ students: [], subjects: [], faculty: [], cycles: [] }); inputRef.current?.focus(); }}
              style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#8E8E93', display: 'flex', alignItems: 'center', padding: 4 }}
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
                  borderBottom: '1px solid #222225', paddingBottom: 4, marginBottom: 8,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <Icon size={10} strokeWidth={1.5} />
                  {LABELS[type]}
                </div>
                <div style={{ border: '1px solid var(--border)', background: 'var(--bg-surface)', borderRadius: '6px', overflow: 'hidden' }}>
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
                          background: isActive ? 'var(--bg-elevated)' : 'transparent',
                          color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                          borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
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
            background: 'var(--bg-elevated)', borderTop: '1px solid var(--border)',
            padding: '8px 16px', display: 'flex', justifyContent: 'space-between',
            fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--text-secondary)',
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
  const { user, logout, setUser } = useAuthStore();
  const { theme, toggleTheme } = useAppStore();
  const { settings, fetchSettings } = useSettingsStore();
  const [openBugsCount, setOpenBugsCount] = useState(0);

  useEffect(() => {
    if (user?.role !== 'coordinator') return;
    const fetchCount = async () => {
      try {
        const { data } = await api.get('/bugs/count');
        setOpenBugsCount(data.count || 0);
      } catch (err) {
        console.warn('Failed to fetch open bugs count:', err);
      }
    };
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    fetchSettings();
    api.get('/iam/profile')
      .then(({ data }) => {
        if (data?.user) {
          const updatedUser = {
            ...data.user,
            role: data.user.role || (data.user.roles && data.user.roles[0]) || 'faculty'
          };
          setUser(updatedUser);
        }
      })
      .catch((err) => {
        console.error('Failed to sync profile details:', err);
      });
  }, []);

  const location = useLocation();
  const pathnames = location.pathname.split('/').filter(x => x);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Dynamic Theme Sync (Feature 19)
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleOSThemeChange = (e) => {
      const targetTheme = e.matches ? 'dark' : 'light';
      if (document.documentElement.getAttribute('data-theme') !== targetTheme) {
        document.documentElement.setAttribute('data-theme', targetTheme);
      }
    };
    
    if (!localStorage.getItem('theme')) {
      const initialTheme = mediaQuery.matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', initialTheme);
    }
    
    mediaQuery.addEventListener('change', handleOSThemeChange);
    return () => mediaQuery.removeEventListener('change', handleOSThemeChange);
  }, []);

  // Inactivity Session Logout (Feature 2)
  useEffect(() => {
    let inactivityTimer;
    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        toast.error('Session expired due to inactivity. Logging out...');
        handleLogout();
      }, 15 * 60 * 1000);
    };

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach(event => window.addEventListener(event, resetTimer));
    
    resetTimer();
    
    return () => {
      clearTimeout(inactivityTimer);
      activityEvents.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, []);

  // Global Shift+? Keyboard Shortcut Guide (Feature 21)
  useEffect(() => {
    const handleShortcutsKey = (e) => {
      if (e.key === '?' && e.shiftKey) {
        setShortcutsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleShortcutsKey);
    return () => window.removeEventListener('keydown', handleShortcutsKey);
  }, []);

  const logoSetting = settings.find(s => s.key === 'general.logo')?.value;
  const bgImage = settings.find(s => s.key === 'general.backgroundImage')?.value;
  const bgOpacitySetting = settings.find(s => s.key === 'general.backgroundOpacity')?.value;
  const bgOpacity = bgOpacitySetting ? parseFloat(bgOpacitySetting) / 100 : 0.75;
  const sidebarBanner = settings.find(s => s.key === 'general.sidebarBanner')?.value;

  const navigate = useNavigate();
  const navItems = user?.role === 'coordinator' ? coordinatorNav : facultyNav;
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [collapsedSecs, setCollapsedSecs] = useState({
    'Overview': false,
    'Master Data': false,
    'Exam Management': false,
    'System': false,
  });

  const toggleSection = (secName) => {
    setCollapsedSecs(prev => ({ ...prev, [secName]: !prev[secName] }));
  };

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
      {bgImage && (
        <style>{`
          [data-theme="dark"], :root:not([data-theme="light"]) {
            --bg-base: rgba(8, 7, 16, 0.4) !important;
            --bg-sidebar: rgba(13, 12, 24, 0.6) !important;
            --bg-surface: rgba(19, 18, 36, 0.5) !important;
            --bg-elevated: rgba(30, 29, 53, 0.65) !important;
          }
          [data-theme="light"] {
            --bg-base: rgba(250, 250, 250, 0.45) !important;
            --bg-sidebar: rgba(244, 244, 245, 0.65) !important;
            --bg-surface: rgba(255, 255, 255, 0.55) !important;
            --bg-elevated: rgba(244, 244, 245, 0.7) !important;
            --bg-topbar: rgba(255, 255, 255, 0.55) !important;
            --border: rgba(228, 228, 231, 0.4) !important;
          }
          .app-shell {
            background-image: url(${bgImage}) !important;
            background-size: cover !important;
            background-position: center !important;
            background-repeat: no-repeat !important;
            background-attachment: fixed !important;
            position: relative;
          }
          .app-shell::before {
            content: '';
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: ${theme === 'dark' ? `rgba(8, 7, 16, ${bgOpacity})` : `rgba(255, 255, 255, ${bgOpacity})`} !important;
            z-index: 0;
            pointer-events: none;
          }
          .app-shell > * {
            position: relative;
            z-index: 1;
          }
        `}</style>
      )}
      {/* Mobile Top Header (hidden on desktop via css) */}
      <header className="mobile-header" style={{
        display: 'none',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 20px',
        background: 'var(--bg-surface)',
        color: 'var(--text-primary)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 40,
        height: '56px',
        boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <GraduationCap size={20} strokeWidth={1.5} color="var(--text-primary)" />
          <span style={{ fontWeight: 800, fontSize: 16, letterSpacing: '0.05em' }}>ExamCell</span>
        </div>
        <button 
          onClick={() => setMobileMenuOpen(prev => !prev)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-primary)',
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
          background: 'var(--bg-base)',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          padding: '24px',
          boxSizing: 'border-box',
          animation: 'slideInMenu 0.2s ease-out',
        }}>
          {/* User badge */}
          <div style={{ paddingBottom: 16, borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text-primary)' }}>{user?.name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', textTransform: 'uppercase', marginTop: 4, fontWeight: 700, letterSpacing: '0.05em' }}>{user?.role}</div>
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
                  color: 'var(--text-tertiary)', 
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
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    background: isActive ? 'var(--bg-elevated)' : 'transparent',
                    textDecoration: 'none',
                    fontWeight: 700,
                    fontSize: 14,
                  })}
                  onClick={(e) => {
                    setMobileMenuOpen(false);
                  }}
                >
                  <item.icon size={16} strokeWidth={1.5} />
                  <span>{item.label}</span>
                </NavLink>
              )
            )}
          </div>
          
          {/* Theme Toggle & Sign Out */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              className="btn btn-ghost btn-sm"
              style={{
                width: '100%',
                justifyContent: 'center',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                padding: '12px',
                fontSize: 13,
                fontWeight: 700,
              }}
              onClick={() => {
                toggleTheme();
              }}
            >
              {theme === 'dark' ? <Sun size={14} strokeWidth={1.5} /> : <Moon size={14} strokeWidth={1.5} />}
              <span style={{ marginLeft: 6 }}>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </button>
            <button
              className="btn btn-ghost btn-sm"
              style={{
                width: '100%',
                justifyContent: 'center',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                padding: '12px',
                fontSize: 13,
                fontWeight: 700,
              }}
              onClick={() => {
                setMobileMenuOpen(false);
                handleLogout();
              }}
            >
              <LogOut size={14} strokeWidth={1.5} />
              <span style={{ marginLeft: 6 }}>Sign Out</span>
            </button>
          </div>
        </div>
      )}

      {/* Main shell grid */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* ── Sidebar ───────────────────────────────────────────────────────── */}
        <nav className="sidebar" style={{ 
          background: 'var(--bg-sidebar)', 
          padding: sidebarBanner && !sidebarCollapsed ? '0' : '12px 0 0',
          width: sidebarCollapsed ? '64px' : '240px',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
          flexShrink: 0,
          borderRight: '1px solid var(--border-faint)'
        }}>
          {/* Workspace select header (SaaS UI style) */}
          <div style={{ 
            padding: sidebarBanner && !sidebarCollapsed ? '0' : '4px 12px 12px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: sidebarCollapsed ? 'center' : 'space-between', 
            borderBottom: '1px solid var(--border-faint)',
            height: sidebarBanner && !sidebarCollapsed ? '64px' : 'auto',
            overflow: 'hidden'
          }}>
            {sidebarBanner && !sidebarCollapsed ? (
              <div style={{ width: '100%', height: '100%', cursor: 'pointer' }} onClick={() => setSearchOpen(true)}>
                <img src={sidebarBanner} alt="Sidebar Banner" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
            ) : (
              <div className="saas-workspace-select" style={{ flex: sidebarCollapsed ? 'none' : 1 }} onClick={() => setSearchOpen(true)}>
                <div className="saas-avatar-circle" style={{ overflow: 'hidden', padding: 0 }}>
                  {logoSetting ? (
                    <img src={logoSetting} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    'EC'
                  )}
                </div>
                {!sidebarCollapsed && (
                  <>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginLeft: 8 }}>ExamCell</span>
                    <ChevronDown size={12} color="var(--text-tertiary)" style={{ marginLeft: 4 }} />
                  </>
                )}
              </div>
            )}
          </div>

          {/* Search bar wrapper */}
          <div style={{ padding: '12px 12px 8px' }}>
            <div className="saas-search-input-wrapper" onClick={() => setSearchOpen(true)} style={{ cursor: 'pointer', justifyContent: sidebarCollapsed ? 'center' : 'flex-start', padding: sidebarCollapsed ? '6px' : '6px 12px' }}>
              <SearchIcon size={12} color="var(--text-tertiary)" strokeWidth={1.5} />
              {!sidebarCollapsed && (
                <>
                  <input readOnly placeholder="Search" className="saas-search-input" style={{ cursor: 'pointer' }} />
                  <span className="saas-shortcut-tag">/</span>
                </>
              )}
            </div>
          </div>

          {/* Navigation Links */}
          <div className="sidebar-nav" style={{ overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
            {(() => {
              let currentSec = '';
              return navItems.map((item, i) => {
                if (item.section) {
                  currentSec = item.section;
                  return sidebarCollapsed ? (
                    <div key={i} style={{ borderTop: '1px solid var(--border-faint)', margin: '14px 8px 8px', height: 0 }} />
                  ) : (
                    <div 
                      key={i} 
                      className="saas-sidebar-nav-section-title"
                      style={{ marginTop: i > 0 ? 16 : 8 }}
                    >
                      {item.section}
                    </div>
                  );
                }
                
                const hasBadge = item.to === '/bugs' && openBugsCount > 0;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => `saas-sidebar-nav-link${isActive ? ' active' : ''}`}
                    style={{
                      justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                      padding: sidebarCollapsed ? '10px 0' : '10px 12px',
                      gap: sidebarCollapsed ? 0 : 12,
                      position: 'relative'
                    }}
                    title={sidebarCollapsed ? item.label : ''}
                  >
                    <item.icon size={13} strokeWidth={1.5} style={{ opacity: 0.7 }} />
                    {!sidebarCollapsed && <span style={{ flex: 1 }}>{item.label}</span>}
                    {hasBadge && (
                      <span style={{
                        background: '#ef4444',
                        color: '#fff',
                        fontSize: '9px',
                        fontWeight: 'bold',
                        padding: '1px 5px',
                        borderRadius: '10px',
                        marginLeft: sidebarCollapsed ? '0' : 'auto',
                        position: sidebarCollapsed ? 'absolute' : 'static',
                        top: sidebarCollapsed ? '2px' : 'auto',
                        right: sidebarCollapsed ? '2px' : 'auto',
                        transform: sidebarCollapsed ? 'scale(0.8)' : 'none'
                      }}>
                        {openBugsCount}
                      </span>
                    )}
                  </NavLink>
                );
              });
            })()}
          </div>

          {/* Footer list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 12px', borderTop: '1px solid var(--border-faint)' }}>
            <NavLink to="/docs" className="saas-sidebar-nav-link" style={{ fontSize: 13, padding: sidebarCollapsed ? '10px 0' : '6px 12px', justifyContent: sidebarCollapsed ? 'center' : 'flex-start', gap: sidebarCollapsed ? 0 : 8, display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'var(--text-secondary)' }} title={sidebarCollapsed ? "Documentation" : ""}>
              <HelpCircle size={13} strokeWidth={1.5} style={{ color: 'var(--text-tertiary)' }} />
              {!sidebarCollapsed && <span>Documentation</span>}
            </NavLink>
            <button className="btn btn-ghost" style={{ display: 'flex', justifyContent: sidebarCollapsed ? 'center' : 'flex-start', border: 'none', background: 'transparent', padding: sidebarCollapsed ? '10px 0' : '6px 12px', fontSize: 13, height: 'auto', minHeight: 'auto', color: 'var(--text-secondary)', gap: sidebarCollapsed ? 0 : 8 }} onClick={handleLogout} title={sidebarCollapsed ? "Sign Out" : ""}>
              <LogOut size={13} strokeWidth={1.5} style={{ color: 'var(--text-tertiary)' }} />
              {!sidebarCollapsed && <span>Sign Out</span>}
            </button>
          </div>
        </nav>

        {/* ── Main area ─────────────────────────────────────────────────────── */}
        <div className="main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Top bar */}
          <div style={{
            background: 'var(--bg-topbar)',
            borderBottom: '1px solid var(--border-faint)',
            padding: '0 28px',
            height: 52,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button 
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="btn btn-ghost"
                style={{
                  width: 32, 
                  height: 32, 
                  padding: 0, 
                  borderRadius: 6, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  border: '1px solid var(--border-faint)',
                  cursor: 'pointer'
                }}
                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                <Menu size={14} strokeWidth={1.5} />
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500, userSelect: 'none' }}>
                <span style={{ color: 'var(--text-secondary)' }}>MIT WPU</span>
                <span>/</span>
                {pathnames.length === 0 ? (
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Dashboard</span>
                ) : (
                  pathnames.map((name, index) => {
                    const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`;
                    const isLast = index === pathnames.length - 1;
                    const cleanName = name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                    
                    return (
                      <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {isLast ? (
                          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{cleanName}</span>
                        ) : (
                          <span style={{ cursor: 'pointer', transition: 'color 0.2s' }} onClick={() => navigate(routeTo)} className="hover:text-primary">{cleanName}</span>
                        )}
                        {!isLast && <span>/</span>}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)', letterSpacing: '0.03em' }}>
                {today}
              </span>
              <button 
                onClick={toggleTheme} 
                className="btn btn-ghost" 
                style={{ 
                  width: 32, 
                  height: 32, 
                  padding: 0, 
                  borderRadius: 6, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  border: '1px solid var(--border-faint)'
                }}
                title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {theme === 'dark' ? <Sun size={13} strokeWidth={1.5} /> : <Moon size={13} strokeWidth={1.5} />}
              </button>

              {/* Account Dropdown Options */}
              <div style={{ position: 'relative' }}>
                <button 
                  onClick={() => setAccountMenuOpen(!accountMenuOpen)}
                  className="saas-avatar-circle"
                  style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: user?.profile_picture ? 'transparent' : 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 11, color: '#FFFFFF', cursor: 'pointer', border: '1px solid var(--border-faint)',
                    overflow: 'hidden', padding: 0
                  }}
                >
                  {user?.profile_picture ? (
                    <img src={user.profile_picture} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    user?.name ? user.name[0].toUpperCase() : 'U'
                  )}
                </button>
                {accountMenuOpen && (
                  <>
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }} onClick={() => setAccountMenuOpen(false)} />
                    <div style={{
                      position: 'absolute', right: 0, top: 40, zIndex: 999,
                      background: 'var(--bg-surface)', border: '1px solid var(--border)',
                      borderRadius: 8, padding: '8px 0', minWidth: 200,
                      boxShadow: '0 10px 30px rgba(0,0,0,0.5)', textAlign: 'left',
                      animation: 'fadeInUp 0.15s ease-out'
                    }}>
                      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-faint)' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 13 }}>{user?.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600, marginTop: 2 }}>{user?.role}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>{user?.email}</div>
                      </div>
                      <div style={{ padding: '4px 0' }}>
                        <button onClick={() => { setAccountMenuOpen(false); navigate('/profile'); }} style={{ display: 'block', width: '100%', padding: '8px 16px', background: 'none', border: 'none', textAlign: 'left', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 12 }}>Profile</button>
                        {user?.role === 'coordinator' && (
                          <button onClick={() => { setAccountMenuOpen(false); navigate('/settings'); }} style={{ display: 'block', width: '100%', padding: '8px 16px', background: 'none', border: 'none', textAlign: 'left', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 12 }}>Settings</button>
                        )}
                        {user?.role === 'faculty' && (
                          <button onClick={() => { setAccountMenuOpen(false); navigate('/my-duties'); }} style={{ display: 'block', width: '100%', padding: '8px 16px', background: 'none', border: 'none', textAlign: 'left', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 12 }}>My Duties</button>
                        )}
                        <button onClick={() => { setAccountMenuOpen(false); navigate('/search'); }} style={{ display: 'block', width: '100%', padding: '8px 16px', background: 'none', border: 'none', textAlign: 'left', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 12 }}>Global Search</button>
                        <button onClick={() => { setAccountMenuOpen(false); handleLogout(); }} style={{ display: 'block', width: '100%', padding: '8px 16px', background: 'none', border: 'none', textAlign: 'left', color: 'var(--accent-red)', cursor: 'pointer', fontSize: 12, borderTop: '1px solid var(--border-faint)', paddingTop: 10 }}>Sign Out</button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="main-inner" style={{ flex: 1, overflowY: 'auto' }}>
            <Outlet />
          </div>
        </div>
      </div>
      
      {searchOpen && (
        <GlobalSearchModal onClose={() => setSearchOpen(false)} />
      )}

      {shortcutsOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '24px 32px', width: '90%', maxWidth: 440,
            boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Keyboard Shortcuts Guide</h3>
              <button 
                onClick={() => setShortcutsOpen(false)} 
                style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Global Search Modal</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '3px 8px', borderRadius: 4, color: 'var(--text-primary)' }}>Ctrl + K</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Shortcuts Helper Guide</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '3px 8px', borderRadius: 4, color: 'var(--text-primary)' }}>Shift + ?</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Close Modals</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '3px 8px', borderRadius: 4, color: 'var(--text-primary)' }}>Esc</span>
              </div>
            </div>
          </div>
        </div>
      )}
      <BugReporter />

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
