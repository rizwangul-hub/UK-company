import express from 'express';
import multer from 'multer';
import {
  getPropertyDocuments,
  createPropertyDocument,
  updatePropertyDocument,
  uploadDocumentVersion,
  downloadDocument,
  deletePropertyDocument,
  getCouncilApplications,
  createCouncilApplication,
  updateCouncilApplication,
  addCouncilCorrespondence,
  getComplianceOverview,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  runRemindersCheck,
  exportComplianceReport,
} from '../controllers/complianceController.js';
import { protect } from '../middleware/auth.js';
import { requireCompanyContext } from '../middleware/companyContext.js';

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max for PDFs and high-res drawings
});

const router = express.Router();

router.use(protect, requireCompanyContext);

// Overview, Reminders & In-App Notifications
router.get('/overview', getComplianceOverview);
router.get('/notifications', getNotifications);
router.patch('/notifications/:id/read', markNotificationRead);
router.post('/notifications/mark-all-read', markAllNotificationsRead);
router.post('/reminders/check', runRemindersCheck);
router.get('/reports/export', exportComplianceReport);

// Council Applications & Correspondence
router.get('/council-applications', getCouncilApplications);
router.get('/properties/:propertyId/council-applications', getCouncilApplications);
router.post('/properties/:propertyId/council-applications', createCouncilApplication);
router.put('/council-applications/:id', updateCouncilApplication);
router.post('/council-applications/:id/correspondence', upload.single('file'), addCouncilCorrespondence);

// Property Document Center
router.get('/properties/:propertyId/documents', getPropertyDocuments);
router.post('/properties/:propertyId/documents', upload.single('file'), createPropertyDocument);
router.put('/documents/:id', updatePropertyDocument);
router.post('/documents/:id/version', upload.single('file'), uploadDocumentVersion);
router.get('/documents/:id/download', downloadDocument);
router.delete('/documents/:id', deletePropertyDocument);

export default router;
