import mongoose from 'mongoose';
import { VALID_COMPANY_IDS } from '../config/companies.js';

export const COUNCIL_APPLICATION_TYPES = [
  'HMO_LICENCE',
  'SELECTIVE_LICENCE',
  'ADDITIONAL_LICENCE',
  'PLANNING_PERMISSION',
  'BUILDING_CONTROL',
  'CHANGE_OF_USE',
  'LISTED_BUILDING_CONSENT',
  'OTHER',
];

export const COUNCIL_APPLICATION_STATUSES = [
  'OUTSTANDING',
  'IN_PROGRESS',
  'SUBMITTED',
  'AWAITING_COUNCIL',
  'INFORMATION_REQUESTED',
  'APPROVED',
  'REJECTED',
  'RENEWAL_REQUESTED',
  'COMPLETED',
  'ARCHIVED',
];

const correspondenceItemSchema = new mongoose.Schema(
  {
    date: { type: Date, default: Date.now },
    type: {
      type: String,
      enum: ['INCOMING_LETTER', 'OUTGOING_EMAIL', 'INSPECTION_REPORT', 'FEE_PAYMENT', 'NOTICE', 'DECISION', 'NOTE'],
      default: 'NOTE',
    },
    summary: { type: String, required: true, trim: true },
    senderOrRecipient: { type: String, default: '' },
    referenceNumber: { type: String, default: '' },
    fileUrl: { type: String, default: '' },
    fileName: { type: String, default: '' },
    recordedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const councilApplicationSchema = new mongoose.Schema(
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
    applicationType: {
      type: String,
      required: [true, 'Application type is required'],
      enum: COUNCIL_APPLICATION_TYPES,
      default: 'HMO_LICENCE',
      index: true,
    },
    applicationReference: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    councilName: {
      type: String,
      trim: true,
      required: [true, 'Council authority name is required'],
      default: 'Local Authority Council',
    },
    title: {
      type: String,
      required: [true, 'Application title is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    submissionDate: {
      type: Date,
      default: null,
    },
    responseDeadline: {
      type: Date,
      default: null,
      index: true,
    },
    decisionDate: {
      type: Date,
      default: null,
    },
    lastCommunicationDate: {
      type: Date,
      default: null,
    },
    nextFollowUpDate: {
      type: Date,
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: COUNCIL_APPLICATION_STATUSES,
      default: 'SUBMITTED',
      index: true,
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM',
    },
    feePaid: {
      type: Number,
      default: 0,
    },
    outcomeNotes: {
      type: String,
      trim: true,
      default: '',
    },
    correspondence: [correspondenceItemSchema],
    linkedDocumentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PropertyDocument',
      default: null,
    },
    remindersTriggered: {
      type: [String],
      default: [],
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

councilApplicationSchema.index({ companyId: 1, propertyId: 1 });
councilApplicationSchema.index({ companyId: 1, responseDeadline: 1 });
councilApplicationSchema.index({ companyId: 1, status: 1 });

export const CouncilApplication = mongoose.model('CouncilApplication', councilApplicationSchema);
export default CouncilApplication;
