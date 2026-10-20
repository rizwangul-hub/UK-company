import ExcelJS from 'exceljs';
import mongoose from 'mongoose';
import '../config/env.js';
import Property from '../models/Property.js';
import RentPayment from '../models/RentPayment.js';
import RentSchedule from '../models/RentSchedule.js';

// Exact definition of the 23 Old Street direct properties
export const OLD_STREET_PROPERTIES = [
  { no: 1, name: '12 Alexandra Street', rent: 925, mFee: -50, dueDate: '1st', type: 'Commercial', status: 'Occupied', tenant: 'Danial Butt', jul: { date: '01/07/2026', amt: 925 }, aug: { date: '01/08/2026', amt: 925 }, sep: { date: '10/09/2026', amt: 925 }, dueHistorical: 11100, received: 925 },
  { no: 2, name: '26 Calarane Road -shop', rent: 1667, mFee: -50, dueDate: '1st', type: 'Commercial', status: 'Occupied', tenant: 'Danial Butt', jul: { date: '01/07/2026', amt: 1667 }, aug: { date: '01/08/2026', amt: 1667 }, sep: { date: '01/09/2026', amt: 1667 }, dueHistorical: 15003, received: 1667 },
  { no: 3, name: '62A Orsett Road', rent: 1600, mFee: -50, dueDate: '1st', type: 'Residential', status: 'Available', tenant: '— (Direct Asset Available)', jul: { date: '-', amt: 0 }, aug: { date: '-', amt: 0 }, sep: { date: '-', amt: 0 }, dueHistorical: 8000, received: 0 },
  { no: 4, name: '26 Calarane Road -flat', rent: 1500, mFee: -50, dueDate: '1st', type: 'Residential', status: 'Available', tenant: '— (Direct Asset Available)', jul: { date: '-', amt: 0 }, aug: { date: '-', amt: 0 }, sep: { date: '-', amt: 0 }, dueHistorical: 0, received: 0 },
  { no: 5, name: '7 Vansittart Street', rent: 1200, mFee: -50, dueDate: '1st', type: 'Residential', status: 'Occupied', tenant: 'CENTENNIAL PROPERTY LTD', jul: { date: '01/07/2026', amt: 1200 }, aug: { date: '01/08/2026', amt: 1200 }, sep: { date: '01/09/2026', amt: 1200 }, dueHistorical: 10800, received: 0 },
  { no: 6, name: '73 Lakewalk', rent: 1550, mFee: -50, dueDate: '1st', type: 'Residential', status: 'Available', tenant: '— (Direct Asset Available)', jul: { date: '-', amt: 0 }, aug: { date: '-', amt: 0 }, sep: { date: '-', amt: 0 }, dueHistorical: 0, received: 0 },
  { no: 7, name: '31 Morley Avenue', rent: 2600, mFee: -50, dueDate: '1st', type: 'Residential', status: 'Available', tenant: '— (Direct Asset Available)', jul: { date: '-', amt: 0 }, aug: { date: '-', amt: 0 }, sep: { date: '-', amt: 0 }, dueHistorical: 0, received: 0 },
  { no: 8, name: '62 Orset Road', rent: 2000, mFee: -50, dueDate: '1st', type: 'Commercial', status: 'Occupied', tenant: 'CLAUDIA JOHANNA LUNA & WILMER LUNA PENUELA', jul: { date: '01/07/2026', amt: 2000 }, aug: { date: '01/08/2026', amt: 2000 }, sep: { date: '01/09/2026', amt: 2000 }, dueHistorical: 18000, received: 0 },
  { no: 9, name: '127 Southend Road', rent: 1667, mFee: -50, dueDate: '1st', type: 'Commercial', status: 'Occupied', tenant: 'PENNS INC.LTD', jul: { date: '01/07/2026', amt: 1667 }, aug: { date: '01/08/2026', amt: 1667 }, sep: { date: '01/09/2026', amt: 2000 }, dueHistorical: 15003, received: 2000 },
  { no: 10, name: '65 Lansbury Avenue', rent: 2700, mFee: -50, dueDate: '1st', type: 'Residential', status: 'Available', tenant: '— (Direct Asset Available)', jul: { date: '-', amt: 0 }, aug: { date: '-', amt: 0 }, sep: { date: '-', amt: 0 }, dueHistorical: 0, received: 0 },
  { no: 11, name: '124 Millard Terrace', rent: 1650, mFee: -50, dueDate: '1st', type: 'Residential', status: 'Occupied', tenant: 'SHOUKAT ALI & REHANA SHOUKAT', jul: { date: '01/07/2026', amt: 1650 }, aug: { date: '01/08/2026', amt: 1650 }, sep: { date: '01/09/2026', amt: 1650 }, dueHistorical: 14850, received: 0 },
  { no: 12, name: '13 A ,15 A & 15 B Claracne Road', rent: 4100, mFee: -50, dueDate: '1st', type: 'Commercial', status: 'Occupied', tenant: 'SUAVIDA LTD', jul: { date: '-', amt: 0 }, aug: { date: '-', amt: 0 }, sep: { date: '14/09/2026', amt: 3810 }, dueHistorical: 12300, received: 3810 },
  { no: 13, name: '82 COMO STREET', rent: 2500, mFee: -50, dueDate: '1st', type: 'Residential', status: 'Available', tenant: '— (Direct Asset Available)', jul: { date: '-', amt: 0 }, aug: { date: '-', amt: 0 }, sep: { date: '-', amt: 0 }, dueHistorical: 0, received: 0 },
  { no: 14, name: '12A,12B, 12C, 12D Alexandra Street-', rent: 4500, mFee: -50, dueDate: '1st', type: 'Residential', status: 'Available', tenant: '— (Direct Asset Available)', jul: { date: '-', amt: 0 }, aug: { date: '-', amt: 0 }, sep: { date: '-', amt: 0 }, dueHistorical: 0, received: 0 },
  { no: 15, name: '10A-12A Cromwell Road', rent: 3500, mFee: -50, dueDate: '1st', type: 'Residential', status: 'Available', tenant: '— (Direct Asset Available)', jul: { date: '-', amt: 0 }, aug: { date: '-', amt: 0 }, sep: { date: '-', amt: 0 }, dueHistorical: 0, received: 0 },
  { no: 16, name: '15 Claracne Road', rent: 2667, mFee: -50, dueDate: '1st', type: 'Commercial', status: 'Occupied', tenant: 'Ivape Grays Limited (Kaled Ahmed Anwar)', jul: { date: '01/07/2026', amt: 2667 }, aug: { date: '01/08/2026', amt: 2667 }, sep: { date: '01/09/2026', amt: 2667 }, dueHistorical: 24003, received: 0 },
  { no: 17, name: '13 Clarance Road', rent: 2167, mFee: -50, dueDate: '1st', type: 'Commercial', status: 'Occupied', tenant: 'Khalid Aziz Mustafa', jul: { date: '01/07/2026', amt: 2167 }, aug: { date: '01/08/2026', amt: 2167 }, sep: { date: '01/09/2026', amt: 2167 }, dueHistorical: 19503, received: 0 },
  { no: 18, name: '127 Southend Road (Resi)', rent: 1200, mFee: -50, dueDate: '1st', type: 'Residential', status: 'Available', tenant: '— (Direct Asset Available)', jul: { date: '-', amt: 0 }, aug: { date: '-', amt: 0 }, sep: { date: '-', amt: 0 }, dueHistorical: 0, received: 0 },
  { no: 19, name: '12 Cromwell Road Ground Floor', rent: 1550, mFee: -50, dueDate: '1st', type: 'Residential', status: 'Available', tenant: '— (Direct Asset Available)', jul: { date: '-', amt: 0 }, aug: { date: '-', amt: 0 }, sep: { date: '-', amt: 0 }, dueHistorical: 0, received: 0 },
  { no: 20, name: '10 B Cromwell Road Ground Floor', rent: 1400, mFee: -50, dueDate: '1st', type: 'Residential', status: 'Available', tenant: '— (Direct Asset Available)', jul: { date: '-', amt: 0 }, aug: { date: '-', amt: 0 }, sep: { date: '-', amt: 0 }, dueHistorical: 0, received: 0 },
  { no: 21, name: '12 B Cromwell Road Ground Floor', rent: 1450, mFee: -50, dueDate: '1st', type: 'Residential', status: 'Available', tenant: '— (Direct Asset Available)', jul: { date: '-', amt: 0 }, aug: { date: '-', amt: 0 }, sep: { date: '-', amt: 0 }, dueHistorical: 0, received: 0 },
  { no: 22, name: '10 Cromwell Road Ground Floor', rent: 1550, mFee: -50, dueDate: '1st', type: 'Residential', status: 'Occupied', tenant: 'MRS IFEOMA IKHOYAMHE', jul: { date: '01/07/2026', amt: 1550 }, aug: { date: '01/08/2026', amt: 1550 }, sep: { date: '01/09/2026', amt: 1550 }, dueHistorical: 12400, received: 0 },
  { no: 23, name: '104 Pretoria Road', rent: 2600, mFee: -50, dueDate: '1st', type: 'Other', status: 'Available', tenant: '— (Direct Asset Available)', jul: { date: '-', amt: 0 }, aug: { date: '-', amt: 0 }, sep: { date: '-', amt: 0 }, dueHistorical: 0, received: 0 },
];

export async function createOfficialLandlordWorkbook(
  companyName = 'Old Street Holdings Ltd',
  properties = OLD_STREET_PROPERTIES
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Pixx Property Finance';
  wb.lastModifiedBy = 'Pixx Property Finance';
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
  // WORKSHEET 1: Rent Income Report
  // =========================================================================
  const ws1 = wb.addWorksheet('Rent Income Report', {
    views: [{ showGridLines: true }],
  });

  ws1.columns = [
    { key: 'no', width: 6 },
    { key: 'address', width: 38 },
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

  // Header Titles
  ws1.mergeCells('A1:L1');
  const r1 = ws1.getCell('A1');
  r1.value = companyName;
  r1.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF0F172A' } };
  r1.alignment = { horizontal: 'center', vertical: 'middle' };
  ws1.getRow(1).height = 28;

  ws1.mergeCells('A2:L2');
  const r2 = ws1.getCell('A2');
  r2.value = 'RENT INCOME REPORT';
  r2.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF1E293B' } };
  r2.alignment = { horizontal: 'center', vertical: 'middle' };
  ws1.getRow(2).height = 22;

  ws1.mergeCells('A3:L3');
  const r3 = ws1.getCell('A3');
  r3.value = 'Sep-26 (Q3 Statement: Jul-26 to Sep-26)';
  r3.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF64748B' } };
  r3.alignment = { horizontal: 'center', vertical: 'middle' };
  ws1.getRow(3).height = 18;

  ws1.getRow(4).height = 8; // Spacer

  // Header Table: Rows 5 & 6
  ws1.getRow(5).height = 24;
  ws1.getRow(6).height = 22;

  ws1.mergeCells('A5:A6');
  ws1.getCell('A5').value = 'No';

  ws1.mergeCells('B5:B6');
  ws1.getCell('B5').value = 'Property Address';

  ws1.mergeCells('C5:C6');
  ws1.getCell('C5').value = 'Rent';

  ws1.mergeCells('D5:D6');
  ws1.getCell('D5').value = 'M. Fee';

  ws1.mergeCells('E5:E6');
  ws1.getCell('E5').value = 'Due Date';

  ws1.mergeCells('F5:F6');
  ws1.getCell('F5').value = 'Net Rent\nReceivable';

  ws1.mergeCells('G5:H5');
  ws1.getCell('G5').value = 'Jul-26';
  ws1.getCell('G6').value = 'Date';
  ws1.getCell('H6').value = 'Amount';

  ws1.mergeCells('I5:J5');
  ws1.getCell('I5').value = 'Aug-26';
  ws1.getCell('I6').value = 'Date';
  ws1.getCell('J6').value = 'Amount';

  ws1.mergeCells('K5:L5');
  ws1.getCell('K5').value = 'Sep-26';
  ws1.getCell('K6').value = 'Date';
  ws1.getCell('L6').value = 'Amount';

  for (let r = 5; r <= 6; r++) {
    const row = ws1.getRow(r);
    for (let c = 1; c <= 12; c++) {
      const cell = row.getCell(c);
      cell.border = headerBorder;
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
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

  // Populate direct properties
  let startR = 7;
  for (let idx = 0; idx < properties.length; idx++) {
    const p = properties[idx];
    const rNum = startR + idx;
    const row = ws1.getRow(rNum);
    row.height = 22;

    row.getCell(1).value = p.no;
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(1).font = { name: 'Calibri', size: 10, bold: true };

    row.getCell(2).value = p.name;
    row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(2).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };

    row.getCell(3).value = p.rent;
    row.getCell(3).numFmt = '£#,##0.00';
    row.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(3).font = { name: 'Calibri', size: 10 };

    row.getCell(4).value = p.mFee;
    row.getCell(4).numFmt = '£#,##0.00;[Red]-£#,##0.00;"-"';
    row.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(4).font = { name: 'Calibri', size: 10, color: { argb: 'FFDC2626' } };

    row.getCell(5).value = p.dueDate;
    row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(5).font = { name: 'Calibri', size: 10, bold: true };
    row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF08A' } };

    // Dynamic Excel formula: Rent + M. Fee
    row.getCell(6).value = { formula: `C${rNum}+D${rNum}` };
    row.getCell(6).numFmt = '£#,##0.00';
    row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(6).font = { name: 'Calibri', size: 10, bold: true };

    // Jul-26
    row.getCell(7).value = p.jul?.date || '-';
    row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(7).font = { name: 'Calibri', size: 9 };

    row.getCell(8).value = p.jul?.amt || 0;
    row.getCell(8).numFmt = '£#,##0.00';
    row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(8).font = { name: 'Calibri', size: 10 };

    // Aug-26
    row.getCell(9).value = p.aug?.date || '-';
    row.getCell(9).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(9).font = { name: 'Calibri', size: 9 };

    row.getCell(10).value = p.aug?.amt || 0;
    row.getCell(10).numFmt = '£#,##0.00';
    row.getCell(10).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(10).font = { name: 'Calibri', size: 10 };

    // Sep-26
    row.getCell(11).value = p.sep?.date || '-';
    row.getCell(11).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(11).font = { name: 'Calibri', size: 9 };

    row.getCell(12).value = p.sep?.amt || 0;
    row.getCell(12).numFmt = '£#,##0.00';
    row.getCell(12).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(12).font = { name: 'Calibri', size: 10 };

    // Borders & zebra fills
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
  }

  // Row Grand Total Income
  const endDataR = startR + properties.length - 1;
  const totR = endDataR + 1;
  const totRow = ws1.getRow(totR);
  totRow.height = 26;

  ws1.mergeCells(`A${totR}:B${totR}`);
  const totCell = ws1.getCell(`A${totR}`);
  totCell.value = 'Grand Total Income';
  totCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } };
  totCell.alignment = { horizontal: 'center', vertical: 'middle' };

  totRow.getCell(3).value = { formula: `SUM(C${startR}:C${endDataR})` };
  totRow.getCell(3).numFmt = '£#,##0.00';

  totRow.getCell(4).value = { formula: `SUM(D${startR}:D${endDataR})` };
  totRow.getCell(4).numFmt = '£#,##0.00;[Red]-£#,##0.00;"-"';
  totRow.getCell(4).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFDC2626' } };

  totRow.getCell(5).value = '';

  totRow.getCell(6).value = { formula: `SUM(F${startR}:F${endDataR})` };
  totRow.getCell(6).numFmt = '£#,##0.00';

  totRow.getCell(7).value = '';
  totRow.getCell(8).value = { formula: `SUM(H${startR}:H${endDataR})` };
  totRow.getCell(8).numFmt = '£#,##0.00';

  totRow.getCell(9).value = '';
  totRow.getCell(10).value = { formula: `SUM(J${startR}:J${endDataR})` };
  totRow.getCell(10).numFmt = '£#,##0.00';

  totRow.getCell(11).value = '';
  totRow.getCell(12).value = { formula: `SUM(L${startR}:L${endDataR})` };
  totRow.getCell(12).numFmt = '£#,##0.00';

  for (let c = 1; c <= 12; c++) {
    const cell = totRow.getCell(c);
    cell.border = totalBorder;
    cell.font = cell.font || { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } };
    cell.alignment = cell.alignment || { horizontal: 'right', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  }

  // =========================================================================
  // WORKSHEET 2: Portfolio Summary (DIRECT PROPERTY OWNERSHIP - NO UNITS)
  // =========================================================================
  const ws2 = wb.addWorksheet('Portfolio Summary', {
    views: [{ showGridLines: true }],
  });

  ws2.columns = [
    { key: 'no', width: 6 },
    { key: 'name', width: 38 },
    { key: 'type', width: 16 },
    { key: 'status', width: 16 },
    { key: 'tenant', width: 38 },
    { key: 'monthlyRent', width: 18 },
    { key: 'annualRent', width: 18 },
    { key: 'rentDue', width: 18 },
    { key: 'received', width: 18 },
    { key: 'arrears', width: 20 },
  ];

  // Header Banner
  ws2.mergeCells('A1:J1');
  const s2Title = ws2.getCell('A1');
  s2Title.value = `${companyName} - DIRECT PROPERTY PORTFOLIO & FINANCIAL SUMMARY`;
  s2Title.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  s2Title.alignment = { horizontal: 'center', vertical: 'middle' };
  s2Title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF04A26F' } }; // Deep Emerald
  ws2.getRow(1).height = 28;

  ws2.getRow(2).height = 8; // Spacer

  // Column Headers (NO UNITS)
  ws2.getRow(3).height = 24;
  const s2Headers = [
    'No',
    'Property Address',
    'Asset Type',
    'Occupancy Status',
    'Tenant Name',
    'Contractual Rent (£)',
    'Annual Rent Roll (£)',
    'Total Rent Due (£)',
    'Rent Received (£)',
    'Outstanding Arrears (£)',
  ];

  s2Headers.forEach((h, idx) => {
    const cell = ws2.getRow(3).getCell(idx + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }; // Executive Slate
    cell.alignment = {
      horizontal: idx === 0 || idx === 2 || idx === 3 ? 'center' : idx >= 5 ? 'right' : 'left',
      vertical: 'middle',
    };
    cell.border = headerBorder;
  });

  // Data Rows
  let s2StartR = 4;
  for (let idx = 0; idx < properties.length; idx++) {
    const p = properties[idx];
    const rNum = s2StartR + idx;
    const row = ws2.getRow(rNum);
    row.height = 22;

    const isOccupied = p.status === 'Occupied';

    row.getCell(1).value = p.no;
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(1).font = { name: 'Calibri', size: 10, bold: true };

    row.getCell(2).value = p.name;
    row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(2).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };

    row.getCell(3).value = p.type;
    row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(3).font = { name: 'Calibri', size: 10 };

    row.getCell(4).value = p.status;
    row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(4).font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: { argb: isOccupied ? 'FF059669' : 'FF64748B' },
    };

    row.getCell(5).value = p.tenant;
    row.getCell(5).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(5).font = {
      name: 'Calibri',
      size: 10,
      italic: !isOccupied,
      color: { argb: isOccupied ? 'FF0F172A' : 'FF94A3B8' },
    };

    row.getCell(6).value = p.rent;
    row.getCell(6).numFmt = '£#,##0.00';
    row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(6).font = { name: 'Calibri', size: 10, bold: true };

    // Annual Rent Formula: =F{row}*12
    row.getCell(7).value = { formula: `F${rNum}*12` };
    row.getCell(7).numFmt = '£#,##0.00';
    row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(7).font = { name: 'Calibri', size: 10 };

    row.getCell(8).value = p.dueHistorical;
    row.getCell(8).numFmt = '£#,##0.00';
    row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(8).font = { name: 'Calibri', size: 10 };

    row.getCell(9).value = p.received;
    row.getCell(9).numFmt = '£#,##0.00';
    row.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(9).font = {
      name: 'Calibri',
      size: 10,
      bold: p.received > 0,
      color: { argb: p.received > 0 ? 'FF059669' : 'FF64748B' },
    };

    // Arrears Formula: =MAX(0, H{row}-I{row})
    row.getCell(10).value = { formula: `MAX(0, H${rNum}-I${rNum})` };
    row.getCell(10).numFmt = '£#,##0.00';
    row.getCell(10).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(10).font = {
      name: 'Calibri',
      size: 10,
      bold: true,
      color: { argb: 'FFDC2626' },
    };

    for (let c = 1; c <= 10; c++) {
      row.getCell(c).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC' },
      };
      row.getCell(c).border = thinBorder;
    }
  }

  // Row Grand Portfolio Total
  const s2EndDataR = s2StartR + properties.length - 1;
  const s2TotR = s2EndDataR + 1;
  const s2TotRow = ws2.getRow(s2TotR);
  s2TotRow.height = 26;

  ws2.mergeCells(`A${s2TotR}:E${s2TotR}`);
  const s2TotLabel = ws2.getCell(`A${s2TotR}`);
  s2TotLabel.value = `Grand Portfolio Total (${properties.length} Direct Properties)`;
  s2TotLabel.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } };
  s2TotLabel.alignment = { horizontal: 'center', vertical: 'middle' };

  s2TotRow.getCell(6).value = { formula: `SUM(F${s2StartR}:F${s2EndDataR})` };
  s2TotRow.getCell(6).numFmt = '£#,##0.00';

  s2TotRow.getCell(7).value = { formula: `SUM(G${s2StartR}:G${s2EndDataR})` };
  s2TotRow.getCell(7).numFmt = '£#,##0.00';

  s2TotRow.getCell(8).value = { formula: `SUM(H${s2StartR}:H${s2EndDataR})` };
  s2TotRow.getCell(8).numFmt = '£#,##0.00';

  s2TotRow.getCell(9).value = { formula: `SUM(I${s2StartR}:I${s2EndDataR})` };
  s2TotRow.getCell(9).numFmt = '£#,##0.00';
  s2TotRow.getCell(9).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF059669' } };

  s2TotRow.getCell(10).value = { formula: `SUM(J${s2StartR}:J${s2EndDataR})` };
  s2TotRow.getCell(10).numFmt = '£#,##0.00';
  s2TotRow.getCell(10).font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFDC2626' } };

  for (let c = 1; c <= 10; c++) {
    const cell = s2TotRow.getCell(c);
    cell.border = totalBorder;
    cell.font = cell.font || { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } };
    cell.alignment = cell.alignment || { horizontal: 'right', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  }

  return wb;
}

// Generate files
async function execute() {
  try {
    const wb = await createOfficialLandlordWorkbook('Old Street Holdings Ltd');

    // 1. Save to Landlord_Report_Corrected.xlsx
    const correctedPath = 'C:\\Users\\HP\\Downloads\\Landlord_Report_Corrected.xlsx';
    await wb.xlsx.writeFile(correctedPath);
    console.log(`✓ Saved corrected report to: ${correctedPath}`);

    // 2. Try overwriting original Landlord_Report.xlsx
    const originalPath = 'C:\\Users\\HP\\Downloads\\Landlord_Report.xlsx';
    try {
      await wb.xlsx.writeFile(originalPath);
      console.log(`✓ Also successfully updated original: ${originalPath}`);
    } catch (err) {
      if (err.code === 'EBUSY') {
        console.log(`[Notice]: "${originalPath}" is open in Excel. Saved as "${correctedPath}".`);
      } else {
        console.error('Error saving original:', err);
      }
    }
    process.exit(0);
  } catch (err) {
    console.error('Fatal execution error:', err);
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('generateLandlordReportFile.js')) {
  execute();
}
