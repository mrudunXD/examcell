import { getDb } from '../../db/database.js';

export class SubjectRepository {
  static async findAll() {
    const db = getDb();
    return await db.prepare('SELECT * FROM subjects ORDER BY semester, code').all();
  }

  static async findPaginated({ branch, year, course_type, search, limit, offset }) {
    const db = getDb();
    let query = 'SELECT * FROM subjects WHERE 1=1';
    const params = [];
    if (branch)      { query += ' AND branch = ?';      params.push(branch); }
    if (year)        { query += ' AND year = ?';        params.push(year); }
    if (course_type) { query += ' AND course_type = ?'; params.push(course_type); }
    if (search)      {
      query += ' AND (name LIKE ? OR code LIKE ? OR abbreviation LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    query += ' ORDER BY semester, code';
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
      `INSERT INTO subjects (id, code, name, branch, year, semester, abbreviation, course_type, is_common, branches)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      subject.id,
      subject.code,
      subject.name,
      subject.branch,
      subject.year,
      subject.semester,
      subject.abbreviation || null,
      subject.course_type || null,
      subject.is_common ? 1 : 0,
      subject.is_common && subject.branches ? JSON.stringify(subject.branches) : null
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
        course_type = ?,
        is_common = ?,
        branches = ?
       WHERE id = ?`
    ).run(
      subject.code,
      subject.name,
      subject.branch,
      subject.year,
      subject.semester,
      subject.abbreviation || null,
      subject.course_type || null,
      subject.is_common ? 1 : 0,
      subject.is_common && subject.branches ? JSON.stringify(subject.branches) : null,
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

  static async countActive({ branch, year, course_type, search } = {}) {
    const db = getDb();
    let query = 'SELECT COUNT(*) as cnt FROM subjects WHERE 1=1';
    const params = [];
    if (branch)      { query += ' AND branch = ?';      params.push(branch); }
    if (year)        { query += ' AND year = ?';        params.push(year); }
    if (course_type) { query += ' AND course_type = ?'; params.push(course_type); }
    if (search)      {
      query += ' AND (name LIKE ? OR code LIKE ? OR abbreviation LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    const row = await db.prepare(query).get(...params);
    return row?.cnt || 0;
  }

  static async getUniqueMeta() {
    const db = getDb();
    const branches = (await db.prepare('SELECT DISTINCT branch FROM subjects ORDER BY branch').all()).map(r => r.branch);
    const courseTypes = (await db.prepare("SELECT DISTINCT course_type FROM subjects WHERE course_type IS NOT NULL AND course_type != '' ORDER BY course_type").all()).map(r => r.course_type);
    return { branches, courseTypes };
  }
}
