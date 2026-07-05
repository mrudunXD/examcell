import { Router } from 'express';
import crypto from 'crypto';
import { getDb } from '../db/database.js';
import { authenticate, requireCoordinator } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { auditLog } from '../middleware/auditLog.js';
import { FacultyRepository } from '../modules/faculty/facultyRepository.js';

const router = Router();
router.use(authenticate);

// GET all faculty
router.get('/', requireCoordinator, asyncHandler(async (req, res) => {
  const faculty = await FacultyRepository.findAll();
  res.json(faculty);
}));

// POST create faculty account
router.post('/', requireCoordinator, auditLog('CREATE_FACULTY', 'users', (req, data) => data?.id, (req, data) => `Created faculty account for ${data?.name} (${data?.email})`), asyncHandler(async (req, res) => {
  const { name, email, department, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' });
  const id = crypto.randomUUID();
  const faculty = await FacultyRepository.create({
    id,
    name: name.trim(),
    email: email.toLowerCase().trim(),
    department: department?.trim() || '',
    password
  });
  res.status(201).json(faculty);
}));

// PUT update faculty
router.put('/:id', requireCoordinator, auditLog('UPDATE_FACULTY', 'users', (req) => req.params.id, (req, data) => `Updated faculty account for ${data?.name} (${data?.email})`), asyncHandler(async (req, res) => {
  const { name, email, department, password } = req.body;

  // Verify target is indeed a faculty member
  const targetUser = await FacultyRepository.findById(req.params.id);
  if (!targetUser) return res.status(404).json({ error: 'User not found' });
  if (targetUser.role !== 'faculty') {
    return res.status(403).json({ error: 'Only faculty accounts can be modified via this endpoint' });
  }

  const updated = await FacultyRepository.update(req.params.id, {
    name,
    email,
    department,
    password
  });
  res.json(updated);
}));

// DELETE (deactivate) faculty
router.delete('/:id', requireCoordinator, auditLog('DELETE_FACULTY', 'users', (req) => req.params.id, (req) => `Deactivated faculty account ID: ${req.params.id}`), asyncHandler(async (req, res) => {
  const db = getDb();
  // M8: Block deactivation if faculty has upcoming supervisor duties
  const upcomingDuties = await FacultyRepository.checkUpcomingDuties(req.params.id);
  if (upcomingDuties > 0) {
    return res.status(400).json({
      error: `Cannot deactivate: faculty has ${upcomingDuties} upcoming supervisor duties. Reassign them first.`
    });
  }
  await FacultyRepository.softDelete(req.params.id);
  res.json({ success: true });
}));

// GET faculty subjects
router.get('/:id/subjects', asyncHandler(async (req, res) => {
  // H6: Faculty can only view their own subjects; coordinators can view any
  if (req.user.role === 'faculty' && req.user.id !== req.params.id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const subjects = await FacultyRepository.getSubjects(req.params.id);
  res.json(subjects);
}));

// PUT assign subjects to faculty
router.put('/:id/subjects', requireCoordinator, auditLog('ASSIGN_FACULTY_SUBJECTS', 'users', (req) => req.params.id, (req) => `Assigned subjects to faculty ID: ${req.params.id}`), asyncHandler(async (req, res) => {
  const { subject_ids } = req.body; // array of subject IDs
  if (!Array.isArray(subject_ids)) return res.status(400).json({ error: 'subject_ids must be array' });
  if (subject_ids.length > 50) return res.status(400).json({ error: 'Maximum 50 subjects can be assigned to a faculty member.' });

  await FacultyRepository.assignSubjects(req.params.id, subject_ids);
  res.json({ success: true });
}));

export default router;
