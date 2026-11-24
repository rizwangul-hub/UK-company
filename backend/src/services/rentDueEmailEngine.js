import RentSchedule from '../models/RentSchedule.js';
import TenancyAgreement from '../models/TenancyAgreement.js';
import EmailNotificationConfig from '../models/EmailNotificationConfig.js';
import { sendRentDueNoticeEmail } from './emailService.js';

/**
 * Checks whether automatic rent due emailing is active.
 * Remains OFF by default until both the env kill-switch is not 'false'
 * and config.rentDueEmailEnabled is explicitly true.
 */
export const isRentDueEmailingActive = (config, env = process.env) => {
  if (String(env.AUTO_RENT_DUE_EMAIL_ENABLED || '').trim().toLowerCase() === 'false') {
    return false;
  }
  return Boolean(config?.rentDueEmailEnabled);
};

/**
 * Pure check for whether a RentSchedule is eligible for an automatic due-date notice.
 * Only sends when:
 * - Not already sent (dueNoticeSentAt is null)
 * - Not PAID and has outstanding balance > 0
 * - dueDate is today or within the past 7 days (prevents blasting old historical arrears on activation)
 */
export const isScheduleDueForNotice = (schedule, now = new Date()) => {
  if (!schedule || !schedule.dueDate || schedule.dueNoticeSentAt) {
    return false;
  }
  if (schedule.status === 'PAID') {
    return false;
  }
  const outstanding =
    schedule.outstandingAmount !== undefined
      ? Number(schedule.outstandingAmount)
      : Math.max(0, Number(schedule.expectedAmount || 0) - Number(schedule.paidAmount || 0));
  if (outstanding <= 0) {
    return false;
  }

  const endOfTodayUTC = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    23,
    59,
    59,
    999
  );
  const sevenDaysAgoUTC = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - 7,
    0,
    0,
    0,
    0
  );
  const dueMs = new Date(schedule.dueDate).getTime();
  if (Number.isNaN(dueMs)) return false;

  return dueMs >= sevenDaysAgoUTC && dueMs <= endOfTodayUTC;
};

/**
 * Ensures RentSchedule entries exist for the current billing month for all ACTIVE TenancyAgreements.
 */
export const ensureCurrentMonthRentSchedules = async ({ targetCompanyId = null, now = new Date() } = {}) => {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  const billingMonth = `${y}-${String(m).padStart(2, '0')}`;
  const monthStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const monthEnd = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));

  const agreementQuery = {
    status: 'ACTIVE',
    startDate: { $lte: monthEnd },
    endDate: { $gte: monthStart },
  };
  if (targetCompanyId) agreementQuery.companyId = targetCompanyId;

  const activeAgreements = await TenancyAgreement.find(agreementQuery).lean();
  let createdCount = 0;

  for (const agreement of activeAgreements) {
    const existing = await RentSchedule.findOne({
      companyId: agreement.companyId,
      agreementId: agreement._id,
      billingMonth,
    }).lean();

    if (!existing) {
      const dueDay = Math.min(Math.max(Number(agreement.rentDueDay) || 1, 1), 28);
      const dueDate = new Date(Date.UTC(y, m - 1, dueDay));

      await RentSchedule.create({
        companyId: agreement.companyId,
        agreementId: agreement._id,
        tenantId: agreement.tenantId,
        propertyId: agreement.propertyId,
        unitId: agreement.unitId || null,
        billingMonth,
        dueDate,
        expectedAmount: agreement.rentAmount,
        paidAmount: 0,
      });
      createdCount++;
    }
  }

  return { billingMonth, createdCount };
};

/**
 * Evaluates all due RentSchedules and dispatches rent due notice emails to tenants.
 * Uses configured SMTP credentials (pixxtechinfo@gmail.com) and sets Reply-To to ftaccountants@hotmail.com.
 */
export const evaluateAndSendRentDueEmails = async ({
  targetCompanyId = null,
  forceSend = false,
  now = new Date(),
} = {}) => {
  const results = {
    skippedDisabled: false,
    evaluatedCount: 0,
    emailsSent: 0,
    skippedNoEmailCount: 0,
    failedCount: 0,
    createdSchedulesCount: 0,
    errors: [],
  };

  try {
    let config = await EmailNotificationConfig.findOne({ companyId: 'GLOBAL' });
    if (!config) {
      config = await EmailNotificationConfig.create({
        companyId: 'GLOBAL',
        rentDueEmailEnabled: false,
        rentDueReplyTo: process.env.RENT_DUE_REPLY_TO || 'ftaccountants@hotmail.com',
      });
    }

    if (!forceSend && !isRentDueEmailingActive(config)) {
      results.skippedDisabled = true;
      return {
        ...results,
        message: 'Automatic tenant rent due emailing is currently disabled.',
      };
    }

    // Ensure current month's schedules exist for active tenancy agreements
    const ensured = await ensureCurrentMonthRentSchedules({ targetCompanyId, now });
    results.createdSchedulesCount = ensured.createdCount;

    const endOfTodayUTC = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)
    );
    const sevenDaysAgoUTC = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 7, 0, 0, 0, 0)
    );

    const query = {
      dueNoticeSentAt: null,
      status: { $in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
      tenantId: { $ne: null },
      dueDate: { $gte: sevenDaysAgoUTC, $lte: endOfTodayUTC },
    };
    if (targetCompanyId) query.companyId = targetCompanyId;

    const schedules = await RentSchedule.find(query)
      .populate('tenantId', 'fullName email phone')
      .populate('propertyId', 'name addressLine1 postcode')
      .populate('unitId', 'unitName');

    results.evaluatedCount = schedules.length;
    const replyToEmail =
      config.rentDueReplyTo || process.env.RENT_DUE_REPLY_TO || 'ftaccountants@hotmail.com';

    for (const schedule of schedules) {
      if (!isScheduleDueForNotice(schedule, now)) {
        continue;
      }

      const tenantEmail = (schedule.tenantId?.email || '').trim();
      if (!tenantEmail || !tenantEmail.includes('@')) {
        results.skippedNoEmailCount++;
        continue;
      }

      const tenantName = schedule.tenantId?.fullName || 'Valued Tenant';
      const propertyName = schedule.propertyId?.name || 'Leased Property';
      const unitName = schedule.unitId?.unitName || '';
      const amountDue =
        schedule.outstandingAmount > 0 ? schedule.outstandingAmount : schedule.expectedAmount;
      const paymentReference = `RENT-${(schedule.billingMonth || '').replace('-', '')}-${tenantName
        .slice(0, 4)
        .toUpperCase()}`;

      const emailConfig = {
        smtpHost: config.smtpHost,
        smtpPort: config.smtpPort,
        smtpSecure: config.smtpSecure,
        smtpUser: config.smtpUser,
        smtpPass: config.smtpPass,
        fromEmail: config.fromEmail,
        fromName: 'Kamran Ijaz & Fahad Rasheed (FT Accountants)',
        replyTo: replyToEmail,
        bcc: replyToEmail,
      };

      const sendRes = await sendRentDueNoticeEmail({
        tenantName,
        tenantEmail,
        propertyName,
        unitName,
        amountDue,
        dueDate: schedule.dueDate,
        paymentReference,
        notes: schedule.notes || '',
        config: emailConfig,
      });

      if (sendRes.success) {
        schedule.dueNoticeSentAt = now;
        schedule.dueNoticeSentTo = tenantEmail;
        schedule.dueNoticeMessageId = sendRes.messageId || '';
        await schedule.save();

        config.rentDueSentHistory.unshift({
          scheduleId: schedule._id,
          tenantName,
          propertyName,
          billingMonth: schedule.billingMonth,
          dueDate: schedule.dueDate,
          amountDue,
          sentTo: tenantEmail,
          replyTo: replyToEmail,
          sentAt: now,
          status: 'SENT',
        });
        results.emailsSent++;
      } else {
        config.rentDueSentHistory.unshift({
          scheduleId: schedule._id,
          tenantName,
          propertyName,
          billingMonth: schedule.billingMonth,
          dueDate: schedule.dueDate,
          amountDue,
          sentTo: tenantEmail,
          replyTo: replyToEmail,
          sentAt: now,
          status: 'FAILED',
          errorMessage: sendRes.error || 'Unknown SMTP error',
        });
        results.failedCount++;
        results.errors.push(`${tenantEmail}: ${sendRes.error}`);
      }
    }

    if (config.rentDueSentHistory.length > 100) {
      config.rentDueSentHistory = config.rentDueSentHistory.slice(0, 100);
    }
    config.rentDueLastCheckedAt = now;
    await config.save();

    return {
      ...results,
      message: `Evaluated ${results.evaluatedCount} due rent schedule(s); sent ${results.emailsSent} email(s).`,
    };
  } catch (error) {
    console.error('[RentDueEmailEngine] Error:', error);
    return {
      ...results,
      errors: [error.message],
      message: error.message || 'Rent due email evaluation failed.',
    };
  }
};

export default {
  isRentDueEmailingActive,
  isScheduleDueForNotice,
  ensureCurrentMonthRentSchedules,
  evaluateAndSendRentDueEmails,
};
