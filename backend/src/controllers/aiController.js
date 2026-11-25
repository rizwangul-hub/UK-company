import { apiSuccess, apiError } from '../utils/apiResponse.js';
import {
  listUserConversations,
  createConversation,
  getConversationWithMessages,
  getSlidingWindowHistory,
  appendMessage,
  deleteUserConversation,
} from '../services/ai/AIConversationService.js';
import {
  checkUserRateLimit,
  recordUsage,
  getUsageDashboard,
  calculateEstimatedCostUsd,
} from '../services/ai/AIUsageService.js';
import {
  assertCompanyAuthorized,
  getAuthorizedCompanies,
} from '../services/ai/CompanyAuthorizationService.js';
import { runGeminiTurn } from '../services/ai/GeminiService.js';
import { toolDeclarations, createToolExecutor } from '../services/ai/AIToolRegistry.js';
import {
  listPendingApprovals,
  approveAndExecute,
  rejectApprovalRequest,
} from '../services/ai/ApprovalService.js';
import { getUserAuditLogs } from '../services/ai/AuditService.js';

export const getConversations = async (req, res) => {
  try {
    const conversations = await listUserConversations(req.user._id);
    const companies = getAuthorizedCompanies(req.user);
    return apiSuccess(res, { conversations, companies });
  } catch (error) {
    return apiError(res, error.message || 'Failed to load conversations', error.status || 500, error);
  }
};

export const startConversation = async (req, res) => {
  try {
    const { title, companyContext } = req.body || {};
    let resolvedContext = null;
    if (companyContext && String(companyContext).toUpperCase() !== 'ALL') {
      resolvedContext = assertCompanyAuthorized(req.user, companyContext).companyId;
    } else if (String(companyContext).toUpperCase() === 'ALL') {
      resolvedContext = 'ALL';
    }
    const conv = await createConversation({
      userId: req.user._id,
      title: title || 'New Conversation',
      companyContext: resolvedContext,
    });
    return apiSuccess(res, conv, 'Conversation created', 201);
  } catch (error) {
    return apiError(res, error.message || 'Failed to create conversation', error.status || 500, error);
  }
};

export const getConversationById = async (req, res) => {
  try {
    const data = await getConversationWithMessages({
      conversationId: req.params.id,
      userId: req.user._id,
    });
    return apiSuccess(res, data);
  } catch (error) {
    return apiError(res, error.message || 'Failed to fetch conversation', error.status || 500, error);
  }
};

export const removeConversation = async (req, res) => {
  try {
    await deleteUserConversation({
      conversationId: req.params.id,
      userId: req.user._id,
    });
    return apiSuccess(res, null, 'Conversation deleted');
  } catch (error) {
    return apiError(res, error.message || 'Failed to delete conversation', error.status || 500, error);
  }
};

export const chatWithAssistant = async (req, res) => {
  const started = Date.now();
  let activeCompanyId = null;

  try {
    const { conversationId, companyContext, message } = req.body || {};
    const cleanMessage = String(message || '').trim();
    if (!cleanMessage) {
      return apiError(res, 'Message is required.', 400);
    }

    await checkUserRateLimit(req.user._id);

    if (companyContext && String(companyContext).toUpperCase() !== 'ALL') {
      activeCompanyId = assertCompanyAuthorized(req.user, companyContext).companyId;
    } else if (String(companyContext).toUpperCase() === 'ALL') {
      activeCompanyId = 'ALL';
    }

    let convId = conversationId;
    let isFirstMessage = false;
    if (!convId) {
      const conv = await createConversation({
        userId: req.user._id,
        title: cleanMessage.slice(0, 60),
        companyContext: activeCompanyId,
      });
      convId = conv._id;
      isFirstMessage = true;
    } else {
      const existing = await getConversationWithMessages({
        conversationId: convId,
        userId: req.user._id,
      });
      if (!activeCompanyId && existing.conversation.companyContext) {
        activeCompanyId = existing.conversation.companyContext;
      }
      isFirstMessage = existing.messages.length === 0;
    }

    const history = await getSlidingWindowHistory({
      conversationId: convId,
      userId: req.user._id,
    });

    await appendMessage({
      conversationId: convId,
      userId: req.user._id,
      role: 'user',
      content: cleanMessage,
      companyContext: activeCompanyId,
      autoTitle: isFirstMessage ? cleanMessage.slice(0, 60) : null,
    });

    const executeTool = createToolExecutor({
      user: req.user,
      activeCompanyId,
      conversationId: convId,
    });

    const aiResult = await runGeminiTurn({
      user: req.user,
      activeCompanyId,
      history,
      userMessage: cleanMessage,
      toolDeclarations,
      executeTool,
    });

    const estimatedCostUsd = calculateEstimatedCostUsd(
      aiResult.usage.inputTokens,
      aiResult.usage.outputTokens,
      aiResult.usage.thoughtsTokens
    );

    const assistantMsg = await appendMessage({
      conversationId: convId,
      userId: req.user._id,
      role: 'assistant',
      content: aiResult.reply,
      companyContext: activeCompanyId,
      toolCalls: aiResult.toolCalls,
      reportPreview: aiResult.reportPreview,
      emailPreview: aiResult.emailPreview,
      approvalRequestId: aiResult.approvalRequest?._id || null,
      usage: { ...aiResult.usage, estimatedCostUsd },
    });

    await recordUsage({
      userId: req.user._id,
      companyContext: activeCompanyId || 'GENERAL',
      conversationId: convId,
      model: aiResult.model,
      inputTokens: aiResult.usage.inputTokens,
      outputTokens: aiResult.usage.outputTokens,
      thoughtsTokens: aiResult.usage.thoughtsTokens,
      totalTokens: aiResult.usage.totalTokens,
      toolCallsPerformed: aiResult.toolCalls.map((t) => t.name),
      durationMs: Date.now() - started,
      status: 'SUCCESS',
    });

    return apiSuccess(res, {
      conversationId: convId,
      message: assistantMsg,
      approvalRequest: aiResult.approvalRequest,
    });
  } catch (error) {
    await recordUsage({
      userId: req.user._id,
      companyContext: activeCompanyId || 'GENERAL',
      model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
      durationMs: Date.now() - started,
      status: error.status === 429 ? 'RATE_LIMITED' : 'ERROR',
      errorMessage: error.message || 'AI chat failed',
    }).catch(() => {});

    return apiError(res, error.message || 'AI request failed', error.status || 500, error);
  }
};

export const getPendingApprovals = async (req, res) => {
  try {
    const approvals = await listPendingApprovals(req.user._id);
    return apiSuccess(res, { approvals });
  } catch (error) {
    return apiError(res, error.message || 'Failed to load approvals', 500, error);
  }
};

export const approveAction = async (req, res) => {
  try {
    const { approvalToken } = req.body || {};
    if (!approvalToken) {
      return apiError(res, 'One-time approvalToken is required.', 400);
    }
    const outcome = await approveAndExecute({
      approvalId: req.params.id,
      approvalToken,
      user: req.user,
    });
    return apiSuccess(res, outcome, 'Operation approved and executed.');
  } catch (error) {
    return apiError(res, error.message || 'Approval execution failed', error.status || 400, error);
  }
};

export const rejectAction = async (req, res) => {
  try {
    const { approvalToken } = req.body || {};
    if (!approvalToken) {
      return apiError(res, 'One-time approvalToken is required.', 400);
    }
    const approval = await rejectApprovalRequest({
      approvalId: req.params.id,
      approvalToken,
      user: req.user,
    });
    return apiSuccess(res, { approval }, 'Operation rejected.');
  } catch (error) {
    return apiError(res, error.message || 'Failed to reject approval', error.status || 400, error);
  }
};

export const getUsageStats = async (req, res) => {
  try {
    const stats = await getUsageDashboard(req.user._id);
    return apiSuccess(res, stats);
  } catch (error) {
    return apiError(res, error.message || 'Failed to fetch AI usage stats', 500, error);
  }
};

export const getAuditHistory = async (req, res) => {
  try {
    const logs = await getUserAuditLogs(req.user._id, 50);
    return apiSuccess(res, { logs });
  } catch (error) {
    return apiError(res, error.message || 'Failed to fetch AI audit logs', 500, error);
  }
};
