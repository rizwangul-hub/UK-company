import PropertyDocument, { DOCUMENT_CATEGORIES } from '../models/PropertyDocument.js';
import CouncilApplication from '../models/CouncilApplication.js';
import ComplianceNotification from '../models/ComplianceNotification.js';
import Property from '../models/Property.js';
import Appliance from '../models/Appliance.js';
import { apiSuccess, apiError } from '../utils/apiResponse.js';
import { cloudinary, isCloudinaryConfigured, CLOUDINARY_FOLDER } from '../config/cloudinary.js';
import { checkAndGenerateComplianceReminders } from '../services/complianceReminderService.js';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

/**
 * 1. Get All Documents for a Property (Includes Appliance Equipment docs)
 */
export const getPropertyDocuments = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { category, status, search } = req.query;

    const property = await Property.findOne({ _id: propertyId, companyId: req.companyId }).lean();
    if (!property) {
      return apiError(res, 'Property not found or does not belong to the active company', 404);
    }

    const filter = {
      companyId: req.companyId,
      propertyId,
      isActive: true,
    };

    if (category && category !== 'ALL') {
      filter.category = category;
    }

    if (status && status !== 'ALL') {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { provider: { $regex: search, $options: 'i' } },
        { referenceNumber: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } },
      ];
    }

    const documents = await PropertyDocument.find(filter)
      .sort({ expiryDate: 1, createdAt: -1 })
      .lean();

    // Link existing Appliance and Equipment documents naturally to prevent duplicate uploads
    let linkedApplianceDocs = [];
    if (!category || category === 'ALL' || category === 'APPLIANCE_EQUIPMENT') {
      const appliances = await Appliance.find({
        companyId: req.companyId,
        propertyId,
      }).lean();

      appliances.forEach((app) => {
        // Purchase invoices/receipts
        if (app.documents && app.documents.length > 0) {
          app.documents.forEach((d) => {
            linkedApplianceDocs.push({
              _id: `APPLIANCE_DOC_${app._id}_${d._id || d.title}`,
              isVirtualLink: true,
              linkedApplianceId: app._id,
              propertyId,
              companyId: req.companyId,
              category: 'APPLIANCE_EQUIPMENT',
              subCategory: app.applianceType || 'White Goods',
              title: `${app.name || app.brand || 'Appliance'} — ${d.title || 'Purchase Receipt'}`,
              provider: app.supplierName || 'Currys',
              referenceNumber: app.serialNumber || app.currysOrderReference || '',
              fileUrl: d.url,
              fileName: d.title || 'receipt.pdf',
              issueDate: app.purchaseDate || null,
              expiryDate: app.warrantyExpiryDate || null,
              status: app.warrantyStatus === 'EXPIRED' ? 'EXPIRED' : 'ACTIVE',
              notes: `Linked from Equipment Register (${app.brand || ''} ${app.model || ''})`,
              isMissing: false,
              version: 1,
              uploadedAt: d.uploadedAt || app.createdAt,
            });
          });
        }

        // Care & Repair Plan document
        if (app.careAndRepairPlan?.planDocumentUrl) {
          linkedApplianceDocs.push({
            _id: `CARE_PLAN_${app._id}`,
            isVirtualLink: true,
            linkedApplianceId: app._id,
            propertyId,
            companyId: req.companyId,
            category: 'APPLIANCE_EQUIPMENT',
            subCategory: 'Currys Care & Repair Agreement',
            title: `Currys Care & Repair Plan — ${app.name || app.brand}`,
            provider: 'Currys Care & Repair',
            referenceNumber: app.careAndRepairPlan.planReference || '',
            fileUrl: app.careAndRepairPlan.planDocumentUrl,
            fileName: app.careAndRepairPlan.planDocumentFilename || 'currys_care_agreement.pdf',
            issueDate: app.careAndRepairPlan.startDate || null,
            expiryDate: app.careAndRepairPlan.endDate || null,
            status: app.careAndRepairPlan.planStatus || 'ACTIVE',
            notes: `Covered appliance: ${app.name}. Includes Annual Squeaky Clean Valet.`,
            isMissing: false,
            version: 1,
            uploadedAt: app.careAndRepairPlan.verifiedAt || app.createdAt,
          });
        }
      });
    }

    return apiSuccess(res, {
      documents,
      linkedApplianceDocs,
      total: documents.length + linkedApplianceDocs.length,
      property: {
        _id: property._id,
        name: property.name,
        addressLine1: property.addressLine1,
        postcode: property.postcode,
      },
    });
  } catch (error) {
    return apiError(res, 'Failed to fetch property documents', 500, error);
  }
};

/**
 * 2. Upload Document or Record Missing Compliance Item
 */
export const createPropertyDocument = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const {
      category,
      subCategory,
      title,
      isMissing,
      issueDate,
      expiryDate,
      provider,
      referenceNumber,
      description,
      notes,
      epcRating,
    } = req.body;

    const property = await Property.findOne({ _id: propertyId, companyId: req.companyId });
    if (!property) {
      return apiError(res, 'Property not found or access denied for this company', 404);
    }

    if (!title || !category) {
      return apiError(res, 'Document title and category are required', 400);
    }

    const missingBool = String(isMissing) === 'true';
    let fileUrl = '';
    let fileName = '';
    let fileSize = 0;
    let mimeType = '';

    if (req.file) {
      fileName = req.file.originalname;
      fileSize = req.file.size;
      mimeType = req.file.mimetype;

      if (isCloudinaryConfigured()) {
        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: `${CLOUDINARY_FOLDER}/properties/${propertyId}/compliance`,
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
    } else if (!missingBool) {
      // If not marked missing, user may provide direct URL or empty for pending upload
      fileUrl = req.body.fileUrl || '';
    }

    const docStatus = missingBool
      ? 'MISSING'
      : expiryDate && new Date(expiryDate) < new Date()
      ? 'EXPIRED'
      : 'ACTIVE';

    const document = await PropertyDocument.create({
      companyId: req.companyId,
      propertyId,
      category,
      subCategory: subCategory || '',
      title,
      fileUrl,
      fileName,
      fileSize,
      mimeType,
      isMissing: missingBool,
      issueDate: issueDate ? new Date(issueDate) : null,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      provider: provider || '',
      referenceNumber: referenceNumber || '',
      description: description || '',
      notes: notes || '',
      status: docStatus,
      uploadedBy: req.user?.name || req.user?.email || 'Authorized User',
    });

    // Synchronize core statutory dates to Property model for backwards compatibility
    if (category === 'SAFETY_COMPLIANCE' && expiryDate) {
      const expD = new Date(expiryDate);
      const sub = (subCategory || title || '').toUpperCase();
      if (sub.includes('GAS') || sub.includes('CP12')) {
        property.compliance.gasSafetyExpiryDate = expD;
      } else if (sub.includes('EICR') || sub.includes('ELECTRIC')) {
        property.compliance.eicrExpiryDate = expD;
      } else if (sub.includes('EPC')) {
        property.compliance.epcExpiryDate = expD;
        if (epcRating) property.compliance.epcRating = epcRating;
      }
      await property.save();
    }

    return apiSuccess(res, document, 201, 'Document recorded successfully');
  } catch (error) {
    return apiError(res, error.message || 'Failed to create property document', 500, error);
  }
};

/**
 * 3. Update Document Metadata
 */
export const updatePropertyDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await PropertyDocument.findOne({ _id: id, companyId: req.companyId });
    if (!document) {
      return apiError(res, 'Document not found or access denied', 404);
    }

    const {
      title,
      category,
      subCategory,
      issueDate,
      expiryDate,
      provider,
      referenceNumber,
      description,
      notes,
      status,
      isMissing,
    } = req.body;

    if (title) document.title = title;
    if (category) document.category = category;
    if (subCategory !== undefined) document.subCategory = subCategory;
    if (provider !== undefined) document.provider = provider;
    if (referenceNumber !== undefined) document.referenceNumber = referenceNumber;
    if (description !== undefined) document.description = description;
    if (notes !== undefined) document.notes = notes;
    if (status) document.status = status;
    if (isMissing !== undefined) document.isMissing = Boolean(isMissing);

    if (issueDate !== undefined) {
      document.issueDate = issueDate ? new Date(issueDate) : null;
    }

    if (expiryDate !== undefined) {
      const newExp = expiryDate ? new Date(expiryDate) : null;
      // If expiry date has changed, reset reminder triggers for the new period
      if (
        (newExp && !document.expiryDate) ||
        (newExp && document.expiryDate && newExp.getTime() !== new Date(document.expiryDate).getTime())
      ) {
        document.remindersTriggered = [];
      }
      document.expiryDate = newExp;
    }

    await document.save();
    return apiSuccess(res, document, 200, 'Document updated successfully');
  } catch (error) {
    return apiError(res, error.message || 'Failed to update document', 500, error);
  }
};

/**
 * 4. Replace Document with New Version / Renewal Certificate (Preserves Version History)
 */
export const uploadDocumentVersion = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await PropertyDocument.findOne({ _id: id, companyId: req.companyId });
    if (!document) {
      return apiError(res, 'Document not found or access denied', 404);
    }

    // Archive current document into versionHistory
    document.versionHistory.push({
      version: document.version,
      fileUrl: document.fileUrl,
      fileName: document.fileName,
      fileSize: document.fileSize,
      mimeType: document.mimeType,
      issueDate: document.issueDate,
      expiryDate: document.expiryDate,
      provider: document.provider,
      referenceNumber: document.referenceNumber,
      archivedAt: new Date(),
      archivedBy: req.user?.name || req.user?.email || 'Authorized User',
      notes: req.body.archivedNotes || 'Superseded by renewed certificate',
    });

    let fileUrl = document.fileUrl;
    let fileName = document.fileName;
    let fileSize = document.fileSize;
    let mimeType = document.mimeType;

    if (req.file) {
      fileName = req.file.originalname;
      fileSize = req.file.size;
      mimeType = req.file.mimetype;

      if (isCloudinaryConfigured()) {
        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: `${CLOUDINARY_FOLDER}/properties/${document.propertyId}/compliance`,
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
    }

    document.version += 1;
    document.fileUrl = fileUrl;
    document.fileName = fileName;
    document.fileSize = fileSize;
    document.mimeType = mimeType;
    document.isMissing = false;
    document.status = 'ACTIVE';
    document.urgency = 'NORMAL';
    document.remindersTriggered = []; // reset reminders for new valid period
    document.uploadedAt = new Date();

    if (req.body.issueDate) document.issueDate = new Date(req.body.issueDate);
    if (req.body.expiryDate) document.expiryDate = new Date(req.body.expiryDate);
    if (req.body.provider) document.provider = req.body.provider;
    if (req.body.referenceNumber) document.referenceNumber = req.body.referenceNumber;
    if (req.body.notes) document.notes = req.body.notes;

    await document.save();

    // Dismiss existing notifications for this document
    await ComplianceNotification.updateMany(
      { companyId: req.companyId, documentId: document._id },
      { $set: { isDismissed: true, isRead: true } }
    );

    return apiSuccess(res, document, 200, `Document renewed to Version ${document.version}`);
  } catch (error) {
    return apiError(res, error.message || 'Failed to upload document version', 500, error);
  }
};

/**
 * 5. Secure Authenticated Document Download / Redirection
 */
export const downloadDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await PropertyDocument.findOne({ _id: id, companyId: req.companyId }).lean();
    if (!document) {
      return apiError(res, 'Document not found or does not belong to active company', 404);
    }

    if (!document.fileUrl) {
      return apiError(res, 'No file content attached to this document record', 404);
    }

    if (document.fileUrl.startsWith('data:')) {
      const parts = document.fileUrl.split(',');
      const mime = parts[0].split(':')[1].split(';')[0];
      const buffer = Buffer.from(parts[1], 'base64');
      res.setHeader('Content-Type', mime);
      res.setHeader('Content-Disposition', `inline; filename="${document.fileName || 'document.pdf'}"`);
      return res.send(buffer);
    }

    // Cloudinary or remote storage: redirect securely
    return res.redirect(document.fileUrl);
  } catch (error) {
    return apiError(res, 'Download failed', 500, error);
  }
};

/**
 * 6. Delete / Archive Document
 */
export const deletePropertyDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await PropertyDocument.findOne({ _id: id, companyId: req.companyId });
    if (!document) {
      return apiError(res, 'Document not found or access denied', 404);
    }

    document.isActive = false;
    document.status = 'ARCHIVED';
    await document.save();

    return apiSuccess(res, null, 200, 'Document archived successfully');
  } catch (error) {
    return apiError(res, 'Failed to archive document', 500, error);
  }
};

/**
 * 7. Get Council Applications for Property or Company
 */
export const getCouncilApplications = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const filter = { companyId: req.companyId, isActive: true };
    if (propertyId) filter.propertyId = propertyId;

    const applications = await CouncilApplication.find(filter)
      .populate('propertyId', 'name addressLine1 postcode')
      .sort({ responseDeadline: 1, createdAt: -1 })
      .lean();

    return apiSuccess(res, { applications, count: applications.length });
  } catch (error) {
    return apiError(res, 'Failed to fetch council applications', 500, error);
  }
};

/**
 * 8. Create Council Application
 */
export const createCouncilApplication = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const property = await Property.findOne({ _id: propertyId, companyId: req.companyId });
    if (!property) {
      return apiError(res, 'Property not found or does not belong to active company', 404);
    }

    const {
      applicationType,
      applicationReference,
      councilName,
      title,
      description,
      submissionDate,
      responseDeadline,
      priority,
      feePaid,
      notes,
    } = req.body;

    if (!title) {
      return apiError(res, 'Application title is required', 400);
    }

    const app = await CouncilApplication.create({
      companyId: req.companyId,
      propertyId,
      applicationType: applicationType || 'HMO_LICENCE',
      applicationReference: applicationReference || '',
      councilName: councilName || 'Local Authority Council',
      title,
      description: description || '',
      submissionDate: submissionDate ? new Date(submissionDate) : new Date(),
      responseDeadline: responseDeadline ? new Date(responseDeadline) : null,
      priority: priority || 'MEDIUM',
      feePaid: Number(feePaid) || 0,
      outcomeNotes: notes || '',
    });

    return apiSuccess(res, app, 201, 'Council application registered');
  } catch (error) {
    return apiError(res, error.message || 'Failed to register council application', 500, error);
  }
};

/**
 * 9. Update Council Application
 */
export const updateCouncilApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const app = await CouncilApplication.findOne({ _id: id, companyId: req.companyId });
    if (!app) {
      return apiError(res, 'Council application not found', 404);
    }

    const {
      status,
      responseDeadline,
      decisionDate,
      lastCommunicationDate,
      nextFollowUpDate,
      outcomeNotes,
      priority,
    } = req.body;

    if (status) app.status = status;
    if (priority) app.priority = priority;
    if (outcomeNotes !== undefined) app.outcomeNotes = outcomeNotes;
    if (responseDeadline !== undefined) app.responseDeadline = responseDeadline ? new Date(responseDeadline) : null;
    if (decisionDate !== undefined) app.decisionDate = decisionDate ? new Date(decisionDate) : null;
    if (lastCommunicationDate !== undefined) app.lastCommunicationDate = lastCommunicationDate ? new Date(lastCommunicationDate) : null;
    if (nextFollowUpDate !== undefined) app.nextFollowUpDate = nextFollowUpDate ? new Date(nextFollowUpDate) : null;

    await app.save();
    return apiSuccess(res, app, 200, 'Council application updated');
  } catch (error) {
    return apiError(res, 'Failed to update application', 500, error);
  }
};

/**
 * 10. Record Council Correspondence Log Item
 */
export const addCouncilCorrespondence = async (req, res) => {
  try {
    const { id } = req.params;
    const app = await CouncilApplication.findOne({ _id: id, companyId: req.companyId });
    if (!app) {
      return apiError(res, 'Council application not found', 404);
    }

    const { summary, type, senderOrRecipient, referenceNumber, date } = req.body;
    if (!summary) {
      return apiError(res, 'Correspondence summary is required', 400);
    }

    let fileUrl = '';
    let fileName = '';
    if (req.file) {
      fileName = req.file.originalname;
      const mime = req.file.mimetype;
      if (isCloudinaryConfigured()) {
        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: `${CLOUDINARY_FOLDER}/council_correspondence`,
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
        fileUrl = `data:${mime || 'application/octet-stream'};base64,${req.file.buffer.toString('base64')}`;
      }
    }

    app.correspondence.push({
      date: date ? new Date(date) : new Date(),
      type: type || 'NOTE',
      summary,
      senderOrRecipient: senderOrRecipient || '',
      referenceNumber: referenceNumber || '',
      fileUrl,
      fileName,
      recordedAt: new Date(),
    });

    app.lastCommunicationDate = date ? new Date(date) : new Date();
    await app.save();

    return apiSuccess(res, app, 201, 'Correspondence logged successfully');
  } catch (error) {
    return apiError(res, 'Failed to record correspondence', 500, error);
  }
};

/**
 * 11. Company-Wide Compliance Overview & Metrics
 */
export const getComplianceOverview = async (req, res) => {
  try {
    const now = new Date();
    const in45Days = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);
    const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    const [
      totalDocuments,
      expiredDocs,
      expiringIn45Days,
      expiringIn60Days,
      missingDocs,
      pendingCouncilApps,
      upcomingCouncilDeadlines,
      recentNotifications,
    ] = await Promise.all([
      PropertyDocument.countDocuments({ companyId: req.companyId, isActive: true, isMissing: false }),
      PropertyDocument.find({
        companyId: req.companyId,
        isActive: true,
        isMissing: false,
        expiryDate: { $lt: now, $ne: null },
      })
        .populate('propertyId', 'name addressLine1')
        .sort({ expiryDate: 1 })
        .lean(),
      PropertyDocument.find({
        companyId: req.companyId,
        isActive: true,
        isMissing: false,
        expiryDate: { $gte: now, $lte: in45Days },
      })
        .populate('propertyId', 'name addressLine1')
        .sort({ expiryDate: 1 })
        .lean(),
      PropertyDocument.find({
        companyId: req.companyId,
        isActive: true,
        isMissing: false,
        expiryDate: { $gte: now, $lte: in60Days },
      })
        .populate('propertyId', 'name addressLine1')
        .sort({ expiryDate: 1 })
        .lean(),
      PropertyDocument.find({
        companyId: req.companyId,
        isActive: true,
        isMissing: true,
      })
        .populate('propertyId', 'name addressLine1')
        .sort({ createdAt: -1 })
        .lean(),
      CouncilApplication.find({
        companyId: req.companyId,
        isActive: true,
        status: { $nin: ['COMPLETED', 'ARCHIVED', 'APPROVED', 'REJECTED'] },
      })
        .populate('propertyId', 'name addressLine1')
        .sort({ responseDeadline: 1 })
        .lean(),
      CouncilApplication.find({
        companyId: req.companyId,
        isActive: true,
        status: { $nin: ['COMPLETED', 'ARCHIVED', 'APPROVED', 'REJECTED'] },
        responseDeadline: { $lte: in45Days, $ne: null },
      })
        .populate('propertyId', 'name addressLine1')
        .sort({ responseDeadline: 1 })
        .lean(),
      ComplianceNotification.find({
        companyId: req.companyId,
        isDismissed: false,
      })
        .populate('propertyId', 'name')
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
    ]);

    const metrics = {
      totalDocuments,
      expiredCount: expiredDocs.length,
      expiring45Count: expiringIn45Days.length,
      expiring60Count: expiringIn60Days.length,
      missingCount: missingDocs.length,
      councilPendingCount: pendingCouncilApps.length,
      councilDeadlinesCount: upcomingCouncilDeadlines.length,
    };

    return apiSuccess(res, {
      metrics,
      expiredDocs,
      expiringIn45Days,
      expiringIn60Days,
      missingDocs,
      pendingCouncilApps,
      upcomingCouncilDeadlines,
      recentNotifications,
    });
  } catch (error) {
    return apiError(res, 'Failed to generate compliance overview', 500, error);
  }
};

/**
 * 12. In-App Notifications List & Read Toggles
 */
export const getNotifications = async (req, res) => {
  try {
    const notifications = await ComplianceNotification.find({
      companyId: req.companyId,
      isDismissed: false,
    })
      .populate('propertyId', 'name')
      .populate('documentId', 'title category')
      .populate('councilApplicationId', 'title councilName')
      .sort({ isRead: 1, createdAt: -1 })
      .limit(50)
      .lean();

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return apiSuccess(res, { notifications, unreadCount });
  } catch (error) {
    return apiError(res, 'Failed to fetch notifications', 500, error);
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    await ComplianceNotification.updateOne({ _id: id, companyId: req.companyId }, { $set: { isRead: true } });
    return apiSuccess(res, null, 200, 'Notification marked as read');
  } catch (error) {
    return apiError(res, 'Failed to update notification', 500, error);
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    await ComplianceNotification.updateMany({ companyId: req.companyId }, { $set: { isRead: true } });
    return apiSuccess(res, null, 200, 'All notifications marked as read');
  } catch (error) {
    return apiError(res, 'Failed to update notifications', 500, error);
  }
};

/**
 * 13. Idempotent Scheduled Reminder Check Trigger
 */
export const runRemindersCheck = async (req, res) => {
  try {
    const result = await checkAndGenerateComplianceReminders(req.companyId);
    return apiSuccess(res, result, 200, 'Compliance reminders evaluated successfully');
  } catch (error) {
    return apiError(res, 'Failed to run reminders check', 500, error);
  }
};

/**
 * 14. Export Compliance Register & Expiry Report (Excel & PDF)
 */
export const exportComplianceReport = async (req, res) => {
  try {
    const format = (req.query.format || 'excel').toLowerCase();
    const documents = await PropertyDocument.find({
      companyId: req.companyId,
      isActive: true,
    })
      .populate('propertyId', 'name addressLine1 postcode')
      .sort({ propertyId: 1, category: 1, expiryDate: 1 })
      .lean();

    const councilApps = await CouncilApplication.find({
      companyId: req.companyId,
      isActive: true,
    })
      .populate('propertyId', 'name')
      .sort({ responseDeadline: 1 })
      .lean();

    const companyName = req.company?.name || 'UK Portfolio';

    if (format === 'excel' || format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'PIXX Technologies UK Compliance Engine';

      const sheet1 = workbook.addWorksheet('Compliance & Documents');
      sheet1.columns = [
        { header: 'Property', key: 'property', width: 25 },
        { header: 'Category', key: 'category', width: 22 },
        { header: 'Document Title', key: 'title', width: 32 },
        { header: 'Status', key: 'status', width: 16 },
        { header: 'Provider / Authority', key: 'provider', width: 24 },
        { header: 'Reference No', key: 'ref', width: 20 },
        { header: 'Issue Date', key: 'issueDate', width: 14 },
        { header: 'Expiry Date', key: 'expiryDate', width: 14 },
        { header: 'Version', key: 'version', width: 10 },
        { header: 'Missing Document?', key: 'missing', width: 18 },
        { header: 'Notes', key: 'notes', width: 30 },
      ];

      documents.forEach((d) => {
        sheet1.addRow({
          property: d.propertyId?.name || 'Property',
          category: d.category,
          title: d.title,
          status: d.status,
          provider: d.provider || '-',
          ref: d.referenceNumber || '-',
          issueDate: d.issueDate ? new Date(d.issueDate).toLocaleDateString('en-GB') : '-',
          expiryDate: d.expiryDate ? new Date(d.expiryDate).toLocaleDateString('en-GB') : 'No Expiry',
          version: `v${d.version}`,
          missing: d.isMissing ? 'YES - ACTION REQUIRED' : 'No',
          notes: d.notes || '',
        });
      });

      const sheet2 = workbook.addWorksheet('Council & Licensing');
      sheet2.columns = [
        { header: 'Property', key: 'property', width: 25 },
        { header: 'Application Type', key: 'type', width: 22 },
        { header: 'Title / HMO Ref', key: 'title', width: 28 },
        { header: 'Council Authority', key: 'council', width: 25 },
        { header: 'Status', key: 'status', width: 18 },
        { header: 'Submission Date', key: 'submitted', width: 15 },
        { header: 'Response Deadline', key: 'deadline', width: 18 },
        { header: 'Next Follow-up', key: 'followup', width: 16 },
        { header: 'Fee Paid (£)', key: 'fee', width: 14 },
      ];

      councilApps.forEach((c) => {
        sheet2.addRow({
          property: c.propertyId?.name || 'Property',
          type: c.applicationType,
          title: c.title,
          council: c.councilName,
          status: c.status,
          submitted: c.submissionDate ? new Date(c.submissionDate).toLocaleDateString('en-GB') : '-',
          deadline: c.responseDeadline ? new Date(c.responseDeadline).toLocaleDateString('en-GB') : '-',
          followup: c.nextFollowUpDate ? new Date(c.nextFollowUpDate).toLocaleDateString('en-GB') : '-',
          fee: c.feePaid ? `£${c.feePaid.toFixed(2)}` : '£0.00',
        });
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${req.companyId}_Compliance_Register_${new Date().toISOString().slice(0, 10)}.xlsx"`
      );
      await workbook.xlsx.write(res);
      return res.end();
    }

    // PDF Format
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${req.companyId}_Compliance_Audit_${new Date().toISOString().slice(0, 10)}.pdf"`
    );

    doc.pipe(res);

    doc.fontSize(16).font('Helvetica-Bold').text(`${companyName} — Property Compliance & Expiry Register`);
    doc.fontSize(9).font('Helvetica').text(`Generated: ${new Date().toLocaleDateString('en-GB')} | Scope: Six-Company Isolation Protected`);
    doc.moveDown();

    doc.fontSize(11).font('Helvetica-Bold').text('Statutory & Property Documents Summary', { underline: true });
    doc.moveDown(0.5);

    documents.slice(0, 40).forEach((d) => {
      const expStr = d.expiryDate ? new Date(d.expiryDate).toLocaleDateString('en-GB') : 'No Expiry';
      const statusColor = d.status === 'EXPIRED' ? 'red' : d.isMissing ? 'orange' : 'black';
      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .fillColor(statusColor)
        .text(`[${d.category}] ${d.title} (${d.propertyId?.name || 'Property'}) — Status: ${d.status}`)
        .font('Helvetica')
        .fillColor('black')
        .text(`  Provider: ${d.provider || 'N/A'} | Ref: ${d.referenceNumber || 'N/A'} | Expiry: ${expStr} | Version: v${d.version}`);
      doc.moveDown(0.3);
    });

    doc.end();
  } catch (error) {
    return apiError(res, 'Failed to export compliance report', 500, error);
  }
};
