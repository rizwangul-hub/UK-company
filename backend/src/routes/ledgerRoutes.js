import express from 'express';
import multer from 'multer';
import {
  getTransactions,
  recordExpense,
  recordIncome,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryHierarchyController,
  createHeadCategoryController,
  createSubHeadCategoryController,
  updateCategoryHierarchyController,
  deleteCategoryHierarchyController,
  previewCategoryBackfillController,
  applyCategoryBackfillController,
  updateTransaction,
  deleteTransaction,
  restoreTransaction,
  getDeletedTransactions,
  getTransactionAudit,
  getTransactionById,
  getLedgerEntities,
  queryEntityLedger,
  getHeadSubHeadSummary,
  uploadLedgerReceipt,
  attachTransactionReceipt,
  removeTransactionReceipt,
} from '../controllers/ledgerController.js';
import {
  getLedgerReportPreview,
  exportLedgerExcel,
  exportLedgerPdf,
} from '../controllers/reportController.js';
import { protect } from '../middleware/auth.js';
import { requireCompanyContext } from '../middleware/companyContext.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

const router = express.Router();

router.use(protect, requireCompanyContext);

router.get('/entities', getLedgerEntities);
router.get('/head-summary', getHeadSubHeadSummary);
router.get('/query', queryEntityLedger);
router.get('/preview', getLedgerReportPreview);
router.post('/preview', getLedgerReportPreview);
router.get('/export/excel', exportLedgerExcel);
router.post('/export/excel', exportLedgerExcel);
router.get('/export/pdf', exportLedgerPdf);
router.post('/export/pdf', exportLedgerPdf);

// Transaction Management & Recycle Bin
router.get('/transactions/recycle-bin', getDeletedTransactions);
router.get('/transactions', getTransactions);
router.get('/transactions/:id', getTransactionById);
router.get('/transactions/:id/audit', getTransactionAudit);
router.put('/transactions/:id', updateTransaction);
router.delete('/transactions/:id', deleteTransaction);
router.post('/transactions/:id/restore', restoreTransaction);

router.post('/expenses', recordExpense);
router.post('/income', recordIncome);
router.post('/upload-receipt', upload.single('file'), uploadLedgerReceipt);
router.post('/transactions/:id/receipt', upload.single('file'), attachTransactionReceipt);
router.delete('/transactions/:id/receipt', removeTransactionReceipt);
router.get('/categories/hierarchy', getCategoryHierarchyController);
router.post('/categories/heads', createHeadCategoryController);
router.post('/categories/subheads', createSubHeadCategoryController);
router.get('/categories/backfill/preview', previewCategoryBackfillController);
router.post('/categories/backfill/apply', applyCategoryBackfillController);
router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.put('/categories/:id', updateCategoryHierarchyController);
router.delete('/categories/:id', deleteCategoryHierarchyController);

export default router;
