import mongoose from 'mongoose';

/**
 * UK Category / Chart of Accounts Schema
 * Standardized nominal heads for rental income, property operating costs,
 * mortgage interest finance charges, capital works, and account transfers.
 */
const categorySchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      required: [true, 'Company ID is required'],
      trim: true,
      lowercase: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Category head name is required'],
      trim: true,
      index: true,
    },
    code: {
      type: String,
      trim: true,
      uppercase: true,
      sparse: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['INCOME', 'OPERATING_EXPENSE', 'FINANCE_COST', 'CAPITAL_EXPENDITURE', 'TRANSFER'],
      default: 'OPERATING_EXPENSE',
      index: true,
    },
    expenseClassification: {
      type: String,
      enum: ['GENERAL_EXPENSE', 'PROPERTY_OWN_EXPENSE', 'UNIT_EXPENSE'],
      default: 'GENERAL_EXPENSE',
      index: true,
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Property',
      default: null,
      index: true,
    },
    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Unit',
      default: null,
      index: true,
    },
    parentCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
    },
    isMainHead: {
      type: Boolean,
      default: false,
      index: true,
    },
    isRentalHead: {
      type: Boolean,
      default: false,
    },
    isAllowableTaxDeduction: {
      type: Boolean,
      default: true, // Operating expenses allowable; finance costs handled under Section 24 relief
    },
    defaultScope: {
      type: String,
      enum: ['GENERAL', 'PROPERTY', 'UNIT'],
      default: 'PROPERTY',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    aliases: [
      {
        type: String,
        trim: true,
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

categorySchema.index({ companyId: 1, name: 1, propertyId: 1, parentCategoryId: 1 });
categorySchema.index({ companyId: 1, type: 1 });
categorySchema.index({ companyId: 1, isRentalHead: 1 });
categorySchema.index({ companyId: 1, isActive: 1 });

export const Category = mongoose.model('Category', categorySchema);
export default Category;
