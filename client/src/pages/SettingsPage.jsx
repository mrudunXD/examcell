import { useState, useEffect } from 'react';
import { 
  UserCog, Shield, Database, Cpu, Bell, Key, RefreshCw, Sliders, ToggleLeft, 
  Terminal, Info, Check, Save, RotateCcw, AlertTriangle, Play, HelpCircle, 
  Folder, ChevronRight, ChevronDown, CheckSquare, Square, Search, Eye, EyeOff, BookOpen, Layers
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore, useSettingsStore } from '../store/index.js';
import api from '../lib/api.js';

const SECTIONS = [
  { id: 'general', label: 'General', category: 'General', desc: 'Institution name, branding logo, defaults' },
  { id: 'users', label: 'Users & Roles', category: 'Access Control', desc: 'Role management and permission matrix' },
  { id: 'security', label: 'Security', category: 'Security', desc: 'JWT expiration, login attempts, rate limits' },
  { id: 'database', label: 'Database', category: 'Infrastructure', desc: 'Vacuum, reindex, database connection status' },
  { id: 'solver', label: 'Solver Configurations', category: 'Scheduling', desc: 'Max solve time, threads, seed parameters' },
  { id: 'constraints', label: 'Constraint Manager', category: 'Scheduling', desc: 'Configure constraint toggles, weights, priorities' },
  { id: 'weights', label: 'Objective Weights', category: 'Scheduling', desc: 'Configure sliders for scheduling priorities' },
  { id: 'seating', label: 'Seating Layouts', category: 'Exam Rules', desc: 'Bench capacity, alternate seating rules' },
  { id: 'faculty', label: 'Faculty Duties', category: 'Exam Rules', desc: 'Duty caps, department mapping rules' },
  { id: 'classrooms', label: 'Classrooms Settings', category: 'Exam Rules', desc: 'Smart room priorities, capacity buffers' },
  { id: 'notifications', label: 'Notifications', category: 'Communications', desc: 'SMS, Email, Web socket alerts' },
  { id: 'ai', label: 'AI Settings', category: 'Intelligence', desc: 'LLM providers, API keys, temperature settings' },
  { id: 'monitoring', label: 'Monitoring Alerts', category: 'Infrastructure', desc: 'CPU, RAM telemetry alerts threshold' },
  { id: 'logging', label: 'Logging Policies', category: 'Infrastructure', desc: 'Retention days, debug level filters' },
  { id: 'performance', label: 'Performance', category: 'Infrastructure', desc: 'Response caching, compression settings' },
  { id: 'backup', label: 'Backup & Recovery', category: 'Infrastructure', desc: 'Automated backup schedules, recovery snapshot logs' },
  { id: 'academic', label: 'Academic Policies', category: 'Exam Rules', desc: 'Semester structures, shift times' },
  { id: 'flags', label: 'Feature Flags', category: 'Developer Tools', desc: 'Configure experimental toggles' },
  { id: 'playground', label: 'SQL Playground', category: 'Developer Tools', desc: 'Run sandbox queries directly' },
  { id: 'about', label: 'About ExamCell', category: 'General', desc: 'System build indicators' }
];

export default function SettingsPage() {
  const user = useAuthStore(state => state.user);
  const isSuper = user?.role === 'coordinator' && user?.email === 'admin@mitwpu.edu.in';
  
  const { settings, isLoading, isSaving, fetchSettings, updateSettings, resetToDefaults } = useSettingsStore();

  const [activeSection, setActiveSection] = useState('general');
  const [search, setSearch] = useState('');
  const [localState, setLocalState] = useState({});
  const [showApiKey, setShowApiKey] = useState(false);

  // SQL Playground States
  const [sqlQuery, setSqlQuery] = useState('SELECT name, email, role, department FROM users LIMIT 5;');
  const [sqlResults, setSqlResults] = useState(null);
  const [sqlLoading, setSqlLoading] = useState(false);
  const [sqlError, setSqlError] = useState(null);
  const [sqlStats, setSqlStats] = useState(null);

  // Settings history state
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

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

  useEffect(() => {
    if (activeSection === 'logging' && isSuper) {
      loadAuditLogs();
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
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to optimize', { id: loadId });
    }
  };

  // Group sections by category
  const categories = {};
  SECTIONS.forEach(s => {
    if (!categories[s.category]) categories[s.category] = [];
    categories[s.category].push(s);
  });

  // Filter sections based on search query
  const filteredCategories = {};
  let totalFiltered = 0;
  Object.keys(categories).forEach(cat => {
    const matches = categories[cat].filter(s => 
      s.label.toLowerCase().includes(search.toLowerCase()) ||
      s.desc.toLowerCase().includes(search.toLowerCase())
    );
    if (matches.length > 0) {
      filteredCategories[cat] = matches;
      totalFiltered += matches.length;
    }
  });

  if (isLoading && settings.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 16px' }} />
        <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Loading enterprise settings center...</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 52px)', background: 'var(--bg-base)' }}>
      {/* ── Left Navigation Column ─────────────────────────────────────────── */}
      <div style={{ 
        width: 280, 
        borderRight: '1px solid var(--border-faint)', 
        background: 'var(--bg-sidebar)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0
      }}>
        {/* Search Header */}
        <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid var(--border-faint)' }}>
          <div className="saas-search-input-wrapper" style={{ width: '100%' }}>
            <Search size={12} color="var(--text-tertiary)" strokeWidth={1.5} />
            <input 
              placeholder="Search settings..." 
              className="saas-search-input" 
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Categories Tree list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 8px' }}>
          {Object.keys(filteredCategories).map(catName => (
            <div key={catName} style={{ marginBottom: 20 }}>
              <div style={{ 
                fontSize: 10, 
                fontWeight: 900, 
                textTransform: 'uppercase', 
                letterSpacing: '0.08em', 
                color: 'var(--text-tertiary)', 
                padding: '0 12px 6px',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}>
                <Folder size={10} color="var(--text-tertiary)" />
                {catName}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {filteredCategories[catName].map(sec => {
                  const isActive = activeSection === sec.id;
                  
                  // Check RBAC labels
                  const isRestricted = ['database', 'security', 'flags', 'backup', 'playground'].includes(sec.id);
                  
                  return (
                    <button
                      key={sec.id}
                      onClick={() => setActiveSection(sec.id)}
                      className={`saas-sidebar-nav-link${isActive ? ' active' : ''}`}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 6,
                        justifyContent: 'space-between',
                        textAlign: 'left',
                        fontSize: 12.5,
                        fontWeight: isActive ? 600 : 500,
                        border: 'none',
                        background: isActive ? 'var(--bg-elevated)' : 'transparent',
                        cursor: 'pointer',
                        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)'
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {sec.label}
                      </span>
                      {isRestricted && (
                        <Shield size={10} color={isSuper ? 'var(--accent-purple)' : 'var(--accent-amber)'} style={{ opacity: 0.8 }} title="Protected Area" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {totalFiltered === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-tertiary)', fontSize: 12 }}>
              No setting categories match.
            </div>
          )}
        </div>
      </div>

      {/* ── Right Details Form Column ─────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Tab Header bar */}
        <div style={{ 
          padding: '20px 32px', 
          borderBottom: '1px solid var(--border-faint)', 
          background: 'var(--bg-sidebar)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
              {SECTIONS.find(s => s.id === activeSection)?.label}
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
              {SECTIONS.find(s => s.id === activeSection)?.desc}
            </p>
          </div>
          {isDirty && (
            <div className="fade-in-up" style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setLocalState(dbStateMap)}>
                <RotateCcw size={12} style={{ marginRight: 4 }} /> Reset
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : <><Save size={12} style={{ marginRight: 4 }} /> Save Changes</>}
              </button>
            </div>
          )}
        </div>

        {/* Active panel content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
          
          {/* ──────────────────────────────── GENERAL ──────────────────────────────── */}
          {activeSection === 'general' && (
            <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div className="form-group">
                <label className="form-label">Institution Name</label>
                <input 
                  className="input" 
                  value={localState['general.institutionName'] || ''} 
                  onChange={e => handleLocalChange('general.institutionName', e.target.value)}
                />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Short Code Name</label>
                  <input 
                    className="input" 
                    value={localState['general.shortName'] || ''} 
                    onChange={e => handleLocalChange('general.shortName', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Branding Logo Path</label>
                  <input 
                    className="input" 
                    value={localState['general.logo'] || ''} 
                    onChange={e => handleLocalChange('general.logo', e.target.value)}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Postal Address</label>
                <textarea 
                  className="input" 
                  rows={2}
                  value={localState['general.address'] || ''} 
                  onChange={e => handleLocalChange('general.address', e.target.value)}
                  style={{ resize: 'none', height: 'auto', padding: '8px 12px' }}
                />
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Default Date Display Format</label>
                  <select 
                    className="select"
                    value={localState['general.dateFormat'] || ''} 
                    onChange={e => handleLocalChange('general.dateFormat', e.target.value)}
                  >
                    <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 05/07/2026)</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-07-05)</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 07/05/2026)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Default Time Format</label>
                  <select 
                    className="select"
                    value={localState['general.timeFormat'] || ''} 
                    onChange={e => handleLocalChange('general.timeFormat', e.target.value)}
                  >
                    <option value="12h">12-Hour format (AM/PM)</option>
                    <option value="24h">24-Hour format (Military)</option>
                  </select>
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Accent Theme Color</label>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input 
                      type="color" 
                      value={localState['general.accentColor'] || '#a855f7'}
                      onChange={e => handleLocalChange('general.accentColor', e.target.value)}
                      style={{ border: 'none', width: 32, height: 32, padding: 0, background: 'transparent', cursor: 'pointer', borderRadius: 4 }}
                    />
                    <input 
                      className="input" 
                      value={localState['general.accentColor'] || '#a855f7'}
                      onChange={e => handleLocalChange('general.accentColor', e.target.value)}
                      placeholder="#a855f7"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Default System Landing Route</label>
                  <select 
                    className="select"
                    value={localState['general.defaultLandingPage'] || ''} 
                    onChange={e => handleLocalChange('general.defaultLandingPage', e.target.value)}
                  >
                    <option value="/dashboard">Dashboard</option>
                    <option value="/my-duties">My Duties (Faculty)</option>
                    <option value="/search">Global Search</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────── USERS & ROLES ──────────────────────────────── */}
          {activeSection === 'users' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              {/* Permission Matrix */}
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>RBAC Permission Matrix</h3>
                <div className="table-responsive" style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>Capability Resource</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>Super Admin</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>Coordinator</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600 }}>Faculty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { resource: 'Database Optimization & Raw SQL', super: true, coord: false, faculty: false },
                        { resource: 'Update System Security Policies', super: true, coord: false, faculty: false },
                        { resource: 'Configure Exam Cycles & Solve limits', super: true, coord: true, faculty: false },
                        { resource: 'Override / Swapping Student Seating', super: true, coord: true, faculty: false },
                        { resource: 'View System Dashboard & Heatmap', super: true, coord: true, faculty: false },
                        { resource: 'Acknowledge Supervisor Duties', super: true, coord: true, faculty: true },
                        { resource: 'Mark Attendance & Log incidents', super: true, coord: true, faculty: true },
                      ].map((row, idx) => (
                        <tr key={idx} style={{ borderBottom: idx < 6 ? '1px solid var(--border-faint)' : 'none' }}>
                          <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{row.resource}</td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', width: 16, height: 16, borderRadius: '50%', background: row.super ? 'rgba(168,85,247,0.1)' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                              {row.super ? <Check size={10} color="var(--accent-purple)" /> : '—'}
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', width: 16, height: 16, borderRadius: '50%', background: row.coord ? 'rgba(16,185,129,0.1)' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                              {row.coord ? <Check size={10} color="var(--accent-green)" /> : '—'}
                            </div>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', width: 16, height: 16, borderRadius: '50%', background: row.faculty ? 'rgba(59,130,246,0.1)' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                              {row.faculty ? <Check size={10} color="var(--accent-blue)" /> : '—'}
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
            <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 24 }}>
              {!isSuper && (
                <div style={{ padding: 12, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 6, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <AlertTriangle size={16} color="var(--accent-amber)" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: 600 }}>Authorization Warning</span>
                    <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>Only the Super Admin role is permitted to modify security policy settings. Changes will be blocked on submit.</p>
                  </div>
                </div>
              )}
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">JWT Session Expiration (e.g. 1h, 12h)</label>
                  <input 
                    className="input" 
                    value={localState['security.jwtExpiry'] || ''} 
                    onChange={e => handleLocalChange('security.jwtExpiry', e.target.value)}
                    disabled={!isSuper}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Refresh Token Expiration (e.g. 7d, 30d)</label>
                  <input 
                    className="input" 
                    value={localState['security.refreshTokenExpiry'] || ''} 
                    onChange={e => handleLocalChange('security.refreshTokenExpiry', e.target.value)}
                    disabled={!isSuper}
                  />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Login Failed Attempt Limit</label>
                  <input 
                    className="input" 
                    type="number"
                    value={localState['security.loginAttemptLimit'] || ''} 
                    onChange={e => handleLocalChange('security.loginAttemptLimit', e.target.value)}
                    disabled={!isSuper}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Account Lockout Duration (Mins)</label>
                  <input 
                    className="input" 
                    type="number"
                    value={localState['security.accountLockoutDurationMins'] || ''} 
                    onChange={e => handleLocalChange('security.accountLockoutDurationMins', e.target.value)}
                    disabled={!isSuper}
                  />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">API Rate Limit Window (Mins)</label>
                  <input 
                    className="input" 
                    type="number"
                    value={localState['security.rateLimitWindowMins'] || ''} 
                    onChange={e => handleLocalChange('security.rateLimitWindowMins', e.target.value)}
                    disabled={!isSuper}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Max Requests per Window</label>
                  <input 
                    className="input" 
                    type="number"
                    value={localState['security.rateLimitMaxRequests'] || ''} 
                    onChange={e => handleLocalChange('security.rateLimitMaxRequests', e.target.value)}
                    disabled={!isSuper}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">CORS Allowed Origins</label>
                <input 
                  className="input" 
                  value={localState['security.allowedOrigins'] || ''} 
                  onChange={e => handleLocalChange('security.allowedOrigins', e.target.value)}
                  disabled={!isSuper}
                />
              </div>
            </div>
          )}

          {/* ──────────────────────────────── DATABASE ──────────────────────────────── */}
          {activeSection === 'database' && (
            <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Connection Status indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
                <Database size={24} color="var(--accent-purple)" />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>PostgreSQL Database Connected</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Pool Limit: {localState['database.connectionPoolMax'] || 20} connections · Idle timeout: {localState['database.idleTimeoutMillis'] || 30000} ms</div>
                </div>
              </div>

              {/* Maintenance Tools */}
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>System Maintenance Tools</h3>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button 
                    onClick={runDatabaseOptimize}
                    disabled={!isSuper}
                    className="btn btn-ghost"
                    style={{ border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  >
                    <RefreshCw size={13} style={{ marginRight: 6 }} /> Optimize Database (VACUUM & REINDEX)
                  </button>
                </div>
                <span style={{ display: 'block', fontSize: 10, color: 'var(--text-tertiary)', marginTop: 8 }}>Restructures index storage trees and reclaims deleted cell spaces. Runs asynchronously in the background.</span>
              </div>
            </div>
          )}

          {/* ──────────────────────────────── SOLVER CONFIGURATIONS ──────────────────────────────── */}
          {activeSection === 'solver' && (
            <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Maximum Solve Time Limit (Seconds)</label>
                  <input 
                    className="input" 
                    type="number"
                    value={localState['scheduling.solverMaxSolveTimeSecs'] || ''} 
                    onChange={e => handleLocalChange('scheduling.solverMaxSolveTimeSecs', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Parallel Search Worker Threads</label>
                  <input 
                    className="input" 
                    type="number"
                    value={localState['scheduling.solverWorkerThreads'] || ''} 
                    onChange={e => handleLocalChange('scheduling.solverWorkerThreads', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Solver Random Seed</label>
                  <input 
                    className="input" 
                    type="number"
                    value={localState['scheduling.solverRandomSeed'] || ''} 
                    onChange={e => handleLocalChange('scheduling.solverRandomSeed', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Memory Allocation Ceiling Limit (MB)</label>
                  <input 
                    className="input" 
                    type="number"
                    value={localState['scheduling.solverMemoryLimitMb'] || ''} 
                    onChange={e => handleLocalChange('scheduling.solverMemoryLimitMb', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid-2" style={{ marginTop: 12 }}>
                <div className="form-group flex-row" style={{ alignItems: 'center', gap: 10 }}>
                  <input 
                    type="checkbox"
                    id="logSearch"
                    checked={localState['scheduling.solverLogSearch'] === 'true'}
                    onChange={e => handleLocalChange('scheduling.solverLogSearch', e.target.checked ? 'true' : 'false')}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <label htmlFor="logSearch" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>Enable CP-SAT Search Log</label>
                </div>
                <div className="form-group flex-row" style={{ alignItems: 'center', gap: 10 }}>
                  <input 
                    type="checkbox"
                    id="parallelSearch"
                    checked={localState['scheduling.solverParallelSearch'] === 'true'}
                    onChange={e => handleLocalChange('scheduling.solverParallelSearch', e.target.checked ? 'true' : 'false')}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <label htmlFor="parallelSearch" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>Enable Parallel Search</label>
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────── CONSTRAINT MANAGER ──────────────────────────────── */}
          {activeSection === 'constraints' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {[
                { key: 'studentConflict', title: 'Student Conflict', help: 'Ensures no candidate has two concurrent exams.' },
                { key: 'facultyConflict', title: 'Faculty Conflict', help: 'Ensures no supervisor is allocated to multiple classrooms in the same slot.' },
                { key: 'roomConflict', title: 'Room Conflict', help: 'Prevents booking the same classroom for different slot groups.' },
                { key: 'capacity', title: 'Room Capacity', help: 'Limits student allocations to matching bench limits.' },
                { key: 'fixedSlot', title: 'Fixed Slot constraints', help: 'Respects manual preset mappings.' },
                { key: 'holiday', title: 'Holiday constraints', help: 'Blocks scheduling on declared holiday dates.' },
                { key: 'facultyLeave', title: 'Faculty Leave rules', help: 'Bypasses duty assignments on approved leave periods.' },
                { key: 'maxExamsPerDay', title: 'Max Exams Per Day', help: 'Ceiling cap of exams a student writes in 24 hours.' },
                { key: 'morningPreference', title: 'Morning preference', help: 'Prioritizes morning slot scheduling.' },
                { key: 'gapPreference', title: 'Gap Spacing preference', help: 'Prioritizes spreading exams across dates.' },
                { key: 'departmentIsolation', title: 'Department Isolation', help: 'Keeps student branches grouped in home clusters.' }
              ].map((c) => {
                const enabledKey = `scheduling.constraints.${c.key}.enabled`;
                const priorityKey = `scheduling.constraints.${c.key}.priority`;
                const weightKey = `scheduling.constraints.${c.key}.weight`;
                
                const isEnabled = localState[enabledKey] === 'true';

                return (
                  <div key={c.key} style={{ 
                    padding: '16px 20px', 
                    background: 'var(--bg-surface)', 
                    border: '1px solid var(--border)', 
                    borderRadius: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-primary)' }}>{c.title}</span>
                          <HelpCircle size={12} color="var(--text-tertiary)" style={{ cursor: 'pointer' }} title={c.help} />
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginTop: 2 }}>{c.help}</span>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>Enabled</span>
                        <input 
                          type="checkbox"
                          checked={isEnabled}
                          onChange={e => handleLocalChange(enabledKey, e.target.checked ? 'true' : 'false')}
                          style={{ width: 16, height: 16, cursor: 'pointer' }}
                        />
                      </div>
                    </div>

                    {isEnabled && (
                      <div className="grid-2 fade-in-up" style={{ marginTop: 4, paddingTop: 12, borderTop: '1px solid var(--border-faint)' }}>
                        <div className="form-group">
                          <label className="form-label">Constraint Priority</label>
                          <select 
                            className="select"
                            value={localState[priorityKey] || 'medium'}
                            onChange={e => handleLocalChange(priorityKey, e.target.value)}
                            style={{ background: 'var(--bg-input)' }}
                          >
                            <option value="critical">Critical Hard Constraint</option>
                            <option value="high">High priority</option>
                            <option value="medium">Medium priority</option>
                            <option value="low">Low priority</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Solver Penalty Weight</label>
                          <input 
                            className="input"
                            type="number"
                            value={localState[weightKey] || '100'}
                            onChange={e => handleLocalChange(weightKey, e.target.value)}
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
            <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 24 }}>
              {[
                { key: 'weights.studentGap', label: 'Student Exam Spacing', desc: 'Spacing between consecutive candidate exams' },
                { key: 'weights.roomUtilization', label: 'Compact Room Utilization', desc: 'Fills classrooms densely to save operational resources' },
                { key: 'weights.facultyBalance', label: 'Faculty Duty Balance', desc: 'Ensures even load count across department teachers' },
                { key: 'weights.morningPreference', label: 'Morning Shift Preference', desc: 'Prioritizes morning slot scheduling' },
                { key: 'weights.preferredRoom', label: 'Department Home Room Mapping', desc: 'Maps classes close to home blocks' },
                { key: 'weights.examSpread', label: 'Branch Exam Spread', desc: 'Ensures spacing spacing of same branch subjects' }
              ].map(w => (
                <div key={w.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{w.label}</span>
                      <span style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)' }}>{w.desc}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-purple)', background: 'rgba(168,85,247,0.1)', padding: '2px 8px', borderRadius: 4 }}>
                      Weight: {localState[w.key] || '0'}
                    </span>
                  </div>
                  <input 
                    type="range"
                    min="0"
                    max="100"
                    value={localState[w.key] || '0'}
                    onChange={e => handleLocalChange(w.key, e.target.value)}
                    style={{ width: '100%', cursor: 'pointer', accentColor: 'var(--accent-purple)' }}
                  />
                </div>
              ))}

              {/* Score preview indicator */}
              <div style={{ 
                padding: 16, 
                background: 'var(--bg-surface)', 
                border: '1px solid var(--border)', 
                borderRadius: 8,
                marginTop: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>Live Simulated Solver Score Preview</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--accent-green)' }}>
                  {Object.keys(localState)
                    .filter(k => k.startsWith('weights.'))
                    .reduce((sum, key) => sum + (parseInt(localState[key]) || 0) * 12, 12000)} pts
                </span>
              </div>
            </div>
          )}

          {/* ──────────────────────────────── SEATING LAYOUTS ──────────────────────────────── */}
          {activeSection === 'seating' && (
            <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div className="form-group">
                <label className="form-label">Default Seating Density per Bench</label>
                <select 
                  className="select"
                  value={localState['seating.benchCapacity'] || '2'}
                  onChange={e => handleLocalChange('seating.benchCapacity', e.target.value)}
                >
                  <option value="1">1 Student per Bench (High spacing)</option>
                  <option value="2">2 Students per Bench (Standard)</option>
                  <option value="3">3 Students per Bench (High density)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Reserved Buffer Seats count per Room</label>
                <input 
                  className="input"
                  type="number"
                  value={localState['seating.reservedSeatsCount'] || ''}
                  onChange={e => handleLocalChange('seating.reservedSeatsCount', e.target.value)}
                />
              </div>
              <div className="grid-2" style={{ marginTop: 8 }}>
                <div className="form-group flex-row" style={{ alignItems: 'center', gap: 10 }}>
                  <input 
                    type="checkbox"
                    id="alternateSeating"
                    checked={localState['seating.alternateSeating'] === 'true'}
                    onChange={e => handleLocalChange('seating.alternateSeating', e.target.checked ? 'true' : 'false')}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <label htmlFor="alternateSeating" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>Enforce Alternate Seating</label>
                </div>
                <div className="form-group flex-row" style={{ alignItems: 'center', gap: 10 }}>
                  <input 
                    type="checkbox"
                    id="mixedBranchSeating"
                    checked={localState['seating.mixedBranchSeating'] === 'true'}
                    onChange={e => handleLocalChange('seating.mixedBranchSeating', e.target.checked ? 'true' : 'false')}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <label htmlFor="mixedBranchSeating" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>Allow Mixed Branch Seating</label>
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────── FACULTY DUTIES ──────────────────────────────── */}
          {activeSection === 'faculty' && (
            <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Minimum baseline duties per staff</label>
                  <input 
                    className="input"
                    type="number"
                    value={localState['faculty.minDuties'] || ''}
                    onChange={e => handleLocalChange('faculty.minDuties', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Maximum duties ceiling cap per staff</label>
                  <input 
                    className="input"
                    type="number"
                    value={localState['faculty.maxDuties'] || ''}
                    onChange={e => handleLocalChange('faculty.maxDuties', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid-2" style={{ marginTop: 8 }}>
                <div className="form-group flex-row" style={{ alignItems: 'center', gap: 10 }}>
                  <input 
                    type="checkbox"
                    id="deptPref"
                    checked={localState['faculty.departmentPreference'] === 'true'}
                    onChange={e => handleLocalChange('faculty.departmentPreference', e.target.checked ? 'true' : 'false')}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <label htmlFor="deptPref" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>Prioritize Department Preference</label>
                </div>
                <div className="form-group flex-row" style={{ alignItems: 'center', gap: 10 }}>
                  <input 
                    type="checkbox"
                    id="autoBal"
                    checked={localState['faculty.automaticBalancing'] === 'true'}
                    onChange={e => handleLocalChange('faculty.automaticBalancing', e.target.checked ? 'true' : 'false')}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <label htmlFor="autoBal" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>Enable Automatic balancing</label>
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────── CLASSROOMS ──────────────────────────────── */}
          {activeSection === 'classrooms' && (
            <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Classroom selection priorities</label>
                  <select 
                    className="select"
                    value={localState['classrooms.roomPriority'] || ''}
                    onChange={e => handleLocalChange('classrooms.roomPriority', e.target.value)}
                  >
                    <option value="capacity_desc">Capacity: Large Rooms First</option>
                    <option value="capacity_asc">Capacity: Small Rooms First</option>
                    <option value="room_no_asc">Room Name ascending</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Classroom Capacity Safety Buffer (%)</label>
                  <input 
                    className="input"
                    type="number"
                    value={localState['classrooms.capacityBuffer'] || ''}
                    onChange={e => handleLocalChange('classrooms.capacityBuffer', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid-2" style={{ marginTop: 8 }}>
                <div className="form-group flex-row" style={{ alignItems: 'center', gap: 10 }}>
                  <input 
                    type="checkbox"
                    id="smartClass"
                    checked={localState['classrooms.smartClassroomPreference'] === 'true'}
                    onChange={e => handleLocalChange('classrooms.smartClassroomPreference', e.target.checked ? 'true' : 'false')}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <label htmlFor="smartClass" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>Smart Classroom Preference</label>
                </div>
                <div className="form-group flex-row" style={{ alignItems: 'center', gap: 10 }}>
                  <input 
                    type="checkbox"
                    id="labRest"
                    checked={localState['classrooms.labRestrictions'] === 'true'}
                    onChange={e => handleLocalChange('classrooms.labRestrictions', e.target.checked ? 'true' : 'false')}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <label htmlFor="labRest" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>Enforce Laboratory restrictions</label>
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────── NOTIFICATIONS ──────────────────────────────── */}
          {activeSection === 'notifications' && (
            <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {[
                { key: 'notifications.emailEnabled', label: 'Email Notifications Briefs', desc: 'Send automated email briefs to faculty and students.' },
                { key: 'notifications.smsEnabled', label: 'SMS Notifications integration', desc: 'Relay notifications over SMS integrations.' },
                { key: 'notifications.pushEnabled', label: 'Web Browser Push Indicators', desc: 'Trigger web browser push indicator events.' },
                { key: 'notifications.socketNotificationsEnabled', label: 'Real-Time WebSocket Warnings', desc: 'Push real-time warnings over WebSockets.' },
                { key: 'notifications.emergencyBroadcastEnabled', label: 'Emergency Broadcast Priority', desc: 'Allow broadcast priority notifications.' }
              ].map(n => (
                <div key={n.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{n.label}</span>
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{n.desc}</span>
                  </div>
                  <input 
                    type="checkbox"
                    checked={localState[n.key] === 'true'}
                    onChange={e => handleLocalChange(n.key, e.target.checked ? 'true' : 'false')}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                </div>
              ))}
            </div>
          )}

          {/* ──────────────────────────────── AI SETTINGS ──────────────────────────────── */}
          {activeSection === 'ai' && (
            <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Primary Large Language Model Provider</label>
                  <select 
                    className="select"
                    value={localState['ai.provider'] || ''}
                    onChange={e => handleLocalChange('ai.provider', e.target.value)}
                  >
                    <option value="gemini">Google Gemini LLM</option>
                    <option value="openai">OpenAI (GPT-4o)</option>
                    <option value="anthropic">Anthropic Claude</option>
                    <option value="local">Local Model (Ollama / Llama-3)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Model Identifier tag</label>
                  <input 
                    className="input"
                    value={localState['ai.model'] || ''}
                    onChange={e => handleLocalChange('ai.model', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">API Access Key</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input 
                    className="input"
                    type={showApiKey ? 'text' : 'password'}
                    value={localState['ai.apiKey'] || ''}
                    onChange={e => handleLocalChange('ai.apiKey', e.target.value)}
                    placeholder="Enter access credential token..."
                  />
                  <button 
                    type="button" 
                    className="btn btn-ghost"
                    style={{ border: '1px solid var(--border)', width: 40, height: 38, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="grid-3">
                <div className="form-group">
                  <label className="form-label">Temperature</label>
                  <input 
                    className="input"
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={localState['ai.temperature'] || ''}
                    onChange={e => handleLocalChange('ai.temperature', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Max Token limits</label>
                  <input 
                    className="input"
                    type="number"
                    value={localState['ai.maxTokens'] || ''}
                    onChange={e => handleLocalChange('ai.maxTokens', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Daily Call limits</label>
                  <input 
                    className="input"
                    type="number"
                    value={localState['ai.dailyUsageLimit'] || ''}
                    onChange={e => handleLocalChange('ai.dailyUsageLimit', e.target.value)}
                  />
                </div>
              </div>

              {/* AI Capabilities Toggles */}
              <div>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Enabled AI Capabilities</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { key: 'ai.enableScheduleExplanation', label: 'Natural Language Schedule Explanations', desc: 'Allows generation of summary reports explaining allocation schedules.' },
                    { key: 'ai.enableConflictExplanation', label: 'Seating conflict explanation & resolution suggestion', desc: 'Exposes suggestion metrics when seating allocations fail.' },
                    { key: 'ai.enableRiskAnalysis', label: 'Schedule Risk and Telemetry Analysis', desc: 'Scans cycles to identify scheduling risks.' }
                  ].map(capability => (
                    <div key={capability.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6 }}>
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{capability.label}</span>
                        <span style={{ display: 'block', fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 2 }}>{capability.desc}</span>
                      </div>
                      <input 
                        type="checkbox"
                        checked={localState[capability.key] === 'true'}
                        onChange={e => handleLocalChange(capability.key, e.target.checked ? 'true' : 'false')}
                        style={{ width: 15, height: 15, cursor: 'pointer' }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────── MONITORING ALERTS ──────────────────────────────── */}
          {activeSection === 'monitoring' && (
            <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">CPU Warning Threshold Limit (%)</label>
                  <input 
                    className="input"
                    type="number"
                    value={localState['monitoring.cpuThreshold'] || ''}
                    onChange={e => handleLocalChange('monitoring.cpuThreshold', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">RAM Warning Threshold Limit (%)</label>
                  <input 
                    className="input"
                    type="number"
                    value={localState['monitoring.ramThreshold'] || ''}
                    onChange={e => handleLocalChange('monitoring.ramThreshold', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Disk Usage Warning threshold (%)</label>
                  <input 
                    className="input"
                    type="number"
                    value={localState['monitoring.diskThreshold'] || ''}
                    onChange={e => handleLocalChange('monitoring.diskThreshold', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Solver Timeout Threshold (Seconds)</label>
                  <input 
                    className="input"
                    type="number"
                    value={localState['monitoring.solverRuntimeThresholdSecs'] || ''}
                    onChange={e => handleLocalChange('monitoring.solverRuntimeThresholdSecs', e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────── LOGGING POLICIES ──────────────────────────────── */}
          {activeSection === 'logging' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Console Logging Depth Filter</label>
                    <select 
                      className="select"
                      value={localState['logging.level'] || ''}
                      onChange={e => handleLocalChange('logging.level', e.target.value)}
                    >
                      <option value="debug">DEBUG (Verbose logs)</option>
                      <option value="info">INFO (Standard alerts)</option>
                      <option value="warn">WARN (Warnings only)</option>
                      <option value="error">ERROR (Failures only)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Audit Log Database Retention (Days)</label>
                    <input 
                      className="input"
                      type="number"
                      value={localState['logging.retentionPeriodDays'] || ''}
                      onChange={e => handleLocalChange('logging.retentionPeriodDays', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Settings Audit Trail Log (Super Admin only) */}
              {isSuper && (
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Settings Modification Audit Trail Logs</h3>
                  {auditLoading ? (
                    <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading audit records...</div>
                  ) : (
                    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                      <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Timestamp</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Setting Key</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Prior Value</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>New Value</th>
                            <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>Modified By</th>
                          </tr>
                        </thead>
                        <tbody>
                          {auditLogs.map((log) => (
                            <tr key={log.id} style={{ borderBottom: '1px solid var(--border-faint)' }}>
                              <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{new Date(log.updated_at).toLocaleString()}</td>
                              <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>{log.setting_key}</td>
                              <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', maxInlineSize: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.old_value || '—'}</td>
                              <td style={{ padding: '8px 12px', color: 'var(--text-primary)', maxInlineSize: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.new_value}</td>
                              <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>{log.updated_by_name || 'System Seed'}</td>
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

          {/* ──────────────────────────────── PERFORMANCE ──────────────────────────────── */}
          {activeSection === 'performance' && (
            <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Static Route Cache TTL (Seconds)</label>
                  <input 
                    className="input"
                    type="number"
                    value={localState['performance.cacheDurationSecs'] || ''}
                    onChange={e => handleLocalChange('performance.cacheDurationSecs', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">WebSocket Heartbeat Ping Interval (Seconds)</label>
                  <input 
                    className="input"
                    type="number"
                    value={localState['performance.socketHeartbeatSecs'] || ''}
                    onChange={e => handleLocalChange('performance.socketHeartbeatSecs', e.target.value)}
                  />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group flex-row" style={{ alignItems: 'center', gap: 10, marginTop: 8 }}>
                  <input 
                    type="checkbox"
                    id="compression"
                    checked={localState['performance.compressionEnabled'] === 'true'}
                    onChange={e => handleLocalChange('performance.compressionEnabled', e.target.checked ? 'true' : 'false')}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <label htmlFor="compression" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>Enable Gzip Response Compression</label>
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────── BACKUP & RECOVERY ──────────────────────────────── */}
          {activeSection === 'backup' && (
            <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div className="form-group">
                <label className="form-label">Cron auto-backup schedule mapping</label>
                <input 
                  className="input"
                  value={localState['backup.schedule'] || ''}
                  onChange={e => handleLocalChange('backup.schedule', e.target.value)}
                />
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>Standard cron syntax. Default `0 0 * * *` triggers database backups daily at midnight.</span>
              </div>
              <div className="form-group">
                <label className="form-label">Backup copy retention limits</label>
                <input 
                  className="input"
                  type="number"
                  value={localState['backup.retentionCount'] || ''}
                  onChange={e => handleLocalChange('backup.retentionCount', e.target.value)}
                />
              </div>
              <div className="grid-2">
                <div className="form-group flex-row" style={{ alignItems: 'center', gap: 10 }}>
                  <input 
                    type="checkbox"
                    id="autoBackup"
                    checked={localState['backup.autoBackupEnabled'] === 'true'}
                    onChange={e => handleLocalChange('backup.autoBackupEnabled', e.target.checked ? 'true' : 'false')}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <label htmlFor="autoBackup" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>Enable Daily Auto-Backups</label>
                </div>
                <div className="form-group flex-row" style={{ alignItems: 'center', gap: 10 }}>
                  <input 
                    type="checkbox"
                    id="backupVerification"
                    checked={localState['backup.verificationEnabled'] === 'true'}
                    onChange={e => handleLocalChange('backup.verificationEnabled', e.target.checked ? 'true' : 'false')}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <label htmlFor="backupVerification" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>Verify Backup Integrity checks</label>
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────── ACADEMIC POLICIES ──────────────────────────────── */}
          {activeSection === 'academic' && (
            <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div className="form-group">
                <label className="form-label">Institute Working Days (Comma-separated)</label>
                <input 
                  className="input"
                  value={localState['academic.workingDays'] || ''}
                  onChange={e => handleLocalChange('academic.workingDays', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Daily Exam Slot shift hours (Comma-separated)</label>
                <input 
                  className="input"
                  value={localState['academic.shiftTimings'] || ''}
                  onChange={e => handleLocalChange('academic.shiftTimings', e.target.value)}
                />
              </div>
              <div className="grid-3">
                <div className="form-group">
                  <label className="form-label">Max daily exams/student</label>
                  <input 
                    className="input"
                    type="number"
                    value={localState['academic.maxExamsPerDay'] || ''}
                    onChange={e => handleLocalChange('academic.maxExamsPerDay', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Min Spacing Gap Days</label>
                  <input 
                    className="input"
                    type="number"
                    value={localState['academic.minGapDays'] || ''}
                    onChange={e => handleLocalChange('academic.minGapDays', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Max Spacing Gap Days</label>
                  <input 
                    className="input"
                    type="number"
                    value={localState['academic.maxGapDays'] || ''}
                    onChange={e => handleLocalChange('academic.maxGapDays', e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ──────────────────────────────── FEATURE FLAGS ──────────────────────────────── */}
          {activeSection === 'flags' && (
            <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {!isSuper && (
                <div style={{ padding: 12, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 6, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <AlertTriangle size={16} color="var(--accent-amber)" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', fontWeight: 600 }}>Authorization Warning</span>
                    <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>Only the Super Admin role is permitted to modify experimental feature flags.</p>
                  </div>
                </div>
              )}
              {[
                { key: 'flags.enableExperimentalSolver', label: 'ML-driven objective weight optimization search', desc: 'Allows AI constraint guidance calculations inside solver.py execution runs.' },
                { key: 'flags.enableConflictHotReload', label: 'Seating Conflict Hot Real-time updates', desc: 'Detects conflicts instantly when cell seat mappings shift.' },
                { key: 'flags.enableAdvancedAnalytics', label: 'Historical Forecasting and Trend analytics', desc: 'Integrates duty trend models in the heatmap visual displays.' },
                { key: 'flags.enableParallelScheduling', label: 'Multithread solver slot generation mapping', desc: 'Runs slots generation mapping across separate system workers.' }
              ].map(f => (
                <div key={f.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{f.label}</span>
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{f.desc}</span>
                  </div>
                  <input 
                    type="checkbox"
                    checked={localState[f.key] === 'true'}
                    onChange={e => handleLocalChange(f.key, e.target.checked ? 'true' : 'false')}
                    disabled={!isSuper}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                </div>
              ))}
            </div>
          )}

          {/* ──────────────────────────────── SQL PLAYGROUND ──────────────────────────────── */}
          {activeSection === 'playground' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {!isSuper ? (
                <div style={{ padding: 24, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: 'var(--text-primary)' }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent-red)' }}>Security Restrict Warning</h3>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>The developer playground SQL terminal is exclusively accessible to the Super Admin (admin@mitwpu.edu.in). Regular coordinator accounts cannot invoke database commands.</p>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>SQL Command query text (PostgreSQL syntax)</span>
                      <button 
                        onClick={executeSql} 
                        disabled={sqlLoading || !sqlQuery.trim()} 
                        className="btn btn-primary btn-sm"
                        style={{ height: 28 }}
                      >
                        {sqlLoading ? 'Executing...' : <><Play size={10} style={{ marginRight: 6 }} /> Run Query</>}
                      </button>
                    </div>
                    
                    <textarea 
                      value={sqlQuery}
                      onChange={e => setSqlQuery(e.target.value)}
                      style={{ 
                        width: '100%', 
                        height: 120, 
                        background: 'rgba(0,0,0,0.4)', 
                        color: '#34d399', 
                        fontFamily: 'var(--font-mono)', 
                        fontSize: 12.5, 
                        padding: 16, 
                        borderRadius: 8, 
                        border: '1px solid var(--border)',
                        resize: 'vertical',
                        outline: 'none'
                      }}
                    />
                  </div>

                  {sqlError && (
                    <div style={{ padding: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: 'var(--accent-red)', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                      Error: {sqlError}
                    </div>
                  )}

                  {sqlStats && (
                    <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-tertiary)' }}>
                      <span>Rows: {sqlStats.rows}</span>
                      <span>Duration: {sqlStats.duration}ms</span>
                    </div>
                  )}

                  {sqlResults && sqlResults.rows && (
                    <div style={{ marginTop: 8 }}>
                      <h4 style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Query Result Set</h4>
                      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', overflowX: 'auto' }}>
                        <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
                              {sqlResults.fields.map(f => (
                                <th key={f} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>{f}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sqlResults.rows.map((row, idx) => (
                              <tr key={idx} style={{ borderBottom: idx < sqlResults.rows.length - 1 ? '1px solid var(--border-faint)' : 'none' }}>
                                {sqlResults.fields.map(f => (
                                  <td key={f} style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontFamily: typeof row[f] === 'object' ? 'var(--font-mono)' : 'inherit' }}>
                                    {typeof row[f] === 'object' ? JSON.stringify(row[f]) : String(row[f] !== null ? row[f] : 'NULL')}
                                  </td>
                                ))}
                              </tr>
                            ))}
                            {sqlResults.rows.length === 0 && (
                              <tr>
                                <td colSpan={sqlResults.fields.length || 1} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-tertiary)' }}>Empty result set returned.</td>
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
            <div style={{ maxWidth: 500, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ padding: '24px 28px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, textAlign: 'center' }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.05em' }}>ExamCell</span>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Enterprise internal exam seatings scheduler</span>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 24, textAlign: 'left', fontSize: 12.5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-faint)', paddingBottom: 6 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Software Version</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>v2.4.0-stable</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-faint)', paddingBottom: 6 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Database engine</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>PostgreSQL 16.2</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-faint)', paddingBottom: 6 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Scheduling engine</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Google OR-Tools CP-SAT</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-faint)', paddingBottom: 6 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Node Environment</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Node.js v20.12</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>License</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>MIT License</span>
                  </div>
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
            padding: '16px 32px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: '0 -8px 24px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={14} color="var(--accent-amber)" />
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>
                You have unsaved changes in your system configurations.
              </span>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button 
                onClick={handleReset}
                className="btn btn-ghost"
                style={{ border: '1px solid var(--border)', color: 'var(--text-primary)', height: 36 }}
              >
                Reset to default values
              </button>
              <button 
                onClick={handleSave} 
                disabled={isSaving} 
                className="btn btn-primary"
                style={{ height: 36 }}
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
