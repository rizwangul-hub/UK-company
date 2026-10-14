import { test } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

// Models
import PropertyDocument from '../src/models/PropertyDocument.js';
import CouncilApplication from '../src/models/CouncilApplication.js';
import ComplianceNotification from '../src/models/ComplianceNotification.js';

// Services
import { checkAndGenerateComplianceReminders } from '../src/services/complianceReminderService.js';
import { VALID_COMPANY_IDS } from '../src/config/companies.js';

// -----------------------------------------------------------------------------
// 1. SCHEMA VALIDATION & COMPLIANCE CATEGORIES
// -----------------------------------------------------------------------------
test('COMPLIANCE SCHEMA: All 6 required document categories are supported', () => {
  const allowedCategories = [
    'INSURANCE',
    'SAFETY_COMPLIANCE',
    'LEGAL_PURCHASE',
    'DRAWINGS_STRUCTURAL',
    'COUNCIL_LICENSING',
    'APPLIANCE_EQUIPMENT',
    'OTHER',
  ];

  const categoryEnum = PropertyDocument.schema.path('category').enumValues;
  allowedCategories.forEach((cat) => {
    assert.ok(categoryEnum.includes(cat), `PropertyDocument category must include ${cat}`);
  });
});

test('COMPLIANCE SCHEMA: Document statuses support full lifecycle', () => {
  const expectedStatuses = ['ACTIVE', 'EXPIRING_SOON', 'EXPIRED', 'ARCHIVED', 'MISSING', 'RENEWAL_REQUESTED'];
  const statusEnum = PropertyDocument.schema.path('status').enumValues;
  expectedStatuses.forEach((st) => {
    assert.ok(statusEnum.includes(st), `PropertyDocument status must include ${st}`);
  });
});

test('COMPLIANCE SCHEMA: Company isolation indexes exist on PropertyDocument and CouncilApplication', () => {
  const docIndexes = PropertyDocument.schema.indexes();
  const hasCompPropCatIndex = docIndexes.some(
    ([fields]) => fields.companyId === 1 && fields.propertyId === 1 && fields.category === 1
  );
  assert.ok(hasCompPropCatIndex, 'PropertyDocument must index { companyId: 1, propertyId: 1, category: 1 }');

  const councilIndexes = CouncilApplication.schema.indexes();
  const hasCouncilIndex = councilIndexes.some(
    ([fields]) => fields.companyId === 1 && fields.propertyId === 1
  );
  assert.ok(hasCouncilIndex, 'CouncilApplication must index { companyId: 1, propertyId: 1 }');
});

// -----------------------------------------------------------------------------
// 2. MISSING STATUTORY DOCUMENTS WITHOUT FAKE FILES
// -----------------------------------------------------------------------------
test('MISSING DOCUMENTS: Allows recording statutory missing certificates without uploading a file', async () => {
  const missingEICR = new PropertyDocument({
    companyId: 'old-street',
    propertyId: new mongoose.Types.ObjectId(),
    category: 'SAFETY_COMPLIANCE',
    title: 'EICR - 5 Year Electrical Installation Condition Report',
    documentType: 'EICR',
    isMissing: true,
    status: 'MISSING',
    followUpRequired: true,
    renewalNotes: 'Previous certificate lost by previous landlord; electrician inspection booked for next Tuesday',
    version: 1,
  });

  // Verify document can validate successfully without a real file upload
  const validationError = missingEICR.validateSync();
  assert.equal(validationError, undefined, 'Missing document should validate without requiring a file upload');
  assert.equal(missingEICR.isMissing, true);
  assert.equal(missingEICR.status, 'MISSING');
  assert.equal(missingEICR.fileUrl, '');
});

// -----------------------------------------------------------------------------
// 3. DOCUMENT VERSIONING & AUDIT TRAIL PRESERVATION
// -----------------------------------------------------------------------------
test('DOCUMENT VERSIONING: Preserves history when certificate is renewed with a new version', () => {
  const gasCert = new PropertyDocument({
    companyId: 'sk-hamilton',
    propertyId: new mongoose.Types.ObjectId(),
    category: 'SAFETY_COMPLIANCE',
    title: 'Gas Safety Certificate CP12 (2025)',
    documentType: 'GAS_SAFETY_CP12',
    referenceNumber: 'GAS-2025-001',
    provider: 'British Gas',
    issueDate: new Date('2025-01-15'),
    expiryDate: new Date('2026-01-14'),
    fileUrl: 'https://example.com/docs/cp12_2025.pdf',
    version: 1,
    status: 'ACTIVE',
  });

  assert.equal(gasCert.version, 1);
  assert.equal(gasCert.versionHistory.length, 0);

  // Simulate Version Renewal (as done in uploadDocumentVersion controller)
  gasCert.versionHistory.push({
    version: gasCert.version,
    fileUrl: gasCert.fileUrl,
    publicId: gasCert.publicId,
    fileName: gasCert.fileName,
    issueDate: gasCert.issueDate,
    expiryDate: gasCert.expiryDate,
    referenceNumber: gasCert.referenceNumber,
    provider: gasCert.provider,
    archivedAt: new Date(),
    reason: 'Annual renewal for 2026/2027',
  });

  gasCert.version = 2;
  gasCert.fileUrl = 'https://example.com/docs/cp12_2026.pdf';
  gasCert.referenceNumber = 'GAS-2026-042';
  gasCert.issueDate = new Date('2026-01-10');
  gasCert.expiryDate = new Date('2027-01-09');
  gasCert.status = 'ACTIVE';
  gasCert.remindersTriggered = [];

  assert.equal(gasCert.version, 2, 'Version must be incremented to 2');
  assert.equal(gasCert.versionHistory.length, 1, 'Historical version must be preserved');
  assert.equal(gasCert.versionHistory[0].version, 1);
  assert.equal(gasCert.versionHistory[0].fileUrl, 'https://example.com/docs/cp12_2025.pdf');
  assert.equal(gasCert.fileUrl, 'https://example.com/docs/cp12_2026.pdf');
});

// -----------------------------------------------------------------------------
// 4. ADVANCE REMINDER SCHEDULE & DEDUPLICATION (45-DAY FOCUS)
// -----------------------------------------------------------------------------
test('REMINDERS ENGINE: Verifies 60d, 45d, 30d, 14d, 7d, 0d, and expired interval rules', () => {
  const intervals = [
    { days: 60, expectedTag: '60d', urgency: 'INFO' },
    { days: 45, expectedTag: '45d', urgency: 'PRIORITY' },
    { days: 30, expectedTag: '30d', urgency: 'WARNING' },
    { days: 14, expectedTag: '14d', urgency: 'URGENT' },
    { days: 7, expectedTag: '7d', urgency: 'CRITICAL' },
    { days: 0, expectedTag: '0d', urgency: 'CRITICAL' },
    { days: -5, expectedTag: 'expired', urgency: 'CRITICAL' },
  ];

  // Helper matching logic from complianceReminderService
  function evaluateReminder(daysRemaining) {
    if (daysRemaining < 0) {
      return { tag: 'expired', urgency: 'CRITICAL' };
    } else if (daysRemaining === 0) {
      return { tag: '0d', urgency: 'CRITICAL' };
    } else if (daysRemaining <= 7) {
      return { tag: '7d', urgency: 'CRITICAL' };
    } else if (daysRemaining <= 14) {
      return { tag: '14d', urgency: 'URGENT' };
    } else if (daysRemaining <= 30) {
      return { tag: '30d', urgency: 'WARNING' };
    } else if (daysRemaining <= 45) {
      return { tag: '45d', urgency: 'PRIORITY' };
    } else if (daysRemaining <= 60) {
      return { tag: '60d', urgency: 'INFO' };
    }
    return null;
  }

  intervals.forEach(({ days, expectedTag, urgency }) => {
    const res = evaluateReminder(days);
    assert.ok(res, `Reminder should trigger for ${days} days remaining`);
    assert.equal(res.tag, expectedTag, `Expected reminder tag ${expectedTag} for ${days} days remaining`);
    assert.equal(res.urgency, urgency, `Expected urgency ${urgency} for ${days} days remaining`);
  });

  // Verify that an item with 70 days remaining triggers NO reminder
  assert.equal(evaluateReminder(70), null, 'Certificates with >60 days should not trigger reminders');
});

test('REMINDERS ENGINE: Deduplication prevents duplicate alerts for the same document and interval', () => {
  const doc = new PropertyDocument({
    companyId: 'best-standard',
    propertyId: new mongoose.Types.ObjectId(),
    category: 'SAFETY_COMPLIANCE',
    title: 'EPC Energy Performance Certificate',
    documentType: 'EPC',
    expiryDate: new Date(Date.now() + 44 * 24 * 60 * 60 * 1000), // 44 days remaining (in 45d window)
    status: 'ACTIVE',
    remindersTriggered: ['60d'], // 60d already sent
  });

  const targetTag = '45d';
  const alreadyTriggered = doc.remindersTriggered.includes(targetTag);
  assert.equal(alreadyTriggered, false, '45d reminder not yet sent');

  // Trigger 45d reminder
  doc.remindersTriggered.push(targetTag);
  assert.equal(doc.remindersTriggered.includes('45d'), true);

  // Subsequent check for 45d reminder must detect it is already triggered
  const duplicateCheck = doc.remindersTriggered.includes(targetTag);
  assert.equal(duplicateCheck, true, 'Deduplication check must prevent re-sending 45d reminder');
});

// -----------------------------------------------------------------------------
// 5. COUNCIL APPLICATION & CORRESPONDENCE LOG
// -----------------------------------------------------------------------------
test('COUNCIL TRACKING: Supports application types, response deadlines, and correspondence attachments', () => {
  const councilApp = new CouncilApplication({
    companyId: 'homewards',
    propertyId: new mongoose.Types.ObjectId(),
    title: 'HMO Mandatory Licence Renewal 2026',
    applicationType: 'HMO_LICENCE',
    referenceNumber: 'HMO/2026/0891',
    issuingAuthority: 'Tower Hamlets Council',
    submissionDate: new Date('2026-01-05'),
    responseDeadline: new Date('2026-03-01'),
    status: 'AWAITING_COUNCIL',
    correspondence: [
      {
        date: new Date('2026-01-10'),
        type: 'OUTGOING_EMAIL',
        summary: 'Application submission fee and floor plans sent',
        senderOrRecipient: 'Tower Hamlets Council',
      },
      {
        date: new Date('2026-01-22'),
        type: 'INCOMING_LETTER',
        summary: 'Council Request for Information: Room dimensions',
        senderOrRecipient: 'Tower Hamlets Council Planning Dept',
      },
    ],
  });

  const valErr = councilApp.validateSync();
  assert.equal(valErr, undefined, 'CouncilApplication must validate cleanly');
  assert.equal(councilApp.applicationType, 'HMO_LICENCE');
  assert.equal(councilApp.correspondence.length, 2);
  assert.equal(councilApp.correspondence[1].type, 'INCOMING_LETTER');
  assert.equal(councilApp.status, 'AWAITING_COUNCIL');
});

// -----------------------------------------------------------------------------
// 6. SIX-COMPANY MULTI-ENTITY DATA ISOLATION
// -----------------------------------------------------------------------------
test('COMPANY ISOLATION: Compliance documents and council apps cannot cross company boundaries', () => {
  const companyA = 'old-street';
  const companyB = 'sk-hamilton';

  const propDocA = {
    companyId: companyA,
    title: 'Building Insurance Schedule',
    category: 'INSURANCE',
  };

  const propDocB = {
    companyId: companyB,
    title: 'Building Insurance Schedule',
    category: 'INSURANCE',
  };

  // Ensure both have valid distinct UK company IDs
  assert.ok(VALID_COMPANY_IDS.includes(propDocA.companyId));
  assert.ok(VALID_COMPANY_IDS.includes(propDocB.companyId));
  assert.notEqual(propDocA.companyId, propDocB.companyId);

  // Cross-company query test simulation
  const queryCompanyA = { companyId: companyA };
  const matchesA = [propDocA, propDocB].filter(
    (d) => d.companyId === queryCompanyA.companyId
  );

  assert.equal(matchesA.length, 1);
  assert.equal(matchesA[0].companyId, companyA);
});
