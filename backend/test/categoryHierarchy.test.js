import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import '../src/config/env.js';

// Models
import Category from '../src/models/Category.js';
import Transaction from '../src/models/Transaction.js';
import Account from '../src/models/Account.js';
import { VALID_COMPANY_IDS } from '../src/config/companies.js';

// Seeding & Services
import {
  AUTHORITATIVE_HEADS_HIERARCHY,
  seedHeadsAndSubHeadsForCompany,
} from '../src/scripts/seedHeadsAndSubHeads.js';
import {
  resolveAndValidateCategoryHierarchy,
  getCategoryHierarchy,
  createHeadCategory,
  createSubHeadCategory,
  updateCategoryHierarchy,
  deleteCategoryHierarchy,
} from '../src/services/categoryService.js';
import {
  previewBackfill,
  applyBackfill,
} from '../src/services/categoryBackfillService.js';

let sharedAccountId = null;

test.before(async () => {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGO_URI);
  }

  // Ensure test account exists
  let acc = await Account.findOne({ companyId: 'old-street' });
  if (!acc) {
    acc = await Account.create({
      companyId: 'old-street',
      name: 'TEST_CAT_ACCOUNT',
      accountType: 'BANK',
      currentBalance: 5000,
    });
  }
  sharedAccountId = acc._id;
});

test.after(async () => {
  // Clean up any test transactions created during test runs
  await Transaction.deleteMany({ narration: { $regex: /^TEST_CAT_HIERARCHY/ } });
  await Category.deleteMany({ name: { $regex: /^TEST_CAT_/ } });
  await Account.deleteMany({ name: 'TEST_CAT_ACCOUNT' });
  await mongoose.disconnect();
});

// -----------------------------------------------------------------------------
// 1. SCHEMA INTEGRITY
// -----------------------------------------------------------------------------
test('SCHEMA: Category model contains hierarchy, alias, and multi-company fields', () => {
  const paths = Category.schema.paths;
  assert.ok(paths.companyId, 'Category must have companyId');
  assert.ok(paths.name, 'Category must have name');
  assert.ok(paths.type, 'Category must have type');
  assert.ok(paths.isMainHead, 'Category must have isMainHead flag');
  assert.ok(paths.parentCategoryId, 'Category must have parentCategoryId reference');
  assert.ok(paths.aliases, 'Category must have aliases array');
  assert.ok(paths.isActive, 'Category must have isActive flag');

  const indexes = Category.schema.indexes();
  const hasHierarchyIndex = indexes.some(
    ([idx]) => idx.companyId === 1 && idx.name === 1 && idx.parentCategoryId === 1
  );
  assert.ok(hasHierarchyIndex, 'Category must have compound index on { companyId, name, parentCategoryId }');
});

test('SCHEMA: Transaction model contains dual Head and Sub Head references and compound index', () => {
  const paths = Transaction.schema.paths;
  assert.ok(paths.headId, 'Transaction must have headId ObjectId');
  assert.ok(paths.subHeadId, 'Transaction must have subHeadId ObjectId');
  assert.ok(paths.head, 'Transaction must have textual head field');
  assert.ok(paths.subHead, 'Transaction must have textual subHead field');

  const indexes = Transaction.schema.indexes();
  const hasHeadSubHeadIndex = indexes.some(
    ([idx]) => idx.companyId === 1 && idx.headId === 1 && idx.subHeadId === 1
  );
  assert.ok(hasHeadSubHeadIndex, 'Transaction must have index on { companyId, headId, subHeadId }');
});

// -----------------------------------------------------------------------------
// 2. AUTHORITATIVE LIST STRUCTURE
// -----------------------------------------------------------------------------
test('HIERARCHY CONFIG: Authoritative list contains all 6 required Heads with workbook spellings', () => {
  const headNames = AUTHORITATIVE_HEADS_HIERARCHY.map((h) => h.name);
  assert.deepEqual(headNames, [
    'Income',
    'Admin Expenses',
    'Interest Expenses',
    'Loan',
    'Others',
    'Property Purchase',
  ]);

  const adminHead = AUTHORITATIVE_HEADS_HIERARCHY.find((h) => h.name === 'Admin Expenses');
  assert.ok(adminHead.aliases.includes('Admin Expeses'), 'Admin Expenses must support Admin Expeses alias');

  const adminSubHeadNames = adminHead.subHeads.map((s) => s.name);
  assert.ok(adminSubHeadNames.includes('Repair and Maintainance'), 'Must include workbook spelling: Repair and Maintainance');
  assert.ok(adminSubHeadNames.includes('Rent Depsit Refund'), 'Must include workbook spelling: Rent Depsit Refund');

  const interestHead = AUTHORITATIVE_HEADS_HIERARCHY.find((h) => h.name === 'Interest Expenses');
  const interestSubHeadNames = interestHead.subHeads.map((s) => s.name);
  assert.ok(interestSubHeadNames.includes('12 & 12a Alaxandra'), 'Interest Expenses must include 12 & 12a Alaxandra');
  assert.ok(interestSubHeadNames.includes('62 Orsett Road'), 'Interest Expenses must include 62 Orsett Road');
});

// -----------------------------------------------------------------------------
// 3. SEEDING & IDEMPOTENCY
// -----------------------------------------------------------------------------
test('SEEDING: seedHeadsAndSubHeadsForCompany idempotently seeds Heads and Sub Heads', async () => {
  const companyId = 'old-street';

  // First seed execution
  const res1 = await seedHeadsAndSubHeadsForCompany(companyId);
  assert.ok(res1, 'Seed result returned');

  // Verify all 6 Main Heads exist
  const heads = await Category.find({ companyId, isMainHead: true });
  assert.strictEqual(heads.length, 6, 'Must have exactly 6 Main Heads in old-street');

  // Verify Admin Expenses alias exists
  const adminDoc = await Category.findOne({ companyId, name: 'Admin Expenses' });
  assert.ok(adminDoc, 'Admin Expenses head must exist');
  assert.ok(adminDoc.aliases.includes('Admin Expeses'), 'Admin Expenses must have Admin Expeses alias in DB');

  // Verify subheads under Admin Expenses
  const adminSubs = await Category.find({ companyId, parentCategoryId: adminDoc._id });
  assert.ok(adminSubs.length >= 18, `Admin Expenses must have at least 18 subheads, got ${adminSubs.length}`);

  // Second seed execution must not duplicate
  const res2 = await seedHeadsAndSubHeadsForCompany(companyId);
  assert.strictEqual(res2.headsCreated, 0, 'Second seed run must create 0 duplicate Heads');
  assert.strictEqual(res2.subHeadsCreated, 0, 'Second seed run must create 0 duplicate Sub Heads');

  const headsAfter = await Category.find({ companyId, isMainHead: true });
  assert.strictEqual(headsAfter.length, 6, 'Head count must remain strictly 6');
});

// -----------------------------------------------------------------------------
// 4. PARENT-CHILD HIERARCHY VALIDATION
// -----------------------------------------------------------------------------
test('HIERARCHY VALIDATION: resolveAndValidateCategoryHierarchy enforces parent-child integrity', async () => {
  const companyId = 'old-street';
  const incomeHead = await Category.findOne({ companyId, name: 'Income', isMainHead: true });
  const adminHead = await Category.findOne({ companyId, name: 'Admin Expenses', isMainHead: true });
  const rentSub = await Category.findOne({ companyId, name: 'Rent', parentCategoryId: incomeHead._id });
  const utilitiesSub = await Category.findOne({ companyId, name: 'Utilities', parentCategoryId: adminHead._id });

  assert.ok(incomeHead && adminHead && rentSub && utilitiesSub, 'Setup categories must exist');

  // 1. Valid matching Head & Sub Head
  const validResolved = await resolveAndValidateCategoryHierarchy({
    companyId,
    headId: incomeHead._id,
    subHeadId: rentSub._id,
  });
  assert.strictEqual(validResolved.headId.toString(), incomeHead._id.toString());
  assert.strictEqual(validResolved.subHeadId.toString(), rentSub._id.toString());
  assert.strictEqual(validResolved.head, 'Income');
  assert.strictEqual(validResolved.subHead, 'Rent');

  // 2. Mismatched Sub Head and Head must throw
  await assert.rejects(
    async () => {
      await resolveAndValidateCategoryHierarchy({
        companyId,
        headId: adminHead._id, // Admin Head
        subHeadId: rentSub._id, // Rent (belongs to Income!)
      });
    },
    /does not belong to the selected Head/
  );

  // 3. Resolving textual names with alias
  const aliasResolved = await resolveAndValidateCategoryHierarchy({
    companyId,
    head: 'Admin Expeses', // Alias
    subHead: 'Utilities',
  });
  assert.strictEqual(aliasResolved.head, 'Admin Expenses');
  assert.strictEqual(aliasResolved.headId.toString(), adminHead._id.toString());
  assert.strictEqual(aliasResolved.subHead, 'Utilities');
  assert.strictEqual(aliasResolved.subHeadId.toString(), utilitiesSub._id.toString());
});

// -----------------------------------------------------------------------------
// 5. MOVING A SUB HEAD SYNCS LINKED TRANSACTIONS
// -----------------------------------------------------------------------------
test('HIERARCHY SERVICE: updateCategoryHierarchy moving a Sub Head updates linked transactions', async () => {
  const companyId = 'old-street';

  // Create temporary Head A and Head B
  const headA = await createHeadCategory({
    companyId,
    name: 'TEST_CAT_HEAD_A',
    type: 'OPERATING_EXPENSE',
  });
  const headB = await createHeadCategory({
    companyId,
    name: 'TEST_CAT_HEAD_B',
    type: 'OPERATING_EXPENSE',
  });

  // Create Sub Head under Head A
  const subHead = await createSubHeadCategory({
    companyId,
    headId: headA._id,
    name: 'TEST_CAT_SUB_A',
  });

  // Create test transaction linked to Sub Head and Head A
  const tx = await Transaction.create({
    companyId,
    accountId: sharedAccountId,
    voucherNo: 'TEST_TX_' + Date.now(),
    transactionDate: new Date(),
    transactionType: 'EXPENSE',
    amount: 150.0,
    headId: headA._id,
    subHeadId: subHead._id,
    head: headA.name,
    subHead: subHead.name,
    narration: 'TEST_CAT_HIERARCHY Move Test',
    status: 'POSTED',
  });

  // Move Sub Head from Head A to Head B
  await updateCategoryHierarchy({
    companyId,
    categoryId: subHead._id,
    updateData: {
      parentCategoryId: headB._id,
    },
  });

  // Verify Sub Head's parent is now Head B
  const updatedSub = await Category.findById(subHead._id);
  assert.strictEqual(updatedSub.parentCategoryId.toString(), headB._id.toString());

  // Verify Transaction is synced to Head B!
  const updatedTx = await Transaction.findById(tx._id);
  assert.strictEqual(updatedTx.headId.toString(), headB._id.toString());
  assert.strictEqual(updatedTx.head, headB.name);
  assert.strictEqual(updatedTx.subHeadId.toString(), subHead._id.toString());

  // Clean up
  await Transaction.deleteOne({ _id: tx._id });
  await Category.deleteMany({ _id: { $in: [headA._id, headB._id, subHead._id] } });
});

// -----------------------------------------------------------------------------
// 6. DELETE PROTECTION
// -----------------------------------------------------------------------------
test('HIERARCHY SERVICE: deleteCategoryHierarchy blocks deletion of categories linked to transactions', async () => {
  const companyId = 'old-street';

  const testHead = await createHeadCategory({
    companyId,
    name: 'TEST_CAT_HEAD_DEL',
    type: 'OPERATING_EXPENSE',
  });

  const testSub = await createSubHeadCategory({
    companyId,
    headId: testHead._id,
    name: 'TEST_CAT_SUB_DEL',
  });

  let tx = null;
  try {
    // Block Head deletion because it contains a Sub Head
    await assert.rejects(
      async () => {
        await deleteCategoryHierarchy({ companyId, categoryId: testHead._id });
      },
      /contains.*Sub Head/i
    );

    // Link a transaction to Sub Head
    tx = await Transaction.create({
      companyId,
      accountId: sharedAccountId,
      voucherNo: 'TEST_DEL_' + Date.now(),
      transactionDate: new Date(),
      transactionType: 'EXPENSE',
      amount: 75.0,
      headId: testHead._id,
      subHeadId: testSub._id,
      head: testHead.name,
      subHead: testSub.name,
      narration: 'TEST_CAT_HIERARCHY Delete Protection Test',
      status: 'POSTED',
    });

    // Block Sub Head deletion because a transaction references it
    await assert.rejects(
      async () => {
        await deleteCategoryHierarchy({ companyId, categoryId: testSub._id });
      },
      /linked to.*active transaction/i
    );
  } finally {
    // Clean up
    if (tx) await Transaction.deleteOne({ _id: tx._id });
    try { await deleteCategoryHierarchy({ companyId, categoryId: testSub._id }); } catch {}
    try { await deleteCategoryHierarchy({ companyId, categoryId: testHead._id }); } catch {}
    await Category.deleteMany({ name: { $regex: /^TEST_CAT_/ } });
  }
});

// -----------------------------------------------------------------------------
// 7. BACKFILL HEURISTICS & APPLICATION
// -----------------------------------------------------------------------------
test('BACKFILL SERVICE: Heuristics classify unlinked transactions and apply backfill correctly', async () => {
  const companyId = 'old-street';

  // Seed heads and subheads first
  await seedHeadsAndSubHeadsForCompany(companyId);

  // Create unlinked legacy transaction
  const tx = await Transaction.create({
    companyId,
    accountId: sharedAccountId,
    voucherNo: 'TEST_BF_' + Date.now(),
    transactionDate: new Date(),
    transactionType: 'EXPENSE',
    amount: 220.0,
    narration: 'TEST_CAT_HIERARCHY British Gas Electricity Bill',
    headId: null,
    subHeadId: null,
    head: '',
    subHead: '',
    status: 'POSTED',
  });

  try {
    // Preview backfill
    const preview = await previewBackfill({ companyId, limit: 100 });
    assert.ok(preview.rows.length > 0, 'Backfill preview should return rows');

    const previewRow = preview.rows.find((r) => r.transactionId.toString() === tx._id.toString());
    assert.ok(previewRow, 'Test transaction should appear in backfill preview');
    assert.strictEqual(previewRow.suggestedHead, 'Admin Expenses');
    assert.strictEqual(previewRow.suggestedSubHead, 'Utilities');

    // Apply backfill
    const applyResult = await applyBackfill({
      companyId,
      updates: [
        {
          transactionId: tx._id,
          headId: previewRow.suggestedHeadId,
          subHeadId: previewRow.suggestedSubHeadId,
        },
      ],
    });
    assert.strictEqual(applyResult.updated, 1, 'Exactly 1 transaction should be updated');

    // Verify transaction in DB
    const updatedTx = await Transaction.findById(tx._id);
    assert.strictEqual(updatedTx.head, 'Admin Expenses');
    assert.strictEqual(updatedTx.subHead, 'Utilities');
    assert.ok(updatedTx.headId, 'headId must be set');
    assert.ok(updatedTx.subHeadId, 'subHeadId must be set');
  } finally {
    // Clean up
    await Transaction.deleteOne({ _id: tx._id });
  }
});

// -----------------------------------------------------------------------------
// 8. MULTI-COMPANY ISOLATION
// -----------------------------------------------------------------------------
test('MULTI-COMPANY: Category hierarchy is strictly partitioned across companies', async () => {
  const company1 = 'old-street';
  const company2 = 'sk-hamilton';

  await Category.deleteMany({ name: { $regex: /^TEST_CAT_/ } });
  await seedHeadsAndSubHeadsForCompany(company1);
  await seedHeadsAndSubHeadsForCompany(company2);

  const tree1 = await getCategoryHierarchy(company1);
  const tree2 = await getCategoryHierarchy(company2);

  assert.strictEqual(tree1.heads.length, 6, 'Company 1 must have 6 Heads');
  assert.strictEqual(tree2.heads.length, 6, 'Company 2 must have 6 Heads');

  // Check that IDs between company 1 and company 2 are completely distinct
  const c1HeadIds = new Set(tree1.heads.map((h) => h._id.toString()));
  const c2HeadIds = new Set(tree2.heads.map((h) => h._id.toString()));

  for (const id of c1HeadIds) {
    assert.ok(!c2HeadIds.has(id), 'Category IDs must never overlap between companies');
  }
});
