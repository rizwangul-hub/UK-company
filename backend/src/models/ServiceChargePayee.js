import mongoose from 'mongoose';
import { VALID_COMPANY_IDS } from '../config/companies.js';

/**
 * Service Charge & Ground Rent Payee / Managing Company Schema
 * Reusable payee records linkable to multiple properties and demands.
 */
const serviceChargePayeeSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: [true, 'Company ID is required'],
      enum: VALID_COMPANY_IDS,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Payee / Managing Company name is required'],
      trim: true,
      index: true,
    },
    companyNumber: {
      type: String,
      trim: true,
      default: '',
    },
    // Banking Details for Payment Verification (Manual payments only)
    bankName: {
      type: String,
      trim: true,
      default: '',
    },
    sortCode: {
      type: String,
      trim: true,
      default: '',
    },
    accountNumber: {
      type: String,
      trim: true,
      default: '',
    },
    iban: {
      type: String,
      trim: true,
      default: '',
    },
    // Contact details
    telephone: {
      type: String,
      trim: true,
      default: '',
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    contactPerson: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

serviceChargePayeeSchema.pre('validate', function () {
  if (!this.name && this._payeeName) {
    this.name = this._payeeName;
  }
});

serviceChargePayeeSchema
  .virtual('payeeName')
  .get(function () {
    return this.name;
  })
  .set(function (val) {
    this._payeeName = val;
    this.name = val;
  });

serviceChargePayeeSchema.index({ companyId: 1, name: 1 });

export const ServiceChargePayee = mongoose.model('ServiceChargePayee', serviceChargePayeeSchema);
export default ServiceChargePayee;
