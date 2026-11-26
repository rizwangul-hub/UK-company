export const isRequestCanceled = (error) => Boolean(
  error?.code === 'ERR_CANCELED' || error?.__CANCEL__ || error?.name === 'AbortError'
  || error?.config?.signal?.aborted
);

const isInterrupted = (error) => !error?.response && (
  ['ECONNABORTED', 'ERR_NETWORK', 'ETIMEDOUT'].includes(error?.code)
  || error?.message === 'Request aborted'
);

// Safe reads can recover from one interrupted connection. Never replay a mutation.
export async function retryInterruptedRead(read, { signal, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {}) {
  try {
    return await read();
  } catch (error) {
    if (signal?.aborted || isRequestCanceled(error) || !isInterrupted(error)) throw error;
    await sleep(350);
    if (signal?.aborted) throw error;
    return read();
  }
}

export function getAIErrorMessage(error) {
  const data = error?.response?.data;
  const status = Number(error?.response?.status || data?.error?.code);
  if (data?.code === 'AI_NOT_CONFIGURED') return 'The AI service is not configured. Please contact your administrator.';
  if (data?.code === 'AI_MODEL_CONFIGURATION_ERROR') return 'The AI model setting is invalid. An administrator needs to correct GEMINI_MODEL or GEMINI_FALLBACK_MODEL in the backend settings.';
  if (status === 429) return 'The AI request limit has been reached. Please wait a moment and try again.';
  if (status === 503 || status === 504) return 'The AI service is temporarily busy or unavailable. Your message is kept below; please try again shortly.';
  if (isRequestCanceled(error) || isInterrupted(error)) return 'The connection was interrupted. Your message is kept below. Check your connection before trying again.';
  return typeof data?.message === 'string' && !data.message.trim().startsWith('{')
    ? data.message
    : 'The AI request could not be completed. Please try again.';
}
