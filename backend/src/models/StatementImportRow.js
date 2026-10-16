import mongoose from 'mongoose';

/**
 * StatementImportRow Schema
 * Individual extracted bank transaction line item staged for review, classification, and posting.
 */
const statementImportRowSchema = new mongoose.Schema(
  {
    batchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StatementImportBatch',
      required: [true, 'Batch reference is required'],
      index: true,
    },
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
    rowIndex: {
      type: Number,
      required: true,
    },
    transactionDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    valueDate: {
      type: Date,
      default: null,
    },
    excelRowNumber: {
      type: Number,
      default: null,
    },
    description: {
      type: String,
      default: 'Bank Movement',
      trim: true,
    },
    originalNarrative: {
      type: String,
      trim: true,
      default: '',
    },
    head: {
      type: String,
      trim: true,
      default: '',
    },
    subHead: {
      type: String,
      trim: true,
      default: '',
    },
    reference: {
      type: String,
      trim: true,
      default: '',
    },
    amount: {
      type: Number,
      default: 0,
      min: [0, 'Amount must be non-negative'],
    },
    direction: {
      type: String,
      enum: ['IN', 'OUT'],
      required: [true, 'Direction is required'],
      index: true,
    },
    runningBalance: {
      type: Number,
      default: null,
    },
    // Classification Suggestions / User Selections
    suggestedType: {
      type: String,
      enum: ['RENT', 'EXPENSE', 'MORTGAGE_PAYMENT', 'TRANSFER', 'LOAN', 'UNCATEGORIZED'],
      default: 'UNCATEGORIZED',
      index: true,
    },
    suggestedPropertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      default: null,
      index: true,
    },
    suggestedPropertyName: {
      type: String,
      default: '',
    },
    suggestedUnitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Unit',
      default: null,
    },
    suggestedCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
    },
    suggestedCategoryName: {
      type: String,
      default: '',
    },
    suggestedHeadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
    },
    suggestedHead: {
      type: String,
      trim: true,
      default: '',
    },
    suggestedSubHeadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
    },
    suggestedSubHead: {
      type: String,
      trim: true,
      default: '',
    },
    suggestedTenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
    },
    suggestedTenantName: {
      type: String,
      default: '',
    },
    suggestedMortgageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Mortgage',
      default: null,
    },
    suggestedMortgageName: {
      type: String,
      default: '',
    },
    suggestedCounterAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Account',
      default: null,
    },
    suggestedCounterAccountName: {
      type: String,
      default: '',
    },
    confidenceScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    classificationReason: {
      type: String,
      default: '',
    },
    // Duplicate Detection
    isDuplicate: {
      type: Boolean,
      default: false,
      index: true,
    },
    duplicateReason: {
      type: String,
      default: '',
    },
    matchedTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },
    matchedTransactionSummary: {
      type: String,
      default: '',
    },
    // Row Lifecycle Status
    status: {
      type: String,
      enum: ['NEW', 'MATCHED', 'POSSIBLE_DUPLICATE', 'NEEDS_REVIEW', 'INVALID', 'APPROVED', 'POSTED', 'SKIPPED'],
      default: 'NEW',
      index: true,
    },
    validationErrors: {
      type: [String],
      default: [],
    },
    isExcluded: {
      type: Boolean,
      default: false,
      index: true,
    },
    // Ledger Posting Result
    postedTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Transaction',
      default: null,
    },
    postedVoucherNo: {
      type: String,
      default: '',
    },
    postedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

statementImportRowSchema.index({ batchId: 1, rowIndex: 1 });
statementImportRowSchema.index({ companyId: 1, accountId: 1, transactionDate: 1 });
statementImportRowSchema.index({ batchId: 1, status: 1 });

export const StatementImportRow = mongoose.model('StatementImportRow', statementImportRowSchema);
export default StatementImportRow;
