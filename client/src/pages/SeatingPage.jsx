import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Play, CheckCircle, Unlock, ArrowLeftRight, AlertTriangle, RefreshCw } from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';

function BenchSeat({ seat, onSwapSelect, swapSource, isSwapMode }) {
  if (!seat) return <div className="bench-seat empty">—</div>;
  const isSource = swapSource?.id === seat.id;
  return (
    <div
      className="bench-seat"
      style={{
        background: isSource ? 'rgba(59,130,246,0.2)' : 'var(--color-surface)',
        border: `1px solid ${isSource ? 'rgba(59,130,246,0.6)' : 'var(--color-border)'}`,
        cursor: isSwapMode ? 'pointer' : 'default'
      }}
      onClick={() => isSwapMode && onSwapSelect(seat)}
      title={`${seat.student_name} (${seat.branch} ${seat.year})`}
    >
      <div className="seat-name">{seat.student_name}</div>
      <div className="seat-prn">PRN: {seat.prn}</div>
      <div className="seat-roll">Roll: {seat.roll_no}</div>
      <div className="seat-branch">
        <span className={`badge badge-${seat.year.toLowerCase()}`} style={{ fontSize: 8, padding: '1px 4px' }}>{seat.year}</span>
        {' '}{seat.branch}
      </div>
    </div>
  );
}

export default function SeatingPage() {
  const { slotId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [isSwapMode, setIsSwapMode] = useState(false);
  const [swapSource, setSwapSource] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);

  const fetchSeating = async () => {
    setLoading(true);
    try {
      const { data: d } = await api.get(`/seating/${slotId}`);
      setData(d);
      if (d.rooms.length > 0) setSelectedRoom(d.rooms[0].room.id);
    } catch { toast.error('Failed to load seating'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchSeating(); }, [slotId]);

  const generate = async () => {
    setGenerating(true);
    try {
      const { data: result } = await api.post(`/seating/generate/${slotId}`);
      toast.success(result.message);
      if (result.conflicts?.length > 0) {
        toast('⚠ Some conflicts were detected — check conflict panel', { icon: '⚠️' });
      }
      fetchSeating();
    } catch (err) { toast.error(err.response?.data?.error || 'Generation failed'); }
    finally { setGenerating(false); }
  };

  const approve = async () => {
    setApproving(true);
    try {
      await api.post(`/seating/approve/${slotId}`);
      toast.success('Seating plan approved and finalised! ✅');
      fetchSeating();
    } catch (err) { toast.error(err.response?.data?.error || 'Cannot approve'); }
    finally { setApproving(false); }
  };

  const unlock = async () => {
    try {
      await api.post(`/seating/unlock/${slotId}`);
      toast.success('Seating plan unlocked for editing');
      fetchSeating();
    } catch { toast.error('Failed to unlock'); }
  };

  const handleSwapSelect = async (seat) => {
    if (!swapSource) { setSwapSource(seat); return; }
    if (swapSource.id === seat.id) { setSwapSource(null); return; }
    try {
      await api.put('/seating/swap', { assignment_id_1: swapSource.id, assignment_id_2: seat.id });
      toast.success(`Swapped ${swapSource.student_name} ↔ ${seat.student_name}`);
      setSwapSource(null);
      setIsSwapMode(false);
      fetchSeating();
    } catch { toast.error('Swap failed'); }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>;
  if (!data) return null;

  const { slot, rooms } = data;
  const isApproved = slot.status === 'finalised';
  const hasSeating = rooms.some(r => r.assignments.length > 0);

  const currentRoom = rooms.find(r => r.room.id === selectedRoom);

  // Build grid from assignments
  const buildGrid = (room, assignments) => {
    const grid = {};
    for (const a of assignments) {
      if (!grid[a.bench_row]) grid[a.bench_row] = {};
      grid[a.bench_row][a.bench_col] = a;
    }
    return { grid, rows: room.bench_rows, cols: room.bench_cols };
  };

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="flex-row" style={{ gap: 8, marginBottom: 6 }}>
            <Link to="/exam-cycles" className="btn btn-ghost btn-sm"><ArrowLeft size={13} /></Link>
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Exam Cycles</span>
          </div>
          <h1>Seating Arrangement</h1>
          <p>{slot.subject_code} — {slot.subject_name} · {slot.date} at {slot.start_time}</p>
        </div>
        <div className="flex-row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={fetchSeating}><RefreshCw size={14} /></button>
          {!isApproved && (
            <>
              <button className="btn btn-primary" onClick={generate} disabled={generating}>
                {generating ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Generating…</> : <><Play size={14} /> Generate Seating</>}
              </button>
              {hasSeating && (
                <>
                  <button
                    className={`btn ${isSwapMode ? 'btn-warning' : 'btn-ghost'}`}
                    onClick={() => { setIsSwapMode(!isSwapMode); setSwapSource(null); }}
                  >
                    <ArrowLeftRight size={14} /> {isSwapMode ? (swapSource ? 'Select 2nd seat…' : 'Click to swap…') : 'Swap Seats'}
                  </button>
                  <button className="btn btn-success" onClick={approve} disabled={approving}>
                    {approving ? <div className="spinner" style={{ width: 14, height: 14 }} /> : <><CheckCircle size={14} /> Approve & Finalise</>}
                  </button>
                </>
              )}
            </>
          )}
          {isApproved && (
            <button className="btn btn-warning" onClick={unlock}>
              <Unlock size={14} /> Unlock for Editing
            </button>
          )}
        </div>
      </div>

      {/* Status */}
      <div className="flex-row" style={{ marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div className="card" style={{ padding: '10px 16px', flex: 1, minWidth: 120 }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Status</div>
          <div style={{ fontWeight: 700, textTransform: 'capitalize', color: isApproved ? 'var(--color-success)' : 'var(--color-accent)' }}>
            {isApproved ? '✅ Finalised' : slot.status?.replace(/_/g, ' ')}
          </div>
        </div>
        <div className="card" style={{ padding: '10px 16px', flex: 1, minWidth: 120 }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Rooms</div>
          <div style={{ fontWeight: 700 }}>{rooms.length}</div>
        </div>
        <div className="card" style={{ padding: '10px 16px', flex: 1, minWidth: 120 }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Total Seated</div>
          <div style={{ fontWeight: 700 }}>{rooms.reduce((sum, r) => sum + r.assignments.length, 0)}</div>
        </div>
        {isSwapMode && (
          <div className="alert alert-warning" style={{ flex: 2 }}>
            <ArrowLeftRight size={14} />
            {swapSource ? `Selected: ${swapSource.student_name} — now click the target seat` : 'Click a seat to start swap'}
          </div>
        )}
      </div>

      {!hasSeating && (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <Play size={40} color="var(--color-text-muted)" style={{ margin: '0 auto 14px' }} />
          <h3>No Seating Generated Yet</h3>
          <p className="text-muted" style={{ fontSize: 13, margin: '8px 0 20px' }}>
            Click "Generate Seating" to auto-assign students to benches.
          </p>
          <button className="btn btn-primary" onClick={generate} disabled={generating}>
            {generating ? 'Generating…' : 'Generate Seating'}
          </button>
        </div>
      )}

      {hasSeating && (
        <>
          {/* Room tabs */}
          <div className="flex-row" style={{ gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {rooms.map(r => (
              <button key={r.room.id} className={`btn btn-sm ${selectedRoom === r.room.id ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setSelectedRoom(r.room.id)}>
                {r.room.room_no} ({r.assignments.length} seated)
              </button>
            ))}
          </div>

          {currentRoom && (() => {
            const { grid, rows, cols } = buildGrid(currentRoom.room, currentRoom.assignments);
            return (
              <div className="card">
                <div className="flex-between" style={{ marginBottom: 14 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>Room {currentRoom.room.room_no} — {currentRoom.room.block}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {currentRoom.room.bench_rows} rows × {currentRoom.room.bench_cols} cols · capacity {currentRoom.room.capacity}
                    </div>
                  </div>
                  <div className="flex-row" style={{ gap: 12, fontSize: 12, color: 'var(--color-text-muted)' }}>
                    <span style={{ color: 'var(--color-success)' }}>● {currentRoom.assignments.length} seated</span>
                    <span>○ {currentRoom.room.capacity - currentRoom.assignments.length} empty</span>
                  </div>
                </div>

                {/* Front of class label */}
                <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 10,
                  borderBottom: '2px solid var(--color-border)', paddingBottom: 8 }}>
                  ▼ Front of Class / Blackboard ▼
                </div>

                <div className="bench-grid">
                  {Array.from({ length: rows }, (_, rowIdx) => (
                    <div key={rowIdx} className="bench-row-grid">
                      <div className="bench-row-label">Row {rowIdx + 1}</div>
                      {Array.from({ length: cols }, (_, colIdx) => (
                        <BenchSeat
                          key={colIdx}
                          seat={grid[rowIdx + 1]?.[colIdx + 1] || null}
                          onSwapSelect={handleSwapSelect}
                          swapSource={swapSource}
                          isSwapMode={isSwapMode}
                        />
                      ))}
                    </div>
                  ))}
                </div>

                {/* Student list */}
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Student List</div>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Row</th><th>Col</th><th>Name</th><th>PRN</th><th>Roll No</th><th>Branch</th><th>Year</th></tr></thead>
                      <tbody>
                        {currentRoom.assignments.map(a => (
                          <tr key={a.id}>
                            <td>{a.bench_row}</td><td>{a.bench_col}</td>
                            <td style={{ fontWeight: 600 }}>{a.student_name}</td>
                            <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{a.prn}</td>
                            <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--color-accent)' }}>{a.roll_no}</td>
                            <td>{a.branch}</td>
                            <td><span className={`badge badge-${a.year.toLowerCase()}`}>{a.year}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
