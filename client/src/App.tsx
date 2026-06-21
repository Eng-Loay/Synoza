import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import StudentDashboard from './pages/StudentDashboard';
import SimulationPage from './pages/SimulationPage';
import ProfilePage from './pages/ProfilePage';
import ResultsPage from './pages/ResultsPage';
import AdminDashboard from './pages/AdminDashboard';
import { PageTransition } from './components/PageTransition';

function RoleRedirect() {
  const user = JSON.parse(localStorage.getItem('synoza_user') || 'null');
  if (!user) return <Navigate to="/login" />;
  if (user.role === 'ADMIN') return <Navigate to="/admin" />;
  return <Navigate to="/student" />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <PageTransition>
          <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/dashboard" element={<RoleRedirect />} />

          <Route element={<ProtectedRoute roles={['STUDENT', 'ADMIN']} />}>
            <Route path="/simulation/:sessionId" element={<SimulationPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={['STUDENT']} />}>
            <Route path="/student" element={<StudentDashboard />} />
            <Route path="/student/profile" element={<ProfilePage />} />
            <Route path="/student/results" element={<ResultsPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={['ADMIN']} />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>

          <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </PageTransition>
      </BrowserRouter>
    </AuthProvider>
  );
}
