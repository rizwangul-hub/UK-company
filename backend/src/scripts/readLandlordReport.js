import ExcelJS from 'exceljs';

async function readExcel() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('C:\\Users\\HP\\Downloads\\Landlord_Report.xlsx');
  console.log('Worksheets in Landlord_Report.xlsx:');
  wb.eachSheet((sheet, id) => {
    console.log(`Sheet ${id}: "${sheet.name}" (${sheet.rowCount} rows, ${sheet.columnCount} cols)`);
  });

  for (const sheet of wb.worksheets) {
    console.log(`\n======================================================`);
    console.log(`SHEET: "${sheet.name}" (${sheet.rowCount} rows, ${sheet.columnCount} columns)`);
    console.log(`======================================================`);
    for (let r = 1; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      const vals = Array.isArray(row.values) ? row.values.slice(1) : row.values;
      if (vals && vals.some(v => v !== null && v !== undefined && v !== '')) {
        console.log(`R${r}:`, JSON.stringify(vals));
      }
    }
  }
}

readExcel().catch(console.error);
