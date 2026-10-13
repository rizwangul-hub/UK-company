import './env.js';
import mongoose from 'mongoose';

/**
 * Connect to MongoDB with robust options and connection state caching.
 */
let connectionPromise = null;

export const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error('MONGO_URI is not defined in the environment variables.');
  }

  connectionPromise = (async () => {
    try {
      const dbName = process.env.DB_NAME || 'uk_property_finance';
      const conn = await mongoose.connect(mongoUri, {
        dbName,
        authSource: 'admin',
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 8000,
        socketTimeoutMS: 45000,
      });

      if (conn.connection.name === 'pixx_expense_tracker') {
        await mongoose.disconnect();
        throw new Error('FATAL SECURITY SHIELD: Connection to Pakistan production database blocked! UK system must use uk_property_finance.');
      }

      console.log(`[MongoDB Connected]: ${conn.connection.host} / ${conn.connection.name}`);

      // Ensure legacy unique name_1 index on categories and accounts is removed
      try {
        await conn.connection.collection('categories').dropIndex('name_1');
        console.log('[MongoDB Clean]: Dropped legacy unique index name_1 on categories.');
      } catch (e) {
        // Index may not exist or already dropped, which is expected
      }
      try {
        await conn.connection.collection('accounts').dropIndex('name_1');
        console.log('[MongoDB Clean]: Dropped legacy unique index name_1 on accounts.');
      } catch (e) {
        // Index may not exist or already dropped, which is expected
      }

      return conn;
    } catch (error) {
      connectionPromise = null;
      console.error(`[MongoDB Connection Error]: ${error.message}`);
      throw error;
    }
  })();

  return connectionPromise;
};

export default connectDB;
