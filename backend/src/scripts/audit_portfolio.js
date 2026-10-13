import mongoose from 'mongoose';
import '../config/env.js';
import Property from '../models/Property.js';
import { VALID_COMPANY_IDS } from '../config/companies.js';

async function auditPortfolio() {
  await mongoose.connect(process.env.MONGO_URI);

  for (const cid of VALID_COMPANY_IDS) {
    const props = await Property.find({ companyId: cid }).lean();
    const totalRent = props.reduce((sum, p) => sum + (p.contractualRent || 0), 0);
    const occupied = props.filter(p => p.status === 'Occupied' || p.tenantName);
    console.log(`\n🏢 COMPANY: [${cid}] | Props: ${props.length} | Monthly Rent: £${totalRent} | Occupied: ${occupied.length}`);
    props.forEach(p => {
      console.log(`   - "${p.name}" | Status: ${p.status} | Rent: £${p.contractualRent} | Tenant: "${p.tenantName || 'None'}"`);
    });
  }

  await mongoose.disconnect();
}

auditPortfolio().catch(console.error);
