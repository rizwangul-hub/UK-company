import TenantDocument, { TENANT_STANDARD_DOCUMENTS } from '../models/TenantDocument.js';
import Tenant from '../models/Tenant.js';
import cloudinary, { isCloudinaryConfigured, CLOUDINARY_FOLDER } from '../config/cloudinary.js';
import { apiSuccess, apiError } from '../utils/apiResponse.js';

/**
 * Get all documents for a specific tenant
 */
export const getTenantDocuments = async (req, res) => {
  try {
    const { tenantId } = req.params;

    const tenant = await Tenant.findOne({ _id: tenantId, companyId: req.companyId });
    if (!tenant) {
      return apiError(res, 'Tenant not found in this company', 404);
    }

    const documents = await TenantDocument.find({ tenantId, companyId: req.companyId })
      .sort({ createdAt: -1 });

    return apiSuccess(res, {
      documents,
      standardList: TENANT_STANDARD_DOCUMENTS,
      total: documents.length,
    });
  } catch (error) {
    return apiError(res, error.message || 'Failed to fetch tenant documents', 500, error);
  }
};

/**
 * Upload or replace a document for a tenant
 */
export const uploadTenantDocument = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { documentName, documentType = 'standard', expiryDate, notes } = req.body;

    if (!documentName) {
      return apiError(res, 'Document name is required', 400);
    }

    const tenant = await Tenant.findOne({ _id: tenantId, companyId: req.companyId });
    if (!tenant) {
      return apiError(res, 'Tenant not found in this company', 404);
    }

    if (!req.file) {
      return apiError(res, 'Please select a file to upload', 400);
    }

    let fileUrl = '';
    let publicId = '';

    if (isCloudinaryConfigured()) {
      try {
        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: `${CLOUDINARY_FOLDER}/tenants/${tenantId}`,
              resource_type: 'auto',
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          stream.end(req.file.buffer);
        });

        fileUrl = uploadResult.secure_url || uploadResult.url;
        publicId = uploadResult.public_id || '';
      } catch (cloudErr) {
        console.warn('[Cloudinary Upload Warning, falling back to base64]', cloudErr.message);
        fileUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      }
    } else {
      fileUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    }

    const parsedExpiryDate = expiryDate ? new Date(expiryDate) : null;

    let docRecord;

    if (documentType === 'standard') {
      const existingDoc = await TenantDocument.findOne({
        companyId: req.companyId,
        tenantId,
        documentName,
        documentType: 'standard',
      });

      if (existingDoc) {
        if (existingDoc.publicId && isCloudinaryConfigured()) {
          try {
            await cloudinary.uploader.destroy(existingDoc.publicId);
          } catch (e) {
            console.warn('[Cloudinary cleanup notice]', e.message);
          }
        }

        existingDoc.fileUrl = fileUrl;
        existingDoc.publicId = publicId;
        existingDoc.originalFileName = req.file.originalname;
        existingDoc.fileType = req.file.mimetype;
        existingDoc.fileSize = req.file.size;
        existingDoc.expiryDate = parsedExpiryDate;
        existingDoc.notes = notes !== undefined ? notes : existingDoc.notes;
        existingDoc.uploadedAt = new Date();

        await existingDoc.save();
        docRecord = existingDoc;
      }
    }

    if (!docRecord) {
      docRecord = await TenantDocument.create({
        companyId: req.companyId,
        tenantId,
        documentName,
        documentType: documentType === 'custom' ? 'custom' : 'standard',
        fileUrl,
        publicId,
        originalFileName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        expiryDate: parsedExpiryDate,
        notes: notes || '',
        uploadedAt: new Date(),
      });
    }

    return apiSuccess(res, docRecord, `Document "${documentName}" successfully saved.`, 201);
  } catch (error) {
    return apiError(res, error.message || 'Failed to upload tenant document', 500, error);
  }
};

/**
 * Update an existing tenant document (e.g. expiry date or notes)
 */
export const updateTenantDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const { expiryDate, notes, documentName } = req.body;

    const doc = await TenantDocument.findOne({ _id: documentId, companyId: req.companyId });
    if (!doc) {
      return apiError(res, 'Tenant document not found in this company', 404);
    }

    if (expiryDate !== undefined) {
      doc.expiryDate = expiryDate ? new Date(expiryDate) : null;
    }
    if (notes !== undefined) doc.notes = notes;
    if (documentName !== undefined && doc.documentType === 'custom') {
      doc.documentName = documentName;
    }

    if (req.file) {
      if (doc.publicId && isCloudinaryConfigured()) {
        try {
          await cloudinary.uploader.destroy(doc.publicId);
        } catch (e) {
          console.warn('[Cloudinary cleanup notice]', e.message);
        }
      }

      if (isCloudinaryConfigured()) {
        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              folder: `${CLOUDINARY_FOLDER}/tenants/${doc.tenantId}`,
              resource_type: 'auto',
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          );
          stream.end(req.file.buffer);
        });

        doc.fileUrl = uploadResult.secure_url || uploadResult.url;
        doc.publicId = uploadResult.public_id || '';
      } else {
        doc.fileUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      }

      doc.originalFileName = req.file.originalname;
      doc.fileType = req.file.mimetype;
      doc.fileSize = req.file.size;
      doc.uploadedAt = new Date();
    }

    await doc.save();
    return apiSuccess(res, doc, 'Document updated successfully.');
  } catch (error) {
    return apiError(res, error.message || 'Failed to update tenant document', 500, error);
  }
};

/**
 * Delete a tenant document
 */
export const deleteTenantDocument = async (req, res) => {
  try {
    const { documentId } = req.params;

    const doc = await TenantDocument.findOne({ _id: documentId, companyId: req.companyId });
    if (!doc) {
      return apiError(res, 'Document not found in this company', 404);
    }

    if (doc.publicId && isCloudinaryConfigured()) {
      try {
        await cloudinary.uploader.destroy(doc.publicId);
      } catch (e) {
        console.warn('[Cloudinary delete notice]', e.message);
      }
    }

    await TenantDocument.deleteOne({ _id: documentId });

    return apiSuccess(res, null, 'Document deleted successfully.');
  } catch (error) {
    return apiError(res, error.message || 'Failed to delete tenant document', 500, error);
  }
};
