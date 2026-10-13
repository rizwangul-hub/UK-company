import mongoose from 'mongoose';
import '../config/env.js';

async function checkUkCollections() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected to: ${mongoose.connection.host} / ${mongoose.connection.name}`);

  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('\n--- UK EXPENSE TRACKER COLLECTIONS ---');
  for (const c of collections) {
    const count = await mongoose.connection.db.collection(c.name).countDocuments();
    console.log(`- ${c.name}: ${count} docs`);
  }

  await mongoose.disconnect();
}

checkUkCollections().catch(console.error);
