import { createBackup, listBackups } from './backupService.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKUP_DIR = path.join(__dirname, '../../backups');

const BACKUP_RETENTION_LIMIT = 5;
const AUTO_BACKUP_INTERVAL_MS = 6 * 60 * 60 * 1000; // Run backup every 6 hours

let autoBackupState = {
  lastRun: null,
  status: 'never',
  error: null
};

let autoBackupTimer = null;

export function getAutoBackupStatus() {
  return autoBackupState;
}

export async function runAutoBackup() {
  console.log('💾 Running scheduled database auto-backup...');
  try {
    const result = await createBackup();
    
    // Clean up older backups exceeding retention limit
    const list = await listBackups();
    if (list.length > BACKUP_RETENTION_LIMIT) {
      const toDelete = list.slice(BACKUP_RETENTION_LIMIT);
      for (const item of toDelete) {
        const filepath = path.join(BACKUP_DIR, item.filename);
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
          console.log(`🗑️ Deleted old backup file: ${item.filename} (Retention Policy)`);
        }
      }
    }

    autoBackupState = {
      lastRun: new Date().toISOString(),
      status: 'success',
      error: null
    };
    console.log('✓ Scheduled database auto-backup complete.');
  } catch (err) {
    autoBackupState = {
      lastRun: new Date().toISOString(),
      status: 'fail',
      error: err.message
    };
    console.error('❌ Database auto-backup failed:', err.message);
  }
}

export function initAutoBackupScheduler() {
  if (autoBackupTimer) return;

  // Run initial auto-backup after 10 seconds of server boot, then on interval
  setTimeout(runAutoBackup, 10000);

  autoBackupTimer = setInterval(runAutoBackup, AUTO_BACKUP_INTERVAL_MS);
  console.log('⏰ Database auto-backup scheduler initialized.');
}
