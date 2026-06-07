import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import {
  LayoutDashboard, Users, BookOpen, Building2, UserCheck,
  CalendarDays, Grid3x3, UserCog, AlertTriangle, Download,
  ClipboardList, LogOut, GraduationCap, Search, Calendar,
  ClipboardCheck, Copy
} from 'lucide-react';
import { useAuthStore, useAppStore } from '../store/index.js';

const coordinatorNav = [
  { section: 'Overview' },
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard', end: true },
  { section: 'Master Data' },
  { to: '/students',  icon: Users,      label: 'Students' },
  { to: '/subjects',  icon: BookOpen,   label: 'Subjects' },
  { to: '/classrooms',icon: Building2,  label: 'Classrooms' },
  { to: '/faculty',   icon: UserCheck,  label: 'Faculty' },
  { section: 'Exam Management' },
  { to: '/exam-cycles', icon: CalendarDays, label: 'Exam Cycles' },
  { section: 'System' },
  { to: '/search',    icon: Search,        label: 'Search', shortcut: '⌃K' },
  { to: '/audit',     icon: ClipboardList, label: 'Audit Log' },
];

const facultyNav = [
  { to: '/my-duties', icon: CalendarDays, label: 'My Duties', end: true },
  { to: '/search',    icon: Search, label: 'Search', shortcut: '⌃K' },
];

// Inline date for the edition strip
const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const navItems = user?.role === 'coordinator' ? coordinatorNav : facultyNav;

  const handleLogout = () => { logout(); navigate('/login'); };

  // Global Ctrl+K shortcut → Search
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        navigate('/search');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  return (
    <div className="app-shell">
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
      <div className="main-content">
        {/* Edition strip */}
        <div className="edition-strip">
          <span>MIT WPU Examination Cell · Internal System</span>
          <span>Vol. 1 · {today} · Pune Edition</span>
        </div>

        <div className="main-inner">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
