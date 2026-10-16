import multer from 'multer';
import StatementImportBatch from '../models/StatementImportBatch.js';
import StatementImportRow from '../models/StatementImportRow.js';
import Account from '../models/Account.js';
import {
  parseStatementBuffer,
  classifyAndMatchRows,
  saveStatementBatch,
  postBatchTransactions,
  reverseBatchTransactions,
  deleteStatementBatch,
  getReconciliationReport,
} from '../services/statementImportService.js';

// Multer memory storage configuration for statement uploads (max 15MB)
const storage = multer.memoryStorage();
export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const name = file.originalname.toLowerCase();
    if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel (.xlsx, .xls) and CSV (.csv) bank statements are accepted.'));
    }
  },
});

/**
 * Preview and parse uploaded statement file without committing to DB
 */
export const previewStatement = async (req, res) => {
  try {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(400).json({ success: false, message: 'Company context is required.' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a bank statement file.' });
    }

    const customMapping = req.body.customMapping ? JSON.parse(req.body.customMapping) : {};
    const sheetName = req.body.sheetName || null;
    const parsed = await parseStatementBuffer(req.file.buffer, req.file.originalname, customMapping, { sheetName });

    // Check if duplicate file already uploaded
    const existingBatch = await StatementImportBatch.findOne({
      companyId,
      fileHash: parsed.fileHash,
    }).lean();

    res.status(200).json({
      success: true,
      data: {
        filename: req.file.originalname,
        fileHash: parsed.fileHash,
        fileSize: parsed.fileSize,
        sheetName: parsed.sheetName,
        sheetsList: parsed.sheetsList,
        isDuplicateFile: !!existingBatch,
        existingBatchId: existingBatch?._id || null,
        existingBatchDate: existingBatch?.createdAt || null,
        detectedHeaders: parsed.detectedHeaders,
        detectedMapping: parsed.detectedMapping,
        openingBalance: parsed.openingBalance,
        closingBalance: parsed.closingBalance,
        statementPeriodStart: parsed.statementPeriodStart,
        statementPeriodEnd: parsed.statementPeriodEnd,
        totalRows: parsed.totalParsedRows,
        previewRows: parsed.parsedRows.slice(0, 15),
        validationErrorsCount: parsed.validationErrors.length,
        validationErrorsSample: parsed.validationErrors.slice(0, 10),
      },
    });
  } catch (error) {
    console.error('[Statement Preview Error]:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Upload and process statement batch into database staging rows
 */
export const processStatementUpload = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { accountId, customMapping: rawMapping, sheetName, notes } = req.body;

    if (!companyId) {
      return res.status(400).json({ success: false, message: 'Company context is required.' });
    }
    if (!accountId) {
      return res.status(400).json({ success: false, message: 'Bank account is required.' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a bank statement file.' });
    }

    // Verify account belongs to company (or legacy unassigned)
    let account = await Account.findOne({
      _id: accountId,
      $or: [{ companyId }, { companyId: null }, { companyId: { $exists: false } }],
    });
    if (!account) {
      return res.status(404).json({ success: false, message: 'Selected bank account was not found in active company.' });
    }
    if (!account.companyId) {
      account.companyId = companyId;
      await account.save();
    }

    const customMapping = rawMapping ? (typeof rawMapping === 'string' ? JSON.parse(rawMapping) : rawMapping) : {};

    const { batch, summary } = await saveStatementBatch({
      companyId,
      accountId,
      filename: req.file.originalname,
      fileBuffer: req.file.buffer,
      customMapping,
      sheetName: sheetName || null,
      userId: req.user?._id || null,
      userName: req.user?.name || 'System Operator',
      notes: notes || '',
    });

    res.status(201).json({
      success: true,
      message: `Statement imported successfully with ${summary.totalRows} transactions staged for review.`,
      data: {
        batchId: batch._id,
        batch,
        summary,
      },
    });
  } catch (error) {
    console.error('[Statement Upload Process Error]:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get all import batches for the active company
 */
export const getBatches = async (req, res) => {
  try {
    const companyId = req.companyId;
    const batches = await StatementImportBatch.find({ companyId })
      .populate('accountId', 'name accountNumber bankName')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: batches.length,
      data: batches,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get batch details and staged rows
 */
export const getBatchById = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { id } = req.params;
    const { status, search, limit = 500, skip = 0 } = req.query;

    const batch = await StatementImportBatch.findOne({ _id: id, companyId })
      .populate('accountId', 'name accountNumber currentBalance openingBalance')
      .lean();

    if (!batch) {
      return res.status(404).json({ success: false, message: 'Statement batch not found.' });
    }

    const query = { batchId: id, companyId };
    if (status && status !== 'ALL') {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { description: { $regex: search, $options: 'i' } },
        { reference: { $regex: search, $options: 'i' } },
        { suggestedPropertyName: { $regex: search, $options: 'i' } },
      ];
    }

    const [rows, totalRows] = await Promise.all([
      StatementImportRow.find(query)
        .populate('suggestedPropertyId', 'title addressLine1')
        .populate('suggestedCategoryId', 'name')
        .populate('suggestedTenantId', 'name fullName')
        .populate('suggestedMortgageId', 'lenderName mortgageReference')
        .populate('suggestedCounterAccountId', 'name')
        .sort({ rowIndex: 1 })
        .skip(parseInt(skip, 10))
        .limit(parseInt(limit, 10))
        .lean(),
      StatementImportRow.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        batch,
        rows,
        totalRows,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Update single staged row classification
 */
export const updateBatchRow = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { batchId, rowId } = req.params;
    const updates = req.body;

    const row = await StatementImportRow.findOne({ _id: rowId, batchId, companyId });
    if (!row) {
      return res.status(404).json({ success: false, message: 'Staged row not found.' });
    }

    if (row.status === 'POSTED') {
      return res.status(400).json({ success: false, message: 'Cannot edit a row that has already been posted to the ledger.' });
    }

    // Apply allowed updates
    const allowedFields = [
      'suggestedType',
      'suggestedPropertyId',
      'suggestedPropertyName',
      'suggestedUnitId',
      'suggestedCategoryId',
      'suggestedCategoryName',
      'suggestedTenantId',
      'suggestedTenantName',
      'suggestedMortgageId',
      'suggestedMortgageName',
      'suggestedCounterAccountId',
      'suggestedCounterAccountName',
      'isExcluded',
      'status',
      'description',
      'reference',
    ];

    allowedFields.forEach((field) => {
      if (updates[field] !== undefined) {
        row[field] = updates[field];
      }
    });

    await row.save();

    res.status(200).json({
      success: true,
      message: 'Row updated successfully.',
      data: row,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Bulk update rows in a batch (e.g. approve all, exclude duplicates, set property)
 */
export const bulkUpdateRows = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { batchId } = req.params;
    const { rowIds, updates } = req.body;

    if (!Array.isArray(rowIds) || !rowIds.length) {
      return res.status(400).json({ success: false, message: 'rowIds array is required.' });
    }

    await StatementImportRow.updateMany(
      { _id: { $in: rowIds }, batchId, companyId, status: { $ne: 'POSTED' } },
      { $set: updates }
    );

    res.status(200).json({
      success: true,
      message: `Updated ${rowIds.length} rows successfully.`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Commit approved rows of a batch to the authoritative Central Ledger
 */
export const postBatch = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { batchId } = req.params;
    const { rowIds } = req.body;

    const batch = await StatementImportBatch.findOne({ _id: batchId, companyId });
    if (!batch) {
      return res.status(404).json({ success: false, message: 'Statement batch not found in active company.' });
    }

    const result = await postBatchTransactions({
      batchId,
      rowIds: Array.isArray(rowIds) && rowIds.length > 0 ? rowIds : null,
      userId: req.user?._id || null,
      userName: req.user?.name || 'System Operator',
    });

    res.status(200).json({
      success: true,
      message: `Successfully posted ${result.postedCount} transactions to the Central Ledger.`,
      data: result,
    });
  } catch (error) {
    console.error('[Post Batch Error]:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Cancel an unposted import batch
 */
export const cancelBatch = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { batchId } = req.params;

    const batch = await StatementImportBatch.findOne({ _id: batchId, companyId });
    if (!batch) {
      return res.status(404).json({ success: false, message: 'Statement batch not found.' });
    }

    if (batch.status === 'POSTED') {
      return res.status(400).json({ success: false, message: 'Cannot cancel a fully posted statement batch.' });
    }

    batch.status = 'CANCELLED';
    await batch.save();

    await StatementImportRow.updateMany(
      { batchId, companyId, status: { $ne: 'POSTED' } },
      { $set: { status: 'SKIPPED', isExcluded: true } }
    );

    res.status(200).json({
      success: true,
      message: 'Statement batch cancelled successfully.',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Reverse all posted transactions of an import batch
 */
export const reverseBatch = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { batchId } = req.params;

    const result = await reverseBatchTransactions({
      batchId,
      companyId,
      userId: req.user?._id || null,
      userName: req.user?.name || 'System Operator',
    });

    res.status(200).json({
      success: true,
      message: `Successfully reversed ${result.reversedCount} posted transactions from the Central Ledger.`,
      data: result,
    });
  } catch (error) {
    console.error('[Reverse Batch Error]:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get account statement reconciliation comparison
 */
export const getReconciliation = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { accountId, batchId } = req.query;

    if (!accountId) {
      return res.status(400).json({ success: false, message: 'accountId query param is required.' });
    }

    const report = await getReconciliationReport(companyId, accountId, batchId || null);

    res.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Permanently delete a statement import batch and associated staging/posted records
 */
export const deleteBatch = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { batchId } = req.params;

    if (!companyId) {
      return res.status(400).json({ success: false, message: 'Company context is required.' });
    }

    const result = await deleteStatementBatch({
      batchId,
      companyId,
      userId: req.user?._id || null,
      userName: req.user?.name || 'System Operator',
    });

    res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    console.error('[Delete Batch Error]:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
