import mongoose from 'mongoose';
import { VALID_COMPANY_IDS } from '../config/companies.js';

const aiAuditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    userName: {
      type: String,
      default: 'Authorized Operator',
    },
    companyId: {
      type: String,
      enum: [...VALID_COMPANY_IDS, 'ALL', 'GENERAL'],
      default: 'GENERAL',
      index: true,
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AIConversation',
      default: null,
    },
    approvalRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AIApprovalRequest',
      default: null,
    },
    actionType: {
      type: String,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['SUCCESS', 'REJECTED', 'FAILED', 'BLOCKED'],
      required: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    result: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    errorMessage: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

aiAuditLogSchema.index({ userId: 1, createdAt: -1 });
aiAuditLogSchema.index({ companyId: 1, createdAt: -1 });

export const AIAuditLog = mongoose.model('AIAuditLog', aiAuditLogSchema);
export default AIAuditLog;
