import ExcelJS from 'exceljs';

async function inspectSheet1() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('C:\\Users\\HP\\Downloads\\Landlord_Report.xlsx');
  const sheet = wb.getWorksheet('Rent Income Report');

  console.log('--- SHEET 1 MERGES ---');
  // inspect merges if any
  console.log(sheet.model.merges);

  console.log('\n--- SHEET 1 COLS ---');
  sheet.columns.forEach((c, idx) => {
    console.log(`Col ${idx + 1}: key=${c.key}, width=${c.width}`);
  });

  console.log('\n--- SHEET 1 ROWS 1-7 ---');
  for (let r = 1; r <= 7; r++) {
    const row = sheet.getRow(r);
    console.log(`\nRow ${r} (height: ${row.height}):`);
    for (let c = 1; c <= 12; c++) {
      const cell = row.getCell(c);
      console.log(`  C${c}: val=${JSON.stringify(cell.value)} | fill=${JSON.stringify(cell.fill?.fgColor || cell.fill?.bgColor || cell.fill)} | font=${cell.font?.name} ${cell.font?.size}pt bold:${cell.font?.bold} color:${JSON.stringify(cell.font?.color)} | align=${JSON.stringify(cell.alignment)} | border=${JSON.stringify(cell.border)}`);
    }
  }
}

inspectSheet1().catch(console.error);
