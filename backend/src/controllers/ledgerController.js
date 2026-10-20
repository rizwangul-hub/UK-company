import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import Category from '../models/Category.js';
import Voucher from '../models/Voucher.js';
import Account from '../models/Account.js';
import Property from '../models/Property.js';
import Tenant from '../models/Tenant.js';
import RentSchedule from '../models/RentSchedule.js';
import RentPayment from '../models/RentPayment.js';
import Mortgage from '../models/Mortgage.js';
import MortgagePayment from '../models/MortgagePayment.js';
import Unit from '../models/Unit.js';
import {
  postLedgerTransaction,
  deleteLedgerTransaction,
  restoreLedgerTransaction,
  updateComprehensiveTransaction,
  getRecycleBinTransactions,
  getTransactionAuditHistory,
  round2,
} from '../services/ledgerService.js';
import {
  getCategoryHierarchy,
  createHeadCategory,
  createSubHeadCategory,
  updateCategoryHierarchy,
  deleteCategoryHierarchy,
} from '../services/categoryService.js';
import {
  previewBackfill,
  applyBackfill,
} from '../services/categoryBackfillService.js';
import { apiSuccess, apiError } from '../utils/apiResponse.js';
import cloudinary, { isCloudinaryConfigured, CLOUDINARY_FOLDER } from '../config/cloudinary.js';

const escapeRegex = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseDateRange = (datePreset, startDate, endDate) => {
  const now = new Date();
  let periodStart = null;
  let periodEnd = null;

  switch (datePreset) {
    case 'TODAY': {
      periodStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0));
      periodEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0));
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
      periodEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0));
      break;
    }
    case 'PREVIOUS_MONTH': {
      periodStart = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0));
      periodEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0));
      break;
    }
    case 'THIS_YEAR': {
      periodStart = new Date(Date.UTC(now.getFullYear(), 0, 1, 0, 0, 0));
      periodEnd = new Date(Date.UTC(now.getFullYear() + 1, 0, 1, 0, 0, 0));
      break;
    }
    case 'THIS_FY': {
      const currentYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
      periodStart = new Date(Date.UTC(currentYear, 3, 1, 0, 0, 0));
      periodEnd = new Date(Date.UTC(currentYear + 1, 3, 1, 0, 0, 0));
      break;
    }
    case 'LAST_FY': {
      const prevYear = (now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1) - 1;
      periodStart = new Date(Date.UTC(prevYear, 3, 1, 0, 0, 0));
      periodEnd = new Date(Date.UTC(prevYear + 1, 3, 1, 0, 0, 0));
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
 * Format clean property type (e.g. 'Flat', 'Shop', 'House', 'Commercial')
 * Avoids showing raw or awkward 'London · 1 Units' in ledger views.
 */
export function formatPropertyType(p) {
  if (!p) return 'Property';
  const rawType = (p.propertyType || '').trim();
  const nameLower = (p.name || '').toLowerCase();

  if (nameLower.includes('-shop') || nameLower.startsWith('shop') || nameLower.includes(' shop')) {
    return 'Shop';
  }
  if (
    nameLower.includes('-flat') ||
    nameLower.includes('flat ') ||
    nameLower.includes(' flat') ||
    nameLower.includes('ground floor') ||
    nameLower.includes('1st floor') ||
    nameLower.includes('first floor') ||
    nameLower.includes('2nd floor') ||
    nameLower.includes('second floor') ||
    nameLower.includes('basement')
  ) {
    return 'Flat';
  }

  switch (rawType.toUpperCase()) {
    case 'COMMERCIAL_RESIDENTIAL_MIXED':
      return 'Mixed (Shop & Flat)';
    case 'MULTI_UNIT_RESIDENTIAL':
      return 'Multi-Unit Flats';
    case 'SHOP':
      return 'Shop';
    case 'FLAT':
    case 'FLAT_APARTMENT':
    case 'APARTMENT':
      return 'Flat';
    case 'HOUSE':
    case 'RESIDENTIAL_TERRACED':
    case 'TERRACED_HOUSE':
    case 'SEMI_DETACHED':
    case 'DETACHED':
      return 'House';
    case 'COMMERCIAL':
    case 'COMMERCIAL_OFFICE':
    case 'OFFICE':
      return 'Commercial';
    case 'HMO':
    case 'ROOM_HMO':
      return 'HMO';
    case 'RESIDENTIAL':
      return (nameLower.includes('flat') || nameLower.includes('apartment')) ? 'Flat' : 'House';
    case 'OTHER':
      if (nameLower.includes('flat') || nameLower.includes('apartment')) return 'Flat';
      if (nameLower.includes('shop') || nameLower.includes('retail')) return 'Shop';
      if (nameLower.includes('office') || nameLower.includes('commercial')) return 'Commercial';
      return 'House';
    default:
      return rawType || 'Property';
  }
}

export const getLedgerEntities = async (req, res) => {
  try {
    const [accounts, properties, tenants, mortgages, categories, units] = await Promise.all([
      Account.find({ companyId: req.companyId, isActive: true }).sort({ accountType: 1, name: 1 }).lean(),
      Property.find({ companyId: req.companyId, isActive: true }).sort({ name: 1 }).lean(),
      Tenant.find({ companyId: req.companyId, isActive: true }).sort({ fullName: 1 }).lean(),
      Mortgage.find({ companyId: req.companyId, status: 'ACTIVE' }).populate('propertyId', 'name').sort({ lenderName: 1 }).lean(),
      Category.find({ companyId: req.companyId, isActive: true })
        .populate('propertyId', 'name postcode')
        .populate('parentCategoryId', 'name')
        .sort({ type: 1, name: 1 })
        .lean(),
      Unit.find({ companyId: req.companyId, isActive: true }).sort({ unitName: 1 }).lean(),
    ]);

    const bankAccounts = accounts
      .filter((a) => a.accountType === 'BANK')
      .map((a) => ({
        id: a._id,
        name: a.name,
        type: 'BANK',
        subtext: `${a.bankName || 'UK Bank'} · Sort: ${a.sortCode || 'N/A'} · Bal: £${(a.currentBalance || 0).toFixed(2)}`,
      }));

    const cashAccounts = accounts
      .filter((a) => a.accountType === 'CASH')
      .map((a) => ({
        id: a._id,
        name: a.name,
        type: 'CASH',
        subtext: `Cash Float · Bal: £${(a.currentBalance || 0).toFixed(2)}`,
      }));

    const propertyEntities = properties.map((p) => {
      const propType = formatPropertyType(p);
      const propUnits = units.filter((u) => u.propertyId?.toString() === p._id.toString());
      const subtext = propUnits.length > 1
        ? `${propType} · ${propUnits.length} Units (${propUnits.map((u) => u.unitType === 'RETAIL_SHOP' ? 'Shop' : 'Flat').join(', ')})`
        : propType;
      return {
        id: p._id,
        name: p.name,
        type: 'PROPERTY',
        propertyType: propType,
        subtext,
        unitsCount: propUnits.length,
        units: propUnits.map((u) => ({
          id: u._id,
          name: u.unitName,
          type: u.unitType === 'RETAIL_SHOP' ? 'Shop' : (u.unitType === 'FLAT' ? 'Flat' : 'Unit'),
          targetRent: u.targetRent,
        })),
      };
    });

    const tenantEntities = tenants.map((t) => ({
      id: t._id,
      name: t.fullName,
      type: 'TENANT',
      subtext: `Email: ${t.email || 'N/A'} · Phone: ${t.phone || 'N/A'}`,
    }));

    const mortgageEntities = mortgages.map((m) => ({
      id: m._id,
      name: `${m.lenderName} (${m.accountReference})`,
      type: 'MORTGAGE',
      subtext: `${m.propertyId?.name || 'Property'} · Debt: £${(m.outstandingPrincipalBalance || 0).toFixed(2)}`,
    }));

    const expenseHeads = [
      {
        id: 'ALL_EXPENSES',
        name: '★ All Expenses (Consolidated)',
        type: 'ACCOUNT_HEAD',
        subtext: 'Complete operational expenses across all categories',
      },
      ...categories
        .filter((c) => c.type === 'OPERATING_EXPENSE' || c.type === 'EXPENSE')
        .map((c) => {
          const propName = c.propertyId?.name;
          return {
            id: c._id,
            name: propName ? `${propName} ➔ ${c.name}` : c.name,
            type: 'ACCOUNT_HEAD',
            subtext: `Code: ${c.code || 'EXP'} · ${propName ? `Property: ${propName}` : 'General Portfolio'} · ${c.isAllowableTaxDeduction ? 'Tax Allowable' : 'Standard'}`,
          };
        }),
    ];

    const incomeHeads = [
      {
        id: 'ALL_INCOME',
        name: '★ All Income & Receipts (Consolidated)',
        type: 'OTHER_INCOME',
        subtext: 'Consolidated rental & sundry receipts',
      },
      ...categories
        .filter((c) => c.type === 'INCOME')
        .map((c) => ({
          id: c._id,
          name: c.name,
          type: 'OTHER_INCOME',
          subtext: `Code: ${c.code || 'INC'} · ${c.isRentalHead ? 'Rental Head' : 'Sundry Income'}`,
        })),
    ];

    // Extract distinct Heads and Sub Heads recorded in company transactions
    const [distinctHeads, distinctSubHeads] = await Promise.all([
      Transaction.distinct('head', {
        companyId: req.companyId,
        head: { $ne: null, $ne: '' },
        isDeleted: { $ne: true },
        status: 'POSTED',
      }),
      Transaction.distinct('subHead', {
        companyId: req.companyId,
        subHead: { $ne: null, $ne: '' },
        isDeleted: { $ne: true },
        status: 'POSTED',
      }),
    ]);

    const headEntities = [
      { id: 'ALL_HEADS', name: '★ All Heads (Consolidated)', type: 'HEAD', subtext: 'Consolidated transactions across all heads' },
      ...distinctHeads.filter(Boolean).sort().map((h) => ({
        id: h,
        name: h,
        type: 'HEAD',
        subtext: `Nominal Head: ${h}`,
      })),
    ];

    const subHeadEntities = [
      { id: 'ALL_SUBHEADS', name: '★ All Sub Heads (Consolidated)', type: 'SUB_HEAD', subtext: 'Consolidated transactions across all sub heads' },
      ...distinctSubHeads.filter(Boolean).sort().map((s) => ({
        id: s,
        name: s,
        type: 'SUB_HEAD',
        subtext: `Sub Head: ${s}`,
      })),
    ];

    return apiSuccess(res, {
      bankAccounts,
      cashAccounts,
      properties: propertyEntities,
      tenants: tenantEntities,
      mortgages: mortgageEntities,
      expenseHeads,
      incomeHeads,
      heads: headEntities,
      subHeads: subHeadEntities,
    });
  } catch (error) {
    return apiError(res, 'Failed to fetch ledger entities', 500, error);
  }
};

export const queryEntityLedger = async (req, res) => {
  try {
    const {
      type = 'BANK',
      entityId,
      datePreset = 'THIS_MONTH',
      startDate,
      endDate,
      search,
    } = req.query;

    const { periodStart, periodEnd } = parseDateRange(datePreset, startDate, endDate);
    const sRegex = search && search.trim() ? new RegExp(search.trim(), 'i') : null;

    let ledgerTitle = 'Financial Ledger';
    let entitySubtext = '';
    let entries = [];
    let openingBalance = 0;
    let totalDebit = 0;
    let totalCredit = 0;
    let closingBalance = 0;
    let isLiquidity = false;

    // 1. BANK ACCOUNT & CASH LEDGER
    if (type === 'BANK' || type === 'CASH') {
      isLiquidity = true;
      let account = null;
      if (entityId && mongoose.Types.ObjectId.isValid(entityId)) {
        account = await Account.findOne({ _id: entityId, companyId: req.companyId }).lean();
      }
      if (!account) {
        account = await Account.findOne({ companyId: req.companyId, accountType: type, isActive: true }).lean();
      }
      if (!account) {
        ledgerTitle = `${type === 'BANK' ? 'UK Bank' : 'Cash'} Account Ledger`;
        entitySubtext = `No ${type.toLowerCase()} accounts configured yet for this company.`;
        entries = [];
        openingBalance = 0;
        closingBalance = 0;
      } else {
        const effectiveId = account._id;
        const effectiveIdStr = effectiveId.toString();
        ledgerTitle = `${account.name} Ledger`;
        entitySubtext = `${account.bankName || 'Cash Account'} · Sort Code: ${account.sortCode || 'N/A'} · Acc: ${account.accountNumber || 'N/A'}`;

        let calcOpening = account.openingBalance || 0;
        if (periodStart) {
          const priorTxs = await Transaction.find({
            companyId: req.companyId,
            status: 'POSTED',
            isDeleted: { $ne: true },
            $or: [{ accountId: effectiveId }, { counterAccountId: effectiveId }],
            transactionDate: { $lt: periodStart },
          }).lean();

          for (const tx of priorTxs) {
            const txAcc = (tx.accountId?._id || tx.accountId)?.toString();
            const txCounter = (tx.counterAccountId?._id || tx.counterAccountId)?.toString();
            if (txAcc === effectiveIdStr) {
              calcOpening += tx.direction === 'IN' ? tx.amount : -tx.amount;
            } else if (txCounter === effectiveIdStr) {
              calcOpening += tx.amount;
            }
          }
        }
        openingBalance = round2(calcOpening);

        const txQuery = {
          companyId: req.companyId,
          status: 'POSTED',
          isDeleted: { $ne: true },
          $or: [{ accountId: effectiveId }, { counterAccountId: effectiveId }],
        };
        if (periodStart && periodEnd) txQuery.transactionDate = { $gte: periodStart, $lte: periodEnd };
        else if (periodStart) txQuery.transactionDate = { $gte: periodStart };
        else if (periodEnd) txQuery.transactionDate = { $lte: periodEnd };

        if (sRegex) {
          txQuery.$and = txQuery.$and || [];
          txQuery.$and.push({ $or: [{ voucherNo: sRegex }, { narration: sRegex }, { reference: sRegex }] });
        }

        const txns = await Transaction.find(txQuery)
          .sort({ transactionDate: 1, createdAt: 1 })
          .populate('accountId', 'name bankName')
          .populate('counterAccountId', 'name bankName')
          .populate('categoryId', 'name type code')
          .populate('headId', 'name')
          .populate('subHeadId', 'name')
          .populate('propertyId', 'name postcode')
          .populate('unitId', 'unitName')
          .populate('mortgageId', 'lenderName accountReference')
          .lean();

        let running = openingBalance;
        entries = txns.map((tx) => {
          const txAcc = (tx.accountId?._id || tx.accountId)?.toString();
          const isPrimary = txAcc === effectiveIdStr;
          const isInflow = isPrimary ? tx.direction === 'IN' : true;
          const debit = isInflow ? tx.amount : 0;
          const credit = !isInflow ? tx.amount : 0;

          running = round2(running + (isInflow ? tx.amount : -tx.amount));
          totalDebit += debit;
          totalCredit += credit;

          return {
            _id: tx._id,
            date: tx.transactionDate,
            voucherNo: tx.voucherNo,
            detail: tx.narration,
            transactionType: tx.transactionType,
            head: tx.head || tx.headId?.name || '',
            subHead: tx.subHead || tx.subHeadId?.name || '',
            categoryName: tx.head && tx.subHead ? `${tx.head} · ${tx.subHead}` : (tx.subHead || tx.head || tx.categoryId?.name || tx.transactionType),
            drAccount: isInflow ? account.name : (tx.counterAccountId?.name || tx.categoryId?.name || 'Payee'),
            crAccount: !isInflow ? account.name : (tx.counterAccountId?.name || 'Receipt'),
            propertyName: tx.propertyId?.name || '',
            unitName: tx.unitId?.unitName || '',
            reference: tx.reference || '',
            debit: round2(debit),
            credit: round2(credit),
            amount: round2(tx.amount),
            runningBalance: round2(running),
            direction: isInflow ? 'IN' : 'OUT',
          };
        });

        closingBalance = round2(running);
      }
    }

    // 2. PROPERTY & UNIT LEDGER
    else if (type === 'PROPERTY') {
      let prop = null;
      let unit = null;

      // Check if entityId is a Unit ID or Property ID
      if (entityId && mongoose.Types.ObjectId.isValid(entityId)) {
        unit = await Unit.findOne({ _id: entityId, companyId: req.companyId }).populate('propertyId').lean();
        if (unit && unit.propertyId) {
          prop = unit.propertyId;
        } else {
          prop = await Property.findOne({ _id: entityId, companyId: req.companyId }).lean();
        }
      }

      // Check if unitId query param was explicitly provided
      if (!unit && req.query.unitId && mongoose.Types.ObjectId.isValid(req.query.unitId)) {
        unit = await Unit.findOne({ _id: req.query.unitId, companyId: req.companyId }).populate('propertyId').lean();
        if (unit && unit.propertyId) {
          prop = unit.propertyId;
        }
      }

      if (!prop && !unit) {
        prop = await Property.findOne({ companyId: req.companyId, isActive: true }).lean();
      }

      if (!prop) {
        ledgerTitle = 'Property Portfolio Ledger';
        entitySubtext = 'No properties added yet for this company. Add properties in the Properties tab.';
        entries = [];
        openingBalance = 0;
        closingBalance = 0;
      } else {
        const effectivePropId = prop._id;
        const propType = formatPropertyType(prop);
        const unitType = unit ? (unit.unitType === 'RETAIL_SHOP' ? 'Shop' : unit.unitType === 'FLAT' ? 'Flat' : (unit.unitType || 'Unit')) : null;

        if (unit) {
          ledgerTitle = `Property Ledger: ${unit.unitName} (${unitType})`;
          entitySubtext = `Property: ${prop.name} · Unit: ${unit.unitName} · Type: ${unitType} · Target Rent: £${(unit.targetRent || 0).toFixed(2)}/mo · Postcode: ${prop.postcode || 'N/A'}`;
        } else {
          ledgerTitle = `Property Ledger: ${prop.name} (${propType})`;
          const locParts = [
            `Type: ${propType}`,
            prop.addressLine1,
            prop.city,
            prop.postcode,
          ].filter(Boolean);
          entitySubtext = `${locParts.join(' · ')} · Valuation: £${(prop.currentValuation || 0).toFixed(2)}`;
        }

        const txQuery = {
          companyId: req.companyId,
          status: 'POSTED',
          isDeleted: { $ne: true },
        };

        if (unit) {
          txQuery.unitId = unit._id;
        } else {
          txQuery.propertyId = effectivePropId;
        }

        if (periodStart && periodEnd) txQuery.transactionDate = { $gte: periodStart, $lte: periodEnd };
        else if (periodStart) txQuery.transactionDate = { $gte: periodStart };
        else if (periodEnd) txQuery.transactionDate = { $lte: periodEnd };

        if (sRegex) {
          txQuery.$and = txQuery.$and || [];
          txQuery.$and.push({ $or: [{ voucherNo: sRegex }, { narration: sRegex }, { reference: sRegex }] });
        }

        const txns = await Transaction.find(txQuery)
          .sort({ transactionDate: 1, createdAt: 1 })
          .populate('accountId', 'name')
          .populate('categoryId', 'name type')
          .populate('unitId', 'unitName unitType')
          .lean();

        let netCashFlow = 0;
        entries = txns.map((tx) => {
          const isIncome = tx.direction === 'IN' || tx.transactionType === 'INCOME';
          const debit = isIncome ? tx.amount : 0;
          const credit = !isIncome ? tx.amount : 0;

          netCashFlow = round2(netCashFlow + (isIncome ? tx.amount : -tx.amount));
          totalDebit += debit;
          totalCredit += credit;

          const rowUnitType = tx.unitId?.unitType === 'RETAIL_SHOP' ? 'Shop' : tx.unitId?.unitType === 'FLAT' ? 'Flat' : (tx.unitId?.unitType || unitType || '');

          return {
            _id: tx._id,
            date: tx.transactionDate,
            voucherNo: tx.voucherNo,
            detail: tx.narration,
            transactionType: tx.transactionType,
            categoryName: tx.categoryId?.name || tx.transactionType,
            drAccount: tx.accountId?.name || 'Account',
            crAccount: isIncome ? 'Rental Revenue' : (tx.categoryId?.name || 'Disbursement'),
            propertyName: prop.name,
            unitName: tx.unitId?.unitName || (unit ? unit.unitName : ''),
            unitType: rowUnitType,
            reference: tx.reference || '',
            debit: round2(debit),
            credit: round2(credit),
            amount: round2(tx.amount),
            runningBalance: round2(netCashFlow),
            direction: isIncome ? 'IN' : 'OUT',
          };
        });

        openingBalance = 0;
        closingBalance = round2(netCashFlow);
      }
    }

    // 3. TENANT / RENTAL LEDGER
    else if (type === 'TENANT') {
      let tenant = null;
      if (entityId && mongoose.Types.ObjectId.isValid(entityId)) {
        tenant = await Tenant.findOne({ _id: entityId, companyId: req.companyId }).lean();
      }
      if (!tenant) {
        tenant = await Tenant.findOne({ companyId: req.companyId, isActive: true }).lean();
      }

      if (!tenant) {
        ledgerTitle = 'Tenant Rental Ledger';
        entitySubtext = 'No tenants added yet for this company. Add tenants in Tenants & Leases.';
        entries = [];
        openingBalance = 0;
        closingBalance = 0;
      } else {
        const effectiveTenantId = tenant._id;
        ledgerTitle = `Tenant Rental Ledger: ${tenant.fullName}`;
        entitySubtext = `Email: ${tenant.email || 'N/A'} · Phone: ${tenant.phone || 'N/A'}`;

        const [schedules, payments] = await Promise.all([
          RentSchedule.find({ companyId: req.companyId, tenantId: effectiveTenantId }).populate('propertyId', 'name').populate('unitId', 'unitName').lean(),
          RentPayment.find({ companyId: req.companyId, tenantId: effectiveTenantId, status: { $ne: 'VOID' }, isDeleted: { $ne: true } }).populate('propertyId', 'name').populate('receivingAccountId', 'name').lean(),
        ]);

        const combined = [];
        schedules.forEach((s) => {
          combined.push({
            date: s.dueDate,
            voucherNo: `INV-${s.billingMonth}`,
            detail: `Rent Billing Invoice — ${s.billingMonth} (${s.propertyId?.name || 'Property'} ${s.unitId?.unitName || ''})`,
            transactionType: 'RENT_DUE',
            categoryName: 'Rent Invoice',
            debit: round2(s.expectedAmount),
            credit: 0,
            amount: round2(s.expectedAmount),
            drAccount: 'Tenant Receivable',
            crAccount: 'Rental Revenue',
            status: s.status,
          });
        });

        payments.forEach((p) => {
          combined.push({
            date: p.paymentDate,
            voucherNo: p.receiptRef || `REC-${p._id.toString().slice(-4)}`,
            detail: p.notes || `Rent Payment Receipt — ${p.billingMonth}`,
            transactionType: 'RENT_PAID',
            categoryName: 'Rent Receipt',
            debit: 0,
            credit: round2(p.amount),
            amount: round2(p.amount),
            drAccount: p.receivingAccountId?.name || 'Bank Account',
            crAccount: 'Tenant Receivable Cleared',
            status: 'PAID',
          });
        });

        combined.sort((a, b) => new Date(a.date) - new Date(b.date));

        let arrearsRunning = 0;
        entries = combined.map((entry, idx) => {
          arrearsRunning = round2(arrearsRunning + entry.debit - entry.credit);
          totalDebit += entry.debit;
          totalCredit += entry.credit;

          return {
            _id: `TENANT_ROW_${idx}`,
            date: entry.date,
            voucherNo: entry.voucherNo,
            detail: entry.detail,
            transactionType: entry.transactionType,
            categoryName: entry.categoryName,
            drAccount: entry.drAccount,
            crAccount: entry.crAccount,
            debit: entry.debit,
            credit: entry.credit,
            amount: entry.amount,
            runningBalance: round2(arrearsRunning),
            direction: entry.debit > 0 ? 'DUE' : 'PAID',
          };
        });

        openingBalance = 0;
        closingBalance = round2(arrearsRunning);
      }
    }

    // 4. MORTGAGE FACILITY LEDGER (UK Specific)
    else if (type === 'MORTGAGE') {
      let mortgage = null;
      if (entityId && mongoose.Types.ObjectId.isValid(entityId)) {
        mortgage = await Mortgage.findOne({ _id: entityId, companyId: req.companyId }).populate('propertyId', 'name postcode').lean();
      }
      if (!mortgage) {
        mortgage = await Mortgage.findOne({ companyId: req.companyId, status: 'ACTIVE' }).populate('propertyId', 'name postcode').lean();
      }

      if (!mortgage) {
        ledgerTitle = 'Mortgage Facilities Ledger';
        entitySubtext = 'No active mortgages added yet for this company. Add mortgages in Mortgage Facilities.';
        entries = [];
        openingBalance = 0;
        closingBalance = 0;
      } else {
        const effectiveMortgageId = mortgage._id;
        ledgerTitle = `Mortgage Ledger: ${mortgage.lenderName} (${mortgage.accountReference})`;
        entitySubtext = `Property: ${mortgage.propertyId?.name || 'N/A'} · Rate: ${mortgage.interestRate}% · Type: ${mortgage.repaymentType}`;

        const payments = await MortgagePayment.find({
          companyId: req.companyId,
          mortgageId: effectiveMortgageId,
          status: { $ne: 'VOID' },
          isDeleted: { $ne: true },
        })
          .sort({ paymentDate: 1, createdAt: 1 })
          .populate('paymentAccountId', 'name')
          .lean();

        openingBalance = round2(mortgage.originalLoanAmount || mortgage.outstandingPrincipalBalance);
        let remainingPrincipal = openingBalance;

        entries = payments.map((p) => {
          const principal = p.principalAmount || 0;
          const interest = p.interestAmount || 0;
          const total = p.totalAmountPaid || 0;

          remainingPrincipal = round2(remainingPrincipal - principal);
          totalDebit += interest;
          totalCredit += principal;

          return {
            _id: p._id,
            date: p.paymentDate,
            voucherNo: p.paymentReference || `MTG-${p._id.toString().slice(-4)}`,
            detail: `Mortgage Repayment: Total Paid £${total.toFixed(2)} [Interest: £${interest.toFixed(2)}, Principal: £${principal.toFixed(2)}]`,
            transactionType: 'MORTGAGE_PAYMENT',
            categoryName: 'Finance Costs & Debt Reduction',
            drAccount: 'Mortgage Principal Repayment',
            crAccount: p.paymentAccountId?.name || 'Bank Account',
            debit: round2(interest),
            credit: round2(principal),
            amount: round2(total),
            runningBalance: round2(remainingPrincipal),
            direction: 'OUT',
          };
        });

        closingBalance = round2(remainingPrincipal);
      }
    }

    // 5. EXPENSE / ACCOUNT HEAD LEDGER
    else if (type === 'ACCOUNT_HEAD' || type === 'EXPENSE') {
      let cat = null;
      if (entityId && entityId !== 'ALL_EXPENSES' && mongoose.Types.ObjectId.isValid(entityId)) {
        cat = await Category.findOne({ _id: entityId, companyId: req.companyId }).lean();
      }

      ledgerTitle = cat ? `Expense Head Ledger: ${cat.name}` : 'All Expenses — Consolidated Ledger';
      entitySubtext = cat
        ? `Code: ${cat.code || 'EXP'} · Tax Allowable: ${cat.isAllowableTaxDeduction ? 'Yes' : 'No'}`
        : 'Consolidated operational expenses across all categories';

      const txQuery = {
        companyId: req.companyId,
        status: 'POSTED',
        isDeleted: { $ne: true },
        transactionType: 'EXPENSE',
      };
      if (cat) txQuery.categoryId = cat._id;

      if (periodStart && periodEnd) txQuery.transactionDate = { $gte: periodStart, $lte: periodEnd };
      else if (periodStart) txQuery.transactionDate = { $gte: periodStart };
      else if (periodEnd) txQuery.transactionDate = { $lte: periodEnd };

      if (sRegex) {
        txQuery.$and = txQuery.$and || [];
        txQuery.$and.push({ $or: [{ voucherNo: sRegex }, { narration: sRegex }, { reference: sRegex }] });
      }

      const txns = await Transaction.find(txQuery)
        .sort({ transactionDate: 1, createdAt: 1 })
        .populate('accountId', 'name')
        .populate('categoryId', 'name')
        .populate('propertyId', 'name')
        .populate('unitId', 'unitName')
        .lean();

      let sumExpenses = 0;
      entries = txns.map((tx) => {
        sumExpenses = round2(sumExpenses + tx.amount);
        totalDebit += tx.amount;

        return {
          _id: tx._id,
          date: tx.transactionDate,
          voucherNo: tx.voucherNo,
          detail: tx.narration,
          transactionType: tx.transactionType,
          categoryName: tx.categoryId?.name || 'Expense',
          drAccount: tx.categoryId?.name || 'Expense Head',
          crAccount: tx.accountId?.name || 'Bank Account',
          propertyName: tx.propertyId?.name || '',
          unitName: tx.unitId?.unitName || '',
          reference: tx.reference || '',
          debit: round2(tx.amount),
          credit: 0,
          amount: round2(tx.amount),
          runningBalance: round2(sumExpenses),
          direction: 'OUT',
        };
      });

      openingBalance = 0;
      closingBalance = round2(sumExpenses);
    }

    // 6. HEAD & SUB HEAD CATEGORY LEDGER (UK Bank Reconciliation Hierarchy)
    else if (type === 'HEAD' || type === 'SUB_HEAD') {
      const headName = req.query.head || (type === 'HEAD' && entityId && entityId !== 'ALL_HEADS' ? entityId : null);
      const subHeadName = req.query.subHead || (type === 'SUB_HEAD' && entityId && entityId !== 'ALL_SUBHEADS' ? entityId : null);

      const txQuery = { companyId: req.companyId, status: 'POSTED', isDeleted: { $ne: true } };

      if (headName && headName !== 'ALL_HEADS') {
        txQuery.head = new RegExp(`^${escapeRegex(headName.trim())}$`, 'i');
      }
      if (subHeadName && subHeadName !== 'ALL_SUBHEADS') {
        txQuery.subHead = new RegExp(`^${escapeRegex(subHeadName.trim())}$`, 'i');
      }

      ledgerTitle = subHeadName
        ? `Sub Head Ledger: ${subHeadName} (${headName || 'All Heads'})`
        : headName
        ? `Head Ledger: ${headName}`
        : 'Heads & Sub Heads Consolidated Ledger';

      entitySubtext = `Categorized Nominal Ledger for ${req.companyId.toUpperCase()}`;

      if (periodStart && periodEnd) txQuery.transactionDate = { $gte: periodStart, $lte: periodEnd };
      else if (periodStart) txQuery.transactionDate = { $gte: periodStart };
      else if (periodEnd) txQuery.transactionDate = { $lte: periodEnd };

      if (sRegex) {
        txQuery.$and = txQuery.$and || [];
        txQuery.$and.push({ $or: [{ voucherNo: sRegex }, { narration: sRegex }, { reference: sRegex }] });
      }

      const txns = await Transaction.find(txQuery)
        .sort({ transactionDate: 1, createdAt: 1 })
        .populate('accountId', 'name')
        .populate('counterAccountId', 'name')
        .populate('categoryId', 'name')
        .populate('propertyId', 'name title addressLine1')
        .populate('unitId', 'unitName')
        .lean();

      let headRunning = 0;
      entries = txns.map((tx) => {
        const isDebit = tx.direction === 'OUT'; // Debit = Money Out / Payments; Credit = Money In / Receipts
        const debit = isDebit ? tx.amount : 0;
        const credit = !isDebit ? tx.amount : 0;

        headRunning = round2(headRunning + (!isDebit ? tx.amount : -tx.amount));
        totalDebit += debit;
        totalCredit += credit;

        return {
          _id: tx._id,
          date: tx.transactionDate,
          voucherNo: tx.voucherNo,
          detail: tx.narration,
          transactionType: tx.transactionType,
          head: tx.head || '',
          subHead: tx.subHead || '',
          categoryName: tx.head && tx.subHead ? `${tx.head} · ${tx.subHead}` : (tx.subHead || tx.head || tx.categoryId?.name || tx.transactionType),
          drAccount: isDebit ? (tx.subHead || tx.head || 'Expense') : (tx.accountId?.name || 'Bank Account'),
          crAccount: !isDebit ? (tx.subHead || tx.head || 'Revenue') : (tx.accountId?.name || 'Bank Account'),
          propertyName: tx.propertyId?.title || tx.propertyId?.name || tx.propertyId?.addressLine1 || '',
          unitName: tx.unitId?.unitName || '',
          reference: tx.reference || '',
          receiptUrl: tx.receiptUrl || (tx.documents?.[0]?.url || ''),
          receiptFilename: tx.receiptFilename || (tx.documents?.[0]?.title || ''),
          documents: tx.documents || [],
          debit: round2(debit),
          credit: round2(credit),
          amount: round2(tx.amount),
          runningBalance: round2(headRunning),
          direction: tx.direction,
        };
      });

      openingBalance = 0;
      closingBalance = round2(headRunning);
    }

    // 7. RENT JOURNAL / OTHER INCOME / CONSOLIDATED ALL
    else {
      ledgerTitle = type === 'RENT'
        ? 'Rent Invoicing & Collections Journal'
        : type === 'OTHER_INCOME'
        ? 'Other Receipts & Non-Rent Income Ledger'
        : 'All Transactions — Master Journal';

      entitySubtext = 'Official Double-Entry Transaction Ledger';

      const txQuery = { companyId: req.companyId, status: 'POSTED', isDeleted: { $ne: true } };
      if (type === 'RENT') {
        txQuery.transactionType = 'INCOME';
        txQuery.periodMonth = { $exists: true };
      } else if (type === 'OTHER_INCOME') {
        txQuery.transactionType = 'INCOME';
        if (entityId && entityId !== 'ALL_INCOME' && mongoose.Types.ObjectId.isValid(entityId)) {
          const incCat = await Category.findOne({ _id: entityId, companyId: req.companyId }).lean();
          if (incCat) {
            txQuery.categoryId = incCat._id;
            ledgerTitle = `Income Head Ledger: ${incCat.name}`;
            entitySubtext = `Code: ${incCat.code || 'INC'} · ${incCat.isRentalHead ? 'Rental Head' : 'Sundry Income'}`;
          }
        }
      }

      if (periodStart && periodEnd) txQuery.transactionDate = { $gte: periodStart, $lte: periodEnd };
      else if (periodStart) txQuery.transactionDate = { $gte: periodStart };
      else if (periodEnd) txQuery.transactionDate = { $lte: periodEnd };

      if (sRegex) {
        txQuery.$and = txQuery.$and || [];
        txQuery.$and.push({ $or: [{ voucherNo: sRegex }, { narration: sRegex }, { reference: sRegex }] });
      }

      const txns = await Transaction.find(txQuery)
        .sort({ transactionDate: 1, createdAt: 1 })
        .populate('accountId', 'name')
        .populate('counterAccountId', 'name')
        .populate('categoryId', 'name')
        .populate('headId', 'name')
        .populate('subHeadId', 'name')
        .populate('propertyId', 'name')
        .populate('unitId', 'unitName')
        .lean();

      let masterRunning = 0;
      entries = txns.map((tx) => {
        const isDebit = tx.direction === 'IN';
        const debit = isDebit ? tx.amount : 0;
        const credit = !isDebit ? tx.amount : 0;

        masterRunning = round2(masterRunning + (isDebit ? tx.amount : -tx.amount));
        totalDebit += debit;
        totalCredit += credit;

        return {
          _id: tx._id,
          date: tx.transactionDate,
          voucherNo: tx.voucherNo,
          detail: tx.narration,
          transactionType: tx.transactionType,
          head: tx.head || tx.headId?.name || '',
          subHead: tx.subHead || tx.subHeadId?.name || '',
          categoryName: tx.head && tx.subHead ? `${tx.head} · ${tx.subHead}` : (tx.subHead || tx.head || tx.categoryId?.name || tx.transactionType),
          drAccount: tx.accountId?.name || 'Account',
          crAccount: tx.counterAccountId?.name || (isDebit ? 'Income Revenue' : (tx.categoryId?.name || 'Outflow')),
          propertyName: tx.propertyId?.name || '',
          unitName: tx.unitId?.unitName || '',
          reference: tx.reference || '',
          receiptUrl: tx.receiptUrl || (tx.documents?.[0]?.url || ''),
          receiptFilename: tx.receiptFilename || (tx.documents?.[0]?.title || ''),
          documents: tx.documents || [],
          debit: round2(debit),
          credit: round2(credit),
          amount: round2(tx.amount),
          runningBalance: round2(masterRunning),
          direction: tx.direction,
        };
      });

      openingBalance = 0;
      closingBalance = round2(masterRunning);
    }

    return apiSuccess(res, {
      ledgerTitle,
      entitySubtext,
      type,
      datePreset,
      isLiquidity,
      summary: {
        openingBalance: round2(openingBalance),
        totalDebit: round2(totalDebit),
        totalCredit: round2(totalCredit),
        closingBalance: round2(closingBalance),
        entryCount: entries.length,
      },
      entries,
    });
  } catch (error) {
    return apiError(res, error.message || 'Failed to query entity ledger', 500, error);
  }
};

/**
 * Interactive Head & Sub Head Pivot Summary
 * Aggregates all transactions by Head and Sub Head with Payments, Receipts, and Net Balance.
 * Exactly matches the hierarchical summary of the UK bank reconciliation report.
 */
export const getHeadSubHeadSummary = async (req, res) => {
  try {
    const { datePreset = 'ALL', startDate, endDate, search } = req.query;
    const { periodStart, periodEnd } = parseDateRange(datePreset, startDate, endDate);

    const matchQuery = {
      companyId: req.companyId,
      status: 'POSTED',
      isDeleted: { $ne: true },
    };

    if (periodStart && periodEnd) matchQuery.transactionDate = { $gte: periodStart, $lte: periodEnd };
    else if (periodStart) matchQuery.transactionDate = { $gte: periodStart };
    else if (periodEnd) matchQuery.transactionDate = { $lte: periodEnd };

    if (search && search.trim()) {
      const s = search.trim();
      matchQuery.$or = [
        { head: { $regex: s, $options: 'i' } },
        { subHead: { $regex: s, $options: 'i' } },
        { narration: { $regex: s, $options: 'i' } },
        { voucherNo: { $regex: s, $options: 'i' } },
      ];
    }

    const aggregated = await Transaction.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            head: { $ifNull: ['$head', 'Uncategorized'] },
            subHead: { $ifNull: ['$subHead', 'General'] },
          },
          count: { $sum: 1 },
          payments: { $sum: { $cond: [{ $eq: ['$direction', 'OUT'] }, '$amount', 0] } },
          receipts: { $sum: { $cond: [{ $eq: ['$direction', 'IN'] }, '$amount', 0] } },
        },
      },
      {
        $sort: { '_id.head': 1, '_id.subHead': 1 },
      },
    ]);

    const headsMap = {};
    let grandTotalPayments = 0;
    let grandTotalReceipts = 0;
    let grandTotalCount = 0;

    aggregated.forEach((item) => {
      const headName = item._id.head || 'Uncategorized';
      const subHeadName = item._id.subHead || 'General';
      const payments = round2(item.payments);
      const receipts = round2(item.receipts);
      const count = item.count;
      const net = round2(receipts - payments);

      grandTotalPayments = round2(grandTotalPayments + payments);
      grandTotalReceipts = round2(grandTotalReceipts + receipts);
      grandTotalCount += count;

      if (!headsMap[headName]) {
        headsMap[headName] = {
          head: headName,
          totalPayments: 0,
          totalReceipts: 0,
          net: 0,
          count: 0,
          subHeads: [],
        };
      }

      headsMap[headName].totalPayments = round2(headsMap[headName].totalPayments + payments);
      headsMap[headName].totalReceipts = round2(headsMap[headName].totalReceipts + receipts);
      headsMap[headName].net = round2(headsMap[headName].totalReceipts - headsMap[headName].totalPayments);
      headsMap[headName].count += count;

      headsMap[headName].subHeads.push({
        subHead: subHeadName,
        head: headName,
        payments,
        receipts,
        net,
        count,
      });
    });

    const headsList = Object.values(headsMap);

    // Canonical UK corporate ordering: Income, Admin Expenses, Loan, Interest Expenses, Others, Property Purchase
    const priorityOrder = ['income', 'admin expenses', 'loan', 'interest expenses', 'property purchase', 'others'];
    headsList.sort((a, b) => {
      const idxA = priorityOrder.indexOf(a.head.toLowerCase().trim());
      const idxB = priorityOrder.indexOf(b.head.toLowerCase().trim());
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.head.localeCompare(b.head);
    });

    return apiSuccess(res, {
      heads: headsList,
      totals: {
        totalPayments: grandTotalPayments,
        totalReceipts: grandTotalReceipts,
        netMovement: round2(grandTotalReceipts - grandTotalPayments),
        totalTransactions: grandTotalCount,
      },
    });
  } catch (error) {
    return apiError(res, 'Failed to generate Head & Sub Head summary', 500, error);
  }
};

export const getTransactions = async (req, res) => {
  try {
    const {
      propertyId,
      categoryId,
      headId,
      subHeadId,
      accountId,
      type,
      startDate,
      endDate,
      search,
      includeDeleted,
    } = req.query;
    const query = { companyId: req.companyId };

    if (includeDeleted !== 'true') {
      query.status = 'POSTED';
      query.isDeleted = { $ne: true };
    }

    if (propertyId) query.propertyId = propertyId;
    if (categoryId) query.categoryId = categoryId;
    if (headId) query.headId = headId;
    if (subHeadId) query.subHeadId = subHeadId;
    if (accountId) query.$or = [{ accountId }, { counterAccountId: accountId }];
    if (type) query.transactionType = type;

    if (startDate || endDate) {
      query.transactionDate = {};
      if (startDate) query.transactionDate.$gte = new Date(startDate);
      if (endDate) query.transactionDate.$lte = new Date(endDate);
    }

    if (search) {
      query.$or = [
        { narration: { $regex: search, $options: 'i' } },
        { voucherNo: { $regex: search, $options: 'i' } },
        { reference: { $regex: search, $options: 'i' } },
        { head: { $regex: search, $options: 'i' } },
        { subHead: { $regex: search, $options: 'i' } },
      ];
    }

    const transactions = await Transaction.find(query)
      .populate('accountId', 'name sortCode accountNumber accountType')
      .populate('counterAccountId', 'name sortCode accountNumber')
      .populate('categoryId', 'name type code')
      .populate('headId', 'name type code isMainHead')
      .populate('subHeadId', 'name type code isRentalHead')
      .populate('propertyId', 'name addressLine1 postcode')
      .populate('unitId', 'unitName')
      .populate('mortgageId', 'lenderName accountReference')
      .sort({ transactionDate: -1, createdAt: -1 })
      .limit(200)
      .lean();

    return apiSuccess(res, { transactions, total: transactions.length });
  } catch (error) {
    return apiError(res, 'Failed to fetch ledger transactions', 500, error);
  }
};

export const recordExpense = async (req, res) => {
  try {
    const {
      transactionDate = new Date(),
      accountId,
      categoryId,
      headId = null,
      subHeadId = null,
      head = '',
      subHead = '',
      amount,
      propertyId = null,
      unitId = null,
      narration,
      reference = '',
      periodMonth = null,
      receiptUrl = '',
      receiptFilename = '',
      documents = [],
    } = req.body;

    const numAmount = round2(amount);
    const effectiveCatId = categoryId || subHeadId || headId;
    if (!accountId || (!effectiveCatId && !head && !subHead) || numAmount <= 0 || !narration) {
      return apiError(res, 'Bank Account, Category Head, Amount (£), and Narration are required.', 400);
    }

    // Verify account belongs to active company
    const acc = await Account.findOne({ _id: accountId, companyId: req.companyId });
    if (!acc) return apiError(res, 'Bank Account not found in active company.', 400);

    if (propertyId) {
      const prop = await Property.findOne({ _id: propertyId, companyId: req.companyId });
      if (!prop) return apiError(res, 'Property not found in active company.', 400);
    }
    if (unitId) {
      const u = await Unit.findOne({ _id: unitId, companyId: req.companyId });
      if (!u) return apiError(res, 'Unit not found in active company.', 400);
    }

    const { transaction, voucher } = await postLedgerTransaction({
      companyId: req.companyId,
      transactionDate,
      transactionType: 'EXPENSE',
      accountId,
      categoryId: effectiveCatId,
      headId,
      subHeadId,
      head,
      subHead,
      amount: numAmount,
      direction: 'OUT',
      propertyId,
      unitId,
      periodMonth,
      narration: narration.trim(),
      reference: reference.trim(),
      userId: req.user?._id,
      receiptUrl: receiptUrl.trim(),
      receiptFilename: receiptFilename.trim(),
      documents,
    });

    return apiSuccess(
      res,
      { transaction, voucher },
      `Expense voucher ${voucher.voucherNumber} (£${numAmount.toFixed(2)}) recorded successfully.`,
      201
    );
  } catch (error) {
    return apiError(res, error.message || 'Failed to record expense', 500, error);
  }
};

export const recordIncome = async (req, res) => {
  try {
    const {
      transactionDate = new Date(),
      accountId,
      categoryId,
      headId = null,
      subHeadId = null,
      head = '',
      subHead = '',
      amount,
      propertyId = null,
      unitId = null,
      narration,
      reference = '',
      periodMonth = null,
      receiptUrl = '',
      receiptFilename = '',
      documents = [],
    } = req.body;

    const numAmount = round2(amount);
    const effectiveCatId = categoryId || subHeadId || headId;
    if (!accountId || (!effectiveCatId && !head && !subHead) || numAmount <= 0 || !narration) {
      return apiError(res, 'Bank Account, Income Head Category, Amount (£), and Narration are required.', 400);
    }

    // Verify account belongs to active company
    const acc = await Account.findOne({ _id: accountId, companyId: req.companyId });
    if (!acc) return apiError(res, 'Bank Account not found in active company.', 400);

    if (propertyId) {
      const prop = await Property.findOne({ _id: propertyId, companyId: req.companyId });
      if (!prop) return apiError(res, 'Property not found in active company.', 400);
    }
    if (unitId) {
      const u = await Unit.findOne({ _id: unitId, companyId: req.companyId });
      if (!u) return apiError(res, 'Unit not found in active company.', 400);
    }

    const { transaction, voucher } = await postLedgerTransaction({
      companyId: req.companyId,
      transactionDate,
      transactionType: 'INCOME',
      accountId,
      categoryId: effectiveCatId,
      headId,
      subHeadId,
      head,
      subHead,
      amount: numAmount,
      direction: 'IN',
      propertyId,
      unitId,
      periodMonth,
      narration: narration.trim(),
      reference: reference.trim(),
      userId: req.user?._id,
      receiptUrl: receiptUrl.trim(),
      receiptFilename: receiptFilename.trim(),
      documents,
    });

    return apiSuccess(
      res,
      { transaction, voucher },
      `Income voucher ${voucher.voucherNumber} (£${numAmount.toFixed(2)}) recorded successfully.`,
      201
    );
  } catch (error) {
    return apiError(res, error.message || 'Failed to record income', 500, error);
  }
};

export const getCategories = async (req, res) => {
  try {
    const { type, includeInactive, propertyId } = req.query;
    const query = includeInactive === 'true' ? { companyId: req.companyId } : { companyId: req.companyId, isActive: true };
    if (type) query.type = type;
    if (propertyId) query.propertyId = propertyId;

    const categories = await Category.find(query)
      .populate('propertyId', 'name postcode')
      .populate('unitId', 'unitName')
      .populate('parentCategoryId', 'name code')
      .sort({ type: 1, name: 1 })
      .lean();
    return apiSuccess(res, { categories, total: categories.length });
  } catch (error) {
    return apiError(res, 'Failed to fetch categories', 500, error);
  }
};

export const createCategory = async (req, res) => {
  try {
    const data = { ...req.body, companyId: req.companyId };
    if (data.propertyId) {
      const prop = await Property.findOne({ _id: data.propertyId, companyId: req.companyId });
      if (!prop) return apiError(res, 'Property not found in active company', 400);
    }
    if (data.unitId) {
      const u = await Unit.findOne({ _id: data.unitId, companyId: req.companyId });
      if (!u) return apiError(res, 'Unit not found in active company', 400);
    }
    if (data.parentCategoryId) {
      const parent = await Category.findOne({ _id: data.parentCategoryId, companyId: req.companyId });
      if (!parent) return apiError(res, 'Parent category head not found in active company', 400);
    }

    if (data.propertyId && !data.unitId) {
      data.expenseClassification = 'PROPERTY_OWN_EXPENSE';
    } else if (data.propertyId && data.unitId) {
      data.expenseClassification = 'UNIT_EXPENSE';
    } else {
      data.expenseClassification = data.expenseClassification || 'GENERAL_EXPENSE';
    }
    const category = await Category.create(data);
    return apiSuccess(res, category, 'Category head created successfully', 201);
  } catch (error) {
    return apiError(res, error.message || 'Failed to create category', 400, error);
  }
};

export const updateCategory = async (req, res) => {
  try {
    const {
      name,
      code,
      type,
      isRentalHead,
      isAllowableTaxDeduction,
      defaultScope,
      description,
      isActive,
      propertyId,
      unitId,
      parentCategoryId,
      isMainHead,
      expenseClassification,
    } = req.body;
    const category = await Category.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!category) return apiError(res, 'Category head not found', 404);

    if (propertyId) {
      const prop = await Property.findOne({ _id: propertyId, companyId: req.companyId });
      if (!prop) return apiError(res, 'Property not found in active company', 400);
    }
    if (unitId) {
      const u = await Unit.findOne({ _id: unitId, companyId: req.companyId });
      if (!u) return apiError(res, 'Unit not found in active company', 400);
    }
    if (parentCategoryId) {
      const parent = await Category.findOne({ _id: parentCategoryId, companyId: req.companyId });
      if (!parent) return apiError(res, 'Parent category head not found in active company', 400);
    }

    if (name !== undefined) category.name = name.trim();
    if (code !== undefined) category.code = code ? code.trim().toUpperCase() : '';
    if (type !== undefined) category.type = type;
    if (isRentalHead !== undefined) category.isRentalHead = Boolean(isRentalHead);
    if (isAllowableTaxDeduction !== undefined) category.isAllowableTaxDeduction = Boolean(isAllowableTaxDeduction);
    if (defaultScope !== undefined) category.defaultScope = defaultScope;
    if (description !== undefined) category.description = description ? description.trim() : '';
    if (isActive !== undefined) category.isActive = Boolean(isActive);
    if (propertyId !== undefined) category.propertyId = propertyId || null;
    if (unitId !== undefined) category.unitId = unitId || null;
    if (parentCategoryId !== undefined) category.parentCategoryId = parentCategoryId || null;
    if (isMainHead !== undefined) category.isMainHead = Boolean(isMainHead);
    if (expenseClassification !== undefined) category.expenseClassification = expenseClassification;

    const updated = await updateCategoryHierarchy({
      companyId: req.companyId,
      categoryId: req.params.id,
      updateData: req.body,
    });
    return apiSuccess(res, updated, 'Category updated successfully');
  } catch (error) {
    return apiError(res, error.message || 'Failed to update category', 400, error);
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const result = await deleteCategoryHierarchy({
      companyId: req.companyId,
      categoryId: req.params.id,
    });
    return apiSuccess(res, null, result.message);
  } catch (error) {
    return apiError(res, error.message || 'Failed to delete category', 400, error);
  }
};

export const getCategoryHierarchyController = async (req, res) => {
  try {
    const hierarchy = await getCategoryHierarchy(req.companyId);
    return apiSuccess(res, hierarchy);
  } catch (error) {
    return apiError(res, error.message || 'Failed to fetch category hierarchy', 500, error);
  }
};

export const createHeadCategoryController = async (req, res) => {
  try {
    const head = await createHeadCategory({
      companyId: req.companyId,
      ...req.body,
    });
    return apiSuccess(res, head, 'Head category created successfully', 201);
  } catch (error) {
    return apiError(res, error.message || 'Failed to create head category', 400, error);
  }
};

export const createSubHeadCategoryController = async (req, res) => {
  try {
    const subHead = await createSubHeadCategory({
      companyId: req.companyId,
      ...req.body,
    });
    return apiSuccess(res, subHead, 'Sub Head category created successfully', 201);
  } catch (error) {
    return apiError(res, error.message || 'Failed to create sub head category', 400, error);
  }
};

export const updateCategoryHierarchyController = async (req, res) => {
  try {
    const category = await updateCategoryHierarchy({
      companyId: req.companyId,
      categoryId: req.params.id,
      updateData: req.body,
    });
    return apiSuccess(res, category, 'Category updated successfully');
  } catch (error) {
    return apiError(res, error.message || 'Failed to update category', 400, error);
  }
};

export const deleteCategoryHierarchyController = async (req, res) => {
  try {
    const result = await deleteCategoryHierarchy({
      companyId: req.companyId,
      categoryId: req.params.id,
    });
    return apiSuccess(res, null, result.message);
  } catch (error) {
    return apiError(res, error.message || 'Failed to delete category', 400, error);
  }
};

export const previewCategoryBackfillController = async (req, res) => {
  try {
    const preview = await previewBackfill(req.companyId);
    return apiSuccess(res, preview);
  } catch (error) {
    return apiError(res, error.message || 'Failed to preview category backfill', 500, error);
  }
};

export const applyCategoryBackfillController = async (req, res) => {
  try {
    const result = await applyBackfill(req.companyId, req.body.items);
    return apiSuccess(res, result, `Backfilled ${result.updatedCount} transaction(s) successfully.`);
  } catch (error) {
    return apiError(res, error.message || 'Failed to apply category backfill', 500, error);
  }
};

export const updateTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const reason = req.body.reason || req.body.editReason || 'Updated via Ledger';

    const transaction = await updateComprehensiveTransaction({
      transactionId: id,
      companyId: req.companyId,
      updateData,
      userId: req.user?._id || req.user?.id,
      userName: req.user?.name || 'System Operator',
      reason,
    });

    const populatedTx = await Transaction.findOne({ _id: transaction._id, companyId: req.companyId })
      .populate('accountId', 'name sortCode accountNumber accountType')
      .populate('counterAccountId', 'name sortCode accountNumber')
      .populate('categoryId', 'name type code')
      .populate('headId', 'name type code isMainHead')
      .populate('subHeadId', 'name type code isRentalHead')
      .populate('propertyId', 'name addressLine1 postcode')
      .populate('unitId', 'unitName')
      .populate('mortgageId', 'lenderName accountReference')
      .lean();

    return apiSuccess(res, populatedTx, `Transaction ${transaction.voucherNo} updated and synchronized successfully.`);
  } catch (error) {
    return apiError(res, error.message || 'Failed to update transaction', 400, error);
  }
};

export const deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = '' } = req.body;

    const voidedTx = await deleteLedgerTransaction({
      transactionId: id,
      companyId: req.companyId,
      userId: req.user?._id || req.user?.id,
      userName: req.user?.name || 'System Operator',
      reason,
    });

    return apiSuccess(
      res,
      voidedTx,
      `Transaction ${voidedTx.voucherNo} (£${voidedTx.amount.toFixed(2)}) voided and moved to Recycle Bin.`
    );
  } catch (error) {
    return apiError(res, error.message || 'Failed to delete transaction', 400, error);
  }
};

export const permanentlyDeleteTransactions = async (req, res) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100) {
      return apiError(res, 'Select between 1 and 100 recycle-bin transactions to permanently delete.', 400);
    }

    const transactionIds = [...new Set(ids.map((id) => String(id)))];
    if (transactionIds.some((id) => !/^[a-f\d]{24}$/i.test(id))) {
      return apiError(res, 'One or more transaction IDs are invalid.', 400);
    }

    const recycleBinFilter = {
      companyId: req.companyId,
      _id: { $in: transactionIds },
      $or: [{ isDeleted: true }, { status: 'VOID' }],
    };
    const eligibleCount = await Transaction.countDocuments(recycleBinFilter);
    if (eligibleCount !== transactionIds.length) {
      return apiError(res, 'One or more selected transactions are not in this company’s recycle bin.', 404);
    }

    const result = await Transaction.deleteMany(recycleBinFilter);
    if (result.deletedCount !== transactionIds.length) {
      return apiError(res, `Only ${result.deletedCount} of ${transactionIds.length} selected transactions were permanently deleted. Refresh the recycle bin and try again.`, 409);
    }

    return apiSuccess(
      res,
      { deletedCount: result.deletedCount },
      `${result.deletedCount} transaction record${result.deletedCount === 1 ? '' : 's'} permanently deleted. Linked records and audit logs were retained.`
    );
  } catch (error) {
    return apiError(res, error.message || 'Failed to permanently delete transactions', 500, error);
  }
};

export const restoreTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = '' } = req.body;

    const restoredTx = await restoreLedgerTransaction({
      transactionId: id,
      companyId: req.companyId,
      userId: req.user?._id || req.user?.id,
      userName: req.user?.name || 'System Operator',
      reason,
    });

    const populatedTx = await Transaction.findOne({ _id: restoredTx._id, companyId: req.companyId })
      .populate('accountId', 'name sortCode accountNumber accountType')
      .populate('counterAccountId', 'name sortCode accountNumber')
      .populate('categoryId', 'name type code')
      .populate('headId', 'name type code isMainHead')
      .populate('subHeadId', 'name type code isRentalHead')
      .populate('propertyId', 'name addressLine1 postcode')
      .populate('unitId', 'unitName')
      .populate('mortgageId', 'lenderName accountReference')
      .lean();

    return apiSuccess(
      res,
      populatedTx,
      `Transaction ${restoredTx.voucherNo} (£${restoredTx.amount.toFixed(2)}) restored successfully.`
    );
  } catch (error) {
    return apiError(res, error.message || 'Failed to restore transaction', 400, error);
  }
};

export const getDeletedTransactions = async (req, res) => {
  try {
    const transactions = await getRecycleBinTransactions({
      companyId: req.companyId,
      query: req.query,
    });

    return apiSuccess(res, {
      transactions,
      total: transactions.length,
    });
  } catch (error) {
    return apiError(res, error.message || 'Failed to fetch deleted transactions', 500, error);
  }
};

export const getTransactionAudit = async (req, res) => {
  try {
    const { id } = req.params;
    const auditData = await getTransactionAuditHistory({
      transactionId: id,
      companyId: req.companyId,
    });

    return apiSuccess(res, auditData);
  } catch (error) {
    return apiError(res, error.message || 'Failed to fetch transaction audit history', 400, error);
  }
};

export const getTransactionById = async (req, res) => {
  try {
    const { id } = req.params;
    const tx = await Transaction.findOne({ _id: id, companyId: req.companyId })
      .populate('accountId', 'name sortCode accountNumber accountType currentBalance')
      .populate('counterAccountId', 'name sortCode accountNumber currentBalance')
      .populate('categoryId', 'name type code')
      .populate('headId', 'name type code isMainHead')
      .populate('subHeadId', 'name type code isRentalHead')
      .populate('propertyId', 'name addressLine1 postcode')
      .populate('unitId', 'unitName')
      .populate('mortgageId', 'lenderName accountReference outstandingPrincipalBalance')
      .lean();

    if (!tx) {
      return apiError(res, 'Transaction not found in active company', 404);
    }

    return apiSuccess(res, tx);
  } catch (error) {
    return apiError(res, error.message || 'Failed to fetch transaction', 500, error);
  }
};

/**
 * Upload general ledger entry receipt (Rent, Expense, Transfer, Other Income, Mortgage)
 */
export const uploadLedgerReceipt = async (req, res) => {
  try {
    if (!req.file) {
      return apiError(res, 'No receipt file provided for upload', 400);
    }

    let fileUrl = '';
    if (isCloudinaryConfigured()) {
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: `${CLOUDINARY_FOLDER}/receipts`,
            resource_type: 'auto',
          },
          (err, result) => {
            if (err) return reject(err);
            resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });
      fileUrl = uploadResult.secure_url;
    } else {
      const mime = req.file.mimetype || 'application/octet-stream';
      fileUrl = `data:${mime};base64,${req.file.buffer.toString('base64')}`;
    }

    return apiSuccess(
      res,
      {
        url: fileUrl,
        filename: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      },
      'Receipt uploaded successfully',
      201
    );
  } catch (error) {
    return apiError(res, error.message || 'Failed to upload receipt', 500, error);
  }
};

/**
 * Attach a receipt file directly to an existing transaction
 */
export const attachTransactionReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    const transaction = await Transaction.findOne({ _id: id, companyId: req.companyId });
    if (!transaction) {
      return apiError(res, 'Transaction not found in active company', 404);
    }

    let fileUrl = req.body.receiptUrl || '';
    let filename = req.body.receiptFilename || req.body.title || 'Receipt Document';

    if (req.file) {
      filename = req.file.originalname;
      if (isCloudinaryConfigured()) {
        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: `${CLOUDINARY_FOLDER}/receipts`,
              resource_type: 'auto',
            },
            (err, result) => {
              if (err) return reject(err);
              resolve(result);
            }
          );
          stream.end(req.file.buffer);
        });
        fileUrl = uploadResult.secure_url;
      } else {
        const mime = req.file.mimetype || 'application/octet-stream';
        fileUrl = `data:${mime};base64,${req.file.buffer.toString('base64')}`;
      }
    }

    if (!fileUrl) {
      return apiError(res, 'No file or receipt URL provided', 400);
    }

    transaction.receiptUrl = fileUrl;
    transaction.receiptFilename = filename;
    transaction.documents.push({
      title: filename,
      url: fileUrl,
      docType: req.body.docType || 'RECEIPT',
      uploadedAt: new Date(),
    });

    await transaction.save();

    if (transaction.voucherId) {
      await Voucher.findOneAndUpdate(
        { _id: transaction.voucherId, companyId: req.companyId },
        {
          receiptUrl: fileUrl,
          receiptFilename: filename,
          $push: {
            documents: {
              title: filename,
              url: fileUrl,
              docType: req.body.docType || 'RECEIPT',
              uploadedAt: new Date(),
            },
          },
        }
      );
    }

    return apiSuccess(res, transaction, 'Receipt attached to transaction successfully');
  } catch (error) {
    return apiError(res, error.message || 'Failed to attach receipt', 500, error);
  }
};

/**
 * Remove receipt from transaction
 */
export const removeTransactionReceipt = async (req, res) => {
  try {
    const { id } = req.params;
    const transaction = await Transaction.findOne({ _id: id, companyId: req.companyId });
    if (!transaction) {
      return apiError(res, 'Transaction not found', 404);
    }

    transaction.receiptUrl = '';
    transaction.receiptFilename = '';
    transaction.documents = [];
    await transaction.save();

    if (transaction.voucherId) {
      await Voucher.findOneAndUpdate(
        { _id: transaction.voucherId, companyId: req.companyId },
        {
          receiptUrl: '',
          receiptFilename: '',
          documents: [],
        }
      );
    }

    return apiSuccess(res, transaction, 'Receipt removed successfully');
  } catch (error) {
    return apiError(res, error.message || 'Failed to remove receipt', 500, error);
  }
};
