import ExcelJS from 'exceljs';

async function inspectHeaders() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('C:\\Users\\HP\\Downloads\\Landlord_Report.xlsx');
  const sheet = wb.getWorksheet('Rent Income Report');

  console.log('--- SHEET 1 MERGES ---', sheet.model.merges);

  for (let r = 1; r <= 6; r++) {
    const row = sheet.getRow(r);
    console.log(`\nRow ${r}:`);
    for (let c = 1; c <= 12; c++) {
      const cell = row.getCell(c);
      if (cell.value) {
        console.log(`  C${c}: val="${cell.value}" | fill=${JSON.stringify(cell.fill)} | font=${JSON.stringify(cell.font)}`);
      }
    }
  }

  const sheet2 = wb.getWorksheet('Portfolio Summary');
  console.log('\n--- SHEET 2 MERGES ---', sheet2.model.merges);
  for (let r = 1; r <= 4; r++) {
    const row = sheet2.getRow(r);
    console.log(`\nSheet 2 Row ${r}:`);
    for (let c = 1; c <= 8; c++) {
      const cell = row.getCell(c);
      if (cell.value) {
        console.log(`  C${c}: val="${cell.value}" | fill=${JSON.stringify(cell.fill)} | font=${JSON.stringify(cell.font)}`);
      }
    }
  }
}

inspectHeaders().catch(console.error);
