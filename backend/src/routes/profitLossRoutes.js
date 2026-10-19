import express from 'express';
import {
  getProfitAndLossReport,
  getProfitLossSummary,
  updateTransactionClassification,
  exportProfitLossCsv,
  exportProfitLossExcel,
} from '../controllers/profitLossController.js';
import { protect } from '../middleware/auth.js';
import { requireCompanyContext } from '../middleware/companyContext.js';

const router = express.Router();

// All P&L routes are strictly authenticated and company-context isolated
router.get('/', protect, requireCompanyContext, getProfitAndLossReport);
router.get('/summary', protect, requireCompanyContext, getProfitLossSummary);
router.patch('/classify/:transactionId', protect, requireCompanyContext, updateTransactionClassification);
router.get('/export/csv', protect, requireCompanyContext, exportProfitLossCsv);
router.get('/export/excel', protect, requireCompanyContext, exportProfitLossExcel);

export default router;
