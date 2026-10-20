import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Category from '../models/Category.js';

async function checkSubCats() {
  await mongoose.connect(process.env.MONGO_URI);
  const companyId = 'old-street';

  const cats = await Category.find({ companyId }).lean();
  const parentMap = {};
  cats.forEach(c => {
    if (c.parentCategoryId) {
      const p = String(c.parentCategoryId);
      if (!parentMap[p]) parentMap[p] = [];
      parentMap[p].push(c.name);
    }
  });

  const mainHeads = cats.filter(c => c.isMainHead || ['Income', 'Admin Expenses', 'Interest Expenses', 'Loan', 'Others', 'Property Purchase'].includes(c.name));
  for (const m of mainHeads) {
    console.log(`[${m.name}] (ID: ${m._id}):`, parentMap[String(m._id)] || []);
  }

  await mongoose.disconnect();
}

checkSubCats().catch(console.error);
