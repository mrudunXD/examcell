import { getDb } from '../../db/database.js';

export class ClassroomRepository {
  static async findAll() {
    const db = getDb();
    return await db.prepare('SELECT * FROM classrooms ORDER BY room_no').all();
  }

  static async findAllActive() {
    const db = getDb();
    return await db.prepare('SELECT * FROM classrooms WHERE is_active = 1').all();
  }

  static async findById(id) {
    const db = getDb();
    return await db.prepare('SELECT * FROM classrooms WHERE id = ?').get(id);
  }

  static async create(classroom) {
    const db = getDb();
    return await db.prepare(
      `INSERT INTO classrooms (id, room_no, block, capacity, bench_rows, bench_cols, is_online)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      classroom.id,
      classroom.room_no,
      classroom.block,
      classroom.capacity,
      classroom.bench_rows,
      classroom.bench_cols,
      classroom.is_online || 0
    );
  }

  static async update(id, classroom) {
    const db = getDb();
    return await db.prepare(
      `UPDATE classrooms SET 
        room_no = ?,
        block = ?,
        capacity = ?, 
        bench_rows = ?, 
        bench_cols = ?, 
        is_online = ? 
       WHERE id = ?`
    ).run(
      classroom.room_no,
      classroom.block,
      classroom.capacity,
      classroom.bench_rows,
      classroom.bench_cols,
      classroom.is_online || 0,
      id
    );
  }
}
