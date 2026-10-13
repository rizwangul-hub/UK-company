import ExcelJS from 'exceljs';

async function inspectStyles() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('C:\\Users\\HP\\Downloads\\Landlord_Report.xlsx');

  for (const sheet of wb.worksheets) {
    console.log(`\n======================================================`);
    console.log(`SHEET: "${sheet.name}"`);
    console.log(`Columns count: ${sheet.columnCount}, Rows count: ${sheet.rowCount}`);
    console.log(`Column widths:`, sheet.columns?.map(c => ({ key: c.key, width: c.width })));
    
    // Inspect headers rows (R1 to R7)
    for (let r = 1; r <= Math.min(10, sheet.rowCount); r++) {
      const row = sheet.getRow(r);
      const cellsInfo = [];
      row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        cellsInfo.push({
          col: colNumber,
          val: cell.value,
          fill: cell.fill,
          font: cell.font,
          align: cell.alignment,
          numFmt: cell.numFmt,
        });
      });
      console.log(`Row ${r}:`, JSON.stringify(cellsInfo, null, 2));
    }
  }
}

inspectStyles().catch(console.error);
