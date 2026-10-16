import mongoose from 'mongoose';
import { VALID_COMPANY_IDS } from '../config/companies.js';

/**
 * UK Financial Transaction Audit Log Schema
 * Complete, immutable ledger tracking all creations, edits, soft-deletions,
 * restorations, and reversals across all 6 UK companies.
 */
const auditLogSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: [true, 'Company ID is required'],
      enum: VALID_COMPANY_IDS,
      index: true,
    },
    entityType: {
      type: String,
      required: true,
      enum: ['TRANSACTION', 'RENT_PAYMENT', 'MORTGAGE_PAYMENT', 'PROPERTY_CHARGE_PAYMENT', 'ACCOUNT_TRANSFER'],
      default: 'TRANSACTION',
      index: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    voucherNo: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: ['CREATED', 'EDITED', 'DELETED', 'RESTORED', 'REVERSED'],
      index: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    performedByName: {
      type: String,
      default: 'System Operator',
      trim: true,
    },
    reason: {
      type: String,
      default: '',
      trim: true,
    },
    changes: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    snapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

auditLogSchema.index({ companyId: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ companyId: 1, action: 1, createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
export default AuditLog;
