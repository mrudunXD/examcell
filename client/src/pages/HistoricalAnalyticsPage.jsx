import { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  AlertTriangle, 
  Activity, 
  Users, 
  ShieldAlert, 
  Calendar, 
  Layers, 
  CheckCircle2, 
  XCircle,
  HelpCircle,
  Scale,
  Award,
  Search,
  X,
  RefreshCw
} from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';
import { formatDate } from '../lib/format.js';

export default function HistoricalAnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'trends', 'workload', 'heatmap'

  // Heatmap specific states
  const [heatmapData, setHeatmapData] = useState(null);
  const [heatmapCycles, setHeatmapCycles] = useState([]);
  const [selectedCycle, setSelectedCycle] = useState(null);
  const [heatmapLoadData, setHeatmapLoadData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [heatmapLoading, setHeatmapLoading] = useState(false);

  const fetchHistorical = async () => {
    try {
      const res = await api.get('/analytics/historical');
      setData(res.data);
    } catch (err) {
      toast.error('Failed to load historical analytics data');
    }
  };

  const fetchHeatmap = async () => {
    setHeatmapLoading(true);
    try {
      const [hr, cr] = await Promise.all([
        api.get('/analytics/heatmap'),
        api.get('/exam-cycles'),
      ]);
      setHeatmapData(hr.data);
      setHeatmapCycles(cr.data);
      const active = cr.data.find(c => c.status === 'active') || cr.data[0];
      if (active) setSelectedCycle(active.id);
    } catch {
      toast.error('Failed to load workload heatmap');
    } finally {
      setHeatmapLoading(false);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([fetchHistorical(), fetchHeatmap()]);
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (!selectedCycle) return;
    api.get(`/analytics/load/${selectedCycle}`)
      .then(r => setHeatmapLoadData(r.data))
      .catch(() => {});
  }, [selectedCycle]);

  // Heatmap density mapping helper
  const heatColor = (value, max) => {
    if (!value || max === 0) return { bg: 'rgba(22, 184, 151, 0.02)', text: 'var(--text-tertiary)', label: '0 Duties' };
    const ratio = value / max;
    if (ratio < 0.25)  return { bg: 'rgba(22, 184, 151, 0.12)', text: '#16B897', label: 'Very Light' };
    if (ratio < 0.5)   return { bg: 'rgba(22, 184, 151, 0.35)', text: '#14a386', label: 'Light' };
    if (ratio < 0.75)  return { bg: 'rgba(22, 184, 151, 0.60)', text: '#f0faf9', label: 'Moderate' };
    if (ratio < 0.9)   return { bg: 'rgba(22, 184, 151, 0.82)', text: '#ffffff', label: 'High' };
    return { bg: '#16B897', text: '#ffffff', label: 'Maximum' };
  };

  const faculty = heatmapData?.faculty || [];
  const allCycles = heatmapData?.cycles || [];
  const matrix = heatmapData?.matrix || {};
  const totals = heatmapData?.totals || {};

  const filteredFaculty = useMemo(() => {
    return faculty.filter(f => 
      f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.department.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [faculty, searchTerm]);

  const totalFaculty = faculty.length;
  const totalDuties = Object.values(totals).reduce((s, v) => s + Number(v || 0), 0);
  const avgDuties = totalFaculty ? totalDuties / totalFaculty : 0;
  
  let fairnessScore = 100;
  if (totalFaculty > 1 && avgDuties > 0) {
    const variance = faculty.reduce((s, f) => s + Math.pow(Number(totals[f.id] || 0) - avgDuties, 2), 0) / totalFaculty;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / avgDuties;
    fairnessScore = Math.max(0, Math.min(100, Math.round(100 * (1 - cv))));
  }

  const sortedCycles = [...allCycles].reverse();
  const trendData = sortedCycles.map(c => {
    const cycleFacultyDuties = faculty.map(f => Number(matrix[f.id]?.[c.id] || 0));
    const sum = cycleFacultyDuties.reduce((s, v) => s + v, 0);
    const avg = faculty.length ? sum / faculty.length : 0;
    return { name: c.name, avg: Math.round(avg * 10) / 10 };
  });

  const gaugeAngle = -90 + (fairnessScore / 100) * 180;

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <div className="spinner" style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  if (!data || !data.cycles || data.cycles.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 64, margin: '24px 0' }}>
        <BarChart3 size={48} strokeWidth={1} style={{ margin: '0 auto 16px', color: '#767680' }} />
        <h2 className="font-serif" style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>No Historical Data Available</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 400, margin: '0 auto' }}>
          Execute optimization solver runs within your exam cycles to generate historical telemetry and track performance.
        </p>
      </div>
    );
  }

  const { cycles, overall } = data;
  const successRate = overall.totalRuns > 0 ? Math.round((overall.successRuns / overall.totalRuns) * 100) : 100;

  const renderTrendsChart = (metricKey, label, color) => {
    const chartCycles = [...cycles].reverse();
    const maxVal = Math.max(...chartCycles.map(c => c[metricKey] || 1)) * 1.15;
    const width = 600;
    const height = 250;
    const padding = 40;
    
    const points = chartCycles.map((c, i) => {
      const x = padding + (i * (width - padding * 2)) / (chartCycles.length - 1 || 1);
      const val = c[metricKey] || 0;
      const y = height - padding - (val * (height - padding * 2)) / maxVal;
      return { x, y, name: c.name, val };
    });

    return (
      <div className="card" style={{ padding: 20, background: '#FFF' }}>
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>
            {label} Trend
          </span>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
            {chartCycles.length} Cycles Evaluated
          </span>
        </div>
        <div style={{ position: 'relative', overflowX: 'auto' }}>
          <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ border: '1px solid var(--border)' }}>
            {[0, 0.25, 0.5, 0.75, 1].map((p, index) => {
              const y = padding + p * (height - padding * 2);
              const val = Math.round(maxVal * (1 - p));
              return (
                <g key={index}>
                  <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="var(--border)" strokeDasharray="3,3" />
                  <text x={padding - 8} y={y + 4} textAnchor="end" style={{ fontSize: 8, fontFamily: 'var(--font-mono)', fill: 'var(--text-secondary)' }}>
                    {val}
                  </text>
                </g>
              );
            })}
            {points.map((p, index) => (
              <text key={index} x={p.x} y={height - padding + 15} textAnchor="middle" style={{ fontSize: 8, fill: 'var(--text-secondary)' }}>
                {p.name.length > 8 ? p.name.slice(0, 8) + '..' : p.name}
              </text>
            ))}
            {points.length > 1 && (
              <polyline
                fill="none"
                stroke={color}
                strokeWidth="2"
                points={points.map(p => `${p.x},${p.y}`).join(' ')}
              />
            )}
            {points.map((p, index) => (
              <g key={index}>
                <circle cx={p.x} cy={p.y} r="4" fill="#FFF" stroke={color} strokeWidth="2" />
                <text x={p.x} y={p.y - 8} textAnchor="middle" style={{ fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700, fill: 'var(--text-primary)' }}>
                  {p.val}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Analytics & Rotation Heatmap
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            Monitor solver performance history, rotation fairness metrics, and active supervisor load densities.
          </p>
        </div>
        {activeTab === 'heatmap' && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div className="saas-search-input-wrapper" style={{ width: 180 }}>
              <Search size={12} color="var(--text-tertiary)" strokeWidth={1.5} />
              <input 
                placeholder="Search name, dept..." 
                className="saas-search-input" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              {searchTerm && <X size={12} color="var(--text-tertiary)" style={{ cursor: 'pointer' }} onClick={() => setSearchTerm('')} />}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={fetchHeatmap} disabled={heatmapLoading}>
              <RefreshCw size={13} strokeWidth={1.5} className={heatmapLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        )}
      </div>

      {/* Tabs list */}
      <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid var(--border)', padding: '0 8px' }}>
        {[
          { id: 'overview', label: 'History Overview' },
          { id: 'trends', label: 'Solver Trends' },
          { id: 'workload', label: 'Supervisor Workloads' },
          { id: 'heatmap', label: 'Allocation Heatmap' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '12px 4px',
              fontSize: 13,
              fontWeight: 600,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === tab.id ? '2px solid var(--text-primary)' : '2px solid transparent',
              transition: 'all 0.12s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Summary KPIs Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                Total Scheduler Runs
                <Activity size={14} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8, fontFamily: 'var(--font-mono)' }}>
                {overall.totalRuns}
              </div>
            </div>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                Solver Success Rate
                <CheckCircle2 size={14} color="#22c55e" />
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8, color: '#22c55e', fontFamily: 'var(--font-mono)' }}>
                {successRate}%
              </div>
            </div>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
                Total Seated Students
                <Users size={14} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8, fontFamily: 'var(--font-mono)' }}>
                {overall.totalStudents}
              </div>
            </div>
          </div>

          {/* Historical Runs Table */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 16px 0' }}>Solver Run Records</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Cycle Name</th>
                    <th>Execution Date</th>
                    <th>Runtime</th>
                    <th>Constraints Verified</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {cycles.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td>{formatDate(c.created_at)}</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{c.runtime_ms} ms</td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{c.conflicts_resolved} verified</td>
                      <td>
                        <span className={`badge ${c.status === 'SUCCESS' ? 'badge-green' : 'badge-red'}`}>
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'trends' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {renderTrendsChart('runtime_ms', 'Solver Runtime (ms)', '#3b82f6')}
          {renderTrendsChart('conflicts_resolved', 'Conflicts Handled', '#ef4444')}
        </div>
      )}

      {activeTab === 'workload' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* Workload Average Trend Chart */}
            <div className="card" style={{ padding: 20, background: '#FFF' }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', marginBottom: 12 }}>
                Average Duties Trend per Cycle
              </h4>
              {trendData.length > 0 ? (
                <div style={{ position: 'relative', height: 160 }}>
                  <svg viewBox="0 0 400 120" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
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
                      return (
                        <>
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

            {/* Rotation Equity Speedometer */}
            <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', width: '100%' }}>
                Rotation Equity Score
              </h4>
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
                  <circle cx="50" cy="50" r="3" fill="var(--border)" />
                  <g transform={`rotate(${gaugeAngle} 50 50)`}>
                    <line x1="50" y1="50" x2="50" y2="15" stroke="var(--text-primary)" strokeWidth="1.5" strokeLinecap="round" />
                    <polygon points="48,50 52,50 50,12" fill="var(--text-primary)" />
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

          {/* Load Rankings Table */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Supervisor Workload Rankings</h3>
              {heatmapCycles.length > 0 && (
                <select className="select" style={{ fontSize: 12, height: 28, padding: '2px 8px', width: 180, background: 'var(--bg-surface)' }} value={selectedCycle || ''} onChange={e => setSelectedCycle(e.target.value)}>
                  {heatmapCycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </div>
            <div className="table-wrap">
              <table>
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
                  {faculty.map(f => {
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
          </div>
        </div>
      )}

      {activeTab === 'heatmap' && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Duty Allocation Density Matrix</h3>
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
    </div>
  );
}
