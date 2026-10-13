import mongoose from 'mongoose';
import '../config/env.js';
import Property from '../models/Property.js';
import Mortgage from '../models/Mortgage.js';
import { VALID_COMPANY_IDS } from '../config/companies.js';

async function verifyDatabaseImport() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected to: ${mongoose.connection.host} / ${mongoose.connection.name}`);

  console.log(`\n======================================================`);
  console.log(`  POST-IMPORT DATABASE VERIFICATION AUDIT              `);
  console.log(`======================================================\n`);

  let grandTotalProps = 0;
  let grandTotalRent = 0;
  let grandTotalMortgages = 0;
  let grandTotalDebt = 0;

  for (const companyId of VALID_COMPANY_IDS) {
    const props = await Property.find({ companyId, isActive: true }).lean();
    const mortgs = await Mortgage.find({ companyId, status: 'ACTIVE' }).lean();

    const companyRent = props.reduce((sum, p) => sum + (p.contractualRent || 0), 0);
    const companyDebt = mortgs.reduce((sum, m) => sum + (m.outstandingPrincipalBalance || 0), 0);

    grandTotalProps += props.length;
    grandTotalRent += companyRent;
    grandTotalMortgages += mortgs.length;
    grandTotalDebt += companyDebt;

    console.log(`🏢 COMPANY: [${companyId}]`);
    console.log(`   Properties:       ${props.length}`);
    console.log(`   Contractual Rent: £${companyRent.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / month`);
    console.log(`   Active Mortgages: ${mortgs.length} (Total Debt: £${companyDebt.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`);
  }

  // Check legacy unassigned records
  const unassignedProps = await Property.find({
    $or: [{ companyId: { $exists: false } }, { companyId: null }, { companyId: '' }],
  }).lean();

  console.log(`\n======================================================`);
  console.log(`  PORTFOLIO RECONCILIATION SUMMARY:`);
  console.log(`  Total Active Properties: ${grandTotalProps} / 48 target`);
  console.log(`  Total Monthly Rent Roll: £${grandTotalRent.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (Target: £99,876.00)`);
  console.log(`  Total Active Mortgages:  ${grandTotalMortgages}`);
  console.log(`  Total Mortgage Debt:     £${grandTotalDebt.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  console.log(`  Quarantined Unassigned:  ${unassignedProps.length} properties remain safely quarantined`);
  console.log(`======================================================\n`);

  await mongoose.disconnect();
}

verifyDatabaseImport().catch(console.error);
