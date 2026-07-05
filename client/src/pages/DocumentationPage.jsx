import { useState } from 'react';
import {
  LayoutDashboard, Users, BookOpen, Building2, UserCheck,
  CalendarDays, Grid3x3, UserCog, AlertTriangle, Download,
  ClipboardList, Search, Calendar, ClipboardCheck, Radio,
  BarChart3, Activity, TrendingUp, Settings, GraduationCap,
  Shield, FileDown, Clock, MapPin, CheckCircle, Zap,
  QrCode, Bell, Database, Cpu, Eye, FileText
} from 'lucide-react';

const sectionStyle = {
  marginBottom: 40,
};

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
  gap: 16,
};

const visualCard = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: 20,
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 10,
  transition: 'all 0.2s',
};

const stepConnector = {
  width: 2,
  height: 32,
  background: 'var(--border)',
  margin: '0 auto',
};

const MOCK = {
  pages: [
    { icon: LayoutDashboard, label: 'Dashboard', color: '#8b5cf6', desc: 'KPIs, live ops, broadcasts' },
    { icon: CalendarDays, label: 'Exam Cycles', color: '#3b82f6', desc: 'Create, activate, auto-schedule' },
    { icon: Users, label: 'Students', color: '#10b981', desc: 'CRUD, CSV import/export' },
    { icon: BookOpen, label: 'Subjects', color: '#f59e0b', desc: 'Manage exam subjects' },
    { icon: Building2, label: 'Classrooms', color: '#ef4444', desc: 'Room inventory & capacity' },
    { icon: UserCheck, label: 'Faculty', color: '#ec4899', desc: 'Accounts, leaves, subjects' },
    { icon: Grid3x3, label: 'Seating', color: '#14b8a6', desc: 'Generate, swap, override' },
    { icon: UserCog, label: 'Supervisors', color: '#f97316', desc: 'Assign duties to faculty' },
    { icon: AlertTriangle, label: 'Conflicts', color: '#dc2626', desc: 'Detect & resolve clashes' },
    { icon: Download, label: 'Exports', color: '#6366f1', desc: 'PDF: seating, duty, timetable' },
    { icon: ClipboardList, label: 'Attendance', color: '#84cc16', desc: 'Mark & track per slot' },
    { icon: Calendar, label: 'Calendar', color: '#06b6d4', desc: 'Cycle overview timeline' },
    { icon: Activity, label: 'Live Dashboard', color: '#22d3ee', desc: 'Real-time exam status' },
    { icon: BarChart3, label: 'Heatmap', color: '#a855f7', desc: 'Faculty load visualization' },
    { icon: TrendingUp, label: 'Analytics', color: '#34d399', desc: 'Historical trends & stats' },
    { icon: Radio, label: 'Planner', color: '#e11d48', desc: 'Drag & drop scheduling' },
    { icon: Eye, label: 'Kiosk', color: '#0ea5e9', desc: 'Smartboard display mode' },
    { icon: Settings, label: 'Settings', color: '#64748b', desc: 'System configuration' },
  ],
  roles: [
    { role: 'Super Admin', color: '#ef4444', perms: ['Full system access', 'DB & SQL console', 'Security policies', 'All coordinator features'] },
    { role: 'Coordinator', color: '#8b5cf6', perms: ['Exam cycle management', 'Seating & supervisors', 'Scheduling engine', 'Analytics & exports'] },
    { role: 'Faculty', color: '#3b82f6', perms: ['My duties & attendance', 'Incident reporting', 'Replacement requests', 'Broadcast acknowledgments'] },
  ],
  workflow: [
    { icon: GraduationCap, step: 'Create Cycle', color: '#8b5cf6' },
    { icon: BookOpen, step: 'Add Subjects', color: '#3b82f6' },
    { icon: Building2, step: 'Configure Rooms', color: '#10b981' },
    { icon: CalendarDays, step: 'Auto-Schedule', color: '#f59e0b' },
    { icon: Grid3x3, step: 'Generate Seating', color: '#ef4444' },
    { icon: UserCog, step: 'Assign Supervisors', color: '#ec4899' },
    { icon: ClipboardList, step: 'Mark Attendance', color: '#14b8a6' },
  ],
};

function Badge({ text, color }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, letterSpacing: '0.05em',
      textTransform: 'uppercase',
      background: `${color}18`, color,
      border: `1px solid ${color}30`,
      padding: '2px 8px', borderRadius: 4,
    }}>
      {text}
    </span>
  );
}

function StatCard({ icon: Icon, value, label, color }) {
  return (
    <div style={visualCard}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={20} color={color} />
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>{label}</div>
    </div>
  );
}

export default function DocumentationPage() {
  const [activeSection, setActiveSection] = useState('overview');

  const sections = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'pages', label: 'Pages', icon: FileText },
    { id: 'roles', label: 'Roles', icon: Shield },
    { id: 'workflow', label: 'Workflow', icon: Zap },
    { id: 'features', label: 'Features', icon: GraduationCap },
  ];

  return (
    <div className="fade-in" style={{ maxWidth: 960, margin: '0 auto', paddingBottom: 48 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <GraduationCap size={20} color="#8b5cf6" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>ExamCell Documentation</h1>
            <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--text-tertiary)' }}>Visual guide to the examination management platform</p>
          </div>
        </div>
      </div>

      {/* Section tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 32, flexWrap: 'wrap' }}>
        {sections.map(s => {
          const active = activeSection === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 8,
                border: 'none', cursor: 'pointer',
                background: active ? 'rgba(139,92,246,0.12)' : 'transparent',
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: 13, fontWeight: active ? 700 : 500,
                borderBottom: active ? '2px solid #8b5cf6' : '2px solid transparent',
                transition: 'all 0.15s',
              }}
            >
              <s.icon size={14} />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* ── OVERVIEW ── */}
      {activeSection === 'overview' && (
        <>
          <div style={{ ...sectionStyle, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
            <StatCard icon={CalendarDays} value="Exam Cycles" label="Manage exam periods" color="#8b5cf6" />
            <StatCard icon={Users} value="Students" label="CRUD + CSV import" color="#3b82f6" />
            <StatCard icon={Building2} value="Classrooms" label="Room inventory" color="#10b981" />
            <StatCard icon={UserCheck} value="Faculty" label="Accounts & duties" color="#f59e0b" />
            <StatCard icon={Grid3x3} value="Seating" label="Auto-generate plans" color="#ef4444" />
          </div>

          <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>System Architecture</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              {[
                { title: 'Frontend', stack: 'React 19 + Vite', items: ['Zustand state', 'Socket.IO client', 'Tailwind + CSS vars', 'Lucide icons'] },
                { title: 'Backend', stack: 'Node.js + Express', items: ['PostgreSQL + pg', 'JWT auth (cookies)', 'Socket.IO server', 'Helmet + CORS'] },
                { title: 'Scheduler', stack: 'Python OR-Tools', items: ['CP-SAT solver', 'Constraint plugins', 'Relaxed fallback', 'Docker integration'] },
              ].map(layer => (
                <div key={layer.title} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{layer.title}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>{layer.stack}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {layer.items.map(item => (
                      <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
                        <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--text-tertiary)' }} />
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── PAGES ── */}
      {activeSection === 'pages' && (
        <div style={sectionStyle}>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 20 }}>
            All pages available in the sidebar, organized by access level.
          </p>
          <div style={gridStyle}>
            {MOCK.pages.map(p => (
              <div key={p.label} style={visualCard}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${p.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <p.icon size={22} color={p.color} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{p.label}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.3 }}>{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ROLES ── */}
      {activeSection === 'roles' && (
        <div style={sectionStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {MOCK.roles.map(r => (
              <div key={r.role} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <Badge text={r.role} color={r.color} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {r.perms.map(p => (
                    <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                      <CheckCircle size={12} color={r.color} />
                      {p}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── WORKFLOW ── */}
      {activeSection === 'workflow' && (
        <div style={sectionStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
            {MOCK.workflow.map((w, i) => (
              <div key={w.step} style={{ display: 'flex', alignItems: 'center', gap: 20, width: '100%', maxWidth: 500 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: `${w.color}15`, border: `2px solid ${w.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <w.icon size={20} color={w.color} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{w.step}</div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                  Step {i + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── FEATURES ── */}
      {activeSection === 'features' && (
        <div style={sectionStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
            {[
              { icon: Zap, title: 'Auto-Scheduling', desc: 'CP-SAT solver assigns exams to slots respecting constraints', color: '#8b5cf6' },
              { icon: Grid3x3, title: 'Seating Generator', desc: 'Branch-interleaved bench allocation with override support', color: '#3b82f6' },
              { icon: QrCode, title: 'QR Attendance', desc: 'Simulated hall ticket scanning for rapid check-in', color: '#10b981' },
              { icon: Bell, title: 'Live Broadcasts', desc: 'Emergency alerts & announcements to kiosks and faculty', color: '#f59e0b' },
              { icon: AlertTriangle, title: 'Conflict Detection', desc: 'Faculty double-booking & room overflow checks', color: '#ef4444' },
              { icon: FileDown, title: 'PDF Exports', desc: 'Seating, duty sheets, timetables with QR codes', color: '#ec4899' },
              { icon: Radio, title: 'Drag & Drop Planner', desc: 'Manual slot adjustments with visual calendar', color: '#14b8a6' },
              { icon: Eye, title: 'Kiosk Mode', desc: 'Smartboard display with countdown timers & chimes', color: '#f97316' },
              { icon: BarChart3, title: 'Heatmap', desc: 'Faculty load distribution across exam schedule', color: '#6366f1' },
              { icon: Shield, title: 'Audit Trail', desc: 'Full action logging for compliance and review', color: '#dc2626' },
              { icon: Database, title: 'Backups & SQL', desc: 'Snapshot management and admin SQL console', color: '#84cc16' },
              { icon: Cpu, title: 'Settings Engine', desc: 'Configurable solver params, weights & feature flags', color: '#06b6d4' },
            ].map(f => (
              <div key={f.title} style={visualCard}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${f.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <f.icon size={20} color={f.color} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{f.title}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ borderTop: '1px solid var(--border-faint)', paddingTop: 24, textAlign: 'center', fontSize: 11, color: 'var(--text-tertiary)' }}>
        ExamCell v2.4.0 · MIT WPU Examination Cell · Internal Documentation
      </div>
    </div>
  );
}
