import mongoose from 'mongoose';
import { VALID_COMPANY_IDS } from '../config/companies.js';

/**
 * UK Property Schema
 * Supports Freehold & Leasehold properties, valuation tracking,
 * and UK statutory compliance certificates (EPC, Gas Safety, EICR).
 */
const propertySchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: [true, 'Company ID is required'],
      enum: VALID_COMPANY_IDS,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Property name/reference is required'],
      trim: true,
      index: true,
    },
    propertyCode: {
      type: String,
      trim: true,
      uppercase: true,
      sparse: true,
      index: true,
    },
    propertyType: {
      type: String,
      trim: true,
      default: 'FLAT_APARTMENT',
    },
    // Direct Property Financials & Tenancy
    contractualRent: {
      type: Number,
      default: 0,
      min: [0, 'Contractual rent cannot be negative'],
    },
    rentFrequency: {
      type: String,
      enum: ['MONTHLY', 'WEEKLY', 'QUARTERLY', 'ANNUALLY'],
      default: 'MONTHLY',
    },
    status: {
      type: String,
      trim: true,
      default: 'Available',
      index: true,
    },
    tenantName: {
      type: String,
      trim: true,
      default: '',
    },
    tenancyStartDate: {
      type: Date,
      default: null,
    },
    tenancyEndDate: {
      type: Date,
      default: null,
    },
    sourceReference: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    originalSourceId: {
      type: String,
      trim: true,
      default: '',
    },
    addressLine1: {
      type: String,
      trim: true,
      default: '',
    },
    addressLine2: {
      type: String,
      trim: true,
      default: '',
    },
    city: {
      type: String,
      trim: true,
      default: 'London',
    },
    county: {
      type: String,
      trim: true,
      default: '',
    },
    postcode: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
      index: true,
    },
    tenure: {
      type: String,
      enum: ['FREEHOLD', 'LEASEHOLD', 'SHARE_OF_FREEHOLD'],
      default: 'FREEHOLD',
    },
    leaseDetails: {
      leaseYearsRemaining: { type: Number, default: null },
      groundRentAnnual: { type: Number, default: 0 },
      serviceChargeAnnual: { type: Number, default: 0 },
    },
    ownershipEntity: {
      type: String,
      trim: true,
      default: 'Personal', // e.g. "Personal" or "PIXX Properties UK Ltd"
    },
    companyNumber: {
      type: String,
      trim: true,
      default: '',
    },
    // Valuation & Purchase Metrics
    purchasePrice: {
      type: Number,
      default: 0,
    },
    purchaseDate: {
      type: Date,
      default: null,
    },
    currentValuation: {
      type: Number,
      default: 0,
    },
    lastValuationDate: {
      type: Date,
      default: null,
    },
    // UK Statutory Compliance
    compliance: {
      epcRating: {
        type: String,
        enum: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'EXEMPT', 'PENDING', ''],
        default: 'PENDING',
      },
      epcExpiryDate: { type: Date, default: null },
      gasSafetyExpiryDate: { type: Date, default: null },
      eicrExpiryDate: { type: Date, default: null },
      councilTaxBand: {
        type: String,
        enum: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'BUSINESS_RATES', 'EXEMPT', ''],
        default: '',
      },
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

propertySchema.pre('save', function () {
  if (!this.propertyCode && this.name) {
    const clean = this.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
    const rand = Math.floor(100 + Math.random() * 900);
    this.propertyCode = `UK-${clean || 'PROP'}-${rand}`;
  }
  if (!this.addressLine1 && this.name) {
    this.addressLine1 = this.name;
  }
});

propertySchema.index({ companyId: 1, name: 1 });
propertySchema.index({ companyId: 1, propertyCode: 1 });
propertySchema.index({ companyId: 1, sourceReference: 1 });
propertySchema.index({ companyId: 1, isActive: 1 });

export const Property = mongoose.model('Property', propertySchema);
export default Property;
