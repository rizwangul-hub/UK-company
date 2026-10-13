import Appliance, { OFFICIAL_VALET_CHECKLISTS } from '../models/Appliance.js';
import MaintenanceTask, { DEFAULT_MAINTENANCE_TASKS } from '../models/MaintenanceTask.js';
import SupplierReceipt from '../models/SupplierReceipt.js';
import Property from '../models/Property.js';
import cloudinary, { isCloudinaryConfigured, CLOUDINARY_FOLDER } from '../config/cloudinary.js';
import { apiSuccess, apiError } from '../utils/apiResponse.js';

// Official Currys Directory transcribed from Care & Repair leaflet
const CURRYS_OFFICIAL_CONTACTS = {
  careAndRepairPhone: '0344 800 6080',
  careAndRepairHours: 'Mon-Fri: 8am-8pm, Sat: 8am-6pm, Sun: 9am-6pm',
  faultSupportPhone: '0800 0121 909',
  faultSupportHours: '24/7 Tech Support & Fault Diagnostics',
  careAndRepairWebsite: 'https://www.currys.co.uk/careandrepair',
  instantReplacementWebsite: 'https://www.currys.co.uk/instantreplacement',
  postalAddress: 'Currys Care Services, PO Box 194, Cramlington, NE23 0DA',
  transcribedNotice: 'Transcribed from official Currys Care & Repair documentation. Not independently verified real-time directory.',
};

/**
 * Auto-seed Currys Verified Receipt #159485 and pending appliances for company if not existing
 */
const seedCurrysReceiptIfMissing = async (companyId) => {
  try {
    const existingReceipt = await SupplierReceipt.findOne({ companyId, receiptNumber: '159485' });
    if (existingReceipt) return existingReceipt;

    // 1. Create master source receipt (strictly unposted in financial ledger)
    const masterReceipt = await SupplierReceipt.create({
      companyId,
      supplier: 'Currys',
      branch: '2234 Chingford',
      receiptNumber: '159485',
      receiptDate: new Date('2026-10-13T00:00:00.000Z'),
      totalAmountDueGBP: 682.35,
      paymentInformation: {
        method: 'SPLIT_CARD_DIRECT_DEBIT',
        cardPaymentGBP: 498.15,
        directDebitMandate: {
          hasMandate: true,
          monthlyInstalmentGBP: 18.42,
          numberOfInstalments: 10,
          totalMandateGBP: 184.20,
        },
        notes: '£498.15 upfront card payment; 10 monthly Direct Debit instalments of £18.42.',
      },
      financialLedgerStatus: 'SOURCE_RECORD_ONLY',
      notes: 'Currys Chingford Branch 2234 master receipt. Includes discounts, delivery, Care Services, and instalment mandate.',
      isVerified: true,
    });

    // 2. Item A: Indesit Washing Machine / Washer Dryer
    const existingItemA = await Appliance.findOne({ companyId, 'serviceAgreement.agreementReference': '1453938413' });
    if (!existingItemA) {
      await Appliance.create({
        companyId,
        propertyId: null,
        propertyAssignmentStatus: 'PENDING_VERIFICATION',
        supplierReceiptId: masterReceipt._id,
        name: 'INDESIT IMA864MYT IMEUK',
        applianceType: 'WASHING_MACHINE',
        brand: 'INDESIT',
        modelNumber: 'IMA864MYT IMEUK',
        serialNumber: '', // Unverified until physical inspection
        supplier: 'Currys',
        itemCode: '0000628710',
        purchasePrice: 279.00,
        careServicesChargeGBP: 150.00,
        purchaseDate: new Date('2026-10-13T00:00:00.000Z'),
        manufacturerWarranty: {
          provider: 'INDESIT',
          warrantyType: 'STANDARD_MANUFACTURER',
          startDate: new Date('2026-10-13T00:00:00.000Z'),
          expiryDate: new Date('2027-10-12T00:00:00.000Z'),
          durationYears: 1,
          verificationStatus: 'NOT_VERIFIED',
          verificationNotes: 'Standard 1-year manufacturer warranty subject to registration',
        },
        serviceAgreement: {
          hasAgreement: true,
          provider: 'Currys Care & Repair',
          agreementReference: '1453938413',
          planType: 'PAY_UPFRONT',
          durationYears: 5,
          startDate: new Date('2026-10-13T00:00:00.000Z'),
          endDate: new Date('2031-10-12T00:00:00.000Z'),
          chargeGBP: 150.00,
          includedServices: '7-day fix promise, no repair bills for parts or labour, annual Squeaky Clean Valet',
          verificationStatus: 'VERIFIED',
          verificationNotes: '5-year Care & Repair plan verified from Currys Chingford receipt #159485',
        },
        currysCareAndRepair: {
          hasPlan: true,
          planType: 'PAY_UPFRONT',
          planDuration: '5_YEARS',
          planReferenceNumber: '1453938413',
          planStartDate: new Date('2026-10-13T00:00:00.000Z'),
          planEndDate: new Date('2031-10-12T00:00:00.000Z'),
          isPlanVerified: true,
        },
        squeakyCleanValet: {
          eligibilityStatus: 'ELIGIBLE',
          eligibilityEvidence: 'Covered under Currys 5-Year Care & Repair agreement #1453938413',
          nextValetDueDate: new Date('2027-10-13T00:00:00.000Z'),
          appointedServiceProvider: 'Currys',
        },
        status: 'OPERATIONAL',
        isPropertyAssignedVerified: false,
        notes: 'Source Currys receipt #159485 Item A. Location/property assignment pending physical confirmation.',
      });
    }

    // 3. Item B: Logik Fridge / Fridge Freezer
    const existingItemB = await Appliance.findOne({ companyId, 'serviceAgreement.agreementReference': '1453938462' });
    if (!existingItemB) {
      await Appliance.create({
        companyId,
        propertyId: null,
        propertyAssignmentStatus: 'PENDING_VERIFICATION',
        supplierReceiptId: masterReceipt._id,
        name: 'LOGIK L50BW23',
        applianceType: 'FRIDGE_FREEZER',
        brand: 'LOGIK',
        modelNumber: 'L50BW23',
        serialNumber: '', // Unverified until physical inspection
        supplier: 'Currys',
        itemCode: '0000370794',
        purchasePrice: 199.00,
        careServicesChargeGBP: 65.00,
        purchaseDate: new Date('2026-10-13T00:00:00.000Z'),
        manufacturerWarranty: {
          provider: 'LOGIK',
          warrantyType: 'STANDARD_MANUFACTURER',
          startDate: new Date('2026-10-13T00:00:00.000Z'),
          expiryDate: new Date('2027-10-12T00:00:00.000Z'),
          durationYears: 1,
          verificationStatus: 'NOT_VERIFIED',
          verificationNotes: 'Standard 1-year manufacturer warranty',
        },
        serviceAgreement: {
          hasAgreement: true,
          provider: 'Currys Care & Repair',
          agreementReference: '1453938462',
          planType: 'PAY_UPFRONT',
          durationYears: 5,
          startDate: new Date('2026-10-13T00:00:00.000Z'),
          endDate: new Date('2031-10-12T00:00:00.000Z'),
          chargeGBP: 65.00,
          includedServices: '7-day fix promise, no repair bills for parts or labour, annual Squeaky Clean Valet',
          verificationStatus: 'VERIFIED',
          verificationNotes: '5-year Care & Repair plan verified from Currys Chingford receipt #159485',
        },
        currysCareAndRepair: {
          hasPlan: true,
          planType: 'PAY_UPFRONT',
          planDuration: '5_YEARS',
          planReferenceNumber: '1453938462',
          planStartDate: new Date('2026-10-13T00:00:00.000Z'),
          planEndDate: new Date('2031-10-12T00:00:00.000Z'),
          isPlanVerified: true,
        },
        squeakyCleanValet: {
          eligibilityStatus: 'ELIGIBLE',
          eligibilityEvidence: 'Covered under Currys 5-Year Care & Repair agreement #1453938462',
          nextValetDueDate: new Date('2027-10-13T00:00:00.000Z'),
          appointedServiceProvider: 'Currys',
        },
        status: 'OPERATIONAL',
        isPropertyAssignedVerified: false,
        notes: 'Source Currys receipt #159485 Item B. Location/property assignment pending physical confirmation.',
      });
    }

    return masterReceipt;
  } catch (err) {
    console.error('Currys receipt auto-seed notice:', err.message);
  }
};

/**
 * 1. Get All Appliances for active company (with auto-seeding Currys receipt)
 */
export const getAppliances = async (req, res) => {
  try {
    await seedCurrysReceiptIfMissing(req.companyId);

    const { propertyId, applianceType, supplier, hasPlan, valetStatus, assignmentStatus, search } = req.query;
    const filter = { companyId: req.companyId };

    if (propertyId) {
      filter.propertyId = propertyId;
    }
    if (assignmentStatus) {
      filter.propertyAssignmentStatus = assignmentStatus;
    }
    if (applianceType) {
      filter.applianceType = applianceType;
    }
    if (supplier) {
      filter.supplier = { $regex: supplier, $options: 'i' };
    }
    if (hasPlan === 'true') {
      filter['currysCareAndRepair.hasPlan'] = true;
    } else if (hasPlan === 'false') {
      filter['currysCareAndRepair.hasPlan'] = false;
    }
    if (valetStatus) {
      filter['squeakyCleanValet.eligibilityStatus'] = valetStatus;
    }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
        { modelNumber: { $regex: search, $options: 'i' } },
        { serialNumber: { $regex: search, $options: 'i' } },
        { itemCode: { $regex: search, $options: 'i' } },
        { 'serviceAgreement.agreementReference': { $regex: search, $options: 'i' } },
      ];
    }

    const appliances = await Appliance.find(filter)
      .populate('propertyId', 'name addressLine1 postcode city')
      .populate('supplierReceiptId', 'supplier branch receiptNumber receiptDate totalAmountDueGBP')
      .sort({ createdAt: -1 })
      .lean();

    // Aggregated metrics
    const now = new Date();
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);
    const in60Days = new Date();
    in60Days.setDate(in60Days.getDate() + 60);
    const in90Days = new Date();
    in90Days.setDate(in90Days.getDate() + 90);

    const summary = {
      totalAppliances: appliances.length,
      pendingAssignmentCount: appliances.filter((a) => a.propertyAssignmentStatus === 'PENDING_VERIFICATION' || !a.propertyId).length,
      currysAppliancesCount: appliances.filter((a) => (a.supplier || '').toLowerCase().includes('curry')).length,
      howdensAppliancesCount: appliances.filter((a) => (a.supplier || '').toLowerCase().includes('howden')).length,
      careAndRepairPlanCount: appliances.filter((a) => a.serviceAgreement?.hasAgreement || a.currysCareAndRepair?.hasPlan).length,
      valetDueCount: appliances.filter((a) => ['DUE', 'BOOKING_REQUIRED'].includes(a.squeakyCleanValet?.eligibilityStatus)).length,
      valetBookedCount: appliances.filter((a) => a.squeakyCleanValet?.eligibilityStatus === 'BOOKED').length,
      valetCompletedCount: appliances.filter((a) => a.squeakyCleanValet?.eligibilityStatus === 'COMPLETED').length,
      missingReceiptsCount: appliances.filter((a) => (!a.documents || a.documents.length === 0) && !a.supplierReceiptId).length,
      unverifiedPropertyCount: appliances.filter((a) => !a.isPropertyAssignedVerified).length,
      warrantiesExpiring30Days: appliances.filter((a) => {
        const exp = a.serviceAgreement?.endDate || a.extendedWarranty?.expiryDate || a.warrantyExpiryDate;
        return exp && new Date(exp) > now && new Date(exp) <= in30Days;
      }).length,
      warrantiesExpiring60Days: appliances.filter((a) => {
        const exp = a.serviceAgreement?.endDate || a.extendedWarranty?.expiryDate || a.warrantyExpiryDate;
        return exp && new Date(exp) > now && new Date(exp) <= in60Days;
      }).length,
      warrantiesExpiring90Days: appliances.filter((a) => {
        const exp = a.serviceAgreement?.endDate || a.extendedWarranty?.expiryDate || a.warrantyExpiryDate;
        return exp && new Date(exp) > now && new Date(exp) <= in90Days;
      }).length,
      expiredWarrantiesCount: appliances.filter((a) => {
        const exp = a.serviceAgreement?.endDate || a.extendedWarranty?.expiryDate || a.warrantyExpiryDate;
        return exp && new Date(exp) < now;
      }).length,
    };

    return apiSuccess(res, { appliances, summary, currysContacts: CURRYS_OFFICIAL_CONTACTS });
  } catch (error) {
    return apiError(res, 'Failed to fetch appliances register', 500, error);
  }
};

/**
 * 2. Get Single Appliance by ID
 */
export const getApplianceById = async (req, res) => {
  try {
    const appliance = await Appliance.findOne({ _id: req.params.id, companyId: req.companyId })
      .populate('propertyId', 'name addressLine1 addressLine2 postcode city tenure')
      .populate('supplierReceiptId')
      .lean();

    if (!appliance) {
      return apiError(res, 'Appliance record not found', 404);
    }

    return apiSuccess(res, appliance);
  } catch (error) {
    return apiError(res, 'Failed to fetch appliance details', 500, error);
  }
};

/**
 * 3. Create Appliance
 */
export const createAppliance = async (req, res) => {
  try {
    const payload = { ...req.body, companyId: req.companyId };

    if (payload.propertyId) {
      const property = await Property.findOne({ _id: payload.propertyId, companyId: req.companyId });
      if (!property) {
        return apiError(res, 'Referenced property does not exist in the active company context', 400);
      }
      payload.propertyAssignmentStatus = payload.propertyAssignmentStatus || 'ASSIGNED';
      payload.isPropertyAssignedVerified = true;
    } else {
      payload.propertyAssignmentStatus = 'PENDING_VERIFICATION';
      payload.isPropertyAssignedVerified = false;
    }

    const appliance = await Appliance.create(payload);
    return apiSuccess(res, appliance, 'Appliance registered successfully', 201);
  } catch (error) {
    return apiError(res, error.message || 'Failed to create appliance record', 400, error);
  }
};

/**
 * 4. Update Appliance
 */
export const updateAppliance = async (req, res) => {
  try {
    const updateData = { ...req.body };
    delete updateData.companyId;

    if (updateData.propertyId) {
      const property = await Property.findOne({ _id: updateData.propertyId, companyId: req.companyId });
      if (!property) {
        return apiError(res, 'Referenced property does not belong to active company', 400);
      }
      updateData.propertyAssignmentStatus = 'ASSIGNED';
      updateData.isPropertyAssignedVerified = true;
    }

    const appliance = await Appliance.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      updateData,
      { new: true, runValidators: true }
    ).populate('propertyId', 'name addressLine1 postcode city');

    if (!appliance) {
      return apiError(res, 'Appliance record not found', 404);
    }

    return apiSuccess(res, appliance, 'Appliance record updated');
  } catch (error) {
    return apiError(res, error.message || 'Failed to update appliance record', 400, error);
  }
};

/**
 * 5. Verify & Assign Property to Appliance
 */
export const assignPropertyToAppliance = async (req, res) => {
  try {
    const { propertyId, notes } = req.body;
    if (!propertyId) {
      return apiError(res, 'Property ID is required to assign appliance', 400);
    }

    const property = await Property.findOne({ _id: propertyId, companyId: req.companyId });
    if (!property) {
      return apiError(res, 'Selected property does not belong to the active company', 400);
    }

    const appliance = await Appliance.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      {
        propertyId,
        propertyAssignmentStatus: 'ASSIGNED',
        isPropertyAssignedVerified: true,
        ...(notes ? { notes } : {}),
      },
      { new: true }
    ).populate('propertyId', 'name addressLine1 postcode city');

    if (!appliance) {
      return apiError(res, 'Appliance record not found', 404);
    }

    return apiSuccess(res, appliance, `Appliance assigned to property ${property.name} successfully`);
  } catch (error) {
    return apiError(res, error.message || 'Failed to assign property', 400, error);
  }
};

/**
 * 6. Delete Appliance
 */
export const deleteAppliance = async (req, res) => {
  try {
    const appliance = await Appliance.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
    if (!appliance) {
      return apiError(res, 'Appliance record not found', 404);
    }

    return apiSuccess(res, { deletedId: req.params.id }, 'Appliance deleted successfully');
  } catch (error) {
    return apiError(res, 'Failed to delete appliance', 500, error);
  }
};

/**
 * 7. Upload Appliance Document
 */
export const uploadApplianceDocument = async (req, res) => {
  try {
    if (!req.file) {
      return apiError(res, 'No file uploaded', 400);
    }

    const appliance = await Appliance.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!appliance) {
      return apiError(res, 'Appliance record not found', 404);
    }

    let fileUrl = '';
    if (isCloudinaryConfigured()) {
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: `${CLOUDINARY_FOLDER}/appliances`,
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
      const mime = req.file.mimetype || 'application/octet-stream';
      fileUrl = `data:${mime};base64,${req.file.buffer.toString('base64')}`;
    }

    const doc = {
      title: req.body.title || req.file.originalname,
      url: fileUrl,
      docType: req.body.docType || 'PURCHASE_RECEIPT',
      uploadedAt: new Date(),
    };

    appliance.documents.push(doc);
    await appliance.save();

    return apiSuccess(res, appliance, 'Document attached successfully', 201);
  } catch (error) {
    return apiError(res, error.message || 'Failed to upload document', 500, error);
  }
};

/**
 * 8. Delete Appliance Document
 */
export const deleteApplianceDocument = async (req, res) => {
  try {
    const { id, documentId } = req.params;
    const appliance = await Appliance.findOne({ _id: id, companyId: req.companyId });

    if (!appliance) {
      return apiError(res, 'Appliance record not found', 404);
    }

    appliance.documents = appliance.documents.filter((d) => d._id.toString() !== documentId);
    await appliance.save();

    return apiSuccess(res, appliance, 'Document removed successfully');
  } catch (error) {
    return apiError(res, 'Failed to delete document', 500, error);
  }
};

/**
 * 9. Supplier Receipts API (Currys, Howdens & Configurable Suppliers)
 */
export const getSupplierReceipts = async (req, res) => {
  try {
    await seedCurrysReceiptIfMissing(req.companyId);

    const receipts = await SupplierReceipt.find({ companyId: req.companyId })
      .sort({ receiptDate: -1 })
      .lean();

    // Populate covered appliances for each receipt
    const receiptsWithItems = await Promise.all(
      receipts.map(async (r) => {
        const linkedItems = await Appliance.find({
          companyId: req.companyId,
          supplierReceiptId: r._id,
        })
          .populate('propertyId', 'name')
          .select('name brand modelNumber purchasePrice careServicesChargeGBP propertyAssignmentStatus propertyId')
          .lean();

        return { ...r, linkedAppliances: linkedItems };
      })
    );

    return apiSuccess(res, receiptsWithItems);
  } catch (error) {
    return apiError(res, 'Failed to fetch supplier receipts', 500, error);
  }
};

export const createSupplierReceipt = async (req, res) => {
  try {
    const payload = {
      ...req.body,
      companyId: req.companyId,
      financialLedgerStatus: 'SOURCE_RECORD_ONLY', // Strict non-interference guard
    };

    const receipt = await SupplierReceipt.create(payload);
    return apiSuccess(res, receipt, 'Supplier receipt recorded successfully', 201);
  } catch (error) {
    return apiError(res, error.message || 'Failed to record receipt', 400, error);
  }
};

export const uploadReceiptDocument = async (req, res) => {
  try {
    if (!req.file) {
      return apiError(res, 'No file uploaded', 400);
    }

    const receipt = await SupplierReceipt.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!receipt) {
      return apiError(res, 'Supplier receipt not found', 404);
    }

    let fileUrl = '';
    if (isCloudinaryConfigured()) {
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: `${CLOUDINARY_FOLDER}/receipts`,
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
      const mime = req.file.mimetype || 'application/octet-stream';
      fileUrl = `data:${mime};base64,${req.file.buffer.toString('base64')}`;
    }

    const doc = {
      title: req.body.title || req.file.originalname,
      url: fileUrl,
      docType: req.body.docType || 'PURCHASE_RECEIPT',
      uploadedAt: new Date(),
    };

    receipt.documents.push(doc);
    await receipt.save();

    return apiSuccess(res, receipt, 'Receipt attachment saved', 201);
  } catch (error) {
    return apiError(res, error.message || 'Failed to attach receipt document', 500, error);
  }
};

/**
 * 10. Configurable Reminders (90, 60, 30 Days Expiry, Missing Docs, Unverified Properties, Valet Due)
 */
export const getApplianceReminders = async (req, res) => {
  try {
    const daysAhead = parseInt(req.query.days, 10) || 90;
    const now = new Date();
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() + daysAhead);

    const appliances = await Appliance.find({ companyId: req.companyId })
      .populate('propertyId', 'name postcode')
      .populate('supplierReceiptId', 'receiptNumber supplier')
      .lean();

    const reminders = [];

    appliances.forEach((a) => {
      const propLabel = a.propertyId?.name || 'Unassigned Property';

      // 1. Unconfirmed property location
      if (a.propertyAssignmentStatus === 'PENDING_VERIFICATION' || !a.propertyId) {
        reminders.push({
          category: 'UNCONFIRMED_LOCATION',
          severity: 'HIGH',
          title: `Property Location Pending: ${a.name}`,
          message: `Physical property assignment not yet confirmed for ${a.brand || ''} ${a.name}.`,
          applianceId: a._id,
          propertyId: a.propertyId?._id || null,
          dueDate: null,
        });
      }

      // 2. Missing receipt or contract documents
      if ((!a.documents || a.documents.length === 0) && !a.supplierReceiptId) {
        reminders.push({
          category: 'MISSING_DOCUMENTS',
          severity: 'MEDIUM',
          title: `Missing Purchase Document: ${a.name}`,
          message: `No purchase receipt, invoice, or warranty certificate attached for ${a.name} (${propLabel}).`,
          applianceId: a._id,
          propertyId: a.propertyId?._id || null,
          dueDate: null,
        });
      }

      // 3. Service Agreement / Care Plan expiring
      const serviceEnd = a.serviceAgreement?.endDate || a.currysCareAndRepair?.planEndDate;
      if (serviceEnd) {
        const endDt = new Date(serviceEnd);
        if (endDt > now && endDt <= thresholdDate) {
          const daysLeft = Math.ceil((endDt - now) / (1000 * 60 * 60 * 24));
          reminders.push({
            category: 'CONTRACT_EXPIRING',
            severity: daysLeft <= 30 ? 'URGENT' : daysLeft <= 60 ? 'HIGH' : 'MEDIUM',
            title: `Care Plan Expiring in ${daysLeft} days: ${a.name}`,
            message: `Service contract (${a.serviceAgreement?.provider || 'Currys'}) ends on ${endDt.toLocaleDateString('en-GB')}.`,
            applianceId: a._id,
            propertyId: a.propertyId?._id || null,
            dueDate: endDt,
          });
        } else if (endDt < now) {
          reminders.push({
            category: 'CONTRACT_EXPIRED',
            severity: 'HIGH',
            title: `Service Plan Expired: ${a.name}`,
            message: `Service contract expired on ${endDt.toLocaleDateString('en-GB')}. Renewal required.`,
            applianceId: a._id,
            propertyId: a.propertyId?._id || null,
            dueDate: endDt,
          });
        }
      }

      // 4. Annual Squeaky Clean Valet Due or Overdue
      if (['DUE', 'BOOKING_REQUIRED'].includes(a.squeakyCleanValet?.eligibilityStatus)) {
        reminders.push({
          category: 'VALET_DUE',
          severity: 'HIGH',
          title: `Annual Valet Due: ${a.name} (${propLabel})`,
          message: `Eligible for Currys Squeaky Clean Valet deep-clean service. Call 0344 800 6080 to book.`,
          applianceId: a._id,
          propertyId: a.propertyId?._id || null,
          dueDate: a.squeakyCleanValet?.nextValetDueDate || null,
        });
      }
    });

    return apiSuccess(res, { reminders, count: reminders.length, daysAhead });
  } catch (error) {
    return apiError(res, 'Failed to calculate reminders', 500, error);
  }
};

/**
 * 11. Currys Contacts Directory
 */
export const getCurrysContacts = async (req, res) => {
  return apiSuccess(res, CURRYS_OFFICIAL_CONTACTS);
};

/**
 * 12. Maintenance Action Tasks
 */
export const getMaintenanceTasks = async (req, res) => {
  try {
    let tasks = await MaintenanceTask.find({ companyId: req.companyId })
      .sort({ taskNumber: 1, createdAt: 1 })
      .lean();

    if (tasks.length === 0) {
      const initialTasks = DEFAULT_MAINTENANCE_TASKS.map((t) => ({
        ...t,
        companyId: req.companyId,
        assignedTo: '',
        status: 'PENDING',
      }));
      await MaintenanceTask.insertMany(initialTasks);
      tasks = await MaintenanceTask.find({ companyId: req.companyId })
        .sort({ taskNumber: 1, createdAt: 1 })
        .lean();
    }

    return apiSuccess(res, tasks);
  } catch (error) {
    return apiError(res, 'Failed to fetch maintenance tasks', 500, error);
  }
};

export const updateMaintenanceTask = async (req, res) => {
  try {
    const updateData = { ...req.body };
    delete updateData.companyId;

    if (updateData.status === 'COMPLETED' && !updateData.completedAt) {
      updateData.completedAt = new Date();
    } else if (updateData.status && updateData.status !== 'COMPLETED') {
      updateData.completedAt = null;
    }

    const task = await MaintenanceTask.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      updateData,
      { new: true, runValidators: true }
    );

    if (!task) {
      return apiError(res, 'Maintenance task not found', 404);
    }

    return apiSuccess(res, task, 'Maintenance task updated');
  } catch (error) {
    return apiError(res, error.message || 'Failed to update task', 400, error);
  }
};

export const createMaintenanceTask = async (req, res) => {
  try {
    const count = await MaintenanceTask.countDocuments({ companyId: req.companyId });
    const payload = {
      ...req.body,
      companyId: req.companyId,
      taskNumber: req.body.taskNumber || count + 1,
      assignedTo: req.body.assignedTo || '',
    };

    const task = await MaintenanceTask.create(payload);
    return apiSuccess(res, task, 'Maintenance task created', 201);
  } catch (error) {
    return apiError(res, error.message || 'Failed to create task', 400, error);
  }
};
