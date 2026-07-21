import { useState, useEffect } from 'react';
import {
  User, Mail, Phone, Shield, ShieldCheck, MapPin, Building, Key, Activity,
  Smartphone, Monitor, Globe, LogOut, CheckCircle, AlertTriangle, UserMinus,
  Check, X, Eye, EyeOff, Plus, Play, Trash2, Edit2, Lock, Unlock, AlertOctagon,
  Clock, ShieldAlert, FileText, CheckCircle2, RefreshCw, BarChart2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/index.js';
import api from '../lib/api.js';

// --- Styling Design Tokens ---
const cardStyle = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 14,
  padding: '24px 28px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
};

const rowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '14px 18px',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-faint)',
  borderRadius: 10,
};

const titleStyle = {
  fontSize: 18,
  fontWeight: 700,
  color: 'var(--text-primary)',
  letterSpacing: '-0.02em',
  margin: 0,
};

const g2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 };

const PERMISSIONS = {
  // Scheduling
  GENERATE_SCHEDULE: 'scheduling.generate',
  PUBLISH_SCHEDULE: 'scheduling.publish',
  ROLLBACK_SCHEDULE: 'scheduling.rollback',
  EDIT_CONSTRAINTS: 'scheduling.edit_constraints',
  MODIFY_SOLVER_SETTINGS: 'scheduling.modify_solver',

  // Students
  VIEW_STUDENTS: 'students.view',
  CREATE_STUDENTS: 'students.create',
  EDIT_STUDENTS: 'students.edit',
  DELETE_STUDENTS: 'students.delete',
  IMPORT_STUDENTS: 'students.import',
  EXPORT_STUDENTS: 'students.export',

  // Subjects
  VIEW_SUBJECTS: 'subjects.view',
  CREATE_SUBJECTS: 'subjects.create',
  EDIT_SUBJECTS: 'subjects.edit',
  DELETE_SUBJECTS: 'subjects.delete',
  IMPORT_SUBJECTS: 'subjects.import',
  EXPORT_SUBJECTS: 'subjects.export',

  // Faculty
  VIEW_FACULTY: 'faculty.view',
  MANAGE_DUTIES: 'faculty.manage_duties',
  EDIT_AVAILABILITY: 'faculty.edit_availability',

  // Classrooms
  MANAGE_ROOMS: 'classrooms.manage_rooms',
  EDIT_CAPACITIES: 'classrooms.edit_capacities',

  // Analytics
  VIEW_DASHBOARDS: 'analytics.view_dashboards',
  EXPORT_REPORTS: 'analytics.export_reports',

  // Audit
  VIEW_LOGS: 'audit.view_logs',
  EXPORT_LOGS: 'audit.export_logs',
  VERIFY_INTEGRITY: 'audit.verify_integrity',

  // System
  MANAGE_USERS: 'system.manage_users',
  MANAGE_ROLES: 'system.manage_roles',
  CHANGE_SETTINGS: 'system.change_settings',
  RESTORE_BACKUPS: 'system.restore_backups',
  RUN_MIGRATIONS: 'system.run_migrations',
  ACCESS_DEVELOPER_TOOLS: 'system.access_developer_tools'
};

const groupHeader = {
  fontSize: 10,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: 'var(--accent-purple)',
  opacity: 0.8,
  marginBottom: 14,
  paddingBottom: 8,
  borderBottom: '1px solid var(--border-faint)',
};

function Pill({ text, color = 'purple' }) {
  const map = {
    purple: ['rgba(168,85,247,0.12)', '#c084fc', 'rgba(168,85,247,0.25)'],
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
      borderRadius: 6, background: bg, color: fg, border: `1px solid ${border}`
    }}>{text}</span>
  );
}

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState('personal');
  
  // Profile loading / states
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Personal Info Form
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  
  // Password Change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [pwdStrength, setPwdStrength] = useState({ score: 0, text: 'Weak', color: 'red' });
  const [savingPassword, setSavingPassword] = useState(false);

  // MFA States (Feature 16)
  const [mfaSetupData, setMfaSetupData] = useState(null);
  const [totpToken, setTotpToken] = useState('');
  const [mfaStep, setMfaStep] = useState('idle'); // 'idle', 'setup', 'disabling'

  const handleStartMfaSetup = async () => {
    try {
      const { data } = await api.post('/iam/mfa/setup');
      setMfaSetupData(data);
      setMfaStep('setup');
      setTotpToken('');
    } catch (err) {
      toast.error('Failed to initialize MFA setup');
    }
  };

  const handleEnableMfa = async (e) => {
    e.preventDefault();
    if (!totpToken || !mfaSetupData) return;
    try {
      await api.post('/iam/mfa/enable', { token: totpToken, secret: mfaSetupData.secret });
      toast.success('MFA enabled successfully!');
      setMfaStep('idle');
      setMfaSetupData(null);
      setTotpToken('');
      loadProfile();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Verification failed');
    }
  };

  const handleDisableMfa = async (e) => {
    e.preventDefault();
    if (!totpToken) return;
    try {
      await api.post('/iam/mfa/disable', { token: totpToken });
      toast.success('MFA disabled successfully!');
      setMfaStep('idle');
      setTotpToken('');
      loadProfile();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Verification failed');
    }
  };

  // Admin and approval states
  const [adminStats, setAdminStats] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    name: '', email: '', username: '', employeeId: '', phone: '', designation: '', department: '', roles: ['faculty'], password: ''
  });

  const hasAdminPerm = user?.permissions?.includes('system.manage_users');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/iam/profile');
      setProfileData(data);
      setName(data.user.name || '');
      setPhone(data.user.phone || '');
      setDepartment(data.user.department || '');
      setDesignation(data.user.designation || '');
    } catch {
      toast.error('Failed to load profile details');
    } finally {
      setLoading(false);
    }
  };

  const loadAdminDashboard = async () => {
    if (!hasAdminPerm) return;
    try {
      const statsRes = await api.get('/iam/admin/dashboard');
      setAdminStats(statsRes.data);
      
      const usersRes = await api.get('/iam/admin/users');
      setAllUsers(usersRes.data);

      const approvalsRes = await api.get('/iam/approvals');
      setPendingApprovals(approvalsRes.data);
    } catch {
      toast.error('Failed to load admin context');
    }
  };

  useEffect(() => {
    if (activeTab === 'admin' && hasAdminPerm) {
      loadAdminDashboard();
    }
  }, [activeTab]);

  // Handle personal profile save
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await api.put('/iam/profile', { name, phone, department, designation });
      toast.success('Profile details updated successfully');
      
      // Update local store user object so layout matches instantly
      setUser({ ...user, name, department });
      loadProfile();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save changes');
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle Profile Picture Upload
  const handleProfilePictureUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;



    const t = toast.loading('Uploading profile picture...');
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const { data } = await api.post('/iam/profile-picture', { image: event.target.result });
        setUser({ ...user, profile_picture: data.profile_picture });
        loadProfile();
        toast.success('Profile picture updated', { id: t });
      } catch (err) {
        toast.error(err.response?.data?.error || 'Upload failed', { id: t });
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle password strength calculation
  const handlePasswordChangeInput = (val) => {
    setNewPassword(val);
    if (!val) {
      setPwdStrength({ score: 0, text: 'Empty', color: 'red' });
      return;
    }
    let score = 0;
    if (val.length >= 8) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[a-z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;

    let text = 'Weak';
    let color = 'red';
    if (score >= 4) { text = 'Strong'; color = 'green'; }
    else if (score >= 3) { text = 'Medium'; color = 'amber'; }

    setPwdStrength({ score, text, color });
  };

  // Handle change password form submit
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (pwdStrength.score < 3) {
      toast.error('Please choose a stronger password');
      return;
    }
    setSavingPassword(true);
    try {
      const res = await api.post('/iam/change-password', { currentPassword, newPassword });
      toast.success(res.data.message);
      setCurrentPassword('');
      setNewPassword('');
      setPwdStrength({ score: 0, text: 'Empty', color: 'red' });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Password update failed');
    } finally {
      setSavingPassword(false);
    }
  };

  // Session management
  const handleRevokeSession = async (sid) => {
    if (!confirm('Are you sure you want to sign out of this session?')) return;
    try {
      await api.delete(`/iam/sessions/${sid}`);
      toast.success('Session terminated');
      loadProfile();
    } catch {
      toast.error('Failed to revoke session');
    }
  };

  const handleRevokeAllOtherSessions = async () => {
    if (!confirm('Sign out of all other devices? This will terminate all active logins except this one.')) return;
    try {
      await api.delete('/iam/sessions');
      toast.success('Terminated all other sessions');
      loadProfile();
    } catch {
      toast.error('Failed to terminate sessions');
    }
  };

  // Admin user lifecycle management
  const handleUserStatusUpdate = async (uid, status) => {
    const confirmationMsg = status === 'archived' 
      ? 'Soft delete/archive this user? Active sessions will be terminated and they will not be able to log in.'
      : `Change status of user to ${status}?`;
    if (!confirm(confirmationMsg)) return;

    try {
      const res = await api.post(`/iam/admin/users/${uid}/status`, { status });
      if (res.data.pendingApproval) {
        toast.success(res.data.message);
      } else {
        toast.success(`User status updated to ${status}`);
        loadAdminDashboard();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Action failed');
    }
  };

  const handleUserRolesUpdate = async (uid, roles) => {
    try {
      await api.put(`/iam/admin/users/${uid}/roles`, { roles });
      toast.success('User roles updated');
      loadAdminDashboard();
      setSelectedUser(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Role assignment failed');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      await api.post('/iam/admin/users', newUserForm);
      toast.success('User account created successfully');
      setShowCreateUser(false);
      setNewUserForm({
        name: '', email: '', username: '', employeeId: '', phone: '', designation: '', department: '', roles: ['faculty'], password: ''
      });
      loadAdminDashboard();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create user');
    }
  };

  // Approval queue handling
  const handleResolveApproval = async (id, status) => {
    try {
      await api.post(`/iam/approvals/${id}/resolve`, { status });
      toast.success(`Request ${status} successfully`);
      loadAdminDashboard();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to resolve request');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: 16 }}>
        <div className="spinner" />
        <span style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>Enforcing IAM Policies & loading profile...</span>
      </div>
    );
  }

  const u = profileData.user;

  return (
    <div style={{ padding: '0 0 40px', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
      
      {/* --- HEADER --- */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', margin: 0 }}>
            Identity & Profile
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4, marginBottom: 0 }}>
            Manage identity, monitor active sessions, and review security policies
          </p>
        </div>
      </div>

      {/* --- TAB BAR --- */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', borderBottom: '1px solid var(--border)', marginBottom: 28 }}>
        {[
          { id: 'personal',    label: 'Profile',      icon: User },
          { id: 'security',    label: 'Security',     icon: Key },
          { id: 'sessions',    label: 'Sessions',     icon: Smartphone },
          { id: 'permissions', label: 'Permissions',  icon: ShieldCheck },
          { id: 'activity',    label: 'Activity Logs',icon: Activity },
          ...(hasAdminPerm ? [{ id: 'admin', label: 'IAM Administrator', icon: ShieldAlert }] : [])
        ].map(t => {
          const active = activeTab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '10px 18px',
                borderRadius: '8px 8px 0 0', border: 'none', cursor: 'pointer',
                background: active ? 'rgba(168,85,247,0.08)' : 'transparent',
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

      {/* --- CONTENT TABS --- */}
      <div style={{ maxWidth: 880 }}>

        {/* ══ Tab: Profile ══ */}
        {activeTab === 'personal' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }} className="fade-in-up">
            <div style={cardStyle}>
              <div style={{ display: 'flex', gap: 24, alignItems: 'center', paddingBottom: 24, borderBottom: '1px solid var(--border-faint)' }}>
                {/* Profile Picture Upload & Preview */}
                <div style={{ position: 'relative' }}>
                  <div style={{
                    width: 72, height: 72, borderRadius: '50%', overflow: 'hidden',
                    background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 28, fontWeight: 700, color: '#fff', border: '2px solid var(--border)'
                  }}>
                    {u.profile_picture ? (
                      <img src={u.profile_picture} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      u.name?.[0]?.toUpperCase() || 'U'
                    )}
                  </div>
                  <label style={{
                    position: 'absolute', bottom: -2, right: -2, width: 24, height: 24,
                    borderRadius: '50%', background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.4)'
                  }} title="Upload new picture">
                    <Edit2 size={11} color="var(--text-secondary)" />
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleProfilePictureUpload} />
                  </label>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{u.name}</h2>
                    <Pill text={u.status} color={u.status === 'active' ? 'green' : 'red'} />
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 4 }}>
                    Username: <span style={{ fontFamily: 'var(--font-mono)' }}>{u.username || 'N/A'}</span> &middot; Employee ID: <span style={{ fontFamily: 'var(--font-mono)' }}>{u.employee_id || 'N/A'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                    {u.roles?.map(r => <Pill key={r} text={r} color="purple" />)}
                  </div>
                </div>
              </div>

              <form onSubmit={handleSaveProfile} style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={groupHeader}>Identity details</div>
                <div style={g2}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)' }}>Full Name</label>
                    <input className="input" value={name} onChange={e => setName(e.target.value)} required style={{ background: 'rgba(9,9,20,0.5)' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)' }}>Email Address</label>
                    <input className="input" type="email" value={u.email} disabled style={{ background: 'rgba(9,9,20,0.2)', cursor: 'not-allowed', opacity: 0.6 }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)' }}>Phone Number</label>
                    <input className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 XXXXX XXXXX" style={{ background: 'rgba(9,9,20,0.5)' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)' }}>Employee ID</label>
                    <input className="input" value={u.employee_id || ''} disabled style={{ background: 'rgba(9,9,20,0.2)', cursor: 'not-allowed', opacity: 0.6 }} />
                  </div>
                </div>

                <div style={groupHeader}>Organization Assignment</div>
                <div style={g2}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)' }}>Department</label>
                    <input className="input" value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g. Computer Science & Engineering" style={{ background: 'rgba(9,9,20,0.5)' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)' }}>Designation</label>
                    <input className="input" value={designation} onChange={e => setDesignation(e.target.value)} placeholder="e.g. Assistant Professor" style={{ background: 'rgba(9,9,20,0.5)' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 16, borderTop: '1px solid var(--border-faint)' }}>
                  <button type="submit" className="btn btn-primary" disabled={savingProfile} style={{ borderRadius: 8 }}>
                    {savingProfile ? 'Saving...' : 'Save Profile Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ══ Tab: Security ══ */}
        {activeTab === 'security' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }} className="fade-in-up">
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <Key size={18} color="var(--accent-purple)" />
                <h3 style={titleStyle}>Change Password</h3>
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 0, marginBottom: 20 }}>
                Secure your account by updating your password. We prevent reuse of any of your last 5 passwords.
              </p>

              <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)' }}>Current Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="input"
                      type={showPwd ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={e => setCurrentPassword(e.target.value)}
                      required
                      style={{ background: 'rgba(9,9,20,0.5)' }}
                    />
                    <button type="button" onClick={() => setShowPwd(p => !p)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                      {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)' }}>New Password</label>
                  <input
                    className="input"
                    type={showPwd ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => handlePasswordChangeInput(e.target.value)}
                    required
                    style={{ background: 'rgba(9,9,20,0.5)' }}
                  />
                </div>

                {newPassword && (
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-faint)', padding: '12px 14px', borderRadius: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Password Strength:</span>
                      <span style={{ fontWeight: 700, color: `var(--accent-${pwdStrength.color})` }}>{pwdStrength.text}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4, height: 4 }}>
                      {[1, 2, 3, 4, 5].map(step => (
                        <div key={step} style={{
                          flex: 1, borderRadius: 2,
                          background: step <= pwdStrength.score ? `var(--accent-${pwdStrength.color})` : 'rgba(255,255,255,0.06)'
                        }} />
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8, lineHeight: 1.4 }}>
                      Requirements: Min 8 chars, 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special symbol.
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 12 }}>
                  <button type="submit" className="btn btn-primary" disabled={savingPassword} style={{ borderRadius: 8 }}>
                    {savingPassword ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>

            {/* MFA Setup Panel (Feature 16) */}
            <div style={{ ...cardStyle }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <Smartphone size={18} color="var(--accent-purple)" />
                <h3 style={titleStyle}>Multi-Factor Authentication (MFA)</h3>
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', marginTop: 0, marginBottom: 20 }}>
                Add an extra layer of security to your account using TOTP Google Authenticator.
              </p>

              {profileData?.user?.mfa_enabled === 1 ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.25)', padding: '14px 18px', borderRadius: 10, marginBottom: 18 }}>
                    <ShieldCheck size={20} color="var(--accent-green)" />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>MFA is Currently Active</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Your account is protected by 2FA verification.</div>
                    </div>
                  </div>

                  {mfaStep === 'disabling' ? (
                    <form onSubmit={handleDisableMfa} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-secondary)' }}>Enter 6-digit verification code to disable:</label>
                        <input 
                          type="text" 
                          className="input" 
                          value={totpToken} 
                          onChange={e => setTotpToken(e.target.value)} 
                          placeholder="000000" 
                          required 
                          maxLength={6}
                          style={{ maxWidth: 200, fontFamily: 'var(--font-mono)', textAlign: 'center', letterSpacing: '0.2em' }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button type="submit" className="btn btn-sm" style={{ background: 'var(--accent-red)', color: '#fff' }}>Confirm Deactivation</button>
                        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setMfaStep('idle')}>Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <button className="btn btn-sm" onClick={() => { setMfaStep('disabling'); setTotpToken(''); }} style={{ color: 'var(--accent-red)', border: '1px solid rgba(239,68,68,0.2)', background: 'none' }}>
                      Disable Two-Factor Authentication
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)', padding: '14px 18px', borderRadius: 10, marginBottom: 18 }}>
                    <ShieldAlert size={20} color="var(--accent-red)" />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>MFA is Disabled</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>We strongly recommend enabling MFA to secure coordinator and administrator privileges.</div>
                    </div>
                  </div>

                  {mfaStep === 'setup' && mfaSetupData ? (
                    <form onSubmit={handleEnableMfa} style={{ display: 'flex', flexDirection: 'column', gap: 18, borderTop: '1px solid var(--border-faint)', paddingTop: 18 }}>
                      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                        <div style={{ background: '#FFF', padding: 10, borderRadius: 8, display: 'inline-block' }}>
                          <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(mfaSetupData.otpauthUrl)}`} 
                            alt="MFA QR Code" 
                            style={{ display: 'block', width: 150, height: 150 }}
                          />
                        </div>
                        <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>Step 1: Scan this QR code or enter secret key manually</div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                            Scan the QR code with Google Authenticator or Microsoft Authenticator. If you cannot scan, enter the key below:
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, background: 'var(--bg-surface)', border: '1px solid var(--border)', padding: '8px 12px', borderRadius: 8, color: 'var(--accent-purple)', fontWeight: 600, letterSpacing: '0.05em' }}>
                            {mfaSetupData.secret}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--border-faint)', paddingTop: 18 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}>Step 2: Enter the 6-digit code to verify and activate</div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <input 
                            type="text" 
                            className="input" 
                            value={totpToken} 
                            onChange={e => setTotpToken(e.target.value)} 
                            placeholder="000000" 
                            required 
                            maxLength={6}
                            style={{ maxWidth: 200, fontFamily: 'var(--font-mono)', textAlign: 'center', letterSpacing: '0.2em' }}
                          />
                          <button type="submit" className="btn btn-primary" style={{ borderRadius: 8 }}>Activate MFA</button>
                          <button type="button" className="btn btn-ghost" onClick={() => setMfaStep('idle')} style={{ borderRadius: 8 }}>Cancel</button>
                        </div>
                      </div>
                    </form>
                  ) : (
                    <button className="btn btn-primary" onClick={handleStartMfaSetup} style={{ borderRadius: 8 }}>
                      Set Up Two-Factor Authentication
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ Tab: Sessions ══ */}
        {activeTab === 'sessions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }} className="fade-in-up">
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <h3 style={titleStyle}>My Active Sessions</h3>
                  <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
                    Tracking all devices currently logged into your ExamCell account
                  </p>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={handleRevokeAllOtherSessions} style={{ color: 'var(--accent-red)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  Sign Out Other Devices
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {profileData.sessions?.map(s => (
                  <div key={s.id} style={{
                    ...rowStyle,
                    ...(s.isCurrent ? { borderColor: 'rgba(168,85,247,0.25)', background: 'rgba(168,85,247,0.03)' } : {})
                  }}>
                    <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.03)',
                        display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center'
                      }}>
                        {s.device === 'Mobile' ? <Smartphone size={16} /> : <Monitor size={16} />}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 600 }}>{s.browser} on {s.os}</span>
                          {s.isCurrent && <Pill text="This Session" color="green" />}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                          IP: <span style={{ fontFamily: 'var(--font-mono)' }}>{s.ip_address}</span> &middot; Active: <span style={{ fontFamily: 'var(--font-mono)' }}>{new Date(s.last_activity).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {!s.isCurrent && (
                      <button className="btn btn-ghost btn-sm" onClick={() => handleRevokeSession(s.id)} style={{ color: 'var(--accent-red)', padding: 6 }}>
                        <LogOut size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ Tab: Permissions ══ */}
        {activeTab === 'permissions' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }} className="fade-in-up">
            <div style={cardStyle}>
              <div style={{ marginBottom: 20 }}>
                <h3 style={titleStyle}>Authorized System Capabilities</h3>
                <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
                  Below are the system privileges cryptographically verified for your active roles.
                </p>
              </div>

              <div style={{ border: '1px solid var(--border-faint)', borderRadius: 10, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-faint)' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Resource Module</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Permission Key</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>Authorized</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(PERMISSIONS).map(([nameKey, permValue], idx, arr) => {
                      const authorized = u.permissions?.includes(permValue);
                      const [moduleName] = permValue.split('.');
                      return (
                        <tr key={nameKey} style={{ borderBottom: idx < arr.length - 1 ? '1px solid var(--border-faint)' : 'none' }}>
                          <td style={{ padding: '10px 14px', fontWeight: 600, textTransform: 'capitalize' }}>{moduleName}</td>
                          <td style={{ padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-secondary)' }}>{permValue}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            {authorized ? (
                              <CheckCircle2 size={15} color="#34d399" />
                            ) : (
                              <span style={{ color: 'rgba(255,255,255,0.1)' }}>&mdash;</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══ Tab: Activity Logs ══ */}
        {activeTab === 'activity' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }} className="fade-in-up">
            <div style={cardStyle}>
              <div style={{ marginBottom: 20 }}>
                <h3 style={titleStyle}>My Account Audit History</h3>
                <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
                  A secure, immutable audit trail of actions performed by your user ID.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {profileData.auditLogs?.length === 0 ? (
                  <p style={{ textAlign: 'center', padding: '24px', color: 'var(--text-tertiary)' }}>No activities logged yet.</p>
                ) : (
                  profileData.auditLogs?.map((log, idx) => (
                    <div key={idx} style={{
                      display: 'flex', gap: 12, padding: '10px 14px',
                      background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-faint)',
                      borderRadius: 8
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-purple)', marginTop: 4 }} />
                        <div style={{ flex: 1, width: 1, background: 'rgba(255,255,255,0.05)', marginTop: 4 }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary)' }}>{log.action}</span>
                          <span style={{ fontSize: 10.5, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>{new Date(log.created_at).toLocaleString()}</span>
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 3 }}>
                          {log.details || `Modified ${log.entity}`}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══ Tab: IAM Administrator Dashboard ══ */}
        {activeTab === 'admin' && hasAdminPerm && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }} className="fade-in-up">
            
            {/* Dashboard Stats */}
            {adminStats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                {[
                  { label: 'Total Users', value: adminStats.stats?.totalUsers, color: 'purple' },
                  { label: 'Online Now', value: adminStats.stats?.onlineUsers, color: 'green' },
                  { label: 'Locked Accounts', value: adminStats.stats?.lockedUsers, color: 'red' },
                  { label: 'Failed Logins', value: adminStats.stats?.failedLogins, color: 'amber' },
                  { label: 'Active Users', value: adminStats.stats?.activeUsers, color: 'blue' }
                ].map((s, i) => (
                  <div key={i} style={{ ...cardStyle, padding: '14px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: `var(--accent-${s.color})` }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 3, fontWeight: 600 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Approval Workflows */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <Clock size={16} color="var(--accent-amber)" />
                <h3 style={titleStyle}>Pending Approval Requests</h3>
              </div>
              
              {pendingApprovals.length === 0 ? (
                <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', margin: 0, padding: '12px 0' }}>No pending dual-control approval requests.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {pendingApprovals.map(req => (
                    <div key={req.id} style={{ ...rowStyle, flexWrap: 'wrap', gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{req.action}</span>
                          <Pill text={req.status} color="amber" />
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
                          Entity: <span style={{ fontFamily: 'var(--font-mono)' }}>{req.entity_id || 'Global System'}</span> &middot; By: {req.requested_by_name} ({req.requested_by_email})
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sm" onClick={() => handleResolveApproval(req.id, 'approved')} style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Check size={12} /> Approve
                        </button>
                        <button className="btn btn-sm" onClick={() => handleResolveApproval(req.id, 'rejected')} style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <X size={12} /> Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* User Lifecycle List */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Users size={16} color="var(--accent-purple)" />
                  <h3 style={titleStyle}>User Accounts Management</h3>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => setShowCreateUser(true)} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Plus size={13} /> Invite User
                </button>
              </div>

              {/* Create User Dialog */}
              {showCreateUser && (
                <div style={{ ...cardStyle, border: '1px solid rgba(168,85,247,0.3)', marginBottom: 20 }} className="fade-in-up">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>Invite / Create New Account</div>
                    <button onClick={() => setShowCreateUser(false)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}><X size={16} /></button>
                  </div>
                  
                  <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={g2}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Full Name</label>
                        <input className="input" value={newUserForm.name} onChange={e => setNewUserForm({...newUserForm, name: e.target.value})} required />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Email</label>
                        <input className="input" type="email" value={newUserForm.email} onChange={e => setNewUserForm({...newUserForm, email: e.target.value})} required />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Username</label>
                        <input className="input" value={newUserForm.username} onChange={e => setNewUserForm({...newUserForm, username: e.target.value})} required />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Password</label>
                        <input className="input" type="password" value={newUserForm.password} onChange={e => setNewUserForm({...newUserForm, password: e.target.value})} required />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Employee ID</label>
                        <input className="input" value={newUserForm.employeeId} onChange={e => setNewUserForm({...newUserForm, employeeId: e.target.value})} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Designation</label>
                        <input className="input" value={newUserForm.designation} onChange={e => setNewUserForm({...newUserForm, designation: e.target.value})} />
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowCreateUser(false)}>Cancel</button>
                      <button type="submit" className="btn btn-primary btn-sm">Create Account</button>
                    </div>
                  </form>
                </div>
              )}

              <div style={{ border: '1px solid var(--border-faint)', borderRadius: 10, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-faint)' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>User Details</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Roles</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>Status</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allUsers.map((userObj) => (
                      <tr key={userObj.id} style={{ borderBottom: '1px solid var(--border-faint)' }}>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{userObj.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{userObj.email} &middot; Emp ID: {userObj.employee_id || '—'}</div>
                        </td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {userObj.roles?.map(r => <span key={r} style={{ fontSize: 9.5, padding: '2px 5px', borderRadius: 4, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-faint)' }}>{r}</span>)}
                          </div>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <Pill text={userObj.status || 'active'} color={userObj.status === 'active' ? 'green' : userObj.status === 'locked' ? 'red' : 'amber'} />
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                            {userObj.status === 'locked' && (
                              <button className="btn btn-ghost btn-sm" onClick={() => handleUserStatusUpdate(userObj.id, 'active')} title="Unlock account" style={{ padding: 4 }}>
                                <Unlock size={12} color="var(--accent-green)" />
                              </button>
                            )}
                            {userObj.status === 'active' && (
                              <button className="btn btn-ghost btn-sm" onClick={() => handleUserStatusUpdate(userObj.id, 'locked')} title="Lock account" style={{ padding: 4 }}>
                                <Lock size={12} color="var(--accent-red)" />
                              </button>
                            )}
                            
                            {userObj.status !== 'suspended' ? (
                              <button className="btn btn-ghost btn-sm" onClick={() => handleUserStatusUpdate(userObj.id, 'suspended')} title="Suspend account" style={{ padding: 4 }}>
                                <AlertOctagon size={12} color="var(--accent-amber)" />
                              </button>
                            ) : (
                              <button className="btn btn-ghost btn-sm" onClick={() => handleUserStatusUpdate(userObj.id, 'active')} title="Reactivate user" style={{ padding: 4 }}>
                                <CheckCircle size={12} color="var(--accent-green)" />
                              </button>
                            )}

                            {userObj.id !== user.id && (
                              <button className="btn btn-ghost btn-sm" onClick={() => handleRevokeSession(userObj.id)} title="Delete/archive account" style={{ padding: 4, color: 'var(--accent-red)' }}>
                                <Trash2 size={12} />
                              </button>
                            )}
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

      </div>
    </div>
  );
}
