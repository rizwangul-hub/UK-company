import ExcelJS from 'exceljs';

async function checkEnd() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('C:/Users/HP/Desktop/Bank statment of company.xlsx');
  const ws = wb.getWorksheet('Sheet1');
  console.log('Total rows:', ws.rowCount);
  for (let r = 670; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const vals = [];
    row.eachCell({ includeEmpty: true }, (c, col) => vals[col] = c.value);
    console.log(`Row ${r}:`, JSON.stringify(vals.slice(1, 10)));
  }
}

checkEnd().catch(console.error);
