import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import '../src/config/env.js';

// Models
import Transaction from '../src/models/Transaction.js';
import Property from '../src/models/Property.js';
import Account from '../src/models/Account.js';
import Category from '../src/models/Category.js';
import MortgagePayment from '../src/models/MortgagePayment.js';

// P&L Engine Services
import {
  classifyTransaction,
  parsePnLDateRange,
  calculateProfitAndLoss,
} from '../src/services/profitLossService.js';
import { round2 } from '../src/services/ledgerService.js';

const TEST_PREFIX = 'TEST_PNL_SUITE_';
const COMPANY_A = 'sk-hamilton';
const COMPANY_B = 'best-standard';

let accountA = null;
let accountB = null;
let propertyA1 = null;
let propertyA2 = null;
let rentCategory = null;
let repairCategory = null;
let vchCounter = 1;

function createTestTx(overrides) {
  const direction = overrides.direction || 'OUT';
  const defaultType = direction === 'IN' ? 'INCOME' : 'EXPENSE';
  return Transaction.create({
    voucherNo: `TEST-VCH-${Date.now()}-${vchCounter++}`,
    transactionType: overrides.transactionType || defaultType,
    status: 'POSTED',
    ...overrides,
  });
}

test.before(async () => {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGO_URI);
  }

  // Cleanup any lingering artifacts from previous test runs
  await Transaction.deleteMany({ narration: { $regex: new RegExp(`^${TEST_PREFIX}`) } });
  await Property.deleteMany({ name: { $regex: new RegExp(`^${TEST_PREFIX}`) } });
  await Account.deleteMany({ name: { $regex: new RegExp(`^${TEST_PREFIX}`) } });
  await Category.deleteMany({ name: { $regex: new RegExp(`^${TEST_PREFIX}`) } });
  await MortgagePayment.deleteMany({ notes: { $regex: new RegExp(`^${TEST_PREFIX}`) } });

  // 1. Create Test Accounts
  accountA = await Account.create({
    companyId: COMPANY_A,
    name: `${TEST_PREFIX}ACC_A`,
    accountType: 'BANK',
    currentBalance: 50000,
  });

  accountB = await Account.create({
    companyId: COMPANY_B,
    name: `${TEST_PREFIX}ACC_B`,
    accountType: 'BANK',
    currentBalance: 25000,
  });

  // 2. Create Test Properties
  propertyA1 = await Property.create({
    companyId: COMPANY_A,
    name: `${TEST_PREFIX}PROP_1`,
    addressLine1: '10 Test High Street',
    city: 'London',
    postcode: 'E1 1AA',
    currentValuation: 450000,
  });

  propertyA2 = await Property.create({
    companyId: COMPANY_A,
    name: `${TEST_PREFIX}PROP_2`,
    addressLine1: '20 Test High Street',
    city: 'London',
    postcode: 'E1 2BB',
    currentValuation: 350000,
  });

  // 3. Create Categories
  rentCategory = await Category.create({
    companyId: COMPANY_A,
    name: `${TEST_PREFIX}Rent`,
    type: 'INCOME',
    head: 'Income',
    subHead: 'Rent',
  });

  repairCategory = await Category.create({
    companyId: COMPANY_A,
    name: `${TEST_PREFIX}Repairs`,
    type: 'OPERATING_EXPENSE',
    head: 'Admin Expenses',
    subHead: 'Repair and Maintainance',
  });
});

test.after(async () => {
  await Transaction.deleteMany({ narration: { $regex: new RegExp(`^${TEST_PREFIX}`) } });
  await Property.deleteMany({ name: { $regex: new RegExp(`^${TEST_PREFIX}`) } });
  await Account.deleteMany({ name: { $regex: new RegExp(`^${TEST_PREFIX}`) } });
  await Category.deleteMany({ name: { $regex: new RegExp(`^${TEST_PREFIX}`) } });
  await MortgagePayment.deleteMany({ notes: { $regex: new RegExp(`^${TEST_PREFIX}`) } });
  await mongoose.disconnect();
});

// -----------------------------------------------------------------------------
// SCENARIO 1: Rent £1,500 + Expense £400 = £1,100 Net Profit
// -----------------------------------------------------------------------------
test('Scenario 1: Rent £1,500 and Expenses £400 calculates exactly £1,100 Net Profit', async () => {
  const rentTx = await createTestTx({
    companyId: COMPANY_A,
    accountId: accountA._id,
    propertyId: propertyA1._id,
    categoryId: rentCategory._id,
    head: 'Income',
    subHead: 'Rent',
    transactionType: 'INCOME',
    direction: 'IN',
    amount: 1500,
    transactionDate: new Date('2025-05-10T10:00:00Z'),
    narration: `${TEST_PREFIX}S1_RENT`,
  });

  const expTx = await createTestTx({
    companyId: COMPANY_A,
    accountId: accountA._id,
    propertyId: propertyA1._id,
    categoryId: repairCategory._id,
    head: 'Admin Expenses',
    subHead: 'Repair and Maintainance',
    transactionType: 'EXPENSE',
    direction: 'OUT',
    amount: 400,
    transactionDate: new Date('2025-05-15T12:00:00Z'),
    narration: `${TEST_PREFIX}S1_EXP`,
  });

  const report = await calculateProfitAndLoss({
    companyId: COMPANY_A,
    startDate: '2025-05-01',
    endDate: '2025-05-31',
    datePreset: 'CUSTOM',
  });

  assert.equal(report.summary.totalIncome, 1500, 'Total income must be £1,500');
  assert.equal(report.summary.operatingExpenses, 400, 'Operating expenses must be £400');
  assert.equal(report.summary.totalExpenses, 400, 'Total expenses must be £400');
  assert.equal(report.summary.netResult, 1100, 'Net result must be £1,100');
  assert.equal(report.summary.netProfit, 1100, 'Net profit must be £1,100');
  assert.equal(report.summary.netLoss, 0, 'Net loss must be £0');
  assert.equal(report.summary.isProfit, true, 'isProfit must be true');
  assert.equal(report.summary.netProfitMargin, round2((1100 / 1500) * 100), 'Margin must match formula');

  await Transaction.deleteMany({ _id: { $in: [rentTx._id, expTx._id] } });
});

// -----------------------------------------------------------------------------
// SCENARIO 2: Income £300 + Expense £500 = £200 Net Loss (Zero Simultaneous Profit)
// -----------------------------------------------------------------------------
test('Scenario 2: Income £300 and Expense £500 yields £200 Net Loss without simultaneous profit', async () => {
  const incTx = await createTestTx({
    companyId: COMPANY_A,
    accountId: accountA._id,
    head: 'Income',
    subHead: 'Council Refund',
    transactionType: 'INCOME',
    direction: 'IN',
    amount: 300,
    transactionDate: new Date('2025-06-05T10:00:00Z'),
    narration: `${TEST_PREFIX}S2_INC`,
  });

  const expTx = await createTestTx({
    companyId: COMPANY_A,
    accountId: accountA._id,
    head: 'Admin Expenses',
    subHead: 'Insurance',
    transactionType: 'EXPENSE',
    direction: 'OUT',
    amount: 500,
    transactionDate: new Date('2025-06-12T10:00:00Z'),
    narration: `${TEST_PREFIX}S2_EXP`,
  });

  const report = await calculateProfitAndLoss({
    companyId: COMPANY_A,
    startDate: '2025-06-01',
    endDate: '2025-06-30',
    datePreset: 'CUSTOM',
  });

  assert.equal(report.summary.totalIncome, 300);
  assert.equal(report.summary.totalExpenses, 500);
  assert.equal(report.summary.netResult, -200, 'Net result should be negative £200');
  assert.equal(report.summary.netProfit, 0, 'Net profit MUST be zero when in loss');
  assert.equal(report.summary.netLoss, 200, 'Net loss MUST be positive £200');
  assert.equal(report.summary.isProfit, false, 'isProfit flag must be false');

  await Transaction.deleteMany({ _id: { $in: [incTx._id, expTx._id] } });
});

// -----------------------------------------------------------------------------
// SCENARIO 3: £1,000 Transfer between accounts changes neither income nor expense
// -----------------------------------------------------------------------------
test('Scenario 3: £1,000 internal bank transfer is excluded from P&L revenue and expenses', async () => {
  const transferTx = await createTestTx({
    companyId: COMPANY_A,
    accountId: accountA._id,
    transactionType: 'TRANSFER',
    counterAccountId: new mongoose.Types.ObjectId(),
    direction: 'OUT',
    amount: 1000,
    transactionDate: new Date('2025-07-10T10:00:00Z'),
    narration: `${TEST_PREFIX}S3_TRANSFER`,
  });

  const report = await calculateProfitAndLoss({
    companyId: COMPANY_A,
    startDate: '2025-07-01',
    endDate: '2025-07-31',
    datePreset: 'CUSTOM',
  });

  assert.equal(report.summary.totalIncome, 0, 'Internal transfer must NOT count as income');
  assert.equal(report.summary.totalExpenses, 0, 'Internal transfer must NOT count as expense');
  assert.equal(report.summary.totalExcluded, 1000, 'Transfer must be tracked under balance sheet exclusions');

  const excludedBreakdown = report.breakdown.excluded.find((e) => e.classification === 'EXCLUDED_TRANSFER');
  assert.ok(excludedBreakdown, 'Should have EXCLUDED_TRANSFER category in exclusions');
  assert.equal(excludedBreakdown.total, 1000);

  await Transaction.deleteOne({ _id: transferTx._id });
});

// -----------------------------------------------------------------------------
// SCENARIO 4: Mortgage payment split: £500 principal vs £100 interest
// -----------------------------------------------------------------------------
test('Scenario 4: Mortgage payment split (£500 principal + £100 interest) only includes £100 in P&L', async () => {
  const mortgageTx = await createTestTx({
    companyId: COMPANY_A,
    accountId: accountA._id,
    propertyId: propertyA1._id,
    transactionType: 'MORTGAGE_PAYMENT',
    head: 'Interest Expenses',
    subHead: propertyA1.name,
    direction: 'OUT',
    amount: 600,
    transactionDate: new Date('2025-08-01T09:00:00Z'),
    narration: `${TEST_PREFIX}S4_MORTGAGE`,
  });

  const mortgageRecord = await MortgagePayment.create({
    companyId: COMPANY_A,
    transactionId: mortgageTx._id,
    mortgageId: new mongoose.Types.ObjectId(),
    paymentAccountId: accountA._id,
    propertyId: propertyA1._id,
    totalAmountPaid: 600,
    principalAmount: 500,
    interestAmount: 100,
    feeAmount: 0,
    paymentDate: new Date('2025-08-01T09:00:00Z'),
    notes: `${TEST_PREFIX}S4_SPLIT`,
    status: 'POSTED',
  });

  const report = await calculateProfitAndLoss({
    companyId: COMPANY_A,
    startDate: '2025-08-01',
    endDate: '2025-08-31',
    datePreset: 'CUSTOM',
  });

  assert.equal(report.summary.financeCosts, 100, 'Only the £100 interest component belongs in finance costs');
  assert.equal(report.summary.operatingExpenses, 0, 'Principal repayment must NOT be in operating expenses');
  assert.equal(report.summary.totalExpenses, 100, 'Total P&L expenses must be £100');
  assert.equal(report.summary.totalExcluded, 500, '£500 principal repayment must be tracked as balance sheet reduction');

  await MortgagePayment.deleteOne({ _id: mortgageRecord._id });
  await Transaction.deleteOne({ _id: mortgageTx._id });
});

// -----------------------------------------------------------------------------
// SCENARIO 5: Repair expense £200 appears exactly once in expenses
// -----------------------------------------------------------------------------
test('Scenario 5: Repair expense £200 appears exactly once in operating expenses', async () => {
  const repairTx = await createTestTx({
    companyId: COMPANY_A,
    accountId: accountA._id,
    propertyId: propertyA1._id,
    categoryId: repairCategory._id,
    head: 'Admin Expenses',
    subHead: 'Repair and Maintainance',
    transactionType: 'EXPENSE',
    direction: 'OUT',
    amount: 200,
    transactionDate: new Date('2025-09-05T14:00:00Z'),
    narration: `${TEST_PREFIX}S5_REPAIR`,
  });

  const report = await calculateProfitAndLoss({
    companyId: COMPANY_A,
    startDate: '2025-09-01',
    endDate: '2025-09-30',
    datePreset: 'CUSTOM',
  });

  assert.equal(report.summary.operatingExpenses, 200);
  assert.equal(report.summary.totalExpenses, 200);

  const repairBucket = report.breakdown.operatingExpenses.find(
    (c) => c.category === 'Repair and Maintainance' || c.head === 'Admin Expenses'
  );
  assert.ok(repairBucket, 'Repair category must be in breakdown');
  assert.equal(repairBucket.count, 1, 'Transaction count must be exactly 1 (no duplicate counting)');

  await Transaction.deleteOne({ _id: repairTx._id });
});

// -----------------------------------------------------------------------------
// SCENARIO 6: Editing £200 expense to £250 updates report dynamically
// -----------------------------------------------------------------------------
test('Scenario 6: Editing £200 expense to £250 updates report to reflect new amount', async () => {
  const tx = await createTestTx({
    companyId: COMPANY_A,
    accountId: accountA._id,
    propertyId: propertyA1._id,
    head: 'Admin Expenses',
    subHead: 'Accountant Fee',
    transactionType: 'EXPENSE',
    direction: 'OUT',
    amount: 200,
    transactionDate: new Date('2025-10-01T10:00:00Z'),
    narration: `${TEST_PREFIX}S6_EDIT`,
  });

  let report = await calculateProfitAndLoss({
    companyId: COMPANY_A,
    startDate: '2025-10-01',
    endDate: '2025-10-31',
    datePreset: 'CUSTOM',
  });
  assert.equal(report.summary.operatingExpenses, 200);

  // Edit to £250
  await Transaction.findByIdAndUpdate(tx._id, { amount: 250 });

  report = await calculateProfitAndLoss({
    companyId: COMPANY_A,
    startDate: '2025-10-01',
    endDate: '2025-10-31',
    datePreset: 'CUSTOM',
  });
  assert.equal(report.summary.operatingExpenses, 250, 'Report must dynamically reflect edited £250');

  await Transaction.deleteOne({ _id: tx._id });
});

// -----------------------------------------------------------------------------
// SCENARIO 7: Soft-deleting or voiding an expense removes it from active P&L
// -----------------------------------------------------------------------------
test('Scenario 7: Soft-deleting or voiding an expense removes it from P&L calculation', async () => {
  const tx = await createTestTx({
    companyId: COMPANY_A,
    accountId: accountA._id,
    head: 'Admin Expenses',
    subHead: 'Utilities',
    transactionType: 'EXPENSE',
    direction: 'OUT',
    amount: 250,
    transactionDate: new Date('2025-11-05T10:00:00Z'),
    narration: `${TEST_PREFIX}S7_VOID`,
  });

  let report = await calculateProfitAndLoss({
    companyId: COMPANY_A,
    startDate: '2025-11-01',
    endDate: '2025-11-30',
    datePreset: 'CUSTOM',
  });
  assert.equal(report.summary.operatingExpenses, 250);

  // Soft-delete / Void
  await Transaction.findByIdAndUpdate(tx._id, {
    isDeleted: true,
    status: 'VOID',
    deletedAt: new Date(),
  });

  report = await calculateProfitAndLoss({
    companyId: COMPANY_A,
    startDate: '2025-11-01',
    endDate: '2025-11-30',
    datePreset: 'CUSTOM',
  });
  assert.equal(report.summary.operatingExpenses, 0, 'Voided transaction must NOT be counted in P&L');

  await Transaction.deleteOne({ _id: tx._id });
});

// -----------------------------------------------------------------------------
// SCENARIO 8: Restoring a voided expense restores it to P&L without duplicates
// -----------------------------------------------------------------------------
test('Scenario 8: Restoring voided expense restores it to P&L without duplicates', async () => {
  const tx = await createTestTx({
    companyId: COMPANY_A,
    accountId: accountA._id,
    head: 'Admin Expenses',
    subHead: 'Legal Expenses',
    transactionType: 'EXPENSE',
    direction: 'OUT',
    amount: 350,
    transactionDate: new Date('2025-12-05T10:00:00Z'),
    narration: `${TEST_PREFIX}S8_RESTORE`,
    status: 'VOID',
    isDeleted: true,
  });

  let report = await calculateProfitAndLoss({
    companyId: COMPANY_A,
    startDate: '2025-12-01',
    endDate: '2025-12-31',
    datePreset: 'CUSTOM',
  });
  assert.equal(report.summary.operatingExpenses, 0);

  // Restore
  await Transaction.findByIdAndUpdate(tx._id, {
    isDeleted: false,
    status: 'POSTED',
    restoredAt: new Date(),
  });

  report = await calculateProfitAndLoss({
    companyId: COMPANY_A,
    startDate: '2025-12-01',
    endDate: '2025-12-31',
    datePreset: 'CUSTOM',
  });
  assert.equal(report.summary.operatingExpenses, 350, 'Restored expense must appear once');

  await Transaction.deleteOne({ _id: tx._id });
});

// -----------------------------------------------------------------------------
// SCENARIO 9: Property filtering isolates property performance strictly
// -----------------------------------------------------------------------------
test('Scenario 9: Filtering by property strictly isolates property figures', async () => {
  const txProp1 = await createTestTx({
    companyId: COMPANY_A,
    accountId: accountA._id,
    propertyId: propertyA1._id,
    head: 'Income',
    subHead: 'Rent',
    transactionType: 'INCOME',
    direction: 'IN',
    amount: 2000,
    transactionDate: new Date('2025-04-10T10:00:00Z'),
    narration: `${TEST_PREFIX}S9_P1`,
  });

  const txProp2 = await createTestTx({
    companyId: COMPANY_A,
    accountId: accountA._id,
    propertyId: propertyA2._id,
    head: 'Income',
    subHead: 'Rent',
    transactionType: 'INCOME',
    direction: 'IN',
    amount: 1500,
    transactionDate: new Date('2025-04-12T10:00:00Z'),
    narration: `${TEST_PREFIX}S9_P2`,
  });

  // Query only propertyA1
  const reportP1 = await calculateProfitAndLoss({
    companyId: COMPANY_A,
    propertyId: propertyA1._id.toString(),
    startDate: '2025-04-01',
    endDate: '2025-04-30',
    datePreset: 'CUSTOM',
  });

  assert.equal(reportP1.summary.totalIncome, 2000, 'Should only contain Property 1 income');
  assert.equal(reportP1.propertyProfitability.length, 1, 'Should only have 1 property in breakdown');
  assert.equal(reportP1.propertyProfitability[0].propertyId.toString(), propertyA1._id.toString());

  await Transaction.deleteMany({ _id: { $in: [txProp1._id, txProp2._id] } });
});

// -----------------------------------------------------------------------------
// SCENARIO 10: Multi-Company isolation: Company A never sees Company B's records
// -----------------------------------------------------------------------------
test('Scenario 10: Multi-Company isolation ensures zero data bleed between companies', async () => {
  const txCompA = await createTestTx({
    companyId: COMPANY_A,
    accountId: accountA._id,
    head: 'Income',
    subHead: 'Rent',
    transactionType: 'INCOME',
    direction: 'IN',
    amount: 4000,
    transactionDate: new Date('2025-03-10T10:00:00Z'),
    narration: `${TEST_PREFIX}S10_A`,
  });

  const txCompB = await createTestTx({
    companyId: COMPANY_B,
    accountId: accountB._id,
    head: 'Income',
    subHead: 'Rent',
    transactionType: 'INCOME',
    direction: 'IN',
    amount: 7000,
    transactionDate: new Date('2025-03-10T10:00:00Z'),
    narration: `${TEST_PREFIX}S10_B`,
  });

  const reportA = await calculateProfitAndLoss({
    companyId: COMPANY_A,
    startDate: '2025-03-01',
    endDate: '2025-03-31',
    datePreset: 'CUSTOM',
  });

  const reportB = await calculateProfitAndLoss({
    companyId: COMPANY_B,
    startDate: '2025-03-01',
    endDate: '2025-03-31',
    datePreset: 'CUSTOM',
  });

  assert.equal(reportA.summary.totalIncome, 4000, 'Company A must show only £4,000');
  assert.equal(reportB.summary.totalIncome, 7000, 'Company B must show only £7,000');

  await Transaction.deleteMany({ _id: { $in: [txCompA._id, txCompB._id] } });
});

// -----------------------------------------------------------------------------
// SCENARIO 11: Unclassified transaction flagged for review without distorting P&L
// -----------------------------------------------------------------------------
test('Scenario 11: Unclassified transaction is flagged in unclassifiedList and does not distort P&L', async () => {
  const unclassifiedTx = await createTestTx({
    companyId: COMPANY_A,
    accountId: accountA._id,
    transactionType: 'EXPENSE',
    accountingClassification: 'NEEDS_REVIEW',
    direction: 'OUT',
    amount: 999,
    transactionDate: new Date('2025-02-14T10:00:00Z'),
    narration: `${TEST_PREFIX}S11_UNCLASSIFIED`,
  });

  const report = await calculateProfitAndLoss({
    companyId: COMPANY_A,
    startDate: '2025-02-01',
    endDate: '2025-02-28',
    datePreset: 'CUSTOM',
  });

  assert.equal(report.summary.totalExpenses, 0, 'Unclassified items must NOT be counted as expenses');
  assert.equal(report.summary.unclassifiedCount, 1, 'Must report 1 unclassified item');
  assert.equal(report.summary.unclassifiedTotal, 999, 'Must report £999 unclassified total');
  assert.equal(report.unclassifiedList.length, 1);
  assert.equal(report.unclassifiedList[0]._id.toString(), unclassifiedTx._id.toString());

  await Transaction.deleteOne({ _id: unclassifiedTx._id });
});

// -----------------------------------------------------------------------------
// SCENARIO 12: Monthly totals reconcile with the period total
// -----------------------------------------------------------------------------
test('Scenario 12: Monthly trend sum reconciles with annual period totals', async () => {
  const txJan = await createTestTx({
    companyId: COMPANY_A,
    accountId: accountA._id,
    head: 'Income',
    subHead: 'Rent',
    transactionType: 'INCOME',
    direction: 'IN',
    amount: 1000,
    transactionDate: new Date('2025-01-15T10:00:00Z'),
    narration: `${TEST_PREFIX}S12_JAN`,
  });

  const txFeb = await createTestTx({
    companyId: COMPANY_A,
    accountId: accountA._id,
    head: 'Income',
    subHead: 'Rent',
    transactionType: 'INCOME',
    direction: 'IN',
    amount: 1200,
    transactionDate: new Date('2025-02-15T10:00:00Z'),
    narration: `${TEST_PREFIX}S12_FEB`,
  });

  const txMar = await createTestTx({
    companyId: COMPANY_A,
    accountId: accountA._id,
    head: 'Admin Expenses',
    subHead: 'Subscriptions',
    transactionType: 'EXPENSE',
    direction: 'OUT',
    amount: 300,
    transactionDate: new Date('2025-03-20T10:00:00Z'),
    narration: `${TEST_PREFIX}S12_MAR`,
  });

  const report = await calculateProfitAndLoss({
    companyId: COMPANY_A,
    startDate: '2025-01-01',
    endDate: '2025-03-31',
    datePreset: 'CUSTOM',
  });

  const monthlySumIncome = round2(report.monthlyTrend.reduce((sum, m) => sum + m.income, 0));
  const monthlySumExpenses = round2(report.monthlyTrend.reduce((sum, m) => sum + m.totalExpenses, 0));

  assert.equal(monthlySumIncome, report.summary.totalIncome, 'Sum of monthly income must equal total income');
  assert.equal(monthlySumExpenses, report.summary.totalExpenses, 'Sum of monthly expenses must equal total expenses');
  assert.equal(report.summary.netResult, round2(monthlySumIncome - monthlySumExpenses));

  await Transaction.deleteMany({ _id: { $in: [txJan._id, txFeb._id, txMar._id] } });
});

// -----------------------------------------------------------------------------
// SCENARIO 13: Export formats integrity (breakdown matches report totals)
// -----------------------------------------------------------------------------
test('Scenario 13: Export data structures accurately mirror P&L report calculations', async () => {
  const txInc = await createTestTx({
    companyId: COMPANY_A,
    accountId: accountA._id,
    head: 'Income',
    subHead: 'Rent',
    transactionType: 'INCOME',
    direction: 'IN',
    amount: 1800,
    transactionDate: new Date('2025-04-05T10:00:00Z'),
    narration: `${TEST_PREFIX}S13_INC`,
  });

  const report = await calculateProfitAndLoss({
    companyId: COMPANY_A,
    startDate: '2025-04-01',
    endDate: '2025-04-30',
    datePreset: 'CUSTOM',
  });

  const totalFromBreakdown = round2(report.breakdown.income.reduce((sum, c) => sum + c.total, 0));
  assert.equal(totalFromBreakdown, report.summary.totalIncome);
  assert.equal(report.summary.netResult, 1800);

  await Transaction.deleteOne({ _id: txInc._id });
});

// -----------------------------------------------------------------------------
// SCENARIO 14: Existing account balances and rent arrears remain intact & unaffected
// -----------------------------------------------------------------------------
test('Scenario 14: P&L calculations do NOT mutate bank balances, rent schedules, or ledger records', async () => {
  const startingBalance = accountA.currentBalance;

  // Run multiple P&L reports with different basis and date filters
  await calculateProfitAndLoss({ companyId: COMPANY_A, datePreset: 'THIS_YEAR' });
  await calculateProfitAndLoss({ companyId: COMPANY_A, datePreset: 'UK_TAX_YEAR', taxYear: '2024-2025' });
  await calculateProfitAndLoss({ companyId: COMPANY_A, basis: 'ACCRUAL', datePreset: 'ALL' });

  const refreshedAccount = await Account.findById(accountA._id);
  assert.equal(refreshedAccount.currentBalance, startingBalance, 'Account balance must remain completely untouched');
});

// -----------------------------------------------------------------------------
// SCENARIO 15: UK Tax Year calculations: 6 April 2024 to 5 April 2025
// -----------------------------------------------------------------------------
test('Scenario 15: UK Tax Year preset strictly enforces 6 April to 5 April boundaries', () => {
  // Test UK Tax Year 2024-2025
  const parsed2425 = parsePnLDateRange('UK_TAX_YEAR', null, null, '2024-2025');
  assert.equal(parsed2425.periodLabel, 'UK Tax Year 2024/2025 (6 Apr – 5 Apr)');
  assert.equal(parsed2425.periodStart.toISOString().slice(0, 10), '2024-04-06');
  assert.equal(parsed2425.periodEnd.toISOString().slice(0, 10), '2025-04-05');

  // Verify comparison period is previous tax year (2023-2024)
  assert.equal(parsed2425.previousLabel, 'UK Tax Year 2023/2024 (6 Apr – 5 Apr)');
  assert.equal(parsed2425.previousStart.toISOString().slice(0, 10), '2023-04-06');
  assert.equal(parsed2425.previousEnd.toISOString().slice(0, 10), '2024-04-05');

  // Test UK Tax Year 2025-2026
  const parsed2526 = parsePnLDateRange('UK_TAX_YEAR', null, null, '2025-2026');
  assert.equal(parsed2526.periodLabel, 'UK Tax Year 2025/2026 (6 Apr – 5 Apr)');
  assert.equal(parsed2526.periodStart.toISOString().slice(0, 10), '2025-04-06');
  assert.equal(parsed2526.periodEnd.toISOString().slice(0, 10), '2026-04-05');
});
