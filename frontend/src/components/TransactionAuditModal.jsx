import React, { useState, useEffect } from 'react';
import {
  History,
  X,
  Clock,
  User,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Edit3,
  Trash2,
  PlusCircle,
  FileText,
  Loader2,
} from 'lucide-react';
import { ModalPortal } from './ModalPortal.jsx';
import { ledgerAPI } from '../services/api.js';
import { formatGBP, formatUKDate } from '../utils/formatters.js';

export function TransactionAuditModal({ isOpen, onClose, transactionId, voucherNo }) {
  const [loading, setLoading] = useState(true);
  const [auditData, setAuditData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !transactionId) return;

    let isMounted = true;
    setLoading(true);
    setError('');

    const fetchAudit = async () => {
      try {
        const res = await ledgerAPI.getTransactionAudit(transactionId);
        if (isMounted) {
          if (res?.success) {
            setAuditData(res.data);
          } else {
            setError(res?.message || 'Failed to retrieve audit trail.');
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err?.response?.data?.message || err?.message || 'Error fetching audit history.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchAudit();

    return () => {
      isMounted = false;
    };
  }, [isOpen, transactionId]);

  if (!isOpen) return null;

  const getActionBadge = (action) => {
    switch (action) {
      case 'CREATED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <PlusCircle className="w-3 h-3" /> CREATED
          </span>
        );
      case 'EDITED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Edit3 className="w-3 h-3" /> EDITED
          </span>
        );
      case 'DELETED':
      case 'VOID':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <Trash2 className="w-3 h-3" /> VOIDED / DELETED
          </span>
        );
      case 'RESTORED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">
            <RotateCcw className="w-3 h-3" /> RESTORED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/15 text-slate-400 border border-slate-500/30">
            {action}
          </span>
        );
    }
  };

  const logs = auditData?.auditLogs || auditData?.embeddedHistory || [];

  return (
    <ModalPortal isOpen={isOpen} onClose={onClose}>
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>Transaction Audit Trail</span>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-500/30">
                  {voucherNo || auditData?.transaction?.voucherNo || 'VOUCHER'}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Immutable chronological log of creation, edits, voiding, and restorations
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
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 custom-scrollbar text-xs">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              <p className="font-medium">Loading audit history...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs">
              {error}
            </div>
          ) : logs.length === 0 ? (
            <div className="py-10 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
              <History className="w-8 h-8 mx-auto text-slate-600 mb-2" />
              <p className="font-semibold text-slate-400">No previous audit entries recorded</p>
              <p className="text-[11px] text-slate-500 mt-0.5">This transaction is currently in its initial posted state.</p>
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
              {logs.map((entry, index) => {
                const action = entry.action;
                const timestamp = entry.createdAt || entry.timestamp;
                const user = entry.performedByName || (typeof entry.performedBy === 'object' ? entry.performedBy?.name : 'Authorized User');
                const reason = entry.reason || entry.deletionReason;
                const changes = entry.changes || {};

                return (
                  <div key={entry._id || index} className="relative group">
                    {/* Timeline bullet */}
                    <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-slate-900 border-2 border-indigo-500 ring-4 ring-slate-900" />

                    <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {getActionBadge(action)}
                          <span className="text-slate-300 font-bold flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-400" /> {user}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {timestamp ? new Date(timestamp).toLocaleString('en-GB') : 'Unknown Date'}
                        </span>
                      </div>

                      {reason && (
                        <div className="text-[11px] text-amber-300/90 bg-amber-950/30 border border-amber-900/40 rounded-lg p-2 font-medium">
                          <span className="font-bold text-amber-400">Reason: </span>
                          {reason}
                        </div>
                      )}

                      {/* Display field changes if EDITED */}
                      {action === 'EDITED' && Object.keys(changes).length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-800/80 space-y-1">
                          <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">
                            Updated Fields:
                          </span>
                          <div className="space-y-1 font-mono text-[11px]">
                            {Object.entries(changes).map(([field, delta]) => {
                              const fromVal = delta?.from !== undefined ? String(delta.from) : 'None';
                              const toVal = delta?.to !== undefined ? String(delta.to) : 'None';
                              return (
                                <div
                                  key={field}
                                  className="flex items-center gap-2 px-2 py-1 rounded bg-slate-900/60 border border-slate-800"
                                >
                                  <span className="text-indigo-300 font-semibold">{field}:</span>
                                  <span className="text-rose-400 line-through truncate max-w-[150px]" title={fromVal}>
                                    {fromVal}
                                  </span>
                                  <span className="text-slate-500">&rarr;</span>
                                  <span className="text-emerald-400 font-bold truncate max-w-[150px]" title={toVal}>
                                    {toVal}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-950/90 border-t border-slate-800 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </ModalPortal>
  );
}

export default TransactionAuditModal;
