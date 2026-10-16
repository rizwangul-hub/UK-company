import crypto from 'crypto';
import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import StatementImportBatch from '../models/StatementImportBatch.js';
import StatementImportRow from '../models/StatementImportRow.js';
import Transaction from '../models/Transaction.js';
import Account from '../models/Account.js';
import Property from '../models/Property.js';
import Category from '../models/Category.js';
import Tenant from '../models/Tenant.js';
import Mortgage from '../models/Mortgage.js';
import RentSchedule from '../models/RentSchedule.js';
import RentPayment from '../models/RentPayment.js';
import MortgagePayment from '../models/MortgagePayment.js';
import { postLedgerTransaction, round2 } from './ledgerService.js';

/**
 * Tokenize string into alphanumeric search tokens for fuzzy matching
 */
const normalizeTokens = (str) => {
  if (!str) return [];
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
};

/**
 * Calculate similarity / overlap score between two strings
 */
const calculateTokenOverlap = (textA, textB) => {
  const tokensA = normalizeTokens(textA);
  const tokensB = normalizeTokens(textB);
  if (!tokensA.length || !tokensB.length) return 0;
  let matches = 0;
  for (const tA of tokensA) {
    if (tokensB.some((tB) => tB.includes(tA) || tA.includes(tB))) {
      matches++;
    }
  }
  return matches / Math.min(tokensA.length, tokensB.length);
};

/**
 * Parse date from various formats (Excel Date object, ISO, DD/MM/YYYY, DD-MM-YYYY, or Excel serial)
 */
const parseUKDate = (val) => {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val;
  }
  if (typeof val === 'number') {
    // Excel serial number (1 = 1900-01-01)
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(excelEpoch.getTime() + val * 86400000);
  }
  const str = String(val).trim();
  // Try ISO format
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d;
  }
  // Try UK DD/MM/YYYY or DD-MM-YYYY
  const ukMatch = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (ukMatch) {
    const day = parseInt(ukMatch[1], 10);
    const month = parseInt(ukMatch[2], 10) - 1;
    let year = parseInt(ukMatch[3], 10);
    if (year < 100) year += 2000;
    const d = new Date(Date.UTC(year, month, day));
    if (!isNaN(d.getTime())) return d;
  }
  const fallback = new Date(str);
  return isNaN(fallback.getTime()) ? null : fallback;
};

/**
 * Extract numeric value from Excel cell (handles numbers, strings, and formula results)
 */
const extractNumber = (val) => {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  if (typeof val === 'object' && val.result !== undefined) {
    return extractNumber(val.result);
  }
  const cleaned = String(val).replace(/[£,\s]/g, '').trim();
  if (!cleaned) return null;
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};

/**
 * Parse CSV text buffer with support for quotes and commas
 */
const parseCSVRows = (csvText) => {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const rows = [];
  for (const line of lines) {
    const cells = [];
    let inQuotes = false;
    let currentCell = '';
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') {
          currentCell += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        cells.push(currentCell.trim());
        currentCell = '';
      } else {
        currentCell += c;
      }
    }
    cells.push(currentCell.trim());
    rows.push(cells);
  }
  return rows;
};

/**
 * Auto-detect statement column mappings from header names
 */
export const detectColumnMapping = (headerCells) => {
  const mapping = {
    dateCol: -1,
    descCol: -1,
    originalNarrativeCol: -1,
    headCol: -1,
    subHeadCol: -1,
    debitCol: -1,
    creditCol: -1,
    amountCol: -1,
    balanceCol: -1,
    refCol: -1,
  };

  headerCells.forEach((cell, idx) => {
    if (!cell) return;
    const h = String(cell).toLowerCase().trim();

    if (mapping.dateCol === -1 && /date|posting date|trx date/i.test(h)) {
      mapping.dateCol = idx;
    } else if (h.includes('original') || h.includes('memo original') || h.includes('raw narrative')) {
      mapping.originalNarrativeCol = idx;
    } else if (mapping.descCol === -1 && /memo|description|details|narrative|particulars|payee/i.test(h)) {
      mapping.descCol = idx;
    } else if (mapping.headCol === -1 && /^head$/i.test(h)) {
      mapping.headCol = idx;
    } else if (mapping.subHeadCol === -1 && /sub[\s_-]?head/i.test(h)) {
      mapping.subHeadCol = idx;
    } else if (mapping.debitCol === -1 && /payment|paid out|debit|outflow|dr/i.test(h)) {
      mapping.debitCol = idx;
    } else if (mapping.creditCol === -1 && /receipt|paid in|credit|inflow|cr/i.test(h)) {
      mapping.creditCol = idx;
    } else if (mapping.balanceCol === -1 && /balance|running balance/i.test(h)) {
      mapping.balanceCol = idx;
    } else if (mapping.refCol === -1 && /ref|reference|chq|cheque|type/i.test(h)) {
      mapping.refCol = idx;
    } else if (mapping.amountCol === -1 && /^amount$|^net$|^value$/i.test(h)) {
      mapping.amountCol = idx;
    }
  });

  return mapping;
};

/**
 * Parse an uploaded statement file buffer (Excel .xlsx/.xls or CSV)
 */
export const parseStatementBuffer = async (fileBuffer, filename, customMapping = {}) => {
  const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  const isCSV = filename.toLowerCase().endsWith('.csv');

  let rawRows = [];

  if (isCSV) {
    const text = fileBuffer.toString('utf8');
    rawRows = parseCSVRows(text);
  } else {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer);
    const worksheet = workbook.worksheets.find((ws) => ws.rowCount > 0) || workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('The uploaded Excel spreadsheet contains no visible worksheets or data.');
    }

    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      const rowValues = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        let val = cell.value;
        if (val && typeof val === 'object' && val.result !== undefined) {
          val = val.result;
        }
        rowValues[colNumber - 1] = val;
      });
      rawRows.push({ rowNumber, values: rowValues });
    });
  }

  if (!rawRows.length) {
    throw new Error('The uploaded bank statement file is completely empty.');
  }

  // Find header row (first 15 rows looking for keywords like Date, Memo, Payment, etc.)
  let headerIndex = -1;
  let detectedHeaders = [];
  for (let i = 0; i < Math.min(15, rawRows.length); i++) {
    const rowVals = isCSV ? rawRows[i] : rawRows[i].values;
    const strVals = (rowVals || []).map((v) => (v ? String(v).toLowerCase().trim() : ''));
    const score = strVals.filter((v) =>
      /date|memo|desc|head|payment|receipt|debit|credit|amount|balance|narrative/i.test(v)
    ).length;
    if (score >= 2) {
      headerIndex = i;
      detectedHeaders = (rowVals || []).map((v) => (v ? String(v).trim() : ''));
      break;
    }
  }

  if (headerIndex === -1) {
    // Default to row 0 if no clear header found
    headerIndex = 0;
    detectedHeaders = (isCSV ? rawRows[0] : rawRows[0].values || []).map((v) => (v ? String(v).trim() : ''));
  }

  const autoMapping = detectColumnMapping(detectedHeaders);
  const activeMapping = { ...autoMapping, ...customMapping };

  // Detect opening and closing balances
  let openingBalance = null;
  let closingBalance = null;

  const parsedRows = [];
  const validationErrors = [];

  const dataRows = isCSV ? rawRows.slice(headerIndex + 1) : rawRows.slice(headerIndex + 1);

  let firstValidRowBalance = null;
  let lastValidRowBalance = null;

  dataRows.forEach((rowEntry, idx) => {
    const rowNumber = isCSV ? headerIndex + 2 + idx : rowEntry.rowNumber;
    const cells = isCSV ? rowEntry : rowEntry.values;

    if (!cells || cells.length === 0) return;

    // Check if the entire row is empty
    const hasAnyContent = cells.some((c) => c !== null && c !== undefined && String(c).trim() !== '');
    if (!hasAnyContent) return;

    // Extract Date
    const rawDate = activeMapping.dateCol >= 0 ? cells[activeMapping.dateCol] : null;
    const parsedDate = parseUKDate(rawDate);

    // Extract Description / Narrative
    const primaryDesc = activeMapping.descCol >= 0 && cells[activeMapping.descCol] ? String(cells[activeMapping.descCol]).trim() : '';
    const origNarrative = activeMapping.originalNarrativeCol >= 0 && cells[activeMapping.originalNarrativeCol] ? String(cells[activeMapping.originalNarrativeCol]).trim() : '';
    const headText = activeMapping.headCol >= 0 && cells[activeMapping.headCol] ? String(cells[activeMapping.headCol]).trim() : '';
    const subHeadText = activeMapping.subHeadCol >= 0 && cells[activeMapping.subHeadCol] ? String(cells[activeMapping.subHeadCol]).trim() : '';

    const description = primaryDesc || origNarrative || [headText, subHeadText].filter(Boolean).join(' - ') || 'Bank Movement';

    // Extract Debit / Credit / Signed Amount
    const debitVal = activeMapping.debitCol >= 0 ? extractNumber(cells[activeMapping.debitCol]) : null;
    const creditVal = activeMapping.creditCol >= 0 ? extractNumber(cells[activeMapping.creditCol]) : null;
    const signedAmountVal = activeMapping.amountCol >= 0 ? extractNumber(cells[activeMapping.amountCol]) : null;

    let direction = null;
    let amount = 0;

    if (debitVal !== null && debitVal > 0) {
      direction = 'OUT';
      amount = round2(debitVal);
    } else if (creditVal !== null && creditVal > 0) {
      direction = 'IN';
      amount = round2(creditVal);
    } else if (signedAmountVal !== null && signedAmountVal !== 0) {
      if (signedAmountVal < 0) {
        direction = 'OUT';
        amount = round2(Math.abs(signedAmountVal));
      } else {
        direction = 'IN';
        amount = round2(signedAmountVal);
      }
    }

    // Extract Running Balance
    const balanceVal = activeMapping.balanceCol >= 0 ? extractNumber(cells[activeMapping.balanceCol]) : null;
    const runningBalance = balanceVal !== null ? round2(balanceVal) : null;

    if (runningBalance !== null) {
      if (firstValidRowBalance === null) firstValidRowBalance = runningBalance;
      lastValidRowBalance = runningBalance;
    }

    // Extract Reference
    const refVal = activeMapping.refCol >= 0 && cells[activeMapping.refCol] ? String(cells[activeMapping.refCol]).trim() : '';

    // Validation
    const rowErrors = [];
    if (!parsedDate) {
      rowErrors.push(`Row ${rowNumber}: Invalid or missing transaction date.`);
    }
    if (!direction || amount <= 0) {
      rowErrors.push(`Row ${rowNumber}: Amount could not be extracted (payments/receipts empty or zero).`);
    }

    if (rowErrors.length > 0) {
      validationErrors.push(...rowErrors);
    }

    parsedRows.push({
      rowIndex: rowNumber,
      transactionDate: parsedDate,
      valueDate: parsedDate,
      description,
      originalNarrative: origNarrative || primaryDesc,
      reference: refVal,
      head: headText,
      subHead: subHeadText,
      amount,
      direction: direction || 'OUT',
      runningBalance,
      validationErrors: rowErrors,
      status: rowErrors.length > 0 ? 'INVALID' : 'NEW',
    });
  });

  // Calculate opening balance if not explicitly set
  // If first row had balance B1 and was OUT (payment) of P1, opening was B1 + P1. If was IN (receipt) of R1, opening was B1 - R1.
  if (firstValidRowBalance !== null && parsedRows.length > 0) {
    const firstRow = parsedRows.find((r) => r.runningBalance !== null && r.amount > 0);
    if (firstRow) {
      openingBalance = firstRow.direction === 'OUT'
        ? round2(firstRow.runningBalance + firstRow.amount)
        : round2(firstRow.runningBalance - firstRow.amount);
    }
    closingBalance = lastValidRowBalance;
  }

  // Calculate date range
  const validDates = parsedRows
    .map((r) => r.transactionDate)
    .filter(Boolean)
    .sort((a, b) => a.getTime() - b.getTime());

  const statementPeriodStart = validDates.length > 0 ? validDates[0] : null;
  const statementPeriodEnd = validDates.length > 0 ? validDates[validDates.length - 1] : null;

  return {
    fileHash,
    fileSize: fileBuffer.length,
    detectedHeaders,
    detectedMapping: activeMapping,
    openingBalance,
    closingBalance,
    statementPeriodStart,
    statementPeriodEnd,
    totalParsedRows: parsedRows.length,
    parsedRows,
    validationErrors,
  };
};

/**
 * Classify transactions and match against existing DB entities and existing transactions
 */
export const classifyAndMatchRows = async (companyId, accountId, parsedRows) => {
  if (!companyId) throw new Error('Company ID is required for classification.');
  if (!accountId) throw new Error('Account ID is required for classification.');

  // Fetch company context in parallel
  const [properties, tenants, categories, mortgages, accounts, recentTxns] = await Promise.all([
    Property.find({ companyId }).lean(),
    Tenant.find({ companyId }).lean(),
    Category.find({ $or: [{ companyId }, { companyId: null }] }).lean(),
    Mortgage.find({ companyId }).populate('propertyId').lean(),
    Account.find({ companyId }).lean(),
    Transaction.find({
      companyId,
      accountId,
      isDeleted: false,
    })
      .sort({ transactionDate: -1 })
      .limit(2000)
      .lean(),
  ]);

  // Known Category Heads Cache
  const rentCategory = categories.find((c) => /rent/i.test(c.name)) || null;
  const bankChargesCategory = categories.find((c) => /bank.*charge/i.test(c.name)) || null;
  const repairsCategory = categories.find((c) => /repair|maintenance/i.test(c.name)) || null;
  const utilitiesCategory = categories.find((c) => /utilit|electric|water|gas|council/i.test(c.name)) || null;
  const adminCategory = categories.find((c) => /admin|office|general/i.test(c.name)) || null;
  const mortgageInterestCategory = categories.find((c) => /mortgage.*interest|finance.*cost/i.test(c.name)) || null;

  // Process each row
  return parsedRows.map((row) => {
    if (row.status === 'INVALID') {
      return {
        ...row,
        suggestedType: 'UNCATEGORIZED',
        confidenceScore: 0,
        classificationReason: 'Row has validation errors',
      };
    }

    const combinedSearchText = [
      row.description,
      row.originalNarrative,
      row.reference,
      row.head,
      row.subHead,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    // 1. DUPLICATE CHECK against recent posted transactions
    let isDuplicate = false;
    let duplicateReason = '';
    let matchedTransactionId = null;
    let matchedTransactionSummary = '';

    if (row.transactionDate && row.amount > 0) {
      const rowDateMs = new Date(row.transactionDate).getTime();
      const match = recentTxns.find((tx) => {
        if (round2(tx.amount) !== round2(row.amount)) return false;
        if (tx.direction !== row.direction) return false;
        const txDateMs = new Date(tx.transactionDate).getTime();
        const daysDiff = Math.abs(txDateMs - rowDateMs) / (1000 * 60 * 60 * 24);
        if (daysDiff > 3) return false;

        // Check reference or narration similarity
        if (tx.reference && row.reference && tx.reference.toLowerCase() === row.reference.toLowerCase()) {
          return true;
        }
        const sim = calculateTokenOverlap(tx.narration || '', row.description || '');
        return sim > 0.4 || daysDiff <= 1;
      });

      if (match) {
        isDuplicate = true;
        matchedTransactionId = match._id;
        matchedTransactionSummary = `${match.voucherNo} (£${match.amount.toFixed(2)} on ${new Date(
          match.transactionDate
        ).toLocaleDateString('en-GB')})`;
        duplicateReason = `Matches existing posted transaction ${matchedTransactionSummary}`;
      }
    }

    // 2. PROPERTY MATCHING
    let matchedProperty = null;
    let bestPropScore = 0;

    for (const prop of properties) {
      const propText = [prop.title, prop.addressLine1, prop.city, prop.postcode].filter(Boolean).join(' ');
      const score = calculateTokenOverlap(combinedSearchText, propText);
      // Give bonus if street number + name matches
      const streetNumMatch = prop.addressLine1?.match(/^\d+/);
      if (streetNumMatch && combinedSearchText.includes(streetNumMatch[0])) {
        if (score + 0.3 > bestPropScore && score > 0.15) {
          bestPropScore = score + 0.3;
          matchedProperty = prop;
        }
      } else if (score > bestPropScore && score >= 0.25) {
        bestPropScore = score;
        matchedProperty = prop;
      }
    }

    // 3. TENANT MATCHING
    let matchedTenant = null;
    let bestTenantScore = 0;
    for (const t of tenants) {
      const tName = [t.name, t.fullName, t.tradingName].filter(Boolean).join(' ');
      const score = calculateTokenOverlap(combinedSearchText, tName);
      if (score > bestTenantScore && score >= 0.4) {
        bestTenantScore = score;
        matchedTenant = t;
      }
    }

    // 4. MORTGAGE MATCHING
    let matchedMortgage = null;
    let bestMortgageScore = 0;
    for (const m of mortgages) {
      const mText = [m.lenderName, m.mortgageReference, m.accountNumber].filter(Boolean).join(' ');
      const score = calculateTokenOverlap(combinedSearchText, mText);
      if (score > bestMortgageScore && score >= 0.3) {
        bestMortgageScore = score;
        matchedMortgage = m;
      }
    }

    // 5. CLASSIFICATION INFERENCE ENGINE
    let suggestedType = 'UNCATEGORIZED';
    let suggestedCategoryId = null;
    let suggestedCategoryName = '';
    let suggestedPropertyId = matchedProperty ? matchedProperty._id : null;
    let suggestedPropertyName = matchedProperty ? (matchedProperty.title || matchedProperty.addressLine1) : '';
    let suggestedTenantId = matchedTenant ? matchedTenant._id : null;
    let suggestedTenantName = matchedTenant ? (matchedTenant.name || matchedTenant.fullName) : '';
    let suggestedMortgageId = matchedMortgage ? matchedMortgage._id : null;
    let suggestedMortgageName = matchedMortgage ? `${matchedMortgage.lenderName} (${matchedMortgage.mortgageReference || 'Facility'})` : '';
    let suggestedCounterAccountId = null;
    let suggestedCounterAccountName = '';
    let confidenceScore = 50;
    let classificationReason = 'Heuristic pattern detection';

    const isRentSignal =
      /rent|tenant|lease|bgc|letting|flat.*rent|shop.*rent/i.test(combinedSearchText) ||
      (row.head && /income/i.test(row.head) && /rent/i.test(row.subHead));

    const isBankChargeSignal =
      /bank charges|commission for period|commission|account fee/i.test(combinedSearchText) ||
      (row.subHead && /bank charge/i.test(row.subHead)) ||
      (row.description && /bank charge/i.test(row.description));

    const isMortgageSignal =
      !isBankChargeSignal &&
      (/quantum|interbay|together commercial|together commercia|commercial acceptn|commercial acceptance|mortgage|interest expenses/i.test(
        combinedSearchText
      ) ||
      (row.head && /interest/i.test(row.head)) ||
      matchedMortgage !== null);

    const isTransferSignal =
      /intra.*company|transfer|intral ft|loan return|director loan|dlr ft/i.test(combinedSearchText) ||
      (row.head && /loan/i.test(row.head));

    if (row.direction === 'IN' && isRentSignal) {
      suggestedType = 'RENT';
      suggestedCategoryId = rentCategory ? rentCategory._id : null;
      suggestedCategoryName = rentCategory ? rentCategory.name : 'Rental Income';
      confidenceScore = matchedProperty ? 90 : 75;
      classificationReason = matchedProperty
        ? `Identified rental receipt matched to ${suggestedPropertyName}`
        : 'Identified rental receipt narrative';
    } else if (row.direction === 'OUT' && isBankChargeSignal) {
      suggestedType = 'EXPENSE';
      suggestedCategoryId = bankChargesCategory ? bankChargesCategory._id : null;
      suggestedCategoryName = bankChargesCategory ? bankChargesCategory.name : 'Bank Charges';
      suggestedPropertyId = null;
      suggestedPropertyName = '';
      confidenceScore = 95;
      classificationReason = 'Bank account servicing commission or service fee';
    } else if (row.direction === 'OUT' && isMortgageSignal) {
      suggestedType = 'MORTGAGE_PAYMENT';
      suggestedCategoryId = mortgageInterestCategory ? mortgageInterestCategory._id : null;
      suggestedCategoryName = mortgageInterestCategory ? mortgageInterestCategory.name : 'Mortgage Servicing';
      if (matchedMortgage && matchedMortgage.propertyId) {
        suggestedPropertyId = matchedMortgage.propertyId._id || matchedMortgage.propertyId;
        suggestedPropertyName = matchedMortgage.propertyId.title || matchedMortgage.propertyId.addressLine1 || suggestedPropertyName;
      }
      confidenceScore = matchedMortgage ? 95 : 85;
      classificationReason = matchedMortgage
        ? `Matched mortgage lender facility: ${suggestedMortgageName}`
        : 'Mortgage lender servicing debt debit';
    } else if (isTransferSignal) {
      suggestedType = 'TRANSFER';
      confidenceScore = 80;
      classificationReason = 'Inter-account liquidity movement or company loan';
      // Search for sister or counter account
      const otherAccount = accounts.find((a) => a._id.toString() !== accountId.toString());
      if (otherAccount) {
        suggestedCounterAccountId = otherAccount._id;
        suggestedCounterAccountName = otherAccount.name;
      }
    } else if (row.direction === 'OUT') {
      suggestedType = 'EXPENSE';
      if (/repair|paint|plumb|labour|builder|hardware/i.test(combinedSearchText)) {
        suggestedCategoryId = repairsCategory ? repairsCategory._id : null;
        suggestedCategoryName = repairsCategory ? repairsCategory.name : 'Repairs & Maintenance';
        confidenceScore = matchedProperty ? 85 : 70;
        classificationReason = matchedProperty
          ? `Property repair allocated to ${suggestedPropertyName}`
          : 'Property repair / contractor payment';
      } else if (/post|nisa|vision|subscription|software|tech|telecom/i.test(combinedSearchText)) {
        suggestedCategoryId = adminCategory ? adminCategory._id : null;
        suggestedCategoryName = adminCategory ? adminCategory.name : 'Administrative Expenses';
        confidenceScore = 80;
        classificationReason = 'Administrative, software or postage expense';
      } else {
        confidenceScore = 55;
        classificationReason = 'Outflow expense requiring operator confirmation';
      }
    } else {
      suggestedType = 'UNCATEGORIZED';
      confidenceScore = 40;
      classificationReason = 'Requires operator review';
    }

    // Determine row status
    let status = 'NEW';
    if (isDuplicate) {
      status = 'POSSIBLE_DUPLICATE';
    } else if (confidenceScore >= 80) {
      status = 'APPROVED';
    } else {
      status = 'NEEDS_REVIEW';
    }

    return {
      ...row,
      suggestedType,
      suggestedPropertyId,
      suggestedPropertyName,
      suggestedTenantId,
      suggestedTenantName,
      suggestedMortgageId,
      suggestedMortgageName,
      suggestedCategoryId,
      suggestedCategoryName,
      suggestedCounterAccountId,
      suggestedCounterAccountName,
      confidenceScore,
      classificationReason,
      isDuplicate,
      duplicateReason,
      matchedTransactionId,
      matchedTransactionSummary,
      status,
      isExcluded: isDuplicate, // Exclude duplicates by default to prevent accidental double-posting
    };
  });
};

/**
 * Save an imported statement batch and all staging rows in MongoDB
 */
export const saveStatementBatch = async ({
  companyId,
  accountId,
  filename,
  fileBuffer,
  customMapping = {},
  userId = null,
  userName = 'System Operator',
  notes = '',
}) => {
  const parsed = await parseStatementBuffer(fileBuffer, filename, customMapping);
  const classifiedRows = await classifyAndMatchRows(companyId, accountId, parsed.parsedRows);

  const totalRows = classifiedRows.length;
  const duplicateRows = classifiedRows.filter((r) => r.isDuplicate).length;
  const matchedRows = classifiedRows.filter((r) => r.status === 'MATCHED' || r.isDuplicate).length;
  const newRows = totalRows - duplicateRows;

  // Create Batch
  const batch = await StatementImportBatch.create({
    companyId,
    accountId,
    filename,
    fileHash: parsed.fileHash,
    fileSize: parsed.fileSize,
    statementPeriodStart: parsed.statementPeriodStart,
    statementPeriodEnd: parsed.statementPeriodEnd,
    openingBalance: parsed.openingBalance,
    closingBalance: parsed.closingBalance,
    totalRows,
    newRows,
    matchedRows,
    duplicateRows,
    postedRows: 0,
    skippedRows: 0,
    status: 'DRAFT',
    uploadedBy: userId,
    uploadedByName: userName,
    columnMapping: parsed.detectedMapping,
    notes,
  });

  // Bulk Insert Rows
  const rowDocs = classifiedRows.map((r) => ({
    ...r,
    batchId: batch._id,
    companyId,
    accountId,
  }));

  if (rowDocs.length > 0) {
    await StatementImportRow.insertMany(rowDocs);
  }

  return {
    batch,
    summary: {
      totalRows,
      newRows,
      duplicateRows,
      openingBalance: parsed.openingBalance,
      closingBalance: parsed.closingBalance,
      statementPeriodStart: parsed.statementPeriodStart,
      statementPeriodEnd: parsed.statementPeriodEnd,
    },
  };
};

/**
 * Post approved rows of an import batch to the authoritative Central Ledger
 */
export const postBatchTransactions = async ({ batchId, rowIds = null, userId = null, userName = 'System Operator' }) => {
  const batch = await StatementImportBatch.findById(batchId);
  if (!batch) throw new Error('Statement import batch not found.');
  if (batch.status === 'POSTED') throw new Error('This statement batch has already been fully posted.');

  const filter = {
    batchId,
    isExcluded: false,
    status: { $in: ['APPROVED', 'NEW', 'NEEDS_REVIEW'] },
  };
  if (Array.isArray(rowIds) && rowIds.length > 0) {
    filter._id = { $in: rowIds };
  }

  const rowsToPost = await StatementImportRow.find(filter).sort({ rowIndex: 1 });
  if (!rowsToPost.length) {
    return {
      success: true,
      postedCount: 0,
      message: 'No eligible approved rows found to post.',
    };
  }

  let postedCount = 0;
  const errors = [];

  for (const row of rowsToPost) {
    try {
      const txType =
        row.suggestedType === 'RENT'
          ? 'INCOME'
          : row.suggestedType === 'TRANSFER'
          ? 'TRANSFER'
          : row.suggestedType === 'MORTGAGE_PAYMENT'
          ? 'MORTGAGE_PAYMENT'
          : 'EXPENSE';

      const postResult = await postLedgerTransaction({
        companyId: batch.companyId,
        transactionDate: row.transactionDate,
        transactionType: txType,
        accountId: batch.accountId,
        counterAccountId: row.suggestedCounterAccountId || null,
        categoryId: row.suggestedCategoryId || null,
        amount: row.amount,
        direction: row.direction,
        propertyId: row.suggestedPropertyId || null,
        unitId: row.suggestedUnitId || null,
        mortgageId: row.suggestedMortgageId || null,
        narration: row.description,
        reference: row.reference || `IMP-${batch._id.toString().slice(-6)}-R${row.rowIndex}`,
        userId,
        userName,
      });

      // Update Transaction with batch references
      await Transaction.findByIdAndUpdate(postResult.transaction._id, {
        importBatchId: batch._id,
        statementRef: `Row #${row.rowIndex} (${batch.filename})`,
        reconciled: true,
        reconciledAt: new Date(),
      });

      // If RENT payment and tenant known, register in RentPayment
      if (row.suggestedType === 'RENT' && row.suggestedPropertyId) {
        try {
          await RentPayment.create({
            companyId: batch.companyId,
            propertyId: row.suggestedPropertyId,
            unitId: row.suggestedUnitId || null,
            tenantId: row.suggestedTenantId || null,
            amount: row.amount,
            paymentDate: row.transactionDate,
            paymentMethod: 'BANK_TRANSFER',
            reference: row.reference || 'Imported Rent Payment',
            accountId: batch.accountId,
            transactionId: postResult.transaction._id,
            voucherNo: postResult.transaction.voucherNo,
            recordedBy: userId,
          });
        } catch (rentErr) {
          console.warn('RentPayment link notice:', rentErr.message);
        }
      }

      // If MORTGAGE payment and mortgage known, register in MortgagePayment
      if (row.suggestedType === 'MORTGAGE_PAYMENT' && row.suggestedMortgageId) {
        try {
          await MortgagePayment.create({
            companyId: batch.companyId,
            mortgageId: row.suggestedMortgageId,
            propertyId: row.suggestedPropertyId || null,
            paymentDate: row.transactionDate,
            totalPayment: row.amount,
            interestPaid: row.amount, // Default interest servicing until split confirmed
            principalPaid: 0,
            accountId: batch.accountId,
            transactionId: postResult.transaction._id,
            voucherNo: postResult.transaction.voucherNo,
            reference: row.reference || 'Imported Mortgage Servicing',
            recordedBy: userId,
          });
        } catch (mtgErr) {
          console.warn('MortgagePayment link notice:', mtgErr.message);
        }
      }

      // Update Staging Row
      row.status = 'POSTED';
      row.postedTransactionId = postResult.transaction._id;
      row.postedVoucherNo = postResult.transaction.voucherNo;
      row.postedAt = new Date();
      await row.save();

      postedCount++;
    } catch (err) {
      errors.push({ rowIndex: row.rowIndex, error: err.message });
      row.validationErrors.push(err.message);
      await row.save();
    }
  }

  // Update Batch Metrics
  const totalPostedInBatch = await StatementImportRow.countDocuments({ batchId, status: 'POSTED' });
  batch.postedRows = totalPostedInBatch;
  batch.status = totalPostedInBatch >= batch.totalRows ? 'POSTED' : 'PARTIALLY_POSTED';
  await batch.save();

  return {
    success: true,
    postedCount,
    failedCount: errors.length,
    errors,
    batchStatus: batch.status,
  };
};

/**
 * Generate a comprehensive Reconciliation Report comparing the Statement vs Ledger
 */
export const getReconciliationReport = async (companyId, accountId, batchId = null) => {
  const account = await Account.findOne({ _id: accountId, companyId }).lean();
  if (!account) throw new Error('Bank account not found in active company.');

  let batch = null;
  if (batchId) {
    batch = await StatementImportBatch.findOne({ _id: batchId, companyId }).lean();
  }

  // Calculate System Ledger Totals for this account
  const transactions = await Transaction.find({
    companyId,
    accountId,
    isDeleted: false,
    status: 'POSTED',
  }).lean();

  let ledgerTotalIn = 0;
  let ledgerTotalOut = 0;
  for (const tx of transactions) {
    if (tx.direction === 'IN') {
      ledgerTotalIn += tx.amount;
    } else {
      ledgerTotalOut += tx.amount;
    }
  }

  ledgerTotalIn = round2(ledgerTotalIn);
  ledgerTotalOut = round2(ledgerTotalOut);
  const ledgerCalculatedBalance = round2(account.openingBalance + ledgerTotalIn - ledgerTotalOut);

  // Statement Metrics (if batch provided)
  let statementOpening = batch?.openingBalance !== null && batch?.openingBalance !== undefined ? batch.openingBalance : null;
  let statementClosing = batch?.closingBalance !== null && batch?.closingBalance !== undefined ? batch.closingBalance : null;
  let statementTotalIn = 0;
  let statementTotalOut = 0;
  let unpostedRowsCount = 0;

  if (batchId) {
    const batchRows = await StatementImportRow.find({ batchId }).lean();
    for (const r of batchRows) {
      if (r.direction === 'IN') statementTotalIn += r.amount;
      else statementTotalOut += r.amount;
      if (r.status !== 'POSTED' && !r.isExcluded) unpostedRowsCount++;
    }
    statementTotalIn = round2(statementTotalIn);
    statementTotalOut = round2(statementTotalOut);
  }

  // Variance: Difference between Statement Closing Balance and System Calculated Balance
  let variance = 0;
  let isBalanced = true;
  if (statementClosing !== null) {
    variance = round2(statementClosing - account.currentBalance);
    isBalanced = Math.abs(variance) < 0.01;
  }

  return {
    companyId,
    accountId,
    accountName: account.name,
    accountNumber: account.accountNumber,
    systemOpeningBalance: account.openingBalance,
    systemCurrentBalance: account.currentBalance,
    ledgerTotalIn,
    ledgerTotalOut,
    ledgerCalculatedBalance,
    statementOpeningBalance: statementOpening,
    statementClosingBalance: statementClosing,
    statementTotalIn,
    statementTotalOut,
    unpostedRowsCount,
    variance,
    isBalanced,
    reconciliationStatus: isBalanced ? 'RECONCILED' : 'DISCREPANCY_DETECTED',
  };
};
