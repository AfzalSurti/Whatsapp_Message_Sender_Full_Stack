import axios from 'axios';
import { getToken, isAuthBootstrapping, removeToken } from './auth';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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

export const whatsappAPI = {
  connect: (data = {}) => api.post('/api/whatsapp/connect', data),
  getStatus: () => api.get('/api/whatsapp/status'),
  disconnect: () => api.post('/api/whatsapp/disconnect'),
};

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

export const aiTemplateAPI = {
  getTemplates: () => api.get('/api/ai-templates'),
  getStarterTemplates: () => api.get('/api/ai-templates/starters'),
  getExampleTemplate: (slug = 'welcome') => api.get(`/api/ai-templates/example/${slug}`),
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

export const businessProfileAPI = {
  getProfile: () => api.get('/api/business-profile'),
  updateProfile: (data) => api.put('/api/business-profile', data),
};

export default api;
