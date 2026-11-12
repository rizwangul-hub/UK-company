import '../config/env.js';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import Property from '../models/Property.js';
import Unit from '../models/Unit.js';
import Tenant from '../models/Tenant.js';
import TenancyAgreement from '../models/TenancyAgreement.js';
import Transaction from '../models/Transaction.js';
import Mortgage from '../models/Mortgage.js';
import RentSchedule from '../models/RentSchedule.js';

async function check() {
  await connectDB();
  console.log('[DB] Connected to UK DB');

  const unitIds = [
    new mongoose.Types.ObjectId('6ad642dbb019f3c59a55a51d'), // 13 Clarence
    new mongoose.Types.ObjectId('6ad642dcb019f3c59a55a51e'), // 15 Clarence
    new mongoose.Types.ObjectId('6ad642ddb019f3c59a55a51f'), // 13A, 15A & 15B
  ];

  const txs = await Transaction.find({
    $or: [
      { unitId: { $in: unitIds } },
      { description: { $regex: /clarence/i } }
    ]
  }).lean();
  console.log(`Found ${txs.length} transactions for Clarence units:`);
  txs.forEach(t => console.log({
    id: t._id,
    desc: t.description,
    propId: t.propertyId,
    unitId: t.unitId,
    amt: t.amount,
    date: t.transactionDate
  }));

  const schedules = await RentSchedule.find({
    unitId: { $in: unitIds }
  }).lean();
  console.log(`\nFound ${schedules.length} rent schedules for Clarence units:`);
  schedules.forEach(s => console.log({
    id: s._id,
    unitId: s.unitId,
    propId: s.propertyId,
    billingMonth: s.billingMonth,
    rentDue: s.rentDue,
    status: s.status
  }));

  const mortgages = await Mortgage.find({
    $or: [
      { propertyId: new mongoose.Types.ObjectId('6acd0d854ccab36d6191c1be') },
      { propertyReference: { $regex: /clarence/i } }
    ]
  }).lean();
  console.log(`\nFound ${mortgages.length} mortgages for Clarence:`);
  mortgages.forEach(m => console.log({
    id: m._id,
    ref: m.mortgageReference,
    propId: m.propertyId,
    lender: m.lenderName,
    principal: m.originalLoanAmount
  }));

  await mongoose.disconnect();
}

check().catch(e => {
  console.error('[FATAL]', e);
  process.exit(1);
});
