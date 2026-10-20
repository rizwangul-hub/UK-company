import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
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
  mTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };
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
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF08A' } };
        } else if (c >= 7) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        } else {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
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
      row.getCell(4).font = { name: 'Calibri', size: 9.5, color: { argb: 'FFDC2626' } };

      row.getCell(5).value = p.dueDate || '1st';
      row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(5).font = { name: 'Calibri', size: 9.5, bold: true };
      row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF08A' } };

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
            fgColor: { argb: idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' },
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

    totRow.getCell(3).value = { formula: `SUM(C${dataStartRow}:C${dataEndRow})` };
    totRow.getCell(3).numFmt = '£#,##0.00';

    totRow.getCell(4).value = { formula: `SUM(D${dataStartRow}:D${dataEndRow})` };
    totRow.getCell(4).numFmt = '£#,##0.00;[Red]-£#,##0.00;"-"';
    totRow.getCell(4).font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FFDC2626' } };

    totRow.getCell(6).value = { formula: `SUM(F${dataStartRow}:F${dataEndRow})` };
    totRow.getCell(6).numFmt = '£#,##0.00';

    totRow.getCell(8).value = { formula: `SUM(H${dataStartRow}:H${dataEndRow})` };
    totRow.getCell(8).numFmt = '£#,##0.00';

    totRow.getCell(10).value = { formula: `SUM(J${dataStartRow}:J${dataEndRow})` };
    totRow.getCell(10).numFmt = '£#,##0.00';

    totRow.getCell(12).value = { formula: `SUM(L${dataStartRow}:L${dataEndRow})` };
    totRow.getCell(12).numFmt = '£#,##0.00';

    for (let c = 1; c <= 12; c++) {
      const cell = totRow.getCell(c);
      cell.border = totalBorder;
      cell.font = cell.font || { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
      cell.alignment = cell.alignment || { horizontal: 'right', vertical: 'middle' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    }

    companyTotalRows.push(totR);
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
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } }; // Soft Indigo Tint
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
    row.getCell(9).font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FFDC2626' } };

    for (let c = 1; c <= 9; c++) {
      row.getCell(c).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' },
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

  s2TotRow.getCell(8).value = { formula: `SUM(H${s2StartRow}:H${s2EndRow})` };
  s2TotRow.getCell(8).numFmt = '£#,##0.00';
  s2TotRow.getCell(8).font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF059669' } };

  s2TotRow.getCell(9).value = { formula: `SUM(I${s2StartRow}:I${s2EndRow})` };
  s2TotRow.getCell(9).numFmt = '£#,##0.00';
  s2TotRow.getCell(9).font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FFDC2626' } };

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
  ws3Title.value = 'PIXX TECHNOLOGIES UK — DIRECT PROPERTY ASSET INVENTORY (ALL 48 PROPERTIES)';
  ws3Title.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1E40AF' } };
  ws3Title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } }; // Soft Indigo Tint
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
      color: { argb: isOccupied ? 'FF059669' : 'FF64748B' },
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
        fgColor: { argb: idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' },
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

  s3TotRow.getCell(7).value = { formula: `SUM(G${s3StartRow}:G${s3EndRow})` };
  s3TotRow.getCell(7).numFmt = '£#,##0.00';

  s3TotRow.getCell(8).value = { formula: `SUM(H${s3StartRow}:H${s3EndRow})` };
  s3TotRow.getCell(8).numFmt = '£#,##0.00';

  s3TotRow.getCell(9).value = { formula: `SUM(I${s3StartRow}:I${s3EndRow})` };
  s3TotRow.getCell(9).numFmt = '£#,##0.00';

  for (let c = 1; c <= 9; c++) {
    const cell = s3TotRow.getCell(c);
    cell.border = totalBorder;
    cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF0F172A' } };
    cell.alignment = cell.alignment || { horizontal: 'right', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  }

  return await wb.xlsx.writeBuffer();
}

/**
 * Generate Attractive, Beautiful Master Group PDF Report using PDFKit
 */
export async function generateConsolidatedGroupPdfReport(options = {}) {
  const { companyId } = options;
  const data = await getConsolidatedGroupOverviewData();

  const isSingleCompany = Boolean(companyId && companyId !== 'all');
  const targetCompany = isSingleCompany
    ? COMPANIES.find((c) => c.id === companyId || c.slug === companyId) || COMPANIES[0]
    : null;

  const companiesToReport = isSingleCompany
    ? [targetCompany]
    : COMPANIES;

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 26,
        bufferPages: true,
      });

      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const margin = 26;
      const contentWidth = pageWidth - margin * 2;

      // =====================================================================
      // PAGE 1: If Master Report -> Group Overview & Comparison Matrix
      // =====================================================================
      if (!isSingleCompany) {
        // Corporate Header
        const logoWidth = 44;
        const logoHeight = 44;
        if (fs.existsSync(LOGO_PATH)) {
          doc.image(LOGO_PATH, margin, margin, { width: logoWidth, height: logoHeight });
        }

        const textStartX = fs.existsSync(LOGO_PATH) ? margin + logoWidth + 12 : margin;
        doc
          .font('Helvetica-Bold')
          .fontSize(14)
          .fillColor('#0F172A')
          .text('PIXX TECHNOLOGIES UK — MASTER GROUP PORTFOLIO STATEMENT', textStartX, margin);

        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor('#64748B')
          .text('Consolidated Property Finance & Multi-Entity Investment Audit Register • United Kingdom', textStartX, margin + 17);

        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor('#059669')
          .text('ALL SIX REGISTERED CORPORATE ENTITIES • INDIVIDUAL COMPANY AUDIT SECTIONS', textStartX, margin + 30);

        // Top Right Reference Box
        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .fillColor('#475569')
          .text('REF: PIXX-GRP-Q3-2026', contentWidth - 100, margin, { align: 'right' });

        doc
          .font('Helvetica')
          .fontSize(7.5)
          .fillColor('#64748B')
          .text(`Generated: ${formatUKDate(data.generatedAt)} ${new Date(data.generatedAt).toLocaleTimeString('en-GB')}`, contentWidth - 100, margin + 14, { align: 'right' });

        doc
          .text('Companies: 6 Legal Entities', contentWidth - 100, margin + 26, { align: 'right' });

        // Horizontal Divider
        const headerDividerY = margin + 50;
        doc
          .strokeColor('#CBD5E1')
          .lineWidth(1)
          .moveTo(margin, headerDividerY)
          .lineTo(pageWidth - margin, headerDividerY)
          .stroke();

        // 2. Executive KPI Cards Strip (6 tiles)
        const kpiCards = [
          { label: 'TOTAL DIRECT ASSETS', val: `${data.totals.totalProperties} Properties`, color: '#0F172A', bg: '#F8FAFC' },
          { label: 'MONTHLY RENT ROLL', val: formatGBP(data.totals.totalMonthlyRent), color: '#059669', bg: '#ECFDF5' },
          { label: 'ANNUAL RENT ROLL', val: formatGBP(data.totals.totalAnnualRent), color: '#047857', bg: '#E6F4EA' },
          { label: 'PORTFOLIO VALUATION', val: formatGBP(data.totals.totalValuation), color: '#2563EB', bg: '#EFF6FF' },
          { label: 'MORTGAGE LIABILITY', val: formatGBP(data.totals.totalMortgageDebt), color: '#DC2626', bg: '#FEF2F2' },
          { label: 'NET GROUP EQUITY', val: formatGBP(data.totals.netEquity), color: '#4F46E5', bg: '#EEF2FF' },
        ];

        const kpiCardWidth = (contentWidth - 5 * 8) / 6;
        const kpiCardHeight = 44;
        const kpiY = headerDividerY + 10;

        kpiCards.forEach((card, idx) => {
          const cardX = margin + idx * (kpiCardWidth + 8);
          doc
            .roundedRect(cardX, kpiY, kpiCardWidth, kpiCardHeight, 6)
            .fillAndStroke(card.bg, '#E2E8F0');

          doc
            .font('Helvetica-Bold')
            .fontSize(6.5)
            .fillColor('#64748B')
            .text(card.label, cardX + 6, kpiY + 8, { width: kpiCardWidth - 12 });

          doc
            .font('Helvetica-Bold')
            .fontSize(9.5)
            .fillColor(card.color)
            .text(card.val, cardX + 6, kpiY + 22, { width: kpiCardWidth - 12 });
        });

        // 3. Consolidated Corporate Entities Comparison Table
        const tableY = kpiY + kpiCardHeight + 14;
        doc
          .font('Helvetica-Bold')
          .fontSize(10)
          .fillColor('#0F172A')
          .text('CONSOLIDATED ENTITY BREAKDOWN & FINANCIAL METRICS', margin, tableY);

        const compCols = [
          { label: 'Company Entity', width: 140, align: 'left' },
          { label: 'UK Reg No.', width: 80, align: 'center' },
          { label: 'Direct Assets', width: 65, align: 'center' },
          { label: 'Monthly Rent', width: 95, align: 'right' },
          { label: 'Annual Rent Roll', width: 105, align: 'right' },
          { label: 'Mortgages', width: 60, align: 'center' },
          { label: 'Mortgage Debt', width: 105, align: 'right' },
          { label: 'Monthly Debt Service', width: 100, align: 'right' },
        ];

        const compHeaderY = tableY + 16;
        doc
          .roundedRect(margin, compHeaderY, contentWidth, 20, 4)
          .fill('#F1F5F9');

        let colX = margin + 6;
        compCols.forEach((c) => {
          doc
            .font('Helvetica-Bold')
            .fontSize(7.5)
            .fillColor('#0F172A')
            .text(c.label, colX, compHeaderY + 6, { width: c.width - 10, align: c.align });
          colX += c.width;
        });

        let compRowY = compHeaderY + 22;
        data.companySummaries.forEach((comp, idx) => {
          const isEven = idx % 2 === 0;
          doc
            .rect(margin, compRowY, contentWidth, 18)
            .fill(isEven ? '#FFFFFF' : '#F8FAFC');

          colX = margin + 6;

          // Name
          doc.font('Helvetica-Bold').fontSize(8).fillColor('#0F172A')
            .text(comp.name, colX, compRowY + 5, { width: compCols[0].width - 10, align: 'left' });
          colX += compCols[0].width;

          // Reg No
          doc.font('Helvetica').fontSize(7.5).fillColor('#64748B')
            .text(comp.registrationNo || 'N/A', colX, compRowY + 5, { width: compCols[1].width - 10, align: 'center' });
          colX += compCols[1].width;

          // Properties
          doc.font('Helvetica-Bold').fontSize(8).fillColor('#0F172A')
            .text(String(comp.propertyCount), colX, compRowY + 5, { width: compCols[2].width - 10, align: 'center' });
          colX += compCols[2].width;

          // Monthly Rent
          doc.font('Helvetica-Bold').fontSize(8).fillColor('#059669')
            .text(formatGBP(comp.monthlyRentRoll), colX, compRowY + 5, { width: compCols[3].width - 10, align: 'right' });
          colX += compCols[3].width;

          // Annual Rent
          doc.font('Helvetica-Bold').fontSize(8).fillColor('#047857')
            .text(formatGBP(comp.annualRentRoll), colX, compRowY + 5, { width: compCols[4].width - 10, align: 'right' });
          colX += compCols[4].width;

          // Mortgages
          doc.font('Helvetica').fontSize(8).fillColor('#0F172A')
            .text(String(comp.mortgageCount), colX, compRowY + 5, { width: compCols[5].width - 10, align: 'center' });
          colX += compCols[5].width;

          // Mortgage Debt
          doc.font('Helvetica-Bold').fontSize(8).fillColor('#DC2626')
            .text(formatGBP(comp.mortgageDebt), colX, compRowY + 5, { width: compCols[6].width - 10, align: 'right' });
          colX += compCols[6].width;

          // Monthly Payments
          doc.font('Helvetica').fontSize(8).fillColor('#0F172A')
            .text(formatGBP(comp.monthlyDebtService), colX, compRowY + 5, { width: compCols[7].width - 10, align: 'right' });

          compRowY += 19;
        });

        // Total Row for Comparison Table (NO BLACK BACKGROUND)
        doc
          .roundedRect(margin, compRowY, contentWidth, 22, 4)
          .fill('#EEF2FF');

        colX = margin + 6;
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#0F172A')
          .text('MASTER GROUP TOTAL', colX, compRowY + 6, { width: compCols[0].width - 10, align: 'left' });
        colX += compCols[0].width;

        doc.font('Helvetica-Bold').fontSize(8).fillColor('#475569')
          .text('6 Entities', colX, compRowY + 6, { width: compCols[1].width - 10, align: 'center' });
        colX += compCols[1].width;

        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#0F172A')
          .text(String(data.totals.totalProperties), colX, compRowY + 6, { width: compCols[2].width - 10, align: 'center' });
        colX += compCols[2].width;

        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#059669')
          .text(formatGBP(data.totals.totalMonthlyRent), colX, compRowY + 6, { width: compCols[3].width - 10, align: 'right' });
        colX += compCols[3].width;

        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#047857')
          .text(formatGBP(data.totals.totalAnnualRent), colX, compRowY + 6, { width: compCols[4].width - 10, align: 'right' });
        colX += compCols[4].width;

        doc.font('Helvetica-Bold').fontSize(8).fillColor('#0F172A')
          .text(String(data.allMortgages.length), colX, compRowY + 6, { width: compCols[5].width - 10, align: 'center' });
        colX += compCols[5].width;

        doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#DC2626')
          .text(formatGBP(data.totals.totalMortgageDebt), colX, compRowY + 6, { width: compCols[6].width - 10, align: 'right' });
        colX += compCols[6].width;

        doc.font('Helvetica-Bold').fontSize(8).fillColor('#0F172A')
          .text(formatGBP(data.totals.totalMonthlyDebtService), colX, compRowY + 6, { width: compCols[7].width - 10, align: 'right' });
      }

      // =====================================================================
      // INDIVIDUAL DEDICATED COMPANY REPORTS (Single-Company Sections like Excel)
      // =====================================================================
      companiesToReport.forEach((comp, compIdx) => {
        // Add new page for each company section (unless single-company export on page 1)
        if (!isSingleCompany || compIdx > 0) {
          doc.addPage();
        }

        const compSummary = data.companySummaries.find((s) => s.companyId === comp.id) || {
          propertyCount: 0,
          monthlyRentRoll: 0,
          annualRentRoll: 0,
          mortgageCount: 0,
          mortgageDebt: 0,
          monthlyDebtService: 0,
          netEquity: 0,
        };

        const compProps = comp.id === 'old-street'
          ? OLD_STREET_PROPERTIES.map((p, i) => ({
              _id: `old-street-prop-${i}`,
              companyId: 'old-street',
              name: p.name,
              propertyType: 'Residential',
              currentStatus: 'Occupied',
              tenantName: p.tenantName || 'Active Tenancy',
              contractualRent: p.rent,
            }))
          : data.allProperties.filter((p) => p.companyId === comp.id);

        const compMorts = data.allMortgages.filter((m) => m.companyId === comp.id);

        // 1. Company Corporate Header
        const headerTopY = margin;
        const compLogoPath = getCompanyLogoPath(comp.id);
        const hasCompLogo = Boolean(compLogoPath && fs.existsSync(compLogoPath));
        if (hasCompLogo) {
          doc.image(compLogoPath, margin, headerTopY, { width: 38, height: 38 });
        }

        const headTextX = hasCompLogo ? margin + 48 : margin;
        const compSeq = !isSingleCompany ? `${compIdx + 1}. ` : '';

        doc
          .font('Helvetica-Bold')
          .fontSize(13)
          .fillColor('#0F172A')
          .text(`${compSeq}${comp.name.toUpperCase()} — ${comp.legalName.toUpperCase()}`, headTextX, headerTopY);

        doc
          .font('Helvetica')
          .fontSize(7.5)
          .fillColor('#64748B')
          .text(`UK Company Registration: ${comp.registrationNo} • Jurisdiction: ${comp.jurisdiction} • Single Entity Audit`, headTextX, headerTopY + 16);

        // Right side badge
        doc
          .font('Helvetica-Bold')
          .fontSize(8)
          .fillColor('#059669')
          .text(isSingleCompany ? 'OFFICIAL SINGLE ENTITY AUDIT REPORT' : `CORPORATE ENTITY REPORT ${compIdx + 1} OF 6`, contentWidth - 100, headerTopY, { align: 'right' });

        doc
          .font('Helvetica')
          .fontSize(7)
          .fillColor('#64748B')
          .text('Statement Period: Q3-2026', contentWidth - 100, headerTopY + 14, { align: 'right' });

        // Divider
        const divY = headerTopY + 42;
        doc.strokeColor('#CBD5E1').lineWidth(1).moveTo(margin, divY).lineTo(pageWidth - margin, divY).stroke();

        // 2. Company 5-Tile KPI Banner
        const compKpis = [
          { label: 'DIRECT ASSETS', val: `${compSummary.propertyCount} Properties`, color: '#0F172A', bg: '#F8FAFC' },
          { label: 'MONTHLY RENT ROLL', val: formatGBP(compSummary.monthlyRentRoll), color: '#059669', bg: '#ECFDF5' },
          { label: 'ANNUAL RENT ROLL', val: formatGBP(compSummary.annualRentRoll), color: '#047857', bg: '#E6F4EA' },
          { label: 'MORTGAGE LIABILITIES', val: `${compSummary.mortgageCount} Facilities (${formatGBP(compSummary.mortgageDebt)})`, color: '#DC2626', bg: '#FEF2F2' },
          { label: 'NET ENTITY EQUITY', val: formatGBP(compSummary.netEquity), color: '#4F46E5', bg: '#EEF2FF' },
        ];

        const cKpiW = (contentWidth - 4 * 6) / 5;
        const cKpiH = 36;
        const cKpiY = divY + 8;

        compKpis.forEach((kpi, kIdx) => {
          const kx = margin + kIdx * (cKpiW + 6);
          doc.roundedRect(kx, cKpiY, cKpiW, cKpiH, 5).fillAndStroke(kpi.bg, '#E2E8F0');
          doc.font('Helvetica-Bold').fontSize(6).fillColor('#64748B').text(kpi.label, kx + 6, cKpiY + 6, { width: cKpiW - 12 });
          doc.font('Helvetica-Bold').fontSize(8.5).fillColor(kpi.color).text(kpi.val, kx + 6, cKpiY + 18, { width: cKpiW - 12 });
        });

        // 3. Property Inventory & Rent Roll Table for this Single Company
        let currentY = cKpiY + cKpiH + 12;

        doc
          .font('Helvetica-Bold')
          .fontSize(9.5)
          .fillColor('#0F172A')
          .text(`${comp.name.toUpperCase()} — PROPERTY RENT ROLL & ASSET INVENTORY`, margin, currentY);

        currentY += 14;

        const propCols = [
          { label: 'No', width: 28, align: 'center' },
          { label: 'Property Address', width: 235, align: 'left' },
          { label: 'Asset Type', width: 85, align: 'center' },
          { label: 'Status', width: 75, align: 'center' },
          { label: 'Tenant Name', width: 175, align: 'left' },
          { label: 'Monthly Rent', width: 95, align: 'right' },
          { label: 'Annual Rent', width: 95, align: 'right' },
        ];

        const drawPropHeader = (y) => {
          doc.roundedRect(margin, y, contentWidth, 16, 3).fill('#F1F5F9');
          let px = margin + 4;
          propCols.forEach((col) => {
            doc
              .font('Helvetica-Bold')
              .fontSize(7)
              .fillColor('#0F172A')
              .text(col.label, px, y + 4, { width: col.width - 6, align: col.align });
            px += col.width;
          });
        };

        drawPropHeader(currentY);
        currentY += 18;

        let compTotalMonthlyRent = 0;
        let compTotalAnnualRent = 0;

        compProps.forEach((p, idx) => {
          if (currentY > pageHeight - 50) {
            doc.addPage();
            currentY = margin;
            drawPropHeader(currentY);
            currentY += 18;
          }

          const isOccupied = p.currentStatus === 'Occupied' || !!p.tenantName;
          const monthlyRent = Number(p.contractualRent || p.rent || 0);
          const annualRent = monthlyRent * 12;
          compTotalMonthlyRent += monthlyRent;
          compTotalAnnualRent += annualRent;

          doc.rect(margin, currentY, contentWidth, 14).fill(idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC');

          let px = margin + 4;

          // No
          doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#0F172A')
            .text(String(idx + 1), px, currentY + 3, { width: propCols[0].width - 6, align: 'center' });
          px += propCols[0].width;

          // Address
          doc.font('Helvetica').fontSize(6.5).fillColor('#0F172A')
            .text(p.name || p.address?.line1 || '-', px, currentY + 3, { width: propCols[1].width - 6, align: 'left' });
          px += propCols[1].width;

          // Type
          doc.font('Helvetica').fontSize(6).fillColor('#64748B')
            .text(p.propertyType || 'Residential', px, currentY + 3, { width: propCols[2].width - 6, align: 'center' });
          px += propCols[2].width;

          // Status
          doc.font('Helvetica-Bold').fontSize(6).fillColor(isOccupied ? '#059669' : '#64748B')
            .text(isOccupied ? 'Occupied' : 'Available', px, currentY + 3, { width: propCols[3].width - 6, align: 'center' });
          px += propCols[3].width;

          // Tenant
          doc.font(p.tenantName ? 'Helvetica' : 'Helvetica-Oblique').fontSize(6.5).fillColor(p.tenantName ? '#0F172A' : '#94A3B8')
            .text(p.tenantName || '— (Direct Available)', px, currentY + 3, { width: propCols[4].width - 6, align: 'left' });
          px += propCols[4].width;

          // Monthly Rent
          doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#059669')
            .text(formatGBP(monthlyRent), px, currentY + 3, { width: propCols[5].width - 6, align: 'right' });
          px += propCols[5].width;

          // Annual Rent
          doc.font('Helvetica').fontSize(6.5).fillColor('#0F172A')
            .text(formatGBP(annualRent), px, currentY + 3, { width: propCols[6].width - 6, align: 'right' });

          currentY += 15;
        });

        // Company Property Sub-Total Row (NO BLACK BACKGROUND)
        if (currentY > pageHeight - 50) {
          doc.addPage();
          currentY = margin;
        }
        doc.roundedRect(margin, currentY, contentWidth, 16, 3).fill('#EEF2FF');
        let totPx = margin + 4;
        doc.font('Helvetica-Bold').fontSize(7).fillColor('#0F172A')
          .text(`${comp.name.toUpperCase()} — TOTAL (${compProps.length} PROPERTIES)`, totPx, currentY + 4, {
            width: propCols[0].width + propCols[1].width + propCols[2].width + propCols[3].width + propCols[4].width - 6,
            align: 'left',
          });

        totPx += propCols[0].width + propCols[1].width + propCols[2].width + propCols[3].width + propCols[4].width;
        doc.font('Helvetica-Bold').fontSize(7).fillColor('#059669')
          .text(formatGBP(compTotalMonthlyRent), totPx, currentY + 4, { width: propCols[5].width - 6, align: 'right' });
        totPx += propCols[5].width;

        doc.font('Helvetica-Bold').fontSize(7).fillColor('#047857')
          .text(formatGBP(compTotalAnnualRent), totPx, currentY + 4, { width: propCols[6].width - 6, align: 'right' });

        currentY += 22;

        // 4. Company Mortgage Liabilities Schedule (if applicable)
        if (compMorts.length > 0) {
          if (currentY > pageHeight - 90) {
            doc.addPage();
            currentY = margin;
          }

          doc
            .font('Helvetica-Bold')
            .fontSize(9.5)
            .fillColor('#0F172A')
            .text(`${comp.name.toUpperCase()} — ACTIVE MORTGAGE LIABILITIES & LOAN REGISTER`, margin, currentY);

          currentY += 14;

          const mortCols = [
            { label: 'No', width: 28, align: 'center' },
            { label: 'Linked Property Asset', width: 235, align: 'left' },
            { label: 'Mortgage Lender', width: 145, align: 'left' },
            { label: 'Account Reference', width: 115, align: 'left' },
            { label: 'Rate', width: 55, align: 'center' },
            { label: 'Monthly Payment', width: 105, align: 'right' },
            { label: 'Outstanding Balance', width: 105, align: 'right' },
          ];

          const drawMortHeader = (y) => {
            doc.roundedRect(margin, y, contentWidth, 16, 3).fill('#F1F5F9');
            let mx = margin + 4;
            mortCols.forEach((col) => {
              doc
                .font('Helvetica-Bold')
                .fontSize(7)
                .fillColor('#0F172A')
                .text(col.label, mx, y + 4, { width: col.width - 6, align: col.align });
              mx += col.width;
            });
          };

          drawMortHeader(currentY);
          currentY += 18;

          let compTotalMortDebt = 0;
          let compTotalMortService = 0;

          compMorts.forEach((m, idx) => {
            if (currentY > pageHeight - 50) {
              doc.addPage();
              currentY = margin;
              drawMortHeader(currentY);
              currentY += 18;
            }

            const matchedProp = data.allProperties.find((p) => String(p._id) === String(m.propertyId));
            const payAmt = Number(m.expectedRepaymentAmount || 0);
            const balAmt = Number(m.outstandingPrincipalBalance || 0);
            compTotalMortService += payAmt;
            compTotalMortDebt += balAmt;

            doc.rect(margin, currentY, contentWidth, 14).fill(idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC');

            let mx = margin + 4;
            // No
            doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#0F172A')
              .text(String(idx + 1), mx, currentY + 3, { width: mortCols[0].width - 6, align: 'center' });
            mx += mortCols[0].width;

            // Property
            doc.font('Helvetica').fontSize(6.5).fillColor('#0F172A')
              .text(matchedProp?.name || matchedProp?.address?.line1 || 'Property Asset', mx, currentY + 3, { width: mortCols[1].width - 6, align: 'left' });
            mx += mortCols[1].width;

            // Lender
            doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#0F172A')
              .text(m.lenderName || '-', mx, currentY + 3, { width: mortCols[2].width - 6, align: 'left' });
            mx += mortCols[2].width;

            // Ref
            doc.font('Helvetica').fontSize(6.5).fillColor('#64748B')
              .text(m.accountReference || '-', mx, currentY + 3, { width: mortCols[3].width - 6, align: 'left' });
            mx += mortCols[3].width;

            // Rate
            doc.font('Helvetica').fontSize(6.5).fillColor('#0F172A')
              .text(`${m.interestRate || 0}%`, mx, currentY + 3, { width: mortCols[4].width - 6, align: 'center' });
            mx += mortCols[4].width;

            // Payment
            doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#059669')
              .text(formatGBP(payAmt), mx, currentY + 3, { width: mortCols[5].width - 6, align: 'right' });
            mx += mortCols[5].width;

            // Balance
            doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#DC2626')
              .text(formatGBP(balAmt), mx, currentY + 3, { width: mortCols[6].width - 6, align: 'right' });

            currentY += 15;
          });

          // Company Mortgage Sub-Total Row (NO BLACK BACKGROUND)
          if (currentY > pageHeight - 50) {
            doc.addPage();
            currentY = margin;
          }
          doc.roundedRect(margin, currentY, contentWidth, 16, 3).fill('#EEF2FF');
          let mTotPx = margin + 4;
          doc.font('Helvetica-Bold').fontSize(7).fillColor('#0F172A')
            .text(`${comp.name.toUpperCase()} — MORTGAGE SUB-TOTAL (${compMorts.length} FACILITIES)`, mTotPx, currentY + 4, {
              width: mortCols[0].width + mortCols[1].width + mortCols[2].width + mortCols[3].width + mortCols[4].width - 6,
              align: 'left',
            });

          mTotPx += mortCols[0].width + mortCols[1].width + mortCols[2].width + mortCols[3].width + mortCols[4].width;
          doc.font('Helvetica-Bold').fontSize(7).fillColor('#059669')
            .text(formatGBP(compTotalMortService), mTotPx, currentY + 4, { width: mortCols[5].width - 6, align: 'right' });
          mTotPx += mortCols[5].width;

          doc.font('Helvetica-Bold').fontSize(7).fillColor('#DC2626')
            .text(formatGBP(compTotalMortDebt), mTotPx, currentY + 4, { width: mortCols[6].width - 6, align: 'right' });
        } else {
          // Note if no mortgages
          doc.roundedRect(margin, currentY, contentWidth, 18, 3).fill('#F8FAFC');
          doc.font('Helvetica-Oblique').fontSize(7).fillColor('#64748B')
            .text('No active mortgage facility liabilities encumbering this corporate entity portfolio (100% Unencumbered Equity).', margin + 8, currentY + 5);
        }
      });

      // =====================================================================
      // 4. Two-Pass Running Footers (Page X of Y & Confidentiality Disclaimer)
      // =====================================================================
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

        const footerTitle = isSingleCompany
          ? `${targetCompany.name.toUpperCase()} • SINGLE CORPORATE PORTFOLIO AUDIT REPORT • CONFIDENTIAL`
          : 'PIXX TECHNOLOGIES UK • CONSOLIDATED GROUP PORTFOLIO AUDIT REGISTER • CONFIDENTIAL & PRIVILEGED';

        doc
          .font('Helvetica')
          .fontSize(6.5)
          .fillColor('#64748B')
          .text(footerTitle, margin, footerY, { align: 'left', width: contentWidth / 2 });

        doc.text(
          `Page ${i + 1} of ${range.count} • Master Group Statement Ref: PIXX-GRP-Q3-2026`,
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
}
