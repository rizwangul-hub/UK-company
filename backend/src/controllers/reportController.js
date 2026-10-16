import Property from '../models/Property.js';
import Unit from '../models/Unit.js';
import Mortgage from '../models/Mortgage.js';
import Account from '../models/Account.js';
import Transaction from '../models/Transaction.js';
import RentSchedule from '../models/RentSchedule.js';
import MortgagePayment from '../models/MortgagePayment.js';
import { round2 } from '../services/ledgerService.js';
import { apiSuccess, apiError } from '../utils/apiResponse.js';
import {
  buildLedgerReportData,
  generateExcelReport,
  generatePdfReport,
  generateLandlordRentStatementExcel,
} from '../services/reportExportService.js';
import {
  getConsolidatedGroupOverviewData,
  generateConsolidatedGroupExcelReport,
  generateConsolidatedGroupPdfReport,
} from '../services/consolidatedReportService.js';

export const getDashboardStats = async (req, res) => {
  try {
    const { month } = req.query;
    const selectedMonth = month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

    // 1. Portfolio & Mortgage Debt for active company
    const [properties, totalUnits, mortgages, accounts] = await Promise.all([
      Property.find({ companyId: req.companyId, isActive: true }).lean(),
      Unit.countDocuments({ companyId: req.companyId, isActive: { $ne: false } }),
      Mortgage.find({ companyId: req.companyId, status: 'ACTIVE' }).lean(),
      Account.find({ companyId: req.companyId, isActive: true }).lean(),
    ]);

    const totalPortfolioValue = properties.reduce(
      (sum, p) => sum + (p.currentValuation || p.purchasePrice || 0),
      0
    );
    const totalMortgageDebt = mortgages.reduce(
      (sum, m) => sum + (m.outstandingPrincipalBalance || 0),
      0
    );
    const netEquity = Math.max(0, totalPortfolioValue - totalMortgageDebt);
    const averageLtv = totalPortfolioValue > 0 ? Math.round((totalMortgageDebt / totalPortfolioValue) * 100) : 0;
    const totalLiquidity = accounts.reduce((sum, a) => sum + (a.currentBalance || 0), 0);

    // 2. Monthly Rent Billings & Collections for active company
    const rentSchedules = await RentSchedule.find({ companyId: req.companyId, billingMonth: selectedMonth }).lean();
    const scheduledRent = rentSchedules.reduce((sum, s) => sum + (s.expectedAmount || 0), 0);
    const contractualMonthlyRent = properties.reduce((sum, p) => sum + (p.contractualRent || 0), 0);
    const expectedRent = scheduledRent > 0 ? scheduledRent : contractualMonthlyRent;
    const rentCollected = rentSchedules.reduce((sum, s) => sum + (s.paidAmount || 0), 0);
    const rentOutstanding = scheduledRent > 0
      ? rentSchedules.reduce((sum, s) => sum + (s.outstandingAmount || 0), 0)
      : Math.max(0, expectedRent - rentCollected);
    const collectionRate = expectedRent > 0 ? Math.round((rentCollected / expectedRent) * 100) : 0;

    // 3. Operating Expenses & Other Income in selected month
    const [year, mNum] = selectedMonth.split('-').map(Number);
    const startOfMonth = new Date(Date.UTC(year, mNum - 1, 1, 0, 0, 0, 0));
    const nextMonth = new Date(Date.UTC(year, mNum, 1, 0, 0, 0, 0));

    const [expenseTxns, otherIncomeTxns, recentTransactionsRaw] = await Promise.all([
      Transaction.find({
        companyId: req.companyId,
        status: 'POSTED',
        isDeleted: { $ne: true },
        transactionType: 'EXPENSE',
        transactionDate: { $gte: startOfMonth, $lt: nextMonth },
      }).lean(),
      Transaction.find({
        companyId: req.companyId,
        status: 'POSTED',
        isDeleted: { $ne: true },
        transactionType: 'INCOME',
        transactionDate: { $gte: startOfMonth, $lt: nextMonth },
      }).lean(),
      Transaction.find({
        companyId: req.companyId,
        status: 'POSTED',
        isDeleted: { $ne: true },
      })
        .sort({ transactionDate: -1, createdAt: -1 })
        .limit(6)
        .populate('accountId', 'name bankName accountType')
        .populate('categoryId', 'name type')
        .populate('propertyId', 'name postcode')
        .lean(),
    ]);

    const operatingExpenses = expenseTxns.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const otherIncome = otherIncomeTxns
      .filter((tx) => !tx.periodMonth)
      .reduce((sum, tx) => sum + (tx.amount || 0), 0);

    // 4. Mortgage Payments in selected month
    const mortgagePayments = await MortgagePayment.find({
      companyId: req.companyId,
      status: { $ne: 'VOID' },
      isDeleted: { $ne: true },
      paymentDate: { $gte: startOfMonth, $lt: nextMonth },
    }).lean();

    const mortgageInterestPaid = mortgagePayments.reduce((sum, p) => sum + (p.interestAmount || 0), 0);
    const mortgagePrincipalPaid = mortgagePayments.reduce((sum, p) => sum + (p.principalAmount || 0), 0);
    const totalMortgagePaid = mortgagePayments.reduce((sum, p) => sum + (p.totalAmountPaid || 0), 0);

    // 5. Net Cash Flow Calculation
    const netCashFlow = round2(rentCollected + otherIncome - operatingExpenses - totalMortgagePaid);

    // 6. Recent Transactions formatting
    const recentTransactions = recentTransactionsRaw.map((tx) => ({
      _id: tx._id,
      date: tx.transactionDate,
      voucherNo: tx.voucherNo,
      narration: tx.narration,
      amount: round2(tx.amount),
      direction: tx.direction,
      transactionType: tx.transactionType,
      categoryName: tx.categoryId?.name || tx.transactionType,
      propertyName: tx.propertyId?.name || '-',
      accountName: tx.accountId?.name || '-',
    }));

    // 7. Monthly Trends (Past 6 Months)
    const monthOffsets = [5, 4, 3, 2, 1, 0];
    const monthlyTrends = await Promise.all(
      monthOffsets.map(async (offset) => {
        const d = new Date(Date.UTC(year, mNum - 1 - offset, 1));
        const mStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
        const mStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
        const mEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0));

        const [mSchedules, mExp, mInc] = await Promise.all([
          RentSchedule.find({ companyId: req.companyId, billingMonth: mStr }).lean(),
          Transaction.find({
            companyId: req.companyId,
            status: 'POSTED',
            isDeleted: { $ne: true },
            transactionType: 'EXPENSE',
            transactionDate: { $gte: mStart, $lt: mEnd },
          }).lean(),
          Transaction.find({
            companyId: req.companyId,
            status: 'POSTED',
            isDeleted: { $ne: true },
            transactionType: 'INCOME',
            transactionDate: { $gte: mStart, $lt: mEnd },
          }).lean(),
        ]);

        const rentRec = mSchedules.reduce((sum, s) => sum + (s.paidAmount || 0), 0);
        const sundryInc = mInc.filter((t) => !t.periodMonth).reduce((sum, t) => sum + (t.amount || 0), 0);
        const expTotal = mExp.reduce((sum, t) => sum + (t.amount || 0), 0);
        const totalInc = round2(rentRec + sundryInc);

        return {
          month: mStr,
          income: totalInc,
          expenses: round2(expTotal),
          net: round2(totalInc - expTotal),
        };
      })
    );

    return apiSuccess(res, {
      companyId: req.companyId,
      month: selectedMonth,
      portfolio: {
        totalProperties: properties.length,
        totalUnits,
        contractualMonthlyRent: round2(contractualMonthlyRent),
        totalPortfolioValue: round2(totalPortfolioValue),
        totalMortgageDebt: round2(totalMortgageDebt),
        netEquity: round2(netEquity),
        averageLtv,
        totalLiquidity: round2(totalLiquidity),
      },
      monthly: {
        expectedRent: round2(expectedRent),
        rentCollected: round2(rentCollected),
        rentOutstanding: round2(rentOutstanding),
        collectionRate,
        operatingExpenses: round2(operatingExpenses),
        mortgageInterestPaid: round2(mortgageInterestPaid),
        mortgagePrincipalPaid: round2(mortgagePrincipalPaid),
        totalMortgagePaid: round2(totalMortgagePaid),
        netCashFlow,
      },
      recentTransactions,
      monthlyTrends,
    });
  } catch (error) {
    return apiError(res, 'Failed to fetch dashboard stats', 500, error);
  }
};

export const getPropertyProfitability = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const properties = await Property.find({ companyId: req.companyId, isActive: true }).lean();

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const txQuery = { companyId: req.companyId, status: 'POSTED', isDeleted: { $ne: true } };
    if (startDate || endDate) txQuery.transactionDate = dateFilter;

    const [txns, mortgages] = await Promise.all([
      Transaction.find(txQuery).populate('categoryId', 'type name isRentalHead').lean(),
      Mortgage.find({ companyId: req.companyId, status: 'ACTIVE' }).lean(),
    ]);

    const report = properties.map((prop) => {
      const propIdStr = prop._id.toString();
      const propTxns = txns.filter((t) => t.propertyId?.toString() === propIdStr);
      const propMortgages = mortgages.filter((m) => m.propertyId.toString() === propIdStr);

      const rentalIncome = propTxns
        .filter((t) => t.transactionType === 'INCOME')
        .reduce((sum, t) => sum + t.amount, 0);

      const operatingExpenses = propTxns
        .filter((t) => t.transactionType === 'EXPENSE')
        .reduce((sum, t) => sum + t.amount, 0);

      const mortgagePayments = propTxns
        .filter((t) => t.transactionType === 'MORTGAGE_PAYMENT')
        .reduce((sum, t) => sum + t.amount, 0);

      const netOperatingIncome = round2(rentalIncome - operatingExpenses);
      const netCashFlow = round2(rentalIncome - operatingExpenses - mortgagePayments);
      const valuation = prop.currentValuation || prop.purchasePrice || 0;
      const totalDebt = propMortgages.reduce((sum, m) => sum + (m.outstandingPrincipalBalance || 0), 0);

      return {
        propertyId: prop._id,
        name: prop.name,
        postcode: prop.postcode,
        valuation: round2(valuation),
        totalMortgageDebt: round2(totalDebt),
        rentalIncome: round2(rentalIncome),
        operatingExpenses: round2(operatingExpenses),
        netOperatingIncome,
        mortgagePayments: round2(mortgagePayments),
        netCashFlow,
        grossYield: valuation > 0 ? round2(((rentalIncome * 12) / valuation) * 100) : 0,
      };
    });

    return apiSuccess(res, { properties: report, count: report.length });
  } catch (error) {
    return apiError(res, 'Failed to generate property profitability report', 500, error);
  }
};

export const getFinancialYearReport = async (req, res) => {
  try {
    const { taxYear = '2026-2027' } = req.query;
    // Standard UK Tax Year runs from 6 April to 5 April
    const [startYear] = taxYear.split('-').map(Number);
    const startDate = new Date(Date.UTC(startYear, 3, 6)); // 6 April
    const endDate = new Date(Date.UTC(startYear + 1, 3, 5, 23, 59, 59)); // 5 April

    const [transactions, mortgagePayments] = await Promise.all([
      Transaction.find({
        companyId: req.companyId,
        status: 'POSTED',
        transactionDate: { $gte: startDate, $lte: endDate },
      }).populate('categoryId', 'name type isAllowableTaxDeduction').lean(),
      MortgagePayment.find({
        companyId: req.companyId,
        paymentDate: { $gte: startDate, $lte: endDate },
      }).lean(),
    ]);

    const grossRentalIncome = transactions
      .filter((t) => t.transactionType === 'INCOME')
      .reduce((sum, t) => sum + t.amount, 0);

    const allowableExpenses = transactions
      .filter((t) => t.transactionType === 'EXPENSE' && t.categoryId?.isAllowableTaxDeduction !== false)
      .reduce((sum, t) => sum + t.amount, 0);

    // Exact finance costs from mortgage payments (excluding principal repayments)
    const mortgageInterestFinanceCosts = mortgagePayments.reduce(
      (sum, p) => sum + (p.interestAmount || 0),
      0
    );
    const mortgagePrincipalRepaid = mortgagePayments.reduce(
      (sum, p) => sum + (p.principalAmount || 0),
      0
    );
    const allowableLenderFees = mortgagePayments.reduce(
      (sum, p) => sum + (p.feeAmount || 0),
      0
    );

    const netTaxableProfitBeforeFinanceCosts = round2(grossRentalIncome - allowableExpenses - allowableLenderFees);

    // Section 24 HMRC statutory basic-rate (20%) tax reducer
    const qualifyingFinanceCosts = Math.min(
      mortgageInterestFinanceCosts,
      Math.max(0, netTaxableProfitBeforeFinanceCosts)
    );
    const section24TaxCreditEstimated = round2(qualifyingFinanceCosts * 0.20);
    const carriedForwardFinanceCosts = round2(
      Math.max(0, mortgageInterestFinanceCosts - qualifyingFinanceCosts)
    );

    return apiSuccess(res, {
      taxYear,
      period: { startDate, endDate },
      grossRentalIncome: round2(grossRentalIncome),
      allowableExpenses: round2(allowableExpenses + allowableLenderFees),
      netTaxableProfitBeforeFinanceCosts,
      mortgageInterestFinanceCosts: round2(mortgageInterestFinanceCosts),
      mortgagePrincipalRepaid: round2(mortgagePrincipalRepaid),
      qualifyingFinanceCosts: round2(qualifyingFinanceCosts),
      section24TaxCreditEstimated,
      carriedForwardFinanceCosts,
      notes: {
        disclaimer: 'Estimated statutory Section 24 tax reducer (20% relief) under HMRC rules. Basic-rate relief is capped by property business profits. Final tax liability requires professional verification by a UK Chartered Accountant (ICAEW/CTA).',
      },
    });
  } catch (error) {
    return apiError(res, 'Failed to generate UK tax year report', 500, error);
  }
};

/**
 * Interactive preview of ledger report with KPIs and first slice of data
 */
export const getLedgerReportPreview = async (req, res) => {
  try {
    const filters = { ...req.query, ...req.body, companyId: req.companyId };
    const reportData = await buildLedgerReportData(filters);

    const previewLimit = Math.min(Number(req.query.limit) || 100, 500);
    const previewRows = reportData.entries.slice(0, previewLimit);

    return apiSuccess(res, {
      reportRef: reportData.reportRef,
      reportTitle: reportData.reportTitle,
      companyId: reportData.companyId,
      companyName: reportData.companyName,
      scope: reportData.scope,
      scopeDescription: reportData.scopeDescription,
      periodLabel: reportData.periodLabel,
      datePreset: reportData.datePreset,
      periodStart: reportData.periodStart,
      periodEnd: reportData.periodEnd,
      isLiquidity: reportData.isLiquidity,
      isMortgage: reportData.isMortgage,
      summary: reportData.summary,
      categoryBreakdown: reportData.categoryBreakdown,
      propertyBreakdown: reportData.propertyBreakdown,
      totalCount: reportData.entries.length,
      previewRows,
      hasMore: reportData.entries.length > previewLimit,
    });
  } catch (error) {
    return apiError(res, 'Failed to generate ledger report preview', 500, error);
  }
};

/**
 * Generate and stream formatted Excel (.xlsx) file
 */
export const exportLedgerExcel = async (req, res) => {
  try {
    const filters = { ...req.query, ...req.body, companyId: req.companyId };
    const reportData = await buildLedgerReportData(filters);
    const buffer = await generateExcelReport(reportData);

    const safeScope = (reportData.scope || 'COMPLETE').toLowerCase();
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `Pixx_UK_Ledger_${req.companyId || 'company'}_${safeScope}_${dateStr}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );
    res.setHeader('Content-Length', buffer.length);
    return res.end(buffer);
  } catch (error) {
    return apiError(res, 'Failed to export Excel ledger report', 500, error);
  }
};

/**
 * Generate and stream vector corporate PDF report
 */
export const exportLedgerPdf = async (req, res) => {
  try {
    const filters = { ...req.query, ...req.body, companyId: req.companyId };
    const reportData = await buildLedgerReportData(filters);
    const buffer = await generatePdfReport(reportData);

    const safeScope = (reportData.scope || 'COMPLETE').toLowerCase();
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `Pixx_UK_Ledger_${req.companyId || 'company'}_${safeScope}_${dateStr}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );
    res.setHeader('Content-Length', buffer.length);
    return res.end(buffer);
  } catch (error) {
    return apiError(res, 'Failed to export PDF ledger report', 500, error);
  }
};

/**
 * Generate and stream Landlord Rent Statement Excel (.xlsx) file
 * Exact 2-sheet structure: Rent Income Report & Portfolio Summary (Direct Properties, No Inside Units)
 */
export const exportLandlordRentStatementExcel = async (req, res) => {
  try {
    const buffer = await generateLandlordRentStatementExcel(req.companyId);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `Landlord_Report_${req.companyId || 'company'}_${dateStr}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );
    res.setHeader('Content-Length', buffer.length);
    return res.end(buffer);
  } catch (error) {
    return apiError(res, 'Failed to export Landlord Rent Statement Excel report', 500, error);
  }
};

/**
 * Master Group Portfolio Overview (All 6 Companies)
 */
export const getConsolidatedOverview = async (req, res) => {
  try {
    const data = await getConsolidatedGroupOverviewData();
    return apiSuccess(res, data, 'Consolidated group portfolio overview retrieved successfully');
  } catch (error) {
    return apiError(res, 'Failed to fetch consolidated overview', 500, error);
  }
};

/**
 * Export Consolidated All-Companies Excel Report (.xlsx)
 * Modeled on "Rent Deails for Software (1).xlsx"
 */
export const exportConsolidatedExcel = async (req, res) => {
  try {
    const buffer = await generateConsolidatedGroupExcelReport();
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `Consolidated_Rent_Details_All_Companies_${dateStr}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );
    res.setHeader('Content-Length', buffer.length);
    return res.end(buffer);
  } catch (error) {
    return apiError(res, 'Failed to export consolidated Excel report', 500, error);
  }
};

/**
 * Export Attractive, Beautiful Corporate PDF Report for All 6 Companies
 */
export const exportConsolidatedPdf = async (req, res) => {
  try {
    const companyId = req.query.companyId || req.headers['x-company-id'];
    const buffer = await generateConsolidatedGroupPdfReport({ companyId });
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = companyId && companyId !== 'all'
      ? `${companyId.toUpperCase()}_Single_Company_Report_${dateStr}.pdf`
      : `Consolidated_Group_Portfolio_Report_${dateStr}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );
    res.setHeader('Content-Length', buffer.length);
    return res.end(buffer);
  } catch (error) {
    return apiError(res, 'Failed to export consolidated PDF report', 500, error);
  }
};



