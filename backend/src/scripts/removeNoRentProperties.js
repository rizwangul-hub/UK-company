/**
 * Remove all OLD STREET properties that have no contractual rent set (0 or missing).
 * Run: node src/scripts/removeNoRentProperties.js
 */
import '../config/env.js';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import Property from '../models/Property.js';

const COMPANY_ID = 'old-street';

async function run() {
  await connectDB();
  console.log('[DB] Connected\n');

  // Find all properties with no rent
  const noRent = await Property.find({
    companyId: COMPANY_ID,
    $or: [
      { contractualRent: { $exists: false } },
      { contractualRent: null },
      { contractualRent: 0 },
    ],
  }).select('name addressLine1 city postcode contractualRent').lean();

  console.log(`Found ${noRent.length} properties with NO rent:\n`);
  noRent.forEach((p, i) =>
    console.log(`  ${i + 1}. ${p.name} | ${p.addressLine1}, ${p.city} ${p.postcode} | rent: ${p.contractualRent}`)
  );

  if (noRent.length === 0) {
    console.log('Nothing to delete.');
    await mongoose.disconnect();
    process.exit(0);
  }

  const ids = noRent.map((p) => p._id);
  const result = await Property.deleteMany({ _id: { $in: ids }, companyId: COMPANY_ID });
  console.log(`\n[DELETED] ${result.deletedCount} properties removed.`);

  // Show what remains
  const remaining = await Property.find({ companyId: COMPANY_ID })
    .select('name contractualRent')
    .sort({ name: 1 })
    .lean();
  console.log(`\nRemaining: ${remaining.length} properties`);
  remaining.forEach((p, i) =>
    console.log(`  ${i + 1}. ${p.name} | rent: £${p.contractualRent}`)
  );

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
