import mongoose from 'mongoose';
import { VALID_COMPANY_IDS } from '../config/companies.js';

export const DOCUMENT_CATEGORIES = [
  'INSURANCE',
  'SAFETY_COMPLIANCE',
  'LEGAL_PURCHASE',
  'DRAWINGS_STRUCTURAL',
  'COUNCIL_LICENSING',
  'APPLIANCE_EQUIPMENT',
  'OTHER',
];

export const DOCUMENT_STATUSES = [
  'ACTIVE',
  'EXPIRING_SOON',
  'EXPIRED',
  'MISSING',
  'RENEWAL_REQUESTED',
  'AWAITING_COUNCIL',
  'UNDER_REVIEW',
  'ARCHIVED',
];

export const DOCUMENT_URGENCIES = [
  'NORMAL',
  'WARNING_60',
  'PRIORITY_45',
  'APPROACHING_30',
  'URGENT_14',
  'CRITICAL_7',
  'EXPIRED',
  'MISSING',
];

const documentVersionSchema = new mongoose.Schema(
  {
    version: { type: Number, required: true },
    fileUrl: { type: String, default: '' },
    cloudinaryAssetId: { type: String, default: '' },
    fileName: { type: String, default: '' },
    fileSize: { type: Number, default: 0 },
    mimeType: { type: String, default: '' },
    issueDate: { type: Date, default: null },
    expiryDate: { type: Date, default: null },
    provider: { type: String, default: '' },
    referenceNumber: { type: String, default: '' },
    archivedAt: { type: Date, default: Date.now },
    archivedBy: { type: String, default: 'Authorized User' },
    notes: { type: String, default: '' },
  },
  { _id: true }
);

const propertyDocumentSchema = new mongoose.Schema(
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
    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Unit',
      default: null,
      index: true,
    },
    category: {
      type: String,
      required: [true, 'Document category is required'],
      enum: DOCUMENT_CATEGORIES,
      index: true,
    },
    subCategory: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Document title is required'],
      trim: true,
    },
    fileUrl: {
      type: String,
      trim: true,
      default: '',
    },
    cloudinaryAssetId: {
      type: String,
      trim: true,
      default: '',
    },
    fileName: {
      type: String,
      trim: true,
      default: '',
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    mimeType: {
      type: String,
      trim: true,
      default: '',
    },
    isMissing: {
      type: Boolean,
      default: false,
      index: true,
    },
    issueDate: {
      type: Date,
      default: null,
    },
    expiryDate: {
      type: Date,
      default: null,
      index: true,
    },
    provider: {
      type: String,
      trim: true,
      default: '',
    },
    referenceNumber: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: DOCUMENT_STATUSES,
      default: 'ACTIVE',
      index: true,
    },
    urgency: {
      type: String,
      enum: DOCUMENT_URGENCIES,
      default: 'NORMAL',
    },
    version: {
      type: Number,
      default: 1,
    },
    versionHistory: [documentVersionSchema],
    remindersTriggered: {
      type: [String],
      default: [],
    },
    lastReminderSentAt: {
      type: Date,
      default: null,
    },
    linkedCouncilApplicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CouncilApplication',
      default: null,
    },
    linkedApplianceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appliance',
      default: null,
    },
    uploadedBy: {
      type: String,
      trim: true,
      default: 'Authorized User',
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
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

propertyDocumentSchema.index({ companyId: 1, propertyId: 1, category: 1 });
propertyDocumentSchema.index({ companyId: 1, expiryDate: 1 });
propertyDocumentSchema.index({ companyId: 1, status: 1 });
propertyDocumentSchema.index({ companyId: 1, isMissing: 1 });

export const PropertyDocument = mongoose.model('PropertyDocument', propertyDocumentSchema);
export default PropertyDocument;
