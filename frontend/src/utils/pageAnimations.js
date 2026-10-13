/**
 * Mapping of application views to distinct 3D page transition animation styles.
 * Each view has a unique transfer animation:
 * - dashboard: Center 3D perspective zoom & float
 * - data-entry: Rises up from bottom with 3D tilt
 * - properties: Classic book page turn from left spine
 * - tenants: Slides in from the right edge with 3D angle
 * - rent: Cascades down from top
 * - mortgages: 3D folder/vault vertical unfold
 * - accounts: Slides in from the left edge
 * - chart-of-accounts: Isometric diagonal glide
 * - ledger: Deep financial ledger double-page turn
 * - reports: Executive statement drop from top
 * - settings: Modern 3D scale pop with rotational settle
 */
export const PAGE_ANIMATION_CLASSES = {
  'dashboard': 'page-anim-zoom-3d',
  'data-entry': 'page-anim-slide-bottom',
  'properties': 'page-anim-book-flip',
  'appliances': 'page-anim-scale-pop',
  'tenants': 'page-anim-slide-right',
  'rent': 'page-anim-slide-top',
  'mortgages': 'page-anim-flip-x',
  'accounts': 'page-anim-slide-left',
  'chart-of-accounts': 'page-anim-diagonal',
  'ledger': 'page-anim-ledger-flip',
  'reports': 'page-anim-slide-top',
  'settings': 'page-anim-scale-pop',
  'master-dashboard': 'page-anim-zoom-3d',
  'company-selection': 'page-anim-slide-bottom',
};

/**
 * Returns the CSS class for the given page view.
 * @param {string} view
 * @returns {string}
 */
export const getPageAnimationClass = (view) => {
  return PAGE_ANIMATION_CLASSES[view] || 'page-anim-book-flip';
};

export default getPageAnimationClass;
