import { useState } from 'react';
import { User, Mail, Building, Shield, Save, Loader2, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../store/index.js';
import api from '../lib/api.js';

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const { data } = await api.put('/auth/profile', { name, email, department });
      setUser(data.user);
      setSaved(true);
      toast.success('Profile updated');
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const card = {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: '24px 28px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: 640 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
        Profile
      </h1>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 24 }}>
        Manage your personal account information
      </p>

      <div style={card}>
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingBottom: 20, borderBottom: '1px solid var(--border-faint)' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 700, color: '#fff', flexShrink: 0
            }}>
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{user?.name}</div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                marginTop: 4, padding: '2px 8px', borderRadius: 4,
                background: 'var(--accent-primary-alpha)',
                color: 'var(--accent-primary)', fontSize: 11, fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.03em'
              }}>
                <Shield size={12} strokeWidth={2.5} />
                {user?.role}
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label"><User size={14} /> Full Name</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label"><Mail size={14} /> Email</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label"><Building size={14} /> Department</label>
            <input className="input" value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g. Computer Engineering" />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border-faint)' }}>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {saving ? <Loader2 size={15} className="spin" /> : saved ? <CheckCircle size={15} /> : <Save size={15} />}
              {saving ? 'Saving...' : saved ? 'Saved' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
