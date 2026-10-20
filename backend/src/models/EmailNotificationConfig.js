import mongoose from 'mongoose';

const sentAlertSchema = new mongoose.Schema(
  {
    propertyName: { type: String, required: true },
    documentTitle: { type: String, required: true },
    documentType: { type: String, default: 'Document' },
    expiryDate: { type: Date, required: true },
    daysRemaining: { type: Number, required: true },
    sentTo: { type: String, required: true },
    sentAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['SENT', 'FAILED'], default: 'SENT' },
    errorMessage: { type: String, default: '' },
    milestone: { type: String, default: '' },
  },
  { _id: true }
);

const emailNotificationConfigSchema = new mongoose.Schema(
  {
    companyId: {
      type: String,
      default: 'GLOBAL',
    },
    // The recipient email(s) attached by the user to receive expiry warnings
    recipientEmail: {
      type: String,
      trim: true,
      default: '',
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    // Days before expiry to trigger alert emails
    alertDays: {
      type: [Number],
      default: [60, 45, 30, 14, 7, 0],
    },
    // Custom SMTP details (optional - falls back to .env if empty)
    smtpHost: {
      type: String,
      trim: true,
      default: '',
    },
    smtpPort: {
      type: Number,
      default: 587,
    },
    smtpSecure: {
      type: Boolean,
      default: false,
    },
    smtpUser: {
      type: String,
      trim: true,
      default: '',
    },
    smtpPass: {
      type: String,
      trim: true,
      default: '',
    },
    fromEmail: {
      type: String,
      trim: true,
      default: '',
    },
    fromName: {
      type: String,
      trim: true,
      default: 'UK Property Management Alerts',
    },
    lastCheckedAt: {
      type: Date,
      default: null,
    },
    lastEmailSentAt: {
      type: Date,
      default: null,
    },
    sentAlertsHistory: {
      type: [sentAlertSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

emailNotificationConfigSchema.index({ companyId: 1 }, { unique: true });

export const EmailNotificationConfig = mongoose.model('EmailNotificationConfig', emailNotificationConfigSchema);
export default EmailNotificationConfig;
