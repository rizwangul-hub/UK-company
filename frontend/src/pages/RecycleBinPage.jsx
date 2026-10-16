import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Trash2,
  RotateCcw,
  History,
  Search,
  Filter,
  Calendar,
  Building2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Eye,
  FileSpreadsheet,
  FileText,
  Clock,
  ShieldCheck,
  CreditCard,
  DollarSign,
  Receipt,
  Landmark,
  ArrowRightLeft,
  Loader2,
  X,
} from 'lucide-react';
import { ledgerAPI, propertiesAPI } from '../services/api.js';
import { formatGBP, formatUKDate } from '../utils/formatters.js';
import { ModalPortal } from '../components/ModalPortal.jsx';
import { TransactionAuditModal } from '../components/TransactionAuditModal.jsx';

export function RecycleBinPage({ selectedCompany }) {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [properties, setProperties] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals state
  const [auditTx, setAuditTx] = useState(null);
  const [restoringTx, setRestoringTx] = useState(null);
  const [restoringSubmitting, setRestoringSubmitting] = useState(false);
  const [restoringError, setRestoringError] = useState('');

  const companySlug = selectedCompany?.slug || selectedCompany?._id;

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const params = {};
      if (typeFilter) params.type = typeFilter;
      if (propertyFilter) params.propertyId = propertyFilter;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (searchQuery) params.search = searchQuery;

      const [res, propRes] = await Promise.all([
        ledgerAPI.getRecycleBin(params, { forceRefresh: true }),
        propertiesAPI.getAll({}, { forceRefresh: true }),
      ]);

      if (res?.success) {
        setTransactions(res.data.transactions || []);
      } else {
        setErrorMsg(res?.message || 'Failed to load deleted transactions.');
      }

      if (propRes?.success) {
        setProperties(propRes.data.properties || propRes.data || []);
      }
    } catch (err) {
      console.error('Failed to load recycle bin:', err);
      setErrorMsg(err?.response?.data?.message || err?.message || 'Error fetching deleted transactions.');
    } finally {
      setLoading(false);
    }
  }, [typeFilter, propertyFilter, startDate, endDate, searchQuery, companySlug]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Restore
  const handleConfirmRestore = async () => {
    if (!restoringTx) return;
    setRestoringSubmitting(true);
    setRestoringError('');

    try {
      const res = await ledgerAPI.restoreTransaction(restoringTx._id);
      if (res?.success) {
        setSuccessMsg(`Transaction ${restoringTx.voucherNo} successfully restored! Balances and reports updated.`);
        setRestoringTx(null);
        // Refresh list
        loadData();
        // Clear message after 5 seconds
        setTimeout(() => setSuccessMsg(''), 5000);
      } else {
        setRestoringError(res?.message || 'Failed to restore transaction.');
      }
    } catch (err) {
      setRestoringError(err?.response?.data?.message || err?.message || 'Error occurred while restoring.');
    } finally {
      setRestoringSubmitting(false);
    }
  };

  // Metrics summary
  const summary = useMemo(() => {
    let totalVoid = transactions.length;
    let totalValue = 0;
    let totalExpense = 0;
    let totalIncome = 0;

    transactions.forEach((tx) => {
      const amt = Number(tx.amount || 0);
      totalValue += amt;
      if (tx.direction === 'OUT' || tx.transactionType === 'EXPENSE' || tx.transactionType === 'MORTGAGE_PAYMENT') {
        totalExpense += amt;
      } else if (tx.direction === 'IN' || tx.transactionType === 'INCOME' || tx.transactionType === 'RENT') {
        totalIncome += amt;
      }
    });

    return { totalVoid, totalValue, totalExpense, totalIncome };
  }, [transactions]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-rose-500/15 text-rose-500 border border-rose-500/30">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <span>Recycle Bin &amp; Void Transactions</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 font-mono">
                {summary.totalVoid} VOID
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Securely view, inspect audit history, and restore soft-deleted transactions for{' '}
              <strong className="text-indigo-600 dark:text-indigo-400">
                {selectedCompany?.name || 'Active Company'}
              </strong>
            </p>
          </div>
        </div>

        <button
          onClick={() => loadData()}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center gap-2 self-start sm:self-auto cursor-pointer border border-slate-200 dark:border-slate-700 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-500' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Success Notification Alert */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">
            Total Void Records
          </div>
          <div className="font-mono text-2xl font-black text-slate-900 dark:text-white">
            {summary.totalVoid}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Excluded from active ledgers</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">
            Total Void Volume
          </div>
          <div className="font-mono text-2xl font-black text-rose-600 dark:text-rose-400">
            {formatGBP(summary.totalValue)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Total reversed liquidity</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">
            Reversed Outflows (Expenses)
          </div>
          <div className="font-mono text-2xl font-black text-amber-600 dark:text-amber-400">
            {formatGBP(summary.totalExpense)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Restored to bank balances</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">
            Reversed Inflows (Rent/Income)
          </div>
          <div className="font-mono text-2xl font-black text-indigo-600 dark:text-indigo-400">
            {formatGBP(summary.totalIncome)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Arrears reinstated to tenants</div>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search voucher, payee, reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="">-- All Transaction Types --</option>
              <option value="EXPENSE">Expense</option>
              <option value="INCOME">Income</option>
              <option value="RENT">Rent Receipt</option>
              <option value="MORTGAGE_PAYMENT">Mortgage Payment</option>
              <option value="TRANSFER">Internal Transfer</option>
              <option value="PROPERTY_CHARGE_PAYMENT">Property Charge</option>
            </select>
          </div>

          {/* Property Filter */}
          <div>
            <select
              value={propertyFilter}
              onChange={(e) => setPropertyFilter(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="">-- All Properties --</option>
              {properties.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} ({p.postcode})
                </option>
              ))}
            </select>
          </div>

          {/* Reset Filters */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSearchQuery('');
                setTypeFilter('');
                setPropertyFilter('');
                setStartDate('');
                setEndDate('');
              }}
              className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition cursor-pointer text-center"
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-500 font-bold flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
            Loading deleted transactions from secure archive...
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Recycle Bin is Empty</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              There are no voided or deleted financial transactions in this company. All active records are properly posted.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 uppercase font-black border-b border-slate-200 dark:border-slate-700 tracking-wider">
                <tr>
                  <th className="p-3 whitespace-nowrap">Deleted Date / By</th>
                  <th className="p-3 whitespace-nowrap">Voucher No</th>
                  <th className="p-3 whitespace-nowrap">Type</th>
                  <th className="p-3 whitespace-nowrap">Tx Date</th>
                  <th className="p-3">Particulars / Narration</th>
                  <th className="p-3">Bank Account</th>
                  <th className="p-3 text-right">Amount (£)</th>
                  <th className="p-3">Deletion Reason</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-semibold text-slate-900 dark:text-slate-100">
                {transactions.map((tx) => {
                  const isIncome = tx.direction === 'IN';
                  const isTransfer = tx.transactionType === 'TRANSFER';
                  const isMortgage = tx.transactionType === 'MORTGAGE_PAYMENT';

                  return (
                    <tr
                      key={tx._id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition opacity-85 hover:opacity-100"
                    >
                      {/* Deleted Date & User */}
                      <td className="p-3 whitespace-nowrap text-slate-500 dark:text-slate-400 text-[11px]">
                        <div>{tx.deletedAt ? new Date(tx.deletedAt).toLocaleString('en-GB') : '-'}</div>
                        <div className="text-[10px] text-rose-500 font-bold">
                          {tx.deletedBy?.name || 'Authorized User'}
                        </div>
                      </td>

                      {/* Voucher No */}
                      <td className="p-3 whitespace-nowrap font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {tx.voucherNo}
                      </td>

                      {/* Type Badge */}
                      <td className="p-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            isTransfer
                              ? 'bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-300 dark:border-sky-800'
                              : isMortgage
                              ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800'
                              : isIncome
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                              : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                          }`}
                        >
                          {tx.transactionType}
                        </span>
                      </td>

                      {/* Transaction Date */}
                      <td className="p-3 whitespace-nowrap font-mono text-slate-600 dark:text-slate-400">
                        {formatUKDate(tx.transactionDate)}
                      </td>

                      {/* Narration & Property */}
                      <td className="p-3 max-w-xs">
                        <div className="font-bold text-slate-900 dark:text-white truncate">
                          {tx.narration || tx.detail || 'General transaction'}
                        </div>
                        {(tx.propertyId?.name || tx.payee || tx.receivedFrom) && (
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 flex flex-wrap gap-1">
                            {tx.propertyId?.name && (
                              <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800">
                                {tx.propertyId.name}
                              </span>
                            )}
                            {(tx.payee || tx.receivedFrom) && (
                              <span className="px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                                {tx.payee || tx.receivedFrom}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Bank Account */}
                      <td className="p-3 whitespace-nowrap text-slate-600 dark:text-slate-400">
                        {tx.accountId?.name || 'Bank Account'}
                      </td>

                      {/* Amount */}
                      <td className="p-3 whitespace-nowrap text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                        {formatGBP(tx.amount)}
                      </td>

                      {/* Deletion Reason */}
                      <td className="p-3 max-w-xs">
                        <span className="text-[11px] text-amber-600 dark:text-amber-400 italic">
                          {tx.deletionReason || 'No reason specified'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-3 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setRestoringTx(tx)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1 shadow-sm cursor-pointer"
                            title="Restore this transaction and reinstate financial balances"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Restore</span>
                          </button>

                          <button
                            onClick={() => setAuditTx(tx)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-600 dark:text-slate-300 transition cursor-pointer"
                            title="Inspect Audit History"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
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

      {/* Restore Confirmation Dialog */}
      {restoringTx && (
        <ModalPortal isOpen={Boolean(restoringTx)} onClose={() => setRestoringTx(null)}>
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-emerald-950/20 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-white">Restore Transaction</h2>
                  <p className="text-[11px] text-emerald-400/90 font-medium">
                    Re-post to active ledgers and recalculate balances
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRestoringTx(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 sm:p-6 space-y-4 text-xs">
              {restoringError && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 font-semibold">
                  {restoringError}
                </div>
              )}

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2 text-slate-300">
                <div className="flex justify-between font-mono font-bold">
                  <span className="text-indigo-400">{restoringTx.voucherNo}</span>
                  <span className="text-slate-100">{formatGBP(restoringTx.amount)}</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  {restoringTx.narration || restoringTx.detail}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">
                  Tx Date: {formatUKDate(restoringTx.transactionDate)} &bull; Account: {restoringTx.accountId?.name || 'Bank'}
                </div>
              </div>

              <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-xl p-3.5 text-emerald-200 space-y-1">
                <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Restoration actions:</span>
                </div>
                <ul className="list-disc list-inside text-[11px] text-emerald-300/80 space-y-0.5 ml-1">
                  <li>Transaction will return to the active ledger with status <strong>POSTED</strong>.</li>
                  <li>Account balance for <strong>{restoringTx.accountId?.name || 'Bank'}</strong> will be recalculated.</li>
                  {restoringTx.transactionType === 'RENT' && (
                    <li>Tenant rent arrears will be marked as paid again.</li>
                  )}
                  {restoringTx.transactionType === 'MORTGAGE_PAYMENT' && (
                    <li>Mortgage principal liability will be reduced accordingly.</li>
                  )}
                  <li>A <strong>RESTORED</strong> audit entry will be permanently appended.</li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setRestoringTx(null)}
                  disabled={restoringSubmitting}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRestore}
                  disabled={restoringSubmitting}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/25 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {restoringSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Restoring...</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Confirm &amp; Restore</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Transaction Audit Modal */}
      {auditTx && (
        <TransactionAuditModal
          isOpen={Boolean(auditTx)}
          onClose={() => setAuditTx(null)}
          transactionId={auditTx._id}
          voucherNo={auditTx.voucherNo}
        />
      )}
    </div>
  );
}

export default RecycleBinPage;
