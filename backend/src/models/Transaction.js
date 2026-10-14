import mongoose from 'mongoose';

/**
 * UK Transaction Schema
 * Central master journal ledger for all monetary movements.
 * Enforces clean separation between Bank Liquidity accounts and Nominal Category heads.
 */
const transactionSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: [true, 'Company ID is required'],
      trim: true,
      lowercase: true,
      index: true,
    },
    transactionDate: {
      type: Date,
      required: [true, 'Transaction date is required'],
      index: true,
    },
    voucherNo: {
      type: String,
      required: [true, 'Voucher number is required'],
      trim: true,
      index: true,
    },
    voucherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Voucher',
      default: null,
      index: true,
    },
    transactionType: {
      type: String,
      required: true,
      enum: ['INCOME', 'EXPENSE', 'TRANSFER', 'MORTGAGE_PAYMENT', 'CAPITAL_ADJUSTMENT'],
      default: 'EXPENSE',
      index: true,
    },
    // Primary Bank or Cash account impacted
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: [true, 'Bank or Cash Account is required'],
      index: true,
    },
    // Counter account for internal transfers (Bank <-> Bank or Bank <-> Cash)
    counterAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
      index: true,
    },
    // Nominal Chart of Accounts head
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Transaction amount is required'],
      min: [0.01, 'Amount must be positive'],
    },
    // 'IN' = Money received into account; 'OUT' = Money disbursed from account
    direction: {
      type: String,
      required: true,
      enum: ['IN', 'OUT'],
      default: 'OUT',
      index: true,
    },
    // Allocation Links
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      default: null,
      index: true,
    },
    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Unit',
      default: null,
      index: true,
    },
    mortgageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Mortgage',
      default: null,
      index: true,
    },
    // Accrual / Billing period (YYYY-MM)
    periodMonth: {
      type: String,
      match: [/^\d{4}-(0[1-9]|1[0-2])$/, 'Period month must be YYYY-MM'],
      default: null,
      index: true,
    },
    narration: {
      type: String,
      required: [true, 'Narration / description is required'],
      trim: true,
    },
    reference: {
      type: String,
      trim: true,
      default: '',
    },
    receiptUrl: {
      type: String,
      trim: true,
      default: '',
    },
    receiptFilename: {
      type: String,
      trim: true,
      default: '',
    },
    documents: [
      {
        title: { type: String, default: '' },
        url: { type: String, required: true },
        docType: { type: String, default: 'RECEIPT' },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    status: {
      type: String,
      enum: ['POSTED', 'VOID', 'REVERSED'],
      default: 'POSTED',
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Strategic Indexes for rapid search and reporting
transactionSchema.index({ companyId: 1, transactionDate: 1, accountId: 1 });
transactionSchema.index({ companyId: 1, transactionDate: 1, propertyId: 1 });
transactionSchema.index({ companyId: 1, transactionType: 1, transactionDate: 1 });
transactionSchema.index({ companyId: 1, voucherNo: 1 });
transactionSchema.index({ companyId: 1, status: 1 });

export const Transaction = mongoose.model('Transaction', transactionSchema);
export default Transaction;
