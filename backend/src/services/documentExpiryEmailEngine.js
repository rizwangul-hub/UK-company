import PropertyDocument from '../models/PropertyDocument.js';
import Property from '../models/Property.js';
import TenancyAgreement from '../models/TenancyAgreement.js';
import User from '../models/User.js';
import EmailNotificationConfig from '../models/EmailNotificationConfig.js';
import { sendDocumentExpiryAlertEmail } from './emailService.js';

/**
 * Evaluates all documents across all properties and sends expiry alert emails
 * to the attached recipient email address.
 */
export const evaluateAndSendExpiryEmails = async ({ targetCompanyId = null, forceSend = false } = {}) => {
  const results = {
    evaluatedCount: 0,
    emailsSent: 0,
    alreadyNotifiedCount: 0,
    failedCount: 0,
    errors: [],
    recipient: '',
  };

  try {
    // 1. Get or create notification config
    let config = await EmailNotificationConfig.findOne({ companyId: 'GLOBAL' });
    if (!config) {
      // Find operator user email as default
      const defaultUser = await User.findOne({ isActive: true }).lean();
      config = await EmailNotificationConfig.create({
        companyId: 'GLOBAL',
        recipientEmail: defaultUser?.email || '',
        enabled: true,
        alertDays: [60, 45, 30, 14, 7, 0],
      });
    }

    if (!config.enabled && !forceSend) {
      return { ...results, message: 'Expiry email alerts are disabled in settings.' };
    }

    const recipientEmail = config.recipientEmail?.trim();
    if (!recipientEmail) {
      return { ...results, message: 'No recipient email attached to receive alerts.' };
    }

    results.recipient = recipientEmail;
    const now = new Date();
    const todayMs = now.getTime();
    const thresholdDays = (config.alertDays && config.alertDays.length > 0) ? config.alertDays : [60, 45, 30, 14, 7, 0];
    const maxThreshold = Math.max(...thresholdDays);

    // 2. Process PropertyDocument items
    const docQuery = {
      isActive: true,
      status: { $ne: 'ARCHIVED' },
      isMissing: false,
      expiryDate: { $ne: null },
    };
    if (targetCompanyId) docQuery.companyId = targetCompanyId;

    const documents = await PropertyDocument.find(docQuery).populate('propertyId', 'name addressLine1 postcode');
    results.evaluatedCount += documents.length;

    for (const doc of documents) {
      if (!doc.expiryDate) continue;

      const expiryMs = new Date(doc.expiryDate).getTime();
      const diffDays = Math.ceil((expiryMs - todayMs) / (1000 * 60 * 60 * 24));

      // Only evaluate if within the maximum threshold or already expired
      if (diffDays > maxThreshold) continue;

      let milestone = null;
      if (diffDays < 0) milestone = 'EXPIRED';
      else if (diffDays === 0) milestone = '0_DAYS';
      else if (diffDays <= 7 && thresholdDays.includes(7)) milestone = '7_DAYS';
      else if (diffDays <= 14 && thresholdDays.includes(14)) milestone = '14_DAYS';
      else if (diffDays <= 30 && thresholdDays.includes(30)) milestone = '30_DAYS';
      else if (diffDays <= 45 && thresholdDays.includes(45)) milestone = '45_DAYS';
      else if (diffDays <= 60 && thresholdDays.includes(60)) milestone = '60_DAYS';

      if (!milestone) continue;

      const emailMilestoneTag = `EMAIL_${milestone}`;
      if (!forceSend && doc.remindersTriggered.includes(emailMilestoneTag)) {
        results.alreadyNotifiedCount++;
        continue;
      }

      const propName = doc.propertyId?.name || 'Property';
      const propAddress = doc.propertyId?.addressLine1 ? `${doc.propertyId.addressLine1}${doc.propertyId.postcode ? ` (${doc.propertyId.postcode})` : ''}` : '';

      // Send the warning email
      const emailRes = await sendDocumentExpiryAlertEmail({
        toEmail: recipientEmail,
        propertyName: propName,
        propertyAddress: propAddress,
        documentTitle: doc.title,
        documentCategory: doc.category || 'Safety & Compliance',
        expiryDate: doc.expiryDate,
        daysRemaining: diffDays,
        config,
      });

      if (emailRes.success) {
        doc.remindersTriggered.push(emailMilestoneTag);
        doc.lastReminderSentAt = now;
        await doc.save();

        config.sentAlertsHistory.unshift({
          propertyName: propName,
          documentTitle: doc.title,
          documentType: doc.category || 'Document',
          expiryDate: doc.expiryDate,
          daysRemaining: diffDays,
          sentTo: recipientEmail,
          sentAt: now,
          status: 'SENT',
          milestone,
        });

        results.emailsSent++;
      } else {
        results.failedCount++;
        results.errors.push(`Failed for "${doc.title}": ${emailRes.error}`);

        config.sentAlertsHistory.unshift({
          propertyName: propName,
          documentTitle: doc.title,
          documentType: doc.category || 'Document',
          expiryDate: doc.expiryDate,
          daysRemaining: diffDays,
          sentTo: recipientEmail,
          sentAt: now,
          status: 'FAILED',
          errorMessage: emailRes.error || 'Dispatch error',
          milestone,
        });
      }
    }

    // 3. Process Property Compliance statutory certificates (Gas Safety, EICR, EPC)
    const propQuery = { isActive: { $ne: false } };
    if (targetCompanyId) propQuery.companyId = targetCompanyId;
    const properties = await Property.find(propQuery).lean();

    for (const prop of properties) {
      const checks = [
        { title: 'Gas Safety Certificate (CP12)', date: prop.compliance?.gasSafetyExpiryDate, key: 'GAS_SAFETY' },
        { title: 'Electrical Installation Condition Report (EICR)', date: prop.compliance?.eicrExpiryDate, key: 'EICR' },
        { title: 'Energy Performance Certificate (EPC)', date: prop.compliance?.epcExpiryDate, key: 'EPC' },
      ];

      for (const check of checks) {
        if (!check.date) continue;
        results.evaluatedCount++;

        const expMs = new Date(check.date).getTime();
        const diffD = Math.ceil((expMs - todayMs) / (1000 * 60 * 60 * 24));
        if (diffD > maxThreshold) continue;

        let m = null;
        if (diffD < 0) m = 'EXPIRED';
        else if (diffD === 0) m = '0_DAYS';
        else if (diffD <= 7 && thresholdDays.includes(7)) m = '7_DAYS';
        else if (diffD <= 14 && thresholdDays.includes(14)) m = '14_DAYS';
        else if (diffD <= 30 && thresholdDays.includes(30)) m = '30_DAYS';
        else if (diffD <= 60 && thresholdDays.includes(60)) m = '60_DAYS';

        if (!m) continue;

        // Check if recorded in sent history recently (within past 3 days for same milestone & property)
        const recentDuplicate = config.sentAlertsHistory.find(
          (h) => h.propertyName === prop.name && h.documentTitle === check.title && h.milestone === m && (now.getTime() - new Date(h.sentAt).getTime()) < 3 * 24 * 60 * 60 * 1000
        );
        if (!forceSend && recentDuplicate) {
          results.alreadyNotifiedCount++;
          continue;
        }

        const emailRes = await sendDocumentExpiryAlertEmail({
          toEmail: recipientEmail,
          propertyName: prop.name,
          propertyAddress: prop.addressLine1 || '',
          documentTitle: check.title,
          documentCategory: 'Statutory Safety Certificate',
          expiryDate: check.date,
          daysRemaining: diffD,
          config,
        });

        if (emailRes.success) {
          config.sentAlertsHistory.unshift({
            propertyName: prop.name,
            documentTitle: check.title,
            documentType: 'Statutory Certificate',
            expiryDate: check.date,
            daysRemaining: diffD,
            sentTo: recipientEmail,
            sentAt: now,
            status: 'SENT',
            milestone: m,
          });
          results.emailsSent++;
        } else {
          results.failedCount++;
          results.errors.push(`Failed for "${check.title}" at ${prop.name}: ${emailRes.error}`);
        }
      }
    }

    // Limit sent history to last 50 records
    if (config.sentAlertsHistory.length > 50) {
      config.sentAlertsHistory = config.sentAlertsHistory.slice(0, 50);
    }

    config.lastCheckedAt = now;
    if (results.emailsSent > 0) {
      config.lastEmailSentAt = now;
    }
    await config.save();

  } catch (err) {
    console.error('[DocumentExpiryEmailEngine] Error during evaluation:', err);
    results.errors.push(err.message);
  }

  return results;
};

export default {
  evaluateAndSendExpiryEmails,
};
