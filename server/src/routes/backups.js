import { Router } from 'express';
import { authenticate, requireCoordinator } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { auditLog } from '../middleware/auditLog.js';
import { createBackup, listBackups, restoreBackup } from '../services/backupService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKUP_DIR = path.join(__dirname, '../../backups');

const router = Router();
router.use(authenticate, requireCoordinator);

// GET /api/backups - List backups
router.get('/', asyncHandler(async (req, res) => {
  const list = await listBackups();
  res.json(list);
}));

// POST /api/backups - Trigger backup creation
router.post('/', auditLog('CREATE_BACKUP', 'system', () => 'system', () => 'Created database backup'), asyncHandler(async (req, res) => {
  const result = await createBackup();
  res.status(201).json({ message: 'Backup created successfully', filename: result.filename });
}));

// POST /api/backups/restore - Restore backup from filename
router.post('/restore', auditLog('RESTORE_BACKUP', 'system', () => 'system', (req) => `Restored database backup ${req.body.filename}`), asyncHandler(async (req, res) => {
  const { filename } = req.body;
  if (!filename) return res.status(400).json({ error: 'filename is required' });

  const safeFilename = path.basename(filename);
  const filepath = path.join(BACKUP_DIR, safeFilename);
  if (!filepath.startsWith(BACKUP_DIR + path.sep)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Backup file not found' });

  if (safeFilename.endsWith('.dump')) {
    const result = await restoreBackup(null, safeFilename);
    res.json({ message: 'Database restored successfully via pg_restore', timestamp: new Date().toISOString() });
  } else {
    const backupData = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    const result = await restoreBackup(backupData);
    res.json({ message: 'Database restored successfully', timestamp: result.timestamp });
  }
}));

// POST /api/backups/restore-upload - Upload and restore JSON file directly
router.post('/restore-upload', auditLog('RESTORE_BACKUP_UPLOAD', 'system', () => 'system', () => 'Restored database from direct upload'), asyncHandler(async (req, res) => {
  const backupData = req.body;
  if (!backupData || !backupData.tables) {
    return res.status(400).json({ error: 'Invalid backup file content' });
  }

  const result = await restoreBackup(backupData);
  res.json({ message: 'Database restored successfully', timestamp: result.timestamp });
}));

// GET /api/backups/download/:filename - Download backup file
router.get('/download/:filename', asyncHandler(async (req, res) => {
  const filename = path.basename(req.params.filename); // strips all path traversal sequences
  const filepath = path.join(BACKUP_DIR, filename);
  if (!filepath.startsWith(BACKUP_DIR + path.sep) && filepath !== BACKUP_DIR) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Backup file not found' });

  res.download(filepath, filename);
}));

// DELETE /api/backups/:filename - Delete a backup file
router.delete('/:filename', auditLog('DELETE_BACKUP', 'system', () => 'system', (req) => `Deleted database backup ${req.params.filename}`), asyncHandler(async (req, res) => {
  const filename = path.basename(req.params.filename);
  const filepath = path.join(BACKUP_DIR, filename);
  if (!filepath.startsWith(BACKUP_DIR + path.sep)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'Backup file not found' });

  fs.unlinkSync(filepath);
  res.json({ message: 'Backup file deleted successfully' });
}));

export default router;
