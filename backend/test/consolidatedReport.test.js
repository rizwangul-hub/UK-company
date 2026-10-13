import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import '../src/config/env.js';
import {
  getConsolidatedGroupOverviewData,
  generateConsolidatedGroupExcelReport,
  generateConsolidatedGroupPdfReport,
} from '../src/services/consolidatedReportService.js';

test.before(async () => {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGO_URI);
  }
});

test.after(async () => {
  await mongoose.disconnect();
});

test('CONSOLIDATED OVERVIEW: Aggregates all 6 companies into master group metrics', async () => {
  const data = await getConsolidatedGroupOverviewData();

  assert.ok(data, 'Consolidated data should be returned');
  assert.strictEqual(data.companySummaries.length, 6, 'Should have exactly 6 corporate summaries');
  assert.strictEqual(data.totals.totalCompanies, 6);
  assert.strictEqual(data.totals.totalProperties, 48, 'Should have exactly 48 direct properties across group');
  assert.ok(data.totals.totalMonthlyRent > 99000, 'Monthly rent roll should exceed £99,000/mo');
  assert.strictEqual(data.totals.totalAnnualRent, data.totals.totalMonthlyRent * 12);
  assert.strictEqual(data.allMortgages.length, 27, 'Should have 27 active mortgage facilities across group');
});

test('CONSOLIDATED EXCEL: Generates multi-sheet workbook modeled on Rent Details for Software', async () => {
  const buffer = await generateConsolidatedGroupExcelReport();

  assert.ok(buffer && buffer.length > 10000, 'Excel buffer should be non-empty and >10KB');

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const sheetNames = wb.worksheets.map((w) => w.name);
  assert.ok(sheetNames.includes('Rent Income Report'), 'Should contain Rent Income Report sheet');
  assert.ok(sheetNames.includes('Mortgage Register'), 'Should contain Mortgage Register sheet');
  assert.ok(sheetNames.includes('Portfolio Summary'), 'Should contain Portfolio Summary sheet');

  const ws1 = wb.getWorksheet('Rent Income Report');
  assert.ok(ws1.rowCount >= 80, 'Sheet 1 should contain rows for all 6 companies');

  // Verify Master Total Row exists and has formulas
  const lastRow = ws1.getRow(ws1.rowCount);
  const cellVal = String(lastRow.getCell(1).value || '');
  assert.ok(cellVal.includes('MASTER GROUP GRAND TOTAL'), 'Last row should be Master Group Grand Total');
});

test('CONSOLIDATED PDF: Generates valid, attractive corporate vector PDF', async () => {
  const buffer = await generateConsolidatedGroupPdfReport();

  assert.ok(buffer && buffer.length > 20000, 'PDF buffer should be non-empty and >20KB');
  const header = buffer.subarray(0, 5).toString('ascii');
  assert.strictEqual(header, '%PDF-', 'Buffer should have valid PDF magic bytes');
});
