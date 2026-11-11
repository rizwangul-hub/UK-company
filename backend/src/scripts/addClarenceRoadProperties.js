/**
 * Re-add 3 Clarence Road properties with correct rent details
 * Run: node src/scripts/addClarenceRoadProperties.js
 */
import '../config/env.js';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import Property from '../models/Property.js';

const COMPANY_ID = 'old-street';

const PROPERTIES = [
  {
    companyId: COMPANY_ID,
    name: '13A, 15A & 15B Clarence Road (Flats)',
    addressLine1: '13A, 15A & 15B Clarence Road',
    city: 'Grays',
    postcode: 'RM17 6QA',
    propertyType: 'MULTI_UNIT_RESIDENTIAL',
    contractualRent: 4100,
    rentFrequency: 'MONTHLY',
    status: 'Occupied',
    tenantName: 'SUAVIDA LTD',
    tenancyStartDate: new Date('2026-01-01'),
    tenancyEndDate: new Date('2026-03-31'),
    isActive: true,
  },
  {
    companyId: COMPANY_ID,
    name: '15 Clarence Road (Shop)',
    addressLine1: '15 Clarence Road',
    city: 'Grays',
    postcode: 'RM17 6QA',
    propertyType: 'COMMERCIAL_SHOP',
    contractualRent: 2667,
    rentFrequency: 'MONTHLY',
    status: 'Occupied',
    tenantName: 'Ivape Grays Ltd - Kaled Ahmed',
    tenancyStartDate: new Date('2026-01-01'),
    tenancyEndDate: new Date('2032-07-31'),
    isActive: true,
  },
  {
    companyId: COMPANY_ID,
    name: '13 Clarence Road (Shop)',
    addressLine1: '13 Clarence Road',
    city: 'Grays',
    postcode: 'RM17 6QA',
    propertyType: 'COMMERCIAL_SHOP',
    contractualRent: 2167,
    rentFrequency: 'MONTHLY',
    status: 'Occupied',
    tenantName: 'Khalid Aziz Mustafa',
    tenancyStartDate: new Date('2026-01-01'),
    tenancyEndDate: new Date('2032-11-30'),
    isActive: true,
  },
];

async function run() {
  await connectDB();
  console.log('[DB] Connected\n');

  for (const prop of PROPERTIES) {
    // Skip if already exists
    const existing = await Property.findOne({ companyId: COMPANY_ID, name: prop.name });
    if (existing) {
      console.log(`[EXISTS] ${prop.name} — updating rent details...`);
      await Property.updateOne({ _id: existing._id }, { $set: {
        contractualRent: prop.contractualRent,
        rentFrequency: prop.rentFrequency,
        status: prop.status,
        tenantName: prop.tenantName,
        tenancyStartDate: prop.tenancyStartDate,
        tenancyEndDate: prop.tenancyEndDate,
      }});
      console.log(`  [UPDATED] ${prop.name} → £${prop.contractualRent}/month`);
      continue;
    }

    const created = await Property.create(prop);
    console.log(`[ADDED] ${created.name}`);
    console.log(`  Address : ${created.addressLine1}, ${created.city} ${created.postcode}`);
    console.log(`  Type    : ${created.propertyType}`);
    console.log(`  Rent    : £${created.contractualRent}/month`);
    console.log(`  Tenant  : ${created.tenantName}`);
    console.log(`  Lease   : ${created.tenancyStartDate?.toDateString()} → ${created.tenancyEndDate?.toDateString()}`);
    console.log();
  }

  // Final list
  const all = await Property.find({ companyId: COMPANY_ID })
    .select('name contractualRent status tenantName')
    .sort({ name: 1 })
    .lean();
  console.log(`\nTotal OLD STREET properties: ${all.length}`);
  all.forEach((p, i) =>
    console.log(`  ${String(i+1).padStart(2)}. ${p.name} | £${p.contractualRent}/mo | ${p.status || '-'} | ${p.tenantName || '-'}`)
  );

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
