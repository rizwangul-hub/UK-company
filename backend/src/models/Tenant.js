import mongoose from 'mongoose';
import { VALID_COMPANY_IDS } from '../config/companies.js';

/**
 * UK Tenant Schema
 * Residential and Commercial tenant records.
 */
const tenantSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: [true, 'Company ID is required'],
      enum: VALID_COMPANY_IDS,
      index: true,
    },
    fullName: {
      type: String,
      required: [true, 'Tenant full name is required'],
      trim: true,
      index: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: '',
    },
    phone: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    currentAddress: {
      type: String,
      trim: true,
      default: '',
    },
    postcode: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
    },
    tenantType: {
      type: String,
      enum: ['INDIVIDUAL', 'COMPANY'],
      default: 'INDIVIDUAL',
    },
    companyName: {
      type: String,
      trim: true,
      default: '',
    },
    companyNumber: {
      type: String,
      trim: true,
      default: '',
    },
    emergencyContact: {
      name: { type: String, default: '' },
      phone: { type: String, default: '' },
      relationship: { type: String, default: '' },
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

tenantSchema.index({ companyId: 1, fullName: 1 });
tenantSchema.index({ companyId: 1, phone: 1 });
tenantSchema.index({ companyId: 1, isActive: 1 });

export const Tenant = mongoose.model('Tenant', tenantSchema);
export default Tenant;
