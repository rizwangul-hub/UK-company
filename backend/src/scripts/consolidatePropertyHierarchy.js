import './../config/env.js';
import mongoose from 'mongoose';
import Property from '../models/Property.js';
import Unit from '../models/Unit.js';
import Transaction from '../models/Transaction.js';
import Mortgage from '../models/Mortgage.js';
import RentSchedule from '../models/RentSchedule.js';
import RentPayment from '../models/RentPayment.js';
import TenancyAgreement from '../models/TenancyAgreement.js';
import PropertyChargeConfig from '../models/PropertyChargeConfig.js';
import PropertyDocument from '../models/PropertyDocument.js';
import StatementImportRow from '../models/StatementImportRow.js';

const COMPANY_ID = 'old-street';

async function runMigration() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB. Starting property portfolio consolidation for company:', COMPANY_ID);

  // 1. Initial State Audit
  const initialProps = await Property.find({ companyId: COMPANY_ID }).lean();
  const initialTxCount = await Transaction.countDocuments({ companyId: COMPANY_ID });
  const initialTxWithPropCount = await Transaction.countDocuments({ companyId: COMPANY_ID, propertyId: { $ne: null } });
  const initialRentTotal = initialProps.reduce((sum, p) => sum + (p.contractualRent || 0), 0);

  console.log(`Initial Properties count: ${initialProps.length}`);
  console.log(`Initial Transactions total: ${initialTxCount} (with property: ${initialTxWithPropCount})`);
  console.log(`Initial Total Contractual Rent: £${initialRentTotal}`);

  // Clear existing Unit records for old-street to allow clean idempotent creation
  const deletedUnits = await Unit.deleteMany({ companyId: COMPANY_ID });
  console.log(`Cleared ${deletedUnits.deletedCount} existing Unit records for clean build.`);

  // Define Multi-Unit Groups configuration
  // For each group:
  // - parentId: the ObjectId of the property document to keep and rename
  // - parentName: correct canonical name
  // - parentType: 'COMMERCIAL_RESIDENTIAL_MIXED' or 'MULTI_UNIT_RESIDENTIAL'
  // - units: array of unit definitions, with sourcePropertyIds (from which txs, tenancies, schedules will be mapped)
  // - removePropertyIds: IDs of properties merged into this parent that should be deleted after data re-linking
  const multiUnitGroups = [
    {
      groupKey: '62_orsett_road',
      parentId: '6acd0d824ccab36d6191c1ae', // formerly '62 Orset Road'
      parentName: '62 Orsett Road',
      parentType: 'COMMERCIAL_RESIDENTIAL_MIXED',
      removePropertyIds: ['6acd0d4cfb0d7a49d437db02'], // '62A Orsett Road'
      units: [
        {
          unitName: '62 Orsett Road (Shop)',
          unitType: 'RETAIL_SHOP',
          targetRent: 2000,
          status: 'OCCUPIED',
          sourcePropertyId: '6acd0d824ccab36d6191c1ae',
        },
        {
          unitName: '62A Orsett Road (Flat)',
          unitType: 'FLAT',
          targetRent: 1600,
          status: 'OCCUPIED',
          sourcePropertyId: '6acd0d4cfb0d7a49d437db02',
        },
      ],
    },
    {
      groupKey: '26_clarence_road',
      parentId: '6acd0d4cfb0d7a49d437db01', // formerly '26 Calarane Road -shop'
      parentName: '26 Clarence Road',
      parentType: 'COMMERCIAL_RESIDENTIAL_MIXED',
      removePropertyIds: ['6acd0d814ccab36d6191c1a7'], // '26 Calarane Road-flat'
      units: [
        {
          unitName: '26 Clarence Road (Shop)',
          unitType: 'RETAIL_SHOP',
          targetRent: 1667,
          status: 'OCCUPIED',
          sourcePropertyId: '6acd0d4cfb0d7a49d437db01',
        },
        {
          unitName: '26 Clarence Road (Flat)',
          unitType: 'FLAT',
          targetRent: 1500,
          status: 'OCCUPIED',
          sourcePropertyId: '6acd0d814ccab36d6191c1a7',
        },
      ],
    },
    {
      groupKey: '127_southend_road',
      parentId: '6acd0d824ccab36d6191c1af', // formerly '127 Southend Road' (Flat)
      parentName: '127 Southend Road',
      parentType: 'COMMERCIAL_RESIDENTIAL_MIXED',
      removePropertyIds: ['6acd0dd09b1350807a8c673d'], // '127 Southend Road' (Shop)
      units: [
        {
          unitName: '127 Southend Road (Shop)',
          unitType: 'RETAIL_SHOP',
          targetRent: 1667,
          status: 'OCCUPIED',
          sourcePropertyId: '6acd0dd09b1350807a8c673d',
        },
        {
          unitName: '127 Southend Road (Flat)',
          unitType: 'FLAT',
          targetRent: 1200,
          status: 'OCCUPIED',
          sourcePropertyId: '6acd0d824ccab36d6191c1af',
        },
      ],
    },
    {
      groupKey: '10_12_cromwell_road',
      parentId: '6acd0d844ccab36d6191c1ba', // formerly '10A-12A Cromwell Road'
      parentName: '10-12 Cromwell Road',
      parentType: 'MULTI_UNIT_RESIDENTIAL',
      removePropertyIds: [
        '6acd0d884ccab36d6191c1c6', // 10 Cromwell Road Ground Floor
        '6acd0d864ccab36d6191c1c0', // 12 Cromwell Road Ground Floor
        '6acd0d874ccab36d6191c1c2', // 10 B Cromwell Road Ground Floor
        '6acd0d874ccab36d6191c1c4', // 12 B Cromwell Road Ground Floor
      ],
      units: [
        {
          unitName: '10 Cromwell Road Ground Floor',
          unitType: 'FLAT',
          targetRent: 1550,
          status: 'OCCUPIED',
          sourcePropertyId: '6acd0d884ccab36d6191c1c6',
        },
        {
          unitName: '12 Cromwell Road Ground Floor',
          unitType: 'FLAT',
          targetRent: 1550,
          status: 'OCCUPIED',
          sourcePropertyId: '6acd0d864ccab36d6191c1c0',
        },
        {
          unitName: '10 B Cromwell Road Ground Floor',
          unitType: 'FLAT',
          targetRent: 1400,
          status: 'OCCUPIED',
          sourcePropertyId: '6acd0d874ccab36d6191c1c2',
        },
        {
          unitName: '12 B Cromwell Road Ground Floor',
          unitType: 'FLAT',
          targetRent: 1450,
          status: 'OCCUPIED',
          sourcePropertyId: '6acd0d874ccab36d6191c1c4',
        },
        {
          unitName: '10A-12A Cromwell Road',
          unitType: 'FLAT',
          targetRent: 3500,
          status: 'OCCUPIED',
          sourcePropertyId: '6acd0d844ccab36d6191c1ba',
        },
      ],
    },
    {
      groupKey: '13_15_clarence_road',
      parentId: '6acd0d854ccab36d6191c1be', // formerly '13 Clarance Road'
      parentName: '13/15 Clarence Road',
      parentType: 'COMMERCIAL_RESIDENTIAL_MIXED',
      removePropertyIds: [
        '6acd0d854ccab36d6191c1bd', // 15 Claracne Road
        '6acd0d834ccab36d6191c1b4', // 13 A ,15 A & 15 B Claracne Road
      ],
      units: [
        {
          unitName: '13 Clarence Road',
          unitType: 'RETAIL_SHOP',
          targetRent: 2167,
          status: 'OCCUPIED',
          sourcePropertyId: '6acd0d854ccab36d6191c1be',
        },
        {
          unitName: '15 Clarence Road',
          unitType: 'RETAIL_SHOP',
          targetRent: 2667,
          status: 'OCCUPIED',
          sourcePropertyId: '6acd0d854ccab36d6191c1bd',
        },
        {
          unitName: '13A, 15A & 15B Clarence Road',
          unitType: 'FLAT',
          targetRent: 4100,
          status: 'OCCUPIED',
          sourcePropertyId: '6acd0d834ccab36d6191c1b4',
        },
      ],
    },
    {
      groupKey: '12_alexandra_street',
      parentId: '6acd0d4cfb0d7a49d437db00', // formerly '12 Alexandra Street'
      parentName: '12 Alexandra Street',
      parentType: 'COMMERCIAL_RESIDENTIAL_MIXED',
      removePropertyIds: ['6acd0d844ccab36d6191c1b8'], // '12A,12B, 12C, 12D Alexandra Street-'
      units: [
        {
          unitName: '12 Alexandra Street',
          unitType: 'RETAIL_SHOP',
          targetRent: 925,
          status: 'OCCUPIED',
          sourcePropertyId: '6acd0d4cfb0d7a49d437db00',
        },
        {
          unitName: '12A, 12B, 12C, 12D Alexandra Street',
          unitType: 'FLAT',
          targetRent: 4500,
          status: 'OCCUPIED',
          sourcePropertyId: '6acd0d844ccab36d6191c1b8',
        },
      ],
    },
  ];

  // Define Single-Unit Properties
  const singleUnitProperties = [
    {
      propertyId: '6acd0d814ccab36d6191c1a8',
      name: '7 Vansittart Street',
      propertyType: 'FLAT_APARTMENT',
      unitType: 'FLAT',
      contractualRent: 1200,
    },
    {
      propertyId: '6acd0d814ccab36d6191c1aa',
      name: '73 Lakewalk',
      propertyType: 'Residential',
      unitType: 'OTHER',
      contractualRent: 1550,
    },
    {
      propertyId: '6acd0d824ccab36d6191c1ac',
      name: '31 Morley Avenue',
      propertyType: 'FLAT_APARTMENT',
      unitType: 'FLAT',
      contractualRent: 2600,
    },
    {
      propertyId: '6acd0d824ccab36d6191c1b0',
      name: '65 Lansbury Avenue',
      propertyType: 'FLAT_APARTMENT',
      unitType: 'FLAT',
      contractualRent: 2700,
    },
    {
      propertyId: '6acd0d834ccab36d6191c1b2',
      name: '124 Millard Terrace',
      propertyType: 'FLAT_APARTMENT',
      unitType: 'FLAT',
      contractualRent: 1650,
    },
    {
      propertyId: '6acd0d834ccab36d6191c1b6',
      name: '82 Como Street', // Clean casing from '82 COMO STREET'
      propertyType: 'FLAT_APARTMENT',
      unitType: 'FLAT',
      contractualRent: 2500,
    },
    {
      propertyId: '6acd0d8a4ccab36d6191c1cf',
      name: '104 Pretoria Road',
      propertyType: 'RESIDENTIAL_TERRACED',
      unitType: 'OTHER',
      contractualRent: 2600,
    },
  ];

  // Process Multi-Unit Groups
  for (const group of multiUnitGroups) {
    console.log(`\n--- Processing Multi-Unit Group: ${group.parentName} ---`);
    const parentObjectId = new mongoose.Types.ObjectId(group.parentId);
    const totalGroupRent = group.units.reduce((s, u) => s + u.targetRent, 0);

    // Update parent property document
    await Property.updateOne(
      { _id: parentObjectId },
      {
        $set: {
          name: group.parentName,
          propertyType: group.parentType,
          contractualRent: totalGroupRent,
          status: 'Occupied',
        },
      }
    );

    // Create Units and remap linked collections
    for (const unitDef of group.units) {
      const sourcePropObjectId = new mongoose.Types.ObjectId(unitDef.sourcePropertyId);

      // Create Unit document
      const unitDoc = await Unit.create({
        companyId: COMPANY_ID,
        propertyId: parentObjectId,
        unitName: unitDef.unitName,
        unitType: unitDef.unitType,
        targetRent: unitDef.targetRent,
        status: unitDef.status,
        isActive: true,
      });

      console.log(`  Created Unit: "${unitDoc.unitName}" (ID: ${unitDoc._id}) on Parent: ${group.parentName}`);

      // 1. Remap Transactions
      const txRes = await Transaction.updateMany(
        { companyId: COMPANY_ID, propertyId: sourcePropObjectId },
        { $set: { propertyId: parentObjectId, unitId: unitDoc._id } }
      );
      console.log(`    Updated ${txRes.modifiedCount} Transactions to parent property & unit`);

      // 2. Remap RentSchedules
      const schedRes = await RentSchedule.updateMany(
        { companyId: COMPANY_ID, propertyId: sourcePropObjectId },
        { $set: { propertyId: parentObjectId, unitId: unitDoc._id } }
      );
      console.log(`    Updated ${schedRes.modifiedCount} RentSchedules`);

      // 3. Remap RentPayments
      const payRes = await RentPayment.updateMany(
        { companyId: COMPANY_ID, propertyId: sourcePropObjectId },
        { $set: { propertyId: parentObjectId, unitId: unitDoc._id } }
      );
      console.log(`    Updated ${payRes.modifiedCount} RentPayments`);

      // 4. Remap TenancyAgreements
      const tenRes = await TenancyAgreement.updateMany(
        { companyId: COMPANY_ID, propertyId: sourcePropObjectId },
        { $set: { propertyId: parentObjectId, unitId: unitDoc._id } }
      );
      console.log(`    Updated ${tenRes.modifiedCount} TenancyAgreements`);

      // 5. Remap PropertyChargeConfig
      const chargeRes = await PropertyChargeConfig.updateMany(
        { companyId: COMPANY_ID, propertyId: sourcePropObjectId },
        { $set: { propertyId: parentObjectId } }
      );
      if (chargeRes.modifiedCount > 0) {
        console.log(`    Updated ${chargeRes.modifiedCount} PropertyChargeConfigs`);
      }

      // 6. Remap PropertyDocument
      const docRes = await PropertyDocument.updateMany(
        { companyId: COMPANY_ID, propertyId: sourcePropObjectId },
        { $set: { propertyId: parentObjectId } }
      );
      if (docRes.modifiedCount > 0) {
        console.log(`    Updated ${docRes.modifiedCount} PropertyDocuments`);
      }

      // 7. Remap StatementImportRow
      const importRes = await StatementImportRow.updateMany(
        { companyId: COMPANY_ID, suggestedPropertyId: sourcePropObjectId },
        { $set: { suggestedPropertyId: parentObjectId, suggestedUnitId: unitDoc._id, suggestedPropertyName: group.parentName } }
      );
      if (importRes.modifiedCount > 0) {
        console.log(`    Updated ${importRes.modifiedCount} StatementImportRows`);
      }

      // 8. Remap Mortgages
      const mtgRes = await Mortgage.updateMany(
        { companyId: COMPANY_ID, propertyId: sourcePropObjectId },
        { $set: { propertyId: parentObjectId } }
      );
      if (mtgRes.modifiedCount > 0) {
        console.log(`    Remapped ${mtgRes.modifiedCount} Mortgages to parent`);
      }
    }

    // Deduplicate redundant mortgages on this parent
    const parentMortgages = await Mortgage.find({ companyId: COMPANY_ID, propertyId: parentObjectId });
    const seenRefs = new Set();
    for (const m of parentMortgages) {
      const key = `${m.lenderName}_${m.accountReference}_${m.outstandingPrincipalBalance}`;
      if (seenRefs.has(key)) {
        console.log(`    Removing duplicate mortgage: ${m.lenderName} (${m.accountReference}) ID: ${m._id}`);
        await Mortgage.deleteOne({ _id: m._id });
      } else {
        seenRefs.add(key);
      }
    }

    // Delete redundant merged property records
    for (const removeId of group.removePropertyIds) {
      const delRes = await Property.deleteOne({ _id: new mongoose.Types.ObjectId(removeId) });
      console.log(`  Removed merged sibling property doc ID: ${removeId} (deleted: ${delRes.deletedCount})`);
    }
  }

  // Process Single-Unit Properties
  console.log('\n--- Processing Single-Unit Properties ---');
  for (const single of singleUnitProperties) {
    const propObjectId = new mongoose.Types.ObjectId(single.propertyId);

    // Update property name / casing
    await Property.updateOne(
      { _id: propObjectId },
      {
        $set: {
          name: single.name,
          propertyType: single.propertyType,
          contractualRent: single.contractualRent,
        },
      }
    );

    // Create 1 Unit record for consistency across the application
    const unitDoc = await Unit.create({
      companyId: COMPANY_ID,
      propertyId: propObjectId,
      unitName: single.name,
      unitType: single.unitType,
      targetRent: single.contractualRent,
      status: 'OCCUPIED',
      isActive: true,
    });

    console.log(`  Created Unit: "${unitDoc.unitName}" (ID: ${unitDoc._id}) for Property: ${single.name}`);

    // Update transactions for this property with unitId
    const txRes = await Transaction.updateMany(
      { companyId: COMPANY_ID, propertyId: propObjectId, unitId: null },
      { $set: { unitId: unitDoc._id } }
    );
    console.log(`    Updated ${txRes.modifiedCount} Transactions with unitId`);

    // Update rent schedules with unitId
    const schedRes = await RentSchedule.updateMany(
      { companyId: COMPANY_ID, propertyId: propObjectId, unitId: null },
      { $set: { unitId: unitDoc._id } }
    );
    console.log(`    Updated ${schedRes.modifiedCount} RentSchedules with unitId`);

    // Update tenancies with unitId
    const tenRes = await TenancyAgreement.updateMany(
      { companyId: COMPANY_ID, propertyId: propObjectId, unitId: null },
      { $set: { unitId: unitDoc._id } }
    );
    console.log(`    Updated ${tenRes.modifiedCount} TenancyAgreements with unitId`);
  }

  // Final Verification
  console.log('\n================ FINAL VERIFICATION ================');
  const finalProps = await Property.find({ companyId: COMPANY_ID }).sort({ name: 1 }).lean();
  const finalUnits = await Unit.find({ companyId: COMPANY_ID }).lean();
  const finalTxCount = await Transaction.countDocuments({ companyId: COMPANY_ID });
  const finalTxWithPropCount = await Transaction.countDocuments({ companyId: COMPANY_ID, propertyId: { $ne: null } });
  const finalTxWithUnitCount = await Transaction.countDocuments({ companyId: COMPANY_ID, unitId: { $ne: null } });
  const finalRentTotal = finalProps.reduce((sum, p) => sum + (p.contractualRent || 0), 0);
  const finalMortgages = await Mortgage.find({ companyId: COMPANY_ID }).lean();

  console.log(`Final Properties count: ${finalProps.length} (Expected: 13)`);
  console.log(`Final Units count: ${finalUnits.length} (6 multi-unit with 16 units + 7 single-unit with 7 units = 23 units)`);
  console.log(`Final Transactions total: ${finalTxCount} (Initial: ${initialTxCount})`);
  console.log(`Final Transactions with propertyId: ${finalTxWithPropCount} (Initial: ${initialTxWithPropCount})`);
  console.log(`Final Transactions with unitId: ${finalTxWithUnitCount}`);
  console.log(`Final Total Contractual Rent: £${finalRentTotal} (Initial: £${initialRentTotal})`);
  console.log(`Final Mortgages count: ${finalMortgages.length}`);

  console.log('\n--- Final Consolidated Properties in old-street ---');
  for (const p of finalProps) {
    const propUnits = finalUnits.filter(u => u.propertyId.toString() === p._id.toString());
    const propTxs = await Transaction.countDocuments({ companyId: COMPANY_ID, propertyId: p._id });
    const propMtgs = finalMortgages.filter(m => m.propertyId?.toString() === p._id.toString());
    console.log(`• "${p.name}" (${p.propertyType}) | Rent: £${p.contractualRent} | Units: ${propUnits.length} [${propUnits.map(u => u.unitName).join(', ')}] | Txs: ${propTxs} | Mortgages: ${propMtgs.length}`);
  }

  // Assertions
  if (finalProps.length !== 13) {
    throw new Error(`Expected exactly 13 properties, but found ${finalProps.length}`);
  }
  if (finalTxCount !== initialTxCount) {
    throw new Error(`Transaction count mismatch! Expected ${initialTxCount}, got ${finalTxCount}`);
  }
  if (finalRentTotal !== initialRentTotal) {
    throw new Error(`Total contractual rent mismatch! Expected ${initialRentTotal}, got ${finalRentTotal}`);
  }

  console.log('\n SUCCESS: Property portfolio consolidation and hierarchy migration completed flawlessly!');
  await mongoose.disconnect();
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
