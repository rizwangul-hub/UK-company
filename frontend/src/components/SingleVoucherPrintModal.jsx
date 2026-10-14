import React from 'react';
import {
  Printer,
  X,
  CheckCircle2,
  Building2,
  CreditCard,
  Tag,
  FileText,
  Calendar,
  Layers,
  Edit3,
  Paperclip,
  ExternalLink,
} from 'lucide-react';
import { formatGBP, formatUKDate } from '../utils/formatters.js';
import pixxLogo from '../assets/logo.png';

export function SingleVoucherPrintModal({ voucher, selectedCompany, onClose, onEdit }) {
  if (!voucher) return null;

  const handlePrint = () => {
    window.print();
  };

  const isRent = voucher.type === 'RENT_PAYMENT' || voucher.type === 'INCOME';
  const isMortgage = voucher.type === 'MORTGAGE_PAYMENT' || voucher.type === 'MORTGAGE';
  const isTransfer = voucher.type === 'INTERNAL_TRANSFER' || voucher.type === 'TRANSFER';
  const isExpense = voucher.type === 'EXPENSE' || (!isRent && !isMortgage && !isTransfer);

  const documentTitle = isRent
    ? 'RENT RECEIPT & COLLECTION VOUCHER'
    : isMortgage
    ? 'MORTGAGE SERVICING & DEBT VOUCHER'
    : isTransfer
    ? 'INTERNAL LIQUIDITY TRANSFER VOUCHER'
    : 'PROPERTY EXPENSE & OPERATING VOUCHER';

  const amount = voucher.amount ?? voucher.debit ?? voucher.credit ?? 0;
  const displayLogo = selectedCompany?.logo || pixxLogo;
  const displayName = selectedCompany?.legalName || selectedCompany?.name || 'PIXX TECHNOLOGIES UK PROPERTY FINANCE LTD';
  const displayReg = selectedCompany?.registrationNo ? `Reg: ${selectedCompany.registrationNo} • ` : '';

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm overflow-y-auto flex justify-center p-2 sm:p-4 md:p-6 font-sans">
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-3xl w-full flex flex-col my-auto border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Top Action Bar (Hidden when printing) */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3 no-print border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-600/30 text-indigo-400 border border-indigo-500/30">
              <FileText size={18} />
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                UK Voucher Document
              </span>
              <span className="text-xs font-mono font-bold text-indigo-400 ml-2">
                {voucher.voucherNo}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={() => {
                  onEdit(voucher);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
              >
                <Edit3 size={14} />
                <span>Edit Voucher</span>
              </button>
            )}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition cursor-pointer"
            >
              <Printer size={14} />
              <span>Print A4 Voucher</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Sheet */}
        <div className="p-4 sm:p-8 bg-slate-100 dark:bg-slate-950/50 flex justify-center overflow-x-auto">
          <div
            id="printable-voucher-sheet"
            className="printable-a4-voucher bg-white text-slate-900 p-6 sm:p-8 shadow-xl rounded-xl w-full max-w-[210mm] mx-auto flex flex-col justify-between border border-slate-200"
          >
            <div className="space-y-5">
              {/* 1. Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-slate-900 pb-4">
                <div className="flex items-center gap-3.5">
                  <div className="h-14 w-14 rounded-xl border border-slate-200 p-1 flex items-center justify-center shrink-0 overflow-hidden bg-white">
                    <img
                      src={displayLogo}
                      alt={`${displayName} Logo`}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <h1 className="text-lg font-black tracking-tight text-slate-900 uppercase">
                      {displayName}
                    </h1>
                    <p className="text-[11px] font-semibold text-slate-600">
                      {displayReg}14 Belgrave Square, London SW1X 8PZ &bull; United Kingdom
                    </p>
                    <p className="text-[11px] font-medium text-slate-500">
                      Property Asset Accounting &bull; HMRC Section 24 Compliant
                    </p>
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <div className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider">
                    Official Company Voucher
                  </div>
                  <div className="text-xs font-mono font-black text-indigo-950 bg-indigo-50 px-2.5 py-1 rounded border border-indigo-200 mt-1 inline-block">
                    Voucher #: {voucher.voucherNo}
                  </div>
                </div>
              </div>

              {/* 2. Document Title & Verified Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200 gap-2">
                <div>
                  <h2 className="text-sm font-black tracking-wide text-slate-900 uppercase">
                    {documentTitle}
                  </h2>
                  <div className="text-[11px] font-semibold text-slate-500">
                    Transaction Date:{' '}
                    <strong className="text-slate-900 font-mono">
                      {formatUKDate(voucher.date)}
                    </strong>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 bg-emerald-100 border border-emerald-300 text-emerald-900 px-3 py-1 rounded text-xs font-black uppercase self-start sm:self-auto">
                  <CheckCircle2 size={14} className="text-emerald-700" />
                  POSTED &amp; VERIFIED
                </div>
              </div>

              {/* 3. Classification Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Left Card: Property / Tenant details */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                  <div className="text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200 pb-1">
                    Asset &amp; Counter-Party
                  </div>

                  <div>
                    <span className="text-slate-500 font-semibold">Property: </span>
                    <strong className="text-slate-900">
                      {voucher.propertyName || 'Portfolio-wide / UK Assets'}
                    </strong>
                  </div>

                  {voucher.unitName && (
                    <div>
                      <span className="text-slate-500 font-semibold">Unit: </span>
                      <strong className="text-slate-900">{voucher.unitName}</strong>
                    </div>
                  )}

                  {voucher.tenantName && (
                    <div>
                      <span className="text-slate-500 font-semibold">Tenant: </span>
                      <strong className="text-slate-900">{voucher.tenantName}</strong>
                    </div>
                  )}

                  <div>
                    <span className="text-slate-500 font-semibold">Transaction Type: </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-800">
                      {voucher.type || 'JOURNAL_ENTRY'}
                    </span>
                  </div>
                </div>

                {/* Right Card: Bank Accounts & Nominal Classification */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                  <div className="text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200 pb-1">
                    Nominal Head &amp; Accounts
                  </div>

                  <div>
                    <span className="text-slate-500 font-semibold">Nominal Head: </span>
                    <strong className="text-slate-900">{voucher.categoryName || 'General'}</strong>
                  </div>

                  <div>
                    <span className="text-slate-500 font-semibold">Debit Leg (Dr): </span>
                    <strong className="text-slate-900">{voucher.drAccount || '-'}</strong>
                  </div>

                  <div>
                    <span className="text-slate-500 font-semibold">Credit Leg (Cr): </span>
                    <strong className="text-slate-900">{voucher.crAccount || '-'}</strong>
                  </div>

                  {voucher.reference && (
                    <div>
                      <span className="text-slate-500 font-semibold">Bank / Cheque Ref: </span>
                      <strong className="font-mono text-slate-900">{voucher.reference}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* 4. Narration */}
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">
                  Transaction Narration &amp; Particulars
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 leading-relaxed">
                  {voucher.detail || voucher.narration || 'No narration provided.'}
                </div>
              </div>

              {/* 5. Double-Entry Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 text-slate-800 uppercase font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">Ledger Account</th>
                      <th className="p-2.5">Nominal Classification</th>
                      <th className="p-2.5 text-right">Debit (£)</th>
                      <th className="p-2.5 text-right">Credit (£)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-semibold text-slate-900">
                    <tr>
                      <td className="p-2.5">{voucher.drAccount || 'Receiving Account / Asset'}</td>
                      <td className="p-2.5">{voucher.categoryName || 'Operating Nominal'}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                        {formatGBP(amount)}
                      </td>
                      <td className="p-2.5 text-right font-mono text-slate-400">-</td>
                    </tr>
                    <tr>
                      <td className="p-2.5">{voucher.crAccount || 'Payment Source / Income Head'}</td>
                      <td className="p-2.5">{voucher.categoryName || 'Operating Nominal'}</td>
                      <td className="p-2.5 text-right font-mono text-slate-400">-</td>
                      <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                        {formatGBP(amount)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 6. Prominent Total Banner */}
              <div className="bg-slate-50 border-2 border-slate-900 text-slate-900 p-3.5 rounded-lg flex items-center justify-between shadow-xs">
                <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                  TOTAL AMOUNT {isRent ? 'RECEIVED' : 'TRANSACTED'}
                </span>
                <span className="text-2xl font-black font-mono tracking-tight text-slate-900">
                  {formatGBP(amount)}
                </span>
              </div>

              {/* 7. Attached Receipt / Source Verification Document */}
              {voucher.receiptUrl && (
                <div className="bg-indigo-50/80 border border-indigo-200 rounded-lg p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700 shrink-0">
                      <Paperclip size={16} />
                    </div>
                    <div className="truncate">
                      <div className="text-[10px] uppercase font-bold text-indigo-800 tracking-wider">
                        Attached Receipt / Source Document
                      </div>
                      <div className="text-xs font-semibold text-slate-800 truncate">
                        {voucher.receiptFilename || 'Verified Transaction Document'}
                      </div>
                    </div>
                  </div>
                  <a
                    href={voucher.receiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition shadow-xs shrink-0"
                  >
                    <ExternalLink size={12} />
                    <span>View Document</span>
                  </a>
                </div>
              )}
            </div>

            {/* Bottom Signatures & Certification */}
            <div className="pt-6 mt-6 space-y-4 border-t border-slate-200">
              <div className="grid grid-cols-2 gap-8 border border-slate-200 rounded-lg p-4 bg-slate-50">
                <div className="text-center space-y-1">
                  <div className="text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200 pb-1 mb-2">
                    Prepared By
                  </div>
                  <div className="text-xs font-black text-slate-900 font-mono">
                    Rizwan Ullah
                  </div>
                  <div className="text-[10px] text-slate-500 font-semibold">
                    Software Developer &amp; Systems Controller
                  </div>
                  <div className="text-[9px] text-slate-400">
                    PIXX Technologies UK
                  </div>
                </div>

                <div className="text-center space-y-1">
                  <div className="text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200 pb-1 mb-2">
                    Verified &amp; Approved By
                  </div>
                  <div className="text-xs font-black text-slate-900 font-mono">
                    UK Property Controller
                  </div>
                  <div className="text-[10px] text-slate-500 font-semibold">
                    Landlord &amp; Finance Director
                  </div>
                  <div className="text-[9px] text-slate-400">
                    HMRC Self-Assessment Ready
                  </div>
                </div>
              </div>

              <div className="text-center text-[10px] font-semibold text-slate-500">
                PIXX Technologies UK Property Finance System &bull; System Generated Voucher &bull; Printed {new Date().toLocaleString('en-GB')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print CSS */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 12mm;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            background: #ffffff !important;
            color: #000000 !important;
          }
          .no-print {
            display: none !important;
          }
          #printable-voucher-sheet {
            box-shadow: none !important;
            border: none !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}

export default SingleVoucherPrintModal;
