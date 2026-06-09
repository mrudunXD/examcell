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
import attendanceLogsRouter from './routes/attendanceLogs.js';
import facultyLeavesRouter from './routes/facultyLeaves.js';
import subjectConstraintsRouter from './routes/subjectConstraints.js';
import { initAutoBackupScheduler } from './services/autoBackup.js';
import { initAlertingMonitor } from './services/alerting.js';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';




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
// Swagger OpenAPI configuration options
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'MIT WPU Exam Management System API',
      version: '1.0.0',
      description: 'API contract documentation for the Exam Cell platform, supporting scheduling, room allocation, seating plans, invigilator rotations, and live telemetry.',
    },
    servers: [
      {
        url: 'http://localhost:5000/api/v1',
        description: 'V1 API Server',
      },
    ],
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Prometheus telemetry metrics exporter
app.get('/metrics', async (req, res) => {
  try {
    const { getPrometheusMetrics, getMetricsContentType } = await import('./services/metrics.js');
    res.set('Content-Type', getMetricsContentType());
    res.end(await getPrometheusMetrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
});

// Versioned Ingress Router
const v1Router = express.Router();
v1Router.use('/auth', authRoutes);
v1Router.use('/public', publicRouter);
v1Router.use('/students', studentRoutes);
v1Router.use('/subjects', subjectRoutes);
v1Router.use('/classrooms', classroomRoutes);
v1Router.use('/faculty', facultyRoutes);
v1Router.use('/exam-cycles', examCycleRoutes);
v1Router.use('/seating', seatingRoutes);
v1Router.use('/supervisors', supervisorRoutes);
v1Router.use('/conflicts', conflictRoutes);
v1Router.use('/export', exportRoutes);
v1Router.use('/dashboard', dashboardRoutes);
v1Router.use('/audit', auditRoutes);
v1Router.use('/attendance', attendanceRouter);
v1Router.use('/search', searchRouter);
v1Router.use('/broadcasts', broadcastRouter);
v1Router.use('/incidents', incidentRouter);
v1Router.use('/analytics', analyticsRouter);
v1Router.use('/health', healthRouter);
v1Router.use('/backups', backupRouter);
v1Router.use('/replacements', replacementRouter);
v1Router.use('/attendance-logs', attendanceLogsRouter);
v1Router.use('/faculty-leaves', facultyLeavesRouter);
v1Router.use('/subject-constraints', subjectConstraintsRouter);

app.use('/api/v1', v1Router);
app.use('/api', v1Router); // Client compatibility alias




app.use(errorHandler);

const server = http.createServer(app);
initSocket(server);

server.listen(PORT, () => {
  console.log(`\n🎓 MIT WPU Exam Management Server running on http://localhost:${PORT}\n`);
  initAutoBackupScheduler();
  initAlertingMonitor();
});

export default app;
