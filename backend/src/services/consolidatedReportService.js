import ExcelJS from 'exceljs';
import { configureReportSheet, gbpNumberFormat, renderReportPdf, reportSum, styleReportBand, styleReportRows } from './reportPresentation.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Property from '../models/Property.js';
import Mortgage from '../models/Mortgage.js';
import Tenant from '../models/Tenant.js';
import Account from '../models/Account.js';
import RentSchedule from '../models/RentSchedule.js';
import { COMPANIES, getCompanyById, normalizeCompanyId } from '../config/companies.js';
import { round2 } from './ledgerService.js';
import { OLD_STREET_PROPERTIES } from '../scripts/generateLandlordReportFile.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOGO_PATH = path.resolve(__dirname, '../assets/logo.png');

/**
 * Resolve dynamic high-resolution company logo
 */
const getCompanyLogoPath = (companyId) => {
  if (!companyId) return LOGO_PATH;
  const normalized = normalizeCompanyId(companyId);
  const logoMap = {
    'old-street': path.resolve(__dirname, '../assets/logos/OldStreetLogo.png'),
    'best-standard': path.resolve(__dirname, '../assets/logos/BestStandardLogo.png'),
    'sk-hamilton': path.resolve(__dirname, '../assets/logos/SKLogo.png'),
    'homewards': path.resolve(__dirname, '../assets/logos/HomeWardsLogo.png'),
    'mile-end-road': path.resolve(__dirname, '../assets/logos/MileEndLogo.png'),
    'global-standard': path.resolve(__dirname, '../assets/logos/GlobalStandardLogo.png'),
  };
  const targetPath = logoMap[normalized];
  if (targetPath && fs.existsSync(targetPath)) {
    return targetPath;
  }
  return LOGO_PATH;
};

/**
 * Format monetary amount into GBP currency string
 */
export const formatGBP = (amount) => {
  const val = Number(amount) || 0;
  if (val < 0) {
    return `-£${Math.abs(val).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `£${val.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

/**
 * Format date string into UK format (DD/MM/YYYY)
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
 * Fetch and assemble consolidated data across all 6 companies
 */
export async function getConsolidatedGroupOverviewData() {
  const [allProperties, allMortgages, allAccounts] = await Promise.all([
    Property.find({ isActive: true }).lean(),
    Mortgage.find({ status: 'ACTIVE' }).lean(),
    Account.find({ isActive: true }).lean(),
  ]);

  // Aggregate metrics
  let totalProperties = 0;
  let totalMonthlyRent = 0;
  let totalValuation = 0;
  let totalMortgageDebt = 0;
  let totalMonthlyDebtService = 0;
  let totalLiquidity = allAccounts.reduce((sum, a) => sum + (a.currentBalance || 0), 0);

  const companySummaries = COMPANIES.map((comp) => {
    const compProps = allProperties.filter((p) => p.companyId === comp.id);
    const compMorts = allMortgages.filter((m) => m.companyId === comp.id);
    const compAccounts = allAccounts.filter((a) => a.companyId === comp.id);

    const propCount = compProps.length;
    const monthlyRent = compProps.reduce((sum, p) => sum + (p.contractualRent || 0), 0);
    const valuation = compProps.reduce((sum, p) => sum + (p.currentValuation || p.purchasePrice || 0), 0);
    const mortgageDebt = compMorts.reduce((sum, m) => sum + (m.outstandingPrincipalBalance || 0), 0);
    const monthlyPayments = compMorts.reduce((sum, m) => sum + (m.expectedRepaymentAmount || 0), 0);
    const liquidity = compAccounts.reduce((sum, a) => sum + (a.currentBalance || 0), 0);

    totalProperties += propCount;
    totalMonthlyRent += monthlyRent;
    totalValuation += valuation;
    totalMortgageDebt += mortgageDebt;
    totalMonthlyDebtService += monthlyPayments;

    return {
      companyId: comp.id,
      name: comp.name,
      legalName: comp.legalName,
      slug: comp.slug,
      registrationNo: comp.registrationNo,
      jurisdiction: comp.jurisdiction,
      logoUrl: comp.logoUrl,
      propertyCount: propCount,
      monthlyRentRoll: round2(monthlyRent),
      annualRentRoll: round2(monthlyRent * 12),
      valuation: round2(valuation),
      mortgageCount: compMorts.length,
      mortgageDebt: round2(mortgageDebt),
      monthlyDebtService: round2(monthlyPayments),
      liquidity: round2(liquidity),
      netEquity: round2(Math.max(0, valuation - mortgageDebt)),
    };
  });

  const totalAnnualRent = totalMonthlyRent * 12;
  const netEquity = Math.max(0, totalValuation - totalMortgageDebt);

  return {
    groupTitle: 'PIXX TECHNOLOGIES UK - MASTER CONSOLIDATED PROPERTY PORTFOLIO',
    generatedAt: new Date().toISOString(),
    totals: {
      totalProperties,
      totalMonthlyRent: round2(totalMonthlyRent),
      totalAnnualRent: round2(totalAnnualRent),
      totalValuation: round2(totalValuation),
      totalMortgageDebt: round2(totalMortgageDebt),
      totalMonthlyDebtService: round2(totalMonthlyDebtService),
      netEquity: round2(netEquity),
      totalLiquidity: round2(totalLiquidity),
      totalCompanies: COMPANIES.length,
    },
    companySummaries,
    allProperties,
    allMortgages,
  };
}

/**
 * Generate Consolidated Group Excel Report
 * Exactly matches the structure of "Rent Deails for Software (1).xlsx"
 */
export async function generateConsolidatedGroupExcelReport() {
  const data = await getConsolidatedGroupOverviewData();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Pixx Technologies UK';
  wb.lastModifiedBy = 'Pixx Technologies UK';
  wb.created = new Date();
  wb.modified = new Date();

  const thinBorder = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  };

  const headerBorder = {
    top: { style: 'thin', color: { argb: 'FF94A3B8' } },
    bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
    left: { style: 'thin', color: { argb: 'FF94A3B8' } },
    right: { style: 'thin', color: { argb: 'FF94A3B8' } },
  };

  const totalBorder = {
    top: { style: 'thin', color: { argb: 'FF0F172A' } },
    bottom: { style: 'double', color: { argb: 'FF0F172A' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  };

  // =========================================================================
  // WORKSHEET 1: Rent Income Report (All 6 Companies)
  // =========================================================================
  const ws1 = wb.addWorksheet('Rent Income Report', {
    views: [{ showGridLines: true }],
  });

  ws1.columns = [
    { key: 'no', width: 6 },
    { key: 'address', width: 44 },
    { key: 'rent', width: 14 },
    { key: 'mfee', width: 14 },
    { key: 'duedate', width: 12 },
    { key: 'netrent', width: 16 },
    { key: 'date1', width: 13 },
    { key: 'amt1', width: 14 },
    { key: 'date2', width: 13 },
    { key: 'amt2', width: 14 },
    { key: 'date3', width: 13 },
    { key: 'amt3', width: 14 },
  ];

  // Master Title
  ws1.mergeCells('A1:L1');
  const mTitle = ws1.getCell('A1');
  mTitle.value = 'PIXX TECHNOLOGIES UK — MASTER CONSOLIDATED RENT INCOME REPORT';
  mTitle.font = { name: 'Calibri', size: 15, bold: true, color: { argb: 'FF0F172A' } };
  mTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF1F8' } };
  mTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  ws1.getRow(1).height = 30;

  ws1.mergeCells('A2:L2');
  const mSub = ws1.getCell('A2');
  mSub.value = 'ALL SIX CORPORATE PROPERTY PORTFOLIOS • Q3 STATEMENT (JUL-26 TO SEP-26)';
  mSub.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF047857' } };
  mSub.alignment = { horizontal: 'center', vertical: 'middle' };
  ws1.getRow(2).height = 20;

  let currentRow = 4;
  const companyTotalRows = [];

  // Iterate over each company in standard corporate order
  for (const comp of COMPANIES) {
    const compProps = comp.id === 'old-street'
      ? OLD_STREET_PROPERTIES
      : data.allProperties.filter((p) => p.companyId === comp.id).map((p, idx) => ({
          no: idx + 1,
          name: p.name || p.address?.line1 || `Property ${idx + 1}`,
          rent: p.contractualRent || 0,
          mFee: (p.contractualRent || 0) > 0 ? -50 : 0,
          dueDate: '1st',
          jul: { date: '-', amt: 0 },
          aug: { date: '-', amt: 0 },
          sep: { date: '-', amt: 0 },
        }));

    // Company Header Banner
    ws1.mergeCells(`A${currentRow}:L${currentRow}`);
    const compBanner = ws1.getCell(`A${currentRow}`);
    compBanner.value = `${comp.name.toUpperCase()} — ${comp.legalName.toUpperCase()}`;
    compBanner.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF0F172A' } };
    compBanner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    compBanner.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    ws1.getRow(currentRow).height = 24;
    styleReportBand(ws1, currentRow, 'header');
    currentRow++;

    // Subtitle
    ws1.mergeCells(`A${currentRow}:L${currentRow}`);
    const subCell = ws1.getCell(`A${currentRow}`);
    subCell.value = `RENT INCOME REPORT • REGISTRATION NO: ${comp.registrationNo}`;
    subCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF64748B' } };
    subCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
    ws1.getRow(currentRow).height = 18;
    currentRow++;

    // Column Headers (Rows currentRow & currentRow + 1)
    const hR1 = currentRow;
    const hR2 = currentRow + 1;
    ws1.getRow(hR1).height = 20;
    ws1.getRow(hR2).height = 20;

    ws1.mergeCells(`A${hR1}:A${hR2}`);
    ws1.getCell(`A${hR1}`).value = 'No';

    ws1.mergeCells(`B${hR1}:B${hR2}`);
    ws1.getCell(`B${hR1}`).value = 'Property Address';

    ws1.mergeCells(`C${hR1}:C${hR2}`);
    ws1.getCell(`C${hR1}`).value = 'Rent';

    ws1.mergeCells(`D${hR1}:D${hR2}`);
    ws1.getCell(`D${hR1}`).value = 'M. Fee';

    ws1.mergeCells(`E${hR1}:E${hR2}`);
    ws1.getCell(`E${hR1}`).value = 'Due Date';

    ws1.mergeCells(`F${hR1}:F${hR2}`);
    ws1.getCell(`F${hR1}`).value = 'Net Rent\nReceivable';

    ws1.mergeCells(`G${hR1}:H${hR1}`);
    ws1.getCell(`G${hR1}`).value = 'Jul-26';
    ws1.getCell(`G${hR2}`).value = 'Date';
    ws1.getCell(`H${hR2}`).value = 'Amount';

    ws1.mergeCells(`I${hR1}:J${hR1}`);
    ws1.getCell(`I${hR1}`).value = 'Aug-26';
    ws1.getCell(`I${hR2}`).value = 'Date';
    ws1.getCell(`J${hR2}`).value = 'Amount';

    ws1.mergeCells(`K${hR1}:L${hR1}`);
    ws1.getCell(`K${hR1}`).value = 'Sep-26';
    ws1.getCell(`K${hR2}`).value = 'Date';
    ws1.getCell(`L${hR2}`).value = 'Amount';

    for (let r = hR1; r <= hR2; r++) {
      const row = ws1.getRow(r);
      for (let c = 1; c <= 12; c++) {
        const cell = row.getCell(c);
        cell.border = headerBorder;
        cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        if (c === 5) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF4DE' } };
        } else if (c >= 7) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        } else {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F8FA' } };
        }
      }
    }
    currentRow += 2;

    const dataStartRow = currentRow;

    // Direct Property Data Rows
    for (let idx = 0; idx < compProps.length; idx++) {
      const p = compProps[idx];
      const rNum = currentRow;
      const row = ws1.getRow(rNum);
      row.height = 20;

      row.getCell(1).value = idx + 1;
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(1).font = { name: 'Calibri', size: 9.5, bold: true };

      row.getCell(2).value = p.name;
      row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(2).font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };

      row.getCell(3).value = p.rent;
      row.getCell(3).numFmt = '£#,##0.00';
      row.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(3).font = { name: 'Calibri', size: 9.5 };

      row.getCell(4).value = p.mFee;
      row.getCell(4).numFmt = '£#,##0.00;[Red]-£#,##0.00;"-"';
      row.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(4).font = { name: 'Calibri', size: 9.5, color: { argb: 'FFA1283D' } };

      row.getCell(5).value = p.dueDate || '1st';
      row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(5).font = { name: 'Calibri', size: 9.5, bold: true };
      row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF4DE' } };

      // Live Dynamic Formula: Net Rent Receivable = Rent + M. Fee
      row.getCell(6).value = { formula: `C${rNum}+D${rNum}` };
      row.getCell(6).numFmt = '£#,##0.00';
      row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(6).font = { name: 'Calibri', size: 9.5, bold: true };

      // Jul-26
      row.getCell(7).value = p.jul?.date || '-';
      row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(7).font = { name: 'Calibri', size: 9 };
      row.getCell(8).value = p.jul?.amt || 0;
      row.getCell(8).numFmt = '£#,##0.00';
      row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(8).font = { name: 'Calibri', size: 9.5 };

      // Aug-26
      row.getCell(9).value = p.aug?.date || '-';
      row.getCell(9).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(9).font = { name: 'Calibri', size: 9 };
      row.getCell(10).value = p.aug?.amt || 0;
      row.getCell(10).numFmt = '£#,##0.00';
      row.getCell(10).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(10).font = { name: 'Calibri', size: 9.5 };

      // Sep-26
      row.getCell(11).value = p.sep?.date || '-';
      row.getCell(11).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(11).font = { name: 'Calibri', size: 9 };
      row.getCell(12).value = p.sep?.amt || 0;
      row.getCell(12).numFmt = '£#,##0.00';
      row.getCell(12).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(12).font = { name: 'Calibri', size: 9.5 };

      for (let c = 1; c <= 12; c++) {
        if (c !== 5) {
          row.getCell(c).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: idx % 2 === 0 ? 'FFFFFFFF' : 'FFF4F8FA' },
          };
        }
        row.getCell(c).border = thinBorder;
      }

      currentRow++;
    }

    const dataEndRow = currentRow - 1;

    // Company Subtotal Row
    const totR = currentRow;
    const totRow = ws1.getRow(totR);
    totRow.height = 24;

    ws1.mergeCells(`A${totR}:B${totR}`);
    const totLabel = ws1.getCell(`A${totR}`);
    totLabel.value = `Grand Total Income — ${comp.name} (${compProps.length} Properties)`;
    totLabel.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    totLabel.alignment = { horizontal: 'center', vertical: 'middle' };

    totRow.getCell(3).value = reportSum('C', dataStartRow, dataEndRow);
    totRow.getCell(3).numFmt = '£#,##0.00';

    totRow.getCell(4).value = reportSum('D', dataStartRow, dataEndRow);
    totRow.getCell(4).numFmt = '£#,##0.00;[Red]-£#,##0.00;"-"';
    totRow.getCell(4).font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FFA1283D' } };

    totRow.getCell(6).value = reportSum('F', dataStartRow, dataEndRow);
    totRow.getCell(6).numFmt = '£#,##0.00';

    totRow.getCell(8).value = reportSum('H', dataStartRow, dataEndRow);
    totRow.getCell(8).numFmt = '£#,##0.00';

    totRow.getCell(10).value = reportSum('J', dataStartRow, dataEndRow);
    totRow.getCell(10).numFmt = '£#,##0.00';

    totRow.getCell(12).value = reportSum('L', dataStartRow, dataEndRow);
    totRow.getCell(12).numFmt = '£#,##0.00';

    for (let c = 1; c <= 12; c++) {
      const cell = totRow.getCell(c);
      cell.border = totalBorder;
      cell.font = cell.font || { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      cell.alignment = cell.alignment || { horizontal: 'right', vertical: 'middle' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    }

    companyTotalRows.push(totR);
    styleReportBand(ws1, hR1, 'header');
    styleReportBand(ws1, hR2, 'header');
    styleReportRows(ws1, dataStartRow, dataEndRow, { currencyColumns: [3, 4, 6, 8, 10, 12] });
    styleReportBand(ws1, totR, 'total');
    for (const column of [3, 4, 6, 8, 10, 12]) totRow.getCell(column).numFmt = gbpNumberFormat;
    currentRow += 3; // Spacer between companies
  }

  // Master Group Grand Total (Summing all 6 companies)
  const masterTotR = currentRow;
  const masterTotRow = ws1.getRow(masterTotR);
  masterTotRow.height = 28;

  ws1.mergeCells(`A${masterTotR}:B${masterTotR}`);
  const mTotLabel = ws1.getCell(`A${masterTotR}`);
  mTotLabel.value = 'MASTER GROUP GRAND TOTAL (ALL 6 COMPANIES • 48 DIRECT PROPERTIES)';
  mTotLabel.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  mTotLabel.alignment = { horizontal: 'center', vertical: 'middle' };

  // Construct sum formula across the 6 company subtotal rows
  const rentSum = companyTotalRows.map((r) => `C${r}`).join('+');
  const mFeeSum = companyTotalRows.map((r) => `D${r}`).join('+');
  const netRentSum = companyTotalRows.map((r) => `F${r}`).join('+');
  const julSum = companyTotalRows.map((r) => `H${r}`).join('+');
  const augSum = companyTotalRows.map((r) => `J${r}`).join('+');
  const sepSum = companyTotalRows.map((r) => `L${r}`).join('+');

  masterTotRow.getCell(3).value = { formula: rentSum };
  masterTotRow.getCell(3).numFmt = '£#,##0.00';

  masterTotRow.getCell(4).value = { formula: mFeeSum };
  masterTotRow.getCell(4).numFmt = '£#,##0.00;[Red]-£#,##0.00;"-"';

  masterTotRow.getCell(6).value = { formula: netRentSum };
  masterTotRow.getCell(6).numFmt = '£#,##0.00';

  masterTotRow.getCell(8).value = { formula: julSum };
  masterTotRow.getCell(8).numFmt = '£#,##0.00';

  masterTotRow.getCell(10).value = { formula: augSum };
  masterTotRow.getCell(10).numFmt = '£#,##0.00';

  masterTotRow.getCell(12).value = { formula: sepSum };
  masterTotRow.getCell(12).numFmt = '£#,##0.00';

  for (let c = 1; c <= 12; c++) {
    const cell = masterTotRow.getCell(c);
    cell.border = totalBorder;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } };
    cell.alignment = cell.alignment || { horizontal: 'right', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF1F8' } }; // Soft Indigo Tint
  }

  // =========================================================================
  // WORKSHEET 2: Consolidated Mortgage & Asset Register
  // =========================================================================
  const ws2 = wb.addWorksheet('Mortgage Register', {
    views: [{ showGridLines: true }],
  });

  ws2.columns = [
    { key: 'no', width: 6 },
    { key: 'company', width: 26 },
    { key: 'property', width: 44 },
    { key: 'lender', width: 24 },
    { key: 'account', width: 22 },
    { key: 'rate', width: 12 },
    { key: 'repaymentType', width: 18 },
    { key: 'monthlyPayment', width: 20 },
    { key: 'debt', width: 22 },
  ];

  // Header Title
  ws2.mergeCells('A1:I1');
  const ws2Title = ws2.getCell('A1');
  ws2Title.value = 'PIXX TECHNOLOGIES UK — CONSOLIDATED MORTGAGE & LOAN FACILITY REGISTER';
  ws2Title.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF047857' } };
  ws2Title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } }; // Soft Emerald Tint
  ws2Title.alignment = { horizontal: 'center', vertical: 'middle' };
  ws2.getRow(1).height = 28;

  ws2.getRow(2).height = 8; // Spacer

  // Column Headers
  ws2.getRow(3).height = 24;
  const s2Headers = [
    'No',
    'Owning Company',
    'Property Address',
    'Mortgage Lender',
    'Account Number',
    'Interest Rate',
    'Repayment Type',
    'Monthly Payment (£)',
    'Outstanding Principal (£)',
  ];

  s2Headers.forEach((h, idx) => {
    const cell = ws2.getRow(3).getCell(idx + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.alignment = {
      horizontal: idx === 0 || idx === 5 || idx === 6 ? 'center' : idx >= 7 ? 'right' : 'left',
      vertical: 'middle',
    };
    cell.border = headerBorder;
  });

  let s2Row = 4;
  const s2StartRow = s2Row;

  // Populate Mortgages with matched property names
  for (let idx = 0; idx < data.allMortgages.length; idx++) {
    const mort = data.allMortgages[idx];
    const comp = getCompanyById(mort.companyId);
    const matchedProp = data.allProperties.find((p) => String(p._id) === String(mort.propertyId));

    const row = ws2.getRow(s2Row);
    row.height = 20;

    row.getCell(1).value = idx + 1;
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(1).font = { name: 'Calibri', size: 9.5, bold: true };

    row.getCell(2).value = comp?.name || mort.companyId;
    row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(2).font = { name: 'Calibri', size: 9.5, bold: true };

    row.getCell(3).value = matchedProp?.name || matchedProp?.address?.line1 || 'Property Asset';
    row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(3).font = { name: 'Calibri', size: 9.5 };

    row.getCell(4).value = mort.lenderName;
    row.getCell(4).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(4).font = { name: 'Calibri', size: 9.5, bold: true };

    row.getCell(5).value = mort.accountReference;
    row.getCell(5).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(5).font = { name: 'Calibri', size: 9.5 };

    row.getCell(6).value = `${mort.interestRate || 0}%`;
    row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(6).font = { name: 'Calibri', size: 9.5 };

    row.getCell(7).value = mort.repaymentType || 'INTEREST_ONLY';
    row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(7).font = { name: 'Calibri', size: 9 };

    row.getCell(8).value = mort.expectedRepaymentAmount || 0;
    row.getCell(8).numFmt = '£#,##0.00';
    row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(8).font = { name: 'Calibri', size: 9.5, bold: true };

    row.getCell(9).value = mort.outstandingPrincipalBalance || 0;
    row.getCell(9).numFmt = '£#,##0.00';
    row.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(9).font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FFA1283D' } };

    for (let c = 1; c <= 9; c++) {
      row.getCell(c).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: idx % 2 === 0 ? 'FFFFFFFF' : 'FFF4F8FA' },
      };
      row.getCell(c).border = thinBorder;
    }
    s2Row++;
  }

  const s2EndRow = s2Row - 1;

  // Grand Total Row for Mortgages
  const s2TotRow = ws2.getRow(s2Row);
  s2TotRow.height = 24;

  ws2.mergeCells(`A${s2Row}:G${s2Row}`);
  const s2TotLabel = ws2.getCell(`A${s2Row}`);
  s2TotLabel.value = `Grand Portfolio Total (${data.allMortgages.length} Active Mortgage Facilities)`;
  s2TotLabel.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF0F172A' } };
  s2TotLabel.alignment = { horizontal: 'center', vertical: 'middle' };

  s2TotRow.getCell(8).value = reportSum('H', s2StartRow, s2EndRow);
  s2TotRow.getCell(8).numFmt = '£#,##0.00';
  s2TotRow.getCell(8).font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF16634C' } };

  s2TotRow.getCell(9).value = reportSum('I', s2StartRow, s2EndRow);
  s2TotRow.getCell(9).numFmt = '£#,##0.00';
  s2TotRow.getCell(9).font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FFA1283D' } };

  for (let c = 1; c <= 9; c++) {
    const cell = s2TotRow.getCell(c);
    cell.border = totalBorder;
    cell.alignment = cell.alignment || { horizontal: 'right', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  }

  // =========================================================================
  // WORKSHEET 3: Portfolio Summary (All 48 Direct Properties)
  // =========================================================================
  const ws3 = wb.addWorksheet('Portfolio Summary', {
    views: [{ showGridLines: true }],
  });

  ws3.columns = [
    { key: 'no', width: 6 },
    { key: 'company', width: 26 },
    { key: 'name', width: 44 },
    { key: 'type', width: 16 },
    { key: 'status', width: 14 },
    { key: 'tenant', width: 36 },
    { key: 'monthlyRent', width: 18 },
    { key: 'annualRent', width: 18 },
    { key: 'valuation', width: 18 },
  ];

  // Header Title
  ws3.mergeCells('A1:I1');
  const ws3Title = ws3.getCell('A1');
  ws3Title.value = `PIXX TECHNOLOGIES UK — DIRECT PROPERTY ASSET INVENTORY (${data.allProperties.length} PROPERTIES)`;
  ws3Title.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1E40AF' } };
  ws3Title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF1F8' } }; // Soft Indigo Tint
  ws3Title.alignment = { horizontal: 'center', vertical: 'middle' };
  ws3.getRow(1).height = 28;

  ws3.getRow(2).height = 8; // Spacer

  // Column Headers
  ws3.getRow(3).height = 24;
  const s3Headers = [
    'No',
    'Owning Company',
    'Property Address',
    'Asset Type',
    'Occupancy Status',
    'Tenant Name',
    'Contractual Rent (£)',
    'Annual Rent Roll (£)',
    'Valuation (£)',
  ];

  s3Headers.forEach((h, idx) => {
    const cell = ws3.getRow(3).getCell(idx + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.alignment = {
      horizontal: idx === 0 || idx === 3 || idx === 4 ? 'center' : idx >= 6 ? 'right' : 'left',
      vertical: 'middle',
    };
    cell.border = headerBorder;
  });

  let s3Row = 4;
  const s3StartRow = s3Row;

  for (let idx = 0; idx < data.allProperties.length; idx++) {
    const p = data.allProperties[idx];
    const comp = getCompanyById(p.companyId);
    const row = ws3.getRow(s3Row);
    row.height = 20;

    row.getCell(1).value = idx + 1;
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(1).font = { name: 'Calibri', size: 9.5, bold: true };

    row.getCell(2).value = comp?.name || p.companyId || '-';
    row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(2).font = { name: 'Calibri', size: 9.5, bold: true };

    row.getCell(3).value = p.name || p.address?.line1 || '-';
    row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(3).font = { name: 'Calibri', size: 9.5 };

    row.getCell(4).value = p.propertyType || 'Residential';
    row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(4).font = { name: 'Calibri', size: 9.5 };

    const isOccupied = p.currentStatus === 'Occupied' || !!p.tenantName;
    row.getCell(5).value = isOccupied ? 'Occupied' : 'Available';
    row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(5).font = {
      name: 'Calibri',
      size: 9.5,
      bold: true,
      color: { argb: isOccupied ? 'FF16634C' : 'FF64748B' },
    };

    row.getCell(6).value = p.tenantName || '— (Direct Asset Available)';
    row.getCell(6).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(6).font = {
      name: 'Calibri',
      size: 9.5,
      italic: !p.tenantName,
      color: { argb: p.tenantName ? 'FF0F172A' : 'FF94A3B8' },
    };

    row.getCell(7).value = p.contractualRent || 0;
    row.getCell(7).numFmt = '£#,##0.00';
    row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(7).font = { name: 'Calibri', size: 9.5, bold: true };

    // Dynamic Formula: Annual Rent Roll = Monthly Rent * 12
    row.getCell(8).value = { formula: `G${s3Row}*12` };
    row.getCell(8).numFmt = '£#,##0.00';
    row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(8).font = { name: 'Calibri', size: 9.5 };

    row.getCell(9).value = p.currentValuation || p.purchasePrice || 0;
    row.getCell(9).numFmt = '£#,##0.00';
    row.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(9).font = { name: 'Calibri', size: 9.5 };

    for (let c = 1; c <= 9; c++) {
      row.getCell(c).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: idx % 2 === 0 ? 'FFFFFFFF' : 'FFF4F8FA' },
      };
      row.getCell(c).border = thinBorder;
    }
    s3Row++;
  }

  const s3EndRow = s3Row - 1;

  // Grand Total Row for Direct Properties
  const s3TotRow = ws3.getRow(s3Row);
  s3TotRow.height = 24;

  ws3.mergeCells(`A${s3Row}:F${s3Row}`);
  const s3TotLabel = ws3.getCell(`A${s3Row}`);
  s3TotLabel.value = `Grand Portfolio Total (${data.allProperties.length} Direct Independent Assets)`;
  s3TotLabel.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF0F172A' } };
  s3TotLabel.alignment = { horizontal: 'center', vertical: 'middle' };

  s3TotRow.getCell(7).value = reportSum('G', s3StartRow, s3EndRow);
  s3TotRow.getCell(7).numFmt = '£#,##0.00';

  s3TotRow.getCell(8).value = reportSum('H', s3StartRow, s3EndRow);
  s3TotRow.getCell(8).numFmt = '£#,##0.00';

  s3TotRow.getCell(9).value = reportSum('I', s3StartRow, s3EndRow);
  s3TotRow.getCell(9).numFmt = '£#,##0.00';

  for (let c = 1; c <= 9; c++) {
    const cell = s3TotRow.getCell(c);
    cell.border = totalBorder;
    cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF0F172A' } };
    cell.alignment = cell.alignment || { horizontal: 'right', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  }

  configureReportSheet(ws1, { freezeRows: 3 });
  styleReportBand(ws1, 1, 'title');
  styleReportBand(ws1, masterTotR, 'total');
  for (const column of [3, 4, 6, 8, 10, 12]) masterTotRow.getCell(column).numFmt = gbpNumberFormat;
  configureReportSheet(ws2, { freezeRows: 3, headerRow: 3, lastDataRow: s2EndRow });
  styleReportBand(ws2, 1, 'title');
  styleReportBand(ws2, 3, 'header');
  styleReportRows(ws2, s2StartRow, s2EndRow, { currencyColumns: [8, 9] });
  styleReportBand(ws2, s2Row, 'total');
  for (const column of [8, 9]) s2TotRow.getCell(column).numFmt = gbpNumberFormat;
  configureReportSheet(ws3, { freezeRows: 3, headerRow: 3, lastDataRow: s3EndRow });
  styleReportBand(ws3, 1, 'title');
  styleReportBand(ws3, 3, 'header');
  styleReportRows(ws3, s3StartRow, s3EndRow, { currencyColumns: [7, 8, 9] });
  styleReportBand(ws3, s3Row, 'total');
  for (const column of [7, 8, 9]) s3TotRow.getCell(column).numFmt = gbpNumberFormat;
  return wb.xlsx.writeBuffer();
}

/** Generate the group overview or a single company's portfolio PDF. */
export async function generateConsolidatedGroupPdfReport({ companyId } = {}) {
  const company = companyId && companyId !== 'all' ? getCompanyById(companyId) : null;
  if (companyId && companyId !== 'all' && !company) throw new RangeError('Select a valid company for the portfolio report.');

  const data = await getConsolidatedGroupOverviewData();
  const title = company ? 'Company portfolio report' : 'Group portfolio report';
  const details = [`As at ${formatUKDate(data.generatedAt)} | GBP`];
  const money = (label, width, tone = 'ink') => ({ label, width, align: 'right', tone: () => tone });
  const metric = (label, value, tone) => ({ label, value: formatGBP(value), tone });
  const sections = [];
  if (!company) {
    const { totals } = data;
    sections.push({
      title,
      company: 'PIXX Property',
      logo: LOGO_PATH,
      details: [`${data.companySummaries.length} companies`, ...details],
      metrics: [
        { label: 'Properties', value: totals.totalProperties, tone: 'blue' },
        metric('Monthly rent', totals.totalMonthlyRent, 'green'),
        metric('Annual rent', totals.totalAnnualRent, 'green'),
        metric('Recorded valuation', totals.totalValuation, 'blue'),
        metric('Mortgage debt', totals.totalMortgageDebt, 'red'),
        metric('Net equity', totals.netEquity, 'teal'),
      ],
      tables: [{
        heading: 'Company comparison',
        columns: [
          { label: 'Company', width: 155 }, { label: 'Registration', width: 87 },
          { label: 'Properties', width: 58, align: 'right' },
          money('Monthly rent', 99, 'green'), money('Annual rent', 99, 'green'),
          { label: 'Mortgages', width: 60, align: 'right' },
          money('Mortgage debt', 111, 'red'), money('Monthly payments', 112),
        ],
        rows: data.companySummaries.map(c => [
          c.name, c.registrationNo, c.propertyCount, formatGBP(c.monthlyRentRoll),
          formatGBP(c.annualRentRoll), c.mortgageCount, formatGBP(c.mortgageDebt), formatGBP(c.monthlyDebtService),
        ]),
        total: [
          'Group total', '', totals.totalProperties, formatGBP(totals.totalMonthlyRent),
          formatGBP(totals.totalAnnualRent), data.allMortgages.length,
          formatGBP(totals.totalMortgageDebt), formatGBP(totals.totalMonthlyDebtService),
        ],
      }],
    });
  }

  for (const summary of data.companySummaries.filter(c => !company || c.companyId === company.id)) {
    const properties = data.allProperties.filter(p => p.companyId === summary.companyId);
    const mortgages = data.allMortgages.filter(m => m.companyId === summary.companyId);
    const propertyNames = new Map(properties.map(p => [String(p._id), p.name || p.address?.line1]));
    sections.push({
      title: 'Property and mortgage portfolio',
      company: summary.legalName || summary.name,
      logo: getCompanyLogoPath(summary.companyId),
      details: [`Registration: ${summary.registrationNo || '-'}`, ...details],
      metrics: [
        { label: 'Properties', value: summary.propertyCount, tone: 'blue' },
        metric('Monthly rent', summary.monthlyRentRoll, 'green'),
        metric('Annual rent', summary.annualRentRoll, 'green'),
        metric('Mortgage debt', summary.mortgageDebt, 'red'),
        metric('Net equity', summary.netEquity, 'teal'),
      ],
      tables: [
        {
          heading: `Rent roll (${properties.length})`,
          columns: [
            { label: 'Property', width: 218 }, { label: 'Type', width: 94 }, { label: 'Status', width: 84 },
            { label: 'Tenant', width: 177 }, money('Monthly rent', 101, 'green'), money('Annual rent', 108),
          ],
          rows: properties.map(p => [
            p.name || p.address?.line1, p.propertyType,
            p.currentStatus || p.status || (p.tenantName ? 'Occupied' : 'Available'),
            p.tenantName, formatGBP(p.contractualRent), formatGBP((p.contractualRent || 0) * 12),
          ]),
          total: ['Total rent', '', '', '', formatGBP(summary.monthlyRentRoll), formatGBP(summary.annualRentRoll)],
          empty: 'No active properties are recorded for this company.',
        },
        {
          heading: `Active mortgages (${mortgages.length})`,
          columns: [
            { label: 'Property', width: 210 }, { label: 'Lender', width: 152 }, { label: 'Account reference', width: 123 },
            { label: 'Rate', width: 58, align: 'right' }, money('Monthly payment', 114), money('Outstanding', 126, 'red'),
          ],
          rows: mortgages.map(m => [
            propertyNames.get(String(m.propertyId)), m.lenderName, m.accountReference,
            m.interestRate == null ? '-' : `${m.interestRate}%`,
            formatGBP(m.expectedRepaymentAmount), formatGBP(m.outstandingPrincipalBalance),
          ]),
          total: ['Total mortgage debt', '', '', '', formatGBP(summary.monthlyDebtService), formatGBP(summary.mortgageDebt)],
          empty: 'No active mortgages are recorded for this company.',
        },
      ],
    });
  }

  return renderReportPdf({ title, sections });
}
