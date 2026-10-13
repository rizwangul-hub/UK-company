import mongoose from 'mongoose';
import { VALID_COMPANY_IDS } from '../config/companies.js';

/**
 * Standard Currys "Squeaky Clean Valet" Checklist definitions by Appliance Category
 */
export const OFFICIAL_VALET_CHECKLISTS = {
  WASHING_MACHINE: [
    { taskKey: 'clean_interior_exterior', taskDescription: 'Clean inside and outside of machine' },
    { taskKey: 'clean_soap_drawer', taskDescription: 'Clean soap drawer and detergent dispenser' },
    { taskKey: 'clean_door_seal', taskDescription: 'Clean and inspect door and rubber seal' },
    { taskKey: 'defluff_vents', taskDescription: 'De-fluff and clear vents' },
    { taskKey: 'run_descale_cycle', taskDescription: 'Run complete cycle with specialized de-scale solution' },
  ],
  WASHER_DRYER: [
    { taskKey: 'clean_interior_exterior', taskDescription: 'Clean inside and outside of machine' },
    { taskKey: 'clean_soap_drawer', taskDescription: 'Clean soap drawer and detergent dispenser' },
    { taskKey: 'clean_door_seal', taskDescription: 'Clean and inspect door and rubber seal' },
    { taskKey: 'clean_lint_filters', taskDescription: 'Clean and inspect lint filters and condenser' },
    { taskKey: 'defluff_vents', taskDescription: 'De-fluff and clear exhaust/air vents' },
    { taskKey: 'run_descale_cycle', taskDescription: 'Run complete cycle with specialized de-scale solution' },
  ],
  TUMBLE_DRYER: [
    { taskKey: 'clean_interior_exterior', taskDescription: 'Clean inside and outside of tumble dryer' },
    { taskKey: 'clean_filters', taskDescription: 'Clean and inspect lint filters' },
    { taskKey: 'clean_condenser', taskDescription: 'Clean and flush condenser unit' },
    { taskKey: 'defluff_vents', taskDescription: 'De-fluff and clear all exhaust and internal vents' },
  ],
  DISHWASHER: [
    { taskKey: 'clean_interior_exterior', taskDescription: 'Clean inside and outside of dishwasher' },
    { taskKey: 'clean_filter', taskDescription: 'Remove, clean and inspect micro-mesh filter' },
    { taskKey: 'check_waste_blockages', taskDescription: 'Check waste disposal and drainage lines for blockages' },
    { taskKey: 'remove_food_seal', taskDescription: 'Remove food particles from interior, spray arms and door seal' },
    { taskKey: 'run_dishwasher_cleaner', taskDescription: 'Run hot cycle with specialized dishwasher cleaner' },
  ],
  COOKER_OVEN_HOB: [
    { taskKey: 'deep_clean_cavity', taskDescription: 'Deep clean interior oven cavity and door surround' },
    { taskKey: 'clean_shelving_grill', taskDescription: 'Deep clean all interior shelving, racks and grill pan' },
    { taskKey: 'clean_exterior', taskDescription: 'Clean exterior cooker body and control panel' },
    { taskKey: 'clean_hob', taskDescription: 'Clean and degrease hob / burners / ceramic glass top' },
    { taskKey: 'polish_door', taskDescription: 'Clean and polish oven viewing door' },
  ],
  FRIDGE_FREEZER: [
    { taskKey: 'defrost_unit', taskDescription: 'Defrost freezer compartment (where applicable)' },
    { taskKey: 'clean_dry_interior', taskDescription: 'Clean and thoroughly dry interior cavity' },
    { taskKey: 'clean_racks_trays_seals', taskDescription: 'Clean racks, storage trays, salad crispers, shelves and magnetic seals' },
    { taskKey: 'antibacterial_protection', taskDescription: 'Apply food-safe anti-bacterial protective treatment' },
    { taskKey: 'check_water_filters', taskDescription: 'Inspect water filters and dispenser lines (if fitted)' },
  ],
  FRIDGE: [
    { taskKey: 'clean_dry_interior', taskDescription: 'Clean and thoroughly dry interior cavity' },
    { taskKey: 'clean_racks_trays_seals', taskDescription: 'Clean racks, storage trays, salad crispers, shelves and magnetic seals' },
    { taskKey: 'antibacterial_protection', taskDescription: 'Apply food-safe anti-bacterial protective treatment' },
    { taskKey: 'check_water_filters', taskDescription: 'Inspect water filters and dispenser lines (if fitted)' },
  ],
  FREEZER: [
    { taskKey: 'defrost_unit', taskDescription: 'Defrost freezer compartment (where applicable)' },
    { taskKey: 'clean_dry_interior', taskDescription: 'Clean and thoroughly dry interior cavity' },
    { taskKey: 'clean_baskets_seals', taskDescription: 'Clean storage baskets, shelves and magnetic door seals' },
    { taskKey: 'antibacterial_protection', taskDescription: 'Apply food-safe anti-bacterial protective treatment' },
  ],
  BOILER: [
    { taskKey: 'visual_inspection', taskDescription: 'Visual inspection of casing and pressure gauge' },
    { taskKey: 'clean_casing', taskDescription: 'Clean external casing and flue surround' },
  ],
  OTHER: [
    { taskKey: 'general_clean', taskDescription: 'Clean inside and outside of appliance' },
    { taskKey: 'safety_check', taskDescription: 'Inspect electrical cable, plug, and operational safety' },
  ],
};

const documentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    url: { type: String, required: true },
    docType: {
      type: String,
      enum: [
        'PURCHASE_RECEIPT',
        'EXTENDED_WARRANTY_CERT',
        'MANUFACTURER_WARRANTY_DOC',
        'CARE_REPAIR_AGREEMENT',
        'SERVICE_CONTRACT',
        'TERMS_AND_CONDITIONS',
        'INSTALLATION_DOC',
        'REPAIR_INVOICE',
        'VALET_REPORT',
        'OTHER',
      ],
      default: 'PURCHASE_RECEIPT',
    },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const valetChecklistItemSchema = new mongoose.Schema(
  {
    taskKey: { type: String, required: true },
    taskDescription: { type: String, required: true },
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
  },
  { _id: false }
);

const applianceSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: [true, 'Company ID is required'],
      enum: VALID_COMPANY_IDS,
      index: true,
    },
    // Optional/nullable until property assignment is confirmed
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      default: null,
      index: true,
    },
    propertyAssignmentStatus: {
      type: String,
      enum: ['PENDING_VERIFICATION', 'ASSIGNED', 'UNASSIGNED'],
      default: 'ASSIGNED',
      index: true,
    },
    supplierReceiptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SupplierReceipt',
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Appliance name is required'],
      trim: true,
    },
    applianceType: {
      type: String,
      required: [true, 'Appliance type is required'],
      enum: [
        'WASHING_MACHINE',
        'WASHER_DRYER',
        'TUMBLE_DRYER',
        'DISHWASHER',
        'COOKER_OVEN_HOB',
        'FRIDGE_FREEZER',
        'FRIDGE',
        'FREEZER',
        'BOILER',
        'OTHER',
      ],
      index: true,
    },
    brand: {
      type: String,
      trim: true,
      default: '',
    },
    modelNumber: {
      type: String,
      trim: true,
      default: '',
    },
    serialNumber: {
      type: String,
      trim: true,
      default: '',
    },
    supplier: {
      type: String,
      trim: true,
      default: 'Currys',
      index: true,
    },
    itemCode: {
      type: String,
      trim: true,
      default: '',
    },
    purchasePrice: {
      type: Number,
      default: 0,
      min: [0, 'Purchase price cannot be negative'],
    },
    careServicesChargeGBP: {
      type: Number,
      default: 0,
      min: 0,
    },
    purchaseDate: {
      type: Date,
      default: null,
    },
    installationDate: {
      type: Date,
      default: null,
    },

    // 1. Separate Manufacturer Warranty Record
    manufacturerWarranty: {
      provider: { type: String, trim: true, default: '' },
      warrantyType: {
        type: String,
        enum: ['STANDARD_MANUFACTURER', 'PARTS_AND_LABOUR', 'PARTS_ONLY', 'EXTENDED_MANUFACTURER', 'NONE', 'OTHER'],
        default: 'STANDARD_MANUFACTURER',
      },
      startDate: { type: Date, default: null },
      expiryDate: { type: Date, default: null },
      durationYears: { type: Number, default: 1 }, // 1, 2, 5, 10 or custom
      policyNumber: { type: String, trim: true, default: '' },
      documentUrl: { type: String, default: '' },
      verificationStatus: {
        type: String,
        enum: ['NOT_VERIFIED', 'VERIFIED', 'EXPIRED', 'MISSING_DOCS'],
        default: 'NOT_VERIFIED',
      },
      verificationNotes: { type: String, trim: true, default: '' },
    },

    // 2. Separate Extended Warranty Record
    extendedWarranty: {
      hasExtendedWarranty: { type: Boolean, default: false },
      provider: { type: String, trim: true, default: '' },
      policyNumber: { type: String, trim: true, default: '' },
      startDate: { type: Date, default: null },
      expiryDate: { type: Date, default: null },
      durationYears: { type: Number, default: 5 }, // 5-year, 10-year or custom
      documentUrl: { type: String, default: '' },
      verificationStatus: {
        type: String,
        enum: ['NOT_VERIFIED', 'VERIFIED', 'EXPIRED', 'MISSING_DOCS'],
        default: 'NOT_VERIFIED',
      },
      verificationNotes: { type: String, trim: true, default: '' },
    },

    // 3. Separate Supplier Service Agreement (Care & Repair / Service Contract)
    serviceAgreement: {
      hasAgreement: { type: Boolean, default: false },
      provider: { type: String, trim: true, default: 'Currys' },
      agreementReference: { type: String, trim: true, default: '' },
      planType: {
        type: String,
        enum: ['PAY_MONTHLY', 'PAY_UPFRONT', 'ANNUAL_CONTRACT', 'NOT_APPLICABLE'],
        default: 'NOT_APPLICABLE',
      },
      durationYears: { type: Number, default: 5 }, // 2, 3, 5, 10 years
      startDate: { type: Date, default: null },
      endDate: { type: Date, default: null },
      chargeGBP: { type: Number, default: 0 },
      includedServices: { type: String, trim: true, default: '7-day fix promise, parts and labour, annual valet' },
      exclusions: { type: String, trim: true, default: '' },
      contractDocumentUrl: { type: String, default: '' },
      verificationStatus: {
        type: String,
        enum: ['NOT_VERIFIED', 'VERIFIED', 'EXPIRED'],
        default: 'NOT_VERIFIED',
      },
      verificationNotes: { type: String, trim: true, default: '' },
    },

    // Backwards-compatible legacy mirror fields
    hasWarranty: { type: Boolean, default: true },
    warrantyStartDate: { type: Date, default: null },
    warrantyExpiryDate: { type: Date, default: null },
    hasExtendedWarranty: { type: Boolean, default: false },
    extendedWarrantyExpiryDate: { type: Date, default: null },
    warrantyProvider: { type: String, trim: true, default: '' },
    warrantyPolicyNumber: { type: String, trim: true, default: '' },
    isWarrantyVerified: { type: Boolean, default: false },

    currysCareAndRepair: {
      hasPlan: { type: Boolean, default: false },
      planType: {
        type: String,
        enum: ['PAY_MONTHLY', 'PAY_UPFRONT', 'NOT_APPLICABLE'],
        default: 'NOT_APPLICABLE',
      },
      planDuration: {
        type: String,
        enum: ['MONTHLY_ROLLING', '2_YEARS', '3_YEARS', '5_YEARS', 'CUSTOM'],
        default: 'MONTHLY_ROLLING',
      },
      planReferenceNumber: { type: String, trim: true, default: '' },
      planStartDate: { type: Date, default: null },
      planEndDate: { type: Date, default: null },
      monthlyFeeGBP: { type: Number, default: 0, min: 0 },
      isPlanVerified: { type: Boolean, default: false },
      planDocumentUrl: { type: String, default: '' },
    },

    // 4. Annual Squeaky Clean Valet / Annual Servicing
    squeakyCleanValet: {
      eligibilityStatus: {
        type: String,
        enum: [
          'NOT_VERIFIED',
          'NOT_ELIGIBLE',
          'ELIGIBLE',
          'DUE',
          'BOOKING_REQUIRED',
          'BOOKED',
          'COMPLETED',
          'CANCELLED',
        ],
        default: 'NOT_VERIFIED',
        index: true,
      },
      eligibilityEvidence: { type: String, trim: true, default: '' },
      lastValetDate: { type: Date, default: null },
      nextValetDueDate: { type: Date, default: null },
      bookingReference: { type: String, trim: true, default: '' },
      bookedAppointmentDate: { type: Date, default: null },
      appointedServiceProvider: { type: String, trim: true, default: 'Currys' },
      serviceNotes: { type: String, trim: true, default: '' },
      completedChecklist: [valetChecklistItemSchema],
      valetReportDocumentUrl: { type: String, default: '' },
    },

    // Receipt and Certificate Attachments
    documents: [documentSchema],

    // Tenant Visit Communication & Property Access
    tenantAccessNotice: {
      isNotified: { type: Boolean, default: false },
      notificationDate: { type: Date, default: null },
      communicationMethod: {
        type: String,
        enum: ['EMAIL', 'SMS', 'PHONE', 'WRITTEN_NOTICE', 'WHATSAPP', 'OTHER'],
        default: 'PHONE',
      },
      accessStatus: {
        type: String,
        enum: [
          'NOT_NOTIFIED',
          'NOTICE_SENT',
          'TENANT_CONFIRMED',
          'ACCESS_DISPUTED',
          'RESCHEDULED_BY_TENANT',
          'VACANT_NO_NOTICE_NEEDED',
        ],
        default: 'NOT_NOTIFIED',
      },
      tenantNotes: { type: String, trim: true, default: '' },
    },

    status: {
      type: String,
      enum: ['OPERATIONAL', 'FAULTY', 'NEEDS_SERVICE', 'REPLACED', 'DISPOSED'],
      default: 'OPERATIONAL',
      index: true,
    },
    isPropertyAssignedVerified: {
      type: Boolean,
      default: false,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook: sync legacy mirrors with decoupled structures and initialize valet checklists
applianceSchema.pre('save', function () {
  // Sync propertyAssignmentStatus
  if (this.propertyId) {
    if (this.propertyAssignmentStatus === 'PENDING_VERIFICATION' && this.isPropertyAssignedVerified) {
      this.propertyAssignmentStatus = 'ASSIGNED';
    }
  } else {
    this.propertyAssignmentStatus = 'PENDING_VERIFICATION';
  }

  // Sync serviceAgreement with currysCareAndRepair mirror
  if (this.serviceAgreement?.hasAgreement) {
    this.currysCareAndRepair.hasPlan = true;
    this.currysCareAndRepair.planReferenceNumber = this.serviceAgreement.agreementReference || this.currysCareAndRepair.planReferenceNumber;
    this.currysCareAndRepair.planStartDate = this.serviceAgreement.startDate || this.currysCareAndRepair.planStartDate;
    this.currysCareAndRepair.planEndDate = this.serviceAgreement.endDate || this.currysCareAndRepair.planEndDate;
    this.currysCareAndRepair.isPlanVerified = this.serviceAgreement.verificationStatus === 'VERIFIED';
  } else if (this.currysCareAndRepair?.hasPlan) {
    this.serviceAgreement.hasAgreement = true;
    this.serviceAgreement.agreementReference = this.currysCareAndRepair.planReferenceNumber || '';
    this.serviceAgreement.startDate = this.currysCareAndRepair.planStartDate;
    this.serviceAgreement.endDate = this.currysCareAndRepair.planEndDate;
    this.serviceAgreement.verificationStatus = this.currysCareAndRepair.isPlanVerified ? 'VERIFIED' : 'NOT_VERIFIED';
  }

  // Sync manufacturerWarranty with hasWarranty legacy mirror
  if (this.manufacturerWarranty?.expiryDate) {
    this.hasWarranty = true;
    this.warrantyStartDate = this.manufacturerWarranty.startDate;
    this.warrantyExpiryDate = this.manufacturerWarranty.expiryDate;
    this.warrantyProvider = this.manufacturerWarranty.provider || this.brand;
  }

  // Initialize checklist if needed
  if (
    (!this.squeakyCleanValet.completedChecklist || this.squeakyCleanValet.completedChecklist.length === 0) &&
    OFFICIAL_VALET_CHECKLISTS[this.applianceType]
  ) {
    this.squeakyCleanValet.completedChecklist = OFFICIAL_VALET_CHECKLISTS[this.applianceType].map((item) => ({
      taskKey: item.taskKey,
      taskDescription: item.taskDescription,
      isCompleted: false,
      completedAt: null,
    }));
  }
});

applianceSchema.index({ companyId: 1, propertyId: 1 });
applianceSchema.index({ companyId: 1, applianceType: 1 });
applianceSchema.index({ companyId: 1, supplier: 1 });
applianceSchema.index({ companyId: 1, propertyAssignmentStatus: 1 });
applianceSchema.index({ companyId: 1, 'squeakyCleanValet.eligibilityStatus': 1 });
applianceSchema.index({ companyId: 1, 'currysCareAndRepair.hasPlan': 1 });

export const Appliance = mongoose.model('Appliance', applianceSchema);
export default Appliance;
