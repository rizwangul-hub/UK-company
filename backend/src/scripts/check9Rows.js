import dotenv from 'dotenv';
dotenv.config();

import ExcelJS from 'exceljs';

async function check9() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('C:/Users/HP/Desktop/Bank statment of company.xlsx');
  const ws = wb.getWorksheet('Sheet1');

  for (let r = 5; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const memo = String(row.getCell(2).value || '').trim();
    const head = String(row.getCell(3).value || '').trim();
    const subHead = String(row.getCell(4).value || '').trim();
    const payments = Number(row.getCell(5).value) || 0;
    const receipts = Number(row.getCell(6).value) || 0;

    const normHead = head.toLowerCase();
    const isRent = normHead.includes('income') && subHead.toLowerCase().includes('rent');
    const isInterest = normHead.includes('interest');
    const isLoan = normHead.includes('loan');
    const isAdmin = normHead.includes('admin');

    if (!isRent && !isInterest && !isLoan && !isAdmin) {
      console.log(`Row ${r}: Memo="${memo}", Head="${head}", SubHead="${subHead}", Out=${payments}, In=${receipts}`);
    }
  }
}

check9().catch(console.error);
