import mongoose from 'mongoose';
import '../config/env.js';
import RentSchedule from '../models/RentSchedule.js';
import Property from '../models/Property.js';

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB Atlas');

  const total = await RentSchedule.countDocuments();
  console.log('Total schedules:', total);

  const byCompanyMonth = await RentSchedule.aggregate([
    { $group: { _id: { companyId: '$companyId', month: '$billingMonth' }, count: { $sum: 1 } } },
    { $sort: { '_id.month': -1 } }
  ]);
  console.log('Schedules by company & month:', JSON.stringify(byCompanyMonth, null, 2));

  const props = await Property.aggregate([
    { $group: { _id: '$companyId', count: { $sum: 1 } } }
  ]);
  console.log('Properties by company:', props);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
