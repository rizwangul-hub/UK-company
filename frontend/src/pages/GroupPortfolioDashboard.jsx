import React, { useState, useEffect } from 'react';
import {
  Building2,
  FileSpreadsheet,
  FileText,
  Download,
  RefreshCw,
  Landmark,
  Coins,
  TrendingUp,
  Receipt,
  Users,
  Search,
  ExternalLink,
  Loader2,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Layers,
  Sparkles,
  ArrowRightLeft,
} from 'lucide-react';
import { formatGBP } from '../utils/formatters.js';
import { reportsAPI } from '../services/api.js';
import { COMPANIES } from '../config/companies.js';
import pixxLogo from '../assets/logo.png';

export function GroupPortfolioDashboard({ user, onSelectCompany, onSwitchToSingleCompany }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [excelDownloading, setExcelDownloading] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'properties' | 'mortgages'
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCompany, setFilterCompany] = useState('ALL');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await reportsAPI.getConsolidatedOverview();
      if (res?.success) {
        // Robust extraction: handles res.data, res.message, or res itself
        const payload =
          res.data && typeof res.data === 'object' && res.data.totals
            ? res.data
            : res.message && typeof res.message === 'object' && res.message.totals
            ? res.message
            : res.totals
            ? res
            : null;

        if (payload) {
          setData(payload);
        } else {
          console.warn('Unexpected consolidated overview response structure:', res);
          setError('Failed to load portfolio overview: invalid response structure.');
        }
      } else {
        setError(res?.message || 'Failed to load master overview');
      }
    } catch (err) {
      console.error('Failed to load consolidated group data:', err);
      setError(err.response?.data?.message || err.message || 'Network error loading consolidated data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDownloadExcel = async () => {
    setExcelDownloading(true);
    try {
      const filename = `Consolidated_Rent_Details_All_Companies_${new Date().toISOString().slice(0, 10)}.xlsx`;
      await reportsAPI.downloadConsolidatedExcel(filename);
    } catch (err) {
      console.error('Excel download failed:', err);
      alert(err.message || 'Failed to download consolidated Excel file');
    } finally {
      setExcelDownloading(false);
    }
  };

  const handleDownloadPdf = async () => {
    setPdfDownloading(true);
    try {
      const filename = `Consolidated_Group_Portfolio_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
      await reportsAPI.downloadConsolidatedPdf(filename);
    } catch (err) {
      console.error('PDF download failed:', err);
      alert(err.message || 'Failed to download consolidated PDF report');
    } finally {
      setPdfDownloading(false);
    }
  };

  // Filtered properties for direct property inventory table
  const filteredProperties = (data?.allProperties || []).filter((p) => {
    const matchesSearch =
      !searchTerm.trim() ||
      (p.name && p.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.tenantName && p.tenantName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.address?.line1 && p.address.line1.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCompany = filterCompany === 'ALL' || p.companyId === filterCompany;
    return matchesSearch && matchesCompany;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header Banner */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-10 w-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center p-1.5 shadow-md shrink-0">
            <img src={pixxLogo} alt="Pixx Technologies UK" className="h-full w-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-sm sm:text-base tracking-tight text-white">
                PIXX TECHNOLOGIES
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                MASTER GROUP DASHBOARD
              </span>
            </div>
            <p className="text-[11px] text-emerald-400 font-semibold -mt-0.5">
              Consolidated Portfolio &amp; Financial Register across All 6 UK Companies
            </p>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-xl text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 transition cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>

          {/* Export Master Excel (.xlsx) Button */}
          <button
            onClick={handleDownloadExcel}
            disabled={excelDownloading || loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50"
            title="Download single Excel file containing all 6 companies (like Rent Details for Software)"
          >
            {excelDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
            <span>Export Master Excel (.xlsx)</span>
          </button>

          {/* Export Attractive PDF Report Button */}
          <button
            onClick={handleDownloadPdf}
            disabled={pdfDownloading || loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition cursor-pointer disabled:opacity-50"
            title="Download executive corporate PDF report for all 6 companies"
          >
            {pdfDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
            <span>Export Master PDF Report</span>
          </button>

          {/* Switch to Single Company View */}
          {onSwitchToSingleCompany && (
            <button
              onClick={onSwitchToSingleCompany}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 font-semibold text-xs transition cursor-pointer"
              title="Return to Single Company Selection"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-400" />
              <span>Single Company View</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6 pb-page-safe">
        {/* Loading State */}
        {loading && !data && (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
            <p className="text-sm font-semibold text-slate-400">Loading Master Group Portfolios &amp; Financial Ledgers...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={loadData} className="px-3 py-1 rounded-lg bg-rose-600 text-white text-xs font-bold">
              Retry
            </button>
          </div>
        )}

        {data && data.totals && (
          <>
            {/* Top KPI Metric Cards (6 Tiles) */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm hover:border-slate-700 transition">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Direct Assets
                </div>
                <div className="text-xl sm:text-2xl font-black text-white">
                  {data.totals?.totalProperties ?? 0}
                </div>
                <div className="text-[10px] text-emerald-400 font-medium mt-1">
                  Across 6 Companies
                </div>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm hover:border-slate-700 transition">
                <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider mb-1">
                  Monthly Rent Roll
                </div>
                <div className="text-xl sm:text-2xl font-black text-emerald-300">
                  {formatGBP(data.totals?.totalMonthlyRent ?? 0)}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Contractual expected
                </div>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm hover:border-slate-700 transition">
                <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider mb-1">
                  Annual Rent Roll
                </div>
                <div className="text-xl sm:text-2xl font-black text-emerald-300">
                  {formatGBP(data.totals?.totalAnnualRent ?? 0)}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Full annual capacity
                </div>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm hover:border-slate-700 transition">
                <div className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider mb-1">
                  Asset Valuation
                </div>
                <div className="text-xl sm:text-2xl font-black text-blue-300">
                  {formatGBP(data.totals?.totalValuation ?? 0)}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Acquisition / Book value
                </div>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm hover:border-slate-700 transition">
                <div className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider mb-1">
                  Mortgage Liabilities
                </div>
                <div className="text-xl sm:text-2xl font-black text-rose-300">
                  {formatGBP(data.totals?.totalMortgageDebt ?? 0)}
                </div>
                <div className="text-[10px] text-rose-400/80 mt-1">
                  {data.totals?.totalMortgages ?? 27} Active Facilities
                </div>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-sm hover:border-slate-700 transition">
                <div className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider mb-1">
                  Debt Servicing / Mo
                </div>
                <div className="text-xl sm:text-2xl font-black text-indigo-300">
                  {formatGBP(data.totals?.totalMonthlyDebtService ?? 0)}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Monthly installments
                </div>
              </div>
            </div>

            {/* Quick Export Banner */}
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-indigo-950/40 border border-emerald-500/25 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    Master Consolidated Reports (All 6 Companies)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Generate the single multi-company Excel workbook (modeled on <span className="text-emerald-300 font-semibold">Rent Details for Software</span>) and the executive vector PDF report with full property inventories.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0 w-full md:w-auto">
                <button
                  onClick={handleDownloadExcel}
                  disabled={excelDownloading}
                  className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
                >
                  {excelDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  <span>Download Master Excel (.xlsx)</span>
                </button>
                <button
                  onClick={handleDownloadPdf}
                  disabled={pdfDownloading}
                  className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
                >
                  {pdfDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  <span>Download Master PDF</span>
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl">
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    activeTab === 'overview'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Company Matrix (6)
                </button>
                <button
                  onClick={() => setActiveTab('properties')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    activeTab === 'properties'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Direct Properties (48)
                </button>
                <button
                  onClick={() => setActiveTab('mortgages')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    activeTab === 'mortgages'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Mortgage Register (27)
                </button>
              </div>

              {activeTab === 'properties' && (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search properties or tenants..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <select
                    value={filterCompany}
                    onChange={(e) => setFilterCompany(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 focus:outline-none cursor-pointer"
                  >
                    <option value="ALL">All Companies</option>
                    {COMPANIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* TAB 1: Company Matrix Cards */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(data.companySummaries || []).map((comp) => {
                    const compConfig = COMPANIES.find((c) => c.id === comp.companyId);
                    return (
                      <div
                        key={comp.companyId}
                        className="bg-slate-900/90 border border-slate-800 hover:border-emerald-500/40 rounded-2xl p-5 shadow-sm transition flex flex-col justify-between space-y-4"
                      >
                        <div>
                          {/* Company Header */}
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-sm shrink-0 overflow-hidden">
                                <img
                                  src={compConfig?.logo || pixxLogo}
                                  alt={comp.name}
                                  className="w-full h-full object-contain"
                                />
                              </div>
                              <div>
                                <h4 className="font-extrabold text-white text-base tracking-tight leading-tight">
                                  {comp.name}
                                </h4>
                                <div className="text-[11px] text-slate-400 font-medium">
                                  {comp.legalName}
                                </div>
                                <div className="text-[10px] text-indigo-400 font-semibold mt-0.5">
                                  Reg: {comp.registrationNo || 'N/A'}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Financial Particulars */}
                          <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs mt-3">
                            <div>
                              <div className="text-[10px] text-slate-500 uppercase font-semibold">Direct Assets</div>
                              <div className="font-bold text-white mt-0.5">{comp.propertyCount} Properties</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-500 uppercase font-semibold">Monthly Rent</div>
                              <div className="font-bold text-emerald-400 mt-0.5">{formatGBP(comp.monthlyRentRoll)}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-500 uppercase font-semibold">Annual Rent Roll</div>
                              <div className="font-bold text-emerald-300 mt-0.5">{formatGBP(comp.annualRentRoll)}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-slate-500 uppercase font-semibold">Mortgages</div>
                              <div className="font-bold text-rose-300 mt-0.5">
                                {comp.mortgageCount} Facilities ({formatGBP(comp.mortgageDebt)})
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Open Company Dashboard Button */}
                        {onSelectCompany && compConfig && (
                          <button
                            onClick={() => onSelectCompany(compConfig)}
                            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white text-xs font-bold transition shadow-sm cursor-pointer"
                          >
                            <span>Open {comp.name} Dashboard</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: Direct Properties Table */}
            {activeTab === 'properties' && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4 text-center">No</th>
                        <th className="py-3 px-4">Owning Company</th>
                        <th className="py-3 px-4">Property Address</th>
                        <th className="py-3 px-4 text-center">Asset Type</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4">Tenant Name</th>
                        <th className="py-3 px-4 text-right">Monthly Rent</th>
                        <th className="py-3 px-4 text-right">Annual Rent</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredProperties.map((p, idx) => {
                        const comp = COMPANIES.find((c) => c.id === p.companyId);
                        const isOccupied = p.currentStatus === 'Occupied' || !!p.tenantName;
                        return (
                          <tr key={p._id || idx} className="hover:bg-slate-850/50 transition">
                            <td className="py-2.5 px-4 text-center font-bold text-slate-400">{idx + 1}</td>
                            <td className="py-2.5 px-4 font-bold text-white">{comp?.name || p.companyId}</td>
                            <td className="py-2.5 px-4 font-semibold text-slate-200">{p.name || p.address?.line1}</td>
                            <td className="py-2.5 px-4 text-center text-slate-400">{p.propertyType || 'Residential'}</td>
                            <td className="py-2.5 px-4 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isOccupied
                                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {isOccupied ? 'Occupied' : 'Available'}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-slate-300">
                              {p.tenantName || <span className="text-slate-500 italic">— Available</span>}
                            </td>
                            <td className="py-2.5 px-4 text-right font-bold text-emerald-400">
                              {formatGBP(p.contractualRent || 0)}
                            </td>
                            <td className="py-2.5 px-4 text-right font-medium text-slate-300">
                              {formatGBP((p.contractualRent || 0) * 12)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: Mortgage Register Table */}
            {activeTab === 'mortgages' && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/80 text-slate-400 font-bold border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4 text-center">No</th>
                        <th className="py-3 px-4">Owning Company</th>
                        <th className="py-3 px-4">Property Asset</th>
                        <th className="py-3 px-4">Mortgage Lender</th>
                        <th className="py-3 px-4">Account Number</th>
                        <th className="py-3 px-4 text-center">Rate</th>
                        <th className="py-3 px-4 text-right">Monthly Payment</th>
                        <th className="py-3 px-4 text-right">Outstanding Debt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {(data.allMortgages || []).map((m, idx) => {
                        const comp = COMPANIES.find((c) => c.id === m.companyId);
                        const matchedProp = (data.allProperties || []).find((p) => String(p._id) === String(m.propertyId));
                        return (
                          <tr key={m._id || idx} className="hover:bg-slate-850/50 transition">
                            <td className="py-2.5 px-4 text-center font-bold text-slate-400">{idx + 1}</td>
                            <td className="py-2.5 px-4 font-bold text-white">{comp?.name || m.companyId}</td>
                            <td className="py-2.5 px-4 text-slate-200">{matchedProp?.name || matchedProp?.address?.line1 || 'Property Asset'}</td>
                            <td className="py-2.5 px-4 font-bold text-indigo-300">{m.lenderName}</td>
                            <td className="py-2.5 px-4 text-slate-400 font-mono text-[11px]">{m.accountReference}</td>
                            <td className="py-2.5 px-4 text-center text-slate-300">{m.interestRate || 0}%</td>
                            <td className="py-2.5 px-4 text-right font-bold text-emerald-400">
                              {formatGBP(m.expectedRepaymentAmount || 0)}
                            </td>
                            <td className="py-2.5 px-4 text-right font-bold text-rose-300">
                              {formatGBP(m.outstandingPrincipalBalance || 0)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
