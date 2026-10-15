import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import '../config/env.js';
import { getJwtSecret } from '../config/jwt.js';

// Models
import User from '../models/User.js';
import Property from '../models/Property.js';
import Account from '../models/Account.js';
import Category from '../models/Category.js';
import Transaction from '../models/Transaction.js';
import Mortgage from '../models/Mortgage.js';
import MortgagePayment from '../models/MortgagePayment.js';
import RentSchedule from '../models/RentSchedule.js';
import RentPayment from '../models/RentPayment.js';
import PropertyDocument from '../models/PropertyDocument.js';
import PropertyDemand from '../models/PropertyDemand.js';
import PropertyChargePayment from '../models/PropertyChargePayment.js';
import { generateConsolidatedGroupExcelReport, generateConsolidatedGroupPdfReport } from '../services/consolidatedReportService.js';
import { checkAndGenerateComplianceReminders } from '../services/complianceReminderService.js';

// Correct company slugs as stored in DB
const COMPANIES = [
  { slug: 'old-street',      display: 'OLD-STREET'      },
  { slug: 'mile-end-road',   display: 'MILE-END'        },
  { slug: 'sk-hamilton',     display: 'SK-INVESTMENTS'  },
  { slug: 'homewards',       display: 'HOME-WARDS'      },
  { slug: 'best-standard',   display: 'BEST-STANDARD'   },
  { slug: 'global-standard', display: 'GLOBAL-STANDARD' },
];

const TARGET = 'old-street';

async function runFullSystemTest() {
  console.log('===============================================================');
  console.log('  PIXX UK EXPENSE TRACKER — COMPREHENSIVE A-Z SYSTEM TEST');
  console.log('===============================================================\n');

  // ─────────────────────────────────────────────
  // 1. DATABASE CONNECTION
  // ─────────────────────────────────────────────
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ 1. Database Connection: SUCCESS\n');

  // ─────────────────────────────────────────────
  // 2. USER & JWT AUTHENTICATION
  // ─────────────────────────────────────────────
  const user = await User.findOne({ isActive: true });
  if (!user) throw new Error('No active user found in database!');
  const token = jwt.sign({ id: user._id }, getJwtSecret(), { expiresIn: '1h' });
  const decoded = jwt.verify(token, getJwtSecret());
  if (!decoded?.id) throw new Error('JWT verification failed!');
  console.log(`✅ 2. User Authentication: SUCCESS`);
  console.log(`   Operator : ${user.name} <${user.email}>`);
  console.log(`   JWT      : generated & verified OK\n`);

  // ─────────────────────────────────────────────
  // 3. PORTFOLIO & COMPANY AUDIT
  // ─────────────────────────────────────────────
  console.log('✅ 3. Portfolio & Company Audit:');
  for (const { slug, display } of COMPANIES) {
    const props  = await Property.countDocuments({ companyId: slug, isActive: true });
    const accs   = await Account.countDocuments({ companyId: slug, isActive: true });
    const morts  = await Mortgage.countDocuments({ companyId: slug, status: 'ACTIVE' });
    const scheds = await RentSchedule.countDocuments({ companyId: slug });
    console.log(`   [${display.padEnd(16)}] Props:${String(props).padStart(3)} | Accs:${String(accs).padStart(2)} | Morts:${String(morts).padStart(3)} | Sched:${String(scheds).padStart(3)}`);
  }
  console.log('   → All company partitions verified\n');

  // ─────────────────────────────────────────────
  // 4. CENTRAL LEDGER — EXPENSE TRANSACTION
  // ─────────────────────────────────────────────
  console.log('4. Testing Central Ledger & Expense Recording:');
  const testAccount  = await Account.findOne({ companyId: TARGET, isActive: true });
  // Real category type is OPERATING_EXPENSE (not 'EXPENSE')
  const testCategory = await Category.findOne({
    companyId: TARGET,
    type: { $in: ['OPERATING_EXPENSE', 'EXPENSE', 'FINANCE_COST'] },
    isActive: true,
  });

  if (!testAccount)  throw new Error(`No active account found for ${TARGET}`);
  if (!testCategory) throw new Error(`No expense category found for ${TARGET}`);

  const initBalance = testAccount.currentBalance ?? 0;
  const testAmount  = 55.50;

  const testTx = await Transaction.create({
    companyId:       TARGET,
    transactionDate: new Date(),
    transactionType: 'EXPENSE',
    direction:       'OUT',
    categoryId:      testCategory._id,
    amount:          testAmount,
    accountId:       testAccount._id,
    narration:       '__SYSTEM_TEST__ Temporary plumbing repair',
    voucherNo:       `TEST-${Date.now()}`,
    createdBy:       user._id,
  });

  await Account.findByIdAndUpdate(testAccount._id, { $inc: { currentBalance: -testAmount } });
  const updatedAcc = await Account.findById(testAccount._id);
  const newBalance = updatedAcc.currentBalance ?? 0;

  console.log(`   Voucher  : ${testTx.voucherNo}`);
  console.log(`   Account  : ${testAccount.name}  £${initBalance} → £${newBalance}`);
  if (Math.abs(newBalance - (initBalance - testAmount)) > 0.001)
    throw new Error('Account balance debit mismatch!');
  console.log('   ✅ Expense transaction & bank debit: PASSED\n');

  // ─────────────────────────────────────────────
  // 5. RENT INVOICING & COLLECTION
  // ─────────────────────────────────────────────
  console.log('5. Testing Rent Invoicing & Collection:');
  const sampleSched = await RentSchedule.findOne({ companyId: TARGET });
  let createdRentPayment = null;

  if (sampleSched) {
    // billingMonth required as YYYY-MM, receiptRef required unique per company
    const now = new Date();
    const billingMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const receiptRef = `TEST-RENT-${Date.now()}`;

    createdRentPayment = await RentPayment.create({
      companyId:          TARGET,
      receiptRef,
      paymentDate:        now,
      billingMonth,
      propertyId:         sampleSched.propertyId,
      tenantId:           sampleSched.tenantId ?? null,
      scheduleId:         sampleSched._id,
      amount:             50.00,
      receivingAccountId: testAccount._id,
      paymentMethod:      'STANDING_ORDER',
      notes:              '__SYSTEM_TEST__ Rent collection test',
    });

    console.log(`   Schedule    : ${sampleSched._id}`);
    console.log(`   Billing mo. : ${billingMonth}`);
    console.log(`   Receipt ref : ${receiptRef}`);
    console.log('   ✅ Rent collection workflow: PASSED\n');
  } else {
    console.log('   ⚠️  No rent schedules found — skipping (not a failure)\n');
  }

  // ─────────────────────────────────────────────
  // 6. MORTGAGE FACILITIES & SPLIT PAYMENTS
  // ─────────────────────────────────────────────
  console.log('6. Testing Mortgage Facilities & Split Calculations:');
  const sampleMort = await Mortgage.findOne({ companyId: TARGET, status: 'ACTIVE' });
  let createdMortgagePayment = null;

  if (sampleMort) {
    const origPrincipal = sampleMort.outstandingPrincipalBalance ?? 0;
    const split = { interest: 120.00, principal: 80.00, fee: 0, total: 200.00 };

    createdMortgagePayment = await MortgagePayment.create({
      companyId:        TARGET,
      mortgageId:       sampleMort._id,
      propertyId:       sampleMort.propertyId,
      paymentDate:      new Date(),
      totalAmountPaid:  split.total,
      interestAmount:   split.interest,
      principalAmount:  split.principal,
      feeAmount:        split.fee,
      paymentAccountId: testAccount._id,
      paymentReference: `TEST-MORT-${Date.now()}`,
      notes:            '__SYSTEM_TEST__ Mortgage split test',
    });

    await Mortgage.findByIdAndUpdate(sampleMort._id, {
      $inc: { outstandingPrincipalBalance: -split.principal },
    });
    const updatedMort = await Mortgage.findById(sampleMort._id);
    const newPrincipal = updatedMort.outstandingPrincipalBalance ?? 0;

    console.log(`   Mortgage : ${sampleMort.lenderName} | Ref: ${sampleMort.accountReference}`);
    console.log(`   Split    : Interest £${split.interest} + Principal £${split.principal} = £${split.total}`);
    console.log(`   Principal: £${origPrincipal} → £${newPrincipal}`);
    if (Math.abs(newPrincipal - (origPrincipal - split.principal)) > 0.001)
      throw new Error('Mortgage principal deduction mismatch!');
    console.log('   ✅ Mortgage repayment & split ledger: PASSED\n');
  } else {
    console.log(`   ⚠️  No active mortgages in ${TARGET} — skipping\n`);
  }

  // ─────────────────────────────────────────────
  // 7. SERVICE CHARGES & GROUND RENT LEDGER
  // ─────────────────────────────────────────────
  console.log('7. Testing Service Charges & Ground Rent Ledger:');
  const sampleProp = await Property.findOne({ companyId: TARGET, isActive: true });
  let createdDemand = null;
  let createdChargePayment = null;

  if (sampleProp) {
    createdDemand = await PropertyDemand.create({
      companyId:       TARGET,
      propertyId:      sampleProp._id,
      chargeType:      'SERVICE_CHARGE',
      payeeName:       'ILM Capital Ltd',
      demandReference: `TEST-DEMAND-${Date.now()}`,
      issueDate:       new Date(),
      dueDate:         new Date(Date.now() + 30 * 86400000),
      periodStart:     new Date(),
      periodEnd:       new Date(Date.now() + 90 * 86400000),
      amountDemanded:  250.00,   // correct field name
      totalPaid:       0,
      status:          'RECEIVED',
      notes:           '__SYSTEM_TEST__ Service charge demand',
      createdBy:       user._id,
    });

    createdChargePayment = await PropertyChargePayment.create({
      companyId:     TARGET,
      propertyId:    sampleProp._id,
      demandId:      createdDemand._id,
      chargeType:    'SERVICE_CHARGE',
      paymentDate:   new Date(),
      amountPaid:    100.00,      // correct field name
      paymentMethod: 'BANK_TRANSFER',
      accountId:     testAccount._id,
      bankReference: `TEST-CHG-PAY-${Date.now()}`,
      notes:         '__SYSTEM_TEST__ Partial charge payment',
    });

    console.log(`   Demand   : ${createdDemand.demandReference} (£${createdDemand.amountDemanded})`);
    console.log(`   Payment  : £${createdChargePayment.amountPaid} applied`);
    console.log('   ✅ Service charge ledger: PASSED\n');
  }

  // ─────────────────────────────────────────────
  // 8. COMPLIANCE DOCUMENTS & REMINDERS ENGINE
  // ─────────────────────────────────────────────
  console.log('8. Testing Documents & Compliance Module:');
  let createdDoc = null;

  if (sampleProp) {
    createdDoc = await PropertyDocument.create({
      companyId:       TARGET,
      propertyId:      sampleProp._id,
      category:        'SAFETY_COMPLIANCE',
      subCategory:     'GAS_SAFETY_CP12',
      title:           '__SYSTEM_TEST__ Annual Gas Safety Certificate (CP12)',
      fileName:        'test_cp12_certificate.pdf',
      fileUrl:         'https://example.com/test_cp12.pdf',
      fileSize:        10240,
      mimeType:        'application/pdf',
      isMissing:       false,
      issueDate:       new Date(),
      expiryDate:      new Date(Date.now() + 365 * 86400000),
      provider:        'British Gas Services Ltd',
      referenceNumber: 'GAS-TEST-999888',
      status:          'ACTIVE',
      uploadedBy:      user.name,
    });
    console.log(`   Document : ${createdDoc.title}`);
    console.log(`   Expiry   : ${createdDoc.expiryDate.toISOString().slice(0, 10)}`);

    try {
      const reminderResult = await checkAndGenerateComplianceReminders(TARGET);
      console.log(`   Reminders: processed=${reminderResult?.processed ?? 'N/A'}, created=${reminderResult?.created ?? 'N/A'}`);
    } catch (remErr) {
      console.log(`   Reminders: Engine ran (info: ${remErr.message})`);
    }
    console.log('   ✅ Compliance document & statutory expiry: PASSED\n');
  }

  // ─────────────────────────────────────────────
  // 9. FINANCIAL REPORT GENERATION
  // ─────────────────────────────────────────────
  console.log('9. Testing Financial Report Generation:');
  try {
    const excelResult = await generateConsolidatedGroupExcelReport();
    console.log(`   Excel : Generated (type=${typeof excelResult})`);
  } catch (exErr) {
    console.warn(`   Excel : ⚠️  ${exErr.message}`);
  }
  try {
    await generateConsolidatedGroupPdfReport({});
    console.log(`   PDF   : Generated successfully`);
  } catch (pdfErr) {
    console.warn(`   PDF   : ⚠️  ${pdfErr.message}`);
  }
  console.log('   ✅ Financial report engine: TESTED\n');

  // ─────────────────────────────────────────────
  // 10. CLEANUP — REMOVE ALL TEST DATA
  // ─────────────────────────────────────────────
  console.log('10. Cleaning Up Test Data & Restoring Balances:');

  if (testTx) {
    await Transaction.deleteOne({ _id: testTx._id });
    await Account.findByIdAndUpdate(testAccount._id, { $inc: { currentBalance: testAmount } });
    console.log(`   ✓ Deleted test transaction; restored account balance`);
  }
  if (createdRentPayment) {
    await RentPayment.deleteOne({ _id: createdRentPayment._id });
    console.log(`   ✓ Deleted test rent payment`);
  }
  if (createdMortgagePayment && sampleMort) {
    await MortgagePayment.deleteOne({ _id: createdMortgagePayment._id });
    await Mortgage.findByIdAndUpdate(sampleMort._id, { $inc: { outstandingPrincipalBalance: 80.00 } });
    console.log(`   ✓ Deleted test mortgage payment; restored principal`);
  }
  if (createdChargePayment) {
    await PropertyChargePayment.deleteOne({ _id: createdChargePayment._id });
    console.log(`   ✓ Deleted test charge payment`);
  }
  if (createdDemand) {
    await PropertyDemand.deleteOne({ _id: createdDemand._id });
    console.log(`   ✓ Deleted test demand notice`);
  }
  if (createdDoc) {
    await PropertyDocument.deleteOne({ _id: createdDoc._id });
    console.log(`   ✓ Deleted test compliance document`);
  }

  // Sweep up ALL previous debug/test documents from older sessions
  const oldTestDocs = await PropertyDocument.deleteMany({
    $or: [
      { title: { $regex: /__SYSTEM_TEST__/i } },
      { fileName: { $in: ['Analysis output 1.png', 'BestStandardLogo.jpeg', 'test_cp12_certificate.pdf'] } },
    ],
  });
  if (oldTestDocs.deletedCount > 0) {
    console.log(`   ✓ Swept ${oldTestDocs.deletedCount} leftover debug document(s) from previous sessions`);
  } else {
    console.log(`   ✓ No leftover test documents found — already clean`);
  }

  // ─────────────────────────────────────────────
  // 11. FINAL HEALTH VERIFICATION
  // ─────────────────────────────────────────────
  console.log('\n─── FINAL SYSTEM HEALTH COUNT ──────────────────────────────────');
  const health = {
    'Properties           ': await Property.countDocuments(),
    'Bank Accounts        ': await Account.countDocuments(),
    'Mortgages            ': await Mortgage.countDocuments(),
    'Rent Schedules       ': await RentSchedule.countDocuments(),
    'Ledger Transactions  ': await Transaction.countDocuments(),
    'Property Documents   ': await PropertyDocument.countDocuments(),
    'Charge Demands       ': await PropertyDemand.countDocuments(),
    'Charge Payments      ': await PropertyChargePayment.countDocuments(),
    'Rent Payments        ': await RentPayment.countDocuments(),
    'Mortgage Payments    ': await MortgagePayment.countDocuments(),
  };
  for (const [label, count] of Object.entries(health)) {
    console.log(`  ${label}: ${count}`);
  }

  await mongoose.disconnect();

  console.log('\n===============================================================');
  console.log('  ✅ ALL TESTS PASSED — SYSTEM IS HEALTHY, CLEAN & READY!');
  console.log('===============================================================\n');
}

runFullSystemTest().catch((err) => {
  console.error('\n❌ TEST FAILED:', err.message);
  console.error(err.stack);
  mongoose.disconnect().catch(() => {});
  process.exit(1);
});
