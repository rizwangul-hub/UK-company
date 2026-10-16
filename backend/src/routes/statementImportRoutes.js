import express from 'express';
import {
  uploadMiddleware,
  previewStatement,
  processStatementUpload,
  getBatches,
  getBatchById,
  updateBatchRow,
  bulkUpdateRows,
  postBatch,
  reverseBatch,
  cancelBatch,
  deleteBatch,
  getReconciliation,
} from '../controllers/statementImportController.js';
import { protect } from '../middleware/auth.js';
import { requireCompanyContext } from '../middleware/companyContext.js';

const router = express.Router();

router.use(protect, requireCompanyContext);

// Statement Upload & Parsing
router.post('/parse-preview', uploadMiddleware.single('statementFile'), previewStatement);
router.post('/process-batch', uploadMiddleware.single('statementFile'), processStatementUpload);

// Batch Management
router.get('/batches', getBatches);
router.get('/batches/:id', getBatchById);
router.delete('/batches/:batchId', deleteBatch);
router.put('/batches/:batchId/rows/:rowId', updateBatchRow);
router.put('/batches/:batchId/rows', bulkUpdateRows);
router.post('/batches/:batchId/post', postBatch);
router.post('/batches/:batchId/reverse', reverseBatch);
router.post('/batches/:batchId/cancel', cancelBatch);

// Reconciliation
router.get('/reconciliation', getReconciliation);

export default router;
