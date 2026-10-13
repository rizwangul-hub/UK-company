import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Plus,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  Users,
  CreditCard,
  RefreshCw,
  X,
  Loader2,
  ArrowRight,
  Edit3,
  FileSpreadsheet,
} from 'lucide-react';
import { formatGBP, formatUKDate, formatMonthLabel, getCurrentMonth } from '../utils/formatters.js';
import { rentAPI, accountsAPI, reportsAPI } from '../services/api.js';

export function RentManagerPage({ selectedCompany }) {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth);
  const [schedules, setSchedules] = useState([]);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [landlordLoading, setLandlordLoading] = useState(false);

  // Generate schedules state
  const [generating, setGenerating] = useState(false);
  const [generateMsg, setGenerateMsg] = useState('');

  // Collect Payment Modal
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [collecting, setCollecting] = useState(false);
  const [collectError, setCollectError] = useState('');
  const [collectForm, setCollectForm] = useState({
    amount: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    receivingAccountId: '',
    paymentMethod: 'STANDING_ORDER',
    notes: '',
  });

  // Edit Schedule Modal
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [editScheduleSubmitting, setEditScheduleSubmitting] = useState(false);
  const [editScheduleError, setEditScheduleError] = useState('');
  const [editScheduleForm, setEditScheduleForm] = useState({
    expectedAmount: '',
    dueDate: '',
    paidAmount: '',
    status: 'PENDING',
    notes: '',
  });

  const loadSchedules = async () => {
    setLoading(true);
    try {
      const res = await rentAPI.getSchedules({ billingMonth: selectedMonth });
      if (res?.success) {
        setSchedules(res.data.schedules || []);
        setTotals(res.data.totals);
      }
    } catch (err) {
      console.error('Failed to load rent schedules:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAccounts = async () => {
    try {
      const res = await accountsAPI.getAll();
      if (res?.success) setAccounts(res.data.accounts || []);
    } catch (err) {
      console.error('Failed to load accounts:', err);
    }
  };

  useEffect(() => {
    loadSchedules();
  }, [selectedMonth]);

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleGenerateMonthly = async () => {
    setGenerating(true);
    setGenerateMsg('');
    try {
      const res = await rentAPI.generateMonthlySchedules(selectedMonth);
      if (res?.success) {
        setGenerateMsg(res.message);
        loadSchedules();
      }
    } catch (err) {
      setGenerateMsg(err.response?.data?.message || 'Failed to generate schedules.');
    } finally {
      setGenerating(false);
    }
  };

  const handleOpenCollect = (schedule) => {
    setSelectedSchedule(schedule);
    setCollectError('');
    setCollectForm({
      amount: String(schedule.outstandingAmount || schedule.expectedAmount || ''),
      paymentDate: new Date().toISOString().slice(0, 10),
      receivingAccountId: accounts[0]?._id || '',
      paymentMethod: 'STANDING_ORDER',
      notes: `Rent payment for ${formatMonthLabel(schedule.billingMonth)}`,
    });
    setShowCollectModal(true);
  };

  const handleCollectSubmit = async (e) => {
    e.preventDefault();
    setCollecting(true);
    setCollectError('');

    try {
      await rentAPI.recordPayment({
        scheduleId: selectedSchedule._id,
        amount: Number(collectForm.amount),
        paymentDate: collectForm.paymentDate,
        receivingAccountId: collectForm.receivingAccountId,
        paymentMethod: collectForm.paymentMethod,
        notes: collectForm.notes,
      });

      setShowCollectModal(false);
      loadSchedules();
    } catch (err) {
      setCollectError(err.response?.data?.message || 'Failed to record rent payment.');
    } finally {
      setCollecting(false);
    }
  };

  const handleOpenEditSchedule = (s) => {
    setEditingSchedule(s);
    setEditScheduleError('');
    setEditScheduleForm({
      expectedAmount: String(s.expectedAmount ?? ''),
      dueDate: s.dueDate ? new Date(s.dueDate).toISOString().slice(0, 10) : '',
      paidAmount: String(s.paidAmount ?? '0'),
      status: s.status || 'PENDING',
      notes: s.notes || '',
    });
  };

  const handleEditScheduleSubmit = async (e) => {
    e.preventDefault();
    if (!editingSchedule) return;
    setEditScheduleSubmitting(true);
    setEditScheduleError('');

    try {
      await rentAPI.updateSchedule(editingSchedule._id, {
        ...editScheduleForm,
        expectedAmount: Number(editScheduleForm.expectedAmount) || 0,
        paidAmount: Number(editScheduleForm.paidAmount) || 0,
      });
      setEditingSchedule(null);
      loadSchedules();
    } catch (err) {
      setEditScheduleError(err.response?.data?.message || 'Failed to update rent schedule.');
    } finally {
      setEditScheduleSubmitting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Rent Invoicing &amp; Collections
            </h1>
            {selectedCompany?.name && (
              <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {selectedCompany.name}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Expected rent billing schedules, collection receipts, and tenant arrears management for {selectedCompany?.legalName || selectedCompany?.name || 'portfolio'}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Month Selector */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            />
          </div>

          <button
            onClick={handleGenerateMonthly}
            disabled={generating}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition cursor-pointer disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            <span>Generate Invoices</span>
          </button>

          <button
            onClick={async () => {
              try {
                setLandlordLoading(true);
                const slug = selectedCompany?.slug || 'company';
                await reportsAPI.downloadLandlordStatementExcel(`Landlord_Report_${slug}_${new Date().toISOString().slice(0, 10)}.xlsx`);
              } catch (err) {
                console.error('Failed to download Landlord Report:', err);
                alert(err.message || 'Failed to download report');
              } finally {
                setLandlordLoading(false);
              }
            }}
            disabled={landlordLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50"
            title="Download official Landlord Rent Statement Excel report (Direct Properties, No Units)"
          >
            {landlordLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
            <span>Landlord Report (.xlsx)</span>
          </button>
        </div>
      </div>

      {generateMsg && (
        <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs flex items-center justify-between">
          <span>{generateMsg}</span>
          <button onClick={() => setGenerateMsg('')} className="text-slate-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="text-xs font-medium text-slate-400 mb-1">Expected Rent Roll</div>
          <div className="text-xl sm:text-2xl font-bold text-white">
            {formatGBP(totals?.totalExpected)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Total rent billed for {formatMonthLabel(selectedMonth)}
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="text-xs font-medium text-emerald-400 mb-1">Rent Received</div>
          <div className="text-xl sm:text-2xl font-bold text-emerald-300">
            {formatGBP(totals?.totalPaid)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Settled into UK bank accounts
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="text-xs font-medium text-amber-400 mb-1">Uncollected / Arrears</div>
          <div className="text-xl sm:text-2xl font-bold text-amber-300">
            {formatGBP(totals?.totalOutstanding)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Outstanding balance pending payment
          </div>
        </div>
      </div>

      {/* Schedules Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">
            Rent Billing Schedule: {formatMonthLabel(selectedMonth)}
          </h2>
          <span className="text-xs text-slate-400">
            {schedules.length} {schedules.length === 1 ? 'tenancy invoice' : 'tenancy invoices'}
          </span>
        </div>

        {loading ? (
          <div className="py-20 flex items-center justify-center text-slate-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
            <span className="text-xs">Loading billing schedules...</span>
          </div>
        ) : schedules.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Receipt className="w-10 h-10 text-slate-600 mx-auto" />
            <div className="text-sm font-semibold text-slate-300">No rent schedules generated for this month</div>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Click "Generate Invoices" above to automatically create rent bills for all active tenancy agreements.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Property & Unit</th>
                  <th className="py-3 px-4">Tenant</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Expected Rent</th>
                  <th className="py-3 px-4">Paid Amount</th>
                  <th className="py-3 px-4">Outstanding</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {schedules.map((s) => (
                  <tr key={s._id} className="hover:bg-slate-850/50 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">{s.propertyId?.name || 'Property'}</div>
                      <div className="text-[11px] text-slate-400">
                        {s.unitId?.unitName ? `${s.unitId.unitName} · ` : ''}
                        {s.propertyId?.postcode || s.propertyId?.city || 'UK'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-slate-200">
                        {s.tenantId?.fullName || s.propertyId?.tenantName || 'Direct Lease Tenant'}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {s.tenantId?.phone || s.tenantId?.email || s.notes || '—'}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-300">
                      {formatUKDate(s.dueDate)}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-200">
                      {formatGBP(s.expectedAmount)}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-emerald-400">
                      {formatGBP(s.paidAmount)}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-amber-400">
                      {formatGBP(s.outstandingAmount)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        s.status === 'PAID'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : s.status === 'PARTIAL'
                          ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                          : s.status === 'OVERDUE'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {s.status !== 'PAID' ? (
                          <button
                            onClick={() => handleOpenCollect(s)}
                            className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-semibold transition cursor-pointer"
                          >
                            Collect Rent
                          </button>
                        ) : (
                          <span className="text-[11px] text-emerald-400 font-medium inline-flex items-center gap-1 mr-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Settled</span>
                          </span>
                        )}
                        <button
                          onClick={() => handleOpenEditSchedule(s)}
                          className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer border border-slate-700/60"
                          title="Edit rent invoice details"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Collect Rent Modal */}
      {showCollectModal && selectedSchedule && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-base font-bold text-white">Record Rent Collection</h2>
                <p className="text-xs text-indigo-400 mt-0.5">
                  {selectedSchedule.propertyId?.name} ({selectedSchedule.unitId?.unitName})
                </p>
              </div>
              <button
                onClick={() => setShowCollectModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {collectError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {collectError}
              </div>
            )}

            <form onSubmit={handleCollectSubmit} className="mt-4 space-y-3.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>Tenant:</span>
                  <span className="font-semibold text-slate-200">{selectedSchedule.tenantId?.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Billing Period:</span>
                  <span className="text-slate-300">{formatMonthLabel(selectedSchedule.billingMonth)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Due:</span>
                  <span className="font-bold text-amber-400">{formatGBP(selectedSchedule.outstandingAmount)}</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Amount Paid (£)</label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={collectForm.amount}
                  onChange={(e) => setCollectForm({ ...collectForm, amount: e.target.value })}
                  placeholder="e.g. 1200.00"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-bold focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Receipt Date</label>
                  <input
                    type="date"
                    required
                    value={collectForm.paymentDate}
                    onChange={(e) => setCollectForm({ ...collectForm, paymentDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Payment Method</label>
                  <select
                    value={collectForm.paymentMethod}
                    onChange={(e) => setCollectForm({ ...collectForm, paymentMethod: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer"
                  >
                    <option value="STANDING_ORDER">Standing Order</option>
                    <option value="DIRECT_DEBIT">Direct Debit</option>
                    <option value="BANK_TRANSFER">Bank Transfer (BACS)</option>
                    <option value="CARD">Debit Card</option>
                    <option value="CASH">Cash</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Receiving Bank Account</label>
                <select
                  required
                  value={collectForm.receivingAccountId}
                  onChange={(e) => setCollectForm({ ...collectForm, receivingAccountId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer"
                >
                  <option value="">-- Select Receiving Account --</option>
                  {accounts.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name} ({a.bankName}) · Sort: {a.sortCode}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Receipt Notes</label>
                <input
                  type="text"
                  value={collectForm.notes}
                  onChange={(e) => setCollectForm({ ...collectForm, notes: e.target.value })}
                  placeholder="e.g. Cleared via online banking reference SO-102"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCollectModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={collecting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {collecting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Post Rent Receipt</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Rent Schedule Modal */}
      {editingSchedule && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Edit Rent Invoice Schedule</h2>
                  <p className="text-[11px] text-indigo-400">
                    {editingSchedule.propertyId?.name} ({editingSchedule.unitId?.unitName}) · {formatMonthLabel(editingSchedule.billingMonth)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingSchedule(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editScheduleError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {editScheduleError}
              </div>
            )}

            <form onSubmit={handleEditScheduleSubmit} className="mt-4 space-y-3.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 block">Tenant:</span>
                <span className="text-sm font-bold text-white">{editingSchedule.tenantId?.fullName}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <label className="block text-emerald-400 font-bold mb-1">Expected Rent (£)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editScheduleForm.expectedAmount}
                    onChange={(e) => setEditScheduleForm({ ...editScheduleForm, expectedAmount: e.target.value })}
                    className="w-full bg-slate-950 border border-emerald-500/30 rounded-lg px-3 py-2 text-emerald-300 font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Paid Amount (£)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editScheduleForm.paidAmount}
                    onChange={(e) => setEditScheduleForm({ ...editScheduleForm, paidAmount: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={editScheduleForm.dueDate}
                    onChange={(e) => setEditScheduleForm({ ...editScheduleForm, dueDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Status Override</label>
                  <select
                    value={editScheduleForm.status}
                    onChange={(e) => setEditScheduleForm({ ...editScheduleForm, status: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer"
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="PARTIAL">PARTIAL</option>
                    <option value="PAID">PAID</option>
                    <option value="OVERDUE">OVERDUE</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Invoice Notes</label>
                <input
                  type="text"
                  value={editScheduleForm.notes}
                  onChange={(e) => setEditScheduleForm({ ...editScheduleForm, notes: e.target.value })}
                  placeholder="e.g. Adjusted rent agreed due to repair delay..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingSchedule(null)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editScheduleSubmitting}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {editScheduleSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Rent Invoice</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default RentManagerPage;
