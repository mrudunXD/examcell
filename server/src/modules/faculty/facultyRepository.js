import { getDb } from '../../db/database.js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export class FacultyRepository {
  static async findAll() {
    const db = getDb();
    const faculty = await db.prepare("SELECT id, name, email, role, department, is_active, created_at FROM users WHERE role='faculty' ORDER BY name").all();
    const subjectStmt = db.prepare(`
      SELECT s.* FROM subjects s
      JOIN faculty_subjects fs ON fs.subject_id = s.id
      WHERE fs.faculty_id = ?
    `);
    return faculty.map(f => ({ ...f, subjects: subjectStmt.all(f.id) }));
  }

  static async findById(id) {
    const db = getDb();
    const faculty = await db.prepare("SELECT id, name, email, role, department, is_active FROM users WHERE id=? AND role='faculty'").get(id);
    if (!faculty) return null;
    const subjectStmt = db.prepare(`
      SELECT s.* FROM subjects s
      JOIN faculty_subjects fs ON fs.subject_id = s.id
      WHERE fs.faculty_id = ?
    `);
    faculty.subjects = subjectStmt.all(id);
    return faculty;
  }

  static async create(faculty) {
    const db = getDb();
    const hash = bcrypt.hashSync(faculty.password, 10);
    const id = faculty.id || crypto.randomUUID();
    await db.prepare('INSERT INTO users (id, name, email, password_hash, role, department) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, faculty.name.trim(), faculty.email.toLowerCase().trim(), hash, 'faculty', faculty.department?.trim() || '');
    return await this.findById(id);
  }

  static async update(id, faculty) {
    const db = getDb();
    if (faculty.password) {
      const hash = bcrypt.hashSync(faculty.password, 10);
      await db.prepare("UPDATE users SET name=?, email=?, department=?, password_hash=?, updated_at=datetime('now') WHERE id=? AND role='faculty'")
        .run(faculty.name, faculty.email, faculty.department, hash, id);
    } else {
      await db.prepare("UPDATE users SET name=?, email=?, department=?, updated_at=datetime('now') WHERE id=? AND role='faculty'")
        .run(faculty.name, faculty.email, faculty.department, id);
    }
    return await this.findById(id);
  }

  static async softDelete(id) {
    const db = getDb();
    return await db.prepare("UPDATE users SET is_active=0 WHERE id=? AND role='faculty'").run(id);
  }

  static async getSubjects(facultyId) {
    const db = getDb();
    return await db.prepare(`
      SELECT s.* FROM subjects s
      JOIN faculty_subjects fs ON fs.subject_id = s.id
      WHERE fs.faculty_id = ?
    `).all(facultyId);
  }

  static async assignSubjects(facultyId, subjectIds) {
    const db = getDb();
    const deleteStmt = db.prepare('DELETE FROM faculty_subjects WHERE faculty_id=?');
    const insertStmt = db.prepare('INSERT INTO faculty_subjects (faculty_id, subject_id) VALUES (?, ?)');
    
    const executeTx = db.transaction(() => {
      deleteStmt.run(facultyId);
      for (const sid of subjectIds) {
        insertStmt.run(facultyId, sid);
      }
    });
    await executeTx();
    return { success: true };
  }

  static async checkUpcomingDuties(facultyId) {
    const db = getDb();
    const upcomingDuties = await db.prepare(`
      SELECT COUNT(*) as cnt FROM supervisor_duties sd
      JOIN room_allocations ra ON ra.id = sd.room_allocation_id
      JOIN exam_slots es ON es.id = ra.slot_id
      WHERE sd.faculty_id = ? AND es.date >= CURRENT_DATE
    `).get(facultyId);
    return upcomingDuties?.cnt || 0;
  }
}