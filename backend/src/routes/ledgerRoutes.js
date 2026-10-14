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
  updateTransaction,
  getLedgerEntities,
  queryEntityLedger,
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
router.get('/query', queryEntityLedger);
router.get('/preview', getLedgerReportPreview);
router.post('/preview', getLedgerReportPreview);
router.get('/export/excel', exportLedgerExcel);
router.post('/export/excel', exportLedgerExcel);
router.get('/export/pdf', exportLedgerPdf);
router.post('/export/pdf', exportLedgerPdf);
router.get('/transactions', getTransactions);
router.put('/transactions/:id', updateTransaction);
router.post('/expenses', recordExpense);
router.post('/income', recordIncome);
router.post('/upload-receipt', upload.single('file'), uploadLedgerReceipt);
router.post('/transactions/:id/receipt', upload.single('file'), attachTransactionReceipt);
router.delete('/transactions/:id/receipt', removeTransactionReceipt);
router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

export default router;
