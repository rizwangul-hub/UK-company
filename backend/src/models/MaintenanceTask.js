import mongoose from 'mongoose';
import { VALID_COMPANY_IDS } from '../config/companies.js';

export const KHURSHID_DEFAULT_TASKS = [
  {
    taskNumber: 1,
    title: 'Identify Currys washing machines, fridges & household appliances',
    description: 'Audit portfolio appliances across properties to identify all domestic white goods supplied by Currys.',
    priority: 'HIGH',
    isCoreResponsibility: true,
  },
  {
    taskNumber: 2,
    title: 'Locate Currys receipts & match appliances to physical properties',
    description: 'Retrieve purchase receipts and invoices; attach documents and match each unit to its designated property.',
    priority: 'HIGH',
    isCoreResponsibility: true,
  },
  {
    taskNumber: 3,
    title: 'Find and verify Currys Care & Repair plan documents',
    description: 'Locate Care & Repair policy certificates, policy numbers, and terms (Pay Monthly or 2, 3 or 5 Years Upfront).',
    priority: 'HIGH',
    isCoreResponsibility: true,
  },
  {
    taskNumber: 4,
    title: 'Confirm qualifying appliances for annual Squeaky Clean Valet',
    description: 'Verify which Household Appliances qualify for the annual valet deep clean under plan terms.',
    priority: 'HIGH',
    isCoreResponsibility: true,
  },
  {
    taskNumber: 5,
    title: 'Contact Currys (0344 800 6080) to arrange cleaning appointments',
    description: 'Call Currys Care line or submit booking online to arrange the first round of cleaning appointments.',
    priority: 'MEDIUM',
    isCoreResponsibility: true,
  },
  {
    taskNumber: 6,
    title: 'Record confirmed appointment dates & coordinate property access',
    description: 'Enter confirmed booking references and appointment dates; notify tenants for occupied properties.',
    priority: 'MEDIUM',
    isCoreResponsibility: true,
  },
  {
    taskNumber: 7,
    title: 'Execute valet checklist & mark complete only after visit occurs',
    description: 'Inspect completed work against the official category checklist and mark complete with engineer notes.',
    priority: 'MEDIUM',
    isCoreResponsibility: true,
  },
  {
    taskNumber: 8,
    title: 'Schedule next annual valet service (12 months forward)',
    description: 'Calculate and record the next expected valet date according to applicable plan terms for ongoing care.',
    priority: 'LOW',
    isCoreResponsibility: true,
  },
];

const maintenanceTaskSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: [true, 'Company ID is required'],
      enum: VALID_COMPANY_IDS,
      index: true,
    },
    taskNumber: {
      type: Number,
      default: 1,
    },
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    assignedTo: {
      type: String,
      trim: true,
      default: 'Khurshid',
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
      default: 'MEDIUM',
    },
    status: {
      type: String,
      enum: ['PENDING', 'IN_PROGRESS', 'WAITING_FOR_PROVIDER', 'COMPLETED', 'BLOCKED'],
      default: 'PENDING',
      index: true,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    linkedPropertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      default: null,
    },
    linkedApplianceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appliance',
      default: null,
    },
    isCoreResponsibility: {
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

maintenanceTaskSchema.index({ companyId: 1, status: 1 });
maintenanceTaskSchema.index({ companyId: 1, assignedTo: 1 });
maintenanceTaskSchema.index({ companyId: 1, taskNumber: 1 });

export const MaintenanceTask = mongoose.model('MaintenanceTask', maintenanceTaskSchema);
export default MaintenanceTask;
