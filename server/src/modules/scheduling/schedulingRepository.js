import { getDb } from '../../db/database.js';

export class SchedulingRepository {
  static async findAllCycles() {
    const db = getDb();
    return await db.prepare('SELECT * FROM exam_cycles ORDER BY start_date DESC').all();
  }

  static async findCycleById(id) {
    const db = getDb();
    return await db.prepare('SELECT * FROM exam_cycles WHERE id = ?').get(id);
  }

  static async createCycle(cycle) {
    const db = getDb();
    return await db.prepare(
      `INSERT INTO exam_cycles (id, name, start_date, end_date, semester_type, status, created_by, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
    ).run(
      cycle.id,
      cycle.name,
      cycle.start_date,
      cycle.end_date,
      cycle.semester_type || 'odd',
      cycle.status || 'draft',
      cycle.created_by
    );
  }

  static async updateCycle(id, cycle, version) {
    const db = getDb();
    return await db.prepare(
      `UPDATE exam_cycles SET 
        name = ?,
        start_date = ?,
        end_date = ?,
        status = ?,
        semester_type = ?,
        version = version + 1,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND version = ?`
    ).run(
      cycle.name,
      cycle.start_date,
      cycle.end_date,
      cycle.status,
      cycle.semester_type || 'odd',
      id,
      version
    );
  }

  static async deleteCycle(id) {
    const db = getDb();
    return await db.prepare('DELETE FROM exam_cycles WHERE id = ?').run(id);
  }

  static async promoteCycleToActive(id) {
    const db = getDb();
    return await db.prepare(
      "UPDATE exam_cycles SET status='active', updated_at=datetime('now') WHERE id = ?"
    ).run(id);
  }

  static async demoteActiveCycles(excludeId) {
    const db = getDb();
    return await db.prepare(
      "UPDATE exam_cycles SET status='draft', updated_at=datetime('now') WHERE status='active' AND id != ?"
    ).run(excludeId);
  }

  static async findSlotsByCycleId(cycleId) {
    const db = getDb();
    return await db.prepare('SELECT * FROM exam_slots WHERE cycle_id = ?').all(cycleId);
  }

  static async deleteSlotsByCycleId(cycleId) {
    const db = getDb();
    return await db.prepare('DELETE FROM exam_slots WHERE cycle_id = ?').run(cycleId);
  }

  static async deleteConflictsByCycleId(cycleId) {
    const db = getDb();
    return await db.prepare('DELETE FROM conflicts WHERE cycle_id = ?').run(cycleId);
  }
}
