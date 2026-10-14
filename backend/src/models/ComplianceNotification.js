import mongoose from 'mongoose';
import { VALID_COMPANY_IDS } from '../config/companies.js';

export const NOTIFICATION_TYPES = [
  'EXPIRY_WARNING_60',
  'EXPIRY_PRIORITY_45',
  'EXPIRY_APPROACHING_30',
  'EXPIRY_URGENT_14',
  'EXPIRY_CRITICAL_7',
  'DOCUMENT_EXPIRED',
  'DOCUMENT_MISSING',
  'COUNCIL_DEADLINE_APPROACHING',
  'COUNCIL_DEADLINE_OVERDUE',
  'RENEWAL_REQUIRED',
];

export const NOTIFICATION_URGENCIES = ['INFO', 'WARNING', 'PRIORITY', 'URGENT', 'CRITICAL'];

const complianceNotificationSchema = new mongoose.Schema(
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
      required: [true, 'Property ID is required'],
      index: true,
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PropertyDocument',
      default: null,
      index: true,
    },
    councilApplicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CouncilApplication',
      default: null,
      index: true,
    },
    type: {
      type: String,
      required: [true, 'Notification type is required'],
      enum: NOTIFICATION_TYPES,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Message is required'],
      trim: true,
    },
    urgency: {
      type: String,
      enum: NOTIFICATION_URGENCIES,
      default: 'INFO',
      index: true,
    },
    deadline: {
      type: Date,
      default: null,
      index: true,
    },
    actionUrl: {
      type: String,
      default: '',
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    isDismissed: {
      type: Boolean,
      default: false,
      index: true,
    },
    pushedToBrowser: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

complianceNotificationSchema.index({ companyId: 1, isRead: 1 });
complianceNotificationSchema.index({ companyId: 1, type: 1, documentId: 1 });
complianceNotificationSchema.index({ companyId: 1, type: 1, councilApplicationId: 1 });

export const ComplianceNotification = mongoose.model('ComplianceNotification', complianceNotificationSchema);
export default ComplianceNotification;
