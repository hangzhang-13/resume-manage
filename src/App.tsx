import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import IntersectObserver from '@/components/common/IntersectObserver';
import SupabaseEnvNotice from '@/components/common/SupabaseEnvNotice';
import { Toaster } from '@/components/ui/sonner';
import AppLayout from '@/components/layouts/AppLayout';
import { isSupabaseConfigured, supabase } from '@/db/supabase';
import LoginPage from '@/pages/LoginPage';

import { routes } from './routes';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const adminEmail = (import.meta.env.VITE_ADMIN_EMAIL || '').trim().toLowerCase();
    const syncSession = (email?: string | null) => {
      setIsAuthenticated(Boolean(email) && (!adminEmail || email?.toLowerCase() === adminEmail));
      setAuthLoading(false);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      syncSession(session?.user.email);
    }).catch(() => setAuthLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      syncSession(session?.user.email);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (!isSupabaseConfigured) {
    return <SupabaseEnvNotice />;
  }

  if (authLoading || !isAuthenticated) {
    return (
      <>
        <LoginPage />
        <Toaster />
      </>
    );
  }

  const handleLogout = () => {
    void supabase.auth.signOut();
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
