import mongoose from 'mongoose';
import { VALID_COMPANY_IDS } from '../config/companies.js';

/**
 * UK Rent Payment Schema
 * Represents actual rent cash receipts deposited into a UK bank or cash account.
 */
const rentPaymentSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: [true, 'Company ID is required'],
      enum: VALID_COMPANY_IDS,
      index: true,
    },
    receiptRef: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    paymentDate: {
      type: Date,
      required: [true, 'Payment date is required'],
      default: Date.now,
      index: true,
    },
    billingMonth: {
      type: String,
      required: [true, 'Billing month (YYYY-MM) is required'],
      match: [/^\d{4}-(0[1-9]|1[0-2])$/, 'Billing month must be in YYYY-MM format'],
      index: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
      index: true,
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: true,
      index: true,
    },
    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Unit',
      default: null,
      index: true,
    },
    agreementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TenancyAgreement',
      default: null,
    },
    scheduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RentSchedule',
      default: null,
    },
    amount: {
      type: Number,
      required: [true, 'Rent payment amount in GBP is required'],
      min: [0.01, 'Payment amount must be greater than zero'],
    },
    receivingAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: [true, 'Receiving Bank/Cash Account is required'],
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ['STANDING_ORDER', 'DIRECT_DEBIT', 'BANK_TRANSFER', 'CARD', 'CASH', 'CHEQUE'],
      default: 'STANDING_ORDER',
    },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
      index: true,
    },
    notes: {
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
        docType: { type: String, default: 'RENT_RECEIPT' },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    status: {
      type: String,
      enum: ['POSTED', 'VOID'],
      default: 'POSTED',
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

rentPaymentSchema.index({ companyId: 1, receiptRef: 1 }, { unique: true });
rentPaymentSchema.index({ companyId: 1, paymentDate: 1 });
rentPaymentSchema.index({ companyId: 1, propertyId: 1 });
rentPaymentSchema.index({ companyId: 1, isDeleted: 1, paymentDate: -1 });

export const RentPayment = mongoose.model('RentPayment', rentPaymentSchema);
export default RentPayment;
