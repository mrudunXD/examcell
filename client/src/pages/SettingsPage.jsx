import { useState, useEffect } from 'react';
import {
  Settings, Users, Database, Shield, Bell, Cpu, Info,
  Save, RotateCcw, AlertTriangle, Check, X, Eye, EyeOff,
  Play, Download, Upload, Trash2, RefreshCw, Search,
  Zap, BookOpen
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore, useSettingsStore } from '../store/index.js';
import api from '../lib/api.js';

/* ─── Design tokens ─────────────────────────────────────────────────────── */
const card = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: '22px 26px',
  boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
};
const sRow = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '14px 18px',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-faint)',
  borderRadius: 10,
};
const sGap = { display: 'flex', flexDirection: 'column', gap: 8 };
const g2   = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 };
const TXT  = { fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)' };
const HNT  = { fontSize: 11.5, color: 'var(--text-tertiary)', marginTop: 2, lineHeight: 1.4 };
const GH   = {
  fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em',
  color: 'var(--accent-purple)', opacity: 0.7, marginBottom: 14,
  paddingBottom: 8, borderBottom: '1px solid var(--border-faint)',
};

/* ─── Primitive UI components ────────────────────────────────────────────── */
function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      style={{
        flexShrink: 0, width: 48, height: 26, borderRadius: 26,
        background: checked
          ? 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)'
          : 'rgba(255,255,255,0.06)',
        border: `1px solid ${checked ? 'rgba(168,85,247,0.5)' : 'rgba(255,255,255,0.1)'}`,
        position: 'relative', cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.25s ease', padding: 0, outline: 'none',
        boxShadow: checked ? '0 0 16px rgba(168,85,247,0.35), inset 0 1px 0 rgba(255,255,255,0.1)' : 'inset 0 1px 0 rgba(255,255,255,0.04)',
        opacity: disabled ? 0.35 : 1,
      }}
    >
      <span style={{
        position: 'absolute', width: 18, height: 18, borderRadius: '50%',
        background: checked ? '#fff' : 'rgba(255,255,255,0.7)',
        top: 3, left: checked ? 27 : 3,
        transition: 'left 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
      }} />
    </button>
  );
}

function ToggleRow({ label, hint, checked, onChange, disabled }) {
  return (
    <div style={{
      ...sRow,
      transition: 'border-color 0.15s ease, background 0.15s ease',
      ...(checked ? { borderColor: 'rgba(168,85,247,0.18)', background: 'rgba(168,85,247,0.04)' } : {}),
    }}>
      <div style={{ paddingRight: 14, flex: 1 }}>
        <div style={TXT}>{label}</div>
        {hint && <div style={HNT}>{hint}</div>}
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {label && (
        <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.02em' }}>
          {label}
        </label>
      )}
      {children}
      {hint && <span style={HNT}>{hint}</span>}
    </div>
  );
}

function Inp({ value, onChange, type = 'text', placeholder, style: sx }) {
  return (
    <input
      type={type}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="input"
      style={{ background: 'rgba(9,9,20,0.55)', borderRadius: 8, fontSize: 13, ...sx }}
    />
  );
}

function Sel({ value, onChange, options }) {
  return (
    <select
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      className="select"
      style={{ background: 'rgba(9,9,20,0.55)', borderRadius: 8, fontSize: 13 }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function Slider({ value, onChange, min = 0, max = 100 }) {
  const v = value ?? 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <input
        type="range" min={min} max={max} value={v}
        onChange={e => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: 'var(--accent-purple)', cursor: 'pointer', height: 4 }}
      />
      <span style={{
        fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 700,
        color: 'var(--accent-purple)', background: 'rgba(168,85,247,0.12)',
        padding: '3px 10px', borderRadius: 6, minWidth: 40, textAlign: 'center',
      }}>{v}</span>
    </div>
  );
}

function SecTitle({ icon: Icon, title, sub }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {Icon && (
          <div style={{
            width: 32, height: 32, borderRadius: 9, flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(124,58,237,0.08))',
            border: '1px solid rgba(168,85,247,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon size={15} color="#c084fc" />
          </div>
        )}
        <div>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0, lineHeight: 1.2 }}>
            {title}
          </h2>
          {sub && <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '2px 0 0' }}>{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function Pill({ text, color = 'purple' }) {
  const map = {
    purple: ['rgba(168,85,247,0.15)', '#c084fc', 'rgba(168,85,247,0.3)'],
    green:  ['rgba(16,185,129,0.12)',  '#34d399', 'rgba(16,185,129,0.25)'],
    blue:   ['rgba(59,130,246,0.12)',   '#60a5fa', 'rgba(59,130,246,0.25)'],
    amber:  ['rgba(245,158,11,0.12)',   '#fbbf24', 'rgba(245,158,11,0.25)'],
    red:    ['rgba(239,68,68,0.12)',    '#f87171', 'rgba(239,68,68,0.25)'],
  };
  const [bg, fg, border] = map[color] || map.purple;
  return (
    <span style={{
      fontSize: 9.5, fontWeight: 800, letterSpacing: '0.07em',
      textTransform: 'uppercase', padding: '3px 8px',
      borderRadius: 6, background: bg, color: fg,
      border: `1px solid ${border}`,
    }}>{text}</span>
  );
}

/* ─── Tab definitions ────────────────────────────────────────────────────── */
const TABS = [
  { id: 'general',       icon: Settings,  label: 'General' },
  { id: 'scheduling',    icon: Cpu,       label: 'Scheduling' },
  { id: 'users',         icon: Users,     label: 'Users & Roles' },
  { id: 'data',          icon: Database,  label: 'Data & Backups' },
  { id: 'notifications', icon: Bell,      label: 'Notifications' },
  { id: 'security',      icon: Shield,    label: 'Security' },
  { id: 'ai',            icon: Zap,       label: 'AI Resolver' },
  { id: 'about',         icon: Info,      label: 'About' },
];

/* ══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════════════ */
export default function SettingsPage() {
  const user = useAuthStore(s => s.user);
  const isSuper = user?.role === 'coordinator' && user?.email === 'admin@mitwpu.edu.in';
  const { settings, isLoading, isSaving, fetchSettings, updateSettings, resetToDefaults } = useSettingsStore();

  const [tab, setTab]     = useState('general');
  const [local, setLocal] = useState({});

  const [users, setUsers]               = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch]     = useState('');
  const [editUser, setEditUser]         = useState(null);
  const [userForm, setUserForm]         = useState({});
  const [showPwd, setShowPwd]           = useState(false);

  const [backups, setBackups]               = useState([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [dbStats, setDbStats]               = useState(null);

  const [sqlQuery, setSqlQuery]     = useState('SELECT name, email, role FROM users LIMIT 10;');
  const [sqlResult, setSqlResult]   = useState(null);
  const [sqlRunning, setSqlRunning] = useState(false);
  const [sqlError, setSqlError]     = useState(null);

  useEffect(() => { fetchSettings(); }, []);

  useEffect(() => {
    if (!settings?.length) return;
    const m = {};
    settings.forEach(s => { m[s.key] = s.value; });
    setLocal(m);
  }, [settings]);

  useEffect(() => {
    let mounted = true;
    if (tab === 'users') loadUsers();
    if (tab === 'data') { loadBackups(); loadDbStats(); }
    return () => { mounted = false; };
  }, [tab]);

  /* ── Helpers ─────────────────────────────────────────────────────────── */
  const isMounted = () => true; // Use mounted flag pattern below
  const setK  = (k, v) => setLocal(p => ({ ...p, [k]: String(v) }));
  const bool  = k => local[k] === 'true';
  const numV  = k => parseInt(local[k] || '0', 10);
  const strV  = k => local[k] || '';

  const dbMap   = {};
  settings.forEach(s => { dbMap[s.key] = s.value; });
  const isDirty = JSON.stringify(local) !== JSON.stringify(dbMap);

  const handleSave = async () => {
    const res = await updateSettings(local);
    res.success ? toast.success('Settings saved') : toast.error(res.error || 'Save failed');
  };

  const handleReset = async () => {
    if (!confirm('Reset ALL settings to factory defaults? This cannot be undone.')) return;
    const res = await resetToDefaults();
    res.success ? toast.success('Reset to defaults') : toast.error('Reset failed');
  };

  /* ── Users ───────────────────────────────────────────────────────────── */
  const loadUsers = async () => {
    setUsersLoading(true);
    try { const { data } = await api.get('/faculty'); setUsers(data); }
    catch { toast.error('Failed to load users'); }
    finally { setUsersLoading(false); }
  };

  const startEdit = u => {
    setEditUser(u);
    setUserForm({ name: u.name, email: u.email, department: u.department || '', role: u.role, password: '' });
    setShowPwd(false);
  };

  const saveUser = async e => {
    e.preventDefault();
    const tid = toast.loading('Updating...');
    try {
      await api.put(`/faculty/${editUser.id}`, userForm);
      toast.success('Account updated', { id: tid });
      setEditUser(null);
      loadUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed', { id: tid });
    }
  };

  /* ── Backups / DB ────────────────────────────────────────────────────── */
  const loadBackups = async () => {
    setBackupsLoading(true);
    try { const { data } = await api.get('/backups'); setBackups(data); }
    catch { toast.error('Failed to load backups'); }
    finally { setBackupsLoading(false); }
  };

  const loadDbStats = async () => {
    try { const { data } = await api.get('/settings/telemetry'); setDbStats(data); }
    catch (err) { console.error('Failed to load DB stats:', err); }
  };

  const createBackup = async () => {
    const t = toast.loading('Creating backup...');
    try { await api.post('/backups'); toast.success('Backup created', { id: t }); loadBackups(); }
    catch { toast.error('Failed', { id: t }); }
  };

  const restoreBackup = async f => {
    if (!confirm(`Restore from "${f}"? Current data will be replaced.`)) return;
    const t = toast.loading('Restoring...');
    try {
      await api.post('/backups/restore', { filename: f });
      toast.success('Restored! Reloading...', { id: t });
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) { toast.error(err.response?.data?.error || 'Failed', { id: t }); }
  };

  const deleteBackup = async f => {
    if (!confirm(`Delete backup "${f}"?`)) return;
    const t = toast.loading('Deleting...');
    try { await api.delete(`/backups/${f}`); toast.success('Deleted', { id: t }); loadBackups(); }
    catch { toast.error('Failed', { id: t }); }
  };

  const optimizeDb = async () => {
    if (!confirm('Run VACUUM & REINDEX on the database?')) return;
    const t = toast.loading('Optimizing...');
    try { const { data } = await api.post('/settings/optimize'); toast.success(data.message || 'Done', { id: t }); loadDbStats(); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed', { id: t }); }
  };

  /* ── SQL ─────────────────────────────────────────────────────────────── */
  const runSql = async () => {
    setSqlRunning(true); setSqlError(null); setSqlResult(null);
    try { const { data } = await api.post('/settings/playground', { query: sqlQuery }); setSqlResult(data); toast.success('Query executed'); }
    catch (err) { setSqlError(err.response?.data?.error || 'Query failed'); }
    finally { setSqlRunning(false); }
  };

  /* ── Loading state ───────────────────────────────────────────────────── */
  if (isLoading && !settings.length) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400, flexDirection: 'column', gap: 16 }}>
      <div className="spinner" />
      <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Loading settings...</span>
    </div>
  );

  /* ══════════════════════════════════════════════════════════════════════
     RENDER — fits inside Layout's .main-inner scroll container
     No sticky headers. No extra outer padding. No minHeight tricks.
  ══════════════════════════════════════════════════════════════════════ */
  return (
    <div style={{ fontFamily: 'var(--font-sans)' }}>

      {/* ── Page title + save button ────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>
            System Settings
          </h1>
          <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 4, marginBottom: 0 }}>
            Configure every aspect of the ExamCell platform
          </p>
        </div>
        {isDirty && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} className="fade-in-up">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setLocal(dbMap)}
              style={{ borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <RotateCcw size={12} style={{ marginRight: 5 }} />Discard
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSave}
              disabled={isSaving}
              style={{ borderRadius: 8, padding: '0 18px', boxShadow: '0 4px 14px rgba(168,85,247,0.3)' }}
            >
              <Save size={12} style={{ marginRight: 5 }} />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>

      {/* ── Horizontal tab bar ──────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 4, flexWrap: 'wrap',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        marginBottom: 28,
      }}>
        {TABS.map(t => {
          const active = tab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '9px 16px',
                borderRadius: '8px 8px 0 0',
                border: 'none', cursor: 'pointer',
                background: active ? 'rgba(168,85,247,0.1)' : 'transparent',
                borderBottom: `2px solid ${active ? 'var(--accent-purple)' : 'transparent'}`,
                marginBottom: -1,
                color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: 13, fontWeight: active ? 700 : 500,
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={14} strokeWidth={active ? 2.5 : 1.8} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab panels ──────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 820 }}>

        {/* ══ GENERAL ══ */}
        {tab === 'general' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SecTitle icon={Settings} title="General Configuration"
              sub="Institution identity, display preferences and appearance" />

            <div style={card}>
              <div style={GH}>Institution Identity</div>
              <div style={g2}>
                <Field label="Institution Name">
                  <Inp value={strV('general.institutionName')} onChange={v => setK('general.institutionName', v)} placeholder="MIT World Peace University" />
                </Field>
                <Field label="Short Name">
                  <Inp value={strV('general.shortName')} onChange={v => setK('general.shortName', v)} placeholder="MIT WPU" />
                </Field>
                <Field label="Address">
                  <Inp value={strV('general.address')} onChange={v => setK('general.address', v)} placeholder="Pune, Maharashtra" />
                </Field>
                 <Field label="Logo Path / URL">
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', width: '100%' }}>
                    {strV('general.logo') && (
                      <img src={strV('general.logo')} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }} alt="Logo Preview" />
                    )}
                    {strV('general.logo')?.startsWith('data:image/') ? (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', height: 36, background: 'var(--bg-elevated)', border: '1.5px solid var(--border)', borderRadius: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--np-n500)', fontFamily: 'var(--font-mono)' }}>[Uploaded Image (Base64)]</span>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setK('general.logo', '')} style={{ padding: '2px 8px', fontSize: 10, margin: 0, height: 24, minWidth: 0 }}>Clear</button>
                      </div>
                    ) : (
                      <Inp value={strV('general.logo')} onChange={v => setK('general.logo', v)} placeholder="/logo.png" style={{ flex: 1 }} />
                    )}
                    <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', height: 36, display: 'flex', alignItems: 'center', gap: 6, margin: 0, padding: '0 12px', fontSize: 12 }}>
                      <Upload size={13} />
                      Upload Logo
                      <input 
                        type="file" 
                        accept="image/*" 
                        style={{ display: 'none' }} 
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              setK('general.logo', event.target.result);
                              toast.success('Logo uploaded. Save settings to apply.');
                            };
                            reader.readAsDataURL(file);
                          }
                        }} 
                      />
                    </label>
                  </div>
                </Field>
                <Field label="Sidebar Header Banner">
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', width: '100%' }}>
                    {strV('general.sidebarBanner') && (
                      <img src={strV('general.sidebarBanner')} style={{ height: 36, width: 90, borderRadius: 6, objectFit: 'contain', background: 'var(--bg-base)', border: '1px solid var(--border)' }} alt="Banner Preview" />
                    )}
                    {strV('general.sidebarBanner')?.startsWith('data:image/') ? (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', height: 36, background: 'var(--bg-elevated)', border: '1.5px solid var(--border)', borderRadius: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--np-n500)', fontFamily: 'var(--font-mono)' }}>[Uploaded Banner (Base64)]</span>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setK('general.sidebarBanner', '')} style={{ padding: '2px 8px', fontSize: 10, margin: 0, height: 24, minWidth: 0 }}>Clear</button>
                      </div>
                    ) : (
                      <Inp value={strV('general.sidebarBanner')} onChange={v => setK('general.sidebarBanner', v)} placeholder="URL or Base64 Image string" style={{ flex: 1 }} />
                    )}
                    <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', height: 36, display: 'flex', alignItems: 'center', gap: 6, margin: 0, padding: '0 12px', fontSize: 12 }}>
                      <Upload size={13} />
                      Upload Banner
                      <input 
                        type="file" 
                        accept="image/*" 
                        style={{ display: 'none' }} 
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              setK('general.sidebarBanner', event.target.result);
                              toast.success('Sidebar banner loaded. Save settings to apply.');
                            };
                            reader.readAsDataURL(file);
                          }
                        }} 
                      />
                    </label>
                  </div>
                </Field>
              </div>
            </div>

            <div style={card}>
              <div style={GH}>Application Background</div>
              <div style={g2}>
                <Field label="Background Image">
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', width: '100%' }}>
                    {strV('general.backgroundImage') && (
                      <img src={strV('general.backgroundImage')} style={{ height: 36, width: 64, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--border)' }} alt="Background Preview" />
                    )}
                    {strV('general.backgroundImage')?.startsWith('data:image/') ? (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', height: 36, background: 'var(--bg-elevated)', border: '1.5px solid var(--border)', borderRadius: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--np-n500)', fontFamily: 'var(--font-mono)' }}>[Uploaded Background (Base64)]</span>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setK('general.backgroundImage', '')} style={{ padding: '2px 8px', fontSize: 10, margin: 0, height: 24, minWidth: 0 }}>Clear</button>
                      </div>
                    ) : (
                      <Inp value={strV('general.backgroundImage')} onChange={v => setK('general.backgroundImage', v)} placeholder="URL or Base64 Image string" style={{ flex: 1 }} />
                    )}
                    <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', height: 36, display: 'flex', alignItems: 'center', gap: 6, margin: 0, padding: '0 12px', fontSize: 12 }}>
                      <Upload size={13} />
                      Upload Image
                      <input 
                        type="file" 
                        accept="image/*" 
                        style={{ display: 'none' }} 
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              setK('general.backgroundImage', event.target.result);
                              toast.success('Background image loaded. Save settings to apply.');
                            };
                            reader.readAsDataURL(file);
                          }
                        }} 
                      />
                    </label>
                  </div>
                </Field>
                <Field label={`Overlay Opacity (${strV('general.backgroundOpacity') || '75'}%)`}>
                  <Slider 
                    value={parseInt(strV('general.backgroundOpacity') || '75')} 
                    onChange={v => setK('general.backgroundOpacity', String(v))} 
                    min={0} 
                    max={100} 
                    step={5}
                  />
                </Field>
              </div>
            </div>

            <div style={card}>
              <div style={GH}>Display Preferences</div>
              <div style={g2}>
                <Field label="Date Format">
                  <Sel
                    value={strV('general.dateFormat') || 'DD/MM/YYYY'}
                    onChange={v => setK('general.dateFormat', v)}
                    options={[
                      { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (05/07/2026)' },
                      { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2026-07-05)' },
                      { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (07/05/2026)' },
                    ]}
                  />
                </Field>
                <Field label="Time Format">
                  <Sel
                    value={strV('general.timeFormat') || '12h'}
                    onChange={v => setK('general.timeFormat', v)}
                    options={[
                      { value: '12h', label: '12-hour (AM/PM)' },
                      { value: '24h', label: '24-hour' },
                    ]}
                  />
                </Field>
                <Field label="Default Landing Page">
                  <Sel
                    value={strV('general.defaultLandingPage') || '/dashboard'}
                    onChange={v => setK('general.defaultLandingPage', v)}
                    options={[
                      { value: '/dashboard',   label: 'Dashboard' },
                      { value: '/exam-cycles', label: 'Exam Cycles' },
                      { value: '/my-duties',   label: 'My Duties (Faculty)' },
                      { value: '/search',      label: 'Global Search' },
                    ]}
                  />
                </Field>
                <Field label="Accent Colour">
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="color"
                      value={strV('general.accentColor') || '#a855f7'}
                      onChange={e => setK('general.accentColor', e.target.value)}
                      style={{ width: 36, height: 36, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 2, background: 'transparent', cursor: 'pointer' }}
                    />
                    <Inp value={strV('general.accentColor') || '#a855f7'} onChange={v => setK('general.accentColor', v)} placeholder="#a855f7" />
                  </div>
                </Field>
              </div>
            </div>

            <div style={card}>
              <div style={GH}>Seating Layout Rules</div>
              <div style={{ ...g2, marginBottom: 16 }}>
                <Field label="Bench Capacity">
                  <Sel
                    value={strV('seating.benchCapacity') || '2'}
                    onChange={v => setK('seating.benchCapacity', v)}
                    options={[
                      { value: '1', label: '1 per bench (strict)' },
                      { value: '2', label: '2 per bench (standard)' },
                      { value: '3', label: '3 per bench (dense)' },
                    ]}
                  />
                </Field>
                <Field label="Reserved Seats per Room">
                  <Inp type="number" value={strV('seating.reservedSeatsCount')} onChange={v => setK('seating.reservedSeatsCount', v)} placeholder="2" />
                </Field>
              </div>
              <div style={sGap}>
                <ToggleRow label="Alternate Branch Seating" hint="Alternates branch rows to prevent candidate collusion." checked={bool('seating.alternateSeating')} onChange={v => setK('seating.alternateSeating', v)} />
                <ToggleRow label="Allow Mixed Branch Rooms" hint="Permits multiple branch subjects in a single room." checked={bool('seating.mixedBranchSeating')} onChange={v => setK('seating.mixedBranchSeating', v)} />
                <ToggleRow label="Accessible Ground-Floor Priority" hint="Reserves ground floor rooms for candidates with special needs." checked={bool('seating.accessibleSeating')} onChange={v => setK('seating.accessibleSeating', v)} />
              </div>
            </div>

            <div style={card}>
              <div style={GH}>Classroom Preferences</div>
              <div style={{ ...g2, marginBottom: 16 }}>
                <Field label="Room Selection Priority">
                  <Sel
                    value={strV('classrooms.roomPriority') || 'capacity_desc'}
                    onChange={v => setK('classrooms.roomPriority', v)}
                    options={[
                      { value: 'capacity_desc', label: 'Large rooms first' },
                      { value: 'capacity_asc',  label: 'Small rooms first' },
                      { value: 'room_no_asc',   label: 'Room number order' },
                    ]}
                  />
                </Field>
                <Field label="Capacity Buffer (%)">
                  <Inp type="number" value={strV('classrooms.capacityBuffer')} onChange={v => setK('classrooms.capacityBuffer', v)} placeholder="10" />
                </Field>
              </div>
              <div style={sGap}>
                <ToggleRow label="Prefer Smart Classrooms" hint="Prioritises technologically enhanced rooms." checked={bool('classrooms.smartClassroomPreference')} onChange={v => setK('classrooms.smartClassroomPreference', v)} />
                <ToggleRow label="Enforce Lab Restrictions" hint="Prevents theory exams being held in laboratory rooms." checked={bool('classrooms.labRestrictions')} onChange={v => setK('classrooms.labRestrictions', v)} />
              </div>
            </div>
          </div>
        )}

        {/* ══ SCHEDULING ══ */}
        {tab === 'scheduling' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SecTitle icon={Cpu} title="Scheduling Engine"
              sub="Solver parameters, constraints and optimisation weights" />

            <div style={card}>
              <div style={GH}>Solver Parameters</div>
              <div style={{ ...g2, marginBottom: 16 }}>
                <Field label="Max Solve Time (seconds)" hint="Longer limits improve quality but delay response.">
                  <Inp type="number" value={strV('scheduling.solverMaxSolveTimeSecs') || '60'} onChange={v => setK('scheduling.solverMaxSolveTimeSecs', v)} />
                </Field>
                <Field label="Parallel Worker Threads">
                  <Inp type="number" value={strV('scheduling.solverWorkerThreads') || '20'} onChange={v => setK('scheduling.solverWorkerThreads', v)} />
                </Field>
                <Field label="Random Seed">
                  <Inp type="number" value={strV('scheduling.solverRandomSeed')} onChange={v => setK('scheduling.solverRandomSeed', v)} placeholder="42" />
                </Field>
                <Field label="Memory Limit (MB)">
                  <Inp type="number" value={strV('scheduling.solverMemoryLimitMb')} onChange={v => setK('scheduling.solverMemoryLimitMb', v)} placeholder="2048" />
                </Field>
              </div>
              <div style={sGap}>
                <ToggleRow label="Enable Search Progress Logging" hint="Prints CP-SAT search telemetry to server logs." checked={bool('scheduling.solverLogSearch')} onChange={v => setK('scheduling.solverLogSearch', v)} />
                <ToggleRow label="Parallel Search Workers" hint="Runs concurrent search loops for faster optimisation." checked={bool('scheduling.solverParallelSearch')} onChange={v => setK('scheduling.solverParallelSearch', v)} />
              </div>
            </div>

            <div style={card}>
              <div style={GH}>Academic Policies</div>
              <div style={g2}>
                <Field label="Working Days" hint="Comma-separated: Monday,Tuesday,...">
                  <Inp value={strV('academic.workingDays')} onChange={v => setK('academic.workingDays', v)} placeholder="Monday,Tuesday,Wednesday,Thursday,Friday" />
                </Field>
                <Field label="Shift Timings" hint="e.g. 09:30,13:30">
                  <Inp value={strV('academic.shiftTimings')} onChange={v => setK('academic.shiftTimings', v)} placeholder="09:30,13:30" />
                </Field>
                <Field label="Max Exams Per Student Per Day">
                  <Inp type="number" value={strV('academic.maxExamsPerDay')} onChange={v => setK('academic.maxExamsPerDay', v)} placeholder="1" />
                </Field>
                <Field label="Minimum Gap Days Between Exams">
                  <Inp type="number" value={strV('academic.minGapDays')} onChange={v => setK('academic.minGapDays', v)} placeholder="1" />
                </Field>
              </div>
            </div>

            <div style={card}>
              <div style={GH}>Constraint Toggles</div>
              <div style={sGap}>
                {[
                  { k: 'studentConflict',      l: 'Student Conflict Prevention',  h: 'No candidate sits two simultaneous exams.' },
                  { k: 'facultyConflict',      l: 'Faculty Double-Booking Guard', h: 'Prevents supervisor in multiple rooms in same slot.' },
                  { k: 'capacity',             l: 'Room Capacity Enforcement',    h: 'Allocations respect bench counts.' },
                  { k: 'fixedSlot',            l: 'Manual Placement Locks',       h: 'Honours manually preset exam slot assignments.' },
                  { k: 'holiday',              l: 'Holiday Calendar Blocking',    h: 'No scheduling on declared holidays.' },
                  { k: 'facultyLeave',         l: 'Faculty Leave Exclusion',      h: 'Skips faculty on approved leave days.' },
                  { k: 'maxExamsPerDay',       l: 'Daily Exam Cap',               h: 'Caps exams a student writes per day.' },
                  { k: 'gapPreference',        l: 'Candidate Exam Gap Spacing',   h: 'Spreads consecutive exams across days.' },
                  { k: 'departmentIsolation',  l: 'Branch Room Clustering',       h: 'Groups same-branch students in nearby rooms.' },
                ].map(c => (
                  <ToggleRow
                    key={c.k} label={c.l} hint={c.h}
                    checked={bool(`scheduling.constraints.${c.k}.enabled`)}
                    onChange={v => setK(`scheduling.constraints.${c.k}.enabled`, v)}
                  />
                ))}
              </div>
            </div>

            <div style={card}>
              <div style={GH}>Optimisation Weights</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {[
                  { k: 'weights.studentGap',        l: 'Student Exam Spacing',     h: 'Days between consecutive student exams' },
                  { k: 'weights.roomUtilization',   l: 'Room Utilisation Density', h: 'Fill rooms compactly' },
                  { k: 'weights.facultyBalance',    l: 'Faculty Load Balance',     h: 'Even duty distribution' },
                  { k: 'weights.morningPreference', l: 'Morning Shift Preference', h: 'Prefer morning slots' },
                  { k: 'weights.examSpread',        l: 'Branch Exam Spread',       h: 'Spread same-branch exams over days' },
                ].map(w => (
                  <div key={w.k}>
                    <div style={{ marginBottom: 8 }}>
                      <div style={TXT}>{w.l}</div>
                      <div style={HNT}>{w.h}</div>
                    </div>
                    <Slider value={numV(w.k)} onChange={v => setK(w.k, v)} />
                  </div>
                ))}
              </div>
            </div>

            <div style={card}>
              <div style={{ ...GH, display: 'flex', alignItems: 'center', gap: 8 }}>
                Feature Flags
                {!isSuper && <Pill text="Super Admin Only" color="amber" />}
              </div>
              <div style={sGap}>
                {[
                  { k: 'flags.enableExperimentalSolver',  l: 'ML-Driven Objective Weights',  h: 'AI-guided constraint weight calculations.' },
                  { k: 'flags.enableConflictHotReload',   l: 'Real-Time Conflict Detection', h: 'Instant conflict check on seating changes.' },
                  { k: 'flags.enableAdvancedAnalytics',   l: 'Historical Trend Forecasting', h: 'Trend models in heatmap displays.' },
                  { k: 'flags.enableParallelScheduling',  l: 'Multi-Thread Slot Generation', h: 'Slot mapping across separate workers.' },
                ].map(f => (
                  <ToggleRow key={f.k} label={f.l} hint={f.h} checked={bool(f.k)} onChange={v => setK(f.k, v)} disabled={!isSuper} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ USERS & ROLES ══ */}
        {tab === 'users' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SecTitle icon={Users} title="Users & Roles"
              sub="Manage accounts, permissions and role assignments" />

            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={GH}>Active Accounts</div>
                <div className="saas-search-input-wrapper" style={{ width: 210, background: 'rgba(9,9,20,0.6)' }}>
                  <Search size={12} color="var(--text-tertiary)" />
                  <input
                    className="saas-search-input"
                    placeholder="Search..."
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                  />
                </div>
              </div>

              {usersLoading ? (
                <div style={{ textAlign: 'center', padding: 24 }}><div className="spinner" /></div>
              ) : (
                <div style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                        {['Name', 'Email', 'Role', 'Department', ''].map((h, i) => (
                          <th key={i} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {users
                        .filter(u => !userSearch || `${u.name} ${u.email} ${u.department || ''}`.toLowerCase().includes(userSearch.toLowerCase()))
                        .map((u, i, arr) => (
                          <tr key={u.id} style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                            <td style={{ padding: '11px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>{u.name}</td>
                            <td style={{ padding: '11px 14px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>{u.email}</td>
                            <td style={{ padding: '11px 14px' }}><Pill text={u.role} color={u.role === 'coordinator' ? 'purple' : 'blue'} /></td>
                            <td style={{ padding: '11px 14px', color: 'var(--text-tertiary)' }}>{u.department || '—'}</td>
                            <td style={{ padding: '11px 14px', textAlign: 'right' }}>
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => startEdit(u)}
                                style={{ height: 27, padding: '0 10px', borderRadius: 6, fontSize: 11.5, border: '1px solid rgba(255,255,255,0.09)' }}
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {editUser && (
              <div style={{ ...card, border: '1px solid rgba(168,85,247,0.2)' }} className="fade-in-up">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Edit: {editUser.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>{editUser.email}</div>
                  </div>
                  <button onClick={() => setEditUser(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', lineHeight: 1 }}>
                    <X size={16} />
                  </button>
                </div>
                <form onSubmit={saveUser}>
                  <div style={{ ...g2, marginBottom: 16 }}>
                    <Field label="Full Name">
                      <Inp value={userForm.name || ''} onChange={v => setUserForm(p => ({ ...p, name: v }))} />
                    </Field>
                    <Field label="Email">
                      <Inp type="email" value={userForm.email || ''} onChange={v => setUserForm(p => ({ ...p, email: v }))} />
                    </Field>
                    <Field label="Department">
                      <Inp value={userForm.department || ''} onChange={v => setUserForm(p => ({ ...p, department: v }))} />
                    </Field>
                    <Field label="New Password" hint="Leave blank to keep current">
                      <div style={{ position: 'relative' }}>
                        <Inp
                          type={showPwd ? 'text' : 'password'}
                          value={userForm.password || ''}
                          onChange={v => setUserForm(p => ({ ...p, password: v }))}
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPwd(p => !p)}
                          style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', lineHeight: 1 }}
                        >
                          {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </Field>
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-ghost" onClick={() => setEditUser(null)} style={{ borderRadius: 8 }}>Cancel</button>
                    <button type="submit" className="btn btn-primary" style={{ borderRadius: 8 }}>
                      <Check size={13} style={{ marginRight: 5 }} />Update Account
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div style={card}>
              <div style={GH}>Role Permission Matrix</div>
              <div style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      <th style={{ padding: '11px 16px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Capability</th>
                      {['Super Admin', 'Coordinator', 'Faculty'].map(r => (
                        <th key={r} style={{ padding: '11px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontWeight: 600 }}>{r}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['Database Optimization & SQL',       true,  false, false],
                      ['System Security Policies',          true,  false, false],
                      ['Configure Exam Cycles & Solver',    true,  true,  false],
                      ['Override Seating Plans',            true,  true,  false],
                      ['View Analytics & Heatmaps',         true,  true,  false],
                      ['Acknowledge Supervisor Duties',      true,  true,  true],
                      ['Mark Attendance & Incident Logs',   true,  true,  true],
                    ].map(([cap, sa, co, fa], i, arr) => (
                      <tr key={i} style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                        <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{cap}</td>
                        {[sa, co, fa].map((has, j) => (
                          <td key={j} style={{ padding: '12px 16px', textAlign: 'center' }}>
                            {has
                              ? <Check size={14} color="#a855f7" />
                              : <span style={{ color: 'rgba(255,255,255,0.12)' }}>—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══ DATA & BACKUPS ══ */}
        {tab === 'data' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SecTitle icon={Database} title="Data & Backups"
              sub="Database maintenance, snapshot management and SQL console" />

            {dbStats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { label: 'DB Size',       value: dbStats.dbSizeMb ? `${dbStats.dbSizeMb} MB` : '—', color: 'purple' },
                  { label: 'Tables',        value: dbStats.tableCount || '—',                           color: 'blue' },
                  { label: 'Total Records', value: dbStats.totalRows?.toLocaleString() || '—',          color: 'green' },
                ].map(s => (
                  <div key={s.label} style={{ ...card, padding: '14px 18px', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: `var(--accent-${s.color})` }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={card}>
              <div style={GH}>Database Maintenance</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-ghost" onClick={loadDbStats} style={{ borderRadius: 8, border: '1px solid rgba(255,255,255,0.09)', fontSize: 13 }}>
                  <RefreshCw size={13} style={{ marginRight: 7 }} />Refresh Stats
                </button>
                {isSuper && (
                  <button className="btn btn-ghost" onClick={optimizeDb} style={{ borderRadius: 8, border: '1px solid rgba(245,158,11,0.2)', color: 'var(--accent-amber)', fontSize: 13 }}>
                    <Zap size={13} style={{ marginRight: 7 }} />VACUUM & REINDEX
                  </button>
                )}
              </div>
            </div>

            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={GH}>Backup Snapshots</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost btn-sm" onClick={loadBackups} style={{ borderRadius: 8, border: '1px solid rgba(255,255,255,0.09)' }}>
                    <RefreshCw size={12} style={{ marginRight: 5 }} />Refresh
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={createBackup} style={{ borderRadius: 8 }}>
                    <Download size={12} style={{ marginRight: 5 }} />New Backup
                  </button>
                </div>
              </div>

              {backupsLoading ? (
                <div style={{ textAlign: 'center', padding: 24 }}><div className="spinner" /></div>
              ) : backups.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px', color: 'var(--text-tertiary)', fontSize: 13 }}>
                  No backups yet. Create one above.
                </div>
              ) : (
                <div style={sGap}>
                  {backups.map(b => (
                    <div key={b.filename} style={sRow}>
                      <div>
                        <div style={TXT}>{b.filename}</div>
                        <div style={HNT}>
                          {b.size ? `${(b.size / 1024).toFixed(1)} KB` : ''}
                          {b.createdAt ? ` · ${new Date(b.createdAt).toLocaleString()}` : ''}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 7 }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => restoreBackup(b.filename)}
                          style={{ height: 27, padding: '0 10px', borderRadius: 6, fontSize: 11, color: 'var(--accent-green)', border: '1px solid rgba(16,185,129,0.2)' }}
                        >
                          <Upload size={11} style={{ marginRight: 4 }} />Restore
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => deleteBackup(b.filename)}
                          style={{ height: 27, padding: '0 9px', borderRadius: 6, color: 'var(--accent-red)', border: '1px solid rgba(239,68,68,0.2)' }}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {isSuper && (
              <div style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ ...GH, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    SQL Console <Pill text="Super Admin" color="red" />
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={runSql} disabled={sqlRunning || !sqlQuery.trim()} style={{ borderRadius: 8 }}>
                    {sqlRunning ? 'Running...' : <><Play size={12} style={{ marginRight: 5 }} />Execute</>}
                  </button>
                </div>
                <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)', background: '#080814' }}>
                  <div style={{ padding: '8px 14px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 6, alignItems: 'center' }}>
                    {['#ff5f56', '#ffbd2e', '#27c93f'].map(c => <div key={c} style={{ width: 9, height: 9, borderRadius: '50%', background: c }} />)}
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 6, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>SQL Terminal</span>
                  </div>
                  <textarea
                    value={sqlQuery}
                    onChange={e => setSqlQuery(e.target.value)}
                    style={{ width: '100%', minHeight: 110, background: 'transparent', color: '#34d399', fontFamily: 'var(--font-mono)', fontSize: 12.5, padding: 14, border: 'none', resize: 'vertical', outline: 'none', lineHeight: 1.7, boxSizing: 'border-box' }}
                  />
                </div>
                {sqlError && (
                  <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: 8, color: '#f87171', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                    {sqlError}
                  </div>
                )}
                {sqlResult?.rows?.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ ...GH, marginBottom: 8 }}>Results — {sqlResult.rowCount} rows · {sqlResult.duration}ms</div>
                    <div style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, overflow: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                            {sqlResult.fields.map(f => <th key={f} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>{f}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {sqlResult.rows.map((row, i) => (
                            <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                              {sqlResult.fields.map(f => <td key={f} style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{String(row[f] ?? 'NULL')}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══ NOTIFICATIONS ══ */}
        {tab === 'notifications' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SecTitle icon={Bell} title="Notifications"
              sub="Configure email, SMS, push and real-time alert channels" />
            <div style={card}>
              <div style={GH}>Alert Channels</div>
              <div style={sGap}>
                <ToggleRow label="Email Notifications" hint="Send automated email briefs to faculty and students." checked={bool('notifications.emailEnabled')} onChange={v => setK('notifications.emailEnabled', v)} />
                <ToggleRow label="SMS Notifications" hint="Relay notifications via SMS gateway integration." checked={bool('notifications.smsEnabled')} onChange={v => setK('notifications.smsEnabled', v)} />
                <ToggleRow label="Browser Push Alerts" hint="Trigger web browser push notification events." checked={bool('notifications.pushEnabled')} onChange={v => setK('notifications.pushEnabled', v)} />
                <ToggleRow label="Real-Time WebSocket Warnings" hint="Stream live warnings over WebSocket connections." checked={bool('notifications.socketNotificationsEnabled')} onChange={v => setK('notifications.socketNotificationsEnabled', v)} />
                <ToggleRow label="Emergency Broadcast Mode" hint="Allow high-priority broadcast notifications." checked={bool('notifications.emergencyBroadcastEnabled')} onChange={v => setK('notifications.emergencyBroadcastEnabled', v)} />
              </div>
            </div>
            <div style={card}>
              <div style={GH}>Email Configuration</div>
              <div style={g2}>
                <Field label="SMTP Host"><Inp value={strV('notifications.smtpHost')} onChange={v => setK('notifications.smtpHost', v)} placeholder="smtp.gmail.com" /></Field>
                <Field label="SMTP Port"><Inp type="number" value={strV('notifications.smtpPort')} onChange={v => setK('notifications.smtpPort', v)} placeholder="587" /></Field>
                <Field label="SMTP Username"><Inp value={strV('notifications.smtpUser')} onChange={v => setK('notifications.smtpUser', v)} placeholder="noreply@mitwpu.edu.in" /></Field>
                <Field label="From Address"><Inp value={strV('notifications.emailFrom')} onChange={v => setK('notifications.emailFrom', v)} placeholder="ExamCell <noreply@mitwpu.edu.in>" /></Field>
              </div>
            </div>
          </div>
        )}

        {/* ══ SECURITY ══ */}
        {tab === 'security' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SecTitle icon={Shield} title="Security Policies"
              sub="Authentication, session management and access controls" />
            {!isSuper && (
              <div style={{ padding: '13px 16px', background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
                <AlertTriangle size={15} color="var(--accent-amber)" />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Security settings are restricted to the Super Admin account.</span>
              </div>
            )}
            <div style={card}>
              <div style={GH}>Authentication</div>
              <div style={g2}>
                <Field label="JWT Token Expiry" hint="e.g. 7d, 24h, 1h"><Inp value={strV('security.jwtExpiry')} onChange={v => setK('security.jwtExpiry', v)} placeholder="7d" /></Field>
                <Field label="Max Login Attempts"><Inp type="number" value={strV('security.maxLoginAttempts')} onChange={v => setK('security.maxLoginAttempts', v)} placeholder="5" /></Field>
                <Field label="Lockout Duration (mins)"><Inp type="number" value={strV('security.lockoutDurationMins')} onChange={v => setK('security.lockoutDurationMins', v)} placeholder="30" /></Field>
                <Field label="Session Timeout (mins)"><Inp type="number" value={strV('security.sessionTimeoutMins')} onChange={v => setK('security.sessionTimeoutMins', v)} placeholder="480" /></Field>
              </div>
            </div>
            <div style={card}>
              <div style={GH}>Rate Limiting</div>
              <div style={g2}>
                <Field label="API Requests / 15 min"><Inp type="number" value={strV('security.rateLimitRequests')} onChange={v => setK('security.rateLimitRequests', v)} placeholder="100" /></Field>
                <Field label="Auth Requests / 15 min"><Inp type="number" value={strV('security.authRateLimitRequests')} onChange={v => setK('security.authRateLimitRequests', v)} placeholder="10" /></Field>
              </div>
            </div>
            <div style={card}>
              <div style={GH}>Access Controls</div>
              <div style={sGap}>
                <ToggleRow label="Enforce Strong Passwords" hint="Requires 8+ chars, uppercase, number and symbol." checked={bool('security.enforceStrongPasswords')} onChange={v => setK('security.enforceStrongPasswords', v)} disabled={!isSuper} />
                <ToggleRow label="MFA for Admin Accounts" hint="Multi-factor auth required for coordinator logins." checked={bool('security.requireMfaForAdmin')} onChange={v => setK('security.requireMfaForAdmin', v)} disabled={!isSuper} />
                <ToggleRow label="Full Audit Trail Logging" hint="Logs every write and delete action." checked={bool('security.auditAllActions')} onChange={v => setK('security.auditAllActions', v)} disabled={!isSuper} />
                <ToggleRow label="Block Cross-Origin Requests" hint="Rejects API requests from unlisted domains." checked={bool('security.blockCrossOrigin')} onChange={v => setK('security.blockCrossOrigin', v)} disabled={!isSuper} />
              </div>
            </div>
          </div>
        )}

        {/* ══ AI RESOLVER ══ */}
        {tab === 'ai' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SecTitle icon={Zap} title="AI Auto-Resolver Configuration"
              sub="Manage Google Gemini API settings for real-time bug diagnostics and code resolution" />

            <div style={card}>
              <div style={GH}>AI Auto-Resolver Provider Settings</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Field label="AI Provider" hint="Select the service to use for diagnostics and auto-resolution.">
                  <Sel 
                    value={strV('ai.provider')} 
                    onChange={v => setK('ai.provider', v)} 
                    options={[
                      { value: 'openrouter', label: 'OpenRouter (Llama 3 / Gemini / Claude)' },
                      { value: 'gemini', label: 'Google AI Studio (Gemini Direct API)' }
                    ]} 
                  />
                </Field>

                {strV('ai.provider') === 'openrouter' ? (
                  <>
                    <Field label="OpenRouter API Key" hint="API key from openrouter.ai. Starts with sk-or-v1-...">
                      <Inp 
                        type="password"
                        value={strV('ai.openrouterApiKey')} 
                        onChange={v => setK('ai.openrouterApiKey', v)} 
                        placeholder="sk-or-v1-..." 
                      />
                    </Field>
                    <Field label="OpenRouter Model" hint="The AI model used to analyze the code. Recommended: google/gemini-2.5-flash (free tier) or meta-llama/llama-3-8b-instruct:free">
                      <Inp 
                        value={strV('ai.openrouterModel')} 
                        onChange={v => setK('ai.openrouterModel', v)} 
                        placeholder="google/gemini-2.5-flash" 
                      />
                    </Field>
                  </>
                ) : (
                  <>
                    <Field label="Gemini API Key" hint="Google AI Studio Gemini API key. Starts with AIzaSy...">
                      <Inp 
                        type="password"
                        value={strV('ai.geminiApiKey')} 
                        onChange={v => setK('ai.geminiApiKey', v)} 
                        placeholder="AIzaSy..." 
                      />
                    </Field>
                    <Field label="Gemini Model" hint="Google Gemini model key. E.g., gemini-2.5-flash.">
                      <Inp 
                        value={strV('ai.geminiModel')} 
                        onChange={v => setK('ai.geminiModel', v)} 
                        placeholder="gemini-2.5-flash" 
                      />
                    </Field>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══ ABOUT ══ */}
        {tab === 'about' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <SecTitle icon={Info} title="About ExamCell"
              sub="System version, stack information and license details" />
            <div style={{ ...card, textAlign: 'center', padding: '44px 28px' }}>
              <div style={{ width: 64, height: 64, borderRadius: 16, margin: '0 auto 18px', background: 'linear-gradient(135deg,rgba(168,85,247,0.14),rgba(124,58,237,0.07))', border: '1px solid rgba(168,85,247,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BookOpen size={26} color="var(--accent-purple)" />
              </div>
              <div style={{ fontSize: 26, fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>ExamCell</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 5 }}>Enterprise Academic Examination Management Platform</div>
              <div style={{ display: 'inline-flex', marginTop: 12 }}><Pill text="v2.4.0-stable" color="green" /></div>
            </div>
            <div style={card}>
              <div style={GH}>System Stack</div>
              {[
                ['Frontend',  'React 18 + Vite + Zustand'],
                ['Backend',   'Node.js v20 + Express.js'],
                ['Database',  'PostgreSQL 16 via pg'],
                ['Scheduler', 'Google OR-Tools CP-SAT (Python)'],
                ['Real-Time', 'Socket.IO WebSocket'],
                ['Auth',      'JWT + bcrypt'],
                ['License',   'MIT License'],
              ].map(([k, v], i, arr) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>{k}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 13 }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ ...card, borderColor: 'rgba(239,68,68,0.15)' }}>
              <div style={{ ...GH, color: '#f87171' }}>Danger Zone</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                <div>
                  <div style={{ ...TXT, color: '#f87171' }}>Reset All Settings to Defaults</div>
                  <div style={HNT}>Restores all configuration to factory defaults. Cannot be undone.</div>
                </div>
                <button
                  className="btn btn-ghost"
                  onClick={handleReset}
                  style={{ borderRadius: 8, color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', flexShrink: 0 }}
                >
                  <RotateCcw size={13} style={{ marginRight: 6 }} />Reset Defaults
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ── Unsaved changes notice (inline, no fixed/sticky) ─────────────── */}
      {isDirty && (
        <div className="fade-in-up" style={{
          marginTop: 32,
          padding: '14px 20px',
          background: 'rgba(168,85,247,0.06)',
          border: '1px solid rgba(168,85,247,0.2)',
          borderRadius: 12,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16,
          maxWidth: 820,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fbbf24', boxShadow: '0 0 8px rgba(251,191,36,0.6)', flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>You have unsaved configuration changes</span>
          </div>
          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setLocal(dbMap)} style={{ borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }}>Discard</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={isSaving} style={{ borderRadius: 8, padding: '0 18px', boxShadow: '0 4px 14px rgba(168,85,247,0.3)' }}>
              <Save size={12} style={{ marginRight: 6 }} />
              {isSaving ? 'Saving...' : 'Save All Changes'}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
