import React from 'react';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { RootNavigator } from './navigation/RootNavigator';
import { GlobalErrorBoundary } from './components/common/GlobalErrorBoundary';

export default function App() {
  return (
    <GlobalErrorBoundary fallbackTitle="MaxPlay App Encountered an Error">
      <AuthProvider>
        <ThemeProvider>
          <div className="h-full h-[100dvh] w-full bg-[#0A0A0A] text-white font-sans overflow-hidden">
            <RootNavigator />
          </div>
        </ThemeProvider>
      </AuthProvider>
    </GlobalErrorBoundary>
  );
}
