import { Router } from 'express';
import { authenticate, requireCoordinator } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { auditLog } from '../middleware/auditLog.js';
import { ClassroomRepository } from '../modules/classrooms/classroomRepository.js';

const router = Router();
router.use(authenticate);

// M15: Restrict room listing to coordinators — faculty don't need to enumerate all rooms/layouts
router.get('/', requireCoordinator, asyncHandler(async (req, res) => {
  res.json(await ClassroomRepository.findAllActiveOrdered());
}));

router.post('/', requireCoordinator, auditLog('CREATE_CLASSROOM', 'classrooms', (req, data) => data?.id, (req, data) => `Created classroom Room ${data?.room_no} (block: ${data?.block}, capacity: ${data?.capacity})`), asyncHandler(async (req, res) => {
  const { room_no, block, capacity, bench_rows, bench_cols, is_online } = req.body;
  if (!room_no || !block || !capacity || !bench_rows || !bench_cols) return res.status(400).json({ error: 'All fields required' });
  if (room_no.trim().length > 20) return res.status(400).json({ error: 'room_no must be 20 characters or fewer' });
  if (block.trim().length > 10) return res.status(400).json({ error: 'block must be 10 characters or fewer' });
  const parsedCapacity = parseInt(capacity, 10);
  const parsedRows = parseInt(bench_rows, 10);
  const parsedCols = parseInt(bench_cols, 10);
  if (isNaN(parsedCapacity) || parsedCapacity < 1 || parsedCapacity > 500) return res.status(400).json({ error: 'capacity must be a positive integer (1–500)' });
  if (isNaN(parsedRows) || parsedRows < 1 || parsedRows > 50) return res.status(400).json({ error: 'bench_rows must be between 1 and 50' });
  if (isNaN(parsedCols) || parsedCols < 1 || parsedCols > 20) return res.status(400).json({ error: 'bench_cols must be between 1 and 20' });
  const id = crypto.randomUUID();
  await ClassroomRepository.create({
    id,
    room_no: room_no.trim(),
    block: block.trim(),
    capacity: parsedCapacity,
    bench_rows: parsedRows,
    bench_cols: parsedCols,
    is_online: is_online ? 1 : 0
  });
  res.status(201).json(await ClassroomRepository.findById(id));
}));

router.put('/:id', requireCoordinator, auditLog('UPDATE_CLASSROOM', 'classrooms', (req) => req.params.id, (req, data) => `Updated classroom Room ${data?.room_no}`), asyncHandler(async (req, res) => {
  const { room_no, block, capacity, bench_rows, bench_cols, is_online, version } = req.body;
  if (!room_no || !block || !capacity || !bench_rows || !bench_cols) return res.status(400).json({ error: 'All fields required' });
  if (room_no.trim().length > 20) return res.status(400).json({ error: 'room_no must be 20 characters or fewer' });
  if (block.trim().length > 10) return res.status(400).json({ error: 'block must be 10 characters or fewer' });
  const parsedCapacity = parseInt(capacity, 10);
  const parsedRows = parseInt(bench_rows, 10);
  const parsedCols = parseInt(bench_cols, 10);
  if (isNaN(parsedCapacity) || parsedCapacity < 1 || parsedCapacity > 500) return res.status(400).json({ error: 'capacity must be a positive integer (1–500)' });
  if (isNaN(parsedRows) || parsedRows < 1 || parsedRows > 50) return res.status(400).json({ error: 'bench_rows must be between 1 and 50' });
  if (isNaN(parsedCols) || parsedCols < 1 || parsedCols > 20) return res.status(400).json({ error: 'bench_cols must be between 1 and 20' });
  
  if (version !== undefined) {
    const result = await ClassroomRepository.updateWithVersion(req.params.id, {
      room_no: room_no.trim(),
      block: block.trim(),
      capacity: parsedCapacity,
      bench_rows: parsedRows,
      bench_cols: parsedCols,
      is_online: is_online ? 1 : 0
    }, parseInt(version, 10));
    if (result.changes === 0) {
      return res.status(409).json({ error: 'Conflict: Classroom was updated by another coordinator. Please refresh.' });
    }
  } else {
    await ClassroomRepository.update(req.params.id, {
      room_no: room_no.trim(),
      block: block.trim(),
      capacity: parsedCapacity,
      bench_rows: parsedRows,
      bench_cols: parsedCols,
      is_online: is_online ? 1 : 0
    });
  }
  res.json(await ClassroomRepository.findById(req.params.id));
}));

router.delete('/:id', requireCoordinator, auditLog('DELETE_CLASSROOM', 'classrooms', (req) => req.params.id, (req) => `Soft-deleted classroom ID: ${req.params.id}`), asyncHandler(async (req, res) => {
  await ClassroomRepository.softDelete(req.params.id);
  res.json({ success: true });
}));

export default router;
