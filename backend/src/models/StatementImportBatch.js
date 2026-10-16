import mongoose from 'mongoose';

/**
 * StatementImportBatch Schema
 * Tracks bank statement upload batches, header metadata, verification balances, and overall import status.
 */
const statementImportBatchSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: [true, 'Company ID is required'],
      trim: true,
      lowercase: true,
      index: true,
    },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      required: [true, 'Bank Account is required'],
      index: true,
    },
    filename: {
      type: String,
      required: [true, 'Original filename is required'],
      trim: true,
    },
    fileHash: {
      type: String,
      required: [true, 'File SHA-256 hash is required'],
      index: true,
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    statementPeriodStart: {
      type: Date,
      default: null,
    },
    statementPeriodEnd: {
      type: Date,
      default: null,
    },
    openingBalance: {
      type: Number,
      default: null,
    },
    closingBalance: {
      type: Number,
      default: null,
    },
    totalRows: {
      type: Number,
      default: 0,
    },
    newRows: {
      type: Number,
      default: 0,
    },
    matchedRows: {
      type: Number,
      default: 0,
    },
    duplicateRows: {
      type: Number,
      default: 0,
    },
    postedRows: {
      type: Number,
      default: 0,
    },
    skippedRows: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'READY', 'PARTIALLY_POSTED', 'POSTED', 'CANCELLED'],
      default: 'DRAFT',
      index: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    uploadedByName: {
      type: String,
      default: 'System Operator',
    },
    columnMapping: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

statementImportBatchSchema.index({ companyId: 1, accountId: 1, createdAt: -1 });
statementImportBatchSchema.index({ companyId: 1, fileHash: 1 });

export const StatementImportBatch = mongoose.model('StatementImportBatch', statementImportBatchSchema);
export default StatementImportBatch;
