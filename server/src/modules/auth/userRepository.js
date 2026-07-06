import { getDb } from '../../db/database.js';
import crypto from 'crypto';

export class UserRepository {
  static async findById(id) {
    const db = getDb();
    return await db.prepare(
      'SELECT id, name, email, role, department, updated_at, must_change_password, is_active FROM users WHERE id = ?'
    ).get(id);
  }

  static async findActiveById(id) {
    const db = getDb();
    return await db.prepare(
      'SELECT id, name, email, role, department, updated_at, must_change_password FROM users WHERE id = ? AND is_active = 1'
    ).get(id);
  }

  static async findByEmail(email) {
    const db = getDb();
    return await db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  }

  static async updateLockout(id, failedAttempts, lockoutUntil) {
    const db = getDb();
    return await db.prepare(
      'UPDATE users SET failed_login_attempts = ?, lockout_until = ? WHERE id = ?'
    ).run(failedAttempts, lockoutUntil, id);
  }

  static async resetLockout(id) {
    const db = getDb();
    return await db.prepare(
      'UPDATE users SET failed_login_attempts = 0, lockout_until = NULL WHERE id = ?'
    ).run(id);
  }

  static async updatePassword(id, passwordHash) {
    const db = getDb();
    const action = db.transaction(() => {
      // 1. Update user password fields
      db.prepare(
        `UPDATE users SET 
          password_hash = ?, 
          must_change_password = 0, 
          failed_login_attempts = 0, 
          lockout_until = NULL, 
          last_password_change = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`
      ).run(passwordHash, id);

      // 2. Insert into password_history
      db.prepare(
        `INSERT INTO password_history (id, user_id, password_hash)
         VALUES (?, ?, ?)`
      ).run(crypto.randomUUID(), id, passwordHash);
    });
    return action();
  }

  static async updateProfile(id, { name, email, department }) {
    const db = getDb();
    return await db.prepare(
      `UPDATE users SET name = ?, email = ?, department = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).run(name, email, department, id);
  }
}
