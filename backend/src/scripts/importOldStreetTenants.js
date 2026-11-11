/**
 * Import Tenants from Landlord Vision Export
 * Company: OLD STREET (old-street)
 * Source: tenants-list-2026-11-07.xls
 *
 * Maps property address → existing Property document, then creates Tenant records.
 * Skips duplicates by fullName + companyId.
 *
 * Run from: Uk Expense Tracker/backend
 *   node --experimental-vm-modules src/scripts/importOldStreetTenants.js
 */

import '../config/env.js';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import Tenant from '../models/Tenant.js';
import Property from '../models/Property.js';

const COMPANY_ID = 'old-street';

// Known company / management-agent emails to strip (not real tenant emails)
const AGENT_EMAILS = new Set([
  'ideallettinghomes@hotmail.co.uk',
  'info@swissestates.co.uk',
  'onboarding@thn.co.uk',
]);

// Raw tenant data extracted from the XLS export
// Columns: propertyName, address, county, postcode, tenantName, phone1, phone2, email
const RAW_TENANTS = [
  {
    propertyName: '10 CROMWELL ROAD GRAYS ESSEX RM17 5HF',
    address: '10 CROMWELL ROAD',
    postcode: 'RM17 5HF',
    tenantName: 'MRS IFEOMA IKHOYAMHE',
    phone1: '',
    phone2: '',
    email: '',
  },
  {
    propertyName: '104 Pretoria Road',
    address: '104 Pretoria Road',
    postcode: 'RM7 7AT',
    tenantName: 'Mr Daniele Marucelli',
    phone1: '07884660659',
    phone2: '',
    email: 'ideallettinghomes@hotmail.co.uk', // agent email - will be stripped
  },
  {
    propertyName: '10A-12A Cromwell Road (Flats)',
    address: '10 Cromwell Road',
    postcode: 'RM17 5HF',
    tenantName: 'ROCKMAN ESTATE LIMITED (10A/12A)',
    phone1: '',
    phone2: '',
    email: 'info@rockmanestates.co.uk',
  },
  {
    propertyName: '12 Alexandra Street (Ground Floor Shop)',
    address: '12 Alexandra Street',
    postcode: 'SS1 1BU',
    tenantName: 'MAHMOUD MOHAMMED AL-SADI',
    phone1: '07411311806',
    phone2: '',
    email: 'alsadi6979@gmail.com',
  },
  {
    propertyName: '124 Millard Terrace',
    address: '124 Millard Terrace, Heathway',
    postcode: 'RM10 8RQ',
    tenantName: 'Muhammad Kamruzzaman Gazi Nesa & Mrs Farzana Jaha',
    phone1: '07459524343',
    phone2: '',
    email: 'ideallettinghomes@hotmail.co.uk', // agent email - will be stripped
  },
  {
    propertyName: '124 Millard Terrace',
    address: '124 Millard Terrace, Heathway',
    postcode: 'RM10 8RQ',
    tenantName: 'SHOUKAT ALI AND REHANA SHOUKAT',
    phone1: '',
    phone2: '',
    email: '',
  },
  {
    propertyName: '124 Millard Terrace',
    address: '124 Millard Terrace, Heathway',
    postcode: 'RM10 8RQ',
    tenantName: 'Kamran Rasheed',
    phone1: '',
    phone2: '',
    email: 'abdulhadikamran117@gmail.com',
  },
  {
    propertyName: '127 Southend Road (Shop)',
    address: '127 Southend Road',
    postcode: 'SS4 1HX',
    tenantName: 'PENNS INC.LTD',
    phone1: '',
    phone2: '',
    email: '',
  },
  {
    propertyName: '127A Southend Road (Flat)',
    address: '127A SOUTHEND ROAD',
    postcode: 'SS4 1HX',
    tenantName: 'MISS OLUWAKEMI IDAYAT',
    phone1: '',
    phone2: '',
    email: '',
  },
  {
    propertyName: '12A,12B, 12C, 12D Alexandra Street',
    address: '12a Alexandra Street',
    postcode: 'SS1 1BU',
    tenantName: 'ROCKMAN ESTATES LIMITED',
    phone1: '07831689094',
    phone2: '',
    email: 'info@rockmanestates.co.uk',
  },
  {
    propertyName: '12A,12B, 12C, 12D Alexandra Street',
    address: '12a Alexandra Street',
    postcode: 'SS1 1BU',
    tenantName: 'Right Way Business Limited T/A Swiss Estates',
    phone1: '',
    phone2: '',
    email: '',
  },
  {
    propertyName: '13 A ,15 A & 15 B Clarence Road (Flats)',
    address: '13 A, 15 A & 15 B CLARENCE ROAD GRAYS RM17 6QA',
    postcode: 'RM17 6QA',
    tenantName: 'SUAVIDA LTD',
    phone1: '07960856203',
    phone2: '',
    email: 'info.suavida@gmail.com',
  },
  {
    propertyName: '13 Clarence Road (Shop)',
    address: '13 CLARENCE ROAD, GRAYS, THURROCK',
    postcode: 'RM17 6QA',
    tenantName: 'Khalid Aziz Mustafa',
    phone1: '00447393334244',
    phone2: '',
    email: 'xan.1996@yahoo.com',
  },
  {
    propertyName: '15 Clarence Road (Shop)',
    address: '15 Clarence Road',
    postcode: 'RM17 6QA',
    tenantName: 'Ivape Grays Limited',
    phone1: '00447445134336',
    phone2: '00447940539166',
    email: 'amin@cloudcityvape.co.uk',
  },
  {
    propertyName: '26 Clarence Road (Shop)',
    address: '26 Clarence Road',
    postcode: 'RM17 6QJ',
    tenantName: 'Danial Butt',
    phone1: '00447828600598',
    phone2: '',
    email: 'daniyalbutt83@gmail.com',
  },
  {
    propertyName: '26A Clarence Road GRAYS RM17 6QJ',
    address: '26A Clarence Road GRAYS',
    postcode: 'RM17 6QJ',
    tenantName: 'MUSTAFIZUR RAHMAN & SHAMIMA AKTER',
    phone1: '',
    phone2: '',
    email: '',
  },
  {
    propertyName: '26A Clarence Road GRAYS RM17 6QJ',
    address: '26A Clarence Road GRAYS',
    postcode: 'RM17 6QJ',
    tenantName: 'Mudasir Nazar Cheema & Amara Bashir',
    phone1: '00447983625804',
    phone2: '',
    email: 'cheemaccount@yahoo.com',
  },
  {
    propertyName: '31 Morley Avenue',
    address: '31 Morley Avenue',
    postcode: 'N18 2QU',
    tenantName: 'JAY\'S HOMECARE LIMITED',
    phone1: '',
    phone2: '',
    email: 'Kasia@jayshomecare.co.uk',
  },
  {
    propertyName: '31 Morley Avenue',
    address: '31 Morley Avenue',
    postcode: 'N18 2QU',
    tenantName: 'BAFFOUR DUAH AGYEMANG, DORIS OBENG KYEREMAA, SYDNEY OPPON',
    phone1: '',
    phone2: '',
    email: '',
  },
  {
    propertyName: '62 Orsett Road - Shop',
    address: '62 Orsett Road Grays Essex',
    postcode: 'RM17 5EH',
    tenantName: 'THE LATIN PLAZA LIMITED',
    phone1: '07799953815',
    phone2: '',
    email: 'thelatinplaza@gmail.com',
  },
  {
    propertyName: '62A Orsett Road - Flat',
    address: '62A Orsett Road',
    postcode: 'RM17 5EH',
    tenantName: 'ION TOMA & CAROLINA TOMA',
    phone1: '',
    phone2: '',
    email: '',
  },
  {
    propertyName: '62A Orsett Road - Flat',
    address: '62A Orsett Road',
    postcode: 'RM17 5EH',
    tenantName: 'GURMUKH SINGH, MANPREET KAUR & JAGPREET SINGH',
    phone1: '',
    phone2: '',
    email: '',
  },
  {
    propertyName: '62A Orsett Road - Flat',
    address: '62A Orsett Road',
    postcode: 'RM17 5EH',
    tenantName: 'Nicole Stratan',
    phone1: '00447514411836',
    phone2: '',
    email: 'info@swissestates.co.uk', // agent email - will be stripped
  },
  {
    propertyName: '65 LANSBURY AVENUE',
    address: '65 LANSBURY AVENUE',
    postcode: 'RM6 6SD',
    tenantName: 'EVA-MARIA VASILESCU, ANCA-AIDA STAN AND DUMITRU-OCTAVIAN SIIU',
    phone1: '',
    phone2: '',
    email: '',
  },
  {
    propertyName: '7 Vansittart Street',
    address: '7 Vansittart Street',
    postcode: 'CO12 3HZ',
    tenantName: 'CENTENNIAL PROPERTY LTD',
    phone1: '',
    phone2: '',
    email: 'onboarding@thn.co.uk', // agent email - will be stripped
  },
  {
    propertyName: '7 Vansittart Street',
    address: '7 Vansittart Street',
    postcode: 'CO12 3HZ',
    tenantName: 'Louren Ann',
    phone1: '07393386102',
    phone2: '',
    email: 'ideallettinghomes@hotmail.co.uk', // agent email - will be stripped
  },
  {
    propertyName: '73 Lake Walk',
    address: '73 Lake Walk',
    postcode: 'CO15 2AE',
    tenantName: 'TOBIN JOY PAYYAPILLY AND GEETHU DAVIS PUTHUSSERY',
    phone1: '07721932944',
    phone2: '',
    email: '',
  },
  {
    propertyName: '73 Lake Walk',
    address: '73 Lake Walk',
    postcode: 'CO15 2AE',
    tenantName: 'JESSICA COURTNEY FISHER',
    phone1: '00447398976253',
    phone2: '',
    email: 'info@swissestates.co.uk', // agent email - will be stripped
  },
  {
    propertyName: '82 COMO STREET',
    address: '82 COMO STREET, ROMFORD',
    postcode: 'RM7 7DT',
    tenantName: 'MUHAMMED ASLAM AND SHILPA TRESA JOHN',
    phone1: '07385714905',
    phone2: '',
    email: 'muhammedaslamck123@gmail.com',
  },
  {
    propertyName: '82 COMO STREET',
    address: '82 COMO STREET, ROMFORD',
    postcode: 'RM7 7DT',
    tenantName: 'VISHAL KUMAR AND KAVITA',
    phone1: '',
    phone2: '',
    email: '',
  },
  {
    propertyName: '82 COMO STREET',
    address: '82 COMO STREET, ROMFORD',
    postcode: 'RM7 7DT',
    tenantName: 'MD FAYSAL ALAM, AKTER HOSSAIN & NADIA AKTER, NIZUM SULTANA RUMI',
    phone1: '',
    phone2: '',
    email: '',
  },
  {
    propertyName: '82 COMO STREET',
    address: '82 COMO STREET, ROMFORD',
    postcode: 'RM7 7DT',
    tenantName: 'CONSTANTIN-FLORIN ISTRATE, NICOLAE SPINU & GABRIELA-DANIELA BUTURUGA',
    phone1: '',
    phone2: '',
    email: '',
  },
];

/** Determine if a tenant name sounds like a company */
function isCompanyTenant(name) {
  const upper = name.toUpperCase();
  return (
    upper.includes('LIMITED') ||
    upper.includes('LTD') ||
    upper.includes('PLC') ||
    upper.includes('INC') ||
    upper.includes('ESTATE') ||
    upper.includes('PROPERTY') ||
    upper.includes('HOMECARE') ||
    upper.includes('CENTENNIAL') ||
    upper.includes('RIGHT WAY') ||
    upper.includes('ROCKMAN')
  );
}

/** Normalize a UK phone number - strip spaces, keep leading 0 or +44 */
function normalizePhone(phone) {
  if (!phone) return '';
  // Remove all non-digit characters except leading +
  let p = phone.trim().replace(/[^\d+]/g, '');
  // International format: 004471234... → +44 71234...
  if (p.startsWith('0044')) p = '+44' + p.slice(4);
  return p;
}

/** Find a property in the DB by postcode or partial address match */
async function findMatchingProperty(postcode, address, propertyName) {
  if (!postcode && !address) return null;

  const cleanPostcode = (postcode || '').toUpperCase().replace(/\s+/g, '');

  // 1. Try exact postcode match within old-street company
  if (cleanPostcode) {
    const byPostcode = await Property.find({
      companyId: COMPANY_ID,
      $or: [
        { postcode: { $regex: cleanPostcode, $options: 'i' } },
        { addressLine1: { $regex: cleanPostcode, $options: 'i' } },
      ],
    }).limit(5);

    if (byPostcode.length === 1) return byPostcode[0];
    if (byPostcode.length > 1) {
      // Narrow down by address
      const addrNum = (address || propertyName || '').match(/^\d+/)?.[0];
      if (addrNum) {
        const narrowed = byPostcode.find((p) =>
          (p.addressLine1 || '').startsWith(addrNum) ||
          (p.name || '').includes(addrNum)
        );
        if (narrowed) return narrowed;
      }
      return byPostcode[0];
    }
  }

  // 2. Try address line match
  const addrWords = (address || '').split(/[\s,]+/).filter(Boolean).slice(0, 3);
  if (addrWords.length >= 2) {
    const byAddress = await Property.findOne({
      companyId: COMPANY_ID,
      addressLine1: { $regex: addrWords.join('.*'), $options: 'i' },
    });
    if (byAddress) return byAddress;
  }

  return null;
}

async function run() {
  console.log('==========================================================');
  console.log(' OLD STREET Tenant Import from Landlord Vision Export');
  console.log('==========================================================\n');

  await connectDB();
  console.log('[DB] Connected to MongoDB\n');

  // Check how many properties already exist for old-street
  const propCount = await Property.countDocuments({ companyId: COMPANY_ID });
  console.log(`[INFO] Found ${propCount} existing properties for old-street\n`);

  let created = 0;
  let skipped = 0;
  let noProperty = 0;
  const results = [];

  for (const raw of RAW_TENANTS) {
    const fullName = raw.tenantName.trim();

    // Skip if already exists
    const existing = await Tenant.findOne({ companyId: COMPANY_ID, fullName });
    if (existing) {
      console.log(`  [SKIP] Already exists: ${fullName}`);
      skipped++;
      results.push({ status: 'skipped', name: fullName });
      continue;
    }

    // Strip agent emails
    let email = (raw.email || '').toLowerCase().trim();
    if (AGENT_EMAILS.has(email)) email = '';

    // Build phone
    const phone = normalizePhone(raw.phone1) || normalizePhone(raw.phone2);

    // Determine tenant type
    const tenantType = isCompanyTenant(fullName) ? 'COMPANY' : 'INDIVIDUAL';
    const companyName = tenantType === 'COMPANY' ? fullName : '';

    // Try to find matching property
    const matchedProperty = await findMatchingProperty(
      raw.postcode,
      raw.address,
      raw.propertyName
    );

    if (!matchedProperty) {
      console.log(`  [NO-PROP] No property match for: ${fullName} (${raw.postcode} / ${raw.address})`);
      noProperty++;
    }

    // Build tenant document
    const tenantDoc = {
      companyId: COMPANY_ID,
      fullName,
      email,
      phone,
      currentAddress: raw.address || '',
      postcode: (raw.postcode || '').toUpperCase().trim(),
      tenantType,
      companyName,
      notes: matchedProperty
        ? `Imported from Landlord Vision. Property: ${raw.propertyName}`
        : `Imported from Landlord Vision. Source property: ${raw.propertyName} (no DB match found)`,
      isActive: true,
    };

    const tenant = await Tenant.create(tenantDoc);
    created++;
    console.log(
      `  [OK] ${fullName} → ${tenantType}${matchedProperty ? ` → ${matchedProperty.addressLine1 || matchedProperty.name}` : ' → (no property matched)'}`
    );
    results.push({
      status: 'created',
      name: fullName,
      tenantId: tenant._id.toString(),
      propertyMatched: matchedProperty ? matchedProperty.addressLine1 : null,
    });
  }

  console.log('\n==========================================================');
  console.log(` IMPORT COMPLETE`);
  console.log(`  Created : ${created}`);
  console.log(`  Skipped : ${skipped} (already existed)`);
  console.log(`  No prop : ${noProperty} (tenant created but property not matched)`);
  console.log('==========================================================\n');

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
