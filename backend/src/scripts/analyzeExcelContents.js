import ExcelJS from 'exceljs';

async function analyzeFile() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('C:/Users/HP/Desktop/Bank statment of company.xlsx');
  const ws = wb.getWorksheet('Sheet1');
  
  const heads = new Set();
  const subHeads = new Set();
  const headSubHeadMap = {};
  const memos = [];

  for (let r = 5; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const date = row.getCell(1).value;
    const memo = String(row.getCell(2).value || '').trim();
    const head = String(row.getCell(3).value || '').trim();
    const subHead = String(row.getCell(4).value || '').trim();
    const payments = row.getCell(5).value;
    const receipts = row.getCell(6).value;

    if (!memo && !head && !payments && !receipts) continue;

    heads.add(head);
    subHeads.add(subHead);
    if (!headSubHeadMap[head]) headSubHeadMap[head] = new Set();
    headSubHeadMap[head].add(subHead);

    memos.push({ r, memo, head, subHead, payments, receipts });
  }

  console.log('=== UNIQUE HEADS ===');
  console.log(Array.from(heads));

  console.log('\n=== HEAD -> SUBHEAD HIERARCHY IN EXCEL ===');
  for (const [h, subs] of Object.entries(headSubHeadMap)) {
    console.log(`[${h}]:`, Array.from(subs));
  }

  console.log('\nTotal transaction rows in Excel:', memos.length);
}

analyzeFile().catch(console.error);
