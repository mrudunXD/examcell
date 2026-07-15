import { useState, useEffect } from 'react';
import { 
  Bug, AlertOctagon, CheckCircle2, ChevronRight, Play, RefreshCw, Trash2, 
  Clock, Server, Terminal, User, FileText, ChevronDown, Sparkles
} from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';

export default function BugTrackerPage() {
  const [bugs, setBugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBug, setSelectedBug] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [notesText, setNotesText] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);

  const fetchBugs = async () => {
    try {
      const { data } = await api.get('/bugs');
      setBugs(data);
      // Keep selected bug up to date if one is selected
      if (selectedBug) {
        const updated = data.find(b => b.id === selectedBug.id);
        if (updated) setSelectedBug(updated);
      }
    } catch (err) {
      toast.error('Failed to load bugs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBugs();
  }, []);

  const handleSelectBug = (bug) => {
    setSelectedBug(bug);
    setNotesText(bug.notes || '');
  };

  const handleSaveNotes = async () => {
    if (!selectedBug) return;
    setSavingNotes(true);
    try {
      const { data } = await api.patch(`/bugs/${selectedBug.id}`, { notes: notesText });
      toast.success('Notes updated successfully');
      setSelectedBug(data);
      setBugs(prev => prev.map(b => b.id === data.id ? data : b));
    } catch (err) {
      toast.error('Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleReanalyze = async (bugId) => {
    setReanalyzing(true);
    try {
      await api.post(`/bugs/${bugId}/reanalyze`);
      toast.success('AI Re-analysis triggered');
      // Wait a moment then fetch update
      setTimeout(fetchBugs, 3000);
    } catch (err) {
      toast.error('Failed to trigger AI re-analysis');
    } finally {
      setReanalyzing(false);
    }
  };

  const handleDeleteBug = async (bugId) => {
    if (!confirm('Are you sure you want to delete this bug report?')) return;
    try {
      await api.delete(`/bugs/${bugId}`);
      toast.success('Bug deleted successfully');
      setSelectedBug(null);
      fetchBugs();
    } catch (err) {
      toast.error('Failed to delete bug');
    }
  };

  const handleForceApply = async (bugId) => {
    try {
      await api.post(`/bugs/${bugId}/apply-patch`);
      toast.success('AI Patch manually applied');
      fetchBugs();
    } catch (err) {
      toast.error('Failed to apply AI patch');
    }
  };

  const getSeverityStyle = (severity) => {
    switch (severity) {
      case 'critical': return { bg: '#fee2e2', fg: '#ef4444', text: 'Critical' };
      case 'major': return { bg: '#ffedd5', fg: '#f97316', text: 'Major' };
      case 'minor': return { bg: '#dbeafe', fg: '#3b82f6', text: 'Minor' };
      default: return { bg: '#f3f4f6', fg: '#6b7280', text: 'Cosmetic' };
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'fixed': return { bg: '#dcfce7', fg: '#15803d', text: 'Auto-Fixed' };
      case 'ai_suggested': return { bg: '#fef9c3', fg: '#a16207', text: 'AI Proposing' };
      case 'in_progress': return { bg: '#e0f2fe', fg: '#0369a1', text: 'In Progress' };
      case 'closed': return { bg: '#f3f4f6', fg: '#4b5563', text: 'Closed' };
      default: return { bg: '#fef2f2', fg: '#b91c1c', text: 'Open / Failed' };
    }
  };

  const filteredBugs = bugs.filter(b => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'fixed') return b.status === 'fixed';
    if (filterStatus === 'open') return b.status === 'open';
    if (filterStatus === 'in_progress') return b.status === 'in_progress';
    return true;
  });

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', boxSizing: 'border-box' }}>
      
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontFamily: 'var(--font-serif)', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Bug size={32} style={{ color: 'var(--np-ink)' }} />
            AI Bug Tracker & Auto-Resolver
          </h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--np-n500)', fontSize: '13px' }}>
            Bugs reported by faculty and coordinators. Analyzed and resolved automatically in real-time by Google Gemini.
          </p>
        </div>
        
        <button 
          onClick={fetchBugs} 
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px',
            border: '2px solid var(--np-ink)', borderRadius: '6px', background: 'transparent',
            cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '12px',
            boxShadow: '4px 4px 0 0 var(--np-ink)', transition: 'all 0.1s'
          }}
          onMouseDown={e => e.currentTarget.style.transform = 'translate(2px, 2px)'}
          onMouseUp={e => e.currentTarget.style.transform = 'none'}
        >
          <RefreshCw size={14} /> Refresh Board
        </button>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', padding: '16px', borderRadius: '8px', boxShadow: '2px 2px 0 0 var(--np-ink)' }}>
          <div style={{ fontSize: '12px', color: 'var(--np-n500)', fontWeight: 700, textTransform: 'uppercase' }}>Total Reported</div>
          <div style={{ fontSize: '28px', fontWeight: 900, marginTop: '8px', fontFamily: 'var(--font-mono)' }}>{bugs.length}</div>
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', padding: '16px', borderRadius: '8px', boxShadow: '2px 2px 0 0 var(--np-ink)' }}>
          <div style={{ fontSize: '12px', color: '#16a34a', fontWeight: 700, textTransform: 'uppercase' }}>Auto-Resolved by AI</div>
          <div style={{ fontSize: '28px', fontWeight: 900, marginTop: '8px', fontFamily: 'var(--font-mono)', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {bugs.filter(b => b.status === 'fixed').length}
            <span style={{ fontSize: '12px', fontWeight: 600, background: '#dcfce7', padding: '2px 8px', borderRadius: '12px' }}>
              {bugs.length ? Math.round((bugs.filter(b => b.status === 'fixed').length / bugs.length) * 100) : 0}% success rate
            </span>
          </div>
        </div>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', padding: '16px', borderRadius: '8px', boxShadow: '2px 2px 0 0 var(--np-ink)' }}>
          <div style={{ fontSize: '12px', color: '#dc2626', fontWeight: 700, textTransform: 'uppercase' }}>Active / Open</div>
          <div style={{ fontSize: '28px', fontWeight: 900, marginTop: '8px', fontFamily: 'var(--font-mono)', color: '#dc2626' }}>
            {bugs.filter(b => b.status === 'open' || b.status === 'in_progress').length}
          </div>
        </div>
      </div>

      {/* Main Board Layout */}
      <div style={{ display: 'flex', gap: '24px', flex: 1, minHeight: 0 }}>
        
        {/* Left Side: Bug List */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)', border: '2px solid var(--np-ink)', borderRadius: '8px', overflow: 'hidden' }}>
          
          {/* Filters Bar */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'flex', gap: '8px' }}>
            {['all', 'open', 'fixed', 'in_progress'].map(st => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                style={{
                  padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--border)',
                  background: filterStatus === st ? 'var(--np-ink)' : 'transparent',
                  color: filterStatus === st ? '#fff' : 'var(--text-primary)',
                  fontWeight: 700, fontSize: '12px', cursor: 'pointer', textTransform: 'uppercase'
                }}
              >
                {st.replace('_', ' ')} ({st === 'all' ? bugs.length : bugs.filter(b => b.status === st).length})
              </button>
            ))}
          </div>

          {/* List Scroll Container */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }} className="custom-scrollbar">
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--np-n500)' }}>Loading board...</div>
            ) : filteredBugs.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--np-n500)' }}>No bug reports found matching filters.</div>
            ) : (
              filteredBugs.map(bug => {
                const sev = getSeverityStyle(bug.severity);
                const stat = getStatusStyle(bug.status);
                const isSelected = selectedBug?.id === bug.id;
                
                return (
                  <div
                    key={bug.id}
                    onClick={() => handleSelectBug(bug)}
                    style={{
                      padding: '16px',
                      borderRadius: '8px',
                      border: isSelected ? '2px solid var(--np-ink)' : '1px solid var(--border)',
                      background: isSelected ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                      cursor: 'pointer',
                      boxShadow: isSelected ? '4px 4px 0 0 var(--np-ink)' : 'none',
                      transition: 'all 0.15s',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '10px', fontWeight: 900, background: sev.bg, color: sev.fg, padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                          {sev.text}
                        </span>
                        <span style={{ fontSize: '10px', fontWeight: 900, background: stat.bg, color: stat.fg, padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                          {stat.text}
                        </span>
                        {bug.ai_confidence && (
                          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--np-n500)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <Sparkles size={10} style={{ color: '#8b5cf6' }} /> AI {bug.ai_confidence}%
                          </span>
                        )}
                      </div>
                      
                      <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', wordBreak: 'break-all' }}>{bug.title}</div>
                      
                      <div style={{ fontSize: '11px', color: 'var(--np-n500)', display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><User size={12} /> {bug.reporter_name} ({bug.reporter_role})</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> {new Date(bug.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <ChevronRight size={20} style={{ color: 'var(--np-n500)', flexShrink: 0, transform: isSelected ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Bug Details / Panel */}
        <div style={{ width: '450px', background: 'var(--bg-surface)', border: '2px solid var(--np-ink)', borderRadius: '8px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {selectedBug ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              
              {/* Detail Header */}
              <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 900, background: getSeverityStyle(selectedBug.severity).bg, color: getSeverityStyle(selectedBug.severity).fg, padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                      {getSeverityStyle(selectedBug.severity).text}
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: 900, background: getStatusStyle(selectedBug.status).bg, color: getStatusStyle(selectedBug.status).fg, padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                      {getStatusStyle(selectedBug.status).text}
                    </span>
                  </div>
                  <button onClick={() => handleDeleteBug(selectedBug.id)} style={{ padding: '4px', border: 'none', background: 'transparent', color: '#dc2626', cursor: 'pointer' }} title="Delete Bug">
                    <Trash2 size={16} />
                  </button>
                </div>
                
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>{selectedBug.title}</h3>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '11px', color: 'var(--np-n500)' }}>
                  <span>Reporter: <strong>{selectedBug.reporter_name}</strong> ({selectedBug.reporter_role})</span>
                  <span>Created: {new Date(selectedBug.created_at).toLocaleString()}</span>
                  {selectedBug.page_url && (
                    <span style={{ width: '100%', wordBreak: 'break-all' }}>URL: <a href={selectedBug.page_url} target="_blank" rel="noreferrer" style={{ color: 'var(--np-ink)', textDecoration: 'underline' }}>{selectedBug.page_url}</a></span>
                  )}
                </div>
              </div>

              {/* Detail Content (Scrollable) */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }} className="custom-scrollbar">
                
                {/* Description */}
                {selectedBug.description && (
                  <div>
                    <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', color: 'var(--np-n500)', letterSpacing: '0.05em' }}>Description</h4>
                    <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{selectedBug.description}</p>
                  </div>
                )}

                {/* Steps */}
                {selectedBug.steps && (
                  <div>
                    <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', color: 'var(--np-n500)', letterSpacing: '0.05em' }}>Steps to Reproduce</h4>
                    <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, whiteSpace: 'pre-wrap', background: 'var(--bg-elevated)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)' }}>{selectedBug.steps}</p>
                  </div>
                )}

                {/* Screen Shot Image */}
                {selectedBug.image_url && (
                  <div>
                    <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', color: 'var(--np-n500)', letterSpacing: '0.05em' }}>Screenshot</h4>
                    <img 
                      src={selectedBug.image_url} 
                      alt="Bug visual screenshot" 
                      style={{ width: '100%', borderRadius: '6px', border: '1px solid var(--border)', cursor: 'pointer', filter: 'brightness(0.95)' }}
                      onClick={() => window.open(selectedBug.image_url)}
                    />
                  </div>
                )}

                {/* AI Root Cause & Fix suggestions */}
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                    <span style={{ fontSize: '16px' }}>🤖</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>Google Gemini AI Diagnostics</span>
                    <button 
                      onClick={() => handleReanalyze(selectedBug.id)}
                      disabled={reanalyzing}
                      style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <RefreshCw size={10} style={{ animation: reanalyzing ? 'spin 1s linear infinite' : 'none' }} /> Re-analyze
                    </button>
                  </div>

                  {selectedBug.ai_root_cause ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', color: '#334155' }}>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2px' }}>AI Identified Cause</div>
                        <p style={{ margin: 0, fontWeight: 600 }}>{selectedBug.ai_root_cause}</p>
                      </div>
                      
                      {selectedBug.ai_explanation && (
                        <div>
                          <div style={{ fontSize: '11px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '2px' }}>Analysis Explanation</div>
                          <p style={{ margin: 0, color: '#64748b', fontSize: '12px', lineHeight: 1.5 }}>{selectedBug.ai_explanation}</p>
                        </div>
                      )}

                      {/* Auto Patched Code Output */}
                      {selectedBug.status === 'fixed' && (
                        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '12px', borderRadius: '6px', color: '#047857', fontWeight: 700, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={16} /> ✅ Auto-patched successfully!</span>
                          <span style={{ fontSize: '11px', fontWeight: 400, color: '#065f46' }}>The app code was directly written and hot-reloaded.</span>
                        </div>
                      )}

                      {selectedBug.ai_patches && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ fontSize: '11px', fontWeight: 900, color: '#94a3b8', textTransform: 'uppercase' }}>Proposed Patch Diff</div>
                          {JSON.parse(selectedBug.ai_patches).map((p, idx) => (
                            <div key={idx} style={{ background: '#0f172a', color: '#cbd5e1', padding: '12px', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '11px', overflowX: 'auto' }}>
                              <div style={{ borderBottom: '1px solid #334155', paddingBottom: '4px', marginBottom: '8px', color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                                <span>{p.filePath}</span>
                              </div>
                              <div style={{ color: '#ef4444', textDecoration: 'line-through', whiteSpace: 'pre-wrap' }}>- {p.search}</div>
                              <div style={{ color: '#22c55e', whiteSpace: 'pre-wrap', marginTop: '4px' }}>+ {p.replace}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ color: '#64748b', fontSize: '12px', fontStyle: 'italic', textAlign: 'center', padding: '10px' }}>
                      No AI analysis results available. Click 'Re-analyze' to run Gemini.
                    </div>
                  )}
                </div>

                {/* Internal Notes */}
                <div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', color: 'var(--np-n500)', letterSpacing: '0.05em' }}>Notes / Comments</h4>
                  <textarea
                    rows={3}
                    placeholder="Add coordinator notes about this bug..."
                    value={notesText}
                    onChange={e => setNotesText(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1.5px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box' }}
                  />
                  <button
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                    style={{
                      marginTop: '8px', width: '100%', padding: '10px', borderRadius: '6px', border: 'none',
                      background: 'var(--np-ink)', color: '#fff', fontWeight: 700, fontSize: '12px', cursor: 'pointer'
                    }}
                  >
                    {savingNotes ? 'Saving...' : 'Save Notes'}
                  </button>
                </div>

              </div>

              {/* Status Update Actions Footer */}
              <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'flex', gap: '8px' }}>
                <button
                  onClick={async () => {
                    const next = selectedBug.status === 'closed' ? 'open' : 'closed';
                    const { data } = await api.patch(`/bugs/${selectedBug.id}`, { status: next });
                    setSelectedBug(data);
                    setBugs(prev => prev.map(b => b.id === data.id ? data : b));
                    toast.success(`Bug marked as ${next}`);
                  }}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '6px', border: '1.5px solid var(--border)',
                    background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '12px', fontWeight: 700
                  }}
                >
                  {selectedBug.status === 'closed' ? 'Reopen Bug' : 'Mark as Closed'}
                </button>
                {selectedBug.status === 'open' && (
                  <button
                    onClick={async () => {
                      const { data } = await api.patch(`/bugs/${selectedBug.id}`, { status: 'in_progress' });
                      setSelectedBug(data);
                      setBugs(prev => prev.map(b => b.id === data.id ? data : b));
                      toast.success('Bug marked as In Progress');
                    }}
                    style={{
                      flex: 1, padding: '10px', borderRadius: '6px', border: 'none',
                      background: '#3b82f6', color: '#fff', cursor: 'pointer', fontSize: '12px', fontWeight: 700
                    }}
                  >
                    Start Fixing
                  </button>
                )}
              </div>

            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: 'var(--np-n500)', padding: '40px' }}>
              <Bug size={48} style={{ opacity: 0.3 }} />
              <div style={{ fontSize: '14px', fontWeight: 700 }}>No Bug Selected</div>
              <div style={{ fontSize: '12px', textAlign: 'center' }}>Select a bug report from the left panel to inspect detailed telemetry, logs, and AI auto-fixes.</div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
