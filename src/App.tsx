import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import IntersectObserver from '@/components/common/IntersectObserver';
import SupabaseEnvNotice from '@/components/common/SupabaseEnvNotice';
import { Toaster } from '@/components/ui/sonner';
import AppLayout from '@/components/layouts/AppLayout';
import { isSupabaseConfigured } from '@/db/supabase';
import LoginPage, { HRBP_AUTH_STORAGE_KEY } from '@/pages/LoginPage';

import { routes } from './routes';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => sessionStorage.getItem(HRBP_AUTH_STORAGE_KEY) === "authenticated"
  );

  if (!isSupabaseConfigured) {
    return <SupabaseEnvNotice />;
  }

  if (!isAuthenticated) {
    return (
      <>
        <LoginPage onLogin={() => setIsAuthenticated(true)} />
        <Toaster />
      </>
    );
  }

  const handleLogout = () => {
    sessionStorage.removeItem(HRBP_AUTH_STORAGE_KEY);
    setIsAuthenticated(false);
  };

  return (
    <Router>
      <IntersectObserver />
      <AppLayout onLogout={handleLogout}>
        <Routes>
          {routes.map((route, index) => (
            <Route
              key={index}
              path={route.path}
              element={route.element}
            />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
      <Toaster />
    </Router>
  );
};

export default App;
