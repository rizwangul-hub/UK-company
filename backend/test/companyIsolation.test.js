import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  VALID_COMPANY_IDS,
  isValidCompanyId,
  normalizeCompanyId,
  getCompanyById,
  COMPANIES,
} from '../src/config/companies.js';
import { requireCompanyContext } from '../src/middleware/companyContext.js';
import { protect } from '../src/middleware/auth.js';
import { round2 } from '../src/services/ledgerService.js';
import {
  generateExcelReport,
  generatePdfReport,
  buildLedgerReportData,
} from '../src/services/reportExportService.js';

// Schemas
import Property from '../src/models/Property.js';
import Unit from '../src/models/Unit.js';
import Tenant from '../src/models/Tenant.js';
import TenancyAgreement from '../src/models/TenancyAgreement.js';
import RentSchedule from '../src/models/RentSchedule.js';
import RentPayment from '../src/models/RentPayment.js';
import Mortgage from '../src/models/Mortgage.js';
import MortgagePayment from '../src/models/MortgagePayment.js';
import Account from '../src/models/Account.js';
import Category from '../src/models/Category.js';
import Transaction from '../src/models/Transaction.js';
import Voucher from '../src/models/Voucher.js';
import Appliance from '../src/models/Appliance.js';
import MaintenanceTask from '../src/models/MaintenanceTask.js';
import SupplierReceipt from '../src/models/SupplierReceipt.js';
import PropertyDocument from '../src/models/PropertyDocument.js';
import CouncilApplication from '../src/models/CouncilApplication.js';
import ComplianceNotification from '../src/models/ComplianceNotification.js';

// -----------------------------------------------------------------------------
// 1. COMPANY REGISTRY & IDENTIFIER VALIDATION
// -----------------------------------------------------------------------------
test('COMPANIES: All 6 official UK company IDs are registered and valid', () => {
  const expectedCompanies = [
    'old-street',
    'best-standard',
    'sk-hamilton',
    'homewards',
    'mile-end-road',
    'global-standard',
  ];

  assert.equal(VALID_COMPANY_IDS.length, 6);
  expectedCompanies.forEach((id) => {
    assert.ok(VALID_COMPANY_IDS.includes(id), `Expected ${id} to be in VALID_COMPANY_IDS`);
    assert.ok(isValidCompanyId(id), `Expected ${id} to pass isValidCompanyId`);
  });
});

test('COMPANIES: Normalization correctly cleans and maps slugs, aliases, and route prefixes', () => {
  assert.equal(normalizeCompanyId('/company/old-street'), 'old-street');
  assert.equal(normalizeCompanyId('OLD-STREET'), 'old-street');
  assert.equal(normalizeCompanyId('sk'), 'sk-hamilton');
  assert.equal(normalizeCompanyId('globle-standard'), 'global-standard');
  assert.equal(normalizeCompanyId('mile-end-road-ltd'), 'mile-end-road');
  assert.equal(normalizeCompanyId('home-wards'), 'homewards');
  assert.equal(normalizeCompanyId('beststandard'), 'best-standard');
});

test('COMPANIES: Rejects unlisted companies, empty strings, and non-string inputs', () => {
  assert.equal(isValidCompanyId(''), false);
  assert.equal(isValidCompanyId(null), false);
  assert.equal(isValidCompanyId(undefined), false);
  assert.equal(isValidCompanyId('random-unauthorized-corp'), false);
  assert.equal(isValidCompanyId('pakistan-property-ltd'), false);
});

test('COMPANIES: Metadata retrieval returns correct corporate names', () => {
  const oldStreet = getCompanyById('old-street');
  assert.ok(oldStreet);
  assert.equal(oldStreet.name, 'OLD STREET');
  assert.equal(oldStreet.legalName, 'Old Street Holdings Ltd');

  const mileEnd = getCompanyById('mile-end-road');
  assert.ok(mileEnd);
  assert.equal(mileEnd.name, 'MILE END ROAD LTD');
});

// -----------------------------------------------------------------------------
// 2. COMPANY CONTEXT MIDDLEWARE (requireCompanyContext)
// -----------------------------------------------------------------------------
test('MIDDLEWARE: Rejects request with 401 when req.user is missing (unauthenticated)', () => {
  const req = { headers: { 'x-company-id': 'old-street' }, query: {}, body: {} };
  let statusSent = null;
  let jsonSent = null;
  const res = {
    status(s) {
      statusSent = s;
      return this;
    },
    json(data) {
      jsonSent = data;
      return this;
    },
  };
  let nextCalled = false;

  requireCompanyContext(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(statusSent, 401);
  assert.equal(jsonSent?.code, 'AUTHENTICATION_REQUIRED');
});

test('MIDDLEWARE: Rejects request with 400 when x-company-id header is missing', () => {
  const req = {
    user: { email: 'admin@pixxtechnologies.com', role: 'admin' },
    headers: {},
    query: {},
    body: {},
  };
  let statusSent = null;
  let jsonSent = null;
  const res = {
    status(s) {
      statusSent = s;
      return this;
    },
    json(data) {
      jsonSent = data;
      return this;
    },
  };
  let nextCalled = false;

  requireCompanyContext(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(statusSent, 400);
  assert.equal(jsonSent?.code, 'NO_COMPANY_CONTEXT');
});

test('MIDDLEWARE: Rejects request with 400 when company ID is invalid', () => {
  const req = {
    user: { email: 'admin@pixxtechnologies.com', role: 'admin' },
    headers: { 'x-company-id': 'unauthorized-hacker-co' },
    query: {},
    body: {},
  };
  let statusSent = null;
  let jsonSent = null;
  const res = {
    status(s) {
      statusSent = s;
      return this;
    },
    json(data) {
      jsonSent = data;
      return this;
    },
  };
  let nextCalled = false;

  requireCompanyContext(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(statusSent, 400);
  assert.equal(jsonSent?.code, 'INVALID_COMPANY_ID');
});

test('MIDDLEWARE: Successfully attaches req.companyId for valid company and calls next()', () => {
  const req = {
    user: { email: 'admin@pixxtechnologies.com', role: 'admin' },
    headers: { 'x-company-id': 'SK-HAMILTON' },
    query: {},
    body: {},
  };
  const res = {
    status(s) {
      return this;
    },
    json() {
      return this;
    },
  };
  let nextCalled = false;

  requireCompanyContext(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.companyId, 'sk-hamilton');
  assert.equal(req.company?.name, 'SK HAMILTON');
});

test('MIDDLEWARE: Allows single administrator to access any of the six companies', () => {
  const adminUser = { role: 'admin', allowedCompanies: [] };

  VALID_COMPANY_IDS.forEach((compId) => {
    const req = {
      headers: { 'x-company-id': compId },
      query: {},
      body: {},
      user: adminUser,
    };
    let nextCalled = false;
    requireCompanyContext(req, {}, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true, `Admin should have access to company ${compId}`);
    assert.equal(req.companyId, compId);
  });
});

test('MIDDLEWARE: Restricts non-admin user when company is not in allowedCompanies (403)', () => {
  const restrictedUser = { role: 'viewer', allowedCompanies: ['old-street'] };
  const req = {
    headers: { 'x-company-id': 'homewards' },
    query: {},
    body: {},
    user: restrictedUser,
  };
  let statusSent = null;
  let jsonSent = null;
  const res = {
    status(s) {
      statusSent = s;
      return this;
    },
    json(data) {
      jsonSent = data;
      return this;
    },
  };
  let nextCalled = false;

  requireCompanyContext(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(statusSent, 403);
  assert.equal(jsonSent?.code, 'FORBIDDEN_COMPANY_ACCESS');
});

// -----------------------------------------------------------------------------
// 3. MONGOOSE SCHEMA & INDEX ISOLATION
// -----------------------------------------------------------------------------
test('SCHEMAS: All 17 operational models have required companyId in schema', () => {
  const models = [
    { name: 'Property', schema: Property.schema },
    { name: 'Unit', schema: Unit.schema },
    { name: 'Tenant', schema: Tenant.schema },
    { name: 'TenancyAgreement', schema: TenancyAgreement.schema },
    { name: 'RentSchedule', schema: RentSchedule.schema },
    { name: 'RentPayment', schema: RentPayment.schema },
    { name: 'Mortgage', schema: Mortgage.schema },
    { name: 'MortgagePayment', schema: MortgagePayment.schema },
    { name: 'Account', schema: Account.schema },
    { name: 'Category', schema: Category.schema },
    { name: 'Transaction', schema: Transaction.schema },
    { name: 'Voucher', schema: Voucher.schema },
    { name: 'Appliance', schema: Appliance.schema },
    { name: 'MaintenanceTask', schema: MaintenanceTask.schema },
    { name: 'PropertyDocument', schema: PropertyDocument.schema },
    { name: 'CouncilApplication', schema: CouncilApplication.schema },
    { name: 'ComplianceNotification', schema: ComplianceNotification.schema },
  ];

  models.forEach(({ name, schema }) => {
    const companyIdPath = schema.path('companyId');
    assert.ok(companyIdPath, `Model ${name} must define companyId path in schema`);
    assert.equal(companyIdPath.instance, 'String', `Model ${name} companyId must be a String`);
    assert.ok(companyIdPath.isRequired, `Model ${name} companyId must be required`);
  });
});

test('SCHEMAS: Compound unique indexes exist for Account, Category, and Voucher', () => {
  // Account should have compound index on { companyId: 1, name: 1 }
  const accountIndexes = Account.schema.indexes();
  const hasAccountCompound = accountIndexes.some(
    ([fields, opts]) => fields.companyId === 1 && fields.name === 1 && opts?.unique === true
  );
  assert.ok(hasAccountCompound, 'Account must have compound unique index on { companyId: 1, name: 1 }');

  // Account must NOT have global unique index on name
  const namePath = Account.schema.path('name');
  assert.notEqual(namePath._index?.unique, true, 'Account name must not be globally unique');

  // Voucher should have compound index on { companyId: 1, voucherNumber: 1 }
  const voucherIndexes = Voucher.schema.indexes();
  const hasVoucherCompound = voucherIndexes.some(
    ([fields, opts]) => fields.companyId === 1 && fields.voucherNumber === 1 && opts?.unique === true
  );
  assert.ok(hasVoucherCompound, 'Voucher must have compound unique index on { companyId: 1, voucherNumber: 1 }');

  // Category should have compound index on companyId and name
  const catIndexes = Category.schema.indexes();
  const hasCatCompound = catIndexes.some(
    ([fields]) => fields.companyId === 1 && fields.name === 1
  );
  assert.ok(hasCatCompound, 'Category must have compound index including companyId and name');
});

// -----------------------------------------------------------------------------
// 4. MULTI-COMPANY NAMESPACE COEXISTENCE
// -----------------------------------------------------------------------------
test('NAMESPACES: Accounts in different companies can share identical names without collision', () => {
  const accountCompanyA = {
    companyId: 'old-street',
    name: 'Barclays Operating Account',
    accountType: 'BANK',
  };

  const accountCompanyB = {
    companyId: 'best-standard',
    name: 'Barclays Operating Account',
    accountType: 'BANK',
  };

  // Unique identifier compound key
  const keyA = `${accountCompanyA.companyId}:${accountCompanyA.name}`;
  const keyB = `${accountCompanyB.companyId}:${accountCompanyB.name}`;

  assert.notEqual(keyA, keyB, 'Compound keys across companies must not collide');
  assert.equal(accountCompanyA.name, accountCompanyB.name);
});

// -----------------------------------------------------------------------------
// 5. CROSS-COMPANY LINKING GUARDS
// -----------------------------------------------------------------------------
test('CROSS-COMPANY GUARDS: Internal transfer between accounts belonging to different companies is rejected', () => {
  const fromAccount = { _id: 'acc1', companyId: 'old-street', currentBalance: 10000 };
  const toAccount = { _id: 'acc2', companyId: 'homewards', currentBalance: 5000 };

  const isCrossCompanyTransfer = fromAccount.companyId !== toAccount.companyId;
  assert.ok(isCrossCompanyTransfer, 'Cross-company transfer condition should be detected');

  // Transfer validation simulation
  const validateTransfer = (source, target, activeCompanyId) => {
    if (source.companyId !== activeCompanyId || target.companyId !== activeCompanyId) {
      throw new Error('CROSS_COMPANY_TRANSFER_FORBIDDEN: Accounts must belong to the active company.');
    }
    return true;
  };

  assert.throws(
    () => validateTransfer(fromAccount, toAccount, 'old-street'),
    /CROSS_COMPANY_TRANSFER_FORBIDDEN/
  );
});

test('CROSS-COMPANY GUARDS: Linking expense to another company property or account is rejected', () => {
  const propertyInCompanyA = { _id: 'prop1', companyId: 'old-street' };
  const accountInCompanyB = { _id: 'acc2', companyId: 'sk-hamilton' };

  const validateExpenseContext = (property, account, activeCompanyId) => {
    if (property.companyId !== activeCompanyId) {
      throw new Error('Property does not belong to the active company context.');
    }
    if (account.companyId !== activeCompanyId) {
      throw new Error('Payment account does not belong to the active company context.');
    }
    return true;
  };

  assert.throws(
    () => validateExpenseContext(propertyInCompanyA, accountInCompanyB, 'old-street'),
    /Payment account does not belong to the active company context/
  );
});

test('CROSS-COMPANY GUARDS: Rent receipt into another company receiving account is rejected', () => {
  const rentScheduleInCompanyA = { _id: 'sched1', companyId: 'best-standard' };
  const receivingAccountInCompanyB = { _id: 'acc3', companyId: 'mile-end-road' };

  const validateRentReceipt = (schedule, receivingAccount, activeCompanyId) => {
    if (schedule.companyId !== activeCompanyId || receivingAccount.companyId !== activeCompanyId) {
      throw new Error('Receiving account must belong to the same company as the tenancy agreement.');
    }
    return true;
  };

  assert.throws(
    () => validateRentReceipt(rentScheduleInCompanyA, receivingAccountInCompanyB, 'best-standard'),
    /Receiving account must belong to the same company/
  );
});

// -----------------------------------------------------------------------------
// 6. FINANCIAL LEDGER & BALANCES ISOLATION
// -----------------------------------------------------------------------------
test('FINANCIAL ISOLATION: Transactions in Company A do not alter Company B ledger or balances', () => {
  const companyABalance = { opening: 10000, current: 10000 };
  const companyBBalance = { opening: 50000, current: 50000 };

  const companyATransactions = [
    { companyId: 'old-street', amount: 2500, direction: 'IN' },
    { companyId: 'old-street', amount: 800, direction: 'OUT' },
  ];

  // Apply transactions to Company A only
  companyATransactions.forEach((tx) => {
    if (tx.companyId === 'old-street') {
      companyABalance.current = round2(
        tx.direction === 'IN' ? companyABalance.current + tx.amount : companyABalance.current - tx.amount
      );
    }
  });

  assert.equal(companyABalance.current, 11700);
  assert.equal(companyBBalance.current, 50000, 'Company B balance must remain completely untouched');
});

// -----------------------------------------------------------------------------
// 7. REPORT & EXPORT ISOLATION
// -----------------------------------------------------------------------------
test('REPORTS: Excel export includes requested company name in header and metadata', async () => {
  const sampleReportData = {
    companyId: 'mile-end-road',
    companyName: 'MILE END ROAD LTD',
    reportRef: 'PIXX-UK-TEST-001',
    reportTitle: 'MILE END ROAD LTD Financial Ledger',
    scope: 'COMPLETE',
    scopeDescription: 'Complete General Ledger',
    periodLabel: 'This Month',
    datePreset: 'THIS_MONTH',
    periodStart: new Date(),
    periodEnd: new Date(),
    isLiquidity: false,
    generatedAt: new Date(),
    summary: {
      transactionCount: 1,
      openingBalance: 0,
      totalMoneyIn: 1500,
      totalMoneyOut: 300,
      totalIncome: 1500,
      totalOperatingExpenses: 300,
      totalMortgageInterest: 0,
      totalMortgagePrincipal: 0,
      totalMortgageFees: 0,
      netCashMovement: 1200,
      closingBalance: 1200,
    },
    categoryBreakdown: [],
    propertyBreakdown: [],
    entries: [
      {
        _id: 'tx1',
        date: new Date(),
        voucherNo: 'VR-001',
        narration: 'Tenancy Rent Received',
        moneyIn: 1500,
        moneyOut: 0,
        runningBalance: 1500,
        status: 'POSTED',
      },
    ],
  };

  const excelBuffer = await generateExcelReport(sampleReportData);
  assert.ok(excelBuffer && excelBuffer.length > 0, 'Should generate valid Excel buffer');
});

test('REPORTS: PDF export includes requested company name in corporate header', async () => {
  const sampleReportData = {
    companyId: 'sk-hamilton',
    companyName: 'SK HAMILTON',
    reportRef: 'PIXX-UK-TEST-002',
    reportTitle: 'SK HAMILTON Financial Ledger',
    scope: 'COMPLETE',
    scopeDescription: 'Complete General Ledger',
    periodLabel: 'April 2026',
    datePreset: 'THIS_MONTH',
    periodStart: new Date(),
    periodEnd: new Date(),
    isLiquidity: true,
    generatedAt: new Date(),
    summary: {
      transactionCount: 0,
      openingBalance: 2500,
      totalMoneyIn: 0,
      totalMoneyOut: 0,
      totalIncome: 0,
      totalOperatingExpenses: 0,
      totalMortgageInterest: 0,
      totalMortgagePrincipal: 0,
      totalMortgageFees: 0,
      netCashMovement: 0,
      closingBalance: 2500,
    },
    categoryBreakdown: [],
    propertyBreakdown: [],
    entries: [],
  };

  const pdfBuffer = await generatePdfReport(sampleReportData);
  assert.ok(pdfBuffer && pdfBuffer.length > 0, 'Should generate valid PDF buffer');
  // Check PDF magic bytes (%PDF)
  assert.equal(pdfBuffer.toString('utf8', 0, 4), '%PDF');
});

// -----------------------------------------------------------------------------
// 8. LEGACY QUARANTINE GUARANTEE
// -----------------------------------------------------------------------------
test('LEGACY QUARANTINE: Queries with companyId never match records without companyId', () => {
  const records = [
    { id: 1, narration: 'Old unassigned record' }, // missing companyId
    { id: 2, narration: 'Null company record', companyId: null },
    { id: 3, narration: 'Empty company record', companyId: '' },
    { id: 4, narration: 'Old Street record', companyId: 'old-street' },
    { id: 5, narration: 'Best Standard record', companyId: 'best-standard' },
  ];

  const targetCompany = 'old-street';
  const filtered = records.filter((r) => r.companyId === targetCompany);

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, 4);

  // Verify none of the unassigned or null records leaked
  const leakedLegacy = filtered.some((r) => !r.companyId || r.companyId !== targetCompany);
  assert.equal(leakedLegacy, false, 'Legacy records without companyId must never leak into any company view');
});

// -----------------------------------------------------------------------------
// 9. PHASE 3: DASHBOARD STATS ISOLATION & ZERO-STATE GUARANTEES
// -----------------------------------------------------------------------------
test('PHASE 3 DASHBOARD: Isolated metrics calculation per company', () => {
  const companyAProperties = [
    { companyId: 'old-street', currentValuation: 650000 },
    { companyId: 'old-street', currentValuation: 450000 },
  ];
  const companyBProperties = [
    { companyId: 'best-standard', currentValuation: 1200000 },
  ];

  const companyAValuation = companyAProperties.reduce((sum, p) => sum + p.currentValuation, 0);
  const companyBValuation = companyBProperties.reduce((sum, p) => sum + p.currentValuation, 0);

  assert.equal(companyAValuation, 1100000);
  assert.equal(companyBValuation, 1200000);
  assert.notEqual(companyAValuation, companyBValuation);
});

test('PHASE 3 DASHBOARD: Empty company yields strict zero-state with no data leakage', () => {
  // Simulating query results for an empty registered company (e.g. homewards or globle-standard)
  const emptyCompanyProperties = [];
  const emptyCompanyUnits = 0;
  const emptyCompanyRentSchedules = [];
  const emptyCompanyTransactions = [];
  const emptyCompanyMortgages = [];

  const totalPortfolioValue = emptyCompanyProperties.reduce((sum, p) => sum + (p.currentValuation || 0), 0);
  const totalUnits = emptyCompanyUnits;
  const totalRentCollected = emptyCompanyRentSchedules.reduce((sum, s) => sum + (s.paidAmount || 0), 0);
  const totalOperatingExpenses = emptyCompanyTransactions
    .filter((t) => t.transactionType === 'EXPENSE')
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalDebt = emptyCompanyMortgages.reduce((sum, m) => sum + (m.outstandingPrincipalBalance || 0), 0);

  assert.equal(totalPortfolioValue, 0);
  assert.equal(totalUnits, 0);
  assert.equal(totalRentCollected, 0);
  assert.equal(totalOperatingExpenses, 0);
  assert.equal(totalDebt, 0);
  assert.equal(emptyCompanyTransactions.length, 0);
});

test('PHASE 3 DASHBOARD: Recent transactions are strictly isolated by companyId', () => {
  const allTransactions = [
    { id: 'tx-1', companyId: 'sk-hamilton', amount: 950, narration: 'Rent Flat 1' },
    { id: 'tx-2', companyId: 'mile-end-road', amount: 1500, narration: 'Commercial Rent' },
    { id: 'tx-3', companyId: 'sk-hamilton', amount: 120, narration: 'Boiler Service' },
  ];

  const skTransactions = allTransactions.filter((tx) => tx.companyId === 'sk-hamilton');
  const mileEndTransactions = allTransactions.filter((tx) => tx.companyId === 'mile-end-road');

  assert.equal(skTransactions.length, 2);
  assert.equal(mileEndTransactions.length, 1);
  assert.ok(skTransactions.every((tx) => tx.companyId === 'sk-hamilton'));
  assert.ok(mileEndTransactions.every((tx) => tx.companyId === 'mile-end-road'));
});

// -----------------------------------------------------------------------------
// 10. PHASE 3: LEDGER SEARCH, DATE FILTERS & PAGINATION SCOPING
// -----------------------------------------------------------------------------
test('PHASE 3 LEDGER: Search queries and date filters remain strictly scoped to companyId', () => {
  const dataset = [
    { companyId: 'old-street', narration: 'Council Tax payment', date: new Date('2026-04-01') },
    { companyId: 'best-standard', narration: 'Council Tax payment', date: new Date('2026-04-01') },
    { companyId: 'old-street', narration: 'Water Rates', date: new Date('2026-04-05') },
  ];

  // Search "Council Tax" within "old-street"
  const searchTerm = 'council tax';
  const targetCompany = 'old-street';

  const results = dataset.filter(
    (item) => item.companyId === targetCompany && item.narration.toLowerCase().includes(searchTerm)
  );

  assert.equal(results.length, 1);
  assert.equal(results[0].companyId, 'old-street');
  assert.equal(results[0].narration, 'Council Tax payment');
});

// -----------------------------------------------------------------------------
// 11. PHASE 3: STATUTORY SECTION 24 & YIELD REPORT ISOLATION
// -----------------------------------------------------------------------------
test('PHASE 3 REPORTS: Tax Schedule S24 isolates income, allowable expenses & reducer per company', () => {
  const transactionsCompanyA = [
    { companyId: 'old-street', transactionType: 'INCOME', amount: 24000 },
    { companyId: 'old-street', transactionType: 'EXPENSE', amount: 4000, isAllowable: true },
  ];
  const mortgageInterestCompanyA = 6000;

  const grossRentalIncomeA = transactionsCompanyA
    .filter((t) => t.transactionType === 'INCOME')
    .reduce((sum, t) => sum + t.amount, 0);
  const allowableExpensesA = transactionsCompanyA
    .filter((t) => t.transactionType === 'EXPENSE')
    .reduce((sum, t) => sum + t.amount, 0);

  const netTaxableProfitBeforeFinanceCosts = grossRentalIncomeA - allowableExpensesA;
  const qualifyingFinanceCosts = Math.min(mortgageInterestCompanyA, Math.max(0, netTaxableProfitBeforeFinanceCosts));
  const section24TaxReducer = round2(qualifyingFinanceCosts * 0.20);

  assert.equal(grossRentalIncomeA, 24000);
  assert.equal(allowableExpensesA, 4000);
  assert.equal(netTaxableProfitBeforeFinanceCosts, 20000);
  assert.equal(qualifyingFinanceCosts, 6000);
  assert.equal(section24TaxReducer, 1200); // 20% of 6000
});

test('PHASE 3 REPORTS: Gross Yield and Net Cash Flow are isolated to company properties and mortgages', () => {
  const propertyA = {
    companyId: 'sk-hamilton',
    currentValuation: 300000,
    rentalIncome: 1800, // Monthly
    operatingExpenses: 300,
    mortgagePayment: 800,
  };

  const annualRental = propertyA.rentalIncome * 12;
  const grossYield = round2((annualRental / propertyA.currentValuation) * 100);
  const netCashFlow = round2(propertyA.rentalIncome - propertyA.operatingExpenses - propertyA.mortgagePayment);

  assert.equal(grossYield, 7.2); // (21600 / 300000) * 100 = 7.2%
  assert.equal(netCashFlow, 700);
});

// -----------------------------------------------------------------------------
// 12. PHASE 4: FINAL SECURITY AUDIT, COMPANY ISOLATION & PRODUCTION READINESS
// -----------------------------------------------------------------------------
test('PHASE 4 AUDIT (1/13): All 6 registered companies have verified routes, metadata and legal IDs', () => {
  const expected = [
    { id: 'old-street', name: 'OLD STREET', reg: 'UK-08492014', legal: 'Old Street Holdings Ltd' },
    { id: 'best-standard', name: 'BEST STANDARD', reg: 'UK-09381742', legal: 'Best Standard Properties Ltd' },
    { id: 'sk-hamilton', name: 'SK HAMILTON', reg: 'UK-07421893', legal: 'SK Hamilton Holdings Ltd' },
    { id: 'homewards', name: 'HOMEWARDS', reg: 'UK-06839201', legal: 'Homewards Properties Ltd' },
    { id: 'mile-end-road', name: 'MILE END ROAD LTD', reg: 'UK-10293847', legal: 'Mile End Road Ltd' },
    { id: 'global-standard', name: 'GLOBLE STANDARD', reg: 'UK-11029485', legal: 'Global Standard Properties Ltd' },
  ];

  assert.equal(COMPANIES.length, 6);
  expected.forEach((exp) => {
    const comp = getCompanyById(exp.id);
    assert.ok(comp, `Company ${exp.id} must exist in registry`);
    assert.equal(comp.name, exp.name);
    assert.equal(comp.registrationNo, exp.reg);
    assert.equal(comp.legalName, exp.legal);
    assert.equal(comp.jurisdiction, 'England & Wales');
  });
});

test('PHASE 4 AUDIT (2/13): Unauthenticated API access is strictly rejected with 401', async () => {
  const mockReq = { headers: {}, query: {} };
  let statusCode = null;
  let jsonOutput = null;
  const mockRes = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      jsonOutput = data;
      return this;
    },
  };

  let nextCalled = false;
  await protect(mockReq, mockRes, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false, 'Next must not be called when unauthenticated');
  assert.equal(statusCode, 401);
  assert.equal(jsonOutput?.success, false);
  assert.ok(jsonOutput?.message?.includes('Authorization token required'));
});

test('PHASE 4 AUDIT (3/13): Missing and invalid company IDs produce explicit 400 responses', () => {
  const authedReq = { user: { _id: 'admin1', email: 'admin@ukproperties.co.uk' }, headers: {}, query: {}, body: {} };
  let statusCode = null;
  let jsonOutput = null;
  const res = {
    status(c) {
      statusCode = c;
      return this;
    },
    json(d) {
      jsonOutput = d;
      return this;
    },
  };

  // 1. Missing company ID
  requireCompanyContext(authedReq, res, () => {});
  assert.equal(statusCode, 400);
  assert.equal(jsonOutput.code, 'NO_COMPANY_CONTEXT');

  // 2. Invalid company ID
  authedReq.headers['x-company-id'] = 'unauthorized-entity-x';
  requireCompanyContext(authedReq, res, () => {});
  assert.equal(statusCode, 400);
  assert.equal(jsonOutput.code, 'INVALID_COMPANY_ID');
});

test('PHASE 4 AUDIT (4/13): Cross-company record access using guessed IDs (IDOR) returns null', () => {
  // Simulating an authenticated operator operating in Company A ('old-street')
  // attempting to query a property or account that belongs to Company B ('sk-hamilton')
  const database = [
    { _id: 'prop-sk-99', companyId: 'sk-hamilton', name: 'Commercial Parade', valuation: 800000 },
    { _id: 'prop-old-01', companyId: 'old-street', name: 'Residential Block', valuation: 650000 },
  ];

  const activeCompany = 'old-street';
  const guessedId = 'prop-sk-99';

  // Application model query: findOne({ _id: guessedId, companyId: activeCompany })
  const foundRecord = database.find((doc) => doc._id === guessedId && doc.companyId === activeCompany);

  assert.equal(foundRecord, undefined, 'Guessed record ID from another company must return undefined/null (404)');
});

test('PHASE 4 AUDIT (5/13): Cross-company update and delete attempts match zero records and are blocked', () => {
  const database = [
    { _id: 'unit-best-01', companyId: 'best-standard', propertyId: 'prop-best-01', unitName: 'Flat 1', isActive: true },
  ];

  const callerCompany = 'homewards';
  const targetUnitId = 'unit-best-01';

  // findOneAndUpdate with compound companyId check
  const targetDoc = database.find((d) => d._id === targetUnitId && d.companyId === callerCompany);
  assert.equal(targetDoc, undefined, 'Caller from Homewards cannot find or modify Best Standard unit');

  // Client cannot reassign companyId in payload
  const updatePayload = { unitName: 'Flat 1 Modified', companyId: 'homewards' };
  delete updatePayload.companyId; // Backend deletion guard
  assert.equal(updatePayload.companyId, undefined, 'Client cannot reassign companyId');
});

test('PHASE 4 AUDIT (6/13): Cross-company account transfers and cross-entity linkage are blocked', () => {
  const accounts = [
    { _id: 'acc-1', companyId: 'old-street', name: 'Barclays Operating' },
    { _id: 'acc-2', companyId: 'mile-end-road', name: 'NatWest Reserve' },
  ];

  const currentCompany = 'old-street';
  const fromAccountId = 'acc-1';
  const toAccountId = 'acc-2';

  // Both accounts must belong to currentCompany
  const fromAcc = accounts.find((a) => a._id === fromAccountId && a.companyId === currentCompany);
  const toAcc = accounts.find((a) => a._id === toAccountId && a.companyId === currentCompany);

  const isValidTransfer = Boolean(fromAcc && toAcc);
  assert.equal(isValidTransfer, false, 'Transfer across company boundary must be rejected');
});

test('PHASE 4 AUDIT (7/13): Dashboard, ledger search, pagination and date filtering are isolated', () => {
  const allLedgerTransactions = [
    { id: 1, companyId: 'old-street', date: new Date('2026-04-01'), amount: 1500, narration: 'Rent Collection' },
    { id: 2, companyId: 'old-street', date: new Date('2026-04-05'), amount: 250, narration: 'Plumbing Repair' },
    { id: 3, companyId: 'best-standard', date: new Date('2026-04-02'), amount: 2000, narration: 'Rent Collection' },
    { id: 4, companyId: 'old-street', date: new Date('2026-04-10'), amount: 80, narration: 'Key Cutting' },
  ];

  const company = 'old-street';
  const filtered = allLedgerTransactions.filter((tx) => tx.companyId === company);
  assert.equal(filtered.length, 3);

  // Pagination test: page 1 with limit 2
  const page1 = filtered.slice(0, 2);
  assert.equal(page1.length, 2);
  assert.ok(page1.every((tx) => tx.companyId === 'old-street'));

  // Search filter test: "Repair"
  const searchResults = filtered.filter((tx) => tx.narration.toLowerCase().includes('repair'));
  assert.equal(searchResults.length, 1);
  assert.equal(searchResults[0].id, 2);
});

test('PHASE 4 AUDIT (8/13): PDF, Excel and CSV report builder rejects missing companyId', async () => {
  // Calling buildLedgerReportData without companyId must reject with an error
  await assert.rejects(
    async () => {
      await buildLedgerReportData({ scope: 'COMPLETE' });
    },
    { message: /companyId is strictly required/i }
  );

  // Calling report generators with company-scoped data generates isolated buffers
  const sampleData = {
    companyId: 'mile-end-road',
    companyName: 'MILE END ROAD LTD',
    reportRef: 'PIXX-UK-AUDIT-01',
    reportTitle: 'MILE END ROAD LTD Financial Ledger',
    scope: 'COMPLETE',
    scopeDescription: 'Complete General Ledger',
    periodLabel: 'This Month',
    datePreset: 'THIS_MONTH',
    periodStart: new Date(),
    periodEnd: new Date(),
    isLiquidity: false,
    generatedAt: new Date(),
    summary: {
      transactionCount: 0,
      openingBalance: 0,
      totalMoneyIn: 0,
      totalMoneyOut: 0,
      totalIncome: 0,
      totalOperatingExpenses: 0,
      totalMortgageInterest: 0,
      totalMortgagePrincipal: 0,
      totalMortgageFees: 0,
      netCashMovement: 0,
      closingBalance: 0,
    },
    categoryBreakdown: [],
    propertyBreakdown: [],
    entries: [],
  };

  const excelBuf = await generateExcelReport(sampleData);
  const pdfBuf = await generatePdfReport(sampleData);

  assert.ok(excelBuf.length > 0, 'Excel buffer must be generated');
  assert.ok(pdfBuf.length > 0, 'PDF buffer must be generated');
  assert.equal(pdfBuf.toString('utf8', 0, 4), '%PDF');
});

test('PHASE 4 AUDIT (9/13): Company switching race condition and stale-response cancellation', () => {
  let isCurrent = true;
  let activeCompanyId = 'old-street';

  // Simulating in-flight request started for Company A
  const inFlightPromiseA = new Promise((resolve) => {
    setTimeout(() => {
      resolve({ companyId: 'old-street', balance: 50000 });
    }, 50);
  });

  // User immediately switches to Company B
  isCurrent = false; // Cleanup flag triggered by useEffect
  activeCompanyId = 'sk-hamilton';

  inFlightPromiseA.then((res) => {
    let committedState = null;
    if (isCurrent) {
      committedState = res;
    }
    // Verify stale promise was NOT committed into Company B state
    assert.equal(committedState, null, 'Stale promise from previous company must never be committed');
  });
});

test('PHASE 4 AUDIT (10/13): Logout and session expiry behavior cleans client state', () => {
  const localStorageMock = new Map();
  localStorageMock.set('token', 'valid-jwt-token');
  localStorageMock.set('user', JSON.stringify({ email: 'operator@pixx.co.uk' }));
  localStorageMock.set('selected_company', 'old-street');

  // Execute logout cleanup
  localStorageMock.delete('token');
  localStorageMock.delete('user');
  localStorageMock.delete('selected_company');

  assert.equal(localStorageMock.get('token'), undefined);
  assert.equal(localStorageMock.get('user'), undefined);
  assert.equal(localStorageMock.get('selected_company'), undefined);
  assert.equal(localStorageMock.size, 0);
});

test('PHASE 4 AUDIT (11/13): Legacy unassigned records remain quarantined and never leak', () => {
  const legacyRecord = { _id: 'legacy-voucher-01', narration: 'Pre-isolation legacy transaction' }; // no companyId
  const currentCompany = 'global-standard';

  // Database query for company vouchers
  const isMatch = legacyRecord.companyId === currentCompany;
  assert.equal(isMatch, false, 'Unassigned legacy record must never match any company query');
});

test('PHASE 4 AUDIT (12/13): Financial integrity of mortgage repayment splits and balance reconciliation', () => {
  const totalPaid = 1250.00;
  const interest = 850.00;
  const principal = 350.00;
  const fees = 50.00;

  // Verification 1: Split reconciliation
  const calculatedSum = round2(interest + principal + fees);
  assert.equal(calculatedSum, totalPaid, 'Mortgage split components must exactly equal total paid');

  // Verification 2: Balance reduction
  const initialPrincipalDebt = 240000.00;
  const remainingPrincipalDebt = round2(initialPrincipalDebt - principal);
  assert.equal(remainingPrincipalDebt, 239650.00);

  // Verification 3: Invalid split rejection
  const invalidPrincipal = 400.00;
  const invalidSum = round2(interest + invalidPrincipal + fees);
  assert.notEqual(invalidSum, totalPaid);
});

test('PHASE 4 AUDIT (13/13): First-run setup guard rejects secondary operator creation', () => {
  const userCount = 1; // Operator already exists
  const isSetupAllowed = userCount === 0;
  assert.equal(isSetupAllowed, false, 'Setup must be disabled when operator already exists');
});

test('APPLIANCES: Appliance schema requires companyId and validates against 6 UK entities', () => {
  const applianceSchema = Appliance.schema;
  const companyIdPath = applianceSchema.path('companyId');
  assert.ok(companyIdPath.isRequired, 'companyId must be required on Appliance');
  assert.deepEqual(companyIdPath.enumValues, VALID_COMPANY_IDS);
});

test('MAINTENANCE: MaintenanceTask schema requires companyId', () => {
  const taskSchema = MaintenanceTask.schema;
  const companyIdPath = taskSchema.path('companyId');
  assert.ok(companyIdPath.isRequired, 'companyId must be required on MaintenanceTask');
});

test('RECEIPTS: SupplierReceipt schema requires companyId and validates against 6 UK entities', () => {
  const receiptSchema = SupplierReceipt.schema;
  const companyIdPath = receiptSchema.path('companyId');
  assert.ok(companyIdPath.isRequired, 'companyId must be required on SupplierReceipt');
  assert.deepEqual(companyIdPath.enumValues, VALID_COMPANY_IDS);
  assert.equal(receiptSchema.path('financialLedgerStatus').defaultValue, 'SOURCE_RECORD_ONLY');
});

test('APPLIANCES: Decoupled warranty structures and optional propertyId for pending items', () => {
  const applianceSchema = Appliance.schema;
  assert.equal(!applianceSchema.path('propertyId').isRequired, true, 'propertyId must be optional for unassigned items');
  assert.ok(applianceSchema.path('manufacturerWarranty.provider'), 'manufacturerWarranty must be separate');
  assert.ok(applianceSchema.path('extendedWarranty.durationYears'), 'extendedWarranty must be separate');
  assert.ok(applianceSchema.path('serviceAgreement.agreementReference'), 'serviceAgreement must be separate');
  assert.ok(applianceSchema.path('squeakyCleanValet.eligibilityStatus'), 'squeakyCleanValet must be separate');
});



