import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

/**
 * User Schema for Single Authorized Operator
 * PIXX Technologies UK Property Finance System
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'User name is required'],
      trim: true,
      default: 'Authorized Operator',
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please enter a valid email address',
      ],
      index: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters long'],
      select: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    singleUserLock: {
      type: String,
      default: 'SINGLE_AUTHORIZED_OPERATOR',
      unique: true,
      index: true,
    },
    allowedCompanies: {
      type: [String],
      default: ['old-street', 'best-standard', 'sk-hamilton', 'homewards', 'mile-end-road', 'global-standard'],
    },
    activeCompanyId: {
      type: String,
      default: null,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model('User', userSchema);
export default User;
