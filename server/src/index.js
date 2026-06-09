import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import path from 'path';
import http from 'http';
import { initSocket } from './services/socket.js';

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
import broadcastRouter from './routes/broadcasts.js';
import incidentRouter from './routes/incidents.js';
import analyticsRouter from './routes/analytics.js';
import publicRouter from './routes/public.js';
import healthRouter from './routes/health.js';
import backupRouter from './routes/backups.js';
import replacementRouter from './routes/replacements.js';
import { initAutoBackupScheduler } from './services/autoBackup.js';
import { initAlertingMonitor } from './services/alerting.js';




import { initDb } from './db/database.js';
import { errorHandler } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Add CSP and secure HTTP headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws://localhost:5000", "http://localhost:5000", "ws://localhost:5173"]
    }
  }
}));

// Apply DDoS and reconnect storm rate limiting
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 1000, // Safe limit accommodating localhost tests
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again after a minute.' }
});
app.use('/api', apiLimiter);

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
app.use('/api/public', publicRouter);
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
app.use('/api/broadcasts', broadcastRouter);
app.use('/api/incidents', incidentRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/health', healthRouter);
app.use('/api/backups', backupRouter);
app.use('/api/replacements', replacementRouter);




app.use(errorHandler);

const server = http.createServer(app);
initSocket(server);

server.listen(PORT, () => {
  console.log(`\n🎓 MIT WPU Exam Management Server running on http://localhost:${PORT}\n`);
  initAutoBackupScheduler();
  initAlertingMonitor();
});

export default app;
