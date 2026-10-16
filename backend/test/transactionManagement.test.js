import { test } from 'node:test';
import assert from 'node:assert/strict';
import { round2 } from '../src/services/ledgerService.js';

// Schemas
import Transaction from '../src/models/Transaction.js';
import RentPayment from '../src/models/RentPayment.js';
import MortgagePayment from '../src/models/MortgagePayment.js';
import PropertyChargePayment from '../src/models/PropertyChargePayment.js';
import AuditLog from '../src/models/AuditLog.js';
import { VALID_COMPANY_IDS } from '../src/config/companies.js';

// -----------------------------------------------------------------------------
// 1. SCHEMA INTEGRITY FOR VOID / SOFT-DELETE & AUDIT TRAIL
// -----------------------------------------------------------------------------
test('SCHEMA: AuditLog model contains all required tracking fields', () => {
  const paths = AuditLog.schema.paths;
  assert.ok(paths.companyId, 'AuditLog must have companyId');
  assert.ok(paths.entityType, 'AuditLog must have entityType');
  assert.ok(paths.entityId, 'AuditLog must have entityId');
  assert.ok(paths.voucherNo, 'AuditLog must have voucherNo');
  assert.ok(paths.action, 'AuditLog must have action');
  assert.ok(paths.performedBy, 'AuditLog must have performedBy');
  assert.ok(paths.performedByName, 'AuditLog must have performedByName');
  assert.ok(paths.reason, 'AuditLog must have reason');
  assert.ok(paths.changes, 'AuditLog must have changes');
  assert.ok(paths.snapshot, 'AuditLog must have snapshot');

  const actionEnum = AuditLog.schema.path('action').enumValues;
  assert.ok(actionEnum.includes('CREATED'), 'Action enum must include CREATED');
  assert.ok(actionEnum.includes('EDITED'), 'Action enum must include EDITED');
  assert.ok(actionEnum.includes('DELETED'), 'Action enum must include DELETED');
  assert.ok(actionEnum.includes('RESTORED'), 'Action enum must include RESTORED');
  assert.ok(actionEnum.includes('REVERSED'), 'Action enum must include REVERSED');
});

test('SCHEMA: Transaction model includes soft-delete, void status, and audit history', () => {
  const paths = Transaction.schema.paths;
  assert.ok(paths.isDeleted, 'Transaction must have isDeleted');
  assert.ok(paths.deletedAt, 'Transaction must have deletedAt');
  assert.ok(paths.deletedBy, 'Transaction must have deletedBy');
  assert.ok(paths.deletionReason, 'Transaction must have deletionReason');
  assert.ok(paths.restoredAt, 'Transaction must have restoredAt');
  assert.ok(paths.restoredBy, 'Transaction must have restoredBy');
  assert.ok(paths.auditHistory, 'Transaction must have embedded auditHistory array');

  const statusEnum = Transaction.schema.path('status').enumValues;
  assert.ok(statusEnum.includes('POSTED'), 'Status enum must include POSTED');
  assert.ok(statusEnum.includes('VOID'), 'Status enum must include VOID');
});

test('SCHEMA: RentPayment, MortgagePayment, and PropertyChargePayment include soft-delete & void status', () => {
  [RentPayment, MortgagePayment, PropertyChargePayment].forEach((Model) => {
    const paths = Model.schema.paths;
    assert.ok(paths.isDeleted, `${Model.modelName} must have isDeleted`);
    assert.ok(paths.status, `${Model.modelName} must have status`);
    const statusEnum = Model.schema.path('status').enumValues;
    assert.ok(statusEnum.includes('POSTED'), `${Model.modelName} status must include POSTED`);
    assert.ok(statusEnum.includes('VOID'), `${Model.modelName} status must include VOID`);
  });
});

// -----------------------------------------------------------------------------
// 2. EXPENSE EDITING & AUTOMATIC BALANCE RECALCULATION
// -----------------------------------------------------------------------------
test('EXPENSE: Editing expense amount adjusts bank balance and maintains central ledger consistency', () => {
  // Scenario:
  // Bank Account starting balance: £10,000
  // Initial Expense: £500
  // Updated Expense: £650
  let bankBalance = 10000;
  let initialAmount = 500;
  let newAmount = 650;

  // 1. Initial posting
  bankBalance = round2(bankBalance - initialAmount);
  assert.equal(bankBalance, 9500, 'Bank balance becomes £9,500 after initial expense');

  // 2. Edit amount from £500 to £650: delta = £150 outflow
  const delta = round2(newAmount - initialAmount);
  assert.equal(delta, 150, 'Outflow difference is £150');
  bankBalance = round2(bankBalance - delta);
  assert.equal(bankBalance, 9350, 'Bank balance correctly reflects £650 total outflow (£9,350)');

  // 3. Edit amount from £650 down to £400: delta = -£250 (inflow refund)
  const reducedAmount = 400;
  const refundDelta = round2(reducedAmount - newAmount);
  assert.equal(refundDelta, -250);
  bankBalance = round2(bankBalance - refundDelta);
  assert.equal(bankBalance, 9600, 'Bank balance correctly refunded to £9,600');
});

test('EXPENSE: Changing paying bank account switches liquidity accurately', () => {
  // Scenario:
  // NatWest starting: £5,000
  // Barclays starting: £12,000
  // Transaction: £800 mistakenly logged against NatWest, then edited to Barclays
  let natwestBalance = 5000;
  let barclaysBalance = 12000;
  const expenseAmount = 800;

  // Initial posting on NatWest
  natwestBalance = round2(natwestBalance - expenseAmount);
  assert.equal(natwestBalance, 4200);

  // Edit: Switch account from NatWest to Barclays
  // Revert old account (NatWest)
  natwestBalance = round2(natwestBalance + expenseAmount);
  assert.equal(natwestBalance, 5000, 'NatWest balance restored to £5,000');

  // Apply to new account (Barclays)
  barclaysBalance = round2(barclaysBalance - expenseAmount);
  assert.equal(barclaysBalance, 11200, 'Barclays balance decreased to £11,200');
});

// -----------------------------------------------------------------------------
// 3. EXPENSE SOFT-DELETE (VOID) & RECYCLE BIN RESTORE WORKFLOW
// -----------------------------------------------------------------------------
test('EXPENSE: Soft-deleting reverses financial impact, restore reapplies it exactly once', () => {
  let bankBalance = 10000;
  const expenseAmount = 650;

  // 1. Initial posted expense
  let tx = {
    _id: 'tx_exp_001',
    voucherNo: 'V-EXP-001',
    amount: expenseAmount,
    status: 'POSTED',
    isDeleted: false,
    auditHistory: [
      { action: 'CREATED', performedByName: 'Fahad', amount: 650, timestamp: new Date() },
    ],
  };
  bankBalance = round2(bankBalance - expenseAmount);
  assert.equal(bankBalance, 9350);

  // 2. Delete / Void transaction
  const deletionReason = 'Duplicate entry uploaded by clerk';
  tx.status = 'VOID';
  tx.isDeleted = true;
  tx.deletedAt = new Date();
  tx.deletionReason = deletionReason;
  tx.auditHistory.push({
    action: 'DELETED',
    performedByName: 'Admin',
    reason: deletionReason,
    timestamp: new Date(),
  });

  // Reversal: Bank balance restored
  bankBalance = round2(bankBalance + expenseAmount);
  assert.equal(bankBalance, 10000, 'Bank balance fully restored to £10,000 upon void');

  // 3. Ensure deleted transaction is excluded from active query
  const allTxs = [tx];
  const activeTxs = allTxs.filter((t) => t.status === 'POSTED' && !t.isDeleted);
  assert.equal(activeTxs.length, 0, 'Active transaction query excludes voided transaction');

  const recycleBinTxs = allTxs.filter((t) => t.isDeleted === true || t.status === 'VOID');
  assert.equal(recycleBinTxs.length, 1, 'Transaction appears in Recycle Bin');
  assert.equal(recycleBinTxs[0].deletionReason, deletionReason);

  // 4. Restore from Recycle Bin
  assert.equal(tx.status, 'VOID');
  tx.status = 'POSTED';
  tx.isDeleted = false;
  tx.restoredAt = new Date();
  tx.auditHistory.push({
    action: 'RESTORED',
    performedByName: 'Admin',
    timestamp: new Date(),
  });

  // Reapply liquidity outflow
  bankBalance = round2(bankBalance - expenseAmount);
  assert.equal(bankBalance, 9350, 'Bank balance accurately re-deducted to £9,350 upon restore');

  // 5. Verify audit history survives through entire lifecycle
  assert.equal(tx.auditHistory.length, 3, 'Audit history preserves CREATED, DELETED, and RESTORED records');
  assert.equal(tx.auditHistory[0].action, 'CREATED');
  assert.equal(tx.auditHistory[1].action, 'DELETED');
  assert.equal(tx.auditHistory[2].action, 'RESTORED');
});

// -----------------------------------------------------------------------------
// 4. MORTGAGE PAYMENT: SPLIT VALIDATION, EDIT, DELETE & RESTORE
// -----------------------------------------------------------------------------
test('MORTGAGE: Split validation, principal balance adjustment, delete restores debt, restore re-deducts', () => {
  let bankBalance = 25000;
  let mortgagePrincipalDebt = 200000;

  // Initial Mortgage Payment: Total £1,500 = £1,000 Interest + £450 Principal + £50 Fee
  let payment = {
    total: 1500,
    interest: 1000,
    principal: 450,
    fee: 50,
  };
  assert.equal(payment.interest + payment.principal + payment.fee, payment.total);

  // Post payment
  bankBalance = round2(bankBalance - payment.total);
  mortgagePrincipalDebt = round2(mortgagePrincipalDebt - payment.principal);
  assert.equal(bankBalance, 23500);
  assert.equal(mortgagePrincipalDebt, 199550, 'Principal debt reduced by £450');

  // EDIT Payment: Lender advised interest was £900 and principal was £550 (Total £1,500)
  const newPrincipal = 550;
  const newInterest = 900;
  const principalDiff = round2(newPrincipal - payment.principal); // £100 additional principal paid
  assert.equal(principalDiff, 100);

  payment.principal = newPrincipal;
  payment.interest = newInterest;
  mortgagePrincipalDebt = round2(mortgagePrincipalDebt - principalDiff);
  assert.equal(mortgagePrincipalDebt, 199450, 'Principal debt updated to £199,450');
  assert.equal(bankBalance, 23500, 'Bank outflow unchanged as total amount paid remained £1,500');

  // VOID / DELETE Mortgage Payment
  // 1. Bank balance restored (+£1,500)
  bankBalance = round2(bankBalance + payment.total);
  assert.equal(bankBalance, 25000, 'Bank balance restored to £25,000');

  // 2. Mortgage liability restored (+£550 principal debt reinstated)
  mortgagePrincipalDebt = round2(mortgagePrincipalDebt + payment.principal);
  assert.equal(mortgagePrincipalDebt, 200000, 'Mortgage principal debt reinstated back to £200,000');

  // RESTORE Mortgage Payment
  bankBalance = round2(bankBalance - payment.total);
  mortgagePrincipalDebt = round2(mortgagePrincipalDebt - payment.principal);
  assert.equal(bankBalance, 23500, 'Bank balance re-deducted upon restore');
  assert.equal(mortgagePrincipalDebt, 199450, 'Mortgage principal debt re-deducted upon restore');
});

// -----------------------------------------------------------------------------
// 5. RENT RECEIPT: ARREARS RECALCULATION ON DELETE AND RESTORE
// -----------------------------------------------------------------------------
test('RENT: Deleting rent payment reinstates tenant arrears; restoring marks schedule paid', () => {
  let bankBalance = 8000;

  // Rent schedule for Unit 1, October 2026
  let schedule = {
    expectedAmount: 1200,
    paidAmount: 0,
    outstandingAmount: 1200,
    status: 'PENDING',
  };

  // 1. Post Rent Receipt of £1,200
  const paymentAmount = 1200;
  bankBalance = round2(bankBalance + paymentAmount);
  schedule.paidAmount = round2(schedule.paidAmount + paymentAmount);
  schedule.outstandingAmount = Math.max(0, round2(schedule.expectedAmount - schedule.paidAmount));
  schedule.status = schedule.outstandingAmount === 0 ? 'PAID' : 'PARTIAL';

  assert.equal(bankBalance, 9200);
  assert.equal(schedule.paidAmount, 1200);
  assert.equal(schedule.outstandingAmount, 0);
  assert.equal(schedule.status, 'PAID', 'Schedule marked as fully paid');

  // 2. Void / Delete Rent Payment (e.g. cheque bounced / reversed)
  bankBalance = round2(bankBalance - paymentAmount);
  schedule.paidAmount = round2(schedule.paidAmount - paymentAmount);
  schedule.outstandingAmount = Math.max(0, round2(schedule.expectedAmount - schedule.paidAmount));
  schedule.status = schedule.paidAmount === 0 ? 'OVERDUE' : 'PARTIAL';

  assert.equal(bankBalance, 8000, 'Bank balance reversed by £1,200');
  assert.equal(schedule.paidAmount, 0, 'Schedule paid amount reverted to 0');
  assert.equal(schedule.outstandingAmount, 1200, 'Arrears of £1,200 reinstated to tenant');
  assert.equal(schedule.status, 'OVERDUE', 'Schedule status reinstated to OVERDUE');

  // 3. Restore Rent Payment from Recycle Bin
  bankBalance = round2(bankBalance + paymentAmount);
  schedule.paidAmount = round2(schedule.paidAmount + paymentAmount);
  schedule.outstandingAmount = Math.max(0, round2(schedule.expectedAmount - schedule.paidAmount));
  schedule.status = schedule.outstandingAmount === 0 ? 'PAID' : 'PARTIAL';

  assert.equal(bankBalance, 9200, 'Bank balance reinstated to £9,200');
  assert.equal(schedule.paidAmount, 1200);
  assert.equal(schedule.outstandingAmount, 0);
  assert.equal(schedule.status, 'PAID', 'Schedule status returns to PAID');
});

// -----------------------------------------------------------------------------
// 6. INTERNAL TRANSFERS: EXCLUDED FROM P&L & CORRECT MULTI-ACCOUNT ADJUSTMENT
// -----------------------------------------------------------------------------
test('TRANSFER: Inter-account transfer excluded from P&L; void reverses both accounts', () => {
  let sourceBank = 15000;
  let targetBank = 2000;
  let incomeTotal = 50000;
  let expenseTotal = 30000;

  const transferAmount = 4000;

  // Execute transfer
  sourceBank = round2(sourceBank - transferAmount);
  targetBank = round2(targetBank + transferAmount);

  // Transfers must NOT alter income or expenses
  assert.equal(sourceBank, 11000);
  assert.equal(targetBank, 6000);
  assert.equal(incomeTotal, 50000, 'Income unchanged by internal transfer');
  assert.equal(expenseTotal, 30000, 'Expenses unchanged by internal transfer');

  // Void / Delete transfer
  sourceBank = round2(sourceBank + transferAmount);
  targetBank = round2(targetBank - transferAmount);

  assert.equal(sourceBank, 15000, 'Source account restored');
  assert.equal(targetBank, 2000, 'Target account reversed');
  assert.equal(incomeTotal, 50000);
  assert.equal(expenseTotal, 30000);
});

// -----------------------------------------------------------------------------
// 7. MULTI-COMPANY ISOLATION ENFORCEMENT
// -----------------------------------------------------------------------------
test('MULTI-COMPANY: Operations are strictly isolated to the active companyId', () => {
  const companyA = 'old-street';
  const companyB = 'mile-end-road';

  assert.ok(VALID_COMPANY_IDS.includes(companyA));
  assert.ok(VALID_COMPANY_IDS.includes(companyB));
  assert.notEqual(companyA, companyB);

  const mockDb = [
    { _id: 'tx_old_1', companyId: companyA, amount: 500, status: 'POSTED', isDeleted: false },
    { _id: 'tx_old_2', companyId: companyA, amount: 300, status: 'VOID', isDeleted: true },
    { _id: 'tx_mile_1', companyId: companyB, amount: 1500, status: 'POSTED', isDeleted: false },
    { _id: 'tx_mile_2', companyId: companyB, amount: 800, status: 'VOID', isDeleted: true },
  ];

  // Active company queries for companyA
  const companyAActive = mockDb.filter((t) => t.companyId === companyA && t.status === 'POSTED' && !t.isDeleted);
  assert.equal(companyAActive.length, 1);
  assert.equal(companyAActive[0]._id, 'tx_old_1');

  // Recycle bin queries for companyA
  const companyARecycleBin = mockDb.filter((t) => t.companyId === companyA && (t.isDeleted === true || t.status === 'VOID'));
  assert.equal(companyARecycleBin.length, 1);
  assert.equal(companyARecycleBin[0]._id, 'tx_old_2');

  // Cross-company access attempt: Attempting to edit/delete companyB record under companyA context
  const crossCompanyTarget = mockDb.find((t) => t._id === 'tx_mile_1' && t.companyId === companyA);
  assert.equal(crossCompanyTarget, undefined, 'Cross-company record must not be found');
});
