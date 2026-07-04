import { useState, useEffect, useMemo } from 'react';
import { RefreshCw, TrendingUp, AlertCircle, Users, Scale, BarChart3, Activity, ShieldAlert, Award, Search, X } from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';

// Monochromatic sea-green heat mapping
function heatColor(value, max) {
  if (!value || max === 0) return { bg: 'rgba(22, 184, 151, 0.02)', text: 'var(--text-tertiary)', label: '0 Duties' };
  const ratio = value / max;
  if (ratio < 0.25)  return { bg: 'rgba(22, 184, 151, 0.12)', text: '#16B897', label: 'Very Light' };
  if (ratio < 0.5)   return { bg: 'rgba(22, 184, 151, 0.35)', text: '#14a386', label: 'Light' };
  if (ratio < 0.75)  return { bg: 'rgba(22, 184, 151, 0.60)', text: '#f0faf9', label: 'Moderate' };
  if (ratio < 0.9)   return { bg: 'rgba(22, 184, 151, 0.82)', text: '#ffffff', label: 'High' };
  return { bg: '#16B897', text: '#ffffff', label: 'Maximum' };
}

export default function HeatmapPage() {
  const [data, setData] = useState(null);
  const [loadData, setLoadData] = useState(null);
  const [cycles, setCycles] = useState([]);
  const [selectedCycle, setSelectedCycle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('heatmap'); // 'heatmap' | 'load' | 'charts'
  const [searchTerm, setSearchTerm] = useState('');

  const fetchHeatmap = () => {
    setLoading(true);
    Promise.all([
      api.get('/analytics/heatmap'),
      api.get('/exam-cycles'),
    ]).then(([hr, cr]) => {
      setData(hr.data);
      setCycles(cr.data);
      const active = cr.data.find(c => c.status === 'active') || cr.data[0];
      if (active) setSelectedCycle(active.id);
    }).catch(() => toast.error('Failed to load heatmap'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchHeatmap();
  }, []);

  useEffect(() => {
    if (!selectedCycle) return;
    api.get(`/analytics/load/${selectedCycle}`)
      .then(r => setLoadData(r.data))
      .catch(() => {});
  }, [selectedCycle]);

  const faculty = data?.faculty || [];
  const allCycles = data?.cycles || [];
  const matrix = data?.matrix || {};
  const totals = data?.totals || {};

  const filteredFaculty = useMemo(() => {
    return faculty.filter(f => 
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.department.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [faculty, searchTerm]);

  // Compute Statistics
  const totalFaculty = faculty.length;
  const totalDuties = Object.values(totals).reduce((s, v) => s + v, 0);
  const avgDuties = totalFaculty ? totalDuties / totalFaculty : 0;
  
  const overloadedFaculty = faculty.filter(f => (totals[f.id] || 0) > avgDuties * 1.5);
  const underloadedFaculty = faculty.filter(f => (totals[f.id] || 0) < avgDuties * 0.5 && (totals[f.id] || 0) > 0);
  const overloadedCount = overloadedFaculty.length;
  const underloadedCount = underloadedFaculty.length;

  // Fairness Score Calculation (100 - CV * 100)
  let fairnessScore = 100;
  if (totalFaculty > 1 && avgDuties > 0) {
    const variance = faculty.reduce((s, f) => s + Math.pow((totals[f.id] || 0) - avgDuties, 2), 0) / totalFaculty;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / avgDuties;
    fairnessScore = Math.max(0, Math.min(100, Math.round(100 * (1 - cv))));
  }

  // Duty Distribution Bands
  const bands = { '0': 0, '1-2': 0, '3-4': 0, '5+': 0 };
  faculty.forEach(f => {
    const t = totals[f.id] || 0;
    if (t === 0) bands['0']++;
    else if (t <= 2) bands['1-2']++;
    else if (t <= 4) bands['3-4']++;
    else bands['5+']++;
  });

  // Utilization Trend by Cycle (Chronological order)
  const sortedCycles = [...allCycles].reverse();
  const trendData = sortedCycles.map(c => {
    const cycleFacultyDuties = faculty.map(f => matrix[f.id]?.[c.id] || 0);
    const sum = cycleFacultyDuties.reduce((s, v) => s + v, 0);
    const avg = faculty.length ? sum / faculty.length : 0;
    return { name: c.name, avg: Math.round(avg * 10) / 10 };
  });

  // Equity Gauge needle angle
  const gaugeAngle = -90 + (fairnessScore / 100) * 180;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: 0, paddingBottom: 16 }}>
        <div>
          <h1 className="page-title">Faculty Workload Heatmap</h1>
          <p className="page-subtitle">Analyze invigilator workload distribution, rotation equity, and live shift schedules.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Search bar inside header so it works across all tabs */}
          <div className="saas-search-input-wrapper" style={{ width: 220 }}>
            <Search size={12} color="var(--text-tertiary)" strokeWidth={1.5} />
            <input 
              placeholder="Search faculty or dept..." 
              className="saas-search-input" 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
            {searchTerm && <X size={12} color="var(--text-tertiary)" style={{ cursor: 'pointer' }} onClick={() => setSearchTerm('')} />}
          </div>

          {cycles.length > 0 && (
            <select className="select" style={{ fontSize: 12, height: 32, padding: '4px 10px', width: 180, background: 'var(--bg-surface)', border: '1px solid var(--border)' }} value={selectedCycle || ''} onChange={e => setSelectedCycle(e.target.value)}>
              {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}

          <button className="btn btn-ghost btn-sm btn-icon" onClick={fetchHeatmap} title="Reload metrics">
            <RefreshCw size={13} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Row 1: KPI Summary Section */}
      <div className="kpi-grid">
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>Total Invigilators</span>
            <Users size={14} color="#16B897" strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{totalFaculty}</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>Registered faculty members</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>Average Workload</span>
            <Activity size={14} color="#16B897" strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{avgDuties.toFixed(1)}</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>Duties assigned per cycle average</div>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)' }}>Rotation Equity Index</span>
            <Award size={14} color="#16B897" strokeWidth={1.5} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#16B897', fontFamily: 'var(--font-mono)' }}>{fairnessScore}%</div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>Duty equity index score</div>
          </div>
        </div>
      </div>

      {/* View Switcher Tabs Bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: 24, padding: '0 8px' }}>
        {[
          { id: 'heatmap', label: 'Duty Allocation Heatmap' },
          { id: 'load', label: 'Workload Rankings' },
          { id: 'charts', label: 'Rotation Equity Analytics' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            style={{
              padding: '12px 4px',
              fontSize: 13,
              fontWeight: 600,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: view === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderBottom: view === tab.id ? '2px solid #16B897' : '2px solid transparent',
              transition: 'all 0.12s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Row 2: Bottom Primary Content Area */}
      <div className="card" style={{ padding: 24 }}>
        {view === 'heatmap' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Duty Allocation Density Matrix</h3>
                <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Faculty supervision records mapped across active and archived exam cycles.</p>
              </div>
              <div className="flex-row" style={{ gap: 12, alignItems: 'center' }}>
                <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>Density:</span>
                {[
                  { label: '0', bg: 'rgba(22, 184, 151, 0.02)' },
                  { label: 'Low', bg: 'rgba(22, 184, 151, 0.12)' },
                  { label: 'Mod', bg: 'rgba(22, 184, 151, 0.35)' },
                  { label: 'High', bg: 'rgba(22, 184, 151, 0.60)' },
                  { label: 'Max', bg: '#16B897' },
                ].map(l => (
                  <div key={l.label} className="flex-row" style={{ gap: 4, alignItems: 'center' }}>
                    <div style={{ width: 10, height: 10, background: l.bg, borderRadius: 2, border: '1px solid var(--border)' }} />
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {filteredFaculty.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: 13 }}>
                No faculty members match the search term.
              </div>
            ) : (
              <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
                <table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '12px 16px', textAlign: 'left', background: 'var(--bg-surface)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 11, borderRight: '1px solid var(--border)' }}>
                        Faculty Member
                      </th>
                      {allCycles.map(c => (
                        <th key={c.id} style={{ padding: '12px 14px', textAlign: 'center', background: 'var(--bg-surface)', color: 'var(--text-secondary)', fontWeight: 600, fontSize: 11, borderRight: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                          {c.name}
                        </th>
                      ))}
                      <th style={{ padding: '12px 16px', textAlign: 'center', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 11 }}>
                        All Cycles Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFaculty.map((f) => {
                      const total = totals[f.id] || 0;
                      const totalStyle = heatColor(total, avgDuties * 2);
                      return (
                        <tr key={f.id} style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-base)' }}>
                          <td style={{ padding: '12px 16px', borderRight: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-primary)' }}>{f.name}</div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-secondary)' }}>{f.department}</div>
                          </td>
                          {allCycles.map(c => {
                            const val = matrix[f.id]?.[c.id] || 0;
                            const style = heatColor(val, avgDuties * 2);
                            return (
                              <td key={c.id} style={{ padding: '12px 14px', textAlign: 'center', background: style.bg, borderRight: '1px solid var(--border)' }}>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: val > 0 ? 700 : 400, color: style.text }}>
                                  {val || '—'}
                                </span>
                              </td>
                            );
                          })}
                          <td style={{ padding: '12px 16px', textAlign: 'center', background: totalStyle.bg }}>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: totalStyle.text }}>{total}</div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {view === 'load' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Faculty Workload Rankings</h3>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Workload rankings for the selected cycle. Highlights overloaded and underloaded supervisors.</p>
            </div>

            {filteredFaculty.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: 13 }}>
                No faculty members match the filters.
              </div>
            ) : (
              <div className="table-wrap">
                <table style={{ minWidth: '100%' }}>
                  <thead>
                    <tr>
                      <th>Faculty Member</th>
                      <th>Department</th>
                      <th>Selected Cycle Duties</th>
                      <th>Total Cumulative Duties</th>
                      <th>Load Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredFaculty.map(f => {
                      const total = totals[f.id] || 0;
                      const activeCycleCount = selectedCycle ? (matrix[f.id]?.[selectedCycle] || 0) : 0;
                      
                      const isOver = total > avgDuties * 1.5;
                      const isUnder = total < avgDuties * 0.5 && total > 0;
                      const loadText = total === 0 ? 'Inactive' : isOver ? 'Overloaded' : isUnder ? 'Underloaded' : 'Optimal';
                      const loadBadgeClass = total === 0 ? 'badge-neutral' : isOver ? 'badge-red' : isUnder ? 'badge-amber' : 'badge-green';

                      return (
                        <tr key={f.id}>
                          <td><div style={{ fontWeight: 600, fontSize: 12 }}>{f.name}</div></td>
                          <td><div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{f.department}</div></td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{activeCycleCount} duties</td>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600 }}>{total} duties</td>
                          <td>
                            <span className={`badge ${loadBadgeClass}`} style={{ fontSize: 9 }}>
                              {loadText}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {view === 'charts' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Workload Equity & Rotation Trends</h3>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>Analysis of load balance fairness and trends across cycles.</p>
            </div>

            <div className="grid-2" style={{ gap: 24 }}>
              {/* Workload Shift Trend Chart */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Average Assigned Duties Trend</h4>
                {trendData.length > 0 ? (
                  <div style={{ position: 'relative', height: 160 }}>
                    <svg viewBox="0 0 400 120" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                      <defs>
                        <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#16B897" stopOpacity="0.2"/>
                          <stop offset="100%" stopColor="#16B897" stopOpacity="0"/>
                        </linearGradient>
                      </defs>
                      <line x1="0" y1="30" x2="400" y2="30" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3,3" />
                      <line x1="0" y1="60" x2="400" y2="60" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3,3" />
                      <line x1="0" y1="90" x2="400" y2="90" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3,3" />
                      {(() => {
                        const points = trendData.map((d, i) => {
                          const x = (i / (trendData.length - 1 || 1)) * 380 + 10;
                          const maxVal = Math.max(1, ...trendData.map(v => v.avg));
                          const y = 100 - (d.avg / maxVal) * 80;
                          return { x, y };
                        });
                        if (points.length === 0) return null;
                        const dLine = `M ${points.map(p => `${p.x} ${p.y}`).join(' L ')}`;
                        const dArea = `${dLine} L ${points[points.length - 1].x} 100 L ${points[0].x} 100 Z`;
                        return (
                          <>
                            <path d={dArea} fill="url(#trendGrad)" />
                            <path d={dLine} fill="none" stroke="#16B897" strokeWidth="2" />
                            {points.map((p, i) => (
                              <g key={i}>
                                <circle cx={p.x} cy={p.y} r="4" fill="var(--bg-base)" stroke="#16B897" strokeWidth="2" />
                                <text x={p.x} y={p.y - 8} fontSize="7.5" fill="var(--text-secondary)" textAnchor="middle" fontFamily="var(--font-mono)">
                                  {trendData[i].avg}
                                </text>
                                <text x={p.x} y="115" fontSize="7" fill="var(--text-tertiary)" textAnchor="middle">
                                  {trendData[i].name.length > 8 ? trendData[i].name.slice(0, 8) + '..' : trendData[i].name}
                                </text>
                              </g>
                            ))}
                          </>
                        );
                      })()}
                    </svg>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160, border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-tertiary)', fontSize: 11, fontStyle: 'italic' }}>
                    No historical trend data.
                  </div>
                )}
              </div>

              {/* Workload Equity Speedometer */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', width: '100%' }}>Rotation Equity Dial</h4>
                <div style={{ position: 'relative', width: 200, height: 130, display: 'flex', justifyContent: 'center' }}>
                  <svg width="200" height="120" viewBox="0 0 100 60" style={{ overflow: 'visible' }}>
                    <path d="M 10 50 A 40 40 0 0 1 50 10" fill="none" stroke="rgba(239, 68, 68, 0.2)" strokeWidth="6" />
                    <path d="M 50 10 A 40 40 0 0 1 82 26" fill="none" stroke="rgba(245, 158, 11, 0.2)" strokeWidth="6" />
                    <path d="M 82 26 A 40 40 0 0 1 90 50" fill="none" stroke="rgba(22, 184, 151, 0.2)" strokeWidth="6" />
                    {fairnessScore < 60 && (
                      <path d={`M 10 50 A 40 40 0 0 1 ${50 - 40 * Math.cos((fairnessScore / 60) * Math.PI * 0.5)} ${50 - 40 * Math.sin((fairnessScore / 60) * Math.PI * 0.5)}`} fill="none" stroke="#EF4444" strokeWidth="6" />
                    )}
                    {fairnessScore >= 60 && fairnessScore < 80 && (
                      <>
                        <path d="M 10 50 A 40 40 0 0 1 50 10" fill="none" stroke="#EF4444" strokeWidth="6" />
                        <path d={`M 50 10 A 40 40 0 0 1 ${50 + 40 * Math.sin(((fairnessScore - 60) / 20) * Math.PI * 0.2)} ${10 + 40 * (1 - Math.cos(((fairnessScore - 60) / 20) * Math.PI * 0.2))}`} fill="none" stroke="#F59E0B" strokeWidth="6" />
                      </>
                    )}
                    {fairnessScore >= 80 && (
                      <>
                        <path d="M 10 50 A 40 40 0 0 1 50 10" fill="none" stroke="#EF4444" strokeWidth="6" />
                        <path d="M 50 10 A 40 40 0 0 1 82 26" fill="none" stroke="#F59E0B" strokeWidth="6" />
                        <path d={`M 82 26 A 40 40 0 0 1 ${82 + 8 * Math.sin(((fairnessScore - 80) / 20) * Math.PI * 0.2)} ${26 + 24 * Math.sin(((fairnessScore - 80) / 20) * Math.PI * 0.2)}`} fill="none" stroke="#16B897" strokeWidth="6" />
                      </>
                    )}
                    <circle cx="50" cy="50" r="3" fill="#FFFFFF" />
                    <g transform={`rotate(${gaugeAngle} 50 50)`}>
                      <line x1="50" y1="50" x2="50" y2="15" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
                      <polygon points="48,50 52,50 50,12" fill="#FFFFFF" />
                    </g>
                  </svg>
                  <div style={{ position: 'absolute', bottom: 0, textAlign: 'center' }}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      {fairnessScore}%
                    </span>
                    <div style={{ fontSize: 8.5, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 2 }}>
                      {fairnessScore >= 80 ? 'Optimal Rotation' : fairnessScore >= 60 ? 'Moderate Skew' : 'Highly Unbalanced'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
