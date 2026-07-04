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
  const id = crypto.randomUUID();
  await ClassroomRepository.create({
    id,
    room_no: room_no.trim(),
    block: block.trim(),
    capacity: parseInt(capacity, 10),
    bench_rows: parseInt(bench_rows, 10),
    bench_cols: parseInt(bench_cols, 10),
    is_online: is_online ? 1 : 0
  });
  res.status(201).json(await ClassroomRepository.findById(id));
}));

router.put('/:id', requireCoordinator, auditLog('UPDATE_CLASSROOM', 'classrooms', (req) => req.params.id, (req, data) => `Updated classroom Room ${data?.room_no}`), asyncHandler(async (req, res) => {
  const { room_no, block, capacity, bench_rows, bench_cols, is_online, version } = req.body;
  
  if (version !== undefined) {
    const result = await ClassroomRepository.updateWithVersion(req.params.id, {
      room_no,
      block,
      capacity: parseInt(capacity, 10),
      bench_rows: parseInt(bench_rows, 10),
      bench_cols: parseInt(bench_cols, 10),
      is_online: is_online ? 1 : 0
    }, parseInt(version, 10));
    if (result.changes === 0) {
      return res.status(409).json({ error: 'Conflict: Classroom was updated by another coordinator. Please refresh.' });
    }
  } else {
    await ClassroomRepository.update(req.params.id, {
      room_no,
      block,
      capacity: parseInt(capacity, 10),
      bench_rows: parseInt(bench_rows, 10),
      bench_cols: parseInt(bench_cols, 10),
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
