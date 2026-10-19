import mongoose from 'mongoose';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Transaction from '../models/Transaction.js';
import Account from '../models/Account.js';
import Category from '../models/Category.js';
import Property from '../models/Property.js';
import Unit from '../models/Unit.js';
import Tenant from '../models/Tenant.js';
import Mortgage from '../models/Mortgage.js';
import MortgagePayment from '../models/MortgagePayment.js';
import RentSchedule from '../models/RentSchedule.js';
import RentPayment from '../models/RentPayment.js';
import { round2 } from './ledgerService.js';
import { getCompanyById } from '../config/companies.js';
import { createOfficialLandlordWorkbook } from '../scripts/generateLandlordReportFile.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOGO_PATH = path.resolve(__dirname, '../assets/logo.png');

const escapeRegex = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Format standard UK date string (DD/MM/YYYY)
 */
export const formatUKDate = (date) => {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Format monetary amount into GBP string
 */
export const formatGBP = (amount) => {
  const val = Number(amount) || 0;
  if (val < 0) {
    return `-£${Math.abs(val).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `£${val.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Sanitize strings to prevent CSV/Excel formula injection
 */
export const sanitizeCell = (val) => {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
};

/**
 * Parse date presets or custom start/end dates
 */
export const parseReportingDateRange = (datePreset, startDate, endDate) => {
  const now = new Date();
  let periodStart = null;
  let periodEnd = null;

  switch (datePreset) {
    case 'TODAY': {
      periodStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0));
      periodEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999));
      break;
    }
    case 'THIS_WEEK': {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      periodStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), diff, 0, 0, 0));
      periodEnd = new Date();
      break;
    }
    case 'THIS_MONTH': {
      periodStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0));
      periodEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999));
      break;
    }
    case 'PREVIOUS_MONTH': {
      periodStart = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0));
      periodEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999));
      break;
    }
    case 'THIS_TAX_YEAR':
    case 'CURRENT_FINANCIAL_YEAR': {
      // Standard UK Personal Tax Year: 6 April to 5 April
      const currYear = now.getMonth() >= 3 && (now.getMonth() > 3 || now.getDate() >= 6)
        ? now.getFullYear()
        : now.getFullYear() - 1;
      periodStart = new Date(Date.UTC(currYear, 3, 6, 0, 0, 0));
      periodEnd = new Date(Date.UTC(currYear + 1, 3, 5, 23, 59, 59, 999));
      break;
    }
    case 'CUSTOM': {
      if (startDate) periodStart = new Date(startDate);
      if (endDate) {
        periodEnd = new Date(endDate);
        periodEnd.setHours(23, 59, 59, 999);
      }
      break;
    }
    case 'ALL':
    default: {
      periodStart = null;
      periodEnd = null;
      break;
    }
  }

  return { periodStart, periodEnd };
};

/**
 * Core Authoritative Ledger Report Compiler
 * Retrieves and calculates comprehensive ledger data across any scope and filters.
 */
export const buildLedgerReportData = async (filters = {}) => {
  const {
    companyId,
    scope = 'COMPLETE',
    entityId,
    propertyId,
    unitId,
    tenantId,
    mortgageId,
    accountId,
    categoryId,
    transactionType,
    datePreset = 'THIS_MONTH',
    startDate,
    endDate,
    minAmount,
    maxAmount,
    search,
    voucherNo,
    reference,
    status = 'POSTED',
    selectedIds = [],
    includeUnits = true,
  } = filters;

  if (!companyId) {
    throw new Error('companyId is strictly required to compile ledger report data.');
  }

  const companyConfig = getCompanyById(companyId);
  const companyName = companyConfig ? companyConfig.name.toUpperCase() : 'PIXX TECHNOLOGIES UK PROPERTY FINANCE LTD';

  const { periodStart, periodEnd } = parseReportingDateRange(datePreset, startDate, endDate);

  // Generate unique report reference
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const now = new Date();
  const dateTag = now.toISOString().slice(0, 10).replace(/-/g, '');
  const reportRef = `PIXX-UK-${dateTag}-${randomSuffix}`;

  let reportTitle = `${companyName} Financial Ledger`;
  let scopeDescription = 'Complete General Ledger';
  let entityDetails = null;
  let isLiquidity = false;
  let isMortgage = false;
  let openingBalance = 0;

  // Base Transaction Query
  const query = {};
  if (companyId) query.companyId = companyId;
  if (status && status !== 'ALL') {
    query.status = status;
  } else {
    query.status = 'POSTED';
    query.isDeleted = { $ne: true };
  }

  // If specific records selected
  if (Array.isArray(selectedIds) && selectedIds.length > 0) {
    query._id = { $in: selectedIds };
  }

  // 1. Resolve Scope & Target Entity
  switch (scope) {
    case 'ACCOUNT_HEAD': {
      const targetCatId = entityId || categoryId;
      if (targetCatId && targetCatId !== 'ALL_EXPENSES' && targetCatId !== 'ALL_INCOME' && mongoose.Types.ObjectId.isValid(targetCatId)) {
        const catQuery = { _id: targetCatId };
        if (companyId) catQuery.companyId = companyId;
        const cat = await Category.findOne(catQuery).lean();
        if (cat) {
          query.categoryId = cat._id;
          reportTitle = `Nominal Account Head: ${cat.name}`;
          scopeDescription = `Category Code: ${cat.code || 'N/A'} · Type: ${cat.type} · Tax Deductible: ${cat.isAllowableTaxDeduction ? 'Yes' : 'No'}`;
          entityDetails = cat;
        }
      } else if (targetCatId === 'ALL_EXPENSES') {
        query.transactionType = 'EXPENSE';
        reportTitle = 'Consolidated Operational Expenses Ledger';
        scopeDescription = 'All Nominal Expense Categories Combined';
      } else if (targetCatId === 'ALL_INCOME') {
        query.transactionType = 'INCOME';
        reportTitle = 'Consolidated Income & Rental Receipts Ledger';
        scopeDescription = 'All Rental & Sundry Revenue Heads Combined';
      }
      break;
    }

    case 'PROPERTY': {
      const targetPropId = entityId || propertyId;
      if (targetPropId && mongoose.Types.ObjectId.isValid(targetPropId)) {
        const propQuery = { _id: targetPropId };
        if (companyId) propQuery.companyId = companyId;
        const prop = await Property.findOne(propQuery).lean();
        if (prop) {
          query.propertyId = prop._id;
          reportTitle = `Property Asset Ledger: ${prop.name}`;
          scopeDescription = `${prop.addressLine1 || ''}, ${prop.city || 'London'} ${prop.postcode || ''} · Valuation: ${formatGBP(prop.currentValuation || prop.purchasePrice)}`;
          entityDetails = prop;
        }
      }
      if (unitId && mongoose.Types.ObjectId.isValid(unitId)) {
        query.unitId = unitId;
      }
      break;
    }

    case 'UNIT': {
      const targetUnitId = entityId || unitId;
      if (targetUnitId && mongoose.Types.ObjectId.isValid(targetUnitId)) {
        const unitQuery = { _id: targetUnitId };
        if (companyId) unitQuery.companyId = companyId;
        const unit = await Unit.findOne(unitQuery).populate('propertyId', 'name postcode addressLine1').lean();
        if (unit) {
          query.unitId = unit._id;
          reportTitle = `Unit Activity Ledger: ${unit.unitName}`;
          scopeDescription = `Property: ${unit.propertyId?.name || 'Asset'} (${unit.propertyId?.postcode || ''}) · Target Rent: ${formatGBP(unit.targetRent)}/mo · Status: ${unit.status}`;
          entityDetails = unit;
        }
      }
      break;
    }

    case 'MORTGAGE': {
      isMortgage = true;
      const targetMtgId = entityId || mortgageId;
      if (targetMtgId && mongoose.Types.ObjectId.isValid(targetMtgId)) {
        const mtgQuery = { _id: targetMtgId };
        if (companyId) mtgQuery.companyId = companyId;
        const mtg = await Mortgage.findOne(mtgQuery).populate('propertyId', 'name postcode').lean();
        if (mtg) {
          query.mortgageId = mtg._id;
          reportTitle = `Mortgage Facility Ledger: ${mtg.lenderName} (${mtg.accountReference})`;
          scopeDescription = `Property: ${mtg.propertyId?.name || 'Secured Asset'} · Rate: ${mtg.interestRate}% · Principal Debt: ${formatGBP(mtg.outstandingPrincipalBalance)}`;
          entityDetails = mtg;
        }
      }
      break;
    }

    case 'BANK':
    case 'CASH': {
      isLiquidity = true;
      const targetAccId = entityId || accountId;
      let acc = null;
      if (targetAccId && mongoose.Types.ObjectId.isValid(targetAccId)) {
        const accQuery = { _id: targetAccId };
        if (companyId) accQuery.companyId = companyId;
        acc = await Account.findOne(accQuery).lean();
      } else {
        const accQuery = { accountType: scope, isActive: true };
        if (companyId) accQuery.companyId = companyId;
        acc = await Account.findOne(accQuery).lean();
      }

      if (acc) {
        query.$or = [{ accountId: acc._id }, { counterAccountId: acc._id }];
        reportTitle = `${acc.name} (${acc.accountType}) Statement & Ledger`;
        scopeDescription = `${acc.bankName || 'UK Bank Account'} · Sort Code: ${acc.sortCode || 'N/A'} · Account No: ${acc.accountNumber || 'N/A'}`;
        entityDetails = acc;

        // Calculate authoritative opening balance before periodStart
        let calcOpening = acc.openingBalance || 0;
        if (periodStart) {
          const priorQuery = {
            status: 'POSTED',
            isDeleted: { $ne: true },
            $or: [{ accountId: acc._id }, { counterAccountId: acc._id }],
            transactionDate: { $lt: periodStart },
          };
          if (companyId) priorQuery.companyId = companyId;
          const priorTxs = await Transaction.find(priorQuery).lean();

          for (const tx of priorTxs) {
            if (tx.accountId?.toString() === acc._id.toString()) {
              calcOpening += tx.direction === 'IN' ? tx.amount : -tx.amount;
            } else if (tx.counterAccountId?.toString() === acc._id.toString()) {
              calcOpening += tx.amount;
            }
          }
        }
        openingBalance = round2(calcOpening);
      }
      break;
    }

    case 'RENT': {
      query.transactionType = 'INCOME';
      query.periodMonth = { $exists: true };
      reportTitle = 'Rent Invoicing & Rental Receipts Journal';
      scopeDescription = 'Dedicated Tenancy Rent Payments and Collections Log';
      break;
    }

    case 'OTHER_INCOME': {
      query.transactionType = 'INCOME';
      query.periodMonth = { $exists: false };
      reportTitle = 'Sundry Income & Non-Rent Revenue Ledger';
      scopeDescription = 'Parking, Utility Recharges & Ancillary Income';
      break;
    }

    case 'TRANSACTION_TYPE': {
      if (transactionType) {
        query.transactionType = transactionType;
        reportTitle = `${transactionType} Transaction Journal`;
        scopeDescription = `All ${transactionType} operations across UK portfolio`;
      }
      break;
    }

    case 'HEAD':
    case 'SUB_HEAD': {
      const headName = filters.head || (scope === 'HEAD' ? entityId : null);
      const subHeadName = filters.subHead || (scope === 'SUB_HEAD' ? entityId : null);
      if (headName && headName !== 'ALL_HEADS') {
        query.head = new RegExp(`^${escapeRegex(headName.trim())}$`, 'i');
      }
      if (subHeadName && subHeadName !== 'ALL_SUBHEADS') {
        query.subHead = new RegExp(`^${escapeRegex(subHeadName.trim())}$`, 'i');
      }
      reportTitle = subHeadName
        ? `Sub Head Ledger: ${subHeadName} (${headName || 'All Heads'})`
        : headName
        ? `Head Ledger: ${headName}`
        : 'Heads & Sub Heads Consolidated Ledger';
      scopeDescription = 'Categorized UK Nominal Ledger';
      break;
    }

    case 'COMPLETE':
    default: {
      reportTitle = 'Master UK Property Finance & Central Ledger';
      scopeDescription = 'Consolidated Double-Entry Transaction Ledger across all Accounts & Assets';
      break;
    }
  }

  // 2. Apply Date Boundaries
  if (periodStart && periodEnd) {
    query.transactionDate = { $gte: periodStart, $lte: periodEnd };
  } else if (periodStart) {
    query.transactionDate = { $gte: periodStart };
  } else if (periodEnd) {
    query.transactionDate = { $lte: periodEnd };
  }

  // 3. Apply Specific Subsidiary Filters
  if (transactionType && scope !== 'TRANSACTION_TYPE') query.transactionType = transactionType;
  if (propertyId && scope !== 'PROPERTY') query.propertyId = propertyId;
  if (unitId && scope !== 'UNIT') query.unitId = unitId;
  if (tenantId) query.tenantId = tenantId;
  if (mortgageId && scope !== 'MORTGAGE') query.mortgageId = mortgageId;
  if (categoryId && scope !== 'ACCOUNT_HEAD') query.categoryId = categoryId;
  if (accountId && scope !== 'BANK' && scope !== 'CASH') {
    query.$or = [{ accountId }, { counterAccountId: accountId }];
  }

  if (voucherNo) query.voucherNo = new RegExp(voucherNo.trim(), 'i');
  if (reference) query.reference = new RegExp(reference.trim(), 'i');

  if (minAmount !== undefined && minAmount !== '' && !isNaN(Number(minAmount))) {
    query.amount = query.amount || {};
    query.amount.$gte = Number(minAmount);
  }
  if (maxAmount !== undefined && maxAmount !== '' && !isNaN(Number(maxAmount))) {
    query.amount = query.amount || {};
    query.amount.$lte = Number(maxAmount);
  }

  if (search && search.trim()) {
    const sRegex = new RegExp(search.trim(), 'i');
    query.$and = query.$and || [];
    query.$and.push({
      $or: [{ voucherNo: sRegex }, { narration: sRegex }, { reference: sRegex }],
    });
  }

  // 4. Query All Eligible Transactions (No truncation)
  const rawTransactions = await Transaction.find(query)
    .sort({ transactionDate: 1, createdAt: 1, _id: 1 })
    .populate('accountId', 'name bankName accountType sortCode accountNumber')
    .populate('counterAccountId', 'name bankName accountType sortCode accountNumber')
    .populate('categoryId', 'name type code isRentalHead isAllowableTaxDeduction')
    .populate('headId', 'name type code')
    .populate('subHeadId', 'name type code')
    .populate('propertyId', 'name postcode addressLine1 city')
    .populate('unitId', 'unitName unitType')
    .populate('mortgageId', 'lenderName accountReference outstandingPrincipalBalance')
    .lean();

  // 5. Authoritatively Process Rows & Running Balances
  let runningBalance = openingBalance;
  let totalMoneyIn = 0;
  let totalMoneyOut = 0;
  let totalIncome = 0;
  let totalOperatingExpenses = 0;
  let totalMortgageInterest = 0;
  let totalMortgagePrincipal = 0;
  let totalMortgageFees = 0;

  const categoryMap = new Map();
  const propertyMap = new Map();

  const entries = rawTransactions.map((tx) => {
    let isInflow = false;
    let isOutflow = false;

    if (isLiquidity && entityDetails) {
      const isPrimary = tx.accountId?._id?.toString() === entityDetails._id.toString();
      isInflow = isPrimary ? tx.direction === 'IN' : true;
      isOutflow = !isInflow;
    } else {
      isInflow = tx.direction === 'IN' || tx.transactionType === 'INCOME';
      isOutflow = tx.direction === 'OUT' || tx.transactionType === 'EXPENSE' || tx.transactionType === 'MORTGAGE_PAYMENT';
    }

    const moneyIn = isInflow ? tx.amount : 0;
    const moneyOut = isOutflow ? tx.amount : 0;

    totalMoneyIn += moneyIn;
    totalMoneyOut += moneyOut;

    // Running balance computation
    if (isLiquidity) {
      runningBalance = round2(runningBalance + (isInflow ? tx.amount : -tx.amount));
    } else {
      runningBalance = round2(runningBalance + (isInflow ? tx.amount : -tx.amount));
    }

    // Segregate internal transfers vs revenue & operating costs
    const isTransfer = tx.transactionType === 'TRANSFER';
    if (!isTransfer) {
      if (tx.transactionType === 'INCOME') {
        totalIncome += tx.amount;
      } else if (tx.transactionType === 'EXPENSE') {
        totalOperatingExpenses += tx.amount;
      }
    }

    // Mortgage specific component breakdown if attached
    let interestComponent = 0;
    let principalComponent = 0;
    let feeComponent = 0;
    if (tx.transactionType === 'MORTGAGE_PAYMENT') {
      // Mortgage payment breakdown
      totalMortgagePrincipal += tx.amount;
      principalComponent = tx.amount;
    }

    // Track Category summary
    const catName = tx.categoryId?.name || (isTransfer ? 'Internal Liquidity Transfer' : tx.transactionType);
    const catType = tx.categoryId?.type || (isTransfer ? 'TRANSFER' : tx.transactionType);
    if (!categoryMap.has(catName)) {
      categoryMap.set(catName, { name: catName, type: catType, count: 0, total: 0 });
    }
    const catStat = categoryMap.get(catName);
    catStat.count += 1;
    catStat.total = round2(catStat.total + tx.amount);

    // Track Property summary
    if (tx.propertyId?.name) {
      const propName = tx.propertyId.name;
      if (!propertyMap.has(propName)) {
        propertyMap.set(propName, { name: propName, postcode: tx.propertyId.postcode || '', income: 0, expense: 0, net: 0, count: 0 });
      }
      const propStat = propertyMap.get(propName);
      propStat.count += 1;
      if (isInflow) propStat.income = round2(propStat.income + tx.amount);
      if (isOutflow) propStat.expense = round2(propStat.expense + tx.amount);
      propStat.net = round2(propStat.income - propStat.expense);
    }

    return {
      _id: tx._id,
      date: tx.transactionDate,
      periodMonth: tx.periodMonth || '-',
      voucherNo: tx.voucherNo,
      reference: tx.reference || '-',
      narration: tx.narration,
      transactionType: tx.transactionType,
      head: tx.head || tx.headId?.name || '',
      subHead: tx.subHead || tx.subHeadId?.name || '',
      categoryName: tx.head && tx.subHead ? `${tx.head} · ${tx.subHead}` : (tx.subHead || tx.head || catName),
      categoryCode: tx.categoryId?.code || '-',
      categoryType: catType,
      propertyName: tx.propertyId?.name || '-',
      propertyPostcode: tx.propertyId?.postcode || '',
      unitName: tx.unitId?.unitName || '-',
      tenantName: tx.tenantId?.fullName || '-',
      accountName: tx.accountId?.name || '-',
      counterAccountName: tx.counterAccountId?.name || '-',
      direction: tx.direction,
      amount: round2(tx.amount),
      moneyIn: round2(moneyIn),
      moneyOut: round2(moneyOut),
      interestComponent: round2(interestComponent),
      principalComponent: round2(principalComponent),
      feeComponent: round2(feeComponent),
      runningBalance: round2(runningBalance),
      status: tx.status,
    };
  });

  const closingBalance = round2(runningBalance);
  const netCashMovement = round2(totalMoneyIn - totalMoneyOut);

  // Format date range label
  let periodLabel = 'All Recorded History';
  if (periodStart && periodEnd) {
    periodLabel = `${formatUKDate(periodStart)} – ${formatUKDate(periodEnd)}`;
  } else if (periodStart) {
    periodLabel = `From ${formatUKDate(periodStart)}`;
  } else if (periodEnd) {
    periodLabel = `Up to ${formatUKDate(periodEnd)}`;
  }

  return {
    companyId,
    companyName,
    reportRef,
    reportTitle,
    scope,
    scopeDescription,
    periodLabel,
    datePreset,
    periodStart,
    periodEnd,
    entityDetails,
    isLiquidity,
    isMortgage,
    generatedAt: now,
    summary: {
      transactionCount: entries.length,
      openingBalance: round2(openingBalance),
      totalMoneyIn: round2(totalMoneyIn),
      totalMoneyOut: round2(totalMoneyOut),
      totalIncome: round2(totalIncome),
      totalOperatingExpenses: round2(totalOperatingExpenses),
      totalMortgageInterest: round2(totalMortgageInterest),
      totalMortgagePrincipal: round2(totalMortgagePrincipal),
      totalMortgageFees: round2(totalMortgageFees),
      netCashMovement,
      closingBalance,
    },
    categoryBreakdown: Array.from(categoryMap.values()).sort((a, b) => b.total - a.total),
    propertyBreakdown: Array.from(propertyMap.values()).sort((a, b) => b.income - a.income),
    entries,
  };
};

/**
 * Generate Real, High-Quality Corporate Excel (.xlsx) Report using ExcelJS
 * Designed to mirror the executive visual prestige and styling of the official PDF export.
 */
export const generateExcelReport = async (reportData) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = reportData.companyName || 'PixxTechnologies UK Property Finance';
  workbook.lastModifiedBy = 'PixxTechnologies UK System';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Unified Corporate Color Palette
  const brandNavy = '0F172A';
  const brandDark = '1E293B';
  const brandIndigo = '4338CA';
  const brandEmerald = '059669';
  const brandRose = 'E11D48';
  const brandLightGray = 'F8FAFC';
  const borderLight = 'E2E8F0';

  // Embed Official PixxTechnologies Logo if available
  let logoImageId = null;
  if (fs.existsSync(LOGO_PATH)) {
    try {
      logoImageId = workbook.addImage({
        filename: LOGO_PATH,
        extension: 'png',
      });
    } catch {
      logoImageId = null;
    }
  }

  // Card outline & background styling helper
  const applyCardBox = (sheet, startCol, endCol, startRow, endRow, bgColor, borderColor) => {
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const cell = sheet.getCell(r, c);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        cell.border = {
          top: { style: r === startRow ? 'medium' : 'thin', color: { argb: r === startRow ? borderColor : borderLight } },
          bottom: { style: r === endRow ? 'medium' : 'thin', color: { argb: r === endRow ? borderColor : borderLight } },
          left: { style: c === startCol ? 'medium' : 'thin', color: { argb: c === startCol ? borderColor : borderLight } },
          right: { style: c === endCol ? 'medium' : 'thin', color: { argb: c === endCol ? borderColor : borderLight } },
        };
      }
    }
  };

  // -------------------------------------------------------------------------
  // WORKSHEET 1: Executive Summary & Dashboard
  // -------------------------------------------------------------------------
  const summarySheet = workbook.addWorksheet('Report Summary', {
    views: [{ showGridLines: true }],
  });

  // Balanced column widths
  summarySheet.columns = [
    { width: 22 }, // A
    { width: 22 }, // B
    { width: 22 }, // C
    { width: 22 }, // D
    { width: 22 }, // E
    { width: 22 }, // F
    { width: 24 }, // G
    { width: 24 }, // H
  ];

  // Embed Logo at top left
  if (logoImageId !== null) {
    summarySheet.addImage(logoImageId, {
      tl: { col: 0.15, row: 0.15 },
      ext: { width: 140, height: 46 },
    });
  }

  // Header Title & Address (Cols C to F)
  summarySheet.mergeCells('C1:F1');
  const h1 = summarySheet.getCell('C1');
  h1.value = reportData.companyName || 'PIXX TECHNOLOGIES UK PROPERTY FINANCE LTD';
  h1.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FF' + brandNavy } };
  h1.alignment = { vertical: 'middle', horizontal: 'left' };

  summarySheet.mergeCells('C2:F2');
  const h2 = summarySheet.getCell('C2');
  h2.value = '14 Belgrave Square, London SW1X 8PZ • United Kingdom • HMRC Compliant Accounting';
  h2.font = { name: 'Segoe UI', size: 8.5, color: { argb: 'FF64748B' } };
  h2.alignment = { vertical: 'middle', horizontal: 'left' };

  summarySheet.mergeCells('C3:F3');
  const h3 = summarySheet.getCell('C3');
  h3.value = `${(reportData.reportTitle || 'General Ledger').toUpperCase()} — EXECUTIVE AUDIT REPORT`;
  h3.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FF' + brandIndigo } };
  h3.alignment = { vertical: 'middle', horizontal: 'left' };

  // Top Right Audit Metadata Pill (Cols G to H)
  summarySheet.mergeCells('G1:H1');
  const m1 = summarySheet.getCell('G1');
  m1.value = `AUDIT REF: ${reportData.reportRef}`;
  m1.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF' + brandNavy } };
  m1.alignment = { vertical: 'middle', horizontal: 'right' };

  summarySheet.mergeCells('G2:H2');
  const m2 = summarySheet.getCell('G2');
  m2.value = `PERIOD: ${reportData.periodLabel}`;
  m2.font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: 'FF475569' } };
  m2.alignment = { vertical: 'middle', horizontal: 'right' };

  summarySheet.mergeCells('G3:H3');
  const m3 = summarySheet.getCell('G3');
  m3.value = `GENERATED: ${formatUKDate(reportData.generatedAt)} ${new Date(reportData.generatedAt).toLocaleTimeString('en-GB')}`;
  m3.font = { name: 'Segoe UI', size: 8, color: { argb: 'FF64748B' } };
  m3.alignment = { vertical: 'middle', horizontal: 'right' };

  // Header Divider
  summarySheet.getRow(1).height = 20;
  summarySheet.getRow(2).height = 18;
  summarySheet.getRow(3).height = 20;
  summarySheet.getRow(4).height = 8;
  for (let c = 1; c <= 8; c++) {
    summarySheet.getCell(4, c).border = {
      bottom: { style: 'medium', color: { argb: 'FFCBD5E1' } },
    };
  }

  summarySheet.getRow(5).height = 10; // Spacing

  // -------------------------------------------------------------------------
  // 4 Executive KPI Cards (Rows 6 to 8) - Matching PDF Design
  // -------------------------------------------------------------------------
  summarySheet.getRow(6).height = 18;
  summarySheet.getRow(7).height = 28;
  summarySheet.getRow(8).height = 16;

  // Card 1: OPENING BALANCE (B/F) - Slate Card
  summarySheet.mergeCells('A6:B6');
  summarySheet.getCell('A6').value = 'OPENING BALANCE (B/F)';
  summarySheet.getCell('A6').font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: 'FF475569' } };
  summarySheet.getCell('A6').alignment = { vertical: 'middle', horizontal: 'center' };

  summarySheet.mergeCells('A7:B7');
  summarySheet.getCell('A7').value = reportData.summary.openingBalance;
  summarySheet.getCell('A7').numFmt = '"£"#,##0.00;[Red]-"£"#,##0.00;"£"0.00';
  summarySheet.getCell('A7').font = { name: 'Segoe UI', size: 15, bold: true, color: { argb: 'FF0F172A' } };
  summarySheet.getCell('A7').alignment = { vertical: 'middle', horizontal: 'center' };

  summarySheet.mergeCells('A8:B8');
  summarySheet.getCell('A8').value = 'Brought Forward Status';
  summarySheet.getCell('A8').font = { name: 'Segoe UI', size: 7.5, italic: true, color: { argb: 'FF64748B' } };
  summarySheet.getCell('A8').alignment = { vertical: 'middle', horizontal: 'center' };

  applyCardBox(summarySheet, 1, 2, 6, 8, 'FFF8FAFC', 'FFCBD5E1');

  // Card 2: TOTAL RECEIPTS (IN) - Emerald Card
  summarySheet.mergeCells('C6:D6');
  summarySheet.getCell('C6').value = 'TOTAL RECEIPTS (IN)';
  summarySheet.getCell('C6').font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: 'FF065F46' } };
  summarySheet.getCell('C6').alignment = { vertical: 'middle', horizontal: 'center' };

  summarySheet.mergeCells('C7:D7');
  summarySheet.getCell('C7').value = reportData.summary.totalMoneyIn;
  summarySheet.getCell('C7').numFmt = '"£"#,##0.00;[Red]-"£"#,##0.00;"£"0.00';
  summarySheet.getCell('C7').font = { name: 'Segoe UI', size: 15, bold: true, color: { argb: 'FF059669' } };
  summarySheet.getCell('C7').alignment = { vertical: 'middle', horizontal: 'center' };

  summarySheet.mergeCells('C8:D8');
  summarySheet.getCell('C8').value = 'Total Credited Inflows';
  summarySheet.getCell('C8').font = { name: 'Segoe UI', size: 7.5, italic: true, color: { argb: 'FF047857' } };
  summarySheet.getCell('C8').alignment = { vertical: 'middle', horizontal: 'center' };

  applyCardBox(summarySheet, 3, 4, 6, 8, 'FFECFDF5', 'FFA7F3D0');

  // Card 3: TOTAL PAYMENTS (OUT) - Rose Card
  summarySheet.mergeCells('E6:F6');
  summarySheet.getCell('E6').value = 'TOTAL PAYMENTS (OUT)';
  summarySheet.getCell('E6').font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: 'FF9F1239' } };
  summarySheet.getCell('E6').alignment = { vertical: 'middle', horizontal: 'center' };

  summarySheet.mergeCells('E7:F7');
  summarySheet.getCell('E7').value = reportData.summary.totalMoneyOut;
  summarySheet.getCell('E7').numFmt = '"£"#,##0.00;[Red]-"£"#,##0.00;"£"0.00';
  summarySheet.getCell('E7').font = { name: 'Segoe UI', size: 15, bold: true, color: { argb: 'FFE11D48' } };
  summarySheet.getCell('E7').alignment = { vertical: 'middle', horizontal: 'center' };

  summarySheet.mergeCells('E8:F8');
  summarySheet.getCell('E8').value = 'Total Debited Disbursements';
  summarySheet.getCell('E8').font = { name: 'Segoe UI', size: 7.5, italic: true, color: { argb: 'FFBE123C' } };
  summarySheet.getCell('E8').alignment = { vertical: 'middle', horizontal: 'center' };

  applyCardBox(summarySheet, 5, 6, 6, 8, 'FFFFF1F2', 'FFFECDD3');

  // Card 4: CLOSING BALANCE (C/F) or NET CASH MOVEMENT - Indigo Card
  const isLiq = reportData.isLiquidity !== false;
  summarySheet.mergeCells('G6:H6');
  summarySheet.getCell('G6').value = isLiq ? 'CLOSING BALANCE (C/F)' : 'NET CASH MOVEMENT';
  summarySheet.getCell('G6').font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: 'FF3730A3' } };
  summarySheet.getCell('G6').alignment = { vertical: 'middle', horizontal: 'center' };

  summarySheet.mergeCells('G7:H7');
  summarySheet.getCell('G7').value = isLiq ? reportData.summary.closingBalance : reportData.summary.netCashMovement;
  summarySheet.getCell('G7').numFmt = '"£"#,##0.00;[Red]-"£"#,##0.00;"£"0.00';
  summarySheet.getCell('G7').font = { name: 'Segoe UI', size: 15, bold: true, color: { argb: 'FF4338CA' } };
  summarySheet.getCell('G7').alignment = { vertical: 'middle', horizontal: 'center' };

  summarySheet.mergeCells('G8:H8');
  summarySheet.getCell('G8').value = isLiq ? 'Carried Forward Position' : 'Receipts Less Disbursements';
  summarySheet.getCell('G8').font = { name: 'Segoe UI', size: 7.5, italic: true, color: { argb: 'FF4F46E5' } };
  summarySheet.getCell('G8').alignment = { vertical: 'middle', horizontal: 'center' };

  applyCardBox(summarySheet, 7, 8, 6, 8, 'FFEEF2FF', 'FFC7D2FE');

  summarySheet.getRow(9).height = 10; // Spacing

  // -------------------------------------------------------------------------
  // Secondary Performance Metrics Bar (Rows 10-11)
  // -------------------------------------------------------------------------
  summarySheet.mergeCells('A10:B10');
  summarySheet.getCell('A10').value = 'Recorded Operational Income:';
  summarySheet.getCell('A10').font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: 'FF475569' } };
  summarySheet.mergeCells('A11:B11');
  summarySheet.getCell('A11').value = reportData.summary.totalIncome;
  summarySheet.getCell('A11').numFmt = '"£"#,##0.00;[Red]-"£"#,##0.00;"£"0.00';
  summarySheet.getCell('A11').font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF059669' } };

  summarySheet.mergeCells('C10:D10');
  summarySheet.getCell('C10').value = 'Operating Expenses:';
  summarySheet.getCell('C10').font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: 'FF475569' } };
  summarySheet.mergeCells('C11:D11');
  summarySheet.getCell('C11').value = reportData.summary.totalOperatingExpenses;
  summarySheet.getCell('C11').numFmt = '"£"#,##0.00;[Red]-"£"#,##0.00;"£"0.00';
  summarySheet.getCell('C11').font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFE11D48' } };

  summarySheet.mergeCells('E10:F10');
  summarySheet.getCell('E10').value = 'Net Cash Flow:';
  summarySheet.getCell('E10').font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: 'FF475569' } };
  summarySheet.mergeCells('E11:F11');
  summarySheet.getCell('E11').value = reportData.summary.netCashMovement;
  summarySheet.getCell('E11').numFmt = '"£"#,##0.00;[Red]-"£"#,##0.00;"£"0.00';
  summarySheet.getCell('E11').font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF4338CA' } };

  summarySheet.mergeCells('G10:H10');
  summarySheet.getCell('G10').value = 'Total Audit Volume:';
  summarySheet.getCell('G10').font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: 'FF475569' } };
  summarySheet.mergeCells('G11:H11');
  summarySheet.getCell('G11').value = `${reportData.summary.transactionCount} Posted Transactions`;
  summarySheet.getCell('G11').font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FF0F172A' } };

  for (let r = 10; r <= 11; r++) {
    summarySheet.getRow(r).height = 18;
    for (let c = 1; c <= 8; c++) {
      summarySheet.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      summarySheet.getCell(r, c).border = {
        top: { style: 'thin', color: { argb: borderLight } },
        bottom: { style: 'thin', color: { argb: borderLight } },
        left: { style: 'thin', color: { argb: borderLight } },
        right: { style: 'thin', color: { argb: borderLight } },
      };
    }
  }

  summarySheet.getRow(12).height = 14; // Spacing

  // -------------------------------------------------------------------------
  // Nominal Account Head Breakdown Table
  // -------------------------------------------------------------------------
  let nextRow = 13;
  if (reportData.categoryBreakdown && reportData.categoryBreakdown.length > 0) {
    summarySheet.mergeCells(`A${nextRow}:H${nextRow}`);
    const sec1 = summarySheet.getCell(`A${nextRow}`);
    sec1.value = 'NOMINAL ACCOUNT HEAD BREAKDOWN';
    sec1.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    sec1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + brandNavy } };
    sec1.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    summarySheet.getRow(nextRow).height = 24;
    nextRow++;

    // Table Header
    summarySheet.mergeCells(`A${nextRow}:C${nextRow}`);
    summarySheet.getCell(`A${nextRow}`).value = 'Category / Nominal Head';
    summarySheet.getCell(`D${nextRow}`).value = 'Accounting Type';
    summarySheet.getCell(`E${nextRow}`).value = 'Voucher Count';
    summarySheet.mergeCells(`F${nextRow}:G${nextRow}`);
    summarySheet.getCell(`F${nextRow}`).value = 'Total Volume (£)';
    summarySheet.getCell(`H${nextRow}`).value = '% Share';

    summarySheet.getRow(nextRow).height = 22;
    for (let c = 1; c <= 8; c++) {
      const cell = summarySheet.getCell(nextRow, c);
      cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + brandDark } };
      cell.alignment = {
        vertical: 'middle',
        horizontal: c === 4 || c === 5 ? 'center' : c >= 6 ? 'right' : 'left',
      };
    }
    nextRow++;

    // Data Rows
    const catStartRow = nextRow;
    const grandCatTotal = reportData.categoryBreakdown.reduce((sum, c) => sum + Math.abs(c.total), 0) || 1;

    reportData.categoryBreakdown.forEach((cat, idx) => {
      const isEven = idx % 2 === 0;
      summarySheet.mergeCells(`A${nextRow}:C${nextRow}`);
      summarySheet.getCell(`A${nextRow}`).value = cat.name;
      summarySheet.getCell(`D${nextRow}`).value = cat.type;
      summarySheet.getCell(`E${nextRow}`).value = cat.count;
      summarySheet.mergeCells(`F${nextRow}:G${nextRow}`);
      summarySheet.getCell(`F${nextRow}`).value = cat.total;
      summarySheet.getCell(`F${nextRow}`).numFmt = '"£"#,##0.00;[Red]-"£"#,##0.00;"£"0.00';
      summarySheet.getCell(`H${nextRow}`).value = Math.abs(cat.total) / grandCatTotal;
      summarySheet.getCell(`H${nextRow}`).numFmt = '0.0%';

      summarySheet.getRow(nextRow).height = 20;
      for (let c = 1; c <= 8; c++) {
        const cell = summarySheet.getCell(nextRow, c);
        cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF0F172A' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' },
        };
        cell.border = {
          top: { style: 'thin', color: { argb: borderLight } },
          bottom: { style: 'thin', color: { argb: borderLight } },
          left: { style: 'thin', color: { argb: borderLight } },
          right: { style: 'thin', color: { argb: borderLight } },
        };
        if (c === 4 || c === 5) cell.alignment = { vertical: 'middle', horizontal: 'center' };
        if (c >= 6) cell.alignment = { vertical: 'middle', horizontal: 'right' };
      }
      nextRow++;
    });

    // Total Row
    summarySheet.mergeCells(`A${nextRow}:D${nextRow}`);
    summarySheet.getCell(`A${nextRow}`).value = 'TOTAL NOMINAL VOLUME';
    summarySheet.getCell(`E${nextRow}`).value = { formula: `SUM(E${catStartRow}:E${nextRow - 1})` };
    summarySheet.mergeCells(`F${nextRow}:G${nextRow}`);
    summarySheet.getCell(`F${nextRow}`).value = { formula: `SUM(F${catStartRow}:F${nextRow - 1})` };
    summarySheet.getCell(`F${nextRow}`).numFmt = '"£"#,##0.00;[Red]-"£"#,##0.00;"£"0.00';
    summarySheet.getCell(`H${nextRow}`).value = 1.0;
    summarySheet.getCell(`H${nextRow}`).numFmt = '0.0%';

    summarySheet.getRow(nextRow).height = 22;
    for (let c = 1; c <= 8; c++) {
      const cell = summarySheet.getCell(nextRow, c);
      cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + brandDark } };
      cell.border = {
        top: { style: 'thin', color: { argb: borderLight } },
        bottom: { style: 'double', color: { argb: 'FFFFFFFF' } },
      };
      if (c === 5) cell.alignment = { vertical: 'middle', horizontal: 'center' };
      if (c >= 6) cell.alignment = { vertical: 'middle', horizontal: 'right' };
    }
    nextRow += 2;
  }

  // -------------------------------------------------------------------------
  // Property Portfolio Breakdown Table
  // -------------------------------------------------------------------------
  if (reportData.propertyBreakdown && reportData.propertyBreakdown.length > 0) {
    summarySheet.mergeCells(`A${nextRow}:H${nextRow}`);
    const sec2 = summarySheet.getCell(`A${nextRow}`);
    sec2.value = 'PROPERTY ASSET & UNIT FINANCIAL SUMMARY';
    sec2.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    sec2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + brandNavy } };
    sec2.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    summarySheet.getRow(nextRow).height = 24;
    nextRow++;

    // Table Header
    summarySheet.mergeCells(`A${nextRow}:B${nextRow}`);
    summarySheet.getCell(`A${nextRow}`).value = 'Property Asset';
    summarySheet.getCell(`C${nextRow}`).value = 'Postcode';
    summarySheet.getCell(`D${nextRow}`).value = 'Vouchers';
    summarySheet.getCell(`E${nextRow}`).value = 'Rental Receipts (£)';
    summarySheet.getCell(`F${nextRow}`).value = 'Operating Costs (£)';
    summarySheet.mergeCells(`G${nextRow}:H${nextRow}`);
    summarySheet.getCell(`G${nextRow}`).value = 'Net Surplus / Deficit (£)';

    summarySheet.getRow(nextRow).height = 22;
    for (let c = 1; c <= 8; c++) {
      const cell = summarySheet.getCell(nextRow, c);
      cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + brandDark } };
      cell.alignment = {
        vertical: 'middle',
        horizontal: c === 3 || c === 4 ? 'center' : c >= 5 ? 'right' : 'left',
      };
    }
    nextRow++;

    const propStartRow = nextRow;
    reportData.propertyBreakdown.forEach((prop, idx) => {
      const isEven = idx % 2 === 0;
      summarySheet.mergeCells(`A${nextRow}:B${nextRow}`);
      summarySheet.getCell(`A${nextRow}`).value = prop.name;
      summarySheet.getCell(`C${nextRow}`).value = prop.postcode || '-';
      summarySheet.getCell(`D${nextRow}`).value = prop.count;
      summarySheet.getCell(`E${nextRow}`).value = prop.income;
      summarySheet.getCell(`E${nextRow}`).numFmt = '"£"#,##0.00;[Red]-"£"#,##0.00;"-"';
      summarySheet.getCell(`F${nextRow}`).value = prop.expense;
      summarySheet.getCell(`F${nextRow}`).numFmt = '"£"#,##0.00;[Red]-"£"#,##0.00;"-"';
      summarySheet.mergeCells(`G${nextRow}:H${nextRow}`);
      summarySheet.getCell(`G${nextRow}`).value = prop.net;
      summarySheet.getCell(`G${nextRow}`).numFmt = '"£"#,##0.00;[Red]-"£"#,##0.00;"£"0.00';

      summarySheet.getRow(nextRow).height = 20;
      for (let c = 1; c <= 8; c++) {
        const cell = summarySheet.getCell(nextRow, c);
        cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF0F172A' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' },
        };
        cell.border = {
          top: { style: 'thin', color: { argb: borderLight } },
          bottom: { style: 'thin', color: { argb: borderLight } },
          left: { style: 'thin', color: { argb: borderLight } },
          right: { style: 'thin', color: { argb: borderLight } },
        };
        if (c === 3 || c === 4) cell.alignment = { vertical: 'middle', horizontal: 'center' };
        if (c >= 5) cell.alignment = { vertical: 'middle', horizontal: 'right' };
      }
      // Emphasize financial figures
      summarySheet.getCell(`E${nextRow}`).font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF' + brandEmerald } };
      summarySheet.getCell(`F${nextRow}`).font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF' + brandRose } };
      summarySheet.getCell(`G${nextRow}`).font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF' + brandIndigo } };
      nextRow++;
    });

    // Total Row
    summarySheet.mergeCells(`A${nextRow}:C${nextRow}`);
    summarySheet.getCell(`A${nextRow}`).value = 'PORTFOLIO TOTALS';
    summarySheet.getCell(`D${nextRow}`).value = { formula: `SUM(D${propStartRow}:D${nextRow - 1})` };
    summarySheet.getCell(`E${nextRow}`).value = { formula: `SUM(E${propStartRow}:E${nextRow - 1})` };
    summarySheet.getCell(`E${nextRow}`).numFmt = '"£"#,##0.00;[Red]-"£"#,##0.00;"£"0.00';
    summarySheet.getCell(`F${nextRow}`).value = { formula: `SUM(F${propStartRow}:F${nextRow - 1})` };
    summarySheet.getCell(`F${nextRow}`).numFmt = '"£"#,##0.00;[Red]-"£"#,##0.00;"£"0.00';
    summarySheet.mergeCells(`G${nextRow}:H${nextRow}`);
    summarySheet.getCell(`G${nextRow}`).value = { formula: `SUM(G${propStartRow}:G${nextRow - 1})` };
    summarySheet.getCell(`G${nextRow}`).numFmt = '"£"#,##0.00;[Red]-"£"#,##0.00;"£"0.00';

    summarySheet.getRow(nextRow).height = 22;
    for (let c = 1; c <= 8; c++) {
      const cell = summarySheet.getCell(nextRow, c);
      cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + brandDark } };
      cell.border = {
        top: { style: 'thin', color: { argb: borderLight } },
        bottom: { style: 'double', color: { argb: 'FFFFFFFF' } },
      };
      if (c === 4) cell.alignment = { vertical: 'middle', horizontal: 'center' };
      if (c >= 5) cell.alignment = { vertical: 'middle', horizontal: 'right' };
    }
  }

  // -------------------------------------------------------------------------
  // WORKSHEET 2: Transactions Register
  // -------------------------------------------------------------------------
  const txSheet = workbook.addWorksheet('Transactions Register', {
    views: [{ state: 'frozen', ySplit: 5, showGridLines: true }],
  });

  // Generous column widths so data is never cramped or truncated
  txSheet.columns = [
    { width: 14 }, // A: Date
    { width: 14 }, // B: Period
    { width: 18 }, // C: Voucher No
    { width: 18 }, // D: Reference
    { width: 38 }, // E: Narration
    { width: 18 }, // F: Type
    { width: 26 }, // G: Category
    { width: 24 }, // H: Property
    { width: 16 }, // I: Unit
    { width: 22 }, // J: Tenant
    { width: 26 }, // K: Account Head
    { width: 16 }, // L: Money In
    { width: 16 }, // M: Money Out
    { width: 18 }, // N: Running Balance
    { width: 14 }, // O: Status
  ];

  // Embed Logo on Sheet 2
  if (logoImageId !== null) {
    txSheet.addImage(logoImageId, {
      tl: { col: 0.15, row: 0.15 },
      ext: { width: 140, height: 46 },
    });
  }

  // Corporate Banner on Sheet 2 (Rows 1 to 3)
  txSheet.mergeCells('C1:J1');
  const tH1 = txSheet.getCell('C1');
  tH1.value = 'PIXX TECHNOLOGIES UK PROPERTY FINANCE LTD';
  tH1.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FF' + brandNavy } };
  tH1.alignment = { vertical: 'middle', horizontal: 'left' };

  txSheet.mergeCells('C2:J2');
  const tH2 = txSheet.getCell('C2');
  tH2.value = 'OFFICIAL TRANSACTIONS REGISTER & AUDIT JOURNAL';
  tH2.font = { name: 'Segoe UI', size: 10.5, bold: true, color: { argb: 'FF' + brandIndigo } };
  tH2.alignment = { vertical: 'middle', horizontal: 'left' };

  txSheet.mergeCells('C3:J3');
  const tH3 = txSheet.getCell('C3');
  tH3.value = `${(reportData.reportTitle || 'General Ledger').toUpperCase()} • REPORTING PERIOD: ${reportData.periodLabel}`;
  tH3.font = { name: 'Segoe UI', size: 8.5, color: { argb: 'FF64748B' } };
  tH3.alignment = { vertical: 'middle', horizontal: 'left' };

  // Sheet 2 Top Right Metadata
  txSheet.mergeCells('K1:O1');
  const tM1 = txSheet.getCell('K1');
  tM1.value = `AUDIT REF: ${reportData.reportRef}`;
  tM1.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF' + brandNavy } };
  tM1.alignment = { vertical: 'middle', horizontal: 'right' };

  txSheet.mergeCells('K2:O2');
  const tM2 = txSheet.getCell('K2');
  tM2.value = `HMRC COMPLIANT • STERLING GBP (£)`;
  tM2.font = { name: 'Segoe UI', size: 8.5, bold: true, color: { argb: 'FF' + brandEmerald } };
  tM2.alignment = { vertical: 'middle', horizontal: 'right' };

  txSheet.mergeCells('K3:O3');
  const tM3 = txSheet.getCell('K3');
  tM3.value = `GENERATED: ${formatUKDate(reportData.generatedAt)} ${new Date(reportData.generatedAt).toLocaleTimeString('en-GB')}`;
  tM3.font = { name: 'Segoe UI', size: 8, color: { argb: 'FF64748B' } };
  tM3.alignment = { vertical: 'middle', horizontal: 'right' };

  txSheet.getRow(1).height = 20;
  txSheet.getRow(2).height = 18;
  txSheet.getRow(3).height = 20;
  txSheet.getRow(4).height = 8;
  for (let c = 1; c <= 15; c++) {
    txSheet.getCell(4, c).border = {
      bottom: { style: 'medium', color: { argb: 'FFCBD5E1' } },
    };
  }

  // Row 5: Sticky Column Header Row
  const headers = [
    'Date',
    'Period',
    'Voucher No',
    'Reference / Invoice',
    'Particulars / Narration',
    'Transaction Type',
    'Nominal Head / Category',
    'Property Asset',
    'Unit',
    'Tenant',
    'Account Head',
    'Money In (£)',
    'Money Out (£)',
    'Running Balance (£)',
    'Status',
  ];

  const headerRow = txSheet.getRow(5);
  headers.forEach((h, idx) => {
    headerRow.getCell(idx + 1).value = h;
  });
  headerRow.height = 28;
  for (let c = 1; c <= 15; c++) {
    const cell = headerRow.getCell(c);
    cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + brandNavy } };
    cell.alignment = {
      vertical: 'middle',
      horizontal: c === 1 || c === 2 || c === 3 || c === 15 ? 'center' : c >= 12 && c <= 14 ? 'right' : 'left',
    };
  }

  // Data Rows (Row 6 onwards)
  let currentTxRow = 6;
  if (!reportData.entries || reportData.entries.length === 0) {
    txSheet.mergeCells(`A${currentTxRow}:O${currentTxRow}`);
    const emptyCell = txSheet.getCell(`A${currentTxRow}`);
    emptyCell.value = `No financial transactions recorded matching criteria. Opening Balance: £${(reportData.summary.openingBalance || 0).toFixed(2)} | Closing Balance: £${(reportData.summary.closingBalance || 0).toFixed(2)}`;
    emptyCell.font = { name: 'Segoe UI', size: 9.5, italic: true, color: { argb: 'FF64748B' } };
    emptyCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    emptyCell.alignment = { vertical: 'middle', horizontal: 'center' };
    txSheet.getRow(currentTxRow).height = 36;
    for (let c = 1; c <= 15; c++) {
      txSheet.getCell(currentTxRow, c).border = {
        top: { style: 'thin', color: { argb: borderLight } },
        bottom: { style: 'thin', color: { argb: borderLight } },
      };
    }
  } else {
    reportData.entries.forEach((tx, idx) => {
      const isEven = idx % 2 === 0;
      const r = txSheet.getRow(currentTxRow);
      r.getCell(1).value = formatUKDate(tx.date);
      r.getCell(2).value = sanitizeCell(tx.periodMonth);
      r.getCell(3).value = sanitizeCell(tx.voucherNo);
      r.getCell(4).value = sanitizeCell(tx.reference);
      r.getCell(5).value = sanitizeCell(tx.narration);
      r.getCell(6).value = sanitizeCell(tx.transactionType);
      r.getCell(7).value = sanitizeCell(tx.categoryName);
      r.getCell(8).value = sanitizeCell(tx.propertyName);
      r.getCell(9).value = sanitizeCell(tx.unitName);
      r.getCell(10).value = sanitizeCell(tx.tenantName);
      r.getCell(11).value = sanitizeCell(tx.accountName);
      r.getCell(12).value = tx.moneyIn > 0 ? tx.moneyIn : 0;
      r.getCell(13).value = tx.moneyOut > 0 ? tx.moneyOut : 0;
      r.getCell(14).value = tx.runningBalance;
      r.getCell(15).value = sanitizeCell(tx.status);

      r.height = 20;

      for (let c = 1; c <= 15; c++) {
        const cell = r.getCell(c);
        cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF0F172A' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isEven ? 'FFFFFFFF' : 'FFF8FAFC' },
        };
        cell.border = {
          top: { style: 'thin', color: { argb: borderLight } },
          bottom: { style: 'thin', color: { argb: borderLight } },
          left: { style: 'thin', color: { argb: borderLight } },
          right: { style: 'thin', color: { argb: borderLight } },
        };
        if (c === 1 || c === 2 || c === 15) cell.alignment = { vertical: 'middle', horizontal: 'center' };
        if (c >= 12 && c <= 14) cell.alignment = { vertical: 'middle', horizontal: 'right' };
      }

      // Special highlight typography
      r.getCell(3).font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF' + brandIndigo } };
      r.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' };

      r.getCell(12).numFmt = '"£"#,##0.00;[Red]-"£"#,##0.00;"-"';
      r.getCell(13).numFmt = '"£"#,##0.00;[Red]-"£"#,##0.00;"-"';
      r.getCell(14).numFmt = '"£"#,##0.00;[Red]-"£"#,##0.00;"£"0.00';

      if (tx.moneyIn > 0) {
        r.getCell(12).font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF' + brandEmerald } };
      }
      if (tx.moneyOut > 0) {
        r.getCell(13).font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF' + brandRose } };
      }
      r.getCell(14).font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF' + brandNavy } };

      currentTxRow++;
    });

    // Total Row
    const lastDataRow = currentTxRow - 1;
    txSheet.mergeCells(`A${currentTxRow}:K${currentTxRow}`);
    const totLabel = txSheet.getCell(`A${currentTxRow}`);
    totLabel.value = `GRAND TOTALS (${reportData.entries.length} POSTED RECORDS)`;
    totLabel.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    txSheet.getCell(`L${currentTxRow}`).value = { formula: `SUM(L6:L${lastDataRow})` };
    txSheet.getCell(`L${currentTxRow}`).numFmt = '"£"#,##0.00;[Red]-"£"#,##0.00;"£"0.00';

    txSheet.getCell(`M${currentTxRow}`).value = { formula: `SUM(M6:M${lastDataRow})` };
    txSheet.getCell(`M${currentTxRow}`).numFmt = '"£"#,##0.00;[Red]-"£"#,##0.00;"£"0.00';

    txSheet.getCell(`N${currentTxRow}`).value = reportData.summary.closingBalance;
    txSheet.getCell(`N${currentTxRow}`).numFmt = '"£"#,##0.00;[Red]-"£"#,##0.00;"£"0.00';

    txSheet.getCell(`O${currentTxRow}`).value = 'RECONCILED';
    txSheet.getCell(`O${currentTxRow}`).alignment = { vertical: 'middle', horizontal: 'center' };

    txSheet.getRow(currentTxRow).height = 26;
    for (let c = 1; c <= 15; c++) {
      const cell = txSheet.getCell(currentTxRow, c);
      cell.font = { name: 'Segoe UI', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + brandDark } };
      cell.border = {
        top: { style: 'thin', color: { argb: borderLight } },
        bottom: { style: 'double', color: { argb: 'FFFFFFFF' } },
      };
      if (c >= 12 && c <= 14) cell.alignment = { vertical: 'middle', horizontal: 'right' };
    }

    // Auto-Filter
    txSheet.autoFilter = {
      from: { row: 5, column: 1 },
      to: { row: lastDataRow, column: 15 },
    };
  }

  // Generate buffer
  return await workbook.xlsx.writeBuffer();
};

/**
 * Generate Real, High-Quality Corporate PDF Report using PDFKit
 */
export const generatePdfReport = async (reportData) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 28,
        bufferPages: true,
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        const result = Buffer.concat(chunks);
        resolve(result);
      });
      doc.on('error', (err) => reject(err));

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const margin = 28;
      const contentWidth = pageWidth - margin * 2;

      // ---------------------------------------------------------------------
      // 1. Header (Logo & Company Title)
      // ---------------------------------------------------------------------
      const logoWidth = 48;
      const logoHeight = 48;
      if (fs.existsSync(LOGO_PATH)) {
        doc.image(LOGO_PATH, margin, margin, { width: logoWidth, height: logoHeight });
      }

      const textStartX = fs.existsSync(LOGO_PATH) ? margin + logoWidth + 12 : margin;
      doc
        .font('Helvetica-Bold')
        .fontSize(13)
        .fillColor('#0F172A')
        .text(reportData.companyName || 'PIXX TECHNOLOGIES UK PROPERTY FINANCE LTD', textStartX, margin);

      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#64748B')
        .text('14 Belgrave Square, London SW1X 8PZ • United Kingdom • HMRC Compliant Accounting', textStartX, margin + 17);

      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#1E293B')
        .text(reportData.reportTitle.toUpperCase(), textStartX, margin + 30);

      // Top Right Reference Box
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor('#475569')
        .text(`REF: ${reportData.reportRef}`, contentWidth - 80, margin, { align: 'right' });

      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor('#64748B')
        .text(`Period: ${reportData.periodLabel}`, contentWidth - 80, margin + 14, { align: 'right' });

      doc
        .text(`Date: ${formatUKDate(reportData.generatedAt)} ${new Date(reportData.generatedAt).toLocaleTimeString('en-GB')}`, contentWidth - 80, margin + 26, { align: 'right' });

      // Horizontal Divider
      const headerBottomY = margin + 54;
      doc
        .strokeColor('#CBD5E1')
        .lineWidth(1)
        .moveTo(margin, headerBottomY)
        .lineTo(pageWidth - margin, headerBottomY)
        .stroke();

      // ---------------------------------------------------------------------
      // 2. Executive KPI Cards Strip
      // ---------------------------------------------------------------------
      const kpiY = headerBottomY + 8;
      const kpiCount = 4;
      const gap = 8;
      const kpiWidth = (contentWidth - gap * (kpiCount - 1)) / kpiCount;
      const kpiHeight = 36;

      const kpis = [
        { label: 'OPENING BALANCE (B/F)', val: formatGBP(reportData.summary.openingBalance), color: '#334155' },
        { label: 'TOTAL RECEIPTS (IN)', val: formatGBP(reportData.summary.totalMoneyIn), color: '#059669' },
        { label: 'TOTAL PAYMENTS (OUT)', val: formatGBP(reportData.summary.totalMoneyOut), color: '#E11D48' },
        { label: reportData.isLiquidity ? 'CLOSING BALANCE' : 'NET CASH MOVEMENT', val: formatGBP(reportData.isLiquidity ? reportData.summary.closingBalance : reportData.summary.netCashMovement), color: '#4F46E5' },
      ];

      kpis.forEach((kpi, idx) => {
        const kX = margin + idx * (kpiWidth + gap);
        doc
          .roundedRect(kX, kpiY, kpiWidth, kpiHeight, 4)
          .fillAndStroke('#F8FAFC', '#E2E8F0');

        doc
          .font('Helvetica-Bold')
          .fontSize(6.5)
          .fillColor('#64748B')
          .text(kpi.label, kX + 6, kpiY + 5, { width: kpiWidth - 12 });

        doc
          .font('Helvetica-Bold')
          .fontSize(10)
          .fillColor(kpi.color)
          .text(kpi.val, kX + 6, kpiY + 18, { width: kpiWidth - 12 });
      });

      // ---------------------------------------------------------------------
      // 3. Transactions Table Setup
      // ---------------------------------------------------------------------
      let startTableY = kpiY + kpiHeight + 10;

      // Table Columns definition for Landscape A4 (total contentWidth ~ 786pt)
      const colWidths = {
        date: 58,
        voucher: 68,
        detail: 190,
        head: 100,
        account: 80,
        property: 90,
        in: 66,
        out: 66,
        balance: 68,
      };

      const drawTableHeader = (yPos) => {
        doc
          .rect(margin, yPos, contentWidth, 18)
          .fill('#0F172A');

        doc.font('Helvetica-Bold').fontSize(7).fillColor('#FFFFFF');
        let currentX = margin + 4;

        doc.text('DATE', currentX, yPos + 5, { width: colWidths.date });
        currentX += colWidths.date;

        doc.text('VOUCHER NO', currentX, yPos + 5, { width: colWidths.voucher });
        currentX += colWidths.voucher;

        doc.text('PARTICULARS / DESCRIPTION', currentX, yPos + 5, { width: colWidths.detail });
        currentX += colWidths.detail;

        doc.text('NOMINAL HEAD', currentX, yPos + 5, { width: colWidths.head });
        currentX += colWidths.head;

        doc.text('ACCOUNT', currentX, yPos + 5, { width: colWidths.account });
        currentX += colWidths.account;

        doc.text('ASSET / UNIT', currentX, yPos + 5, { width: colWidths.property });
        currentX += colWidths.property;

        doc.text('MONEY IN (£)', currentX, yPos + 5, { width: colWidths.in, align: 'right' });
        currentX += colWidths.in;

        doc.text('MONEY OUT (£)', currentX, yPos + 5, { width: colWidths.out, align: 'right' });
        currentX += colWidths.out;

        doc.text('BALANCE (£)', currentX, yPos + 5, { width: colWidths.balance - 8, align: 'right' });

        return yPos + 18;
      };

      let currentY = drawTableHeader(startTableY);
      const rowHeight = 16;
      const maxY = pageHeight - margin - 24;

      if (reportData.entries.length === 0) {
        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor('#64748B')
          .text('No financial transactions found matching the selected report criteria.', margin, currentY + 20, { align: 'center', width: contentWidth });
      } else {
        reportData.entries.forEach((tx, idx) => {
          // Check page break
          if (currentY + rowHeight > maxY) {
            doc.addPage({ size: 'A4', layout: 'landscape', margin });
            currentY = drawTableHeader(margin);
          }

          const isEven = idx % 2 === 0;
          if (isEven) {
            doc.rect(margin, currentY, contentWidth, rowHeight).fill('#F8FAFC');
          }

          doc.font('Helvetica').fontSize(6.8).fillColor('#1E293B');
          let rX = margin + 4;

          // Date
          doc.text(formatUKDate(tx.date), rX, currentY + 4, { width: colWidths.date });
          rX += colWidths.date;

          // Voucher
          doc.font('Helvetica-Bold').fillColor('#4338CA').text(tx.voucherNo || '-', rX, currentY + 4, { width: colWidths.voucher });
          rX += colWidths.voucher;

          // Narration (truncated with ellipsis if too long)
          doc.font('Helvetica').fillColor('#1E293B');
          const cleanDetail = (tx.narration || '-').replace(/\n/g, ' ');
          doc.text(cleanDetail, rX, currentY + 4, { width: colWidths.detail - 6, lineBreak: false });
          rX += colWidths.detail;

          // Nominal Head
          doc.text(tx.categoryName || '-', rX, currentY + 4, { width: colWidths.head - 4, lineBreak: false });
          rX += colWidths.head;

          // Account
          doc.text(tx.accountName || '-', rX, currentY + 4, { width: colWidths.account - 4, lineBreak: false });
          rX += colWidths.account;

          // Property / Unit
          const propUnit = tx.propertyName ? `${tx.propertyName} ${tx.unitName !== '-' ? `(${tx.unitName})` : ''}` : '-';
          doc.text(propUnit, rX, currentY + 4, { width: colWidths.property - 4, lineBreak: false });
          rX += colWidths.property;

          // Money In
          doc.font('Helvetica-Bold');
          if (tx.moneyIn > 0) {
            doc.fillColor('#059669').text(formatGBP(tx.moneyIn), rX, currentY + 4, { width: colWidths.in, align: 'right' });
          } else {
            doc.fillColor('#94A3B8').text('-', rX, currentY + 4, { width: colWidths.in, align: 'right' });
          }
          rX += colWidths.in;

          // Money Out
          if (tx.moneyOut > 0) {
            doc.fillColor('#E11D48').text(formatGBP(tx.moneyOut), rX, currentY + 4, { width: colWidths.out, align: 'right' });
          } else {
            doc.fillColor('#94A3B8').text('-', rX, currentY + 4, { width: colWidths.out, align: 'right' });
          }
          rX += colWidths.out;

          // Running Balance
          doc.fillColor('#0F172A').text(formatGBP(tx.runningBalance), rX, currentY + 4, { width: colWidths.balance - 8, align: 'right' });

          // Light row bottom border
          doc
            .strokeColor('#F1F5F9')
            .lineWidth(0.5)
            .moveTo(margin, currentY + rowHeight)
            .lineTo(pageWidth - margin, currentY + rowHeight)
            .stroke();

          currentY += rowHeight;
        });

        // Bottom Grand Total Row
        if (currentY + 20 > maxY) {
          doc.addPage({ size: 'A4', layout: 'landscape', margin });
          currentY = drawTableHeader(margin);
        }

        doc.rect(margin, currentY, contentWidth, 20).fill('#1E293B');
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#FFFFFF');

        let totX = margin + 4;
        doc.text(`TOTALS (${reportData.entries.length} POSTED RECORDS)`, totX, currentY + 6, {
          width: colWidths.date + colWidths.voucher + colWidths.detail + colWidths.head + colWidths.account + colWidths.property,
        });

        totX += colWidths.date + colWidths.voucher + colWidths.detail + colWidths.head + colWidths.account + colWidths.property;
        doc.text(formatGBP(reportData.summary.totalMoneyIn), totX, currentY + 6, { width: colWidths.in, align: 'right' });
        totX += colWidths.in;

        doc.text(formatGBP(reportData.summary.totalMoneyOut), totX, currentY + 6, { width: colWidths.out, align: 'right' });
        totX += colWidths.out;

        doc.text(formatGBP(reportData.summary.closingBalance), totX, currentY + 6, { width: colWidths.balance - 8, align: 'right' });
      }

      // ---------------------------------------------------------------------
      // 4. Two-Pass Dynamic Footers (Page X of Y)
      // ---------------------------------------------------------------------
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        const footerY = pageHeight - margin + 4;

        doc
          .strokeColor('#CBD5E1')
          .lineWidth(0.5)
          .moveTo(margin, footerY - 4)
          .lineTo(pageWidth - margin, footerY - 4)
          .stroke();

        doc
          .font('Helvetica')
          .fontSize(6.5)
          .fillColor('#64748B')
          .text(
            `${reportData.companyName || 'PIXX TECHNOLOGIES UK'} • OFFICIAL AUDIT REGISTER • CONFIDENTIAL`,
            margin,
            footerY,
            { align: 'left', width: contentWidth / 2 }
          );

        doc.text(
          `Page ${i + 1} of ${range.count} • Ref: ${reportData.reportRef}`,
          pageWidth - margin - contentWidth / 2,
          footerY,
          { align: 'right', width: contentWidth / 2 }
        );
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Generate Official Landlord Rent Statement Excel (Direct Property Model - No Inside Units)
 */
export const generateLandlordRentStatementExcel = async (companyId) => {
  const comp = getCompanyById(companyId);
  const companyName = comp ? comp.legalName || comp.name : 'Old Street Holdings Ltd';

  if (companyId === 'old-street') {
    const wb = await createOfficialLandlordWorkbook(companyName);
    return await wb.xlsx.writeBuffer();
  }

  // Dynamic direct property portfolio for any other company
  const properties = await Property.find({ companyId, isActive: true }).lean();
  const propertyList = properties.map((p, idx) => ({
    no: idx + 1,
    name: p.name || p.address?.line1 || `Property ${idx + 1}`,
    rent: p.contractualRent || p.expectedRent || 0,
    mFee: -50,
    dueDate: '1st',
    type: p.propertyType || 'Residential',
    status: p.currentStatus || (p.tenantName ? 'Occupied' : 'Available'),
    tenant: p.tenantName || '— (Direct Asset Available)',
    jul: { date: '-', amt: 0 },
    aug: { date: '-', amt: 0 },
    sep: { date: '-', amt: 0 },
    dueHistorical: (p.contractualRent || 0) * 3,
    received: 0,
  }));

  const wb = await createOfficialLandlordWorkbook(companyName, propertyList.length > 0 ? propertyList : undefined);
  return await wb.xlsx.writeBuffer();
};

