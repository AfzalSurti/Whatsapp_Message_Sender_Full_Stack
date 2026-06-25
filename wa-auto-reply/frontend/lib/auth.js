import Cookies from 'js-cookie';

const TOKEN_KEY = 'wa_sender_token';
const TOKEN_COOKIE = 'token';
const USER_KEY = 'wa_sender_user';

const getCookieOptions = () => {
  const options = {
    expires: 30,
    path: '/',
    sameSite: 'lax'
  };

  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    options.secure = true;
  }

  return options;
};

export const saveUser = (user) => {
  if (typeof window !== 'undefined' && user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
};

export const getCachedUser = () => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const removeUser = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(USER_KEY);
  }
};

export const saveToken = (token) => {
  if (!token) return;

  Cookies.set(TOKEN_COOKIE, token, getCookieOptions());

  if (typeof window !== 'undefined') {
    localStorage.setItem(TOKEN_KEY, token);
  }
};

export const getToken = () => {
  const cookieToken = Cookies.get(TOKEN_COOKIE);
  if (cookieToken) return cookieToken;

  if (typeof window !== 'undefined') {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (storedToken) {
      Cookies.set(TOKEN_COOKIE, storedToken, getCookieOptions());
      return storedToken;
    }
  }

  return null;
};

export const removeToken = () => {
  Cookies.remove(TOKEN_COOKIE, { path: '/' });

  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
};

export const isAuthenticated = () => Boolean(getToken());

const AUTH_BOOTSTRAP_KEY = 'wa_auth_bootstrap';

export const markAuthBootstrap = () => {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(AUTH_BOOTSTRAP_KEY, '1');
  }
};

export const clearAuthBootstrap = () => {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(AUTH_BOOTSTRAP_KEY);
  }
};

export const isAuthBootstrapping = () => {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(AUTH_BOOTSTRAP_KEY) === '1';
};
