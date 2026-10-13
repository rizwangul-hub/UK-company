import '../config/env.js';
import mongoose from 'mongoose';
import Property from '../models/Property.js';
import Category from '../models/Category.js';
import Account from '../models/Account.js';
import Transaction from '../models/Transaction.js';
import { getLedgerEntities } from '../controllers/ledgerController.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/uk_property_finance';

async function verifyHierarchy() {
  console.log('Connecting to MongoDB:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log('✓ Connected to MongoDB');

  // Drop legacy index if present in DB
  try {
    await mongoose.connection.collection('categories').dropIndex('name_1');
    console.log('✓ Dropped legacy name_1 index from database collection');
  } catch (e) {
    // Already dropped
  }

  // 1. Ensure 2 sample properties exist
  let prop1 = await Property.findOne({ name: '24 Kensington Mansions' });
  if (!prop1) {
    prop1 = await Property.create({
      name: '24 Kensington Mansions',
      propertyType: 'FLAT_APARTMENT',
      tenure: 'LEASEHOLD',
      addressLine1: '24 Kensington Mansions, Trebovir Road',
      city: 'London',
      postcode: 'SW5 9TQ',
      purchasePrice: 650000,
      currentValuation: 720000,
      purchaseDate: new Date('2022-03-15'),
      isActive: true,
    });
  }
  console.log(`✓ Property 1 ready: ${prop1.name} (${prop1._id})`);

  let prop2 = await Property.findOne({ name: '12 Oxford Road Commercial Unit' });
  if (!prop2) {
    prop2 = await Property.create({
      name: '12 Oxford Road Commercial Unit',
      propertyType: 'COMMERCIAL_OFFICE',
      tenure: 'FREEHOLD',
      addressLine1: '12 Oxford Road',
      city: 'Manchester',
      postcode: 'M1 5QA',
      purchasePrice: 420000,
      currentValuation: 480000,
      purchaseDate: new Date('2021-08-20'),
      isActive: true,
    });
  }
  console.log(`✓ Property 2 ready: ${prop2.name} (${prop2._id})`);

  // 2. Create sub-heads under Property 1 (Electricity, Gas, Maintenance)
  const subheads = ['Electricity Bill', 'Gas & Heating', 'Maintenance & Repairs'];
  for (const name of subheads) {
    let cat = await Category.findOne({ name, propertyId: prop1._id });
    if (!cat) {
      cat = await Category.create({
        name,
        type: 'OPERATING_EXPENSE',
        propertyId: prop1._id,
        expenseClassification: 'PROPERTY_OWN_EXPENSE',
        isAllowableTaxDeduction: true,
        description: `${name} for ${prop1.name}`,
      });
      console.log(`✓ Created sub-head "${name}" under ${prop1.name}`);
    } else {
      console.log(`✓ Sub-head "${name}" already exists under ${prop1.name}`);
    }
  }

  // 3. Create identical sub-heads under Property 2 (Verify no collision with compound index)
  for (const name of subheads) {
    let cat = await Category.findOne({ name, propertyId: prop2._id });
    if (!cat) {
      cat = await Category.create({
        name,
        type: 'OPERATING_EXPENSE',
        propertyId: prop2._id,
        expenseClassification: 'PROPERTY_OWN_EXPENSE',
        isAllowableTaxDeduction: true,
        description: `${name} for ${prop2.name}`,
      });
      console.log(`✓ Created identical sub-head "${name}" under ${prop2.name} without collision`);
    } else {
      console.log(`✓ Sub-head "${name}" already exists under ${prop2.name}`);
    }
  }

  // 4. Verify getLedgerEntities formatting
  const mockRes = {
    statusCode: 200,
    data: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.data = payload; return this; },
  };

  await getLedgerEntities({}, mockRes);
  const entities = mockRes.data?.data || mockRes.data;
  console.log('\n--- 4. Ledger Entities Verification ---');
  console.log(`✓ Properties count: ${entities.properties?.length}`);
  console.log(`✓ Total Expense Heads: ${entities.expenseHeads?.length}`);

  const prop1Heads = entities.expenseHeads?.filter(h => h.name.startsWith(prop1.name));
  const prop2Heads = entities.expenseHeads?.filter(h => h.name.startsWith(prop2.name));

  console.log(`✓ Expense heads formatted under "${prop1.name}": ${prop1Heads?.length}`);
  prop1Heads?.forEach(h => console.log(`   * ${h.name} (${h.subtext})`));

  console.log(`✓ Expense heads formatted under "${prop2.name}": ${prop2Heads?.length}`);
  prop2Heads?.forEach(h => console.log(`   * ${h.name} (${h.subtext})`));

  if (!prop1Heads || prop1Heads.length < 3 || !prop2Heads || prop2Heads.length < 3) {
    throw new Error('Expected at least 3 formatted sub-heads per property in Ledger Entities.');
  }

  console.log('\n======================================================');
  console.log('  PROPERTY EXPENSE HIERARCHY VERIFIED 100%');
  console.log('======================================================');

  await mongoose.disconnect();
}

verifyHierarchy().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
