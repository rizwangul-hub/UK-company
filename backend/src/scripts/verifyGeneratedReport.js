import ExcelJS from 'exceljs';

async function verifyGeneratedReport() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('C:\\Users\\HP\\Downloads\\Landlord_Report_Corrected.xlsx');

  console.log('Worksheets:', wb.worksheets.map(w => w.name));

  const ws1 = wb.getWorksheet('Rent Income Report');
  console.log('\n--- WS1: Rent Income Report ---');
  console.log('Row 1:', ws1.getCell('A1').value);
  console.log('Row 2:', ws1.getCell('A2').value);
  console.log('Row 3:', ws1.getCell('A3').value);
  console.log('Row 5 headers:', ws1.getRow(5).values.slice(1));
  console.log('Row 6 headers:', ws1.getRow(6).values.slice(1));
  console.log('Row 7 (sample property 1):', ws1.getRow(7).values.slice(1));
  console.log('Row 30 (Grand Total):', ws1.getRow(30).values.slice(1));

  const ws2 = wb.getWorksheet('Portfolio Summary');
  console.log('\n--- WS2: Portfolio Summary (NO UNITS) ---');
  console.log('Row 1:', ws2.getCell('A1').value);
  console.log('Row 3 headers:', ws2.getRow(3).values.slice(1));
  console.log('Row 4 (sample property 1):', ws2.getRow(4).values.slice(1));
  console.log('Row 27 (Grand Portfolio Total):', ws2.getRow(27).values.slice(1));
}

verifyGeneratedReport().catch(console.error);
