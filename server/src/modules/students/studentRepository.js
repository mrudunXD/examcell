import { getDb } from '../../db/database.js';

export class StudentRepository {
  static async findAllActive() {
    const db = getDb();
    return await db.prepare('SELECT * FROM students WHERE is_active = 1').all();
  }

  static async findActiveForSolver() {
    const db = getDb();
    return await db.prepare('SELECT id, name, prn, roll_no, branch, year, semester, section FROM students WHERE is_active = 1').all();
  }

  static async countByPrn(prn) {
    const db = getDb();
    const row = await db.prepare('SELECT COUNT(*) as cnt FROM students WHERE prn = ?').get(prn);
    return row?.cnt || 0;
  }

  static async create(student) {
    const db = getDb();
    return await db.prepare(
      `INSERT INTO students (id, name, prn, roll_no, branch, section, year, semester)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      student.id,
      student.name,
      student.prn,
      student.roll_no,
      student.branch,
      student.section || null,
      student.year,
      student.semester
    );
  }

  static async update(id, student) {
    const db = getDb();
    return await db.prepare(
      `UPDATE students SET 
        name = ?, 
        roll_no = ?, 
        branch = ?, 
        section = ?, 
        year = ?, 
        semester = ? 
       WHERE id = ?`
    ).run(
      student.name,
      student.roll_no,
      student.branch,
      student.section || null,
      student.year,
      student.semester,
      id
    );
  }
}
