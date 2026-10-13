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

// --------------------------------------------------------------------------
// In-Memory Request Deduplication & Response Caching
// --------------------------------------------------------------------------
const requestCache = new Map();
const inFlightRequests = new Map();

/**
 * Invalidate the in-memory API response cache.
 * Automatically triggered on data mutations (POST, PUT, PATCH, DELETE) or user sign-out.
 */
export const clearApiCache = () => {
  requestCache.clear();
};

/**
 * Generate a unique, deterministic cache key based on URL, company scope, and query parameters.
 */
const getCacheKey = (url, config = {}) => {
  let companyId = config.headers?.['x-company-id'];
  if (!companyId && typeof window !== 'undefined') {
    companyId = localStorage.getItem('selected_company');
    if (!companyId && window.location.pathname.startsWith('/company/')) {
      companyId = window.location.pathname.replace(/^\/company\//, '').split('/')[0];
    }
  }
  const paramsKey = config.params ? JSON.stringify(config.params) : '';
  return `${url}::${companyId || 'global'}::${paramsKey}`;
};

/**
 * Cached & Deduplicated GET Request:
 * 1. Checks memory cache (returns in 0ms if within TTL and not force-refreshed).
 * 2. Deduplicates simultaneous in-flight requests so only 1 HTTP network call is made.
 * 3. Caches response upon resolution.
 */
export const cachedGet = async (url, config = {}, ttlMs = 15000) => {
  const { forceRefresh = false, ...axiosConfig } = config;
  const cacheKey = getCacheKey(url, axiosConfig);

  // 1. Return fresh cached copy if available
  if (!forceRefresh) {
    const cached = requestCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < ttlMs) {
      return cached.data;
    }
  }

  // 2. Join existing pending in-flight request if identical request is underway
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  // 3. Dispatch network request and track promise
  const requestPromise = (async () => {
    try {
      const res = await api.get(url, axiosConfig);
      requestCache.set(cacheKey, {
        timestamp: Date.now(),
        data: res.data,
      });
      return res.data;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, requestPromise);
  return requestPromise;
};

// --------------------------------------------------------------------------
// Interceptors
// --------------------------------------------------------------------------

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

// Response interceptor for automatic cache invalidation & session handling
api.interceptors.response.use(
  (response) => {
    // Invalidate cached read queries on any mutation
    const method = response.config?.method?.toLowerCase();
    if (['post', 'put', 'patch', 'delete'].includes(method)) {
      clearApiCache();
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      clearApiCache();
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
  checkSetup: async (config = {}) => {
    return cachedGet('/auth/setup-status', config, 60000);
  },
  setupInitialUser: async (data) => {
    const res = await api.post('/auth/setup', data);
    return res.data;
  },
  login: async (credentials) => {
    const res = await api.post('/auth/login', credentials);
    return res.data;
  },
  getMe: async (config = {}) => {
    return cachedGet('/auth/me', config, 30000);
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
  getAll: async (params, config = {}) => {
    return cachedGet('/properties', { params, ...config });
  },
  getById: async (id, config = {}) => {
    return cachedGet(`/properties/${id}`, config);
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
  getAll: async (params, config = {}) => {
    return cachedGet('/tenants', { params, ...config });
  },
  getById: async (id, config = {}) => {
    return cachedGet(`/tenants/${id}`, config);
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
  getAll: async (params, config = {}) => {
    return cachedGet('/tenancies', { params, ...config });
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
  getSchedules: async (params, config = {}) => {
    return cachedGet('/rent/schedules', { params, ...config });
  },
  generateMonthlySchedules: async (month) => {
    const res = await api.post('/rent/generate-monthly', { month });
    return res.data;
  },
  updateSchedule: async (id, data) => {
    const res = await api.put(`/rent/schedules/${id}`, data);
    return res.data;
  },
  getPayments: async (params, config = {}) => {
    return cachedGet('/rent/payments', { params, ...config });
  },
  recordPayment: async (data) => {
    const res = await api.post('/rent/payments', data);
    return res.data;
  },
  getArrearsSummary: async (config = {}) => {
    return cachedGet('/rent/arrears', config);
  },
};

// --------------------------------------------------------------------------
// Mortgages API (New UK Feature)
// --------------------------------------------------------------------------
export const mortgagesAPI = {
  getAll: async (params, config = {}) => {
    return cachedGet('/mortgages', { params, ...config });
  },
  getById: async (id, config = {}) => {
    return cachedGet(`/mortgages/${id}`, config);
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
  getPayments: async (mortgageId, params, config = {}) => {
    return cachedGet(`/mortgages/${mortgageId}/payments`, { params, ...config });
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
  getAll: async (params, config = {}) => {
    return cachedGet('/accounts', { params, ...config });
  },
  getById: async (id, config = {}) => {
    return cachedGet(`/accounts/${id}`, config);
  },
  create: async (data) => {
    const res = await api.post('/accounts', data);
    return res.data;
  },
  update: async (id, data) => {
    const res = await api.put(`/accounts/${id}`, data);
    return res.data;
  },
  getStatement: async (id, params, config = {}) => {
    return cachedGet(`/accounts/${id}/statement`, { params, ...config });
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
  getEntities: async (params, config = {}) => {
    return cachedGet('/ledger/entities', { params, ...config });
  },
  queryLedger: async (params, config = {}) => {
    return cachedGet('/ledger/query', { params, ...config });
  },
  getTransactions: async (params, config = {}) => {
    return cachedGet('/ledger/transactions', { params, ...config });
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
  getCategories: async (params, config = {}) => {
    return cachedGet('/ledger/categories', { params, ...config });
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
  getDashboardStats: async (params, config = {}) => {
    return cachedGet('/reports/dashboard', { params, ...config });
  },
  getPropertyProfitability: async (params, config = {}) => {
    return cachedGet('/reports/property-profitability', { params, ...config });
  },
  getFinancialYearReport: async (params, config = {}) => {
    return cachedGet('/reports/financial-year', { params, ...config });
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
  getConsolidatedOverview: async (config = {}) => {
    return cachedGet('/reports/consolidated/overview', config);
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
  downloadConsolidatedPdf: async (optionsOrFilename, customFilename) => {
    let companyId = null;
    let finalFilename = null;

    if (typeof optionsOrFilename === 'object' && optionsOrFilename !== null) {
      companyId = optionsOrFilename.companyId;
      finalFilename = optionsOrFilename.filename;
    } else if (typeof optionsOrFilename === 'string') {
      finalFilename = optionsOrFilename;
    } else if (typeof customFilename === 'string') {
      finalFilename = customFilename;
    }

    const url = companyId && companyId !== 'all'
      ? `/reports/consolidated/pdf?companyId=${encodeURIComponent(companyId)}`
      : '/reports/consolidated/pdf';

    const res = await api.get(url, {
      responseType: 'blob',
    });
    if (res.data?.type === 'application/json') {
      const text = await res.data.text();
      const err = JSON.parse(text);
      throw new Error(err.message || 'Consolidated PDF export failed');
    }
    const dateStr = new Date().toISOString().slice(0, 10);
    const defaultFilename = companyId && companyId !== 'all'
      ? `${companyId.toUpperCase()}_Single_Company_Report_${dateStr}.pdf`
      : `Consolidated_Group_Portfolio_Report_${dateStr}.pdf`;

    triggerBlobDownload(res.data, finalFilename || defaultFilename);
    return true;
  },
};

export default api;
