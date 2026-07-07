import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import IntersectObserver from '@/components/common/IntersectObserver';
import SupabaseEnvNotice from '@/components/common/SupabaseEnvNotice';
import { Toaster } from '@/components/ui/sonner';
import AppLayout from '@/components/layouts/AppLayout';
import { AuthProvider } from '@/contexts/AuthContext';
import { isSupabaseConfigured } from '@/db/supabase';

import { routes } from './routes';

const App: React.FC = () => {
  if (!isSupabaseConfigured) {
    return <SupabaseEnvNotice />;
  }

  return (
    <AuthProvider>
      <Router>
        <IntersectObserver />
        <AppLayout>
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
    </AuthProvider>
  );
};

export default App;
