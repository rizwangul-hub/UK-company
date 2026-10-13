import mongoose from 'mongoose';

/**
 * UK Account Schema
 * Liquidity accounts (UK Bank Accounts and Petty Cash in Hand).
 * All monetary amounts denominated in GBP (£).
 */
const accountSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: [true, 'Company ID is required'],
      trim: true,
      lowercase: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Account name is required'],
      trim: true,
      index: true,
    },
    accountType: {
      type: String,
      required: true,
      enum: ['BANK', 'CASH'],
      default: 'BANK',
      index: true,
    },
    bankName: {
      type: String,
      trim: true,
      default: '',
    },
    sortCode: {
      type: String,
      trim: true,
      default: '', // e.g. "20-00-00"
    },
    accountNumber: {
      type: String,
      trim: true,
      default: '', // UK 8-digit account number
    },
    iban: {
      type: String,
      trim: true,
      default: '',
    },
    currency: {
      type: String,
      default: 'GBP',
      uppercase: true,
    },
    openingBalance: {
      type: Number,
      required: [true, 'Opening balance is required'],
      default: 0,
    },
    openingBalanceDate: {
      type: Date,
      default: () => new Date('2026-04-06T00:00:00.000Z'), // UK Tax Year start
    },
    currentBalance: {
      type: Number,
      required: true,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

accountSchema.index({ companyId: 1, name: 1 }, { unique: true });
accountSchema.index({ companyId: 1, accountType: 1 });
accountSchema.index({ companyId: 1, isActive: 1 });

export const Account = mongoose.model('Account', accountSchema);
export default Account;
