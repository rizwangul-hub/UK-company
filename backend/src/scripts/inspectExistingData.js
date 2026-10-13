import '../config/env.js';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';

async function inspectData() {
  await connectDB();
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  console.log('======================================================');
  console.log(`CURRENT UK DATABASE INSPECTION: ${mongoose.connection.name}`);
  console.log('======================================================');
  
  for (const c of collections) {
    const col = db.collection(c.name);
    const count = await col.countDocuments();
    console.log(`\n[Collection]: ${c.name} (${count} documents)`);
    if (count > 0 && count <= 10) {
      const docs = await col.find({}).toArray();
      for (const d of docs) {
        console.log(`  - ID: ${d._id}`);
        if (d.name) console.log(`    name: ${d.name}`);
        if (d.propertyCode) console.log(`    propertyCode: ${d.propertyCode}`);
        if (d.ownershipEntity) console.log(`    ownershipEntity: ${d.ownershipEntity}`);
        if (d.voucherNumber) console.log(`    voucherNumber: ${d.voucherNumber}`);
        if (d.voucherType) console.log(`    voucherType: ${d.voucherType}`);
        if (d.accountType) console.log(`    accountType: ${d.accountType}`);
        if (d.companyId) console.log(`    companyId: ${d.companyId}`);
        else console.log(`    companyId: <NONE>`);
      }
    } else if (count > 10) {
      const withCompany = await col.countDocuments({ companyId: { $exists: true, $ne: null } });
      const withoutCompany = await col.countDocuments({ $or: [{ companyId: { $exists: false } }, { companyId: null }] });
      console.log(`    With companyId: ${withCompany}`);
      console.log(`    Without companyId: ${withoutCompany}`);
    }
  }
  console.log('\n======================================================');
  process.exit(0);
}

inspectData().catch((err) => {
  console.error('Inspection failed:', err);
  process.exit(1);
});
