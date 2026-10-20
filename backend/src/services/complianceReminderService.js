import PropertyDocument from '../models/PropertyDocument.js';
import CouncilApplication from '../models/CouncilApplication.js';
import ComplianceNotification from '../models/ComplianceNotification.js';
import Property from '../models/Property.js';
import { VALID_COMPANY_IDS } from '../config/companies.js';

/**
 * Compliance Reminder & Expiry Engine
 * Intervals: 60d (Warning), 45d (Priority), 30d (Approaching), 14d (Urgent), 7d (Critical), 0d (Expiry), <0d (Expired)
 */
export const checkAndGenerateComplianceReminders = async (targetCompanyId = null) => {
  const companiesToCheck = targetCompanyId ? [targetCompanyId] : VALID_COMPANY_IDS;
  const results = {
    evaluatedDocuments: 0,
    generatedNotifications: 0,
    statusUpdates: 0,
    councilEvaluated: 0,
  };

  const now = new Date();
  const todayMs = now.getTime();

  for (const companyId of companiesToCheck) {
    // 1. Process Property Documents with expiryDate
    const documents = await PropertyDocument.find({
      companyId,
      isActive: true,
      status: { $ne: 'ARCHIVED' },
      isMissing: false,
      expiryDate: { $ne: null },
    }).populate('propertyId', 'name addressLine1');

    results.evaluatedDocuments += documents.length;

    for (const doc of documents) {
      if (!doc.expiryDate) continue;

      const expiryMs = new Date(doc.expiryDate).getTime();
      const diffMs = expiryMs - todayMs;
      const daysUntilExpiry = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      let intervalCode = null;
      let notificationType = null;
      let urgencyLevel = 'INFO';
      let title = '';
      let message = '';
      let nextDocUrgency = doc.urgency;
      let nextDocStatus = doc.status;

      const propName = doc.propertyId?.name || 'Property';

      if (daysUntilExpiry < 0) {
        // Expired
        intervalCode = 'EXPIRED';
        notificationType = 'DOCUMENT_EXPIRED';
        urgencyLevel = 'CRITICAL';
        title = `EXPIRED: ${doc.title} (${propName})`;
        message = `${doc.title} expired ${Math.abs(daysUntilExpiry)} day(s) ago on ${new Date(doc.expiryDate).toLocaleDateString('en-GB')}. Immediate renewal or re-inspection is required.`;
        nextDocStatus = 'EXPIRED';
        nextDocUrgency = 'EXPIRED';
      } else if (daysUntilExpiry <= 0) {
        // Due today
        intervalCode = '0_DAYS';
        notificationType = 'DOCUMENT_EXPIRED';
        urgencyLevel = 'CRITICAL';
        title = `EXPIRES TODAY: ${doc.title} (${propName})`;
        message = `${doc.title} expires today (${new Date(doc.expiryDate).toLocaleDateString('en-GB')}). Urgent renewal action required.`;
        nextDocStatus = 'EXPIRING_SOON';
        nextDocUrgency = 'CRITICAL_7';
      } else if (daysUntilExpiry <= 7) {
        // Critical 7 Days
        intervalCode = '7_DAYS';
        notificationType = 'EXPIRY_CRITICAL_7';
        urgencyLevel = 'CRITICAL';
        title = `CRITICAL (7 Days): ${doc.title} (${propName})`;
        message = `${doc.title} expires in ${daysUntilExpiry} days on ${new Date(doc.expiryDate).toLocaleDateString('en-GB')}.`;
        nextDocStatus = 'EXPIRING_SOON';
        nextDocUrgency = 'CRITICAL_7';
      } else if (daysUntilExpiry <= 14) {
        // Urgent 14 Days
        intervalCode = '14_DAYS';
        notificationType = 'EXPIRY_URGENT_14';
        urgencyLevel = 'URGENT';
        title = `URGENT (14 Days): ${doc.title} (${propName})`;
        message = `${doc.title} expires in ${daysUntilExpiry} days on ${new Date(doc.expiryDate).toLocaleDateString('en-GB')}. Book certified contractor visit.`;
        nextDocStatus = 'EXPIRING_SOON';
        nextDocUrgency = 'URGENT_14';
      } else if (daysUntilExpiry <= 30) {
        // Approaching 30 Days
        intervalCode = '30_DAYS';
        notificationType = 'EXPIRY_APPROACHING_30';
        urgencyLevel = 'PRIORITY';
        title = `Deadline Approaching (30 Days): ${doc.title} (${propName})`;
        message = `${doc.title} expires in ${daysUntilExpiry} days on ${new Date(doc.expiryDate).toLocaleDateString('en-GB')}.`;
        nextDocStatus = 'EXPIRING_SOON';
        nextDocUrgency = 'APPROACHING_30';
      } else if (daysUntilExpiry <= 45) {
        // Priority Reminder 45 Days
        intervalCode = '45_DAYS';
        notificationType = 'EXPIRY_PRIORITY_45';
        urgencyLevel = 'PRIORITY';
        title = `Priority Notice (45 Days): ${doc.title} (${propName})`;
        message = `${doc.title} will reach expiry in ${daysUntilExpiry} days on ${new Date(doc.expiryDate).toLocaleDateString('en-GB')}. Schedule inspection/renewal.`;
        nextDocStatus = 'EXPIRING_SOON';
        nextDocUrgency = 'PRIORITY_45';
      } else if (daysUntilExpiry <= 60) {
        // Early Warning 60 Days
        intervalCode = '60_DAYS';
        notificationType = 'EXPIRY_WARNING_60';
        urgencyLevel = 'WARNING';
        title = `Early Warning (60 Days): ${doc.title} (${propName})`;
        message = `${doc.title} is due for renewal in ${daysUntilExpiry} days on ${new Date(doc.expiryDate).toLocaleDateString('en-GB')}.`;
        nextDocStatus = 'ACTIVE';
        nextDocUrgency = 'WARNING_60';
      } else {
        // > 60 days
        nextDocUrgency = 'NORMAL';
        if (doc.status === 'EXPIRING_SOON' || doc.status === 'EXPIRED') {
          nextDocStatus = 'ACTIVE';
        }
      }

      // Update doc status/urgency if changed
      let docModified = false;
      if (doc.status !== nextDocStatus && doc.status !== 'RENEWAL_REQUESTED' && doc.status !== 'UNDER_REVIEW') {
        doc.status = nextDocStatus;
        docModified = true;
      }
      if (doc.urgency !== nextDocUrgency) {
        doc.urgency = nextDocUrgency;
        docModified = true;
      }

      // Trigger notification if interval not previously sent
      if (intervalCode && !doc.remindersTriggered.includes(intervalCode)) {
        doc.remindersTriggered.push(intervalCode);
        doc.lastReminderSentAt = now;
        docModified = true;

        await ComplianceNotification.create({
          companyId,
          propertyId: doc.propertyId?._id || doc.propertyId,
          documentId: doc._id,
          type: notificationType,
          title,
          message,
          urgency: urgencyLevel,
          deadline: doc.expiryDate,
          actionUrl: `/properties?propertyId=${doc.propertyId?._id || doc.propertyId}&tab=compliance`,
        });

        results.generatedNotifications++;
      }

      if (docModified) {
        await doc.save();
        results.statusUpdates++;
      }
    }

    // 2. Process Missing Documents (isMissing: true)
    const missingDocs = await PropertyDocument.find({
      companyId,
      isActive: true,
      status: { $ne: 'ARCHIVED' },
      isMissing: true,
    }).populate('propertyId', 'name');

    for (const mDoc of missingDocs) {
      if (!mDoc.remindersTriggered.includes('MISSING_ALERT')) {
        mDoc.remindersTriggered.push('MISSING_ALERT');
        mDoc.status = 'MISSING';
        mDoc.urgency = 'MISSING';
        await mDoc.save();

        await ComplianceNotification.create({
          companyId,
          propertyId: mDoc.propertyId?._id || mDoc.propertyId,
          documentId: mDoc._id,
          type: 'DOCUMENT_MISSING',
          title: `MISSING DOCUMENT: ${mDoc.title} (${mDoc.propertyId?.name || 'Property'})`,
          message: `Mandatory statutory document "${mDoc.title}" is flagged as missing. Follow-up action required.`,
          urgency: 'URGENT',
          deadline: null,
          actionUrl: `/properties?propertyId=${mDoc.propertyId?._id || mDoc.propertyId}&tab=compliance`,
        });

        results.generatedNotifications++;
      }
    }

    // 3. Process Council Applications (responseDeadline)
    const councilApps = await CouncilApplication.find({
      companyId,
      isActive: true,
      status: { $nin: ['COMPLETED', 'ARCHIVED', 'APPROVED', 'REJECTED'] },
      responseDeadline: { $ne: null },
    }).populate('propertyId', 'name');

    results.councilEvaluated += councilApps.length;

    for (const app of councilApps) {
      const deadlineMs = new Date(app.responseDeadline).getTime();
      const diffDays = Math.ceil((deadlineMs - todayMs) / (1000 * 60 * 60 * 24));
      const propName = app.propertyId?.name || 'Property';

      let cInterval = null;
      let cType = null;
      let cUrgency = 'INFO';
      let cTitle = '';
      let cMessage = '';

      if (diffDays < 0) {
        cInterval = 'COUNCIL_OVERDUE';
        cType = 'COUNCIL_DEADLINE_OVERDUE';
        cUrgency = 'CRITICAL';
        cTitle = `OVERDUE COUNCIL DEADLINE: ${app.title} (${app.councilName})`;
        cMessage = `Statutory council response deadline for ${app.title} at ${propName} passed ${Math.abs(diffDays)} day(s) ago (${new Date(app.responseDeadline).toLocaleDateString('en-GB')}).`;
      } else if (diffDays <= 7) {
        cInterval = 'COUNCIL_7_DAYS';
        cType = 'COUNCIL_DEADLINE_APPROACHING';
        cUrgency = 'URGENT';
        cTitle = `Council Deadline (7 Days): ${app.title} (${app.councilName})`;
        cMessage = `Response deadline for ${app.title} is due in ${diffDays} day(s) on ${new Date(app.responseDeadline).toLocaleDateString('en-GB')}.`;
      } else if (diffDays <= 14) {
        cInterval = 'COUNCIL_14_DAYS';
        cType = 'COUNCIL_DEADLINE_APPROACHING';
        cUrgency = 'PRIORITY';
        cTitle = `Council Deadline Approaching (14 Days): ${app.title}`;
        cMessage = `Council response deadline for ${app.title} is due on ${new Date(app.responseDeadline).toLocaleDateString('en-GB')}.`;
      }

      if (cInterval && !app.remindersTriggered.includes(cInterval)) {
        app.remindersTriggered.push(cInterval);
        await app.save();

        await ComplianceNotification.create({
          companyId,
          propertyId: app.propertyId?._id || app.propertyId,
          councilApplicationId: app._id,
          type: cType,
          title: cTitle,
          message: cMessage,
          urgency: cUrgency,
          deadline: app.responseDeadline,
          actionUrl: `/properties?propertyId=${app.propertyId?._id || app.propertyId}&tab=compliance`,
        });

        results.generatedNotifications++;
      }
    }
  }

  // Trigger automated document expiry emails
  try {
    const { evaluateAndSendExpiryEmails } = await import('./documentExpiryEmailEngine.js');
    const emailResults = await evaluateAndSendExpiryEmails({ targetCompanyId });
    results.emailResults = emailResults;
  } catch (emailErr) {
    console.warn('[ComplianceReminderService] Expiry email dispatch error:', emailErr.message);
  }

  return results;
};
