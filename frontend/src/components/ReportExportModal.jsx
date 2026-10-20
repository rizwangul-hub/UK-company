import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  FileSpreadsheet,
  X,
  Calendar,
  Layers,
  Filter,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Building2,
  Landmark,
  Coins,
  Percent,
  Receipt,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  Check,
} from 'lucide-react';
import { reportsAPI, propertiesAPI } from '../services/api.js';
import { formatGBP, formatUKDate } from '../utils/formatters.js';
import { formatPropertyType } from '../pages/LedgerPage.jsx';
import { ModalPortal } from './ModalPortal.jsx';
import pixxLogo from '../assets/logo.png';

const SCOPES = [
  { id: 'COMPLETE', label: 'Complete Ledger', icon: Layers, desc: 'Master multi-currency portfolio journal' },
  { id: 'SELECTED', label: 'Selected Records', icon: Check, desc: 'Specific checked transactions only' },
  { id: 'HEAD', label: 'Head / Sub Head', icon: Layers, desc: 'Income, Admin Expenses, Loan, Interest, etc.' },
  { id: 'ACCOUNT_HEAD', label: 'Nominal Head', icon: Receipt, desc: 'Repairs, Agent Fees, Insurance, etc.' },
  { id: 'PROPERTY', label: 'Property Asset', icon: Building2, desc: 'Asset P&L with optional unit rollup' },
  { id: 'MORTGAGE', label: 'Mortgage Facility', icon: Percent, desc: 'Debt principal and interest ledger' },
  { id: 'BANK', label: 'Bank Account', icon: Landmark, desc: 'NatWest, Barclays, Lloyds accounts' },
  { id: 'CASH', label: 'Cash Float', icon: Coins, desc: 'Physical cash & petty cash ledgers' },
  { id: 'TRANSACTION_TYPE', label: 'Transaction Type', icon: Filter, desc: 'Expense, Income, Transfer, Mortgage' },
];

const DATE_PRESETS = [
  { id: 'THIS_MONTH', label: 'This Month' },
  { id: 'PREVIOUS_MONTH', label: 'Previous Month' },
  { id: 'THIS_TAX_YEAR', label: 'Current UK Tax Year (6 Apr – 5 Apr)' },
  { id: 'TODAY', label: 'Today' },
  { id: 'THIS_WEEK', label: 'This Week' },
  { id: 'CUSTOM', label: 'Custom Date Range' },
  { id: 'ALL', label: 'All Recorded Time' },
];

export default function ReportExportModal({
  isOpen,
  onClose,
  selectedCompany,
  initialScope = 'COMPLETE',
  initialEntityId = '',
  initialDatePreset = 'THIS_MONTH',
  initialStartDate = '',
  initialEndDate = '',
  selectedTxIds = [],
  entitiesMap = {},
}) {
  const [scope, setScope] = useState(initialScope);
  const [entityId, setEntityId] = useState(initialEntityId);
  const [propertyUnits, setPropertyUnits] = useState([]);
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [txType, setTxType] = useState('EXPENSE');

  const [datePreset, setDatePreset] = useState(initialDatePreset);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);

  const [searchQuery, setSearchQuery] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [status, setStatus] = useState('POSTED');

  // Preview & Export State
  const [previewData, setPreviewData] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [exportingType, setExportingType] = useState(null); // 'pdf' | 'excel' | null
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Sync state when modal opens or initial values change
  useEffect(() => {
    if (isOpen) {
      if (selectedTxIds.length > 0) {
        setScope('SELECTED');
      } else {
        setScope(initialScope || 'COMPLETE');
      }
      setEntityId(initialEntityId || '');
      setDatePreset(initialDatePreset || 'THIS_MONTH');
      setStartDate(initialStartDate || '');
      setEndDate(initialEndDate || '');
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [isOpen, initialScope, initialEntityId, initialDatePreset, selectedTxIds]);

  // Load units when PROPERTY scope has an entity selected
  useEffect(() => {
    if (scope === 'PROPERTY' && entityId) {
      propertiesAPI
        .getById(entityId)
        .then((res) => {
          if (res?.success) {
            const units = res.data?.units || res.data?.property?.units || [];
            setPropertyUnits(units);
          }
        })
        .catch(() => setPropertyUnits([]));
    } else {
      setPropertyUnits([]);
      setSelectedUnitId('');
    }
  }, [scope, entityId]);

  // Compute filter payload
  const currentFilterPayload = useMemo(() => {
    const payload = {
      scope,
      datePreset,
      status,
    };

    if (scope === 'SELECTED') {
      payload.selectedIds = selectedTxIds;
    } else {
      if (entityId) payload.entityId = entityId;
      if (scope === 'PROPERTY' && selectedUnitId) {
        payload.unitId = selectedUnitId;
      }
      if (scope === 'TRANSACTION_TYPE') {
        payload.transactionType = txType;
      }
      if (scope === 'HEAD') {
        const isSub = (entitiesMap.subHeads || []).some((s) => String(s.id) === String(entityId));
        if (isSub) {
          payload.scope = 'SUB_HEAD';
          payload.subHead = entityId;
        } else if (entityId) {
          payload.head = entityId;
        }
      }
    }

    if (datePreset === 'CUSTOM') {
      if (startDate) payload.startDate = startDate;
      if (endDate) payload.endDate = endDate;
    }

    if (searchQuery.trim()) payload.search = searchQuery.trim();
    if (minAmount !== '') payload.minAmount = Number(minAmount);
    if (maxAmount !== '') payload.maxAmount = Number(maxAmount);

    return payload;
  }, [
    scope,
    entityId,
    selectedUnitId,
    txType,
    datePreset,
    startDate,
    endDate,
    searchQuery,
    minAmount,
    maxAmount,
    status,
    selectedTxIds,
  ]);

  // Fetch real-time preview
  const fetchPreview = async () => {
    try {
      setLoadingPreview(true);
      setErrorMsg('');
      const res = await reportsAPI.getLedgerPreview(currentFilterPayload);
      if (res?.success && res.data) {
        setPreviewData(res.data);
      } else {
        setPreviewData(null);
        setErrorMsg(res?.message || 'Failed to load report preview.');
      }
    } catch (err) {
      console.error('Report preview error:', err);
      setErrorMsg(err.response?.data?.message || err.message || 'Error generating report preview.');
      setPreviewData(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  // Debounce preview fetch on filter change
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      fetchPreview();
    }, 250);
    return () => clearTimeout(timer);
  }, [isOpen, currentFilterPayload]);

  // Handle Excel Export
  const handleExportExcel = async () => {
    try {
      setExportingType('excel');
      setErrorMsg('');
      setSuccessMsg('');
      await reportsAPI.downloadLedgerExcel(currentFilterPayload);
      setSuccessMsg('Excel ledger report (.xlsx) downloaded successfully.');
    } catch (err) {
      console.error('Excel download failed:', err);
      setErrorMsg(err.message || 'Failed to generate Excel report.');
    } finally {
      setExportingType(null);
    }
  };

  // Handle PDF Export
  const handleExportPdf = async () => {
    try {
      setExportingType('pdf');
      setErrorMsg('');
      setSuccessMsg('');
      await reportsAPI.downloadLedgerPdf(currentFilterPayload);
      setSuccessMsg('Corporate PDF statement downloaded successfully.');
    } catch (err) {
      console.error('PDF download failed:', err);
      setErrorMsg(err.message || 'Failed to generate PDF report.');
    } finally {
      setExportingType(null);
    }
  };

  if (!isOpen) return null;

  const summary = previewData?.summary || {
    openingBalance: 0,
    totalMoneyIn: 0,
    totalMoneyOut: 0,
    netCashMovement: 0,
    closingBalance: 0,
    transactionCount: 0,
  };

  const previewRows = previewData?.previewRows || [];

  return (
    <ModalPortal isOpen={true} onClose={onClose} zIndex="z-[9999]">
    <div className="fixed inset-0 z-[9999] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in duration-200">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-900/70 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-2xl bg-white border border-slate-200 dark:border-slate-800 p-1.5 shadow-md shrink-0 flex items-center justify-center overflow-hidden">
              <img
                src={selectedCompany?.logo || pixxLogo}
                alt={`${selectedCompany?.name || 'Pixx Technologies'} Logo`}
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  {selectedCompany?.name ? `${selectedCompany.name} Report Studio` : 'UK Central Ledger Export & Reporting Suite'}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-[10px] font-black text-indigo-600 dark:text-indigo-400">
                  {selectedCompany?.legalName || 'HMRC Ready'}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Generate audited PDF and Excel reports for {selectedCompany?.legalName || selectedCompany?.name || 'active portfolio'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* 1. Scope Selector Bar */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Select Reporting Scope &amp; Target Ledger
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
              {SCOPES.map((tab) => {
                const Icon = tab.icon;
                const isSelected = scope === tab.id;
                const isDisabled = tab.id === 'SELECTED' && selectedTxIds.length === 0;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => {
                      setScope(tab.id);
                      setEntityId('');
                    }}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/25 scale-[1.02]'
                        : isDisabled
                        ? 'opacity-40 border-slate-200 dark:border-slate-800 text-slate-400 cursor-not-allowed'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon size={18} className={isSelected ? 'text-white' : 'text-slate-500 dark:text-slate-400'} />
                    <span className="text-[11px] font-black mt-1.5 leading-tight">{tab.label}</span>
                    {tab.id === 'SELECTED' && selectedTxIds.length > 0 && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-white/20 font-bold mt-0.5">
                        {selectedTxIds.length} rows
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Interactive Filter Configuration Bar */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
            {/* Entity Selector (Dynamically adapts to selected Scope) */}
            {scope !== 'COMPLETE' && scope !== 'SELECTED' && (
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Target Entity
                </label>
                {scope === 'HEAD' && (
                  <select
                    value={entityId}
                    onChange={(e) => setEntityId(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">★ All Heads &amp; Sub Heads (Consolidated)</option>
                    <optgroup label="Main Heads">
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
                  </select>
                )}

                {scope === 'ACCOUNT_HEAD' && (
                  <select
                    value={entityId}
                    onChange={(e) => setEntityId(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">★ All Nominal Expense Heads (Combined)</option>
                    <option value="ALL_EXPENSES">★ All Operating Expenses</option>
                    <option value="ALL_INCOME">★ All Income &amp; Rental Heads</option>
                    {(entitiesMap.expenseHeads || [])
                      .filter((h) => h.id !== 'ALL_EXPENSES')
                      .map((h) => (
                        <option key={String(h.id)} value={String(h.id)}>
                          {h.name} {h.subtext ? `(${h.subtext})` : ''}
                        </option>
                      ))}
                    {(entitiesMap.incomeHeads || [])
                      .filter((h) => h.id !== 'ALL_INCOME')
                      .map((h) => (
                        <option key={String(h.id)} value={String(h.id)}>
                          {h.name} {h.subtext ? `(${h.subtext})` : ''}
                        </option>
                      ))}
                  </select>
                )}

                {scope === 'PROPERTY' && (
                  <div className="space-y-2">
                    <select
                      value={entityId}
                      onChange={(e) => setEntityId(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">★ All Properties (Portfolio Level)</option>
                      {(entitiesMap.properties || []).map((p) => {
                        const propType = formatPropertyType(p);
                        return (
                          <option key={String(p.id)} value={String(p.id)}>
                            {p.name} {propType ? `(${propType})` : ''}
                          </option>
                        );
                      })}
                    </select>

                    {entityId && propertyUnits.length > 0 && (
                      <select
                        value={selectedUnitId}
                        onChange={(e) => setSelectedUnitId(e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">★ All Units (Rollup Consolidations)</option>
                        {propertyUnits.map((u) => (
                          <option key={String(u._id)} value={String(u._id)}>
                            Unit: {u.unitName} ({u.unitType}) &bull; Target: £{u.targetRent || 0}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {scope === 'BANK' && (
                  <select
                    value={entityId}
                    onChange={(e) => setEntityId(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Bank Account</option>
                    {(entitiesMap.bankAccounts || []).map((b) => (
                      <option key={String(b.id)} value={String(b.id)}>
                        {b.name} &bull; {b.subtext}
                      </option>
                    ))}
                  </select>
                )}

                {scope === 'CASH' && (
                  <select
                    value={entityId}
                    onChange={(e) => setEntityId(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Cash Float</option>
                    {(entitiesMap.cashAccounts || []).map((c) => (
                      <option key={String(c.id)} value={String(c.id)}>
                        {c.name} &bull; {c.subtext}
                      </option>
                    ))}
                  </select>
                )}

                {scope === 'MORTGAGE' && (
                  <select
                    value={entityId}
                    onChange={(e) => setEntityId(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select Mortgage Facility</option>
                    {(entitiesMap.mortgages || []).map((m) => (
                      <option key={String(m.id)} value={String(m.id)}>
                        {m.name} &bull; {m.subtext}
                      </option>
                    ))}
                  </select>
                )}

                {scope === 'TRANSACTION_TYPE' && (
                  <select
                    value={txType}
                    onChange={(e) => setTxType(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="EXPENSE">EXPENSE — Property Repairs &amp; Overheads</option>
                    <option value="INCOME">INCOME — Tenancy Rent &amp; Sundry Receipts</option>
                    <option value="TRANSFER">TRANSFER — Internal Account Transfers</option>
                    <option value="MORTGAGE_PAYMENT">MORTGAGE_PAYMENT — Principal &amp; Interest</option>
                  </select>
                )}
              </div>
            )}

            {/* Financial Period */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Financial Period
              </label>
              <select
                value={datePreset}
                onChange={(e) => setDatePreset(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {DATE_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Keyword Search */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Filter Search
              </label>
              <input
                type="text"
                placeholder="Voucher #, narration, payee..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Custom Dates (if selected) */}
            {datePreset === 'CUSTOM' && (
              <div className="sm:col-span-2 lg:col-span-4 grid grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 font-medium text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 font-medium text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Feedback messages */}
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs font-bold flex items-center gap-2">
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* 3. Pre-Export Live KPI Strip */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Pre-Export Reconciliation
                </span>
                {previewData?.reportRef && (
                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    Ref: {previewData.reportRef}
                  </span>
                )}
              </div>
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                Period: <span className="text-slate-900 dark:text-white font-extrabold">{previewData?.periodLabel || 'Current'}</span> &bull; Records: <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{summary.transactionCount}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {/* 1. Opening Balance */}
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5">
                <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
                  Opening Balance
                </div>
                <div className="text-lg sm:text-xl font-black font-display text-slate-900 dark:text-white mt-1 tabular-nums">
                  {formatGBP(summary.openingBalance)}
                </div>
                <div className="text-[9px] text-slate-400 font-medium mt-0.5">Brought Forward</div>
              </div>

              {/* 2. Total Inflow */}
              <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-3.5">
                <div className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <ArrowDownLeft size={12} /> Money In
                </div>
                <div className="text-lg sm:text-xl font-black font-display text-emerald-700 dark:text-emerald-300 mt-1 tabular-nums">
                  {formatGBP(summary.totalMoneyIn)}
                </div>
                <div className="text-[9px] text-emerald-600/70 dark:text-emerald-400/70 font-medium mt-0.5">Receipts &amp; Income</div>
              </div>

              {/* 3. Total Outflow */}
              <div className="bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/60 rounded-2xl p-3.5">
                <div className="text-[10px] font-bold uppercase text-rose-700 dark:text-rose-400 flex items-center gap-1">
                  <ArrowUpRight size={12} /> Money Out
                </div>
                <div className="text-lg sm:text-xl font-black font-display text-rose-700 dark:text-rose-300 mt-1 tabular-nums">
                  {formatGBP(summary.totalMoneyOut)}
                </div>
                <div className="text-[9px] text-rose-600/70 dark:text-rose-400/70 font-medium mt-0.5">Disbursements &amp; Costs</div>
              </div>

              {/* 4. Net Cash Movement */}
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5">
                <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
                  Net Cash Flow
                </div>
                <div
                  className={`text-lg sm:text-xl font-black font-display mt-1 tabular-nums ${
                    summary.netCashMovement >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {formatGBP(summary.netCashMovement)}
                </div>
                <div className="text-[9px] text-slate-400 font-medium mt-0.5">Inflow minus Outflow</div>
              </div>

              {/* 5. Closing Balance */}
              <div className="bg-indigo-50/70 dark:bg-indigo-950/30 border-2 border-indigo-500/40 rounded-2xl p-3.5 col-span-2 lg:col-span-1">
                <div className="text-[10px] font-bold uppercase text-indigo-700 dark:text-indigo-300">
                  Closing Balance
                </div>
                <div className="text-lg sm:text-xl font-black font-display text-indigo-900 dark:text-indigo-200 mt-1 tabular-nums">
                  {formatGBP(summary.closingBalance)}
                </div>
                <div className="text-[9px] text-indigo-600/70 dark:text-indigo-400/70 font-medium mt-0.5">Carried Forward</div>
              </div>
            </div>
          </div>

          {/* 4. Pre-export Data Table Preview */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
              <div className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <span>Sample Transactions Register</span>
                {loadingPreview && <RefreshCw size={13} className="animate-spin text-indigo-600" />}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {previewRows.length === 0
                  ? '0 records found'
                  : `Previewing ${previewRows.length} of ${summary.transactionCount} transactions`}
              </div>
            </div>

            <div className="overflow-x-auto max-h-60 overflow-y-auto">
              {loadingPreview ? (
                <div className="py-12 text-center text-xs text-slate-500 font-bold flex items-center justify-center gap-2">
                  <RefreshCw size={16} className="animate-spin text-indigo-600" />
                  Generating authoritative live ledger preview...
                </div>
              ) : previewRows.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400 font-medium">
                  No posted transactions match the selected criteria.
                </div>
              ) : (
                <table className="w-full text-[11px] text-left">
                  <thead className="bg-slate-100/70 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 sticky top-0">
                    <tr>
                      <th className="p-2.5">Date</th>
                      <th className="p-2.5">Voucher No</th>
                      <th className="p-2.5">Particulars / Narration</th>
                      <th className="p-2.5">Nominal Head</th>
                      <th className="p-2.5">Account</th>
                      <th className="p-2.5 text-right">In (£)</th>
                      <th className="p-2.5 text-right">Out (£)</th>
                      <th className="p-2.5 text-right">Balance (£)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-800 dark:text-slate-200">
                    {previewRows.map((tx) => (
                      <tr key={tx._id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                        <td className="p-2.5 font-mono whitespace-nowrap text-slate-600 dark:text-slate-400">
                          {formatUKDate(tx.date)}
                        </td>
                        <td className="p-2.5 font-mono font-black text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                          {tx.voucherNo}
                        </td>
                        <td className="p-2.5 max-w-xs truncate" title={tx.narration}>
                          {tx.narration || '-'}
                        </td>
                        <td className="p-2.5 whitespace-nowrap">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                            {tx.categoryName}
                          </span>
                        </td>
                        <td className="p-2.5 whitespace-nowrap text-slate-600 dark:text-slate-400">
                          {tx.accountName}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          {tx.moneyIn > 0 ? formatGBP(tx.moneyIn) : '-'}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                          {tx.moneyOut > 0 ? formatGBP(tx.moneyOut) : '-'}
                        </td>
                        <td className="p-2.5 text-right font-mono font-black text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                          {formatGBP(tx.runningBalance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer / Export Trigger Buttons */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Files generated with official PixxTechnologies styling &amp; audit trails.
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Cancel
            </button>

            {/* Excel Download Button */}
            <button
              type="button"
              disabled={loadingPreview || exportingType !== null}
              onClick={handleExportExcel}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-black text-xs shadow-lg shadow-emerald-600/20 transition cursor-pointer"
            >
              {exportingType === 'excel' ? (
                <RefreshCw size={15} className="animate-spin" />
              ) : (
                <FileSpreadsheet size={15} />
              )}
              <span>{exportingType === 'excel' ? 'Compiling Excel...' : 'Export Excel (.xlsx)'}</span>
            </button>

            {/* PDF Download Button */}
            <button
              type="button"
              disabled={loadingPreview || exportingType !== null}
              onClick={handleExportPdf}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-black text-xs shadow-lg shadow-indigo-600/20 transition cursor-pointer"
            >
              {exportingType === 'pdf' ? (
                <RefreshCw size={15} className="animate-spin" />
              ) : (
                <FileText size={15} />
              )}
              <span>{exportingType === 'pdf' ? 'Generating PDF...' : 'Export PDF (Landscape A4)'}</span>
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
