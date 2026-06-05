import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/index.js';
import Layout from './components/Layout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import StudentsPage from './pages/StudentsPage.jsx';
import SubjectsPage from './pages/SubjectsPage.jsx';
import ClassroomsPage from './pages/ClassroomsPage.jsx';
import FacultyPage from './pages/FacultyPage.jsx';
import ExamCyclesPage from './pages/ExamCyclesPage.jsx';
import SeatingPage from './pages/SeatingPage.jsx';
import SupervisorsPage from './pages/SupervisorsPage.jsx';
import ConflictsPage from './pages/ConflictsPage.jsx';
import ExportPage from './pages/ExportPage.jsx';
import FacultyDutyPage from './pages/FacultyDutyPage.jsx';
import AuditPage from './pages/AuditPage.jsx';

function ProtectedRoute({ children, role }) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user } = useAuthStore();

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1f2937',
            color: '#f9fafb',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '10px',
            fontSize: '13px',
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#1f2937' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#1f2937' } },
        }}
      />
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={
            user?.role === 'faculty'
              ? <Navigate to="/my-duties" replace />
              : <DashboardPage />
          } />
          <Route path="dashboard" element={<ProtectedRoute role="coordinator"><DashboardPage /></ProtectedRoute>} />
          <Route path="students" element={<ProtectedRoute role="coordinator"><StudentsPage /></ProtectedRoute>} />
          <Route path="subjects" element={<ProtectedRoute role="coordinator"><SubjectsPage /></ProtectedRoute>} />
          <Route path="classrooms" element={<ProtectedRoute role="coordinator"><ClassroomsPage /></ProtectedRoute>} />
          <Route path="faculty" element={<ProtectedRoute role="coordinator"><FacultyPage /></ProtectedRoute>} />
          <Route path="exam-cycles" element={<ProtectedRoute role="coordinator"><ExamCyclesPage /></ProtectedRoute>} />
          <Route path="seating/:slotId" element={<ProtectedRoute role="coordinator"><SeatingPage /></ProtectedRoute>} />
          <Route path="supervisors/:slotId" element={<ProtectedRoute role="coordinator"><SupervisorsPage /></ProtectedRoute>} />
          <Route path="conflicts/:cycleId" element={<ProtectedRoute role="coordinator"><ConflictsPage /></ProtectedRoute>} />
          <Route path="export/:cycleId" element={<ProtectedRoute role="coordinator"><ExportPage /></ProtectedRoute>} />
          <Route path="audit" element={<ProtectedRoute role="coordinator"><AuditPage /></ProtectedRoute>} />
          <Route path="my-duties" element={<ProtectedRoute><FacultyDutyPage /></ProtectedRoute>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
