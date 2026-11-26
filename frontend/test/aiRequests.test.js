import test from 'node:test';
import assert from 'node:assert/strict';
import { getAIErrorMessage, isRequestCanceled, retryInterruptedRead } from '../src/utils/requestErrors.js';

test('An interrupted read retries once and recovers', async () => {
  let calls = 0;
  const result = await retryInterruptedRead(async () => {
    if (++calls === 1) throw { code: 'ECONNABORTED', message: 'Request aborted' };
    return { conversations: ['saved'] };
  }, { sleep: async () => {} });
  assert.deepEqual(result, { conversations: ['saved'] });
  assert.equal(calls, 2);
});

test('A persistent network error retries only once', async () => {
  let calls = 0;
  const error = { code: 'ERR_NETWORK' };
  await assert.rejects(retryInterruptedRead(async () => { calls++; throw error; }, { sleep: async () => {} }), (e) => e === error);
  assert.equal(calls, 2);
});

test('Canceled requests, HTTP errors and canceled retry delays are not replayed', async () => {
  for (const error of [{ code: 'ERR_CANCELED' }, { response: { status: 401 } }, { response: { status: 503 } }]) {
    let calls = 0;
    await assert.rejects(retryInterruptedRead(async () => { calls++; throw error; }), (e) => e === error);
    assert.equal(calls, 1);
  }
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(retryInterruptedRead(async () => { calls++; throw { code: 'ECONNABORTED' }; }, {
    signal: controller.signal, sleep: async () => controller.abort(),
  }));
  assert.equal(calls, 1);
  assert.equal(isRequestCanceled({ config: { signal: controller.signal } }), true);
});

test('AI errors show readable recovery instructions instead of raw JSON', () => {
  const error = { response: { status: 503, data: { message: '{"error":{"status":"UNAVAILABLE"}}' } } };
  assert.match(getAIErrorMessage(error), /temporarily busy/);
  assert.doesNotMatch(getAIErrorMessage(error), /\{|UNAVAILABLE/);
  assert.match(getAIErrorMessage({ code: 'ECONNABORTED' }), /connection was interrupted/);
  assert.match(getAIErrorMessage({ response: { status: 429 } }), /request limit/);
});

test('Model configuration failures ask for an administrator instead of suggesting a retry', () => {
  const error = { response: { status: 503, data: { code: 'AI_MODEL_CONFIGURATION_ERROR', retryable: false } } };
  assert.match(getAIErrorMessage(error), /GEMINI_MODEL or GEMINI_FALLBACK_MODEL/);
  assert.doesNotMatch(getAIErrorMessage(error), /temporarily busy|try again/i);
});
