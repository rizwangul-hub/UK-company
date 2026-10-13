import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Plus,
  ArrowRightLeft,
  Building2,
  FileText,
  DollarSign,
  X,
  Loader2,
  History,
  CheckCircle2,
  Edit3,
} from 'lucide-react';
import { formatGBP, formatUKDate } from '../utils/formatters.js';
import { accountsAPI, getApiCache } from '../services/api.js';

export function AccountsPage({ selectedCompany }) {
  const cachedAccounts = getApiCache('/accounts');
  const [accounts, setAccounts] = useState(cachedAccounts?.data?.accounts || []);
  const [totals, setTotals] = useState(cachedAccounts?.data?.totals || null);
  const [loading, setLoading] = useState(!cachedAccounts?.data?.accounts);

  // New Account Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState('');
  const [addForm, setAddForm] = useState({
    name: '',
    accountType: 'BANK',
    bankName: 'Barclays Bank UK',
    sortCode: '',
    accountNumber: '',
    openingBalance: '0',
    notes: '',
  });

  // Edit Account Modal
  const [editingAccount, setEditingAccount] = useState(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');
  const [editForm, setEditForm] = useState({
    name: '',
    accountType: 'BANK',
    bankName: '',
    sortCode: '',
    accountNumber: '',
    currentBalance: '0',
    openingBalance: '0',
    notes: '',
    isActive: true,
  });

  // Transfer Modal
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [transferError, setTransferError] = useState('');
  const [transferForm, setTransferForm] = useState({
    fromAccountId: '',
    toAccountId: '',
    amount: '',
    transferDate: new Date().toISOString().slice(0, 10),
    reference: '',
    narration: '',
  });

  // Statement Drawer/Modal
  const [statementAccount, setStatementAccount] = useState(null);
  const [statementData, setStatementData] = useState(null);
  const [statementLoading, setStatementLoading] = useState(false);

  const loadAccounts = async (force = false) => {
    if (accounts.length === 0 || force) {
      setLoading(true);
    }
    try {
      const res = await accountsAPI.getAll({}, { forceRefresh: force });
      if (res?.success) {
        setAccounts(res.data.accounts || []);
        setTotals(res.data.totals);
      }
    } catch (err) {
      console.error('Failed to load accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setAddSubmitting(true);
    setAddError('');

    try {
      await accountsAPI.create({
        ...addForm,
        openingBalance: Number(addForm.openingBalance) || 0,
      });
      setShowAddModal(false);
      loadAccounts();
    } catch (err) {
      setAddError(err.response?.data?.message || 'Failed to create account.');
    } finally {
      setAddSubmitting(false);
    }
  };

  const handleOpenEdit = (acc) => {
    setEditingAccount(acc);
    setEditError('');
    setEditForm({
      name: acc.name || '',
      accountType: acc.accountType || 'BANK',
      bankName: acc.bankName || '',
      sortCode: acc.sortCode || '',
      accountNumber: acc.accountNumber || '',
      currentBalance: String(acc.currentBalance ?? 0),
      openingBalance: String(acc.openingBalance ?? 0),
      notes: acc.notes || '',
      isActive: acc.isActive !== false,
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingAccount) return;
    setEditSubmitting(true);
    setEditError('');

    try {
      await accountsAPI.update(editingAccount._id, {
        ...editForm,
        currentBalance: Number(editForm.currentBalance) || 0,
        openingBalance: Number(editForm.openingBalance) || 0,
      });
      setEditingAccount(null);
      loadAccounts();
    } catch (err) {
      setEditError(err.response?.data?.message || 'Failed to update account.');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    setTransferSubmitting(true);
    setTransferError('');

    try {
      await accountsAPI.transfer({
        fromAccountId: transferForm.fromAccountId,
        toAccountId: transferForm.toAccountId,
        amount: Number(transferForm.amount),
        transferDate: transferForm.transferDate,
        reference: transferForm.reference,
        narration: transferForm.narration,
      });
      setShowTransferModal(false);
      loadAccounts();
    } catch (err) {
      setTransferError(err.response?.data?.message || 'Transfer failed.');
    } finally {
      setTransferSubmitting(false);
    }
  };

  const handleOpenStatement = async (acc) => {
    setStatementAccount(acc);
    setStatementLoading(true);
    try {
      const res = await accountsAPI.getStatement(acc._id);
      if (res?.success) {
        setStatementData(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch account statement:', err);
    } finally {
      setStatementLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Bank Accounts &amp; Liquidity
            </h1>
            {selectedCompany?.name && (
              <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {selectedCompany.name}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Manage UK operational bank accounts, sort codes, balances, and atomic funds transfers for {selectedCompany?.legalName || selectedCompany?.name || 'the active company'}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setTransferError('');
              setTransferForm({
                fromAccountId: accounts[0]?._id || '',
                toAccountId: accounts[1]?._id || '',
                amount: '',
                transferDate: new Date().toISOString().slice(0, 10),
                reference: '',
                narration: '',
              });
              setShowTransferModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-200 border border-slate-700/80 text-xs font-semibold transition cursor-pointer"
          >
            <ArrowRightLeft className="w-4 h-4 text-indigo-400" />
            <span>Transfer Funds</span>
          </button>

          <button
            onClick={() => {
              setAddError('');
              setShowAddModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Bank Account</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="text-xs font-medium text-slate-400 mb-1">Total Liquid Cash</div>
          <div className="text-xl sm:text-2xl font-bold text-white">
            {formatGBP(totals?.totalLiquidity)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Across {accounts.length} UK liquidity accounts
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="text-xs font-medium text-indigo-400 mb-1">Bank Accounts Total</div>
          <div className="text-xl sm:text-2xl font-bold text-indigo-300">
            {formatGBP(totals?.bankBalance)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Cleared funds in UK commercial banks
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="text-xs font-medium text-cyan-400 mb-1">Cash in Hand</div>
          <div className="text-xl sm:text-2xl font-bold text-cyan-300">
            {formatGBP(totals?.cashBalance)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Petty cash floats
          </div>
        </div>
      </div>

      {/* Accounts Grid */}
      {loading ? (
        <div className="py-20 flex items-center justify-center text-slate-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
          <span className="text-xs">Loading bank accounts...</span>
        </div>
      ) : accounts.length === 0 ? (
        <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <CreditCard className="w-10 h-10 text-slate-600 mx-auto" />
          <div className="text-sm font-semibold text-slate-300">No bank accounts configured</div>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Add your Barclays, Lloyds, NatWest or other UK bank accounts to manage rent collections and disbursements.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((acc) => (
            <div
              key={acc._id}
              className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-sm"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-white truncate">{acc.name}</h3>
                    <div className="text-xs text-slate-400 mt-0.5">{acc.bankName || 'UK Bank'}</div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    {acc.accountType}
                  </span>
                </div>

                <div className="mt-4 p-3 rounded-xl bg-slate-950/70 border border-slate-800/80">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider">Current Balance</div>
                  <div className="text-lg font-bold text-emerald-400 mt-0.5">
                    {formatGBP(acc.currentBalance)}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Sort Code:</span>
                    <span className="font-mono text-slate-200">{acc.sortCode || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Account No:</span>
                    <span className="font-mono text-slate-200">{acc.accountNumber || 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <button
                  onClick={() => handleOpenStatement(acc)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 cursor-pointer"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Statement</span>
                </button>
                <button
                  onClick={() => handleOpenEdit(acc)}
                  className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-medium flex items-center gap-1.5 border border-slate-700/60 transition cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Edit Account</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Account Modal */}
      {editingAccount && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Edit Account Details</h2>
                  <p className="text-[11px] text-slate-400">Update balance, sort code, or name</p>
                </div>
              </div>
              <button
                onClick={() => setEditingAccount(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {editError}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Account Name</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="e.g. Barclays Current Account"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Account Type</label>
                  <select
                    value={editForm.accountType}
                    onChange={(e) => setEditForm({ ...editForm, accountType: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer"
                  >
                    <option value="BANK">Bank Account</option>
                    <option value="CASH">Cash in Hand</option>
                    <option value="CARD">Credit / Debit Card</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={editForm.bankName}
                    onChange={(e) => setEditForm({ ...editForm, bankName: e.target.value })}
                    placeholder="e.g. Barclays Bank"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* DIRECT CURRENT BALANCE EDIT */}
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-emerald-400 font-bold">Current Balance (£)</label>
                  <span className="text-[10px] text-emerald-500 font-medium">Live Liquidity</span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editForm.currentBalance}
                  onChange={(e) => setEditForm({ ...editForm, currentBalance: e.target.value })}
                  className="w-full bg-slate-950 border border-emerald-500/30 rounded-lg px-3 py-2 text-emerald-300 font-mono font-bold text-sm focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[10px] text-slate-400">
                  Update this directly if your physical bank statement or cash in hand differs.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Sort Code</label>
                  <input
                    type="text"
                    value={editForm.sortCode}
                    onChange={(e) => setEditForm({ ...editForm, sortCode: e.target.value })}
                    placeholder="20-00-00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Account Number</label>
                  <input
                    type="text"
                    value={editForm.accountNumber}
                    onChange={(e) => setEditForm({ ...editForm, accountNumber: e.target.value })}
                    placeholder="12345678"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 font-mono text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Opening Balance (£)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.openingBalance}
                  onChange={(e) => setEditForm({ ...editForm, openingBalance: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Notes / Description</label>
                <textarea
                  rows="2"
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  placeholder="Primary rental collections account..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="accountIsActive"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-600 bg-slate-950 border-slate-800 cursor-pointer"
                />
                <label htmlFor="accountIsActive" className="text-slate-300 cursor-pointer">
                  Account is Active
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {editSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h2 className="text-base font-bold text-white">Add UK Bank Account</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {addError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {addError}
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Account Display Name</label>
                <input
                  type="text"
                  required
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  placeholder="e.g. Barclays Property Current Account"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Account Type</label>
                  <select
                    value={addForm.accountType}
                    onChange={(e) => setAddForm({ ...addForm, accountType: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer"
                  >
                    <option value="BANK">Bank Account</option>
                    <option value="CASH">Cash in Hand</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Bank Name</label>
                  <input
                    type="text"
                    value={addForm.bankName}
                    onChange={(e) => setAddForm({ ...addForm, bankName: e.target.value })}
                    placeholder="e.g. Barclays, NatWest"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">UK Sort Code</label>
                  <input
                    type="text"
                    value={addForm.sortCode}
                    onChange={(e) => setAddForm({ ...addForm, sortCode: e.target.value })}
                    placeholder="20-00-00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Account Number</label>
                  <input
                    type="text"
                    value={addForm.accountNumber}
                    onChange={(e) => setAddForm({ ...addForm, accountNumber: e.target.value })}
                    placeholder="12345678"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Opening Balance (£)</label>
                <input
                  type="number"
                  step="0.01"
                  value={addForm.openingBalance}
                  onChange={(e) => setAddForm({ ...addForm, openingBalance: e.target.value })}
                  placeholder="0.00"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addSubmitting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {addSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Create Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Funds Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h2 className="text-base font-bold text-white">Transfer Funds Between Accounts</h2>
              <button
                onClick={() => setShowTransferModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {transferError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {transferError}
              </div>
            )}

            <form onSubmit={handleTransferSubmit} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">From Account (Source)</label>
                <select
                  required
                  value={transferForm.fromAccountId}
                  onChange={(e) => setTransferForm({ ...transferForm, fromAccountId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer"
                >
                  <option value="">-- Select Source Account --</option>
                  {accounts.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name} · Bal: {formatGBP(a.currentBalance)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">To Account (Destination)</label>
                <select
                  required
                  value={transferForm.toAccountId}
                  onChange={(e) => setTransferForm({ ...transferForm, toAccountId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer"
                >
                  <option value="">-- Select Destination Account --</option>
                  {accounts.map((a) => (
                    <option key={a._id} value={a._id} disabled={a._id === transferForm.fromAccountId}>
                      {a.name} · Bal: {formatGBP(a.currentBalance)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Transfer Amount (£)</label>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    value={transferForm.amount}
                    onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
                    placeholder="1000.00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-bold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Transfer Date</label>
                  <input
                    type="date"
                    required
                    value={transferForm.transferDate}
                    onChange={(e) => setTransferForm({ ...transferForm, transferDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Reference / Description</label>
                <input
                  type="text"
                  value={transferForm.narration}
                  onChange={(e) => setTransferForm({ ...transferForm, narration: e.target.value })}
                  placeholder="e.g. Sweeping rental surplus to reserve account"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferSubmitting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {transferSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Execute Transfer</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Account Statement Drawer/Modal */}
      {statementAccount && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-5 sm:p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-base font-bold text-white">Bank Account Statement</h2>
                <p className="text-xs text-indigo-400 mt-0.5">
                  {statementAccount.name} · Sort: {statementAccount.sortCode} · Acc: {statementAccount.accountNumber}
                </p>
              </div>
              <button
                onClick={() => setStatementAccount(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-500 block text-[10px]">Opening Balance:</span>
                <span className="font-semibold text-slate-300">{formatGBP(statementData?.openingBalance)}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 block text-[10px]">Closing Balance:</span>
                <span className="font-bold text-emerald-400">{formatGBP(statementData?.closingBalance)}</span>
              </div>
            </div>

            <div className="mt-4 max-h-96 overflow-y-auto">
              {statementLoading ? (
                <div className="py-12 flex items-center justify-center text-slate-500 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                  <span className="text-xs">Loading ledger entries...</span>
                </div>
              ) : statementData?.statement?.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No transactions recorded on this account yet.
                </div>
              ) : (
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-slate-500 text-[10px] uppercase border-b border-slate-800 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Narration</th>
                      <th className="py-2.5 px-3 text-right">Debit (Out)</th>
                      <th className="py-2.5 px-3 text-right">Credit (In)</th>
                      <th className="py-2.5 px-3 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {statementData?.statement?.map((row) => (
                      <tr key={row._id} className="hover:bg-slate-850/40">
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                          {formatUKDate(row.transactionDate)}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-slate-200">{row.narration}</div>
                          <div className="text-[10px] text-slate-500">{row.voucherNo}</div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-rose-400">
                          {row.debit > 0 ? formatGBP(row.debit) : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-emerald-400">
                          {row.credit > 0 ? formatGBP(row.credit) : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-200">
                          {formatGBP(row.runningBalance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AccountsPage;
