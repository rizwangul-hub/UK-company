import mongoose from 'mongoose';
import { VALID_COMPANY_IDS } from '../config/companies.js';

export const DEMAND_STATUSES = [
  'DRAFT',
  'RECEIVED',
  'PARTIALLY_PAID',
  'PAID',
  'OVERDUE',
  'DISPUTED',
  'CANCELLED',
];

/**
 * Property Service Charge & Ground Rent Demand Notice Schema
 * Tracks demands raised, payment deadlines, attachments, and payment reconciliation.
 */
const propertyDemandSchema = new mongoose.Schema(
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
    payeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ServiceChargePayee',
      default: null,
      index: true,
    },
    payeeName: {
      type: String,
      required: [true, 'Payee name is required'],
      trim: true,
    },
    demandReference: {
      type: String,
      required: [true, 'Demand reference number is required'],
      trim: true,
      index: true,
    },
    issueDate: {
      type: Date,
      required: [true, 'Demand issue date is required'],
      index: true,
    },
    dueDate: {
      type: Date,
      required: [true, 'Payment due date is required'],
      index: true,
    },
    periodStart: {
      type: Date,
      default: null,
    },
    periodEnd: {
      type: Date,
      default: null,
    },
    amountDemanded: {
      type: Number,
      required: [true, 'Amount demanded is required'],
      min: [0.01, 'Amount demanded must be positive'],
    },
    totalPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    disputedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    disputeReason: {
      type: String,
      trim: true,
      default: '',
    },
    adjustments: {
      type: Number,
      default: 0, // e.g. Credit notes or discounts applied
    },
    status: {
      type: String,
      enum: DEMAND_STATUSES,
      default: 'RECEIVED',
      index: true,
    },
    // Document storage attachment (Cloudinary or safe base64 storage)
    fileUrl: {
      type: String,
      default: '',
    },
    fileName: {
      type: String,
      default: '',
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    mimeType: {
      type: String,
      default: '',
    },
    publicId: {
      type: String,
      default: '',
    },
    // Reminders triggered deduplication array (e.g. ['60d', '45d', '30d', '14d', '7d', 'overdue'])
    remindersTriggered: {
      type: [String],
      default: [],
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

propertyDemandSchema.virtual('outstandingBalance').get(function () {
  const balance = (this.amountDemanded || 0) - (this.totalPaid || 0) - (this.adjustments || 0);
  return Math.max(0, Math.round(balance * 100) / 100);
});

propertyDemandSchema.index({ companyId: 1, propertyId: 1, chargeType: 1 });
propertyDemandSchema.index({ companyId: 1, dueDate: 1 });
propertyDemandSchema.index({ companyId: 1, status: 1 });

export const PropertyDemand = mongoose.model('PropertyDemand', propertyDemandSchema);
export default PropertyDemand;
