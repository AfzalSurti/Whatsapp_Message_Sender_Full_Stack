import Cookies from 'js-cookie';

const TOKEN_KEY = 'wa_sender_token';
const TOKEN_COOKIE = 'token';

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
  }
};

export const isAuthenticated = () => Boolean(getToken());
