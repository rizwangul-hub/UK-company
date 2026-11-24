import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isRentDueEmailingActive,
  isScheduleDueForNotice,
} from '../src/services/rentDueEmailEngine.js';

test('RENT DUE ENGINE: disabled by default when env is false or config is false', () => {
  assert.equal(isRentDueEmailingActive({}, {}), false);
  assert.equal(isRentDueEmailingActive({ rentDueEmailEnabled: false }, {}), false);
  assert.equal(
    isRentDueEmailingActive({ rentDueEmailEnabled: true }, { AUTO_RENT_DUE_EMAIL_ENABLED: 'false' }),
    false
  );
  assert.equal(
    isRentDueEmailingActive({ rentDueEmailEnabled: true }, { AUTO_RENT_DUE_EMAIL_ENABLED: 'true' }),
    true
  );
});

test('RENT DUE ENGINE: isScheduleDueForNotice only triggers on due date for unpaid, unsent schedules', () => {
  const now = new Date('2026-11-24T12:00:00.000Z');

  // Due today, unpaid, not yet sent -> true
  assert.equal(
    isScheduleDueForNotice(
      {
        dueDate: new Date('2026-11-24T00:00:00.000Z'),
        status: 'PENDING',
        expectedAmount: 1000,
        paidAmount: 0,
        outstandingAmount: 1000,
        dueNoticeSentAt: null,
      },
      now
    ),
    true
  );

  // Due in future -> false
  assert.equal(
    isScheduleDueForNotice(
      {
        dueDate: new Date('2026-11-28T00:00:00.000Z'),
        status: 'PENDING',
        expectedAmount: 1000,
        paidAmount: 0,
        outstandingAmount: 1000,
        dueNoticeSentAt: null,
      },
      now
    ),
    false
  );

  // Already paid -> false
  assert.equal(
    isScheduleDueForNotice(
      {
        dueDate: new Date('2026-11-24T00:00:00.000Z'),
        status: 'PAID',
        expectedAmount: 1000,
        paidAmount: 1000,
        outstandingAmount: 0,
        dueNoticeSentAt: null,
      },
      now
    ),
    false
  );

  // Already sent -> false (prevents duplicate emails)
  assert.equal(
    isScheduleDueForNotice(
      {
        dueDate: new Date('2026-11-24T00:00:00.000Z'),
        status: 'PENDING',
        expectedAmount: 1000,
        paidAmount: 0,
        outstandingAmount: 1000,
        dueNoticeSentAt: new Date('2026-11-24T08:00:00.000Z'),
      },
      now
    ),
    false
  );

  // Old historical schedule (> 7 days ago) -> false
  assert.equal(
    isScheduleDueForNotice(
      {
        dueDate: new Date('2026-10-01T00:00:00.000Z'),
        status: 'OVERDUE',
        expectedAmount: 1000,
        paidAmount: 0,
        outstandingAmount: 1000,
        dueNoticeSentAt: null,
      },
      now
    ),
    false
  );
});
