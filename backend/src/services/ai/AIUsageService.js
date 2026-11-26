import AIUsageLog from '../../models/AIUsageLog.js';

/**
 * Configurable AI Usage, Cost Calculation & Rate-Limiting Service.
 * Pricing is read from environment variables rather than hardcoded.
 */
export const getUsageLimitsConfig = () => {
  const rawModel = (process.env.GEMINI_MODEL || 'gemini-3.5-flash').trim();
  const normalizedModel = rawModel.toLowerCase() === 'gemini 3.5 flash' ? 'gemini-3.5-flash' : rawModel;
  return {
    model: normalizedModel,
    // Only use an alternative model when the deployment explicitly configures one.
    fallbackModel: (process.env.GEMINI_FALLBACK_MODEL || '').trim() || null,
  maxOutputTokens: Number(process.env.AI_MAX_OUTPUT_TOKENS) || 4096,
  maxHistoryMessages: Number(process.env.AI_MAX_HISTORY_MESSAGES) || 20,
  userRpmLimit: Number(process.env.AI_USER_RPM_LIMIT) || 30,
  monthlySpendAlertUsd: Number(process.env.AI_MONTHLY_SPEND_ALERT_USD) || 25,
  maxDocumentChars: Number(process.env.AI_MAX_DOCUMENT_CHARS) || 24000,
  inputCostPer1MUsd: Number(process.env.AI_INPUT_COST_PER_1M_USD) || 0.15,
  outputCostPer1MUsd: Number(process.env.AI_OUTPUT_COST_PER_1M_USD) || 0.60,
  };
};

export const calculateEstimatedCostUsd = (inputTokens = 0, outputTokens = 0, thoughtsTokens = 0) => {
  const cfg = getUsageLimitsConfig();
  const inputCost = (Number(inputTokens || 0) / 1_000_000) * cfg.inputCostPer1MUsd;
  const effectiveOutput = Number(outputTokens || 0) + Number(thoughtsTokens || 0);
  const outputCost = (effectiveOutput / 1_000_000) * cfg.outputCostPer1MUsd;
  return Number((inputCost + outputCost).toFixed(6));
};

export const checkUserRateLimit = async (userId) => {
  const { userRpmLimit } = getUsageLimitsConfig();
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
  const recentCount = await AIUsageLog.countDocuments({
    userId,
    createdAt: { $gte: oneMinuteAgo },
  });
  if (recentCount >= userRpmLimit) {
    const err = new Error(`Rate limit exceeded (${userRpmLimit} AI requests/minute). Please wait a moment.`);
    err.status = 429;
    throw err;
  }
};

export const recordUsage = async ({
  userId,
  companyContext = 'GENERAL',
  conversationId = null,
  model,
  inputTokens = 0,
  outputTokens = 0,
  thoughtsTokens = 0,
  totalTokens = 0,
  toolCallsPerformed = [],
  durationMs = 0,
  status = 'SUCCESS',
  errorMessage = '',
}) => {
  const estimatedCostUsd = calculateEstimatedCostUsd(inputTokens, outputTokens, thoughtsTokens);
  return AIUsageLog.create({
    userId,
    companyContext: companyContext || 'GENERAL',
    conversationId,
    model: model || getUsageLimitsConfig().model,
    inputTokens,
    outputTokens,
    thoughtsTokens,
    totalTokens: totalTokens || inputTokens + outputTokens + thoughtsTokens,
    estimatedCostUsd,
    toolCallsPerformed,
    durationMs,
    status,
    errorMessage,
  });
};

export const getUsageDashboard = async (userId) => {
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const cfg = getUsageLimitsConfig();

  const [dailyAgg, monthlyAgg, recentLogs] = await Promise.all([
    AIUsageLog.aggregate([
      { $match: { userId, createdAt: { $gte: startOfDay } } },
      {
        $group: {
          _id: null,
          requests: { $sum: 1 },
          inputTokens: { $sum: '$inputTokens' },
          outputTokens: { $sum: '$outputTokens' },
          thoughtsTokens: { $sum: '$thoughtsTokens' },
          totalTokens: { $sum: '$totalTokens' },
          estimatedCostUsd: { $sum: '$estimatedCostUsd' },
        },
      },
    ]),
    AIUsageLog.aggregate([
      { $match: { userId, createdAt: { $gte: startOfMonth } } },
      {
        $group: {
          _id: null,
          requests: { $sum: 1 },
          inputTokens: { $sum: '$inputTokens' },
          outputTokens: { $sum: '$outputTokens' },
          thoughtsTokens: { $sum: '$thoughtsTokens' },
          totalTokens: { $sum: '$totalTokens' },
          estimatedCostUsd: { $sum: '$estimatedCostUsd' },
        },
      },
    ]),
    AIUsageLog.find({ userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('model companyContext inputTokens outputTokens totalTokens estimatedCostUsd toolCallsPerformed status createdAt durationMs')
      .lean(),
  ]);

  const daily = dailyAgg[0] || {
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    thoughtsTokens: 0,
    totalTokens: 0,
    estimatedCostUsd: 0,
  };
  const monthly = monthlyAgg[0] || {
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
    thoughtsTokens: 0,
    totalTokens: 0,
    estimatedCostUsd: 0,
  };

  return {
    config: cfg,
    daily,
    monthly,
    monthlyAlertTriggered: monthly.estimatedCostUsd >= cfg.monthlySpendAlertUsd,
    recentLogs,
  };
};

export default {
  getUsageLimitsConfig,
  calculateEstimatedCostUsd,
  checkUserRateLimit,
  recordUsage,
  getUsageDashboard,
};
