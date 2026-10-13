import mongoose from 'mongoose';
import { VALID_COMPANY_IDS } from '../config/companies.js';

const receiptDocumentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    url: { type: String, required: true },
    docType: {
      type: String,
      enum: ['PURCHASE_RECEIPT', 'CARE_REPAIR_PLAN', 'INVOICE', 'DIRECT_DEBIT_MANDATE', 'DELIVERY_NOTE', 'OTHER'],
      default: 'PURCHASE_RECEIPT',
    },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const supplierReceiptSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: [true, 'Company ID is required'],
      enum: VALID_COMPANY_IDS,
      index: true,
    },
    supplier: {
      type: String,
      required: [true, 'Supplier name is required'],
      trim: true,
      default: 'Currys',
      index: true,
    },
    branch: {
      type: String,
      trim: true,
      default: '',
    },
    receiptNumber: {
      type: String,
      required: [true, 'Receipt or invoice number is required'],
      trim: true,
      index: true,
    },
    receiptDate: {
      type: Date,
      required: [true, 'Receipt date is required'],
      default: Date.now,
    },
    totalAmountDueGBP: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Total amount cannot be negative'],
    },
    paymentInformation: {
      method: {
        type: String,
        enum: ['CARD', 'DIRECT_DEBIT', 'SPLIT_CARD_DIRECT_DEBIT', 'BANK_TRANSFER', 'CASH', 'INVOICE_CREDIT', 'OTHER'],
        default: 'SPLIT_CARD_DIRECT_DEBIT',
      },
      cardPaymentGBP: {
        type: Number,
        default: 0,
      },
      directDebitMandate: {
        hasMandate: { type: Boolean, default: false },
        monthlyInstalmentGBP: { type: Number, default: 0 },
        numberOfInstalments: { type: Number, default: 0 },
        totalMandateGBP: { type: Number, default: 0 },
      },
      notes: {
        type: String,
        trim: true,
        default: '',
      },
    },
    // Explicit guard: Receipts are source records and must NOT generate bank transactions automatically
    financialLedgerStatus: {
      type: String,
      enum: ['SOURCE_RECORD_ONLY', 'MANUALLY_RECONCILED', 'IGNORED'],
      default: 'SOURCE_RECORD_ONLY',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    documents: [receiptDocumentSchema],
    isVerified: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

supplierReceiptSchema.index({ companyId: 1, receiptNumber: 1 });
supplierReceiptSchema.index({ companyId: 1, supplier: 1 });
supplierReceiptSchema.index({ companyId: 1, receiptDate: -1 });

export const SupplierReceipt = mongoose.model('SupplierReceipt', supplierReceiptSchema);
export default SupplierReceipt;
