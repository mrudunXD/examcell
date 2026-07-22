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
    await db.transaction(async () => {
      // 1. Delete solver_runs & telemetry
      await db.prepare('DELETE FROM solver_runs WHERE cycle_id = ?').run(id);
      await db.prepare('DELETE FROM solver_telemetry WHERE cycle_id = ?').run(id);

      // 2. Delete conflicts
      await db.prepare('DELETE FROM conflicts WHERE cycle_id = ?').run(id);

      // 3. Find all slot IDs for this cycle and delete slot child dependencies
      const slots = await db.prepare('SELECT id FROM exam_slots WHERE cycle_id = ?').all(id);
      for (const slot of slots) {
        const ras = await db.prepare('SELECT id FROM room_allocations WHERE slot_id = ?').all(slot.id);
        for (const ra of ras) {
          await db.prepare('DELETE FROM seat_assignments WHERE room_allocation_id = ?').run(ra.id);
          await db.prepare('DELETE FROM supervisor_duties WHERE room_allocation_id = ?').run(ra.id);
        }
        await db.prepare('DELETE FROM room_allocations WHERE slot_id = ?').run(slot.id);
        await db.prepare('DELETE FROM slot_students WHERE slot_id = ?').run(slot.id);
        await db.prepare('DELETE FROM attendance WHERE slot_id = ?').run(slot.id);
        await db.prepare('DELETE FROM incidents WHERE slot_id = ?').run(slot.id);
      }

      // 4. Delete exam slots
      await db.prepare('DELETE FROM exam_slots WHERE cycle_id = ?').run(id);

      // 5. Delete cycle itself
      await db.prepare('DELETE FROM exam_cycles WHERE id = ?').run(id);
    })();
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
