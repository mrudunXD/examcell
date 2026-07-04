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

  static async findAllActiveOrdered() {
    const db = getDb();
    return await db.prepare('SELECT * FROM classrooms WHERE is_active = 1 ORDER BY block, room_no').all();
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

  static async updateWithVersion(id, classroom, version) {
    const db = getDb();
    return await db.prepare(
      `UPDATE classrooms SET 
        room_no = ?, 
        block = ?, 
        capacity = ?, 
        bench_rows = ?, 
        bench_cols = ?, 
        is_online = ?, 
        version = version + 1 
       WHERE id = ? AND version = ?`
    ).run(
      classroom.room_no,
      classroom.block,
      classroom.capacity,
      classroom.bench_rows,
      classroom.bench_cols,
      classroom.is_online || 0,
      id,
      version
    );
  }

  static async softDelete(id) {
    const db = getDb();
    return await db.prepare('UPDATE classrooms SET is_active = 0 WHERE id = ?').run(id);
  }
}
