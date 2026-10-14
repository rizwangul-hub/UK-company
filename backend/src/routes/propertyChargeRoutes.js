import express from 'express';
import multer from 'multer';
import {
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
} from '../controllers/propertyChargeController.js';
import { protect } from '../middleware/auth.js';
import { requireCompanyContext } from '../middleware/companyContext.js';

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
});

const router = express.Router();

router.use(protect, requireCompanyContext);

// Overview & Reminders
router.get('/overview', getDashboardOverview);
router.post('/reminders/check', runRemindersCheck);

// Payees
router.get('/payees', getPayees);
router.post('/payees', createPayee);
router.put('/payees/:id', updatePayee);

// Property Configurations
router.get('/properties/:propertyId/configs', getPropertyConfigs);
router.put('/properties/:propertyId/configs/:chargeType', updatePropertyConfig);

// Demands / Notices
router.get('/demands', getDemands);
router.get('/demands/:id', getDemandById);
router.post('/demands', upload.single('file'), createDemand);
router.patch('/demands/:id/status', updateDemandStatus);

// Payments & Proof
router.get('/payments', getPayments);
router.post('/payments', upload.single('file'), recordPayment);

// Ledger
router.get('/properties/:propertyId/ledger', getPropertyLedger);

export default router;
