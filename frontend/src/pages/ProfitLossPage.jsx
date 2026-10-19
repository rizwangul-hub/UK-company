import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Building2,
  Landmark,
  Receipt,
  Calendar,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  ArrowDownLeft,
  RefreshCw,
  Download,
  Printer,
  FileSpreadsheet,
  FileText,
  Layers,
  Eye,
  X,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Filter,
  ShieldCheck,
  ExternalLink,
  BookOpen,
  PieChart,
  BarChart3,
  HelpCircle,
  Clock,
} from 'lucide-react';
import { pnlAPI, propertiesAPI, getApiCache } from '../services/api.js';
import { formatGBP, formatUKDate } from '../utils/formatters.js';
import SingleVoucherPrintModal from '../components/SingleVoucherPrintModal.jsx';
import pixxLogo from '../assets/logo.png';

export function ProfitLossPage({ selectedCompany }) {
  const companySlug = selectedCompany?.slug || selectedCompany?.id || 'old-street';
  const cachedReport = getApiCache('/pnl', { params: { datePreset: 'THIS_YEAR' } });

  // Filter States
  const [datePreset, setDatePreset] = useState('THIS_YEAR');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [basis, setBasis] = useState('CASH'); // 'CASH' | 'ACCRUAL'
  const [taxYear, setTaxYear] = useState('2025-2026');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [viewTab, setViewTab] = useState('STATEMENT'); // 'STATEMENT' | 'PROPERTIES' | 'TRENDS' | 'EXCLUSIONS'

  // Data States
  const [reportData, setReportData] = useState(cachedReport?.data || null);
  const [loading, setLoading] = useState(!cachedReport?.data);
  const [errorMsg, setErrorMsg] = useState('');
  const [propertiesList, setPropertiesList] = useState([]);

  // Drilldown Modal / State
  const [activeDrilldown, setActiveDrilldown] = useState(null); // { title, type, transactions, total }
  const [activeVoucher, setActiveVoucher] = useState(null);
  const [reviewingTx, setReviewingTx] = useState(null);
  const [reclassifying, setReclassifying] = useState(false);

  // Load Properties for dropdown
  useEffect(() => {
    const loadProperties = async () => {
      try {
        const res = await propertiesAPI.getAll();
        if (res?.success && res.data?.properties) {
          setPropertiesList(res.data.properties);
        }
      } catch (err) {
        console.error('Failed to load properties for P&L filter:', err);
      }
    };
    loadProperties();
  }, [selectedCompany]);

  // Fetch P&L Report
  const fetchPnL = async (force = false) => {
    try {
      setLoading(true);
      setErrorMsg('');

      const params = {
        propertyId: selectedPropertyId || undefined,
        datePreset,
        basis,
        startDate: datePreset === 'CUSTOM' ? startDate : undefined,
        endDate: datePreset === 'CUSTOM' ? endDate : undefined,
        taxYear: datePreset === 'UK_TAX_YEAR' ? taxYear : undefined,
      };

      const res = await pnlAPI.getReport(params, { forceRefresh: force });
      if (res?.success && res.data) {
        setReportData(res.data);
      } else {
        setReportData(null);
        setErrorMsg(res?.message || 'Failed to generate Profit and Loss statement');
      }
    } catch (err) {
      console.error('Failed to fetch P&L report:', err);
      setErrorMsg(err.response?.data?.message || err.message || 'Error loading Profit and Loss data');
      setReportData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPnL();
  }, [datePreset, selectedPropertyId, basis, taxYear, selectedCompany]);

  const handleCustomDateSubmit = (e) => {
    e.preventDefault();
    fetchPnL(true);
  };

  // Direct Exports
  const handleExportExcel = async () => {
    try {
      await pnlAPI.downloadExcel({
        propertyId: selectedPropertyId || undefined,
        datePreset,
        basis,
        startDate: datePreset === 'CUSTOM' ? startDate : undefined,
        endDate: datePreset === 'CUSTOM' ? endDate : undefined,
        taxYear: datePreset === 'UK_TAX_YEAR' ? taxYear : undefined,
      });
    } catch (err) {
      alert(err.message || 'Excel export failed');
    }
  };

  const handleExportCsv = async () => {
    try {
      await pnlAPI.downloadCsv({
        propertyId: selectedPropertyId || undefined,
        datePreset,
        basis,
        startDate: datePreset === 'CUSTOM' ? startDate : undefined,
        endDate: datePreset === 'CUSTOM' ? endDate : undefined,
        taxYear: datePreset === 'UK_TAX_YEAR' ? taxYear : undefined,
      });
    } catch (err) {
      alert(err.message || 'CSV export failed');
    }
  };

  // Reclassify Transaction
  const handleReclassify = async (txId, newClassification) => {
    try {
      setReclassifying(true);
      const res = await pnlAPI.classifyTransaction(txId, {
        classification: newClassification,
        reason: `Reclassified from P&L review screen by operator`,
      });
      if (res?.success) {
        setReviewingTx(null);
        fetchPnL(true);
      } else {
        alert(res?.message || 'Classification update failed');
      }
    } catch (err) {
      alert(err.message || 'Failed to reclassify transaction');
    } finally {
      setReclassifying(false);
    }
  };

  const summary = reportData?.summary || {
    totalIncome: 0,
    operatingExpenses: 0,
    financeCosts: 0,
    totalExpenses: 0,
    netResult: 0,
    netProfit: 0,
    netLoss: 0,
    isProfit: true,
    netProfitMargin: 0,
    totalTransactions: 0,
    unclassifiedCount: 0,
    unclassifiedTotal: 0,
    totalExcluded: 0,
  };

  const comparison = reportData?.comparison;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl dashboard-header-banner">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-xl bg-slate-900/90 border border-slate-700/60 flex items-center justify-center p-1.5 shadow-md shrink-0">
            <img src={pixxLogo} alt="Pixx Technologies Logo" className="h-full w-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {selectedCompany?.name ? `${selectedCompany.name} Profit & Loss (P&L)` : 'UK Property Profit & Loss'}
              </h1>
              {selectedCompany?.legalName && (
                <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {selectedCompany.legalName}
                </span>
              )}
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Official P&amp;L Module
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5 max-w-3xl">
              Audited operational profitability calculated automatically from posted transactions, rent collections, and mortgage interest.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportExcel}
            disabled={!reportData || loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs shadow-sm shadow-emerald-600/20 transition cursor-pointer"
            title="Download multi-sheet formatted Excel workbook"
          >
            <FileSpreadsheet size={15} />
            <span>Excel (.xlsx)</span>
          </button>

          <button
            onClick={handleExportCsv}
            disabled={!reportData || loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 font-bold text-xs shadow-sm transition cursor-pointer"
            title="Export CSV data"
          >
            <Download size={13} />
            <span>CSV</span>
          </button>

          <button
            onClick={() => window.print()}
            disabled={!reportData || loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 font-bold text-xs shadow-sm transition cursor-pointer"
          >
            <Printer size={13} />
            <span>Print</span>
          </button>

          <button
            onClick={() => fetchPnL(true)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-sm transition cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter & Period Selector Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Property Filter */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Property Filter
            </label>
            <select
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">★ Entire Portfolio (All Properties &amp; Company Heads)</option>
              {propertiesList.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.title || p.name || p.addressLine1} {p.postcode ? `(${p.postcode})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Preset */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Financial Reporting Period
            </label>
            <select
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="THIS_YEAR">This Year (Calendar 2026)</option>
              <option value="THIS_MONTH">This Month</option>
              <option value="LAST_MONTH">Last Month</option>
              <option value="THIS_QUARTER">This Quarter</option>
              <option value="LAST_YEAR">Last Year (2025)</option>
              <option value="UK_TAX_YEAR">UK Tax Year (6 Apr – 5 Apr)</option>
              <option value="CUSTOM">Custom Date Range</option>
              <option value="ALL">All Time (Full Ledger History)</option>
            </select>
          </div>

          {/* Tax Year or Custom Date */}
          {datePreset === 'UK_TAX_YEAR' ? (
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Select UK Tax Year
              </label>
              <select
                value={taxYear}
                onChange={(e) => setTaxYear(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="2026-2027">2026 / 2027 (Current UK Tax Year)</option>
                <option value="2025-2026">2025 / 2026 (Previous UK Tax Year)</option>
                <option value="2024-2025">2024 / 2025 (Historical Tax Year)</option>
              </select>
            </div>
          ) : datePreset === 'CUSTOM' ? (
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-medium text-slate-900 dark:text-white"
                />
              </div>
              <div className="flex-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-medium text-slate-900 dark:text-white"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Active Period Scope
              </label>
              <div className="py-2.5 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 font-bold text-slate-700 dark:text-slate-300 truncate">
                {reportData?.periodLabel || 'All Recorded Dates'}
              </div>
            </div>
          )}

          {/* Accounting Basis Toggle */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              Accounting Basis
            </label>
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setBasis('CASH')}
                className={`py-1.5 px-2 rounded-lg font-bold text-xs transition cursor-pointer ${
                  basis === 'CASH'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
                title="Cash Basis: based on actual payments and receipts deposited into bank accounts"
              >
                Cash Basis
              </button>
              <button
                type="button"
                onClick={() => setBasis('ACCRUAL')}
                className={`py-1.5 px-2 rounded-lg font-bold text-xs transition cursor-pointer ${
                  basis === 'ACCRUAL'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
                title="Accrual Basis: includes earned rental billings and incurred operating charges"
              >
                Accrual Basis
              </button>
            </div>
          </div>
        </div>

        {datePreset === 'CUSTOM' && (
          <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={handleCustomDateSubmit}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-sm transition cursor-pointer"
            >
              Apply Custom Range
            </button>
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

      {/* Unclassified / Needs Review Alert Banner */}
      {summary.unclassifiedCount > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-amber-900 dark:text-amber-200 font-bold">
            <AlertTriangle size={18} className="text-amber-600 shrink-0" />
            <div>
              <span className="font-black">{summary.unclassifiedCount} Unclassified / Ambiguous Transactions ({formatGBP(summary.unclassifiedTotal)})</span>
              <p className="text-[11px] text-amber-800 dark:text-amber-300/80 font-medium">
                These transactions lack a clear nominal head and are excluded from profit calculations until classified.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveDrilldown({
              title: 'Unclassified Transactions Needing Review',
              type: 'UNCLASSIFIED',
              transactions: reportData.unclassifiedList,
              total: summary.unclassifiedTotal,
            })}
            className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black shadow-sm transition cursor-pointer shrink-0"
          >
            Review &amp; Classify ({summary.unclassifiedCount})
          </button>
        </div>
      )}

      {/* Top 5 Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* 1. Total Operating Revenue */}
        <div className="executive-card rounded-2xl p-4 sm:p-5 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider">Total Revenue</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <ArrowDownLeft size={16} />
            </div>
          </div>
          <div className="font-display text-xl sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight tabular-nums">
            {formatGBP(summary.totalIncome)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1 font-semibold">
            {comparison ? (
              <span className={comparison.incomeDelta >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                {comparison.incomeDelta >= 0 ? '+' : ''}{comparison.incomeDeltaPct}% vs prev
              </span>
            ) : (
              <span>Operating Inflows</span>
            )}
          </div>
        </div>

        {/* 2. Total Operating Expenses */}
        <div className="executive-card rounded-2xl p-4 sm:p-5 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider">Operating Expenses</span>
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
              <ArrowUpRight size={16} />
            </div>
          </div>
          <div className="font-display text-xl sm:text-2xl font-extrabold text-rose-600 dark:text-rose-400 tracking-tight tabular-nums">
            {formatGBP(summary.operatingExpenses)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-semibold">
            Repairs, tax &amp; overheads
          </div>
        </div>

        {/* 3. Finance Costs (Mortgage Interest) */}
        <div className="executive-card rounded-2xl p-4 sm:p-5 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider">Finance Costs</span>
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Landmark size={16} />
            </div>
          </div>
          <div className="font-display text-xl sm:text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 tracking-tight tabular-nums">
            {formatGBP(summary.financeCosts)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-semibold">
            Mortgage &amp; loan interest
          </div>
        </div>

        {/* 4. Net Profit / Net Loss */}
        <div className={`executive-card rounded-2xl p-4 sm:p-5 relative overflow-hidden border-2 ${
          summary.isProfit ? 'border-emerald-500/40 bg-emerald-50/20' : 'border-rose-500/40 bg-rose-50/20'
        }`}>
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className={`text-[11px] font-black uppercase tracking-wider ${
              summary.isProfit ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'
            }`}>
              {summary.isProfit ? 'Net Profit' : 'Net Loss'}
            </span>
            <div className={`p-1.5 rounded-lg ${
              summary.isProfit ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
            }`}>
              {summary.isProfit ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            </div>
          </div>
          <div className={`font-display text-xl sm:text-2xl font-black tracking-tight tabular-nums ${
            summary.isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
          }`}>
            {summary.isProfit ? formatGBP(summary.netProfit) : `(${formatGBP(summary.netLoss)})`}
          </div>
          <div className="text-[11px] font-semibold mt-1 text-slate-500 dark:text-slate-400">
            {summary.isProfit ? 'Profitable Performance' : 'Operational Deficit'}
          </div>
        </div>

        {/* 5. Profit Margin % */}
        <div className="executive-card rounded-2xl p-4 sm:p-5 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider">Net Profit Margin</span>
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Percent size={16} />
            </div>
          </div>
          <div className={`font-display text-xl sm:text-2xl font-black tracking-tight tabular-nums ${
            summary.isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
          }`}>
            {summary.netProfitMargin.toFixed(2)}%
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-semibold">
            {summary.totalIncome > 0 ? 'Margin on revenue' : 'No revenue recorded'}
          </div>
        </div>
      </div>

      {/* Sub-View Navigation Tabs */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-1.5 shadow-sm flex flex-wrap gap-1 text-xs font-bold">
        <button
          onClick={() => setViewTab('STATEMENT')}
          className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl transition cursor-pointer ${
            viewTab === 'STATEMENT'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Receipt size={14} />
          <span>Profit &amp; Loss Statement</span>
        </button>

        <button
          onClick={() => setViewTab('PROPERTIES')}
          className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl transition cursor-pointer ${
            viewTab === 'PROPERTIES'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Building2 size={14} />
          <span>Property Profitability ({reportData?.propertyProfitability?.length || 0})</span>
        </button>

        <button
          onClick={() => setViewTab('TRENDS')}
          className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl transition cursor-pointer ${
            viewTab === 'TRENDS'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <BarChart3 size={14} />
          <span>Monthly Trend &amp; Charts</span>
        </button>

        <button
          onClick={() => setViewTab('EXCLUSIONS')}
          className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl transition cursor-pointer ${
            viewTab === 'EXCLUSIONS'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ShieldCheck size={14} />
          <span>Balance Sheet Exclusions ({formatGBP(summary.totalExcluded)})</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* VIEW 1: STRUCTURED PROFIT & LOSS STATEMENT (AUDITED TABLE)            */}
      {/* ===================================================================== */}
      {viewTab === 'STATEMENT' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 gap-2">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Detailed Statement of Profit or Loss
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Every category total is clickable. Click any row to inspect underlying vouchers and transactions.
              </p>
            </div>
            <div className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 self-start sm:self-auto">
              Accounting Basis: <span className="text-indigo-600 dark:text-indigo-400 font-black">{reportData?.basisLabel}</span>
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center text-xs text-slate-500 font-bold flex items-center justify-center gap-2">
              <RefreshCw size={18} className="animate-spin text-indigo-600" />
              Calculating Profit &amp; Loss from master ledger...
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100/90 dark:bg-slate-800 text-slate-800 dark:text-slate-200 uppercase font-black border-b border-slate-200 dark:border-slate-700 tracking-wider">
                  <tr>
                    <th className="p-3.5">Nominal Category Head</th>
                    <th className="p-3.5 text-center w-24">Vouchers</th>
                    <th className="p-3.5 text-right w-44">Amount (£)</th>
                    <th className="p-3.5 text-center w-32">Drilldown</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium text-slate-900 dark:text-slate-100">
                  {/* 1. REVENUE (INCOME) SECTION */}
                  <tr className="bg-emerald-500/10 font-black text-emerald-950 dark:text-emerald-200 border-t border-b border-emerald-500/30">
                    <td colSpan={4} className="p-3 text-xs tracking-wider uppercase flex items-center gap-1.5">
                      <ArrowDownLeft size={14} className="text-emerald-600" />
                      <span>1. OPERATING REVENUE (INCOME)</span>
                    </td>
                  </tr>

                  {reportData?.breakdown?.income?.map((item) => (
                    <tr
                      key={item.category}
                      onClick={() => setActiveDrilldown({
                        title: `Revenue: ${item.category}`,
                        type: 'INCOME',
                        transactions: item.transactions,
                        total: item.total,
                      })}
                      className="hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition cursor-pointer group"
                      title="Click to view underlying transactions"
                    >
                      <td className="p-3 pl-6 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <span className="text-slate-400 group-hover:text-emerald-600">&bull;</span>
                        <span>{item.category}</span>
                      </td>
                      <td className="p-3 text-center text-slate-500 font-mono">{item.count}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatGBP(item.total)}
                      </td>
                      <td className="p-3 text-center">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 group-hover:underline">
                          <span>Inspect</span>
                          <ChevronRight size={12} />
                        </span>
                      </td>
                    </tr>
                  ))}

                  <tr className="bg-emerald-50 dark:bg-emerald-950/40 font-black border-t-2 border-emerald-500/40 text-emerald-950 dark:text-emerald-200">
                    <td className="p-3 pl-6 uppercase tracking-wider text-xs">Total Operating Revenue</td>
                    <td className="p-3 text-center font-mono">
                      {reportData?.breakdown?.income?.reduce((sum, c) => sum + c.count, 0) || 0}
                    </td>
                    <td className="p-3 text-right font-mono font-extrabold text-sm text-emerald-700 dark:text-emerald-300">
                      {formatGBP(summary.totalIncome)}
                    </td>
                    <td></td>
                  </tr>

                  {/* 2. OPERATING EXPENSES SECTION */}
                  <tr className="bg-rose-500/10 font-black text-rose-950 dark:text-rose-200 border-t-2 border-b border-rose-500/30">
                    <td colSpan={4} className="p-3 text-xs tracking-wider uppercase flex items-center gap-1.5">
                      <ArrowUpRight size={14} className="text-rose-600" />
                      <span>2. OPERATING EXPENSES (ADMIN &amp; PROPERTY OVERHEADS)</span>
                    </td>
                  </tr>

                  {reportData?.breakdown?.operatingExpenses?.map((item) => (
                    <tr
                      key={item.category}
                      onClick={() => setActiveDrilldown({
                        title: `Expense: ${item.category}`,
                        type: 'OPERATING_EXPENSE',
                        transactions: item.transactions,
                        total: item.total,
                      })}
                      className="hover:bg-rose-50/50 dark:hover:bg-rose-950/20 transition cursor-pointer group"
                      title="Click to view underlying transactions"
                    >
                      <td className="p-3 pl-6 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <span className="text-slate-400 group-hover:text-rose-600">&bull;</span>
                        <span>{item.category}</span>
                      </td>
                      <td className="p-3 text-center text-slate-500 font-mono">{item.count}</td>
                      <td className="p-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                        {formatGBP(item.total)}
                      </td>
                      <td className="p-3 text-center">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 dark:text-rose-300 group-hover:underline">
                          <span>Inspect</span>
                          <ChevronRight size={12} />
                        </span>
                      </td>
                    </tr>
                  ))}

                  <tr className="bg-rose-50 dark:bg-rose-950/40 font-black border-t-2 border-rose-500/40 text-rose-950 dark:text-rose-200">
                    <td className="p-3 pl-6 uppercase tracking-wider text-xs">Total Operating Expenses</td>
                    <td className="p-3 text-center font-mono">
                      {reportData?.breakdown?.operatingExpenses?.reduce((sum, c) => sum + c.count, 0) || 0}
                    </td>
                    <td className="p-3 text-right font-mono font-extrabold text-sm text-rose-700 dark:text-rose-300">
                      {formatGBP(summary.operatingExpenses)}
                    </td>
                    <td></td>
                  </tr>

                  {/* 3. FINANCE COSTS (MORTGAGE INTEREST) */}
                  <tr className="bg-indigo-500/10 font-black text-indigo-950 dark:text-indigo-200 border-t-2 border-b border-indigo-500/30">
                    <td colSpan={4} className="p-3 text-xs tracking-wider uppercase flex items-center gap-1.5">
                      <Landmark size={14} className="text-indigo-600" />
                      <span>3. FINANCE COSTS (MORTGAGE &amp; LOAN INTEREST EXPENDITURE)</span>
                    </td>
                  </tr>

                  {reportData?.breakdown?.financeCosts?.map((item) => (
                    <tr
                      key={item.category}
                      onClick={() => setActiveDrilldown({
                        title: `Finance Cost: ${item.category}`,
                        type: 'FINANCE_COST',
                        transactions: item.transactions,
                        total: item.total,
                      })}
                      className="hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition cursor-pointer group"
                      title="Click to view underlying transactions"
                    >
                      <td className="p-3 pl-6 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <span className="text-slate-400 group-hover:text-indigo-600">&bull;</span>
                        <span>{item.category}</span>
                      </td>
                      <td className="p-3 text-center text-slate-500 font-mono">{item.count}</td>
                      <td className="p-3 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {formatGBP(item.total)}
                      </td>
                      <td className="p-3 text-center">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 dark:text-indigo-300 group-hover:underline">
                          <span>Inspect</span>
                          <ChevronRight size={12} />
                        </span>
                      </td>
                    </tr>
                  ))}

                  <tr className="bg-indigo-50 dark:bg-indigo-950/40 font-black border-t-2 border-indigo-500/40 text-indigo-950 dark:text-indigo-200">
                    <td className="p-3 pl-6 uppercase tracking-wider text-xs">Total Finance Costs</td>
                    <td className="p-3 text-center font-mono">
                      {reportData?.breakdown?.financeCosts?.reduce((sum, c) => sum + c.count, 0) || 0}
                    </td>
                    <td className="p-3 text-right font-mono font-extrabold text-sm text-indigo-700 dark:text-indigo-300">
                      {formatGBP(summary.financeCosts)}
                    </td>
                    <td></td>
                  </tr>

                  {/* TOTAL OPERATING & FINANCE EXPENSES */}
                  <tr className="bg-slate-100 dark:bg-slate-800 font-black border-t-2 border-b-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white">
                    <td className="p-3.5 uppercase tracking-wider text-xs">Total Operating &amp; Finance Expenses</td>
                    <td className="p-3.5 text-center font-mono text-slate-500">
                      {(reportData?.breakdown?.operatingExpenses?.reduce((s, c) => s + c.count, 0) || 0) +
                       (reportData?.breakdown?.financeCosts?.reduce((s, c) => s + c.count, 0) || 0)}
                    </td>
                    <td className="p-3.5 text-right font-mono font-black text-sm text-rose-700 dark:text-rose-400">
                      {formatGBP(summary.totalExpenses)}
                    </td>
                    <td></td>
                  </tr>
                </tbody>

                {/* NET PROFIT / NET LOSS BOTTOM LINE */}
                <tfoot className={`text-white font-black border-t-4 ${
                  summary.isProfit ? 'bg-emerald-900 border-emerald-500' : 'bg-rose-900 border-rose-500'
                }`}>
                  <tr>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {summary.isProfit ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                        <span className="text-base uppercase tracking-wider">
                          {summary.isProfit ? 'NET OPERATING PROFIT' : 'NET OPERATING LOSS'}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-center font-mono text-white/80">
                      {summary.totalTransactions} Total
                    </td>
                    <td className="p-4 text-right font-mono text-xl tracking-tight">
                      {summary.isProfit ? formatGBP(summary.netProfit) : `(${formatGBP(summary.netLoss)})`}
                    </td>
                    <td className="p-4 text-center text-xs font-black">
                      Margin: {summary.netProfitMargin.toFixed(1)}%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* VIEW 2: PROPERTY PROFITABILITY MATRIX                                 */}
      {/* ===================================================================== */}
      {viewTab === 'PROPERTIES' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              Property Performance &amp; Profitability Matrix
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Net operating profit per UK property asset with mortgage interest separated from principal repayments.
            </p>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100/90 dark:bg-slate-800 text-slate-800 dark:text-slate-200 uppercase font-black border-b border-slate-200 dark:border-slate-700 tracking-wider">
                <tr>
                  <th className="p-3">Property Name / Address</th>
                  <th className="p-3 text-right">Rental Income (£)</th>
                  <th className="p-3 text-right">Other Income (£)</th>
                  <th className="p-3 text-right">Total Revenue (£)</th>
                  <th className="p-3 text-right">Operating Exp (£)</th>
                  <th className="p-3 text-right">Mortgage Interest (£)</th>
                  <th className="p-3 text-right">Total Exp (£)</th>
                  <th className="p-3 text-right">Net Profit / Loss (£)</th>
                  <th className="p-3 text-center">Margin (%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium text-slate-900 dark:text-slate-100">
                {reportData?.propertyProfitability?.map((p) => (
                  <tr key={String(p.propertyId)} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                    <td className="p-3">
                      <div className="font-bold text-slate-900 dark:text-white">{p.name}</div>
                      {p.postcode && <div className="text-[10px] text-slate-500 font-mono">{p.postcode}</div>}
                    </td>
                    <td className="p-3 text-right font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                      {p.rentalIncome > 0 ? formatGBP(p.rentalIncome) : '-'}
                    </td>
                    <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-400">
                      {p.otherIncome > 0 ? formatGBP(p.otherIncome) : '-'}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-300">
                      {p.totalIncome > 0 ? formatGBP(p.totalIncome) : '-'}
                    </td>
                    <td className="p-3 text-right font-mono text-rose-600 dark:text-rose-400 font-semibold">
                      {p.operatingExpenses > 0 ? formatGBP(p.operatingExpenses) : '-'}
                    </td>
                    <td className="p-3 text-right font-mono text-indigo-600 dark:text-indigo-400 font-semibold">
                      {p.financeCosts > 0 ? formatGBP(p.financeCosts) : '-'}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-rose-700 dark:text-rose-300">
                      {p.totalExpenses > 0 ? formatGBP(p.totalExpenses) : '-'}
                    </td>
                    <td className={`p-3 text-right font-mono font-black ${
                      p.isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {formatGBP(p.netProfit)}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                        p.isProfit
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                          : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                      }`}>
                        {p.profitMargin.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}

                {/* Company Unallocated Row */}
                {reportData?.companyUnallocated && (
                  <tr className="bg-slate-50 dark:bg-slate-800/30 italic text-slate-700 dark:text-slate-300">
                    <td className="p-3 font-semibold">{reportData.companyUnallocated.name}</td>
                    <td className="p-3 text-right font-mono">-</td>
                    <td className="p-3 text-right font-mono text-emerald-600">
                      {reportData.companyUnallocated.otherIncome > 0 ? formatGBP(reportData.companyUnallocated.otherIncome) : '-'}
                    </td>
                    <td className="p-3 text-right font-mono font-bold">
                      {formatGBP(reportData.companyUnallocated.totalIncome)}
                    </td>
                    <td className="p-3 text-right font-mono text-rose-600">
                      {formatGBP(reportData.companyUnallocated.operatingExpenses)}
                    </td>
                    <td className="p-3 text-right font-mono text-indigo-600">
                      {formatGBP(reportData.companyUnallocated.financeCosts)}
                    </td>
                    <td className="p-3 text-right font-mono font-bold text-rose-700">
                      {formatGBP(reportData.companyUnallocated.totalExpenses)}
                    </td>
                    <td className={`p-3 text-right font-mono font-black ${
                      reportData.companyUnallocated.isProfit ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {formatGBP(reportData.companyUnallocated.netProfit)}
                    </td>
                    <td className="p-3 text-center">-</td>
                  </tr>
                )}
              </tbody>

              <tfoot className="bg-slate-900 text-white font-black border-t-2 border-slate-700">
                <tr>
                  <td className="p-3.5 uppercase tracking-wider text-xs">Company Portfolio Total</td>
                  <td className="p-3.5 text-right font-mono text-emerald-300">{formatGBP(summary.totalIncome)}</td>
                  <td className="p-3.5 text-right font-mono text-slate-300">£0.00</td>
                  <td className="p-3.5 text-right font-mono text-emerald-300 font-bold">{formatGBP(summary.totalIncome)}</td>
                  <td className="p-3.5 text-right font-mono text-rose-300">{formatGBP(summary.operatingExpenses)}</td>
                  <td className="p-3.5 text-right font-mono text-indigo-300">{formatGBP(summary.financeCosts)}</td>
                  <td className="p-3.5 text-right font-mono text-rose-300 font-bold">{formatGBP(summary.totalExpenses)}</td>
                  <td className={`p-3.5 text-right font-mono text-sm ${
                    summary.isProfit ? 'text-emerald-300' : 'text-rose-300'
                  }`}>
                    {summary.isProfit ? formatGBP(summary.netProfit) : `(${formatGBP(summary.netLoss)})`}
                  </td>
                  <td className="p-3.5 text-center text-xs">{summary.netProfitMargin.toFixed(1)}%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* VIEW 3: MONTHLY & PERIOD TRENDS (CHARTS & HISTORICAL COMPARISON)     */}
      {/* ===================================================================== */}
      {viewTab === 'TRENDS' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              Monthly Operational Performance &amp; Profit Trends
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              Month-by-month revenue, expenditure, and net profit progression across the portfolio.
            </p>
          </div>

          {/* Responsive Visual Bar Trend Representation */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reportData?.monthlyTrend?.map((m) => (
                <div
                  key={m.month}
                  className={`p-4 rounded-xl border transition ${
                    m.isProfit
                      ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                      : 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {m.monthLabel}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                      m.isProfit
                        ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                        : 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
                    }`}>
                      {m.isProfit ? 'PROFIT' : 'DEFICIT'}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Revenue:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatGBP(m.income)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Operating Exp:</span>
                      <span className="font-semibold text-rose-600 dark:text-rose-400">{formatGBP(m.operatingExpenses)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Mortgage Interest:</span>
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">{formatGBP(m.financeCosts)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-700">
                      <span className="font-bold text-slate-700 dark:text-slate-300">Net Profit / Loss:</span>
                      <span className={`font-black ${m.isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {formatGBP(m.netProfit)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400 pt-0.5">
                      <span>Cumulative YTD Net:</span>
                      <span className="font-semibold">{formatGBP(m.ytdNetProfit)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* VIEW 4: BALANCE SHEET EXCLUSIONS                                      */}
      {/* ===================================================================== */}
      {viewTab === 'EXCLUSIONS' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
              Balance Sheet Movements (Excluded from P&amp;L)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              These {formatGBP(summary.totalExcluded)} transactions represent loans, capital assets, mortgage principal repayments, or internal transfers that correctly do not affect profit or loss.
            </p>
          </div>

          <div className="space-y-4">
            {reportData?.breakdown?.excluded?.map((item) => (
              <div
                key={item.classification}
                onClick={() => setActiveDrilldown({
                  title: `Excluded: ${item.reason}`,
                  type: 'EXCLUDED',
                  transactions: item.transactions,
                  total: item.total,
                })}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-400 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="font-black text-sm text-slate-900 dark:text-white">{item.classification}</div>
                  <div className="text-slate-500 dark:text-slate-400 font-medium mt-0.5">{item.reason}</div>
                </div>
                <div className="flex items-center gap-4 shrink-0 font-mono">
                  <span className="text-slate-500 font-bold">{item.count} Vouchers</span>
                  <span className="font-black text-base text-slate-800 dark:text-slate-200">{formatGBP(item.total)}</span>
                  <button className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white font-bold transition">
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TRANSACTION DRILLDOWN MODAL                                           */}
      {/* ===================================================================== */}
      {activeDrilldown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    {activeDrilldown.title}
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                    {activeDrilldown.transactions?.length || 0} Transactions
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                  Total Reconciled Amount: <span className="font-mono font-bold text-slate-900 dark:text-white">{formatGBP(activeDrilldown.total)}</span>
                </div>
              </div>
              <button
                onClick={() => setActiveDrilldown(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Table Content */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black uppercase tracking-wider">
                    <tr>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Voucher</th>
                      <th className="p-2.5">Particulars / Narration</th>
                      <th className="p-2.5">Property</th>
                      <th className="p-2.5">Account</th>
                      <th className="p-2.5 text-right">Amount (£)</th>
                      <th className="p-2.5 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                    {activeDrilldown.transactions?.map((tx) => (
                      <tr key={tx._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="p-2.5 font-mono whitespace-nowrap text-slate-500">
                          {formatUKDate(tx.date)}
                        </td>
                        <td className="p-2.5 font-mono font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                          {tx.voucherNo}
                        </td>
                        <td className="p-2.5 max-w-xs truncate" title={tx.narration}>
                          <div className="font-bold text-slate-900 dark:text-white truncate">{tx.narration}</div>
                          {tx.head && (
                            <span className="text-[10px] text-slate-400 font-semibold">{tx.head} &bull; {tx.subHead}</span>
                          )}
                        </td>
                        <td className="p-2.5 whitespace-nowrap text-slate-600 dark:text-slate-300">
                          {tx.propertyName}
                        </td>
                        <td className="p-2.5 whitespace-nowrap text-slate-500">{tx.accountName}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                          {formatGBP(tx.amount)}
                        </td>
                        <td className="p-2.5 text-center whitespace-nowrap">
                          <button
                            onClick={() => setActiveVoucher(tx)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-[10px] transition cursor-pointer"
                          >
                            <Eye size={11} />
                            <span>Voucher</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setActiveDrilldown(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition cursor-pointer"
              >
                Close Drilldown
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Voucher Modal */}
      {activeVoucher && (
        <SingleVoucherPrintModal
          voucher={activeVoucher}
          selectedCompany={selectedCompany}
          onClose={() => setActiveVoucher(null)}
        />
      )}
    </div>
  );
}

export default ProfitLossPage;
