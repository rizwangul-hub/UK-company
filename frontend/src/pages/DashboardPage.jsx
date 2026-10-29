import React, { useState, useEffect } from 'react';
import {
  Building2,
  Landmark,
  Wallet,
  Receipt,
  TrendingUp,
  TrendingDown,
  Percent,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Plus,
  Layers,
  ArrowRight,
  Sparkles,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Bell,
  Download,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { formatGBP, formatUKDate, formatMonthLabel, getCurrentMonth } from '../utils/formatters.js';
import { reportsAPI, complianceAPI, propertyChargesAPI, pnlAPI, getApiCache } from '../services/api.js';

export function DashboardPage({
  onNavigate,
  selectedCompany,
  isSidebarCollapsed: propIsSidebarCollapsed,
  onToggleSidebar,
}) {
  const isSidebarCollapsed = Boolean(propIsSidebarCollapsed);

  const handleToggleSidebar = () => {
    if (onToggleSidebar) {
      onToggleSidebar();
    } else {
      window.dispatchEvent(new CustomEvent('pixx:toggle-sidebar'));
    }
  };
  const currentMonthVal = getCurrentMonth();
  const initialCache = getApiCache('/reports/dashboard', { params: { month: currentMonthVal } });
  const [selectedMonth, setSelectedMonth] = useState(currentMonthVal);
  const [data, setData] = useState(initialCache?.data || null);
  const [loading, setLoading] = useState(!initialCache?.data);
  const [complianceData, setComplianceData] = useState(null);
  const [chargesOverview, setChargesOverview] = useState(null);
  const [pnlSummary, setPnlSummary] = useState(null);
  const [exportingReport, setExportingReport] = useState(false);

  const companyName = selectedCompany?.name || 'Portfolio';
  const companyLegal = selectedCompany?.legalName || 'UK Property Finance';

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [res, compRes, chargesRes, pnlRes] = await Promise.all([
        reportsAPI.getDashboardStats({ month: selectedMonth }, { forceRefresh: true }),
        complianceAPI.getOverview({ forceRefresh: true }).catch(() => null),
        propertyChargesAPI.getOverview({ forceRefresh: true }).catch(() => null),
        pnlAPI.getSummary({ month: selectedMonth }, { forceRefresh: true }).catch(() => null),
      ]);
      if (res?.success) {
        setData(res.data);
      }
      if (compRes?.success) {
        setComplianceData(compRes.data);
      }
      if (chargesRes?.success) {
        setChargesOverview(chargesRes.data);
      }
      if (pnlRes?.success) {
        setPnlSummary(pnlRes.data);
      }
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isCurrent = true;
    const cached = getApiCache('/reports/dashboard', { params: { month: selectedMonth } });
    const cachedPnl = getApiCache('/pnl/summary', { params: { month: selectedMonth } });
    if (cachedPnl?.data) {
      setPnlSummary(cachedPnl.data);
    }
    if (cached?.data) {
      setData(cached.data);
      setLoading(false);
    } else if (!data) {
      setLoading(true);
    }

    const loadStats = async () => {
      try {
        const [res, compRes, chargesRes, pnlRes] = await Promise.all([
          reportsAPI.getDashboardStats({ month: selectedMonth }),
          complianceAPI.getOverview().catch(() => null),
          propertyChargesAPI.getOverview().catch(() => null),
          pnlAPI.getSummary({ month: selectedMonth }).catch(() => null),
        ]);
        if (isCurrent && res?.success) {
          setData(res.data);
        }
        if (isCurrent && compRes?.success) {
          setComplianceData(compRes.data);
        }
        if (isCurrent && chargesRes?.success) {
          setChargesOverview(chargesRes.data);
        }
        if (isCurrent && pnlRes?.success) {
          setPnlSummary(pnlRes.data);
        }
      } catch (err) {
        if (isCurrent) console.error('Failed to load dashboard stats:', err);
      } finally {
        if (isCurrent) setLoading(false);
      }
    };

    loadStats();

    return () => {
      isCurrent = false;
    };
  }, [selectedMonth, selectedCompany?.id]);

  const p = data?.portfolio || {};
  const m = data?.monthly || {};
  const recentTransactions = data?.recentTransactions || [];
  const monthlyTrends = data?.monthlyTrends || [];

  const isEmptyCompany = !loading && data && (p.totalProperties === 0) && (p.totalLiquidity === 0) && (recentTransactions.length === 0);

  return (
    <div
      className={`mx-auto transition-all duration-300 overflow-x-hidden ${
        isSidebarCollapsed
          ? 'w-full max-w-[1920px] p-3 sm:p-4 lg:p-5 space-y-3.5'
          : 'max-w-7xl p-4 sm:p-6 lg:p-8 space-y-6'
      }`}
    >
      {/* Executive Brand Header */}
      <div
        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-gradient-to-r dark:from-slate-900/90 dark:via-slate-900/80 dark:to-indigo-950/40 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm dashboard-header-banner ${
          isSidebarCollapsed ? 'p-3 sm:p-4' : 'p-4 sm:p-5'
        }`}
      >
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                {selectedCompany ? `${selectedCompany.name} Financial Dashboard` : 'Portfolio Financial Dashboard'}
              </h1>
              <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30">
                {companyLegal}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              {selectedCompany
                ? `Real-time UK property valuations, mortgage liabilities, and cash flow for ${selectedCompany.name} in GBP (£).`
                : 'Real-time UK property valuations, mortgage liabilities, and cash flow in GBP (£).'}
            </p>
          </div>
        </div>

        {/* Action Controls & Month Selector */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Hide / Show Sidebar Toggle Button */}
          <button
            type="button"
            onClick={handleToggleSidebar}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer shadow-xs ${
              isSidebarCollapsed
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500 shadow-indigo-600/20'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
            }`}
            title={isSidebarCollapsed ? 'Show Sidebar navigation' : 'Hide Sidebar for expanded view (No scrolling)'}
          >
            {isSidebarCollapsed ? (
              <>
                <PanelLeftOpen className="w-3.5 h-3.5" />
                <span>Show Sidebar</span>
              </>
            ) : (
              <>
                <PanelLeftClose className="w-3.5 h-3.5" />
                <span>Hide Sidebar</span>
              </>
            )}
          </button>

          {/* Month Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 shadow-sm">
            <Calendar className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer font-medium"
            />
          </div>
          <button
            onClick={fetchStats}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition cursor-pointer shadow-sm"
            title="Refresh metrics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && !data ? (
        <div className="space-y-4 py-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 rounded-2xl bg-slate-900/40 border border-slate-800/60 animate-pulse p-4" />
            ))}
          </div>
          <div className="h-64 rounded-2xl bg-slate-900/40 border border-slate-800/60 animate-pulse p-4" />
        </div>
      ) : (
        <>
          {/* Sensible Zero-State Onboarding Banner for Empty Companies */}
          {isEmptyCompany && (
            <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-slate-900 to-indigo-950/30 border border-indigo-500/30 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
                    <Sparkles className="w-4 h-4" />
                  </span>
                  <h3 className="text-sm font-extrabold text-white">
                    Welcome to {companyName} — Fresh Multi-Company Workspace
                  </h3>
                </div>
                <p className="text-xs text-slate-400 max-w-2xl">
                  No properties, tenancies, or transactions have been recorded under {companyLegal} yet. All financial calculations and ledgers are strictly partitioned. Get started below:
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onNavigate && onNavigate('properties')}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Property</span>
                </button>
                <button
                  onClick={() => onNavigate && onNavigate('data-entry')}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 border border-slate-700 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Data Entry</span>
                </button>
              </div>
            </div>
          )}

          {/* Primary Portfolio Cards */}
          <div className={`grid grid-cols-2 lg:grid-cols-4 ${isSidebarCollapsed ? 'gap-2.5 sm:gap-3' : 'gap-3 sm:gap-4'}`}>
            {/* Total Property Value */}
            <div className={`bg-slate-900/90 border border-slate-800 rounded-2xl relative overflow-hidden ${isSidebarCollapsed ? 'p-3 sm:p-3.5' : 'p-4'}`}>
              <div className="flex items-center justify-between text-slate-400 mb-1.5">
                <span className="text-xs font-medium">Portfolio Valuation</span>
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
              <div className="font-display text-lg sm:text-xl font-bold text-white tracking-tight tabular-nums">
                {formatGBP(p.totalPortfolioValue)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {p.totalProperties || 0} active {p.totalProperties === 1 ? 'property' : 'properties'} · {p.totalUnits || 0} {p.totalUnits === 1 ? 'unit' : 'units'}
              </div>
            </div>

            {/* Total Mortgage Liabilities */}
            <div className={`bg-slate-900/90 border border-slate-800 rounded-2xl relative overflow-hidden ${isSidebarCollapsed ? 'p-3 sm:p-3.5' : 'p-4'}`}>
              <div className="flex items-center justify-between text-slate-400 mb-1.5">
                <span className="text-xs font-medium">Mortgage Liabilities</span>
                <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
                  <Landmark className="w-4 h-4" />
                </div>
              </div>
              <div className="font-display text-lg sm:text-xl font-bold text-white tracking-tight tabular-nums">
                {formatGBP(p.totalMortgageDebt)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                <span>Avg LTV:</span>
                <span className="font-semibold text-slate-300">{p.averageLtv || 0}%</span>
              </div>
            </div>

            {/* Net Equity */}
            <div className={`bg-slate-900/90 border border-slate-800 rounded-2xl relative overflow-hidden ${isSidebarCollapsed ? 'p-3 sm:p-3.5' : 'p-4'}`}>
              <div className="flex items-center justify-between text-slate-400 mb-1.5">
                <span className="text-xs font-medium">Net Portfolio Equity</span>
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="font-display text-lg sm:text-xl font-bold text-white tracking-tight tabular-nums">
                {formatGBP(p.netEquity)}
              </div>
              <div className="text-[11px] text-emerald-400/90 mt-1">
                Asset value less mortgage debt
              </div>
            </div>

            {/* Total Bank Liquidity */}
            <div className={`bg-slate-900/90 border border-slate-800 rounded-2xl relative overflow-hidden ${isSidebarCollapsed ? 'p-3 sm:p-3.5' : 'p-4'}`}>
              <div className="flex items-center justify-between text-slate-400 mb-1.5">
                <span className="text-xs font-medium">Bank Cash Liquidity</span>
                <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
                  <Wallet className="w-4 h-4" />
                </div>
              </div>
              <div className="font-display text-lg sm:text-xl font-bold text-white tracking-tight tabular-nums">
                {formatGBP(p.totalLiquidity)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Cash across {companyName} accounts
              </div>
            </div>
          </div>

          {/* Monthly Performance Panel */}
          <div className={`bg-slate-900/80 border border-slate-800 rounded-2xl ${isSidebarCollapsed ? 'p-3 sm:p-4 space-y-3' : 'p-4 sm:p-5 space-y-4'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white">
                  Monthly Cash Performance: {formatMonthLabel(selectedMonth)}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Cash-inflows from rent vs operational expenses and mortgage servicing for {companyName}.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                <span className="text-slate-400">Collection Rate:</span>
                <span className={`font-bold ${m.collectionRate >= 90 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {m.collectionRate || 0}%
                </span>
              </div>
            </div>

            <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 ${isSidebarCollapsed ? 'gap-2 sm:gap-2.5' : 'gap-3'}`}>
              {/* 1. Expected Rent Roll */}
              <div className={`metric-card-neutral min-w-0 ${isSidebarCollapsed ? 'p-2.5 sm:p-3' : 'p-3 sm:p-3.5'} rounded-xl flex flex-col justify-between transition hover:border-slate-500`}>
                <div className="flex items-center justify-between gap-1">
                  <span className="metric-title text-[11px] font-semibold uppercase tracking-wider">
                    Expected Rent
                  </span>
                  <Receipt className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                </div>
                <div className="metric-value min-w-0 whitespace-nowrap font-display text-sm sm:text-base font-bold mt-1.5 tracking-tight tabular-nums">
                  {formatGBP(m.expectedRent)}
                </div>
                <div className="metric-subtext min-w-0 break-words text-[10px] font-medium mt-1">Scheduled roll</div>
              </div>

              {/* 2. Rent Collected */}
              <div className={`metric-card-rent-collected min-w-0 ${isSidebarCollapsed ? 'p-2.5 sm:p-3' : 'p-3 sm:p-3.5'} rounded-xl flex flex-col justify-between transition hover:shadow-md`}>
                <div className="flex items-center justify-between gap-1">
                  <span className="metric-title text-[11px] font-semibold uppercase tracking-wider">
                    Rent Collected
                  </span>
                  <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                </div>
                <div className="metric-value min-w-0 whitespace-nowrap font-display text-sm sm:text-base font-bold mt-1.5 tracking-tight tabular-nums">
                  {formatGBP(m.rentCollected)}
                </div>
                <div className="metric-subtext min-w-0 break-words text-[10px] font-medium mt-1">Bank receipts</div>
              </div>

              {/* 3. Arrears / Uncollected */}
              <div className={`metric-card-arrears min-w-0 ${isSidebarCollapsed ? 'p-2.5 sm:p-3' : 'p-3 sm:p-3.5'} rounded-xl flex flex-col justify-between transition hover:shadow-md`}>
                <div className="flex items-center justify-between gap-1">
                  <span className="metric-title text-[11px] font-semibold uppercase tracking-wider">
                    Arrears / Due
                  </span>
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                </div>
                <div className="metric-value min-w-0 whitespace-nowrap font-display text-sm sm:text-base font-bold mt-1.5 tracking-tight tabular-nums">
                  {formatGBP(m.rentOutstanding)}
                </div>
                <div className="metric-subtext min-w-0 break-words text-[10px] font-medium mt-1">Uncollected rent</div>
              </div>

              {/* 4. Operating Expenses */}
              <div className={`metric-card-neutral min-w-0 ${isSidebarCollapsed ? 'p-2.5 sm:p-3' : 'p-3 sm:p-3.5'} rounded-xl flex flex-col justify-between transition hover:border-slate-500`}>
                <div className="flex items-center justify-between gap-1">
                  <span className="metric-title text-[11px] font-semibold uppercase tracking-wider">
                    Operating Exp
                  </span>
                  <Receipt className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                </div>
                <div className="metric-value min-w-0 whitespace-nowrap font-display text-sm sm:text-base font-bold mt-1.5 tracking-tight tabular-nums">
                  {formatGBP(m.operatingExpenses)}
                </div>
                <div className="metric-subtext min-w-0 break-words text-[10px] font-medium mt-1">Repairs & fees</div>
              </div>

              {/* 5. Mortgage Payments */}
              <div className={`metric-card-mortgage-payments min-w-0 ${isSidebarCollapsed ? 'p-2.5 sm:p-3' : 'p-3 sm:p-3.5'} rounded-xl flex flex-col justify-between transition hover:shadow-md`}>
                <div className="flex items-center justify-between gap-1">
                  <span className="metric-title text-[11px] font-semibold uppercase tracking-wider">
                    Mortgages
                  </span>
                  <Landmark className="w-3.5 h-3.5 shrink-0" />
                </div>
                <div className="metric-value min-w-0 whitespace-nowrap font-display text-sm sm:text-base font-bold mt-1.5 tracking-tight tabular-nums">
                  {formatGBP(m.totalMortgagePaid)}
                </div>
                <div className="metric-subtext text-[10px] font-medium mt-1 truncate">
                  Int: {formatGBP(m.mortgageInterestPaid)} · Prin: {formatGBP(m.mortgagePrincipalPaid)}
                </div>
              </div>

              {/* 6. Net Cash Flow */}
              <div
                className={`min-w-0 ${isSidebarCollapsed ? 'p-2.5 sm:p-3' : 'p-3 sm:p-3.5'} rounded-xl flex flex-col justify-between transition hover:shadow-md ${
                  (m.netCashFlow || 0) >= 0 ? 'metric-card-net-cash-flow' : 'metric-card-mortgage-payments'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="metric-title text-[11px] font-semibold uppercase tracking-wider">
                    Net Cash Flow
                  </span>
                  <Wallet className="w-3.5 h-3.5 shrink-0" />
                </div>
                <div className="metric-value min-w-0 whitespace-nowrap font-display text-sm sm:text-base font-bold mt-1.5 tracking-tight tabular-nums">
                  {formatGBP(m.netCashFlow)}
                </div>
                <div className="metric-subtext min-w-0 break-words text-[10px] font-medium mt-1">
                  Rent + Inflow − Exp − Mortgages
                </div>
              </div>
            </div>
          </div>

          {/* Executive Profit & Loss Performance Widget */}
          <div className={`bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm ${isSidebarCollapsed ? 'p-3 sm:p-4 space-y-3' : 'p-4 sm:p-6 space-y-4'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Profit & Loss Executive Summary: {formatMonthLabel(selectedMonth)}
                    </h3>
                    <span className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30">
                      P&L Statement
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Recognised income less allowable operating expenditure and mortgage finance interest.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigate && onNavigate('profit-loss')}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition cursor-pointer self-start sm:self-auto"
              >
                <span>View Full P&L Statement</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className={`grid grid-cols-1 md:grid-cols-3 ${isSidebarCollapsed ? 'gap-2.5 sm:gap-3' : 'gap-4'}`}>
              {/* Card 1: Current Month Net Profit / Loss */}
              <div className={`rounded-xl border ${isSidebarCollapsed ? 'p-3' : 'p-4'} ${
                pnlSummary?.currentPeriod?.isProfit
                  ? 'bg-emerald-500/5 border-emerald-500/30 dark:bg-emerald-950/20'
                  : 'bg-rose-500/5 border-rose-500/30 dark:bg-rose-950/20'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    {formatMonthLabel(selectedMonth)} Net Result
                  </span>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                    pnlSummary?.currentPeriod?.isProfit
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300'
                  }`}>
                    {pnlSummary?.currentPeriod?.isProfit ? 'Net Profit' : 'Net Loss'}
                  </span>
                </div>
                <div className={`text-2xl font-black mt-2 tabular-nums ${
                  pnlSummary?.currentPeriod?.isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}>
                  {formatGBP(pnlSummary?.currentPeriod?.netResult ?? (m.rentCollected - m.operatingExpenses - m.mortgageInterestPaid))}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                  <span>Net Margin:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">
                    {pnlSummary?.currentPeriod?.netProfitMargin != null ? `${pnlSummary.currentPeriod.netProfitMargin}%` : '—'}
                  </span>
                </div>
              </div>

              {/* Card 2: MoM Comparison */}
              <div className={`rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 ${isSidebarCollapsed ? 'p-3' : 'p-4'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Previous Month Comparison
                  </span>
                  {pnlSummary?.comparison?.hasComparison && (
                    <span className={`inline-flex items-center gap-0.5 text-xs font-bold ${
                      (pnlSummary.comparison.netChange || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'
                    }`}>
                      {(pnlSummary.comparison.netChange || 0) >= 0 ? (
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowDownRight className="w-3.5 h-3.5" />
                      )}
                      {pnlSummary.comparison.netChangePercent != null ? `${pnlSummary.comparison.netChangePercent}%` : ''}
                    </span>
                  )}
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white mt-2 tabular-nums">
                  {pnlSummary?.comparison?.hasComparison
                    ? `${(pnlSummary.comparison.netChange || 0) >= 0 ? '+' : ''}${formatGBP(pnlSummary.comparison.netChange)}`
                    : 'Baseline Month'}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                  <span>Prev Net Result:</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {pnlSummary?.comparison?.hasComparison ? formatGBP(pnlSummary.comparison.prevNetResult) : '—'}
                  </span>
                </div>
              </div>

              {/* Card 3: Year-to-Date (YTD) Profit */}
              <div className={`rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 ${isSidebarCollapsed ? 'p-3' : 'p-4'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                    Year-to-Date (YTD) Result
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    Annual YTD
                  </span>
                </div>
                <div className={`text-2xl font-black mt-2 tabular-nums ${
                  (pnlSummary?.ytd?.netResult || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}>
                  {formatGBP(pnlSummary?.ytd?.netResult || 0)}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                  <span>YTD Revenue:</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {formatGBP(pnlSummary?.ytd?.totalIncome || 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Statutory Compliance & Service Charges Row - Side by side when expanded to eliminate scroll */}
          <div className={`grid grid-cols-1 ${isSidebarCollapsed ? 'xl:grid-cols-2 gap-3.5' : 'gap-6'}`}>
            {/* Portfolio Statutory Compliance & Expiry Register */}
            <div className={`bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col justify-between ${isSidebarCollapsed ? 'p-3.5 sm:p-4 space-y-3.5' : 'p-5 sm:p-6 space-y-5'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">
                      Statutory Compliance & Document Centre
                    </h3>
                    <span className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      45-Day Advance Alerts
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Gas safety CP12, electrical EICR, EPC, building insurance, and council HMO licensing tracking.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if ('Notification' in window) {
                      Notification.requestPermission().then((perm) => {
                        if (perm === 'granted') {
                          alert('Browser push alerts enabled for statutory compliance deadlines!');
                        }
                      });
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs flex items-center gap-1.5 border border-slate-700 transition cursor-pointer"
                  title="Enable browser notifications"
                >
                  <Bell className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="hidden sm:inline">Push Alerts</span>
                </button>

                <div className="flex items-center rounded-xl bg-slate-800/80 border border-slate-700 p-0.5">
                  <button
                    type="button"
                    disabled={exportingReport}
                    onClick={async () => {
                      setExportingReport(true);
                      try {
                        await complianceAPI.downloadReport('excel');
                      } catch (err) {
                        console.error(err);
                      } finally {
                        setExportingReport(false);
                      }
                    }}
                    className="px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Excel</span>
                  </button>
                  <button
                    type="button"
                    disabled={exportingReport}
                    onClick={async () => {
                      setExportingReport(true);
                      try {
                        await complianceAPI.downloadReport('pdf');
                      } catch (err) {
                        console.error(err);
                      } finally {
                        setExportingReport(false);
                      }
                    }}
                    className="px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition flex items-center gap-1 cursor-pointer disabled:opacity-50 border-l border-slate-700"
                  >
                    <FileText className="w-3.5 h-3.5 text-indigo-400" />
                    <span>PDF</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigate && onNavigate('properties')}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition cursor-pointer"
                >
                  <span>Properties Register</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Compliance Quick Metric Indicators */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-col justify-between">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Valid & Active</span>
                <div className="text-xl font-extrabold text-emerald-400 mt-1 tabular-nums">
                  {complianceData?.summary?.activeValid ?? '—'}
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5">Certificates current</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-amber-500/20 flex flex-col justify-between">
                <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">≤ 45 Days Warning</span>
                <div className="text-xl font-extrabold text-amber-400 mt-1 tabular-nums">
                  {complianceData?.summary?.expiringWithin45 ?? '—'}
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5">Priority renewals</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-rose-500/20 flex flex-col justify-between">
                <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider">Expired / Overdue</span>
                <div className="text-xl font-extrabold text-rose-400 mt-1 tabular-nums">
                  {complianceData?.summary?.expiredCount ?? '—'}
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5">Action required</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-yellow-500/20 flex flex-col justify-between">
                <span className="text-[11px] font-semibold text-yellow-400 uppercase tracking-wider">Missing Records</span>
                <div className="text-xl font-extrabold text-yellow-400 mt-1 tabular-nums">
                  {complianceData?.summary?.missingCount ?? '—'}
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5">Statutory items</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-indigo-500/20 flex flex-col justify-between col-span-2 sm:col-span-1">
                <span className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider">Council Deadlines</span>
                <div className="text-xl font-extrabold text-indigo-400 mt-1 tabular-nums">
                  {complianceData?.summary?.councilDeadlinesCount ?? '—'}
                </div>
                <span className="text-[10px] text-slate-500 mt-0.5">Pending applications</span>
              </div>
            </div>

            {/* Critical Document Alerts List */}
            {complianceData?.criticalAlerts && complianceData.criticalAlerts.length > 0 ? (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Statutory Compliance Alerts ({complianceData.criticalAlerts.length})</span>
                  </div>
                  <span className="text-[11px] text-slate-400">Target response window: 45 days</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {complianceData.criticalAlerts.map((alertItem) => (
                    <div
                      key={alertItem._id}
                      className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${
                            alertItem.status === 'EXPIRED'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : alertItem.isMissing
                              ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            {alertItem.status}
                          </span>
                          <span className="font-bold text-white truncate" title={alertItem.title}>
                            {alertItem.title}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 truncate">
                          <span>{alertItem.propertyId?.name || 'Property'}</span>
                          {alertItem.expiryDate && (
                            <>
                              <span className="mx-1.5">•</span>
                              <span className={alertItem.status === 'EXPIRED' ? 'text-rose-400 font-bold' : 'text-amber-400'}>
                                Expiry: {formatUKDate(alertItem.expiryDate)} ({alertItem.daysUntilExpiry}d left)
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onNavigate && onNavigate('properties')}
                        className="px-2.5 py-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-lg transition shrink-0 cursor-pointer"
                      >
                        Inspect
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-center gap-3 text-xs text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  All gas safety, electrical condition, energy performance, insurance, and licensing records are fully up to date for {companyName}.
                </span>
              </div>
            )}
          </div>

            {/* Service Charges & Ground Rent Overview Card */}
            <div className={`bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col justify-between ${isSidebarCollapsed ? 'p-3.5 sm:p-4 space-y-3.5' : 'p-5 space-y-4'}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>Service Charges & Ground Rent Ledger</span>
                      {chargesOverview?.pendingCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {chargesOverview.pendingCount} Pending Demands
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Managing company demands, partial payment reconciliation & banking audit trail
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigate && onNavigate('properties')}
                  className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition cursor-pointer self-start sm:self-auto"
                >
                  <span>Open Property Ledgers</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className={`grid grid-cols-2 sm:grid-cols-4 ${isSidebarCollapsed ? 'gap-2' : 'gap-3'}`}>
                <div className={`${isSidebarCollapsed ? 'p-2.5 sm:p-3' : 'p-3.5'} rounded-xl bg-slate-950/60 border border-slate-800/80`}>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Demanded Total</span>
                  <div className="text-base sm:text-lg font-extrabold text-white mt-1 tabular-nums">
                    {formatGBP(chargesOverview?.totalDemanded || 0)}
                  </div>
                  <span className="text-[10px] text-slate-500">All raised notices</span>
                </div>

                <div className={`${isSidebarCollapsed ? 'p-2.5 sm:p-3' : 'p-3.5'} rounded-xl bg-slate-950/60 border border-emerald-500/20`}>
                  <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider block">Reconciled Paid</span>
                  <div className="text-base sm:text-lg font-extrabold text-emerald-400 mt-1 tabular-nums">
                    {formatGBP(chargesOverview?.totalPaid || 0)}
                  </div>
                  <span className="text-[10px] text-slate-500">Deducted from bank</span>
                </div>

                <div className={`${isSidebarCollapsed ? 'p-2.5 sm:p-3' : 'p-3.5'} rounded-xl bg-slate-950/60 border border-amber-500/20`}>
                  <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block">Balance Due</span>
                  <div className={`text-base sm:text-lg font-extrabold mt-1 tabular-nums ${(chargesOverview?.currentOutstanding || 0) > 0 ? 'text-amber-400' : 'text-slate-300'}`}>
                    {formatGBP(chargesOverview?.currentOutstanding || 0)}
                  </div>
                  <span className="text-[10px] text-slate-500">Unsettled balance</span>
                </div>

                <div className={`${isSidebarCollapsed ? 'p-2.5 sm:p-3' : 'p-3.5'} rounded-xl bg-slate-950/60 border border-rose-500/20`}>
                  <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider block">Overdue Demands</span>
                  <div className={`text-base sm:text-lg font-extrabold mt-1 tabular-nums ${(chargesOverview?.overdueAmount || 0) > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                    {formatGBP(chargesOverview?.overdueAmount || 0)}
                  </div>
                  <span className="text-[10px] text-slate-500">Exceeded due date</span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity & Monthly Comparison Grid */}
          <div className={`grid grid-cols-1 lg:grid-cols-2 ${isSidebarCollapsed ? 'gap-3.5' : 'gap-5'}`}>
            {/* Recent Transactions in Active Company */}
            <div className={`bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col justify-between ${isSidebarCollapsed ? 'p-3.5 sm:p-4 space-y-3' : 'p-5 space-y-4'}`}>
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-sm font-bold text-white">
                    Recent Transactions: {companyName}
                  </h3>
                </div>
                <button
                  onClick={() => onNavigate && onNavigate('ledger')}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition cursor-pointer"
                >
                  <span>View All Ledger</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {recentTransactions.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No posted transactions recorded for {companyName} yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {recentTransactions.map((tx) => (
                    <div
                      key={tx._id}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-bold text-indigo-400 px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
                            {tx.voucherNo}
                          </span>
                          <span className="font-semibold text-white truncate max-w-xs" title={tx.narration}>
                            {tx.narration || tx.categoryName}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2 truncate">
                          <span>{formatUKDate(tx.date)}</span>
                          <span>•</span>
                          <span className="text-slate-300">{tx.categoryName}</span>
                          {tx.propertyName !== '-' && (
                            <>
                              <span>•</span>
                              <span className="text-indigo-300 truncate">{tx.propertyName}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div
                          className={`font-mono font-bold text-sm ${
                            tx.direction === 'IN' || tx.transactionType === 'INCOME'
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {tx.direction === 'IN' || tx.transactionType === 'INCOME' ? '+' : '-'}
                          {formatGBP(tx.amount)}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{tx.accountName}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 6-Month Income vs Expenses Visualizer */}
            <div className={`bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col justify-between ${isSidebarCollapsed ? 'p-3.5 sm:p-4 space-y-3' : 'p-5 space-y-4'}`}>
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">
                    6-Month Historical Flow ({companyName})
                  </h3>
                </div>
                <span className="text-xs text-slate-400 font-medium">Income vs Costs</span>
              </div>

              {monthlyTrends.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No historical cash flow data available.
                </div>
              ) : (
                <div className={`space-y-3 ${isSidebarCollapsed ? 'max-h-64 overflow-y-auto pr-1' : ''}`}>
                  {monthlyTrends.map((trend) => (
                    <div key={trend.month} className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/60 text-xs space-y-1.5">
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-slate-300">{formatMonthLabel(trend.month)}</span>
                        <span className={trend.net >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                          Net: {formatGBP(trend.net)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                        <div className="flex items-center justify-between bg-slate-900 px-2 py-1 rounded-lg">
                          <span>Income:</span>
                          <span className="text-emerald-400 font-bold">{formatGBP(trend.income)}</span>
                        </div>
                        <div className="flex items-center justify-between bg-slate-900 px-2 py-1 rounded-lg">
                          <span>Expenses:</span>
                          <span className="text-rose-400 font-bold">{formatGBP(trend.expenses)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions Shortcuts */}
          <div className={`grid grid-cols-2 sm:grid-cols-4 ${isSidebarCollapsed ? 'gap-2.5' : 'gap-3'}`}>
            <button
              onClick={() => onNavigate('rent')}
              className={`${isSidebarCollapsed ? 'p-2.5 sm:p-3' : 'p-3.5'} rounded-xl bg-slate-900 hover:bg-slate-800/80 border border-slate-800 text-left transition flex items-center justify-between group cursor-pointer`}
            >
              <div>
                <div className="text-xs font-semibold text-white group-hover:text-indigo-400 transition">
                  Collect Rent
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Record receipt into bank</div>
              </div>
              <Receipt className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition" />
            </button>

            <button
              onClick={() => onNavigate('mortgages')}
              className={`${isSidebarCollapsed ? 'p-2.5 sm:p-3' : 'p-3.5'} rounded-xl bg-slate-900 hover:bg-slate-800/80 border border-slate-800 text-left transition flex items-center justify-between group cursor-pointer`}
            >
              <div>
                <div className="text-xs font-semibold text-white group-hover:text-indigo-400 transition">
                  Mortgage Payment
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Split Interest & Principal</div>
              </div>
              <Landmark className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition" />
            </button>

            <button
              onClick={() => onNavigate('ledger')}
              className={`${isSidebarCollapsed ? 'p-2.5 sm:p-3' : 'p-3.5'} rounded-xl bg-slate-900 hover:bg-slate-800/80 border border-slate-800 text-left transition flex items-center justify-between group cursor-pointer`}
            >
              <div>
                <div className="text-xs font-semibold text-white group-hover:text-indigo-400 transition">
                  Record Expense
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Property / Unit repairs</div>
              </div>
              <Plus className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition" />
            </button>

            <button
              onClick={() => onNavigate('accounts')}
              className={`${isSidebarCollapsed ? 'p-2.5 sm:p-3' : 'p-3.5'} rounded-xl bg-slate-900 hover:bg-slate-800/80 border border-slate-800 text-left transition flex items-center justify-between group cursor-pointer`}
            >
              <div>
                <div className="text-xs font-semibold text-white group-hover:text-indigo-400 transition">
                  Transfer Funds
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Between {companyName} accounts</div>
              </div>
              <Wallet className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default DashboardPage;
