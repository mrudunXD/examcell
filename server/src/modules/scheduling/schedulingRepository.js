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
