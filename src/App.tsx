/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { LoginView } from './components/LoginView';
import { MainLayout } from './components/MainLayout';

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="w-8 h-8 border-4 border-slate-300 border-t-slate-900 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return <MainLayout />;
}

export default function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-white text-slate-900 selection:bg-slate-200">
        <AppContent />
      </div>
    </AuthProvider>
  );
}
