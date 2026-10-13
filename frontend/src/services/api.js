import axios from 'axios';

const resolveBaseURL = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl) return '/api';
  const clean = envUrl.trim().replace(/\/+$/, '');
  return clean.endsWith('/api') ? clean : `${clean}/api`;
};

const api = axios.create({
  baseURL: resolveBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach Authorization Token and Company Context to outgoing requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Derive company ID from localStorage or from active window location path
  let companyId = localStorage.getItem('selected_company');
  if (!companyId && typeof window !== 'undefined' && window.location.pathname.startsWith('/company/')) {
    companyId = window.location.pathname.replace(/^\/company\//, '').split('/')[0];
  }

  // If the request is for consolidated all-companies reports, skip single-company header
  if (config.url && config.url.includes('/consolidated/')) {
    delete config.headers['x-company-id'];
  } else if (!config.headers['x-company-id'] && companyId && companyId !== 'all') {
    config.headers['x-company-id'] = companyId;
  }

  return config;
});

// Response interceptor for automatic session handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config.url.includes('/auth/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
    return Promise.reject(error);
  }
);

// --------------------------------------------------------------------------
// Auth API
// --------------------------------------------------------------------------
export const authAPI = {
  checkSetup: async () => {
    const res = await api.get('/auth/setup-status');
    return res.data;
  },
  setupInitialUser: async (data) => {
    const res = await api.post('/auth/setup', data);
    return res.data;
  },
  login: async (credentials) => {
    const res = await api.post('/auth/login', credentials);
    return res.data;
  },
  getMe: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  },
  updatePassword: async (passwords) => {
    const res = await api.put('/auth/password', passwords);
    return res.data;
  },
};

// --------------------------------------------------------------------------
// Properties & Units API
// --------------------------------------------------------------------------
export const propertiesAPI = {
  getAll: async (params) => {
    const res = await api.get('/properties', { params });
    return res.data;
  },
  getById: async (id) => {
    const res = await api.get(`/properties/${id}`);
    return res.data;
  },
  create: async (data) => {
    const res = await api.post('/properties', data);
    return res.data;
  },
  update: async (id, data) => {
    const res = await api.put(`/properties/${id}`, data);
    return res.data;
  },
  delete: async (id) => {
    const res = await api.delete(`/properties/${id}`);
    return res.data;
  },
  // Units sub-routes
  addUnit: async (propertyId, data) => {
    const res = await api.post(`/properties/${propertyId}/units`, data);
    return res.data;
  },
  updateUnit: async (propertyId, unitId, data) => {
    const res = await api.put(`/properties/${propertyId}/units/${unitId}`, data);
    return res.data;
  },
  deleteUnit: async (propertyId, unitId) => {
    const res = await api.delete(`/properties/${propertyId}/units/${unitId}`);
    return res.data;
  },
};

// --------------------------------------------------------------------------
// Tenants & Tenancies API
// --------------------------------------------------------------------------
export const tenantsAPI = {
  getAll: async (params) => {
    const res = await api.get('/tenants', { params });
    return res.data;
  },
  getById: async (id) => {
    const res = await api.get(`/tenants/${id}`);
    return res.data;
  },
  create: async (data) => {
    const res = await api.post('/tenants', data);
    return res.data;
  },
  update: async (id, data) => {
    const res = await api.put(`/tenants/${id}`, data);
    return res.data;
  },
};

export const tenanciesAPI = {
  getAll: async (params) => {
    const res = await api.get('/tenancies', { params });
    return res.data;
  },
  create: async (data) => {
    const res = await api.post('/tenancies', data);
    return res.data;
  },
  update: async (id, data) => {
    const res = await api.put(`/tenancies/${id}`, data);
    return res.data;
  },
};

// --------------------------------------------------------------------------
// Rent Billing & Collections API
// --------------------------------------------------------------------------
export const rentAPI = {
  getSchedules: async (params) => {
    const res = await api.get('/rent/schedules', { params });
    return res.data;
  },
  generateMonthlySchedules: async (month) => {
    const res = await api.post('/rent/generate-monthly', { month });
    return res.data;
  },
  updateSchedule: async (id, data) => {
    const res = await api.put(`/rent/schedules/${id}`, data);
    return res.data;
  },
  getPayments: async (params) => {
    const res = await api.get('/rent/payments', { params });
    return res.data;
  },
  recordPayment: async (data) => {
    const res = await api.post('/rent/payments', data);
    return res.data;
  },
  getArrearsSummary: async () => {
    const res = await api.get('/rent/arrears');
    return res.data;
  },
};

// --------------------------------------------------------------------------
// Mortgages API (New UK Feature)
// --------------------------------------------------------------------------
export const mortgagesAPI = {
  getAll: async (params) => {
    const res = await api.get('/mortgages', { params });
    return res.data;
  },
  getById: async (id) => {
    const res = await api.get(`/mortgages/${id}`);
    return res.data;
  },
  create: async (data) => {
    const res = await api.post('/mortgages', data);
    return res.data;
  },
  update: async (id, data) => {
    const res = await api.put(`/mortgages/${id}`, data);
    return res.data;
  },
  recordPayment: async (mortgageId, data) => {
    const res = await api.post(`/mortgages/${mortgageId}/payments`, data);
    return res.data;
  },
  getPayments: async (mortgageId, params) => {
    const res = await api.get(`/mortgages/${mortgageId}/payments`, { params });
    return res.data;
  },
  reconcileBalance: async (mortgageId, data) => {
    const res = await api.post(`/mortgages/${mortgageId}/reconcile`, data);
    return res.data;
  },
};

// --------------------------------------------------------------------------
// Bank & Cash Accounts API
// --------------------------------------------------------------------------
export const accountsAPI = {
  getAll: async (params) => {
    const res = await api.get('/accounts', { params });
    return res.data;
  },
  getById: async (id) => {
    const res = await api.get(`/accounts/${id}`);
    return res.data;
  },
  create: async (data) => {
    const res = await api.post('/accounts', data);
    return res.data;
  },
  update: async (id, data) => {
    const res = await api.put(`/accounts/${id}`, data);
    return res.data;
  },
  getStatement: async (id, params) => {
    const res = await api.get(`/accounts/${id}/statement`, { params });
    return res.data;
  },
  transfer: async (data) => {
    const res = await api.post('/accounts/transfer', data);
    return res.data;
  },
};

// --------------------------------------------------------------------------
// Central Ledger & Expenses API
// --------------------------------------------------------------------------
export const ledgerAPI = {
  getEntities: async (params) => {
    const res = await api.get('/ledger/entities', { params });
    return res.data;
  },
  queryLedger: async (params) => {
    const res = await api.get('/ledger/query', { params });
    return res.data;
  },
  getTransactions: async (params) => {
    const res = await api.get('/ledger/transactions', { params });
    return res.data;
  },
  updateTransaction: async (id, data) => {
    const res = await api.put(`/ledger/transactions/${id}`, data);
    return res.data;
  },
  recordExpense: async (data) => {
    const res = await api.post('/ledger/expenses', data);
    return res.data;
  },
  recordIncome: async (data) => {
    const res = await api.post('/ledger/income', data);
    return res.data;
  },
  getCategories: async (params) => {
    const res = await api.get('/ledger/categories', { params });
    return res.data;
  },
  createCategory: async (data) => {
    const res = await api.post('/ledger/categories', data);
    return res.data;
  },
  updateCategory: async (id, data) => {
    const res = await api.put(`/ledger/categories/${id}`, data);
    return res.data;
  },
  deleteCategory: async (id) => {
    const res = await api.delete(`/ledger/categories/${id}`);
    return res.data;
  },
};

// --------------------------------------------------------------------------
// Helper for browser file downloads
// --------------------------------------------------------------------------
export const triggerBlobDownload = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.parentNode.removeChild(link);
  window.URL.revokeObjectURL(url);
};

// --------------------------------------------------------------------------
// Reports & Dashboard API
// --------------------------------------------------------------------------
export const reportsAPI = {
  getDashboardStats: async (params) => {
    const res = await api.get('/reports/dashboard', { params });
    return res.data;
  },
  getPropertyProfitability: async (params) => {
    const res = await api.get('/reports/property-profitability', { params });
    return res.data;
  },
  getFinancialYearReport: async (params) => {
    const res = await api.get('/reports/financial-year', { params });
    return res.data;
  },
  getLedgerPreview: async (params) => {
    const res = await api.post('/reports/ledger/preview', params);
    return res.data;
  },
  downloadLedgerExcel: async (params, customFilename) => {
    const res = await api.post('/reports/ledger/export/excel', params, {
      responseType: 'blob',
    });
    if (res.data?.type === 'application/json') {
      const text = await res.data.text();
      const err = JSON.parse(text);
      throw new Error(err.message || 'Excel export failed');
    }
    const defaultFilename = `Pixx_UK_Ledger_${params?.scope || 'Report'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    triggerBlobDownload(res.data, customFilename || defaultFilename);
    return true;
  },
  downloadLedgerPdf: async (params, customFilename) => {
    const res = await api.post('/reports/ledger/export/pdf', params, {
      responseType: 'blob',
    });
    if (res.data?.type === 'application/json') {
      const text = await res.data.text();
      const err = JSON.parse(text);
      throw new Error(err.message || 'PDF export failed');
    }
    const defaultFilename = `Pixx_UK_Ledger_${params?.scope || 'Report'}_${new Date().toISOString().slice(0, 10)}.pdf`;
    triggerBlobDownload(res.data, customFilename || defaultFilename);
    return true;
  },
  exportExcel: (type, params = {}) => {
    const query = new URLSearchParams(params).toString();
    return `/api/reports/export/excel?type=${type}&${query}`;
  },
  downloadLandlordStatementExcel: async (customFilename) => {
    const res = await api.get('/reports/landlord-statement/excel', {
      responseType: 'blob',
    });
    if (res.data?.type === 'application/json') {
      const text = await res.data.text();
      const err = JSON.parse(text);
      throw new Error(err.message || 'Landlord statement export failed');
    }
    const defaultFilename = `Landlord_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
    triggerBlobDownload(res.data, customFilename || defaultFilename);
    return true;
  },
  getConsolidatedOverview: async () => {
    const res = await api.get('/reports/consolidated/overview');
    return res.data;
  },
  downloadConsolidatedExcel: async (customFilename) => {
    const res = await api.get('/reports/consolidated/excel', {
      responseType: 'blob',
    });
    if (res.data?.type === 'application/json') {
      const text = await res.data.text();
      const err = JSON.parse(text);
      throw new Error(err.message || 'Consolidated Excel export failed');
    }
    const defaultFilename = `Consolidated_Rent_Details_All_Companies_${new Date().toISOString().slice(0, 10)}.xlsx`;
    triggerBlobDownload(res.data, customFilename || defaultFilename);
    return true;
  },
  downloadConsolidatedPdf: async (customFilename) => {
    const res = await api.get('/reports/consolidated/pdf', {
      responseType: 'blob',
    });
    if (res.data?.type === 'application/json') {
      const text = await res.data.text();
      const err = JSON.parse(text);
      throw new Error(err.message || 'Consolidated PDF export failed');
    }
    const defaultFilename = `Consolidated_Group_Portfolio_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
    triggerBlobDownload(res.data, customFilename || defaultFilename);
    return true;
  },
};

export default api;
