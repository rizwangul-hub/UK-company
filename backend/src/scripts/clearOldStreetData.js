import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import Voucher from '../models/Voucher.js';
import StatementImportBatch from '../models/StatementImportBatch.js';
import StatementImportRow from '../models/StatementImportRow.js';
import RentPayment from '../models/RentPayment.js';
import MortgagePayment from '../models/MortgagePayment.js';
import PropertyChargePayment from '../models/PropertyChargePayment.js';
import RentSchedule from '../models/RentSchedule.js';
import Account from '../models/Account.js';

async function clearOldStreetData() {
  await mongoose.connect(process.env.MONGO_URI);
  const companyId = 'old-street';

  console.log(`[Clear] Clearing all transactions and import history for company: "${companyId}"...`);

  const txRes = await Transaction.deleteMany({ companyId });
  console.log(`[Clear] Deleted Transactions: ${txRes.deletedCount}`);

  const vRes = await Voucher.deleteMany({ companyId });
  console.log(`[Clear] Deleted Vouchers: ${vRes.deletedCount}`);

  const rowRes = await StatementImportRow.deleteMany({ companyId });
  console.log(`[Clear] Deleted Statement Staging Rows: ${rowRes.deletedCount}`);

  const batchRes = await StatementImportBatch.deleteMany({ companyId });
  console.log(`[Clear] Deleted Statement Import Batches: ${batchRes.deletedCount}`);

  const rpRes = await RentPayment.deleteMany({ companyId });
  console.log(`[Clear] Deleted Rent Payments: ${rpRes.deletedCount}`);

  const mpRes = await MortgagePayment.deleteMany({ companyId });
  console.log(`[Clear] Deleted Mortgage Payments: ${mpRes.deletedCount}`);

  const cpRes = await PropertyChargePayment.deleteMany({ companyId });
  console.log(`[Clear] Deleted Property Charge Payments: ${cpRes.deletedCount}`);

  const rsRes = await RentSchedule.updateMany(
    { companyId },
    { $set: { paidAmount: 0, status: 'PENDING' } }
  );
  console.log(`[Clear] Reset Rent Schedules: ${rsRes.modifiedCount}`);

  // Reset Account balance to exact statement opening balance
  const OPENING_BALANCE = 59430.49;
  const accRes = await Account.updateMany(
    { companyId, name: /operating|main|current/i },
    { $set: { currentBalance: OPENING_BALANCE, openingBalance: OPENING_BALANCE } }
  );
  console.log(`[Clear] Reset Main Operating Account balance to £${OPENING_BALANCE}`);

  console.log('[Clear] Database successfully reset and primed for clean bank statement import.');
  await mongoose.disconnect();
}

clearOldStreetData().catch(console.error);
