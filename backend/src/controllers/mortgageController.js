import Mortgage from '../models/Mortgage.js';
import MortgagePayment from '../models/MortgagePayment.js';
import { recordMortgagePayment, reconcileMortgageBalance } from '../services/mortgageService.js';
import { round2 } from '../services/ledgerService.js';
import { apiSuccess, apiError } from '../utils/apiResponse.js';

import Property from '../models/Property.js';
import Account from '../models/Account.js';

export const getMortgages = async (req, res) => {
  try {
    const { propertyId, status } = req.query;
    const query = { companyId: req.companyId };
    if (propertyId) query.propertyId = propertyId;
    if (status) query.status = status;

    const mortgages = await Mortgage.find(query)
      .populate('propertyId', 'name addressLine1 postcode currentValuation purchasePrice')
      .populate('paymentAccountId', 'name sortCode accountNumber currentBalance')
      .sort({ createdAt: -1 })
      .lean();

    const summary = mortgages.reduce(
      (acc, m) => {
        if (m.status === 'ACTIVE') {
          acc.totalOutstandingPrincipal += m.outstandingPrincipalBalance || 0;
          acc.totalExpectedMonthlyPayment += m.expectedRepaymentAmount || 0;
          acc.activeCount++;
        }
        return acc;
      },
      { totalOutstandingPrincipal: 0, totalExpectedMonthlyPayment: 0, activeCount: 0 }
    );

    return apiSuccess(res, {
      mortgages,
      summary: {
        totalOutstandingPrincipal: round2(summary.totalOutstandingPrincipal),
        totalExpectedMonthlyPayment: round2(summary.totalExpectedMonthlyPayment),
        activeCount: summary.activeCount,
      },
    });
  } catch (error) {
    return apiError(res, 'Failed to fetch mortgages', 500, error);
  }
};

export const getMortgageById = async (req, res) => {
  try {
    const mortgage = await Mortgage.findOne({ _id: req.params.id, companyId: req.companyId })
      .populate('propertyId', 'name addressLine1 postcode currentValuation purchasePrice')
      .populate('paymentAccountId', 'name sortCode accountNumber currentBalance')
      .lean();

    if (!mortgage) return apiError(res, 'Mortgage not found', 404);

    const payments = await MortgagePayment.find({ mortgageId: mortgage._id, companyId: req.companyId })
      .populate('paymentAccountId', 'name sortCode accountNumber')
      .sort({ paymentDate: -1 })
      .lean();

    const totalInterestPaid = payments.reduce((sum, p) => sum + (p.interestAmount || 0), 0);
    const totalPrincipalPaid = payments.reduce((sum, p) => sum + (p.principalAmount || 0), 0);

    return apiSuccess(res, {
      ...mortgage,
      payments,
      lifetimeStats: {
        totalInterestPaid: round2(totalInterestPaid),
        totalPrincipalPaid: round2(totalPrincipalPaid),
        paymentsCount: payments.length,
      },
    });
  } catch (error) {
    return apiError(res, 'Failed to fetch mortgage details', 500, error);
  }
};

export const createMortgage = async (req, res) => {
  try {
    const { propertyId, paymentAccountId } = req.body;

    if (propertyId) {
      const property = await Property.findOne({ _id: propertyId, companyId: req.companyId });
      if (!property) {
        return apiError(res, 'Property not found in active company', 400);
      }
    }
    if (paymentAccountId) {
      const account = await Account.findOne({ _id: paymentAccountId, companyId: req.companyId });
      if (!account) {
        return apiError(res, 'Payment bank account not found in active company', 400);
      }
    }

    const payload = { ...req.body, companyId: req.companyId };
    const mortgage = await Mortgage.create(payload);
    return apiSuccess(res, mortgage, 'Mortgage facility created successfully', 201);
  } catch (error) {
    return apiError(res, error.message || 'Failed to create mortgage facility', 400, error);
  }
};

export const updateMortgage = async (req, res) => {
  try {
    const updateData = { ...req.body };
    delete updateData.companyId;

    if (updateData.propertyId) {
      const property = await Property.findOne({ _id: updateData.propertyId, companyId: req.companyId });
      if (!property) return apiError(res, 'Property not found in active company', 400);
    }
    if (updateData.paymentAccountId) {
      const account = await Account.findOne({ _id: updateData.paymentAccountId, companyId: req.companyId });
      if (!account) return apiError(res, 'Payment bank account not found in active company', 400);
    }

    const mortgage = await Mortgage.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      updateData,
      { new: true }
    );
    if (!mortgage) return apiError(res, 'Mortgage not found', 404);
    return apiSuccess(res, mortgage, 'Mortgage details updated successfully');
  } catch (error) {
    return apiError(res, error.message || 'Failed to update mortgage', 400, error);
  }
};

export const postMortgagePayment = async (req, res) => {
  try {
    const result = await recordMortgagePayment(
      {
        ...req.body,
        mortgageId: req.params.id,
        companyId: req.companyId,
      },
      req.user?._id,
      req.companyId
    );

    return apiSuccess(
      res,
      result,
      `Mortgage payment of £${req.body.totalAmountPaid} recorded successfully.`,
      201
    );
  } catch (error) {
    return apiError(res, error.message || 'Failed to record mortgage payment', 400, error);
  }
};

export const getMortgagePayments = async (req, res) => {
  try {
    const payments = await MortgagePayment.find({ mortgageId: req.params.id, companyId: req.companyId })
      .populate('paymentAccountId', 'name sortCode accountNumber')
      .sort({ paymentDate: -1 })
      .lean();

    return apiSuccess(res, { payments, total: payments.length });
  } catch (error) {
    return apiError(res, 'Failed to fetch mortgage payments', 500, error);
  }
};

export const reconcileBalance = async (req, res) => {
  try {
    const { confirmedBalance, statementDate, notes } = req.body;
    if (confirmedBalance === undefined || !statementDate) {
      return apiError(res, 'Confirmed balance and statement date are required.', 400);
    }

    const result = await reconcileMortgageBalance(
      req.params.id,
      confirmedBalance,
      statementDate,
      notes,
      req.companyId
    );

    return apiSuccess(res, result, 'Mortgage balance successfully reconciled with lender statement.');
  } catch (error) {
    return apiError(res, error.message || 'Reconciliation failed', 500, error);
  }
};
