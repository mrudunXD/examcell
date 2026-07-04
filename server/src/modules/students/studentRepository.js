import { getDb } from '../../db/database.js';

export class StudentRepository {
  static async findAllActive() {
    const db = getDb();
    return await db.prepare('SELECT * FROM students WHERE is_active = 1').all();
  }

  static async findPaginatedActive({ branch, year, section, search, limit, offset }) {
    const db = getDb();
    let query = 'SELECT * FROM students WHERE is_active = 1';
    const params = [];
    if (branch)   { query += ' AND branch = ?';   params.push(branch); }
    if (year)     { query += ' AND year = ?';     params.push(year); }
    if (section)  { query += ' AND section = ?';  params.push(section); }
    if (search)   {
      query += ' AND (name LIKE ? OR prn LIKE ? OR roll_no LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    query += ' ORDER BY year, branch, section, roll_no';
    if (limit !== undefined && offset !== undefined) {
      query += ' LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset));
    }
    return await db.prepare(query).all(...params);
  }

  static async findById(id) {
    const db = getDb();
    return await db.prepare('SELECT * FROM students WHERE id = ?').get(id);
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

  static async updateFull(id, student) {
    const db = getDb();
    return await db.prepare(
      `UPDATE students SET 
        name = ?, 
        prn = ?,
        roll_no = ?, 
        branch = ?, 
        section = ?, 
        year = ?, 
        semester = ?,
        updated_at = datetime('now')
       WHERE id = ? AND is_active = 1`
    ).run(
      student.name,
      student.prn,
      student.roll_no,
      student.branch,
      student.section || null,
      student.year,
      student.semester,
      id
    );
  }

  static async softDelete(id) {
    const db = getDb();
    return await db.prepare('UPDATE students SET is_active = 0 WHERE id = ?').run(id);
  }
}
