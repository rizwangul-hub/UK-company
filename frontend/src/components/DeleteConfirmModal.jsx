import React, { useState } from 'react';
import {
  AlertTriangle,
  X,
  Trash2,
  Undo2,
  ShieldAlert,
  Loader2,
  Landmark,
  Receipt,
  Building2,
  Calendar,
} from 'lucide-react';
import { ModalPortal } from './ModalPortal.jsx';
import { ledgerAPI } from '../services/api.js';
import { formatGBP, formatUKDate } from '../utils/formatters.js';

export function DeleteConfirmModal({
  isOpen,
  onClose,
  transaction,
  onSuccess,
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !transaction) return null;

  const txId = transaction._id;
  const voucherNo = transaction.voucherNo || 'VOUCHER';
  const type = transaction.transactionType || transaction.type || 'TRANSACTION';
  const amount = Number(transaction.amount || transaction.debit || transaction.credit || 0);
  const date = transaction.transactionDate || transaction.date;
  const narration = transaction.narration || transaction.detail || 'Financial posting';
  const accountName = transaction.accountId?.name || transaction.accountName || transaction.drAccount || transaction.crAccount || 'Bank / Cash Account';

  const handleDelete = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const res = await ledgerAPI.deleteTransaction(txId, { reason: reason.trim() });
      if (res?.success) {
        if (onSuccess) onSuccess(res.data);
        onClose();
      } else {
        setError(res?.message || 'Failed to void transaction.');
      }
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Error occurred while voiding transaction.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalPortal isOpen={isOpen} onClose={onClose}>
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-rose-950/20 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/15 text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>Void &amp; Delete Transaction</span>
              </h2>
              <p className="text-[11px] text-rose-400/90 font-medium">
                Soft-delete with complete financial balance reversal
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleDelete} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 custom-scrollbar text-xs">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs font-semibold">
              {error}
            </div>
          )}

          {/* Transaction Summary Card */}
          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 space-y-2.5 text-slate-300">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-indigo-400 text-sm">
                {voucherNo}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
                {type}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-800/60">
              <div>
                <span className="text-slate-500 block">Date</span>
                <span className="font-mono text-slate-200 font-semibold">{formatUKDate(date)}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 block">Amount</span>
                <span className="font-mono text-base font-bold text-rose-400">
                  {formatGBP(amount)}
                </span>
              </div>
            </div>

            <div className="text-[11px] pt-1 border-t border-slate-800/60">
              <span className="text-slate-500 block">Narration</span>
              <span className="text-slate-200 font-medium">{narration}</span>
            </div>

            <div className="text-[11px] pt-1 border-t border-slate-800/60">
              <span className="text-slate-500 block">Affected Account</span>
              <span className="text-slate-300 font-medium">{accountName}</span>
            </div>
          </div>

          {/* Reversal Consequences Warning Box */}
          <div className="bg-amber-950/20 border border-amber-900/30 rounded-xl p-3.5 text-amber-200 space-y-1.5">
            <div className="font-bold flex items-center gap-1.5 text-amber-400 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>What happens when you delete:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-amber-300/80 ml-1">
              <li>
                <strong>Liquidity Reversal:</strong> The balance of <strong>{accountName}</strong> will automatically be adjusted by {formatGBP(amount)}.
              </li>
              {type === 'RENT' && (
                <li>
                  <strong>Rent Arrears:</strong> The linked tenant rent schedule will be restored and marked as overdue/pending for this amount.
                </li>
              )}
              {type === 'MORTGAGE_PAYMENT' && (
                <li>
                  <strong>Mortgage Balance:</strong> Any paid principal portion will be added back onto the mortgage liability balance.
                </li>
              )}
              <li>
                <strong>Recycle Bin:</strong> This transaction will move to the Recycle Bin and can be restored at any time.
              </li>
              <li>
                <strong>Audit Trail:</strong> The full history of who created and deleted this record is permanently preserved.
              </li>
            </ul>
          </div>

          {/* Deletion Reason Input */}
          <div>
            <label className="block text-slate-300 font-bold mb-1.5">
              Reason for Deletion / Voiding <span className="text-slate-500 font-normal">(Optional but recommended)</span>
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Duplicate entry, wrong bank account chosen, payment was dishonoured..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-rose-500 text-xs custom-scrollbar"
            />
          </div>

          {/* Footer Actions */}
          <div className="px-1 pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/25 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Voiding...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Confirm Void &amp; Delete</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </ModalPortal>
  );
}

export default DeleteConfirmModal;
