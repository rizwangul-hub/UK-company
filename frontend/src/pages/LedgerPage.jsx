import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Building2,
  Landmark,
  Coins,
  Users,
  Percent,
  Receipt,
  CalendarCheck,
  CircleDollarSign,
  Layers,
  Search,
  Calendar,
  RefreshCw,
  Eye,
  Download,
  Printer,
  X,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  Filter,
  Plus,
  Edit3,
  Loader2,
  FileSpreadsheet,
  FileText,
  CheckSquare,
  Square,
  Check,
  Paperclip,
} from 'lucide-react';
import { ledgerAPI, accountsAPI, reportsAPI, getApiCache } from '../services/api.js';
import { formatGBP, formatUKDate } from '../utils/formatters.js';
import SingleVoucherPrintModal from '../components/SingleVoucherPrintModal.jsx';
import ReportExportModal from '../components/ReportExportModal.jsx';
import pixxLogo from '../assets/logo.png';

const LEDGER_TYPES = [
  { id: 'BANK', label: 'Bank Accounts', icon: Landmark, desc: 'NatWest, Barclays, Lloyds' },
  { id: 'CASH', label: 'Cash in Hand', icon: Coins, desc: 'Petty Cash & Floats' },
  { id: 'PROPERTY', label: 'Properties', icon: Building2, desc: 'Property P&L & Cash Flow' },
  { id: 'TENANT', label: 'Tenants', icon: Users, desc: 'Rent Arrears & Receipts' },
  { id: 'MORTGAGE', label: 'Mortgages', icon: Percent, desc: 'Loan Debt & Principal Repayment' },
  { id: 'ACCOUNT_HEAD', label: 'Expense Heads', icon: Receipt, desc: 'Repairs, Insurance, Agent, Gas/EICR' },
  { id: 'RENT', label: 'Rent Journal', icon: CalendarCheck, desc: 'Invoicing vs Collections' },
  { id: 'OTHER_INCOME', label: 'Other Income', icon: CircleDollarSign, desc: 'Parking, Recharges, Sundry' },
  { id: 'CONSOLIDATED', label: 'Master Journal', icon: BookOpen, desc: 'All Double-Entry Transactions' },
];

export function LedgerPage({ selectedCompany }) {
  const cachedEntities = getApiCache('/ledger/entities');
  const [ledgerType, setLedgerType] = useState('BANK');
  const [entitiesMap, setEntitiesMap] = useState(cachedEntities?.data || {
    bankAccounts: [],
    cashAccounts: [],
    properties: [],
    tenants: [],
    mortgages: [],
    expenseHeads: [],
    incomeHeads: [],
  });

  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [datePreset, setDatePreset] = useState('THIS_MONTH');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [ledgerData, setLedgerData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingEntities, setLoadingEntities] = useState(!cachedEntities?.data);
  const [errorMsg, setErrorMsg] = useState('');

  // Active Voucher Modal
  const [activeVoucher, setActiveVoucher] = useState(null);

  // Auxiliary data for Voucher editing
  const [categoriesList, setCategoriesList] = useState([]);
  const [accountsList, setAccountsList] = useState([]);

  // Edit Voucher Modal
  const [editingVoucher, setEditingVoucher] = useState(null);
  const [editVoucherSubmitting, setEditVoucherSubmitting] = useState(false);
  const [editVoucherError, setEditVoucherError] = useState('');
  const [editVoucherForm, setEditVoucherForm] = useState({
    amount: '',
    narration: '',
    reference: '',
    transactionDate: '',
    categoryId: '',
    accountId: '',
  });

  // Load all entities
  const loadEntities = async (force = false) => {
    try {
      if (!cachedEntities?.data || force) {
        setLoadingEntities(true);
      }
      setErrorMsg('');
      const res = await ledgerAPI.getEntities({}, { forceRefresh: force });
      if (res?.success && res.data) {
        setEntitiesMap(res.data);
      }
    } catch (err) {
      console.error('Failed to load ledger entities:', err);
      setErrorMsg('Failed to fetch ledger entity lists from backend.');
    } finally {
      setLoadingEntities(false);
    }
  };

  const loadAuxData = async () => {
    try {
      const [catsRes, accsRes] = await Promise.all([
        ledgerAPI.getCategories(),
        accountsAPI.getAll(),
      ]);
      if (catsRes?.success) setCategoriesList(catsRes.data.categories || []);
      if (accsRes?.success) setAccountsList(accsRes.data.accounts || []);
    } catch (err) {
      console.error('Failed to load aux lists for voucher edit:', err);
    }
  };

  useEffect(() => {
    loadEntities();
    loadAuxData();
  }, []);

  const handleOpenEditVoucher = (tx) => {
    setEditingVoucher(tx);
    setEditVoucherError('');
    setEditVoucherForm({
      amount: String(tx.amount || tx.debit || tx.credit || ''),
      narration: tx.detail || tx.narration || '',
      reference: tx.reference || '',
      transactionDate: tx.date ? new Date(tx.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      categoryId: tx.categoryId || '',
      accountId: tx.accountId || '',
    });
  };

  const handleEditVoucherSubmit = async (e) => {
    e.preventDefault();
    if (!editingVoucher) return;
    setEditVoucherSubmitting(true);
    setEditVoucherError('');
    try {
      await ledgerAPI.updateTransaction(editingVoucher._id, {
        amount: Number(editVoucherForm.amount) || 0,
        narration: editVoucherForm.narration,
        reference: editVoucherForm.reference,
        transactionDate: editVoucherForm.transactionDate,
        categoryId: editVoucherForm.categoryId || undefined,
        accountId: editVoucherForm.accountId || undefined,
      });
      setEditingVoucher(null);
      if (activeVoucher && activeVoucher._id === editingVoucher._id) {
        setActiveVoucher(null);
      }
      fetchLedger();
    } catch (err) {
      setEditVoucherError(err.response?.data?.message || 'Failed to update voucher.');
    } finally {
      setEditVoucherSubmitting(false);
    }
  };

  // Determine selectable list based on ledgerType
  const getCurrentEntityList = () => {
    switch (ledgerType) {
      case 'BANK':
        return entitiesMap.bankAccounts || [];
      case 'CASH':
        return entitiesMap.cashAccounts || [];
      case 'PROPERTY':
        return entitiesMap.properties || [];
      case 'TENANT':
        return entitiesMap.tenants || [];
      case 'MORTGAGE':
        return entitiesMap.mortgages || [];
      case 'ACCOUNT_HEAD':
        return entitiesMap.expenseHeads || [];
      case 'OTHER_INCOME':
        return entitiesMap.incomeHeads || [];
      case 'RENT':
      case 'CONSOLIDATED':
      default:
        return [];
    }
  };

  const currentEntityList = getCurrentEntityList();

  // Reset or select default entity when switching tabs
  useEffect(() => {
    if (ledgerType === 'RENT' || ledgerType === 'CONSOLIDATED') {
      setSelectedEntityId('');
    } else if (currentEntityList.length > 0) {
      // Keep selected if valid in new list, else pick first
      const exists = currentEntityList.some((e) => String(e.id) === String(selectedEntityId));
      if (!exists) {
        setSelectedEntityId(String(currentEntityList[0].id));
      }
    } else {
      setSelectedEntityId('');
    }
  }, [ledgerType, entitiesMap]);

  // Query Ledger
  const fetchLedger = async () => {
    try {
      setLoading(true);
      setErrorMsg('');

      const res = await ledgerAPI.queryLedger({
        type: ledgerType,
        entityId: selectedEntityId || undefined,
        datePreset,
        startDate: datePreset === 'CUSTOM' ? startDate : undefined,
        endDate: datePreset === 'CUSTOM' ? endDate : undefined,
        search: searchQuery || undefined,
      });

      if (res?.success) {
        setLedgerData(res.data);
      } else {
        setLedgerData(null);
        setErrorMsg(res?.message || 'Failed to query entity ledger.');
      }
    } catch (err) {
      console.error('Failed to query ledger:', err);
      setErrorMsg(err.response?.data?.message || err.message || 'Error querying ledger from server.');
      setLedgerData(null);
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch when core filters change
  useEffect(() => {
    if (
      ledgerType === 'RENT' ||
      ledgerType === 'CONSOLIDATED' ||
      selectedEntityId ||
      currentEntityList.length === 0
    ) {
      fetchLedger();
    }
  }, [ledgerType, selectedEntityId, datePreset]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchLedger();
  };

  // Export current table view as CSV
  const handleExportCSV = () => {
    if (!ledgerData || !ledgerData.entries || ledgerData.entries.length === 0) return;

    const headers = [
      'Date',
      'Voucher No',
      'Detail',
      'Head / Category',
      'Debit Account',
      'Credit Account',
      'Debit (£)',
      'Credit (£)',
      'Running Balance (£)',
      'Property',
      'Tenant',
      'Reference',
    ];

    const rows = ledgerData.entries.map((tx) => [
      tx.date ? new Date(tx.date).toISOString().slice(0, 10) : '',
      `"${tx.voucherNo || ''}"`,
      `"${(tx.detail || '').replace(/"/g, '""')}"`,
      `"${tx.categoryName || ''}"`,
      `"${tx.drAccount || ''}"`,
      `"${tx.crAccount || ''}"`,
      Number(tx.debit || 0).toFixed(2),
      Number(tx.credit || 0).toFixed(2),
      Number(tx.runningBalance || 0).toFixed(2),
      `"${tx.propertyName || ''}"`,
      `"${tx.tenantName || ''}"`,
      `"${tx.reference || ''}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const cleanTitle = (ledgerData.ledgerTitle || 'Ledger').replace(/[^a-zA-Z0-9_-]/g, '_');
    const compPrefix = selectedCompany?.slug ? `${selectedCompany.slug}_` : 'UK_';
    link.setAttribute('download', `${compPrefix}Ledger_${cleanTitle}_${datePreset}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --------------------------------------------------------------------------
  // Upgraded Professional Reporting & Row Selection Suite
  // --------------------------------------------------------------------------
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState([]);
  const [directExporting, setDirectExporting] = useState(false);

  // Clear selections when switching scope, entity or dates
  useEffect(() => {
    setSelectedRowIds([]);
  }, [ledgerType, selectedEntityId, datePreset]);

  const toggleSelectRow = (id) => {
    if (!id || String(id).startsWith('TENANT_ROW_')) return;
    setSelectedRowIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (!ledgerData?.entries || ledgerData.entries.length === 0) return;
    const allValidIds = ledgerData.entries
      .map((e) => e._id)
      .filter((id) => id && !String(id).startsWith('TENANT_ROW_'));
    if (selectedRowIds.length === allValidIds.length) {
      setSelectedRowIds([]);
    } else {
      setSelectedRowIds(allValidIds);
    }
  };

  const handleExportDirect = async (type, useSelected = false) => {
    try {
      setDirectExporting(true);
      const payload = {
        scope: useSelected ? 'SELECTED' : (ledgerType === 'CONSOLIDATED' ? 'COMPLETE' : ledgerType),
        entityId: useSelected ? undefined : (selectedEntityId || undefined),
        datePreset,
        startDate: datePreset === 'CUSTOM' ? startDate : undefined,
        endDate: datePreset === 'CUSTOM' ? endDate : undefined,
        search: searchQuery || undefined,
      };
      if (useSelected) {
        payload.selectedIds = selectedRowIds;
      }
      if (type === 'excel') {
        await reportsAPI.downloadLedgerExcel(payload);
      } else {
        await reportsAPI.downloadLedgerPdf(payload);
      }
    } catch (err) {
      console.error('Direct export failed:', err);
      alert(err.message || 'Export failed. Please check parameters.');
    } finally {
      setDirectExporting(false);
    }
  };

  const summary = ledgerData?.summary || {
    openingBalance: 0,
    totalDebit: 0,
    totalCredit: 0,
    closingBalance: 0,
    entryCount: 0,
  };

  const entries = ledgerData?.entries || [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header & Professional Reporting Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl dashboard-header-banner">
        <div>
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-xl bg-slate-900/90 border border-slate-700/60 flex items-center justify-center p-1.5 shadow-md shrink-0">
              <img src={pixxLogo} alt="Pixx Technologies Logo" className="h-full w-full object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  {selectedCompany?.name ? `${selectedCompany.name} Financial Ledgers` : 'UK Multi-Entity Financial Ledgers'}
                </h1>
                {selectedCompany?.legalName && (
                  <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {selectedCompany.legalName}
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5 max-w-3xl">
                {selectedCompany?.name ? `Complete general and nominal ledgers partitioned strictly for ${selectedCompany.name}.` : 'Individual Dedicated Ledgers • Bank Accounts, Cash Floats, Properties, Tenants, Mortgages & Nominal Heads'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Advanced Report & Preview Studio Trigger */}
          <button
            onClick={() => setIsReportModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs shadow-lg shadow-indigo-600/20 transition cursor-pointer"
            title="Open comprehensive pre-export preview & custom report studio"
          >
            <FileText size={15} />
            <span>Export &amp; Preview Report</span>
          </button>

          {/* Quick Excel Export */}
          <button
            onClick={() => handleExportDirect('excel', false)}
            disabled={!ledgerData || directExporting}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs shadow-sm shadow-emerald-600/20 transition cursor-pointer"
            title="Download formatted Excel (.xlsx) statement for current view"
          >
            <FileSpreadsheet size={15} />
            <span>Excel (.xlsx)</span>
          </button>

          {/* Quick PDF Export */}
          <button
            onClick={() => handleExportDirect('pdf', false)}
            disabled={!ledgerData || directExporting}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 border border-slate-700/60 disabled:opacity-40 text-white font-bold text-xs shadow-sm transition cursor-pointer"
            title="Download vector landscape PDF audit report for current view"
          >
            <FileText size={15} />
            <span>PDF (A4)</span>
          </button>

          <button
            onClick={fetchLedger}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 font-bold text-xs shadow-sm transition cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-indigo-600' : ''} />
            Refresh
          </button>

          <button
            onClick={handleExportCSV}
            disabled={!ledgerData}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 font-bold text-xs shadow-sm transition cursor-pointer"
          >
            <Download size={13} />
            CSV
          </button>

          <button
            onClick={() => window.print()}
            disabled={!ledgerData}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 font-bold text-xs shadow-sm transition cursor-pointer"
          >
            <Printer size={13} />
            Print
          </button>
        </div>
      </div>

      {/* Ledger Type Segmented Switcher */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-1.5">
          {LEDGER_TYPES.map((tab) => {
            const Icon = tab.icon;
            const isActive = ledgerType === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setLedgerType(tab.id)}
                className={`flex flex-col items-center justify-center py-2.5 px-2 rounded-xl text-center transition-all cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'} />
                <span className="text-[11px] font-black mt-1 leading-tight">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter & Selector Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Entity Selector */}
          <div className="lg:col-span-2">
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {ledgerType === 'RENT'
                ? 'Rent Scope'
                : ledgerType === 'CONSOLIDATED'
                ? 'Master Journal Scope'
                : `Select Specific ${LEDGER_TYPES.find((t) => t.id === ledgerType)?.label || 'Entity'}`}
            </label>
            <select
              value={selectedEntityId}
              onChange={(e) => setSelectedEntityId(e.target.value)}
              disabled={loadingEntities || ledgerType === 'RENT' || ledgerType === 'CONSOLIDATED'}
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800/40"
            >
              {ledgerType === 'RENT' ? (
                <option value="">★ Entire Portfolio Rent Journal (Consolidated Invoices &amp; Receipts)</option>
              ) : ledgerType === 'CONSOLIDATED' ? (
                <option value="">★ All Nominal Accounts &amp; Cash Accounts (Consolidated Journal)</option>
              ) : currentEntityList.length === 0 ? (
                <option value="">{loadingEntities ? 'Loading UK entities...' : 'No entities configured'}</option>
              ) : (
                currentEntityList.map((item) => (
                  <option key={String(item.id)} value={String(item.id)}>
                    {item.name} {item.subtext ? ` — (${item.subtext})` : ''}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Date Period Selector */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Financial Period
            </label>
            <select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="THIS_MONTH">This Month</option>
              <option value="PREVIOUS_MONTH">Previous Month</option>
              <option value="TODAY">Today</option>
              <option value="THIS_WEEK">This Week</option>
              <option value="CUSTOM">Custom Date Range</option>
              <option value="ALL">All Time (Full Ledger History)</option>
            </select>
          </div>

          {/* Search Query */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Voucher / Detail Search
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Voucher #, narration, payee..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="submit"
                className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition flex items-center justify-center cursor-pointer"
              >
                <Search size={14} />
              </button>
            </div>
          </div>
        </form>

        {/* Custom Date Pickers */}
        {datePreset === 'CUSTOM' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 font-medium text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 font-medium text-slate-900 dark:text-white"
              />
            </div>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs font-bold flex items-center gap-2">
          <X size={16} className="text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Active Ledger Title & Executive KPI Strip */}
      {ledgerData && (
        <>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-2">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                  {ledgerData.ledgerTitle}
                </h3>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                  {ledgerData.entitySubtext}
                </div>
              </div>
              <div className="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 self-start sm:self-auto">
                Filter: <span className="text-indigo-600 dark:text-indigo-400 font-black">{ledgerData.datePreset}</span>
              </div>
            </div>

            {/* 4 Summary KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* 1. Opening Balance */}
              <div className="executive-card rounded-2xl p-4 sm:p-5 relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-medium uppercase tracking-wider">Opening Balance</span>
                  <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                    <FileText size={15} />
                  </div>
                </div>
                <div className="font-display text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight tabular-nums">
                  {formatGBP(summary.openingBalance)}
                </div>
                <div className="text-[11px] text-slate-400 mt-1 font-medium">
                  Brought forward
                </div>
              </div>

              {/* 2. Total Inflow / Debit */}
              <div className="executive-card rounded-2xl p-4 sm:p-5 relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-medium uppercase tracking-wider flex items-center gap-1">
                    {ledgerData.isLiquidity ? 'Total Receipts (In)' : 'Total Debit (Dr)'}
                  </span>
                  <div className={`p-1.5 rounded-lg ${ledgerData.isLiquidity ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                    {ledgerData.isLiquidity ? (
                      <ArrowDownLeft size={15} />
                    ) : (
                      <ArrowUpRight size={15} />
                    )}
                  </div>
                </div>
                <div
                  className={`font-display text-xl sm:text-2xl font-extrabold tracking-tight tabular-nums ${
                    ledgerData.isLiquidity ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {formatGBP(summary.totalDebit)}
                </div>
                <div className="text-[11px] text-slate-400 mt-1 font-medium">
                  Period additions
                </div>
              </div>

              {/* 3. Total Outflow / Credit */}
              <div className="executive-card rounded-2xl p-4 sm:p-5 relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-medium uppercase tracking-wider flex items-center gap-1">
                    {ledgerData.isLiquidity ? 'Total Payments (Out)' : 'Total Credit (Cr)'}
                  </span>
                  <div className={`p-1.5 rounded-lg ${ledgerData.isLiquidity ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                    {ledgerData.isLiquidity ? (
                      <ArrowUpRight size={15} />
                    ) : (
                      <ArrowDownLeft size={15} />
                    )}
                  </div>
                </div>
                <div
                  className={`font-display text-xl sm:text-2xl font-extrabold tracking-tight tabular-nums ${
                    ledgerData.isLiquidity ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {formatGBP(summary.totalCredit)}
                </div>
                <div className="text-[11px] text-slate-400 mt-1 font-medium">
                  Period deductions
                </div>
              </div>

              {/* 4. Closing Balance */}
              <div className="executive-card rounded-2xl p-4 sm:p-5 relative overflow-hidden border-indigo-500/40">
                <div className="flex items-center justify-between text-indigo-400 mb-2">
                  <span className="text-xs font-medium uppercase tracking-wider">Closing Balance</span>
                  <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300">
                    <Sparkles size={15} />
                  </div>
                </div>
                <div className="font-display text-xl sm:text-2xl font-extrabold text-indigo-900 dark:text-indigo-200 tracking-tight tabular-nums">
                  {formatGBP(summary.closingBalance)}
                </div>
                <div className="text-[11px] text-indigo-400/80 mt-1 font-medium">
                  Net carried forward
                </div>
              </div>
            </div>
          </div>

          {/* Chronological Table of Entries */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-2">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Chronological Transaction Register ({summary.entryCount || entries.length} Entries)
                </h3>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Official UK Double-Entry Records &bull; {ledgerData.ledgerTitle}
                </span>
              </div>
            </div>

            {/* Selected Rows Quick Action Banner */}
            {selectedRowIds.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/40 border-2 border-indigo-500/40 text-xs font-bold text-indigo-900 dark:text-indigo-200">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[11px] font-black">
                    {selectedRowIds.length}
                  </span>
                  <span>Transactions Selected for Targeted Audit Export</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleExportDirect('excel', true)}
                    disabled={directExporting}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <FileSpreadsheet size={13} />
                    Export Selected Excel
                  </button>
                  <button
                    onClick={() => handleExportDirect('pdf', true)}
                    disabled={directExporting}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <FileText size={13} />
                    Export Selected PDF
                  </button>
                  <button
                    onClick={() => setIsReportModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eye size={13} />
                    Preview Report
                  </button>
                  <button
                    onClick={() => setSelectedRowIds([])}
                    className="px-2.5 py-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-xs font-bold transition cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <div className="py-16 text-center text-xs text-slate-500 font-bold flex items-center justify-center gap-2">
                <RefreshCw size={18} className="animate-spin text-indigo-600" />
                Querying database transactions...
              </div>
            ) : entries.length === 0 ? (
              <div className="py-16 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                <BookOpen size={32} className="mx-auto text-slate-400 mb-2.5" />
                <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  No transactions found for this ledger head.
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  No financial postings match the selected entity and date filter.
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 uppercase font-black border-b border-slate-200 dark:border-slate-700 tracking-wider">
                    <tr>
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={
                            entries.length > 0 &&
                            selectedRowIds.length ===
                              entries.filter((e) => !String(e._id).startsWith('TENANT_ROW_')).length
                          }
                          onChange={toggleSelectAll}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4"
                          title="Select / Deselect all rows"
                        />
                      </th>
                      <th className="p-3 whitespace-nowrap">Date</th>
                      <th className="p-3 whitespace-nowrap">Voucher No</th>
                      <th className="p-3">Particulars / Narration</th>
                      <th className="p-3">Nominal Head</th>
                      <th className="p-3">Dr Account</th>
                      <th className="p-3">Cr Account</th>
                      <th className="p-3 text-right">Debit (£)</th>
                      <th className="p-3 text-right">Credit (£)</th>
                      <th className="p-3 text-right">Running Total (£)</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-semibold text-slate-900 dark:text-slate-100">
                    {entries.map((tx) => {
                      const isSelected = selectedRowIds.includes(tx._id);
                      const isSelectable = !String(tx._id).startsWith('TENANT_ROW_');
                      return (
                        <tr
                          key={tx._id}
                          className={`transition ${
                            isSelected
                              ? 'bg-indigo-50/70 dark:bg-indigo-950/40'
                              : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <td className="p-3 text-center">
                            {isSelectable && (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectRow(tx._id)}
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4"
                              />
                            )}
                          </td>
                          <td className="p-3 whitespace-nowrap text-slate-600 dark:text-slate-400 font-mono">
                            {formatUKDate(tx.date)}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <button
                              onClick={() => setActiveVoucher(tx)}
                              className="font-mono font-black text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                            >
                              {tx.voucherNo}
                            </button>
                          </td>
                        <td className="p-3 max-w-xs">
                          <div className="font-bold text-slate-900 dark:text-white truncate">
                            {tx.detail || 'General transaction'}
                          </div>
                          {(tx.propertyName || tx.tenantName) && (
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5 flex flex-wrap items-center gap-1">
                              {tx.propertyName && (
                                <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                  {tx.propertyName}
                                </span>
                              )}
                              {tx.tenantName && (
                                <span className="px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300">
                                  {tx.tenantName}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700">
                            {tx.categoryName || 'General'}
                          </span>
                        </td>
                        <td className="p-3 whitespace-nowrap text-slate-600 dark:text-slate-400">
                          {tx.drAccount || '-'}
                        </td>
                        <td className="p-3 whitespace-nowrap text-slate-600 dark:text-slate-400">
                          {tx.crAccount || '-'}
                        </td>
                        <td className="p-3 whitespace-nowrap text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                          {tx.debit > 0 ? formatGBP(tx.debit) : '-'}
                        </td>
                        <td className="p-3 whitespace-nowrap text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                          {tx.credit > 0 ? formatGBP(tx.credit) : '-'}
                        </td>
                        <td className="p-3 whitespace-nowrap text-right font-mono font-extrabold text-indigo-600 dark:text-indigo-400">
                          {formatGBP(tx.runningBalance)}
                        </td>
                        <td className="p-3 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {tx.receiptUrl && (
                              <a
                                href={tx.receiptUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white transition"
                                title={`View Attached Receipt: ${tx.receiptFilename || 'Document'}`}
                              >
                                <Paperclip size={13} />
                              </a>
                            )}
                            <button
                              onClick={() => setActiveVoucher(tx)}
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-600 dark:text-slate-300 transition cursor-pointer"
                              title="Inspect Voucher"
                            >
                              <Eye size={13} />
                            </button>
                            {tx._id && !String(tx._id).startsWith('TENANT_ROW_') && (
                              <button
                                onClick={() => handleOpenEditVoucher(tx)}
                                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-amber-600 hover:text-white text-slate-600 dark:text-slate-300 transition cursor-pointer"
                                title="Edit Voucher"
                              >
                                <Edit3 size={13} />
                              </button>
                            )}
                          </div>
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

      {/* Voucher Detail Print Modal */}
      {activeVoucher && (
        <SingleVoucherPrintModal
          voucher={activeVoucher}
          selectedCompany={selectedCompany}
          onClose={() => setActiveVoucher(null)}
          onEdit={
            activeVoucher._id && !String(activeVoucher._id).startsWith('TENANT_ROW_')
              ? (v) => handleOpenEditVoucher(v)
              : undefined
          }
        />
      )}

      {/* Edit Voucher Modal */}
      {editingVoucher && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">Edit Financial Voucher</h2>
                  <p className="text-[11px] font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {editingVoucher.voucherNo}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingVoucher(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editVoucherError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs">
                {editVoucherError}
              </div>
            )}

            <form onSubmit={handleEditVoucherSubmit} className="mt-4 space-y-3.5 text-xs">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <label className="block text-emerald-600 dark:text-emerald-400 font-bold mb-1">
                  Voucher Amount (£)
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editVoucherForm.amount}
                  onChange={(e) => setEditVoucherForm({ ...editVoucherForm, amount: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-emerald-500/30 rounded-lg px-3 py-2 text-emerald-600 dark:text-emerald-300 font-mono font-bold text-sm focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  Account balance will be automatically adjusted based on amount difference.
                </p>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Narration / Detail
                </label>
                <textarea
                  rows="2"
                  required
                  value={editVoucherForm.narration}
                  onChange={(e) => setEditVoucherForm({ ...editVoucherForm, narration: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                    Transaction Date
                  </label>
                  <input
                    type="date"
                    required
                    value={editVoucherForm.transactionDate}
                    onChange={(e) => setEditVoucherForm({ ...editVoucherForm, transactionDate: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                    Reference / Invoice #
                  </label>
                  <input
                    type="text"
                    value={editVoucherForm.reference}
                    onChange={(e) => setEditVoucherForm({ ...editVoucherForm, reference: e.target.value })}
                    placeholder="INV-1234"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {categoriesList.length > 0 && (
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                    Nominal Category Head
                  </label>
                  <select
                    value={editVoucherForm.categoryId}
                    onChange={(e) => setEditVoucherForm({ ...editVoucherForm, categoryId: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer"
                  >
                    <option value="">-- Keep Current Category --</option>
                    {categoriesList.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name} ({c.type})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {accountsList.length > 0 && (
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                    Bank / Liquidity Account
                  </label>
                  <select
                    value={editVoucherForm.accountId}
                    onChange={(e) => setEditVoucherForm({ ...editVoucherForm, accountId: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer"
                  >
                    <option value="">-- Keep Current Bank Account --</option>
                    {accountsList.map((a) => (
                      <option key={a._id} value={a._id}>
                        {a.name} ({a.bankName || a.accountType})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingVoucher(null)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editVoucherSubmitting}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {editVoucherSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Voucher Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upgraded Multi-Scope Report & Pre-Export Preview Modal */}
      <ReportExportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        selectedCompany={selectedCompany}
        initialScope={
          selectedRowIds.length > 0
            ? 'SELECTED'
            : ledgerType === 'CONSOLIDATED'
            ? 'COMPLETE'
            : ledgerType
        }
        initialEntityId={selectedEntityId}
        initialDatePreset={datePreset}
        initialStartDate={startDate}
        initialEndDate={endDate}
        selectedTxIds={selectedRowIds}
        entitiesMap={entitiesMap}
      />
    </div>
  );
}

export default LedgerPage;
