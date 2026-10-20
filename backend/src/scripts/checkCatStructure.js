import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Category from '../models/Category.js';

async function checkCats() {
  await mongoose.connect(process.env.MONGO_URI);
  const companyId = 'old-street';
  const cats = await Category.find({ companyId: { $in: [companyId, 'GLOBAL'] } }).lean();
  console.log(`Found ${cats.length} categories:`);
  console.log(cats.slice(0, 10).map(c => ({
    id: c._id,
    name: c.name,
    type: c.type,
    isMainHead: c.isMainHead,
    parentCategoryId: c.parentCategoryId,
    parentHead: c.parentHead,
    subHeads: c.subHeads,
    companyId: c.companyId,
  })));
  await mongoose.disconnect();
}

checkCats().catch(console.error);
