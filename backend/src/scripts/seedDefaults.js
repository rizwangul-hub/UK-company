import Category from '../models/Category.js';
import Account from '../models/Account.js';
import { VALID_COMPANY_IDS, isValidCompanyId } from '../config/companies.js';
import { seedDefaultPayees } from '../services/propertyChargeService.js';

export const STANDARD_UK_CATEGORIES = [
  // Rental & General Income
  { name: 'Rental Income', code: 'INC-RENT', type: 'INCOME', isRentalHead: true, isAllowableTaxDeduction: false },
  { name: 'Parking & Storage Space Rental', code: 'INC-PARK', type: 'INCOME', isRentalHead: false },
  { name: 'Tenant Recharges & Utility Recovery', code: 'INC-RECH', type: 'INCOME', isRentalHead: false },
  { name: 'Insurance Claims Received', code: 'INC-INS', type: 'INCOME', isRentalHead: false },
  { name: 'Director Capital Injection / Equity', code: 'INC-DIR', type: 'INCOME', isRentalHead: false },
  { name: 'Other Sundry Receipts', code: 'INC-OTH', type: 'INCOME', isRentalHead: false },

  // Operating Expenses
  { name: 'Repairs & Property Maintenance', code: 'EXP-REP', type: 'OPERATING_EXPENSE', isAllowableTaxDeduction: true },
  { name: 'Landlord & Building Insurance', code: 'EXP-INS', type: 'OPERATING_EXPENSE', isAllowableTaxDeduction: true },
  { name: 'Letting Agent & Management Fees', code: 'EXP-AGT', type: 'OPERATING_EXPENSE', isAllowableTaxDeduction: true },
  { name: 'Ground Rent & Estate Service Charges', code: 'EXP-SVC', type: 'OPERATING_EXPENSE', isAllowableTaxDeduction: true },
  { name: 'Utilities (Gas, Electric & Water)', code: 'EXP-UTL', type: 'OPERATING_EXPENSE', isAllowableTaxDeduction: true },
  { name: 'Council Tax & Empty Rates', code: 'EXP-CTX', type: 'OPERATING_EXPENSE', isAllowableTaxDeduction: true },
  { name: 'Safety Certifications (Gas, EICR, EPC)', code: 'EXP-CERT', type: 'OPERATING_EXPENSE', isAllowableTaxDeduction: true },
  { name: 'Legal, Eviction & Professional Fees', code: 'EXP-LEG', type: 'OPERATING_EXPENSE', isAllowableTaxDeduction: true },
  { name: 'Cleaning & Waste Clearance', code: 'EXP-CLN', type: 'OPERATING_EXPENSE', isAllowableTaxDeduction: true },
  { name: 'Bank & Transaction Charges', code: 'EXP-BNK', type: 'OPERATING_EXPENSE', isAllowableTaxDeduction: true },

  // Finance Costs
  { name: 'Mortgage Interest (Section 24 Relief)', code: 'FC-MTG-INT', type: 'FINANCE_COST', isAllowableTaxDeduction: false },
  { name: 'Mortgage Arrangement & Valuation Fees', code: 'FC-MTG-FEE', type: 'OPERATING_EXPENSE', isAllowableTaxDeduction: true },
];

/**
 * Seed default categories and initial accounts for a single company
 */
export const seedCompanyDefaults = async (companyId) => {
  if (!isValidCompanyId(companyId)) {
    throw new Error(`Invalid companyId for seeding: "${companyId}"`);
  }

  const catCount = await Category.countDocuments({ companyId });
  if (catCount === 0) {
    const catsToInsert = STANDARD_UK_CATEGORIES.map((c) => ({
      ...c,
      companyId,
    }));
    await Category.insertMany(catsToInsert);
  }

  const accCount = await Account.countDocuments({ companyId });
  if (accCount === 0) {
    const defaultAccounts = [
      {
        companyId,
        name: 'Main Operating Account',
        accountType: 'BANK',
        bankName: 'Barclays Bank UK',
        sortCode: '20-00-00',
        accountNumber: '12345678',
        currency: 'GBP',
        openingBalance: 0,
        currentBalance: 0,
        isActive: true,
        notes: `Primary UK operational bank account for ${companyId}`,
      },
      {
        companyId,
        name: 'Petty Cash Float',
        accountType: 'CASH',
        bankName: 'Cash Float',
        currency: 'GBP',
        openingBalance: 0,
        currentBalance: 0,
        isActive: true,
        notes: `Emergency property maintenance cash float for ${companyId}`,
      },
    ];
    await Account.insertMany(defaultAccounts);
  }

  // Seed default payees (e.g. Zircon Holdings Limited)
  await seedDefaultPayees(companyId).catch(() => {});
};

/**
 * Seed default categories and accounts for all six registered companies
 */
export const seedAllCompaniesDefaults = async () => {
  try {
    for (const companyId of VALID_COMPANY_IDS) {
      await seedCompanyDefaults(companyId);
    }
  } catch (err) {
    console.error('Notice: seeding all company defaults encountered:', err.message);
  }
};

export const seedDefaultsIfEmpty = seedAllCompaniesDefaults;
export default seedAllCompaniesDefaults;
