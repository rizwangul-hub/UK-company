import crypto from 'crypto';
import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import StatementImportBatch from '../models/StatementImportBatch.js';
import StatementImportRow from '../models/StatementImportRow.js';
import Transaction from '../models/Transaction.js';
import Account from '../models/Account.js';
import Property from '../models/Property.js';
import Unit from '../models/Unit.js';
import Category from '../models/Category.js';
import Tenant from '../models/Tenant.js';
import Mortgage from '../models/Mortgage.js';
import RentSchedule from '../models/RentSchedule.js';
import RentPayment from '../models/RentPayment.js';
import MortgagePayment from '../models/MortgagePayment.js';
import PropertyChargePayment from '../models/PropertyChargePayment.js';
import PropertyDemand from '../models/PropertyDemand.js';
import Voucher from '../models/Voucher.js';
import { postLedgerTransaction, deleteLedgerTransaction, generateVoucherNo, round2 } from './ledgerService.js';

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
    } else if (mapping.headCol === -1 && (/^head$/i.test(h) || /main[\s_-]?head|category[\s_-]?head|^head[\s_-]?category/i.test(h))) {
      mapping.headCol = idx;
    } else if (mapping.subHeadCol === -1 && (/sub[\s_-]?head/i.test(h) || /sub[\s_-]?category|child[\s_-]?category/i.test(h))) {
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
export const parseStatementBuffer = async (fileBuffer, filename, customMapping = {}, options = {}) => {
  const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  const isCSV = filename.toLowerCase().endsWith('.csv');

  let rawRows = [];
  let sheetsList = [];
  let sheetName = '';

  if (isCSV) {
    const text = fileBuffer.toString('utf8');
    rawRows = parseCSVRows(text);
    sheetsList = ['CSV Data'];
    sheetName = 'CSV Data';
  } else {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer);
    sheetsList = workbook.worksheets.map((ws) => ws.name);

    let worksheet = null;
    if (options.sheetName) {
      worksheet = workbook.getWorksheet(options.sheetName);
    }
    if (!worksheet) {
      worksheet = workbook.worksheets.find((ws) => ws.rowCount > 0) || workbook.worksheets[0];
    }

    if (!worksheet) {
      throw new Error('The uploaded Excel spreadsheet contains no visible worksheets or data.');
    }
    sheetName = worksheet.name;

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
    sheetsList,
    sheetName,
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
  const [properties, tenants, categories, mortgages, accounts, recentTxns, units] = await Promise.all([
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
    Unit.find({ companyId }).lean(),
  ]);

  // Known Category Heads Cache
  const rentCategory = categories.find((c) => /rent.*income|^rental/i.test(c.name)) || categories.find((c) => /rent/i.test(c.name)) || null;
  const storageCategory = categories.find((c) => /storage|parking/i.test(c.name)) || null;
  const bankChargesCategory = categories.find((c) => /bank.*charge/i.test(c.name)) || null;
  const repairsCategory = categories.find((c) => /repair|maintenance/i.test(c.name)) || null;
  const utilitiesCategory = categories.find((c) => /utilit|electric|water|gas|council/i.test(c.name)) || null;
  const adminCategory = categories.find((c) => /admin|office|general/i.test(c.name)) || null;
  const insuranceCategory = categories.find((c) => /insurance/i.test(c.name)) || null;
  const legalCategory = categories.find((c) => /legal|eviction|professional/i.test(c.name)) || null;
  const managementCategory = categories.find((c) => /management|letting.*agent|commission/i.test(c.name)) || null;
  const mortgageInterestCategory = categories.find((c) => /mortgage.*interest|finance.*cost/i.test(c.name)) || null;
  const mortgageFeesCategory = categories.find((c) => /mortgage.*fee|arrangement|valuation|broker/i.test(c.name)) || null;
  const taxCategory = categories.find((c) => /tax/i.test(c.name)) || null;

  // Pre-tokenize entities once for 100x performance boost
  const preparedProps = properties.map((prop) => {
    const propText = [prop.title, prop.addressLine1, prop.city, prop.postcode].filter(Boolean).join(' ');
    const streetNumMatch = prop.addressLine1?.match(/^\d+/);
    return {
      prop,
      tokens: normalizeTokens(propText),
      streetNum: streetNumMatch ? streetNumMatch[0] : null,
    };
  });

  const preparedTenants = tenants.map((t) => ({
    tenant: t,
    tokens: normalizeTokens([t.name, t.fullName, t.tradingName].filter(Boolean).join(' ')),
  }));

  const preparedMortgages = mortgages.map((m) => ({
    mortgage: m,
    tokens: normalizeTokens([m.lenderName, m.mortgageReference, m.accountNumber].filter(Boolean).join(' ')),
  }));

  // Index recent transactions by amount for O(1) duplicate checks
  const txByAmountMap = new Map();
  recentTxns.forEach((tx) => {
    const key = `${round2(tx.amount)}_${tx.direction}`;
    if (!txByAmountMap.has(key)) txByAmountMap.set(key, []);
    txByAmountMap.get(key).push(tx);
  });

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

    const rowTokens = normalizeTokens(combinedSearchText);

    // 1. FAST DUPLICATE CHECK via Hash Map
    let isDuplicate = false;
    let duplicateReason = '';
    let matchedTransactionId = null;
    let matchedTransactionSummary = '';

    if (row.transactionDate && row.amount > 0) {
      const rowDateMs = new Date(row.transactionDate).getTime();
      const candidateTxns = txByAmountMap.get(`${round2(row.amount)}_${row.direction}`) || [];

      for (const tx of candidateTxns) {
        const txDateMs = new Date(tx.transactionDate).getTime();
        const daysDiff = Math.abs(txDateMs - rowDateMs) / (1000 * 60 * 60 * 24);
        if (daysDiff <= 3) {
          if (
            (tx.reference && row.reference && tx.reference.toLowerCase() === row.reference.toLowerCase()) ||
            daysDiff <= 1
          ) {
            isDuplicate = true;
            matchedTransactionId = tx._id;
            matchedTransactionSummary = `${tx.voucherNo} (£${tx.amount.toFixed(2)} on ${new Date(
              tx.transactionDate
            ).toLocaleDateString('en-GB')})`;
            duplicateReason = `Matches existing posted transaction ${matchedTransactionSummary}`;
            break;
          }
        }
      }
    }

    // 2. FAST PROPERTY MATCHING using pre-tokenized sets
    let matchedProperty = null;
    let bestPropScore = 0;

    for (const item of preparedProps) {
      if (!item.tokens.length) continue;
      let matches = 0;
      for (const t of item.tokens) {
        if (rowTokens.includes(t)) matches++;
      }
      const score = matches / Math.min(rowTokens.length || 1, item.tokens.length);
      if (item.streetNum && combinedSearchText.includes(item.streetNum)) {
        if (score + 0.35 > bestPropScore && (score > 0.1 || matches >= 1)) {
          bestPropScore = score + 0.35;
          matchedProperty = item.prop;
        }
      } else if (score > bestPropScore && score >= 0.25) {
        bestPropScore = score;
        matchedProperty = item.prop;
      }
    }

    // 3. FAST TENANT MATCHING
    let matchedTenant = null;
    let bestTenantScore = 0;
    for (const item of preparedTenants) {
      if (!item.tokens.length) continue;
      let matches = 0;
      for (const t of item.tokens) {
        if (rowTokens.includes(t)) matches++;
      }
      const score = matches / Math.min(rowTokens.length || 1, item.tokens.length);
      if (score > bestTenantScore && score >= 0.4) {
        bestTenantScore = score;
        matchedTenant = item.tenant;
      }
    }

    // 4. FAST MORTGAGE MATCHING
    let matchedMortgage = null;
    let bestMortgageScore = 0;
    for (const item of preparedMortgages) {
      if (!item.tokens.length) continue;
      let matches = 0;
      for (const t of item.tokens) {
        if (rowTokens.includes(t)) matches++;
      }
      const score = matches / Math.min(rowTokens.length || 1, item.tokens.length);
      if (score > bestMortgageScore && score >= 0.3) {
        bestMortgageScore = score;
        matchedMortgage = item.mortgage;
      }
    }

    // 5. CLASSIFICATION INFERENCE & PROPERTY/UNIT RESOLUTION
    const normText = (str) => {
      if (!str) return '';
      return String(str)
        .toLowerCase()
        .replace(/claracne|clarance|clarnece|clarnce/g, 'clarence')
        .replace(/orset\b/g, 'orsett')
        .replace(/alaxandra|alexander/g, 'alexandra')
        .replace(/sounthend/g, 'southend')
        .replace(/protori|pretoria/g, 'pretoria')
        .replace(/vansitart|vansitratt|vanaitratt|vanistrat/g, 'vansittart')
        .replace(/landsbury|landsbbury/g, 'lansbury')
        .replace(/admin expeses/g, 'admin expenses')
        .replace(/repair and maintainance/g, 'repair and maintenance')
        .replace(/rent depsit refund/g, 'rent deposit refund')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const normSearch = normText(`${row.description} ${row.originalNarrative} ${row.reference} ${row.head} ${row.subHead}`);
    const normHead = normText(row.head);
    const normSubHead = normText(row.subHead);

    let suggestedType = 'UNCATEGORIZED';
    let suggestedCategoryId = null;
    let suggestedCategoryName = '';
    let suggestedHeadId = null;
    let suggestedHead = (row.head || '').trim();
    let suggestedSubHeadId = null;
    let suggestedSubHead = (row.subHead || '').trim();
    let suggestedPropertyId = null;
    let suggestedPropertyName = '';
    let suggestedUnitId = null;
    let suggestedUnitName = '';
    let suggestedTenantId = matchedTenant ? matchedTenant._id : null;
    let suggestedTenantName = matchedTenant ? (matchedTenant.name || matchedTenant.fullName) : '';
    let suggestedMortgageId = matchedMortgage ? matchedMortgage._id : null;
    let suggestedMortgageName = matchedMortgage ? `${matchedMortgage.lenderName} (${matchedMortgage.mortgageReference || 'Facility'})` : '';
    let suggestedCounterAccountId = null;
    let suggestedCounterAccountName = '';
    let confidenceScore = 50;
    let classificationReason = 'Heuristic pattern detection';

    // 5.1 Match Property by Address/Street/Postcode
    let matchedProp = null;
    for (const p of properties) {
      const pNameNorm = normText(p.name);
      if (pNameNorm.includes('cromwell') && (normSearch.includes('cromwell') || normSearch.includes('ceomwell'))) {
        matchedProp = p; break;
      }
      if (pNameNorm.includes('clarence') && (normSearch.includes('clarence') || normSearch.includes('claracne') || normSearch.includes('clarnece') || normSearch.includes('clarnce'))) {
        if (pNameNorm.includes('26') && normSearch.includes('26')) {
          matchedProp = p; break;
        } else if (pNameNorm.includes('13') && (normSearch.includes('13') || normSearch.includes('15'))) {
          matchedProp = p; break;
        }
      }
      if (pNameNorm.includes('alexandra') && normSearch.includes('alexandra')) {
        matchedProp = p; break;
      }
      if (pNameNorm.includes('orsett') && normSearch.includes('orsett')) {
        matchedProp = p; break;
      }
      if (pNameNorm.includes('southend') && normSearch.includes('southend')) {
        matchedProp = p; break;
      }
      if (pNameNorm.includes('pretoria') && normSearch.includes('pretoria')) {
        matchedProp = p; break;
      }
      if (pNameNorm.includes('millard') && normSearch.includes('millard')) {
        matchedProp = p; break;
      }
      if (pNameNorm.includes('como') && normSearch.includes('como')) {
        matchedProp = p; break;
      }
      if (pNameNorm.includes('vansittart') && normSearch.includes('vansittart')) {
        matchedProp = p; break;
      }
      if (pNameNorm.includes('lakewalk') && (normSearch.includes('lakewalk') || normSearch.includes('lake walk'))) {
        matchedProp = p; break;
      }
      if (pNameNorm.includes('lansbury') && normSearch.includes('lansbury')) {
        matchedProp = p; break;
      }
      if (pNameNorm.includes('morley') && normSearch.includes('morley')) {
        matchedProp = p; break;
      }
    }

    if (!matchedProp) {
      matchedProp = matchedProperty;
    }

    // 5.2 Direct Category & Head / Sub Head Resolution from Workbook
    const cleanHead = (row.head || '').trim();
    const cleanSubHead = (row.subHead || '').trim();

    // Match parent Main Head category
    const mainHeadCat = categories.find((c) => {
      if (!c.isMainHead && c.parentCategoryId) return false;
      const cNorm = normText(c.name);
      return (normHead && cNorm === normHead) || (cNorm === 'admin expenses' && normHead.includes('admin'));
    });

    if (mainHeadCat) {
      suggestedHeadId = mainHeadCat._id;
      suggestedHead = mainHeadCat.name;
    }

    // Match Sub Head category
    const subCat = categories.find((c) => {
      const cNorm = normText(c.name);
      if (normSubHead && cNorm === normSubHead) return true;
      if (normSubHead && Array.isArray(c.aliases) && c.aliases.some((a) => normText(a) === normSubHead)) return true;
      return false;
    });

    if (subCat) {
      suggestedSubHeadId = subCat._id;
      suggestedSubHead = subCat.name;
      suggestedCategoryId = subCat._id;
      suggestedCategoryName = subCat.name;
      if (!suggestedHeadId && subCat.parentCategoryId) {
        suggestedHeadId = subCat.parentCategoryId?._id || subCat.parentCategoryId;
      }
    } else if (mainHeadCat) {
      suggestedCategoryId = mainHeadCat._id;
      suggestedCategoryName = mainHeadCat.name;
    }

    // 5.3 Type & Property / Unit Allocation Rules
    const isRent = (normHead.includes('income') && normSubHead.includes('rent')) || /rent|tenant/i.test(normSearch);
    const isInterest = normHead.includes('interest') || normText(cleanHead).includes('interest');
    const isLoan = normHead.includes('loan') || normText(cleanHead).includes('loan');
    const isAdmin = normHead.includes('admin') || normText(cleanHead).includes('admin');
    const isPropertyPurchase = normHead.includes('property purchase') || normSearch.includes('auction deposit');

    let matchedUnit = null;

    if (isRent && row.direction === 'IN') {
      suggestedType = 'RENT';
      confidenceScore = 95;
      classificationReason = 'Rental collection income';

      if (matchedProp) {
        suggestedPropertyId = matchedProp._id;
        suggestedPropertyName = matchedProp.name;

        const propUnits = units.filter((u) => u.propertyId.toString() === matchedProp._id.toString());
        if (propUnits.length === 1) {
          matchedUnit = propUnits[0];
        } else if (propUnits.length > 1) {
          const isShop =
            normSearch.includes('shop') ||
            normSearch.includes('barber') ||
            normSearch.includes('latin plaza') ||
            normSearch.includes('heathway') ||
            normSearch.includes('penns') ||
            normSearch.includes('habib') ||
            normSearch.includes('abualela') ||
            normSearch.includes('ivape') ||
            normSearch.includes('shelby') ||
            normSearch.includes('wickford') ||
            normSearch.includes('rashed');

          const isFlat =
            normSearch.includes('flat') ||
            normSearch.includes('flats') ||
            normSearch.includes('ideal letting') ||
            normSearch.includes('12a') ||
            normSearch.includes('12b') ||
            normSearch.includes('12c') ||
            normSearch.includes('12d') ||
            normSearch.includes('62a') ||
            normSearch.includes('26a') ||
            normSearch.includes('127a');

          if (isShop) {
            if (normSearch.includes('13') && !normSearch.includes('13 15') && !normSearch.includes('13/15')) {
              matchedUnit = propUnits.find((u) => u.unitName.includes('13') && !u.unitName.includes('15') && u.unitType === 'RETAIL_SHOP');
            } else if (normSearch.includes('15') && !normSearch.includes('13 15') && !normSearch.includes('13/15')) {
              matchedUnit = propUnits.find((u) => u.unitName.includes('15') && !u.unitName.includes('13') && u.unitType === 'RETAIL_SHOP');
            } else {
              matchedUnit = propUnits.find((u) => u.unitType === 'RETAIL_SHOP' || u.unitName.toLowerCase().includes('shop'));
            }
          } else if (isFlat) {
            matchedUnit = propUnits.find((u) => u.unitType === 'FLAT' || u.unitName.toLowerCase().includes('flat'));
          } else {
            const specific = propUnits.find((u) => normSearch.includes(u.unitName.toLowerCase()));
            if (specific) matchedUnit = specific;
            else matchedUnit = propUnits.find((u) => u.unitType === 'FLAT') || null;
          }
        }
      }
    } else if (isInterest) {
      suggestedType = 'MORTGAGE_PAYMENT';
      confidenceScore = 95;
      classificationReason = 'Mortgage and financing interest expense';
      if (matchedProp) {
        suggestedPropertyId = matchedProp._id;
        suggestedPropertyName = matchedProp.name;
      }
      matchedUnit = null; // User rule: whole property finance cost
    } else if (isLoan) {
      suggestedType = 'LOAN';
      confidenceScore = 95;
      classificationReason = 'Company loan, financing, or remortgage transaction';
      if (normSubHead.includes('remortgage') && matchedProp) {
        suggestedPropertyId = matchedProp._id;
        suggestedPropertyName = matchedProp.name;
        matchedUnit = null; // User rule: whole property remortgage
      } else {
        suggestedPropertyId = null;
        suggestedPropertyName = '';
        matchedUnit = null;
      }
    } else if (isPropertyPurchase) {
      suggestedType = 'CAPITAL_EXPENDITURE';
      confidenceScore = 95;
      classificationReason = 'Capital property purchase deposit / fee';
      matchedUnit = null;
    } else if (isAdmin) {
      suggestedType = 'EXPENSE';
      confidenceScore = 95;
      classificationReason = 'Administrative & Operating overhead expense';
      if (normSubHead.includes('repair') && matchedProp) {
        suggestedPropertyId = matchedProp._id;
        suggestedPropertyName = matchedProp.name;
      } else {
        suggestedPropertyId = null;
        suggestedPropertyName = '';
      }
      matchedUnit = null;
    } else if (normHead.includes('other')) {
      suggestedType = 'TRANSFER';
      confidenceScore = 90;
      classificationReason = 'Sundry movement or cash transaction';
      matchedUnit = null;
    } else if (row.direction === 'IN') {
      suggestedType = 'INCOME';
      confidenceScore = 90;
      classificationReason = 'Operating refund or sundry income';
      matchedUnit = null;
    } else {
      suggestedType = 'EXPENSE';
      confidenceScore = 80;
      classificationReason = 'Operating expense';
      matchedUnit = null;
    }

    if (matchedUnit) {
      suggestedUnitId = matchedUnit._id;
      suggestedUnitName = matchedUnit.unitName;
    }

    const finalHead = (row.head || suggestedHead || '').trim();
    const finalSubHead = (row.subHead || suggestedSubHead || '').trim();

    // Determine row status (all recognized rows are automatically approved)
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
      head: finalHead,
      subHead: finalSubHead,
      suggestedHeadId: suggestedHeadId || null,
      suggestedHead: finalHead,
      suggestedSubHeadId: suggestedSubHeadId || null,
      suggestedSubHead: finalSubHead,
      suggestedType,
      suggestedPropertyId,
      suggestedPropertyName,
      suggestedUnitId,
      suggestedUnitName,
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
      isExcluded: isDuplicate,
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
  sheetName = null,
  userId = null,
  userName = 'System Operator',
  notes = '',
}) => {
  const parsed = await parseStatementBuffer(fileBuffer, filename, customMapping, { sheetName });
  const classifiedRows = await classifyAndMatchRows(companyId, accountId, parsed.parsedRows);

  const totalRows = classifiedRows.length;
  const duplicateRows = classifiedRows.filter((r) => r.isDuplicate).length;
  const matchedRows = classifiedRows.filter((r) => r.status === 'MATCHED' || r.isDuplicate).length;
  const newRows = totalRows - duplicateRows;

  // Clean userId
  const cleanUserId = userId && mongoose.Types.ObjectId.isValid(userId) ? userId : null;

  // Create Batch
  const batch = await StatementImportBatch.create({
    companyId,
    accountId,
    filename,
    fileHash: parsed.fileHash,
    fileSize: parsed.fileSize,
    sheetName: parsed.sheetName || '',
    sheetsList: parsed.sheetsList || [],
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
    uploadedBy: cleanUserId,
    uploadedByName: userName || 'System Operator',
    columnMapping: parsed.detectedMapping,
    notes,
  });

  // Bulk Insert Rows in chunks with clean ObjectIds
  const rowDocs = classifiedRows.map((r) => ({
    ...r,
    batchId: batch._id,
    companyId,
    accountId,
    excelRowNumber: r.rowIndex,
    head: r.head || r.suggestedHead || '',
    subHead: r.subHead || r.suggestedSubHead || '',
    suggestedHeadId: r.suggestedHeadId || null,
    suggestedHead: r.suggestedHead || r.head || '',
    suggestedSubHeadId: r.suggestedSubHeadId || null,
    suggestedSubHead: r.suggestedSubHead || r.subHead || '',
    transactionDate: r.transactionDate || new Date(),
    amount: r.amount > 0 ? r.amount : 0,
    suggestedPropertyId: r.suggestedPropertyId || null,
    suggestedPropertyName: r.suggestedPropertyName || '',
    suggestedUnitId: r.suggestedUnitId || null,
    suggestedUnitName: r.suggestedUnitName || '',
    suggestedCategoryId: r.suggestedCategoryId || null,
    suggestedTenantId: r.suggestedTenantId || null,
    suggestedMortgageId: r.suggestedMortgageId || null,
    suggestedCounterAccountId: r.suggestedCounterAccountId || null,
    matchedTransactionId: r.matchedTransactionId || null,
  }));

  if (rowDocs.length > 0) {
    const CHUNK_SIZE = 250;
    for (let i = 0; i < rowDocs.length; i += CHUNK_SIZE) {
      const chunk = rowDocs.slice(i, i + CHUNK_SIZE);
      await StatementImportRow.insertMany(chunk, { ordered: false });
    }
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
export const postBatchTransactions = async ({ batchId, rowIds = null, limit = null, userId = null, userName = 'System Operator' }) => {
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

  let query = StatementImportRow.find(filter).sort({ rowIndex: 1 });
  if (limit && Number(limit) > 0) {
    query = query.limit(Number(limit));
  }

  const rowsToPost = await query;
  if (!rowsToPost.length) {
    return {
      success: true,
      postedCount: 0,
      failedCount: 0,
      errors: [],
      message: 'No eligible approved rows found to post.',
    };
  }

  let postedCount = 0;
  const errors = [];

  // In-memory voucher sequence cache per type code to eliminate redundant index/regex queries
  const voucherCounters = {};
  const getNextVoucherNo = async (typeCode) => {
    if (!voucherCounters[typeCode]) {
      const initialVoucher = await generateVoucherNo(typeCode, batch.companyId);
      const lastDash = initialVoucher.lastIndexOf('-');
      const prefix = initialVoucher.slice(0, lastDash);
      const seq = parseInt(initialVoucher.slice(lastDash + 1), 10) || 1;
      voucherCounters[typeCode] = { prefix, currentSeq: seq };
      return initialVoucher;
    }
    voucherCounters[typeCode].currentSeq += 1;
    return `${voucherCounters[typeCode].prefix}-${String(voucherCounters[typeCode].currentSeq).padStart(4, '0')}`;
  };

  for (const row of rowsToPost) {
    try {
      const hasValidCounterAccount =
        row.suggestedCounterAccountId &&
        row.suggestedCounterAccountId.toString() !== batch.accountId.toString();

      const txType =
        row.suggestedType === 'TRANSFER' && hasValidCounterAccount
          ? 'TRANSFER'
          : row.suggestedType === 'CAPITAL_EXPENDITURE' || (row.head && /property purchase/i.test(row.head))
          ? 'CAPITAL_ADJUSTMENT'
          : row.suggestedType === 'MORTGAGE_PAYMENT' || (row.head && /interest/i.test(row.head))
          ? 'MORTGAGE_PAYMENT'
          : row.direction === 'IN'
          ? 'INCOME'
          : 'EXPENSE';

      const counterAccountId = txType === 'TRANSFER' ? row.suggestedCounterAccountId : null;

      const typeCode =
        txType === 'INCOME'
          ? 'RNT'
          : txType === 'TRANSFER'
          ? 'TRF'
          : txType === 'MORTGAGE_PAYMENT'
          ? 'MTG'
          : txType === 'CAPITAL_ADJUSTMENT'
          ? 'CAP'
          : 'EXP';

      const voucherNo = await getNextVoucherNo(typeCode);

      const postResult = await postLedgerTransaction({
        companyId: batch.companyId,
        voucherNo,
        transactionDate: row.transactionDate,
        transactionType: txType,
        accountId: batch.accountId,
        counterAccountId,
        categoryId: row.suggestedCategoryId || null,
        headId: row.suggestedHeadId || null,
        subHeadId: row.suggestedSubHeadId || null,
        head: row.head || row.suggestedHead || '',
        subHead: row.subHead || row.suggestedSubHead || '',
        amount: row.amount,
        direction: row.direction,
        propertyId: row.suggestedPropertyId || null,
        unitId: row.suggestedUnitId || null,
        mortgageId: row.suggestedMortgageId || null,
        narration: row.description,
        reference: row.reference || `IMP-${batch._id.toString().slice(-6)}-R${row.rowIndex}`,
        userId,
        userName,
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
    totalPostedInBatch,
  };
};

/**
 * Safely and rapidly reverses all ledger transactions associated with a statement import batch.
 * Handles thousands of rows in milliseconds using bulk operations without request timeouts.
 */
const executeBulkBatchReversal = async ({ batch, companyId, userId = null, userName = 'System Operator', reason = '' }) => {
  // 1. Collect all transaction IDs linked to this batch either via importBatchId OR row.postedTransactionId
  const rows = await StatementImportRow.find({ batchId: batch._id, companyId }).lean();
  const postedTxIdsFromRows = rows.map((r) => r.postedTransactionId).filter(Boolean);

  const transactions = await Transaction.find({
    companyId,
    $or: [
      { importBatchId: batch._id },
      { _id: { $in: postedTxIdsFromRows } },
    ],
  });

  if (!transactions.length) {
    return { reversedCount: 0, alreadyVoidedCount: 0 };
  }

  // 2. Identify active transactions that must have account liquidity reversed vs already voided ones
  const activeTransactions = transactions.filter((t) => !t.isDeleted && t.status !== 'VOID');
  const alreadyVoidedCount = transactions.length - activeTransactions.length;

  if (activeTransactions.length > 0) {
    // 3. Compute net balance adjustments grouped by accountId to restore account liquidity in bulk
    const accountDeltas = {};
    for (const tx of activeTransactions) {
      const amt = round2(tx.amount || 0);
      const accId = String(tx.accountId);
      if (accId) {
        accountDeltas[accId] = round2((accountDeltas[accId] || 0) + (tx.direction === 'OUT' ? amt : -amt));
      }

      if (tx.transactionType === 'TRANSFER' && tx.counterAccountId) {
        const counterId = String(tx.counterAccountId);
        accountDeltas[counterId] = round2((accountDeltas[counterId] || 0) - amt);
      }
    }

    // Apply account balance updates
    for (const [accId, delta] of Object.entries(accountDeltas)) {
      if (delta !== 0) {
        await Account.findOneAndUpdate(
          { _id: accId, companyId },
          { $inc: { currentBalance: delta } }
        );
      }
    }

    // 4. Handle any linked RentPayment, MortgagePayment, PropertyChargePayment
    const activeTxIds = activeTransactions.map((t) => t._id);
    const activeVouchers = activeTransactions.map((t) => t.voucherNo).filter(Boolean);

    // Rent Payments
    const linkedRentPayments = await RentPayment.find({
      companyId,
      isDeleted: { $ne: true },
      $or: [{ transactionId: { $in: activeTxIds } }, { receiptRef: { $in: activeVouchers } }],
    });
    for (const rp of linkedRentPayments) {
      rp.status = 'VOID';
      rp.isDeleted = true;
      await rp.save();

      const schedQuery = rp.scheduleId
        ? { _id: rp.scheduleId, companyId }
        : { propertyId: rp.propertyId, companyId };
      const schedule = await RentSchedule.findOne(schedQuery);
      if (schedule) {
        schedule.paidAmount = round2(Math.max(0, (schedule.paidAmount || 0) - rp.amount));
        await schedule.save();
      }
    }

    // Mortgage Payments
    const linkedMortgagePayments = await MortgagePayment.find({
      companyId,
      isDeleted: { $ne: true },
      $or: [{ transactionId: { $in: activeTxIds } }, { paymentReference: { $in: activeVouchers } }],
    });
    for (const mp of linkedMortgagePayments) {
      mp.status = 'VOID';
      mp.isDeleted = true;
      await mp.save();

      if (mp.principalAmount > 0) {
        await Mortgage.findOneAndUpdate(
          { _id: mp.mortgageId, companyId },
          { $inc: { outstandingPrincipalBalance: mp.principalAmount } }
        );
      }
    }

    // Property Charge Payments
    const linkedChargePayments = await PropertyChargePayment.find({
      companyId,
      isDeleted: { $ne: true },
      $or: [{ transactionId: { $in: activeTxIds } }, { bankReference: { $in: activeVouchers } }],
    });
    for (const cp of linkedChargePayments) {
      cp.status = 'VOID';
      cp.isDeleted = true;
      cp.isActive = false;
      await cp.save();

      if (cp.demandId) {
        const demand = await PropertyDemand.findOne({ _id: cp.demandId, companyId });
        if (demand) {
          demand.totalPaid = round2(Math.max(0, (demand.totalPaid || 0) - cp.amountPaid));
          demand.status = demand.totalPaid <= 0 ? 'RECEIVED' : demand.totalPaid < demand.amountDemanded ? 'PARTIALLY_PAID' : 'PAID';
          await demand.save();
        }
      }
    }

    // 5. Bulk void all active transactions
    const effectiveReason = reason || `Batch Reversal for Statement Import #${batch._id} (${batch.filename})`;
    const deletionAudit = {
      action: 'DELETED',
      performedBy: userId,
      performedByName: userName,
      performedAt: new Date(),
      reason: effectiveReason,
      changes: {
        status: { from: 'POSTED', to: 'VOID' },
        isDeleted: { from: false, to: true },
      },
    };

    await Transaction.updateMany(
      { _id: { $in: activeTxIds }, companyId },
      {
        $set: {
          status: 'VOID',
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: userId,
          deletionReason: effectiveReason,
        },
        $push: {
          auditHistory: deletionAudit,
        },
      }
    );

    // 6. Void linked vouchers
    const voucherIds = activeTransactions.map((t) => t.voucherId).filter(Boolean);
    if (voucherIds.length > 0) {
      await Voucher.updateMany(
        { _id: { $in: voucherIds }, companyId },
        { $set: { status: 'VOID' } }
      );
    }
  }

  return {
    reversedCount: activeTransactions.length,
    alreadyVoidedCount,
  };
};

/**
 * Reverse all posted transactions of an import batch using the authoritative soft-delete/void workflow
 */
export const reverseBatchTransactions = async ({ batchId, companyId, userId = null, userName = 'System Operator' }) => {
  const batch = await StatementImportBatch.findOne({ _id: batchId, companyId });
  if (!batch) throw new Error('Statement import batch not found in active company.');

  const reversal = await executeBulkBatchReversal({
    batch,
    companyId,
    userId,
    userName,
    reason: `Batch Reversal for Statement Import #${batch._id} (${batch.filename})`,
  });

  // Reset staging row status so operator can review/re-edit
  await StatementImportRow.updateMany(
    { batchId: batch._id, companyId },
    {
      $set: {
        status: 'APPROVED',
        postedTransactionId: null,
        postedVoucherNo: null,
        postedAt: null,
        validationErrors: [],
      },
    }
  );

  batch.postedRows = 0;
  batch.status = 'DRAFT';
  await batch.save();

  return {
    success: true,
    reversedCount: reversal.reversedCount,
    alreadyVoidedCount: reversal.alreadyVoidedCount,
    failedCount: 0,
    errors: [],
    batchStatus: batch.status,
    message: `Batch "${batch.filename}" reversed successfully. Reversed ${reversal.reversedCount} active transaction(s).`,
  };
};

/**
 * Permanently delete an imported statement batch, safely reversing any posted transactions first
 */
export const deleteStatementBatch = async ({ batchId, companyId, userId = null, userName = 'System Operator' }) => {
  const batch = await StatementImportBatch.findOne({ _id: batchId, companyId });
  if (!batch) throw new Error('Statement import batch not found in active company.');

  // 1. Revert any active transactions first
  const reversal = await executeBulkBatchReversal({
    batch,
    companyId,
    userId,
    userName,
    reason: `Batch Deletion for Statement Import #${batch._id} (${batch.filename})`,
  });

  // 2. Remove all staging rows for this batch
  const deleteRowsResult = await StatementImportRow.deleteMany({ batchId: batch._id, companyId });

  // 3. Remove the batch itself
  await StatementImportBatch.deleteOne({ _id: batch._id, companyId });

  return {
    success: true,
    deletedBatchId: batchId,
    deletedRowsCount: deleteRowsResult.deletedCount,
    reversedTransactionsCount: reversal.reversedCount,
    reversalErrors: [],
    message: `Batch "${batch.filename}" deleted successfully.${reversal.reversedCount > 0 ? ` Reversed ${reversal.reversedCount} posted transaction(s).` : ''}`,
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
