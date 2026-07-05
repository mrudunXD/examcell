import { useState, useEffect } from 'react';
import { 
  UserCog, Shield, Database, Cpu, Bell, Key, RefreshCw, Sliders, ToggleLeft, 
  Terminal, Info, Check, Save, RotateCcw, AlertTriangle, Play, HelpCircle, 
  Folder, ChevronRight, ChevronDown, CheckSquare, Square, Search, Eye, EyeOff, BookOpen, Layers,
  User, Trash2, Plus, Download, Upload, Server
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore, useSettingsStore } from '../store/index.js';
import api from '../lib/api.js';

// Structured Section Categories for Sidebar
const CATEGORY_GROUPS = [
  {
    name: 'Platform Config',
    items: [
      { id: 'general', label: 'General Settings', desc: 'Institution identity and display settings' },
      { id: 'seating', label: 'Seating Layouts', desc: 'Alternate seating density and rules' },
      { id: 'classrooms', label: 'Classrooms Settings', desc: 'Smart room priorities and buffers' },
      { id: 'notifications', label: 'Notifications', desc: 'Email, SMS, and WebSocket relays' }
    ]
  },
  {
    name: 'Core Scheduling',
    items: [
      { id: 'solver', label: 'Solver Config', desc: 'Solve limits and threads parameters' },
      { id: 'constraints', label: 'Constraint Manager', desc: 'Enable/disable individual rules' },
      { id: 'weights', label: 'Objective Weights', desc: 'Balance scheduling priority sliders' },
      { id: 'academic', label: 'Academic Policies', desc: 'Semester structures and shift timings' }
    ]
  },
  {
    name: 'Access & Security',
    items: [
      { id: 'users', label: 'Users & Roles', desc: 'User management accounts list and access matrix' },
      { id: 'security', label: 'Security Policies', desc: 'JWT expiration and rate limits' }
    ]
  },
  {
    name: 'Infrastructure',
    items: [
      { id: 'database', label: 'Database Status', desc: 'VACUUM tools and connection pools' },
      { id: 'monitoring', label: 'Monitoring Alerts', desc: 'Telemetry warning thresholds' },
      { id: 'logging', label: 'Logging Policies', desc: 'Retention days and log level filters' },
      { id: 'backup', label: 'Backup & Recovery', desc: 'Auto cron schedules and backup snapshots manager' },
      { id: 'performance', label: 'Performance', desc: 'Caching and compression settings' }
    ]
  },
  {
    name: 'Advanced Tools',
    items: [
      { id: 'ai', label: 'AI Settings', desc: 'Model provider and API credentials' },
      { id: 'flags', label: 'Feature Flags', desc: 'Enable experimental toggles' },
      { id: 'playground', label: 'SQL Playground', desc: 'Raw database sandbox query box' },
      { id: 'about', label: 'About System', desc: 'Version indicators and licenses' }
    ]
  }
];

// Reusable Custom Switch Toggle Component
function ToggleSwitch({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      style={{
        width: 40,
        height: 20,
        borderRadius: 20,
        background: checked ? 'var(--accent-purple)' : 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.1)',
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        alignItems: 'center',
        padding: 0,
        boxShadow: checked ? '0 0 10px rgba(168, 85, 247, 0.3)' : 'none'
      }}
    >
      <div style={{
        width: 14,
        height: 14,
        borderRadius: '50%',
        background: '#FFFFFF',
        position: 'absolute',
        left: checked ? 23 : 3,
        transition: 'left 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.4)'
      }} />
    </button>
  );
}

// Reusable Range Slider Component
function RangeSlider({ value, onChange, min = 0, max = 100 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%' }}>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(parseInt(e.target.value, 10))}
        style={{
          flex: 1,
          height: 6,
          borderRadius: 3,
          background: 'rgba(255,255,255,0.08)',
          outline: 'none',
          cursor: 'pointer',
          WebkitAppearance: 'none',
          accentColor: 'var(--accent-purple)'
        }}
      />
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--accent-purple)',
        background: 'rgba(168,85,247,0.12)',
        padding: '3px 8px',
        borderRadius: 4,
        minWidth: 32,
        textAlign: 'center'
      }}>
        {value}
      </span>
    </div>
  );
}

export default function SettingsPage() {
  const user = useAuthStore(state => state.user);
  const isSuper = user?.role === 'coordinator' && user?.email === 'admin@mitwpu.edu.in';
  
  const { settings, isLoading, isSaving, fetchSettings, updateSettings, resetToDefaults } = useSettingsStore();

  const [activeSection, setActiveSection] = useState('general');
  const [search, setSearch] = useState('');
  const [localState, setLocalState] = useState({});
  const [showApiKey, setShowApiKey] = useState(false);

  // Users List states
  const [usersList, setUsersList] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userForm, setUserForm] = useState({ name: '', email: '', department: '', role: 'faculty', password: '' });

  // SQL Playground States
  const [sqlQuery, setSqlQuery] = useState('SELECT name, email, role, department FROM users LIMIT 5;');
  const [sqlResults, setSqlResults] = useState(null);
  const [sqlLoading, setSqlLoading] = useState(false);
  const [sqlError, setSqlError] = useState(null);
  const [sqlStats, setSqlStats] = useState(null);

  // Settings history state
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Database stats states
  const [dbTelemetry, setDbTelemetry] = useState(null);
  const [telemetryLoading, setTelemetryLoading] = useState(false);

  // Backups list states
  const [backupsList, setBackupsList] = useState([]);
  const [backupsLoading, setBackupsLoading] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (settings && settings.length > 0) {
      const state = {};
      settings.forEach(s => {
        state[s.key] = s.value;
      });
      setLocalState(state);
    }
  }, [settings]);

  // Load audit logs
  const loadAuditLogs = async () => {
    if (!isSuper) return;
    setAuditLoading(true);
    try {
      const { data } = await api.get('/settings/audit');
      setAuditLogs(data);
    } catch {
      toast.error('Failed to load audit logs');
    } finally {
      setAuditLoading(false);
    }
  };

  // Load backups list
  const loadBackups = async () => {
    setBackupsLoading(true);
    try {
      const { data } = await api.get('/backups');
      setBackupsList(data);
    } catch {
      toast.error('Failed to load database backups list');
    } finally {
      setBackupsLoading(false);
    }
  };

  // Load database telemetry
  const loadDatabaseTelemetry = async () => {
    setTelemetryLoading(true);
    try {
      const { data } = await api.get('/settings/telemetry');
      setDbTelemetry(data);
    } catch {
      toast.error('Failed to load database telemetry');
    } finally {
      setTelemetryLoading(false);
    }
  };

  // Load users list
  const loadUsersList = async () => {
    setUsersLoading(true);
    try {
      const { data } = await api.get('/faculty');
      setUsersList(data);
    } catch {
      toast.error('Failed to load users accounts list');
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (activeSection === 'logging' && isSuper) {
      loadAuditLogs();
    }
    if (activeSection === 'backup') {
      loadBackups();
    }
    if (activeSection === 'database') {
      loadDatabaseTelemetry();
    }
    if (activeSection === 'users') {
      loadUsersList();
    }
  }, [activeSection]);

  const dbStateMap = {};
  settings.forEach(s => {
    dbStateMap[s.key] = s.value;
  });

  const isDirty = JSON.stringify(localState) !== JSON.stringify(dbStateMap);

  const handleLocalChange = (key, val) => {
    setLocalState(prev => ({ ...prev, [key]: String(val) }));
  };

  const handleSave = async () => {
    const res = await updateSettings(localState);
    if (res.success) {
      toast.success('System settings updated successfully');
    } else {
      toast.error(res.error || 'Failed to save settings');
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to restore all settings to default values? This will override custom configs.')) return;
    const res = await resetToDefaults();
    if (res.success) {
      toast.success('Settings restored to defaults');
    } else {
      toast.error(res.error || 'Reset failed');
    }
  };

  // User Actions
  const handleUserClick = (usr) => {
    setSelectedUser(usr);
    setUserForm({
      name: usr.name,
      email: usr.email,
      department: usr.department || '',
      role: usr.role,
      password: ''
    });
  };

  const handleUserFormSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    const loadId = toast.loading('Updating user account...');
    try {
      await api.put(`/faculty/${selectedUser.id}`, userForm);
      toast.success('User details updated successfully', { id: loadId });
      setSelectedUser(null);
      loadUsersList();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update user', { id: loadId });
    }
  };

  // Backup Actions
  const triggerCreateBackup = async () => {
    const loadId = toast.loading('Creating system backup JSON...');
    try {
      await api.post('/backups');
      toast.success('Manual backup created successfully', { id: loadId });
      loadBackups();
    } catch {
      toast.error('Failed to generate manual backup', { id: loadId });
    }
  };

  const triggerRestoreBackup = async (filename) => {
    if (!confirm(`Are you absolutely sure you want to restore database schema to ${filename}? Current records will be replaced.`)) return;
    const loadId = toast.loading(`Restoring system snapshot: ${filename}...`);
    try {
      await api.post('/backups/restore', { filename });
      toast.success('Database restored successfully! Refreshing details...', { id: loadId });
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Restore failed', { id: loadId });
    }
  };

  const triggerDeleteBackup = async (filename) => {
    if (!confirm(`Are you sure you want to delete backup file: ${filename}?`)) return;
    const loadId = toast.loading(`Deleting backup snapshot file...`);
    try {
      await api.delete(`/backups/${filename}`);
      toast.success('Backup deleted successfully', { id: loadId });
      loadBackups();
    } catch {
      toast.error('Failed to delete backup file', { id: loadId });
    }
  };

  const executeSql = async () => {
    setSqlLoading(true);
    setSqlError(null);
    setSqlResults(null);
    try {
      const { data } = await api.post('/settings/playground', { query: sqlQuery });
      setSqlResults(data);
      setSqlStats({ duration: data.duration, rows: data.rowCount });
      toast.success('Query executed successfully');
    } catch (err) {
      setSqlError(err.response?.data?.error || 'Execution failed');
    } finally {
      setSqlLoading(false);
    }
  };

  const runDatabaseOptimize = async () => {
    if (!confirm('Optimize database? This will run VACUUM and REINDEX schemas.')) return;
    const loadId = toast.loading('Optimizing database tables...');
    try {
      const { data } = await api.post('/settings/optimize');
      toast.success(data.message || 'Optimized successfully', { id: loadId });
      loadDatabaseTelemetry();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to optimize', { id: loadId });
    }
  };

  // Filter sections based on search query
  const filteredGroups = CATEGORY_GROUPS.map(group => {
    const matches = group.items.filter(item => 
      item.label.toLowerCase().includes(search.toLowerCase()) ||
      item.desc.toLowerCase().includes(search.toLowerCase())
    );
    return { ...group, items: matches };
  }).filter(group => group.items.length > 0);

  const totalFiltered = filteredGroups.reduce((acc, g) => acc + g.items.length, 0);

  if (isLoading && settings.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 16px' }} />
        <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Loading settings center...</span>
      </div>
    );
  }

  // Get metadata details for active section
  let activeDetails = null;
  for (const group of CATEGORY_GROUPS) {
    const found = group.items.find(i => i.id === activeSection);
    if (found) {
      activeDetails = found;
      break;
    }
  }

  // Filter users list based on search input
  const filteredUsers = usersList.filter(u => 
    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.department && u.department.toLowerCase().includes(userSearch.toLowerCase()))
  );

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 52px)', background: 'var(--bg-base)', fontFamily: 'var(--font-sans)' }}>
      {/* ── Left Navigation Column ─────────────────────────────────────────── */}
      <div style={{ 
        width: 290, 
        borderRight: '1px solid var(--border)', 
        background: 'rgba(13, 12, 24, 0.4)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0
      }}>
        {/* Search header */}
        <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid var(--border-faint)' }}>
          <div className="saas-search-input-wrapper" style={{ width: '100%', background: 'rgba(9, 9, 20, 0.6)' }}>
            <Search size={13} color="var(--text-tertiary)" strokeWidth={1.5} />
            <input 
              placeholder="Search configurations..." 
              className="saas-search-input" 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ fontSize: 13 }}
            />
          </div>
        </div>

        {/* Tree Menu list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 12px' }}>
          {filteredGroups.map(group => (
            <div key={group.name} style={{ marginBottom: 24 }}>
              <div style={{ 
                fontSize: 10, 
                fontWeight: 900, 
                textTransform: 'uppercase', 
                letterSpacing: '0.1em', 
                color: 'var(--text-tertiary)', 
                padding: '0 12px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <Folder size={11} color="var(--text-tertiary)" />
                {group.name}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {group.items.map(item => {
                  const isActive = activeSection === item.id;
                  const isRestricted = ['database', 'security', 'flags', 'backup', 'playground'].includes(item.id);
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveSection(item.id);
                        setSelectedUser(null);
                      }}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        textAlign: 'left',
                        fontSize: 13,
                        fontWeight: isActive ? 600 : 500,
                        border: 'none',
                        background: isActive ? 'linear-gradient(90deg, rgba(168, 85, 247, 0.12), transparent)' : 'transparent',
                        borderLeft: isActive ? '3px solid var(--accent-purple)' : '3px solid transparent',
                        cursor: 'pointer',
                        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <span>{item.label}</span>
                      {isRestricted && (
                        <Shield size={11} color={isSuper ? 'var(--accent-purple)' : 'var(--accent-amber)'} style={{ opacity: 0.8 }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {totalFiltered === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-tertiary)', fontSize: 13 }}>
              No categories found.
            </div>
          )}
        </div>
      </div>

      {/* ── Right Panel Details Form Column ─────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Content Header */}
        <div style={{ 
          padding: '24px 40px', 
          borderBottom: '1px solid var(--border-faint)', 
          background: 'rgba(13, 12, 24, 0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}>
              {activeDetails?.label}
            </h2>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 4 }}>
              {activeDetails?.desc}
            </p>
          </div>
          {isDirty && (
            <div className="fade-in-up" style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setLocalState(dbStateMap)} style={{ borderRadius: 6 }}>
                <RotateCcw size={12} style={{ marginRight: 6 }} /> Reset
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={isSaving} style={{ borderRadius: 6, padding: '0 16px', boxShadow: '0 4px 12px rgba(168, 85, 247, 0.25)' }}>
                {isSaving ? 'Saving...' : <><Save size={12} style={{ marginRight: 6 }} /> Save Configuration</>}
              </button>
            </div>
          )}
        </div>

        {/* Content area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '40px 48px' }}>
          
          {/* ──────────────────────────────── GENERAL ──────────────────────────────── */}
          {activeSection === 'general' && (
            <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 28 }} className="saas-fade-in">
              <div className="form-group">
                <label className="form-label" style={{ fontFamily: 'var(--font-serif)', letterSpacing: '0.02em' }}>Institution Name</label>
                <input 
                  className="input" 
                  value={localState['general.institutionName'] || ''} 
                  onChange={e => handleLocalChange('general.institutionName', e.target.value)}
                  style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8, padding: '10px 14px' }}
                />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>Short Name Code</label>
                  <input 
                    className="input" 
                    value={localState['general.shortName'] || ''} 
                    onChange={e => handleLocalChange('general.shortName', e.target.value)}
                    style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>Branding Logo Path</label>
                  <input 
                    className="input" 
                    value={localState['general.logo'] || ''} 
                    onChange={e => handleLocalChange('general.logo', e.target.value)}
                    style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>Address</label>
                <textarea 
                  className="input" 
                  rows={2}
                  value={localState['general.address'] || ''} 
                  onChange={e => handleLocalChange('general.address', e.target.value)}
                  style={{ resize: 'none', height: 'auto', padding: '10px 14px', background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>Display Date Format</label>
                  <select 
                    className="select"
                    value={localState['general.dateFormat'] || ''} 
                    onChange={e => handleLocalChange('general.dateFormat', e.target.value)}
                    style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                  >
                    <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 05/07/2026)</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-07-05)</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 07/05/2026)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>Time System</label>
                  <select 
                    className="select"
                    value={localState['general.timeFormat'] || ''} 
                    onChange={e => handleLocalChange('general.timeFormat', e.target.value)}
                    style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                  >
                    <option value="12h">12-Hour format (AM/PM)</option>
                    <option value="24h">24-Hour format (Military)</option>
                  </select>
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>Accent Color Palette</label>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <input 
                      type="color" 
                      value={localState['general.accentColor'] || '#a855f7'}
                      onChange={e => handleLocalChange('general.accentColor', e.target.value)}
                      style={{ border: '1px solid rgba(255,255,255,0.1)', width: 36, height: 36, padding: 0, background: 'transparent', cursor: 'pointer', borderRadius: 8 }}
                    />
                    <input 
                      className="input" 
                      value={localState['general.accentColor'] || '#a855f7'}
                      onChange={e => handleLocalChange('general.accentColor', e.target.value)}
                      placeholder="#a855f7"
                      style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>Landing Route</label>
                  <select 
                    className="select"
                    value={localState['general.defaultLandingPage'] || ''} 
                    onChange={e => handleLocalChange('general.defaultLandingPage', e.target.value)}
                    style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                  >
                    <option value="/dashboard">Dashboard Overview</option>
                    <option value="/my-duties">My Duties (Faculty)</option>
                    <option value="/search">Global Explorer Search</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────── SEATING LAYOUTS ──────────────────────────────── */}
          {activeSection === 'seating' && (
            <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 28 }} className="saas-fade-in">
              <div className="form-group">
                <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>Bench Seating Capacity</label>
                <select 
                  className="select"
                  value={localState['seating.benchCapacity'] || '2'}
                  onChange={e => handleLocalChange('seating.benchCapacity', e.target.value)}
                  style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                >
                  <option value="1">1 Candidate per bench (Strict separation)</option>
                  <option value="2">2 Candidates per bench (Standard spacing)</option>
                  <option value="3">3 Candidates per bench (High density)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>Reserved Seats count per Room</label>
                <input 
                  className="input"
                  type="number"
                  value={localState['seating.reservedSeatsCount'] || ''}
                  onChange={e => handleLocalChange('seating.reservedSeatsCount', e.target.value)}
                  style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: 'rgba(30, 29, 53, 0.25)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <div>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>Alternate Branch seating rules</span>
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Enforces seating candidate branches alternately to block collusion.</span>
                  </div>
                  <ToggleSwitch 
                    checked={localState['seating.alternateSeating'] === 'true'}
                    onChange={val => handleLocalChange('seating.alternateSeating', val ? 'true' : 'false')}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: 'rgba(30, 29, 53, 0.25)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <div>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>Allow Mixed Branch allocation</span>
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Allows seating multiple branch subjects in any single room map.</span>
                  </div>
                  <ToggleSwitch 
                    checked={localState['seating.mixedBranchSeating'] === 'true'}
                    onChange={val => handleLocalChange('seating.mixedBranchSeating', val ? 'true' : 'false')}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: 'rgba(30, 29, 53, 0.25)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <div>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>Accessible Ground Seating Reserve</span>
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Prioritizes ground floor seat maps for disabled candidates.</span>
                  </div>
                  <ToggleSwitch 
                    checked={localState['seating.accessibleSeating'] === 'true'}
                    onChange={val => handleLocalChange('seating.accessibleSeating', val ? 'true' : 'false')}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────── CLASSROOMS ──────────────────────────────── */}
          {activeSection === 'classrooms' && (
            <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 28 }} className="saas-fade-in">
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>Classroom selection priorities</label>
                  <select 
                    className="select"
                    value={localState['classrooms.roomPriority'] || ''}
                    onChange={e => handleLocalChange('classrooms.roomPriority', e.target.value)}
                    style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                  >
                    <option value="capacity_desc">Capacity: Large Rooms First</option>
                    <option value="capacity_asc">Capacity: Small Rooms First</option>
                    <option value="room_no_asc">Room Name ascending</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>Classroom Capacity Buffer (%)</label>
                  <input 
                    className="input"
                    type="number"
                    value={localState['classrooms.capacityBuffer'] || ''}
                    onChange={e => handleLocalChange('classrooms.capacityBuffer', e.target.value)}
                    style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: 'rgba(30, 29, 53, 0.25)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <div>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>Prioritize Smart Classrooms</span>
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Maps exam sessions preferentially to smart classrooms first.</span>
                  </div>
                  <ToggleSwitch 
                    checked={localState['classrooms.smartClassroomPreference'] === 'true'}
                    onChange={val => handleLocalChange('classrooms.smartClassroomPreference', val ? 'true' : 'false')}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: 'rgba(30, 29, 53, 0.25)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <div>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>Enforce Laboratory restrictions</span>
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Blocks scheduling regular theory papers in laboratory blocks.</span>
                  </div>
                  <ToggleSwitch 
                    checked={localState['classrooms.labRestrictions'] === 'true'}
                    onChange={val => handleLocalChange('classrooms.labRestrictions', val ? 'true' : 'false')}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────── NOTIFICATIONS ──────────────────────────────── */}
          {activeSection === 'notifications' && (
            <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 16 }} className="saas-fade-in">
              {[
                { key: 'notifications.emailEnabled', label: 'Email Notifications Briefs', desc: 'Send automated email briefs to faculty and students.' },
                { key: 'notifications.smsEnabled', label: 'SMS Notifications integration', desc: 'Relay notifications over SMS integrations.' },
                { key: 'notifications.pushEnabled', label: 'Web Browser Push Indicators', desc: 'Trigger web browser push indicator events.' },
                { key: 'notifications.socketNotificationsEnabled', label: 'Real-Time WebSocket Warnings', desc: 'Push real-time warnings over WebSockets.' },
                { key: 'notifications.emergencyBroadcastEnabled', label: 'Emergency Broadcast Priority', desc: 'Allow broadcast priority notifications.' }
              ].map(n => (
                <div key={n.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'rgba(30, 29, 53, 0.25)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <div>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{n.label}</span>
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{n.desc}</span>
                  </div>
                  <ToggleSwitch 
                    checked={localState[n.key] === 'true'}
                    onChange={val => handleLocalChange(n.key, val ? 'true' : 'false')}
                  />
                </div>
              ))}
            </div>
          )}

          {/* ──────────────────────────────── SOLVER CONFIGURATIONS ──────────────────────────────── */}
          {activeSection === 'solver' && (
            <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 28 }} className="saas-fade-in">
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>Maximum Solve Time Limit (Seconds)</label>
                  <input 
                    className="input" 
                    type="number"
                    value={localState['scheduling.solverMaxSolveTimeSecs'] || ''} 
                    onChange={e => handleLocalChange('scheduling.solverMaxSolveTimeSecs', e.target.value)}
                    style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>Parallel Search Worker Threads</label>
                  <input 
                    className="input" 
                    type="number"
                    value={localState['scheduling.solverWorkerThreads'] || ''} 
                    onChange={e => handleLocalChange('scheduling.solverWorkerThreads', e.target.value)}
                    style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                  />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>Solver Random Seed</label>
                  <input 
                    className="input" 
                    type="number"
                    value={localState['scheduling.solverRandomSeed'] || ''} 
                    onChange={e => handleLocalChange('scheduling.solverRandomSeed', e.target.value)}
                    style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>Memory Allocation Ceiling (MB)</label>
                  <input 
                    className="input" 
                    type="number"
                    value={localState['scheduling.solverMemoryLimitMb'] || ''} 
                    onChange={e => handleLocalChange('scheduling.solverMemoryLimitMb', e.target.value)}
                    style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: 'rgba(30, 29, 53, 0.25)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <div>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>Enable Search logging outputs</span>
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Prints detailed search telemetry statistics in the backend server logs.</span>
                  </div>
                  <ToggleSwitch 
                    checked={localState['scheduling.solverLogSearch'] === 'true'}
                    onChange={val => handleLocalChange('scheduling.solverLogSearch', val ? 'true' : 'false')}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: 'rgba(30, 29, 53, 0.25)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <div>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>Execute Parallel search workers</span>
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Triggers concurrent CP-SAT search loops to optimize computation.</span>
                  </div>
                  <ToggleSwitch 
                    checked={localState['scheduling.solverParallelSearch'] === 'true'}
                    onChange={val => handleLocalChange('scheduling.solverParallelSearch', val ? 'true' : 'false')}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────── CONSTRAINT MANAGER ──────────────────────────────── */}
          {activeSection === 'constraints' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} className="saas-fade-in">
              {[
                { key: 'studentConflict', title: 'Student Conflict Rules', help: 'Ensures no candidate has two concurrent exams.' },
                { key: 'facultyConflict', title: 'Faculty Double-Booking', help: 'Ensures no supervisor is allocated to multiple classrooms in the same slot.' },
                { key: 'roomConflict', title: 'Room Double-Booking', help: 'Prevents booking the same classroom for different slot groups.' },
                { key: 'capacity', title: 'Room Capacity Constraints', help: 'Limits student allocations to matching bench limits.' },
                { key: 'fixedSlot', title: 'Manual Placement locks', help: 'Respects manual preset mappings.' },
                { key: 'holiday', title: 'Holiday Calendar Block', help: 'Blocks scheduling on declared holiday dates.' },
                { key: 'facultyLeave', title: 'Faculty Leave Exclusions', help: 'Bypasses duty assignments on approved leave periods.' },
                { key: 'maxExamsPerDay', title: 'Max Exams Per Day', help: 'Ceiling cap of exams a student writes in 24 hours.' },
                { key: 'morningPreference', title: 'Morning Shift Bias', help: 'Prioritizes morning slot scheduling.' },
                { key: 'gapPreference', title: 'Candidate Gap Spacing', help: 'Prioritizes spreading exams across dates.' },
                { key: 'departmentIsolation', title: 'Branch Room Clusters', help: 'Keeps student branches grouped in home clusters.' }
              ].map((c) => {
                const enabledKey = `scheduling.constraints.${c.key}.enabled`;
                const priorityKey = `scheduling.constraints.${c.key}.priority`;
                const weightKey = `scheduling.constraints.${c.key}.weight`;
                
                const isEnabled = localState[enabledKey] === 'true';

                return (
                  <div key={c.key} style={{ 
                    padding: '20px 24px', 
                    background: 'rgba(30, 29, 53, 0.25)', 
                    border: '1px solid var(--border)', 
                    borderRadius: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    boxShadow: isEnabled ? '0 0 16px rgba(168, 85, 247, 0.05)' : 'none',
                    transition: 'box-shadow 0.2s ease'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{c.title}</span>
                          <HelpCircle size={12} color="var(--text-tertiary)" style={{ cursor: 'pointer' }} title={c.help} />
                        </div>
                        <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', display: 'block', marginTop: 3 }}>{c.help}</span>
                      </div>
                      
                      <ToggleSwitch 
                        checked={isEnabled}
                        onChange={val => handleLocalChange(enabledKey, val ? 'true' : 'false')}
                      />
                    </div>

                    {isEnabled && (
                      <div className="grid-2 fade-in-up" style={{ marginTop: 4, paddingTop: 16, borderTop: '1px solid var(--border-faint)' }}>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: 11 }}>Constraint Priority</label>
                          <select 
                            className="select"
                            value={localState[priorityKey] || 'medium'}
                            onChange={e => handleLocalChange(priorityKey, e.target.value)}
                            style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                          >
                            <option value="critical">Critical Hard Constraint</option>
                            <option value="high">High priority</option>
                            <option value="medium">Medium priority</option>
                            <option value="low">Low priority</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: 11 }}>Solver Penalty Weight</label>
                          <input 
                            className="input"
                            type="number"
                            value={localState[weightKey] || '100'}
                            onChange={e => handleLocalChange(weightKey, e.target.value)}
                            style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ──────────────────────────────── OBJECTIVE WEIGHTS ──────────────────────────────── */}
          {activeSection === 'weights' && (
            <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 28 }} className="saas-fade-in">
              {[
                { key: 'weights.studentGap', label: 'Student Exam Spacing', desc: 'Spacing between consecutive candidate exams' },
                { key: 'weights.roomUtilization', label: 'Compact Room Utilization', desc: 'Fills classrooms densely to save operational resources' },
                { key: 'weights.facultyBalance', label: 'Faculty Duty Balance', desc: 'Ensures even load count across department teachers' },
                { key: 'weights.morningPreference', label: 'Morning Shift Preference', desc: 'Prioritizes morning slot scheduling' },
                { key: 'weights.preferredRoom', label: 'Department Home Room Mapping', desc: 'Maps classes close to home blocks' },
                { key: 'weights.examSpread', label: 'Branch Exam Spread', desc: 'Ensures spacing of same branch subjects' }
              ].map(w => (
                <div key={w.key} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--text-primary)' }}>{w.label}</span>
                      <span style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{w.desc}</span>
                    </div>
                  </div>
                  <RangeSlider 
                    value={parseInt(localState[w.key] || '0', 10)}
                    onChange={val => handleLocalChange(w.key, val)}
                  />
                </div>
              ))}

              {/* Score preview indicator */}
              <div style={{ 
                padding: '16px 24px', 
                background: 'rgba(16, 185, 129, 0.05)', 
                border: '1px solid rgba(16, 185, 129, 0.2)', 
                borderRadius: 8,
                marginTop: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Live Simulated Solver Score Preview</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: '#34d399', textShadow: '0 0 10px rgba(52, 211, 153, 0.2)' }}>
                  {Object.keys(localState)
                    .filter(k => k.startsWith('weights.'))
                    .reduce((sum, key) => sum + (parseInt(localState[key], 10) || 0) * 12, 12000)} pts
                </span>
              </div>
            </div>
          )}

          {/* ──────────────────────────────── ACADEMIC POLICIES ──────────────────────────────── */}
          {activeSection === 'academic' && (
            <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 28 }} className="saas-fade-in">
              <div className="form-group">
                <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>Institute Working Days (Comma-separated)</label>
                <input 
                  className="input"
                  value={localState['academic.workingDays'] || ''}
                  onChange={e => handleLocalChange('academic.workingDays', e.target.value)}
                  style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>Daily Exam Slot timings (Comma-separated)</label>
                <input 
                  className="input"
                  value={localState['academic.shiftTimings'] || ''}
                  onChange={e => handleLocalChange('academic.shiftTimings', e.target.value)}
                  style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                />
              </div>
              <div className="grid-3">
                <div className="form-group">
                  <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>Max Exams/Student/Day</label>
                  <input 
                    className="input"
                    type="number"
                    value={localState['academic.maxExamsPerDay'] || ''}
                    onChange={e => handleLocalChange('academic.maxExamsPerDay', e.target.value)}
                    style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>Min Gap Days</label>
                  <input 
                    className="input"
                    type="number"
                    value={localState['academic.minGapDays'] || ''}
                    onChange={e => handleLocalChange('academic.minGapDays', e.target.value)}
                    style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>Max Gap Days</label>
                  <input 
                    className="input"
                    type="number"
                    value={localState['academic.maxGapDays'] || ''}
                    onChange={e => handleLocalChange('academic.maxGapDays', e.target.value)}
                    style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────── USERS & ROLES ──────────────────────────────── */}
          {activeSection === 'users' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }} className="saas-fade-in">
              
              {/* User management list */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-primary)' }}>Active Staff & Coordinator Accounts</h3>
                  <div className="saas-search-input-wrapper" style={{ width: 220, background: 'rgba(9, 9, 20, 0.6)' }}>
                    <Search size={12} color="var(--text-tertiary)" />
                    <input 
                      placeholder="Search accounts..." 
                      className="saas-search-input" 
                      value={userSearch}
                      onChange={e => setUserSearch(e.target.value)}
                    />
                  </div>
                </div>

                {usersLoading ? (
                  <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading users list...</div>
                ) : (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                    <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
                          <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Name</th>
                          <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Email Address</th>
                          <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Role</th>
                          <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Department</th>
                          <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((usr) => (
                          <tr key={usr.id} style={{ borderBottom: '1px solid var(--border-faint)' }}>
                            <td style={{ padding: '10px 14px', color: 'var(--text-primary)', fontWeight: 600 }}>{usr.name}</td>
                            <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{usr.email}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{ 
                                fontSize: 11, 
                                fontWeight: 700, 
                                textTransform: 'uppercase', 
                                padding: '2px 8px', 
                                borderRadius: 4, 
                                background: usr.role === 'coordinator' ? 'rgba(168,85,247,0.1)' : 'rgba(59,130,246,0.1)', 
                                color: usr.role === 'coordinator' ? 'var(--accent-purple)' : 'var(--accent-blue)' 
                              }}>
                                {usr.role}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{usr.department || '—'}</td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <button 
                                className="btn btn-ghost btn-sm" 
                                onClick={() => handleUserClick(usr)}
                                style={{ fontSize: 11, height: 24, padding: '0 8px', border: '1px solid var(--border)', borderRadius: 4 }}
                              >
                                Edit Account
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Edit Account Modal form overlay */}
              {selectedUser && (
                <div style={{ 
                  padding: 24, 
                  background: 'rgba(30, 29, 53, 0.35)', 
                  border: '1px solid var(--border)', 
                  borderRadius: 10,
                  marginTop: 16
                }} className="fade-in-up">
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>Edit Account: {selectedUser.name}</h3>
                  <form onSubmit={handleUserFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">Full Name</label>
                        <input 
                          className="input" 
                          value={userForm.name} 
                          onChange={e => setUserForm({ ...userForm, name: e.target.value })}
                          required
                          style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Email Address</label>
                        <input 
                          className="input" 
                          type="email"
                          value={userForm.email} 
                          onChange={e => setUserForm({ ...userForm, email: e.target.value })}
                          required
                          style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                        />
                      </div>
                    </div>
                    <div className="grid-2">
                      <div className="form-group">
                        <label className="form-label">Department</label>
                        <input 
                          className="input" 
                          value={userForm.department} 
                          onChange={e => setUserForm({ ...userForm, department: e.target.value })}
                          style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Update password (Leave blank to keep current)</label>
                        <input 
                          className="input" 
                          type="password"
                          placeholder="••••••••"
                          value={userForm.password} 
                          onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                          style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
                      <button type="button" className="btn btn-ghost" onClick={() => setSelectedUser(null)} style={{ height: 32, borderRadius: 6 }}>Cancel</button>
                      <button type="submit" className="btn btn-primary" style={{ height: 32, borderRadius: 6 }}>Update details</button>
                    </div>
                  </form>
                </div>
              )}

              {/* Permission Matrix */}
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>RBAC Permission Matrix Overview</h3>
                <div className="table-responsive" style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                  <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '14px 18px', textAlign: 'left', fontWeight: 600 }}>Capability Resource</th>
                        <th style={{ padding: '14px 18px', textAlign: 'center', fontWeight: 600 }}>Super Admin</th>
                        <th style={{ padding: '14px 18px', textAlign: 'center', fontWeight: 600 }}>Coordinator</th>
                        <th style={{ padding: '14px 18px', textAlign: 'center', fontWeight: 600 }}>Faculty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { resource: 'Database Optimization & Raw SQL execution', super: true, coord: false, faculty: false },
                        { resource: 'Update System Security & Auth Policies', super: true, coord: false, faculty: false },
                        { resource: 'Configure Exam Cycles & Solve limits', super: true, coord: true, faculty: false },
                        { resource: 'Override / Swapping Student Seating plans', super: true, coord: true, faculty: false },
                        { resource: 'View System Dashboard & Heatmaps', super: true, coord: true, faculty: false },
                        { resource: 'Acknowledge Supervisor Duties', super: true, coord: true, faculty: true },
                        { resource: 'Mark Attendance & Log incident reports', super: true, coord: true, faculty: true },
                      ].map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: idx < 6 ? '1px solid var(--border-faint)' : 'none' }}>
                          <td style={{ padding: '14px 18px', color: 'var(--text-secondary)' }}>{row.resource}</td>
                          <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', width: 20, height: 20, borderRadius: '50%', background: row.super ? 'rgba(168,85,247,0.1)' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                              {row.super ? <Check size={12} color="var(--accent-purple)" /> : '—'}
                            </div>
                          </td>
                          <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', width: 20, height: 20, borderRadius: '50%', background: row.coord ? 'rgba(16,185,129,0.1)' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                              {row.coord ? <Check size={12} color="var(--accent-green)" /> : '—'}
                            </div>
                          </td>
                          <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', width: 20, height: 20, borderRadius: '50%', background: row.faculty ? 'rgba(59,130,246,0.1)' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                              {row.faculty ? <Check size={12} color="var(--accent-blue)" /> : '—'}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────── SECURITY ──────────────────────────────── */}
          {activeSection === 'security' && (
            <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 28 }} className="saas-fade-in">
              {!isSuper && (
                <div style={{ padding: '14px 20px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <AlertTriangle size={18} color="var(--accent-amber)" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>Authorization Notice</span>
                    <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>Only the Super Admin role is permitted to modify security policy settings. Changes will be blocked on submit.</p>
                  </div>
                </div>
              )}
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>JWT Session Expiration (e.g. 1h, 12h)</label>
                  <input 
                    className="input" 
                    value={localState['security.jwtExpiry'] || ''} 
                    onChange={e => handleLocalChange('security.jwtExpiry', e.target.value)}
                    disabled={!isSuper}
                    style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>Refresh Token Expiration (e.g. 7d, 30d)</label>
                  <input 
                    className="input" 
                    value={localState['security.refreshTokenExpiry'] || ''} 
                    onChange={e => handleLocalChange('security.refreshTokenExpiry', e.target.value)}
                    disabled={!isSuper}
                    style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                  />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>Login Failed Attempt Limit</label>
                  <input 
                    className="input" 
                    type="number"
                    value={localState['security.loginAttemptLimit'] || ''} 
                    onChange={e => handleLocalChange('security.loginAttemptLimit', e.target.value)}
                    disabled={!isSuper}
                    style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>Account Lockout Duration (Mins)</label>
                  <input 
                    className="input" 
                    type="number"
                    value={localState['security.accountLockoutDurationMins'] || ''} 
                    onChange={e => handleLocalChange('security.accountLockoutDurationMins', e.target.value)}
                    disabled={!isSuper}
                    style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                  />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>API Rate Limit Window (Mins)</label>
                  <input 
                    className="input" 
                    type="number"
                    value={localState['security.rateLimitWindowMins'] || ''} 
                    onChange={e => handleLocalChange('security.rateLimitWindowMins', e.target.value)}
                    disabled={!isSuper}
                    style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>Max Requests per Window</label>
                  <input 
                    className="input" 
                    type="number"
                    value={localState['security.rateLimitMaxRequests'] || ''} 
                    onChange={e => handleLocalChange('security.rateLimitMaxRequests', e.target.value)}
                    disabled={!isSuper}
                    style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>CORS Allowed Origins</label>
                <input 
                  className="input" 
                  value={localState['security.allowedOrigins'] || ''} 
                  onChange={e => handleLocalChange('security.allowedOrigins', e.target.value)}
                  disabled={!isSuper}
                  style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                />
              </div>
            </div>
          )}

          {/* ──────────────────────────────── DATABASE ──────────────────────────────── */}
          {activeSection === 'database' && (
            <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 28 }} className="saas-fade-in">
              {/* Connection Status indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '20px 24px', background: 'rgba(168, 85, 247, 0.04)', border: '1px solid rgba(168, 85, 247, 0.15)', borderRadius: 8 }}>
                <Database size={26} color="var(--accent-purple)" />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>PostgreSQL Database Operational</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>Pool Limit: {localState['database.connectionPoolMax'] || 20} connections · Idle timeout: {localState['database.idleTimeoutMillis'] || 30000} ms</div>
                </div>
              </div>

              {/* Maintenance Tools */}
              <div>
                <h3 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>System Maintenance Tools</h3>
                <button 
                  onClick={runDatabaseOptimize}
                  disabled={!isSuper}
                  className="btn btn-ghost"
                  style={{ border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 8, padding: '10px 16px' }}
                >
                  <RefreshCw size={13} style={{ marginRight: 8 }} /> Optimize Tables (VACUUM & REINDEX)
                </button>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>Restructures index storage trees and reclaims deleted cell spaces. Runs asynchronously in the background.</span>
              </div>

              {/* Database Telemetry Grid */}
              {telemetryLoading ? (
                <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>Loading table structure telemetry...</div>
              ) : dbTelemetry ? (
                <div>
                  <h3 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>Table Struct Row Telemetry</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                    {dbTelemetry.tables && dbTelemetry.tables.map(table => (
                      <div key={table.name} style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-tertiary)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                          <Server size={10} />
                          {table.name}
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 750, color: 'var(--text-primary)', marginTop: 6 }}>{table.row_count} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-secondary)' }}>rows</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* ──────────────────────────────── MONITORING ALERTS ──────────────────────────────── */}
          {activeSection === 'monitoring' && (
            <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 28 }} className="saas-fade-in">
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>CPU Warning Threshold Limit (%)</label>
                  <input 
                    className="input"
                    type="number"
                    value={localState['monitoring.cpuThreshold'] || ''}
                    onChange={e => handleLocalChange('monitoring.cpuThreshold', e.target.value)}
                    style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>RAM Warning Threshold Limit (%)</label>
                  <input 
                    className="input"
                    type="number"
                    value={localState['monitoring.ramThreshold'] || ''}
                    onChange={e => handleLocalChange('monitoring.ramThreshold', e.target.value)}
                    style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                  />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>Disk Warning threshold (%)</label>
                  <input 
                    className="input"
                    type="number"
                    value={localState['monitoring.diskThreshold'] || ''}
                    onChange={e => handleLocalChange('monitoring.diskThreshold', e.target.value)}
                    style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>Solver Timeout Warning (Seconds)</label>
                  <input 
                    className="input"
                    type="number"
                    value={localState['monitoring.solverRuntimeThresholdSecs'] || ''}
                    onChange={e => handleLocalChange('monitoring.solverRuntimeThresholdSecs', e.target.value)}
                    style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────── LOGGING POLICIES ──────────────────────────────── */}
          {activeSection === 'logging' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }} className="saas-fade-in">
              <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>Console Logging Depth Filter</label>
                    <select 
                      className="select"
                      value={localState['logging.level'] || ''}
                      onChange={e => handleLocalChange('logging.level', e.target.value)}
                      style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                    >
                      <option value="debug">DEBUG (Verbose logs)</option>
                      <option value="info">INFO (Standard alerts)</option>
                      <option value="warn">WARN (Warnings only)</option>
                      <option value="error">ERROR (Failures only)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>Audit Log Database Retention (Days)</label>
                    <input 
                      className="input"
                      type="number"
                      value={localState['logging.retentionPeriodDays'] || ''}
                      onChange={e => handleLocalChange('logging.retentionPeriodDays', e.target.value)}
                      style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                    />
                  </div>
                </div>
              </div>

              {/* Settings Audit Trail Log (Super Admin only) */}
              {isSuper && (
                <div>
                  <h3 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Settings Modification Audit Trail Logs</h3>
                  {auditLoading ? (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading audit records...</div>
                  ) : (
                    <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                      <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                        <thead>
                          <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Timestamp</th>
                            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Setting Key</th>
                            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Prior Value</th>
                            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>New Value</th>
                            <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Modified By</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditLogs.map((log) => (
                            <tr key={log.id} style={{ borderBottom: '1px solid var(--border-faint)' }}>
                              <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{new Date(log.updated_at).toLocaleString()}</td>
                              <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{log.setting_key}</td>
                              <td style={{ padding: '10px 14px', color: 'var(--text-secondary)', maxInlineSize: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.old_value || '—'}</td>
                              <td style={{ padding: '10px 14px', color: 'var(--text-primary)', maxInlineSize: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.new_value}</td>
                              <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{log.updated_by_name || 'System Seed'}</td>
                            </tr>
                          ))}
                          {auditLogs.length === 0 && (
                            <tr>
                              <td colSpan="5" style={{ padding: '16px', textAlign: 'center', color: 'var(--text-tertiary)' }}>No settings audits recorded yet.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ──────────────────────────────── BACKUP & RECOVERY ──────────────────────────────── */}
          {activeSection === 'backup' && (
            <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 28 }} className="saas-fade-in">
              <div className="form-group">
                <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>Cron auto-backup schedule mapping</label>
                <input 
                  className="input"
                  value={localState['backup.schedule'] || ''}
                  onChange={e => handleLocalChange('backup.schedule', e.target.value)}
                  style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>Cron syntax schedule. Default `0 0 * * *` triggers database backups daily at midnight.</span>
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>Backup copy retention limit</label>
                <input 
                  className="input"
                  type="number"
                  value={localState['backup.retentionCount'] || ''}
                  onChange={e => handleLocalChange('backup.retentionCount', e.target.value)}
                  style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: 'rgba(30, 29, 53, 0.25)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <div>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>Enable database daily auto-backups</span>
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Enables scheduled automatic database json backup dumps.</span>
                  </div>
                  <ToggleSwitch 
                    checked={localState['backup.autoBackupEnabled'] === 'true'}
                    onChange={val => handleLocalChange('backup.autoBackupEnabled', val ? 'true' : 'false')}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: 'rgba(30, 29, 53, 0.25)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <div>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>Verify backup snapshot schema integrity</span>
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Runs consistency checks on created database json back files.</span>
                  </div>
                  <ToggleSwitch 
                    checked={localState['backup.verificationEnabled'] === 'true'}
                    onChange={val => handleLocalChange('backup.verificationEnabled', val ? 'true' : 'false')}
                  />
                </div>
              </div>

              {/* Backup Snapshot Manager */}
              <div style={{ borderTop: '1px solid var(--border-faint)', paddingTop: 24, marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Database Backup Snapshot Files</h3>
                  <button 
                    onClick={triggerCreateBackup}
                    className="btn btn-primary btn-sm"
                    style={{ height: 28, fontSize: 11, borderRadius: 6 }}
                  >
                    <Plus size={12} style={{ marginRight: 4 }} /> Trigger Manual Backup
                  </button>
                </div>

                {backupsLoading ? (
                  <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>Loading backups lists...</div>
                ) : (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                    <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
                          <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>File Name</th>
                          <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>File Size</th>
                          <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>Created Date</th>
                          <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600 }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {backupsList.map(bk => (
                          <tr key={bk.filename} style={{ borderBottom: '1px solid var(--border-faint)' }}>
                            <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-primary)' }}>{bk.filename}</td>
                            <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{Math.round(bk.size / 1024 * 10) / 10} KB</td>
                            <td style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>{new Date(bk.createdAt).toLocaleString()}</td>
                            <td style={{ padding: '10px 14px', display: 'flex', gap: 8, justifyContent: 'center' }}>
                              <button 
                                className="btn btn-ghost btn-sm"
                                onClick={() => triggerRestoreBackup(bk.filename)}
                                style={{ height: 24, fontSize: 11, color: 'var(--accent-purple)', borderColor: 'rgba(168,85,247,0.2)' }}
                              >
                                Restore
                              </button>
                              <button 
                                className="btn btn-ghost btn-sm"
                                onClick={() => triggerDeleteBackup(bk.filename)}
                                style={{ height: 24, fontSize: 11, color: 'var(--accent-red)', borderColor: 'rgba(239,68,68,0.2)' }}
                              >
                                <Trash2 size={11} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {backupsList.length === 0 && (
                          <tr>
                            <td colSpan={4} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-tertiary)' }}>No backups saved yet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ──────────────────────────────── PERFORMANCE ──────────────────────────────── */}
          {activeSection === 'performance' && (
            <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 28 }} className="saas-fade-in">
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>Static Route Cache TTL (Seconds)</label>
                  <input 
                    className="input"
                    type="number"
                    value={localState['performance.cacheDurationSecs'] || ''}
                    onChange={e => handleLocalChange('performance.cacheDurationSecs', e.target.value)}
                    style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>WebSocket Heartbeat Ping Interval (Seconds)</label>
                  <input 
                    className="input"
                    type="number"
                    value={localState['performance.socketHeartbeatSecs'] || ''}
                    onChange={e => handleLocalChange('performance.socketHeartbeatSecs', e.target.value)}
                    style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: 'rgba(30, 29, 53, 0.25)', border: '1px solid var(--border)', borderRadius: 8 }}>
                <div>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>Enable Response Compression</span>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Compresses response buffers over HTTP Gzip payloads to save bandwidth.</span>
                </div>
                <ToggleSwitch 
                  checked={localState['performance.compressionEnabled'] === 'true'}
                  onChange={val => handleLocalChange('performance.compressionEnabled', val ? 'true' : 'false')}
                />
              </div>
            </div>
          )}

          {/* ──────────────────────────────── AI SETTINGS ──────────────────────────────── */}
          {activeSection === 'ai' && (
            <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 28 }} className="saas-fade-in">
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>Primary Large Language Model Provider</label>
                  <select 
                    className="select"
                    value={localState['ai.provider'] || ''}
                    onChange={e => handleLocalChange('ai.provider', e.target.value)}
                    style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                  >
                    <option value="gemini">Google Gemini LLM</option>
                    <option value="openai">OpenAI (GPT-4o)</option>
                    <option value="anthropic">Anthropic Claude</option>
                    <option value="local">Local Model (Ollama / Llama-3)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>Model Identifier tag</label>
                  <input 
                    className="input"
                    value={localState['ai.model'] || ''}
                    onChange={e => handleLocalChange('ai.model', e.target.value)}
                    style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>API Access Key</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input 
                    className="input"
                    type={showApiKey ? 'text' : 'password'}
                    value={localState['ai.apiKey'] || ''}
                    onChange={e => handleLocalChange('ai.apiKey', e.target.value)}
                    placeholder="Enter access credential token..."
                    style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                  />
                  <button 
                    type="button" 
                    className="btn btn-ghost"
                    style={{ border: '1px solid var(--border)', width: 40, height: 38, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8 }}
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="grid-3">
                <div className="form-group">
                  <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>Temperature</label>
                  <input 
                    className="input"
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={localState['ai.temperature'] || ''}
                    onChange={e => handleLocalChange('ai.temperature', e.target.value)}
                    style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>Max Token Limit</label>
                  <input 
                    className="input"
                    type="number"
                    value={localState['ai.maxTokens'] || ''}
                    onChange={e => handleLocalChange('ai.maxTokens', e.target.value)}
                    style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>Daily Call Limits</label>
                  <input 
                    className="input"
                    type="number"
                    value={localState['ai.dailyUsageLimit'] || ''}
                    onChange={e => handleLocalChange('ai.dailyUsageLimit', e.target.value)}
                    style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                  />
                </div>
              </div>

              {/* AI Capabilities Toggles */}
              <div>
                <h3 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Enabled AI Actions</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    { key: 'ai.enableScheduleExplanation', label: 'Natural Language Schedule Explanations', desc: 'Allows generation of summary reports explaining allocation schedules.' },
                    { key: 'ai.enableConflictExplanation', label: 'Seating conflict explanation & suggestions', desc: 'Exposes suggestion metrics when seating allocations fail.' },
                    { key: 'ai.enableRiskAnalysis', label: 'Schedule Risk and Telemetry Analysis', desc: 'Scans cycles to identify scheduling risks.' }
                  ].map(capability => (
                    <div key={capability.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: 'rgba(30, 29, 53, 0.25)', border: '1px solid var(--border)', borderRadius: 8 }}>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{capability.label}</span>
                        <span style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{capability.desc}</span>
                      </div>
                      <ToggleSwitch 
                        checked={localState[capability.key] === 'true'}
                        onChange={val => handleLocalChange(capability.key, val ? 'true' : 'false')}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────── FEATURE FLAGS ──────────────────────────────── */}
          {activeSection === 'flags' && (
            <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 16 }} className="saas-fade-in">
              {!isSuper && (
                <div style={{ padding: '14px 20px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <AlertTriangle size={18} color="var(--accent-amber)" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>Authorization Notice</span>
                    <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>Only the Super Admin role is permitted to modify experimental feature flags.</p>
                  </div>
                </div>
              )}
              {[
                { key: 'flags.enableExperimentalSolver', label: 'ML-driven objective weight optimization search', desc: 'Allows AI constraint guidance calculations inside solver.py execution runs.' },
                { key: 'flags.enableConflictHotReload', label: 'Seating Conflict Hot Real-time updates', desc: 'Detects conflicts instantly when cell seat mappings shift.' },
                { key: 'flags.enableAdvancedAnalytics', label: 'Historical Forecasting and Trend analytics', desc: 'Integrates duty trend models in the heatmap visual displays.' },
                { key: 'flags.enableParallelScheduling', label: 'Multithread solver slot generation mapping', desc: 'Runs slots generation mapping across separate system workers.' }
              ].map(f => (
                <div key={f.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'rgba(30, 29, 53, 0.25)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <div>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>{f.label}</span>
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{f.desc}</span>
                  </div>
                  <ToggleSwitch 
                    checked={localState[f.key] === 'true'}
                    onChange={val => handleLocalChange(f.key, val ? 'true' : 'false')}
                    disabled={!isSuper}
                  />
                </div>
              ))}
            </div>
          )}

          {/* ──────────────────────────────── SQL PLAYGROUND ──────────────────────────────── */}
          {activeSection === 'playground' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }} className="saas-fade-in">
              {!isSuper ? (
                <div style={{ padding: 24, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: 'var(--text-primary)' }}>
                  <h3 style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--accent-red)' }}>Security Restriction Enforced</h3>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>The developer playground SQL terminal is exclusively accessible to the Super Admin (admin@mitwpu.edu.in). Regular coordinator accounts cannot invoke database commands.</p>
                </div>
              ) : (
                <>
                  <div style={{ 
                    border: '1px solid var(--border)', 
                    borderRadius: 10, 
                    overflow: 'hidden',
                    background: '#090914',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
                  }}>
                    {/* IDE Console Header layout */}
                    <div style={{ 
                      padding: '10px 16px', 
                      background: 'rgba(255,255,255,0.03)', 
                      borderBottom: '1px solid var(--border-faint)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f56' }} />
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffbd2e' }} />
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#27c93f' }} />
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>SQL Console Terminal</span>
                      <button 
                        onClick={executeSql} 
                        disabled={sqlLoading || !sqlQuery.trim()} 
                        className="btn btn-primary btn-sm"
                        style={{ height: 26, fontSize: 11, borderRadius: 4, padding: '0 12px' }}
                      >
                        {sqlLoading ? 'Executing...' : <><Play size={10} style={{ marginRight: 6 }} /> Run Console</>}
                      </button>
                    </div>
                    
                    <textarea 
                      value={sqlQuery}
                      onChange={e => setSqlQuery(e.target.value)}
                      style={{ 
                        width: '100%', 
                        height: 150, 
                        background: 'transparent', 
                        color: '#34d399', 
                        fontFamily: 'var(--font-mono)', 
                        fontSize: 12.5, 
                        padding: 16, 
                        border: 'none',
                        resize: 'vertical',
                        outline: 'none',
                        lineHeight: '1.6'
                      }}
                    />
                  </div>

                  {sqlError && (
                    <div style={{ padding: 14, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, color: 'var(--accent-red)', fontSize: 12, fontFamily: 'var(--font-mono)' }} className="fade-in-up">
                      Syntax Error: {sqlError}
                    </div>
                  )}

                  {sqlStats && (
                    <div style={{ display: 'flex', gap: 16, fontSize: 11.5, color: 'var(--text-tertiary)' }} className="fade-in-up">
                      <span>Records Fetched: {sqlStats.rows}</span>
                      <span>Execution Speed: {sqlStats.duration}ms</span>
                    </div>
                  )}

                  {sqlResults && sqlResults.rows && (
                    <div style={{ marginTop: 8 }} className="fade-in-up">
                      <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Console Output Results</h4>
                      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', overflowX: 'auto' }}>
                        <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                          <thead>
                            <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
                              {sqlResults.fields.map(f => (
                                <th key={f} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>{f}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sqlResults.rows.map((row, idx) => (
                              <tr key={idx} style={{ borderBottom: idx < sqlResults.rows.length - 1 ? '1px solid var(--border-faint)' : 'none' }}>
                                {sqlResults.fields.map(f => (
                                  <td key={f} style={{ padding: '10px 14px', color: 'var(--text-secondary)' }}>
                                    {typeof row[f] === 'object' ? JSON.stringify(row[f]) : String(row[f] !== null ? row[f] : 'NULL')}
                                  </td>
                                ))}
                              </tr>
                            ))}
                            {sqlResults.rows.length === 0 && (
                              <tr>
                                <td colSpan={sqlResults.fields.length || 1} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-tertiary)' }}>Empty result set.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ──────────────────────────────── ABOUT ──────────────────────────────── */}
          {activeSection === 'about' && (
            <div style={{ maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 16 }} className="saas-fade-in">
              <div style={{ 
                padding: '32px 28px', 
                background: 'rgba(30, 29, 53, 0.2)', 
                border: '1px solid var(--border)', 
                borderRadius: 10, 
                textAlign: 'center',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
              }}>
                <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.05em', fontFamily: 'var(--font-serif)' }}>ExamCell</span>
                <span style={{ display: 'block', fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>Enterprise Internal Academic Scheduler Engine</span>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 28, textAlign: 'left', fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-faint)', paddingBottom: 8 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Platform Version</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>v2.4.0-stable</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-faint)', paddingBottom: 8 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Database engine</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>PostgreSQL 16.2</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-faint)', paddingBottom: 8 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Scheduling engine</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Google OR-Tools CP-SAT</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-faint)', paddingBottom: 8 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Node Environment</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>Node.js v20.12</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>License</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>MIT License</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────── FACULTY DUTIES ──────────────────────────────── */}
          {activeSection === 'faculty' && (
            <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 28 }} className="saas-fade-in">
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>Minimum baseline duties per staff</label>
                  <input 
                    className="input"
                    type="number"
                    value={localState['faculty.minDuties'] || ''}
                    onChange={e => handleLocalChange('faculty.minDuties', e.target.value)}
                    style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontFamily: 'var(--font-serif)' }}>Maximum duties ceiling cap per staff</label>
                  <input 
                    className="input"
                    type="number"
                    value={localState['faculty.maxDuties'] || ''}
                    onChange={e => handleLocalChange('faculty.maxDuties', e.target.value)}
                    style={{ background: 'rgba(9, 9, 20, 0.4)', borderRadius: 8 }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: 'rgba(30, 29, 53, 0.25)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <div>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>Prioritize matching Department</span>
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Assigns faculty matching the branch department of exam.</span>
                  </div>
                  <ToggleSwitch 
                    checked={localState['faculty.departmentPreference'] === 'true'}
                    onChange={val => handleLocalChange('faculty.departmentPreference', val ? 'true' : 'false')}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: 'rgba(30, 29, 53, 0.25)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <div>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' }}>Enforce automatic load balancing</span>
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Distributes invigilation loads evenly across teachers.</span>
                  </div>
                  <ToggleSwitch 
                    checked={localState['faculty.automaticBalancing'] === 'true'}
                    onChange={val => handleLocalChange('faculty.automaticBalancing', val ? 'true' : 'false')}
                  />
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ── Sticky Bottom Drawer Actions ─────────────────────────────────────────── */}
        {isDirty && (
          <div className="fade-in-up" style={{ 
            background: 'var(--bg-surface)', 
            borderTop: '1px solid var(--border)', 
            padding: '18px 40px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 -8px 32px rgba(0,0,0,0.3)',
            zIndex: 30
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <AlertTriangle size={15} color="var(--accent-amber)" />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
                You have unsaved changes in your system configurations.
              </span>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                onClick={handleReset}
                className="btn btn-ghost"
                style={{ border: '1px solid var(--border)', color: 'var(--text-primary)', height: 38, borderRadius: 8 }}
              >
                Reset Defaults
              </button>
              <button 
                onClick={handleSave} 
                disabled={isSaving} 
                className="btn btn-primary"
                style={{ height: 38, borderRadius: 8, padding: '0 20px', boxShadow: '0 4px 12px rgba(168, 85, 247, 0.25)' }}
              >
                {isSaving ? 'Saving...' : <><Save size={13} style={{ marginRight: 6 }} /> Save Configuration</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
