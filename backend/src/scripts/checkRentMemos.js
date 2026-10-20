import ExcelJS from 'exceljs';

async function checkRentMemos() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('C:/Users/HP/Desktop/Bank statment of company.xlsx');
  const ws = wb.getWorksheet('Sheet1');
  
  const rentMemos = new Set();
  const loanMemos = new Set();

  for (let r = 5; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const memo = String(row.getCell(2).value || '').trim();
    const head = String(row.getCell(3).value || '').trim();
    const subHead = String(row.getCell(4).value || '').trim();

    if (head === 'Income' && subHead === 'Rent') {
      rentMemos.add(memo);
    }
    if (head === 'Loan') {
      loanMemos.add(`${memo} -> Sub: ${subHead}`);
    }
  }

  console.log('=== RENT MEMOS ===');
  console.log(Array.from(rentMemos));

  console.log('\n=== LOAN MEMOS ===');
  console.log(Array.from(loanMemos));
}

checkRentMemos().catch(console.error);
