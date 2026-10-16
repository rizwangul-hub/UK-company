import mongoose from 'mongoose';
import { VALID_COMPANY_IDS } from '../config/companies.js';

export const PAYMENT_METHODS = [
  'BANK_TRANSFER',
  'DIRECT_DEBIT',
  'CARD',
  'CASH',
  'CHEQUE',
  'OTHER',
];

/**
 * Property Service Charge & Ground Rent Payment Schema
 * Records monetary payments made against demands and integrates with central ledger & bank accounts.
 */
const propertyChargePaymentSchema = new mongoose.Schema(
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
      required: [true, 'Linked property ID is required'],
      index: true,
    },
    demandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PropertyDemand',
      required: [true, 'Linked demand notice is required'],
      index: true,
    },
    chargeType: {
      type: String,
      required: true,
      enum: ['SERVICE_CHARGE', 'GROUND_RENT'],
      index: true,
    },
    paymentDate: {
      type: Date,
      required: [true, 'Payment date is required'],
      index: true,
    },
    amountPaid: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [0.01, 'Payment amount must be positive'],
    },
    paymentMethod: {
      type: String,
      enum: PAYMENT_METHODS,
      default: 'BANK_TRANSFER',
    },
    // Source Bank or Cash Account in UK system
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
      index: true,
    },
    bankReference: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    // Receipt or proof of payment attachment
    proofFileUrl: {
      type: String,
      default: '',
    },
    proofFileName: {
      type: String,
      default: '',
    },
    proofPublicId: {
      type: String,
      default: '',
    },
    // Integration with Central Ledger & Financial Accounts
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
      index: true,
    },
    voucherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Voucher',
      default: null,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
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

propertyChargePaymentSchema.index({ companyId: 1, propertyId: 1 });
propertyChargePaymentSchema.index({ companyId: 1, paymentDate: 1 });

export const PropertyChargePayment = mongoose.model('PropertyChargePayment', propertyChargePaymentSchema);
export default PropertyChargePayment;
