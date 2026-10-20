import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Category from '../models/Category.js';

async function checkCOA() {
  await mongoose.connect(process.env.MONGO_URI);
  const companyId = 'old-street';

  const cats = await Category.find({ companyId }).lean();
  console.log(`Total categories for ${companyId}: ${cats.length}`);

  const mainHeads = cats.filter(c => c.isMainHead || !c.parentCategoryId);
  console.log('Main Heads:', mainHeads.map(c => ({ id: c._id, name: c.name, type: c.type })));

  await mongoose.disconnect();
}

checkCOA().catch(console.error);
