import { isValidCompanyId, normalizeCompanyId, getCompanyById, VALID_COMPANY_IDS } from '../config/companies.js';

/**
 * Company Context Middleware
 * Enforces strict multi-company data isolation on all protected financial and property routes.
 * Rejects requests that lack a valid, authorized company context.
 */
export const requireCompanyContext = (req, res, next) => {
  // 1. Ensure user is authenticated
  if (!req.user) {
    return res.status(401).json({
      success: false,
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Authentication required prior to establishing company context.',
    });
  }

  // 2. Extract company identifier from headers, query parameters, or request body
  const rawCompanyId =
    req.headers['x-company-id'] ||
    req.headers['x-company'] ||
    req.query.companyId ||
    req.body?.companyId;

  if (!rawCompanyId) {
    return res.status(400).json({
      success: false,
      code: 'NO_COMPANY_CONTEXT',
      message:
        'Company context required. Please provide an active company ID via "x-company-id" header or "companyId" parameter.',
      validCompanies: VALID_COMPANY_IDS,
    });
  }

  // 3. Normalize and validate against the 6 registered UK companies
  const normalized = normalizeCompanyId(String(rawCompanyId));
  if (!normalized || !isValidCompanyId(normalized)) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_COMPANY_ID',
      message: `Invalid company identifier: "${rawCompanyId}". Must be one of the 6 registered UK entities.`,
      validCompanies: VALID_COMPANY_IDS,
    });
  }

  // 4. Verify user permissions for the requested company
  // If user has specific allowed companies defined, enforce access restriction
  if (Array.isArray(req.user.allowedCompanies) && req.user.allowedCompanies.length > 0) {
    const hasPermission = req.user.allowedCompanies.map((c) => normalizeCompanyId(c)).includes(normalized);
    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN_COMPANY_ACCESS',
        message: `Forbidden: User "${req.user.email || req.user._id || 'user'}" does not have authorization to access company "${normalized}".`,
      });
    }
  }

  // 5. Attach company context to request object
  req.companyId = normalized;
  req.company = getCompanyById(normalized);

  next();
};

export default requireCompanyContext;
