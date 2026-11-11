/**
 * Audit & Correct Old Street Properties
 * Compares Landlord Vision export data against existing DB records
 * Fixes: postcodes, cities, addresses, property names, and adds missing properties.
 *
 * Run from: Uk Expense Tracker/backend
 *   node src/scripts/auditAndFixOldStreetProperties.js
 */

import '../config/env.js';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import Property from '../models/Property.js';

const COMPANY_ID = 'old-street';

// Ground truth from Landlord Vision export (property-vacancy-2026-11-07.xls)
// Keys: canonical property reference, Values: correct address data
const LV_PROPERTIES = [
  { ref: '124 Millard Terrace',                    address: '124 Millard Terrace',           city: 'Dagenham',        county: 'Essex',  postcode: 'RM10 8RQ', type: 'MULTI_UNIT_RESIDENTIAL' },
  { ref: '26A Clarence Road GRAYS RM17 6QJ',       address: '26A Clarence Road',             city: 'Grays',           county: 'Essex',  postcode: 'RM17 6QJ', type: 'FLAT_APARTMENT',         targetRent: 1350 },
  { ref: '73 Lake Walk',                            address: '73 Lake Walk',                  city: 'Clacton-on-Sea',  county: 'Essex',  postcode: 'CO15 2AE', type: 'RESIDENTIAL_TERRACED' },
  { ref: '62A Orsett Road - Flat',                  address: '62A Orsett Road',               city: 'Grays',           county: 'Essex',  postcode: 'RM17 5EH', type: 'FLAT_APARTMENT' },
  { ref: '26 Clarence Road (Shop)',                 address: '26 Clarence Road',              city: 'Grays',           county: 'Essex',  postcode: 'RM17 6QJ', type: 'COMMERCIAL_SHOP' },
  { ref: '15 Clarence Road (Shop)',                 address: '15 Clarence Road',              city: 'Grays',           county: 'Essex',  postcode: 'RM17 6QA', type: 'COMMERCIAL_SHOP' },
  { ref: '13 Clarence Road (Shop)',                 address: '13 Clarence Road',              city: 'Grays',           county: 'Essex',  postcode: 'RM17 6QA', type: 'COMMERCIAL_SHOP' },
  { ref: '7 Vansittart Street',                     address: '7 Vansittart Street',           city: 'Harwich',         county: 'Essex',  postcode: 'CO12 3HZ', type: 'RESIDENTIAL_TERRACED' },
  { ref: '104 Pretoria Road',                       address: '104 Pretoria Road',             city: 'Romford',         county: 'Essex',  postcode: 'RM7 7AT',  type: 'RESIDENTIAL_TERRACED' },
  { ref: '10A-12A Cromwell Road (Flats)',           address: '10A-12A Cromwell Road',         city: 'Grays',           county: 'Essex',  postcode: 'RM17 5HF', type: 'MULTI_UNIT_RESIDENTIAL' },
  { ref: '10-12 Cromwell Road (Shop)',              address: '10-12 Cromwell Road',           city: 'Grays',           county: 'Essex',  postcode: 'RM17 5HF', type: 'COMMERCIAL_SHOP' },
  { ref: '12 Alexandra Street (Ground Floor Shop)', address: '12 Alexandra Street',           city: 'Southend-on-Sea', county: 'Essex',  postcode: 'SS1 1BU',  type: 'COMMERCIAL_SHOP' },
  { ref: '12A,12B, 12C, 12D Alexandra Street',     address: '12A-12D Alexandra Street',      city: 'Southend-on-Sea', county: 'Essex',  postcode: 'SS1 1BU',  type: 'MULTI_UNIT_RESIDENTIAL' },
  { ref: '13A, 15A & 15B Clarence Road (Flats)',   address: '13A, 15A & 15B Clarence Road', city: 'Grays',           county: 'Essex',  postcode: 'RM17 6QA', type: 'MULTI_UNIT_RESIDENTIAL' },
  { ref: '62 Orsett Road (Shop)',                   address: '62 Orsett Road',               city: 'Grays',           county: 'Essex',  postcode: 'RM17 5EH', type: 'COMMERCIAL_SHOP' },
  { ref: '82 Como Street',                          address: '82 Como Street',               city: 'Romford',         county: 'Essex',  postcode: 'RM7 7DT',  type: 'MULTI_UNIT_RESIDENTIAL' },
  { ref: '31 Morley Avenue',                        address: '31 Morley Avenue',             city: 'London',          county: 'Greater London', postcode: 'N18 2QU', type: 'MULTI_UNIT_RESIDENTIAL', targetRent: 3300 },
  { ref: '65 Lansbury Avenue',                      address: '65 Lansbury Avenue',           city: 'Romford',         county: 'Essex',  postcode: 'RM6 6SD',  type: 'FLAT_APARTMENT' },
  { ref: '127A Southend Road (Flat)',               address: '127A Southend Road',           city: 'Rochford',        county: 'Essex',  postcode: 'SS4 1HX',  type: 'FLAT_APARTMENT' },
  { ref: '127 Southend Road (Shop)',                address: '127 Southend Road',            city: 'Rochford',        county: 'Essex',  postcode: 'SS4 1HX',  type: 'COMMERCIAL_SHOP' },
  { ref: '10 Cromwell Road',                        address: '10 Cromwell Road',             city: 'Grays',           county: 'Essex',  postcode: 'RM17 5HF', type: 'RESIDENTIAL_TERRACED' },
];

// Map LV property ref → closest DB name/address (for patching existing records)
const DB_NAME_MAP = {
  '26 Clarence Road (Shop)':                 { dbName: '26 Clarence Road' },
  '26A Clarence Road GRAYS RM17 6QJ':        { dbName: null },            // NEW - not in DB yet
  '62A Orsett Road - Flat':                   { dbName: null },            // NEW
  '15 Clarence Road (Shop)':                  { dbName: null },            // NEW (part of 13/15 group)
  '13 Clarence Road (Shop)':                  { dbName: '13/15 Clarence Road' },
  '10-12 Cromwell Road (Shop)':              { dbName: '10-12 Cromwell Road' },
  '12 Alexandra Street (Ground Floor Shop)': { dbName: '12 Alexandra Street' },
  '12A,12B, 12C, 12D Alexandra Street':     { dbName: null },            // NEW
  '13A, 15A & 15B Clarence Road (Flats)':   { dbName: null },            // NEW
  '62 Orsett Road (Shop)':                   { dbName: '62 Orsett Road' },
  '82 Como Street':                           { dbName: '82 Como Street' },
  '31 Morley Avenue':                         { dbName: '31 Morley Avenue' },
  '65 Lansbury Avenue':                       { dbName: '65 Lansbury Avenue' },
  '127A Southend Road (Flat)':               { dbName: '127 Southend Road' },
  '127 Southend Road (Shop)':               { dbName: null },            // NEW (the shop)
  '10 Cromwell Road':                         { dbName: null },            // NEW
  '104 Pretoria Road':                        { dbName: '104 Pretoria Road' },
  '7 Vansittart Street':                      { dbName: '7 Vansittart Street' },
  '73 Lake Walk':                             { dbName: '73 Lakewalk' },
  '10A-12A Cromwell Road (Flats)':           { dbName: '10-12 Cromwell Road' },
  '124 Millard Terrace':                      { dbName: '124 Millard Terrace' },
};

// Properties we know are NOT in the LV portfolio (test/dummy data to remove)
const DUMMY_PROPERTIES = [
  '24 Kensington Mansions',      // SW5 9TQ - not in LV data
  '12 Oxford Road Commercial Unit', // Manchester - not in LV data
];

async function run() {
  console.log('================================================================');
  console.log('  OLD STREET Property Audit & Correction');
  console.log('================================================================\n');

  await connectDB();
  console.log('[DB] Connected\n');

  const allProps = await Property.find({ companyId: COMPANY_ID }).lean();
  console.log(`[INFO] ${allProps.length} existing properties in DB\n`);

  let updated = 0;
  let inserted = 0;
  let removed = 0;

  // ── 1. Remove dummy/test properties ──────────────────────────────────────
  for (const dummyName of DUMMY_PROPERTIES) {
    const found = allProps.find((p) =>
      (p.name || '').toLowerCase().includes(dummyName.toLowerCase()) ||
      (p.addressLine1 || '').toLowerCase().includes(dummyName.toLowerCase())
    );
    if (found) {
      await Property.deleteOne({ _id: found._id });
      console.log(`  [REMOVED] ${found.name} (${found.addressLine1}) — not in Landlord Vision portfolio`);
      removed++;
    }
  }

  // ── 2. For each LV property: update existing OR insert new ───────────────
  for (const lv of LV_PROPERTIES) {
    const mapping = DB_NAME_MAP[lv.ref] || { dbName: null };
    
    // Try to find existing DB record by mapped name or postcode
    let existing = null;
    if (mapping.dbName) {
      existing = allProps.find((p) =>
        (p.name || '').toLowerCase().includes(mapping.dbName.toLowerCase()) ||
        (p.addressLine1 || '').toLowerCase().includes(mapping.dbName.toLowerCase())
      );
    }
    // Also try to match by postcode if already set
    if (!existing && lv.postcode) {
      existing = allProps.find((p) =>
        (p.postcode || '').replace(/\s/,'').toUpperCase() === lv.postcode.replace(/\s/,'').toUpperCase()
      );
    }

    const correctData = {
      addressLine1: lv.address,
      city: lv.city,
      county: lv.county || '',
      postcode: lv.postcode,
      propertyType: lv.type,
      name: lv.ref
        .replace(/\(.*?\)/g, '')  // remove parenthetical descriptions from name
        .replace(/\s+/g, ' ')
        .trim(),
    };

    if (existing) {
      // Build update — only change fields that differ
      const changes = {};
      if (existing.addressLine1 !== lv.address) changes.addressLine1 = lv.address;
      if ((existing.city || '').toLowerCase() !== lv.city.toLowerCase()) changes.city = lv.city;
      if ((existing.county || '') !== (lv.county || '')) changes.county = lv.county;
      if ((existing.postcode || '').replace(/\s/,'').toUpperCase() !== lv.postcode.replace(/\s/,'').toUpperCase()) {
        changes.postcode = lv.postcode;
      }
      if (existing.propertyType !== lv.type) changes.propertyType = lv.type;

      if (Object.keys(changes).length > 0) {
        await Property.updateOne({ _id: existing._id }, { $set: changes });
        console.log(`  [UPDATED] ${existing.name}`);
        Object.entries(changes).forEach(([k, v]) => {
          const oldVal = existing[k] || '(empty)';
          console.log(`            ${k}: "${oldVal}" → "${v}"`);
        });
        updated++;
      } else {
        console.log(`  [OK]      ${existing.name} — no changes needed`);
      }
    } else {
      // Insert new property
      await Property.create({
        companyId: COMPANY_ID,
        name: correctData.name,
        addressLine1: lv.address,
        addressLine2: '',
        city: lv.city,
        county: lv.county || '',
        postcode: lv.postcode,
        country: 'England',
        propertyType: lv.type,
        isMultiUnit: ['MULTI_UNIT_RESIDENTIAL'].includes(lv.type),
        status: 'OCCUPIED',
        isActive: true,
        notes: `Imported from Landlord Vision export (${new Date().toISOString().slice(0,10)})`,
      });
      console.log(`  [ADDED]   ${lv.ref} (${lv.postcode} / ${lv.city})`);
      inserted++;
    }
  }

  console.log('\n================================================================');
  console.log('  AUDIT COMPLETE');
  console.log(`  Updated : ${updated}`);
  console.log(`  Added   : ${inserted}  (new properties not previously in DB)`);
  console.log(`  Removed : ${removed}  (test/dummy data not in LV portfolio)`);
  console.log('================================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('[FATAL]', err.message);
  process.exit(1);
});
