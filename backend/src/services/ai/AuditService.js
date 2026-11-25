import AIAuditLog from '../../models/AIAuditLog.js';

export const logAIAction = async ({
  user,
  companyId = 'GENERAL',
  conversationId = null,
  approvalRequestId = null,
  actionType,
  status = 'SUCCESS',
  payload = {},
  result = null,
  errorMessage = '',
}) => {
  return AIAuditLog.create({
    userId: user._id,
    userName: user.name || user.email || 'Authorized Operator',
    companyId: companyId || 'GENERAL',
    conversationId,
    approvalRequestId,
    actionType,
    status,
    payload,
    result,
    errorMessage,
  });
};

export const getUserAuditLogs = async (userId, limit = 50) => {
  return AIAuditLog.find({ userId }).sort({ createdAt: -1 }).limit(limit).lean();
};

export default {
  logAIAction,
  getUserAuditLogs,
};
