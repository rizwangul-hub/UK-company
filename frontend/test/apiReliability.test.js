import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('API recovery keeps authentication and company isolation intact without replaying chat', async (t) => {
  const values = new Map([['token', 'offline-test-token'], ['selected_company', 'old-street'], ['user', '{"name":"Test"}']]);
  const events = [];
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key) => values.get(key) || null,
    removeItem: (key) => values.delete(key),
  } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    location: { pathname: '/company/old-street/pixx-ai' },
    dispatchEvent: (event) => events.push(event.type),
  } });
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  t.after(async () => {
    await server.close();
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else delete globalThis.localStorage;
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else delete globalThis.window;
  });
  const { default: api, aiAPI, authAPI, clearApiCache } = await server.ssrLoadModule('/src/services/api.js');
  let attempts = 0;
  api.defaults.adapter = async (config) => {
    attempts++;
    assert.equal(config.headers.Authorization, 'Bearer offline-test-token');
    assert.equal(config.headers['x-company-id'], 'old-street');
    if (attempts % 2 === 1) throw Object.assign(new Error('Request aborted'), { code: 'ECONNABORTED', config });
    return { config, status: 200, data: { success: true, data: { user: { name: 'Test' }, conversations: [] } } };
  };
  clearApiCache();
  await authAPI.getMe();
  assert.equal(attempts, 2);
  await aiAPI.getConversations();
  assert.equal(attempts, 4);

  api.defaults.adapter = async (config) => {
    attempts++;
    throw Object.assign(new Error('Provider busy'), { config, response: { status: 503, data: { message: 'AI temporarily unavailable' } } });
  };
  await assert.rejects(aiAPI.chat({ message: 'Offline test' }), /Provider busy/);
  assert.equal(attempts, 5, 'Chat must not be replayed by the browser');
  assert.equal(values.get('token'), 'offline-test-token');
  assert.deepEqual(events, []);

  clearApiCache();
  api.defaults.adapter = async (config) => {
    attempts++;
    throw Object.assign(new Error('Unauthorized'), { config, response: { status: 401 } });
  };
  await assert.rejects(authAPI.getMe(), /Unauthorized/);
  assert.equal(attempts, 6, 'An expired session must not be retried');
  assert.equal(values.has('token'), false);
  assert.equal(values.has('user'), false);
  assert.deepEqual(events, ['auth:logout']);
});
