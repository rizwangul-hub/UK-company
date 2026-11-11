/**
 * Fix & Sync OLD STREET Properties against the Landlord Vision export
 * (property-vacancy-2026-11-07.xls)
 *
 * Actions:
 *  1. Remove manually-added properties not in the official LV export
 *  2. Fix incorrect names / addresses on existing records
 *  3. Add properties that are in the export but missing from DB
 *
 * Run from: Uk Expense Tracker/backend
 *   node src/scripts/fixOldStreetProperties.js
 */

import '../config/env.js';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import Property from '../models/Property.js';

const COMPANY_ID = 'old-street';

// ─────────────────────────────────────────────
// Ground-truth from the LV export (21 properties)
// ─────────────────────────────────────────────
const LV_PROPERTIES = [
  { ref: '124 Millard Terrace',                    addressLine1: '124 Millard Terrace',           city: 'Dagenham',        postcode: 'RM10 8RQ', type: 'MULTI_UNIT_RESIDENTIAL' },
  { ref: '26A Clarence Road GRAYS RM17 6QJ',        addressLine1: '26A Clarence Road',             city: 'Grays',           postcode: 'RM17 6QJ', type: 'FLAT_APARTMENT' },
  { ref: '73 Lake Walk',                            addressLine1: '73 Lake Walk',                  city: 'Clacton-on-Sea',  postcode: 'CO15 2AE', type: 'RESIDENTIAL_TERRACED' },
  { ref: '62A Orsett Road - Flat',                  addressLine1: '62A Orsett Road',               city: 'Grays',           postcode: 'RM17 5EH', type: 'FLAT_APARTMENT' },
  { ref: '26 Clarence Road (Shop)',                 addressLine1: '26 Clarence Road',              city: 'Grays',           postcode: 'RM17 6QJ', type: 'COMMERCIAL_SHOP' },
  { ref: '15 Clarence Road (Shop)',                 addressLine1: '15 Clarence Road',              city: 'Grays',           postcode: 'RM17 6QA', type: 'COMMERCIAL_SHOP' },
  { ref: '13 Clarence Road (Shop)',                 addressLine1: '13 Clarence Road',              city: 'Grays',           postcode: 'RM17 6QA', type: 'COMMERCIAL_SHOP' },
  { ref: '7 Vansittart Street',                     addressLine1: '7 Vansittart Street',           city: 'Harwich',         postcode: 'CO12 3HZ', type: 'RESIDENTIAL_TERRACED' },
  { ref: '104 Pretoria Road',                       addressLine1: '104 Pretoria Road',             city: 'Romford',         postcode: 'RM7 7AT',  type: 'RESIDENTIAL_TERRACED' },
  { ref: '10A-12A Cromwell Road (Flats)',            addressLine1: '10A-12A Cromwell Road',         city: 'Grays',           postcode: 'RM17 5HF', type: 'MULTI_UNIT_RESIDENTIAL' },
  { ref: '10-12 Cromwell Road (Shop)',              addressLine1: '10-12 Cromwell Road',           city: 'Grays',           postcode: 'RM17 5HF', type: 'COMMERCIAL_SHOP' },
  { ref: '12 Alexandra Street (Ground Floor Shop)', addressLine1: '12 Alexandra Street',           city: 'Southend-on-Sea', postcode: 'SS1 1BU',  type: 'COMMERCIAL_SHOP' },
  { ref: '12A,12B, 12C, 12D Alexandra Street',      addressLine1: '12A-12D Alexandra Street',      city: 'Southend-on-Sea', postcode: 'SS1 1BU',  type: 'MULTI_UNIT_RESIDENTIAL' },
  { ref: '13A, 15A & 15B Clarence Road (Flats)',    addressLine1: '13A, 15A & 15B Clarence Road',  city: 'Grays',           postcode: 'RM17 6QA', type: 'MULTI_UNIT_RESIDENTIAL' },
  { ref: '62 Orsett Road (Shop)',                   addressLine1: '62 Orsett Road',                city: 'Grays',           postcode: 'RM17 5EH', type: 'COMMERCIAL_SHOP' },
  { ref: '82 Como Street',                          addressLine1: '82 Como Street',                city: 'Romford',         postcode: 'RM7 7DT',  type: 'MULTI_UNIT_RESIDENTIAL' },
  { ref: '31 Morley Avenue',                        addressLine1: '31 Morley Avenue',              city: 'London',          postcode: 'N18 2QU',  type: 'MULTI_UNIT_RESIDENTIAL' },
  { ref: '65 Lansbury Avenue',                      addressLine1: '65 Lansbury Avenue',            city: 'Romford',         postcode: 'RM6 6SD',  type: 'FLAT_APARTMENT' },
  { ref: '127A Southend Road (Flat)',               addressLine1: '127A Southend Road',            city: 'Rochford',        postcode: 'SS4 1HX',  type: 'FLAT_APARTMENT' },
  { ref: '127 Southend Road (Shop)',                addressLine1: '127 Southend Road',             city: 'Rochford',        postcode: 'SS4 1HX',  type: 'COMMERCIAL_SHOP' },
  { ref: '10 Cromwell Road',                        addressLine1: '10 Cromwell Road',              city: 'Grays',           postcode: 'RM17 5HF', type: 'FLAT_APARTMENT' },
];

// ─────────────────────────────────────────────
// Properties to DELETE from DB (manually added, NOT in LV export)
// IDs from DB audit above
// ─────────────────────────────────────────────
const IDS_TO_DELETE = [
  '6acd0d854ccab36d6191c1be', // "13/15 Clarence Road" – merged record, not in LV (already split into 13 & 15 separately)
];

// ─────────────────────────────────────────────
// Corrections: DB _id → fields to update
// ─────────────────────────────────────────────
const CORRECTIONS = [
  {
    id: '6acd0d824ccab36d6191c1af',
    // DB: name="127 Southend Road", addr="127A Southend Road" → wrong mix
    // Fix: this record IS actually the flat (127A)
    name: '127A Southend Road (Flat)',
    addressLine1: '127A Southend Road',
    city: 'Rochford',
    postcode: 'SS4 1HX',
    propertyType: 'FLAT_APARTMENT',
  },
  {
    id: '6acd0d4cfb0d7a49d437db00',
    // DB: name="12 Alexandra Street" → rename to include clarifier
    name: '12 Alexandra Street (Ground Floor Shop)',
    addressLine1: '12 Alexandra Street',
    city: 'Southend-on-Sea',
    postcode: 'SS1 1BU',
    propertyType: 'COMMERCIAL_SHOP',
  },
  {
    id: '6acd0d4cfb0d7a49d437db01',
    // DB: name="26 Clarence Road" → rename to include clarifier
    name: '26 Clarence Road (Shop)',
    addressLine1: '26 Clarence Road',
    city: 'Grays',
    postcode: 'RM17 6QJ',
    propertyType: 'COMMERCIAL_SHOP',
  },
  {
    id: '6acd0d814ccab36d6191c1aa',
    // DB: name="73 Lakewalk" → fix typo
    name: '73 Lake Walk',
    addressLine1: '73 Lake Walk',
    city: 'Clacton-on-Sea',
    postcode: 'CO15 2AE',
    propertyType: 'RESIDENTIAL_TERRACED',
  },
  {
    id: '6acd0d824ccab36d6191c1ae',
    // DB: name="62 Orsett Road" → rename to include clarifier
    name: '62 Orsett Road (Shop)',
    addressLine1: '62 Orsett Road',
    city: 'Grays',
    postcode: 'RM17 5EH',
    propertyType: 'COMMERCIAL_SHOP',
  },
  {
    id: '6acd0d834ccab36d6191c1b2',
    // DB: name="124 Millard Terrace" → ensure correct city
    name: '124 Millard Terrace',
    addressLine1: '124 Millard Terrace',
    city: 'Dagenham',
    postcode: 'RM10 8RQ',
    propertyType: 'MULTI_UNIT_RESIDENTIAL',
  },
  {
    id: '6acd0d834ccab36d6191c1b6',
    // DB: name="82 Como Street" → fix city (should not be London)
    name: '82 Como Street',
    addressLine1: '82 Como Street',
    city: 'Romford',
    postcode: 'RM7 7DT',
    propertyType: 'MULTI_UNIT_RESIDENTIAL',
  },
  {
    id: '6acd0d844ccab36d6191c1ba',
    // DB: name="10-12 Cromwell Road" → add clarifier
    name: '10-12 Cromwell Road (Shop)',
    addressLine1: '10-12 Cromwell Road',
    city: 'Grays',
    postcode: 'RM17 5HF',
    propertyType: 'COMMERCIAL_SHOP',
  },
  {
    id: '6aef5fb1c0ed4e23896cd847',
    // DB: name="127 Southend Road", addr="127 Southend Road" → this is the SHOP
    name: '127 Southend Road (Shop)',
    addressLine1: '127 Southend Road',
    city: 'Rochford',
    postcode: 'SS4 1HX',
    propertyType: 'COMMERCIAL_SHOP',
  },
  {
    id: '6aef5fafc0ed4e23896cd844',
    // DB: name="15 Clarence Road" → add clarifier
    name: '15 Clarence Road (Shop)',
    addressLine1: '15 Clarence Road',
    city: 'Grays',
    postcode: 'RM17 6QA',
    propertyType: 'COMMERCIAL_SHOP',
  },
  {
    id: '6aef5fb0c0ed4e23896cd846',
    // DB: name="13A, 15A & 15B Clarence Road" → match LV name
    name: '13A, 15A & 15B Clarence Road (Flats)',
    addressLine1: '13A, 15A & 15B Clarence Road',
    city: 'Grays',
    postcode: 'RM17 6QA',
    propertyType: 'MULTI_UNIT_RESIDENTIAL',
  },
];

// ─────────────────────────────────────────────
// Properties to ADD (in LV but missing from DB)
// ─────────────────────────────────────────────
const TO_ADD = [
  {
    // "13 Clarence Road (Shop)" already in DB as id 6aef5fafc0ed4e23896cd843? No – that's 62A Orsett.
    // Check: DB has id 6acd0d8a4ccab36d6191c1cf → "13 Clarence Road" via old 13/15 split.
    // Actually DB has no standalone "13 Clarence Road" – the merged "13/15" is being deleted.
    // So we must re-add "13 Clarence Road (Shop)" fresh.
    companyId: COMPANY_ID,
    name: '13 Clarence Road (Shop)',
    addressLine1: '13 Clarence Road',
    city: 'Grays',
    postcode: 'RM17 6QA',
    propertyType: 'COMMERCIAL_SHOP',
    isActive: true,
  },
  {
    companyId: COMPANY_ID,
    name: '10A-12A Cromwell Road (Flats)',
    addressLine1: '10A-12A Cromwell Road',
    city: 'Grays',
    postcode: 'RM17 5HF',
    propertyType: 'MULTI_UNIT_RESIDENTIAL',
    isActive: true,
  },
  {
    companyId: COMPANY_ID,
    name: '10 Cromwell Road',
    addressLine1: '10 Cromwell Road',
    city: 'Grays',
    postcode: 'RM17 5HF',
    propertyType: 'FLAT_APARTMENT',
    isActive: true,
  },
];

async function run() {
  console.log('====================================================');
  console.log(' OLD STREET Properties — Fix & Sync');
  console.log('====================================================\n');

  await connectDB();
  console.log('[DB] Connected\n');

  // ── STEP 1: Delete manually-added properties ─────────────────
  console.log('STEP 1: Deleting manually-added properties not in LV export...');
  for (const id of IDS_TO_DELETE) {
    const result = await Property.findOneAndDelete({ _id: id, companyId: COMPANY_ID });
    if (result) {
      console.log(`  [DELETED] ${result.name} (${id})`);
    } else {
      console.log(`  [NOT FOUND] ${id} — already removed or wrong ID`);
    }
  }

  // ── STEP 2: Apply corrections to existing records ────────────
  console.log('\nSTEP 2: Applying corrections to existing records...');
  for (const fix of CORRECTIONS) {
    const { id, ...updates } = fix;
    // Build only the fields defined in the schema
    const updateFields = {};
    if (updates.name)         updateFields.name = updates.name;
    if (updates.addressLine1) updateFields.addressLine1 = updates.addressLine1;
    if (updates.city)         updateFields.city = updates.city;
    if (updates.postcode)     updateFields.postcode = updates.postcode;
    if (updates.propertyType) updateFields.propertyType = updates.propertyType;

    const result = await Property.findOneAndUpdate(
      { _id: id, companyId: COMPANY_ID },
      { $set: updateFields },
      { new: true }
    );
    if (result) {
      console.log(`  [FIXED] ${result.name} — ${result.addressLine1}, ${result.city}, ${result.postcode}`);
    } else {
      console.log(`  [NOT FOUND] ID ${id}`);
    }
  }

  // ── STEP 3: Add missing properties ──────────────────────────
  console.log('\nSTEP 3: Adding missing properties...');
  for (const prop of TO_ADD) {
    // Check if already exists (by name or postcode+addressLine1)
    const existing = await Property.findOne({
      companyId: COMPANY_ID,
      $or: [
        { name: prop.name },
        { addressLine1: prop.addressLine1, postcode: prop.postcode },
      ],
    });
    if (existing) {
      console.log(`  [EXISTS] ${prop.name} — skipping`);
      continue;
    }
    const created = await Property.create(prop);
    console.log(`  [ADDED] ${created.name} — ${created.addressLine1}, ${created.city}, ${created.postcode} (${created._id})`);
  }

  // ── STEP 4: Final count ──────────────────────────────────────
  console.log('\n── Final property count ──');
  const all = await Property.find({ companyId: COMPANY_ID })
    .select('name addressLine1 city postcode propertyType')
    .sort({ name: 1 })
    .lean();
  console.log(`Total: ${all.length} properties\n`);
  all.forEach((p, i) =>
    console.log(`  ${String(i + 1).padStart(2)}. ${p.name} | ${p.addressLine1}, ${p.city} ${p.postcode} [${p.propertyType}]`)
  );

  console.log('\n====================================================');
  console.log(' DONE');
  console.log('====================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
