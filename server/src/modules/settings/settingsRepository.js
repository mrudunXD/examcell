import { getDb } from '../../db/database.js';
import crypto from 'crypto';

let settingsCache = null;

export class SettingsRepository {
  static clearCache() {
    settingsCache = null;
  }

  static async findAll() {
    if (settingsCache) return settingsCache;
    const db = getDb();
    const result = await db.prepare('SELECT * FROM system_settings ORDER BY category, key').all();
    settingsCache = result;
    return result;
  }

  static async findByKey(key) {
    if (settingsCache) {
      const found = settingsCache.find(s => s.key === key);
      if (found) return found;
    }
    const db = getDb();
    return await db.prepare('SELECT * FROM system_settings WHERE key = ?').get(key);
  }

  static async updateSettings(settingsMap, userId) {
    const db = getDb();

    const updateStmt = db.prepare(`
      UPDATE system_settings
      SET value = ?, updated_by = ?, updated_at = datetime('now')
      WHERE key = ?
    `);

    const logHistoryStmt = db.prepare(`
      INSERT INTO system_settings_history (id, setting_key, old_value, new_value, updated_by)
      VALUES (?, ?, ?, ?, ?)
    `);

    // Wrap in transaction
    const executeTx = db.transaction(() => {
      let updatedCount = 0;
      for (const [key, value] of Object.entries(settingsMap)) {
        const current = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key);
        if (!current) continue; // Skip unknown setting keys

        const strValue = String(value);
        if (current.value !== strValue) {
          updateStmt.run(strValue, userId, key);
          logHistoryStmt.run(crypto.randomUUID(), key, current.value, strValue, userId);
          updatedCount++;
        }
      }
      return updatedCount;
    });

    const result = executeTx();
    SettingsRepository.clearCache();
    return result;
  }

  static async resetToDefaults(userId) {
    const db = getDb();

    const logHistoryStmt = db.prepare(`
      INSERT INTO system_settings_history (id, setting_key, old_value, new_value, updated_by)
      VALUES (?, ?, ?, ?, ?)
    `);

    const executeTx = db.transaction(() => {
      const allSettings = db.prepare('SELECT key, value, default_value FROM system_settings').all();
      let resetCount = 0;

      for (const s of allSettings) {
        if (s.value !== s.default_value) {
          db.prepare(`
            UPDATE system_settings
            SET value = default_value, updated_by = ?, updated_at = datetime('now')
            WHERE key = ?
          `).run(userId, s.key);

          logHistoryStmt.run(crypto.randomUUID(), s.key, s.value, s.default_value, userId);
          resetCount++;
        }
      }
      return resetCount;
    });

    const result = executeTx();
    SettingsRepository.clearCache();
    return result;
  }

  static async getHistory() {
    const db = getDb();
    return await db.prepare(`
      SELECT h.*, u.name as updated_by_name
      FROM system_settings_history h
      LEFT JOIN users u ON u.id = h.updated_by
      ORDER BY h.updated_at DESC
      LIMIT 150
    `).all();
  }
}
