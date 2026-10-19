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
  ChevronDown,
  ArrowLeft,
  ExternalLink,
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
  Sparkles,
  Trash2,
  History,
} from 'lucide-react';
import { ledgerAPI, accountsAPI, reportsAPI, getApiCache } from '../services/api.js';
import { formatGBP, formatUKDate } from '../utils/formatters.js';
import SingleVoucherPrintModal from '../components/SingleVoucherPrintModal.jsx';
import ReportExportModal from '../components/ReportExportModal.jsx';
import EditTransactionModal from '../components/EditTransactionModal.jsx';
import DeleteConfirmModal from '../components/DeleteConfirmModal.jsx';
import TransactionAuditModal from '../components/TransactionAuditModal.jsx';
import pixxLogo from '../assets/logo.png';

const LEDGER_TYPES = [
  { id: 'HEAD', label: 'Heads & Sub Heads', icon: Layers, desc: 'Interactive Summary & Drilldown Ledger' },
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

export function formatPropertyType(p) {
  if (!p) return 'Property';
  if (p.propertyType && !p.propertyType.includes('Units') && !p.propertyType.includes('London')) {
    const raw = p.propertyType.trim();
    if (['COMMERCIAL_RESIDENTIAL_MIXED'].includes(raw.toUpperCase())) return 'Mixed (Shop & Flat)';
    if (['MULTI_UNIT_RESIDENTIAL'].includes(raw.toUpperCase())) return 'Multi-Unit Flats';
    if (['FLAT', 'FLAT_APARTMENT', 'APARTMENT'].includes(raw.toUpperCase())) return 'Flat';
    if (['SHOP'].includes(raw.toUpperCase())) return 'Shop';
    if (['HOUSE', 'RESIDENTIAL_TERRACED', 'TERRACED_HOUSE', 'SEMI_DETACHED', 'DETACHED'].includes(raw.toUpperCase())) return 'House';
    if (['COMMERCIAL', 'COMMERCIAL_OFFICE', 'OFFICE'].includes(raw.toUpperCase())) return 'Commercial';
    if (['HMO', 'ROOM_HMO'].includes(raw.toUpperCase())) return 'HMO';
    if (raw.toUpperCase() !== 'OTHER' && raw.toUpperCase() !== 'RESIDENTIAL') return raw;
  }
  const nameLower = (p.name || '').toLowerCase();
  if (nameLower.includes('-shop') || nameLower.startsWith('shop') || nameLower.includes(' shop')) {
    return 'Shop';
  }
  if (
    nameLower.includes('-flat') ||
    nameLower.includes('flat ') ||
    nameLower.includes(' flat') ||
    nameLower.includes('ground floor') ||
    nameLower.includes('1st floor') ||
    nameLower.includes('first floor') ||
    nameLower.includes('2nd floor') ||
    nameLower.includes('second floor') ||
    nameLower.includes('basement')
  ) {
    return 'Flat';
  }
  if (p.subtext && !p.subtext.includes('Units') && !p.subtext.includes('London')) {
    return p.subtext;
  }
  return 'House';
}

export function LedgerPage({ selectedCompany }) {
  const cachedEntities = getApiCache('/ledger/entities');
  const [ledgerType, setLedgerType] = useState('HEAD');
  const [entitiesMap, setEntitiesMap] = useState(cachedEntities?.data || {
    bankAccounts: [],
    cashAccounts: [],
    properties: [],
    tenants: [],
    mortgages: [],
    expenseHeads: [],
    incomeHeads: [],
    heads: [],
    subHeads: [],
  });

  const [selectedEntityId, setSelectedEntityId] = useState('');
  const [datePreset, setDatePreset] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Head & Sub Head Interactive Summary & Drilldown State
  const [headViewMode, setHeadViewMode] = useState('SUMMARY'); // 'SUMMARY' | 'DRILLDOWN'
  const [drilldownHead, setDrilldownHead] = useState(null);
  const [drilldownSubHead, setDrilldownSubHead] = useState(null);
  const [headSummaryData, setHeadSummaryData] = useState(null);
  const [loadingHeadSummary, setLoadingHeadSummary] = useState(false);
  const [expandedHeads, setExpandedHeads] = useState(new Set());

  const [ledgerData, setLedgerData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingEntities, setLoadingEntities] = useState(!cachedEntities?.data);
  const [errorMsg, setErrorMsg] = useState('');

  // Active Voucher Modal
  const [activeVoucher, setActiveVoucher] = useState(null);

  // Auxiliary data
  const [categoriesList, setCategoriesList] = useState([]);
  const [accountsList, setAccountsList] = useState([]);

  // Transaction Management Modals (Edit, Delete, Audit)
  const [editModalTx, setEditModalTx] = useState(null);
  const [deleteModalTx, setDeleteModalTx] = useState(null);
  const [auditModalTx, setAuditModalTx] = useState(null);

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

  // Determine selectable list based on ledgerType
  const getCurrentEntityList = () => {
    switch (ledgerType) {
      case 'HEAD':
        return entitiesMap.heads || [];
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
    if (ledgerType === 'RENT' || ledgerType === 'CONSOLIDATED' || ledgerType === 'HEAD') {
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

  // Load Head & Sub Head Summary
  const loadHeadSummary = async () => {
    try {
      setLoadingHeadSummary(true);
      setErrorMsg('');
      const res = await ledgerAPI.getHeadSummary({
        datePreset,
        startDate: datePreset === 'CUSTOM' ? startDate : undefined,
        endDate: datePreset === 'CUSTOM' ? endDate : undefined,
        search: searchQuery || undefined,
      });
      if (res?.success && res.data) {
        setHeadSummaryData(res.data);
        // Expand all heads by default so user sees full hierarchy immediately
        setExpandedHeads(new Set((res.data.heads || []).map((h) => h.head)));
      } else {
        setHeadSummaryData(null);
        setErrorMsg(res?.message || 'Failed to load Head & Sub Head summary.');
      }
    } catch (err) {
      console.error('Failed to load head summary:', err);
      setErrorMsg(err.response?.data?.message || err.message || 'Error querying head summary.');
      setHeadSummaryData(null);
    } finally {
      setLoadingHeadSummary(false);
    }
  };

  // Fetch Drilldown Ledger for a specific Head or Sub Head
  const fetchDrilldownLedger = async (headName, subHeadName) => {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await ledgerAPI.queryLedger({
        type: subHeadName ? 'SUB_HEAD' : 'HEAD',
        head: headName || undefined,
        subHead: subHeadName || undefined,
        datePreset,
        startDate: datePreset === 'CUSTOM' ? startDate : undefined,
        endDate: datePreset === 'CUSTOM' ? endDate : undefined,
        search: searchQuery || undefined,
      });
      if (res?.success) {
        setLedgerData(res.data);
      } else {
        setLedgerData(null);
        setErrorMsg(res?.message || 'Failed to query drilldown ledger.');
      }
    } catch (err) {
      console.error('Failed to query drilldown ledger:', err);
      setErrorMsg(err.response?.data?.message || err.message || 'Error querying drilldown ledger.');
      setLedgerData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDrilldown = (headName, subHeadName = null) => {
    setDrilldownHead(headName || null);
    setDrilldownSubHead(subHeadName || null);
    setHeadViewMode('DRILLDOWN');
    fetchDrilldownLedger(headName, subHeadName);
  };

  const handleBackToSummary = () => {
    setHeadViewMode('SUMMARY');
    setDrilldownHead(null);
    setDrilldownSubHead(null);
    setSelectedEntityId('');
    loadHeadSummary();
  };

  const toggleHeadExpand = (headName) => {
    setExpandedHeads((prev) => {
      const next = new Set(prev);
      if (next.has(headName)) next.delete(headName);
      else next.add(headName);
      return next;
    });
  };

  const expandAllHeads = () => {
    if (!headSummaryData?.heads) return;
    setExpandedHeads(new Set(headSummaryData.heads.map((h) => h.head)));
  };

  const collapseAllHeads = () => {
    setExpandedHeads(new Set());
  };

  const handleExportSummaryCSV = () => {
    if (!headSummaryData || !headSummaryData.heads) return;
    const headers = ['Head Category', 'Sub Head', 'Transactions Count', 'Payments (£)', 'Receipts (£)', 'Net Total (£)'];
    const rows = [];
    headSummaryData.heads.forEach((h) => {
      rows.push([`"${h.head}"`, 'TOTAL (HEAD)', h.count, h.totalPayments.toFixed(2), h.totalReceipts.toFixed(2), h.net.toFixed(2)]);
      (h.subHeads || []).forEach((sh) => {
        rows.push([`"${h.head}"`, `"${sh.subHead}"`, sh.count, sh.payments.toFixed(2), sh.receipts.toFixed(2), sh.net.toFixed(2)]);
      });
    });
    rows.push(['GRAND TOTAL', '', headSummaryData.grandTotalCount, headSummaryData.grandTotalPayments.toFixed(2), headSummaryData.grandTotalReceipts.toFixed(2), headSummaryData.netLiquidity.toFixed(2)]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const compPrefix = selectedCompany?.slug ? `${selectedCompany.slug}_` : 'UK_';
    link.setAttribute('download', `${compPrefix}Head_Summary_${datePreset}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Query Ledger
  const fetchLedger = async () => {
    if (ledgerType === 'HEAD') {
      if (headViewMode === 'SUMMARY') {
        return loadHeadSummary();
      } else {
        return fetchDrilldownLedger(drilldownHead, drilldownSubHead);
      }
    }

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
      ledgerType === 'HEAD' ||
      ledgerType === 'RENT' ||
      ledgerType === 'CONSOLIDATED' ||
      selectedEntityId ||
      currentEntityList.length === 0
    ) {
      fetchLedger();
    }
  }, [ledgerType, selectedEntityId, datePreset, headViewMode]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchLedger();
  };

  // Export current table view as CSV
  const handleExportCSV = () => {
    if (ledgerType === 'HEAD' && headViewMode === 'SUMMARY') {
      return handleExportSummaryCSV();
    }
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
      const isHead = ledgerType === 'HEAD';
      const payload = {
        scope: useSelected
          ? 'SELECTED'
          : isHead
          ? (drilldownSubHead ? 'SUB_HEAD' : 'HEAD')
          : (ledgerType === 'CONSOLIDATED' ? 'COMPLETE' : ledgerType),
        entityId: useSelected ? undefined : (selectedEntityId || undefined),
        head: isHead ? (drilldownHead || undefined) : undefined,
        subHead: isHead ? (drilldownSubHead || undefined) : undefined,
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
            onClick={() => {
              if (ledgerType === 'HEAD' && headViewMode === 'SUMMARY') {
                handleExportSummaryCSV();
              } else {
                handleExportDirect('excel', false);
              }
            }}
            disabled={(!ledgerData && !headSummaryData) || directExporting}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs shadow-sm shadow-emerald-600/20 transition cursor-pointer"
            title="Download formatted Excel statement for current view"
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
            disabled={loading || loadingHeadSummary}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 font-bold text-xs shadow-sm transition cursor-pointer"
          >
            <RefreshCw size={13} className={loading || loadingHeadSummary ? 'animate-spin text-indigo-600' : ''} />
            Refresh
          </button>

          <button
            onClick={handleExportCSV}
            disabled={!ledgerData && !headSummaryData}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 font-bold text-xs shadow-sm transition cursor-pointer"
          >
            <Download size={13} />
            CSV
          </button>

          <button
            onClick={() => window.print()}
            disabled={!ledgerData && !headSummaryData}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 font-bold text-xs shadow-sm transition cursor-pointer"
          >
            <Printer size={13} />
            Print
          </button>
        </div>
      </div>

      {/* Ledger Type Segmented Switcher */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-2 shadow-sm">
        <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-1.5">
          {LEDGER_TYPES.map((tab) => {
            const Icon = tab.icon;
            const isActive = ledgerType === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setLedgerType(tab.id);
                  if (tab.id === 'HEAD') {
                    setHeadViewMode('SUMMARY');
                    setDrilldownHead(null);
                    setDrilldownSubHead(null);
                  }
                }}
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
                : ledgerType === 'HEAD'
                ? 'Head & Sub Head View / Scope'
                : `Select Specific ${LEDGER_TYPES.find((t) => t.id === ledgerType)?.label || 'Entity'}`}
            </label>
            <select
              value={selectedEntityId}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedEntityId(val);
                if (ledgerType === 'HEAD') {
                  if (!val || val === 'ALL_HEADS') {
                    handleBackToSummary();
                  } else {
                    const isSub = (entitiesMap.subHeads || []).some((s) => String(s.id) === String(val));
                    if (isSub) {
                      handleDrilldown(null, val);
                    } else {
                      handleDrilldown(val, null);
                    }
                  }
                }
              }}
              disabled={loadingEntities || ledgerType === 'RENT' || ledgerType === 'CONSOLIDATED'}
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800/40"
            >
              {ledgerType === 'RENT' ? (
                <option value="">★ Entire Portfolio Rent Journal (Consolidated Invoices &amp; Receipts)</option>
              ) : ledgerType === 'CONSOLIDATED' ? (
                <option value="">★ All Nominal Accounts &amp; Cash Accounts (Consolidated Journal)</option>
              ) : ledgerType === 'HEAD' ? (
                <>
                  <option value="">★ Interactive Pivot Reconciliation Summary (Double-click any row to drill down)</option>
                  <optgroup label="Main Nominal Heads">
                    {(entitiesMap.heads || []).map((h) => (
                      <option key={String(h.id)} value={String(h.id)}>
                        Head: {h.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Sub Heads">
                    {(entitiesMap.subHeads || []).map((sh) => (
                      <option key={String(sh.id)} value={String(sh.id)}>
                        Sub Head: {sh.name}
                      </option>
                    ))}
                  </optgroup>
                </>
              ) : currentEntityList.length === 0 ? (
                <option value="">{loadingEntities ? 'Loading UK entities...' : 'No entities configured'}</option>
              ) : (
                currentEntityList.map((item) => {
                  const subtext = ledgerType === 'PROPERTY'
                    ? (item.unitsCount > 1 ? item.subtext : formatPropertyType(item))
                    : item.subtext;
                  return (
                    <option key={String(item.id)} value={String(item.id)}>
                      {item.name} {subtext ? ` — (${subtext})` : ''}
                    </option>
                  );
                })
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

      {/* ============================================================= */}
      {/* 1. HEAD & SUB HEAD RECONCILIATION SUMMARY PIVOT TABLE         */}
      {/* ============================================================= */}
      {ledgerType === 'HEAD' && headViewMode === 'SUMMARY' && (
        <div className="space-y-6">
          {/* Executive KPI Cards for Summary */}
          {headSummaryData && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Total Receipts */}
              <div className="executive-card rounded-2xl p-4 sm:p-5 relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-medium uppercase tracking-wider flex items-center gap-1">
                    Total Receipts (In)
                  </span>
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <ArrowDownLeft size={15} />
                  </div>
                </div>
                <div className="font-display text-xl sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight tabular-nums">
                  {formatGBP(headSummaryData.grandTotalReceipts || 0)}
                </div>
                <div className="text-[11px] text-slate-400 mt-1 font-medium">
                  Income &amp; Credit Collections
                </div>
              </div>

              {/* Total Payments */}
              <div className="executive-card rounded-2xl p-4 sm:p-5 relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-medium uppercase tracking-wider flex items-center gap-1">
                    Total Payments (Out)
                  </span>
                  <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
                    <ArrowUpRight size={15} />
                  </div>
                </div>
                <div className="font-display text-xl sm:text-2xl font-extrabold text-rose-600 dark:text-rose-400 tracking-tight tabular-nums">
                  {formatGBP(headSummaryData.grandTotalPayments || 0)}
                </div>
                <div className="text-[11px] text-slate-400 mt-1 font-medium">
                  Expenses &amp; Loan Disbursements
                </div>
              </div>

              {/* Net Position */}
              <div className="executive-card rounded-2xl p-4 sm:p-5 relative overflow-hidden border-indigo-500/40">
                <div className="flex items-center justify-between text-indigo-400 mb-2">
                  <span className="text-xs font-medium uppercase tracking-wider">Net Position</span>
                  <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300">
                    <Sparkles size={15} />
                  </div>
                </div>
                <div
                  className={`font-display text-xl sm:text-2xl font-extrabold tracking-tight tabular-nums ${
                    (headSummaryData.netLiquidity || 0) >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {formatGBP(headSummaryData.netLiquidity || 0)}
                </div>
                <div className="text-[11px] text-indigo-400/80 mt-1 font-medium">
                  Receipts minus Payments
                </div>
              </div>

              {/* Total Entries */}
              <div className="executive-card rounded-2xl p-4 sm:p-5 relative overflow-hidden">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-xs font-medium uppercase tracking-wider">Total Transactions</span>
                  <div className="p-1.5 rounded-lg bg-slate-500/10 text-slate-400">
                    <BookOpen size={15} />
                  </div>
                </div>
                <div className="font-display text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight tabular-nums">
                  {headSummaryData.grandTotalCount || 0}
                </div>
                <div className="text-[11px] text-slate-400 mt-1 font-medium">
                  Across {(headSummaryData.heads || []).length} Nominal Heads
                </div>
              </div>
            </div>
          )}

          {/* Interactive Pivot Table Container */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    Bank Reconciliation Summary — Heads &amp; Sub Heads
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    Interactive Drilldown
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  Click or double-click on any row to open the full detailed transaction ledger for that Head or Sub Head.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={expandAllHeads}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  Expand All
                </button>
                <button
                  type="button"
                  onClick={collapseAllHeads}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  Collapse All
                </button>
                <button
                  type="button"
                  onClick={handleExportSummaryCSV}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  <Download size={13} />
                  Export Summary CSV
                </button>
              </div>
            </div>

            {loadingHeadSummary ? (
              <div className="py-20 text-center text-xs text-slate-500 font-bold flex items-center justify-center gap-2">
                <RefreshCw size={18} className="animate-spin text-indigo-600" />
                Aggregating Heads &amp; Sub Heads from database...
              </div>
            ) : !headSummaryData || (headSummaryData.heads || []).length === 0 ? (
              <div className="py-16 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                <Layers size={32} className="mx-auto text-slate-400 mb-2.5" />
                <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  No Head or Sub Head entries recorded.
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Upload a statement with Head &amp; Sub Head columns or record transactions to populate.
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100/90 dark:bg-slate-800 text-slate-800 dark:text-slate-200 uppercase font-black border-b border-slate-200 dark:border-slate-700 tracking-wider">
                    <tr>
                      <th className="p-3.5">Head / Sub Head Category</th>
                      <th className="p-3.5 text-center w-20">Entries</th>
                      <th className="p-3.5 text-right">Payments (£) [Out]</th>
                      <th className="p-3.5 text-right">Receipts (£) [In]</th>
                      <th className="p-3.5 text-right">Net Total (£)</th>
                      <th className="p-3.5 text-center w-36">Ledger Drilldown</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800/80 font-medium text-slate-900 dark:text-slate-100">
                    {headSummaryData.heads.map((h) => {
                      const isExpanded = expandedHeads.has(h.head);
                      const subCount = (h.subHeads || []).length;
                      return (
                        <React.Fragment key={h.head}>
                          {/* Master Head Row */}
                          <tr
                            onDoubleClick={() => handleDrilldown(h.head, null)}
                            className="bg-slate-50/90 dark:bg-slate-800/60 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30 transition-colors cursor-pointer group select-none"
                            title={`Double click to open full ${h.head} Ledger`}
                          >
                            <td className="p-3.5">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleHeadExpand(h.head);
                                  }}
                                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition"
                                  title={isExpanded ? 'Collapse Sub Heads' : 'Expand Sub Heads'}
                                >
                                  {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                                </button>
                                <span className="font-black text-sm text-slate-900 dark:text-white tracking-tight">
                                  {h.head}
                                </span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                  {subCount} {subCount === 1 ? 'Sub Head' : 'Sub Heads'}
                                </span>
                              </div>
                            </td>
                            <td className="p-3.5 text-center font-bold text-slate-600 dark:text-slate-400">
                              {h.count}
                            </td>
                            <td className="p-3.5 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                              {h.totalPayments > 0 ? formatGBP(h.totalPayments) : '-'}
                            </td>
                            <td className="p-3.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {h.totalReceipts > 0 ? formatGBP(h.totalReceipts) : '-'}
                            </td>
                            <td
                              className={`p-3.5 text-right font-mono font-extrabold ${
                                h.net > 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : h.net < 0
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              {formatGBP(h.net)}
                            </td>
                            <td className="p-3.5 text-center">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDrilldown(h.head, null);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] shadow-sm shadow-indigo-600/20 transition cursor-pointer"
                                title={`Open complete ${h.head} ledger`}
                              >
                                <span>⚡ Head Ledger</span>
                              </button>
                            </td>
                          </tr>

                          {/* Sub Head Child Rows */}
                          {isExpanded &&
                            (h.subHeads || []).map((sh) => (
                              <tr
                                key={`${h.head}-${sh.subHead}`}
                                onDoubleClick={() => handleDrilldown(h.head, sh.subHead)}
                                className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer group select-none"
                                title={`Double click to open ${sh.subHead} Ledger`}
                              >
                                <td className="p-2.5 pl-10 sm:pl-12">
                                  <div className="flex items-center gap-2">
                                    <span className="text-slate-300 dark:text-slate-600 font-mono text-xs select-none">
                                      └─
                                    </span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                                      {sh.subHead}
                                    </span>
                                  </div>
                                </td>
                                <td className="p-2.5 text-center text-slate-500 dark:text-slate-400 text-xs">
                                  {sh.count}
                                </td>
                                <td className="p-2.5 text-right font-mono text-rose-600/90 dark:text-rose-400/90">
                                  {sh.payments > 0 ? formatGBP(sh.payments) : '-'}
                                </td>
                                <td className="p-2.5 text-right font-mono text-emerald-600/90 dark:text-emerald-400/90">
                                  {sh.receipts > 0 ? formatGBP(sh.receipts) : '-'}
                                </td>
                                <td
                                  className={`p-2.5 text-right font-mono font-semibold ${
                                    sh.net > 0
                                      ? 'text-emerald-600/90 dark:text-emerald-400/90'
                                      : sh.net < 0
                                      ? 'text-rose-600/90 dark:text-rose-400/90'
                                      : 'text-slate-500'
                                  }`}
                                >
                                  {formatGBP(sh.net)}
                                </td>
                                <td className="p-2.5 text-center">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDrilldown(h.head, sh.subHead);
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] shadow-sm transition cursor-pointer"
                                    title={`Open ${sh.subHead} ledger`}
                                  >
                                    <span>⚡ Sub Head Ledger</span>
                                  </button>
                                </td>
                              </tr>
                            ))}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                  {/* Grand Total Row */}
                  <tfoot className="bg-slate-900 text-white dark:bg-slate-950 font-black border-t-2 border-slate-700">
                    <tr>
                      <td className="p-3.5">
                        <span className="text-sm uppercase tracking-wider text-white">
                          Grand Total (All Nominal Heads)
                        </span>
                      </td>
                      <td className="p-3.5 text-center font-mono text-slate-300">
                        {headSummaryData.grandTotalCount}
                      </td>
                      <td className="p-3.5 text-right font-mono text-rose-300 text-sm">
                        {formatGBP(headSummaryData.grandTotalPayments)}
                      </td>
                      <td className="p-3.5 text-right font-mono text-emerald-300 text-sm">
                        {formatGBP(headSummaryData.grandTotalReceipts)}
                      </td>
                      <td
                        className={`p-3.5 text-right font-mono text-sm ${
                          headSummaryData.netLiquidity >= 0 ? 'text-emerald-300' : 'text-rose-300'
                        }`}
                      >
                        {formatGBP(headSummaryData.netLiquidity)}
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => setLedgerType('CONSOLIDATED')}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-[10px] border border-slate-700 transition cursor-pointer"
                        >
                          Master Journal
                        </button>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* 2. DEDICATED TRANSACTION REGISTER & DRILLDOWN LEDGER          */}
      {/* ============================================================= */}
      {(ledgerType !== 'HEAD' || headViewMode === 'DRILLDOWN') && (
        <>
          {/* Breadcrumb Navigation when in HEAD Drilldown */}
          {ledgerType === 'HEAD' && headViewMode === 'DRILLDOWN' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-indigo-50/90 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 shadow-sm">
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={handleBackToSummary}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 font-black text-xs shadow-sm transition cursor-pointer"
                >
                  <ArrowLeft size={14} />
                  <span>← Back to Summary Table</span>
                </button>
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 flex-wrap">
                  <span className="text-slate-400">Reconciliation Summary</span>
                  <ChevronRight size={13} className="text-slate-400" />
                  <button
                    type="button"
                    onClick={() => handleDrilldown(drilldownHead, null)}
                    className="px-2.5 py-1 rounded-lg bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900/60 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-extrabold transition cursor-pointer"
                    title={`View all ${drilldownHead} entries`}
                  >
                    Head: {drilldownHead || 'All Heads'}
                  </button>
                  {drilldownSubHead && (
                    <>
                      <ChevronRight size={13} className="text-slate-400" />
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-extrabold">
                        Sub Head: {drilldownSubHead}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Quick switcher to other Sub Heads in this Head */}
              {drilldownHead && headSummaryData?.heads && (
                <div className="flex items-center gap-2 text-xs font-bold">
                  <span className="text-slate-500 dark:text-slate-400 text-[11px]">Sub Head:</span>
                  <select
                    value={drilldownSubHead || ''}
                    onChange={(e) => handleDrilldown(drilldownHead, e.target.value || null)}
                    className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 dark:text-white"
                  >
                    <option value="">All {drilldownHead} Sub Heads</option>
                    {((headSummaryData.heads.find((h) => h.head === drilldownHead)?.subHeads) || []).map((sh) => (
                      <option key={sh.subHead} value={sh.subHead}>
                        {sh.subHead} ({sh.count})
                      </option>
                    ))}
                  </select>
                </div>
              )}
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
                          {tx.head || tx.subHead ? (
                            <div className="flex flex-col gap-1">
                              {tx.head && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLedgerType('HEAD');
                                    handleDrilldown(tx.head, null);
                                  }}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-extrabold text-[10px] border border-indigo-200 dark:border-indigo-800/60 w-fit cursor-pointer transition"
                                  title={`View ${tx.head} Head Ledger`}
                                >
                                  <span>{tx.head}</span>
                                  <ExternalLink size={9} className="opacity-60" />
                                </button>
                              )}
                              {tx.subHead && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setLedgerType('HEAD');
                                    handleDrilldown(tx.head, tx.subHead);
                                  }}
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] border border-emerald-200 dark:border-emerald-800/60 w-fit cursor-pointer transition"
                                  title={`View ${tx.subHead} Sub Head Ledger`}
                                >
                                  <span>&rarr; {tx.subHead}</span>
                                  <ExternalLink size={9} className="opacity-60" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700">
                              {tx.categoryName || 'General'}
                            </span>
                          )}
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
                              <>
                                <button
                                  onClick={() => setEditModalTx(tx)}
                                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-amber-600 hover:text-white text-slate-600 dark:text-slate-300 transition cursor-pointer"
                                  title="Edit Transaction & Recalculate"
                                >
                                  <Edit3 size={13} />
                                </button>
                                <button
                                  onClick={() => setDeleteModalTx(tx)}
                                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-rose-600 hover:text-white text-slate-600 dark:text-slate-300 transition cursor-pointer"
                                  title="Void & Delete Transaction (Reverses Balance)"
                                >
                                  <Trash2 size={13} />
                                </button>
                                <button
                                  onClick={() => setAuditModalTx(tx)}
                                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-600 dark:text-slate-300 transition cursor-pointer"
                                  title="Inspect Audit History"
                                >
                                  <History size={13} />
                                </button>
                              </>
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
              ? (v) => {
                  setActiveVoucher(null);
                  setEditModalTx(v);
                }
              : undefined
          }
        />
      )}

      {/* Transaction Edit Modal */}
      {editModalTx && (
        <EditTransactionModal
          isOpen={Boolean(editModalTx)}
          transaction={editModalTx}
          onClose={() => setEditModalTx(null)}
          onSuccess={() => {
            setEditModalTx(null);
            fetchLedger(false);
            loadEntities(true);
          }}
        />
      )}

      {/* Transaction Void & Delete Modal */}
      {deleteModalTx && (
        <DeleteConfirmModal
          isOpen={Boolean(deleteModalTx)}
          transaction={deleteModalTx}
          onClose={() => setDeleteModalTx(null)}
          onSuccess={() => {
            setDeleteModalTx(null);
            fetchLedger(false);
            loadEntities(true);
          }}
        />
      )}

      {/* Transaction Audit Modal */}
      {auditModalTx && (
        <TransactionAuditModal
          isOpen={Boolean(auditModalTx)}
          transactionId={auditModalTx._id}
          voucherNo={auditModalTx.voucherNo}
          onClose={() => setAuditModalTx(null)}
        />
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
