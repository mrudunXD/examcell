import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Play, CheckCircle, Unlock, ArrowLeftRight, RefreshCw, Wifi } from 'lucide-react';
import api from '../lib/api.js';
import { formatDate, formatTime } from '../lib/format.js';
import toast from 'react-hot-toast';

function BenchSeat({ 
  seat, 
  row, 
  col, 
  onSwapSelect, 
  swapSource, 
  isSwapMode, 
  isApproved,
  onDragStart, 
  onDragOver, 
  onDrop,
  onDragEnd,
  isDraggedOver
}) {
  const handleDragStartLocal = (e) => {
    if (isApproved || !seat) return;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", seat.id);
    onDragStart(seat);
  };

  const handleDragOverLocal = (e) => {
    if (isApproved) return;
    e.preventDefault();
    onDragOver(row, col);
  };

  const handleDropLocal = (e) => {
    if (isApproved) return;
    e.preventDefault();
    const draggedId = e.dataTransfer.getData("text/plain");
    onDrop(draggedId, row, col, seat);
  };

  if (!seat) {
    return (
      <div 
        className="bench-seat empty" 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          background: isDraggedOver ? 'rgba(22, 101, 52, 0.15)' : 'transparent',
          border: isDraggedOver ? '2px dashed #166534' : '1px solid var(--border)',
          transition: 'all 0.15s'
        }}
        onDragOver={handleDragOverLocal}
        onDrop={handleDropLocal}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--np-n400)' }}>empty</span>
      </div>
    );
  }

  const isSource = swapSource?.id === seat.id;
  return (
    <div
      className="bench-seat"
      draggable={!isApproved}
      onDragStart={handleDragStartLocal}
      onDragOver={handleDragOverLocal}
      onDrop={handleDropLocal}
      onDragEnd={onDragEnd}
      style={{
        background: isSource ? '#F5F5F7' : isDraggedOver ? 'rgba(22, 101, 52, 0.15)' : 'var(--bg-base)',
        borderColor: isSource ? '#F5F5F7' : isDraggedOver ? '#166534' : 'var(--border)',
        borderStyle: isDraggedOver ? 'dashed' : 'solid',
        borderWidth: isDraggedOver ? '2px' : '1px',
        cursor: isApproved ? 'default' : 'grab',
        transition: 'all 0.15s'
      }}
      onClick={() => isSwapMode && onSwapSelect(seat)}
      title={`${seat.student_name} · ${seat.prn} · ${seat.roll_no} · ${seat.branch} ${seat.year}`}
    >
      <div className="seat-name" style={{ color: isSource ? 'var(--bg-base)' : '#F5F5F7' }}>{seat.student_name}</div>
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
  const [draggedSeat, setDraggedSeat] = useState(null);
  const [dragOverCell, setDragOverCell] = useState(null); // { row, col }

  const handleDragStart = (seat) => {
    setDraggedSeat(seat);
  };

  const handleDragOver = (row, col) => {
    setDragOverCell({ row, col });
  };

  const handleDragEnd = () => {
    setDraggedSeat(null);
    setDragOverCell(null);
  };

  const performLocalSwap = (id1, id2) => {
    setData(prev => {
      if (!prev) return prev;
      const nextRooms = prev.rooms.map(room => {
        const assignments = room.assignments.map(a => {
          if (a.id === id1) {
            const other = room.assignments.find(x => x.id === id2);
            return other ? { ...a, student_id: other.student_id, student_name: other.student_name, student_prn: other.student_prn, student_roll_no: other.student_roll_no, student_branch: other.student_branch } : a;
          }
          if (a.id === id2) {
            const other = room.assignments.find(x => x.id === id1);
            return other ? { ...a, student_id: other.student_id, student_name: other.student_name, student_prn: other.student_prn, student_roll_no: other.student_roll_no, student_branch: other.student_branch } : a;
          }
          return a;
        });
        return { ...room, assignments };
      });
      return { ...prev, rooms: nextRooms };
    });
  };

  const performLocalMove = (id, newRow, newCol) => {
    setData(prev => {
      if (!prev) return prev;
      const nextRooms = prev.rooms.map(room => {
        const assignments = room.assignments.map(a => {
          if (a.id === id) {
            return { ...a, bench_row: newRow, bench_col: newCol };
          }
          return a;
        });
        return { ...room, assignments };
      });
      return { ...prev, rooms: nextRooms };
    });
  };

  const handleDrop = async (draggedId, targetRow, targetCol, targetSeat) => {
    setDragOverCell(null);
    setDraggedSeat(null);
    if (!draggedId) return;

    const oldData = { ...data };
    if (targetSeat) {
      if (draggedId === targetSeat.id) return;
      performLocalSwap(draggedId, targetSeat.id);
      try {
        await api.put('/seating/swap', { assignment_id_1: draggedId, assignment_id_2: targetSeat.id });
        toast.success('Seats swapped successfully');
        fetchSeating();
      } catch (err) {
        setData(oldData);
        toast.error(err.response?.data?.error || 'Failed to swap seats');
      }
    } else {
      performLocalMove(draggedId, targetRow, targetCol);
      try {
        await api.put('/seating/override', { 
          assignment_id: draggedId, 
          bench_row: targetRow, 
          bench_col: targetCol 
        });
        toast.success('Student moved successfully');
        fetchSeating();
      } catch (err) {
        setData(oldData);
        toast.error(err.response?.data?.error || 'Failed to move student');
      }
    }
  };

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
    
    const oldData = { ...data };
    performLocalSwap(swapSource.id, seat.id);
    const sourceName = swapSource.student_name;
    const targetName = seat.student_name;
    
    try {
      setSwapSource(null); 
      setIsSwapMode(false);
      await api.put('/seating/swap', { assignment_id_1: swapSource.id, assignment_id_2: seat.id });
      toast.success(`Swapped: ${sourceName} — ${targetName}`);
      fetchSeating();
    } catch {
      setData(oldData);
      toast.error('Swap failed');
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>;
  if (!data) return null;

  const { slot, rooms } = data;
  const isApproved = slot.status === 'finalised';
  const isOnline   = slot.exam_mode === 'online';
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
          
          <h1 className="page-title">Seating Arrangement</h1>
          <p className="page-subtitle">{slot.subject_code} — {slot.subject_name} · {formatDate(slot.date)} · {formatTime(slot.start_time)}</p>
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
      <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', marginBottom: 20 }}>
        {[
          { label: 'Status', val: isApproved ? 'Finalised' : (slot.status || 'Draft').replace(/_/g, ' '), color: isApproved ? '#166534' : '#111' },
          { label: 'Rooms', val: rooms.length },
          { label: 'Total Seated', val: rooms.reduce((s, r) => s + r.assignments.length, 0) },
          { label: 'Exam Duration', val: `${slot.duration_mins} min` },
        ].map((item, i) => (
          <div key={i} style={{
            flex: 1,
            padding: '10px 14px',
            borderRight: i < 3 ? '1px solid var(--border)' : 'none',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#767680' }}>{item.label}</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700, color: item.color || '#111', textTransform: 'capitalize', marginTop: 2 }}>{item.val}</div>
          </div>
        ))}
      </div>

      {isOnline && (
        <div style={{ border: '2px solid #1d4ed8', padding: '32px 24px', textAlign: 'center', background: '#eff6ff', marginBottom: 20 }}>
          <Wifi size={32} strokeWidth={1} color="#1d4ed8" style={{ marginBottom: 12 }} />
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 700, color: '#1d4ed8', marginBottom: 8 }}>
            Online Examination
          </div>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#1e40af' }}>
            This exam is conducted online. No physical seating arrangement is required.
          </p>
        </div>
      )}

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
          <div style={{ border: '1px solid var(--border)', display: 'inline-flex', padding: 14, marginBottom: 16 }}>
            <Play size={28} strokeWidth={1} color="#767680" />
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
          <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', borderBottom: 'none', marginBottom: 0 }}>
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
                  borderRight: i < rooms.length - 1 ? '1px solid var(--border)' : 'none',
                  background: selectedRoom === r.room.id ? '#F5F5F7' : 'var(--bg-base)',
                  color: selectedRoom === r.room.id ? 'var(--bg-base)' : 'var(--text-secondary)',
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
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700 }}>
                      Room {currentRoom.room.room_no}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--np-n500)', marginTop: 2 }}>
                      {currentRoom.room.block} · {currentRoom.room.bench_rows} rows x {currentRoom.room.bench_cols} cols · capacity {currentRoom.room.capacity}
                      {!isApproved && <span style={{ marginLeft: 8, color: '#166534', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Lightbulb size={12} strokeWidth={1.8} style={{ color: '#16a34a' }} /> Drag and drop seats to rearrange visually</span>}
                    </div>
                  </div>
                  <div className="flex-row" style={{ gap: 12 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textAlign: 'right', lineHeight: 1.2 }}>
                      <div style={{ color: '#166534', fontWeight: 600 }}>{currentRoom.assignments.length} seated</div>
                      <div style={{ color: 'var(--np-n500)' }}>{currentRoom.room.capacity - currentRoom.assignments.length} empty</div>
                    </div>
                  </div>
                </div>

                <>
                  {/* Front label */}
                  <div style={{
                    textAlign: 'center',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    color: 'var(--np-n500)',
                    borderBottom: '1px solid var(--border)',
                    paddingBottom: 8,
                    marginBottom: 14,
                  }}>
                    Front of Classroom — Blackboard
                  </div>

                  <div className="bench-grid" style={{ overflowX: 'auto', paddingBottom: 8 }}>
                    {Array.from({ length: rows }, (_, rowIdx) => (
                      <div key={rowIdx} className="bench-row-grid">
                        <div className="bench-row-label">R{rowIdx + 1}</div>
                        {Array.from({ length: cols }, (_, colIdx) => {
                          const row = rowIdx + 1;
                          const col = colIdx + 1;
                          const isDraggedOver = dragOverCell?.row === row && dragOverCell?.col === col;
                          return (
                            <BenchSeat
                              key={colIdx}
                              seat={grid[row]?.[col] || null}
                              row={row}
                              col={col}
                              onSwapSelect={handleSwapSelect}
                              swapSource={swapSource}
                              isSwapMode={isSwapMode}
                              isApproved={isApproved}
                              onDragStart={handleDragStart}
                              onDragOver={handleDragOver}
                              onDrop={handleDrop}
                              onDragEnd={handleDragEnd}
                              isDraggedOver={isDraggedOver}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </>

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
                            <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#FF453A' }}>{a.roll_no}</td>
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










