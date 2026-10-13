import React, { useState, useEffect } from 'react';
import {
  Building2,
  Landmark,
  Wallet,
  Receipt,
  TrendingUp,
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
} from 'lucide-react';
import { formatGBP, formatUKDate, formatMonthLabel, getCurrentMonth } from '../utils/formatters.js';
import { reportsAPI } from '../services/api.js';
import pixxLogo from '../assets/logo.png';

export function DashboardPage({ onNavigate, selectedCompany }) {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const companyLogo = selectedCompany?.logo || pixxLogo;
  const companyName = selectedCompany?.name || 'Portfolio';
  const companyLegal = selectedCompany?.legalName || 'UK Property Finance';

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await reportsAPI.getDashboardStats({ month: selectedMonth });
      if (res?.success) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isCurrent = true;
    setData(null);
    setLoading(true);

    const loadStats = async () => {
      try {
        const res = await reportsAPI.getDashboardStats({ month: selectedMonth });
        if (isCurrent && res?.success) {
          setData(res.data);
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Executive Brand Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gradient-to-r dark:from-slate-900/90 dark:via-slate-900/80 dark:to-indigo-950/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm dashboard-header-banner">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-white border border-slate-200/90 dark:bg-slate-950/90 dark:border-slate-800/80 flex items-center justify-center p-1.5 shadow-sm shrink-0 overflow-hidden">
            <img src={companyLogo} alt={`${companyName} Logo`} className="h-full w-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
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

        {/* Month Selector */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Total Property Value */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">Portfolio Valuation</span>
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
              <div className="font-display text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight tabular-nums">
                {formatGBP(p.totalPortfolioValue)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {p.totalProperties || 0} active {p.totalProperties === 1 ? 'property' : 'properties'} · {p.totalUnits || 0} {p.totalUnits === 1 ? 'unit' : 'units'}
              </div>
            </div>

            {/* Total Mortgage Liabilities */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">Mortgage Liabilities</span>
                <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
                  <Landmark className="w-4 h-4" />
                </div>
              </div>
              <div className="font-display text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight tabular-nums">
                {formatGBP(p.totalMortgageDebt)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                <span>Avg LTV:</span>
                <span className="font-semibold text-slate-300">{p.averageLtv || 0}%</span>
              </div>
            </div>

            {/* Net Equity */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">Net Portfolio Equity</span>
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="font-display text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight tabular-nums">
                {formatGBP(p.netEquity)}
              </div>
              <div className="text-[11px] text-emerald-400/90 mt-1">
                Asset value less mortgage debt
              </div>
            </div>

            {/* Total Bank Liquidity */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 relative overflow-hidden">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium">Bank Cash Liquidity</span>
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                  <Wallet className="w-4 h-4" />
                </div>
              </div>
              <div className="font-display text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight tabular-nums">
                {formatGBP(p.totalLiquidity)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Cash across {companyName} accounts
              </div>
            </div>
          </div>

          {/* Monthly Performance Panel */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-2">
              <div>
                <h2 className="text-base font-bold text-white">
                  Monthly Cash Performance: {formatMonthLabel(selectedMonth)}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Cash-inflows from rent vs operational expenses and mortgage servicing for {companyName}.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                <span className="text-slate-400">Collection Rate:</span>
                <span className={`font-bold ${m.collectionRate >= 90 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {m.collectionRate || 0}%
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
              {/* 1. Expected Rent Roll */}
              <div className="metric-card-neutral min-w-0 p-4 sm:p-5 rounded-2xl flex flex-col justify-between transition hover:border-slate-500">
                <div className="flex items-center justify-between gap-1">
                  <span className="metric-title text-xs sm:text-[13px] font-bold uppercase tracking-wider">
                    Expected Rent
                  </span>
                  <Receipt className="w-4 h-4 text-slate-500 shrink-0" />
                </div>
                <div className="metric-value min-w-0 whitespace-nowrap font-display text-lg sm:text-xl lg:text-2xl xl:text-[clamp(1.125rem,1.8vw,1.75rem)] 2xl:text-[28px] leading-tight font-extrabold mt-2.5 tracking-tight tabular-nums">
                  {formatGBP(m.expectedRent)}
                </div>
                <div className="metric-subtext min-w-0 break-words text-xs font-semibold mt-1">Scheduled roll</div>
              </div>

              {/* 2. Rent Collected */}
              <div className="metric-card-rent-collected min-w-0 p-4 sm:p-5 rounded-2xl flex flex-col justify-between transition hover:shadow-md">
                <div className="flex items-center justify-between gap-1">
                  <span className="metric-title text-xs sm:text-[13px] font-extrabold uppercase tracking-wider">
                    Rent Collected
                  </span>
                  <TrendingUp className="w-4 h-4 shrink-0" />
                </div>
                <div className="metric-value min-w-0 whitespace-nowrap font-display text-lg sm:text-xl lg:text-2xl xl:text-[clamp(1.125rem,1.8vw,1.75rem)] 2xl:text-[28px] leading-tight font-extrabold mt-2.5 tracking-tight tabular-nums">
                  {formatGBP(m.rentCollected)}
                </div>
                <div className="metric-subtext min-w-0 break-words text-xs font-bold mt-1">Bank receipts</div>
              </div>

              {/* 3. Arrears / Uncollected */}
              <div className="metric-card-arrears min-w-0 p-4 sm:p-5 rounded-2xl flex flex-col justify-between transition hover:shadow-md">
                <div className="flex items-center justify-between gap-1">
                  <span className="metric-title text-xs sm:text-[13px] font-extrabold uppercase tracking-wider">
                    Arrears / Uncollected
                  </span>
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                </div>
                <div className="metric-value min-w-0 whitespace-nowrap font-display text-lg sm:text-xl lg:text-2xl xl:text-[clamp(1.125rem,1.8vw,1.75rem)] 2xl:text-[28px] leading-tight font-extrabold mt-2.5 tracking-tight tabular-nums">
                  {formatGBP(m.rentOutstanding)}
                </div>
                <div className="metric-subtext min-w-0 break-words text-xs font-bold mt-1">Uncollected rent</div>
              </div>

              {/* 4. Operating Expenses */}
              <div className="metric-card-neutral min-w-0 p-4 sm:p-5 rounded-2xl flex flex-col justify-between transition hover:border-slate-500">
                <div className="flex items-center justify-between gap-1">
                  <span className="metric-title text-xs sm:text-[13px] font-bold uppercase tracking-wider">
                    Operating Exp
                  </span>
                  <Receipt className="w-4 h-4 text-slate-500 shrink-0" />
                </div>
                <div className="metric-value min-w-0 whitespace-nowrap font-display text-lg sm:text-xl lg:text-2xl xl:text-[clamp(1.125rem,1.8vw,1.75rem)] 2xl:text-[28px] leading-tight font-extrabold mt-2.5 tracking-tight tabular-nums">
                  {formatGBP(m.operatingExpenses)}
                </div>
                <div className="metric-subtext min-w-0 break-words text-xs font-semibold mt-1">Repairs & fees</div>
              </div>

              {/* 5. Mortgage Payments */}
              <div className="metric-card-mortgage-payments min-w-0 p-4 sm:p-5 rounded-2xl flex flex-col justify-between transition hover:shadow-md">
                <div className="flex items-center justify-between gap-1">
                  <span className="metric-title text-xs sm:text-[13px] font-extrabold uppercase tracking-wider">
                    Mortgage Payments
                  </span>
                  <Landmark className="w-4 h-4 shrink-0" />
                </div>
                <div className="metric-value min-w-0 whitespace-nowrap font-display text-lg sm:text-xl lg:text-2xl xl:text-[clamp(1.125rem,1.8vw,1.75rem)] 2xl:text-[28px] leading-tight font-extrabold mt-2.5 tracking-tight tabular-nums">
                  {formatGBP(m.totalMortgagePaid)}
                </div>
                <div className="metric-subtext text-xs font-bold mt-1 truncate">
                  Int: {formatGBP(m.mortgageInterestPaid)} · Prin: {formatGBP(m.mortgagePrincipalPaid)}
                </div>
              </div>

              {/* 6. Net Cash Flow */}
              <div
                className={`min-w-0 p-4 sm:p-5 rounded-2xl flex flex-col justify-between transition hover:shadow-md ${
                  (m.netCashFlow || 0) >= 0 ? 'metric-card-net-cash-flow' : 'metric-card-mortgage-payments'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="metric-title text-xs sm:text-[13px] font-extrabold uppercase tracking-wider">
                    Net Cash Flow
                  </span>
                  <Wallet className="w-4 h-4 shrink-0" />
                </div>
                <div className="metric-value min-w-0 whitespace-nowrap font-display text-lg sm:text-xl lg:text-2xl xl:text-[clamp(1.125rem,1.8vw,1.75rem)] 2xl:text-[28px] leading-tight font-extrabold mt-2.5 tracking-tight tabular-nums">
                  {formatGBP(m.netCashFlow)}
                </div>
                <div className="metric-subtext min-w-0 break-words text-xs font-bold mt-1">
                  Rent + Inflow − Exp − Mortgages
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity & Monthly Comparison Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Recent Transactions in Active Company */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
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
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
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
                <div className="space-y-3">
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
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              onClick={() => onNavigate('rent')}
              className="p-3.5 rounded-xl bg-slate-900 hover:bg-slate-800/80 border border-slate-800 text-left transition flex items-center justify-between group cursor-pointer"
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
              className="p-3.5 rounded-xl bg-slate-900 hover:bg-slate-800/80 border border-slate-800 text-left transition flex items-center justify-between group cursor-pointer"
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
              className="p-3.5 rounded-xl bg-slate-900 hover:bg-slate-800/80 border border-slate-800 text-left transition flex items-center justify-between group cursor-pointer"
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
              className="p-3.5 rounded-xl bg-slate-900 hover:bg-slate-800/80 border border-slate-800 text-left transition flex items-center justify-between group cursor-pointer"
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
