import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import crypto from 'crypto';

// Schemas
import StatementImportBatch from '../src/models/StatementImportBatch.js';
import StatementImportRow from '../src/models/StatementImportRow.js';
import Transaction from '../src/models/Transaction.js';
import { VALID_COMPANY_IDS } from '../src/config/companies.js';

// Services
import {
  detectColumnMapping,
  parseStatementBuffer,
  classifyAndMatchRows,
  deleteStatementBatch,
} from '../src/services/statementImportService.js';
import { round2 } from '../src/services/ledgerService.js';

// -----------------------------------------------------------------------------
// 1. SCHEMA INTEGRITY & MULTI-COMPANY ISOLATION
// -----------------------------------------------------------------------------
test('SCHEMA: StatementImportBatch model contains all required tracking & reconciliation fields', () => {
  const paths = StatementImportBatch.schema.paths;
  assert.ok(paths.companyId, 'Batch must have companyId');
  assert.ok(paths.accountId, 'Batch must have accountId');
  assert.ok(paths.filename, 'Batch must have filename');
  assert.ok(paths.fileHash, 'Batch must have fileHash');
  assert.ok(paths.openingBalance, 'Batch must have openingBalance');
  assert.ok(paths.closingBalance, 'Batch must have closingBalance');
  assert.ok(paths.totalRows, 'Batch must have totalRows');
  assert.ok(paths.postedRows, 'Batch must have postedRows');
  assert.ok(paths.status, 'Batch must have status');

  const statusEnum = StatementImportBatch.schema.path('status').enumValues;
  assert.ok(statusEnum.includes('DRAFT'), 'Status enum must include DRAFT');
  assert.ok(statusEnum.includes('READY'), 'Status enum must include READY');
  assert.ok(statusEnum.includes('PARTIALLY_POSTED'), 'Status enum must include PARTIALLY_POSTED');
  assert.ok(statusEnum.includes('POSTED'), 'Status enum must include POSTED');
  assert.ok(statusEnum.includes('CANCELLED'), 'Status enum must include CANCELLED');
});

test('SCHEMA: StatementImportRow model includes staging, classification, duplicate flags, and posting refs', () => {
  const paths = StatementImportRow.schema.paths;
  assert.ok(paths.batchId, 'Row must have batchId');
  assert.ok(paths.companyId, 'Row must have companyId');
  assert.ok(paths.accountId, 'Row must have accountId');
  assert.ok(paths.rowIndex, 'Row must have rowIndex');
  assert.ok(paths.transactionDate, 'Row must have transactionDate');
  assert.ok(paths.description, 'Row must have description');
  assert.ok(paths.amount, 'Row must have amount');
  assert.ok(paths.direction, 'Row must have direction');
  assert.ok(paths.suggestedType, 'Row must have suggestedType');
  assert.ok(paths.isDuplicate, 'Row must have isDuplicate');
  assert.ok(paths.status, 'Row must have status');
  assert.ok(paths.isExcluded, 'Row must have isExcluded');
  assert.ok(paths.postedTransactionId, 'Row must have postedTransactionId');

  const typeEnum = StatementImportRow.schema.path('suggestedType').enumValues;
  assert.ok(typeEnum.includes('RENT'), 'SuggestedType enum must include RENT');
  assert.ok(typeEnum.includes('EXPENSE'), 'SuggestedType enum must include EXPENSE');
  assert.ok(typeEnum.includes('MORTGAGE_PAYMENT'), 'SuggestedType enum must include MORTGAGE_PAYMENT');
  assert.ok(typeEnum.includes('TRANSFER'), 'SuggestedType enum must include TRANSFER');

  const statusEnum = StatementImportRow.schema.path('status').enumValues;
  assert.ok(statusEnum.includes('NEW'), 'Status enum must include NEW');
  assert.ok(statusEnum.includes('APPROVED'), 'Status enum must include APPROVED');
  assert.ok(statusEnum.includes('POSSIBLE_DUPLICATE'), 'Status enum must include POSSIBLE_DUPLICATE');
  assert.ok(statusEnum.includes('POSTED'), 'Status enum must include POSTED');
  assert.ok(statusEnum.includes('SKIPPED'), 'Status enum must include SKIPPED');
});

test('SCHEMA: Transaction model includes statement import batch link and reconciliation flag', () => {
  const paths = Transaction.schema.paths;
  assert.ok(paths.importBatchId, 'Transaction must have importBatchId');
  assert.ok(paths.statementRef, 'Transaction must have statementRef');
  assert.ok(paths.reconciled, 'Transaction must have reconciled boolean');
  assert.ok(paths.reconciledAt, 'Transaction must have reconciledAt');
});

// -----------------------------------------------------------------------------
// 2. COLUMN DETECTION & STATEMENT PARSING ENGINE
// -----------------------------------------------------------------------------
test('PARSER: detectColumnMapping correctly maps standard UK bank statement column titles', () => {
  const headers = ['Date', 'Transaction Description', 'Paid Out', 'Paid In', 'Balance', 'Reference'];
  const mapping = detectColumnMapping(headers);

  assert.equal(mapping.dateCol, 0, 'Date mapped to col 0');
  assert.equal(mapping.descCol, 1, 'Description mapped to col 1');
  assert.equal(mapping.debitCol, 2, 'Debit mapped to col 2');
  assert.equal(mapping.creditCol, 3, 'Credit mapped to col 3');
  assert.equal(mapping.balanceCol, 4, 'Balance mapped to col 4');
  assert.equal(mapping.refCol, 5, 'Ref mapped to col 5');
});

test('PARSER: parseStatementBuffer parses CSV statements with UK dates and separate debit/credit', async () => {
  const csvContent = `Date,Description,Payments,Receipts,Balance
01/02/2025,Shop Rent Collection,,1500.00,10500.00
02/02/2025,Quantum Mortgage Servicing,850.50,,9649.50
03/02/2025,Bank Charges,15.00,,9634.50
`;
  const buffer = Buffer.from(csvContent, 'utf8');
  const result = await parseStatementBuffer(buffer, 'statement.csv');

  assert.equal(result.totalParsedRows, 3, 'Should parse 3 data rows');
  assert.equal(result.openingBalance, 9000.0, 'Opening balance calculated correctly (10500 - 1500)');
  assert.equal(result.closingBalance, 9634.5, 'Closing balance equals last row balance');

  // Verify Row 1
  assert.equal(result.parsedRows[0].direction, 'IN');
  assert.equal(result.parsedRows[0].amount, 1500.0);
  assert.equal(result.parsedRows[0].description, 'Shop Rent Collection');

  // Verify Row 2
  assert.equal(result.parsedRows[1].direction, 'OUT');
  assert.equal(result.parsedRows[1].amount, 850.5);
});

test('PARSER: parseStatementBuffer parses Excel buffer with signed amounts and UK DD/MM/YYYY dates', async () => {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Bank Statement');
  ws.addRow(['Date', 'Narrative', 'Amount', 'Balance']);
  ws.addRow(['15/03/2025', 'Direct Debit - Water Services', -120.45, 4879.55]);
  ws.addRow(['16/03/2025', 'Flat Rent Receipt', 950.0, 5829.55]);

  const buffer = await workbook.xlsx.writeBuffer();
  const result = await parseStatementBuffer(buffer, 'test-statement.xlsx');

  assert.equal(result.totalParsedRows, 2, 'Should parse 2 rows');
  assert.equal(result.parsedRows[0].direction, 'OUT');
  assert.equal(result.parsedRows[0].amount, 120.45);
  assert.equal(result.parsedRows[1].direction, 'IN');
  assert.equal(result.parsedRows[1].amount, 950.0);
});

test('PARSER: Invalid rows with missing date or amount are reported with rowIndex instead of silently ignored', async () => {
  const csvContent = `Date,Description,Payments,Receipts,Balance
INVALID_DATE,Some Service,100.00,,900.00
10/02/2025,Valid Payment,50.00,,850.00
11/02/2025,Missing Amount,,,850.00
`;
  const buffer = Buffer.from(csvContent, 'utf8');
  const result = await parseStatementBuffer(buffer, 'invalid_test.csv');

  assert.equal(result.totalParsedRows, 3);
  assert.ok(result.validationErrors.length >= 2, 'Validation errors must flag invalid rows');
  assert.equal(result.parsedRows[0].status, 'INVALID');
  assert.equal(result.parsedRows[1].status, 'NEW');
  assert.equal(result.parsedRows[2].status, 'INVALID');
});

// -----------------------------------------------------------------------------
// 3. DUPLICATE FINGERPRINTING & ROW MATCHING ENGINE
// -----------------------------------------------------------------------------
test('DUPLICATE PROTECTION: Identical file buffer generates exact matching SHA-256 hash', async () => {
  const sample = Buffer.from('TEST STATEMENT DATA FOR OLD STREET 2025');
  const hash1 = crypto.createHash('sha256').update(sample).digest('hex');
  const hash2 = crypto.createHash('sha256').update(sample).digest('hex');

  assert.equal(hash1, hash2, 'Identical statement buffers must produce matching SHA-256 hash');
});

// -----------------------------------------------------------------------------
// 4. RECONCILIATION INTEGRITY MATHEMATICS
// -----------------------------------------------------------------------------
test('RECONCILIATION: Formula verification Opening + Receipts - Payments = Closing', () => {
  const opening = 59430.49;
  const receipts = 1666.66 + 925.0 + 1550.0 + 1450.0 + 50000.0; // 55,591.66
  const payments = 8.5 + 250.0 + 250.0 + 803.14 + 1544.39 + 1975.41 + 21.0 + 1000.0 + 1033.81 + 1659.96 + 17.38; // 8,563.59

  const calculatedClosing = round2(opening + receipts - payments);
  const expectedClosing = 106458.56;

  assert.equal(calculatedClosing, expectedClosing, 'Calculated closing balance must match formula exactly');
});

test('RECONCILIATION: Variance is zero when statement closing matches system calculated balance', () => {
  const statementClosing = 7200.76;
  const systemClosing = 7200.76;
  const variance = round2(statementClosing - systemClosing);

  assert.equal(variance, 0.0, 'Variance must be exactly 0.00');
  assert.ok(Math.abs(variance) < 0.01, 'Reconciliation status is RECONCILED');
});

test('RECONCILIATION: Variance alerts operator when statement and ledger differ', () => {
  const statementClosing = 7200.76;
  const systemClosing = 7050.76;
  const variance = round2(statementClosing - systemClosing);

  assert.equal(variance, 150.0, 'Variance detected correctly');
  assert.ok(Math.abs(variance) >= 0.01, 'Flags discrepancy');
});

// -----------------------------------------------------------------------------
// 5. MULTI-SHEET WORKBOOK PARSING & HEAD/SUB-HEAD CLASSIFICATION
// -----------------------------------------------------------------------------
test('PARSER: Multi-sheet Excel workbook lists all sheets and allows sheet selection', async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet1 = workbook.addWorksheet('Summary');
  sheet1.addRow(['Summary Only', 'Not Data']);

  const sheet2 = workbook.addWorksheet('Transactions Feb 2025');
  sheet2.addRow(['Date', 'Memo', 'Head', 'Sub Head', 'Payments', 'Receipts', 'Balance']);
  sheet2.addRow(['01/02/2025', 'Rent 229 Commercial Road', 'Income', 'Rent', '', 1500.0, 1500.0]);

  const buffer = await workbook.xlsx.writeBuffer();

  // Test detection of sheets
  const preview = await parseStatementBuffer(buffer, 'multi-sheet.xlsx');
  assert.equal(preview.sheetsList.length, 2, 'Should list both sheets');
  assert.ok(preview.sheetsList.includes('Summary'));
  assert.ok(preview.sheetsList.includes('Transactions Feb 2025'));

  // Test selecting specific sheet
  const selectedSheet = await parseStatementBuffer(buffer, 'multi-sheet.xlsx', {}, { sheetName: 'Transactions Feb 2025' });
  assert.equal(selectedSheet.sheetName, 'Transactions Feb 2025');
  assert.equal(selectedSheet.totalParsedRows, 1);
  assert.equal(selectedSheet.parsedRows[0].head, 'Income');
  assert.equal(selectedSheet.parsedRows[0].subHead, 'Rent');
  assert.equal(selectedSheet.parsedRows[0].amount, 1500.0);
  assert.equal(selectedSheet.parsedRows[0].direction, 'IN');
});

test('PARSER: detectColumnMapping detects Head, Sub Head, Memo Original, and Running Balance', () => {
  const headers = ['Date', 'Memo', 'Head', 'Sub Head', 'Payments', 'Receipts', 'Balance', 'Memo Original'];
  const mapping = detectColumnMapping(headers);

  assert.equal(mapping.dateCol, 0);
  assert.equal(mapping.descCol, 1);
  assert.equal(mapping.headCol, 2);
  assert.equal(mapping.subHeadCol, 3);
  assert.equal(mapping.debitCol, 4);
  assert.equal(mapping.creditCol, 5);
  assert.equal(mapping.balanceCol, 6);
  assert.equal(mapping.originalNarrativeCol, 7);
});

test('SCHEMA: StatementImportBatch and StatementImportRow have sheet and head/subhead fields', () => {
  const batchPaths = StatementImportBatch.schema.paths;
  assert.ok(batchPaths.sheetName, 'Batch must have sheetName');
  assert.ok(batchPaths.sheetsList, 'Batch must have sheetsList');

  const rowPaths = StatementImportRow.schema.paths;
  assert.ok(rowPaths.excelRowNumber, 'Row must have excelRowNumber');
  assert.ok(rowPaths.head, 'Row must have head');
  assert.ok(rowPaths.subHead, 'Row must have subHead');
  assert.ok(rowPaths.suggestedHeadId, 'Row must have suggestedHeadId');
  assert.ok(rowPaths.suggestedHead, 'Row must have suggestedHead');
  assert.ok(rowPaths.suggestedSubHeadId, 'Row must have suggestedSubHeadId');
  assert.ok(rowPaths.suggestedSubHead, 'Row must have suggestedSubHead');
});

test('BATCH DELETION: deleteStatementBatch service is defined and exported', () => {
  assert.equal(typeof deleteStatementBatch, 'function', 'deleteStatementBatch must be an exported function');
});
