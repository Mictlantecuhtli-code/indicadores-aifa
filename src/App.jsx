import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import IndicatorDetailPage from './pages/IndicatorDetailPage.jsx';
import IndicatorsPage from './pages/IndicatorsPage.jsx';
import CapturePage from './pages/CapturePage.jsx';
import VisualizationPage from './pages/VisualizationPage.jsx';
import UsersPage from './pages/UsersPage.jsx';

function ProtectedRoute({ children }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="rounded-lg bg-white p-6 shadow-lg">
          <p className="text-sm font-medium text-slate-600">Validando sesión...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  const { session, profile } = useAuth();

  const normalizedRole = (profile?.rol ?? profile?.puesto)?.toString().toLowerCase() ?? '';
  const defaultRoute = normalizedRole.includes('capturista') ? '/captura' : '/panel-directivos';
  const defaultSubpath = defaultRoute.replace(/^\//, '');

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to={defaultRoute} replace /> : <LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to={defaultSubpath} replace />} />
        <Route path="panel-directivos" element={<DashboardPage />} />
        <Route path="panel-directivos/:optionId" element={<IndicatorDetailPage />} />
        <Route path="visualizacion" element={<VisualizationPage />} />
        <Route path="indicadores" element={<IndicatorsPage />} />
        <Route path="captura" element={<CapturePage />} />
        <Route path="usuarios" element={<UsersPage />} />
      </Route>
      <Route path="*" element={<Navigate to={session ? defaultRoute : '/login'} replace />} />
    </Routes>
  );
}
