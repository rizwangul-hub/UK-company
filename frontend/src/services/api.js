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
 * Normalize query params so redundant companyId or empty filters share the exact same cache key
 */
const normalizeParams = (params) => {
  if (!params || typeof params !== 'object') return '';
  const cleaned = {};
  const keys = Object.keys(params).sort();
  for (const k of keys) {
    const val = params[k];
    // Ignore redundant companyId query param as it is already enforced via x-company-id header
    if (k === 'companyId') continue;
    // Ignore empty strings, null, undefined
    if (val === '' || val === null || val === undefined) continue;
    cleaned[k] = val;
  }
  return Object.keys(cleaned).length > 0 ? JSON.stringify(cleaned) : '';
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
  const paramsKey = normalizeParams(config.params);
  return `${url}::${companyId || 'global'}::${paramsKey}`;
};

/**
 * Synchronously retrieves cached API response data from memory if valid within TTL.
 * Allows components to mount instantly without displaying unnecessary loading spinners.
 */
export const getApiCache = (url, config = {}, ttlMs = 300000) => {
  const cacheKey = getCacheKey(url, config);
  const cached = requestCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < ttlMs) {
    return cached.data;
  }
  return null;
};

/**
 * Cached & Deduplicated GET Request:
 * 1. Checks memory cache (returns in 0ms if within TTL and not force-refreshed).
 * 2. Deduplicates simultaneous in-flight requests so only 1 HTTP network call is made.
 * 3. Caches response upon resolution with a 5-minute default TTL.
 * 4. Automatically purged whenever a mutation (POST/PUT/PATCH/DELETE) occurs.
 */
export const cachedGet = async (url, config = {}, ttlMs = 300000) => {
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

  // If sending FormData, delete Content-Type so Axios & browser automatically compute boundary
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
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
// Appliances, Warranties & Currys Care API
// --------------------------------------------------------------------------
export const appliancesAPI = {
  getAll: async (params, config = {}) => {
    return cachedGet('/appliances', { params, ...config });
  },
  getById: async (id, config = {}) => {
    return cachedGet(`/appliances/${id}`, config);
  },
  create: async (data) => {
    const res = await api.post('/appliances', data);
    return res.data;
  },
  update: async (id, data) => {
    const res = await api.put(`/appliances/${id}`, data);
    return res.data;
  },
  delete: async (id) => {
    const res = await api.delete(`/appliances/${id}`);
    return res.data;
  },
  uploadDocument: async (id, formData) => {
    const res = await api.post(`/appliances/${id}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  deleteDocument: async (id, documentId) => {
    const res = await api.delete(`/appliances/${id}/documents/${documentId}`);
    return res.data;
  },
  getCurrysContacts: async (config = {}) => {
    return cachedGet('/appliances/currys-contacts', config);
  },
  getTasks: async (config = {}) => {
    return cachedGet('/appliances/tasks', config);
  },
  createTask: async (data) => {
    const res = await api.post('/appliances/tasks', data);
    return res.data;
  },
  updateTask: async (id, data) => {
    const res = await api.put(`/appliances/tasks/${id}`, data);
    return res.data;
  },
  assignProperty: async (id, data) => {
    const res = await api.put(`/appliances/${id}/assign-property`, data);
    return res.data;
  },
  getReceipts: async (config = {}) => {
    return cachedGet('/appliances/receipts', config);
  },
  createReceipt: async (data) => {
    const res = await api.post('/appliances/receipts', data);
    return res.data;
  },
  uploadReceiptDocument: async (id, formData) => {
    const res = await api.post(`/appliances/receipts/${id}/documents`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  getReminders: async (params, config = {}) => {
    return cachedGet('/appliances/reminders', { params, ...config });
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
  getHeadSummary: async (params, config = {}) => {
    return cachedGet('/ledger/head-summary', { params, ...config });
  },
  queryLedger: async (params, config = {}) => {
    return cachedGet('/ledger/query', { params, ...config });
  },
  getTransactions: async (params, config = {}) => {
    return cachedGet('/ledger/transactions', { params, ...config });
  },
  getTransactionById: async (id, config = {}) => {
    return cachedGet(`/ledger/transactions/${id}`, config);
  },
  updateTransaction: async (id, data) => {
    const res = await api.put(`/ledger/transactions/${id}`, data);
    return res.data;
  },
  deleteTransaction: async (id, data = {}) => {
    const res = await api.delete(`/ledger/transactions/${id}`, { data });
    return res.data;
  },
  permanentlyDeleteTransactions: async (ids) => {
    const res = await api.delete('/ledger/transactions/permanent', { data: { ids } });
    return res.data;
  },
  restoreTransaction: async (id, data = {}) => {
    const res = await api.post(`/ledger/transactions/${id}/restore`, data);
    return res.data;
  },
  getRecycleBin: async (params, config = {}) => {
    return cachedGet('/ledger/transactions/recycle-bin', { params, ...config });
  },
  getTransactionAudit: async (id, config = {}) => {
    return cachedGet(`/ledger/transactions/${id}/audit`, config);
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
  getCategoryHierarchy: async (params, config = {}) => {
    return cachedGet('/ledger/categories/hierarchy', { params, ...config });
  },
  createHeadCategory: async (data) => {
    const res = await api.post('/ledger/categories/heads', data);
    clearApiCache();
    return res.data;
  },
  createSubHeadCategory: async (data) => {
    const res = await api.post('/ledger/categories/subheads', data);
    clearApiCache();
    return res.data;
  },
  updateCategoryHierarchy: async (id, data) => {
    const res = await api.put(`/ledger/categories/${id}`, data);
    clearApiCache();
    return res.data;
  },
  deleteCategoryHierarchy: async (id) => {
    const res = await api.delete(`/ledger/categories/${id}`);
    clearApiCache();
    return res.data;
  },
  previewCategoryBackfill: async (params, config = {}) => {
    return cachedGet('/ledger/categories/backfill/preview', { params, ...config });
  },
  applyCategoryBackfill: async (data = {}) => {
    const res = await api.post('/ledger/categories/backfill/apply', data);
    clearApiCache();
    return res.data;
  },
  createCategory: async (data) => {
    const res = await api.post('/ledger/categories', data);
    clearApiCache();
    return res.data;
  },
  updateCategory: async (id, data) => {
    const res = await api.put(`/ledger/categories/${id}`, data);
    clearApiCache();
    return res.data;
  },
  deleteCategory: async (id) => {
    const res = await api.delete(`/ledger/categories/${id}`);
    clearApiCache();
    return res.data;
  },
  uploadReceipt: async (formData) => {
    const res = await api.post('/ledger/upload-receipt', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  attachReceipt: async (transactionId, formData) => {
    const res = await api.post(`/ledger/transactions/${transactionId}/receipt`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  removeReceipt: async (transactionId) => {
    const res = await api.delete(`/ledger/transactions/${transactionId}/receipt`);
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

// --------------------------------------------------------------------------
// Profit & Loss API
// --------------------------------------------------------------------------
export const pnlAPI = {
  getReport: async (params, config = {}) => {
    return cachedGet('/pnl', { params, ...config });
  },
  getSummary: async (params, config = {}) => {
    return cachedGet('/pnl/summary', { params, ...config });
  },
  classifyTransaction: async (id, data) => {
    const res = await api.patch(`/pnl/classify/${id}`, data);
    clearApiCache();
    return res.data;
  },
  downloadExcel: async (params, customFilename) => {
    const res = await api.get('/pnl/export/excel', {
      params,
      responseType: 'blob',
    });
    const filename = customFilename || `UK_Property_Profit_and_Loss_${params?.datePreset || 'Statement'}.xlsx`;
    triggerBlobDownload(res.data, filename);
    return true;
  },
  downloadCsv: async (params, customFilename) => {
    const res = await api.get('/pnl/export/csv', {
      params,
      responseType: 'blob',
    });
    const filename = customFilename || `UK_Property_Profit_and_Loss_${params?.datePreset || 'Statement'}.csv`;
    triggerBlobDownload(res.data, filename);
    return true;
  },
};

// --------------------------------------------------------------------------
// Property Documents & Compliance API
// --------------------------------------------------------------------------
export const complianceAPI = {
  getDocuments: async (propertyId, params, config = {}) => {
    return cachedGet(`/compliance/properties/${propertyId}/documents`, { params, ...config });
  },
  createDocument: async (propertyId, formData) => {
    const isFormData = formData instanceof FormData;
    const res = await api.post(`/compliance/properties/${propertyId}/documents`, formData, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : {},
    });
    return res.data;
  },
  updateDocument: async (id, data) => {
    const res = await api.put(`/compliance/documents/${id}`, data);
    return res.data;
  },
  uploadVersion: async (id, formData) => {
    const res = await api.post(`/compliance/documents/${id}/version`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  deleteDocument: async (id) => {
    const res = await api.delete(`/compliance/documents/${id}`);
    return res.data;
  },
  downloadDocument: async (id, versionIndex) => {
    const path = versionIndex === undefined
      ? `/compliance/documents/${id}/download`
      : `/compliance/documents/${id}/versions/${versionIndex}/download`;
    const newTab = window.open('', '_blank');
    try {
      const res = await api.get(path, { responseType: 'blob' });
      const objectUrl = URL.createObjectURL(res.data);
      if (newTab) {
        newTab.location.href = objectUrl;
      } else {
        const link = document.createElement('a');
        link.href = objectUrl;
        link.target = '_blank';
        link.rel = 'noopener';
        link.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 300_000);
    } catch (error) {
      newTab?.close();
      throw error;
    }
  },
  getCouncilApplications: async (propertyId, params, config = {}) => {
    const url = propertyId
      ? `/compliance/properties/${propertyId}/council-applications`
      : '/compliance/council-applications';
    return cachedGet(url, { params, ...config });
  },
  createCouncilApplication: async (propertyId, data) => {
    const res = await api.post(`/compliance/properties/${propertyId}/council-applications`, data);
    return res.data;
  },
  updateCouncilApplication: async (id, data) => {
    const res = await api.put(`/compliance/council-applications/${id}`, data);
    return res.data;
  },
  addCorrespondence: async (id, formData) => {
    const isFormData = formData instanceof FormData;
    const res = await api.post(`/compliance/council-applications/${id}/correspondence`, formData, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : {},
    });
    return res.data;
  },
  getOverview: async (config = {}) => {
    return cachedGet('/compliance/overview', config);
  },
  getNotifications: async (config = {}) => {
    return cachedGet('/compliance/notifications', config);
  },
  markNotificationRead: async (id) => {
    const res = await api.patch(`/compliance/notifications/${id}/read`);
    return res.data;
  },
  markAllNotificationsRead: async () => {
    const res = await api.post('/compliance/notifications/mark-all-read');
    return res.data;
  },
  checkReminders: async () => {
    const res = await api.post('/compliance/reminders/check');
    return res.data;
  },
  downloadReport: async (format = 'excel', customFilename) => {
    const res = await api.get(`/compliance/reports/export?format=${format}`, {
      responseType: 'blob',
    });
    const defaultFilename = `Compliance_Register_${new Date().toISOString().slice(0, 10)}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
    triggerBlobDownload(res.data, customFilename || defaultFilename);
    return true;
  },
  getEmailSettings: async () => {
    const res = await api.get('/compliance/email-settings');
    return res.data;
  },
  updateEmailSettings: async (data) => {
    const res = await api.put('/compliance/email-settings', data);
    return res.data;
  },
  sendTestEmail: async (data) => {
    const res = await api.post('/compliance/email-settings/test', data);
    return res.data;
  },
  checkExpiryEmailsNow: async (data = {}) => {
    const res = await api.post('/compliance/email-settings/check-now', data);
    return res.data;
  },
};

export const propertyChargesAPI = {
  getPayees: async (config = {}) => {
    return cachedGet('/property-charges/payees', config);
  },
  createPayee: async (data) => {
    const res = await api.post('/property-charges/payees', data);
    return res.data;
  },
  updatePayee: async (id, data) => {
    const res = await api.put(`/property-charges/payees/${id}`, data);
    return res.data;
  },
  getPropertyConfigs: async (propertyId, config = {}) => {
    return cachedGet(`/property-charges/properties/${propertyId}/configs`, config);
  },
  updatePropertyConfig: async (propertyId, chargeType, data) => {
    const res = await api.put(`/property-charges/properties/${propertyId}/configs/${chargeType}`, data);
    return res.data;
  },
  getDemands: async (params, config = {}) => {
    return cachedGet('/property-charges/demands', { params, ...config });
  },
  getDemandById: async (id, config = {}) => {
    return cachedGet(`/property-charges/demands/${id}`, config);
  },
  createDemand: async (formData) => {
    const isFormData = formData instanceof FormData;
    const res = await api.post('/property-charges/demands', formData, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : {},
    });
    return res.data;
  },
  updateDemandStatus: async (id, data) => {
    const res = await api.patch(`/property-charges/demands/${id}/status`, data);
    return res.data;
  },
  getPayments: async (params, config = {}) => {
    return cachedGet('/property-charges/payments', { params, ...config });
  },
  recordPayment: async (formData) => {
    const isFormData = formData instanceof FormData;
    const res = await api.post('/property-charges/payments', formData, {
      headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : {},
    });
    return res.data;
  },
  getPropertyLedger: async (propertyId, params, config = {}) => {
    return cachedGet(`/property-charges/properties/${propertyId}/ledger`, { params, ...config });
  },
  getOverview: async (config = {}) => {
    return cachedGet('/property-charges/overview', config);
  },
  checkReminders: async () => {
    const res = await api.post('/property-charges/reminders/check');
    return res.data;
  },
};

export const statementImportAPI = {
  previewStatement: async (formData) => {
    const res = await api.post('/statement-import/parse-preview', formData);
    return res.data;
  },
  processBatch: async (formData) => {
    const res = await api.post('/statement-import/process-batch', formData);
    return res.data;
  },
  getBatches: async (config = {}) => {
    return cachedGet('/statement-import/batches', config);
  },
  getBatchById: async (id, params = {}, config = {}) => {
    return cachedGet(`/statement-import/batches/${id}`, { params, ...config });
  },
  updateBatchRow: async (batchId, rowId, data) => {
    const res = await api.put(`/statement-import/batches/${batchId}/rows/${rowId}`, data);
    return res.data;
  },
  bulkUpdateRows: async (batchId, data) => {
    const res = await api.put(`/statement-import/batches/${batchId}/rows`, data);
    return res.data;
  },
  postBatch: async (batchId, data = {}) => {
    const res = await api.post(`/statement-import/batches/${batchId}/post`, data);
    return res.data;
  },
  reverseBatch: async (batchId) => {
    const res = await api.post(`/statement-import/batches/${batchId}/reverse`);
    return res.data;
  },
  cancelBatch: async (batchId) => {
    const res = await api.post(`/statement-import/batches/${batchId}/cancel`);
    return res.data;
  },
  deleteBatch: async (batchId) => {
    try {
      const res = await api.delete(`/statement-import/batches/${batchId}`);
      return res.data;
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 405) {
        const res = await api.post(`/statement-import/batches/${batchId}/delete`);
        return res.data;
      }
      throw err;
    }
  },
  getReconciliation: async (params, config = {}) => {
    return cachedGet('/statement-import/reconciliation', { params, ...config });
  },
};

export default api;
