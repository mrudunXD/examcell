import { useState, useEffect, useRef } from 'react';
import { Bug, X, ChevronDown, Send, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '../store/index.js';
import api from '../lib/api.js';
import { useLocation } from 'react-router-dom';

const SEVERITIES = [
  { value: 'cosmetic', label: 'Cosmetic', color: '#6b7280', desc: 'Visual glitch, wrong color/alignment' },
  { value: 'minor',    label: 'Minor',    color: '#3b82f6', desc: 'Annoying but can work around it' },
  { value: 'major',    label: 'Major',    color: '#f59e0b', desc: 'Feature broken or data incorrect' },
  { value: 'critical', label: 'Critical', color: '#ef4444', desc: 'App crashes or data loss risk' },
];

// Capture recent client-side console errors globally
const clientErrors = [];
const _origConsoleError = console.error;
console.error = (...args) => {
  clientErrors.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
  if (clientErrors.length > 20) clientErrors.shift();
  _origConsoleError(...args);
};

export default function BugReporter() {
  const { user } = useAuthStore();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState('form'); // 'form' | 'submitting' | 'success' | 'error'
  const [submittedId, setSubmittedId] = useState(null);
  const [aiResult, setAiResult] = useState(null);
  const [polling, setPolling] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    steps: '',
    severity: 'minor',
    image_url: null,
  });

  const fileRef = useRef(null);
  const pollRef = useRef(null);

  // Don't render on kiosk pages
  if (!user || location.pathname.startsWith('/kiosk')) return null;

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setForm(f => ({ ...f, image_url: ev.target.result }));
    reader.readAsDataURL(file);
  };

  const resetForm = () => {
    setForm({ title: '', description: '', steps: '', severity: 'minor', image_url: null });
    setStage('form');
    setSubmittedId(null);
    setAiResult(null);
    setPolling(false);
    if (pollRef.current) clearInterval(pollRef.current);
  };

  const startPollingForAI = (bugId) => {
    setPolling(true);
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > 20) { // Stop after ~60s
        clearInterval(pollRef.current);
        setPolling(false);
        return;
      }
      try {
        const { data } = await api.get(`/bugs/${bugId}`);
        if (data.ai_root_cause) {
          setAiResult(data);
          setPolling(false);
          clearInterval(pollRef.current);
        }
      } catch { /* ignore */ }
    }, 3000);
  };

  const handleSubmit = async () => {
    if (!form.title.trim()) return;
    setStage('submitting');
    try {
      const { data } = await api.post('/bugs', {
        ...form,
        page_url: window.location.href,
        browser_info: navigator.userAgent,
        console_errors: clientErrors.slice(-10).join('\n') || null,
      });
      setSubmittedId(data.id);
      setStage('success');
      startPollingForAI(data.id);
    } catch (err) {
      console.error('Bug submission failed:', err);
      setStage('error');
    }
  };

  const confidenceColor = (c) => c >= 80 ? '#22c55e' : c >= 50 ? '#f59e0b' : '#ef4444';
  const statusLabel = (s) => ({
    open: '🔍 Analyzing',
    ai_suggested: '💡 Fix Suggested',
    fixed: '✅ Auto-Fixed!',
    in_progress: '🔧 In Progress',
    closed: '🔒 Closed',
  }[s] || s);

  return (
    <>
      {/* Floating trigger button */}
      <button
        id="bug-reporter-btn"
        onClick={() => { setOpen(true); resetForm(); }}
        title="Report a Bug"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 9000,
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
          border: '2px solid rgba(255,255,255,0.2)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(124,58,237,0.5)',
          transition: 'transform 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.12)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(124,58,237,0.7)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(124,58,237,0.5)'; }}
      >
        <Bug size={20} />
      </button>

      {/* Drawer overlay */}
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9001, display: 'flex', justifyContent: 'flex-end' }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div style={{
            width: '100%',
            maxWidth: 480,
            height: '100%',
            background: 'var(--bg-surface)',
            borderLeft: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '-8px 0 40px rgba(0,0,0,0.4)',
            animation: 'slideInRight 0.22s ease',
          }}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Bug size={16} color="#fff" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontFamily: 'var(--font-serif)', fontSize: 16 }}>Report a Bug</div>
                  <div style={{ fontSize: 11, color: 'var(--np-n500)' }}>AI will analyze and auto-fix if possible</div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 24 }} className="custom-scrollbar">

              {stage === 'form' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* Title */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--np-n500)', display: 'block', marginBottom: 6 }}>
                      Bug Summary *
                    </label>
                    <input
                      placeholder="e.g. Seating chart doesn't load after refresh"
                      value={form.title}
                      onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1.5px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-body)', boxSizing: 'border-box' }}
                    />
                  </div>

                  {/* Severity */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--np-n500)', display: 'block', marginBottom: 6 }}>
                      Severity
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      {SEVERITIES.map(s => (
                        <button
                          key={s.value}
                          onClick={() => setForm(f => ({ ...f, severity: s.value }))}
                          style={{
                            padding: '10px 12px',
                            borderRadius: 6,
                            border: `2px solid ${form.severity === s.value ? s.color : 'var(--border)'}`,
                            background: form.severity === s.value ? `${s.color}18` : 'var(--bg-elevated)',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: 12, color: s.color }}>{s.label}</div>
                          <div style={{ fontSize: 10, color: 'var(--np-n500)', marginTop: 2 }}>{s.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--np-n500)', display: 'block', marginBottom: 6 }}>
                      What happened?
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Describe what went wrong..."
                      value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1.5px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-body)', resize: 'vertical', boxSizing: 'border-box' }}
                    />
                  </div>

                  {/* Steps */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--np-n500)', display: 'block', marginBottom: 6 }}>
                      Steps to reproduce
                    </label>
                    <textarea
                      rows={3}
                      placeholder="1. Go to...\n2. Click...\n3. See error"
                      value={form.steps}
                      onChange={e => setForm(f => ({ ...f, steps: e.target.value }))}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1.5px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'var(--font-body)', resize: 'vertical', boxSizing: 'border-box' }}
                    />
                  </div>

                  {/* Screenshot */}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--np-n500)', display: 'block', marginBottom: 6 }}>
                      Screenshot (optional)
                    </label>
                    <input type="file" accept="image/*" ref={fileRef} onChange={handleImageUpload} style={{ display: 'none' }} />
                    {form.image_url ? (
                      <div style={{ position: 'relative' }}>
                        <img src={form.image_url} alt="screenshot" style={{ width: '100%', borderRadius: 6, border: '1px solid var(--border)' }} />
                        <button onClick={() => setForm(f => ({ ...f, image_url: null }))} style={{ position: 'absolute', top: 6, right: 6, background: '#ef4444', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', padding: '2px 6px', fontSize: 11 }}>Remove</button>
                      </div>
                    ) : (
                      <button onClick={() => fileRef.current?.click()} style={{ width: '100%', padding: '12px', borderRadius: 6, border: '1.5px dashed var(--border)', background: 'transparent', color: 'var(--np-n500)', cursor: 'pointer', fontSize: 12 }}>
                        📎 Click to attach a screenshot
                      </button>
                    )}
                  </div>

                  {/* Auto-captured info */}
                  <div style={{ padding: 12, background: 'var(--bg-elevated)', borderRadius: 6, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--np-n500)', marginBottom: 6 }}>AUTO-CAPTURED CONTEXT (sent to AI)</div>
                    <div style={{ fontSize: 11, color: 'var(--np-n500)', fontFamily: 'var(--font-mono)', lineHeight: 1.6 }}>
                      <div>📍 Page: {window.location.pathname}</div>
                      <div>👤 Reporter: {user?.name} ({user?.role})</div>
                      <div>🌐 Browser: {navigator.userAgent.split(' ').slice(-2).join(' ')}</div>
                      <div>⚠️ Console errors captured: {clientErrors.length}</div>
                    </div>
                  </div>
                </div>
              )}

              {stage === 'submitting' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, paddingTop: 60 }}>
                  <Loader2 size={48} style={{ animation: 'spin 1s linear infinite', color: '#7c3aed' }} />
                  <div style={{ fontWeight: 700, fontSize: 16 }}>Submitting bug report...</div>
                </div>
              )}

              {stage === 'success' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div style={{ textAlign: 'center', paddingTop: 20 }}>
                    <CheckCircle2 size={48} color="#22c55e" style={{ marginBottom: 12 }} />
                    <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Bug reported!</div>
                    <div style={{ fontSize: 13, color: 'var(--np-n500)' }}>Gemini 2.5 Pro is analyzing your report...</div>
                  </div>

                  {/* AI Result card */}
                  <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16 }}>🤖</span>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>AI Analysis</span>
                      {polling && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', marginLeft: 'auto', color: '#7c3aed' }} />}
                      {aiResult && <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: confidenceColor(aiResult.ai_confidence), background: `${confidenceColor(aiResult.ai_confidence)}18`, padding: '2px 8px', borderRadius: 20 }}>{aiResult.ai_confidence}% confidence</span>}
                    </div>
                    <div style={{ padding: 16 }}>
                      {!aiResult && polling && (
                        <div style={{ color: 'var(--np-n500)', fontSize: 13 }}>Reading source files and analyzing root cause... This takes 10–30 seconds.</div>
                      )}
                      {!aiResult && !polling && (
                        <div style={{ color: 'var(--np-n500)', fontSize: 13 }}>AI analysis timed out. Check the Bug Tracker for results.</div>
                      )}
                      {aiResult && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--np-n500)', textTransform: 'uppercase', marginBottom: 4 }}>Status</div>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>{statusLabel(aiResult.status)}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--np-n500)', textTransform: 'uppercase', marginBottom: 4 }}>Root Cause</div>
                            <div style={{ fontSize: 13, lineHeight: 1.6 }}>{aiResult.ai_root_cause}</div>
                          </div>
                          {aiResult.ai_explanation && (
                            <div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--np-n500)', textTransform: 'uppercase', marginBottom: 4 }}>Explanation</div>
                              <div style={{ fontSize: 12, color: 'var(--np-n500)', lineHeight: 1.6 }}>{aiResult.ai_explanation}</div>
                            </div>
                          )}
                          {aiResult.status === 'fixed' && (
                            <div style={{ padding: '10px 14px', background: '#14532d', borderRadius: 6, color: '#4ade80', fontWeight: 700, fontSize: 13 }}>
                              ✅ AI automatically patched the code!
                            </div>
                          )}
                          {aiResult.status === 'ai_suggested' && (
                            <div style={{ padding: '10px 14px', background: '#713f12', borderRadius: 6, color: '#fde68a', fontSize: 12 }}>
                              💡 Coordinator needs to review and apply the suggested fix in the Bug Tracker.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <button onClick={resetForm} style={{ padding: '10px', borderRadius: 6, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13 }}>
                    Report another bug
                  </button>
                </div>
              )}

              {stage === 'error' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, paddingTop: 60 }}>
                  <AlertTriangle size={48} color="#ef4444" />
                  <div style={{ fontWeight: 700 }}>Failed to submit bug report</div>
                  <button onClick={() => setStage('form')} style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: '#7c3aed', color: '#fff', cursor: 'pointer' }}>Try Again</button>
                </div>
              )}
            </div>

            {/* Footer submit button */}
            {stage === 'form' && (
              <div style={{ padding: 24, borderTop: '1px solid var(--border)', flexShrink: 0 }}>
                <button
                  id="bug-submit-btn"
                  onClick={handleSubmit}
                  disabled={!form.title.trim()}
                  style={{
                    width: '100%', padding: '12px', borderRadius: 6, border: 'none',
                    background: form.title.trim() ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : 'var(--border)',
                    color: '#fff', fontWeight: 700, fontSize: 14, cursor: form.title.trim() ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  <Send size={16} />
                  Submit Bug Report
                </button>
                <div style={{ fontSize: 11, color: 'var(--np-n500)', textAlign: 'center', marginTop: 8 }}>
                  Gemini 2.5 Pro will analyze and attempt to auto-fix this bug
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
