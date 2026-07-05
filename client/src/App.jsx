import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore, useAppStore } from './store/index.js';
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
import SearchPage from './pages/SearchPage.jsx';
import CalendarPage from './pages/CalendarPage.jsx';
import AttendancePage from './pages/AttendancePage.jsx';
import LiveDashboardPage from './pages/LiveDashboardPage.jsx';
import HeatmapPage from './pages/HeatmapPage.jsx';
import KioskPage from './pages/KioskPage.jsx';
import SystemHealthPage from './pages/SystemHealthPage.jsx';
import HistoricalAnalyticsPage from './pages/HistoricalAnalyticsPage.jsx';
import PlannerPage from './pages/PlannerPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import DocumentationPage from './pages/DocumentationPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';

import { ErrorBoundary } from './components/ErrorBoundary.jsx';

function ProtectedRoute({ children, role }) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user } = useAuthStore();
  const { theme } = useAppStore();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--bg-elevated)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            fontFamily: "'Inter', sans-serif",
            fontSize: '13px',
            fontWeight: 500,
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            padding: '12px 16px',
          },
          success: { iconTheme: { primary: '#30D158', secondary: 'var(--bg-elevated)' } },
          error:   { iconTheme: { primary: '#FF453A', secondary: 'var(--bg-elevated)' } },
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
          <Route path="dashboard"   element={<ProtectedRoute role="coordinator"><DashboardPage /></ProtectedRoute>} />
          <Route path="students"    element={<ProtectedRoute role="coordinator"><StudentsPage /></ProtectedRoute>} />
          <Route path="subjects"    element={<ProtectedRoute role="coordinator"><SubjectsPage /></ProtectedRoute>} />
          <Route path="classrooms"  element={<ProtectedRoute role="coordinator"><ClassroomsPage /></ProtectedRoute>} />
          <Route path="faculty"     element={<ProtectedRoute role="coordinator"><FacultyPage /></ProtectedRoute>} />
          <Route path="exam-cycles" element={<ProtectedRoute role="coordinator"><ExamCyclesPage /></ProtectedRoute>} />
          <Route path="seating/:slotId"     element={<ProtectedRoute role="coordinator"><SeatingPage /></ProtectedRoute>} />
          <Route path="supervisors/:slotId" element={<ProtectedRoute role="coordinator"><SupervisorsPage /></ProtectedRoute>} />
          <Route path="attendance/:slotId"  element={<ProtectedRoute><AttendancePage /></ProtectedRoute>} />
          <Route path="conflicts/:cycleId"  element={<ProtectedRoute role="coordinator"><ConflictsPage /></ProtectedRoute>} />
          <Route path="calendar/:cycleId"   element={<ProtectedRoute role="coordinator"><CalendarPage /></ProtectedRoute>} />
          <Route path="planner/:cycleId"    element={<ProtectedRoute role="coordinator"><PlannerPage /></ProtectedRoute>} />
          <Route path="export/:cycleId"     element={<ProtectedRoute role="coordinator"><ExportPage /></ProtectedRoute>} />
          <Route path="audit"   element={<ProtectedRoute role="coordinator"><AuditPage /></ProtectedRoute>} />
          <Route path="search"  element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
          <Route path="my-duties" element={<ProtectedRoute><FacultyDutyPage /></ProtectedRoute>} />
          <Route path="live-dashboard" element={<Navigate to="/" replace />} />
          <Route path="heatmap" element={<ProtectedRoute role="coordinator"><HeatmapPage /></ProtectedRoute>} />
          <Route path="analytics" element={<ProtectedRoute role="coordinator"><HistoricalAnalyticsPage /></ProtectedRoute>} />
          <Route path="health" element={<ProtectedRoute role="coordinator"><SystemHealthPage /></ProtectedRoute>} />
          <Route path="settings" element={<ProtectedRoute role="coordinator"><SettingsPage /></ProtectedRoute>} />
          <Route path="docs" element={<ProtectedRoute><DocumentationPage /></ProtectedRoute>} />
          <Route path="profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        </Route>
        <Route path="kiosk/:cycleId" element={<div className="kiosk-theme" style={{ height: '100vh', width: '100vw' }}><KioskPage /></div>} />
      </Routes>
    </BrowserRouter>
  </ErrorBoundary>
  );
}
