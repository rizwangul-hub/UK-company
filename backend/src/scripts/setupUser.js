import '../config/env.js';
import readline from 'readline';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

const runSetup = async () => {
  try {
    await connectDB();
    console.log('\n======================================================');
    console.log('  PIXX TECHNOLOGIES UK - SINGLE USER SETUP');
    console.log('======================================================\n');

    const existingCount = await User.countDocuments();
    if (existingCount > 0) {
      console.log('An authorized operator account already exists in this database.');
      const proceed = await question('Do you want to reset the operator password? (y/n): ');
      if (proceed.toLowerCase() !== 'y') {
        console.log('Setup aborted.');
        process.exit(0);
      }
      const newPassword = await question('Enter new password (min 6 chars): ');
      if (!newPassword || newPassword.length < 6) {
        console.log('Error: Password must be at least 6 characters.');
        process.exit(1);
      }
      const user = await User.findOne();
      user.password = newPassword;
      await user.save();
      console.log(`Password successfully updated for user: ${user.email}`);
      process.exit(0);
    }

    const name = (await question('Enter Operator Name [Authorized Operator]: ')) || 'Authorized Operator';
    const email = await question('Enter Operator Email: ');
    if (!email || !email.includes('@')) {
      console.log('Error: A valid email address is required.');
      process.exit(1);
    }

    const password = await question('Enter Password (min 6 characters): ');
    if (!password || password.length < 6) {
      console.log('Error: Password must be at least 6 characters.');
      process.exit(1);
    }

    const created = await User.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      isActive: true,
    });

    console.log(`\nAuthorized Operator successfully created:`);
    console.log(`Name:  ${created.name}`);
    console.log(`Email: ${created.email}\n`);
    process.exit(0);
  } catch (err) {
    console.error('Setup failed:', err.message);
    process.exit(1);
  } finally {
    rl.close();
  }
};

runSetup();
