'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getCachedUser, getToken } from '@/lib/auth';
import { Loader2 } from 'lucide-react';

export function useRedirectIfAuthenticated(redirectTo = '/dashboard') {
  const { user, loading } = useAuth();
  const router = useRouter();
  const hasSession = Boolean(user || (getToken() && getCachedUser()));

  useEffect(() => {
    if (!loading && hasSession) {
      router.replace(redirectTo);
    }
  }, [hasSession, loading, router, redirectTo]);

  return { user, loading, isAuthenticated: hasSession };
}

export function AuthRedirectGate({ children, redirectTo = '/dashboard' }) {
  const { loading, isAuthenticated } = useRedirectIfAuthenticated(redirectTo);

  if (loading || isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="animate-spin text-[#25D366]" size={32} />
      </div>
    );
  }

  return children;
}
