// Dynamic logo resolution supporting any image extension (.jpg, .jpeg, .png, .webp, .svg)
const logoModules = import.meta.glob('../assets/logo/*.{jpg,jpeg,png,webp,svg}', { eager: true, import: 'default' });

function resolveLogo(name) {
  const target = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const [key, value] of Object.entries(logoModules)) {
    const fileBase = key.split('/').pop()?.split('.')[0]?.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (fileBase === target) return value;
  }
  return null;
}

const oldStreetLogo = resolveLogo('OldStreetLogo');
const bestStandardLogo = resolveLogo('BestStandardLogo');
const skLogo = resolveLogo('SKLogo');
const homewardsLogo = resolveLogo('HomeWardsLogo');
const mileEndLogo = resolveLogo('MileEndLogo');
const globalStandardLogo = resolveLogo('GlobalStandardLogo');

export const COMPANIES = [
  {
    id: 'old-street',
    slug: 'old-street',
    name: 'OLD STREET',
    legalName: 'Old Street Holdings Ltd',
    tagline: 'Property Management & Holdings',
    route: '/company/old-street',
    logo: oldStreetLogo,
    registrationNo: 'UK-08492014',
    jurisdiction: 'England & Wales',
    accentColor: '#D97706',
    establishedYear: '2016',
    description: 'Prime London & Greater UK commercial and residential property management and holding facilities.',
  },
  {
    id: 'best-standard',
    slug: 'best-standard',
    name: 'BEST STANDARD',
    legalName: 'Best Standard Properties Ltd',
    tagline: 'Property Management & Portfolio',
    route: '/company/best-standard',
    logo: bestStandardLogo,
    registrationNo: 'UK-09381742',
    jurisdiction: 'England & Wales',
    accentColor: '#CA8A04',
    establishedYear: '2018',
    description: 'High-yield residential portfolios, HMO operations, and executive tenant leasing facilities.',
  },
  {
    id: 'sk-hamilton',
    slug: 'sk-hamilton',
    name: 'SK HAMILTON',
    legalName: 'SK Hamilton Holdings Ltd',
    tagline: 'Property Management & Finance',
    route: '/company/sk-hamilton',
    logo: skLogo,
    registrationNo: 'UK-07421893',
    jurisdiction: 'England & Wales',
    accentColor: '#2563EB',
    establishedYear: '2015',
    description: 'Strategic UK property acquisitions, mortgage financing structures, and commercial asset stewardship.',
  },
  {
    id: 'homewards',
    slug: 'homewards',
    name: 'HOMEWARDS',
    legalName: 'Homewards Properties Ltd',
    tagline: 'Residential & Commercial Management',
    route: '/company/homewards',
    logo: homewardsLogo,
    registrationNo: 'UK-06839201',
    jurisdiction: 'England & Wales',
    accentColor: '#4F46E5',
    establishedYear: '2017',
    description: 'Comprehensive residential tenancy management, statutory compliance, and rental yield optimization.',
  },
  {
    id: 'mile-end-road',
    slug: 'mile-end-road',
    name: 'MILE END ROAD LTD',
    legalName: 'Mile End Road Ltd',
    tagline: 'Commercial & Property Management',
    route: '/company/mile-end-road',
    logo: mileEndLogo,
    registrationNo: 'UK-10293847',
    jurisdiction: 'England & Wales',
    accentColor: '#0284C7',
    establishedYear: '2019',
    description: 'East London commercial parade management, mixed-use units, and urban ground leases.',
  },
  {
    id: 'global-standard',
    slug: 'global-standard',
    name: 'GLOBLE STANDARD',
    legalName: 'Global Standard Properties Ltd',
    tagline: 'Property Portfolio & Investment',
    route: '/company/global-standard',
    logo: globalStandardLogo,
    registrationNo: 'UK-11029485',
    jurisdiction: 'England & Wales',
    accentColor: '#059669',
    establishedYear: '2020',
    description: 'Cross-border UK investment properties, institutional asset custody, and multi-let property finance.',
  },
];

/**
 * Normalizes a company slug for case-insensitive matching and spelling variations
 */
export function normalizeCompanySlug(slug) {
  if (!slug) return '';
  const s = String(slug).toLowerCase().trim().replace(/^\/company\//, '').replace(/^\//, '');
  // Map common spelling variations
  if (s === 'globle-standard' || s === 'global-standard') return 'global-standard';
  if (s === 'sk' || s === 'sklogo' || s === 'sk-hamilton') return 'sk-hamilton';
  if (s === 'mile-end' || s === 'mile-end-road' || s === 'mile-end-road-ltd') return 'mile-end-road';
  if (s === 'old-street' || s === 'oldstreet') return 'old-street';
  if (s === 'best-standard' || s === 'beststandard') return 'best-standard';
  if (s === 'homewards' || s === 'home-wards') return 'homewards';
  return s;
}

/**
 * Retrieve company configuration by slug or path
 */
export function getCompanyBySlug(slug) {
  const normalized = normalizeCompanySlug(slug);
  return COMPANIES.find((c) => c.slug === normalized) || null;
}

/**
 * Retrieve company configuration by ID
 */
export function getCompanyById(id) {
  if (!id) return null;
  return COMPANIES.find((c) => c.id === id) || null;
}

export default COMPANIES;
