import { apiSuccess, apiError } from '../utils/apiResponse.js';
import Property from '../models/Property.js';
import PropertyChargeConfig from '../models/PropertyChargeConfig.js';
import PropertyDemand from '../models/PropertyDemand.js';
import PropertyChargePayment from '../models/PropertyChargePayment.js';
import ServiceChargePayee from '../models/ServiceChargePayee.js';
import cloudinary, { isCloudinaryConfigured, CLOUDINARY_FOLDER } from '../config/cloudinary.js';
import {
  seedDefaultPayees,
  getPropertyChargeConfigs,
  updatePropertyChargeConfig,
  createPropertyDemand,
  recordDemandPayment,
  getPropertyChargeLedger,
  getCompanyChargesOverview,
} from '../services/propertyChargeService.js';
import { checkAndGenerateDemandReminders } from '../services/propertyChargeReminderService.js';

/**
 * 1. Payees
 */
export const getPayees = async (req, res) => {
  try {
    await seedDefaultPayees(req.companyId);
    const payees = await ServiceChargePayee.find({
      companyId: req.companyId,
      isActive: true,
    }).sort({ payeeName: 1 }).lean();

    return apiSuccess(res, payees);
  } catch (err) {
    return apiError(res, err.message, 500);
  }
};

export const createPayee = async (req, res) => {
  try {
    const {
      payeeName,
      contactPerson,
      telephone,
      email,
      managingAgent,
      bankName,
      sortCode,
      accountNumber,
      iban,
      paymentReferenceInstructions,
      notes,
    } = req.body;

    if (!payeeName) {
      return apiError(res, 'Payee name is required', 400);
    }

    const payee = await ServiceChargePayee.create({
      companyId: req.companyId,
      payeeName: payeeName.trim(),
      contactPerson,
      telephone,
      email,
      managingAgent,
      bankName,
      sortCode,
      accountNumber,
      iban,
      paymentReferenceInstructions,
      notes,
      isVerified: true,
      createdBy: req.user?._id || req.user?.id,
    });

    return apiSuccess(res, payee, 201);
  } catch (err) {
    return apiError(res, err.message, 400);
  }
};

export const updatePayee = async (req, res) => {
  try {
    const { id } = req.params;
    const payee = await ServiceChargePayee.findOneAndUpdate(
      { _id: id, companyId: req.companyId },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!payee) {
      return apiError(res, 'Payee not found or not in company', 404);
    }

    return apiSuccess(res, payee);
  } catch (err) {
    return apiError(res, err.message, 400);
  }
};

/**
 * 2. Property Configurations
 */
export const getPropertyConfigs = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const property = await Property.findOne({ _id: propertyId, companyId: req.companyId }).lean();
    if (!property) {
      return apiError(res, 'Property not found for this company', 404);
    }

    const configs = await getPropertyChargeConfigs(req.companyId, propertyId);
    return apiSuccess(res, configs);
  } catch (err) {
    return apiError(res, err.message, 500);
  }
};

export const updatePropertyConfig = async (req, res) => {
  try {
    const { propertyId, chargeType } = req.params;
    const config = await updatePropertyChargeConfig(
      req.companyId,
      propertyId,
      chargeType.toUpperCase(),
      req.body
    );

    return apiSuccess(res, config);
  } catch (err) {
    return apiError(res, err.message, 400);
  }
};

/**
 * 3. Demands & Notices
 */
export const createDemand = async (req, res) => {
  try {
    let documentData = null;

    if (req.file) {
      const fileName = req.file.originalname;
      const fileSize = req.file.size;
      const mimeType = req.file.mimetype;
      let fileUrl = '';

      if (isCloudinaryConfigured()) {
        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: `${CLOUDINARY_FOLDER}/properties/${req.body.propertyId}/demands`,
              resource_type: 'auto',
            },
            (err, result) => {
              if (err) return reject(err);
              resolve(result);
            }
          );
          stream.end(req.file.buffer);
        });
        fileUrl = uploadResult.secure_url;
      } else {
        fileUrl = `data:${mimeType || 'application/octet-stream'};base64,${req.file.buffer.toString('base64')}`;
      }

      documentData = {
        fileUrl,
        fileName,
        fileSize,
        mimeType,
      };
    } else if (req.body.fileUrl) {
      documentData = {
        fileUrl: req.body.fileUrl,
        fileName: req.body.fileName || 'Demand_Notice.pdf',
        fileSize: Number(req.body.fileSize || 0),
        mimeType: req.body.mimeType || 'application/pdf',
      };
    }

    const demand = await createPropertyDemand(
      req.companyId,
      req.body.propertyId,
      { ...req.body, ...documentData }
    );

    return apiSuccess(res, demand, 201);
  } catch (err) {
    return apiError(res, err.message, 400);
  }
};

export const getDemands = async (req, res) => {
  try {
    const { propertyId, chargeType, status, search, year } = req.query;
    const filter = { companyId: req.companyId };

    if (propertyId) filter.propertyId = propertyId;
    if (chargeType && chargeType !== 'ALL') filter.chargeType = chargeType;
    if (status && status !== 'ALL') filter.status = status;
    if (year) {
      const start = new Date(`${year}-01-01T00:00:00.000Z`);
      const end = new Date(`${year}-12-31T23:59:59.999Z`);
      filter.dueDate = { $gte: start, $lte: end };
    }

    if (search) {
      filter.$or = [
        { demandReference: { $regex: search, $options: 'i' } },
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
      ];
    }

    const demands = await PropertyDemand.find(filter)
      .populate('propertyId', 'name addressLine1')
      .populate('payeeId', 'payeeName bankName sortCode accountNumber')
      .sort({ dueDate: -1, createdAt: -1 })
      .lean();

    return apiSuccess(res, demands);
  } catch (err) {
    return apiError(res, err.message, 500);
  }
};

export const getDemandById = async (req, res) => {
  try {
    const { id } = req.params;
    const demand = await PropertyDemand.findOne({ _id: id, companyId: req.companyId })
      .populate('propertyId', 'name addressLine1')
      .populate('payeeId')
      .lean();

    if (!demand) {
      return apiError(res, 'Demand notice not found for this company', 404);
    }

    const payments = await PropertyChargePayment.find({
      demandId: id,
      companyId: req.companyId,
    })
      .populate('accountId', 'accountName accountType')
      .sort({ paymentDate: -1 })
      .lean();

    return apiSuccess(res, { ...demand, payments });
  } catch (err) {
    return apiError(res, err.message, 500);
  }
};

export const updateDemandStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, disputeReason, disputeLoggedDate, adjustments, notes } = req.body;

    const demand = await PropertyDemand.findOne({ _id: id, companyId: req.companyId });
    if (!demand) {
      return apiError(res, 'Demand not found', 404);
    }

    if (status) demand.status = status;
    if (disputeReason !== undefined) demand.disputeReason = disputeReason;
    if (disputeLoggedDate !== undefined) demand.disputeLoggedDate = disputeLoggedDate;
    if (adjustments !== undefined) demand.adjustments = Number(adjustments);
    if (notes !== undefined) demand.notes = notes;

    await demand.save();
    return apiSuccess(res, demand);
  } catch (err) {
    return apiError(res, err.message, 400);
  }
};

/**
 * 4. Payments
 */
export const recordPayment = async (req, res) => {
  try {
    let proofData = null;

    if (req.file) {
      const fileName = req.file.originalname;
      const fileSize = req.file.size;
      const mimeType = req.file.mimetype;
      let fileUrl = '';

      if (isCloudinaryConfigured()) {
        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: `${CLOUDINARY_FOLDER}/payments`,
              resource_type: 'auto',
            },
            (err, result) => {
              if (err) return reject(err);
              resolve(result);
            }
          );
          stream.end(req.file.buffer);
        });
        fileUrl = uploadResult.secure_url;
      } else {
        fileUrl = `data:${mimeType || 'application/octet-stream'};base64,${req.file.buffer.toString('base64')}`;
      }

      proofData = {
        fileUrl,
        fileName,
        fileSize,
        mimeType,
      };
    } else if (req.body.fileUrl) {
      proofData = {
        fileUrl: req.body.fileUrl,
        fileName: req.body.fileName || 'Proof_of_Payment.pdf',
        fileSize: Number(req.body.fileSize || 0),
        mimeType: req.body.mimeType || 'application/pdf',
      };
    }

    const result = await recordDemandPayment(
      req.companyId,
      req.body.propertyId,
      req.body.demandId,
      {
        ...req.body,
        proofFileUrl: proofData?.fileUrl || '',
        proofFileName: proofData?.fileName || '',
      }
    );

    return apiSuccess(res, result, 201);
  } catch (err) {
    return apiError(res, err.message, 400);
  }
};

export const getPayments = async (req, res) => {
  try {
    const { propertyId, demandId } = req.query;
    const filter = { companyId: req.companyId };
    if (propertyId) filter.propertyId = propertyId;
    if (demandId) filter.demandId = demandId;

    const payments = await PropertyChargePayment.find(filter)
      .populate('propertyId', 'name')
      .populate('demandId', 'demandReference chargeType amountDemanded')
      .populate('accountId', 'accountName bankName')
      .populate('payeeId', 'payeeName')
      .sort({ paymentDate: -1 })
      .lean();

    return apiSuccess(res, payments);
  } catch (err) {
    return apiError(res, err.message, 500);
  }
};

/**
 * 5. Full Running Ledger
 */
export const getPropertyLedger = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { chargeType = 'ALL', fromDate, toDate } = req.query;

    const ledger = await getPropertyChargeLedger(
      req.companyId,
      propertyId,
      {
        chargeType,
        startDate: fromDate ? new Date(fromDate) : undefined,
        endDate: toDate ? new Date(toDate) : undefined,
      }
    );

    return apiSuccess(res, ledger);
  } catch (err) {
    return apiError(res, err.message, 500);
  }
};

/**
 * 6. Company-wide Overview
 */
export const getDashboardOverview = async (req, res) => {
  try {
    const overview = await getCompanyChargesOverview(req.companyId);
    return apiSuccess(res, overview);
  } catch (err) {
    return apiError(res, err.message, 500);
  }
};

/**
 * 7. Trigger Reminder Checks
 */
export const runRemindersCheck = async (req, res) => {
  try {
    const results = await checkAndGenerateDemandReminders(req.companyId);
    return apiSuccess(res, results);
  } catch (err) {
    return apiError(res, err.message, 500);
  }
};

export default {
  getPayees,
  createPayee,
  updatePayee,
  getPropertyConfigs,
  updatePropertyConfig,
  createDemand,
  getDemands,
  getDemandById,
  updateDemandStatus,
  recordPayment,
  getPayments,
  getPropertyLedger,
  getDashboardOverview,
  runRemindersCheck,
};
