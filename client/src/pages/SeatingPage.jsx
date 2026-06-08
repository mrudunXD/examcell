import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Play, CheckCircle, Unlock, ArrowLeftRight, RefreshCw, Wifi } from 'lucide-react';
import api from '../lib/api.js';
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
          border: isDraggedOver ? '2px dashed #166534' : '1px solid #E5E5E0',
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
        background: isSource ? '#111111' : isDraggedOver ? 'rgba(22, 101, 52, 0.15)' : 'var(--np-bg)',
        borderColor: isSource ? '#111111' : isDraggedOver ? '#166534' : '#E5E5E0',
        borderStyle: isDraggedOver ? 'dashed' : 'solid',
        borderWidth: isDraggedOver ? '2px' : '1px',
        cursor: isApproved ? 'default' : 'grab',
        transition: 'all 0.15s'
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
  const [draggedSeat, setDraggedSeat] = useState(null);
  const [dragOverCell, setDragOverCell] = useState(null); // { row, col }
  const [viewMode, setViewMode] = useState('2d'); // '2d' or '3d'

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

  const handleDrop = async (draggedId, targetRow, targetCol, targetSeat) => {
    setDragOverCell(null);
    setDraggedSeat(null);
    if (!draggedId) return;

    if (targetSeat) {
      if (draggedId === targetSeat.id) return;
      try {
        await api.put('/seating/swap', { assignment_id_1: draggedId, assignment_id_2: targetSeat.id });
        toast.success('Seats swapped successfully');
        fetchSeating();
      } catch (err) {
        toast.error(err.response?.data?.error || 'Failed to swap seats');
      }
    } else {
      try {
        await api.put('/seating/override', { 
          assignment_id: draggedId, 
          bench_row: targetRow, 
          bench_col: targetCol 
        });
        toast.success('Student moved successfully');
        fetchSeating();
      } catch (err) {
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
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, borderBottom: '1px solid #E5E5E0', paddingBottom: 12 }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, fontWeight: 700 }}>
                      Room {currentRoom.room.room_no}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--np-n500)', marginTop: 2 }}>
                      {currentRoom.room.block} · {currentRoom.room.bench_rows} rows x {currentRoom.room.bench_cols} cols · capacity {currentRoom.room.capacity}
                      {viewMode === '2d' && !isApproved && <span style={{ marginLeft: 8, color: '#166534', fontWeight: 600 }}>— 💡 Drag and drop seats to rearrange visually</span>}
                    </div>
                  </div>
                  <div className="flex-row" style={{ gap: 12 }}>
                    <div style={{ display: 'flex', border: '1px solid #111', background: '#F9F9F7' }}>
                      <button
                        type="button"
                        onClick={() => setViewMode('2d')}
                        style={{
                          padding: '4px 10px',
                          border: 'none',
                          background: viewMode === '2d' ? '#111111' : 'transparent',
                          color: viewMode === '2d' ? '#F9F9F7' : '#525252',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 9,
                          textTransform: 'uppercase',
                          cursor: 'pointer',
                        }}
                      >
                        2D Plan
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('3d')}
                        style={{
                          padding: '4px 10px',
                          border: 'none',
                          background: viewMode === '3d' ? '#111111' : 'transparent',
                          color: viewMode === '3d' ? '#F9F9F7' : '#525252',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 9,
                          textTransform: 'uppercase',
                          cursor: 'pointer',
                        }}
                      >
                        3D View
                      </button>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, textAlign: 'right', lineHeight: 1.2 }}>
                      <div style={{ color: '#166534', fontWeight: 600 }}>{currentRoom.assignments.length} seated</div>
                      <div style={{ color: 'var(--np-n500)' }}>{currentRoom.room.capacity - currentRoom.assignments.length} empty</div>
                    </div>
                  </div>
                </div>

                {viewMode === '3d' ? (
                  <IsometricRoom
                    room={currentRoom.room}
                    grid={grid}
                    rows={rows}
                    cols={cols}
                  />
                ) : (
                  <>
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
                )}

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

// ── 3D CSS volumetric face components ─────────────────────────────────────────
function Cube3D({ width, height, depth, color, label, labelColor = '#fff', transform = '' }) {
  const frontColor = `color-mix(in srgb, ${color} 85%, black)`;
  const rightColor = `color-mix(in srgb, ${color} 70%, black)`;
  const leftColor = `color-mix(in srgb, ${color} 70%, black)`;
  const backColor = `color-mix(in srgb, ${color} 55%, black)`;

  return (
    <div style={{
      position: 'absolute',
      width: `${width}px`,
      height: `${height}px`,
      transformStyle: 'preserve-3d',
      transform: transform,
    }}>
      {/* Top Face */}
      <div style={{
        position: 'absolute',
        width: `${width}px`,
        height: `${height}px`,
        background: color,
        border: '1px solid #111',
        transform: `translateZ(${depth}px)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-mono)',
        fontSize: '7px',
        fontWeight: 'bold',
        color: labelColor,
      }}>
        {label}
      </div>
      {/* Front Face */}
      <div style={{
        position: 'absolute',
        width: `${width}px`,
        height: `${depth}px`,
        background: frontColor,
        border: '1px solid #111',
        transform: `rotateX(-90deg) translate3d(0, 0, ${height - depth}px)`,
        transformOrigin: 'bottom',
        bottom: 0,
      }} />
      {/* Right Face */}
      <div style={{
        position: 'absolute',
        width: `${depth}px`,
        height: `${height}px`,
        background: rightColor,
        border: '1px solid #111',
        transform: 'rotateY(90deg)',
        transformOrigin: 'right',
        right: 0,
      }} />
      {/* Left Face */}
      <div style={{
        position: 'absolute',
        width: `${depth}px`,
        height: `${height}px`,
        background: leftColor,
        border: '1px solid #111',
        transform: 'rotateY(-90deg)',
        transformOrigin: 'left',
        left: 0,
      }} />
      {/* Back Face */}
      <div style={{
        position: 'absolute',
        width: `${width}px`,
        height: `${depth}px`,
        background: backColor,
        border: '1px solid #111',
        transform: 'rotateX(90deg)',
        transformOrigin: 'top',
        top: 0,
      }} />
    </div>
  );
}

// ── Isometric 3D Room Grid Renderer ────────────────────────────────────────────
function IsometricRoom({ room, grid, rows, cols }) {
  const [rotation, setRotation] = useState(-45);
  const [zoom, setZoom] = useState(0.85);
  const [hovered, setHovered] = useState(null);

  const getBranchColor = (branch) => {
    const b = (branch || '').toUpperCase();
    if (b.includes('CSE') || b.includes('COMP')) return '#3b82f6';
    if (b.includes('ECE') || b.includes('ENTC') || b.includes('ELEC')) return '#ea580c';
    if (b.includes('ME') || b.includes('MECH')) return '#8b5cf6';
    if (b.includes('CE') || b.includes('CIVIL')) return '#10b981';
    return '#737373';
  };

  const cellW = 100;
  const cellH = 100;
  const floorW = cols * cellW + 40;
  const floorH = rows * cellH + 40;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Controls & Tooltip Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F5F5F5', border: '1px solid #111', padding: '10px 16px' }}>
        <div className="flex-row" style={{ gap: 8 }}>
          <button type="button" className="btn btn-sm" onClick={() => setRotation(r => r - 45)}>Rotate Left</button>
          <button type="button" className="btn btn-sm" onClick={() => setRotation(r => r + 45)}>Rotate Right</button>
          <button type="button" className="btn btn-sm" onClick={() => setZoom(z => Math.max(0.4, z - 0.05))}>Zoom Out</button>
          <button type="button" className="btn btn-sm" onClick={() => setZoom(z => Math.min(1.4, z + 0.05))}>Zoom In</button>
        </div>
        
        {/* Floating Tooltip info */}
        <div style={{ minHeight: '38px', minWidth: '300px', display: 'flex', alignItems: 'center', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
          {hovered ? (
            <div style={{ borderLeft: '3px solid var(--np-red)', paddingLeft: 8 }}>
              <strong>{hovered.student_name}</strong> · Roll: <span style={{ color: 'var(--np-red)' }}>{hovered.roll_no}</span> · PRN: {hovered.prn} · {hovered.branch} {hovered.year}
            </div>
          ) : (
            <span style={{ color: '#888', fontStyle: 'italic' }}>Hover over an occupied seat to view details</span>
          )}
        </div>
      </div>

      {/* 3D Perspective Box */}
      <div style={{
        height: '520px',
        overflow: 'hidden',
        border: '2px solid #111',
        background: '#e5e7eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        perspective: '1200px',
        position: 'relative',
      }}>
        {/* Room 3D Wrapper */}
        <div style={{
          width: `${floorW}px`,
          height: `${floorH}px`,
          background: 'var(--np-bg)',
          border: '4px solid var(--np-ink)',
          transformStyle: 'preserve-3d',
          transform: `rotateX(55deg) rotateZ(${rotation}deg) scale(${zoom})`,
          transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          position: 'relative',
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath fill='%23111111' fill-opacity='0.05' d='M0 0h1v1H0V0zm9 9h1v1H9V9z'%3E%3C/path%3E%3C/svg%3E\")",
        }}>
          {/* Blackboard vertically at the front */}
          <div style={{
            position: 'absolute',
            top: -24,
            left: 40,
            right: 40,
            height: 36,
            background: '#0f172a',
            border: '2.5px solid var(--np-ink)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--font-serif)',
            fontSize: '11px',
            fontWeight: 'bold',
            letterSpacing: '0.15em',
            transform: 'rotateX(-90deg) translateZ(18px)',
            transformOrigin: 'bottom',
          }}>
            FRONT - BLACKBOARD
          </div>

          {/* Grid Cells */}
          {Array.from({ length: rows }, (_, rIdx) => {
            const row = rIdx + 1;
            return Array.from({ length: cols }, (_, cIdx) => {
              const col = cIdx + 1;
              const seat = grid[row]?.[col];
              const cellLeft = (col - 1) * cellW + 20;
              const cellTop = (row - 1) * cellH + 20;

              return (
                <div 
                  key={`${row}-${col}`}
                  style={{
                    position: 'absolute',
                    left: `${cellLeft}px`,
                    top: `${cellTop}px`,
                    width: '80px',
                    height: '80px',
                    transformStyle: 'preserve-3d',
                  }}
                  onMouseEnter={() => seat && setHovered(seat)}
                  onMouseLeave={() => seat && setHovered(null)}
                >
                  {/* Grid cell label on the floor */}
                  <div style={{
                    position: 'absolute',
                    top: 2,
                    left: 2,
                    fontFamily: 'var(--font-mono)',
                    fontSize: '7px',
                    color: '#ccc',
                  }}>
                    R{row}C{col}
                  </div>

                  {/* 3D Desk */}
                  <div style={{
                    position: 'absolute',
                    top: '8px',
                    left: '8px',
                    transformStyle: 'preserve-3d',
                  }}>
                    <Cube3D 
                      width={64} 
                      height={20} 
                      depth={4} 
                      color="#f1f5f9" 
                      label="" 
                      transform="translateZ(28px)" 
                    />
                    {/* Desk legs (left & right) */}
                    <div style={{
                      position: 'absolute',
                      width: '2px',
                      height: '20px',
                      background: '#111',
                      transform: 'rotateY(90deg) translateZ(2px)',
                      left: '2px',
                      top: 0,
                    }} />
                    <div style={{
                      position: 'absolute',
                      width: '2px',
                      height: '20px',
                      background: '#111',
                      transform: 'rotateY(90deg) translateZ(2px)',
                      right: '2px',
                      top: 0,
                    }} />
                  </div>

                  {/* 3D Chair */}
                  <div style={{
                    position: 'absolute',
                    top: '36px',
                    left: '18px',
                    transformStyle: 'preserve-3d',
                  }}>
                    <Cube3D 
                      width={44} 
                      height={20} 
                      depth={2} 
                      color="#cbd5e1" 
                      label="" 
                      transform="translateZ(12px)"
                    />
                  </div>

                  {/* 3D Student Block if seated */}
                  {seat && (
                    <div style={{
                      position: 'absolute',
                      top: '30px',
                      left: '22px',
                      transformStyle: 'preserve-3d',
                    }}>
                      <Cube3D 
                        width={36} 
                        height={26} 
                        depth={32} 
                        color={getBranchColor(seat.branch)} 
                        label={seat.prn.slice(-3)} 
                        transform="translateZ(20px)"
                      />
                    </div>
                  )}
                </div>
              );
            });
          })}
        </div>
      </div>
    </div>
  );
}
