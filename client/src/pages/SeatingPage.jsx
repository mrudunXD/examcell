import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Play, CheckCircle, Unlock, ArrowLeftRight, RefreshCw } from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';

function BenchSeat({ seat, onSwapSelect, swapSource, isSwapMode }) {
  if (!seat) {
    return (
      <div className="bench-seat empty" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--np-n400)' }}>empty</span>
      </div>
    );
  }

  const isSource = swapSource?.id === seat.id;
  return (
    <div
      className="bench-seat"
      style={{
        background: isSource ? '#111111' : 'var(--np-bg)',
        borderColor: isSource ? '#111111' : '#E5E5E0',
        cursor: isSwapMode ? 'pointer' : 'default',
      }}
      onClick={() => isSwapMode && onSwapSelect(seat)}
      title={`${seat.student_name} · ${seat.prn} · ${seat.roll_no} · ${seat.branch} ${seat.year}`}
    >
      <div className="seat-name" style={{ color: isSource ? '#F9F9F7' : '#111111' }}>{seat.student_name}</div>
      <div className="seat-prn" style={{ color: isSource ? 'rgba(255,255,255,0.5)' : undefined }}>PRN: {seat.prn}</div>
      <div className="seat-roll" style={{ color: isSource ? '#fca5a5' : undefined }}>Roll: {seat.roll_no}</div>
      <div className="seat-branch">
        <span className={`badge badge-${seat.year.toLowerCase()}`} style={{ fontSize: 7, padding: '0 3px' }}>{seat.year}</span>
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
      if (d.rooms.length > 0 && !selectedRoom) setSelectedRoom(d.rooms[0].room.id);
    } catch { toast.error('Failed to load seating'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchSeating(); }, [slotId]);

  const generate = async () => {
    setGenerating(true);
    try {
      const { data: result } = await api.post(`/seating/generate/${slotId}`);
      toast.success(result.message);
      if (result.conflicts?.length > 0) toast('Conflicts detected — check the Conflicts tab', { icon: '!' });
      fetchSeating();
    } catch (err) { toast.error(err.response?.data?.error || 'Generation failed'); }
    finally { setGenerating(false); }
  };

  const approve = async () => {
    setApproving(true);
    try {
      await api.post(`/seating/approve/${slotId}`);
      toast.success('Seating plan approved and finalised');
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
      toast.success(`Swapped: ${swapSource.student_name} — ${seat.student_name}`);
      setSwapSource(null); setIsSwapMode(false); fetchSeating();
    } catch { toast.error('Swap failed'); }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>;
  if (!data) return null;

  const { slot, rooms } = data;
  const isApproved = slot.status === 'finalised';
  const hasSeating = rooms.some(r => r.assignments.length > 0);
  const currentRoom = rooms.find(r => r.room.id === selectedRoom);

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
          <div className="flex-row" style={{ gap: 6, marginBottom: 8 }}>
            <Link to="/exam-cycles" className="btn btn-ghost btn-sm">
              <ArrowLeft size={12} strokeWidth={1.5} /> Cycles
            </Link>
          </div>
          <div className="accent-bar" />
          <h1 className="page-title">Seating Arrangement</h1>
          <p className="page-subtitle">{slot.subject_code} — {slot.subject_name} · {slot.date} · {slot.start_time}</p>
        </div>
        <div className="flex-row" style={{ flexWrap: 'wrap', gap: 6 }}>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={fetchSeating} aria-label="Refresh">
            <RefreshCw size={13} strokeWidth={1.5} />
          </button>
          {!isApproved && (
            <>
              <button className="btn btn-primary" onClick={generate} disabled={generating}>
                {generating
                  ? <><div className="spinner spinner-invert" style={{ width: 14, height: 14 }} /> Generating…</>
                  : <><Play size={13} strokeWidth={1.5} /> Generate Seating</>}
              </button>
              {hasSeating && (
                <>
                  <button
                    className={`btn ${isSwapMode ? 'btn-warning' : 'btn-ghost'}`}
                    onClick={() => { setIsSwapMode(!isSwapMode); setSwapSource(null); }}
                  >
                    <ArrowLeftRight size={13} strokeWidth={1.5} />
                    {isSwapMode ? (swapSource ? 'Select 2nd seat…' : 'Click seat to swap…') : 'Swap Seats'}
                  </button>
                  <button className="btn btn-success" onClick={approve} disabled={approving}>
                    {approving
                      ? <div className="spinner" style={{ width: 14, height: 14 }} />
                      : <><CheckCircle size={13} strokeWidth={1.5} /> Approve & Finalise</>}
                  </button>
                </>
              )}
            </>
          )}
          {isApproved && (
            <button className="btn btn-warning" onClick={unlock}>
              <Unlock size={13} strokeWidth={1.5} /> Unlock for Editing
            </button>
          )}
        </div>
      </div>

      {/* Status strip */}
      <div style={{ display: 'flex', gap: 0, border: '1px solid #111', marginBottom: 20 }}>
        {[
          { label: 'Status', val: isApproved ? 'Finalised' : (slot.status || 'Draft').replace(/_/g, ' '), color: isApproved ? '#166534' : '#111' },
          { label: 'Rooms', val: rooms.length },
          { label: 'Total Seated', val: rooms.reduce((s, r) => s + r.assignments.length, 0) },
          { label: 'Exam Duration', val: `${slot.duration_mins} min` },
        ].map((item, i) => (
          <div key={i} style={{
            flex: 1,
            padding: '10px 14px',
            borderRight: i < 3 ? '1px solid #E5E5E0' : 'none',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#A3A3A3' }}>{item.label}</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700, color: item.color || '#111', textTransform: 'capitalize', marginTop: 2 }}>{item.val}</div>
          </div>
        ))}
      </div>

      {isSwapMode && (
        <div className="alert alert-warning" style={{ marginBottom: 14 }}>
          <ArrowLeftRight size={13} strokeWidth={1.5} />
          {swapSource
            ? `Selected: ${swapSource.student_name} (${swapSource.roll_no}) — now click the target seat to swap`
            : 'Click any occupied seat to begin a swap'}
        </div>
      )}

      {!hasSeating ? (
        <div className="card" style={{ textAlign: 'center', padding: 64 }}>
          <div style={{ border: '1px solid #E5E5E0', display: 'inline-flex', padding: 14, marginBottom: 16 }}>
            <Play size={28} strokeWidth={1} color="#A3A3A3" />
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>No Seating Generated</div>
          <p style={{ fontFamily: 'var(--font-body)', fontStyle: 'italic', color: 'var(--np-n500)', marginBottom: 24, fontSize: 14 }}>
            Click "Generate Seating" to auto-assign students to benches using the configured rules.
          </p>
          <button className="btn btn-primary" onClick={generate} disabled={generating}>
            {generating ? 'Generating…' : <><Play size={13} strokeWidth={1.5} /> Generate Seating</>}
          </button>
        </div>
      ) : (
        <>
          {/* Room tabs */}
          <div style={{ display: 'flex', gap: 0, border: '1px solid #111', borderBottom: 'none', marginBottom: 0 }}>
            {rooms.map((r, i) => (
              <button
                key={r.room.id}
                onClick={() => setSelectedRoom(r.room.id)}
                style={{
                  padding: '8px 16px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  border: 'none',
                  borderRight: i < rooms.length - 1 ? '1px solid #E5E5E0' : 'none',
                  background: selectedRoom === r.room.id ? '#111111' : '#F9F9F7',
                  color: selectedRoom === r.room.id ? '#F9F9F7' : '#525252',
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                }}
              >
                {r.room.room_no} ({r.assignments.length} seated)
              </button>
            ))}
          </div>

          {currentRoom && (() => {
            const { grid, rows, cols } = buildGrid(currentRoom.room, currentRoom.assignments);
            return (
              <div className="card" style={{ marginTop: 0, borderTop: '2px solid #111' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700 }}>
                      Room {currentRoom.room.room_no}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--np-n500)', marginTop: 2 }}>
                      {currentRoom.room.block} · {currentRoom.room.bench_rows} rows x {currentRoom.room.bench_cols} cols · capacity {currentRoom.room.capacity}
                    </div>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textAlign: 'right' }}>
                    <div style={{ color: '#166534', fontWeight: 600 }}>{currentRoom.assignments.length} seated</div>
                    <div style={{ color: 'var(--np-n500)' }}>{currentRoom.room.capacity - currentRoom.assignments.length} empty</div>
                  </div>
                </div>

                {/* Front label */}
                <div style={{
                  textAlign: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  color: 'var(--np-n500)',
                  borderBottom: '2px solid #111111',
                  paddingBottom: 8,
                  marginBottom: 14,
                }}>
                  Front of Classroom — Blackboard
                </div>

                <div className="bench-grid" style={{ overflowX: 'auto', paddingBottom: 8 }}>
                  {Array.from({ length: rows }, (_, rowIdx) => (
                    <div key={rowIdx} className="bench-row-grid">
                      <div className="bench-row-label">R{rowIdx + 1}</div>
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

                {/* Student table */}
                <div style={{ marginTop: 24, borderTop: '2px solid #111', paddingTop: 16 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--np-n500)', marginBottom: 10 }}>
                    Student Register — {currentRoom.assignments.length} entries
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr><th>Row</th><th>Col</th><th>Name</th><th>PRN</th><th>Roll No</th><th>Branch</th><th>Year</th></tr>
                      </thead>
                      <tbody>
                        {currentRoom.assignments.map(a => (
                          <tr key={a.id}>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{a.bench_row}</td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{a.bench_col}</td>
                            <td style={{ fontWeight: 600 }}>{a.student_name}</td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{a.prn}</td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--np-red)' }}>{a.roll_no}</td>
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
