import { getDb } from '../../db/database.js';

export class SubjectRepository {
  static async findAll() {
    const db = getDb();
    return await db.prepare('SELECT * FROM subjects ORDER BY semester, code').all();
  }

  static async findPaginated({ limit, offset }) {
    const db = getDb();
    let query = 'SELECT * FROM subjects ORDER BY semester, code';
    const params = [];
    if (limit !== undefined && offset !== undefined) {
      query += ' LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset));
    }
    return await db.prepare(query).all(...params);
  }

  static async findById(id) {
    const db = getDb();
    return await db.prepare('SELECT * FROM subjects WHERE id = ?').get(id);
  }

  static async create(subject) {
    const db = getDb();
    return await db.prepare(
      `INSERT INTO subjects (id, code, name, branch, year, semester, abbreviation, course_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      subject.id,
      subject.code,
      subject.name,
      subject.branch,
      subject.year,
      subject.semester,
      subject.abbreviation || null,
      subject.course_type || null
    );
  }

  static async update(id, subject) {
    const db = getDb();
    return await db.prepare(
      `UPDATE subjects SET 
        code = ?, 
        name = ?, 
        branch = ?, 
        year = ?, 
        semester = ?, 
        abbreviation = ?, 
        course_type = ?
       WHERE id = ?`
    ).run(
      subject.code,
      subject.name,
      subject.branch,
      subject.year,
      subject.semester,
      subject.abbreviation || null,
      subject.course_type || null,
      id
    );
  }

  static async checkInUse(id) {
    const db = getDb();
    const row = await db.prepare('SELECT COUNT(*) as cnt FROM exam_slots WHERE subject_id = ?').get(id);
    return row?.cnt || 0;
  }

  static async delete(id) {
    const db = getDb();
    return await db.prepare('DELETE FROM subjects WHERE id = ?').run(id);
  }
}
