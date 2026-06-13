import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { App as AntApp, Spin } from 'antd';
import LoginPage from './auth/LoginPage';
import RequireAuth from './auth/RequireAuth';
import AppLayout from './components/AppLayout';
import Dashboard from './pages/Dashboard';
import CoursesPage from './pages/CoursesPage';
import OnboardingPage from './pages/OnboardingPage';
import UsersPage from './pages/UsersPage';
import AdminAccessPage from './pages/AdminAccessPage';
import AIInspectorPage from './pages/AIInspectorPage';

const CharactersPage = lazy(() => import('./pages/CharactersPage'));

function PageLoader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
      <Spin size="large" />
    </div>
  );
}

export default function App() {
  return (
    <AntApp>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="courses" element={<CoursesPage />} />
          <Route path="onboarding" element={<OnboardingPage />} />
          <Route
            path="characters"
            element={(
              <Suspense fallback={<PageLoader />}>
                <CharactersPage />
              </Suspense>
            )}
          />
          <Route path="users" element={<UsersPage />} />
          <Route path="admin-access" element={<AdminAccessPage />} />
          <Route path="ai" element={<AIInspectorPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AntApp>
  );
}
