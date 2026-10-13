import express from 'express';
import {
  generateMonthlySchedules,
  getSchedules,
  updateSchedule,
  recordPayment,
  getArrearsSummary,
} from '../controllers/rentController.js';
import { protect } from '../middleware/auth.js';
import { requireCompanyContext } from '../middleware/companyContext.js';

const router = express.Router();

router.use(protect, requireCompanyContext);

router.post('/generate-monthly', generateMonthlySchedules);
router.get('/schedules', getSchedules);
router.put('/schedules/:id', updateSchedule);
router.post('/payments', recordPayment);
router.get('/arrears', getArrearsSummary);

export default router;
