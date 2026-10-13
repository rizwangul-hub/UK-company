import express from 'express';
import {
  getDashboardStats,
  getPropertyProfitability,
  getFinancialYearReport,
  getLedgerReportPreview,
  exportLedgerExcel,
  exportLedgerPdf,
  exportLandlordRentStatementExcel,
  getConsolidatedOverview,
  exportConsolidatedExcel,
  exportConsolidatedPdf,
} from '../controllers/reportController.js';
import { protect } from '../middleware/auth.js';
import { requireCompanyContext } from '../middleware/companyContext.js';

const router = express.Router();

// Master Consolidated All-Companies Endpoints (Protected by user auth, no single-company lock)
router.get('/consolidated/overview', protect, getConsolidatedOverview);
router.get('/consolidated/excel', protect, exportConsolidatedExcel);
router.get('/consolidated/pdf', protect, exportConsolidatedPdf);

// Enforce Company Context for all single-company endpoints
router.use(protect, requireCompanyContext);

router.get('/dashboard', getDashboardStats);
router.get('/property-profitability', getPropertyProfitability);
router.get('/financial-year', getFinancialYearReport);

// UK Ledger Advanced Reporting & Exports
router.get('/ledger/preview', getLedgerReportPreview);
router.post('/ledger/preview', getLedgerReportPreview);
router.get('/ledger/export/excel', exportLedgerExcel);
router.post('/ledger/export/excel', exportLedgerExcel);
router.get('/ledger/export/pdf', exportLedgerPdf);
router.post('/ledger/export/pdf', exportLedgerPdf);

// Direct Property Landlord Rent Statement (No Inside Units)
router.get('/landlord-statement/excel', exportLandlordRentStatementExcel);

export default router;
