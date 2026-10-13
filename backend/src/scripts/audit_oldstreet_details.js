import mongoose from 'mongoose';
import '../config/env.js';
import Property from '../models/Property.js';
import RentSchedule from '../models/RentSchedule.js';
import RentPayment from '../models/RentPayment.js';
import TenancyAgreement from '../models/TenancyAgreement.js';

async function auditOldStreet() {
  await mongoose.connect(process.env.MONGO_URI);

  const props = await Property.find({ companyId: 'old-street', isActive: true }).sort({ createdAt: 1 }).lean();
  console.log(`Found ${props.length} Old Street properties:`);

  for (let i = 0; i < props.length; i++) {
    const p = props[i];
    const scheds = await RentSchedule.find({ companyId: 'old-street', propertyId: p._id }).lean();
    const payments = await RentPayment.find({ companyId: 'old-street', propertyId: p._id }).lean();
    const agreements = await TenancyAgreement.find({ companyId: 'old-street', propertyId: p._id }).lean();

    const totalExpected = scheds.reduce((s, x) => s + (x.expectedAmount || 0), 0);
    const totalPaid = payments.reduce((s, x) => s + (x.amount || 0), 0);
    const totalOutstanding = scheds.reduce((s, x) => s + (x.outstandingAmount || 0), 0);

    console.log(`${i + 1}. "${p.name}" | Rent: £${p.contractualRent} | Type: ${p.propertyType} | Status: ${p.status} | Tenant: "${p.tenantName || 'None'}" | Scheds: ${scheds.length} | Due: £${totalExpected} | Paid: £${totalPaid} | Arrears: £${totalOutstanding}`);
  }

  await mongoose.disconnect();
}

auditOldStreet().catch(console.error);
