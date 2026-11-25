import AIConversation from '../../models/AIConversation.js';
import AIMessage from '../../models/AIMessage.js';
import { getUsageLimitsConfig } from './AIUsageService.js';

export const listUserConversations = async (userId) => {
  return AIConversation.find({ userId, isArchived: false })
    .sort({ lastMessageAt: -1 })
    .limit(50)
    .lean();
};

export const createConversation = async ({ userId, title = 'New Conversation', companyContext = null }) => {
  return AIConversation.create({
    userId,
    title: String(title || 'New Conversation').slice(0, 160),
    companyContext: companyContext || null,
    lastMessageAt: new Date(),
  });
};

export const getConversationWithMessages = async ({ conversationId, userId }) => {
  const conversation = await AIConversation.findOne({ _id: conversationId, userId, isArchived: false }).lean();
  if (!conversation) {
    const err = new Error('Conversation not found.');
    err.status = 404;
    throw err;
  }
  const messages = await AIMessage.find({ conversationId, userId })
    .sort({ createdAt: 1 })
    .lean();

  return { conversation, messages };
};

export const getSlidingWindowHistory = async ({ conversationId, userId }) => {
  const { maxHistoryMessages } = getUsageLimitsConfig();
  const docs = await AIMessage.find({ conversationId, userId })
    .sort({ createdAt: -1 })
    .limit(maxHistoryMessages)
    .select('role content companyContext')
    .lean();

  return docs.reverse();
};

export const appendMessage = async ({
  conversationId,
  userId,
  role,
  content,
  companyContext = null,
  toolCalls = [],
  reportPreview = null,
  emailPreview = null,
  approvalRequestId = null,
  usage = {},
  autoTitle = null,
}) => {
  const msg = await AIMessage.create({
    conversationId,
    userId,
    role,
    content,
    companyContext,
    toolCalls,
    reportPreview,
    emailPreview,
    approvalRequestId,
    usage,
  });

  const update = {
    $set: { lastMessageAt: new Date() },
    $inc: { messageCount: 1 },
  };
  if (companyContext !== undefined) {
    update.$set.companyContext = companyContext;
  }
  if (autoTitle) {
    update.$set.title = String(autoTitle).trim().slice(0, 80);
  }
  await AIConversation.updateOne({ _id: conversationId, userId }, update);
  return msg;
};

export const deleteUserConversation = async ({ conversationId, userId }) => {
  const conv = await AIConversation.findOne({ _id: conversationId, userId });
  if (!conv) {
    const err = new Error('Conversation not found.');
    err.status = 404;
    throw err;
  }
  await AIMessage.deleteMany({ conversationId, userId });
  await AIConversation.deleteOne({ _id: conversationId, userId });
  return true;
};

export default {
  listUserConversations,
  createConversation,
  getConversationWithMessages,
  getSlidingWindowHistory,
  appendMessage,
  deleteUserConversation,
};
