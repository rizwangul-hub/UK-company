import mongoose from 'mongoose';
import RentSchedule from '../models/RentSchedule.js';
import RentPayment from '../models/RentPayment.js';
import TenancyAgreement from '../models/TenancyAgreement.js';
import Tenant from '../models/Tenant.js';
import Unit from '../models/Unit.js';
import Category from '../models/Category.js';
import Account from '../models/Account.js';
import Property from '../models/Property.js';
import { postLedgerTransaction, generateVoucherNo, round2 } from '../services/ledgerService.js';
import { apiSuccess, apiError } from '../utils/apiResponse.js';

export const generateMonthlySchedules = async (req, res) => {
  try {
    const { month } = req.body;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return apiError(res, 'Valid billing month (YYYY-MM) is required.', 400);
    }

    const [y, m] = month.split('-').map(Number);
    let createdCount = 0;
    const handledPropertyIds = new Set();

    // 1. Process active formal tenancy agreements first
    const activeAgreements = await TenancyAgreement.find({ companyId: req.companyId, status: 'ACTIVE' }).lean();

    for (const agreement of activeAgreements) {
      if (agreement.propertyId) {
        handledPropertyIds.add(agreement.propertyId.toString());
      }

      const existing = await RentSchedule.findOne({
        companyId: req.companyId,
        agreementId: agreement._id,
        billingMonth: month,
      });

      if (!existing) {
        const dueDay = Math.min(agreement.rentDueDay || 1, 28);
        const dueDate = new Date(Date.UTC(y, m - 1, dueDay));

        await RentSchedule.create({
          companyId: req.companyId,
          agreementId: agreement._id,
          tenantId: agreement.tenantId,
          propertyId: agreement.propertyId,
          unitId: agreement.unitId || null,
          billingMonth: month,
          dueDate,
          expectedAmount: agreement.rentAmount,
          paidAmount: 0,
        });
        createdCount++;
      }
    }

    // 2. Direct property/unit model: Process active properties with units or contractual rent that do not have an active agreement
    const directProperties = await Property.find({
      companyId: req.companyId,
      isActive: true,
      contractualRent: { $gt: 0 },
    }).lean();

    for (const prop of directProperties) {
      if (handledPropertyIds.has(prop._id.toString())) continue;

      const propUnits = await Unit.find({ companyId: req.companyId, propertyId: prop._id, isActive: true }).lean();
      const dueDate = new Date(Date.UTC(y, m - 1, 1));

      if (propUnits.length > 0) {
        // Multi-unit property: generate schedule for each lettable unit
        for (const u of propUnits) {
          const existingUnitSchedule = await RentSchedule.findOne({
            companyId: req.companyId,
            propertyId: prop._id,
            unitId: u._id,
            billingMonth: month,
          });

          if (!existingUnitSchedule) {
            await RentSchedule.create({
              companyId: req.companyId,
              agreementId: null,
              tenantId: null,
              propertyId: prop._id,
              unitId: u._id,
              billingMonth: month,
              dueDate,
              expectedAmount: u.targetRent || 0,
              paidAmount: 0,
              notes: `${u.unitName} (${u.unitType})`,
            });
            createdCount++;
          }
        }
      } else {
        // Single unit property
        const existing = await RentSchedule.findOne({
          companyId: req.companyId,
          propertyId: prop._id,
          unitId: null,
          billingMonth: month,
        });

        if (!existing) {
          await RentSchedule.create({
            companyId: req.companyId,
            agreementId: null,
            tenantId: null,
            propertyId: prop._id,
            unitId: null,
            billingMonth: month,
            dueDate,
            expectedAmount: prop.contractualRent,
            paidAmount: 0,
            notes: prop.tenantName ? `Tenant: ${prop.tenantName}` : '',
          });
          createdCount++;
        }
      }
    }

    return apiSuccess(
      res,
      { month, createdCount },
      `Generated ${createdCount} rent billing schedules for ${month}.`
    );
  } catch (error) {
    return apiError(res, 'Failed to generate rent schedules', 500, error);
  }
};

export const getSchedules = async (req, res) => {
  try {
    const { billingMonth, propertyId, status, minMonth = '2026-10' } = req.query;
    const query = { companyId: req.companyId };
    if (billingMonth) {
      query.billingMonth = billingMonth;
    } else if (minMonth) {
      query.billingMonth = { $gte: minMonth };
    }
    if (propertyId) query.propertyId = propertyId;
    if (status) {
      if (status.includes(',')) {
        query.status = { $in: status.split(',').map((s) => s.trim().toUpperCase()) };
      } else {
        query.status = status.toUpperCase();
      }
    }

    const schedules = await RentSchedule.find(query)
      .populate('tenantId', 'fullName email phone')
      .populate('propertyId', 'name addressLine1 postcode contractualRent')
      .populate('unitId', 'unitName unitType')
      .sort({ dueDate: 1 })
      .lean();

    const totals = schedules.reduce(
      (acc, s) => {
        acc.totalExpected += s.expectedAmount || 0;
        acc.totalPaid += s.paidAmount || 0;
        acc.totalOutstanding += s.outstandingAmount || 0;
        return acc;
      },
      { totalExpected: 0, totalPaid: 0, totalOutstanding: 0 }
    );

    return apiSuccess(res, {
      schedules,
      totals: {
        totalExpected: round2(totals.totalExpected),
        totalPaid: round2(totals.totalPaid),
        totalOutstanding: round2(totals.totalOutstanding),
      },
    });
  } catch (error) {
    return apiError(res, 'Failed to fetch rent schedules', 500, error);
  }
};

export const recordPayment = async (req, res) => {
  try {
    let {
      scheduleId,
      propertyId,
      unitId,
      billingMonth,
      amount,
      paymentDate = new Date(),
      receivingAccountId,
      paymentMethod = 'STANDING_ORDER',
      notes = '',
      receiptUrl = '',
      receiptFilename = '',
      documents = [],
    } = req.body;

    const numAmount = round2(amount);
    if (!numAmount || numAmount <= 0) {
      return apiError(res, 'Valid payment amount in GBP is required.', 400);
    }
    if (!receivingAccountId) {
      return apiError(res, 'Receiving bank account is required.', 400);
    }

    let schedule = null;

    if (scheduleId) {
      schedule = await RentSchedule.findOne({ _id: scheduleId, companyId: req.companyId })
        .populate('tenantId')
        .populate('propertyId')
        .populate('unitId');
    }

    // Direct Property / Unit Collection fallback if no scheduleId or schedule not found
    if (!schedule && propertyId && billingMonth) {
      const scheduleFilter = {
        companyId: req.companyId,
        propertyId,
        billingMonth,
      };
      if (unitId && mongoose.Types.ObjectId.isValid(unitId)) {
        scheduleFilter.unitId = unitId;
      }
      schedule = await RentSchedule.findOne(scheduleFilter)
        .populate('tenantId')
        .populate('propertyId')
        .populate('unitId');

      if (!schedule) {
        const prop = await Property.findOne({ _id: propertyId, companyId: req.companyId });
        if (!prop) {
          return apiError(res, 'Property not found in active company.', 404);
        }
        let unitDoc = null;
        if (unitId && mongoose.Types.ObjectId.isValid(unitId)) {
          unitDoc = await Unit.findOne({ _id: unitId, propertyId: prop._id });
        }
        const expectedRent = unitDoc?.targetRent || prop.contractualRent || numAmount;
        // Create schedule on the fly for this direct property/unit and billing month
        schedule = await RentSchedule.create({
          companyId: req.companyId,
          propertyId: prop._id,
          unitId: unitDoc?._id || (unitId && mongoose.Types.ObjectId.isValid(unitId) ? unitId : null),
          tenantId: null,
          billingMonth,
          dueDate: new Date(`${billingMonth}-01`),
          expectedAmount: expectedRent,
          paidAmount: 0,
          outstandingAmount: expectedRent,
          status: 'PENDING',
          notes: unitDoc ? `Rent billing for ${unitDoc.unitName} - ${billingMonth}` : `Rent billing for ${billingMonth}`,
        });
        await schedule.populate('propertyId');
        if (schedule.unitId) await schedule.populate('unitId');
      }
    }

    if (!schedule) {
      return apiError(res, 'Rent billing schedule or property and billing month required.', 404);
    }

    // Verify receiving account belongs to the same company
    const receivingAccount = await Account.findOne({ _id: receivingAccountId, companyId: req.companyId });
    if (!receivingAccount) {
      return apiError(res, 'Receiving bank account not found in this company.', 400);
    }

    // Idempotency check: prevent rapid duplicate submissions
    const recentDuplicate = await RentPayment.findOne({
      companyId: req.companyId,
      scheduleId: schedule._id,
      amount: numAmount,
      receivingAccountId,
      createdAt: { $gte: new Date(Date.now() - 60000) },
    });
    if (recentDuplicate) {
      return apiError(
        res,
        'Duplicate payment detected. A rent receipt with the same amount was posted within the last 60 seconds.',
        400
      );
    }

    // Resolve rental income category head for active company
    let category = await Category.findOne({ companyId: req.companyId, type: 'INCOME', isRentalHead: true });
    if (!category) {
      category = await Category.findOne({ companyId: req.companyId, type: 'INCOME' });
    }

    const receiptRef = await generateVoucherNo('REC', req.companyId);

    const propId = schedule.propertyId?._id || schedule.propertyId;
    const propName = schedule.propertyId?.name || 'Property';
    const unitNamePart = schedule.unitId?.unitName ? ` (${schedule.unitId.unitName})` : '';
    const tenantName = schedule.tenantId?.fullName || schedule.propertyId?.tenantName || 'Tenant';

    const resolvedDocs = Array.isArray(documents) && documents.length > 0
      ? documents
      : receiptUrl
      ? [{ title: receiptFilename || 'Rent Receipt', url: receiptUrl, docType: 'RENT_RECEIPT', uploadedAt: new Date() }]
      : [];

    // 1. Post ledger transaction (IN = Cash inflow to receiving bank)
    const { transaction } = await postLedgerTransaction({
      companyId: req.companyId,
      transactionDate: paymentDate,
      voucherNo: receiptRef,
      transactionType: 'INCOME',
      accountId: receivingAccountId,
      categoryId: category?._id,
      amount: numAmount,
      direction: 'IN',
      propertyId: propId,
      unitId: schedule.unitId?._id || null,
      periodMonth: schedule.billingMonth,
      narration: `Rent received from ${tenantName} for ${propName}${unitNamePart} - Period: ${schedule.billingMonth}`,
      reference: receiptRef,
      userId: req.user?._id,
      receiptUrl: receiptUrl.trim(),
      receiptFilename: receiptFilename.trim(),
      documents: resolvedDocs,
    });

    // 2. Create RentPayment record
    const payment = await RentPayment.create({
      companyId: req.companyId,
      receiptRef,
      paymentDate,
      billingMonth: schedule.billingMonth,
      tenantId: schedule.tenantId?._id || null,
      propertyId: propId,
      unitId: schedule.unitId?._id || null,
      agreementId: schedule.agreementId || null,
      scheduleId: schedule._id,
      amount: numAmount,
      receivingAccountId,
      paymentMethod,
      transactionId: transaction._id,
      receiptUrl: receiptUrl.trim(),
      receiptFilename: receiptFilename.trim(),
      documents: resolvedDocs,
      notes,
    });

    // 3. Update RentSchedule paid amount & status
    schedule.paidAmount = round2((schedule.paidAmount || 0) + numAmount);
    await schedule.save();

    return apiSuccess(
      res,
      { payment, updatedSchedule: schedule },
      `Rent receipt ${receiptRef} of £${numAmount.toFixed(2)} successfully recorded.`,
      201
    );
  } catch (error) {
    return apiError(res, error.message || 'Failed to record rent payment', 500, error);
  }
};

export const getArrearsSummary = async (req, res) => {
  try {
    const overdueSchedules = await RentSchedule.find({
      companyId: req.companyId,
      status: { $in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
      dueDate: { $lt: new Date() },
    })
      .populate('tenantId', 'fullName email phone')
      .populate('propertyId', 'name addressLine1 postcode')
      .populate('unitId', 'unitName')
      .sort({ dueDate: 1 })
      .lean();

    const totalArrears = overdueSchedules.reduce((sum, s) => sum + (s.outstandingAmount || 0), 0);

    return apiSuccess(res, {
      overdueSchedules,
      totalArrears: round2(totalArrears),
      arrearsCount: overdueSchedules.length,
    });
  } catch (error) {
    return apiError(res, 'Failed to fetch arrears summary', 500, error);
  }
};

export const updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { expectedAmount, dueDate, paidAmount, status, notes, billingMonth } = req.body;
    const schedule = await RentSchedule.findOne({ _id: id, companyId: req.companyId });
    if (!schedule) return apiError(res, 'Rent schedule not found in this company', 404);

    if (expectedAmount !== undefined) schedule.expectedAmount = round2(expectedAmount);
    if (dueDate !== undefined) schedule.dueDate = new Date(dueDate);
    if (paidAmount !== undefined) schedule.paidAmount = round2(paidAmount);
    if (notes !== undefined) schedule.notes = notes ? notes.trim() : '';
    if (billingMonth !== undefined) schedule.billingMonth = billingMonth;

    schedule.outstandingAmount = Math.max(0, schedule.expectedAmount - (schedule.paidAmount || 0));
    if (status) {
      schedule.status = status;
    } else {
      if (schedule.paidAmount >= schedule.expectedAmount) {
        schedule.status = 'PAID';
      } else if (schedule.paidAmount > 0) {
        schedule.status = 'PARTIAL';
      } else {
        const isPastDue = new Date(schedule.dueDate) < new Date();
        schedule.status = isPastDue ? 'OVERDUE' : 'PENDING';
      }
    }

    await schedule.save();
    return apiSuccess(res, schedule, 'Rent billing schedule updated successfully');
  } catch (error) {
    return apiError(res, error.message || 'Failed to update rent schedule', 400, error);
  }
};
