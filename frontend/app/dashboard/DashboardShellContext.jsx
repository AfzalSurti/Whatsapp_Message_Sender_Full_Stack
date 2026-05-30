'use client';

import { createContext, useContext } from 'react';

const DashboardShellContext = createContext(null);

export const DashboardShellProvider = ({ value, children }) => (
  <DashboardShellContext.Provider value={value}>{children}</DashboardShellContext.Provider>
);

export const useDashboardShell = () => {
  const context = useContext(DashboardShellContext);
  if (!context) throw new Error('useDashboardShell must be used inside DashboardShellProvider');
  return context;
};
