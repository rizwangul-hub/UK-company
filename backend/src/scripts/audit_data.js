import mongoose from 'mongoose';
import '../config/env.js';

async function audit() {
  await mongoose.connect(process.env.MONGO_URI);

  console.log('\n--- PROPERTY DOCUMENTS (3 docs) ---');
  const docs = await mongoose.connection.db.collection('propertydocuments').find({}).toArray();
  console.log(JSON.stringify(docs, null, 2));

  console.log('\n--- PROPERTY CHARGE CONFIGS (4 docs) ---');
  const configs = await mongoose.connection.db.collection('propertychargeconfigs').find({}).toArray();
  console.log(JSON.stringify(configs, null, 2));

  console.log('\n--- SERVICE CHARGE PAYEES (1 doc) ---');
  const payees = await mongoose.connection.db.collection('servicechargepayees').find({}).toArray();
  console.log(JSON.stringify(payees, null, 2));

  console.log('\n--- APPLIANCES (2 docs) ---');
  const appliances = await mongoose.connection.db.collection('appliances').find({}).toArray();
  console.log(JSON.stringify(appliances, null, 2));

  console.log('\n--- PROPERTIES SAMPLE (5 docs) ---');
  const props = await mongoose.connection.db.collection('properties').find({}).limit(5).toArray();
  for (const p of props) {
    console.log(`- ${p.name} | companyId: ${p.companyId} | address: ${p.address?.line1 || p.address?.street}`);
  }

  await mongoose.disconnect();
}

audit().catch(console.error);
