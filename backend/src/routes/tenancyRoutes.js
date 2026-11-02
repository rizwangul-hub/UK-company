import express from 'express';
import multer from 'multer';
import {
  getTenants,
  getTenantById,
  createTenant,
  updateTenant,
  getTenancies,
  createTenancy,
  updateTenancy,
} from '../controllers/tenancyController.js';
import {
  getTenantDocuments,
  uploadTenantDocument,
  updateTenantDocument,
  deleteTenantDocument,
} from '../controllers/tenantDocumentController.js';
import { protect } from '../middleware/auth.js';
import { requireCompanyContext } from '../middleware/companyContext.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

const router = express.Router();

router.use('/tenants', protect, requireCompanyContext);
router.use('/tenancies', protect, requireCompanyContext);
router.use('/tenant-documents', protect, requireCompanyContext);

router.get('/tenants', getTenants);
router.get('/tenants/:id', getTenantById);
router.post('/tenants', createTenant);
router.put('/tenants/:id', updateTenant);

// Tenant Documents
router.get('/tenants/:tenantId/documents', getTenantDocuments);
router.post('/tenants/:tenantId/documents', upload.single('file'), uploadTenantDocument);
router.put('/tenant-documents/:documentId', upload.single('file'), updateTenantDocument);
router.delete('/tenant-documents/:documentId', deleteTenantDocument);

router.get('/tenancies', getTenancies);
router.post('/tenancies', createTenancy);
router.put('/tenancies/:id', updateTenancy);

export default router;
