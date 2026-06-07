import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import path from 'path';

import authRoutes from './routes/auth.js';
import studentRoutes from './routes/students.js';
import subjectRoutes from './routes/subjects.js';
import classroomRoutes from './routes/classrooms.js';
import facultyRoutes from './routes/faculty.js';
import examCycleRoutes from './routes/examCycles.js';
import seatingRoutes from './routes/seating.js';
import supervisorRoutes from './routes/supervisors.js';
import conflictRoutes from './routes/conflicts.js';
import exportRoutes from './routes/export.js';
import dashboardRoutes from './routes/dashboard.js';
import auditRoutes from './routes/audit.js';
import attendanceRouter from './routes/attendance.js';
import searchRouter from './routes/search.js';

import { initDb } from './db/database.js';
import { errorHandler } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize DB
initDb();

// Middleware
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static exports dir
app.use('/exports', express.static(path.join(__dirname, '../exports')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/classrooms', classroomRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/exam-cycles', examCycleRoutes);
app.use('/api/seating', seatingRoutes);
app.use('/api/supervisors', supervisorRoutes);
app.use('/api/conflicts', conflictRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/attendance', attendanceRouter);
app.use('/api/search', searchRouter);

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`\n🎓 MIT WPU Exam Management Server running on http://localhost:${PORT}\n`);
});

export default app;
