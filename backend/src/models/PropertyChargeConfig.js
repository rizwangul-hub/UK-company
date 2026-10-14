import mongoose from 'mongoose';
import { VALID_COMPANY_IDS } from '../config/companies.js';

/**
 * Property-Specific Service Charge & Ground Rent Configuration Schema
 * Independent settings for Service Charge and Ground Rent per property.
 */
const changeHistoryItemSchema = new mongoose.Schema(
  {
    changedAt: { type: Date, default: Date.now },
    field: { type: String, required: true },
    oldValue: { type: mongoose.Schema.Types.Mixed },
    newValue: { type: mongoose.Schema.Types.Mixed },
    reason: { type: String, default: '' },
    changedBy: { type: String, default: 'Authorized User' },
  },
  { _id: true }
);

const propertyChargeConfigSchema = new mongoose.Schema(
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
    chargeType: {
      type: String,
      required: true,
      enum: ['SERVICE_CHARGE', 'GROUND_RENT'],
      index: true,
    },
    isEnabled: {
      type: Boolean,
      default: false,
    },
    payeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ServiceChargePayee',
      default: null,
      index: true,
    },
    payeeName: {
      type: String,
      trim: true,
      default: '',
    },
    expectedAmount: {
      type: Number,
      default: 0,
      min: [0, 'Expected amount cannot be negative'],
    },
    paymentFrequency: {
      type: String,
      enum: ['ANNUAL', 'HALF_YEARLY', 'QUARTERLY', 'MONTHLY', 'ONE_OFF'],
      default: 'ANNUAL',
    },
    nextExpectedDemandDate: {
      type: Date,
      default: null,
    },
    normalDueDateTerms: {
      type: String,
      trim: true,
      default: '30 days from demand notice date',
    },
    referenceNumber: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    changeHistory: [changeHistoryItemSchema],
  },
  {
    timestamps: true,
  }
);

propertyChargeConfigSchema.index({ companyId: 1, propertyId: 1, chargeType: 1 }, { unique: true });

export const PropertyChargeConfig = mongoose.model('PropertyChargeConfig', propertyChargeConfigSchema);
export default PropertyChargeConfig;
