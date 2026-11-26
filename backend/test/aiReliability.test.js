import test from 'node:test';
import assert from 'node:assert/strict';
import { getProviderStatus, requestGeminiContent } from '../src/services/ai/GeminiRequestService.js';
import { getGeminiClient, runGeminiTurn } from '../src/services/ai/GeminiService.js';
import { chatWithAssistant } from '../src/controllers/aiController.js';
import AIConversation from '../src/models/AIConversation.js';
import AIMessage from '../src/models/AIMessage.js';
import AIUsageLog from '../src/models/AIUsageLog.js';

const user = { _id: 'user-1', name: 'Test', role: 'admin', allowedCompanies: ['old-street'] };

test('Gemini recovers from a nested 503 using bounded backoff', async () => {
  const calls = [];
  const delays = [];
  const client = { models: { generateContent: async (params) => {
    calls.push(params);
    if (calls.length === 1) throw new Error('{"error":{"code":503,"status":"UNAVAILABLE"}}');
    return { text: 'Recovered' };
  } } };
  const result = await requestGeminiContent(client, { model: 'configured-model', config: { maxOutputTokens: 4096 } }, {
    sleep: async (ms) => delays.push(ms), random: () => 0,
  });
  assert.equal(result.response.text, 'Recovered');
  assert.deepEqual(delays, [800]);
  assert.equal(calls.length, 2);
  assert.equal(getProviderStatus({ status: '503' }), 503);
  assert.ok(calls.every((call) => call.model === 'configured-model' && call.config.maxOutputTokens === 4096));
  assert.ok(calls.every((call) => call.config.httpOptions.timeout <= 30_000 && call.config.httpOptions.retryOptions.attempts === 1));
});

test('Gemini persistent overload stops after two attempts and hides raw provider JSON', async () => {
  let calls = 0;
  await assert.rejects(requestGeminiContent({ models: { generateContent: async () => {
    calls++;
    throw { code: 503, message: '{"error":{"message":"internal provider response"}}' };
  } } }, {}, { sleep: async () => {}, random: () => 0 }), (error) => {
    assert.equal(error.status, 503);
    assert.equal(error.retryable, true);
    assert.equal(error.retryAfterSeconds, 10);
    assert.match(error.message, /temporarily busy/);
    assert.doesNotMatch(error.message, /internal provider|\{/);
    return true;
  });
  assert.equal(calls, 2);
});

test('Gemini does not retry invalid credentials, bad requests, or programming errors', async () => {
  for (const failure of [{ status: 400 }, { status: 401 }, { status: 403 }, { status: 404 }, new TypeError('Programming error')]) {
    let calls = 0;
    await assert.rejects(requestGeminiContent({ models: { generateContent: async () => {
      calls++;
      throw failure;
    } } }, { model: 'primary' }, { fallbackModel: 'configured-alternative' }), (error) => error.retryable === false && error.status === 502);
    assert.equal(calls, 1);
  }
});

test('Gemini uses an explicitly configured fallback on overload and reports the actual model', async () => {
  const calls = [];
  const result = await requestGeminiContent({ models: { generateContent: async ({ model }) => {
    calls.push(model);
    if (model === 'primary') throw { status: 503 };
    return { text: 'Recovered on alternative' };
  } } }, { model: 'primary' }, { fallbackModel: 'configured-alternative' });
  assert.deepEqual(calls, ['primary', 'configured-alternative']);
  assert.equal(result.activeModel, 'configured-alternative');
  assert.equal(result.response.text, 'Recovered on alternative');
});

test('Gemini respects a shared deadline and recognizes network timeouts', async () => {
  assert.equal(getProviderStatus({ name: 'TimeoutError' }), 504);
  assert.equal(getProviderStatus({ cause: { code: 'ECONNRESET' } }), 504);
  let calls = 0;
  const client = { models: { generateContent: async () => { calls++; throw { status: 503 }; } } };
  await assert.rejects(requestGeminiContent(client, {}, {
    deadline: 500, now: () => 0, random: () => 0, sleep: async () => assert.fail('Deadline forbids retry'),
  }), { status: 503 });
  assert.equal(calls, 1);
  await assert.rejects(requestGeminiContent(client, {}, { deadline: 0, now: () => 0 }), { status: 503 });
  assert.equal(calls, 1);
});

test('A model retry after a tool result never re-executes the completed tool', async () => {
  let modelCalls = 0;
  let toolCalls = 0;
  const client = { models: { generateContent: async () => {
    modelCalls++;
    if (modelCalls === 1) return {
      functionCalls: [{ name: 'test_tool', args: {} }],
      candidates: [{ content: { role: 'model', parts: [{ functionCall: { name: 'test_tool', args: {} } }] } }],
    };
    if (modelCalls === 2) throw { status: 503 };
    return { text: 'Verified result', usageMetadata: { totalTokenCount: 10 } };
  } } };
  const result = await runGeminiTurn({ user, userMessage: 'Check data', client, executeTool: async () => {
    toolCalls++;
    return { recordCount: 3 };
  } });
  assert.equal(result.reply, 'Verified result');
  assert.equal(modelCalls, 3);
  assert.equal(toolCalls, 1);
  assert.equal(result.toolCalls.length, 1);
});

function mockConversation(t, messages = [], context = 'old-street') {
  t.mock.method(AIUsageLog, 'countDocuments', async () => 0);
  t.mock.method(AIUsageLog, 'create', async (data) => data);
  t.mock.method(AIConversation, 'create', async () => ({ _id: 'conv-1' }));
  t.mock.method(AIConversation, 'findOne', () => ({ lean: async () => ({ _id: 'conv-1', companyContext: context }) }));
  t.mock.method(AIConversation, 'updateOne', async () => ({}));
  t.mock.method(AIMessage, 'find', () => {
    const query = { sort: () => query, limit: () => query, select: () => query, lean: async () => [...messages] };
    return query;
  });
  const create = t.mock.method(AIMessage, 'create', async (data) => ({ ...data, _id: `${data.role}-1` }));
  return create;
}

function mockProvider(t, generate) {
  const originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'offline-test-key';
  t.after(() => {
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
  });
  t.mock.method(getGeminiClient().models, 'generateContent', generate);
  t.after(() => t.mock.restoreAll());
}

async function chat(body) {
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(payload) { this.payload = payload; return this; } };
  await chatWithAssistant({ user, body }, res);
  return res;
}

test('Failed chat returns the saved prompt and conversation ID for recovery', async (t) => {
  const create = mockConversation(t);
  mockProvider(t, async () => { throw { status: 400, message: 'private provider configuration detail' }; });
  const response = await chat({ message: 'Show rent', companyContext: 'old-street' });
  assert.equal(response.statusCode, 502);
  assert.equal(response.payload.code, 'AI_PROVIDER_ERROR');
  assert.equal(response.payload.data.conversationId, 'conv-1');
  assert.equal(response.payload.data.userMessage.content, 'Show rent');
  assert.equal(create.mock.callCount(), 1);
  assert.doesNotMatch(response.payload.message, /private provider/);
});

test('Explicit retry reuses the latest unanswered prompt without duplicating history', async (t) => {
  const saved = { _id: 'user-1', role: 'user', content: 'Show rent', companyContext: 'old-street' };
  const create = mockConversation(t, [saved]);
  mockProvider(t, async (params) => {
    assert.equal(params.contents.filter((c) => c.parts?.[0]?.text === 'Show rent').length, 1);
    return { text: 'Verified rent summary' };
  });
  const response = await chat({ conversationId: 'conv-1', message: 'Show rent', companyContext: 'old-street', retryMessageId: 'user-1' });
  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.success, true);
  assert.equal(create.mock.callCount(), 1);
  assert.equal(create.mock.calls[0].arguments[0].role, 'assistant');
});

test('Retry rejects changed messages and company contexts before contacting Gemini', async (t) => {
  const saved = { _id: 'user-1', role: 'user', content: 'Show rent', companyContext: 'old-street' };
  const create = mockConversation(t, [saved]);
  let providerCalls = 0;
  mockProvider(t, async () => { providerCalls++; return { text: 'Unexpected' }; });
  for (const body of [
    { conversationId: 'conv-1', message: 'Different prompt', companyContext: 'old-street', retryMessageId: 'user-1' },
    { conversationId: 'conv-1', message: 'Show rent', companyContext: 'ALL', retryMessageId: 'user-1' },
    { conversationId: 'conv-1', message: 'Show rent', companyContext: 'old-street', retryMessageId: 'different-id' },
  ]) assert.equal((await chat(body)).statusCode, 409);
  assert.equal((await chat({ message: 'Show rent', retryMessageId: 'user-1' })).statusCode, 400);
  assert.equal(providerCalls, 0);
  assert.equal(create.mock.callCount(), 0);
});
