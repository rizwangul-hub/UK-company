import mongoose from 'mongoose';

/**
 * UK Voucher Header Schema
 * Financial voucher record with sequential numbering and audit metadata.
 */
const voucherSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: [true, 'Company ID is required'],
      trim: true,
      lowercase: true,
      index: true,
    },
    voucherNumber: {
      type: String,
      required: [true, 'Voucher number is required'],
      trim: true,
      uppercase: true,
      index: true,
    },
    voucherDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    voucherType: {
      type: String,
      required: true,
      enum: ['RENT_RECEIPT', 'EXPENSE', 'TRANSFER', 'MORTGAGE_PAYMENT', 'ADJUSTMENT', 'OPENING_BALANCE'],
      default: 'EXPENSE',
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    reference: {
      type: String,
      trim: true,
      default: '',
    },
    receiptUrl: {
      type: String,
      trim: true,
      default: '',
    },
    receiptFilename: {
      type: String,
      trim: true,
      default: '',
    },
    documents: [
      {
        title: { type: String, default: '' },
        url: { type: String, required: true },
        docType: { type: String, default: 'RECEIPT' },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    status: {
      type: String,
      enum: ['POSTED', 'VOID'],
      default: 'POSTED',
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

voucherSchema.index({ companyId: 1, voucherNumber: 1 }, { unique: true });
voucherSchema.index({ companyId: 1, voucherDate: 1 });
voucherSchema.index({ companyId: 1, voucherType: 1 });
voucherSchema.index({ companyId: 1, status: 1 });

export const Voucher = mongoose.model('Voucher', voucherSchema);
export default Voucher;
