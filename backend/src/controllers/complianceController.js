import PropertyDocument, { DOCUMENT_CATEGORIES } from '../models/PropertyDocument.js';
import CouncilApplication from '../models/CouncilApplication.js';
import ComplianceNotification from '../models/ComplianceNotification.js';
import Property from '../models/Property.js';
import Appliance from '../models/Appliance.js';
import { apiSuccess, apiError } from '../utils/apiResponse.js';
import cloudinary, { isCloudinaryConfigured, CLOUDINARY_FOLDER } from '../config/cloudinary.js';
import { checkAndGenerateComplianceReminders } from '../services/complianceReminderService.js';
import EmailNotificationConfig from '../models/EmailNotificationConfig.js';
import User from '../models/User.js';
import { sendTestEmail } from '../services/emailService.js';
import { evaluateAndSendExpiryEmails } from '../services/documentExpiryEmailEngine.js';
import ExcelJS from 'exceljs';
import { configureReportSheet, renderReportPdf, styleReportBand, styleReportRows, styleStatusCell } from '../services/reportPresentation.js';
import { formatGBP, formatUKDate, getCompanyLogoPath } from '../services/reportExportService.js';

/**
 * 1. Get All Documents for a Property (Includes Appliance Equipment docs)
 */
export const getPropertyDocuments = async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { category, status, search } = req.query;

    let property = await Property.findOne({ _id: propertyId, companyId: req.companyId }).lean();
    let targetUnit = null;

    if (!property) {
      targetUnit = await Unit.findOne({ _id: propertyId, companyId: req.companyId }).lean();
      if (targetUnit) {
        property = await Property.findOne({ _id: targetUnit.propertyId, companyId: req.companyId }).lean();
      }
    }

    if (!property) {
      return apiError(res, 'Property not found or does not belong to the active company', 404);
    }

    const filter = {
      companyId: req.companyId,
      isActive: true,
      ...(targetUnit
        ? { $or: [{ unitId: targetUnit._id }, { propertyId: property._id }] }
        : { propertyId: property._id }),
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

    let property = await Property.findOne({ _id: propertyId, companyId: req.companyId });
    let targetUnit = null;
    if (!property) {
      targetUnit = await Unit.findOne({ _id: propertyId, companyId: req.companyId });
      if (targetUnit) {
        property = await Property.findOne({ _id: targetUnit.propertyId, companyId: req.companyId });
      }
    }
    if (!property) {
      return apiError(res, 'Property not found or access denied for this company', 404);
    }

    if (!title || !category) {
      return apiError(res, 'Document title and category are required', 400);
    }

    const missingBool = String(isMissing) === 'true';
    let fileUrl = '';
    let cloudinaryAssetId = '';
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
        cloudinaryAssetId = uploadResult.asset_id || '';
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
      propertyId: property._id,
      ...(targetUnit ? { unitId: targetUnit._id } : {}),
      category,
      subCategory: subCategory || '',
      title,
      fileUrl,
      cloudinaryAssetId,
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

    return apiSuccess(res, document, 'Document recorded successfully', 201);
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
    return apiSuccess(res, document, 'Document updated successfully', 200);
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
      cloudinaryAssetId: document.cloudinaryAssetId,
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
    let cloudinaryAssetId = document.cloudinaryAssetId;
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
        cloudinaryAssetId = uploadResult.asset_id || '';
      } else {
        fileUrl = `data:${mimeType || 'application/octet-stream'};base64,${req.file.buffer.toString('base64')}`;
      }
    }

    document.version += 1;
    document.fileUrl = fileUrl;
    document.cloudinaryAssetId = cloudinaryAssetId;
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

    return apiSuccess(res, document, `Document renewed to Version ${document.version}`, 200);
  } catch (error) {
    return apiError(res, error.message || 'Failed to upload document version', 500, error);
  }
};

/**
 * Download a Cloudinary asset through its authenticated API.
 */
const sendDocumentFile = async (res, { assetId, fileUrl, fileName, mimeType }) => {
  if (fileUrl?.startsWith('data:')) {
    const [metadata, encoded] = fileUrl.split(',');
    if (!metadata || !encoded) {
      return apiError(res, 'Stored document data is invalid', 500);
    }
    const contentType = metadata.slice(5).split(';')[0] || mimeType || 'application/octet-stream';
    const buffer = Buffer.from(encoded, 'base64');
    res.setHeader('Content-Type', contentType);
    const safeFileName = String(fileName || 'document').replace(/[^\x20-\x7e]|["\\]/g, '_');
    res.setHeader('Content-Disposition', `inline; filename="${safeFileName}"`);
    return res.send(buffer);
  }

  if (assetId) {
    if (!isCloudinaryConfigured()) {
      return apiError(res, 'Cloudinary is not configured for secure document delivery', 503);
    }

    const cloudName = cloudinary.config().cloud_name;
    const timestamp = Math.floor(Date.now() / 1000);
    const safeFileName = String(fileName || 'document').replace(/[^\x20-\x7e]|["\\]/g, '_');
    const params = {
      asset_id: assetId,
      attachment: false,
      target_filename: safeFileName,
      timestamp,
    };
    const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET);
    const downloadUrl = new URL(`https://api.cloudinary.com/v1_1/${cloudName}/asset/download`);
    Object.entries({ ...params, api_key: process.env.CLOUDINARY_API_KEY, signature }).forEach(([key, value]) => {
      downloadUrl.searchParams.set(key, String(value));
    });

    const cloudinaryResponse = await fetch(downloadUrl);
    if (!cloudinaryResponse.ok) {
      const errorBody = await cloudinaryResponse.text();
      console.error('[Cloudinary document download error]:', cloudinaryResponse.status, errorBody);
      return apiError(res, 'Cloudinary could not provide this document. Check the Cloudinary API logs and account permissions.', 502);
    }

    const buffer = Buffer.from(await cloudinaryResponse.arrayBuffer());
    res.setHeader('Content-Type', mimeType || cloudinaryResponse.headers.get('content-type') || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${safeFileName}"`);
    return res.send(buffer);
  }

  if (fileUrl && /^https?:\/\//i.test(fileUrl)) {
    return res.redirect(fileUrl);
  }

  return apiError(res, 'No downloadable file is attached to this document', 404);
};

const getCloudinaryAssetId = async (fileUrl) => {
  if (!isCloudinaryConfigured() || !fileUrl) return '';

  const url = new URL(fileUrl);
  const cloudName = cloudinary.config().cloud_name;
  const segments = url.pathname.split('/').filter(Boolean);
  if (
    url.hostname !== 'res.cloudinary.com' ||
    segments[0] !== cloudName ||
    !['image', 'video', 'raw'].includes(segments[1]) ||
    segments[2] !== 'upload'
  ) {
    return '';
  }

  const versionIndex = segments.findIndex((segment, index) => index > 2 && /^v\d+$/.test(segment));
  if (versionIndex < 0 || versionIndex === segments.length - 1) return '';

  const resourceType = segments[1];
  const publicIdParts = segments.slice(versionIndex + 1);
  if (resourceType !== 'raw') {
    publicIdParts[publicIdParts.length - 1] = publicIdParts[publicIdParts.length - 1].replace(/\.[^.]+$/, '');
  }

  const resource = await cloudinary.api.resource(publicIdParts.join('/'), {
    resource_type: resourceType,
    type: 'upload',
  });
  return resource.asset_id || '';
};

/**
 * Secure, company-scoped document download.
 */
export const downloadDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const document = await PropertyDocument.findOne({ _id: id, companyId: req.companyId }).lean();
    if (!document) {
      return apiError(res, 'Document not found or does not belong to active company', 404);
    }

    const assetId = document.cloudinaryAssetId || await getCloudinaryAssetId(document.fileUrl);
    if (assetId && !document.cloudinaryAssetId) {
      await PropertyDocument.updateOne(
        { _id: document._id, companyId: req.companyId },
        { $set: { cloudinaryAssetId: assetId } }
      );
    }
    return await sendDocumentFile(res, {
      assetId,
      fileUrl: document.fileUrl,
      fileName: document.fileName,
      mimeType: document.mimeType,
    });
  } catch (error) {
    console.error('[Property document download error]:', error);
    return apiError(res, 'Document download failed', 502);
  }
};

export const downloadDocumentVersion = async (req, res) => {
  try {
    const { id, versionIndex } = req.params;
    const document = await PropertyDocument.findOne({ _id: id, companyId: req.companyId }).lean();
    if (!document) {
      return apiError(res, 'Document not found or does not belong to active company', 404);
    }

    const version = document.versionHistory?.[Number(versionIndex)];
    if (!version) {
      return apiError(res, 'Document version not found', 404);
    }

    const assetId = version.cloudinaryAssetId || await getCloudinaryAssetId(version.fileUrl);
    if (assetId && !version.cloudinaryAssetId) {
      await PropertyDocument.updateOne(
        { _id: document._id, companyId: req.companyId },
        { $set: { [`versionHistory.${Number(versionIndex)}.cloudinaryAssetId`]: assetId } }
      );
    }
    return await sendDocumentFile(res, {
      assetId,
      fileUrl: version.fileUrl,
      fileName: version.fileName,
      mimeType: version.mimeType,
    });
  } catch (error) {
    console.error('[Property document version download error]:', error);
    return apiError(res, 'Document version download failed', 502);
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

    return apiSuccess(res, null, 'Document archived successfully', 200);
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

    return apiSuccess(res, app, 'Council application registered', 201);
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
    return apiSuccess(res, app, 'Council application updated', 200);
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

    return apiSuccess(res, app, 'Correspondence logged successfully', 201);
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
    return apiSuccess(res, null, 'Notification marked as read', 200);
  } catch (error) {
    return apiError(res, 'Failed to update notification', 500, error);
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    await ComplianceNotification.updateMany({ companyId: req.companyId }, { $set: { isRead: true } });
    return apiSuccess(res, null, 'All notifications marked as read', 200);
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
    return apiSuccess(res, result, 'Compliance reminders evaluated successfully', 200);
  } catch (error) {
    return apiError(res, 'Failed to run reminders check', 500, error);
  }
};

/**
 * 14. Export Compliance Register & Expiry Report (Excel & PDF)
 */
const statusLabel = status => status ? String(status).replaceAll('_', ' ').toLowerCase().replace(/^./, letter => letter.toUpperCase()) : '-';
const statusTone = status => {
  if (/expired|overdue|rejected/i.test(status)) return 'red';
  if (/missing|expiring|pending|due soon/i.test(status)) return 'amber';
  if (/valid|approved|complete/i.test(status)) return 'green';
  return undefined;
};

export const exportComplianceReport = async (req, res) => {
  try {
    const format = String(req.query.format || 'excel').toLowerCase();
    if (!['excel', 'xlsx', 'pdf'].includes(format)) {
      return apiError(res, 'Choose PDF or Excel for the compliance report.', 400);
    }
    const [documents, councilApps] = await Promise.all([
      PropertyDocument.find({ companyId: req.companyId, isActive: true })
        .populate('propertyId', 'name addressLine1 postcode')
        .sort({ propertyId: 1, category: 1, expiryDate: 1 }).lean(),
      CouncilApplication.find({ companyId: req.companyId, isActive: true })
        .populate('propertyId', 'name').sort({ responseDeadline: 1 }).lean(),
    ]);

    const company = req.company?.legalName || req.company?.name || 'UK Portfolio';
    const generatedAt = new Date();
    const date = generatedAt.toISOString().slice(0, 10);
    const documentRows = documents.map(d => [
      d.propertyId?.name || 'Property', d.category, d.title, d.isMissing ? 'Missing document' : statusLabel(d.status),
      d.provider || '-', d.referenceNumber || '-', formatUKDate(d.issueDate),
      d.expiryDate ? formatUKDate(d.expiryDate) : 'No expiry', `v${d.version}`, d.notes || '',
    ]);
    const councilRows = councilApps.map(c => [
      c.propertyId?.name || 'Property', c.applicationType, c.title, c.councilName,
      statusLabel(c.status), formatUKDate(c.submissionDate), formatUKDate(c.responseDeadline),
      formatUKDate(c.nextFollowUpDate), Number(c.feePaid) || 0,
    ]);
    const missing = documents.filter(d => d.isMissing).length;
    const expired = documents.filter(d => !d.isMissing && d.status === 'EXPIRED').length;
    const title = 'Property compliance register';
    let buffer;
    if (format === 'pdf') {
      buffer = await renderReportPdf({
        title,
        sections: [{
          title, company, logo: getCompanyLogoPath(req.companyId),
          details: [`Generated: ${formatUKDate(generatedAt)}`],
          metrics: [
            { label: 'Property documents', value: documents.length, tone: 'blue' },
            { label: 'Missing documents', value: missing, tone: 'amber' },
            { label: 'Expired documents', value: expired, tone: 'red' },
            { label: 'Council applications', value: councilApps.length, tone: 'teal' },
          ],
          tables: [
            {
              heading: 'Property documents',
              columns: [
                { label: 'Property', width: 135 }, { label: 'Document', width: 177 },
                { label: 'Status', width: 89, tone: value => statusTone(value) || 'ink' },
                { label: 'Provider / reference', width: 145 }, { label: 'Issued', width: 69 },
                { label: 'Expires', width: 70 }, { label: 'Version', width: 53 },
                { label: 'Notes', width: 125 },
              ],
              rows: documentRows.map(([property, category, name, status, provider, ref, issued, expiry, version, notes]) => [
                property, [category, name].filter(Boolean).join(' / '), status,
                [provider, ref].filter(value => value !== '-').join(' / '),
                issued, expiry, version, notes,
              ]),
              empty: 'No active property documents are recorded.',
            },
            {
              heading: 'Council applications and licensing',
              columns: [
                { label: 'Property', width: 130 }, { label: 'Application', width: 165 }, { label: 'Council', width: 107 },
                { label: 'Status', width: 84, tone: value => statusTone(value) || 'ink' },
                { label: 'Submitted', width: 75 }, { label: 'Deadline', width: 75 }, { label: 'Follow-up', width: 75 },
                { label: 'Fee paid', width: 81, align: 'right' },
              ],
              rows: councilRows.map(([property, type, name, council, status, submitted, deadline, followup, fee]) => [
                property, [type, name].filter(Boolean).join(' / '), council, status, submitted, deadline, followup, formatGBP(fee),
              ]),
              empty: 'No active council or licensing applications are recorded.',
            },
          ],
        }],
      });
    } else {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'PIXX Property';
      const addRegister = (name, headers, widths, rows, statusColumn, currencyColumns) => {
        const sheet = workbook.addWorksheet(name);
        sheet.columns = widths.map(width => ({ width }));
        sheet.mergeCells(1, 1, 1, headers.length);
        sheet.getCell('A1').value = `${company} | ${name}`;
        sheet.mergeCells(2, 1, 2, headers.length);
        sheet.getCell('A2').value = `Generated ${formatUKDate(generatedAt)} | ${rows.length} records`;
        sheet.addRow(headers);
        for (const values of rows) sheet.addRow(values);
        styleReportBand(sheet, 1, 'title');
        styleReportBand(sheet, 3, 'header');
        styleReportRows(sheet, 4, 3 + rows.length, { currencyColumns });
        rows.forEach((values, i) => styleStatusCell(sheet.getCell(i + 4, statusColumn), statusTone(values[statusColumn - 1])));
        configureReportSheet(sheet, { freezeRows: 3, headerRow: 3, lastDataRow: 3 + rows.length });
      };
      addRegister('Compliance & Documents',
        ['Property', 'Category', 'Document title', 'Status', 'Provider', 'Reference', 'Issued', 'Expires', 'Version', 'Notes'],
        [27, 23, 33, 21, 26, 20, 15, 15, 10, 35], documentRows, 4, []);
      addRegister('Council & Licensing',
        ['Property', 'Application type', 'Title', 'Council', 'Status', 'Submitted', 'Deadline', 'Follow-up', 'Fee paid (£)'],
        [28, 23, 31, 25, 18, 15, 15, 15, 16], councilRows, 5, [9]);
      buffer = await workbook.xlsx.writeBuffer();
    }
    const pdf = format === 'pdf';
    res.setHeader('Content-Type', pdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${req.companyId}_Compliance_Register_${date}.${pdf ? 'pdf' : 'xlsx'}"`);
    res.setHeader('Content-Length', buffer.length);
    return res.end(buffer);
  } catch (error) {
    console.error('Compliance report export failed:', error);
    return apiError(res, 'Failed to export compliance report', 500, error);
  }
};

/**
 * 15. Get Document Expiry Email Notification Settings
 */
export const getEmailSettings = async (req, res) => {
  try {
    let config = await EmailNotificationConfig.findOne({ companyId: 'GLOBAL' });
    if (!config) {
      const defaultUser = await User.findOne({ isActive: true }).lean();
      config = await EmailNotificationConfig.create({
        companyId: 'GLOBAL',
        recipientEmail: defaultUser?.email || '',
        enabled: true,
        alertDays: [60, 45, 30, 14, 7, 0],
      });
    }

    return apiSuccess(res, {
      recipientEmail: config.recipientEmail,
      enabled: config.enabled,
      alertDays: config.alertDays,
      smtpHost: config.smtpHost || '',
      smtpPort: config.smtpPort || 587,
      smtpSecure: config.smtpSecure || false,
      smtpUser: config.smtpUser || '',
      hasSmtpPass: Boolean(config.smtpPass),
      fromEmail: config.fromEmail || '',
      fromName: config.fromName || 'UK Property Management Alerts',
      lastCheckedAt: config.lastCheckedAt,
      lastEmailSentAt: config.lastEmailSentAt,
      sentAlertsHistory: config.sentAlertsHistory || [],
    });
  } catch (error) {
    return apiError(res, 'Failed to fetch email notification settings', 500, error);
  }
};

/**
 * 16. Update Document Expiry Email Notification Settings
 */
export const updateEmailSettings = async (req, res) => {
  try {
    const {
      recipientEmail,
      enabled,
      alertDays,
      smtpHost,
      smtpPort,
      smtpSecure,
      smtpUser,
      smtpPass,
      fromEmail,
      fromName,
    } = req.body;

    let config = await EmailNotificationConfig.findOne({ companyId: 'GLOBAL' });
    if (!config) {
      config = new EmailNotificationConfig({ companyId: 'GLOBAL' });
    }

    if (recipientEmail !== undefined) config.recipientEmail = recipientEmail.trim();
    if (enabled !== undefined) config.enabled = Boolean(enabled);
    if (alertDays !== undefined && Array.isArray(alertDays)) config.alertDays = alertDays;
    if (smtpHost !== undefined) config.smtpHost = smtpHost.trim();
    if (smtpPort !== undefined) config.smtpPort = Number(smtpPort) || 587;
    if (smtpSecure !== undefined) config.smtpSecure = Boolean(smtpSecure);
    if (smtpUser !== undefined) config.smtpUser = smtpUser.trim();
    if (smtpPass !== undefined && smtpPass !== '') config.smtpPass = smtpPass;
    if (fromEmail !== undefined) config.fromEmail = fromEmail.trim();
    if (fromName !== undefined) config.fromName = fromName.trim();

    await config.save();

    return apiSuccess(res, {
      recipientEmail: config.recipientEmail,
      enabled: config.enabled,
      alertDays: config.alertDays,
      smtpHost: config.smtpHost,
      smtpPort: config.smtpPort,
      smtpSecure: config.smtpSecure,
      smtpUser: config.smtpUser,
      hasSmtpPass: Boolean(config.smtpPass),
      fromEmail: config.fromEmail,
      fromName: config.fromName,
      lastCheckedAt: config.lastCheckedAt,
      lastEmailSentAt: config.lastEmailSentAt,
      sentAlertsHistory: config.sentAlertsHistory || [],
    }, 'Email settings updated successfully');
  } catch (error) {
    return apiError(res, 'Failed to update email notification settings', 500, error);
  }
};

/**
 * 17. Send Test Email Notification
 */
export const sendTestNotificationEmail = async (req, res) => {
  try {
    const { toEmail, smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass, fromEmail, fromName } = req.body;
    const config = await EmailNotificationConfig.findOne({ companyId: 'GLOBAL' }).lean() || {};

    const targetEmail = toEmail || config.recipientEmail;
    if (!targetEmail) {
      return apiError(res, 'Please provide or save a recipient email address to receive the test email.', 400);
    }

    // Merge transient test credentials if passed from modal
    const effectiveConfig = {
      ...config,
      smtpHost: smtpHost !== undefined ? smtpHost : config.smtpHost,
      smtpPort: smtpPort !== undefined ? smtpPort : config.smtpPort,
      smtpSecure: smtpSecure !== undefined ? smtpSecure : config.smtpSecure,
      smtpUser: smtpUser !== undefined ? smtpUser : config.smtpUser,
      smtpPass: smtpPass !== undefined && smtpPass !== '' ? smtpPass : config.smtpPass,
      fromEmail: fromEmail !== undefined ? fromEmail : config.fromEmail,
      fromName: fromName !== undefined ? fromName : config.fromName,
    };

    const result = await sendTestEmail(targetEmail, effectiveConfig);
    if (result.success) {
      return apiSuccess(res, result, `Test notification sent successfully to ${targetEmail}`);
    } else {
      return apiError(res, result.error || 'Failed to dispatch test email', 400);
    }
  } catch (error) {
    return apiError(res, 'Failed to send test email', 500, error);
  }
};

/**
 * 18. Trigger Manual Expiry Email Evaluation
 */
export const triggerExpiryEmailCheckNow = async (req, res) => {
  try {
    const { forceSend } = req.body || {};
    const results = await evaluateAndSendExpiryEmails({
      targetCompanyId: req.companyId,
      forceSend: Boolean(forceSend),
    });

    return apiSuccess(res, results, 'Document expiry email check completed');
  } catch (error) {
    return apiError(res, 'Failed to execute expiry email check', 500, error);
  }
};
