import mongoose from 'mongoose';
import { VALID_COMPANY_IDS } from '../config/companies.js';

/**
 * UK Tenancy Agreement Schema
 * Represents formal leases (e.g. AST, Commercial Lease, License).
 */
const tenancyAgreementSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: [true, 'Company ID is required'],
      enum: VALID_COMPANY_IDS,
      index: true,
    },
    agreementRef: {
      type: String,
      required: [true, 'Agreement reference is required'],
      trim: true,
      uppercase: true,
      index: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant is required'],
      index: true,
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: [true, 'Property is required'],
      index: true,
    },
    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Unit',
      default: null,
      index: true,
    },
    leaseType: {
      type: String,
      enum: ['AST', 'COMMERCIAL_LEASE', 'LICENSE_TO_OCCUPY', 'COMPANY_LET', 'OTHER'],
      default: 'AST',
    },
    startDate: {
      type: Date,
      required: [true, 'Tenancy start date is required'],
    },
    endDate: {
      type: Date,
      required: [true, 'Tenancy end date is required'],
    },
    rentAmount: {
      type: Number,
      required: [true, 'Rent amount in GBP is required'],
      min: [0, 'Rent cannot be negative'],
    },
    paymentFrequency: {
      type: String,
      enum: ['MONTHLY', 'QUARTERLY', 'ANNUAL', 'WEEKLY'],
      default: 'MONTHLY',
    },
    rentDueDay: {
      type: Number,
      min: 1,
      max: 31,
      default: 1,
    },
    depositAmount: {
      type: Number,
      default: 0,
    },
    depositScheme: {
      schemeName: {
        type: String,
        enum: ['DPS', 'TDS', 'MYDEPOSITS', 'NOT_REGISTERED', 'COMMERCIAL_DEPOSIT'],
        default: 'DPS',
      },
      certificateNumber: { type: String, default: '' },
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'EXPIRED', 'TERMINATED', 'PERIODIC'],
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

tenancyAgreementSchema.index({ companyId: 1, agreementRef: 1 }, { unique: true });
tenancyAgreementSchema.index({ companyId: 1, propertyId: 1 });
tenancyAgreementSchema.index({ companyId: 1, status: 1 });

export const TenancyAgreement = mongoose.model('TenancyAgreement', tenancyAgreementSchema);
export default TenancyAgreement;
