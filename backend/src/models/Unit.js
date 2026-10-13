import mongoose from 'mongoose';
import { VALID_COMPANY_IDS } from '../config/companies.js';

/**
 * UK Unit Schema
 * Represents an individual lettable apartment, shop, studio, or room within a property.
 */
const unitSchema = new mongoose.Schema(
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
      required: [true, 'Property reference is required'],
      index: true,
    },
    unitName: {
      type: String,
      required: [true, 'Unit name/number is required (e.g. Flat 1, Ground Floor Shop)'],
      trim: true,
    },
    unitType: {
      type: String,
      enum: ['FLAT', 'STUDIO', 'ROOM_HMO', 'RETAIL_SHOP', 'OFFICE', 'PARKING_SPACE', 'STORAGE', 'OTHER'],
      default: 'FLAT',
    },
    floorAreaSqFt: {
      type: Number,
      default: 0,
    },
    floor: {
      type: String,
      trim: true,
      default: 'Ground',
    },
    targetRent: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['OCCUPIED', 'VACANT', 'MAINTENANCE', 'INACTIVE'],
      default: 'VACANT',
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

unitSchema.index({ companyId: 1, propertyId: 1 });
unitSchema.index({ companyId: 1, status: 1 });

export const Unit = mongoose.model('Unit', unitSchema);
export default Unit;
