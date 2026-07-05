import { Router } from 'express';
import { authenticate, requireCoordinator } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { auditLog } from '../middleware/auditLog.js';
import { SubjectRepository } from '../modules/subjects/subjectRepository.js';

function inferBranchFromCode(code, currentBranch) {
  if (!code) return currentBranch;
  const c = code.toUpperCase().trim();
  if (c.startsWith('AID')) return 'CSE';
  if (c.startsWith('AIML')) return 'ECE (AI&ML)';
  if (c.startsWith('CYB') || c.startsWith('CS')) return 'Cyber Security';
  if (c.startsWith('IOT')) return 'IoT';
  if (c.startsWith('AI')) return 'AI';
  if (c.startsWith('DS')) return 'DS';
  if (c.startsWith('MEC')) return 'ME';
  if (c.startsWith('MRA')) return 'MRA';
  if (c.startsWith('CIV')) return 'CE';
  if (c.startsWith('ECE')) return 'ECE';
  if (c.startsWith('CSE')) return 'CSE';
  return currentBranch;
}

const router = Router();
router.use(authenticate);

// GET /subjects/meta — retrieve unique metadata for filters
router.get('/meta', requireCoordinator, asyncHandler(async (req, res) => {
  const meta = await SubjectRepository.getUniqueMeta();
  res.json(meta);
}));

// M16: Restrict subject listing to coordinators — subjects expose exam structure details
router.get('/', requireCoordinator, asyncHandler(async (req, res) => {
  const { page, limit, branch, year, course_type, search } = req.query;
  
  let paginationOptions = {};
  if (limit) {
    const parsedLimit = parseInt(limit, 10);
    const parsedPage = parseInt(page || 1, 10);
    paginationOptions = {
      limit: parsedLimit,
      offset: (parsedPage - 1) * parsedLimit
    };
  }

  const subjects = await SubjectRepository.findPaginated({
    branch,
    year,
    course_type,
    search,
    ...paginationOptions
  });
  
  const total = await SubjectRepository.countActive({ branch, year, course_type, search });
  res.setHeader('X-Total-Count', total);
  res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count');
  res.json(subjects);
}));

router.post('/', requireCoordinator, auditLog('CREATE_SUBJECT', 'subjects', (req, data) => data?.id, (req, data) => `Created subject ${data?.name} (${data?.code})`), asyncHandler(async (req, res) => {
  const { code, name, branch, year, semester, abbreviation, course_type, is_common, branches } = req.body;
  if (!code || !name || !branch || !year || !semester)
    return res.status(400).json({ error: 'code, name, branch, year, semester required' });
  const finalBranch = inferBranchFromCode(code, branch);
  const id = crypto.randomUUID();
  await SubjectRepository.create({
    id,
    code: code.trim(),
    name: name.trim(),
    branch: finalBranch.trim(),
    year,
    semester: parseInt(semester, 10),
    abbreviation,
    course_type,
    is_common,
    branches
  });
  res.status(201).json(await SubjectRepository.findById(id));
}));

router.put('/:id', requireCoordinator, auditLog('UPDATE_SUBJECT', 'subjects', (req) => req.params.id, (req, data) => `Updated subject ${data?.name} (${data?.code})`), asyncHandler(async (req, res) => {
  const { code, name, branch, year, semester, abbreviation, course_type, is_common, branches } = req.body;
  const finalBranch = inferBranchFromCode(code, branch);
  await SubjectRepository.update(req.params.id, {
    code,
    name,
    branch: finalBranch,
    year,
    semester: parseInt(semester, 10),
    abbreviation,
    course_type,
    is_common,
    branches
  });
  res.json(await SubjectRepository.findById(req.params.id));
}));

router.delete('/:id', requireCoordinator, auditLog('DELETE_SUBJECT', 'subjects', (req) => req.params.id, (req) => `Deleted subject ID: ${req.params.id}`), asyncHandler(async (req, res) => {
  const inUse = await SubjectRepository.checkInUse(req.params.id);
  if (inUse > 0) {
    return res.status(400).json({ error: `Cannot delete: subject is used by ${inUse} exam slot(s). Remove those slots first.` });
  }
  await SubjectRepository.delete(req.params.id);
  res.json({ success: true });
}));

export default router;
