import Transaction from '../models/Transaction.js';
import Property from '../models/Property.js';
import MortgagePayment from '../models/MortgagePayment.js';
import RentSchedule from '../models/RentSchedule.js';
import PropertyDemand from '../models/PropertyDemand.js';
import { round2 } from './ledgerService.js';

/**
 * Known Balance Sheet / Liability / Loan entity names to prevent
 * loan drawdowns and principal movements from counting as revenue or operating expenses.
 */
const KNOWN_LOAN_IDENTIFIERS = [
  'loan',
  'director loan',
  'directors loan',
  'intra company loan',
  'inter company loan',
  'funding circle',
  'capital on tap',
  'camden cycles',
  'elite corporate',
  'savings',
  'remortgage',
  'borrowing',
  'drawdown',
];

/**
 * Classify any UK property financial transaction into its proper accounting category.
 *
 * Classifications:
 * - 'INCOME': Operating revenue (Rent collections, refunds, recharge recovery)
 * - 'OPERATING_EXPENSE': Revenue expense (Repairs, insurance, management, council tax, utilities)
 * - 'FINANCE_COST': Financing cost (Mortgage interest, loan interest, bank overdraft interest)
 * - 'EXCLUDED_TRANSFER': Internal bank/cash account transfer (Balance sheet cash movement)
 * - 'EXCLUDED_LOAN': Loan drawdown or principal repayment (Balance sheet liability)
 * - 'EXCLUDED_CAPITAL': Property purchase, legal acquisition cost, structural capex (Balance sheet asset)
 * - 'EXCLUDED_PRINCIPAL': Mortgage principal repayment component (Balance sheet liability reduction)
 * - 'EXCLUDED_EQUITY': Owner capital contribution or personal drawing
 * - 'NEEDS_REVIEW': Unclassified or ambiguous transactions flagged for manual review
 */
export function classifyTransaction(tx, mortgagePaymentMap = new Map()) {
  // 1. Explicit Operator Override
  if (tx.accountingClassification) {
    const override = tx.accountingClassification.toUpperCase();
    if (override === 'INCOME') {
      return {
        classification: 'INCOME',
        subType: tx.subHead || tx.head || 'OPERATING_INCOME',
        isExcluded: false,
        isProfitLoss: true,
        reason: 'Operator manual override as Income',
        pnlAmount: round2(tx.amount),
      };
    }
    if (override === 'OPERATING_EXPENSE') {
      return {
        classification: 'OPERATING_EXPENSE',
        subType: tx.subHead || tx.head || 'OPERATING_EXPENSE',
        isExcluded: false,
        isProfitLoss: true,
        reason: 'Operator manual override as Operating Expense',
        pnlAmount: round2(tx.amount),
      };
    }
    if (override === 'FINANCE_COST') {
      return {
        classification: 'FINANCE_COST',
        subType: tx.subHead || tx.head || 'FINANCE_COST',
        isExcluded: false,
        isProfitLoss: true,
        reason: 'Operator manual override as Finance Cost',
        pnlAmount: round2(tx.amount),
      };
    }
    if (override.startsWith('EXCLUDED') || override === 'TRANSFER' || override === 'CAPITAL_EXPENDITURE' || override === 'LIABILITY_LOAN' || override === 'OWNER_EQUITY') {
      return {
        classification: override,
        subType: tx.subHead || tx.head || 'BALANCE_SHEET_EXCLUSION',
        isExcluded: true,
        isProfitLoss: false,
        reason: 'Operator manual override excluded from P&L',
        pnlAmount: 0,
      };
    }
    if (override === 'NEEDS_REVIEW') {
      return {
        classification: 'NEEDS_REVIEW',
        subType: 'UNCLASSIFIED',
        isExcluded: true,
        isProfitLoss: false,
        reason: 'Marked for operator review',
        pnlAmount: 0,
      };
    }
  }

  // 2. Internal Transfers between Bank/Cash Accounts
  if (
    tx.transactionType === 'TRANSFER' ||
    Boolean(tx.counterAccountId) ||
    tx.categoryId?.type === 'TRANSFER'
  ) {
    return {
      classification: 'EXCLUDED_TRANSFER',
      subType: 'INTERNAL_ACCOUNT_TRANSFER',
      isExcluded: true,
      isProfitLoss: false,
      reason: 'Internal transfer between company accounts (Balance Sheet liquidity movement)',
      pnlAmount: 0,
    };
  }

  const headLower = (tx.head || '').toLowerCase().trim();
  const subHeadLower = (tx.subHead || '').toLowerCase().trim();
  const narrationLower = (tx.narration || '').toLowerCase().trim();

  // 3. Balance Sheet Loan & Financing Liability Movements
  const isLoanIdentified =
    headLower === 'loan' ||
    tx.categoryId?.type === 'LIABILITY_LOAN' ||
    KNOWN_LOAN_IDENTIFIERS.some(
      (id) => subHeadLower.includes(id) || narrationLower.includes(id)
    );

  if (isLoanIdentified) {
    return {
      classification: 'EXCLUDED_LOAN',
      subType: tx.subHead || 'LOAN_MOVEMENT',
      isExcluded: true,
      isProfitLoss: false,
      reason: 'Loan proceeds received or loan principal repaid (Balance Sheet liability)',
      pnlAmount: 0,
    };
  }

  // 4. Balance Sheet Capital Expenditure & Asset Purchases
  const isCapexIdentified =
    headLower === 'property purchase' ||
    tx.transactionType === 'CAPITAL_ADJUSTMENT' ||
    tx.categoryId?.type === 'CAPITAL_EXPENDITURE' ||
    subHeadLower.includes('auction deposit') ||
    narrationLower.includes('auction deposit');

  if (isCapexIdentified) {
    return {
      classification: 'EXCLUDED_CAPITAL',
      subType: tx.subHead || 'PROPERTY_CAPEX',
      isExcluded: true,
      isProfitLoss: false,
      reason: 'Property purchase deposit or asset capitalisation (Balance Sheet asset value)',
      pnlAmount: 0,
    };
  }

  // 5. Drawings / Cash Floats / Security Deposits Return (e.g. Alsop Auction return)
  if (subHeadLower === 'alsop' || subHeadLower === 'cash withdrawal') {
    return {
      classification: 'EXCLUDED_FROM_PNL',
      subType: tx.subHead,
      isExcluded: true,
      isProfitLoss: false,
      reason: 'Auction deposit return or petty cash float movement (Excluded from P&L)',
      pnlAmount: 0,
    };
  }

  // 6. Mortgage Payments (Extract exact Interest vs Principal split)
  if (tx.transactionType === 'MORTGAGE_PAYMENT' || tx.mortgageId) {
    const linkedPayment =
      mortgagePaymentMap.get(String(tx._id)) ||
      mortgagePaymentMap.get(String(tx.voucherNo));

    if (linkedPayment) {
      const interestPart = round2(linkedPayment.interestAmount || 0);
      const principalPart = round2(linkedPayment.principalAmount || 0);
      const feePart = round2(linkedPayment.feeAmount || 0);

      return {
        classification: 'FINANCE_COST',
        subType: tx.subHead || 'MORTGAGE_INTEREST',
        isExcluded: false,
        isProfitLoss: true,
        reason: 'Mortgage payment interest component (P&L finance cost)',
        pnlAmount: interestPart,
        operatingFeeAmount: feePart,
        principalAmountExcluded: principalPart,
      };
    }

    // SPV Company mortgages without split records (e.g. direct bank imported statements)
    // SPV property company mortgages are interest-only facilities
    if (headLower === 'interest expenses' || tx.categoryId?.type === 'FINANCE_COST') {
      return {
        classification: 'FINANCE_COST',
        subType: tx.subHead || 'MORTGAGE_INTEREST',
        isExcluded: false,
        isProfitLoss: true,
        reason: 'Mortgage interest payment (Interest-only facility)',
        pnlAmount: round2(tx.amount),
      };
    }
  }

  // 7. Finance Costs (Interest Expenses)
  if (
    headLower === 'interest expenses' ||
    tx.categoryId?.type === 'FINANCE_COST'
  ) {
    return {
      classification: 'FINANCE_COST',
      subType: tx.subHead || 'INTEREST_EXPENSE',
      isExcluded: false,
      isProfitLoss: true,
      reason: 'Finance cost / Property loan interest',
      pnlAmount: round2(tx.amount),
    };
  }

  // 8. Operating Income
  if (
    headLower === 'income' ||
    tx.categoryId?.type === 'INCOME' ||
    (tx.transactionType === 'INCOME' && tx.direction === 'IN')
  ) {
    const isRent =
      subHeadLower === 'rent' ||
      tx.categoryId?.isRentalHead ||
      Boolean(tx.propertyId);

    return {
      classification: 'INCOME',
      subType: isRent ? 'RENTAL_INCOME' : tx.subHead || 'OTHER_INCOME',
      isExcluded: false,
      isProfitLoss: true,
      reason: isRent ? 'Rental revenue' : 'Other operating business income',
      pnlAmount: round2(tx.amount),
    };
  }

  // 9. Operating Expenses (Admin Expenses)
  if (
    headLower === 'admin expenses' ||
    tx.categoryId?.type === 'OPERATING_EXPENSE' ||
    (tx.transactionType === 'EXPENSE' && tx.direction === 'OUT')
  ) {
    return {
      classification: 'OPERATING_EXPENSE',
      subType: tx.subHead || tx.categoryId?.name || 'ADMIN_EXPENSE',
      isExcluded: false,
      isProfitLoss: true,
      reason: 'General or property operating expense',
      pnlAmount: round2(tx.amount),
    };
  }

  // 10. Ambiguous or Uncategorized Transaction -> Flag for review
  return {
    classification: 'NEEDS_REVIEW',
    subType: 'UNCLASSIFIED',
    isExcluded: true,
    isProfitLoss: false,
    reason: 'Transaction lacks clear nominal head or contains conflicting direction and type',
    pnlAmount: 0,
  };
}

/**
 * Robust date parser supporting UK tax year (6 Apr - 5 Apr) and standard financial presets.
 * Also computes previous equivalent period for period-over-period comparison.
 */
export function parsePnLDateRange(datePreset = 'THIS_YEAR', startDate, endDate, taxYear) {
  const now = new Date();
  const curYear = now.getUTCFullYear();
  const curMonth = now.getUTCMonth(); // 0-indexed

  let periodStart = null;
  let periodEnd = null;
  let previousStart = null;
  let previousEnd = null;
  let periodLabel = '';
  let previousLabel = '';

  switch (datePreset) {
    case 'THIS_MONTH': {
      periodStart = new Date(Date.UTC(curYear, curMonth, 1, 0, 0, 0, 0));
      periodEnd = new Date(Date.UTC(curYear, curMonth + 1, 0, 23, 59, 59, 999));
      periodLabel = periodStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

      // Previous Month
      previousStart = new Date(Date.UTC(curYear, curMonth - 1, 1, 0, 0, 0, 0));
      previousEnd = new Date(Date.UTC(curYear, curMonth, 0, 23, 59, 59, 999));
      previousLabel = previousStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      break;
    }

    case 'LAST_MONTH': {
      periodStart = new Date(Date.UTC(curYear, curMonth - 1, 1, 0, 0, 0, 0));
      periodEnd = new Date(Date.UTC(curYear, curMonth, 0, 23, 59, 59, 999));
      periodLabel = periodStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

      // Month before last
      previousStart = new Date(Date.UTC(curYear, curMonth - 2, 1, 0, 0, 0, 0));
      previousEnd = new Date(Date.UTC(curYear, curMonth - 1, 0, 23, 59, 59, 999));
      previousLabel = previousStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
      break;
    }

    case 'THIS_QUARTER': {
      const qNum = Math.floor(curMonth / 3);
      periodStart = new Date(Date.UTC(curYear, qNum * 3, 1, 0, 0, 0, 0));
      periodEnd = new Date(Date.UTC(curYear, (qNum + 1) * 3, 0, 23, 59, 59, 999));
      periodLabel = `Q${qNum + 1} ${curYear}`;

      // Previous Quarter
      const prevQYear = qNum === 0 ? curYear - 1 : curYear;
      const prevQNum = qNum === 0 ? 3 : qNum - 1;
      previousStart = new Date(Date.UTC(prevQYear, prevQNum * 3, 1, 0, 0, 0, 0));
      previousEnd = new Date(Date.UTC(prevQYear, (prevQNum + 1) * 3, 0, 23, 59, 59, 999));
      previousLabel = `Q${prevQNum + 1} ${prevQYear}`;
      break;
    }

    case 'THIS_YEAR': {
      periodStart = new Date(Date.UTC(curYear, 0, 1, 0, 0, 0, 0));
      periodEnd = new Date(Date.UTC(curYear, 11, 31, 23, 59, 59, 999));
      periodLabel = `Calendar Year ${curYear}`;

      // Previous Calendar Year
      previousStart = new Date(Date.UTC(curYear - 1, 0, 1, 0, 0, 0, 0));
      previousEnd = new Date(Date.UTC(curYear - 1, 11, 31, 23, 59, 59, 999));
      previousLabel = `Calendar Year ${curYear - 1}`;
      break;
    }

    case 'LAST_YEAR': {
      periodStart = new Date(Date.UTC(curYear - 1, 0, 1, 0, 0, 0, 0));
      periodEnd = new Date(Date.UTC(curYear - 1, 11, 31, 23, 59, 59, 999));
      periodLabel = `Calendar Year ${curYear - 1}`;

      previousStart = new Date(Date.UTC(curYear - 2, 0, 1, 0, 0, 0, 0));
      previousEnd = new Date(Date.UTC(curYear - 2, 11, 31, 23, 59, 59, 999));
      previousLabel = `Calendar Year ${curYear - 2}`;
      break;
    }

    case 'UK_TAX_YEAR': {
      // Standard UK Tax Year runs from 6 April to 5 April
      let startYear;
      if (taxYear && taxYear.includes('-')) {
        startYear = parseInt(taxYear.split('-')[0], 10);
      } else {
        // If current date is before 6 April, tax year started last year
        startYear = curMonth < 3 || (curMonth === 3 && now.getUTCDate() < 6) ? curYear - 1 : curYear;
      }

      periodStart = new Date(Date.UTC(startYear, 3, 6, 0, 0, 0, 0)); // 6 April
      periodEnd = new Date(Date.UTC(startYear + 1, 3, 5, 23, 59, 59, 999)); // 5 April
      periodLabel = `UK Tax Year ${startYear}/${startYear + 1} (6 Apr – 5 Apr)`;

      previousStart = new Date(Date.UTC(startYear - 1, 3, 6, 0, 0, 0, 0));
      previousEnd = new Date(Date.UTC(startYear, 3, 5, 23, 59, 59, 999));
      previousLabel = `UK Tax Year ${startYear - 1}/${startYear} (6 Apr – 5 Apr)`;
      break;
    }

    case 'CUSTOM': {
      if (startDate) {
        periodStart = new Date(startDate);
        periodStart.setUTCHours(0, 0, 0, 0);
      }
      if (endDate) {
        periodEnd = new Date(endDate);
        periodEnd.setUTCHours(23, 59, 59, 999);
      }

      const sLabel = periodStart ? periodStart.toISOString().slice(0, 10) : 'Start';
      const eLabel = periodEnd ? periodEnd.toISOString().slice(0, 10) : 'Present';
      periodLabel = `Custom: ${sLabel} to ${eLabel}`;

      if (periodStart && periodEnd) {
        const durationMs = periodEnd.getTime() - periodStart.getTime();
        previousEnd = new Date(periodStart.getTime() - 1);
        previousStart = new Date(previousEnd.getTime() - durationMs);
        previousLabel = `Preceding period (${previousStart.toISOString().slice(0, 10)} to ${previousEnd.toISOString().slice(0, 10)})`;
      }
      break;
    }

    case 'ALL':
    default: {
      periodStart = null;
      periodEnd = null;
      periodLabel = 'All Recorded Financial History';
      previousStart = null;
      previousEnd = null;
      previousLabel = 'N/A';
      break;
    }
  }

  return {
    periodStart,
    periodEnd,
    previousStart,
    previousEnd,
    periodLabel,
    previousLabel,
  };
}

/**
 * Core Profit and Loss Calculation Engine
 */
export async function calculateProfitAndLoss({
  companyId,
  propertyId = null,
  datePreset = 'THIS_YEAR',
  startDate = null,
  endDate = null,
  taxYear = null,
  basis = 'CASH', // 'CASH' | 'ACCRUAL'
}) {
  if (!companyId) {
    throw new Error('companyId is required for Profit and Loss calculation');
  }

  const {
    periodStart,
    periodEnd,
    previousStart,
    previousEnd,
    periodLabel,
    previousLabel,
  } = parsePnLDateRange(datePreset, startDate, endDate, taxYear);

  // 1. Fetch properties belonging strictly to this company
  const propertyFilter = { companyId, isActive: true };
  if (propertyId) {
    propertyFilter._id = propertyId;
  }
  const properties = await Property.find(propertyFilter)
    .select('_id name title addressLine1 postcode purchasePrice currentValuation')
    .lean();

  const propertyMap = new Map();
  properties.forEach((p) => {
    propertyMap.set(String(p._id), {
      _id: p._id,
      name: p.title || p.name || p.addressLine1 || 'Property',
      postcode: p.postcode || '',
    });
  });

  // 2. Fetch Mortgage Payments for exact interest vs principal split
  const mortgagePaymentFilter = { companyId, status: { $ne: 'VOID' }, isDeleted: { $ne: true } };
  if (periodStart && periodEnd) {
    mortgagePaymentFilter.paymentDate = { $gte: periodStart, $lte: periodEnd };
  } else if (periodStart) {
    mortgagePaymentFilter.paymentDate = { $gte: periodStart };
  } else if (periodEnd) {
    mortgagePaymentFilter.paymentDate = { $lte: periodEnd };
  }

  const mortgagePayments = await MortgagePayment.find(mortgagePaymentFilter).lean();
  const mortgagePaymentMap = new Map();
  mortgagePayments.forEach((mp) => {
    if (mp.transactionId) {
      mortgagePaymentMap.set(String(mp.transactionId), mp);
    }
    if (mp.paymentReference) {
      mortgagePaymentMap.set(String(mp.paymentReference), mp);
    }
  });

  // 3. Build Transaction Query for Primary Period
  const txQuery = {
    companyId,
    status: 'POSTED',
    isDeleted: { $ne: true },
  };

  if (propertyId) {
    txQuery.propertyId = propertyId;
  }

  if (periodStart && periodEnd) {
    txQuery.transactionDate = { $gte: periodStart, $lte: periodEnd };
  } else if (periodStart) {
    txQuery.transactionDate = { $gte: periodStart };
  } else if (periodEnd) {
    txQuery.transactionDate = { $lte: periodEnd };
  }

  const transactions = await Transaction.find(txQuery)
    .sort({ transactionDate: 1, createdAt: 1 })
    .populate('propertyId', 'name title addressLine1 postcode')
    .populate('categoryId', 'name type isRentalHead')
    .populate('accountId', 'name bankName accountType')
    .lean();

  // 4. Process Classification & Categorized Buckets
  const incomeCategories = new Map();
  const operatingExpenseCategories = new Map();
  const financeCostCategories = new Map();
  const excludedItems = new Map();
  const unclassifiedList = [];

  let totalIncome = 0;
  let totalOperatingExpenses = 0;
  let totalFinanceCosts = 0;
  let totalExcluded = 0;

  // Monthly buckets for visual charts
  const monthlyBuckets = new Map();

  // Per-property buckets
  const propertyBuckets = new Map();
  properties.forEach((p) => {
    propertyBuckets.set(String(p._id), {
      propertyId: p._id,
      name: p.title || p.name || p.addressLine1,
      postcode: p.postcode || '',
      rentalIncome: 0,
      otherIncome: 0,
      totalIncome: 0,
      operatingExpenses: 0,
      financeCosts: 0,
      totalExpenses: 0,
      netProfit: 0,
      isProfit: true,
      profitMargin: 0,
      transactionCount: 0,
    });
  });

  // Company unallocated bucket (for expenses not linked to a specific property)
  const companyUnallocated = {
    propertyId: null,
    name: 'Unallocated Company / Portfolio Operations',
    postcode: '',
    rentalIncome: 0,
    otherIncome: 0,
    totalIncome: 0,
    operatingExpenses: 0,
    financeCosts: 0,
    totalExpenses: 0,
    netProfit: 0,
    isProfit: true,
    profitMargin: 0,
    transactionCount: 0,
  };

  // Helper to record monthly data
  const recordMonthly = (date, inc, opex, fin) => {
    if (!date) return;
    const d = new Date(date);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    if (!monthlyBuckets.has(key)) {
      monthlyBuckets.set(key, {
        month: key,
        monthLabel: d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }),
        year: d.getUTCFullYear(),
        monthNum: d.getUTCMonth() + 1,
        income: 0,
        operatingExpenses: 0,
        financeCosts: 0,
        totalExpenses: 0,
        netProfit: 0,
        isProfit: true,
      });
    }
    const b = monthlyBuckets.get(key);
    b.income = round2(b.income + inc);
    b.operatingExpenses = round2(b.operatingExpenses + opex);
    b.financeCosts = round2(b.financeCosts + fin);
    b.totalExpenses = round2(b.operatingExpenses + b.financeCosts);
    const net = round2(b.income - b.totalExpenses);
    b.netProfit = net;
    b.isProfit = net >= 0;
  };

  // Process Transactions
  transactions.forEach((tx) => {
    const classification = classifyTransaction(tx, mortgagePaymentMap);
    const amount = round2(classification.pnlAmount);
    const propKey = tx.propertyId?._id ? String(tx.propertyId._id) : null;
    const propBucket = propKey && propertyBuckets.has(propKey)
      ? propertyBuckets.get(propKey)
      : companyUnallocated;

    const rowDetail = {
      _id: tx._id,
      date: tx.transactionDate,
      voucherNo: tx.voucherNo,
      narration: tx.narration,
      reference: tx.reference,
      head: tx.head || '',
      subHead: tx.subHead || '',
      categoryName: tx.categoryId?.name || tx.subHead || tx.head || tx.transactionType,
      accountName: tx.accountId?.name || 'Bank Account',
      amount: round2(tx.amount),
      direction: tx.direction,
      transactionType: tx.transactionType,
      propertyName: tx.propertyId?.name || tx.propertyId?.title || tx.propertyId?.addressLine1 || '-',
      propertyId: tx.propertyId?._id || null,
      classification: classification.classification,
      reason: classification.reason,
    };

    if (classification.classification === 'INCOME') {
      totalIncome = round2(totalIncome + amount);
      const catKey = tx.subHead || tx.categoryId?.name || 'General Income';
      if (!incomeCategories.has(catKey)) {
        incomeCategories.set(catKey, {
          category: catKey,
          head: tx.head || 'Income',
          total: 0,
          count: 0,
          transactions: [],
        });
      }
      const c = incomeCategories.get(catKey);
      c.total = round2(c.total + amount);
      c.count += 1;
      c.transactions.push(rowDetail);

      // Property aggregation
      if (classification.subType === 'RENTAL_INCOME') {
        propBucket.rentalIncome = round2(propBucket.rentalIncome + amount);
      } else {
        propBucket.otherIncome = round2(propBucket.otherIncome + amount);
      }
      propBucket.totalIncome = round2(propBucket.totalIncome + amount);
      propBucket.transactionCount += 1;

      // Monthly aggregation
      recordMonthly(tx.transactionDate, amount, 0, 0);
    } else if (classification.classification === 'OPERATING_EXPENSE') {
      totalOperatingExpenses = round2(totalOperatingExpenses + amount);
      const catKey = tx.subHead || tx.categoryId?.name || 'General Expense';
      if (!operatingExpenseCategories.has(catKey)) {
        operatingExpenseCategories.set(catKey, {
          category: catKey,
          head: tx.head || 'Admin Expenses',
          total: 0,
          count: 0,
          transactions: [],
        });
      }
      const c = operatingExpenseCategories.get(catKey);
      c.total = round2(c.total + amount);
      c.count += 1;
      c.transactions.push(rowDetail);

      propBucket.operatingExpenses = round2(propBucket.operatingExpenses + amount);
      propBucket.totalExpenses = round2(propBucket.totalExpenses + amount);
      propBucket.transactionCount += 1;

      recordMonthly(tx.transactionDate, 0, amount, 0);
    } else if (classification.classification === 'FINANCE_COST') {
      totalFinanceCosts = round2(totalFinanceCosts + amount);
      const catKey = tx.subHead || tx.propertyId?.name || 'Mortgage Interest';
      if (!financeCostCategories.has(catKey)) {
        financeCostCategories.set(catKey, {
          category: catKey,
          head: tx.head || 'Interest Expenses',
          total: 0,
          count: 0,
          transactions: [],
        });
      }
      const c = financeCostCategories.get(catKey);
      c.total = round2(c.total + amount);
      c.count += 1;
      c.transactions.push(rowDetail);

      // Also record fee component if split from mortgage payment
      if (classification.operatingFeeAmount && classification.operatingFeeAmount > 0) {
        totalOperatingExpenses = round2(totalOperatingExpenses + classification.operatingFeeAmount);
        propBucket.operatingExpenses = round2(propBucket.operatingExpenses + classification.operatingFeeAmount);
      }

      propBucket.financeCosts = round2(propBucket.financeCosts + amount);
      propBucket.totalExpenses = round2(propBucket.totalExpenses + amount);
      propBucket.transactionCount += 1;

      recordMonthly(tx.transactionDate, 0, classification.operatingFeeAmount || 0, amount);
    } else if (classification.classification === 'NEEDS_REVIEW') {
      unclassifiedList.push(rowDetail);
    } else {
      // Excluded from P&L (Balance Sheet loan, capital capex, principal repayment, transfer)
      totalExcluded = round2(totalExcluded + (tx.amount || 0));
      const reasonKey = classification.classification;
      if (!excludedItems.has(reasonKey)) {
        excludedItems.set(reasonKey, {
          classification: reasonKey,
          reason: classification.reason,
          total: 0,
          count: 0,
          transactions: [],
        });
      }
      const e = excludedItems.get(reasonKey);
      e.total = round2(e.total + tx.amount);
      e.count += 1;
      e.transactions.push(rowDetail);
    }
  });

  // Finalize Property Profitability Calculations
  const propertyProfitabilityList = Array.from(propertyBuckets.values()).map((p) => {
    const net = round2(p.totalIncome - p.totalExpenses);
    const isProf = net >= 0;
    const margin = p.totalIncome > 0 ? round2((net / p.totalIncome) * 100) : 0;
    return {
      ...p,
      netProfit: net,
      isProfit: isProf,
      profitMargin: margin,
    };
  });

  // Calculate Company Unallocated
  const unallocNet = round2(companyUnallocated.totalIncome - companyUnallocated.totalExpenses);
  companyUnallocated.netProfit = unallocNet;
  companyUnallocated.isProfit = unallocNet >= 0;
  companyUnallocated.profitMargin = companyUnallocated.totalIncome > 0 ? round2((unallocNet / companyUnallocated.totalIncome) * 100) : 0;

  // 5. Total Expenses & Net Profit Calculations
  const totalExpenses = round2(totalOperatingExpenses + totalFinanceCosts);
  const netResult = round2(totalIncome - totalExpenses);
  const isProfit = netResult >= 0;
  const netProfit = isProfit ? netResult : 0;
  const netLoss = !isProfit ? Math.abs(netResult) : 0;
  const netProfitMargin = totalIncome > 0 ? round2((netResult / totalIncome) * 100) : 0;

  // 6. Comparative Calculation for Previous Period
  let comparison = null;
  if (previousStart && previousEnd) {
    try {
      const prevTxQuery = {
        companyId,
        status: 'POSTED',
        isDeleted: { $ne: true },
        transactionDate: { $gte: previousStart, $lte: previousEnd },
      };
      if (propertyId) {
        prevTxQuery.propertyId = propertyId;
      }
      const prevTransactions = await Transaction.find(prevTxQuery).lean();

      let prevInc = 0;
      let prevOpex = 0;
      let prevFin = 0;

      prevTransactions.forEach((tx) => {
        const cls = classifyTransaction(tx, mortgagePaymentMap);
        if (cls.classification === 'INCOME') {
          prevInc = round2(prevInc + cls.pnlAmount);
        } else if (cls.classification === 'OPERATING_EXPENSE') {
          prevOpex = round2(prevOpex + cls.pnlAmount);
        } else if (cls.classification === 'FINANCE_COST') {
          prevFin = round2(prevFin + cls.pnlAmount);
        }
      });

      const prevExp = round2(prevOpex + prevFin);
      const prevNet = round2(prevInc - prevExp);

      const incDelta = round2(totalIncome - prevInc);
      const incDeltaPct = prevInc > 0 ? round2((incDelta / prevInc) * 100) : 0;
      const expDelta = round2(totalExpenses - prevExp);
      const expDeltaPct = prevExp > 0 ? round2((expDelta / prevExp) * 100) : 0;
      const netDelta = round2(netResult - prevNet);
      const netDeltaPct = prevNet !== 0 ? round2((netDelta / Math.abs(prevNet)) * 100) : 0;

      comparison = {
        previousPeriodLabel: previousLabel,
        previousIncome: prevInc,
        previousOperatingExpenses: prevOpex,
        previousFinanceCosts: prevFin,
        previousTotalExpenses: prevExp,
        previousNetProfit: prevNet,
        incomeDelta,
        incomeDeltaPct,
        expenseDelta,
        expenseDeltaPct,
        netDelta,
        netDeltaPct,
      };
    } catch (err) {
      console.error('Error computing previous period P&L:', err);
    }
  }

  // 7. Sort Monthly Trends Chronologically
  const monthlyTrend = Array.from(monthlyBuckets.values()).sort((a, b) =>
    a.month.localeCompare(b.month)
  );

  // Compute Year-to-Date (YTD) running totals
  let runningYtdIncome = 0;
  let runningYtdExpenses = 0;
  let runningYtdNet = 0;

  monthlyTrend.forEach((m) => {
    runningYtdIncome = round2(runningYtdIncome + m.income);
    runningYtdExpenses = round2(runningYtdExpenses + m.totalExpenses);
    runningYtdNet = round2(runningYtdIncome - runningYtdExpenses);
    m.ytdIncome = runningYtdIncome;
    m.ytdExpenses = runningYtdExpenses;
    m.ytdNetProfit = runningYtdNet;
  });

  return {
    companyId,
    propertyId,
    basis,
    basisLabel: basis === 'ACCRUAL' ? 'Accrual Basis (Earnings & Incurred Charges)' : 'Cash Basis (Actual Inflows & Outflows)',
    datePreset,
    periodLabel,
    periodStart,
    periodEnd,
    summary: {
      totalIncome,
      operatingExpenses: totalOperatingExpenses,
      financeCosts: totalFinanceCosts,
      totalExpenses,
      netResult,
      netProfit,
      netLoss,
      isProfit,
      netProfitMargin,
      totalTransactions: transactions.length,
      unclassifiedCount: unclassifiedList.length,
      unclassifiedTotal: round2(unclassifiedList.reduce((sum, u) => sum + (u.amount || 0), 0)),
      totalExcluded,
    },
    comparison,
    breakdown: {
      income: Array.from(incomeCategories.values()).sort((a, b) => b.total - a.total),
      operatingExpenses: Array.from(operatingExpenseCategories.values()).sort((a, b) => b.total - a.total),
      financeCosts: Array.from(financeCostCategories.values()).sort((a, b) => b.total - a.total),
      excluded: Array.from(excludedItems.values()).sort((a, b) => b.total - a.total),
    },
    propertyProfitability: propertyProfitabilityList,
    companyUnallocated: companyUnallocated.transactionCount > 0 ? companyUnallocated : null,
    monthlyTrend,
    unclassifiedList,
  };
}

export default {
  classifyTransaction,
  parsePnLDateRange,
  calculateProfitAndLoss,
};
