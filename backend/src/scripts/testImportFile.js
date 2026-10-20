import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import mongoose from 'mongoose';
import { parseStatementBuffer, classifyAndMatchRows } from '../services/statementImportService.js';
import Account from '../models/Account.js';

async function testFullClassification() {
  await mongoose.connect(process.env.MONGO_URI);
  const companyId = 'old-street';

  const account = await Account.findOne({ companyId, name: /operating|main|current/i }).lean();
  if (!account) throw new Error('Account not found');

  const fileBuffer = fs.readFileSync('C:/Users/HP/Desktop/Bank statment of company.xlsx');
  const filename = 'Bank statment of company.xlsx';

  console.log('[Test] Parsing statement buffer...');
  const parsed = await parseStatementBuffer(fileBuffer, filename, {});
  console.log('[Test] Total parsed rows from Excel:', parsed.parsedRows.length);
  console.log('[Test] Detected Mapping:', parsed.detectedMapping);

  console.log('[Test] Running classifyAndMatchRows with Property & Unit engine...');
  const classified = await classifyAndMatchRows(companyId, account._id, parsed.parsedRows);
  console.log('[Test] Total classified rows:', classified.length);

  const statusCounts = {};
  const typeCounts = {};
  let propAssignedCount = 0;
  let unitAssignedCount = 0;

  classified.forEach(r => {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    typeCounts[r.suggestedType] = (typeCounts[r.suggestedType] || 0) + 1;
    if (r.suggestedPropertyId) propAssignedCount++;
    if (r.suggestedUnitId) unitAssignedCount++;
  });

  console.log('[Test] Status breakdown:', statusCounts);
  console.log('[Test] Type breakdown:', typeCounts);
  console.log('[Test] Property assigned count:', propAssignedCount);
  console.log('[Test] Unit assigned count:', unitAssignedCount);

  // Check sample rent rows with unit
  const rentWithUnits = classified.filter(r => r.suggestedType === 'RENT');
  console.log(`\nSample RENT rows (${rentWithUnits.length} total):`);
  console.log(JSON.stringify(rentWithUnits.slice(0, 8).map(r => ({
    memo: r.description,
    head: r.head,
    subHead: r.subHead,
    prop: r.suggestedPropertyName,
    unit: r.suggestedUnitName,
    type: r.suggestedType,
  })), null, 2));

  // Check sample interest rows
  const interestRows = classified.filter(r => r.suggestedType === 'MORTGAGE_PAYMENT');
  console.log(`\nSample INTEREST rows (${interestRows.length} total):`);
  console.log(JSON.stringify(interestRows.slice(0, 5).map(r => ({
    memo: r.description,
    head: r.head,
    subHead: r.subHead,
    prop: r.suggestedPropertyName,
    unit: r.suggestedUnitName || 'NONE (Whole Property)',
  })), null, 2));

  // Check sample loan rows
  const loanRows = classified.filter(r => r.suggestedType === 'LOAN');
  console.log(`\nSample LOAN rows (${loanRows.length} total):`);
  console.log(JSON.stringify(loanRows.slice(0, 5).map(r => ({
    memo: r.description,
    head: r.head,
    subHead: r.subHead,
    prop: r.suggestedPropertyName || 'NONE (Company)',
    unit: r.suggestedUnitName || 'NONE',
    direction: r.direction,
    amount: r.amount,
  })), null, 2));

  await mongoose.disconnect();
}

testFullClassification().catch(console.error);
