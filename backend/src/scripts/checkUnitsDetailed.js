import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Property from '../models/Property.js';
import Unit from '../models/Unit.js';

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const companyId = 'old-street';
  const properties = await Property.find({ companyId }).lean();
  for (const p of properties) {
    const units = await Unit.find({ propertyId: p._id }).lean();
    console.log(`Property: [${p._id}] "${p.name}" (Units: ${units.length})`);
    units.forEach(u => {
      console.log(`   -> Unit: [${u._id}] unitName="${u.unitName}", unitType="${u.unitType}", targetRent=${u.targetRent}`);
    });
  }
  await mongoose.disconnect();
}

check().catch(console.error);
