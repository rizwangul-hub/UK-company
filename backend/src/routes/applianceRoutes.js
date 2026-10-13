import express from 'express';
import multer from 'multer';
import {
  getAppliances,
  getApplianceById,
  createAppliance,
  updateAppliance,
  deleteAppliance,
  uploadApplianceDocument,
  deleteApplianceDocument,
  getCurrysContacts,
  getMaintenanceTasks,
  updateMaintenanceTask,
  createMaintenanceTask,
} from '../controllers/applianceController.js';
import { protect } from '../middleware/auth.js';
import { requireCompanyContext } from '../middleware/companyContext.js';

// In-memory multer storage for Vercel/Node buffer processing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

const router = express.Router();

// Enforce JWT authentication and strict company context
router.use(protect, requireCompanyContext);

// Currys contact directory
router.get('/currys-contacts', getCurrysContacts);

// Khurshid's Action Tasks
router.get('/tasks', getMaintenanceTasks);
router.post('/tasks', createMaintenanceTask);
router.put('/tasks/:id', updateMaintenanceTask);

// Appliance CRUD
router.get('/', getAppliances);
router.get('/:id', getApplianceById);
router.post('/', createAppliance);
router.put('/:id', updateAppliance);
router.delete('/:id', deleteAppliance);

// Document Attachments
router.post('/:id/documents', upload.single('file'), uploadApplianceDocument);
router.delete('/:id/documents/:documentId', deleteApplianceDocument);

export default router;
