import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, BookOpen, Building2, UserCheck,
  CalendarDays, Grid3x3, UserCog, AlertTriangle, Download,
  FileText, LogOut, ChevronRight, GraduationCap, ClipboardList
} from 'lucide-react';
import { useAuthStore, useAppStore } from '../store/index.js';

const coordinatorNav = [
  { section: 'Overview' },
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { section: 'Master Data' },
  { to: '/students', icon: Users, label: 'Students' },
  { to: '/subjects', icon: BookOpen, label: 'Subjects' },
  { to: '/classrooms', icon: Building2, label: 'Classrooms' },
  { to: '/faculty', icon: UserCheck, label: 'Faculty' },
  { section: 'Exam Management' },
  { to: '/exam-cycles', icon: CalendarDays, label: 'Exam Cycles' },
  { section: 'Tools' },
  { to: '/audit', icon: ClipboardList, label: 'Audit Log' },
];

const facultyNav = [
  { to: '/my-duties', icon: CalendarDays, label: 'My Duties', end: true },
];

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const navItems = user?.role === 'coordinator' ? coordinatorNav : facultyNav;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <nav className="sidebar">
        <div className="sidebar-logo">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg, #3b82f6, #1e40af)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0
            }}>
              <GraduationCap size={18} color="white" />
            </div>
            <div>
              <h2>ExamCell</h2>
              <p>MIT WPU</p>
            </div>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.06)', borderRadius: 6,
            padding: '6px 10px', fontSize: 11
          }}>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10 }}>Signed in as</div>
            <div style={{ color: 'white', fontWeight: 600, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, textTransform: 'capitalize' }}>{user?.role}</div>
          </div>
        </div>

        <div className="sidebar-nav">
          {navItems.map((item, i) => (
            item.section
              ? <div key={i} className="nav-section">{item.section}</div>
              : <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  <item.icon size={16} />
                  {item.label}
                </NavLink>
          ))}
        </div>

        <div className="sidebar-footer">
          <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', fontSize: 13 }} onClick={handleLogout}>
            <LogOut size={15} /> Logout
          </button>
        </div>
      </nav>

      {/* Main content */}
      <main style={{
        flex: 1, overflow: 'auto',
        background: 'var(--color-surface)',
        display: 'flex', flexDirection: 'column'
      }}>
        <div style={{ flex: 1, padding: '28px 32px', maxWidth: 1400, width: '100%', margin: '0 auto' }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
