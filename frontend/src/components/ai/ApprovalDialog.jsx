import React, { useState } from 'react';
import { ShieldAlert, CheckCircle2, XCircle, Loader2, Mail } from 'lucide-react';

export function ApprovalDialog({ approval, onApprove, onReject }) {
  const [busy, setBusy] = useState(false);

  if (!approval) return null;
  const isPending = approval.status === 'PENDING';
  const isEmail = approval.actionType === 'SEND_APPROVED_EMAIL';

  const handleApprove = async () => {
    setBusy(true);
    try {
      await onApprove(approval);
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    setBusy(true);
    try {
      await onReject(approval);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-slate-800 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="p-2 rounded-lg bg-amber-100 text-amber-700 shrink-0">
            {isEmail ? <Mail className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
          </div>
          <div>
            <div className="font-bold text-slate-900 text-[13px]">{approval.title}</div>
            <div className="text-slate-600 mt-0.5">
              Action: <span className="font-mono font-semibold">{approval.actionType}</span> · Company:{' '}
              <span className="font-semibold uppercase">{approval.companyId}</span>
            </div>
          </div>
        </div>
        <span
          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
            approval.status === 'EXECUTED'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : approval.status === 'REJECTED'
              ? 'bg-rose-50 text-rose-700 border-rose-200'
              : 'bg-amber-100 text-amber-800 border-amber-300'
          }`}
        >
          {approval.status}
        </span>
      </div>

      {approval.summary && <p className="text-slate-700">{approval.summary}</p>}

      {approval.previewData && (
        <div className="rounded-lg bg-white border border-slate-200 p-3 space-y-1 text-[12px]">
          {Object.entries(approval.previewData).map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <span className="font-semibold text-slate-500 min-w-[110px]">{k}:</span>
              <span className="text-slate-800 break-words whitespace-pre-wrap">
                {typeof v === 'object' ? JSON.stringify(v) : String(v)}
              </span>
            </div>
          ))}
        </div>
      )}

      {isPending && (
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            disabled={busy}
            onClick={handleReject}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold transition cursor-pointer disabled:opacity-50"
          >
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>Reject</span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleApprove}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm transition cursor-pointer disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            <span>Approve &amp; Execute</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default ApprovalDialog;
