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
  getUsageLimitsConfig,
} from '../services/ai/AIUsageService.js';
import {
  assertCompanyAuthorized,
  getAuthorizedCompanies,
} from '../services/ai/CompanyAuthorizationService.js';
import { runGeminiTurn, getGeminiClient } from '../services/ai/GeminiService.js';
import { toolDeclarations, createToolExecutor } from '../services/ai/AIToolRegistry.js';
import {
  listPendingApprovals,
  approveAndExecute,
  rejectApprovalRequest,
} from '../services/ai/ApprovalService.js';
import { getUserAuditLogs } from '../services/ai/AuditService.js';
import { normalizeGeminiModelName } from '../services/ai/GeminiModelConfig.js';

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
  let convId = null;
  let savedUserMessage = null;

  try {
    const { conversationId, companyContext, message, retryMessageId } = req.body || {};
    const cleanMessage = String(message || '').trim();
    if (!cleanMessage) {
      return apiError(res, 'Message is required.', 400);
    }
    if (retryMessageId && !conversationId) {
      return apiError(res, 'A conversation is required to retry a message.', 400);
    }

    await checkUserRateLimit(req.user._id);

    if (companyContext && String(companyContext).toUpperCase() !== 'ALL') {
      activeCompanyId = assertCompanyAuthorized(req.user, companyContext).companyId;
    } else if (String(companyContext).toUpperCase() === 'ALL') {
      activeCompanyId = 'ALL';
    }

    convId = conversationId;
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
      if (retryMessageId) {
        const latest = existing.messages.at(-1);
        if (!latest || String(latest._id) !== String(retryMessageId) || latest.role !== 'user'
          || latest.content !== cleanMessage || (latest.companyContext || null) !== activeCompanyId) {
          return apiError(res, 'This conversation has changed. Reload it before retrying.', 409);
        }
        savedUserMessage = latest;
      }
    }

    let history = await getSlidingWindowHistory({
      conversationId: convId,
      userId: req.user._id,
    });

    if (savedUserMessage) {
      history = history.filter((msg) => String(msg._id) !== String(savedUserMessage._id));
    } else {
      savedUserMessage = await appendMessage({
        conversationId: convId,
        userId: req.user._id,
        role: 'user',
        content: cleanMessage,
        companyContext: activeCompanyId,
        autoTitle: isFirstMessage ? cleanMessage.slice(0, 60) : null,
      });
    }

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
      conversationId: convId,
      model: normalizeGeminiModelName(process.env.GEMINI_MODEL) || 'gemini-3.5-flash-lite',
      durationMs: Date.now() - started,
      status: error.status === 429 ? 'RATE_LIMITED' : 'ERROR',
      errorMessage: error.message || 'AI chat failed',
    }).catch(() => {});

    const status = Number(error.status);
    // Log the full underlying error to server console for Vercel log inspection
    console.error('[AI Chat Error]', {
      code: error.code,
      status: error.status,
      message: error.message,
      causeStatus: error.cause?.status,
      causeMessage: (error.cause?.message || '').slice(0, 500),
      userId: req.user?._id,
      model: normalizeGeminiModelName(process.env.GEMINI_MODEL),
      fallback: normalizeGeminiModelName(process.env.GEMINI_FALLBACK_MODEL),
      apiKeyPresent: !!(process.env.GEMINI_API_KEY || '').trim(),
    });
    return res.status(Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500).json({
      success: false,
      message: error.message || 'AI request failed',
      ...(typeof error.code === 'string' && error.code.startsWith('AI_') ? {
        code: error.code,
        retryable: error.retryable,
        retryAfterSeconds: error.retryAfterSeconds || null,
      } : {}),
      ...(savedUserMessage ? {
        data: { conversationId: convId, userMessage: savedUserMessage },
      } : {}),
    });
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

/**
 * GET /api/ai/health
 * Diagnostic endpoint: checks whether the Gemini API key is configured and
 * which models are reachable. Protected by auth. Returns plain JSON — never
 * exposes the actual API key value.
 */
export const getAiHealth = async (req, res) => {
  const { GoogleGenAI } = await import('@google/genai');
  const { getUsageLimitsConfig } = await import('../services/ai/AIUsageService.js');
  const cfg = getUsageLimitsConfig();
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();

  const result = {
    apiKeyPresent: !!apiKey,
    apiKeyLength: apiKey.length,
    primaryModel: cfg.model,
    fallbackModel: cfg.fallbackModel,
    modelConfigurationWarnings: cfg.modelConfigurationWarnings,
    models: {},
  };

  if (!apiKey) {
    return res.status(200).json({ success: true, data: result });
  }

  const ai = new GoogleGenAI({ apiKey });
  const modelsToTest = [
    cfg.model,
    cfg.fallbackModel,
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
  ].filter(Boolean).filter((m, i, a) => a.indexOf(m) === i);

  for (const m of modelsToTest) {
    try {
      const r = await ai.models.generateContent({
        model: m,
        contents: 'Reply with only: OK',
        config: { maxOutputTokens: 10, httpOptions: { timeout: 15000, retryOptions: { attempts: 1 } } },
      });
      result.models[m] = { status: 'ok', text: (r.text || '').trim().slice(0, 20) };
    } catch (err) {
      let msgStr = err.message || '';
      let parsed;
      try { parsed = JSON.parse(msgStr); } catch { /* not JSON */ }
      const code = err.status || parsed?.error?.code;
      const msg = parsed?.error?.message || msgStr;
      result.models[m] = { status: 'error', httpStatus: code, message: msg.slice(0, 200) };
    }
  }

  return res.status(200).json({ success: true, data: result });
};
