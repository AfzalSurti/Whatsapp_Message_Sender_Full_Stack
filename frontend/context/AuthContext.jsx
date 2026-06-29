'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authAPI } from '@/lib/api';
import {
  clearAuthBootstrap,
  getCachedUser,
  getToken,
  markAuthBootstrap,
  removeToken,
  saveToken,
  saveUser
} from '@/lib/auth';

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
    const nextUser = res.data?.user;
    if (!nextUser) {
      throw new Error('Session could not be restored');
    }
    saveUser(nextUser);
    setUser(nextUser);
    clearAuthBootstrap();
    return nextUser;
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const token = getToken();
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      const cachedUser = getCachedUser();
      if (cachedUser) {
        setUser(cachedUser);
        setLoading(false);
      }

      try {
        await refreshUser();
      } catch (err) {
        if (err.response?.status === 401) {
          removeToken();
          setUser(null);
          clearAuthBootstrap();
        } else if (!cachedUser) {
          setUser(null);
        }
      } finally {
        setLoading(false);
        clearAuthBootstrap();
      }
    };

    initAuth();
  }, [refreshUser]);

  const login = async (email, password) => {
    const res = await authAPI.login({ email, password });
    markAuthBootstrap();
    saveToken(res.data.token);
    saveUser(res.data.user);
    setUser(res.data.user);
    clearAuthBootstrap();
    return res.data;
  };

  const signup = async (name, email, password) => {
    const res = await authAPI.signup({ name, email, password });
    markAuthBootstrap();
    saveToken(res.data.token);
    saveUser(res.data.user);
    setUser(res.data.user);
    clearAuthBootstrap();
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

  const updateProfile = async (data) => {
    const res = await authAPI.updateProfile(data);
    saveUser(res.data.user);
    setUser(res.data.user);
    return res.data.user;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, refreshUser, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
