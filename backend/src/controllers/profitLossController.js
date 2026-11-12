import ExcelJS from 'exceljs';
import { apiSuccess, apiError } from '../utils/apiResponse.js';
import { calculateProfitAndLoss, classifyTransaction } from '../services/profitLossService.js';
import Transaction from '../models/Transaction.js';
import { getCompanyById } from '../config/companies.js';
import { round2 } from '../services/ledgerService.js';
import { configureReportSheet, gbpNumberFormat, styleReportBand, styleReportRows, styleStatusCell } from '../services/reportPresentation.js';

const reportNumber = (value, digits = 2) => {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : (0).toFixed(digits);
};

/**
 * GET /api/pnl
 * Retrieve complete multi-level Profit & Loss statement for the authenticated company.
 */
export const getProfitAndLossReport = async (req, res) => {
  try {
    const {
      propertyId,
      datePreset = 'THIS_YEAR',
      startDate,
      endDate,
      taxYear,
      basis = 'CASH',
    } = req.query;

    const reportData = await calculateProfitAndLoss({
      companyId: req.companyId,
      propertyId: propertyId || null,
      datePreset,
      startDate: startDate || null,
      endDate: endDate || null,
      taxYear: taxYear || null,
      basis: basis.toUpperCase() === 'ACCRUAL' ? 'ACCRUAL' : 'CASH',
    });

    const companyInfo = getCompanyById(req.companyId);

    return apiSuccess(res, {
      ...reportData,
      company: {
        id: req.companyId,
        name: companyInfo?.name || req.companyId.toUpperCase(),
        legalName: companyInfo?.legalName || '',
        currency: 'GBP',
        symbol: '£',
      },
    });
  } catch (error) {
    console.error('Error generating Profit and Loss report:', error);
    return apiError(res, 'Failed to generate Profit and Loss report', 500, error);
  }
};

/**
 * GET /api/pnl/summary
 * Fast lightweight endpoint designed for the Dashboard executive P&L card.
 */
export const getProfitLossSummary = async (req, res) => {
  try {
    const monthVal = req.query.month; // YYYY-MM
    let datePreset = 'THIS_MONTH';
    let startDate = null;
    let endDate = null;

    if (monthVal && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthVal)) {
      datePreset = 'CUSTOM';
      const [y, m] = monthVal.split('-').map(Number);
      startDate = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0)).toISOString();
      endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)).toISOString();
    }

    const currentReport = await calculateProfitAndLoss({
      companyId: req.companyId,
      datePreset,
      startDate,
      endDate,
      basis: 'CASH',
    });

    // Also get YTD
    const ytdReport = await calculateProfitAndLoss({
      companyId: req.companyId,
      datePreset: 'THIS_YEAR',
      basis: 'CASH',
    });

    return apiSuccess(res, {
      companyId: req.companyId,
      currentPeriod: {
        label: currentReport.periodLabel,
        totalIncome: currentReport.summary.totalIncome,
        operatingExpenses: currentReport.summary.operatingExpenses,
        financeCosts: currentReport.summary.financeCosts,
        totalExpenses: currentReport.summary.totalExpenses,
        netResult: currentReport.summary.netResult,
        netProfit: currentReport.summary.netProfit,
        netLoss: currentReport.summary.netLoss,
        isProfit: currentReport.summary.isProfit,
        netProfitMargin: currentReport.summary.netProfitMargin,
      },
      comparison: currentReport.comparison,
      ytd: {
        totalIncome: ytdReport.summary.totalIncome,
        totalExpenses: ytdReport.summary.totalExpenses,
        netResult: ytdReport.summary.netResult,
        isProfit: ytdReport.summary.isProfit,
        netProfitMargin: ytdReport.summary.netProfitMargin,
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard P&L summary:', error);
    return apiError(res, 'Failed to fetch P&L summary', 500, error);
  }
};

/**
 * PATCH /api/pnl/classify/:transactionId
 * Allows operator to manually classify or re-classify an unclassified transaction.
 */
export const updateTransactionClassification = async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { classification, reason } = req.body;

    const allowed = [
      'INCOME',
      'OPERATING_EXPENSE',
      'FINANCE_COST',
      'CAPITAL_EXPENDITURE',
      'LIABILITY_LOAN',
      'INTERNAL_TRANSFER',
      'OWNER_EQUITY',
      'EXCLUDED_FROM_PNL',
      'NEEDS_REVIEW',
    ];

    if (!allowed.includes(classification)) {
      return apiError(res, `Invalid classification. Must be one of: ${allowed.join(', ')}`, 400);
    }

    const tx = await Transaction.findOne({
      _id: transactionId,
      companyId: req.companyId,
    });

    if (!tx) {
      return apiError(res, 'Transaction not found in active company context', 404);
    }

    const oldClassification = tx.accountingClassification || 'AUTO';
    tx.accountingClassification = classification;

    tx.auditHistory.push({
      action: 'EDITED',
      performedBy: req.user?._id || null,
      performedByName: req.user?.name || 'Operator',
      performedAt: new Date(),
      reason: reason || `Accounting classification changed from ${oldClassification} to ${classification}`,
      changes: {
        accountingClassification: {
          from: oldClassification,
          to: classification,
        },
      },
    });

    await tx.save();

    return apiSuccess(res, {
      message: 'Transaction classification updated successfully',
      transaction: tx,
    });
  } catch (error) {
    console.error('Error updating transaction classification:', error);
    return apiError(res, 'Failed to update transaction classification', 500, error);
  }
};

/**
 * GET /api/pnl/export/csv
 * Direct CSV download of the Profit & Loss statement.
 */
export const exportProfitLossCsv = async (req, res) => {
  try {
    const { propertyId, datePreset, startDate, endDate, taxYear, basis } = req.query;
    const reportData = await calculateProfitAndLoss({
      companyId: req.companyId,
      propertyId: propertyId || null,
      datePreset: datePreset || 'THIS_YEAR',
      startDate: startDate || null,
      endDate: endDate || null,
      taxYear: taxYear || null,
      basis: basis?.toUpperCase() === 'ACCRUAL' ? 'ACCRUAL' : 'CASH',
    });

    const companyInfo = getCompanyById(req.companyId);
    const compName = companyInfo?.name || req.companyId.toUpperCase();

    const rows = [
      ['PROFIT & LOSS STATEMENT'],
      ['Company', compName],
      ['Reporting Period', reportData.periodLabel],
      ['Accounting Basis', reportData.basisLabel],
      ['Currency', 'GBP (£)'],
      ['Generated On', new Date().toISOString().slice(0, 10)],
      [],
      ['EXECUTIVE SUMMARY'],
      ['Total Operating Revenue (£)', reportNumber(reportData.summary.totalIncome)],
      ['Operating Expenses (£)', reportNumber(reportData.summary.operatingExpenses)],
      ['Finance Costs (Mortgage Interest) (£)', reportNumber(reportData.summary.financeCosts)],
      ['Total Expenses (£)', reportNumber(reportData.summary.totalExpenses)],
      ['Net Profit / Loss (£)', reportNumber(reportData.summary.netResult)],
      ['Net Profit Margin (%)', `${reportNumber(reportData.summary.netProfitMargin)}%`],
      [],
      ['SECTION 1: OPERATING REVENUE (INCOME)'],
      ['Category Head', 'Transaction Count', 'Total (£)'],
      ...reportData.breakdown.income.map((c) => [`"${c.category}"`, c.count, reportNumber(c.total)]),
      ['TOTAL INCOME', '', reportNumber(reportData.summary.totalIncome)],
      [],
      ['SECTION 2: OPERATING EXPENSES'],
      ['Category Head', 'Transaction Count', 'Total (£)'],
      ...reportData.breakdown.operatingExpenses.map((c) => [`"${c.category}"`, c.count, reportNumber(c.total)]),
      ['TOTAL OPERATING EXPENSES', '', reportNumber(reportData.summary.operatingExpenses)],
      [],
      ['SECTION 3: FINANCE COSTS'],
      ['Category / Property Head', 'Transaction Count', 'Total (£)'],
      ...reportData.breakdown.financeCosts.map((c) => [`"${c.category}"`, c.count, reportNumber(c.total)]),
      ['TOTAL FINANCE COSTS', '', reportNumber(reportData.summary.financeCosts)],
      [],
      ['SECTION 4: PROPERTY PROFITABILITY BREAKDOWN'],
      ['Property Name', 'Rental Income (£)', 'Other Income (£)', 'Operating Expenses (£)', 'Mortgage Interest (£)', 'Net Profit / Loss (£)', 'Margin (%)'],
      ...reportData.propertyProfitability.map((p) => [
        `"${p.name}"`,
        reportNumber(p.rentalIncome),
        reportNumber(p.otherIncome),
        reportNumber(p.operatingExpenses),
        reportNumber(p.financeCosts),
        reportNumber(p.netProfit),
        `${reportNumber(p.profitMargin)}%`,
      ]),
    ];

    if (reportData.companyUnallocated) {
      const u = reportData.companyUnallocated;
      rows.push([
        `"${u.name}"`,
        reportNumber(u.rentalIncome),
        reportNumber(u.otherIncome),
        reportNumber(u.operatingExpenses),
        reportNumber(u.financeCosts),
        reportNumber(u.netProfit),
        `${reportNumber(u.profitMargin)}%`,
      ]);
    }

    const csvContent = rows.map((r) => r.join(',')).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${req.companyId}_Profit_and_Loss_${datePreset || 'Period'}.csv"`
    );
    return res.status(200).send(csvContent);
  } catch (error) {
    console.error('Error exporting P&L CSV:', error);
    return apiError(res, 'Failed to export CSV report', 500, error);
  }
};

/**
 * GET /api/pnl/export/excel
 * Download a professionally formatted multi-sheet Excel workbook.
 */
export const exportProfitLossExcel = async (req, res) => {
  try {
    const { propertyId, datePreset, startDate, endDate, taxYear, basis } = req.query;
    const reportData = await calculateProfitAndLoss({
      companyId: req.companyId,
      propertyId: propertyId || null,
      datePreset: datePreset || 'THIS_YEAR',
      startDate: startDate || null,
      endDate: endDate || null,
      taxYear: taxYear || null,
      basis: basis?.toUpperCase() === 'ACCRUAL' ? 'ACCRUAL' : 'CASH',
    });

    const companyInfo = getCompanyById(req.companyId);
    const compName = companyInfo?.legalName || companyInfo?.name || req.companyId.toUpperCase();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PIXX UK Property Accounting';
    workbook.created = new Date();

    // ----------------------------------------------------
    // Sheet 1: Profit & Loss Statement
    // ----------------------------------------------------
    const sheet1 = workbook.addWorksheet('P&L Statement', {
      views: [{ showGridLines: true }],
    });

    sheet1.columns = [
      { width: 47 },
      { width: 14 },
      { width: 18 },
      { width: 18 },
    ];

    // Header Title
    sheet1.addRow([`${compName} - PROFIT & LOSS STATEMENT`]);
    sheet1.mergeCells('A1:D1');
    sheet1.getRow(1).font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    sheet1.addRow([`Reporting Period: ${reportData.periodLabel} | Accounting Basis: ${reportData.basisLabel} | Currency: GBP (£)`]);
    sheet1.mergeCells('A2:D2');
    sheet1.getRow(2).font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } };
    sheet1.addRow([]);

    // KPI Summary
    sheet1.addRow(['EXECUTIVE SUMMARY', '', 'AMOUNT (£)']);
    sheet1.getRow(4).font = { bold: true };
    sheet1.getRow(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

    sheet1.addRow(['Total Operating Revenue (Income)', '', reportData.summary.totalIncome]);
    sheet1.addRow(['Operating Expenses', '', reportData.summary.operatingExpenses]);
    sheet1.addRow(['Finance Costs (Mortgage Interest)', '', reportData.summary.financeCosts]);
    sheet1.addRow(['Total Operating & Finance Expenses', '', reportData.summary.totalExpenses]);
    const netRow = sheet1.addRow([
      reportData.summary.isProfit ? 'NET OPERATING PROFIT' : 'NET OPERATING LOSS',
      '',
      reportData.summary.netResult,
    ]);
    netRow.font = { bold: true, color: { argb: reportData.summary.isProfit ? 'FF059669' : 'FFE11D48' } };
    sheet1.addRow(['Net Profit Margin', '', `${reportNumber(reportData.summary.netProfitMargin)}%`]);
    sheet1.addRow([]);

    // Format numbers
    [5, 6, 7, 8, 9].forEach((rNum) => {
      sheet1.getCell(`C${rNum}`).numFmt = '£#,##0.00;[Red]-£#,##0.00;"£0.00"';
    });

    // Income breakdown
    sheet1.addRow(['1. OPERATING REVENUE (INCOME)', 'ENTRIES', 'AMOUNT (£)']);
    const rInc = sheet1.lastRow;
    rInc.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    rInc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };

    reportData.breakdown.income.forEach((c) => {
      const row = sheet1.addRow([c.category, c.count, c.total]);
      row.getCell(3).numFmt = '£#,##0.00';
    });
    const subTotInc = sheet1.addRow(['TOTAL OPERATING REVENUE', '', reportData.summary.totalIncome]);
    subTotInc.font = { bold: true };
    subTotInc.getCell(3).numFmt = '£#,##0.00';
    sheet1.addRow([]);

    // Operating expenses breakdown
    sheet1.addRow(['2. OPERATING EXPENSES', 'ENTRIES', 'AMOUNT (£)']);
    const rExp = sheet1.lastRow;
    rExp.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    rExp.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE11D48' } };

    reportData.breakdown.operatingExpenses.forEach((c) => {
      const row = sheet1.addRow([c.category, c.count, c.total]);
      row.getCell(3).numFmt = '£#,##0.00';
    });
    const subTotExp = sheet1.addRow(['TOTAL OPERATING EXPENSES', '', reportData.summary.operatingExpenses]);
    subTotExp.font = { bold: true };
    subTotExp.getCell(3).numFmt = '£#,##0.00';
    sheet1.addRow([]);

    // Finance Costs
    sheet1.addRow(['3. FINANCE COSTS', 'ENTRIES', 'AMOUNT (£)']);
    const rFin = sheet1.lastRow;
    rFin.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    rFin.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };

    reportData.breakdown.financeCosts.forEach((c) => {
      const row = sheet1.addRow([c.category, c.count, c.total]);
      row.getCell(3).numFmt = '£#,##0.00';
    });
    const subTotFin = sheet1.addRow(['TOTAL FINANCE COSTS', '', reportData.summary.financeCosts]);
    subTotFin.font = { bold: true };
    subTotFin.getCell(3).numFmt = '£#,##0.00';
    sheet1.addRow([]);

    // ----------------------------------------------------
    // Sheet 2: Property Profitability
    // ----------------------------------------------------
    const sheet2 = workbook.addWorksheet('Property Profitability', {
      views: [{ showGridLines: true }],
    });

    sheet2.columns = [
      { header: 'Property Name', width: 32 },
      { header: 'Postcode', width: 14 },
      { header: 'Rental Income (£)', width: 18 },
      { header: 'Other Income (£)', width: 18 },
      { header: 'Total Income (£)', width: 18 },
      { header: 'Operating Expenses (£)', width: 22 },
      { header: 'Mortgage Interest (£)', width: 22 },
      { header: 'Total Expenses (£)', width: 20 },
      { header: 'Net Profit / Loss (£)', width: 20 },
      { header: 'Profit Margin', width: 16 },
    ];

    sheet2.getRow(1).font = { bold: true, color: { argb: 'FF0F172A' } };
    sheet2.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

    reportData.propertyProfitability.forEach((p) => {
      const r = sheet2.addRow([
        p.name,
        p.postcode,
        p.rentalIncome,
        p.otherIncome,
        p.totalIncome,
        p.operatingExpenses,
        p.financeCosts,
        p.totalExpenses,
        p.netProfit,
        `${reportNumber(p.profitMargin, 1)}%`,
      ]);
      [3, 4, 5, 6, 7, 8, 9].forEach((idx) => {
        r.getCell(idx).numFmt = '£#,##0.00;[Red]-£#,##0.00;"£0.00"';
      });
    });

    if (reportData.companyUnallocated) {
      const u = reportData.companyUnallocated;
      const r = sheet2.addRow([
        u.name,
        '-',
        u.rentalIncome,
        u.otherIncome,
        u.totalIncome,
        u.operatingExpenses,
        u.financeCosts,
        u.totalExpenses,
        u.netProfit,
        `${reportNumber(u.profitMargin, 1)}%`,
      ]);
      [3, 4, 5, 6, 7, 8, 9].forEach((idx) => {
        r.getCell(idx).numFmt = '£#,##0.00;[Red]-£#,##0.00;"£0.00"';
      });
    }

    // ----------------------------------------------------
    // Sheet 3: Monthly Trend
    // ----------------------------------------------------
    const sheet3 = workbook.addWorksheet('Monthly Trend', {
      views: [{ showGridLines: true }],
    });

    sheet3.columns = [
      { header: 'Period (Month)', width: 18 },
      { header: 'Operating Revenue (£)', width: 22 },
      { header: 'Operating Expenses (£)', width: 22 },
      { header: 'Finance Costs (£)', width: 20 },
      { header: 'Total Expenses (£)', width: 20 },
      { header: 'Net Profit / Loss (£)', width: 22 },
      { header: 'Status', width: 16 },
      { header: 'YTD Net (£)', width: 20 },
    ];
    sheet3.getRow(1).font = { bold: true, color: { argb: 'FF0F172A' } };
    sheet3.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

    reportData.monthlyTrend.forEach((m) => {
      const r = sheet3.addRow([
        m.monthLabel,
        m.income,
        m.operatingExpenses,
        m.financeCosts,
        m.totalExpenses,
        m.netProfit,
        m.isProfit ? 'PROFITABLE' : 'LOSS-MAKING',
        m.ytdNetProfit,
      ]);
      [2, 3, 4, 5, 6, 8].forEach((idx) => {
        r.getCell(idx).numFmt = '£#,##0.00;[Red]-£#,##0.00;"£0.00"';
      });
      r.getCell(7).font = { bold: true, color: { argb: m.isProfit ? 'FF059669' : 'FFE11D48' } };
    });

    sheet1.getRow(2).height = 28;
    sheet1.getCell('A2').alignment = { vertical: 'middle', wrapText: true };
    styleReportBand(sheet1, 1, 'title');
    styleReportBand(sheet1, 4, 'header');
    styleReportRows(sheet1, 5, 9, { currencyColumns: [3] });
    styleReportRows(sheet1, 10, 10);
    styleStatusCell(netRow.getCell(3), reportData.summary.isProfit ? 'green' : 'red');
    for (const [header, subtotal] of [[rInc, subTotInc], [rExp, subTotExp], [rFin, subTotFin]]) {
      styleReportBand(sheet1, header.number, 'header');
      styleReportRows(sheet1, header.number + 1, subtotal.number - 1, { currencyColumns: [3] });
      styleReportBand(sheet1, subtotal.number, 'total');
      subtotal.getCell(3).numFmt = gbpNumberFormat;
    }
    configureReportSheet(sheet1, { freezeRows: 4 });
    styleReportBand(sheet2, 1, 'header');
    styleReportRows(sheet2, 2, sheet2.rowCount, { currencyColumns: [3, 4, 5, 6, 7, 8, 9] });
    configureReportSheet(sheet2, { freezeRows: 1, headerRow: 1, lastDataRow: sheet2.rowCount });
    styleReportBand(sheet3, 1, 'header');
    styleReportRows(sheet3, 2, sheet3.rowCount, { currencyColumns: [2, 3, 4, 5, 6, 8] });
    reportData.monthlyTrend.forEach((month, index) => styleStatusCell(sheet3.getCell(index + 2, 7), month.isProfit ? 'green' : 'red'));
    configureReportSheet(sheet3, { freezeRows: 1, headerRow: 1, lastDataRow: sheet3.rowCount });
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${req.companyId}_Profit_and_Loss_${datePreset || 'Period'}.xlsx"`
    );

    res.setHeader('Content-Length', buffer.length);
    return res.end(buffer);
  } catch (error) {
    console.error('Error exporting P&L Excel:', error);
    return apiError(res, 'Failed to export Excel report', 500, error);
  }
};

export default {
  getProfitAndLossReport,
  getProfitLossSummary,
  updateTransactionClassification,
  exportProfitLossCsv,
  exportProfitLossExcel,
};
