import mongoose from 'mongoose';
import '../config/env.js';
import RentSchedule from '../models/RentSchedule.js';
import Property from '../models/Property.js';
import TenancyAgreement from '../models/TenancyAgreement.js';
import { VALID_COMPANY_IDS } from '../config/companies.js';

const BASELINE_MONTH = '2026-10';

async function main() {
  console.log(`Starting Rent Baseline Reset to ${BASELINE_MONTH}...`);
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✓ Connected to MongoDB Atlas');

  // 1. Delete all unpaid/overdue schedules strictly before BASELINE_MONTH
  const deleteResult = await RentSchedule.deleteMany({
    billingMonth: { $lt: BASELINE_MONTH },
    status: { $ne: 'PAID' },
  });
  console.log(`✓ Purged ${deleteResult.deletedCount} legacy unpaid/overdue schedules prior to ${BASELINE_MONTH}`);

  // 2. Also check if any schedules exist with billingMonth < BASELINE_MONTH that are marked PAID
  const keptPaid = await RentSchedule.countDocuments({
    billingMonth: { $lt: BASELINE_MONTH },
  });
  console.log(`✓ Preserved ${keptPaid} historical paid schedules for accounting integrity`);

  // 3. For all 6 companies, generate/ensure a clean BASELINE_MONTH schedule for each active property
  let createdCount = 0;
  let updatedCount = 0;

  for (const companyId of VALID_COMPANY_IDS) {
    const properties = await Property.find({
      companyId,
      isActive: true,
      contractualRent: { $gt: 0 },
    }).lean();

    console.log(`Processing company ${companyId} (${properties.length} active rent properties)...`);

    for (const prop of properties) {
      // Find active tenancy agreement if any
      const agreement = await TenancyAgreement.findOne({
        companyId,
        propertyId: prop._id,
        status: 'ACTIVE',
      }).lean();

      const dueDate = new Date(Date.UTC(2026, 9, 1)); // 2026-10-01
      const expectedAmount = agreement?.rentAmount || prop.contractualRent || 0;
      const tenantId = agreement?.tenantId || null;
      const notes = prop.tenantName ? `Tenant: ${prop.tenantName}` : '';

      let schedule = await RentSchedule.findOne({
        companyId,
        propertyId: prop._id,
        billingMonth: BASELINE_MONTH,
      });

      if (!schedule) {
        await RentSchedule.create({
          companyId,
          agreementId: agreement?._id || null,
          tenantId,
          propertyId: prop._id,
          unitId: null,
          billingMonth: BASELINE_MONTH,
          dueDate,
          expectedAmount,
          paidAmount: 0,
          outstandingAmount: expectedAmount,
          status: 'PENDING',
          notes,
        });
        createdCount++;
      } else {
        // Ensure status is PENDING (not overdue) if unpaid during current month
        if (schedule.status === 'OVERDUE') {
          schedule.status = 'PENDING';
          await schedule.save();
          updatedCount++;
        }
      }
    }
  }

  console.log(`\n✓ Baseline ${BASELINE_MONTH} schedules created: ${createdCount}, updated: ${updatedCount}`);

  // Verify total schedules for BASELINE_MONTH
  const octTotal = await RentSchedule.countDocuments({ billingMonth: BASELINE_MONTH });
  console.log(`✓ Total schedules on record for ${BASELINE_MONTH}: ${octTotal}`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
