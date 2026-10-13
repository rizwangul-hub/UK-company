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
      enum: ['PURCHASE_RECEIPT', 'CARE_REPAIR_PLAN', 'VALET_REPORT', 'INVOICE', 'WARRANTY_CERT', 'OTHER'],
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
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      required: [true, 'Linked property is required'],
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
    },
    purchasePrice: {
      type: Number,
      default: 0,
      min: [0, 'Purchase price cannot be negative'],
    },
    purchaseDate: {
      type: Date,
      default: null,
    },
    installationDate: {
      type: Date,
      default: null,
    },

    // Standard Warranty Information
    hasWarranty: {
      type: Boolean,
      default: true,
    },
    warrantyStartDate: {
      type: Date,
      default: null,
    },
    warrantyExpiryDate: {
      type: Date,
      default: null,
    },
    hasExtendedWarranty: {
      type: Boolean,
      default: false,
    },
    extendedWarrantyExpiryDate: {
      type: Date,
      default: null,
    },
    warrantyProvider: {
      type: String,
      trim: true,
      default: '',
    },
    warrantyPolicyNumber: {
      type: String,
      trim: true,
      default: '',
    },
    isWarrantyVerified: {
      type: Boolean,
      default: false,
    },

    // Official Currys Care & Repair Plan
    currysCareAndRepair: {
      hasPlan: {
        type: Boolean,
        default: false,
      },
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
      planReferenceNumber: {
        type: String,
        trim: true,
        default: '',
      },
      planStartDate: {
        type: Date,
        default: null,
      },
      planEndDate: {
        type: Date,
        default: null,
      },
      monthlyFeeGBP: {
        type: Number,
        default: 0,
        min: 0,
      },
      isPlanVerified: {
        type: Boolean,
        default: false,
      },
      planDocumentUrl: {
        type: String,
        default: '',
      },
    },

    // Annual Squeaky Clean Valet
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
      eligibilityEvidence: {
        type: String,
        trim: true,
        default: '',
      },
      lastValetDate: {
        type: Date,
        default: null,
      },
      nextValetDueDate: {
        type: Date,
        default: null,
      },
      bookingReference: {
        type: String,
        trim: true,
        default: '',
      },
      bookedAppointmentDate: {
        type: Date,
        default: null,
      },
      appointedServiceProvider: {
        type: String,
        trim: true,
        default: 'Currys',
      },
      serviceNotes: {
        type: String,
        trim: true,
        default: '',
      },
      completedChecklist: [valetChecklistItemSchema],
      valetReportDocumentUrl: {
        type: String,
        default: '',
      },
    },

    // Receipt and Certificate Attachments
    documents: [documentSchema],

    // Tenant Visit Communication & Property Access
    tenantAccessNotice: {
      isNotified: {
        type: Boolean,
        default: false,
      },
      notificationDate: {
        type: Date,
        default: null,
      },
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
      tenantNotes: {
        type: String,
        trim: true,
        default: '',
      },
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

// Pre-save hook: initialize default checklist if not already populated
applianceSchema.pre('save', function () {
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
applianceSchema.index({ companyId: 1, 'squeakyCleanValet.eligibilityStatus': 1 });
applianceSchema.index({ companyId: 1, 'currysCareAndRepair.hasPlan': 1 });

export const Appliance = mongoose.model('Appliance', applianceSchema);
export default Appliance;
