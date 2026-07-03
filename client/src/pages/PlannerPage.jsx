import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Check, Trash2, User, BookOpen, Clock, HelpCircle } from 'lucide-react';
import api from '../lib/api.js';
import { formatDate } from '../lib/format.js';
import toast from 'react-hot-toast';

const SHIFTS = [
  { id: '1', name: 'Shift 1', start_time: '09:30', duration_mins: 180 },
  { id: '2', name: 'Shift 2', start_time: '13:30', duration_mins: 180 }
];

export default function PlannerPage() {
  const { cycleId } = useParams();
  const navigate = useNavigate();
  const [cycle, setCycle] = useState(null);
  const [slots, setSlots] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);

  // Drag and Drop States
  const [draggedItem, setDraggedItem] = useState(null); // { type: 'subject'|'slot', data: subjectObj|slotObj }
  const [hoveredCell, setHoveredCell] = useState(null); // { date, start_time }
  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');

  // Fetch all required data
  const fetchData = useCallback(async () => {
    try {
      const [cyclesRes, slotsRes, subjectsRes, facultyRes, leavesRes] = await Promise.all([
        api.get('/exam-cycles'),
        api.get(`/exam-cycles/${cycleId}/slots`),
        api.get(`/exam-cycles/${cycleId}/valid-subjects`),
        api.get('/faculty'),
        api.get('/faculty-leaves')
      ]);

      const currentCycle = cyclesRes.data.find(c => c.id === cycleId);
      if (!currentCycle) {
        toast.error('Exam cycle not found');
        navigate('/exam-cycles');
        return;
      }
      setCycle(currentCycle);
      setSlots(slotsRes.data);
      setSubjects(subjectsRes.data);
      setFaculty(facultyRes.data);
      setLeaves(leavesRes.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load planner data');
    } finally {
      setLoading(false);
    }
  }, [cycleId, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Generate list of dates between start_date and end_date, skipping Sundays
  const dates = useMemo(() => {
    if (!cycle?.start_date || !cycle?.end_date) return [];
    const datesList = [];
    let current = new Date(cycle.start_date + 'T00:00:00');
    const end = new Date(cycle.end_date + 'T00:00:00');
    
    // Safety break at 100 iterations
    let iterations = 0;
    while (current <= end && iterations < 100) {
      iterations++;
      const yyyy = current.getFullYear();
      const mm = String(current.getMonth() + 1).padStart(2, '0');
      const dd = String(current.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      
      if (current.getDay() !== 0) { // 0 is Sunday
        datesList.push(dateStr);
      }
      current.setDate(current.getDate() + 1);
    }
    return datesList;
  }, [cycle]);

  // Filter out subjects that have already been scheduled
  const scheduledSubjectIds = useMemo(() => {
    return new Set(slots.map(s => s.subject_id));
  }, [slots]);

  const unscheduledSubjects = useMemo(() => {
    return subjects.filter(sub => {
      // Exclude already scheduled
      if (scheduledSubjectIds.has(sub.id)) return false;
      
      // Filter by search query
      const matchQuery = 
        sub.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        sub.code.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Filter by branch
      const matchBranch = !branchFilter || sub.branch === branchFilter;
      
      // Filter by year
      const matchYear = !yearFilter || sub.year === yearFilter;

      return matchQuery && matchBranch && matchYear;
    });
  }, [subjects, scheduledSubjectIds, searchQuery, branchFilter, yearFilter]);

  // Extract branches and years for filters
  const uniqueBranches = useMemo(() => {
    return Array.from(new Set(subjects.map(s => s.branch))).sort();
  }, [subjects]);

  const uniqueYears = useMemo(() => {
    return Array.from(new Set(subjects.map(s => s.year))).sort();
  }, [subjects]);

  // local constraint solver for drag highlights
  const getCellConflicts = (subject, date, start_time, ignoreSlotId = null) => {
    const conflicts = [];
    if (!subject) return conflicts;

    const shiftId = start_time === '09:30' ? '1' : '2';

    // 1. Student Conflict: Check if another slot in the same shift has student overlap
    const shiftSlots = slots.filter(s => 
      s.date === date && 
      s.start_time === start_time && 
      s.id !== ignoreSlotId
    );

    for (const s of shiftSlots) {
      if (s.branch === subject.branch && s.year === subject.year && s.subject_semester === subject.semester) {
        conflicts.push({
          type: 'STUDENT_CLASH',
          slotId: s.id,
          description: `Student overlap: ${subject.branch} ${subject.year} (Sem ${subject.semester}) already has an exam scheduled in this shift (${s.subject_code})`
        });
      }
    }

    // 2. Faculty Leave Conflict: Check if the faculty teaching this subject is on leave
    const teachers = faculty.filter(f => f.subjects?.some(sub => sub.id === subject.id));
    for (const t of teachers) {
      const hasLeave = leaves.some(l => 
        l.faculty_id === t.id && 
        l.date === date && 
        (!l.shift_id || String(l.shift_id) === String(shiftId))
      );
      if (hasLeave) {
        conflicts.push({
          type: 'FACULTY_LEAVE',
          facultyName: t.name,
          description: `Faculty leave: Instructor ${t.name} is on leave on ${date} (Shift ${shiftId})`
        });
      }
    }

    return conflicts;
  };

  // Get conflicts for currently dragged item at hovered cell
  const currentCellConflicts = useMemo(() => {
    if (!draggedItem || !hoveredCell) return [];
    
    const subject = draggedItem.type === 'subject' 
      ? draggedItem.data 
      : { 
          id: draggedItem.data.subject_id, 
          code: draggedItem.data.subject_code, 
          name: draggedItem.data.subject_name,
          branch: draggedItem.data.branch, 
          year: draggedItem.data.year, 
          semester: draggedItem.data.subject_semester 
        };

    const ignoreSlotId = draggedItem.type === 'slot' ? draggedItem.data.id : null;
    return getCellConflicts(subject, hoveredCell.date, hoveredCell.start_time, ignoreSlotId);
  }, [draggedItem, hoveredCell, slots, faculty, leaves]);

  // Identify which slot IDs are causing conflicts with the currently dragged item
  const conflictingSlotIds = useMemo(() => {
    return new Set(currentCellConflicts.filter(c => c.slotId).map(c => c.slotId));
  }, [currentCellConflicts]);

  // Handle HTML5 Drag and Drop Events
  const handleDragStart = (e, itemType, itemData) => {
    setDraggedItem({ type: itemType, data: itemData });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', itemType);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setHoveredCell(null);
  };

  const handleDragOver = (e, date, start_time) => {
    e.preventDefault();
    if (!hoveredCell || hoveredCell.date !== date || hoveredCell.start_time !== start_time) {
      setHoveredCell({ date, start_time });
    }
  };

  const handleDragLeave = () => {
    // Only clear if mouse actually leaves the cell
  };

  const handleDrop = async (e, date, start_time) => {
    e.preventDefault();
    setHoveredCell(null);
    if (!draggedItem) return;

    const subject = draggedItem.type === 'subject' 
      ? draggedItem.data 
      : { 
          id: draggedItem.data.subject_id, 
          code: draggedItem.data.subject_code, 
          name: draggedItem.data.subject_name,
          branch: draggedItem.data.branch, 
          year: draggedItem.data.year, 
          semester: draggedItem.data.subject_semester 
        };

    const ignoreSlotId = draggedItem.type === 'slot' ? draggedItem.data.id : null;
    const conflicts = getCellConflicts(subject, date, start_time, ignoreSlotId);

    if (conflicts.length > 0) {
      const confirmMsg = conflicts.map(c => c.description).join('\n') + '\n\nDo you want to force schedule anyway?';
      if (!window.confirm(confirmMsg)) {
        setDraggedItem(null);
        return;
      }
    }

    setLoading(true);
    try {
      if (draggedItem.type === 'subject') {
        // Create new slot
        await api.post(`/exam-cycles/${cycleId}/slots`, {
          subject_id: subject.id,
          date,
          start_time,
          duration_mins: 180,
          exam_type: 'regular',
          exam_mode: 'offline',
          classroom_ids: [] // Handled by auto allocation later if they assign rooms
        });
        toast.success(`Successfully scheduled ${subject.code}`);
      } else if (draggedItem.type === 'slot') {
        // Move existing slot (update)
        const slot = draggedItem.data;
        await api.put(`/exam-cycles/${cycleId}/slots/${slot.id}`, {
          subject_id: slot.subject_id,
          date,
          start_time,
          duration_mins: slot.duration_mins,
          exam_type: slot.exam_type,
          exam_mode: slot.exam_mode,
          classroom_ids: slot.rooms?.map(r => r.classroom_id) || [],
          version: slot.version
        });
        toast.success(`Moved ${slot.subject_code} to ${date} (${start_time})`);
      }
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update schedule');
    } finally {
      setLoading(false);
      setDraggedItem(null);
    }
  };

  const handleDeleteSlot = async (slotId) => {
    if (!window.confirm('Are you sure you want to remove this scheduled slot? This will delete seating and duties associated with it.')) return;
    setLoading(true);
    try {
      await api.delete(`/exam-cycles/${cycleId}/slots/${slotId}`);
      toast.success('Slot unscheduled');
      await fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete slot');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !cycle) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <div className="spinner" style={{ margin: '0 auto' }} />
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div className="page-header" style={{ paddingBottom: 12, borderBottom: '3px solid #111111', flexShrink: 0 }}>
        <div>
          <div className="flex-row" style={{ gap: 6, marginBottom: 8 }}>
            <Link to="/exam-cycles" className="btn btn-ghost btn-sm" style={{ border: '1px solid var(--border)', fontWeight: 'bold' }}>
              <ArrowLeft size={12} strokeWidth={2} /> Back to Cycles
            </Link>
          </div>
          <div className="accent-bar" style={{ height: 4, background: '#F5F5F7', margin: '4px 0' }} />
          <h1 className="page-title" style={{ fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 900, textTransform: 'uppercase' }}>
            Interactive Planner
          </h1>
          <p className="page-subtitle" style={{ fontStyle: 'italic', fontFamily: 'var(--font-body)', fontSize: 14 }}>
            {cycle?.name} &middot; Drag subjects onto the grid to schedule. Shift 1 (09:30 AM), Shift 2 (01:30 PM).
          </p>
        </div>
      </div>

      {/* Main Workspace */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        
        {/* Sidebar: Unscheduled Subjects */}
        <div style={{
          width: 320,
          borderRight: '3px solid #111111',
          background: '#FFF',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          padding: 16,
          overflowY: 'auto'
        }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 16, fontWeight: 700, borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 12 }}>
            Unscheduled Subjects ({unscheduledSubjects.length})
          </h2>

          {/* Search and Filters */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            <input 
              type="text" 
              className="input" 
              placeholder="Search code/name..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ border: '1px solid var(--border)', padding: '6px 10px', fontSize: 12 }}
            />
            
            <div style={{ display: 'flex', gap: 6 }}>
              <select 
                className="input" 
                value={branchFilter} 
                onChange={e => setBranchFilter(e.target.value)}
                style={{ border: '1px solid var(--border)', padding: '4px 6px', fontSize: 11, flex: 1 }}
              >
                <option value="">All Branches</option>
                {uniqueBranches.map(b => <option key={b} value={b}>{b}</option>)}
              </select>

              <select 
                className="input" 
                value={yearFilter} 
                onChange={e => setYearFilter(e.target.value)}
                style={{ border: '1px solid var(--border)', padding: '4px 6px', fontSize: 11, flex: 1 }}
              >
                <option value="">All Years</option>
                {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {/* Unscheduled Subjects List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, overflowY: 'auto', paddingRight: 4 }}>
            {unscheduledSubjects.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--np-n500)', fontSize: 12, padding: 24, border: '2px dashed var(--border)', fontStyle: 'italic' }}>
                No unscheduled subjects match the filters.
              </div>
            ) : (
              unscheduledSubjects.map(sub => (
                <div
                  key={sub.id}
                  draggable="true"
                  onDragStart={(e) => handleDragStart(e, 'subject', sub)}
                  onDragEnd={handleDragEnd}
                  style={{
                    border: '1px solid var(--border)',
                    background: '#FFF',
                    padding: 10,
                    cursor: 'grab',
                    transition: 'transform 0.1s, box-shadow 0.1s',
                    boxShadow: '2px 2px 0 0 #111111'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translate(-1px, -1px)';
                    e.currentTarget.style.boxShadow = '3px 3px 0 0 #111111';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = '2px 2px 0 0 #111111';
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 'bold', background: 'var(--border)', padding: '2px 6px', border: '1px solid #111111' }}>
                      {sub.code}
                    </span>
                    <span style={{ fontSize: 9, textTransform: 'uppercase', color: 'var(--np-n500)', fontWeight: 600 }}>
                      {sub.branch} &middot; {sub.year} (Sem {sub.semester})
                    </span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-sans)', color: '#F5F5F7', wordBreak: 'break-word' }}>
                    {sub.name}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Calendar Timetable Timeline Grid */}
        <div style={{
          flex: 1,
          background: 'var(--bg-base)',
          padding: 16,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Conflict Alert Banner */}
          {draggedItem && hoveredCell && currentCellConflicts.length > 0 && (
            <div style={{
              background: 'rgba(204, 0, 0, 0.1)',
              border: '3px solid #FF453A',
              padding: '12px 16px',
              marginBottom: 16,
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              animation: 'pulse 1.5s infinite alternate'
            }}>
              <AlertTriangle size={20} color="#FF453A" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong style={{ textTransform: 'uppercase', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#FF453A' }}>
                  Scheduling Conflicts Detected
                </strong>
                {currentCellConflicts.map((c, idx) => (
                  <div key={idx} style={{ fontSize: 12, color: '#F5F5F7', marginTop: 4 }}>
                    &bull; {c.description}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grid Container */}
          <div style={{ border: '3px solid #111111', background: '#FFF', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <thead>
                <tr style={{ borderBottom: '3px solid #111111', background: 'var(--border)' }}>
                  <th style={{ width: 120, padding: 12, borderRight: '1px solid var(--border)', textAlign: 'left', fontFamily: 'var(--font-serif)', fontSize: 13, fontWeight: 900 }}>
                    SHIFT
                  </th>
                  {dates.map(date => (
                    <th key={date} style={{ padding: 12, borderRight: '1px solid var(--border)', textAlign: 'center', minWidth: 160 }}>
                      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 13, fontWeight: 900 }}>
                        {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--np-n600)', marginTop: 2 }}>
                        {formatDate(date)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SHIFTS.map(shift => (
                  <tr key={shift.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{
                      padding: 12,
                      borderRight: '1px solid var(--border)',
                      background: 'var(--bg-elevated)',
                      verticalAlign: 'top',
                      fontFamily: 'var(--font-sans)',
                      fontWeight: 'bold'
                    }}>
                      <div style={{ fontSize: 13 }}>{shift.name}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--np-n500)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={10} /> {shift.start_time}
                      </div>
                    </td>

                    {dates.map(date => {
                      const cellSlots = slots.filter(s => s.date === date && s.start_time === shift.start_time);
                      const isHovered = hoveredCell && hoveredCell.date === date && hoveredCell.start_time === shift.start_time;
                      const hasConflicts = isHovered && currentCellConflicts.length > 0;
                      
                      // Calculate border styling for active drag actions
                      let cellStyle = {
                        padding: 12,
                        borderRight: '1px solid var(--border)',
                        verticalAlign: 'top',
                        background: '#FFF',
                        minHeight: 120,
                        transition: 'all 0.15s ease-in-out'
                      };

                      if (isHovered) {
                        if (hasConflicts) {
                          cellStyle.background = 'rgba(204, 0, 0, 0.05)';
                          cellStyle.boxShadow = '0 0 12px rgba(204, 0, 0, 0.4) inset';
                          cellStyle.border = '2px dashed #FF453A';
                        } else {
                          cellStyle.background = 'rgba(22, 101, 52, 0.05)';
                          cellStyle.boxShadow = '0 0 12px rgba(22, 101, 52, 0.4) inset';
                          cellStyle.border = '2px solid #166534';
                        }
                      }

                      return (
                        <td
                          key={date}
                          style={cellStyle}
                          onDragOver={(e) => handleDragOver(e, date, shift.start_time)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, date, shift.start_time)}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%', minHeight: 80 }}>
                            {cellSlots.map(slot => {
                              const isClashingSource = conflictingSlotIds.has(slot.id);
                              return (
                                <div
                                  key={slot.id}
                                  draggable="true"
                                  onDragStart={(e) => handleDragStart(e, 'slot', slot)}
                                  onDragEnd={handleDragEnd}
                                  style={{
                                    border: '1px solid var(--border)',
                                    background: isClashingSource ? 'rgba(204, 0, 0, 0.15)' : 'var(--bg-base)',
                                    padding: 8,
                                    cursor: 'grab',
                                    position: 'relative',
                                    boxShadow: isClashingSource 
                                      ? '0 0 8px rgba(204, 0, 0, 0.6)' 
                                      : '2px 2px 0 0 #111111',
                                    borderColor: isClashingSource ? '#FF453A' : '#F5F5F7'
                                  }}
                                >
                                  {/* Delete btn */}
                                  <button
                                    onClick={() => handleDeleteSlot(slot.id)}
                                    style={{
                                      position: 'absolute',
                                      top: 4,
                                      right: 4,
                                      background: 'transparent',
                                      border: 'none',
                                      cursor: 'pointer',
                                      color: 'var(--np-n500)'
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.color = '#FF453A'}
                                    onMouseLeave={e => e.currentTarget.style.color = 'var(--np-n500)'}
                                  >
                                    <Trash2 size={12} />
                                  </button>

                                  <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--np-n500)', marginBottom: 2 }}>
                                    {slot.branch} &bull; {slot.year} (Sem {slot.subject_semester})
                                  </div>
                                  <div style={{ fontSize: 11, fontWeight: 'bold', fontFamily: 'var(--font-sans)', color: '#F5F5F7', paddingRight: 14 }}>
                                    {slot.subject_code} &middot; {slot.subject_name}
                                  </div>

                                  {/* Room allocations count */}
                                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                                    <span style={{ fontSize: 9, color: 'var(--np-n600)', background: 'rgba(0,0,0,0.05)', padding: '1px 4px', border: '1px solid var(--border)' }}>
                                      Rooms: {slot.rooms?.map(r => r.room_no).join(', ') || 'None'}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                            
                            {cellSlots.length === 0 && !isHovered && (
                              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#767680', fontSize: 10, fontFamily: 'var(--font-mono)' }}>
                                EMPTY
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Embedded CSS for pulse animation */}
      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 4px rgba(204, 0, 0, 0.4); }
          100% { box-shadow: 0 0 16px rgba(204, 0, 0, 0.8); }
        }
      `}</style>
    </div>
  );
}









