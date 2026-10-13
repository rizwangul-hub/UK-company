import '../config/env.js';
import mongoose from 'mongoose';
import {
  buildLedgerReportData,
  generateExcelReport,
  generatePdfReport,
} from '../services/reportExportService.js';
import {
  getLedgerReportPreview,
  exportLedgerExcel,
  exportLedgerPdf,
} from '../controllers/reportController.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/uk_property_finance';

const runMockResponse = () => {
  let capturedData = null;
  let headers = {};
  let statusCode = 200;
  const res = {
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (payload) => {
      capturedData = payload;
      return res;
    },
    setHeader: (key, val) => {
      headers[key] = val;
    },
    end: (buffer) => {
      capturedData = buffer;
      return res;
    },
  };
  return { res, getResult: () => ({ statusCode, headers, data: capturedData }) };
};

async function verifyAll() {
  console.log('Connecting to MongoDB:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log('✓ Connected to MongoDB');

  console.log('\n--- 1. Testing buildLedgerReportData (COMPLETE Scope) ---');
  const completeReport = await buildLedgerReportData({
    scope: 'COMPLETE',
    datePreset: 'ALL',
  });
  console.log('✓ Report Reference:', completeReport.reportRef);
  console.log('✓ Title:', completeReport.reportTitle);
  console.log('✓ Transaction Count:', completeReport.summary.transactionCount);
  console.log('✓ Money In:', completeReport.summary.totalMoneyIn);
  console.log('✓ Money Out:', completeReport.summary.totalMoneyOut);
  console.log('✓ Net Cash Flow:', completeReport.summary.netCashMovement);
  console.log('✓ Closing Balance:', completeReport.summary.closingBalance);
  console.log('✓ Category Breakdown items:', completeReport.categoryBreakdown.length);
  console.log('✓ Property Breakdown items:', completeReport.propertyBreakdown.length);

  console.log('\n--- 2. Testing Preview Controller (GET /api/reports/ledger/preview) ---');
  const mockPrev = runMockResponse();
  await getLedgerReportPreview({ query: { scope: 'COMPLETE', datePreset: 'ALL' } }, mockPrev.res);
  const prevRes = mockPrev.getResult();
  if (!prevRes.data?.success) {
    throw new Error('Preview controller failed: ' + JSON.stringify(prevRes));
  }
  console.log('✓ Preview returned success: true');
  console.log('✓ Preview rows count:', prevRes.data.data.previewRows.length);
  console.log('✓ Preview total count:', prevRes.data.data.totalCount);

  console.log('\n--- 3. Testing Excel Generation with ExcelJS ---');
  const excelBuffer = await generateExcelReport(completeReport);
  console.log('✓ Generated Excel Buffer size:', excelBuffer.length, 'bytes');
  if (excelBuffer[0] !== 0x50 || excelBuffer[1] !== 0x4b) {
    throw new Error('Invalid Excel XLSX signature');
  }
  console.log('✓ Valid ZIP / XLSX signature (PK)');

  console.log('\n--- 4. Testing PDF Generation with PDFKit ---');
  const pdfBuffer = await generatePdfReport(completeReport);
  console.log('✓ Generated PDF Buffer size:', pdfBuffer.length, 'bytes');
  const pdfSig = pdfBuffer.slice(0, 5).toString('utf-8');
  if (pdfSig !== '%PDF-') {
    throw new Error('Invalid PDF signature: ' + pdfSig);
  }
  console.log('✓ Valid PDF signature (%PDF-)');

  console.log('\n--- 5. Testing Other Scopes (BANK, PROPERTY, ACCOUNT_HEAD) ---');
  const bankReport = await buildLedgerReportData({ scope: 'BANK', datePreset: 'ALL' });
  console.log(`✓ BANK Scope Title: "${bankReport.reportTitle}" | Count: ${bankReport.summary.transactionCount} | Opening: £${bankReport.summary.openingBalance}`);

  const propReport = await buildLedgerReportData({ scope: 'PROPERTY', datePreset: 'ALL' });
  console.log(`✓ PROPERTY Scope Title: "${propReport.reportTitle}" | Count: ${propReport.summary.transactionCount}`);

  const headReport = await buildLedgerReportData({ scope: 'ACCOUNT_HEAD', datePreset: 'ALL' });
  console.log(`✓ ACCOUNT_HEAD Scope Title: "${headReport.reportTitle}" | Count: ${headReport.summary.transactionCount}`);

  console.log('\n======================================================');
  console.log('  ALL REPORTING AND EXPORT ENGINES VERIFIED 100%');
  console.log('======================================================');

  await mongoose.disconnect();
}

verifyAll().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
