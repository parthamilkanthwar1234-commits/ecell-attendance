import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import TeamMembers from './pages/TeamMembers';
import MarkAttendance from './pages/MarkAttendance';
import MeetingsEvents from './pages/MeetingsEvents';
import SessionDetails from './pages/SessionDetails';
import LeadershipOverview from './pages/LeadershipOverview';
import MyDomain from './pages/MyDomain';
import AuditLogs from './pages/AuditLogs';
import UserManagement from './pages/UserManagement';
import AttendanceHistory from './pages/AttendanceHistory';
import AnalyticsReports from './pages/AnalyticsReports';
import Settings from './pages/Settings';
import Login from './pages/Login';

function AuthRouteGate({ children }: { children: React.ReactNode }) {
  const { state } = useApp();
  if (!state.auth.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Main App Layout */}
          <Route
            path="/"
            element={
              <AuthRouteGate>
                <Layout />
              </AuthRouteGate>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="leadership" element={<LeadershipOverview />} />
            <Route path="my-domain" element={<MyDomain />} />
            <Route path="members" element={<TeamMembers />} />
            <Route path="attendance/mark" element={<MarkAttendance />} />
            <Route path="sessions" element={<MeetingsEvents />} />
            <Route path="sessions/:id" element={<SessionDetails />} />
            <Route path="attendance/history" element={<AttendanceHistory />} />
            <Route path="analytics" element={<AnalyticsReports />} />
            <Route path="audit-logs" element={<AuditLogs />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="settings" element={<Settings />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
