import { useState, useEffect } from 'react';
import { UserCog, Calendar, ShieldCheck, Database, Volume2, Bell, Cpu, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/index.js';

const DEFAULT_SETTINGS = {
  workspaceName: 'ExamCell',
  adminEmail: 'examcell@mitwpu.edu.in',
  defaultDuration: 180,
  defaultMode: 'offline',
  autoBackup: true,
  backupFrequency: 'daily',
  retentionCount: 10,
  cpuThreshold: 80,
  memoryThreshold: 85,
  alertWebhook: '',
  chronologicalOrder: true
};

export default function SettingsPage() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState('general');
  const [saving, setSaving] = useState(false);
  const { user } = useAuthStore();
  const isCoord = user?.role === 'coordinator';

  useEffect(() => {
    const saved = localStorage.getItem('examcell_settings');
    if (saved) {
      try {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleSave = (e) => {
    e.preventDefault();
    if (!isCoord) {
      toast.error('Only coordinators can update system settings');
      return;
    }
    setSaving(true);
    setTimeout(() => {
      localStorage.setItem('examcell_settings', JSON.stringify(settings));
      toast.success('System settings updated successfully');
      setSaving(false);
    }, 600);
  };

  return (
    <div className="saas-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '24px 28px 40px' }}>
      {/* Top Section: Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>System Settings</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>Configure system-wide defaults, database backup policies, and monitoring thresholds.</p>
        </div>
      </div>

      {/* Middle Section: KPI summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24 }}>
        <div className="card" style={{ padding: 24, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Backup Policy</span>
            <Database size={14} color="#10b981" strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
              {settings.autoBackup ? 'Daily Active' : 'Disabled'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Retention limit: {settings.retentionCount} copies</div>
          </div>
        </div>

        <div className="card" style={{ padding: 24, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Default Session</span>
            <Calendar size={14} color="#3b82f6" strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>Odd Semester</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Time-limit: {settings.defaultDuration} mins</div>
          </div>
        </div>

        <div className="card" style={{ padding: 24, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Alert thresholds</span>
            <Cpu size={14} color="#f59e0b" strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
              {settings.cpuThreshold}% CPU / {settings.memoryThreshold}% RAM
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Slack notify: {settings.alertWebhook ? 'Configured' : 'None'}</div>
          </div>
        </div>

        <div className="card" style={{ padding: 24, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Security Mode</span>
            <ShieldCheck size={14} color="#7c3aed" strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>Enforced TLS</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>RBAC level: Coordinator-only</div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Forms Container */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* SaaS UI Header Bar */}
        <div className="saas-page-header-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Configuration Settings</span>
            
            <div className="saas-filter-tabs">
              <button className={`saas-filter-tab${activeTab === 'general' ? ' active' : ''}`} onClick={() => setActiveTab('general')}>General</button>
              <button className={`saas-filter-tab${activeTab === 'scheduling' ? ' active' : ''}`} onClick={() => setActiveTab('scheduling')}>Scheduling</button>
              <button className={`saas-filter-tab${activeTab === 'backups' ? ' active' : ''}`} onClick={() => setActiveTab('backups')}>Backups</button>
              <button className={`saas-filter-tab${activeTab === 'telemetry' ? ' active' : ''}`} onClick={() => setActiveTab('telemetry')}>Telemetry Alerts</button>
            </div>
          </div>

          <div>
            {isCoord && (
              <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ borderRadius: 6 }}>
                {saving ? 'Saving...' : <><Save size={13} style={{ marginRight: 4 }} /> Save Settings</>}
              </button>
            )}
          </div>
        </div>

        {/* Configuration Forms */}
        <form onSubmit={handleSave} style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 24 }}>
          {activeTab === 'general' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 500 }}>
              <div className="form-group">
                <label className="form-label">Workspace/Branding Title</label>
                <input 
                  className="input" 
                  value={settings.workspaceName} 
                  onChange={e => setSettings({ ...settings, workspaceName: e.target.value })} 
                  disabled={!isCoord} 
                  placeholder="ExamCell"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Administrator Notification Email</label>
                <input 
                  className="input" 
                  type="email"
                  value={settings.adminEmail} 
                  onChange={e => setSettings({ ...settings, adminEmail: e.target.value })} 
                  disabled={!isCoord} 
                  placeholder="admin@mitwpu.edu.in"
                />
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>System alerts and conflict warnings will be forwarded here.</span>
              </div>
            </div>
          )}

          {activeTab === 'scheduling' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 500 }}>
              <div className="form-group">
                <label className="form-label">Default Exam Duration (Minutes)</label>
                <input 
                  className="input" 
                  type="number"
                  value={settings.defaultDuration} 
                  onChange={e => setSettings({ ...settings, defaultDuration: parseInt(e.target.value) || 180 })} 
                  disabled={!isCoord} 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Default Exam Mode</label>
                <select 
                  className="select"
                  value={settings.defaultMode} 
                  onChange={e => setSettings({ ...settings, defaultMode: e.target.value })} 
                  disabled={!isCoord} 
                  style={{ background: 'var(--bg-input)' }}
                >
                  <option value="offline">Offline (Halls Grid)</option>
                  <option value="online">Online (Computer Lab)</option>
                </select>
              </div>

              <div className="form-group flex-row" style={{ alignItems: 'center', gap: 10, cursor: 'pointer', marginTop: 8 }}>
                <input 
                  type="checkbox" 
                  id="chrono"
                  checked={settings.chronologicalOrder} 
                  onChange={e => setSettings({ ...settings, chronologicalOrder: e.target.checked })}
                  disabled={!isCoord} 
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <label htmlFor="chrono" className="form-label" style={{ margin: 0, cursor: 'pointer', userSelect: 'none' }}>
                  Enable default chronological order constraint (FY ➔ SY ➔ TY)
                </label>
              </div>
            </div>
          )}

          {activeTab === 'backups' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 500 }}>
              <div className="form-group flex-row" style={{ alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  id="autoback"
                  checked={settings.autoBackup} 
                  onChange={e => setSettings({ ...settings, autoBackup: e.target.checked })}
                  disabled={!isCoord} 
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <label htmlFor="autoback" className="form-label" style={{ margin: 0, cursor: 'pointer', userSelect: 'none' }}>
                  Enable database daily auto-backups
                </label>
              </div>

              <div className="form-group">
                <label className="form-label">Backup Schedule Frequency</label>
                <select 
                  className="select"
                  value={settings.backupFrequency} 
                  onChange={e => setSettings({ ...settings, backupFrequency: e.target.value })} 
                  disabled={!isCoord || !settings.autoBackup} 
                  style={{ background: 'var(--bg-input)' }}
                >
                  <option value="daily">Daily Backup Schedule</option>
                  <option value="weekly">Weekly Backup Schedule</option>
                  <option value="monthly">Monthly Backup Schedule</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Retention Copy Count Limit</label>
                <input 
                  className="input" 
                  type="number"
                  min={1}
                  value={settings.retentionCount} 
                  onChange={e => setSettings({ ...settings, retentionCount: parseInt(e.target.value) || 10 })} 
                  disabled={!isCoord || !settings.autoBackup} 
                />
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>Older database backups will be deleted automatically to preserve storage space.</span>
              </div>
            </div>
          )}

          {activeTab === 'telemetry' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 500 }}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">CPU Alert Threshold (%)</label>
                  <input 
                    className="input" 
                    type="number"
                    min={10}
                    max={100}
                    value={settings.cpuThreshold} 
                    onChange={e => setSettings({ ...settings, cpuThreshold: parseInt(e.target.value) || 80 })} 
                    disabled={!isCoord} 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Memory Alert Threshold (%)</label>
                  <input 
                    className="input" 
                    type="number"
                    min={10}
                    max={100}
                    value={settings.memoryThreshold} 
                    onChange={e => setSettings({ ...settings, memoryThreshold: parseInt(e.target.value) || 85 })} 
                    disabled={!isCoord} 
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Telemetry Notifications Webhook URL</label>
                <input 
                  className="input" 
                  value={settings.alertWebhook} 
                  onChange={e => setSettings({ ...settings, alertWebhook: e.target.value })} 
                  disabled={!isCoord} 
                  placeholder="https://hooks.slack.com/services/..."
                />
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>Webhook for alerting Slack / Discord channel about system health thresholds or critical schedule conflicts.</span>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
