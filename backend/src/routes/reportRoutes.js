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

// Single-company endpoints (Strictly isolated by authenticated company context)
router.get('/dashboard', protect, requireCompanyContext, getDashboardStats);
router.get('/property-profitability', protect, requireCompanyContext, getPropertyProfitability);
router.get('/financial-year', protect, requireCompanyContext, getFinancialYearReport);

// UK Ledger Advanced Reporting & Exports
router.get('/ledger/preview', protect, requireCompanyContext, getLedgerReportPreview);
router.post('/ledger/preview', protect, requireCompanyContext, getLedgerReportPreview);
router.get('/ledger/export/excel', protect, requireCompanyContext, exportLedgerExcel);
router.post('/ledger/export/excel', protect, requireCompanyContext, exportLedgerExcel);
router.get('/ledger/export/pdf', protect, requireCompanyContext, exportLedgerPdf);
router.post('/ledger/export/pdf', protect, requireCompanyContext, exportLedgerPdf);

// Direct Property Landlord Rent Statement (No Inside Units)
router.get('/landlord-statement/excel', protect, requireCompanyContext, exportLandlordRentStatementExcel);

export default router;
