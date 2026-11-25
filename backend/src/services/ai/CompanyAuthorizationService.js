import { COMPANIES, VALID_COMPANY_IDS, normalizeCompanyId, getCompanyById } from '../../config/companies.js';

/**
 * Enforces user-level company & role authorization for all AI tool calls and actions.
 * Gemini never determines its own access rights; every call is verified here.
 */
export const getAuthorizedCompanyIds = (user) => {
  if (!user) return [];
  if (Array.isArray(user.allowedCompanies) && user.allowedCompanies.length > 0) {
    return user.allowedCompanies
      .map((c) => normalizeCompanyId(String(c)))
      .filter((c) => Boolean(c && VALID_COMPANY_IDS.includes(c)));
  }
  return [...VALID_COMPANY_IDS];
};

export const getAuthorizedCompanies = (user) => {
  const allowedIds = new Set(getAuthorizedCompanyIds(user));
  return COMPANIES.filter((c) => allowedIds.has(c.id));
};

export const assertCompanyAuthorized = (user, requestedCompanyId) => {
  if (!user) {
    const err = new Error('Authentication required.');
    err.status = 401;
    throw err;
  }
  const normalized = normalizeCompanyId(String(requestedCompanyId || ''));
  if (!normalized) {
    const err = new Error(`Invalid company identifier: "${requestedCompanyId}".`);
    err.status = 400;
    throw err;
  }
  const allowedIds = getAuthorizedCompanyIds(user);
  if (!allowedIds.includes(normalized)) {
    const err = new Error(`Forbidden: You do not have access to company "${normalized}".`);
    err.status = 403;
    throw err;
  }
  return {
    companyId: normalized,
    company: getCompanyById(normalized),
  };
};

export const resolveRequestedCompanies = (user, requestedCompanyId, fallbackContext = null) => {
  const allowedIds = getAuthorizedCompanyIds(user);
  const target = requestedCompanyId || fallbackContext;

  if (!target || String(target).toUpperCase() === 'ALL') {
    return {
      mode: 'ALL',
      companyIds: allowedIds,
      companies: COMPANIES.filter((c) => allowedIds.includes(c.id)),
    };
  }

  const { companyId, company } = assertCompanyAuthorized(user, target);
  return {
    mode: 'SINGLE',
    companyIds: [companyId],
    companies: [company],
  };
};

export const assertWriteRoleAllowed = (user) => {
  if (!user) {
    const err = new Error('Authentication required.');
    err.status = 401;
    throw err;
  }
  if (user.role === 'viewer') {
    const err = new Error('Forbidden: Viewer role cannot execute write operations.');
    err.status = 403;
    throw err;
  }
  return true;
};

export default {
  getAuthorizedCompanyIds,
  getAuthorizedCompanies,
  assertCompanyAuthorized,
  resolveRequestedCompanies,
  assertWriteRoleAllowed,
};
