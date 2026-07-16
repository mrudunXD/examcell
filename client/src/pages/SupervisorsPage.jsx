import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, Play, UserCog, RefreshCw, Users, ShieldAlert, Award, CheckCircle, 
  Trash2, Plus, Settings, X, HelpCircle, UserPlus, AlertCircle, Info
} from 'lucide-react';
import api from '../lib/api.js';
import toast from 'react-hot-toast';
import { formatDate, formatTime } from '../lib/format.js';

export default function SupervisorsPage() {
  const { slotId } = useParams();
  const [duties, setDuties] = useState([]);
  const [slotInfo, setSlotInfo] = useState(null);
  const [roomsList, setRoomsList] = useState([]);
  const [facultyAvailability, setFacultyAvailability] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Constraints Configuration
  const [config, setConfig] = useState({
    coSupervisorThreshold: 30,
    minGapDays: 0,
    maxDuties: 5,
    reliefCount: 0
  });
  const [showConfig, setShowConfig] = useState(false);

  // Manual Assignment Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    room_allocation_id: '', // Empty means Standby
    faculty_id: '',
    role: 'primary'
  });

  const fetchDutiesAndAvailability = async () => {
    setLoading(true);
    try {
      const [dr, sr, ar] = await Promise.all([
        api.get(`/supervisors/${slotId}`),
        api.get(`/seating/${slotId}`),
        api.get(`/supervisors/availability/${slotId}?min_gap=${config.minGapDays}`)
      ]);
      setDuties(dr.data);
      setSlotInfo(sr.data.slot);
      setRoomsList(sr.data.rooms || []);
      setFacultyAvailability(ar.data);
    } catch (err) {
      toast.error('Failed to load supervisor data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDutiesAndAvailability();
  }, [slotId, config.minGapDays]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data } = await api.post(`/supervisors/generate/${slotId}`, {
        coSupervisorThreshold: config.coSupervisorThreshold,
        minGapDays: config.minGapDays,
        maxDuties: config.maxDuties,
        reliefCount: config.reliefCount
      });
      toast.success(data.message);
      fetchDutiesAndAvailability();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Auto-scheduling failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleManualAssign = async (e) => {
    e.preventDefault();
    if (!addForm.faculty_id) {
      toast.error('Please select a faculty member');
      return;
    }
    setActionLoading(true);
    try {
      await api.post('/supervisors/assign', {
        slot_id: slotId,
        room_allocation_id: addForm.room_allocation_id || null,
        faculty_id: addForm.faculty_id,
        role: addForm.role
      });
      toast.success('Supervisor assigned successfully');
      setShowAddModal(false);
      fetchDutiesAndAvailability();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Manual assignment failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveDuty = async (dutyId) => {
    if (!confirm('Are you sure you want to remove this duty assignment?')) return;
    try {
      await api.delete(`/supervisors/${dutyId}`);
      toast.success('Assignment removed');
      fetchDutiesAndAvailability();
    } catch (err) {
      toast.error('Failed to remove assignment');
    }
  };

  const handleReassignDirect = async (dutyId, newFacultyId, version) => {
    try {
      await api.put('/supervisors/reassign', {
        duty_id: dutyId,
        new_faculty_id: newFacultyId,
        version
      });
      toast.success('Invigilator reassigned');
      fetchDutiesAndAvailability();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Reassignment failed');
    }
  };

  // Group duties
  const roomDuties = duties.filter(d => d.room_allocation_id !== null);
  const standbyDuties = duties.filter(d => d.room_allocation_id === null);

  const groupedRoomDuties = {};
  for (const d of roomDuties) {
    if (!groupedRoomDuties[d.room_no]) {
      groupedRoomDuties[d.room_no] = { room_no: d.room_no, block: d.block, duties: [] };
    }
    groupedRoomDuties[d.room_no].duties.push(d);
  }

  // Availability badge style helper
  const getAvailabilityStyle = (status) => {
    switch (status) {
      case 'available': return { bg: '#e8f5e9', fg: '#2e7d32', label: 'Available' };
      case 'teaches': return { bg: '#ffebee', fg: '#c62828', label: 'Teaches Subject' };
      case 'busy': return { bg: '#fff3e0', fg: '#ef6c00', label: 'Busy' };
      case 'gap': return { bg: '#f3e5f5', fg: '#6a1b9a', label: 'Gap Conflict' };
      default: return { bg: '#eceff1', fg: '#37474f', label: 'Approved Leave' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>
      
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <Link to="/exam-cycles" style={{ display: 'flex', alignItems: 'center', gap: '4px', textDecoration: 'none', color: 'var(--np-n500)', fontSize: '12px', fontWeight: 700 }}>
              <ArrowLeft size={14} /> Back to Cycles
            </Link>
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 900, fontFamily: 'var(--font-serif)', margin: 0 }}>
            Invigilator Allocator
          </h1>
          {slotInfo && (
            <p style={{ margin: '4px 0 0 0', color: 'var(--np-n500)', fontSize: '13px' }}>
              {slotInfo.subject_code} — {slotInfo.subject_name} · {formatDate(slotInfo.date)} · {formatTime(slotInfo.start_time)}
            </p>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            onClick={() => setShowConfig(!showConfig)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 14px',
              border: '1.5px solid var(--border)', borderRadius: '6px', background: showConfig ? 'var(--bg-elevated)' : 'transparent',
              cursor: 'pointer', fontWeight: 700, fontSize: '12px'
            }}
          >
            <Settings size={14} /> Constraints
          </button>
          
          <button 
            onClick={() => {
              setAddForm({ room_allocation_id: '', faculty_id: '', role: 'primary' });
              setShowAddModal(true);
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 14px',
              border: '1.5px solid var(--border)', borderRadius: '6px', background: 'transparent',
              cursor: 'pointer', fontWeight: 700, fontSize: '12px'
            }}
          >
            <Plus size={14} /> Add Supervisor
          </button>
          
          <button 
            onClick={handleGenerate} 
            disabled={generating} 
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px',
              border: 'none', borderRadius: '6px', background: 'var(--np-ink)', color: '#fff',
              cursor: 'pointer', fontWeight: 700, fontSize: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }}
          >
            <Play size={14} /> {generating ? 'Scheduling...' : 'Auto-Assign'}
          </button>
        </div>
      </div>

      {/* Constraints Drawer */}
      {showConfig && (
        <div style={{ background: 'var(--bg-surface)', border: '2px solid var(--np-ink)', borderRadius: '8px', padding: '20px', boxShadow: '4px 4px 0 0 var(--np-ink)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 900, textTransform: 'uppercase', color: 'var(--np-ink)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Settings size={16} /> Auto-Scheduler Constraints & Weights
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--np-n500)', display: 'block', marginBottom: '6px' }}>Co-Supervisor Threshold</label>
              <input 
                type="number" 
                value={config.coSupervisorThreshold} 
                onChange={e => setConfig({ ...config, coSupervisorThreshold: parseInt(e.target.value) || 0 })}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
              />
              <span style={{ fontSize: '10px', color: 'var(--np-n500)', marginTop: '4px', display: 'block' }}>Room student count above which co-invigilator is needed.</span>
            </div>
            
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--np-n500)', display: 'block', marginBottom: '6px' }}>Standby Supervisors Count</label>
              <input 
                type="number" 
                value={config.reliefCount} 
                onChange={e => setConfig({ ...config, reliefCount: parseInt(e.target.value) || 0 })}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
              />
              <span style={{ fontSize: '10px', color: 'var(--np-n500)', marginTop: '4px', display: 'block' }}>Emergency/standby staff allocated to slot.</span>
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--np-n500)', display: 'block', marginBottom: '6px' }}>Minimum Gap Days</label>
              <input 
                type="number" 
                value={config.minGapDays} 
                onChange={e => setConfig({ ...config, minGapDays: parseInt(e.target.value) || 0 })}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
              />
              <span style={{ fontSize: '10px', color: 'var(--np-n500)', marginTop: '4px', display: 'block' }}>Min days of rest between consecutive duties.</span>
            </div>

            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--np-n500)', display: 'block', marginBottom: '6px' }}>Max Duties Per Faculty</label>
              <input 
                type="number" 
                value={config.maxDuties} 
                onChange={e => setConfig({ ...config, maxDuties: parseInt(e.target.value) || 0 })}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
              />
              <span style={{ fontSize: '10px', color: 'var(--np-n500)', marginTop: '4px', display: 'block' }}>Ceiling count of duties a faculty can get this cycle.</span>
            </div>
          </div>
        </div>
      )}

      {/* Main content split */}
      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        
        {/* Left Side: Room Duties and Standbys */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Standby Invigilators Panel */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>Standby Invigilators</h3>
              <span style={{ fontSize: '11px', fontWeight: 700, background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '12px' }}>
                {standbyDuties.length} Standbys
              </span>
            </div>
            
            <div style={{ padding: '16px' }}>
              {standbyDuties.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--np-n500)', fontSize: '12px', padding: '20px' }}>
                  No standby supervisors assigned to this slot.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
                  {standbyDuties.map(d => (
                    <div key={d.id} style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '13px' }}>{d.faculty_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--np-n500)' }}>{d.department}</div>
                      </div>
                      <button 
                        onClick={() => handleRemoveDuty(d.id)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Rooms Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 900, margin: '8px 0 0 0' }}>Classroom Supervision Duties</h3>
            
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--np-n500)' }}>Loading board...</div>
            ) : Object.keys(groupedRoomDuties).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', border: '1px dashed var(--border)', borderRadius: '8px', color: 'var(--np-n500)' }}>
                No invigilators assigned to room slots yet.
              </div>
            ) : (
              Object.values(groupedRoomDuties).map(room => (
                <div key={room.room_no} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                  
                  {/* Room Header */}
                  <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontWeight: 800, fontSize: '15px' }}>Room {room.room_no}</span>
                      <span style={{ fontSize: '11px', color: 'var(--np-n500)' }}>{room.block}</span>
                    </div>
                  </div>

                  {/* Room invigilators list */}
                  <div>
                    {room.duties.map((d, idx) => (
                      <div key={d.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: idx < room.duties.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                          <span style={{
                            fontSize: '9px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em',
                            padding: '3px 8px', borderRadius: '4px',
                            background: d.role === 'primary' ? '#e2f0d9' : '#fce4d6',
                            color: d.role === 'primary' ? '#385723' : '#c65911'
                          }}>
                            {d.role}
                          </span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '13px' }}>{d.faculty_name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--np-n500)' }}>{d.department}</div>
                          </div>
                        </div>

                        {/* Reassign dropdown & actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          
                          {/* Reassign Dropdown with Availability Badges */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--np-n500)' }}>REASSIGN:</span>
                            <select
                              value={d.faculty_id}
                              onChange={e => handleReassignDirect(d.id, e.target.value, d.version)}
                              style={{ padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '12px' }}
                            >
                              <option value={d.faculty_id}>{d.faculty_name} (Current)</option>
                              {facultyAvailability.filter(f => f.id !== d.faculty_id).map(f => {
                                const av = getAvailabilityStyle(f.status);
                                return (
                                  <option key={f.id} value={f.id}>
                                    {f.name} ({f.department}) — [{av.label}]
                                  </option>
                                );
                              })}
                            </select>
                          </div>

                          <button 
                            onClick={() => handleRemoveDuty(d.id)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                            title="Remove supervisor"
                          >
                            <Trash2 size={16} />
                          </button>

                        </div>
                      </div>
                    ))}
                  </div>

                </div>
              ))
            )}
          </div>

        </div>

        {/* Right Side: Invigilator Load Balance Visualizer */}
        <div style={{ width: '320px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>Invigilator Load Balance</h3>
            <p style={{ margin: '4px 0 0 0', color: 'var(--np-n500)', fontSize: '11px' }}>Total duties assigned to faculty during this cycle</p>
          </div>
          
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '480px', overflowY: 'auto' }} className="custom-scrollbar">
            {facultyAvailability.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--np-n500)', fontSize: '11px', padding: '20px' }}>Loading workload stats...</div>
            ) : (
              facultyAvailability.map(f => {
                const av = getAvailabilityStyle(f.status);
                return (
                  <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '12px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{f.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                        <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '4px', background: av.bg, color: av.fg, fontWeight: 700 }}>
                          {av.label}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <span style={{ fontSize: '14px', fontWeight: 900, fontFamily: 'var(--font-mono)' }}>{f.workload}</span>
                      <span style={{ fontSize: '8px', color: 'var(--np-n500)', textTransform: 'uppercase', fontWeight: 700 }}>duties</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Manual Allocation Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ width: '100%', maxWidth: '440px', background: 'var(--bg-surface)', border: '2px solid var(--np-ink)', borderRadius: '8px', boxShadow: '6px 6px 0 0 var(--np-ink)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={16} /> Manually Assign Invigilator
              </h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)' }}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleManualAssign} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Select Room */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--np-n500)', display: 'block', marginBottom: '6px' }}>Room Allocation</label>
                <select 
                  value={addForm.room_allocation_id}
                  onChange={e => setAddForm({ ...addForm, room_allocation_id: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px' }}
                >
                  <option value="">Standby (No Room)</option>
                  {roomsList.map(r => (
                    <option key={r.id} value={r.id}>Room {r.room_no} ({r.block})</option>
                  ))}
                </select>
              </div>

              {/* Select Faculty */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--np-n500)', display: 'block', marginBottom: '6px' }}>Faculty Invigilator</label>
                <select 
                  value={addForm.faculty_id}
                  onChange={e => setAddForm({ ...addForm, faculty_id: e.target.value })}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px' }}
                >
                  <option value="">-- Select Faculty --</option>
                  {facultyAvailability.map(f => {
                    const av = getAvailabilityStyle(f.status);
                    return (
                      <option key={f.id} value={f.id} disabled={f.status !== 'available'}>
                        {f.name} ({f.department}) — [{av.label}] {f.status !== 'available' ? `(${f.reason})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Select Role */}
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--np-n500)', display: 'block', marginBottom: '6px' }}>Role</label>
                <select 
                  value={addForm.role}
                  onChange={e => setAddForm({ ...addForm, role: e.target.value })}
                  disabled={!addForm.room_allocation_id} // If Standby, force role to standby
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: '13px' }}
                >
                  {addForm.room_allocation_id ? (
                    <>
                      <option value="primary">Primary Invigilator</option>
                      <option value="co">Co-Invigilator</option>
                    </>
                  ) : (
                    <option value="standby">Standby Invigilator</option>
                  )}
                </select>
              </div>

              <button 
                type="submit"
                disabled={actionLoading}
                style={{
                  marginTop: '8px', width: '100%', padding: '10px', borderRadius: '6px', border: 'none',
                  background: 'var(--np-ink)', color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer'
                }}
              >
                {actionLoading ? 'Assigning...' : 'Assign Supervisor'}
              </button>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
