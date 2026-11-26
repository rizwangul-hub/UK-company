const TRANSIENT_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const NETWORK_CODES = new Set(['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'ERR_NETWORK']);

export function getProviderStatus(error) {
  let details;
  try {
    details = JSON.parse(error?.message || '{}');
  } catch {
    // Some SDK versions put the provider response in a JSON message.
  }
  const code = [error?.status, error?.response?.status, error?.error?.code, details?.error?.code, error?.code]
    .map(Number).find((value) => Number.isInteger(value) && value >= 400 && value <= 599);
  if (code) return code;
  if (['AbortError', 'TimeoutError'].includes(error?.name) || NETWORK_CODES.has(error?.code || error?.cause?.code)) return 504;
  return null;
}

export function toAIProviderError(cause) {
  if (typeof cause?.code === 'string' && cause.code.startsWith('AI_')) return cause;
  const status = getProviderStatus(cause);
  const retryable = TRANSIENT_STATUSES.has(status);
  const message = status === 429
    ? 'The AI service has reached its request limit. Please wait a moment and try again.'
    : status === 408 || status === 504
      ? 'The AI service took too long to respond. Please try again shortly.'
      : retryable
        ? 'The AI service is temporarily busy. Please try again shortly.'
        : 'The AI service could not process this request. Please contact your administrator if this continues.';
  return Object.assign(new Error(message, { cause }), {
    status: retryable ? (status === 429 ? 429 : 503) : 502,
    code: retryable ? 'AI_TEMPORARILY_UNAVAILABLE' : 'AI_PROVIDER_ERROR',
    retryable,
    retryAfterSeconds: retryable ? 10 : null,
  });
}

// Retry only the model request, never the surrounding chat or executed tools.
// Disable SDK retries so their delays cannot multiply this bounded retry loop.
export async function requestGeminiContent(client, params, {
  deadline = Date.now() + 65_000,
  now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  random = Math.random,
  fallbackModel = null,
} = {}) {
  const modelsToTry = [params.model];
  if (fallbackModel && fallbackModel !== params.model) {
    modelsToTry.push(fallbackModel);
  }

  for (const currentModel of modelsToTry) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const remaining = deadline - now();
      if (remaining <= 0) {
        throw toAIProviderError({ status: 504 });
      }
      try {
        const response = await client.models.generateContent({
          ...params,
          model: currentModel,
          config: {
            ...params.config,
            httpOptions: {
              ...params.config?.httpOptions,
              timeout: Math.min(30_000, remaining),
              retryOptions: { attempts: 1 },
            },
          },
        });
        return { response, activeModel: currentModel };
      } catch (cause) {
        const error = toAIProviderError(cause);
        if (!error.retryable) throw error;
        const isLastModel = currentModel === modelsToTry[modelsToTry.length - 1];
        const delay = 800 * (2 ** attempt) + Math.floor(random() * 400);

        // If this model is experiencing high demand (503/429) and we have a fallback model available,
        // switch immediately to the fallback model on the next iteration
        if (error.retryable && !isLastModel && attempt === 0) {
          console.warn(`[GeminiRequestService] Model ${currentModel} returned ${error.status}. Failing over to fallback ${fallbackModel}...`);
          break;
        }

        if (attempt === 1 || deadline - now() <= delay) {
          if (isLastModel) throw error;
          break;
        }
        await sleep(delay);
      }
    }
  }
}
