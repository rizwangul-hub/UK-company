import mongoose from 'mongoose';
import { VALID_COMPANY_IDS } from '../config/companies.js';

/**
 * UK Mortgage Facility Schema
 * Tracks property loan facilities, lender terms, interest rate periods,
 * and outstanding principal liability.
 */
const mortgageSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: [true, 'Company ID is required'],
      enum: VALID_COMPANY_IDS,
      index: true,
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: [true, 'Linked property is required'],
      index: true,
    },
    lenderName: {
      type: String,
      required: [true, 'Lender or Provider name is required (e.g. Nationwide, Paragon, BM Solutions)'],
      trim: true,
    },
    accountReference: {
      type: String,
      required: [true, 'Mortgage account reference number is required'],
      trim: true,
      index: true,
    },
    originalLoanAmount: {
      type: Number,
      required: [true, 'Original mortgage amount is required'],
      min: [1, 'Original loan amount must be positive'],
    },
    outstandingPrincipalBalance: {
      type: Number,
      required: [true, 'Outstanding principal balance is required'],
      min: [0, 'Principal balance cannot be negative'],
    },
    lastConfirmedBalance: {
      type: Number,
      default: null,
    },
    lastConfirmedDate: {
      type: Date,
      default: null,
    },
    interestRate: {
      type: Number,
      required: [true, 'Annual interest rate is required (percentage, e.g. 4.85)'],
      min: [0, 'Interest rate cannot be negative'],
    },
    rateType: {
      type: String,
      enum: ['FIXED', 'VARIABLE', 'TRACKER', 'STANDARD_VARIABLE'],
      default: 'FIXED',
    },
    fixedRateExpiryDate: {
      type: Date,
      default: null,
      index: true,
    },
    rateReviewDate: {
      type: Date,
      default: null,
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    maturityDate: {
      type: Date,
      default: () => new Date(Date.now() + 25 * 365.25 * 24 * 60 * 60 * 1000),
    },
    termYears: {
      type: Number,
      default: 25,
      min: 1,
    },
    repaymentType: {
      type: String,
      enum: ['CAPITAL_REPAYMENT', 'INTEREST_ONLY', 'PART_AND_PART', 'CAPITAL_AND_INTEREST'],
      default: 'INTEREST_ONLY',
    },
    paymentFrequency: {
      type: String,
      enum: ['MONTHLY', 'QUARTERLY'],
      default: 'MONTHLY',
    },
    expectedRepaymentAmount: {
      type: Number,
      default: 0,
      min: [0, 'Expected repayment cannot be negative'],
    },
    nextPaymentDueDate: {
      type: Date,
      default: null,
    },
    paymentAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
    },
    documents: [
      {
        title: { type: String, default: '' },
        url: { type: String, required: true },
        docType: { type: String, default: 'MORTGAGE_OFFER' },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    status: {
      type: String,
      enum: ['ACTIVE', 'OFFER', 'REDEEMED', 'INACTIVE'],
      default: 'ACTIVE',
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

// Virtual: Estimated Loan-to-Value (LTV) %
mortgageSchema.virtual('ltv').get(function () {
  return 0; // Derived with property valuation
});

mortgageSchema.index({ companyId: 1, propertyId: 1 });
mortgageSchema.index({ companyId: 1, status: 1 });

export const Mortgage = mongoose.model('Mortgage', mortgageSchema);
export default Mortgage;
