import '../config/env.js';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import Property from '../models/Property.js';
import Unit from '../models/Unit.js';
import Tenant from '../models/Tenant.js';
import TenancyAgreement from '../models/TenancyAgreement.js';

async function check() {
  await connectDB();
  console.log('[DB] Connected to UK DB');

  const units = await Unit.find({ companyId: 'old-street' }).lean();
  console.log('Old Street Units count:', units.length);
  units.forEach(u => console.log({ id: u._id, name: u.unitName, propId: u.propertyId, rent: u.targetRent, status: u.status }));

  const tenancies = await TenancyAgreement.find({ companyId: 'old-street' })
    .populate('tenantId', 'fullName')
    .populate('propertyId', 'name')
    .lean();
  console.log('\nOld Street Tenancies count:', tenancies.length);
  tenancies.forEach(t => console.log({
    id: t._id,
    ref: t.agreementRef,
    prop: t.propertyId?.name,
    tenant: t.tenantId?.fullName,
    rent: t.rentAmount,
    start: t.startDate,
    end: t.endDate,
    status: t.status
  }));

  const allOldStreetProps = await Property.find({ companyId: 'old-street' }).lean();
  console.log('\nAll Old Street properties:');
  allOldStreetProps.forEach(p => console.log({
    id: p._id,
    name: p.name,
    propertyType: p.propertyType,
    contractualRent: p.contractualRent,
    status: p.status,
    tenantName: p.tenantName,
    tenancyStartDate: p.tenancyStartDate,
    tenancyEndDate: p.tenancyEndDate
  }));

  await mongoose.disconnect();
}

check().catch(e => {
  console.error('[FATAL]', e);
  process.exit(1);
});
