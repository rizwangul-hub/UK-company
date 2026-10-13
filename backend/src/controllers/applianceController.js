import Appliance, { OFFICIAL_VALET_CHECKLISTS } from '../models/Appliance.js';
import MaintenanceTask, { KHURSHID_DEFAULT_TASKS } from '../models/MaintenanceTask.js';
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
 * 1. Get All Appliances for the active company
 */
export const getAppliances = async (req, res) => {
  try {
    const { propertyId, applianceType, supplier, hasPlan, valetStatus, search } = req.query;
    const filter = { companyId: req.companyId };

    if (propertyId) {
      filter.propertyId = propertyId;
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
        { 'currysCareAndRepair.planReferenceNumber': { $regex: search, $options: 'i' } },
      ];
    }

    const appliances = await Appliance.find(filter)
      .populate('propertyId', 'name addressLine1 postcode city')
      .sort({ createdAt: -1 })
      .lean();

    // Calculate aggregated metrics
    const now = new Date();
    const in30Days = new Date();
    in30Days.setDate(in30Days.getDate() + 30);
    const in60Days = new Date();
    in60Days.setDate(in60Days.getDate() + 60);
    const in90Days = new Date();
    in90Days.setDate(in90Days.getDate() + 90);

    const summary = {
      totalAppliances: appliances.length,
      currysAppliancesCount: appliances.filter((a) => (a.supplier || '').toLowerCase().includes('curry')).length,
      careAndRepairPlanCount: appliances.filter((a) => a.currysCareAndRepair?.hasPlan).length,
      valetDueCount: appliances.filter((a) => ['DUE', 'BOOKING_REQUIRED'].includes(a.squeakyCleanValet?.eligibilityStatus)).length,
      valetBookedCount: appliances.filter((a) => a.squeakyCleanValet?.eligibilityStatus === 'BOOKED').length,
      valetCompletedCount: appliances.filter((a) => a.squeakyCleanValet?.eligibilityStatus === 'COMPLETED').length,
      missingReceiptsCount: appliances.filter((a) => !a.documents || a.documents.length === 0).length,
      unverifiedPropertyCount: appliances.filter((a) => !a.isPropertyAssignedVerified).length,
      unverifiedWarrantiesCount: appliances.filter((a) => !a.isWarrantyVerified).length,
      warrantiesExpiring30Days: appliances.filter((a) => a.warrantyExpiryDate && new Date(a.warrantyExpiryDate) > now && new Date(a.warrantyExpiryDate) <= in30Days).length,
      warrantiesExpiring60Days: appliances.filter((a) => a.warrantyExpiryDate && new Date(a.warrantyExpiryDate) > now && new Date(a.warrantyExpiryDate) <= in60Days).length,
      warrantiesExpiring90Days: appliances.filter((a) => a.warrantyExpiryDate && new Date(a.warrantyExpiryDate) > now && new Date(a.warrantyExpiryDate) <= in90Days).length,
      expiredWarrantiesCount: appliances.filter((a) => a.warrantyExpiryDate && new Date(a.warrantyExpiryDate) < now).length,
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
 * 3. Create New Appliance Record
 */
export const createAppliance = async (req, res) => {
  try {
    const { propertyId, name, applianceType } = req.body;

    if (!propertyId || !name || !applianceType) {
      return apiError(res, 'Property ID, appliance name, and appliance type are required', 400);
    }

    // Validate that property belongs to active company
    const prop = await Property.findOne({ _id: propertyId, companyId: req.companyId });
    if (!prop) {
      return apiError(res, 'Target property does not belong to active company', 400);
    }

    const payload = {
      ...req.body,
      companyId: req.companyId,
    };

    // If checklist was not supplied, pre-fill from OFFICIAL_VALET_CHECKLISTS
    if (!payload.squeakyCleanValet?.completedChecklist && OFFICIAL_VALET_CHECKLISTS[applianceType]) {
      if (!payload.squeakyCleanValet) payload.squeakyCleanValet = {};
      payload.squeakyCleanValet.completedChecklist = OFFICIAL_VALET_CHECKLISTS[applianceType].map((item) => ({
        taskKey: item.taskKey,
        taskDescription: item.taskDescription,
        isCompleted: false,
        completedAt: null,
      }));
    }

    const appliance = await Appliance.create(payload);
    return apiSuccess(res, appliance, 'Appliance record created successfully', 201);
  } catch (error) {
    return apiError(res, error.message || 'Failed to create appliance record', 400, error);
  }
};

/**
 * 4. Update Appliance Record
 */
export const updateAppliance = async (req, res) => {
  try {
    const updateData = { ...req.body };
    delete updateData.companyId; // Strictly prohibit reassigning companyId

    if (updateData.propertyId) {
      const prop = await Property.findOne({ _id: updateData.propertyId, companyId: req.companyId });
      if (!prop) {
        return apiError(res, 'Target property does not belong to active company', 400);
      }
    }

    const appliance = await Appliance.findOneAndUpdate(
      { _id: req.params.id, companyId: req.companyId },
      updateData,
      { new: true, runValidators: true }
    ).populate('propertyId', 'name addressLine1 postcode city');

    if (!appliance) {
      return apiError(res, 'Appliance record not found', 404);
    }

    return apiSuccess(res, appliance, 'Appliance updated successfully');
  } catch (error) {
    return apiError(res, error.message || 'Failed to update appliance record', 400, error);
  }
};

/**
 * 5. Delete Appliance Record
 */
export const deleteAppliance = async (req, res) => {
  try {
    const appliance = await Appliance.findOneAndDelete({
      _id: req.params.id,
      companyId: req.companyId,
    });

    if (!appliance) {
      return apiError(res, 'Appliance record not found', 404);
    }

    return apiSuccess(res, { deletedId: appliance._id }, 'Appliance deleted successfully');
  } catch (error) {
    return apiError(res, 'Failed to delete appliance', 500, error);
  }
};

/**
 * 6. Upload Receipt or Supporting Document to Appliance
 */
export const uploadApplianceDocument = async (req, res) => {
  try {
    const appliance = await Appliance.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!appliance) {
      return apiError(res, 'Appliance not found', 404);
    }

    let fileUrl = '';
    const title = req.body.title || req.file?.originalname || 'Appliance Document';
    const docType = req.body.docType || 'PURCHASE_RECEIPT';

    if (req.file) {
      if (isCloudinaryConfigured()) {
        try {
          const uploadRes = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              {
                folder: `${CLOUDINARY_FOLDER}/appliances/${req.companyId}`,
                resource_type: 'auto',
              },
              (err, result) => {
                if (err) reject(err);
                else resolve(result);
              }
            );
            stream.end(req.file.buffer);
          });
          fileUrl = uploadRes.secure_url;
        } catch (cloudErr) {
          console.warn('[Cloudinary Upload Notice]: Using base64 fallback:', cloudErr.message);
          const mime = req.file.mimetype || 'application/octet-stream';
          fileUrl = `data:${mime};base64,${req.file.buffer.toString('base64')}`;
        }
      } else {
        const mime = req.file.mimetype || 'application/octet-stream';
        fileUrl = `data:${mime};base64,${req.file.buffer.toString('base64')}`;
      }
    } else if (req.body.url) {
      fileUrl = req.body.url;
    } else {
      return apiError(res, 'No file or document URL provided', 400);
    }

    appliance.documents.push({
      title,
      url: fileUrl,
      docType,
      uploadedAt: new Date(),
    });

    await appliance.save();

    return apiSuccess(res, appliance, 'Document attached successfully');
  } catch (error) {
    return apiError(res, error.message || 'Failed to upload document', 500, error);
  }
};

/**
 * 7. Delete Appliance Document
 */
export const deleteApplianceDocument = async (req, res) => {
  try {
    const appliance = await Appliance.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!appliance) {
      return apiError(res, 'Appliance not found', 404);
    }

    appliance.documents = appliance.documents.filter(
      (doc) => doc._id.toString() !== req.params.documentId
    );

    await appliance.save();
    return apiSuccess(res, appliance, 'Document removed successfully');
  } catch (error) {
    return apiError(res, 'Failed to remove document', 500, error);
  }
};

/**
 * 8. Get Currys Contacts Directory
 */
export const getCurrysContacts = async (req, res) => {
  return apiSuccess(res, CURRYS_OFFICIAL_CONTACTS);
};

/**
 * 9. Khurshid's Action Checklist & Maintenance Tasks
 */
export const getMaintenanceTasks = async (req, res) => {
  try {
    let tasks = await MaintenanceTask.find({ companyId: req.companyId })
      .sort({ taskNumber: 1, createdAt: 1 })
      .lean();

    // Auto-seed Khurshid's default 8 tasks if company has none
    if (tasks.length === 0) {
      const initialTasks = KHURSHID_DEFAULT_TASKS.map((t) => ({
        ...t,
        companyId: req.companyId,
        assignedTo: 'Khurshid',
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

/**
 * 10. Update Maintenance Task Status & Details
 */
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

/**
 * 11. Create Custom Maintenance Task
 */
export const createMaintenanceTask = async (req, res) => {
  try {
    const count = await MaintenanceTask.countDocuments({ companyId: req.companyId });
    const payload = {
      ...req.body,
      companyId: req.companyId,
      taskNumber: req.body.taskNumber || count + 1,
      assignedTo: req.body.assignedTo || 'Khurshid',
    };

    const task = await MaintenanceTask.create(payload);
    return apiSuccess(res, task, 'Maintenance task created', 201);
  } catch (error) {
    return apiError(res, error.message || 'Failed to create task', 400, error);
  }
};
