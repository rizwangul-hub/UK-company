import '../config/env.js';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import Account from '../models/Account.js';
import Mortgage from '../models/Mortgage.js';
import Property from '../models/Property.js';
import RentSchedule from '../models/RentSchedule.js';
import Transaction from '../models/Transaction.js';
import MortgagePayment from '../models/MortgagePayment.js';
import { postLedgerTransaction, recalculateAccountBalance, round2 } from '../services/ledgerService.js';
import { recordMortgagePayment } from '../services/mortgageService.js';

const runAudit = async () => {
  try {
    await connectDB();
    console.log('\n================================================================');
    console.log('   PIXX TECHNOLOGIES UK — ACCOUNTING & CALCULATION ENGINE AUDIT');
    console.log('================================================================\n');

    let passedChecks = 0;
    let totalChecks = 0;

    const assertCheck = (title, condition, detail = '') => {
      totalChecks++;
      if (condition) {
        passedChecks++;
        console.log(`[PASS] Check #${totalChecks}: ${title}`);
        if (detail) console.log(`       -> ${detail}`);
      } else {
        console.error(`[FAIL] Check #${totalChecks}: ${title}`);
        if (detail) console.error(`       -> ${detail}`);
      }
    };

    // 1. Math Rounding Integrity Check
    const roundTest1 = round2(0.1 + 0.2);
    assertCheck('Currency Rounding round2(0.1 + 0.2)', roundTest1 === 0.3, `Result: £${roundTest1}`);

    const roundTest2 = round2(1250.456);
    assertCheck('Currency Precision 2 decimals', roundTest2 === 1250.46, `Result: £${roundTest2}`);

    // 2. Fetch existing accounts or create a test sandbox account
    const accounts = await Account.find({ isActive: true });
    console.log(`\nActive Bank & Cash Accounts found: ${accounts.length}`);
    accounts.forEach((a) => {
      console.log(`   - ${a.name} (${a.accountType}, ${a.bankName || 'Cash'}): Current Balance = £${a.currentBalance.toFixed(2)}`);
    });

    assertCheck('Accounts Exist in System', accounts.length > 0, `Count: ${accounts.length}`);

    // 3. Test Bank Account Balance Calculation from Transactions
    if (accounts.length > 0) {
      for (const acc of accounts) {
        const liveBal = acc.currentBalance;
        const recalculated = await recalculateAccountBalance(acc._id);
        assertCheck(
          `Account Reconciliation for "${acc.name}"`,
          Math.abs(liveBal - recalculated) < 0.05,
          `Stored Balance: £${liveBal.toFixed(2)}, Recalculated from Journal Ledger: £${recalculated.toFixed(2)}`
        );
      }
    }

    // 4. Test Rent Billings vs Collections
    const schedules = await RentSchedule.find({});
    console.log(`\nRent Schedules found: ${schedules.length}`);
    if (schedules.length > 0) {
      let allRentMathCorrect = true;
      for (const s of schedules) {
        const expected = s.expectedAmount || 0;
        const paid = s.paidAmount || 0;
        const outstanding = s.outstandingAmount || 0;
        const expectedOutstanding = Math.max(0, expected - paid);
        if (Math.abs(outstanding - expectedOutstanding) > 0.05) {
          allRentMathCorrect = false;
          console.error(`Discrepancy in RentSchedule ${s._id}: expected £${expected}, paid £${paid}, outstanding £${outstanding} vs calculated £${expectedOutstanding}`);
        }
      }
      assertCheck(
        'Rent Schedule Arrears Formula (Expected - Paid === Outstanding)',
        allRentMathCorrect,
        `Audited ${schedules.length} rent billing records`
      );
    }

    // 5. Test Mortgage Facilities & Debt Balances
    const mortgages = await Mortgage.find({ status: 'ACTIVE' });
    console.log(`\nActive Mortgage Facilities found: ${mortgages.length}`);
    if (mortgages.length > 0) {
      for (const m of mortgages) {
        assertCheck(
          `Mortgage "${m.lenderName}" (${m.accountReference}) Debt > 0`,
          m.outstandingPrincipalBalance >= 0,
          `Outstanding Principal: £${m.outstandingPrincipalBalance.toFixed(2)}`
        );

        // Check payments
        const payments = await MortgagePayment.find({ mortgageId: m._id });
        let totalPrincipalPaid = 0;
        for (const p of payments) {
          totalPrincipalPaid += p.principalAmount || 0;
          const splitSum = round2((p.interestAmount || 0) + (p.principalAmount || 0) + (p.feeAmount || 0));
          const totalPaid = round2(p.totalAmountPaid || 0);
          assertCheck(
            `Mortgage Payment #${p._id.toString().slice(-4)} Split Integrity`,
            Math.abs(splitSum - totalPaid) < 0.05,
            `Total Paid: £${totalPaid}, Sum of Splits: £${splitSum}`
          );
        }
      }
    }

    // 6. Test Sandbox Transaction Lifecycle (Atomic Increase & Decrease)
    console.log('\n--- Running Live Ledger Sandbox Simulation ---');
    const testAcc1 = await Account.create({
      name: '__AUDIT_TEST_ACC_A__',
      accountType: 'BANK',
      bankName: 'Test Bank UK',
      openingBalance: 10000,
      currentBalance: 10000,
      isActive: true,
    });

    const testAcc2 = await Account.create({
      name: '__AUDIT_TEST_ACC_B__',
      accountType: 'BANK',
      bankName: 'Test Bank UK',
      openingBalance: 5000,
      currentBalance: 5000,
      isActive: true,
    });

    // Test A: Income Posting (+£1,500)
    console.log('1. Posting £1,500 Income receipt into Account A...');
    await postLedgerTransaction({
      transactionDate: new Date(),
      transactionType: 'INCOME',
      accountId: testAcc1._id,
      amount: 1500,
      direction: 'IN',
      narration: 'Audit Test Income Receipt',
    });

    const acc1AfterIncome = await Account.findById(testAcc1._id);
    assertCheck(
      'Income Posting: Account Balance INCREASES correctly',
      acc1AfterIncome.currentBalance === 11500,
      `Expected: £11,500.00, Actual: £${acc1AfterIncome.currentBalance.toFixed(2)} (+£1,500.00)`
    );

    // Test B: Expense Posting (-£400)
    console.log('2. Posting £400 Expense voucher outflow from Account A...');
    await postLedgerTransaction({
      transactionDate: new Date(),
      transactionType: 'EXPENSE',
      accountId: testAcc1._id,
      amount: 400,
      direction: 'OUT',
      narration: 'Audit Test Expense Outflow',
    });

    const acc1AfterExpense = await Account.findById(testAcc1._id);
    assertCheck(
      'Expense Posting: Account Balance DECREASES correctly',
      acc1AfterExpense.currentBalance === 11100,
      `Expected: £11,100.00, Actual: £${acc1AfterExpense.currentBalance.toFixed(2)} (-£400.00)`
    );

    // Test C: Internal Transfer of £2,000 from Account A to Account B
    console.log('3. Transferring £2,000 from Account A to Account B...');
    await postLedgerTransaction({
      transactionDate: new Date(),
      transactionType: 'TRANSFER',
      accountId: testAcc1._id,
      counterAccountId: testAcc2._id,
      amount: 2000,
      direction: 'OUT',
      narration: 'Audit Test Internal Transfer A -> B',
    });

    const acc1AfterTransfer = await Account.findById(testAcc1._id);
    const acc2AfterTransfer = await Account.findById(testAcc2._id);
    assertCheck(
      'Transfer Outflow: Source Account DECREASES by exact transfer amount',
      acc1AfterTransfer.currentBalance === 9100,
      `Source Expected: £9,100.00, Actual: £${acc1AfterTransfer.currentBalance.toFixed(2)} (-£2,000.00)`
    );
    assertCheck(
      'Transfer Inflow: Destination Account INCREASES by exact transfer amount',
      acc2AfterTransfer.currentBalance === 7000,
      `Destination Expected: £7,000.00, Actual: £${acc2AfterTransfer.currentBalance.toFixed(2)} (+£2,000.00)`
    );

    const totalSandboxLiquidity = acc1AfterTransfer.currentBalance + acc2AfterTransfer.currentBalance;
    // Initial 10000 + 5000 + 1500 (income) - 400 (expense) = 16100
    assertCheck(
      'Conservation of Liquidity across Internal Transfers',
      totalSandboxLiquidity === 16100,
      `Total Liquidity: £${totalSandboxLiquidity.toFixed(2)}`
    );

    // Clean up Sandbox test records
    await Transaction.deleteMany({
      $or: [
        { accountId: { $in: [testAcc1._id, testAcc2._id] } },
        { counterAccountId: { $in: [testAcc1._id, testAcc2._id] } },
      ],
    });
    await Account.deleteMany({ _id: { $in: [testAcc1._id, testAcc2._id] } });
    console.log('Sandbox test records cleaned up successfully.');

    console.log('\n================================================================');
    console.log(`  AUDIT COMPLETED: ${passedChecks}/${totalChecks} CHECKS PASSED`);
    console.log('================================================================\n');

    process.exit(passedChecks === totalChecks ? 0 : 1);
  } catch (err) {
    console.error('Audit execution error:', err);
    process.exit(1);
  }
};

runAudit();
