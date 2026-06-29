import axios from 'axios';
import { getToken, isAuthBootstrapping, removeToken } from './auth';

// Base axios instance — all requests go through here
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { 'Content-Type': 'application/json' }
});

// ─── REQUEST INTERCEPTOR ──────────────────────────────────────
// Automatically attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = getToken();
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
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const requestUrl = error.config?.url || '';
      const isAuthRoute = requestUrl.includes('/api/auth/login')
        || requestUrl.includes('/api/auth/signup')
        || requestUrl.includes('/api/auth/me');
      const hadAuthHeader = Boolean(error.config?.headers?.Authorization);
      const onAuthCallback = window.location.pathname.startsWith('/auth/callback');

      if (!isAuthRoute && hadAuthHeader && !isAuthBootstrapping() && !onAuthCallback) {
        removeToken();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ─── AUTH ─────────────────────────────────────────────────────
export const authAPI = {
  signup: (data) => api.post('/api/auth/signup', data),
  login: (data) => api.post('/api/auth/login', data),
  getMe: () => api.get('/api/auth/me', {
    params: { _: Date.now() },
    headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    timeout: 8000
  }),
  updateProfile: (data) => api.patch('/api/auth/profile', data),
  logout: () => api.post('/api/auth/logout'),
};

// ─── WHATSAPP ─────────────────────────────────────────────────
export const whatsappAPI = {
  connect: (data = {}) => api.post('/api/whatsapp/connect', data),
  getStatus: () => api.get('/api/whatsapp/status'),
  disconnect: () => api.post('/api/whatsapp/disconnect'),
  send: (data) => api.post('/api/whatsapp/send', data),
  getWhatsAppContacts: (options = {}) => api.get('/api/whatsapp/contacts', {
    timeout: 60000,
    params: options.force ? { refresh: '1' } : undefined
  }),
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
  whatsappTest: (id) => api.get(`whatsapp/send-via-api/${id}`),
};

// ─── CONTACT GROUPS ────────────────────────────────────────────
export const groupsAPI = {
  getOverview: () => api.get('/api/groups/overview'),
  getTags: () => api.get('/api/groups/tags'),
  createTag: (data) => api.post('/api/groups/tags', data),
  deleteTag: (id) => api.delete(`/api/groups/tags/${id}`),
  updateContact: (data) => api.put('/api/groups/contacts', data),
  deleteContact: (phone) => api.delete('/api/groups/contacts', { data: { phone } }),
  importContacts: (rows) => api.post('/api/groups/import', { rows }),
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
  updateCampaign: (id, data) => api.put(`/api/scheduled/${id}`, data),
  cancelCampaign: (id) => api.patch(`/api/scheduled/${id}/cancel`),
  deleteCampaign: (id) => api.delete(`/api/scheduled/${id}`),
};

// ─── MESSAGE TEMPLATES ─────────────────────────────────────────
export const templatesAPI = {
  getTemplates: () => api.get('/api/templates'),
  getTemplate: (id) => api.get(`/api/templates/${id}`),
  createTemplate: (data) => api.post('/api/templates', data),
  updateTemplate: (id, data) => api.put(`/api/templates/${id}`, data),
  deleteTemplate: (id) => api.delete(`/api/templates/${id}`),
};

// ─── BUSINESS PROFILE ──────────────────────────────────────────
export const businessProfileAPI = {
  getProfile: () => api.get('/api/business-profile'),
  updateProfile: (data) => api.put('/api/business-profile', data),
};

// ─── AI TEMPLATES (auto-reply conversational flows) ─────────────
export const aiTemplateAPI = {
  getTemplates: () => api.get('/api/ai-templates'),
  getStarterTemplates: () => api.get('/api/ai-templates/starters'),
  getExampleTemplate: (slug) => api.get(`/api/ai-templates/example/${slug}`),
  addStarterTemplate: (slug) => api.post(`/api/ai-templates/starters/${slug}`),
  createTemplate: (data) => api.post('/api/ai-templates', data),
  updateTemplate: (id, data) => api.put(`/api/ai-templates/${id}`, data),
  deleteTemplate: (id) => api.delete(`/api/ai-templates/${id}`),
  toggleTemplate: (id) => api.patch(`/api/ai-templates/${id}/toggle`),
  getConversations: (params) => api.get('/api/ai-templates/conversations', { params }),
  getConversation: (id) => api.get(`/api/ai-templates/conversations/${id}`),
  deleteConversation: (id) => api.delete(`/api/ai-templates/conversations/${id}`),
  getLeads: (params) => api.get('/api/ai-templates/leads', { params }),
};

export const templateAPI = aiTemplateAPI;

// ─── AUTO REPLY ────────────────────────────────────────────────
export const autoReplyAPI = {
  getConfig: () => api.get('/api/auto-reply/config'),
  updateConfig: (data) => api.put('/api/auto-reply/config', data),
  getWhatsAppContacts: (options = {}) => api.get('/api/auto-reply/whatsapp-contacts', {
    timeout: 60000,
    params: options.force ? { refresh: '1' } : undefined
  }),
  getLogs: (params) => api.get('/api/auto-reply/logs', { params }),
  getContacts: () => api.get('/api/auto-reply/contacts'),
  deleteLog: (id) => api.delete(`/api/auto-reply/logs/${id}`),
  deleteContactLogs: (contactPhone) =>
    api.delete('/api/auto-reply/contacts', { params: { contactPhone } }),
  clearLogs: () => api.delete('/api/auto-reply/logs'),
};

export default api;
