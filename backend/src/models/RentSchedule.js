import mongoose from 'mongoose';
import { VALID_COMPANY_IDS } from '../config/companies.js';

/**
 * UK Rent Schedule Schema
 * Represents the expected rent billing ledger generated from an active tenancy agreement.
 */
const rentScheduleSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: [true, 'Company ID is required'],
      enum: VALID_COMPANY_IDS,
      index: true,
    },
    agreementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TenancyAgreement',
      default: null,
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
    billingMonth: {
      type: String,
      required: true,
      match: [/^\d{4}-(0[1-9]|1[0-2])$/, 'Billing month must be in YYYY-MM format'],
      index: true,
    },
    dueDate: {
      type: Date,
      required: true,
      index: true,
    },
    expectedAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    outstandingAmount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['PENDING', 'PARTIAL', 'PAID', 'OVERDUE'],
      default: 'PENDING',
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

rentScheduleSchema.pre('save', function () {
  this.outstandingAmount = Math.max(0, this.expectedAmount - (this.paidAmount || 0));
  if (this.paidAmount >= this.expectedAmount) {
    this.status = 'PAID';
  } else if (this.paidAmount > 0) {
    this.status = 'PARTIAL';
  } else {
    const isPastDue = new Date(this.dueDate) < new Date();
    this.status = isPastDue ? 'OVERDUE' : 'PENDING';
  }
});

rentScheduleSchema.index({ companyId: 1, billingMonth: 1 });
rentScheduleSchema.index({ companyId: 1, agreementId: 1, billingMonth: 1 });
rentScheduleSchema.index({ companyId: 1, propertyId: 1, billingMonth: 1 });
rentScheduleSchema.index({ companyId: 1, status: 1 });

export const RentSchedule = mongoose.model('RentSchedule', rentScheduleSchema);
export default RentSchedule;
