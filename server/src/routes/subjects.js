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

// M16: Restrict subject listing to coordinators — subjects expose exam structure details
router.get('/', requireCoordinator, asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  
  let paginationOptions = {};
  if (limit) {
    const parsedLimit = parseInt(limit, 10);
    const parsedPage = parseInt(page || 1, 10);
    paginationOptions = {
      limit: parsedLimit,
      offset: (parsedPage - 1) * parsedLimit
    };
  }

  const subjects = await SubjectRepository.findPaginated(paginationOptions);
  res.json(subjects);
}));

router.post('/', requireCoordinator, auditLog('CREATE_SUBJECT', 'subjects', (req, data) => data?.id, (req, data) => `Created subject ${data?.name} (${data?.code})`), asyncHandler(async (req, res) => {
  const { code, name, branch, year, semester, abbreviation, course_type } = req.body;
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
    course_type
  });
  res.status(201).json(await SubjectRepository.findById(id));
}));

router.put('/:id', requireCoordinator, auditLog('UPDATE_SUBJECT', 'subjects', (req) => req.params.id, (req, data) => `Updated subject ${data?.name} (${data?.code})`), asyncHandler(async (req, res) => {
  const { code, name, branch, year, semester, abbreviation, course_type } = req.body;
  const finalBranch = inferBranchFromCode(code, branch);
  await SubjectRepository.update(req.params.id, {
    code,
    name,
    branch: finalBranch,
    year,
    semester: parseInt(semester, 10),
    abbreviation,
    course_type
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
