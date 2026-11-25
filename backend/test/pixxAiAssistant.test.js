import test from 'node:test';
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import {
  assertCompanyAuthorized,
  resolveRequestedCompanies,
  assertWriteRoleAllowed,
} from '../src/services/ai/CompanyAuthorizationService.js';
import { calculateEstimatedCostUsd } from '../src/services/ai/AIUsageService.js';
import { buildSystemInstruction, runGeminiTurn } from '../src/services/ai/GeminiService.js';
import { toolDeclarations, createToolExecutor } from '../src/services/ai/AIToolRegistry.js';

dotenv.config();

test('AI SECURITY: enforces company-level authorization and blocks unauthorized cross-company access', () => {
  const restrictedUser = {
    _id: 'u1',
    email: 'manager@pixx.uk',
    role: 'manager',
    allowedCompanies: ['old-street', 'best-standard'],
  };

  const ok = assertCompanyAuthorized(restrictedUser, 'old-street');
  assert.equal(ok.companyId, 'old-street');

  assert.throws(
    () => assertCompanyAuthorized(restrictedUser, 'sk-hamilton'),
    /Forbidden: You do not have access to company "sk-hamilton"/
  );

  const allScope = resolveRequestedCompanies(restrictedUser, 'ALL');
  assert.deepEqual(allScope.companyIds, ['old-street', 'best-standard']);
});

test('AI SECURITY: viewer role is blocked from controlled write operations', () => {
  const viewerUser = { _id: 'u2', email: 'viewer@pixx.uk', role: 'viewer' };
  assert.throws(() => assertWriteRoleAllowed(viewerUser), /Viewer role cannot execute write operations/);
  assert.equal(assertWriteRoleAllowed({ _id: 'u3', role: 'admin' }), true);
});

test('AI SECURITY: system instruction includes prompt injection protection & untrusted data boundary', () => {
  const sys = buildSystemInstruction({
    user: { name: 'Test Admin', role: 'admin', allowedCompanies: ['old-street'] },
    activeCompanyId: 'old-street',
  });
  assert.match(sys, /UNTRUSTED DATA/);
  assert.match(sys, /OLD STREET/);
});

test('AI TOOLS: rejects unknown tool names and invalid write JSON payloads', async () => {
  const executor = createToolExecutor({
    user: { _id: 'u1', role: 'admin', allowedCompanies: ['old-street'] },
    activeCompanyId: 'old-street',
    conversationId: null,
  });

  await assert.rejects(() => executor('non_existent_tool', {}), /Unknown AI tool/);
  await assert.rejects(
    () =>
      executor('request_write_approval', {
        companyId: 'old-street',
        actionType: 'CREATE_PROPERTY_NOTE',
        title: 'Bad JSON',
        payloadJson: '{invalid-json',
      }),
    /Invalid JSON payload/
  );
});

test('AI COST CONTROL: calculates estimated USD cost from input/output/thoughts tokens', () => {
  const cost = calculateEstimatedCostUsd(1_000_000, 1_000_000, 0);
  assert.equal(cost, 0.75); // 0.15 + 0.60 with default env rates
});

test('GEMINI 3.5 FLASH LIVE: answers general question & executes list_companies tool', async () => {
  if (!process.env.GEMINI_API_KEY) {
    return;
  }
  const user = {
    _id: 'u1',
    name: 'Test Operator',
    role: 'admin',
    allowedCompanies: ['old-street', 'best-standard', 'sk-hamilton', 'homewards', 'mile-end-road', 'global-standard'],
  };
  const executor = createToolExecutor({ user, activeCompanyId: 'ALL', conversationId: null });

  const res = await runGeminiTurn({
    user,
    activeCompanyId: 'ALL',
    history: [],
    userMessage: 'Which UK companies am I authorized to access? Use your tool to check.',
    toolDeclarations,
    executeTool: executor,
  });

  assert.ok(res.reply && res.reply.length > 0, 'Expected non-empty Gemini reply');
  assert.ok(
    res.toolCalls.some((t) => t.name === 'list_companies' && t.status === 'SUCCESS'),
    'Expected list_companies tool to be executed'
  );
  assert.ok(res.usage.totalTokens > 0, 'Expected token usage metadata');
});
