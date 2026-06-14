import { useState, useEffect } from 'react';
import { RefreshCw, TrendingUp, AlertCircle } from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';

function heatColor(value, max) {
  if (!value || max === 0) return { bg: '#0C0C0E', text: '#D1D5DB' };
  const ratio = value / max;
  if (ratio < 0.25)  return { bg: '#DBEAFE', text: '#1d4ed8' };
  if (ratio < 0.5)   return { bg: '#BBF7D0', text: '#166534' };
  if (ratio < 0.75)  return { bg: '#FDE68A', text: '#92400e' };
  if (ratio < 0.9)   return { bg: '#FED7AA', text: '#c2410c' };
  return { bg: '#FECACA', text: '#FF453A' };
}

export default function HeatmapPage() {
  const [data, setData] = useState(null);
  const [loadData, setLoadData] = useState(null);
  const [cycles, setCycles] = useState([]);
  const [selectedCycle, setSelectedCycle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('heatmap'); // 'heatmap' | 'load'

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (!selectedCycle) return;
    api.get(`/analytics/load/${selectedCycle}`)
      .then(r => setLoadData(r.data))
      .catch(() => {});
  }, [selectedCycle]);

  if (loading) return <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>;

  const faculty = data?.faculty || [];
  const allCycles = data?.cycles || [];
  const matrix = data?.matrix || {};
  const totals = data?.totals || {};

  const maxDuties = Math.max(1, ...Object.values(totals));
  const avg = faculty.length ? Object.values(totals).reduce((s, v) => s + v, 0) / faculty.length : 0;
  const overloaded = faculty.filter(f => (totals[f.id] || 0) > avg * 1.5);
  const underloaded = faculty.filter(f => (totals[f.id] || 0) < avg * 0.5 && (totals[f.id] || 0) > 0);

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          
          <h1 className="page-title">Faculty Duty Heatmap</h1>
          <p className="page-subtitle">Supervision load across all cycles · {faculty.length} faculty</p>
        </div>
        <div className="flex-row" style={{ gap: 8 }}>
          <button
            className={`btn btn-sm ${view === 'heatmap' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setView('heatmap')}
          >Heatmap</button>
          <button
            className={`btn btn-sm ${view === 'load' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setView('load')}
          >Load Balancer</button>
        </div>
      </div>

      {/* Fairness alerts */}
      {overloaded.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#FFF5F5', border: '1px solid #fecaca', marginBottom: 12 }}>
          <AlertCircle size={13} strokeWidth={1.5} color="#FF453A" style={{ flexShrink: 0 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#FF453A' }}>
            Overloaded (&gt;1.5× avg): {overloaded.map(f => f.name).join(', ')}
          </span>
        </div>
      )}
      {underloaded.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#FFFBEB', border: '1px solid #FDE68A', marginBottom: 20 }}>
          <AlertCircle size={13} strokeWidth={1.5} color="#92400e" style={{ flexShrink: 0 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#92400e' }}>
            Underloaded (&lt;0.5× avg): {underloaded.map(f => f.name).join(', ')}
          </span>
        </div>
      )}

      {view === 'heatmap' ? (
        <>
          {/* Legend */}
          <div className="flex-row" style={{ gap: 16, marginBottom: 16, alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--np-n500)' }}>Duty count:</span>
            {[
              { label: '0', bg: '#0C0C0E', text: '#D1D5DB' },
              { label: '1–25%', bg: '#DBEAFE', text: '#1d4ed8' },
              { label: '26–50%', bg: '#BBF7D0', text: '#166534' },
              { label: '51–75%', bg: '#FDE68A', text: '#92400e' },
              { label: '76–90%', bg: '#FED7AA', text: '#c2410c' },
              { label: '91–100%', bg: '#FECACA', text: '#FF453A' },
            ].map(l => (
              <div key={l.label} className="flex-row" style={{ gap: 5, alignItems: 'center' }}>
                <div style={{ width: 14, height: 14, background: l.bg, border: '1px solid #222225' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--np-n500)' }}>{l.label}</span>
              </div>
            ))}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--np-n500)', marginLeft: 'auto' }}>
              Avg: {avg.toFixed(1)} duties/faculty
            </span>
          </div>

          {/* Heatmap table */}
          <div style={{ overflowX: 'auto', border: '1px solid #222225' }}>
            <table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
              <thead>
                <tr>
                  <th style={{ padding: '8px 14px', textAlign: 'left', background: '#111', color: '#0C0C0E', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
                    Faculty
                  </th>
                  {allCycles.map(c => (
                    <th key={c.id} style={{ padding: '8px 12px', textAlign: 'center', background: '#111', color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.08em', whiteSpace: 'nowrap', minWidth: 80, borderRight: '1px solid rgba(255,255,255,0.07)' }}>
                      {c.name.length > 16 ? c.name.slice(0, 16) + '…' : c.name}
                    </th>
                  ))}
                  <th style={{ padding: '8px 12px', textAlign: 'center', background: '#222', color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-mono)', fontSize: 9, whiteSpace: 'nowrap', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                    TOTAL
                  </th>
                </tr>
              </thead>
              <tbody>
                {faculty.map((f, fi) => {
                  const total = totals[f.id] || 0;
                  const totalStyle = heatColor(total, maxDuties);
                  const isOver = total > avg * 1.5;
                  const isUnder = total < avg * 0.5 && total > 0;
                  return (
                    <tr key={f.id}>
                      <td style={{ padding: '8px 14px', borderBottom: '1px solid #222225', borderRight: '1px solid #222225', whiteSpace: 'nowrap', background: fi % 2 === 0 ? '#FDFDFB' : '#FFF' }}>
                        <div style={{ fontWeight: 600, fontSize: 12 }}>{f.name}</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--np-n500)' }}>{f.department}</div>
                      </td>
                      {allCycles.map(c => {
                        const val = matrix[f.id]?.[c.id] || 0;
                        const style = heatColor(val, maxDuties);
                        return (
                          <td key={c.id} style={{ padding: '8px 12px', textAlign: 'center', background: style.bg, borderBottom: '1px solid #222225', borderRight: '1px solid #222225', transition: 'background 0.2s' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: val > 0 ? 700 : 400, color: style.text }}>
                              {val || '—'}
                            </span>
                          </td>
                        );
                      })}
                      <td style={{ padding: '8px 12px', textAlign: 'center', background: totalStyle.bg, borderBottom: '1px solid #222225', borderLeft: '1px solid #222225' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 800, color: totalStyle.text }}>{total}</div>
                        {isOver && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: '#FF453A', textTransform: 'uppercase', marginTop: 1 }}>Overloaded</div>}
                        {isUnder && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: '#92400e', textTransform: 'uppercase', marginTop: 1 }}>Underused</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        /* Load Balancer View */
        <div>
          <div className="flex-row" style={{ gap: 10, marginBottom: 20, alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--np-n500)' }}>Cycle:</span>
            <select className="select" style={{ fontSize: 11, padding: '4px 8px' }} value={selectedCycle || ''} onChange={e => setSelectedCycle(e.target.value)}>
              {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--np-n500)', marginLeft: 'auto' }}>
              Avg duties: {loadData?.avg || 0}
            </span>
          </div>

          {loadData?.loads.map(faculty => {
            const pct = loadData.avg > 0 ? Math.min(100, Math.round((faculty.duty_count / (loadData.avg * 2)) * 100)) : 0;
            const isHigh = faculty.duty_count > loadData.avg * 1.3;
            const isLow = faculty.duty_count < loadData.avg * 0.5;
            const barColor = isHigh ? '#FF453A' : isLow ? '#92400e' : '#166534';
            return (
              <div key={faculty.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid #222225' }}>
                <div style={{ width: 180, minWidth: 180 }}>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>{faculty.name}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--np-n500)' }}>{faculty.department}</div>
                </div>
                <div style={{ flex: 1, position: 'relative' }}>
                  <div style={{ height: 24, background: '#F5F5F0', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: barColor, transition: 'width 0.5s', opacity: 0.85 }} />
                    {/* Average line */}
                    <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: '#111', opacity: 0.3 }} />
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'center', paddingLeft: 8 }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: faculty.duty_count > 0 ? 'white' : 'var(--np-n400)', mixBlendMode: 'difference' }}>
                        {faculty.duty_count} duties · {faculty.exam_days} days
                      </span>
                    </div>
                  </div>
                </div>
                <div style={{ width: 80, textAlign: 'right' }}>
                  {isHigh && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#FF453A', textTransform: 'uppercase', border: '1px solid #fecaca', padding: '2px 6px' }}>High</span>}
                  {isLow && faculty.duty_count > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#92400e', textTransform: 'uppercase', border: '1px solid #FDE68A', padding: '2px 6px' }}>Low</span>}
                  {faculty.duty_count === 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--np-n400)' }}>None</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}









