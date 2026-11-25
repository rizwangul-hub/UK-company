import mongoose from 'mongoose';

const aiUsageLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    companyContext: {
      type: String,
      default: 'GENERAL',
      index: true,
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AIConversation',
      default: null,
    },
    model: {
      type: String,
      required: true,
      index: true,
    },
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    thoughtsTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    estimatedCostUsd: { type: Number, default: 0 },
    toolCallsPerformed: {
      type: [String],
      default: [],
    },
    durationMs: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['SUCCESS', 'ERROR', 'RATE_LIMITED'],
      default: 'SUCCESS',
    },
    errorMessage: { type: String, default: '' },
  },
  { timestamps: true }
);

aiUsageLogSchema.index({ userId: 1, createdAt: -1 });
aiUsageLogSchema.index({ createdAt: -1 });

export const AIUsageLog = mongoose.model('AIUsageLog', aiUsageLogSchema);
export default AIUsageLog;
