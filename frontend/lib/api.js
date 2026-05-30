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
  logout: () => api.post('/api/auth/logout'),
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
  generate: (data) => api.post('/api/ai/generate', typeof data === 'string' ? { prompt: data } : data),
};

// ─── LOGS ─────────────────────────────────────────────────────
export const logsAPI = {
  getLogs: (params) => api.get('/api/logs', { params }),
  getCampaigns: () => api.get('/api/logs/campaigns'),
  getLiveFeed: () => api.get('/api/logs/live-feed'),
};

// ─── CONTACTS ──────────────────────────────────────────────────
export const contactsAPI = {
  getContacts: () => api.get('/api/contacts'),
  createContact: (data) => api.post('/api/contacts', data),
  updateContact: (id, data) => api.put(`/api/contacts/${id}`, data),
  deleteContact: (id) => api.delete(`/api/contacts/${id}`),
};

// ─── API KEYS ──────────────────────────────────────────────────
export const keysAPI = {
  getKeys: () => api.get('/api/keys'),
  generateKey: (name) => api.post('/api/keys', { name }),
  getFullKey: (id) => api.get(`/api/keys/${id}/full`),
  getKeyStats: (id) => api.get(`/api/keys/${id}/stats`),
  deleteKey: (id) => api.delete(`/api/keys/${id}`),
};

// ─── CONTACT GROUPS ────────────────────────────────────────────
export const groupsAPI = {
  getGroups: () => api.get('/api/groups'),
  getGroup: (id) => api.get(`/api/groups/${id}`),
  createGroup: (data) => api.post('/api/groups', data),
  updateGroup: (id, data) => api.put(`/api/groups/${id}`, data),
  deleteGroup: (id) => api.delete(`/api/groups/${id}`),
  addNumber: (id, data) => api.post(`/api/groups/${id}/numbers`, data),
  removeNumber: (id, phone) => api.delete(`/api/groups/${id}/numbers/${phone}`),
  bulkAdd: (id, data) => api.post(`/api/groups/${id}/bulk`, data),
};

// ─── SCHEDULED CAMPAIGNS ───────────────────────────────────────
export const scheduledAPI = {
  getCampaigns: () => api.get('/api/scheduled'),
  getCampaign: (id) => api.get(`/api/scheduled/${id}`),
  createCampaign: (data) => api.post('/api/scheduled', data),
  cancelCampaign: (id) => api.patch(`/api/scheduled/${id}/cancel`),
  deleteCampaign: (id) => api.delete(`/api/scheduled/${id}`),
};

export default api;
