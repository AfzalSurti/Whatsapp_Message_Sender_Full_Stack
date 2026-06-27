'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getCachedUser, getToken } from '@/lib/auth';
import { Loader2 } from 'lucide-react';

function AuthGateLoader() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <Loader2 className="animate-spin text-[#25D366]" size={32} />
    </div>
  );
}

function useMounted() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted;
}

export function useRedirectIfAuthenticated(redirectTo = '/dashboard') {
  const { user, loading } = useAuth();
  const router = useRouter();
  const mounted = useMounted();

  const token = mounted ? getToken() : null;
  const cachedUser = mounted ? getCachedUser() : null;
  const hasSession = Boolean(user || (token && cachedUser));
  const shouldCheckAuth = Boolean(token);

  useEffect(() => {
    if (!mounted) return;
    if (shouldCheckAuth && !loading && hasSession) {
      router.replace(redirectTo);
    }
  }, [mounted, shouldCheckAuth, loading, hasSession, router, redirectTo]);

  // Only block UI when we already know there is a session to redirect away.
  const showLoader = mounted && shouldCheckAuth && (loading || hasSession);

  return { user, loading, isAuthenticated: hasSession, showLoader, mounted };
}

export function AuthRedirectGate({ children, redirectTo = '/dashboard' }) {
  const { showLoader } = useRedirectIfAuthenticated(redirectTo);

  if (showLoader) {
    return <AuthGateLoader />;
  }

  return children;
}
