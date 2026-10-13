import mongoose from 'mongoose';
import { VALID_COMPANY_IDS } from '../config/companies.js';

/**
 * UK Mortgage Payment Schema
 * Records each actual mortgage payment cash outflow with exact accounting split:
 * - Interest component (P&L Finance Cost)
 * - Principal repayment component (Balance Sheet Liability Reduction)
 * - Fees and charges (P&L Bank/Lender Fee)
 */
const mortgagePaymentSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: [true, 'Company ID is required'],
      enum: VALID_COMPANY_IDS,
      index: true,
    },
    mortgageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Mortgage',
      required: true,
      index: true,
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: true,
      index: true,
    },
    paymentDate: {
      type: Date,
      required: [true, 'Payment date is required'],
      default: Date.now,
      index: true,
    },
    totalAmountPaid: {
      type: Number,
      required: [true, 'Total amount paid in GBP is required'],
      min: [0.01, 'Payment must be positive'],
    },
    interestAmount: {
      type: Number,
      required: [true, 'Interest component is required'],
      min: 0,
    },
    principalAmount: {
      type: Number,
      required: [true, 'Principal component is required'],
      min: 0,
    },
    feeAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: [true, 'Paying Bank Account is required'],
      index: true,
    },
    paymentReference: {
      type: String,
      trim: true,
      default: '',
    },
    isLenderConfirmed: {
      type: Boolean,
      default: false,
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
      index: true,
    },
    documents: [
      {
        title: { type: String, default: '' },
        url: { type: String, required: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
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

// Validate that sum of splits equals total amount paid
mortgagePaymentSchema.pre('validate', function () {
  const sum = Number((this.interestAmount || 0) + (this.principalAmount || 0) + (this.feeAmount || 0)).toFixed(2);
  const total = Number(this.totalAmountPaid || 0).toFixed(2);
  if (Math.abs(Number(sum) - Number(total)) > 0.05) {
    this.invalidate(
      'totalAmountPaid',
      `Split sum (£${sum}) does not match Total Amount Paid (£${total}). Please check Interest, Principal, and Fees.`
    );
  }
});

mortgagePaymentSchema.index({ companyId: 1, mortgageId: 1 });
mortgagePaymentSchema.index({ companyId: 1, paymentDate: 1 });

export const MortgagePayment = mongoose.model('MortgagePayment', mortgagePaymentSchema);
export default MortgagePayment;
