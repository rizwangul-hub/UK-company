import mongoose from 'mongoose';
import { VALID_COMPANY_IDS } from '../config/companies.js';

export const TENANT_STANDARD_DOCUMENTS = [
  { name: 'EPC', hasExpiryDate: true, description: 'Energy Performance Certificate' },
  { name: 'EICR', hasExpiryDate: true, description: 'Electrical Installation Condition Report' },
  { name: 'Floor Plan', hasExpiryDate: false, description: 'Architectural / Layout Plan' },
  { name: 'Tenancy Agreement', hasExpiryDate: true, description: 'Signed AST Agreement' },
  { name: 'Tenant ID - 1', hasExpiryDate: false, description: 'Primary ID (Driving Licence / Photo ID)' },
  { name: 'Tenant ID - 2', hasExpiryDate: false, description: 'Secondary Identification Document' },
  { name: 'Tenant ID - 3', hasExpiryDate: false, description: 'Tertiary Identification Document' },
  { name: 'Tenant Passports', hasExpiryDate: false, description: 'Passport Copy / Identity Verification' },
  { name: 'Anti Social Behavior', hasExpiryDate: false, description: 'ASB Policy Agreement & Acknowledgment' },
  { name: 'How to Rent', hasExpiryDate: false, description: 'UK Government How to Rent Checklist' },
  { name: 'Renters Rights Act', hasExpiryDate: false, description: 'Renters Rights Statutory Notice' },
  { name: 'DPS', hasExpiryDate: false, description: 'Deposit Protection Service Prescribed Information' },
  { name: 'Rent Protection Insurance', hasExpiryDate: true, description: 'Rent Guarantee & Legal Protection Policy' },
  { name: 'Tenant Payslips', hasExpiryDate: false, description: 'Recent Employment Income Proof / Payslips' },
  { name: 'Tenant Bank Statement', hasExpiryDate: false, description: 'Recent Bank Statements / Financial Proof' },
  { name: 'Right to Rent Check', hasExpiryDate: true, description: 'Home Office Statutory Right to Rent Check' },
  { name: 'Gas Certificate', hasExpiryDate: true, description: 'Annual CP12 Gas Safety Record' },
  { name: 'Other Document', hasExpiryDate: false, description: 'Miscellaneous Supporting Document' },
  { name: 'Property Picture', hasExpiryDate: false, description: 'Inventory & Tenancy Check-In Photographs' },
];

const tenantDocumentSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: [true, 'Company ID is required'],
      enum: VALID_COMPANY_IDS,
      index: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    documentName: {
      type: String,
      required: [true, 'Document name is required'],
      trim: true,
    },
    documentType: {
      type: String,
      enum: ['standard', 'custom'],
      default: 'standard',
    },
    fileUrl: {
      type: String,
      required: [true, 'File URL or storage reference is required'],
    },
    publicId: {
      type: String,
      default: '',
    },
    originalFileName: {
      type: String,
      default: '',
    },
    fileType: {
      type: String,
      default: '',
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    expiryDate: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: '',
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

tenantDocumentSchema.index({ companyId: 1, tenantId: 1, documentName: 1 });
tenantDocumentSchema.index({ companyId: 1, expiryDate: 1 });

tenantDocumentSchema.virtual('status').get(function () {
  if (!this.expiryDate) return 'No Expiry Date';

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const exp = new Date(this.expiryDate);
  exp.setHours(0, 0, 0, 0);

  const diffTime = exp.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'Expired';
  if (diffDays <= 30) return 'Expiring Soon';
  return 'Valid';
});

tenantDocumentSchema.virtual('daysRemaining').get(function () {
  if (!this.expiryDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const exp = new Date(this.expiryDate);
  exp.setHours(0, 0, 0, 0);

  const diffTime = exp.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

export const TenantDocument = mongoose.model('TenantDocument', tenantDocumentSchema);
export default TenantDocument;
