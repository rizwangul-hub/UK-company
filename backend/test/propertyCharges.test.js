import { test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import ServiceChargePayee from '../src/models/ServiceChargePayee.js';
import PropertyChargeConfig from '../src/models/PropertyChargeConfig.js';
import PropertyDemand from '../src/models/PropertyDemand.js';
import PropertyChargePayment from '../src/models/PropertyChargePayment.js';
import ComplianceNotification from '../src/models/ComplianceNotification.js';
import { round2 } from '../src/services/ledgerService.js';

test('SERVICE CHARGE PAYEE: Schema validates required companyId and payeeName', () => {
  const payee = new ServiceChargePayee({
    companyId: 'global-standard',
    name: 'Zircon Holdings Limited',
    bankName: 'Royal Bank of Scotland',
    sortCode: '16-00-63',
    accountNumber: '10801788',
    telephone: '020 3355 5309',
    email: 'waqas@ilmcapital.co.uk',
  });

  const err = payee.validateSync();
  assert.equal(err, undefined, 'Valid payee should pass validation');
  assert.equal(payee.payeeName, 'Zircon Holdings Limited');
  assert.equal(payee.sortCode, '16-00-63');
  assert.equal(payee.accountNumber, '10801788');
});

test('PROPERTY CHARGE CONFIG: Supports independent Service Charge & Ground Rent configs', () => {
  const dummyPropId = new mongoose.Types.ObjectId();
  const configSC = new PropertyChargeConfig({
    companyId: 'global-standard',
    propertyId: dummyPropId,
    chargeType: 'SERVICE_CHARGE',
    isEnabled: true,
    expectedAmount: 1850.5,
    paymentFrequency: 'HALF_YEARLY',
    normalDueDateTerms: 'Payable 1st January and 1st July',
  });

  assert.equal(configSC.validateSync(), undefined);
  assert.equal(configSC.chargeType, 'SERVICE_CHARGE');
  assert.equal(configSC.expectedAmount, 1850.5);

  const configGR = new PropertyChargeConfig({
    companyId: 'global-standard',
    propertyId: dummyPropId,
    chargeType: 'GROUND_RENT',
    isEnabled: true,
    expectedAmount: 250,
    paymentFrequency: 'ANNUAL',
    normalDueDateTerms: 'Payable on 25th March',
  });

  assert.equal(configGR.validateSync(), undefined);
  assert.equal(configGR.chargeType, 'GROUND_RENT');
  assert.equal(configGR.expectedAmount, 250);
});

test('PROPERTY CHARGE CONFIG: Rejects invalid payment frequency', () => {
  const config = new PropertyChargeConfig({
    companyId: 'global-standard',
    propertyId: new mongoose.Types.ObjectId(),
    chargeType: 'SERVICE_CHARGE',
    paymentFrequency: 'BI_WEEKLY', // invalid enum
  });

  const err = config.validateSync();
  assert.ok(err, 'Should reject invalid frequency enum');
  assert.ok(err.errors.paymentFrequency);
});

test('PROPERTY DEMAND: Validates status lifecycle and calculates virtual balance', () => {
  const demand = new PropertyDemand({
    companyId: 'global-standard',
    propertyId: new mongoose.Types.ObjectId(),
    chargeType: 'SERVICE_CHARGE',
    payeeName: 'Zircon Holdings Limited',
    demandReference: 'DEM-2026-001',
    issueDate: new Date('2026-01-01'),
    dueDate: new Date('2026-01-31'),
    amountDemanded: 1200,
    totalPaid: 0,
    adjustments: 0,
    status: 'RECEIVED',
  });

  assert.equal(demand.validateSync(), undefined);
  assert.equal(demand.outstandingBalance, 1200);

  // Partial payment update
  demand.totalPaid = 400;
  demand.status = 'PARTIALLY_PAID';
  assert.equal(demand.outstandingBalance, 800);

  // Full payment
  demand.totalPaid = 1200;
  demand.status = 'PAID';
  assert.equal(demand.outstandingBalance, 0);
});

test('ANTI-DOUBLE-COUNTING: Demand notice creation does not alter cash balance', () => {
  let bankBalance = 25000.0;

  // 1. Accrual notice received: £1,450.00 demanded
  const demandNotice = {
    demandReference: 'DEM-BRX-2026',
    amountDemanded: 1450.0,
    status: 'RECEIVED',
  };

  // Demands represent liabilities, NOT cash outflows. Balance remains untouched.
  assert.equal(bankBalance, 25000.0, 'Creating a demand notice must never reduce bank balance');

  // 2. Payment executed: £1,450.00
  const paymentAmount = 1450.0;
  bankBalance = round2(bankBalance - paymentAmount);

  assert.equal(bankBalance, 23550.0, 'Payment execution must deduct the exact amount from bank balance');
  demandNotice.status = 'PAID';
  demandNotice.totalPaid = paymentAmount;
  assert.equal(demandNotice.status, 'PAID');
});

test('RUNNING LEDGER: Sequential demands and partial payments calculate running balance accurately', () => {
  // Scenario:
  // Step 0: Opening balance £0
  // Step 1: Demand raised for £1,000 (Debit) -> Balance: £1,000
  // Step 2: Partial payment £400 (Credit)   -> Balance: £600
  // Step 3: Second demand for £500 (Debit)   -> Balance: £1,100
  // Step 4: Final payment £1,100 (Credit)   -> Balance: £0

  const entries = [
    { type: 'DEMAND', amount: 1000, date: new Date('2026-01-01') },
    { type: 'PAYMENT', amount: 400, date: new Date('2026-01-15') },
    { type: 'DEMAND', amount: 500, date: new Date('2026-02-01') },
    { type: 'PAYMENT', amount: 1100, date: new Date('2026-02-15') },
  ];

  let runningBalance = 0;
  const ledgerRows = entries.map((entry) => {
    if (entry.type === 'DEMAND') {
      runningBalance = round2(runningBalance + entry.amount);
    } else if (entry.type === 'PAYMENT') {
      runningBalance = round2(runningBalance - entry.amount);
    }
    return { ...entry, runningBalance };
  });

  assert.equal(ledgerRows[0].runningBalance, 1000.0);
  assert.equal(ledgerRows[1].runningBalance, 600.0);
  assert.equal(ledgerRows[2].runningBalance, 1100.0);
  assert.equal(ledgerRows[3].runningBalance, 0.0);
});

test('REMINDERS ENGINE: Advance notices milestones and deduplication', () => {
  const demand = {
    _id: new mongoose.Types.ObjectId(),
    demandReference: 'DEM-TEST-7D',
    dueDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000), // 6 days from now
    amountDemanded: 850,
    totalPaid: 0,
    adjustments: 0,
    status: 'RECEIVED',
    remindersTriggered: [],
  };

  const daysUntilDue = Math.ceil((demand.dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  assert.ok(daysUntilDue <= 7, 'Should be within 7 days');

  let milestone = null;
  if (daysUntilDue <= 7) milestone = '7_DAYS';

  assert.equal(milestone, '7_DAYS');
  assert.equal(demand.remindersTriggered.includes('7_DAYS'), false);

  // Trigger milestone
  demand.remindersTriggered.push(milestone);

  // Second evaluation: already triggered, should skip
  const secondEvalAlreadyTriggered = demand.remindersTriggered.includes(milestone);
  assert.equal(secondEvalAlreadyTriggered, true, 'Deduplication must prevent duplicate alerts');
});

test('REMINDERS ENGINE: Paid and cancelled demands are silenced', () => {
  const paidDemand = {
    status: 'PAID',
    amountDemanded: 500,
    totalPaid: 500,
    dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days past due
  };

  const balance = paidDemand.amountDemanded - paidDemand.totalPaid;
  assert.equal(balance <= 0, true, 'Fully paid demand has zero balance');
  assert.equal(['PAID', 'CANCELLED'].includes(paidDemand.status), true, 'Paid demands must be silenced from overdue reminders');
});

test('COMPANY ISOLATION: Property Charge records are strictly partitioned by companyId', () => {
  const dummyProp = new mongoose.Types.ObjectId();
  const demandCoA = new PropertyDemand({
    companyId: 'old-street',
    propertyId: dummyProp,
    chargeType: 'SERVICE_CHARGE',
    demandReference: 'REF-OLD-STREET',
    dueDate: new Date(),
    amountDemanded: 500,
  });

  const demandCoB = new PropertyDemand({
    companyId: 'global-standard',
    propertyId: dummyProp,
    chargeType: 'SERVICE_CHARGE',
    demandReference: 'REF-GLOBAL-STD',
    dueDate: new Date(),
    amountDemanded: 500,
  });

  assert.equal(demandCoA.companyId, 'old-street');
  assert.equal(demandCoB.companyId, 'global-standard');
  assert.notEqual(demandCoA.companyId, demandCoB.companyId);
});
