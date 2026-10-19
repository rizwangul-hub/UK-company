import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileUp,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  Filter,
  Search,
  RefreshCw,
  Trash2,
  Eye,
  Check,
  X,
  CreditCard,
  Building2,
  Calendar,
  Layers,
  Sparkles,
  Download,
  Sliders,
  DollarSign,
  Send,
  Loader2,
  History,
  ShieldCheck,
  ChevronDown,
  Info,
} from 'lucide-react';
import { formatGBP, formatUKDate } from '../utils/formatters.js';
import { statementImportAPI, accountsAPI, propertiesAPI, ledgerAPI } from '../services/api.js';
import { ModalPortal } from '../components/ModalPortal.jsx';

export function StatementImportPage({ selectedCompany }) {
  const companySlug = selectedCompany?.slug || selectedCompany?.id || 'old-street';

  // Tabs: 'upload' | 'review' | 'reconciliation' | 'history'
  const [activeTab, setActiveTab] = useState('upload');

  // Accounts & Master Data
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [properties, setProperties] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // Upload & Preview State
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [selectedSheetName, setSelectedSheetName] = useState('');

  // Column Mapping State
  const [columnMapping, setColumnMapping] = useState({
    dateCol: -1,
    descCol: -1,
    originalNarrativeCol: -1,
    headCol: -1,
    subHeadCol: -1,
    debitCol: -1,
    creditCol: -1,
    amountCol: -1,
    balanceCol: -1,
    refCol: -1,
  });

  // Staged Batch & Review State
  const [activeBatchId, setActiveBatchId] = useState(null);
  const [batchData, setBatchData] = useState(null);
  const [stagedRows, setStagedRows] = useState([]);
  const [totalStagedCount, setTotalStagedCount] = useState(0);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRowIds, setSelectedRowIds] = useState(new Set());
  const [submittingProcess, setSubmittingProcess] = useState(false);

  // Posting Modal & Reconciliation State
  const [showPostModal, setShowPostModal] = useState(false);
  const [postingLoading, setPostingLoading] = useState(false);
  const [postingProgress, setPostingProgress] = useState(null);
  const [postResult, setPostResult] = useState(null);
  const [reconciliationData, setReconciliationData] = useState(null);
  const [reconciliationLoading, setReconciliationLoading] = useState(false);

  // Batch History
  const [batchesList, setBatchesList] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Fetch Master Data on Mount or Company Change
  useEffect(() => {
    let isMounted = true;
    const fetchPrerequisites = async () => {
      try {
        setLoadingInitial(true);
        const [accRes, propRes, catRes] = await Promise.all([
          accountsAPI.getAll(),
          propertiesAPI.getAll(),
          ledgerAPI.getCategories(),
        ]);

        if (!isMounted) return;

        const accs = accRes?.data?.accounts || accRes?.accounts || [];
        const bankAccounts = accs.filter((a) => a.accountType === 'BANK');
        setAccounts(bankAccounts.length > 0 ? bankAccounts : accs);
        if (bankAccounts.length > 0) {
          setSelectedAccountId(bankAccounts[0]._id);
        } else if (accs.length > 0) {
          setSelectedAccountId(accs[0]._id);
        }

        const props = propRes?.data?.properties || propRes?.properties || [];
        setProperties(props);

        const cats = catRes?.data?.categories || catRes?.categories || [];
        setCategories(cats);
      } catch (err) {
        console.error('Failed to load master data:', err);
      } finally {
        if (isMounted) setLoadingInitial(false);
      }
    };

    fetchPrerequisites();
    return () => {
      isMounted = false;
    };
  }, [companySlug]);

  // Load Batch History
  const loadBatchHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      const res = await statementImportAPI.getBatches();
      if (res?.success) {
        setBatchesList(res.data || []);
      }
    } catch (err) {
      console.error('Failed to load import batches:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      loadBatchHistory();
    }
  }, [activeTab, loadBatchHistory]);

  // Load Active Batch Rows
  const loadBatchRows = useCallback(
    async (batchId, filter = statusFilter, search = searchTerm) => {
      if (!batchId) return;
      try {
        setRowsLoading(true);
        const params = { limit: 1000 };
        if (filter && filter !== 'ALL') params.status = filter;
        if (search) params.search = search;

        const res = await statementImportAPI.getBatchById(batchId, params);
        if (res?.success && res.data) {
          setBatchData(res.data.batch);
          setStagedRows(res.data.rows || []);
          setTotalStagedCount(res.data.totalRows || 0);

          // By default, pre-select rows that are APPROVED or NEW and not excluded
          const preSelected = new Set();
          (res.data.rows || []).forEach((r) => {
            if ((r.status === 'APPROVED' || r.status === 'NEW') && !r.isExcluded) {
              preSelected.add(r._id);
            }
          });
          setSelectedRowIds(preSelected);
        }
      } catch (err) {
        console.error('Failed to load batch rows:', err);
      } finally {
        setRowsLoading(false);
      }
    },
    [statusFilter, searchTerm]
  );

  // Trigger preview when file selected
  const handleFileSelect = async (file, sheetOverride = null) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls') && !name.endsWith('.csv')) {
      setUploadError('Only Excel (.xlsx, .xls) and CSV (.csv) statement files are supported.');
      return;
    }

    setUploadFile(file);
    setUploadError('');
    setPreviewLoading(true);

    try {
      const formData = new FormData();
      formData.append('statementFile', file);
      if (sheetOverride) {
        formData.append('sheetName', sheetOverride);
      }

      const res = await statementImportAPI.previewStatement(formData);
      if (res?.success && res.data) {
        setPreviewData(res.data);
        setSelectedSheetName(res.data.sheetName || sheetOverride || '');
        if (res.data.detectedMapping) {
          setColumnMapping(res.data.detectedMapping);
        }
      }
    } catch (err) {
      setUploadError(err.response?.data?.message || err.message || 'Failed to parse file preview.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSheetChange = (sheet) => {
    setSelectedSheetName(sheet);
    if (uploadFile) {
      handleFileSelect(uploadFile, sheet);
    }
  };

  // Drag & drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Process and Stage uploaded batch
  const handleProcessUpload = async () => {
    if (!uploadFile) {
      setUploadError('Please select a bank statement file first.');
      return;
    }
    if (!selectedAccountId) {
      setUploadError('Please select a target company bank account.');
      return;
    }

    setSubmittingProcess(true);
    setUploadError('');

    try {
      const formData = new FormData();
      formData.append('statementFile', uploadFile);
      formData.append('accountId', selectedAccountId);
      formData.append('customMapping', JSON.stringify(columnMapping));
      if (selectedSheetName) {
        formData.append('sheetName', selectedSheetName);
      }

      const res = await statementImportAPI.processBatch(formData);
      if (res?.success && res.data) {
        const newBatchId = res.data.batchId;
        setActiveBatchId(newBatchId);
        setActiveTab('review');
        await loadBatchRows(newBatchId);
      }
    } catch (err) {
      setUploadError(err.response?.data?.message || err.message || 'Failed to process statement upload.');
    } finally {
      setSubmittingProcess(false);
    }
  };

  // Load Reconciliation Data
  const loadReconciliation = useCallback(async () => {
    if (!selectedAccountId) return;
    try {
      setReconciliationLoading(true);
      const params = { accountId: selectedAccountId };
      if (activeBatchId) params.batchId = activeBatchId;
      const res = await statementImportAPI.getReconciliation(params);
      if (res?.success) {
        setReconciliationData(res.data);
      }
    } catch (err) {
      console.error('Failed to load reconciliation:', err);
    } finally {
      setReconciliationLoading(false);
    }
  }, [selectedAccountId, activeBatchId]);

  useEffect(() => {
    if (activeTab === 'reconciliation') {
      loadReconciliation();
    }
  }, [activeTab, loadReconciliation]);

  // Update Single Staged Row
  const handleUpdateRow = async (rowId, field, value) => {
    try {
      const payload = { [field]: value };
      // If type changed, reset or default category/property if needed
      if (field === 'suggestedType') {
        if (value === 'RENT') {
          payload.status = 'APPROVED';
        }
      }
      if (field === 'suggestedPropertyId') {
        const foundProp = properties.find((p) => p._id === value);
        payload.suggestedPropertyName = foundProp ? (foundProp.title || foundProp.addressLine1) : '';
        payload.status = 'APPROVED';
      }
      if (field === 'suggestedCategoryId') {
        const foundCat = categories.find((c) => c._id === value);
        payload.suggestedCategoryName = foundCat ? foundCat.name : '';
        payload.status = 'APPROVED';
      }

      // Optimistic update in UI
      setStagedRows((prev) =>
        prev.map((r) => (r._id === rowId ? { ...r, ...payload } : r))
      );

      await statementImportAPI.updateBatchRow(activeBatchId, rowId, payload);
    } catch (err) {
      console.error('Failed to update staged row:', err);
    }
  };

  // Bulk Row Actions
  const handleToggleSelectAll = () => {
    if (selectedRowIds.size === stagedRows.length) {
      setSelectedRowIds(new Set());
    } else {
      const allIds = new Set(stagedRows.filter((r) => r.status !== 'POSTED').map((r) => r._id));
      setSelectedRowIds(allIds);
    }
  };

  const handleToggleRowSelection = (id) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkApprove = async () => {
    const ids = Array.from(selectedRowIds);
    if (!ids.length) return;
    try {
      await statementImportAPI.bulkUpdateRows(activeBatchId, {
        rowIds: ids,
        updates: { status: 'APPROVED', isExcluded: false },
      });
      await loadBatchRows(activeBatchId);
    } catch (err) {
      console.error('Failed bulk approve:', err);
    }
  };

  const handleBulkExcludeDuplicates = async () => {
    const dupIds = stagedRows.filter((r) => r.isDuplicate && r.status !== 'POSTED').map((r) => r._id);
    if (!dupIds.length) return;
    try {
      await statementImportAPI.bulkUpdateRows(activeBatchId, {
        rowIds: dupIds,
        updates: { isExcluded: true, status: 'SKIPPED' },
      });
      await loadBatchRows(activeBatchId);
    } catch (err) {
      console.error('Failed bulk exclude duplicates:', err);
    }
  };

  // Commit Approved Rows to Ledger in safe chunked batches
  const handleConfirmPost = async () => {
    if (!activeBatchId) return;

    // Filter down to rows that are actually eligible to post (unposted & not excluded)
    const allSelected = Array.from(selectedRowIds);
    const unpostedIds =
      stagedRows.length > 0
        ? stagedRows
            .filter((r) => selectedRowIds.has(r._id) && r.status !== 'POSTED' && !r.isExcluded)
            .map((r) => r._id)
        : allSelected;

    if (unpostedIds.length === 0) {
      setPostResult({
        error:
          'No unposted transactions are currently selected. All selected rows are either already posted or excluded.',
      });
      return;
    }

    setPostingLoading(true);
    setPostResult(null);

    const CHUNK_SIZE = 35;
    const chunks = [];
    for (let i = 0; i < unpostedIds.length; i += CHUNK_SIZE) {
      chunks.push(unpostedIds.slice(i, i + CHUNK_SIZE));
    }

    let totalPosted = 0;
    let totalFailed = 0;
    const allErrors = [];

    setPostingProgress({
      current: 0,
      total: unpostedIds.length,
      percent: 0,
      chunk: 1,
      totalChunks: chunks.length,
      message: `Preparing to post ${unpostedIds.length} transactions across ${chunks.length} batches...`,
    });

    try {
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        setPostingProgress({
          current: totalPosted,
          total: unpostedIds.length,
          percent: Math.round((totalPosted / unpostedIds.length) * 100),
          chunk: i + 1,
          totalChunks: chunks.length,
          message: `Posting batch ${i + 1} of ${chunks.length} (${totalPosted} of ${unpostedIds.length} posted)...`,
        });

        const res = await statementImportAPI.postBatch(activeBatchId, {
          rowIds: chunk,
        });

        if (res?.success && res.data) {
          totalPosted += res.data.postedCount || 0;
          totalFailed += res.data.failedCount || 0;
          if (res.data.errors && res.data.errors.length > 0) {
            allErrors.push(...res.data.errors);
          }
        } else {
          throw new Error(res?.message || `Failed to post batch ${i + 1}`);
        }

        setPostingProgress({
          current: totalPosted,
          total: unpostedIds.length,
          percent: Math.round((totalPosted / unpostedIds.length) * 100),
          chunk: i + 1,
          totalChunks: chunks.length,
          message: `Batch ${i + 1} of ${chunks.length} posted successfully!`,
        });
      }

      if (totalPosted === 0 && totalFailed > 0) {
        const firstErr = allErrors[0]?.error || 'Failed to post selected transactions.';
        setPostResult({
          error: `Posting failed: ${totalFailed} transaction(s) could not be posted. Reason: ${firstErr}`,
          failedCount: totalFailed,
          errors: allErrors,
        });
      } else {
        setPostResult({
          success: true,
          postedCount: totalPosted,
          failedCount: totalFailed,
          errors: allErrors,
        });
      }

      // Reload rows & refresh reconciliation
      await loadBatchRows(activeBatchId);
      await loadReconciliation();
      await loadBatchHistory();
    } catch (err) {
      console.error('Batch post chunking error:', err);
      setPostResult({
        error: err.response?.data?.message || err.message || 'Failed while posting transaction batches.',
        postedCount: totalPosted,
      });
      // Still reload whatever was posted so far so the UI updates
      await loadBatchRows(activeBatchId);
      await loadReconciliation();
    } finally {
      setPostingLoading(false);
    }
  };

  // Cancel Batch
  const handleCancelBatch = async (batchId) => {
    if (!window.confirm('Are you sure you want to cancel this statement import? Unposted staged rows will be discarded.')) {
      return;
    }
    try {
      await statementImportAPI.cancelBatch(batchId);
      if (activeBatchId === batchId) {
        setActiveBatchId(null);
        setBatchData(null);
        setStagedRows([]);
        setActiveTab('history');
      }
      await loadBatchHistory();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to cancel batch.');
    }
  };

  // Reverse Batch
  const handleReverseBatch = async (batchId) => {
    if (!window.confirm('Are you sure you want to reverse all posted transactions from this statement batch? All created ledger entries will be securely voided and bank balances will be restored.')) {
      return;
    }
    try {
      setPostingLoading(true);
      const res = await statementImportAPI.reverseBatch(batchId);
      if (res?.success) {
        alert(res.message || 'Statement batch reversed successfully.');
        if (activeBatchId === batchId) {
          await loadBatchRows(batchId);
          await loadReconciliation();
        }
        await loadBatchHistory();
      }
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to reverse batch.');
    } finally {
      setPostingLoading(false);
    }
  };

  // Delete Statement Import Batch
  const handleDeleteBatch = async (batchId) => {
    const targetBatch = batchesList.find((b) => b._id === batchId) || (activeBatchId === batchId ? batchData : null);
    const hasPosted = (targetBatch?.postedRows || 0) > 0;
    const confirmMsg = hasPosted
      ? `Are you sure you want to PERMANENTLY DELETE this bank statement batch?\n\nWARNING: This batch has ${targetBatch.postedRows} posted transaction(s). Deleting it will automatically REVERSE and void all associated Central Ledger transactions and restore bank balances before deleting the import records.`
      : 'Are you sure you want to PERMANENTLY DELETE this bank statement batch and all its staged rows? This action cannot be undone.';

    if (!window.confirm(confirmMsg)) {
      return;
    }

    try {
      setPostingLoading(true);
      const res = await statementImportAPI.deleteBatch(batchId);
      if (res?.success) {
        alert(res.message || 'Statement batch deleted successfully.');
        if (activeBatchId === batchId) {
          setActiveBatchId(null);
          setBatchData(null);
          setStagedRows([]);
          setActiveTab('history');
        }
        await loadBatchHistory();
        await loadReconciliation();
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to delete statement batch.';
      if (msg.toLowerCase().includes('not found')) {
        alert('This statement batch has already been deleted or does not exist.');
        if (activeBatchId === batchId) {
          setActiveBatchId(null);
          setBatchData(null);
          setStagedRows([]);
          setActiveTab('history');
        }
        await loadBatchHistory();
      } else {
        alert(msg);
      }
    } finally {
      setPostingLoading(false);
    }
  };

  // Summary Metrics for Active Batch
  const approvedCount = stagedRows.filter((r) => r.status === 'APPROVED' && !r.isExcluded).length;
  const duplicateCount = stagedRows.filter((r) => r.isDuplicate).length;
  const postedCount = stagedRows.filter((r) => r.status === 'POSTED').length;
  const needsReviewCount = stagedRows.filter((r) => r.status === 'NEEDS_REVIEW' && !r.isExcluded).length;

  const totalInflows = stagedRows
    .filter((r) => selectedRowIds.has(r._id) && r.direction === 'IN' && !r.isExcluded && r.status !== 'POSTED')
    .reduce((sum, r) => sum + r.amount, 0);

  const totalOutflows = stagedRows
    .filter((r) => selectedRowIds.has(r._id) && r.direction === 'OUT' && !r.isExcluded && r.status !== 'POSTED')
    .reduce((sum, r) => sum + r.amount, 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-4">
      {/* Top Header & Bank Selector Banner */}
      <div className="p-4 sm:p-6 rounded-2xl dashboard-header-banner space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30">
                <ShieldCheck className="w-3.5 h-3.5" />
                Zero External AI · 100% Deterministic Engine
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30">
                GBP (£) UK
              </span>
              {selectedCompany?.name && (
                <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30">
                  {selectedCompany.name}
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/60 shadow-xs shrink-0">
                <FileUp className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <span>Bank Statement Import &amp; Reconciliation</span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium max-w-3xl">
              Upload Excel or CSV bank statements for <strong className="text-slate-900 dark:text-white font-bold">{selectedCompany?.name || 'Active Company'}</strong>, auto-classify rent receipts, mortgage servicing, and property expenses, and post directly to the Central Ledger.
            </p>
          </div>

          {/* Target Bank Account Selector Card */}
          <div className="bg-slate-50/90 dark:bg-slate-900/90 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs min-w-[300px] shrink-0">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Target Bank Account</span>
              <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 lowercase">reconciliation target</span>
            </label>
            <div className="relative">
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full appearance-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded-xl px-3.5 py-2.5 pr-9 text-xs sm:text-sm font-semibold border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-xs"
              >
                {accounts.length === 0 ? (
                  <option value="">No bank accounts available</option>
                ) : (
                  accounts.map((acc) => (
                    <option key={acc._id} value={acc._id}>
                      {acc.name} ({acc.accountNumber || 'Primary'} · {formatGBP(acc.currentBalance)})
                    </option>
                  ))
                )}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Tab Navigation Navigation Bar */}
        <div className="flex items-center gap-1.5 sm:gap-2 pt-3 border-t border-slate-200/70 dark:border-slate-800/80 overflow-x-auto pb-0.5">
          {[
            { id: 'upload', label: '1. Upload & Map Statement', icon: FileSpreadsheet },
            {
              id: 'review',
              label: '2. Review & Classify',
              icon: Sliders,
              badge: activeBatchId ? stagedRows.length : null,
            },
            { id: 'reconciliation', label: '3. Bank Reconciliation', icon: CheckCircle2 },
            { id: 'history', label: '4. Import History', icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === 'review' && activeBatchId) {
                    loadBatchRows(activeBatchId);
                  }
                }}
                className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 ring-1 ring-indigo-500'
                    : 'bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700/60 shadow-2xs'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.badge !== null && tab.badge !== undefined && (
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-extrabold ${
                      isActive ? 'bg-white text-indigo-700' : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: UPLOAD & COLUMN MAPPING */}
      {activeTab === 'upload' && (
        <div className="space-y-6">
          {/* File Dropzone Card */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-3xl p-8 md:p-12 text-center transition cursor-pointer ${
              dragActive
                ? 'border-indigo-500 bg-indigo-500/10'
                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/60 hover:border-indigo-400'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => handleFileSelect(e.target.files?.[0])}
              className="hidden"
            />
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner">
                {previewLoading ? (
                  <Loader2 className="w-8 h-8 animate-spin" />
                ) : (
                  <FileUp className="w-8 h-8" />
                )}
              </div>
              <div className="space-y-1">
                <p className="text-base font-bold text-slate-800 dark:text-slate-100">
                  {uploadFile ? uploadFile.name : 'Click to upload or drag & drop bank statement'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Excel files (.xlsx, .xls) and CSV (.csv) up to 15MB. Evaluated locally on secure UK backend.
                </p>
              </div>
              {uploadFile && (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                  {(uploadFile.size / 1024).toFixed(1)} KB selected
                </div>
              )}
            </div>
          </div>

          {uploadError && (
            <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium">{uploadError}</p>
            </div>
          )}

          {/* Duplicate File Warning Banner */}
          {previewData?.isDuplicateFile && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />
              <div className="text-sm">
                <strong>Duplicate Statement Detected:</strong> A statement with the identical digital fingerprint was previously uploaded on{' '}
                {previewData.existingBatchDate ? formatUKDate(previewData.existingBatchDate) : 'earlier date'}.
                The duplicate protection engine will identify any already-posted transactions during classification.
              </div>
            </div>
          )}

          {/* Preview & Column Mapper */}
          {previewData && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-indigo-500" />
                    Column Mapper & File Overview
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Detected {previewData.totalRows} raw rows. Verify columns or adjust mapping before classification.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleProcessUpload}
                    disabled={submittingProcess}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-600/30 transition disabled:opacity-60 cursor-pointer"
                  >
                    {submittingProcess ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Classifying...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Process & Classify Statement</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Statement Balances & Date Bounds Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                    Opening Balance
                  </span>
                  <span className="text-lg font-bold text-slate-900 dark:text-white">
                    {previewData.openingBalance !== null ? formatGBP(previewData.openingBalance) : 'N/A'}
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                    Closing Balance
                  </span>
                  <span className="text-lg font-bold text-slate-900 dark:text-white">
                    {previewData.closingBalance !== null ? formatGBP(previewData.closingBalance) : 'N/A'}
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                    Statement Period
                  </span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    {previewData.statementPeriodStart ? formatUKDate(previewData.statementPeriodStart) : '—'} to{' '}
                    {previewData.statementPeriodEnd ? formatUKDate(previewData.statementPeriodEnd) : '—'}
                  </span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                    Total Transactions
                  </span>
                  <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                    {previewData.totalRows}
                  </span>
                </div>
              </div>

              {/* Multi-Sheet Selector if multiple worksheets exist */}
              {previewData.sheetsList && previewData.sheetsList.length > 1 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/60">
                  <div className="flex items-center gap-2.5">
                    <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white">Workbook Worksheet</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">Multiple worksheets found. Select sheet to process:</div>
                    </div>
                  </div>
                  <select
                    value={selectedSheetName || previewData.sheetName}
                    onChange={(e) => handleSheetChange(e.target.value)}
                    className="bg-white dark:bg-slate-900 border border-indigo-300 dark:border-indigo-700 rounded-xl px-3 py-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {previewData.sheetsList.map((s, idx) => (
                      <option key={idx} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Column Selectors Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Date Column *
                  </label>
                  <select
                    value={columnMapping.dateCol}
                    onChange={(e) =>
                      setColumnMapping({ ...columnMapping, dateCol: parseInt(e.target.value, 10) })
                    }
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold"
                  >
                    <option value={-1}>-- Not Mapped --</option>
                    {previewData.detectedHeaders.map((h, idx) => (
                      <option key={idx} value={idx}>
                        Col {idx + 1}: {h || `(Column ${idx + 1})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Description / Memo *
                  </label>
                  <select
                    value={columnMapping.descCol}
                    onChange={(e) =>
                      setColumnMapping({ ...columnMapping, descCol: parseInt(e.target.value, 10) })
                    }
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold"
                  >
                    <option value={-1}>-- Not Mapped --</option>
                    {previewData.detectedHeaders.map((h, idx) => (
                      <option key={idx} value={idx}>
                        Col {idx + 1}: {h || `(Column ${idx + 1})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Head Column
                  </label>
                  <select
                    value={columnMapping.headCol}
                    onChange={(e) =>
                      setColumnMapping({ ...columnMapping, headCol: parseInt(e.target.value, 10) })
                    }
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold"
                  >
                    <option value={-1}>-- Not Mapped --</option>
                    {previewData.detectedHeaders.map((h, idx) => (
                      <option key={idx} value={idx}>
                        Col {idx + 1}: {h || `(Column ${idx + 1})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Sub Head Column
                  </label>
                  <select
                    value={columnMapping.subHeadCol}
                    onChange={(e) =>
                      setColumnMapping({ ...columnMapping, subHeadCol: parseInt(e.target.value, 10) })
                    }
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold"
                  >
                    <option value={-1}>-- Not Mapped --</option>
                    {previewData.detectedHeaders.map((h, idx) => (
                      <option key={idx} value={idx}>
                        Col {idx + 1}: {h || `(Column ${idx + 1})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Paid Out (Debit)
                  </label>
                  <select
                    value={columnMapping.debitCol}
                    onChange={(e) =>
                      setColumnMapping({ ...columnMapping, debitCol: parseInt(e.target.value, 10) })
                    }
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold"
                  >
                    <option value={-1}>-- Not Mapped --</option>
                    {previewData.detectedHeaders.map((h, idx) => (
                      <option key={idx} value={idx}>
                        Col {idx + 1}: {h || `(Column ${idx + 1})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Paid In (Credit)
                  </label>
                  <select
                    value={columnMapping.creditCol}
                    onChange={(e) =>
                      setColumnMapping({ ...columnMapping, creditCol: parseInt(e.target.value, 10) })
                    }
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold"
                  >
                    <option value={-1}>-- Not Mapped --</option>
                    {previewData.detectedHeaders.map((h, idx) => (
                      <option key={idx} value={idx}>
                        Col {idx + 1}: {h || `(Column ${idx + 1})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Running Balance
                  </label>
                  <select
                    value={columnMapping.balanceCol}
                    onChange={(e) =>
                      setColumnMapping({ ...columnMapping, balanceCol: parseInt(e.target.value, 10) })
                    }
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold"
                  >
                    <option value={-1}>-- Not Mapped --</option>
                    {previewData.detectedHeaders.map((h, idx) => (
                      <option key={idx} value={idx}>
                        Col {idx + 1}: {h || `(Column ${idx + 1})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Original Narrative / Payee
                  </label>
                  <select
                    value={columnMapping.originalNarrativeCol}
                    onChange={(e) =>
                      setColumnMapping({
                        ...columnMapping,
                        originalNarrativeCol: parseInt(e.target.value, 10),
                      })
                    }
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold"
                  >
                    <option value={-1}>-- Not Mapped --</option>
                    {previewData.detectedHeaders.map((h, idx) => (
                      <option key={idx} value={idx}>
                        Col {idx + 1}: {h || `(Column ${idx + 1})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Reference / Check #
                  </label>
                  <select
                    value={columnMapping.refCol}
                    onChange={(e) =>
                      setColumnMapping({ ...columnMapping, refCol: parseInt(e.target.value, 10) })
                    }
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold"
                  >
                    <option value={-1}>-- Not Mapped --</option>
                    {previewData.detectedHeaders.map((h, idx) => (
                      <option key={idx} value={idx}>
                        Col {idx + 1}: {h || `(Column ${idx + 1})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Single Signed Amount
                  </label>
                  <select
                    value={columnMapping.amountCol}
                    onChange={(e) =>
                      setColumnMapping({ ...columnMapping, amountCol: parseInt(e.target.value, 10) })
                    }
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-semibold"
                  >
                    <option value={-1}>-- Not Mapped (Using Separate In/Out) --</option>
                    {previewData.detectedHeaders.map((h, idx) => (
                      <option key={idx} value={idx}>
                        Col {idx + 1}: {h || `(Column ${idx + 1})`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Sample Preview Rows Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-2.5">Row</th>
                      <th className="px-3 py-2.5">Date</th>
                      <th className="px-3 py-2.5">Description</th>
                      <th className="px-3 py-2.5">Original Narrative</th>
                      <th className="px-3 py-2.5">Head</th>
                      <th className="px-3 py-2.5">Sub Head</th>
                      <th className="px-3 py-2.5 text-right">Debit (Out)</th>
                      <th className="px-3 py-2.5 text-right">Credit (In)</th>
                      <th className="px-3 py-2.5 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {previewData.previewRows.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-3 py-2 text-slate-400 font-mono">#{r.rowIndex}</td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                          {r.transactionDate ? formatUKDate(r.transactionDate) : '—'}
                        </td>
                        <td className="px-3 py-2 text-slate-900 dark:text-white max-w-xs truncate font-semibold">
                          {r.description}
                        </td>
                        <td className="px-3 py-2 text-slate-500 dark:text-slate-400 max-w-xs truncate text-[11px]">
                          {r.originalNarrative || '—'}
                        </td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-200 whitespace-nowrap">
                          {r.head ? (
                            <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-semibold text-[11px]">
                              {r.head}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400 text-[11px] whitespace-nowrap">
                          {r.subHead || '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-rose-600 dark:text-rose-400">
                          {r.direction === 'OUT' ? formatGBP(r.amount) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                          {r.direction === 'IN' ? formatGBP(r.amount) : '—'}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300">
                          {r.runningBalance !== null ? formatGBP(r.runningBalance) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: STAGED TRANSACTIONS REVIEW & CLASSIFICATION */}
      {activeTab === 'review' && (
        <div className="space-y-4">
          {!activeBatchId ? (
            <div className="p-12 text-center rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <FileSpreadsheet className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">No Statement Batch Loaded</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 mb-5">
                Upload a bank statement in Tab 1 or pick an existing import batch from Import History to review.
              </p>
              <button
                onClick={() => setActiveTab('upload')}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow cursor-pointer"
              >
                Go to Statement Upload
              </button>
            </div>
          ) : (
            <>
              {/* Batch Overview & Filter Controls Header */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                        Batch #{activeBatchId.slice(-6)}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="text-xs text-slate-500 font-medium">{batchData?.filename}</span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                          batchData?.status === 'POSTED'
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                        }`}
                      >
                        {batchData?.status || 'DRAFT'}
                      </span>
                    </div>
                    <h2 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
                      Staged Transactions Review ({totalStagedCount} items)
                    </h2>
                  </div>

                  {/* Bulk Actions & Post Button */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleBulkApprove}
                      disabled={selectedRowIds.size === 0}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Approve Selected ({selectedRowIds.size})
                    </button>

                    {duplicateCount > 0 && (
                      <button
                        onClick={handleBulkExcludeDuplicates}
                        className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                      >
                        <X className="w-3.5 h-3.5" />
                        Exclude All Duplicates ({duplicateCount})
                      </button>
                    )}

                    {batchData?.postedRows > 0 && (
                      <button
                        onClick={() => handleReverseBatch(activeBatchId)}
                        disabled={postingLoading}
                        className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${postingLoading ? 'animate-spin' : ''}`} />
                        Reverse Posted ({batchData.postedRows})
                      </button>
                    )}

                    <button
                      onClick={() => setShowPostModal(true)}
                      disabled={selectedRowIds.size === 0}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Post Selected to Ledger ({selectedRowIds.size})
                    </button>

                    <button
                      onClick={() => handleDeleteBatch(activeBatchId)}
                      disabled={postingLoading}
                      className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-rose-100 hover:text-rose-700 text-slate-700 dark:bg-slate-800 dark:hover:bg-rose-950/60 dark:hover:text-rose-300 dark:text-slate-300 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                      title="Permanently delete this statement batch"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                      Delete Batch
                    </button>
                  </div>
                </div>

                {/* Filter Chips & Search Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[
                      { id: 'ALL', label: `All (${stagedRows.length})` },
                      { id: 'APPROVED', label: `Approved (${approvedCount})` },
                      { id: 'NEEDS_REVIEW', label: `Needs Review (${needsReviewCount})` },
                      { id: 'POSSIBLE_DUPLICATE', label: `Duplicates (${duplicateCount})` },
                      { id: 'POSTED', label: `Posted (${postedCount})` },
                    ].map((chip) => (
                      <button
                        key={chip.id}
                        onClick={() => {
                          setStatusFilter(chip.id);
                          loadBatchRows(activeBatchId, chip.id, searchTerm);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                          statusFilter === chip.id
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                        }`}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>

                  <div className="relative min-w-[240px]">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search narrative, property..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        loadBatchRows(activeBatchId, statusFilter, e.target.value);
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Transactions Review Grid */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
                {rowsLoading ? (
                  <div className="p-16 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">Loading staged records...</p>
                  </div>
                ) : stagedRows.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 text-sm">
                    No transactions match the selected filter.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider sticky top-0 z-10">
                        <tr>
                          <th className="px-3 py-3 w-10 text-center">
                            <input
                              type="checkbox"
                              checked={
                                selectedRowIds.size > 0 &&
                                selectedRowIds.size ===
                                  stagedRows.filter((r) => r.status !== 'POSTED').length
                              }
                              onChange={handleToggleSelectAll}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            />
                          </th>
                          <th className="px-2 py-3 w-12 text-slate-400 font-mono text-[10px]">#Row</th>
                          <th className="px-3 py-3 w-24">Date</th>
                          <th className="px-3 py-3 min-w-[200px]">Memo</th>
                          <th className="px-3 py-3 w-28">Head</th>
                          <th className="px-3 py-3 w-28">Sub Head</th>
                          <th className="px-3 py-3 text-right w-24">Payments</th>
                          <th className="px-3 py-3 text-right w-24">Receipts</th>
                          <th className="px-3 py-3 text-right w-24">Balance</th>
                          <th className="px-3 py-3 w-32">Type</th>
                          <th className="px-3 py-3 min-w-[150px]">Property</th>
                          <th className="px-3 py-3 min-w-[140px]">Category</th>
                          <th className="px-3 py-3 w-28">Status</th>
                          <th className="px-3 py-3 text-center w-12">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                        {stagedRows.map((row) => {
                          const isSelected = selectedRowIds.has(row._id);
                          const isRowExcluded = row.isExcluded;
                          const isPosted = row.status === 'POSTED';

                          return (
                            <tr
                              key={row._id}
                              className={`transition ${
                                isPosted
                                  ? 'bg-purple-50/40 dark:bg-purple-950/20 opacity-80'
                                  : isRowExcluded
                                  ? 'bg-slate-50/60 dark:bg-slate-900/40 line-through text-slate-400'
                                  : isSelected
                                  ? 'bg-indigo-50/40 dark:bg-indigo-950/20'
                                  : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                              }`}
                            >
                              {/* Selection Checkbox */}
                              <td className="px-3 py-3 text-center">
                                <input
                                  type="checkbox"
                                  disabled={isPosted || isRowExcluded}
                                  checked={isSelected}
                                  onChange={() => handleToggleRowSelection(row._id)}
                                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-40"
                                />
                              </td>

                              {/* Row Index */}
                              <td className="px-2 py-3 text-slate-400 font-mono text-[11px]">
                                #{row.excelRowNumber || row.rowIndex}
                              </td>

                              {/* Date */}
                              <td className="px-3 py-3 font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                {row.transactionDate ? formatUKDate(row.transactionDate) : '—'}
                              </td>

                              {/* Narrative & Original Description */}
                              <td className="px-3 py-3 max-w-sm">
                                <div className="font-bold text-slate-900 dark:text-white truncate" title={row.description}>
                                  {row.description}
                                </div>
                                {row.originalNarrative && row.originalNarrative !== row.description && (
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate" title={row.originalNarrative}>
                                    {row.originalNarrative}
                                  </div>
                                )}
                                {row.reference && (
                                  <span className="inline-block mt-0.5 text-[10px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.2 rounded">
                                    Ref: {row.reference}
                                  </span>
                                )}
                              </td>

                              {/* Head */}
                              <td className="px-3 py-3 text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">
                                <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold">
                                  {row.head || row.suggestedHead || '—'}
                                </span>
                              </td>

                              {/* Sub Head */}
                              <td className="px-3 py-3 text-slate-600 dark:text-slate-400 font-medium whitespace-nowrap">
                                <span className="text-[11px]">
                                  {row.subHead || row.suggestedSubHead || '—'}
                                </span>
                              </td>

                              {/* Payments (Debit/Out) */}
                              <td className="px-3 py-3 text-right font-mono text-rose-600 dark:text-rose-400 font-semibold whitespace-nowrap">
                                {row.direction === 'OUT' ? formatGBP(row.amount) : '—'}
                              </td>

                              {/* Receipts (Credit/In) */}
                              <td className="px-3 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold whitespace-nowrap">
                                {row.direction === 'IN' ? formatGBP(row.amount) : '—'}
                              </td>

                              {/* Statement Balance */}
                              <td className="px-3 py-3 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                {row.runningBalance !== null && row.runningBalance !== undefined ? formatGBP(row.runningBalance) : '—'}
                              </td>

                              {/* Classification Type Selector */}
                              <td className="px-3 py-3">
                                {isPosted ? (
                                  <span className="font-bold text-slate-700 dark:text-slate-300">
                                    {row.suggestedType}
                                  </span>
                                ) : (
                                  <select
                                    value={row.suggestedType}
                                    onChange={(e) =>
                                      handleUpdateRow(row._id, 'suggestedType', e.target.value)
                                    }
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  >
                                    <option value="RENT">Rent (Income)</option>
                                    <option value="EXPENSE">Expense</option>
                                    <option value="MORTGAGE_PAYMENT">Mortgage Servicing</option>
                                    <option value="TRANSFER">Internal Transfer</option>
                                    <option value="UNCATEGORIZED">Uncategorized</option>
                                  </select>
                                )}
                              </td>

                              {/* Property Selector */}
                              <td className="px-3 py-3">
                                {isPosted ? (
                                  <span className="text-slate-700 dark:text-slate-300 truncate block max-w-[180px]">
                                    {row.suggestedPropertyName || '—'}
                                  </span>
                                ) : (
                                  <select
                                    value={row.suggestedPropertyId?._id || row.suggestedPropertyId || ''}
                                    onChange={(e) =>
                                      handleUpdateRow(row._id, 'suggestedPropertyId', e.target.value)
                                    }
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 truncate"
                                  >
                                    <option value="">-- No Property --</option>
                                    {properties.map((p) => (
                                      <option key={p._id} value={p._id}>
                                        {p.title || p.addressLine1}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </td>

                              {/* Category Selector */}
                              <td className="px-3 py-3">
                                {isPosted ? (
                                  <span className="text-slate-700 dark:text-slate-300 truncate block max-w-[160px]">
                                    {row.suggestedCategoryName || '—'}
                                  </span>
                                ) : (
                                  <select
                                    value={row.suggestedCategoryId?._id || row.suggestedCategoryId || ''}
                                    onChange={(e) =>
                                      handleUpdateRow(row._id, 'suggestedCategoryId', e.target.value)
                                    }
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 truncate"
                                  >
                                    <option value="">-- General Head --</option>
                                    {categories.map((c) => (
                                      <option key={c._id} value={c._id}>
                                        {c.name}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </td>

                              {/* Status Badge & Tooltip */}
                              <td className="px-3 py-3 whitespace-nowrap">
                                {isPosted ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Posted
                                  </span>
                                ) : row.isDuplicate ? (
                                  <span
                                    title={row.duplicateReason}
                                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 cursor-help"
                                  >
                                    <AlertTriangle className="w-3 h-3" />
                                    Duplicate
                                  </span>
                                ) : row.status === 'APPROVED' ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                    <Check className="w-3 h-3" />
                                    Approved
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                                    <HelpCircle className="w-3 h-3" />
                                    Review
                                  </span>
                                )}
                              </td>

                              {/* Include / Exclude Toggle */}
                              <td className="px-3 py-3 text-center">
                                {!isPosted && (
                                  <button
                                    onClick={() =>
                                      handleUpdateRow(row._id, 'isExcluded', !row.isExcluded)
                                    }
                                    title={row.isExcluded ? 'Re-include row' : 'Exclude row'}
                                    className={`p-1 rounded-md transition cursor-pointer ${
                                      row.isExcluded
                                        ? 'text-slate-400 hover:text-emerald-600 bg-slate-100 dark:bg-slate-800'
                                        : 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                                    }`}
                                  >
                                    {row.isExcluded ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 3: BANK RECONCILIATION SUMMARY */}
      {activeTab === 'reconciliation' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  Bank Statement vs Central Ledger Reconciliation
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Mathematical proof of account liquidity, opening/closing verification, and variance detection.
                </p>
              </div>

              <button
                onClick={loadReconciliation}
                disabled={reconciliationLoading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${reconciliationLoading ? 'animate-spin' : ''}`} />
                <span>Refresh Reconciliation</span>
              </button>
            </div>

            {reconciliationLoading ? (
              <div className="p-16 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
                <p className="text-xs text-slate-500">Calculating bank reconciliation...</p>
              </div>
            ) : !reconciliationData ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                Select an account and import batch to generate reconciliation.
              </div>
            ) : (
              <div className="space-y-6">
                {/* Variance Status Pill Card */}
                <div
                  className={`p-6 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    reconciliationData.isBalanced
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100'
                      : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                        reconciliationData.isBalanced
                          ? 'bg-emerald-600 text-white'
                          : 'bg-amber-600 text-white'
                      }`}
                    >
                      {reconciliationData.isBalanced ? (
                        <Check className="w-7 h-7" />
                      ) : (
                        <AlertTriangle className="w-7 h-7" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-lg font-extrabold">
                        {reconciliationData.isBalanced
                          ? 'RECONCILED & BALANCED'
                          : 'DISCREPANCY / VARIANCE DETECTED'}
                      </h4>
                      <p className="text-xs opacity-85">
                        {reconciliationData.isBalanced
                          ? 'Statement closing balance equals the central ledger balance exactly (£0.00 difference).'
                          : `There is a £${Math.abs(reconciliationData.variance).toFixed(2)} variance between the statement closing balance and the system ledger.`}
                      </p>
                    </div>
                  </div>

                  <div className="text-right sm:border-l sm:border-current/20 sm:pl-6">
                    <span className="text-xs uppercase tracking-wider block opacity-75 font-bold">
                      Variance
                    </span>
                    <span className="text-2xl font-black font-mono">
                      {formatGBP(reconciliationData.variance)}
                    </span>
                  </div>
                </div>

                {/* Comparative Breakdown Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Statement Card */}
                  <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3">
                    <h5 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-indigo-500" />
                      Bank Statement Figures
                    </h5>
                    <div className="divide-y divide-slate-200/60 dark:divide-slate-700/60 text-xs">
                      <div className="py-2 flex justify-between">
                        <span className="text-slate-500">Statement Opening Balance</span>
                        <span className="font-bold font-mono">
                          {reconciliationData.statementOpeningBalance !== null
                            ? formatGBP(reconciliationData.statementOpeningBalance)
                            : 'N/A'}
                        </span>
                      </div>
                      <div className="py-2 flex justify-between text-emerald-600 dark:text-emerald-400">
                        <span>Total Receipts (Money In)</span>
                        <span className="font-bold font-mono">
                          +{formatGBP(reconciliationData.statementTotalIn)}
                        </span>
                      </div>
                      <div className="py-2 flex justify-between text-rose-600 dark:text-rose-400">
                        <span>Total Payments (Money Out)</span>
                        <span className="font-bold font-mono">
                          -{formatGBP(reconciliationData.statementTotalOut)}
                        </span>
                      </div>
                      <div className="py-2.5 flex justify-between font-bold text-slate-900 dark:text-white text-sm">
                        <span>Statement Closing Balance</span>
                        <span className="font-mono">
                          {reconciliationData.statementClosingBalance !== null
                            ? formatGBP(reconciliationData.statementClosingBalance)
                            : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* System Ledger Card */}
                  <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3">
                    <h5 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-emerald-500" />
                      Authoritative Central Ledger
                    </h5>
                    <div className="divide-y divide-slate-200/60 dark:divide-slate-700/60 text-xs">
                      <div className="py-2 flex justify-between">
                        <span className="text-slate-500">System Opening Balance</span>
                        <span className="font-bold font-mono">
                          {formatGBP(reconciliationData.systemOpeningBalance)}
                        </span>
                      </div>
                      <div className="py-2 flex justify-between text-emerald-600 dark:text-emerald-400">
                        <span>Posted Ledger Inflows</span>
                        <span className="font-bold font-mono">
                          +{formatGBP(reconciliationData.ledgerTotalIn)}
                        </span>
                      </div>
                      <div className="py-2 flex justify-between text-rose-600 dark:text-rose-400">
                        <span>Posted Ledger Outflows</span>
                        <span className="font-bold font-mono">
                          -{formatGBP(reconciliationData.ledgerTotalOut)}
                        </span>
                      </div>
                      <div className="py-2.5 flex justify-between font-bold text-slate-900 dark:text-white text-sm">
                        <span>System Current Balance</span>
                        <span className="font-mono">
                          {formatGBP(reconciliationData.systemCurrentBalance)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: IMPORT BATCH HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-500" />
                  Statement Import Batches
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Audit log of statement uploads for {selectedCompany?.name || 'this company'}.
                </p>
              </div>

              <button
                onClick={loadBatchHistory}
                disabled={historyLoading}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${historyLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {historyLoading ? (
              <div className="p-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
                <p className="text-xs text-slate-500">Loading batch history...</p>
              </div>
            ) : batchesList.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-sm">
                No bank statements have been uploaded for this company yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Import Date</th>
                      <th className="px-4 py-3">Statement Filename</th>
                      <th className="px-4 py-3">Bank Account</th>
                      <th className="px-4 py-3 text-center">Total Rows</th>
                      <th className="px-4 py-3 text-center">Posted</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {batchesList.map((b) => (
                      <tr key={b._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">
                          {formatUKDate(b.createdAt)}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                          {b.filename}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          {b.accountId?.name || 'Primary Bank Account'}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-slate-700 dark:text-slate-300">
                          {b.totalRows}
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-indigo-600 dark:text-indigo-400">
                          {b.postedRows}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              b.status === 'POSTED'
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                                : b.status === 'CANCELLED'
                                ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                            }`}
                          >
                            {b.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setActiveBatchId(b._id);
                                setActiveTab('review');
                                loadBatchRows(b._id);
                              }}
                              className="px-3 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold hover:bg-indigo-100 transition cursor-pointer"
                            >
                              Review
                            </button>
                            {b.postedRows > 0 && (
                              <button
                                onClick={() => handleReverseBatch(b._id)}
                                className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 font-semibold hover:bg-amber-100 transition cursor-pointer"
                              >
                                Reverse
                              </button>
                            )}
                            {b.status !== 'POSTED' && b.status !== 'CANCELLED' && b.postedRows === 0 && (
                              <button
                                onClick={() => handleCancelBatch(b._id)}
                                className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 font-semibold hover:bg-rose-100 transition cursor-pointer"
                              >
                                Cancel
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteBatch(b._id)}
                              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-rose-100 hover:text-rose-700 text-slate-600 dark:bg-slate-800 dark:hover:bg-rose-950 dark:hover:text-rose-300 dark:text-slate-400 font-semibold transition cursor-pointer flex items-center gap-1"
                              title="Permanently delete this statement batch"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL BEFORE POSTING TO CENTRAL LEDGER */}
      {showPostModal && (
        <ModalPortal>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                  <ShieldCheck className="w-6 h-6" />
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Confirm Central Ledger Posting
                  </h3>
                </div>
                <button
                  onClick={() => {
                    if (!postingLoading) {
                      setShowPostModal(false);
                      setPostingProgress(null);
                      setPostResult(null);
                    }
                  }}
                  disabled={postingLoading}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer disabled:opacity-40"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-300">
                You are about to commit{' '}
                <strong>
                  {stagedRows.filter((r) => selectedRowIds.has(r._id) && r.status !== 'POSTED' && !r.isExcluded)
                    .length || selectedRowIds.size}{' '}
                  transactions
                </strong>{' '}
                to the authoritative Central Ledger. This will create official financial vouchers and adjust the bank account liquidity.
              </p>

              {/* Financial Impact Breakdown Card */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-2 text-xs">
                <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400 font-bold">
                  <span>Total Inflow (Receipts):</span>
                  <span className="font-mono text-sm">+{formatGBP(totalInflows)}</span>
                </div>
                <div className="flex justify-between items-center text-rose-600 dark:text-rose-400 font-bold">
                  <span>Total Outflow (Payments):</span>
                  <span className="font-mono text-sm">-{formatGBP(totalOutflows)}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center font-extrabold text-slate-900 dark:text-white">
                  <span>Net Liquidity Adjustment:</span>
                  <span className="font-mono text-sm">
                    {formatGBP(totalInflows - totalOutflows)}
                  </span>
                </div>
              </div>

              {/* Live Chunking Progress Bar */}
              {postingLoading && postingProgress && (
                <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 space-y-2.5">
                  <div className="flex justify-between items-center text-xs font-bold text-indigo-700 dark:text-indigo-300">
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400" />
                      {postingProgress.message || 'Posting to Central Ledger...'}
                    </span>
                    <span className="font-mono">{postingProgress.percent}%</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${Math.min(100, Math.max(5, postingProgress.percent))}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
                    Posting safely in streaming chunks to guarantee zero timeouts and preserve ledger integrity.
                  </div>
                </div>
              )}

              {postResult?.error && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{postResult.error}</span>
                </div>
              )}

              {postResult?.success && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>Successfully posted {postResult.postedCount} transactions!</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPostModal(false);
                    setPostingProgress(null);
                    setPostResult(null);
                  }}
                  disabled={postingLoading}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-40"
                >
                  {postResult?.success ? 'Close' : 'Cancel'}
                </button>
                {!postResult?.success && (
                  <button
                    type="button"
                    onClick={handleConfirmPost}
                    disabled={postingLoading}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition disabled:opacity-50 cursor-pointer"
                  >
                    {postingLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Posting to Ledger...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Confirm & Post Now</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}

export default StatementImportPage;
