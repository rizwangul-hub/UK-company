import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import '../config/env.js';
import Property from '../models/Property.js';
import Mortgage from '../models/Mortgage.js';
import { VALID_COMPANY_IDS } from '../config/companies.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// LandlordVision MongoDB URI (Read-Only source, loaded from environment)
const LANDLORD_VISION_URI = process.env.LANDLORD_VISION_MONGO_URI;

// Company Name Mapping to official stable IDs
const COMPANY_MAPPING = {
  'old street holdings ltd': 'old-street',
  'old street': 'old-street',
  'best standard properties ltd': 'best-standard',
  'best standard': 'best-standard',
  'sk hamilton holdings ltd': 'sk-hamilton',
  'sk hamilton': 'sk-hamilton',
  'homewards properties ltd': 'homewards',
  'homewards': 'homewards',
  'mile end road ltd': 'mile-end-road',
  'mile end road': 'mile-end-road',
  'global standard properties ltd': 'global-standard',
  'globle standard': 'global-standard',
  'global standard': 'global-standard',
};

// UK Postcode Regex (matches postcodes with or without leading/trailing punctuation)
const UK_POSTCODE_REGEX = /(?:^|[\s,;\-_/])([A-Z]{1,2}[0-9][A-Z0-9]?\s*[0-9][A-Z]{2})(?:$|[\s,;\-_/])/i;

function parseAddressAndPostcode(name, address, city, postcode) {
  let cleanPostcode = (postcode || '').trim().toUpperCase();
  let cleanCity = (city || '').trim();
  let cleanAddress = (address || '').trim();

  // If postcode is missing or incomplete, search in address or name
  if (!cleanPostcode) {
    const combined = `${cleanAddress} ${name}`;
    const match = combined.match(UK_POSTCODE_REGEX);
    if (match) {
      cleanPostcode = match[1].trim().toUpperCase();
    }
  }

  // If city is missing, look for common cities/towns in address or name
  if (!cleanCity || cleanCity.toLowerCase() === 'united kingdom') {
    const text = `${cleanAddress} ${name}`.toLowerCase();
    if (text.includes('clacton')) cleanCity = 'Clacton-on-Sea';
    else if (text.includes('harlow')) cleanCity = 'Harlow';
    else if (text.includes('luton')) cleanCity = 'Luton';
    else if (text.includes('basildon')) cleanCity = 'Basildon';
    else if (text.includes('rainham')) cleanCity = 'Rainham';
    else if (text.includes('romford')) cleanCity = 'Romford';
    else if (text.includes('ilford')) cleanCity = 'Ilford';
    else if (text.includes('grays')) cleanCity = 'Grays';
    else if (text.includes('finchley')) cleanCity = 'London';
    else if (text.includes('chingford')) cleanCity = 'London';
    else if (text.includes('brixton')) cleanCity = 'London';
    else if (text.includes('streatham')) cleanCity = 'London';
    else if (text.includes('hackney')) cleanCity = 'London';
    else if (text.includes('essex')) cleanCity = 'Essex';
    else cleanCity = 'London';
  }

  if (!cleanAddress) {
    cleanAddress = name;
  }

  return {
    addressLine1: cleanAddress,
    city: cleanCity,
    postcode: cleanPostcode,
  };
}

async function runImport() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const doBackup = args.includes('--backup');

  console.log(`======================================================`);
  console.log(`  PIXX UK MULTI-COMPANY PROPERTY & RENT IMPORTER      `);
  console.log(`  Target DB: ${process.env.MONGO_URI ? 'Connected' : 'Missing'}`);
  console.log(`  Mode: ${isDryRun ? '🔍 DRY RUN (PREVIEW ONLY - NO WRITES)' : '⚡ LIVE DATABASE IMPORT'}`);
  console.log(`======================================================\n`);

  // Connect to target UK DB
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`[Target DB Connected]: ${mongoose.connection.host} / ${mongoose.connection.name}`);

  // Safeguard: Ensure we are connected to dedicated UK database uk_property_finance
  if (mongoose.connection.name !== 'uk_property_finance') {
    throw new Error(`CRITICAL: Connected to database "${mongoose.connection.name}" instead of "uk_property_finance". Aborting!`);
  }

  // Backup existing properties if requested or during live run
  if (doBackup || !isDryRun) {
    const backupDir = path.join(__dirname, '../backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const existingProps = await Property.find({}).lean();
    const backupPath = path.join(backupDir, `properties_backup_${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(existingProps, null, 2));
    console.log(`[Safety Backup Created]: ${existingProps.length} existing properties backed up to: ${backupPath}\n`);
  }

  // Connect to LandlordVision DB (Read-Only)
  if (!LANDLORD_VISION_URI) {
    throw new Error('LANDLORD_VISION_MONGO_URI environment variable is required to run this import script.');
  }
  console.log(`[Connecting to Reference Source]: LandlordVision DB...`);
  const lvConn = await mongoose.createConnection(LANDLORD_VISION_URI).asPromise();
  console.log(`[Reference Source Connected]: LandlordVision\n`);

  const [lvProps, lvLandlords, lvTenancies, lvCustomers, lvMortgages] = await Promise.all([
    lvConn.db.collection('properties').find({ isArchived: { $ne: true } }).toArray(),
    lvConn.db.collection('landlords').find({}).toArray(),
    lvConn.db.collection('tenancies').find({ isArchived: { $ne: true } }).toArray(),
    lvConn.db.collection('customers').find({ isArchived: { $ne: true } }).toArray(),
    lvConn.db.collection('mortgages').find({}).toArray(),
  ]);

  console.log(`[Source Records Found]:`);
  console.log(`  - Non-archived Properties: ${lvProps.length}`);
  console.log(`  - Landlord Entities:      ${lvLandlords.length}`);
  console.log(`  - Tenancies:              ${lvTenancies.length}`);
  console.log(`  - Customers / Tenants:    ${lvCustomers.length}`);
  console.log(`  - Mortgage Facilities:    ${lvMortgages.length}\n`);

  const landlordMap = {};
  lvLandlords.forEach((l) => {
    landlordMap[l._id.toString()] = l.fullName;
  });

  const customerMap = {};
  lvCustomers.forEach((c) => {
    customerMap[c._id.toString()] = c;
  });

  // Prepare normalized property records
  const preparedRecords = [];
  const unmappedProperties = [];

  for (const p of lvProps) {
    const rawLandlordName = landlordMap[p.landlordId?.toString()] || '';
    const compKey = rawLandlordName.trim().toLowerCase();
    const companyId = COMPANY_MAPPING[compKey];

    if (!companyId || !VALID_COMPANY_IDS.includes(companyId)) {
      unmappedProperties.push({ name: p.name, landlord: rawLandlordName });
      continue;
    }

    // Tenancy matching
    const propTenancies = lvTenancies.filter((t) => t.propertyId?.toString() === p._id.toString());
    const activeTenancy = propTenancies.find((t) => t.status === 'Active') || propTenancies[0] || null;
    let tenantName = '';
    let tenancyStartDate = null;
    let tenancyEndDate = null;

    if (activeTenancy) {
      const cust = customerMap[activeTenancy.customerId?.toString()];
      tenantName = cust ? cust.name : (p.customerName || '');
      if (activeTenancy.startDate) tenancyStartDate = new Date(activeTenancy.startDate);
      if (activeTenancy.endDate) tenancyEndDate = new Date(activeTenancy.endDate);
    } else if (p.customerName) {
      tenantName = p.customerName;
    }

    // Mortgage matching
    const linkedMortgages = lvMortgages.filter((m) => {
      if (m.propertyId && m.propertyId.toString() === p._id.toString()) return true;
      if (m.properties && m.properties.some((mp) => mp.propertyId && mp.propertyId.toString() === p._id.toString())) return true;
      return false;
    });

    const parsedAddr = parseAddressAndPostcode(p.name, p.address, p.city, p.postcode);
    const rent = typeof p.monthlyRent === 'number' ? p.monthlyRent : (Number(p.price) || 0);

    preparedRecords.push({
      companyId,
      rawLandlord: rawLandlordName,
      sourceReference: p._id.toString(),
      name: p.name.trim(),
      propertyType: p.type || p.assetType || 'FLAT_APARTMENT',
      contractualRent: rent,
      rentFrequency: 'MONTHLY',
      status: p.status === 'Active' ? (tenantName ? 'Occupied' : 'Available') : (p.status || 'Available'),
      tenantName,
      tenancyStartDate,
      tenancyEndDate,
      addressLine1: parsedAddr.addressLine1,
      city: parsedAddr.city,
      postcode: parsedAddr.postcode,
      purchasePrice: p.price || 0,
      currentValuation: p.price || 0,
      notes: p.notes || '',
      mortgages: linkedMortgages.map((m) => ({
        sourceReference: m._id.toString(),
        lenderName: m.lenderName || 'Unknown Lender',
        accountReference: m.mortgageAccountNumber || m.mortgageReference || `MORT-${Date.now().toString().slice(-6)}`,
        originalLoanAmount: m.originalLoanAmount || m.currentOutstandingBalance || 0,
        outstandingPrincipalBalance: m.currentOutstandingBalance || 0,
        interestRate: m.interestRate || 0,
        monthlyPayment: m.monthlyPayment || 0,
      })),
    });
  }

  // Summary by company
  const summaryByCompany = {};
  VALID_COMPANY_IDS.forEach((cid) => {
    summaryByCompany[cid] = {
      count: 0,
      totalRent: 0,
      occupiedCount: 0,
      mortgagesCount: 0,
      properties: [],
    };
  });

  preparedRecords.forEach((rec) => {
    const s = summaryByCompany[rec.companyId];
    if (s) {
      s.count++;
      s.totalRent += rec.contractualRent;
      if (rec.status === 'Occupied' || rec.tenantName) s.occupiedCount++;
      s.mortgagesCount += rec.mortgages.length;
      s.properties.push(rec);
    }
  });

  console.log(`======================================================`);
  console.log(`  IMPORT PREVIEW / AUDIT SUMMARY BY COMPANY           `);
  console.log(`======================================================`);

  let grandTotalProps = 0;
  let grandTotalRent = 0;
  let grandTotalMortgages = 0;

  for (const cid of VALID_COMPANY_IDS) {
    const s = summaryByCompany[cid];
    grandTotalProps += s.count;
    grandTotalRent += s.totalRent;
    grandTotalMortgages += s.mortgagesCount;

    console.log(`\n🏢 COMPANY: [${cid}]`);
    console.log(`   Properties:       ${s.count}`);
    console.log(`   Contractual Rent: £${s.totalRent.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / month`);
    console.log(`   Occupied:         ${s.occupiedCount}`);
    console.log(`   Mortgages Linked: ${s.mortgagesCount}`);

    s.properties.forEach((p, idx) => {
      console.log(`     ${idx + 1}. [${p.propertyType}] "${p.name}" | Rent: £${p.contractualRent} | Status: ${p.status} | Tenant: "${p.tenantName || 'None'}" | Postcode: "${p.postcode}" | Mortgages: ${p.mortgages.length}`);
    });
  }

  console.log(`\n======================================================`);
  console.log(`  PORTFOLIO GRAND TOTALS`);
  console.log(`  Total Properties: ${grandTotalProps} / 48`);
  console.log(`  Total Monthly Rent: £${grandTotalRent.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Target: £99,876.00)`);
  console.log(`  Total Mortgages:  ${grandTotalMortgages}`);
  console.log(`======================================================\n`);

  if (unmappedProperties.length > 0) {
    console.warn(`[WARNING]: ${unmappedProperties.length} properties could not be mapped:`, unmappedProperties);
  }

  // Execute database writes if NOT dry run
  if (isDryRun) {
    console.log(`[DRY RUN COMPLETE]: No modifications were written to the database.`);
    console.log(`To execute live import, re-run with: node src/scripts/importLandlordVisionProperties.js\n`);
  } else {
    console.log(`[STARTING LIVE IMPORT TO DATABASE]...`);
    let createdCount = 0;
    let updatedCount = 0;
    let mortgagesCreated = 0;
    let mortgagesUpdated = 0;

    for (const rec of preparedRecords) {
      // Upsert Property strictly by companyId + sourceReference (handles multiple units at same street name)
      let propDoc = await Property.findOne({
        companyId: rec.companyId,
        sourceReference: rec.sourceReference,
      });

      if (propDoc) {
        // Update existing property
        propDoc.name = rec.name;
        propDoc.propertyType = rec.propertyType;
        propDoc.contractualRent = rec.contractualRent;
        propDoc.rentFrequency = rec.rentFrequency;
        propDoc.status = rec.status;
        propDoc.tenantName = rec.tenantName;
        propDoc.tenancyStartDate = rec.tenancyStartDate;
        propDoc.tenancyEndDate = rec.tenancyEndDate;
        propDoc.sourceReference = rec.sourceReference;
        propDoc.addressLine1 = rec.addressLine1;
        propDoc.city = rec.city;
        propDoc.postcode = rec.postcode;
        propDoc.notes = rec.notes;
        propDoc.isActive = true;
        await propDoc.save();
        updatedCount++;
      } else {
        // Create new property
        propDoc = await Property.create({
          companyId: rec.companyId,
          name: rec.name,
          propertyType: rec.propertyType,
          contractualRent: rec.contractualRent,
          rentFrequency: rec.rentFrequency,
          status: rec.status,
          tenantName: rec.tenantName,
          tenancyStartDate: rec.tenancyStartDate,
          tenancyEndDate: rec.tenancyEndDate,
          sourceReference: rec.sourceReference,
          addressLine1: rec.addressLine1,
          city: rec.city,
          postcode: rec.postcode,
          purchasePrice: rec.purchasePrice,
          currentValuation: rec.currentValuation,
          notes: rec.notes,
          isActive: true,
        });
        createdCount++;
      }

      // Upsert linked mortgages into Mortgage model
      for (const m of rec.mortgages) {
        let mortDoc = await Mortgage.findOne({
          companyId: rec.companyId,
          propertyId: propDoc._id,
          $or: [
            { accountReference: m.accountReference },
            { lenderName: m.lenderName },
          ],
        });

        if (mortDoc) {
          mortDoc.lenderName = m.lenderName;
          mortDoc.accountReference = m.accountReference;
          mortDoc.originalLoanAmount = m.originalLoanAmount;
          mortDoc.outstandingPrincipalBalance = m.outstandingPrincipalBalance;
          mortDoc.interestRate = m.interestRate;
          mortDoc.monthlyPayment = m.monthlyPayment;
          mortDoc.expectedRepaymentAmount = m.monthlyPayment;
          mortDoc.repaymentType = 'INTEREST_ONLY';
          mortDoc.status = 'ACTIVE';
          await mortDoc.save();
          mortgagesUpdated++;
        } else {
          await Mortgage.create({
            companyId: rec.companyId,
            propertyId: propDoc._id,
            lenderName: m.lenderName,
            accountReference: m.accountReference,
            originalLoanAmount: m.originalLoanAmount,
            outstandingPrincipalBalance: m.outstandingPrincipalBalance,
            interestRate: m.interestRate,
            monthlyPayment: m.monthlyPayment,
            expectedRepaymentAmount: m.monthlyPayment,
            rateType: 'FIXED',
            repaymentType: 'INTEREST_ONLY',
            status: 'ACTIVE',
          });
          mortgagesCreated++;
        }
      }
    }

    console.log(`\n======================================================`);
    console.log(`  IMPORT COMPLETE RESULTS`);
    console.log(`  Properties Created: ${createdCount}`);
    console.log(`  Properties Updated: ${updatedCount}`);
    console.log(`  Mortgages Created:  ${mortgagesCreated}`);
    console.log(`  Mortgages Updated:  ${mortgagesUpdated}`);
    console.log(`======================================================\n`);
  }

  await lvConn.close();
  await mongoose.disconnect();
}

runImport().catch((err) => {
  console.error('\n[IMPORT ERROR]:', err);
  process.exit(1);
});
