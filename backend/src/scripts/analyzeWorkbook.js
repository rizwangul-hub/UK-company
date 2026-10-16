import ExcelJS from 'exceljs';

async function analyzeStatement() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('C:\\Users\\HP\\Desktop\\Bank statment of company.xlsx');
  const ws = wb.worksheets[0];
  
  console.log('Sheet Name:', ws.name);
  console.log('Total Rows:', ws.rowCount);
  
  const headerRow = ws.getRow(4);
  const headers = [];
  headerRow.eachCell({ includeEmpty: true }, (c, col) => {
    headers[col] = String(c.value || '').trim();
  });
  console.log('Headers:', headers.filter(Boolean));
  
  const headsMap = {};
  const monthlyMap = {};
  const propertiesRent = {};
  const loanBreakdown = {};
  const mortgageBreakdown = {};
  
  let totalPayments = 0;
  let totalReceipts = 0;
  let rowCount = 0;
  let firstDate = null;
  let lastDate = null;
  let lastBalance = null;
  
  for (let r = 5; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const dateVal = row.getCell(1).value;
    if (!dateVal) continue;
    
    rowCount++;
    const date = new Date(dateVal);
    if (!firstDate || date < firstDate) firstDate = date;
    if (!lastDate || date > lastDate) lastDate = date;
    
    const memo = String(row.getCell(2).value || '').trim();
    const head = String(row.getCell(3).value || '').trim() || 'Uncategorized';
    const subHead = String(row.getCell(4).value || '').trim() || 'General';
    
    let payment = row.getCell(5).value;
    if (payment && typeof payment === 'object' && payment.result !== undefined) payment = payment.result;
    payment = payment ? parseFloat(payment) : 0;
    
    let receipt = row.getCell(6).value;
    if (receipt && typeof receipt === 'object' && receipt.result !== undefined) receipt = receipt.result;
    receipt = receipt ? parseFloat(receipt) : 0;
    
    let balance = row.getCell(7).value;
    if (balance && typeof balance === 'object' && balance.result !== undefined) balance = balance.result;
    balance = balance ? parseFloat(balance) : null;
    if (balance !== null) lastBalance = balance;
    
    totalPayments += payment;
    totalReceipts += receipt;
    
    // Head summary
    if (!headsMap[head]) headsMap[head] = { totalPayment: 0, totalReceipt: 0, count: 0, subHeads: {} };
    headsMap[head].count++;
    headsMap[head].totalPayment += payment;
    headsMap[head].totalReceipt += receipt;
    
    if (!headsMap[head].subHeads[subHead]) headsMap[head].subHeads[subHead] = { payment: 0, receipt: 0, count: 0 };
    headsMap[head].subHeads[subHead].count++;
    headsMap[head].subHeads[subHead].payment += payment;
    headsMap[head].subHeads[subHead].receipt += receipt;
    
    // Monthly summary
    const monthKey = isNaN(date.getTime()) ? 'Invalid Date' : date.toISOString().slice(0, 7);
    if (!monthlyMap[monthKey]) monthlyMap[monthKey] = { payments: 0, receipts: 0, count: 0 };
    monthlyMap[monthKey].count++;
    monthlyMap[monthKey].payments += payment;
    monthlyMap[monthKey].receipts += receipt;
    
    // Rent summary
    if (head.toLowerCase().includes('income') || subHead.toLowerCase().includes('rent')) {
      if (!propertiesRent[memo]) propertiesRent[memo] = { total: 0, count: 0 };
      propertiesRent[memo].total += receipt;
      propertiesRent[memo].count++;
    }
    
    // Mortgage breakdown
    if (head.toLowerCase().includes('interest') || memo.toLowerCase().includes('mortgage') || memo.toLowerCase().includes('together') || memo.toLowerCase().includes('interbay') || memo.toLowerCase().includes('quantum')) {
      if (!mortgageBreakdown[memo]) mortgageBreakdown[memo] = { total: 0, count: 0, subHeads: new Set() };
      mortgageBreakdown[memo].total += payment;
      mortgageBreakdown[memo].count++;
      mortgageBreakdown[memo].subHeads.add(subHead);
    }
    
    // Loan breakdown
    if (head.toLowerCase().includes('loan') || subHead.toLowerCase().includes('loan')) {
      const loanKey = memo || subHead;
      if (!loanBreakdown[loanKey]) loanBreakdown[loanKey] = { payment: 0, receipt: 0, count: 0, subHead };
      loanBreakdown[loanKey].count++;
      loanBreakdown[loanKey].payment += payment;
      loanBreakdown[loanKey].receipt += receipt;
    }
  }
  
  console.log('=== STATEMENT VERIFICATION SUMMARY ===');
  console.log('Total Parsed Transactions:', rowCount);
  console.log('Date Range:', firstDate ? firstDate.toISOString().slice(0, 10) : 'N/A', 'to', lastDate ? lastDate.toISOString().slice(0, 10) : 'N/A');
  console.log('Total Payments (Outflow): £' + totalPayments.toFixed(2));
  console.log('Total Receipts (Inflow):  £' + totalReceipts.toFixed(2));
  console.log('Last Recorded Balance:    £' + (lastBalance ? lastBalance.toFixed(2) : 'N/A'));
  
  const openingBal = 59430.49;
  const expectedClosing = openingBal + totalReceipts - totalPayments;
  console.log('Opening Balance:          £' + openingBal.toFixed(2));
  console.log('Calculated Closing Bal:   £' + expectedClosing.toFixed(2));
  console.log('Math Variance:            £' + (lastBalance ? (lastBalance - expectedClosing).toFixed(2) : 'N/A'));
  
  console.log('\n=== HEADS & SUB-HEADS BREAKDOWN ===');
  for (const [h, data] of Object.entries(headsMap)) {
    console.log(`\nHEAD: [${h}] (Rows: ${data.count})`);
    console.log(`  -> Payments (Out): £${data.totalPayment.toFixed(2)} | Receipts (In): £${data.totalReceipt.toFixed(2)} | Net: £${(data.totalReceipt - data.totalPayment).toFixed(2)}`);
    for (const [sh, sdata] of Object.entries(data.subHeads)) {
      console.log(`     * Sub-Head: ${sh.padEnd(30)} | Rows: ${String(sdata.count).padStart(3)} | Out: £${sdata.payment.toFixed(2).padStart(10)} | In: £${sdata.receipt.toFixed(2).padStart(10)}`);
    }
  }
  
  console.log('\n=== MONTHLY FINANCIAL TRAIL ===');
  for (const [m, mdata] of Object.entries(monthlyMap)) {
    console.log(`Month: ${m} | Rows: ${String(mdata.count).padStart(3)} | Inflow: £${mdata.receipts.toFixed(2).padStart(11)} | Outflow: £${mdata.payments.toFixed(2).padStart(11)} | Net: £${(mdata.receipts - mdata.payments).toFixed(2).padStart(11)}`);
  }
  
  console.log('\n=== RENT COLLECTIONS BY PROPERTY MEMO ===');
  for (const [p, pdata] of Object.entries(propertiesRent)) {
    console.log(`Property/Unit: ${p.padEnd(35)} | Transactions: ${String(pdata.count).padStart(2)} | Total Rent Collected: £${pdata.total.toFixed(2)}`);
  }
  
  console.log('\n=== MORTGAGE REPAYMENTS & INTEREST SERVICING ===');
  for (const [m, mdata] of Object.entries(mortgageBreakdown)) {
    console.log(`Lender/Facility: ${m.padEnd(35)} | Debits: ${String(mdata.count).padStart(2)} | Total Paid: £${mdata.total.toFixed(2)} | Properties: ${Array.from(mdata.subHeads).join(', ')}`);
  }
  
  console.log('\n=== LOANS & ADVANCES ===');
  for (const [l, ldata] of Object.entries(loanBreakdown)) {
    console.log(`Item: ${l.padEnd(35)} | Type: ${ldata.subHead.padEnd(25)} | Out: £${ldata.payment.toFixed(2).padStart(9)} | In: £${ldata.receipt.toFixed(2).padStart(9)}`);
  }
}

analyzeStatement().catch(console.error);
