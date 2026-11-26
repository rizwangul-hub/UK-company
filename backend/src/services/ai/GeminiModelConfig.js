// Accept Gemini model IDs, not display names, URLs, API keys or masked UI values.
export function normalizeGeminiModelName(value) {
  if (typeof value !== 'string') return null;
  const model = value.trim().toLowerCase().replace(/^models\//, '').replace(/\s+/g, '-');
  return /^gemini-[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(model) ? model : null;
}

export function modelConfigurationError(cause) {
  return Object.assign(new Error(
    'The AI model configuration is invalid. Ask your administrator to check GEMINI_MODEL and GEMINI_FALLBACK_MODEL.',
    { cause },
  ), { status: 503, code: 'AI_MODEL_CONFIGURATION_ERROR', retryable: false });
}
