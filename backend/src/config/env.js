import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicit, absolute canonical path to the UK backend's own .env file
export const UK_BACKEND_DIR = path.resolve(__dirname, '../..');
export const UK_ENV_PATH = path.resolve(UK_BACKEND_DIR, '.env');

let isLoaded = false;
if (fs.existsSync(UK_ENV_PATH)) {
  const loadResult = dotenv.config({ path: UK_ENV_PATH, override: true });
  if (loadResult.error) {
    console.warn(`[Env Warning]: Could not load UK .env at ${UK_ENV_PATH}: ${loadResult.error.message}`);
  } else {
    isLoaded = true;
    console.log(`[Env Loaded Successfully]: Strictly using UK environment from: ${UK_ENV_PATH}`);
  }
} else {
  // Running in cloud / Vercel serverless where environment variables are directly injected
  isLoaded = Boolean(process.env.MONGO_URI);
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[Env Runtime]: Injected cloud environment variables active (Vercel/Production).`);
  }
}

// Security guard: Ensure we are NEVER pointed at the Pakistan database
if (process.env.DB_NAME === 'pixx_expense_tracker') {
  console.error('[SECURITY ERROR]: Detected Pakistan database name in UK environment. Resetting to uk_property_finance.');
  process.env.DB_NAME = 'uk_property_finance';
}

export default {
  UK_ENV_PATH,
  UK_BACKEND_DIR,
  isLoaded,
};
