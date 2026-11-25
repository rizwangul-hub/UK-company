import mongoose from 'mongoose';
import { VALID_COMPANY_IDS } from '../config/companies.js';

const aiConversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      trim: true,
      default: 'New Conversation',
      maxlength: 160,
    },
    companyContext: {
      type: String,
      enum: [...VALID_COMPANY_IDS, 'ALL', null],
      default: null,
      index: true,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    messageCount: {
      type: Number,
      default: 0,
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

aiConversationSchema.index({ userId: 1, isArchived: 1, lastMessageAt: -1 });

export const AIConversation = mongoose.model('AIConversation', aiConversationSchema);
export default AIConversation;
