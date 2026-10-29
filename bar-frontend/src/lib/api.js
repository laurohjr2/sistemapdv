import axios from 'axios';
import { showSaveFeedback } from './saveFeedback';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => { showSaveFeedback(response); return response; },
  (error) => {
    if(error.response?.data?.code==='ACCESS_DENIED')window.dispatchEvent(new Event('pdv-access-change'));
    if ((error.response?.status === 401 || error.response?.data?.code === 'COMPANY_SUSPENDED') && !error.config?.url?.startsWith('/support') && !error.config?.url?.startsWith('/auth/') && !error.config?.url?.startsWith('/settings/branding')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (userData) => api.post('/auth/register', userData),
  validateToken: () => api.get('/auth/validate'),
};

// Users API
export const usersAPI = {
  getAll: () => api.get('/users'),
  getById: (id) => api.get(`/users/${id}`),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
};

// Products API
export const productsAPI = {
  getAll: (params) => api.get('/products', { params }),
  getById: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
  getCategories: () => api.get('/products/categories'),
};

// Stock API
export const stockAPI = {
  addStock: (data) => api.post('/stock/add', data),
  getMovements: (params) => api.get('/stock/movements', { params }),
  getLowStock: () => api.get('/stock/low-stock'),
  getReport: (params) => api.get('/stock/report', { params }),
};

// Tables API
export const tablesAPI = {
  getAll: () => api.get('/tables'),
  getById: (id) => api.get(`/tables/${id}`),
  create: (data) => api.post('/tables', data),
  update: (id, data) => api.put(`/tables/${id}`, data),
  delete: (id) => api.delete(`/tables/${id}`),
};

// Comandas API
export const comandasAPI = {
  getAll: (params) => api.get('/comandas', { params }),
  getById: (id) => api.get(`/comandas/${id}`),
  open: (data) => api.post('/comandas', data),
  addItem: (comandaId, data) => api.post(`/comandas/${comandaId}/items`, data),
  removeItem: (comandaId, itemId) => api.delete(`/comandas/${comandaId}/items/${itemId}`),
  close: (id, data) => api.put(`/comandas/${id}/close`, data),
};

// Waiting Queue API
export const waitingQueueAPI = {
  getQueue: (params) => api.get('/waiting-queue', { params }),
  addToQueue: (data) => api.post('/waiting-queue', data),
  seatClient: (id, data) => api.put(`/waiting-queue/${id}/seat`, data),
  cancelEntry: (id) => api.put(`/waiting-queue/${id}/cancel`),
  getStats: () => api.get('/waiting-queue/stats'),
};

// Reports API
export const reportsAPI = {
  getSales: (params) => api.get('/reports/sales', { params }),
  getProducts: (params) => api.get('/reports/products', { params }),
  getWaiters: (params) => api.get('/reports/waiters', { params }),
  getComparative: (params) => api.get('/reports/comparative', { params }),
  getDashboard: () => api.get('/reports/dashboard'),
};

// Printer API
export const printerAPI = {
  printComanda: (id) => api.post(`/printer/comanda/${id}`),
  printReceipt: (id) => api.post(`/printer/receipt/${id}`),
  testPrint: () => api.post('/printer/test'),
};

export default api;

