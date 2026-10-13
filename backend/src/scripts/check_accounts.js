import mongoose from 'mongoose';
import '../config/env.js';
import Account from '../models/Account.js';

async function checkAccounts() {
  await mongoose.connect(process.env.MONGO_URI);
  const accs = await Account.find({}).lean();
  console.log(`\n=== ACCOUNTS IN UK DB (${accs.length}) ===`);
  accs.forEach(a => {
    console.log(`- ID: ${a._id} | Company: ${a.companyId} | Name: "${a.name}" | Type: ${a.accountType} | Bal: £${a.currentBalance}`);
  });
  await mongoose.disconnect();
}

checkAccounts().catch(console.error);
