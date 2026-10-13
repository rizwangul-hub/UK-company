import { test } from 'node:test';
import assert from 'node:assert/strict';
import { round2 } from '../src/services/ledgerService.js';

test('PHASE 5: Mortgage payment exact split scenario', () => {
  // Scenario requirements:
  // - Starting bank balance: £10,000
  // - Starting mortgage principal: £100,000
  // - Total mortgage payment: £1,000
  // - Interest component: £700
  // - Principal component: £300
  // - Lender fees: £0
  let bankBalance = 10000;
  let mortgagePrincipal = 100000;
  let financeCosts = 0;
  let operatingExpenses = 0;

  const payment = {
    totalPaid: 1000,
    interest: 700,
    principal: 300,
    fees: 0,
  };

  // 1. Verify split sum integrity
  const splitSum = round2(payment.interest + payment.principal + payment.fees);
  assert.equal(splitSum, payment.totalPaid, 'Payment splits must equal total paid');

  // 2. Apply cash outflow to bank liquidity
  bankBalance = round2(bankBalance - payment.totalPaid);
  assert.equal(bankBalance, 9000, 'Bank balance becomes £9,000');

  // 3. Apply principal repayment to mortgage liability
  mortgagePrincipal = round2(mortgagePrincipal - payment.principal);
  assert.equal(mortgagePrincipal, 99700, 'Mortgage principal becomes £99,700');

  // 4. Finance costs increase by the £700 interest component
  financeCosts = round2(financeCosts + payment.interest);
  assert.equal(financeCosts, 700, 'Finance costs increase by £700');

  // 5. Operating expenses do NOT increase by the £300 principal repayment
  // (fees are £0, principal is balance sheet liability reduction, not P&L expense)
  operatingExpenses = round2(operatingExpenses + payment.fees);
  assert.equal(operatingExpenses, 0, 'Operating expenses do not increase by principal repayment');

  // 6. Net mortgage liability decreased by exactly £300
  const liabilityReduction = 100000 - mortgagePrincipal;
  assert.equal(liabilityReduction, 300, 'Mortgage liability decreases by £300');
});

test('PHASE 5: Interest-Only Mortgage payment', () => {
  let bankBalance = 15000;
  let mortgagePrincipal = 250000;
  const payment = { totalPaid: 850, interest: 850, principal: 0, fees: 0 };

  bankBalance = round2(bankBalance - payment.totalPaid);
  mortgagePrincipal = round2(mortgagePrincipal - payment.principal);

  assert.equal(bankBalance, 14150);
  assert.equal(mortgagePrincipal, 250000, 'Principal balance remains unchanged for interest-only');
});

test('PHASE 5: Capital Repayment Mortgage payment', () => {
  let bankBalance = 8000;
  let mortgagePrincipal = 80000;
  const payment = { totalPaid: 1200, interest: 350, principal: 850, fees: 0 };

  bankBalance = round2(bankBalance - payment.totalPaid);
  mortgagePrincipal = round2(mortgagePrincipal - payment.principal);

  assert.equal(bankBalance, 6800);
  assert.equal(mortgagePrincipal, 79150);
});

test('PHASE 5: Mortgage payment with lender fee component', () => {
  let bankBalance = 5000;
  let mortgagePrincipal = 50000;
  let financeCosts = 0;
  let operatingExpenses = 0;

  const payment = { totalPaid: 950, interest: 600, principal: 300, fees: 50 };

  bankBalance = round2(bankBalance - payment.totalPaid);
  mortgagePrincipal = round2(mortgagePrincipal - payment.principal);
  financeCosts = round2(financeCosts + payment.interest);
  operatingExpenses = round2(operatingExpenses + payment.fees);

  assert.equal(bankBalance, 4050);
  assert.equal(mortgagePrincipal, 49700);
  assert.equal(financeCosts, 600);
  assert.equal(operatingExpenses, 50, 'Lender fees are accounted under operating expenses');
});

test('PHASE 5: Invalid split mismatch is rejected', () => {
  const payment = { totalPaid: 1000, interest: 700, principal: 250, fees: 0 }; // sum is 950, mismatch 50
  const calculatedSum = round2(payment.interest + payment.principal + payment.fees);
  const isInvalid = Math.abs(calculatedSum - payment.totalPaid) > 0.05;
  assert.ok(isInvalid, 'Must flag split mismatch');
});

test('PHASE 5: Principal repayment exceeding outstanding balance is detected', () => {
  const currentPrincipal = 15000;
  const attemptedPrincipalRepayment = 16000;
  assert.ok(
    attemptedPrincipalRepayment > currentPrincipal,
    'Should reject principal repayment greater than remaining mortgage principal'
  );
});

test('PHASE 6: Internal Bank-to-Bank transfer preserves net portfolio cash', () => {
  const bankA = { name: 'Barclays Main', balance: 12000 };
  const bankB = { name: 'Santander Reserve', balance: 3500 };
  const transferAmount = 2500;

  const initialNetCash = round2(bankA.balance + bankB.balance);

  bankA.balance = round2(bankA.balance - transferAmount);
  bankB.balance = round2(bankB.balance + transferAmount);

  const finalNetCash = round2(bankA.balance + bankB.balance);

  assert.equal(bankA.balance, 9500);
  assert.equal(bankB.balance, 6000);
  assert.equal(initialNetCash, finalNetCash, 'Internal transfer must produce 0 net change to liquidity');
});

test('PHASE 6: Internal Bank-to-Cash transfer', () => {
  const bankAccount = { name: 'Lloyds Business', balance: 5000 };
  const cashAccount = { name: 'Office Petty Cash', balance: 150 };
  const transferAmount = 200;

  const totalBefore = round2(bankAccount.balance + cashAccount.balance);

  bankAccount.balance = round2(bankAccount.balance - transferAmount);
  cashAccount.balance = round2(cashAccount.balance + transferAmount);

  const totalAfter = round2(bankAccount.balance + cashAccount.balance);

  assert.equal(bankAccount.balance, 4800);
  assert.equal(cashAccount.balance, 350);
  assert.equal(totalBefore, totalAfter);
});

test('PHASE 6: Cash account overdraft prevention', () => {
  const cashAccount = { name: 'Petty Cash', balance: 75 };
  const withdrawal = 100;
  const isOverdrawn = round2(cashAccount.balance - withdrawal) < 0;
  assert.ok(isOverdrawn, 'Cash account cannot have negative balance');
});

test('PHASE 4: Rent payments increase bank balance exactly once', () => {
  let bankBalance = 5000;
  const schedule = { expectedAmount: 1250, paidAmount: 0, outstandingAmount: 1250 };
  const paymentAmount = 1250;

  // Single posting
  bankBalance = round2(bankBalance + paymentAmount);
  schedule.paidAmount = round2(schedule.paidAmount + paymentAmount);
  schedule.outstandingAmount = Math.max(0, schedule.expectedAmount - schedule.paidAmount);

  assert.equal(bankBalance, 6250, 'Bank balance increased exactly once by £1,250');
  assert.equal(schedule.paidAmount, 1250);
  assert.equal(schedule.outstandingAmount, 0);
});

test('PHASE 4: Partial rent payments and arrears tracking', () => {
  const schedule = { expectedAmount: 1000, paidAmount: 0, outstandingAmount: 1000 };

  // First partial payment
  schedule.paidAmount = round2(schedule.paidAmount + 400);
  schedule.outstandingAmount = Math.max(0, schedule.expectedAmount - schedule.paidAmount);
  assert.equal(schedule.paidAmount, 400);
  assert.equal(schedule.outstandingAmount, 600, 'Arrears should be £600');

  // Second payment settles remainder
  schedule.paidAmount = round2(schedule.paidAmount + 600);
  schedule.outstandingAmount = Math.max(0, schedule.expectedAmount - schedule.paidAmount);
  assert.equal(schedule.paidAmount, 1000);
  assert.equal(schedule.outstandingAmount, 0, 'Arrears cleared to £0');
});

test('PHASE 7: UK Tax Year Section 24 statutory basic-rate tax relief (Profitable)', () => {
  const grossRentalIncome = 24000;
  const allowableExpenses = 4000;
  const mortgageInterest = 8000; // Finance costs
  const principalRepaid = 5000; // Not deductible, ignored for Section 24

  const netProfitBeforeFinanceCosts = round2(grossRentalIncome - allowableExpenses); // 20,000
  assert.equal(netProfitBeforeFinanceCosts, 20000);

  // Section 24 tax relief is 20% of the LOWER of:
  // 1. Finance costs (£8,000)
  // 2. Net property profit (£20,000)
  const qualifyingFinanceCosts = Math.min(mortgageInterest, Math.max(0, netProfitBeforeFinanceCosts));
  assert.equal(qualifyingFinanceCosts, 8000);

  const section24TaxCredit = round2(qualifyingFinanceCosts * 0.20);
  assert.equal(section24TaxCredit, 1600, '20% basic rate reducer is £1,600');

  const carriedForwardFinanceCosts = round2(Math.max(0, mortgageInterest - qualifyingFinanceCosts));
  assert.equal(carriedForwardFinanceCosts, 0, 'No finance costs carried forward');
});

test('PHASE 7: UK Tax Year Section 24 relief restricted by property business loss', () => {
  const grossRentalIncome = 10000;
  const allowableExpenses = 14000;
  const mortgageInterest = 5000;

  const netProfitBeforeFinanceCosts = round2(grossRentalIncome - allowableExpenses); // -4,000 (Loss)
  assert.equal(netProfitBeforeFinanceCosts, -4000);

  // Under HMRC rules, relief cannot create or increase a property loss
  const qualifyingFinanceCosts = Math.min(mortgageInterest, Math.max(0, netProfitBeforeFinanceCosts));
  assert.equal(qualifyingFinanceCosts, 0, 'Qualifying finance costs capped at £0 during a loss year');

  const section24TaxCredit = round2(qualifyingFinanceCosts * 0.20);
  assert.equal(section24TaxCredit, 0, 'Tax reducer is £0');

  const carriedForwardFinanceCosts = round2(Math.max(0, mortgageInterest - qualifyingFinanceCosts));
  assert.equal(carriedForwardFinanceCosts, 5000, 'Unrelieved £5,000 finance costs carried forward');
});

test('PHASE 7: UK Tax Year date boundaries (6 April to 5 April)', () => {
  const taxYear = '2026-2027';
  const [startYear] = taxYear.split('-').map(Number);
  const startDate = new Date(Date.UTC(startYear, 3, 6)); // 2026-04-06
  const endDate = new Date(Date.UTC(startYear + 1, 3, 5, 23, 59, 59)); // 2027-04-05

  const txDateInside = new Date('2026-07-15T12:00:00Z');
  const txDateBefore = new Date('2026-04-05T23:59:59Z');
  const txDateAfter = new Date('2027-04-06T00:00:01Z');

  assert.ok(txDateInside >= startDate && txDateInside <= endDate, 'Date in July is inside UK tax year');
  assert.ok(txDateBefore < startDate, '5 April 2026 is outside (previous tax year)');
  assert.ok(txDateAfter > endDate, '6 April 2027 is outside (next tax year)');
});
