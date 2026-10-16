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
import { apiSuccess, apiError } from '../utils/apiResponse.js';
import cloudinary, { isCloudinaryConfigured, CLOUDINARY_FOLDER } from '../config/cloudinary.js';

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

export const getLedgerEntities = async (req, res) => {
  try {
    const [accounts, properties, tenants, mortgages, categories] = await Promise.all([
      Account.find({ companyId: req.companyId, isActive: true }).sort({ accountType: 1, name: 1 }).lean(),
      Property.find({ companyId: req.companyId, isActive: true }).sort({ name: 1 }).lean(),
      Tenant.find({ companyId: req.companyId, isActive: true }).sort({ fullName: 1 }).lean(),
      Mortgage.find({ companyId: req.companyId, status: 'ACTIVE' }).populate('propertyId', 'name').sort({ lenderName: 1 }).lean(),
      Category.find({ companyId: req.companyId, isActive: true })
        .populate('propertyId', 'name postcode')
        .populate('parentCategoryId', 'name')
        .sort({ type: 1, name: 1 })
        .lean(),
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

    const propertyEntities = properties.map((p) => ({
      id: p._id,
      name: p.name,
      type: 'PROPERTY',
      subtext: `${p.postcode || ''} · ${p.city || 'UK'} · ${p.totalUnits || 1} Units`,
    }));

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

    return apiSuccess(res, {
      bankAccounts,
      cashAccounts,
      properties: propertyEntities,
      tenants: tenantEntities,
      mortgages: mortgageEntities,
      expenseHeads,
      incomeHeads,
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
            categoryName: tx.categoryId?.name || tx.transactionType,
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

    // 2. PROPERTY LEDGER
    else if (type === 'PROPERTY') {
      let prop = null;
      if (entityId && mongoose.Types.ObjectId.isValid(entityId)) {
        prop = await Property.findOne({ _id: entityId, companyId: req.companyId }).lean();
      }
      if (!prop) {
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
        ledgerTitle = `Property Ledger: ${prop.name}`;
        entitySubtext = `${prop.addressLine1 || ''}, ${prop.city || 'UK'} (${prop.postcode || ''}) · Valuation: £${(prop.currentValuation || 0).toFixed(2)}`;

        const txQuery = {
          companyId: req.companyId,
          status: 'POSTED',
          isDeleted: { $ne: true },
          propertyId: effectivePropId,
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
          .populate('accountId', 'name')
          .populate('categoryId', 'name type')
          .populate('unitId', 'unitName')
          .lean();

        let netCashFlow = 0;
        entries = txns.map((tx) => {
          const isIncome = tx.direction === 'IN' || tx.transactionType === 'INCOME';
          const debit = isIncome ? tx.amount : 0;
          const credit = !isIncome ? tx.amount : 0;

          netCashFlow = round2(netCashFlow + (isIncome ? tx.amount : -tx.amount));
          totalDebit += debit;
          totalCredit += credit;

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
            unitName: tx.unitId?.unitName || '',
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

    // 6. RENT JOURNAL / OTHER INCOME / CONSOLIDATED ALL
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
          categoryName: tx.categoryId?.name || tx.transactionType,
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

export const getTransactions = async (req, res) => {
  try {
    const { propertyId, categoryId, accountId, type, startDate, endDate, search, includeDeleted } = req.query;
    const query = { companyId: req.companyId };

    if (includeDeleted !== 'true') {
      query.status = 'POSTED';
      query.isDeleted = { $ne: true };
    }

    if (propertyId) query.propertyId = propertyId;
    if (categoryId) query.categoryId = categoryId;
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
      ];
    }

    const transactions = await Transaction.find(query)
      .populate('accountId', 'name sortCode accountNumber accountType')
      .populate('counterAccountId', 'name sortCode accountNumber')
      .populate('categoryId', 'name type code')
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
    if (!accountId || !categoryId || numAmount <= 0 || !narration) {
      return apiError(res, 'Bank Account, Category Head, Amount (£), and Narration are required.', 400);
    }

    // Verify account and category belong to active company
    const acc = await Account.findOne({ _id: accountId, companyId: req.companyId });
    if (!acc) return apiError(res, 'Bank Account not found in active company.', 400);

    const cat = await Category.findOne({ _id: categoryId, companyId: req.companyId });
    if (!cat) return apiError(res, 'Category Head not found in active company.', 400);

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
      categoryId,
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
    if (!accountId || !categoryId || numAmount <= 0 || !narration) {
      return apiError(res, 'Bank Account, Income Head Category, Amount (£), and Narration are required.', 400);
    }

    // Verify account and category belong to active company
    const acc = await Account.findOne({ _id: accountId, companyId: req.companyId });
    if (!acc) return apiError(res, 'Bank Account not found in active company.', 400);

    const cat = await Category.findOne({ _id: categoryId, companyId: req.companyId });
    if (!cat) return apiError(res, 'Category Head not found in active company.', 400);

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
      categoryId,
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

    await category.save();
    return apiSuccess(res, category, 'Nominal head category updated successfully');
  } catch (error) {
    return apiError(res, error.message || 'Failed to update category', 400, error);
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const usedCount = await Transaction.countDocuments({ companyId: req.companyId, categoryId: id });
    if (usedCount > 0) {
      await Category.findOneAndUpdate({ _id: id, companyId: req.companyId }, { isActive: false });
      return apiSuccess(res, null, `Category has ${usedCount} associated transactions and was marked inactive.`);
    }
    await Category.findOneAndDelete({ _id: id, companyId: req.companyId });
    return apiSuccess(res, null, 'Category head deleted successfully');
  } catch (error) {
    return apiError(res, error.message || 'Failed to delete category', 400, error);
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
