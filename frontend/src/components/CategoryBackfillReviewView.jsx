import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  Search,
  Filter,
  Check,
  Layers,
  Receipt,
  HelpCircle,
} from 'lucide-react';
import { ledgerAPI } from '../services/api.js';
import { formatGBP, formatUKDate } from '../utils/formatters.js';

export function CategoryBackfillReviewView({ selectedCompany, onBackfillApplied }) {
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'SUGGESTED' | 'INVALID_RELATIONSHIP' | 'UNCLASSIFIED'
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadPreview = async (force = false) => {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await ledgerAPI.previewCategoryBackfill({}, { forceRefresh: force });
      if (res?.success && res.data) {
        setPreviewData(res.data);
      }
    } catch (err) {
      console.error('Failed to load category backfill preview:', err);
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to generate category backfill preview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPreview();
  }, [selectedCompany]);

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 6000);
  };

  const handleApplyAll = async () => {
    if (!previewData || (!previewData.suggestedCount && !previewData.invalidCount)) {
      alert('No suggestions available to backfill.');
      return;
    }

    const confirmMsg = `Apply category linking to ${previewData.suggestedCount + previewData.invalidCount} transaction(s)? All affected transactions will be linked to their appropriate Head and Sub Head.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      setApplying(true);
      setErrorMsg('');
      const res = await ledgerAPI.applyCategoryBackfill();
      if (res?.success) {
        showSuccess(`Successfully backfilled ${res.data.updatedCount} transaction(s) across the central ledger.`);
        await loadPreview(true);
        if (onBackfillApplied) onBackfillApplied();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to apply category backfill.');
    } finally {
      setApplying(false);
    }
  };

  const handleApplySingle = async (item) => {
    try {
      setApplying(true);
      setErrorMsg('');
      const res = await ledgerAPI.applyCategoryBackfill({
        items: [item],
      });
      if (res?.success) {
        showSuccess(`Updated transaction ${item.voucherNo} with Head "${item.suggestedHeadName}" -> Sub Head "${item.suggestedSubHeadName}".`);
        await loadPreview(true);
        if (onBackfillApplied) onBackfillApplied();
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to backfill item.');
    } finally {
      setApplying(false);
    }
  };

  const filteredItems = useMemo(() => {
    if (!previewData?.previewItems) return [];
    const q = searchQuery.toLowerCase().trim();

    return previewData.previewItems.filter((item) => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
      if (!q) return true;
      return (
        item.voucherNo?.toLowerCase().includes(q) ||
        item.narration?.toLowerCase().includes(q) ||
        item.suggestedHeadName?.toLowerCase().includes(q) ||
        item.suggestedSubHeadName?.toLowerCase().includes(q)
      );
    });
  }, [previewData, statusFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="executive-card rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Already Categorized</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black font-display text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
            {previewData?.correctlyCategorizedCount || 0}
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">
            Linked to Head &amp; Sub Head
          </div>
        </div>

        <div className="executive-card rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Ready to Backfill</span>
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Sparkles size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black font-display text-indigo-600 dark:text-indigo-400 mt-1 tabular-nums">
            {previewData?.suggestedCount || 0}
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">
            High-confidence matches
          </div>
        </div>

        <div className="executive-card rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Invalid Relationship</span>
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black font-display text-rose-600 dark:text-rose-400 mt-1 tabular-nums">
            {previewData?.invalidCount || 0}
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">
            Mismatched parent Head
          </div>
        </div>

        <div className="executive-card rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Unclassified</span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <HelpCircle size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black font-display text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
            {previewData?.unclassifiedCount || 0}
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">
            Needs manual allocation
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[240px] sm:min-w-[280px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search transaction or suggestion..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="ALL">All Items</option>
              <option value="SUGGESTED">Ready to Backfill</option>
              <option value="INVALID_RELATIONSHIP">Invalid Relationships</option>
              <option value="UNCLASSIFIED">Unclassified Only</option>
            </select>

            <button
              onClick={() => loadPreview(true)}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Refresh review list"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleApplyAll}
              disabled={applying || !previewData || (previewData.suggestedCount === 0 && previewData.invalidCount === 0)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/25 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles size={14} />
              <span>{applying ? 'Applying Backfill...' : '1-Click Auto-Backfill All Valid Suggestions'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="cursor-pointer">&times;</button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="cursor-pointer">&times;</button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-500 font-bold flex items-center justify-center gap-2">
          <RefreshCw size={18} className="animate-spin text-indigo-600" />
          Analyzing existing transaction records against authoritative categories...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
          <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2" />
          <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
            All transactions are cleanly categorized!
          </div>
          <div className="text-xs text-slate-500 mt-1">
            No unlinked or mismatched transaction records found in this company.
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-sm">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 uppercase font-black border-b border-slate-200 dark:border-slate-700 tracking-wider">
              <tr>
                <th className="p-3 whitespace-nowrap">Date &amp; Voucher</th>
                <th className="p-3">Narration &amp; Amount</th>
                <th className="p-3">Current Status</th>
                <th className="p-3">Suggested Head &rarr; Sub Head</th>
                <th className="p-3">Match Basis / Confidence</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-semibold text-slate-900 dark:text-slate-100">
              {filteredItems.map((item) => (
                <tr key={item.transactionId} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                  <td className="p-3 whitespace-nowrap">
                    <div className="font-mono text-slate-500 text-[11px]">
                      {formatUKDate(item.transactionDate)}
                    </div>
                    <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {item.voucherNo}
                    </div>
                  </td>

                  <td className="p-3 max-w-xs">
                    <div className="font-bold text-slate-900 dark:text-white truncate" title={item.narration}>
                      {item.narration}
                    </div>
                    <div className="font-mono font-bold text-slate-700 dark:text-slate-300 mt-0.5">
                      {formatGBP(item.amount)} ({item.transactionType})
                    </div>
                  </td>

                  <td className="p-3 whitespace-nowrap">
                    {item.currentHeadName || item.currentSubHeadName ? (
                      <div className="text-[11px] text-slate-600 dark:text-slate-400">
                        {item.currentHeadName || 'No Head'} &bull; {item.currentSubHeadName || 'No Sub Head'}
                      </div>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold">
                        Unlinked
                      </span>
                    )}
                  </td>

                  <td className="p-3 whitespace-nowrap">
                    {item.suggestedHeadName || item.suggestedSubHeadName ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-extrabold text-[10px] border border-indigo-200 dark:border-indigo-800/60 w-fit">
                          {item.suggestedHeadName || 'Head'}
                        </span>
                        {item.suggestedSubHeadName && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold text-[10px] border border-emerald-200 dark:border-emerald-800/60 w-fit">
                            &rarr; {item.suggestedSubHeadName}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">No match found</span>
                    )}
                  </td>

                  <td className="p-3 max-w-xs">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          item.status === 'SUGGESTED'
                            ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                            : item.status === 'INVALID_RELATIONSHIP'
                            ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                        }`}
                      >
                        {item.status} ({item.confidence}%)
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate" title={item.ruleMatched}>
                      {item.ruleMatched}
                    </div>
                  </td>

                  <td className="p-3 text-center whitespace-nowrap">
                    {item.suggestedHeadId || item.suggestedSubHeadId ? (
                      <button
                        onClick={() => handleApplySingle(item)}
                        disabled={applying}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition cursor-pointer disabled:opacity-50 shadow-sm"
                      >
                        Apply
                      </button>
                    ) : (
                      <span className="text-slate-400 text-xs">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default CategoryBackfillReviewView;
