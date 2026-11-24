import mongoose from 'mongoose';
import { VALID_COMPANY_IDS } from '../config/companies.js';

/**
 * UK Property Schema
 * Supports Freehold & Leasehold properties, valuation tracking,
 * and UK statutory compliance certificates (EPC, Gas Safety, EICR).
 */
const propertySchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: [true, 'Company ID is required'],
      enum: VALID_COMPANY_IDS,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Property name/reference is required'],
      trim: true,
      index: true,
    },
    propertyCode: {
      type: String,
      trim: true,
      uppercase: true,
      sparse: true,
      index: true,
    },
    propertyType: {
      type: String,
      trim: true,
      default: 'FLAT_APARTMENT',
    },
    // Direct Property Financials & Tenancy
    contractualRent: {
      type: Number,
      default: 0,
      min: [0, 'Contractual rent cannot be negative'],
    },
    rentFrequency: {
      type: String,
      enum: ['MONTHLY', 'WEEKLY', 'QUARTERLY', 'ANNUALLY'],
      default: 'MONTHLY',
    },
    status: {
      type: String,
      trim: true,
      default: 'Available',
      index: true,
    },
    tenantName: {
      type: String,
      trim: true,
      default: '',
    },
    tenancyStartDate: {
      type: Date,
      default: null,
    },
    tenancyEndDate: {
      type: Date,
      default: null,
    },
    sourceReference: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    originalSourceId: {
      type: String,
      trim: true,
      default: '',
    },
    addressLine1: {
      type: String,
      trim: true,
      default: '',
    },
    addressLine2: {
      type: String,
      trim: true,
      default: '',
    },
    city: {
      type: String,
      trim: true,
      default: 'London',
    },
    county: {
      type: String,
      trim: true,
      default: '',
    },
    postcode: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
      index: true,
    },
    tenure: {
      type: String,
      enum: ['FREEHOLD', 'LEASEHOLD', 'SHARE_OF_FREEHOLD'],
      default: 'FREEHOLD',
    },
    leaseDetails: {
      leaseYearsRemaining: { type: Number, default: null },
      groundRentAnnual: { type: Number, default: 0 },
      serviceChargeAnnual: { type: Number, default: 0 },
    },
    leaseholdRecord: {
      // 1. Property & Purchase Details
      propertyAddress: { type: String, trim: true, default: '' },
      titleNumber: { type: String, trim: true, default: '' },
      completionDate: { type: Date, default: null },
      purchasePrice: { type: Number, default: null },
      conveyancingSolicitor: { type: String, trim: true, default: '' },
      solicitorReferenceAndContact: { type: String, trim: true, default: '' },

      // 2. Lease Term & Key Dates
      originalLeaseDate: { type: Date, default: null },
      originalLeaseTermYears: { type: Number, default: null },
      leaseStartDate: { type: Date, default: null },
      leaseExpiryDate: { type: Date, default: null },
      remainingYearsAtPurchase: { type: Number, default: null },
      eightyYearThresholdDate: { type: Date, default: null },

      // 3. Freeholder (Landlord) Details
      freeholderName: { type: String, trim: true, default: '' },
      freeholderTitleNumber: { type: String, trim: true, default: '' },
      freeholderRegisteredAddress: { type: String, trim: true, default: '' },
      freeholderContactName: { type: String, trim: true, default: '' },
      freeholderTelephone: { type: String, trim: true, default: '' },
      freeholderEmail: { type: String, trim: true, default: '' },
      shareOfFreeholdIncluded: { type: String, enum: ['YES', 'NO', ''], default: '' },
      managementCompanyNameAndNo: { type: String, trim: true, default: '' },

      // 4. Managing Agent Details
      managingAgentName: { type: String, trim: true, default: '' },
      managingAgentAddress: { type: String, trim: true, default: '' },
      propertyManagerName: { type: String, trim: true, default: '' },
      managingAgentTelephone: { type: String, trim: true, default: '' },
      managingAgentEmail: { type: String, trim: true, default: '' },
      onlinePortalUrlAndRef: { type: String, trim: true, default: '' },

      // 5. Ground Rent
      currentAnnualGroundRent: { type: Number, default: null },
      groundRentFrequency: {
        type: String,
        enum: ['ANNUALLY', 'HALF_YEARLY', 'QUARTERLY', ''],
        default: '',
      },
      groundRentDueDates: { type: String, trim: true, default: '' },
      groundRentPayableTo: {
        type: String,
        enum: ['FREEHOLDER', 'MANAGING_AGENT', ''],
        default: '',
      },
      groundRentPaymentMethodRef: { type: String, trim: true, default: '' },
      groundRentReviewClause: { type: String, trim: true, default: '' },
      groundRentNextReviewDate: { type: Date, default: null },

      // 6. Service Charge & Reserve Fund
      currentAnnualServiceCharge: { type: Number, default: null },
      serviceChargeFinancialYear: { type: String, trim: true, default: '' },
      serviceChargeFrequency: {
        type: String,
        enum: ['ANNUALLY', 'HALF_YEARLY', 'QUARTERLY', 'MONTHLY', ''],
        default: '',
      },
      serviceChargeDueDates: { type: String, trim: true, default: '' },
      apportionmentSharePercent: { type: Number, default: null },
      serviceChargePayableTo: { type: String, trim: true, default: '' },
      serviceChargePaymentMethodRef: { type: String, trim: true, default: '' },
      sinkingFundIncluded: { type: String, enum: ['YES', 'NO', ''], default: '' },
      currentReserveFundBalance: { type: Number, default: null },
      plannedMajorWorksDisclosed: { type: String, trim: true, default: '' },

      // 7. Buildings Insurance
      insuranceArrangedBy: {
        type: String,
        enum: ['FREEHOLDER_MANAGING_AGENT', 'LEASEHOLDER', ''],
        default: '',
      },
      insurerName: { type: String, trim: true, default: '' },
      policyNumber: { type: String, trim: true, default: '' },
      insuranceRenewalDate: { type: Date, default: null },
      annualInsurancePremium: { type: Number, default: null },
      claimsContactNumber: { type: String, trim: true, default: '' },

      // 8. Lease Covenants, Restrictions & Consents
      sublettingPermitted: {
        type: String,
        enum: ['YES', 'WITH_CONSENT', 'NO', ''],
        default: '',
      },
      petsPermitted: {
        type: String,
        enum: ['YES', 'WITH_CONSENT', 'NO', ''],
        default: '',
      },
      alterationsPermitted: {
        type: String,
        enum: ['YES', 'WITH_CONSENT', 'NO', ''],
        default: '',
      },
      deedOfCovenantFeePaid: { type: Number, default: null },
      shareCertificateReceived: {
        type: String,
        enum: ['YES', 'NO', 'N/A', ''],
        default: '',
      },

      // 9. Key Documents Checklist & Storage Location
      keyDocumentsChecklist: [
        new mongoose.Schema(
          {
            documentName: { type: String, trim: true, required: true },
            received: { type: Boolean, default: false },
            storedLocation: { type: String, trim: true, default: '' },
          },
          { _id: false }
        ),
      ],
    },
    ownershipEntity: {
      type: String,
      trim: true,
      default: 'Personal', // e.g. "Personal" or "PIXX Properties UK Ltd"
    },
    companyNumber: {
      type: String,
      trim: true,
      default: '',
    },
    // Valuation & Purchase Metrics
    purchasePrice: {
      type: Number,
      default: 0,
    },
    purchaseDate: {
      type: Date,
      default: null,
    },
    currentValuation: {
      type: Number,
      default: 0,
    },
    lastValuationDate: {
      type: Date,
      default: null,
    },
    // UK Statutory Compliance
    compliance: {
      epcRating: {
        type: String,
        enum: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'EXEMPT', 'PENDING', ''],
        default: 'PENDING',
      },
      epcExpiryDate: { type: Date, default: null },
      gasSafetyExpiryDate: { type: Date, default: null },
      eicrExpiryDate: { type: Date, default: null },
      councilTaxBand: {
        type: String,
        enum: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'BUSINESS_RATES', 'EXEMPT', ''],
        default: '',
      },
    },
    notes: {
      type: String,
      trim: true,
      default: '',
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

propertySchema.pre('save', function () {
  if (!this.propertyCode && this.name) {
    const clean = this.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
    const rand = Math.floor(100 + Math.random() * 900);
    this.propertyCode = `UK-${clean || 'PROP'}-${rand}`;
  }
  if (!this.addressLine1 && this.name) {
    this.addressLine1 = this.name;
  }
});

propertySchema.index({ companyId: 1, name: 1 });
propertySchema.index({ companyId: 1, propertyCode: 1 });
propertySchema.index({ companyId: 1, sourceReference: 1 });
propertySchema.index({ companyId: 1, isActive: 1 });

export const Property = mongoose.model('Property', propertySchema);
export default Property;
