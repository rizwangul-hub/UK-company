import ExcelJS from 'exceljs';

async function inspect() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('C:/Users/HP/Desktop/Bank statment of company.xlsx');
  const ws = wb.getWorksheet('Sheet1');
  console.log('Total rows:', ws.rowCount);
  for (let r = 1; r <= 20; r++) {
    const row = ws.getRow(r);
    const values = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      values[colNumber] = cell.value;
    });
    console.log(`Row ${r}:`, JSON.stringify(values.slice(1, 12)));
  }
}

inspect().catch(console.error);
