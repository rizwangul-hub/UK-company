import { seedCompanyDefaults, seedAllCompaniesDefaults, STANDARD_UK_CATEGORIES } from '../scripts/seedDefaults.js';

export { seedCompanyDefaults, seedAllCompaniesDefaults, STANDARD_UK_CATEGORIES };

export const seedUKDefaults = async (companyId = null) => {
  if (companyId) {
    return await seedCompanyDefaults(companyId);
  }
  return await seedAllCompaniesDefaults();
};

export default seedUKDefaults;
