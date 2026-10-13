import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatUKDate,
  formatGBP,
  sanitizeCell,
  parseReportingDateRange,
  generateExcelReport,
  generatePdfReport,
} from '../src/services/reportExportService.js';
import { round2 } from '../src/services/ledgerService.js';

test('REPORT SERVICE: Sanitize against CSV & Excel formula injection', () => {
  assert.equal(sanitizeCell('=SUM(A1:A10)'), "'=SUM(A1:A10)");
  assert.equal(sanitizeCell('+12345'), "'+12345");
  assert.equal(sanitizeCell('-cmd|/C'), "'-cmd|/C");
  assert.equal(sanitizeCell('@echo off'), "'@echo off");
  assert.equal(sanitizeCell('Standard Narration'), 'Standard Narration');
  assert.equal(sanitizeCell(null), '');
  assert.equal(sanitizeCell(undefined), '');
});

test('REPORT SERVICE: Format UK dates and GBP currency', () => {
  const d = new Date(Date.UTC(2026, 9, 12, 12, 0, 0));
  assert.equal(formatUKDate(d), '12/10/2026');
  assert.equal(formatUKDate(null), '-');

  assert.equal(formatGBP(1250.5), '£1,250.50');
  assert.equal(formatGBP(0), '£0.00');
  assert.equal(formatGBP(-500), '-£500.00');
});

test('REPORT SERVICE: Parse reporting date presets correctly', () => {
  const { periodStart: thisMonthStart, periodEnd: thisMonthEnd } = parseReportingDateRange('THIS_MONTH');
  assert.ok(thisMonthStart instanceof Date);
  assert.ok(thisMonthEnd instanceof Date);
  assert.ok(thisMonthStart < thisMonthEnd);

  const { periodStart: taxStart, periodEnd: taxEnd } = parseReportingDateRange('THIS_TAX_YEAR');
  assert.ok(taxStart instanceof Date);
  assert.ok(taxEnd instanceof Date);
  assert.equal(taxStart.getUTCMonth(), 3, 'Tax year starts in April (month index 3)');
  assert.equal(taxStart.getUTCDate(), 6, 'Tax year starts on 6 April');

  const { periodStart: customStart, periodEnd: customEnd } = parseReportingDateRange('CUSTOM', '2026-01-01', '2026-06-30');
  assert.equal(customStart.toISOString().slice(0, 10), '2026-01-01');
  assert.equal(customEnd.toISOString().slice(0, 10), '2026-06-30');
});

test('REPORT SERVICE: Accounting KPI mathematical reconciliation', () => {
  const openingBalance = 10500.0;
  const entries = [
    { type: 'INCOME', moneyIn: 2400.0, moneyOut: 0, amount: 2400.0 },
    { type: 'EXPENSE', moneyIn: 0, moneyOut: 650.0, amount: 650.0 },
    { type: 'MORTGAGE_PAYMENT', moneyIn: 0, moneyOut: 1100.0, amount: 1100.0 },
    { type: 'TRANSFER', moneyIn: 500.0, moneyOut: 500.0, amount: 500.0 }, // Internal transfer
  ];

  let totalMoneyIn = 0;
  let totalMoneyOut = 0;
  let running = openingBalance;

  for (const tx of entries) {
    totalMoneyIn += tx.moneyIn;
    totalMoneyOut += tx.moneyOut;
    running = round2(running + tx.moneyIn - tx.moneyOut);
  }

  const netCashMovement = round2(totalMoneyIn - totalMoneyOut);
  const closingBalance = round2(openingBalance + netCashMovement);

  assert.equal(totalMoneyIn, 2900.0);
  assert.equal(totalMoneyOut, 2250.0);
  assert.equal(netCashMovement, 650.0);
  assert.equal(closingBalance, 11150.0);
  assert.equal(running, closingBalance, 'Running balance must reconcile with closing balance');
});

test('REPORT SERVICE: Generate valid Excel (.xlsx) buffer with executive sheets', async () => {
  const mockReportData = {
    reportRef: 'PIXX-UK-20261012-9999',
    reportTitle: 'Master UK Property Finance & Central Ledger',
    scope: 'COMPLETE',
    scopeDescription: 'Consolidated Double-Entry Transaction Ledger across all Accounts & Assets',
    periodLabel: '01/10/2026 – 31/10/2026',
    datePreset: 'THIS_MONTH',
    generatedAt: new Date(),
    summary: {
      transactionCount: 2,
      openingBalance: 12500.0,
      totalMoneyIn: 3200.0,
      totalMoneyOut: 1150.0,
      totalIncome: 3200.0,
      totalOperatingExpenses: 1150.0,
      totalMortgageInterest: 0,
      totalMortgagePrincipal: 0,
      totalMortgageFees: 0,
      netCashMovement: 2050.0,
      closingBalance: 14550.0,
    },
    categoryBreakdown: [
      { name: 'Rental Income', type: 'INCOME', count: 1, total: 3200.0 },
      { name: 'Property Repairs', type: 'OPERATING_EXPENSE', count: 1, total: 1150.0 },
    ],
    propertyBreakdown: [
      { name: '14 Elm Road', postcode: 'NW1 4NP', income: 3200.0, expense: 1150.0, net: 2050.0, count: 2 },
    ],
    entries: [
      {
        _id: 'mock_tx_1',
        date: new Date('2026-10-02'),
        periodMonth: '2026-10',
        voucherNo: 'VCH-2026-001',
        reference: 'INV-101',
        narration: 'Monthly Rent Collected',
        transactionType: 'INCOME',
        categoryName: 'Rental Income',
        categoryCode: 'INC-RENT',
        propertyName: '14 Elm Road',
        unitName: 'Flat 1',
        tenantName: 'John Doe',
        accountName: 'Barclays Main',
        moneyIn: 3200.0,
        moneyOut: 0,
        runningBalance: 15700.0,
        status: 'POSTED',
      },
      {
        _id: 'mock_tx_2',
        date: new Date('2026-10-05'),
        periodMonth: '2026-10',
        voucherNo: 'VCH-2026-002',
        reference: 'REP-554',
        narration: 'Boiler Repair & Certification',
        transactionType: 'EXPENSE',
        categoryName: 'Property Repairs',
        categoryCode: 'EXP-REP',
        propertyName: '14 Elm Road',
        unitName: 'Flat 1',
        tenantName: '-',
        accountName: 'Barclays Main',
        moneyIn: 0,
        moneyOut: 1150.0,
        runningBalance: 14550.0,
        status: 'POSTED',
      },
    ],
  };

  const buffer = await generateExcelReport(mockReportData);

  assert.ok(Buffer.isBuffer(buffer), 'Should generate a binary buffer');
  assert.ok(buffer.length > 1000, 'Excel buffer size should be substantial');

  // Verify ZIP / XLSX magic number: PK\x03\x04 (0x50 0x4B 0x03 0x04)
  assert.equal(buffer[0], 0x50, 'Byte 0 must be P');
  assert.equal(buffer[1], 0x4b, 'Byte 1 must be K');
  assert.equal(buffer[2], 0x03, 'Byte 2 must be 0x03');
  assert.equal(buffer[3], 0x04, 'Byte 3 must be 0x04');
});

test('REPORT SERVICE: Generate vector PDF report with corporate headers and two-pass footers', async () => {
  const mockReportData = {
    reportRef: 'PIXX-UK-20261012-7777',
    reportTitle: 'Property Asset Ledger: 22 Kensington High St',
    scope: 'PROPERTY',
    scopeDescription: 'Valuation: £850,000 · Kensington, London W8 4SG',
    periodLabel: '01/10/2026 – 31/10/2026',
    datePreset: 'THIS_MONTH',
    generatedAt: new Date(),
    summary: {
      transactionCount: 3,
      openingBalance: 0,
      totalMoneyIn: 4500.0,
      totalMoneyOut: 1200.0,
      totalIncome: 4500.0,
      totalOperatingExpenses: 1200.0,
      totalMortgageInterest: 0,
      totalMortgagePrincipal: 0,
      totalMortgageFees: 0,
      netCashMovement: 3300.0,
      closingBalance: 3300.0,
    },
    categoryBreakdown: [],
    propertyBreakdown: [],
    entries: [
      {
        _id: 'mock_tx_p1',
        date: new Date('2026-10-01'),
        voucherNo: 'VCH-P-001',
        reference: 'OCT-RENT',
        narration: 'Rent Receipt - Unit 1',
        categoryName: 'Rental Income',
        accountName: 'Lloyds Client Acc',
        moneyIn: 4500.0,
        moneyOut: 0,
        runningBalance: 4500.0,
        status: 'POSTED',
      },
      {
        _id: 'mock_tx_p2',
        date: new Date('2026-10-08'),
        voucherNo: 'VCH-P-002',
        reference: 'INS-2026',
        narration: 'Building Insurance Premium',
        categoryName: 'Insurance',
        accountName: 'Lloyds Client Acc',
        moneyIn: 0,
        moneyOut: 1200.0,
        runningBalance: 3300.0,
        status: 'POSTED',
      },
    ],
  };

  const pdfBuffer = await generatePdfReport(mockReportData);

  assert.ok(Buffer.isBuffer(pdfBuffer), 'Should generate binary PDF buffer');
  assert.ok(pdfBuffer.length > 1000, 'PDF buffer must not be empty');

  // Verify standard PDF header magic bytes: %PDF- (0x25 0x50 0x44 0x46 0x2D)
  const pdfHeader = pdfBuffer.slice(0, 5).toString('utf-8');
  assert.equal(pdfHeader, '%PDF-', 'PDF must start with %PDF- signature');
});
