import mongoose from 'mongoose';

const aiMessageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AIConversation',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['user', 'assistant', 'system'],
      required: true,
    },
    content: {
      type: String,
      default: '',
    },
    companyContext: {
      type: String,
      default: null,
    },
    toolCalls: {
      type: [
        new mongoose.Schema(
          {
            name: { type: String, required: true },
            args: { type: mongoose.Schema.Types.Mixed, default: {} },
            status: { type: String, enum: ['SUCCESS', 'ERROR', 'BLOCKED'], default: 'SUCCESS' },
            durationMs: { type: Number, default: 0 },
            recordCount: { type: Number, default: null },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    reportPreview: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    emailPreview: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    approvalRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AIApprovalRequest',
      default: null,
    },
    usage: {
      inputTokens: { type: Number, default: 0 },
      outputTokens: { type: Number, default: 0 },
      thoughtsTokens: { type: Number, default: 0 },
      totalTokens: { type: Number, default: 0 },
      estimatedCostUsd: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

aiMessageSchema.index({ conversationId: 1, createdAt: 1 });

export const AIMessage = mongoose.model('AIMessage', aiMessageSchema);
export default AIMessage;
