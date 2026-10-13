import '../config/env.js';
import mongoose from 'mongoose';
import { getLedgerEntities, queryEntityLedger } from '../controllers/ledgerController.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/uk_property_finance';

const runMockResponse = () => {
  let capturedData = null;
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
  };
  return { res, getResult: () => ({ statusCode, data: capturedData }) };
};

async function run() {
  console.log('Connecting to database:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log('✓ Connected to MongoDB');

  // 1. Test getLedgerEntities
  const mockEnt = runMockResponse();
  await getLedgerEntities({}, mockEnt.res);
  const entRes = mockEnt.getResult();
  console.log('\n--- 1. Testing getLedgerEntities ---');
  if (!entRes.data?.success) {
    throw new Error('getLedgerEntities failed: ' + JSON.stringify(entRes));
  }
  const buckets = entRes.data.data;
  console.log('✓ Found bank accounts:', buckets.bankAccounts.length);
  console.log('✓ Found cash accounts:', buckets.cashAccounts.length);
  console.log('✓ Found properties:', buckets.properties.length);
  console.log('✓ Found tenants:', buckets.tenants.length);
  console.log('✓ Found mortgages:', buckets.mortgages.length);
  console.log('✓ Found expense heads:', buckets.expenseHeads.length);
  console.log('✓ Found income heads:', buckets.incomeHeads.length);

  // 2. Test querying each ledger type
  const testTypes = [
    { type: 'BANK', entityId: buckets.bankAccounts[0]?.id },
    { type: 'CASH', entityId: buckets.cashAccounts[0]?.id },
    { type: 'PROPERTY', entityId: buckets.properties[0]?.id },
    { type: 'TENANT', entityId: buckets.tenants[0]?.id },
    { type: 'MORTGAGE', entityId: buckets.mortgages[0]?.id },
    { type: 'ACCOUNT_HEAD', entityId: buckets.expenseHeads[0]?.id },
    { type: 'RENT', entityId: null },
    { type: 'OTHER_INCOME', entityId: null },
    { type: 'CONSOLIDATED', entityId: null },
  ];

  console.log('\n--- 2. Testing queryEntityLedger across all 9 ledger types ---');
  for (const t of testTypes) {
    const mock = runMockResponse();
    await queryEntityLedger(
      {
        query: {
          type: t.type,
          entityId: t.entityId,
          datePreset: 'ALL',
        },
      },
      mock.res
    );
    const result = mock.getResult();
    if (!result.data?.success) {
      console.error(`✗ Error on type ${t.type}:`, result);
      throw new Error(`Query failed for ${t.type}`);
    }
    const d = result.data.data;
    console.log(
      `✓ [${t.type}] Title: "${d.ledgerTitle}" | Entries: ${d.summary.entryCount} | Open: £${d.summary.openingBalance} | In/Dr: £${d.summary.totalDebit} | Out/Cr: £${d.summary.totalCredit} | Close: £${d.summary.closingBalance}`
    );
  }

  console.log('\n======================================================');
  console.log('  ALL 9 UK DEDICATED ENTITY LEDGER TESTS PASSED (100%)');
  console.log('======================================================');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
