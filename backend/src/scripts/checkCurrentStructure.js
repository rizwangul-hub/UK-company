import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Property from '../models/Property.js';
import Unit from '../models/Unit.js';
import Category from '../models/Category.js';

async function checkProperties() {
  await mongoose.connect(process.env.MONGO_URI);
  const companyId = 'old-street';

  const properties = await Property.find({ companyId }).lean();
  console.log(`=== PROPERTIES FOR ${companyId} (${properties.length}) ===`);
  for (const p of properties) {
    const units = await Unit.find({ propertyId: p._id }).lean();
    console.log(`Property: [${p._id}] "${p.name}" (Code: ${p.propertyCode}, Units: ${units.length}, Parent: ${p.parentPropertyId || 'NONE'})`);
    units.forEach(u => {
      console.log(`   -> Unit: [${u._id}] "${u.unitNumber}" "${u.name || ''}"`);
    });
  }

  const categories = await Category.find({ companyId: { $in: [companyId, 'GLOBAL'] } }).lean();
  console.log(`\n=== CATEGORIES (${categories.length}) ===`);
  const catTree = {};
  categories.forEach(c => {
    const parent = c.parentHead || 'MAIN';
    if (!catTree[parent]) catTree[parent] = [];
    catTree[parent].push(`${c.name} (${c.type})`);
  });
  console.log(JSON.stringify(catTree, null, 2));

  await mongoose.disconnect();
}

checkProperties().catch(console.error);
