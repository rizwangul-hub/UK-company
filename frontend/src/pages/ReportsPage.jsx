import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  FileText,
  Download,
  Calendar,
  Building2,
  TrendingUp,
  Percent,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Printer,
} from 'lucide-react';
import { formatGBP } from '../utils/formatters.js';
import { reportsAPI, getApiCache } from '../services/api.js';
import ReportExportModal from '../components/ReportExportModal.jsx';

export function ReportsPage({ selectedCompany }) {
  const [activeTab, setActiveTab] = useState('tax'); // 'tax' | 'profitability'

  // Tax Report State
  const cachedTax = getApiCache('/reports/financial-year', { params: { taxYear: '2026-2027' } });
  const [taxYear, setTaxYear] = useState('2026-2027');
  const [taxData, setTaxData] = useState(cachedTax?.data || null);
  const [taxLoading, setTaxLoading] = useState(!cachedTax?.data);

  // Profitability State
  const cachedProf = getApiCache('/reports/property-profitability');
  const [profitabilityData, setProfitabilityData] = useState(cachedProf?.data?.properties || []);
  const [profitabilityLoading, setProfitabilityLoading] = useState(!cachedProf?.data?.properties);

  // Central Ledger Report Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [landlordLoading, setLandlordLoading] = useState(false);

  const companyName = selectedCompany?.name || 'PIXX TECHNOLOGIES';
  const companyLegal = selectedCompany?.legalName || 'UK Property Finance Ltd';
  const companySlug = selectedCompany?.slug || 'company';

  const loadTaxReport = async (force = false) => {
    if (!taxData || force) {
      setTaxLoading(true);
    }
    try {
      const res = await reportsAPI.getFinancialYearReport({ taxYear }, { forceRefresh: force });
      if (res?.success) setTaxData(res.data);
    } catch (err) {
      console.error('Failed to load UK tax report:', err);
    } finally {
      setTaxLoading(false);
    }
  };

  const loadProfitability = async (force = false) => {
    if (profitabilityData.length === 0 || force) {
      setProfitabilityLoading(true);
    }
    try {
      const res = await reportsAPI.getPropertyProfitability({}, { forceRefresh: force });
      if (res?.success) setProfitabilityData(res.data.properties || []);
    } catch (err) {
      console.error('Failed to load property profitability:', err);
    } finally {
      setProfitabilityLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'tax') loadTaxReport();
    if (activeTab === 'profitability') loadProfitability();
  }, [activeTab, taxYear, selectedCompany?.id]);

  // Export Tax Schedule CSV
  const handleExportTaxScheduleCSV = () => {
    if (!taxData) return;
    const rows = [
      [`${companyLegal.toUpperCase()} — UK HMRC SECTION 24 REPORT`, taxYear],
      ['Company Entity', companyName],
      ['UK Registration', selectedCompany?.registrationNo || 'N/A'],
      ['Jurisdiction', selectedCompany?.jurisdiction || 'England & Wales'],
      ['Generated At', new Date().toISOString()],
      [],
      ['Metric', 'Amount (GBP)'],
      ['Gross Rental Income', Number(taxData.grossRentalIncome || 0).toFixed(2)],
      ['Allowable Property Expenses', Number(taxData.allowableExpenses || 0).toFixed(2)],
      ['Net Taxable Profit (Before Finance Costs)', Number(taxData.netTaxableProfitBeforeFinanceCosts || 0).toFixed(2)],
      ['Mortgage Interest Finance Costs', Number(taxData.mortgageInterestFinanceCosts || 0).toFixed(2)],
      ['Mortgage Principal Repaid (Capital Reduction)', Number(taxData.mortgagePrincipalRepaid || 0).toFixed(2)],
      ['Qualifying Finance Costs for Relief', Number(taxData.qualifyingFinanceCosts || 0).toFixed(2)],
      ['Section 24 Basic Rate Tax Reducer (20%)', Number(taxData.section24TaxCreditEstimated || 0).toFixed(2)],
      ['Carried Forward Finance Costs', Number(taxData.carriedForwardFinanceCosts || 0).toFixed(2)],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((r) => r.join(',')).join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `${companySlug}_Tax_Schedule_S24_${taxYear}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Yields & P&L CSV
  const handleExportProfitabilityCSV = () => {
    if (!profitabilityData || profitabilityData.length === 0) return;
    const metaRows = [
      [`${companyLegal.toUpperCase()} — PROPERTY PORTFOLIO PROFITABILITY & YIELDS`],
      ['Company Entity', companyName],
      ['Generated At', new Date().toISOString()],
      [],
    ];

    const headers = [
      'Property',
      'Postcode',
      'Valuation (£)',
      'Mortgage Debt (£)',
      'Rental Income (£)',
      'Operating Costs (£)',
      'Net Operating Income (£)',
      'Mortgages Serviced (£)',
      'Net Cash Flow (£)',
      'Gross Yield (%)',
    ];

    const rows = profitabilityData.map((p) => [
      `"${p.name || ''}"`,
      `"${p.postcode || ''}"`,
      Number(p.valuation || 0).toFixed(2),
      Number(p.totalMortgageDebt || 0).toFixed(2),
      Number(p.rentalIncome || 0).toFixed(2),
      Number(p.operatingExpenses || 0).toFixed(2),
      Number(p.netOperatingIncome || 0).toFixed(2),
      Number(p.mortgagePayments || 0).toFixed(2),
      Number(p.netCashFlow || 0).toFixed(2),
      `${p.grossYield || 0}%`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [...metaRows.map((r) => r.join(',')), headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `${companySlug}_Property_Yields_Profitability_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Financial & Tax Reporting
            </h1>
            <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {companyName}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            HMRC Section 24 property finance reports, P&L summaries, and individual property rental yields for {companyLegal}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Central Ledger Export Studio Button */}
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition cursor-pointer"
            title="Open central report studio to download complete ledger in PDF or Excel"
          >
            <FileText size={14} />
            <span>Export Ledger (PDF &amp; Excel)</span>
          </button>

          {/* Official Landlord Rent Statement (.xlsx) Button */}
          <button
            onClick={async () => {
              try {
                setLandlordLoading(true);
                await reportsAPI.downloadLandlordStatementExcel(`Landlord_Report_${companySlug}_${new Date().toISOString().slice(0, 10)}.xlsx`);
              } catch (err) {
                console.error('Failed to download Landlord Report:', err);
                alert(err.message || 'Failed to download report');
              } finally {
                setLandlordLoading(false);
              }
            }}
            disabled={landlordLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50"
            title="Download official Landlord Rent Statement Excel report (Direct Properties, No Units)"
          >
            {landlordLoading ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
            <span>Landlord Statement (.xlsx)</span>
          </button>

          {/* Quick Export Active Tab */}
          {activeTab === 'tax' ? (
            <button
              onClick={handleExportTaxScheduleCSV}
              disabled={taxLoading || !taxData}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition cursor-pointer disabled:opacity-40"
              title="Download Tax Schedule spreadsheet (.csv)"
            >
              <FileSpreadsheet size={14} />
              <span>Export Tax (.csv)</span>
            </button>
          ) : (
            <button
              onClick={handleExportProfitabilityCSV}
              disabled={profitabilityLoading || profitabilityData.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition cursor-pointer disabled:opacity-40"
              title="Download Yields & P&L spreadsheet (.csv)"
            >
              <FileSpreadsheet size={14} />
              <span>Export Yields (.csv)</span>
            </button>
          )}

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 font-bold text-xs transition cursor-pointer"
            title="Print or Save as PDF"
          >
            <Printer size={13} />
            <span>Print</span>
          </button>

          {/* Tab Switcher */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800">
            <button
              onClick={() => setActiveTab('tax')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'tax'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              UK Tax Schedule (S24)
            </button>
            <button
              onClick={() => setActiveTab('profitability')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                activeTab === 'profitability'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Property Yields & P&L
            </button>
          </div>
        </div>
      </div>

      {/* Tab 1: UK Tax Year Schedule (Section 24) */}
      {activeTab === 'tax' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl bg-slate-900 border border-slate-800 gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-medium text-slate-300">Select UK Tax Year:</span>
              <select
                value={taxYear}
                onChange={(e) => setTaxYear(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1 text-xs text-white focus:outline-none cursor-pointer"
              >
                <option value="2026-2027">2026-2027 (6 Apr 2026 – 5 Apr 2027)</option>
                <option value="2025-2026">2025-2026 (6 Apr 2025 – 5 Apr 2026)</option>
              </select>
            </div>

            <div className="text-[11px] text-slate-400">
              Computed strictly from verified ledger entries in GBP (£)
            </div>
          </div>

          {taxLoading ? (
            <div className="py-20 flex items-center justify-center text-slate-500 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
              <span className="text-xs">Computing UK tax schedule...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Income & Allowable Expenses */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
                <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-3">
                  Trading Position (Rental Business)
                </h3>

                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center py-2 border-b border-slate-800/60">
                    <span className="text-slate-300 font-medium">Gross Rental Receipts</span>
                    <span className="font-bold text-emerald-400">{formatGBP(taxData?.grossRentalIncome)}</span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-b border-slate-800/60">
                    <span className="text-slate-300 font-medium">Allowable Property Expenses</span>
                    <span className="font-bold text-rose-400">- {formatGBP(taxData?.allowableExpenses)}</span>
                  </div>

                  <div className="flex justify-between items-center py-3 bg-slate-950/80 px-3 rounded-xl border border-slate-800">
                    <span className="font-bold text-white">Net Taxable Profit (Before Finance Costs)</span>
                    <span className="font-bold text-indigo-300">{formatGBP(taxData?.netTaxableProfitBeforeFinanceCosts)}</span>
                  </div>
                </div>
              </div>

              {/* Section 24 Mortgage Finance Restriction */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-sm font-bold text-white">Section 24 Finance Cost Relief</h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    HMRC Rules
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center py-2 border-b border-slate-800/60">
                    <span className="text-slate-300 font-medium">Mortgage Interest Incurred</span>
                    <span className="font-bold text-slate-200">{formatGBP(taxData?.mortgageInterestFinanceCosts)}</span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-b border-slate-800/60">
                    <div>
                      <span className="text-slate-300 font-medium block">Basic Rate Tax Reducer (20%)</span>
                      <span className="text-[10px] text-slate-500">Relief applied against tax liability</span>
                    </div>
                    <span className="font-bold text-emerald-400">{formatGBP(taxData?.section24TaxCreditEstimated)}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400">
                    <div className="font-semibold text-slate-300 mb-1">Tax Note:</div>
                    Under UK Section 24 legislation, mortgage interest is not deducted from turnover for personal buy-to-let landlords. Instead, relief is granted as a 20% basic rate tax reducer.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Property Profitability & Rental Yields */}
      {activeTab === 'profitability' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Property Performance &amp; Yield Analysis</h2>
            <button
              onClick={loadProfitability}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {profitabilityLoading ? (
            <div className="py-20 flex items-center justify-center text-slate-500 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
              <span className="text-xs">Computing yields...</span>
            </div>
          ) : profitabilityData.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500">
              No property transactions recorded to calculate performance.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Property</th>
                    <th className="py-3 px-4">Valuation</th>
                    <th className="py-3 px-4">Mortgage Debt</th>
                    <th className="py-3 px-4">Rental Income</th>
                    <th className="py-3 px-4">Operating Costs</th>
                    <th className="py-3 px-4">NOI</th>
                    <th className="py-3 px-4">Mortgages Serviced</th>
                    <th className="py-3 px-4">Net Cash Flow</th>
                    <th className="py-3 px-4 text-right">Gross Yield</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {profitabilityData.map((p) => (
                    <tr key={p.propertyId} className="hover:bg-slate-850/50 transition">
                      <td className="py-3.5 px-4 font-semibold text-white">
                        {p.name} <span className="text-[11px] text-slate-500">({p.postcode})</span>
                      </td>
                      <td className="py-3.5 px-4 font-mono">{formatGBP(p.valuation)}</td>
                      <td className="py-3.5 px-4 font-mono text-rose-300">{formatGBP(p.totalMortgageDebt)}</td>
                      <td className="py-3.5 px-4 font-mono text-emerald-400">{formatGBP(p.rentalIncome)}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-400">{formatGBP(p.operatingExpenses)}</td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-indigo-300">{formatGBP(p.netOperatingIncome)}</td>
                      <td className="py-3.5 px-4 font-mono text-rose-400">{formatGBP(p.mortgagePayments)}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-100">{formatGBP(p.netCashFlow)}</td>
                      <td className="py-3.5 px-4 text-right font-bold text-emerald-400">
                        {p.grossYield}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Central Ledger Export Studio Modal */}
      <ReportExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        selectedCompany={selectedCompany}
        initialScope="COMPLETE"
        initialDatePreset="THIS_TAX_YEAR"
      />
    </div>
  );
}

export default ReportsPage;
