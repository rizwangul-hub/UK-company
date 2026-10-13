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
  assignPropertyToAppliance,
  getSupplierReceipts,
  createSupplierReceipt,
  uploadReceiptDocument,
  getApplianceReminders,
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

// Reminders & Expiry Alerts
router.get('/reminders', getApplianceReminders);

// Supplier Receipts (Master source invoices: Currys, Howdens, etc.)
router.get('/receipts', getSupplierReceipts);
router.post('/receipts', createSupplierReceipt);
router.post('/receipts/:id/documents', upload.single('file'), uploadReceiptDocument);

// Maintenance Action Tasks
router.get('/tasks', getMaintenanceTasks);
router.post('/tasks', createMaintenanceTask);
router.put('/tasks/:id', updateMaintenanceTask);

// Appliance Property Assignment
router.put('/:id/assign-property', assignPropertyToAppliance);

// Appliance CRUD
router.get('/', getAppliances);
router.get('/:id', getApplianceById);
router.post('/', createAppliance);
router.put('/:id', updateAppliance);
router.delete('/:id', deleteAppliance);

// Appliance Document Attachments
router.post('/:id/documents', upload.single('file'), uploadApplianceDocument);
router.delete('/:id/documents/:documentId', deleteApplianceDocument);

export default router;
