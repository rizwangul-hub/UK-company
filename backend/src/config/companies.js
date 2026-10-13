/**
 * UK Multi-Company Registry & Validation Configuration
 * Authoritative backend definition for the six isolated company entities.
 */

export const VALID_COMPANY_IDS = Object.freeze([
  'old-street',
  'best-standard',
  'sk-hamilton',
  'homewards',
  'mile-end-road',
  'global-standard',
]);

export const COMPANIES = Object.freeze([
  {
    id: 'old-street',
    slug: 'old-street',
    name: 'OLD STREET',
    legalName: 'Old Street Holdings Ltd',
    registrationNo: 'UK-08492014',
    jurisdiction: 'England & Wales',
  },
  {
    id: 'best-standard',
    slug: 'best-standard',
    name: 'BEST STANDARD',
    legalName: 'Best Standard Properties Ltd',
    registrationNo: 'UK-09381742',
    jurisdiction: 'England & Wales',
  },
  {
    id: 'sk-hamilton',
    slug: 'sk-hamilton',
    name: 'SK HAMILTON',
    legalName: 'SK Hamilton Holdings Ltd',
    registrationNo: 'UK-07421893',
    jurisdiction: 'England & Wales',
  },
  {
    id: 'homewards',
    slug: 'homewards',
    name: 'HOMEWARDS',
    legalName: 'Homewards Properties Ltd',
    registrationNo: 'UK-06839201',
    jurisdiction: 'England & Wales',
  },
  {
    id: 'mile-end-road',
    slug: 'mile-end-road',
    name: 'MILE END ROAD LTD',
    legalName: 'Mile End Road Ltd',
    registrationNo: 'UK-10293847',
    jurisdiction: 'England & Wales',
  },
  {
    id: 'global-standard',
    slug: 'global-standard',
    name: 'GLOBLE STANDARD',
    legalName: 'Global Standard Properties Ltd',
    registrationNo: 'UK-11029485',
    jurisdiction: 'England & Wales',
  },
]);

/**
 * Validates if the given company ID is one of the six registered UK companies
 */
export function isValidCompanyId(id) {
  if (!id || typeof id !== 'string') return false;
  const normalized = normalizeCompanyId(id);
  return Boolean(normalized && VALID_COMPANY_IDS.includes(normalized));
}

/**
 * Normalizes input slug or ID to a standard company ID
 */
export function normalizeCompanyId(id) {
  if (!id || typeof id !== 'string') return null;
  const s = id.toLowerCase().trim().replace(/^\/company\//, '').replace(/^\//, '');
  if (s === 'globle-standard' || s === 'global-standard') return 'global-standard';
  if (s === 'sk' || s === 'sk-hamilton') return 'sk-hamilton';
  if (s === 'mile-end' || s === 'mile-end-road' || s === 'mile-end-road-ltd') return 'mile-end-road';
  if (s === 'old-street' || s === 'oldstreet') return 'old-street';
  if (s === 'best-standard' || s === 'beststandard') return 'best-standard';
  if (s === 'homewards' || s === 'home-wards') return 'homewards';
  if (VALID_COMPANY_IDS.includes(s)) return s;
  return null;
}

/**
 * Get company metadata by ID
 */
export function getCompanyById(id) {
  const normalized = normalizeCompanyId(id);
  if (!normalized) return null;
  return COMPANIES.find((c) => c.id === normalized) || null;
}

export default COMPANIES;
