import axios from 'axios';
import Cookies from 'js-cookie';

// Base axios instance — all requests go through here
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { 'Content-Type': 'application/json' }
});

// ─── REQUEST INTERCEPTOR ──────────────────────────────────────
// Automatically attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = Cookies.get('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── RESPONSE INTERCEPTOR ─────────────────────────────────────
// Handle 401 globally — redirect to login if token expired
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      Cookies.remove('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ─── AUTH ─────────────────────────────────────────────────────
export const authAPI = {
  signup: (data) => api.post('/api/auth/signup', data),
  login: (data) => api.post('/api/auth/login', data),
  getMe: () => api.get('/api/auth/me'),
};

// ─── WHATSAPP ─────────────────────────────────────────────────
export const whatsappAPI = {
  connect: () => api.post('/api/whatsapp/connect'),
  getStatus: () => api.get('/api/whatsapp/status'),
  disconnect: () => api.post('/api/whatsapp/disconnect'),
  send: (data) => api.post('/api/whatsapp/send', data),
};

// ─── AI ───────────────────────────────────────────────────────
export const aiAPI = {
  generate: (prompt) => api.post('/api/ai/generate', { prompt }),
};

// ─── LOGS ─────────────────────────────────────────────────────
export const logsAPI = {
  getLogs: (params) => api.get('/api/logs', { params }),
  getCampaigns: () => api.get('/api/logs/campaigns'),
};

export default api;