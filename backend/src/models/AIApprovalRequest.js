import mongoose from 'mongoose';
import { VALID_COMPANY_IDS } from '../config/companies.js';

const aiApprovalRequestSchema = new mongoose.Schema(
  {
    approvalToken: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    companyId: {
      type: String,
      required: true,
      enum: VALID_COMPANY_IDS,
      index: true,
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AIConversation',
      default: null,
    },
    actionType: {
      type: String,
      required: true,
      enum: [
        'CREATE_EXPENSE_DRAFT',
        'CREATE_INCOME_DRAFT',
        'CREATE_PROPERTY_NOTE',
        'CREATE_MAINTENANCE_REQUEST',
        'CREATE_COMPLIANCE_REMINDER',
        'PREPARE_RECONCILIATION_ADJUSTMENT',
        'CREATE_SUPPLIER_INVOICE_DRAFT',
        'CREATE_EMAIL_DRAFT',
        'SEND_APPROVED_EMAIL',
      ],
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    summary: {
      type: String,
      default: '',
      trim: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    previewData: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ['PENDING', 'EXECUTED', 'REJECTED', 'EXPIRED', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    executedAt: {
      type: Date,
      default: null,
    },
    executionResult: {
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

export const AIApprovalRequest = mongoose.model('AIApprovalRequest', aiApprovalRequestSchema);
export default AIApprovalRequest;
