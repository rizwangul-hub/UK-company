import '../config/env.js';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from '../config/db.js';
import { VALID_COMPANY_IDS, isValidCompanyId } from '../config/companies.js';

import Property from '../models/Property.js';
import Unit from '../models/Unit.js';
import Tenant from '../models/Tenant.js';
import TenancyAgreement from '../models/TenancyAgreement.js';
import RentSchedule from '../models/RentSchedule.js';
import RentPayment from '../models/RentPayment.js';
import Mortgage from '../models/Mortgage.js';
import MortgagePayment from '../models/MortgagePayment.js';
import Account from '../models/Account.js';
import Category from '../models/Category.js';
import Transaction from '../models/Transaction.js';
import Voucher from '../models/Voucher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODELS = [
  { name: 'Property', model: Property },
  { name: 'Unit', model: Unit },
  { name: 'Tenant', model: Tenant },
  { name: 'TenancyAgreement', model: TenancyAgreement },
  { name: 'RentSchedule', model: RentSchedule },
  { name: 'RentPayment', model: RentPayment },
  { name: 'Mortgage', model: Mortgage },
  { name: 'MortgagePayment', model: MortgagePayment },
  { name: 'Account', model: Account },
  { name: 'Category', model: Category },
  { name: 'Transaction', model: Transaction },
  { name: 'Voucher', model: Voucher },
];

function printHelp() {
  console.log(`
===================================================================
  UK EXPENSE TRACKER - MULTI-COMPANY DATA BACKFILL / MIGRATION TOOL
===================================================================
Usage:
  node src/scripts/backfillCompanyData.js [options]

Options:
  --dry-run                 Simulate scan and report unassigned records without altering data.
  --backup                  Dump unassigned records to timestamped JSON files prior to updating.
  --target-company=<id>     Target company ID to assign unassigned records to.
                            Valid IDs: ${VALID_COMPANY_IDS.join(', ')}
  --help                    Show this help screen.

Examples:
  node src/scripts/backfillCompanyData.js --dry-run
  node src/scripts/backfillCompanyData.js --backup --target-company=old-street
===================================================================
`);
}

async function runBackfill() {
  const args = process.argv.slice(2);
  const isHelp = args.includes('--help') || args.includes('-h');
  if (isHelp) {
    printHelp();
    process.exit(0);
  }

  const isDryRun = args.includes('--dry-run');
  const doBackup = args.includes('--backup');
  const targetCompanyArg = args.find((a) => a.startsWith('--target-company='));
  const targetCompany = targetCompanyArg ? targetCompanyArg.split('=')[1]?.trim().toLowerCase() : null;

  if (!isDryRun) {
    if (!targetCompany) {
      console.error('ERROR: Missing required --target-company=<id> flag for live execution.');
      console.error(`Valid company IDs are: ${VALID_COMPANY_IDS.join(', ')}`);
      console.error('Use --dry-run to inspect counts without changing data.');
      process.exit(1);
    }
    if (!isValidCompanyId(targetCompany)) {
      console.error(`ERROR: "${targetCompany}" is not a recognized UK company ID.`);
      console.error(`Allowed values: ${VALID_COMPANY_IDS.join(', ')}`);
      process.exit(1);
    }
  }

  console.log(`\n======================================================`);
  console.log(`  UK Multi-Company Data Backfill & Audit Strategy`);
  console.log(`  Mode:           ${isDryRun ? 'DRY RUN (Read-Only Simulation)' : 'LIVE MIGRATION'}`);
  console.log(`  Backup Enabled: ${doBackup ? 'YES' : 'NO'}`);
  console.log(`  Target Company: ${targetCompany || '(N/A - dry run inspection)'}`);
  console.log(`======================================================\n`);

  await connectDB();

  const unassignedFilter = {
    $or: [
      { companyId: { $exists: false } },
      { companyId: null },
      { companyId: '' },
    ],
  };

  const report = [];
  let totalUnassignedAcrossAll = 0;

  for (const { name, model } of MODELS) {
    const totalDocs = await model.countDocuments({});
    const unassignedCount = await model.countDocuments(unassignedFilter);
    totalUnassignedAcrossAll += unassignedCount;

    report.push({
      Collection: name,
      TotalDocuments: totalDocs,
      UnassignedRecords: unassignedCount,
      Status: unassignedCount === 0 ? 'Fully Isolated' : 'Requires Migration',
    });
  }

  console.table(report);
  console.log(`Total unassigned legacy records across all collections: ${totalUnassignedAcrossAll}\n`);

  if (totalUnassignedAcrossAll === 0) {
    console.log('✓ All records already have strict companyId isolation. No migration necessary.');
    await mongoose.disconnect();
    process.exit(0);
  }

  if (isDryRun) {
    console.log('[DRY RUN COMPLETE]: No data was altered. Run with --backup --target-company=<id> to perform live migration.');
    await mongoose.disconnect();
    process.exit(0);
  }

  // Backup step
  if (doBackup) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.resolve(__dirname, `../../backups/pre-migration-${timestamp}`);
    fs.mkdirSync(backupDir, { recursive: true });
    console.log(`[Backup]: Creating JSON backup directory at: ${backupDir}`);

    for (const { name, model } of MODELS) {
      const recordsToBackup = await model.find(unassignedFilter).lean();
      if (recordsToBackup.length > 0) {
        const filePath = path.join(backupDir, `${name}.json`);
        fs.writeFileSync(filePath, JSON.stringify(recordsToBackup, null, 2), 'utf-8');
        console.log(`  ✓ Backed up ${recordsToBackup.length} unassigned ${name} records to ${name}.json`);
      }
    }
    console.log('[Backup]: Completed successfully.\n');
  }

  // Live Migration step
  console.log(`[Migrating]: Assigning companyId = "${targetCompany}" to all unassigned records...`);
  for (const { name, model } of MODELS) {
    const res = await model.updateMany(unassignedFilter, { $set: { companyId: targetCompany } });
    console.log(`  ✓ ${name}: updated ${res.modifiedCount} records to company "${targetCompany}".`);
  }

  console.log(`\n✓ Backfill migration completed successfully! All records now tagged with companyId: "${targetCompany}".`);
  await mongoose.disconnect();
  process.exit(0);
}

runBackfill().catch((err) => {
  console.error('Fatal Migration Error:', err);
  mongoose.disconnect().finally(() => process.exit(1));
});
