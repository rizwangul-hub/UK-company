import React, { useState, useEffect } from 'react';
import {
  Edit3,
  X,
  Save,
  Loader2,
  Calendar,
  Building2,
  CreditCard,
  Tag,
  DollarSign,
  FileText,
  AlertCircle,
  Landmark,
  ArrowRightLeft,
  Receipt,
  Users,
} from 'lucide-react';
import { ModalPortal } from './ModalPortal.jsx';
import { ledgerAPI, accountsAPI, propertiesAPI } from '../services/api.js';
import { formatGBP } from '../utils/formatters.js';

export function EditTransactionModal({
  isOpen,
  onClose,
  transaction,
  onSuccess,
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Dropdown lists
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loadingAux, setLoadingAux] = useState(false);

  // Form fields
  const [amount, setAmount] = useState('');
  const [transactionDate, setTransactionDate] = useState('');
  const [narration, setNarration] = useState('');
  const [reference, setReference] = useState('');
  const [accountId, setAccountId] = useState('');
  const [counterAccountId, setCounterAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [payeePayer, setPayeePayer] = useState('');

  // Mortgage specific splits
  const [interestAmount, setInterestAmount] = useState('0');
  const [principalAmount, setPrincipalAmount] = useState('0');
  const [feeAmount, setFeeAmount] = useState('0');

  useEffect(() => {
    if (!isOpen || !transaction) return;

    // Populate initial form values from transaction
    const tx = transaction;
    setAmount(String(tx.amount || tx.debit || tx.credit || ''));
    setTransactionDate(
      tx.transactionDate || tx.date
        ? new Date(tx.transactionDate || tx.date).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10)
    );
    setNarration(tx.narration || tx.detail || '');
    setReference(tx.reference || '');
    
    // Account ID extraction
    const accId = tx.accountId?._id || tx.accountId || tx.account || '';
    setAccountId(accId);

    // Counter Account ID (for transfers)
    const counterAccId = tx.counterAccountId?._id || tx.counterAccountId || '';
    setCounterAccountId(counterAccId);

    // Category ID
    const catId = tx.categoryId?._id || tx.categoryId || '';
    setCategoryId(catId);

    // Property ID
    const propId = tx.propertyId?._id || tx.propertyId || '';
    setPropertyId(propId);

    // Payee / Payer
    setPayeePayer(tx.payee || tx.receivedFrom || tx.tenantName || '');

    // Mortgage fields
    if (tx.transactionType === 'MORTGAGE_PAYMENT' || tx.type === 'MORTGAGE_PAYMENT') {
      setInterestAmount(String(tx.interestAmount || 0));
      setPrincipalAmount(String(tx.principalAmount || 0));
      setFeeAmount(String(tx.feeAmount || 0));
    }

    setError('');

    // Load aux data
    let isMounted = true;
    setLoadingAux(true);

    const loadAux = async () => {
      try {
        const promises = [
          accountsAPI.getAll(),
          ledgerAPI.getCategories(),
          propertiesAPI.getAll(),
        ];
        if (tx._id) {
          promises.push(ledgerAPI.getTransactionById(tx._id).catch(() => null));
        }

        const [accRes, catRes, propRes, txRes] = await Promise.all(promises);

        if (isMounted) {
          if (accRes?.success && accRes.data) {
            setAccounts(accRes.data.accounts || accRes.data || []);
          }
          if (catRes?.success && catRes.data) {
            setCategories(catRes.data.categories || catRes.data || []);
          }
          if (propRes?.success && propRes.data) {
            setProperties(propRes.data.properties || propRes.data || []);
          }
          if (txRes?.success && txRes.data) {
            const fullTx = txRes.data;
            if (fullTx.accountId) setAccountId(fullTx.accountId._id || fullTx.accountId);
            if (fullTx.counterAccountId) setCounterAccountId(fullTx.counterAccountId._id || fullTx.counterAccountId);
            if (fullTx.categoryId) setCategoryId(fullTx.categoryId._id || fullTx.categoryId);
            if (fullTx.propertyId) setPropertyId(fullTx.propertyId._id || fullTx.propertyId);
            if (fullTx.interestAmount !== undefined) setInterestAmount(String(fullTx.interestAmount));
            if (fullTx.principalAmount !== undefined) setPrincipalAmount(String(fullTx.principalAmount));
            if (fullTx.feeAmount !== undefined) setFeeAmount(String(fullTx.feeAmount));
            if (fullTx.payee || fullTx.receivedFrom) setPayeePayer(fullTx.payee || fullTx.receivedFrom);
          }
        }
      } catch (err) {
        console.error('Failed to load auxiliary data for transaction edit:', err);
      } finally {
        if (isMounted) setLoadingAux(false);
      }
    };

    loadAux();

    return () => {
      isMounted = false;
    };
  }, [isOpen, transaction]);

  if (!isOpen || !transaction) return null;

  const type = transaction.transactionType || transaction.type || 'EXPENSE';
  const isTransfer = type === 'TRANSFER';
  const isMortgage = type === 'MORTGAGE_PAYMENT';
  const isRent = type === 'RENT';
  const isIncome = type === 'INCOME' || type === 'RENT';

  // For mortgage split validation
  const numAmount = parseFloat(amount) || 0;
  const numInterest = parseFloat(interestAmount) || 0;
  const numPrincipal = parseFloat(principalAmount) || 0;
  const numFee = parseFloat(feeAmount) || 0;
  const mortgageSplitTotal = numInterest + numPrincipal + numFee;
  const mortgageSplitDiff = Math.abs(numAmount - mortgageSplitTotal);
  const isMortgageSplitValid = !isMortgage || mortgageSplitDiff < 0.05;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please specify a positive transaction amount.');
      return;
    }

    if (!accountId) {
      setError('Please select a bank or cash account.');
      return;
    }

    if (isTransfer && !counterAccountId) {
      setError('Please select the destination bank account for this transfer.');
      return;
    }

    if (isTransfer && accountId === counterAccountId) {
      setError('Source and destination accounts must be different for a transfer.');
      return;
    }

    if (isMortgage && !isMortgageSplitValid) {
      setError(`Mortgage breakdown (£${mortgageSplitTotal.toFixed(2)}) must exactly equal the total payment amount (£${numAmount.toFixed(2)}).`);
      return;
    }

    setSubmitting(true);
    setError('');

    const payload = {
      amount: numAmount,
      transactionDate,
      narration: narration.trim(),
      reference: reference.trim(),
      accountId,
    };

    if (isTransfer) {
      payload.counterAccountId = counterAccountId;
    }

    if (categoryId) {
      payload.categoryId = categoryId;
    }

    if (propertyId) {
      payload.propertyId = propertyId;
    }

    if (payeePayer) {
      if (isIncome) {
        payload.receivedFrom = payeePayer.trim();
      } else {
        payload.payee = payeePayer.trim();
      }
    }

    if (isMortgage) {
      payload.interestAmount = numInterest;
      payload.principalAmount = numPrincipal;
      payload.feeAmount = numFee;
    }

    try {
      const res = await ledgerAPI.updateTransaction(transaction._id, payload);
      if (res?.success) {
        if (onSuccess) onSuccess(res.data);
        onClose();
      } else {
        setError(res?.message || 'Failed to update transaction.');
      }
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Error occurred while saving transaction changes.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalPortal isOpen={isOpen} onClose={onClose}>
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>Edit Financial Transaction</span>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-500/30">
                  {transaction.voucherNo || 'VOUCHER'}
                </span>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {type}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Updating will automatically synchronize bank accounts, schedules, and ledgers
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

        {/* Content Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 custom-scrollbar text-xs">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Primary Transaction Info: Date & Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>Transaction Date</span> <span className="text-rose-400">*</span>
              </label>
              <input
                type="date"
                required
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-medium focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-indigo-400" />
                <span>Total Amount (£)</span> <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-bold font-mono focus:outline-none focus:border-indigo-500 text-sm"
              />
            </div>
          </div>

          {/* Accounts Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-indigo-400" />
                <span>
                  {isTransfer ? 'Source Account (Transfer Out)' : isIncome ? 'Receiving Bank / Cash' : 'Paying Bank / Cash'}
                </span>
                <span className="text-rose-400">*</span>
              </label>
              <select
                required
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-medium focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="">-- Select Bank Account --</option>
                {accounts.map((acc) => (
                  <option key={acc._id} value={acc._id}>
                    {acc.name} ({acc.bankName}) · Bal: {formatGBP(acc.currentBalance)}
                  </option>
                ))}
              </select>
            </div>

            {isTransfer ? (
              <div>
                <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1.5">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-sky-400" />
                  <span>Destination Account (Transfer In)</span> <span className="text-rose-400">*</span>
                </label>
                <select
                  required
                  value={counterAccountId}
                  onChange={(e) => setCounterAccountId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-medium focus:outline-none focus:border-sky-500 cursor-pointer"
                >
                  <option value="">-- Select Receiving Account --</option>
                  {accounts
                    .filter((acc) => acc._id !== accountId)
                    .map((acc) => (
                      <option key={acc._id} value={acc._id}>
                        {acc.name} ({acc.bankName}) · Bal: {formatGBP(acc.currentBalance)}
                      </option>
                    ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Nominal Category</span>
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-medium focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="">-- Select Category --</option>
                  {categories.map((cat) => (
                    <option key={cat._id} value={cat._id}>
                      {cat.name} ({cat.type})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Mortgage Breakdown (Only if MORTGAGE_PAYMENT) */}
          {isMortgage && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
                <span className="font-bold text-slate-300 flex items-center gap-1.5 text-xs">
                  <Landmark className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Mortgage Payment Allocation Breakdown</span>
                </span>
                <span
                  className={`text-[11px] font-mono font-bold ${
                    isMortgageSplitValid ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  Split Total: {formatGBP(mortgageSplitTotal)} / Total: {formatGBP(numAmount)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">
                    Interest Amount (£) <span className="text-slate-500">(Finance Cost)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={interestAmount}
                    onChange={(e) => setInterestAmount(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">
                    Principal Amount (£) <span className="text-emerald-400/90">(Reduces Debt)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={principalAmount}
                    onChange={(e) => setPrincipalAmount(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">
                    Lender Fee (£) <span className="text-slate-500">(Admin/Fee)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={feeAmount}
                    onChange={(e) => setFeeAmount(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {!isMortgageSplitValid && (
                <div className="text-[11px] text-rose-400 font-semibold bg-rose-950/20 border border-rose-900/40 rounded-lg p-2">
                  The sum of interest (£{numInterest.toFixed(2)}) + principal (£{numPrincipal.toFixed(2)}) + fee (£{numFee.toFixed(2)}) must equal £{numAmount.toFixed(2)} (difference: £{mortgageSplitDiff.toFixed(2)}).
                </div>
              )}
            </div>
          )}

          {/* Property & Payee / Payer (For non-transfer) */}
          {!isTransfer && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Linked Property (Optional)</span>
                </label>
                <select
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-medium focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="">-- No Property Link (General / Head Office) --</option>
                  {properties.map((prop) => (
                    <option key={prop._id} value={prop._id}>
                      {prop.name} ({prop.postcode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{isIncome ? 'Payer / Received From' : 'Payee / Supplier'}</span>
                </label>
                <input
                  type="text"
                  value={payeePayer}
                  onChange={(e) => setPayeePayer(e.target.value)}
                  placeholder={isIncome ? 'e.g. Tenant, Parking Lessee' : 'e.g. Contractor, British Gas'}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-medium focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Narration / Particulars */}
          <div>
            <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              <span>Particulars / Narration</span> <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              placeholder="Detailed description of the transaction"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-medium focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Reference */}
          <div>
            <label className="block text-slate-300 font-bold mb-1">
              External Reference / Invoice / Receipt No.
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. INV-2026-0042, DD-REF"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-medium focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Sticky Form Footer */}
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
              disabled={submitting || (isMortgage && !isMortgageSplitValid)}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/25 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save &amp; Recalculate</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </ModalPortal>
  );
}

export default EditTransactionModal;
