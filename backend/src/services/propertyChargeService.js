import mongoose from 'mongoose';
import PropertyChargeConfig from '../models/PropertyChargeConfig.js';
import ServiceChargePayee from '../models/ServiceChargePayee.js';
import PropertyDemand from '../models/PropertyDemand.js';
import PropertyChargePayment from '../models/PropertyChargePayment.js';
import Property from '../models/Property.js';
import Category from '../models/Category.js';
import Account from '../models/Account.js';
import { postLedgerTransaction, round2 } from './ledgerService.js';
import { VALID_COMPANY_IDS } from '../config/companies.js';

// Pre-seeded verified example payee constants
export const EXAMPLE_PAYEE = {
  name: 'Zircon Holdings Limited',
  bankName: 'Royal Bank of Scotland',
  sortCode: '16-00-63',
  accountNumber: '10801788',
  telephone: '020 3355 5309',
  email: 'waqas@ilmcapital.co.uk',
  address: 'London, United Kingdom',
  notes: 'Managing agent and freehold collector for Brixton Road properties.',
  isVerified: true,
};

/**
 * Ensure default payee (Zircon Holdings) exists for a company or all companies
 */
export const seedDefaultPayees = async (targetCompanyId = null) => {
  const companies = targetCompanyId ? [targetCompanyId] : VALID_COMPANY_IDS;
  for (const companyId of companies) {
    const existing = await ServiceChargePayee.findOne({
      companyId,
      name: EXAMPLE_PAYEE.name,
    });
    if (!existing) {
      await ServiceChargePayee.create({
        companyId,
        ...EXAMPLE_PAYEE,
      });
    }
  }
};

/**
 * Get or initialize charge configurations for a property (Service Charge & Ground Rent)
 */
export const getPropertyChargeConfigs = async (companyId, propertyId) => {
  // Verify property belongs to active company
  const prop = await Property.findOne({ _id: propertyId, companyId });
  if (!prop) {
    throw new Error('Property not found in active company context');
  }

  const chargeTypes = ['SERVICE_CHARGE', 'GROUND_RENT'];
  const configs = [];

  for (const cType of chargeTypes) {
    let cfg = await PropertyChargeConfig.findOne({
      companyId,
      propertyId,
      chargeType: cType,
    }).populate('payeeId');

    if (!cfg) {
      // Find default payee if available
      const defaultPayee = await ServiceChargePayee.findOne({
        companyId,
        name: EXAMPLE_PAYEE.name,
      });

      cfg = await PropertyChargeConfig.create({
        companyId,
        propertyId,
        chargeType: cType,
        isEnabled: false,
        payeeId: defaultPayee?._id || null,
        payeeName: defaultPayee?.name || '',
        expectedAmount: cType === 'SERVICE_CHARGE' ? (prop.leaseDetails?.serviceChargeAnnual || 0) : (prop.leaseDetails?.groundRentAnnual || 0),
        paymentFrequency: 'ANNUAL',
        normalDueDateTerms: '30 days from demand notice date',
      });
    }
    configs.push(cfg);
  }

  return configs;
};

/**
 * Update charge configuration for a property
 */
export const updatePropertyChargeConfig = async (companyId, propertyId, chargeType, updateData) => {
  const prop = await Property.findOne({ _id: propertyId, companyId });
  if (!prop) {
    throw new Error('Property not found in active company context');
  }

  let cfg = await PropertyChargeConfig.findOne({ companyId, propertyId, chargeType });
  if (!cfg) {
    cfg = new PropertyChargeConfig({ companyId, propertyId, chargeType });
  }

  // Audit change history if amount or frequency changed
  if (updateData.expectedAmount !== undefined && updateData.expectedAmount !== cfg.expectedAmount) {
    cfg.changeHistory.push({
      changedAt: new Date(),
      field: 'expectedAmount',
      oldValue: cfg.expectedAmount,
      newValue: Number(updateData.expectedAmount),
      reason: updateData.changeReason || 'Budget revision / revised notice',
      changedBy: 'Authorized User',
    });
    cfg.expectedAmount = Number(updateData.expectedAmount);
  }

  if (updateData.paymentFrequency !== undefined && updateData.paymentFrequency !== cfg.paymentFrequency) {
    cfg.changeHistory.push({
      changedAt: new Date(),
      field: 'paymentFrequency',
      oldValue: cfg.paymentFrequency,
      newValue: updateData.paymentFrequency,
      reason: updateData.changeReason || 'Frequency amendment',
      changedBy: 'Authorized User',
    });
    cfg.paymentFrequency = updateData.paymentFrequency;
  }

  if (updateData.isEnabled !== undefined) cfg.isEnabled = Boolean(updateData.isEnabled);
  if (updateData.payeeId !== undefined) {
    cfg.payeeId = updateData.payeeId || null;
    if (updateData.payeeName) cfg.payeeName = updateData.payeeName;
  }
  if (updateData.nextExpectedDemandDate !== undefined) {
    cfg.nextExpectedDemandDate = updateData.nextExpectedDemandDate ? new Date(updateData.nextExpectedDemandDate) : null;
  }
  if (updateData.normalDueDateTerms !== undefined) cfg.normalDueDateTerms = updateData.normalDueDateTerms;
  if (updateData.referenceNumber !== undefined) cfg.referenceNumber = updateData.referenceNumber;
  if (updateData.notes !== undefined) cfg.notes = updateData.notes;

  await cfg.save();
  return cfg;
};

/**
 * Create a new demand notice / invoice
 */
export const createPropertyDemand = async (companyId, propertyId, demandData) => {
  const prop = await Property.findOne({ _id: propertyId, companyId });
  if (!prop) {
    throw new Error('Property not found in active company context');
  }

  const {
    chargeType,
    payeeId,
    payeeName,
    demandReference,
    issueDate,
    dueDate,
    periodStart,
    periodEnd,
    amountDemanded,
    notes = '',
    fileUrl = '',
    fileName = '',
    fileSize = 0,
    mimeType = '',
    publicId = '',
    status = 'RECEIVED',
  } = demandData;

  const numAmount = round2(amountDemanded);
  if (numAmount <= 0) {
    throw new Error('Demand amount must be strictly greater than zero.');
  }

  // Prevent duplicate demand reference for the same property and charge type
  const duplicate = await PropertyDemand.findOne({
    companyId,
    propertyId,
    chargeType,
    demandReference: demandReference.trim(),
  });
  if (duplicate) {
    throw new Error(`Demand with reference "${demandReference}" already exists for this property.`);
  }

  let finalPayeeName = payeeName;
  if (payeeId && !finalPayeeName) {
    const payeeDoc = await ServiceChargePayee.findOne({ _id: payeeId, companyId });
    if (payeeDoc) finalPayeeName = payeeDoc.name;
  }

  const demand = await PropertyDemand.create({
    companyId,
    propertyId,
    chargeType,
    payeeId: payeeId || null,
    payeeName: finalPayeeName || 'Managing Agent',
    demandReference: demandReference.trim(),
    issueDate: new Date(issueDate),
    dueDate: new Date(dueDate),
    periodStart: periodStart ? new Date(periodStart) : null,
    periodEnd: periodEnd ? new Date(periodEnd) : null,
    amountDemanded: numAmount,
    totalPaid: 0,
    status,
    notes,
    fileUrl,
    fileName,
    fileSize,
    mimeType,
    publicId,
  });

  return demand;
};

/**
 * Record a payment against a demand with financial ledger & bank account integration
 */
export const recordDemandPayment = async (companyId, propertyId, demandId, paymentData) => {
  const prop = await Property.findOne({ _id: propertyId, companyId });
  if (!prop) {
    throw new Error('Property not found in active company context');
  }

  const demand = await PropertyDemand.findOne({ _id: demandId, propertyId, companyId });
  if (!demand) {
    throw new Error('Demand notice not found for this property');
  }

  if (demand.status === 'PAID') {
    throw new Error('This demand has already been paid in full.');
  }

  const {
    paymentDate,
    amountPaid,
    paymentMethod = 'BANK_TRANSFER',
    accountId = null,
    bankReference = '',
    notes = '',
    proofFileUrl = '',
    proofFileName = '',
    proofPublicId = '',
  } = paymentData;

  const numPayment = round2(amountPaid);
  if (numPayment <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }

  const currentOutstanding = round2((demand.amountDemanded || 0) - (demand.totalPaid || 0) - (demand.adjustments || 0));
  if (numPayment > currentOutstanding + 0.01) {
    throw new Error(`Payment of £${numPayment.toFixed(2)} exceeds current outstanding balance of £${currentOutstanding.toFixed(2)}.`);
  }

  // Find or verify appropriate Nominal Category for finance ledger
  let categoryDoc = await Category.findOne({
    companyId,
    name: 'Ground Rent & Estate Service Charges',
  });

  if (!categoryDoc) {
    categoryDoc = await Category.findOne({
      companyId,
      type: 'OPERATING_EXPENSE',
    });
  }

  let transactionId = null;
  let voucherId = null;

  // If a bank/cash account is chosen, integrate with central finance ledger
  if (accountId) {
    const accountDoc = await Account.findOne({ _id: accountId, companyId });
    if (!accountDoc) {
      throw new Error('Selected bank or cash account not found in active company');
    }

    const narration = `${demand.chargeType === 'SERVICE_CHARGE' ? 'Service Charge' : 'Ground Rent'} Payment: ${demand.demandReference} (${prop.name})`;

    const ledgerResult = await postLedgerTransaction({
      companyId,
      transactionDate: new Date(paymentDate),
      transactionType: 'EXPENSE',
      accountId,
      categoryId: categoryDoc?._id || null,
      amount: numPayment,
      direction: 'OUT',
      propertyId,
      narration,
      reference: bankReference || demand.demandReference,
      receiptUrl: proofFileUrl,
      receiptFilename: proofFileName,
    });

    transactionId = ledgerResult.transaction?._id || null;
    voucherId = ledgerResult.voucher?._id || null;
  }

  // Create payment record
  const payment = await PropertyChargePayment.create({
    companyId,
    propertyId,
    demandId: demand._id,
    chargeType: demand.chargeType,
    paymentDate: new Date(paymentDate),
    amountPaid: numPayment,
    paymentMethod,
    accountId: accountId || null,
    bankReference,
    notes,
    proofFileUrl,
    proofFileName,
    proofPublicId,
    transactionId,
    voucherId,
  });

  // Update demand totals and status
  demand.totalPaid = round2((demand.totalPaid || 0) + numPayment);
  const remaining = round2((demand.amountDemanded || 0) - demand.totalPaid - (demand.adjustments || 0));

  if (remaining <= 0) {
    demand.status = 'PAID';
  } else {
    demand.status = 'PARTIALLY_PAID';
  }
  await demand.save();

  return { payment, demand };
};

/**
 * Apply Credit Note, Adjustment, or Dispute to a demand
 */
export const adjustDemand = async (companyId, propertyId, demandId, adjustmentData) => {
  const demand = await PropertyDemand.findOne({ _id: demandId, propertyId, companyId });
  if (!demand) {
    throw new Error('Demand notice not found');
  }

  const { adjustmentAmount, isDispute, disputeReason, note } = adjustmentData;

  if (adjustmentAmount !== undefined) {
    const adjNum = round2(adjustmentAmount);
    demand.adjustments = round2((demand.adjustments || 0) + adjNum);
  }

  if (isDispute !== undefined) {
    if (isDispute) {
      demand.status = 'DISPUTED';
      demand.disputeReason = disputeReason || 'Charges under dispute with managing agent';
    } else {
      // Revert from dispute
      const remaining = round2((demand.amountDemanded || 0) - (demand.totalPaid || 0) - (demand.adjustments || 0));
      demand.status = remaining <= 0 ? 'PAID' : demand.totalPaid > 0 ? 'PARTIALLY_PAID' : 'RECEIVED';
      demand.disputeReason = '';
    }
  }

  if (note) {
    demand.notes = demand.notes ? `${demand.notes}\n[Adjustment]: ${note}` : `[Adjustment]: ${note}`;
  }

  await demand.save();
  return demand;
};

/**
 * Generate Comprehensive Running Ledger Statement
 */
export const getPropertyChargeLedger = async (companyId, propertyId, options = {}) => {
  const { chargeType = 'ALL', startDate, endDate } = options;

  const prop = await Property.findOne({ _id: propertyId, companyId }).lean();
  if (!prop) {
    throw new Error('Property not found in active company context');
  }

  const demandQuery = { companyId, propertyId, isActive: true };
  const paymentQuery = { companyId, propertyId, isActive: true };

  if (chargeType && chargeType !== 'ALL') {
    demandQuery.chargeType = chargeType;
    paymentQuery.chargeType = chargeType;
  }

  if (startDate || endDate) {
    demandQuery.issueDate = {};
    paymentQuery.paymentDate = {};
    if (startDate) {
      demandQuery.issueDate.$gte = new Date(startDate);
      paymentQuery.paymentDate.$gte = new Date(startDate);
    }
    if (endDate) {
      demandQuery.issueDate.$lte = new Date(endDate);
      paymentQuery.paymentDate.$lte = new Date(endDate);
    }
  }

  const [demands, payments] = await Promise.all([
    PropertyDemand.find(demandQuery).sort({ issueDate: 1 }).lean(),
    PropertyChargePayment.find(paymentQuery).populate('accountId', 'name accountType').sort({ paymentDate: 1 }).lean(),
  ]);

  // Combine into single chronological ledger timeline
  const ledgerEntries = [];

  demands.forEach((d) => {
    ledgerEntries.push({
      id: `DEM-${d._id}`,
      type: 'DEMAND',
      chargeType: d.chargeType,
      date: d.issueDate,
      dueDate: d.dueDate,
      reference: d.demandReference,
      payeeName: d.payeeName,
      debit: round2(d.amountDemanded), // Amount charged to property
      credit: 0,
      status: d.status,
      fileUrl: d.fileUrl,
      fileName: d.fileName,
      disputedAmount: d.disputedAmount || 0,
      disputeReason: d.disputeReason || '',
      adjustments: d.adjustments || 0,
      totalPaidOnDemand: d.totalPaid || 0,
      outstandingOnDemand: Math.max(0, round2((d.amountDemanded || 0) - (d.totalPaid || 0) - (d.adjustments || 0))),
      demandDoc: d,
    });
  });

  payments.forEach((p) => {
    ledgerEntries.push({
      id: `PAY-${p._id}`,
      type: 'PAYMENT',
      chargeType: p.chargeType,
      date: p.paymentDate,
      reference: p.bankReference || 'Bank Payment',
      paymentMethod: p.paymentMethod,
      accountName: p.accountId?.name || 'Bank Account',
      debit: 0,
      credit: round2(p.amountPaid), // Amount paid towards demand
      notes: p.notes,
      proofFileUrl: p.proofFileUrl,
      paymentDoc: p,
    });
  });

  // Sort chronologically by date
  ledgerEntries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Compute Running Balance after each transaction
  let runningBalance = 0;
  ledgerEntries.forEach((entry) => {
    if (entry.type === 'DEMAND') {
      runningBalance = round2(runningBalance + entry.debit - (entry.adjustments || 0));
    } else if (entry.type === 'PAYMENT') {
      runningBalance = round2(runningBalance - entry.credit);
    }
    entry.balance = Math.max(0, runningBalance);
  });

  // Calculate Summary KPI Totals
  const now = new Date();
  let totalDemanded = 0;
  let totalPaid = 0;
  let totalDisputed = 0;
  let overdueAmount = 0;

  demands.forEach((d) => {
    totalDemanded = round2(totalDemanded + (d.amountDemanded || 0));
    totalPaid = round2(totalPaid + (d.totalPaid || 0));
    totalDisputed = round2(totalDisputed + (d.disputedAmount || 0));

    const outstanding = Math.max(0, round2((d.amountDemanded || 0) - (d.totalPaid || 0) - (d.adjustments || 0)));
    if (outstanding > 0 && new Date(d.dueDate).getTime() < now.getTime() && d.status !== 'PAID' && d.status !== 'CANCELLED') {
      overdueAmount = round2(overdueAmount + outstanding);
    }
  });

  const totalOutstanding = Math.max(0, round2(totalDemanded - totalPaid));

  return {
    property: prop,
    chargeType,
    summary: {
      totalDemanded,
      totalPaid,
      totalOutstanding,
      overdueAmount,
      totalDisputed,
      demandCount: demands.length,
      paymentCount: payments.length,
    },
    entries: ledgerEntries,
    demands,
    payments,
  };
};

/**
 * Central Dashboard Overview of Charges across all properties of the active company
 */
export const getCompanyChargesOverview = async (companyId) => {
  const now = new Date();
  const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const next60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

  const [activeDemands, recentPayments] = await Promise.all([
    PropertyDemand.find({
      companyId,
      isActive: true,
      status: { $in: ['RECEIVED', 'PARTIALLY_PAID', 'OVERDUE', 'DISPUTED'] },
    })
      .populate('propertyId', 'name addressLine1')
      .sort({ dueDate: 1 })
      .lean(),
    PropertyChargePayment.find({ companyId, isActive: true })
      .populate('propertyId', 'name')
      .populate('accountId', 'name')
      .sort({ paymentDate: -1 })
      .limit(8)
      .lean(),
  ]);

  let upcomingServiceCharges = 0;
  let upcomingGroundRent = 0;
  let overdueAmount = 0;
  let totalOutstanding = 0;

  const upcomingList = [];
  const overdueList = [];

  activeDemands.forEach((d) => {
    const outstanding = Math.max(0, round2((d.amountDemanded || 0) - (d.totalPaid || 0) - (d.adjustments || 0)));
    totalOutstanding = round2(totalOutstanding + outstanding);

    const isOverdue = new Date(d.dueDate).getTime() < now.getTime();
    if (isOverdue) {
      overdueAmount = round2(overdueAmount + outstanding);
      overdueList.push({
        ...d,
        outstandingBalance: outstanding,
      });
    } else {
      if (d.chargeType === 'SERVICE_CHARGE') {
        upcomingServiceCharges = round2(upcomingServiceCharges + outstanding);
      } else {
        upcomingGroundRent = round2(upcomingGroundRent + outstanding);
      }
      upcomingList.push({
        ...d,
        outstandingBalance: outstanding,
      });
    }
  });

  return {
    summary: {
      totalOutstanding,
      overdueAmount,
      upcomingServiceCharges,
      upcomingGroundRent,
      activeDemandsCount: activeDemands.length,
    },
    upcomingDemands: upcomingList.slice(0, 8),
    overdueDemands: overdueList.slice(0, 8),
    recentPayments,
  };
};
