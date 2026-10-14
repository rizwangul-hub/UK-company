import PropertyDemand from '../models/PropertyDemand.js';
import PropertyChargeConfig from '../models/PropertyChargeConfig.js';
import ComplianceNotification from '../models/ComplianceNotification.js';
import { VALID_COMPANY_IDS } from '../config/companies.js';

/**
 * Service Charge & Ground Rent Reminder & Expiry Engine
 * Checks demands for upcoming due dates (60, 45, 30, 14, 7 days, 0 days, overdue)
 * and expected demand notices according to configured frequencies.
 */
export const checkAndGenerateDemandReminders = async (targetCompanyId = null) => {
  const companiesToCheck = targetCompanyId ? [targetCompanyId] : VALID_COMPANY_IDS;
  const results = {
    evaluatedDemands: 0,
    generatedNotifications: 0,
    statusUpdates: 0,
    configsEvaluated: 0,
  };

  const now = new Date();
  const todayMs = now.getTime();

  for (const companyId of companiesToCheck) {
    // 1. Process Active Demands that are not fully paid or cancelled
    const demands = await PropertyDemand.find({
      companyId,
      status: { $nin: ['PAID', 'CANCELLED'] },
    }).populate('propertyId', 'name addressLine1');

    results.evaluatedDemands += demands.length;

    for (const demand of demands) {
      const balance = (demand.amountDemanded || 0) + (demand.adjustments || 0) - (demand.totalPaid || 0);

      // If balance is 0 or less, mark paid and do not remind
      if (balance <= 0) {
        if (demand.status !== 'PAID') {
          demand.status = 'PAID';
          await demand.save();
          results.statusUpdates += 1;
        }
        continue;
      }

      if (!demand.dueDate) continue;

      const dueMs = new Date(demand.dueDate).getTime();
      const diffMs = dueMs - todayMs;
      const daysUntilDue = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      let intervalCode = null;
      let notificationType = null;
      let urgencyLevel = 'INFO';
      let title = '';
      let message = '';

      const propName = demand.propertyId?.name || 'Property';
      const chargeLabel = demand.chargeType === 'SERVICE_CHARGE' ? 'Service Charge' : 'Ground Rent';
      const formattedDue = new Date(demand.dueDate).toLocaleDateString('en-GB');

      if (daysUntilDue < 0) {
        intervalCode = 'OVERDUE';
        notificationType = 'DEMAND_OVERDUE';
        urgencyLevel = 'CRITICAL';
        title = `OVERDUE: ${chargeLabel} #${demand.demandReference} (${propName})`;
        message = `${chargeLabel} demand #${demand.demandReference} (£${balance.toFixed(2)}) is overdue by ${Math.abs(daysUntilDue)} day(s). Due date was ${formattedDue}.`;

        if (demand.status !== 'OVERDUE' && demand.status !== 'DISPUTED') {
          demand.status = 'OVERDUE';
          await demand.save();
          results.statusUpdates += 1;
        }
      } else if (daysUntilDue <= 7) {
        intervalCode = '7_DAYS';
        notificationType = 'DEMAND_DUE_7';
        urgencyLevel = 'CRITICAL';
        title = `URGENT (7 Days): ${chargeLabel} #${demand.demandReference} (${propName})`;
        message = `${chargeLabel} demand #${demand.demandReference} for £${balance.toFixed(2)} is due in ${daysUntilDue} day(s) on ${formattedDue}.`;
      } else if (daysUntilDue <= 14) {
        intervalCode = '14_DAYS';
        notificationType = 'DEMAND_DUE_14';
        urgencyLevel = 'URGENT';
        title = `Due Soon (14 Days): ${chargeLabel} #${demand.demandReference} (${propName})`;
        message = `${chargeLabel} demand #${demand.demandReference} for £${balance.toFixed(2)} is due in ${daysUntilDue} day(s) on ${formattedDue}.`;
      } else if (daysUntilDue <= 30) {
        intervalCode = '30_DAYS';
        notificationType = 'DEMAND_DUE_30';
        urgencyLevel = 'PRIORITY';
        title = `Upcoming (30 Days): ${chargeLabel} #${demand.demandReference} (${propName})`;
        message = `${chargeLabel} demand #${demand.demandReference} for £${balance.toFixed(2)} is due in ${daysUntilDue} day(s) on ${formattedDue}.`;
      } else if (daysUntilDue <= 45) {
        intervalCode = '45_DAYS';
        notificationType = 'DEMAND_DUE_45';
        urgencyLevel = 'WARNING';
        title = `Advance Notice (45 Days): ${chargeLabel} #${demand.demandReference} (${propName})`;
        message = `${chargeLabel} demand #${demand.demandReference} for £${balance.toFixed(2)} is due in ${daysUntilDue} day(s) on ${formattedDue}.`;
      } else if (daysUntilDue <= 60) {
        intervalCode = '60_DAYS';
        notificationType = 'DEMAND_DUE_60';
        urgencyLevel = 'INFO';
        title = `Advance Notice (60 Days): ${chargeLabel} #${demand.demandReference} (${propName})`;
        message = `${chargeLabel} demand #${demand.demandReference} for £${balance.toFixed(2)} is due in ${daysUntilDue} day(s) on ${formattedDue}.`;
      }

      if (intervalCode) {
        const alreadyTriggered = (demand.remindersTriggered || []).includes(intervalCode);

        if (!alreadyTriggered) {
          // Check if existing notification exists
          const existingNotification = await ComplianceNotification.findOne({
            companyId,
            demandId: demand._id,
            type: notificationType,
          });

          if (!existingNotification) {
            await ComplianceNotification.create({
              companyId,
              propertyId: demand.propertyId._id || demand.propertyId,
              demandId: demand._id,
              type: notificationType,
              title,
              message,
              urgency: urgencyLevel,
              deadline: demand.dueDate,
              actionUrl: `/properties/${demand.propertyId._id || demand.propertyId}?tab=service-charges`,
            });
            results.generatedNotifications += 1;
          }

          if (!demand.remindersTriggered) demand.remindersTriggered = [];
          demand.remindersTriggered.push(intervalCode);
          await demand.save();
        }
      }
    }

    // 2. Evaluate Property Charge Configs for expected upcoming demand arrival
    const configs = await PropertyChargeConfig.find({
      companyId,
      isEnabled: true,
      nextExpectedDemandDate: { $ne: null },
    }).populate('propertyId', 'name');

    results.configsEvaluated += configs.length;

    for (const cfg of configs) {
      if (!cfg.nextExpectedDemandDate) continue;

      const expMs = new Date(cfg.nextExpectedDemandDate).getTime();
      const diffMs = expMs - todayMs;
      const daysUntilExpected = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (daysUntilExpected >= 0 && daysUntilExpected <= 30) {
        const propName = cfg.propertyId?.name || 'Property';
        const chargeLabel = cfg.chargeType === 'SERVICE_CHARGE' ? 'Service Charge' : 'Ground Rent';
        const formattedExpected = new Date(cfg.nextExpectedDemandDate).toLocaleDateString('en-GB');

        const existingAlert = await ComplianceNotification.findOne({
          companyId,
          propertyId: cfg.propertyId._id || cfg.propertyId,
          type: 'EXPECTED_DEMAND_DUE',
          deadline: cfg.nextExpectedDemandDate,
        });

        if (!existingAlert) {
          await ComplianceNotification.create({
            companyId,
            propertyId: cfg.propertyId._id || cfg.propertyId,
            type: 'EXPECTED_DEMAND_DUE',
            title: `Expected Demand Notice: ${chargeLabel} (${propName})`,
            message: `A regular ${cfg.paymentFrequency?.toLowerCase() || 'scheduled'} ${chargeLabel} demand notice is expected around ${formattedExpected}.`,
            urgency: daysUntilExpected <= 7 ? 'PRIORITY' : 'INFO',
            deadline: cfg.nextExpectedDemandDate,
            actionUrl: `/properties/${cfg.propertyId._id || cfg.propertyId}?tab=service-charges`,
          });
          results.generatedNotifications += 1;
        }
      }
    }
  }

  return results;
};

export default {
  checkAndGenerateDemandReminders,
};
