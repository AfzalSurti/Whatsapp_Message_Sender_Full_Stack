'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authAPI } from '@/lib/api';
import { getToken, removeToken, saveToken } from '@/lib/auth';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      return null;
    }

    const res = await authAPI.getMe();
    setUser(res.data.user);
    return res.data.user;
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const token = getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        await refreshUser();
      } catch (err) {
        if (err.response?.status === 401) {
          removeToken();
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, [refreshUser]);

  const login = async (email, password) => {
    const res = await authAPI.login({ email, password });
    saveToken(res.data.token);
    setUser(res.data.user);
    return res.data;
  };

  const signup = async (name, email, password) => {
    const res = await authAPI.signup({ name, email, password });
    saveToken(res.data.token);
    setUser(res.data.user);
    return res.data;
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch {
      // Still clear local session if API is unavailable.
    }
    removeToken();
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
