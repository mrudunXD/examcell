import { useState, useEffect } from 'react';
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
  Scale
} from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';
import { formatDate } from '../lib/format.js';

export default function HistoricalAnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'trends', 'equity'

  useEffect(() => {
    setLoading(true);
    api.get('/analytics/historical')
      .then(res => {
        setData(res.data);
      })
      .catch(err => {
        toast.error('Failed to load historical analytics data');
        console.error(err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

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
        <BarChart3 size={48} strokeWidth={1} style={{ margin: '0 auto 16px', color: '#A3A3A3' }} />
        <h2 className="font-serif" style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>No Historical Data Available</h2>
        <p style={{ fontSize: 13, color: '#737373', maxWidth: 400, margin: '0 auto' }}>
          Execute optimization solver runs within your exam cycles to generate historical telemetry and track performance.
        </p>
      </div>
    );
  }

  const { cycles, overall } = data;
  const successRate = overall.totalRuns > 0 ? Math.round((overall.successRuns / overall.totalRuns) * 100) : 100;

  // Render SVG Chart for trends
  const renderTrendsChart = (metricKey, label, color) => {
    const chartCycles = [...cycles].reverse(); // oldest to newest
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
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: '#737373' }}>
            {chartCycles.length} Cycles Evaluated
          </span>
        </div>
        <div style={{ position: 'relative', overflowX: 'auto' }}>
          <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} style={{ border: '1px solid #E5E5E0' }}>
            {/* Grid Lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((p, index) => {
              const y = padding + p * (height - padding * 2);
              const val = Math.round(maxVal * (1 - p));
              return (
                <g key={index}>
                  <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#E5E5E0" strokeDasharray="3,3" />
                  <text x={padding - 8} y={y + 4} textAnchor="end" style={{ fontSize: 8, fontFamily: 'var(--font-mono)', fill: '#737373' }}>
                    {val}
                  </text>
                </g>
              );
            })}

            {/* Line path */}
            {points.length > 1 && (
              <path
                d={`M ${points.map(p => `${p.x} ${p.y}`).join(' L ')}`}
                fill="none"
                stroke={color}
                strokeWidth={3}
              />
            )}

            {/* Points & Labels */}
            {points.map((p, index) => (
              <g key={index}>
                <circle cx={p.x} cy={p.y} r={5} fill={color} stroke="#111111" strokeWidth={1} />
                <text x={p.x} y={p.y - 10} textAnchor="middle" style={{ fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                  {p.val}
                </text>
                <text x={p.x} y={height - padding + 15} textAnchor="middle" transform={`rotate(-15, ${p.x}, ${height - padding + 15})`} style={{ fontSize: 8, fill: '#525252', fontWeight: 600 }}>
                  {p.name.length > 10 ? p.name.substring(0, 10) + '..' : p.name}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    );
  };

  return (
    <div className="fade-in">
      {/* Page header */}
      <div className="page-header">
        <div>
          <div className="accent-bar" style={{ background: 'var(--np-ink)' }} />
          <h1 className="page-title">Historical Analytics</h1>
          <p className="page-subtitle">Multi-cycle performance indicators, workload equity metrics, and solver benchmarks.</p>
        </div>
        <div style={{ display: 'flex', border: '1px solid #111' }}>
          {['overview', 'trends', 'equity'].map(t => (
            <button
              key={t}
              className={`btn btn-sm ${activeTab === t ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveTab(t)}
              style={{ padding: '8px 16px', border: 'none' }}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* Key Metrics Dashboard */}
          <div className="grid-4" style={{ marginBottom: 28 }}>
            <div className="stat-card hard-shadow-hover" style={{ borderTop: '3px solid var(--np-ink)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="stat-card-value">{overall.totalRuns}</div>
                  <div className="stat-card-label">Total Solver Executions</div>
                  <div className="stat-card-sub">{overall.successRuns} successful / {overall.failRuns} failed</div>
                </div>
                <div style={{ border: '1px solid #111', padding: 8, color: 'var(--np-ink)', opacity: 0.6 }}>
                  <Activity size={16} />
                </div>
              </div>
            </div>

            <div className="stat-card hard-shadow-hover" style={{ borderTop: `3px solid ${successRate > 80 ? '#166534' : '#CC0000'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="stat-card-value" style={{ color: successRate > 80 ? '#166534' : '#CC0000' }}>
                    {successRate}%
                  </div>
                  <div className="stat-card-label">Solver Success Rate</div>
                  <div className="stat-card-sub">Infeasibility-free ratio</div>
                </div>
                <div style={{ border: '1px solid #111', padding: 8, color: 'var(--np-ink)', opacity: 0.6 }}>
                  {successRate > 80 ? <CheckCircle2 size={16} color="#166534" /> : <XCircle size={16} color="#CC0000" />}
                </div>
              </div>
            </div>

            <div className="stat-card hard-shadow-hover" style={{ borderTop: '3px solid #1d4ed8' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="stat-card-value" style={{ color: '#1d4ed8' }}>
                    {(overall.avgDuration / 1000).toFixed(2)}s
                  </div>
                  <div className="stat-card-label">Average Solve Duration</div>
                  <div className="stat-card-sub">Google OR-Tools benchmark</div>
                </div>
                <div style={{ border: '1px solid #111', padding: 8, color: 'var(--np-ink)', opacity: 0.6 }}>
                  <Clock size={16} />
                </div>
              </div>
            </div>

            <div className="stat-card hard-shadow-hover" style={{ borderTop: '3px solid #92400e' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div className="stat-card-value" style={{ color: '#92400e' }}>
                    {overall.totalIncidents}
                  </div>
                  <div className="stat-card-label">All-Time Incidents</div>
                  <div className="stat-card-sub">Malpractices & disturbances</div>
                </div>
                <div style={{ border: '1px solid #111', padding: 8, color: 'var(--np-ink)', opacity: 0.6 }}>
                  <ShieldAlert size={16} />
                </div>
              </div>
            </div>
          </div>

          {/* Historical Cycles Matrix */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', border: '2px solid #111', marginBottom: 24 }}>
            <div style={{ padding: '16px 20px', borderBottom: '2px solid #111', background: '#FFFFFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="font-serif" style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                Aggregated Exam Cycle Statistics
              </h3>
              <span className="badge badge-ink" style={{ fontSize: 9 }}>
                {cycles.length} Cycles Registered
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#F5F5F5', borderBottom: '1px solid #111' }}>
                    <th style={{ padding: '12px 16px', fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>Cycle Name</th>
                    <th style={{ padding: '12px 16px', fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>Status</th>
                    <th style={{ padding: '12px 16px', fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', textAlign: 'right' }}>Slots</th>
                    <th style={{ padding: '12px 16px', fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', textAlign: 'right' }}>Seated Students</th>
                    <th style={{ padding: '12px 16px', fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', textAlign: 'right' }}>Classrooms</th>
                    <th style={{ padding: '12px 16px', fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', textAlign: 'right' }}>Conflicts</th>
                    <th style={{ padding: '12px 16px', fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', textAlign: 'right' }}>Incidents</th>
                    <th style={{ padding: '12px 16px', fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', textAlign: 'right' }}>Optimization Score</th>
                    <th style={{ padding: '12px 16px', fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', textAlign: 'right' }}>Avg Solve Time</th>
                  </tr>
                </thead>
                <tbody>
                  {cycles.map((c, idx) => (
                    <tr key={c.id} style={{ borderBottom: idx < cycles.length - 1 ? '1px solid #E5E5E0' : 'none', background: '#FFF' }}>
                      <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 700 }}>
                        {c.name}
                        <div style={{ fontSize: 9, color: '#737373', fontWeight: 500, fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                          {formatDate(c.startDate)} to {formatDate(c.endDate)}
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span className={`badge ${c.status === 'active' ? 'badge-ink' : 'badge-ghost'}`} style={{ textTransform: 'uppercase', fontSize: 8 }}>
                          {c.status}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 13, fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{c.totalSlots}</td>
                      <td style={{ padding: '14px 16px', fontSize: 13, fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{c.totalSeated}</td>
                      <td style={{ padding: '14px 16px', fontSize: 13, fontFamily: 'var(--font-mono)', textAlign: 'right' }}>{c.totalRooms}</td>
                      <td style={{ padding: '14px 16px', fontSize: 13, fontFamily: 'var(--font-mono)', textAlign: 'right', fontWeight: 700, color: c.totalConflicts > 0 ? '#CC0000' : 'inherit' }}>
                        {c.totalConflicts}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 13, fontFamily: 'var(--font-mono)', textAlign: 'right', color: c.totalIncidents > 0 ? '#92400e' : 'inherit' }}>
                        {c.totalIncidents}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 13, fontFamily: 'var(--font-mono)', textAlign: 'right', fontWeight: 700 }}>
                        {c.avgOptimizationScore || '—'}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 13, fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
                        {c.avgSolveDurationMs ? `${(c.avgSolveDurationMs / 1000).toFixed(2)}s` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Trends Tab */}
      {activeTab === 'trends' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 24 }}>
          <div className="grid-2" style={{ gap: 20 }}>
            {renderTrendsChart('avgOptimizationScore', 'Optimization Score', '#166534')}
            {renderTrendsChart('avgSolveDurationMs', 'Solve Duration (ms)', '#1d4ed8')}
          </div>
          <div className="grid-2" style={{ gap: 20 }}>
            {renderTrendsChart('totalSeated', 'Seated Students Volume', '#CC0000')}
            {renderTrendsChart('totalConflicts', 'Unresolved Conflict Incidences', '#92400e')}
          </div>
        </div>
      )}

      {/* Equity Tab */}
      {activeTab === 'equity' && (
        <div className="grid-2" style={{ gap: 20, marginBottom: 24 }}>
          {/* Workload Balance overview */}
          <div className="card" style={{ padding: 20, border: '2px solid #111', background: '#FFF' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Scale size={20} />
              <h3 className="font-serif" style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>
                Faculty Workload Balance Equity
              </h3>
            </div>
            <p style={{ fontSize: 13, color: '#525252', marginBottom: 20 }}>
              The load balancing index reflects the equity in duty rotations. A lower range (difference between maximum and minimum duties) signifies better equity and prevents supervisor fatigue.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {cycles.map(c => {
                const range = c.maxDuties - c.minDuties;
                const equityScore = c.maxDuties > 0 ? Math.max(0, 100 - (range * 20)) : 100;
                
                return (
                  <div key={c.id} style={{ padding: '12px 14px', border: '1px solid #E5E5E0', background: '#F9F9F7' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{c.name}</span>
                      <span className="badge badge-ink" style={{ fontSize: 9, fontFamily: 'var(--font-mono)' }}>
                        Equity Index: {equityScore}%
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, textAlign: 'center', marginBottom: 10 }}>
                      <div style={{ borderRight: '1px solid #E5E5E0' }}>
                        <div style={{ fontSize: 10, color: '#737373', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>Min Duties</div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>{c.minDuties}</div>
                      </div>
                      <div style={{ borderRight: '1px solid #E5E5E0' }}>
                        <div style={{ fontSize: 10, color: '#737373', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>Avg Duties</div>
                        <div style={{ fontSize: 16, fontWeight: 700 }}>{c.avgDuties}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: '#737373', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>Max Duties</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: range > 3 ? '#CC0000' : 'inherit' }}>{c.maxDuties}</div>
                      </div>
                    </div>

                    {/* Progress representation */}
                    <div style={{ height: 6, background: '#E5E5E0', position: 'relative' }}>
                      <div 
                        style={{ 
                          position: 'absolute', 
                          left: `${(c.minDuties / (c.maxDuties || 1)) * 100}%`, 
                          right: `${100 - 100}%`,
                          width: `${((c.maxDuties - c.minDuties) / (c.maxDuties || 1)) * 100}%`,
                          height: '100%', 
                          background: equityScore > 75 ? '#166534' : equityScore > 50 ? '#92400e' : '#CC0000'
                        }} 
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8, color: '#A3A3A3', marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                      <span>MIN LOAD ({c.minDuties})</span>
                      <span>MAX LOAD ({c.maxDuties})</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Supervisor allocations count analysis */}
          <div className="card" style={{ padding: 20, border: '2px solid #111', background: '#FFF' }}>
            <h3 className="font-serif" style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>
              Rotation Integrity Analysis
            </h3>
            <p style={{ fontSize: 13, color: '#525252', marginBottom: 20 }}>
              Audit details regarding active supervisor engagement and total duty execution across cycles.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {cycles.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E5E5E0', paddingBottom: 10 }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{c.name}</span>
                    <div style={{ fontSize: 10, color: '#737373', marginTop: 2 }}>
                      {c.assignedFacultyCount} distinct invigilators assigned
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      {c.totalDuties}
                    </span>
                    <div style={{ fontSize: 9, color: '#737373', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
                      Total Duties
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div style={{ marginTop: 24, padding: 12, border: '1px solid #111', background: '#F5F5F5', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2, color: '#92400e' }} />
              <div style={{ fontSize: 11, color: '#525252' }}>
                <strong>Recommendation:</strong> Ensure that the load balancing difference (Max - Min) stays below 3 duties. High variance indicate possible rule bias or constraint overrides that skew supervisor fairness.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
