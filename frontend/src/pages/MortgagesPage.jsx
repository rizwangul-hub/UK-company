import React, { useState, useEffect } from 'react';
import {
  Landmark,
  Plus,
  CreditCard,
  Building2,
  Calendar,
  AlertTriangle,
  Percent,
  CheckCircle2,
  FileText,
  DollarSign,
  ChevronRight,
  X,
  Loader2,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { formatGBP, formatUKDate } from '../utils/formatters.js';
import { mortgagesAPI, propertiesAPI, accountsAPI, getApiCache } from '../services/api.js';

export function MortgagesPage({ selectedCompany }) {
  const cachedMortgages = getApiCache('/mortgages');
  const [mortgages, setMortgages] = useState(cachedMortgages?.data?.mortgages || []);
  const [summary, setSummary] = useState(cachedMortgages?.data?.summary || null);
  const [loading, setLoading] = useState(!cachedMortgages?.data?.mortgages);

  // Reference data for modals
  const [properties, setProperties] = useState([]);
  const [accounts, setAccounts] = useState([]);

  // Add Mortgage Facility Modal
  const [showFacilityModal, setShowFacilityModal] = useState(false);
  const [facilitySubmitting, setFacilitySubmitting] = useState(false);
  const [facilityError, setFacilityError] = useState('');
  const [facilityForm, setFacilityForm] = useState({
    propertyId: '',
    lenderName: '',
    accountReference: '',
    originalLoanAmount: '',
    outstandingPrincipalBalance: '',
    interestRate: '',
    rateType: 'FIXED',
    fixedRateExpiryDate: '',
    startDate: '',
    maturityDate: '',
    termYears: '25',
    repaymentType: 'INTEREST_ONLY',
    expectedRepaymentAmount: '',
    paymentAccountId: '',
    notes: '',
  });

  // Record Mortgage Payment Modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedMortgage, setSelectedMortgage] = useState(null);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentForm, setPaymentForm] = useState({
    paymentDate: new Date().toISOString().slice(0, 10),
    totalAmountPaid: '',
    interestAmount: '',
    principalAmount: '',
    feeAmount: '0',
    paymentAccountId: '',
    paymentReference: '',
    isLenderConfirmed: false,
    notes: '',
  });

  // Reconcile Modal
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [reconcileSubmitting, setReconcileSubmitting] = useState(false);
  const [reconcileError, setReconcileError] = useState('');
  const [reconcileForm, setReconcileForm] = useState({
    confirmedBalance: '',
    statementDate: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  const loadMortgages = async (force = false) => {
    if (mortgages.length === 0 || force) {
      setLoading(true);
    }
    try {
      const res = await mortgagesAPI.getAll({}, { forceRefresh: force });
      if (res?.success) {
        setMortgages(res.data.mortgages || []);
        setSummary(res.data.summary);
      }
    } catch (err) {
      console.error('Failed to load mortgages:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadReferences = async () => {
    try {
      const [propsRes, accsRes] = await Promise.all([
        propertiesAPI.getAll(),
        accountsAPI.getAll(),
      ]);
      if (propsRes?.success) setProperties(propsRes.data.properties || []);
      if (accsRes?.success) setAccounts(accsRes.data.accounts || []);
    } catch (err) {
      console.error('Failed to load reference dropdowns:', err);
    }
  };

  useEffect(() => {
    loadMortgages();
    loadReferences();
  }, []);

  // Open Payment Modal
  const handleOpenPayment = (mortgage) => {
    setSelectedMortgage(mortgage);
    setPaymentError('');

    // Pre-calculate interest split if interest-only
    let defaultInterest = '';
    let defaultPrincipal = '0';
    if (mortgage.repaymentType === 'INTEREST_ONLY') {
      defaultInterest = String(mortgage.expectedRepaymentAmount || '');
    } else {
      // Estimated monthly interest
      const monthlyInt = ((mortgage.outstandingPrincipalBalance * (mortgage.interestRate / 100)) / 12).toFixed(2);
      defaultInterest = String(monthlyInt);
      defaultPrincipal = String(Math.max(0, (mortgage.expectedRepaymentAmount - Number(monthlyInt))).toFixed(2));
    }

    setPaymentForm({
      paymentDate: new Date().toISOString().slice(0, 10),
      totalAmountPaid: String(mortgage.expectedRepaymentAmount || ''),
      interestAmount: defaultInterest,
      principalAmount: defaultPrincipal,
      feeAmount: '0',
      paymentAccountId: mortgage.paymentAccountId?._id || mortgage.paymentAccountId || '',
      paymentReference: mortgage.accountReference || '',
      isLenderConfirmed: false,
      notes: '',
    });
    setShowPaymentModal(true);
  };

  // Open Reconcile Modal
  const handleOpenReconcile = (mortgage) => {
    setSelectedMortgage(mortgage);
    setReconcileError('');
    setReconcileForm({
      confirmedBalance: String(mortgage.outstandingPrincipalBalance || ''),
      statementDate: new Date().toISOString().slice(0, 10),
      notes: 'Annual lender statement balance verification',
    });
    setShowReconcileModal(true);
  };

  const handleFacilitySubmit = async (e) => {
    e.preventDefault();
    setFacilitySubmitting(true);
    setFacilityError('');

    try {
      const payload = {
        ...facilityForm,
        originalLoanAmount: Number(facilityForm.originalLoanAmount),
        outstandingPrincipalBalance: Number(facilityForm.outstandingPrincipalBalance) || Number(facilityForm.originalLoanAmount),
        interestRate: Number(facilityForm.interestRate),
        expectedRepaymentAmount: Number(facilityForm.expectedRepaymentAmount),
        termYears: Number(facilityForm.termYears) || 25,
      };

      await mortgagesAPI.create(payload);
      setShowFacilityModal(false);
      loadMortgages();
    } catch (err) {
      setFacilityError(err.response?.data?.message || 'Failed to create mortgage facility.');
    } finally {
      setFacilitySubmitting(false);
    }
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setPaymentSubmitting(true);
    setPaymentError('');

    try {
      const total = Number(paymentForm.totalAmountPaid);
      const interest = Number(paymentForm.interestAmount);
      const principal = Number(paymentForm.principalAmount);
      const fee = Number(paymentForm.feeAmount) || 0;

      const sum = Number((interest + principal + fee).toFixed(2));
      if (Math.abs(sum - total) > 0.05) {
        setPaymentError(`Split components (£${sum}) do not match total amount paid (£${total}). Please balance Interest and Principal.`);
        setPaymentSubmitting(false);
        return;
      }

      await mortgagesAPI.recordPayment(selectedMortgage._id, {
        paymentDate: paymentForm.paymentDate,
        totalAmountPaid: total,
        interestAmount: interest,
        principalAmount: principal,
        feeAmount: fee,
        paymentAccountId: paymentForm.paymentAccountId,
        paymentReference: paymentForm.paymentReference,
        isLenderConfirmed: paymentForm.isLenderConfirmed,
        notes: paymentForm.notes,
      });

      setShowPaymentModal(false);
      loadMortgages();
    } catch (err) {
      setPaymentError(err.response?.data?.message || 'Failed to record mortgage payment.');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const handleReconcileSubmit = async (e) => {
    e.preventDefault();
    setReconcileSubmitting(true);
    setReconcileError('');

    try {
      await mortgagesAPI.reconcileBalance(selectedMortgage._id, {
        confirmedBalance: Number(reconcileForm.confirmedBalance),
        statementDate: reconcileForm.statementDate,
        notes: reconcileForm.notes,
      });
      setShowReconcileModal(false);
      loadMortgages();
    } catch (err) {
      setReconcileError(err.response?.data?.message || 'Failed to reconcile balance.');
    } finally {
      setReconcileSubmitting(false);
    }
  };

  // Helper calculation for payment split in modal
  const enteredTotal = Number(paymentForm.totalAmountPaid) || 0;
  const enteredSplitSum = Number(
    (
      (Number(paymentForm.interestAmount) || 0) +
      (Number(paymentForm.principalAmount) || 0) +
      (Number(paymentForm.feeAmount) || 0)
    ).toFixed(2)
  );
  const splitDifference = Number((enteredTotal - enteredSplitSum).toFixed(2));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <span>Mortgage Management</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium">
                UK Module
              </span>
            </h1>
            {selectedCompany?.name && (
              <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {selectedCompany.name}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Track lender terms, interest vs capital principal splits, and statement reconciliations for {selectedCompany?.legalName || selectedCompany?.name || 'portfolio'}.
          </p>
        </div>

        <button
          onClick={() => {
            setFacilityError('');
            setShowFacilityModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Mortgage Facility</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="text-xs font-medium text-slate-400 mb-1 flex items-center justify-between">
            <span>Total Outstanding Principal</span>
            <Landmark className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white">
            {formatGBP(summary?.totalOutstandingPrincipal)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Aggregate mortgage debt across portfolio
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="text-xs font-medium text-slate-400 mb-1 flex items-center justify-between">
            <span>Monthly Debt Service</span>
            <CreditCard className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white">
            {formatGBP(summary?.totalExpectedMonthlyPayment)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Scheduled monthly cash outflow
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5">
          <div className="text-xs font-medium text-slate-400 mb-1 flex items-center justify-between">
            <span>Active Facilities</span>
            <Building2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white">
            {summary?.activeCount || 0}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Active lenders & secured mortgages
          </div>
        </div>
      </div>

      {/* Facilities Grid */}
      {loading ? (
        <div className="py-20 flex items-center justify-center text-slate-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
          <span className="text-xs">Loading mortgage facilities...</span>
        </div>
      ) : mortgages.length === 0 ? (
        <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <Landmark className="w-10 h-10 text-slate-600 mx-auto" />
          <div className="text-sm font-semibold text-slate-300">No mortgages on record</div>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Attach buy-to-let or commercial mortgage loans to your UK properties to begin tracking interest costs and capital amortizations.
          </p>
          <button
            onClick={() => setShowFacilityModal(true)}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-medium cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Mortgage</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mortgages.map((m) => {
            const isExpiringSoon = m.fixedRateExpiryDate && new Date(m.fixedRateExpiryDate) - new Date() < 180 * 24 * 3600 * 1000;

            return (
              <div
                key={m._id}
                className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between shadow-sm space-y-4"
              >
                <div>
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                        {m.lenderName}
                      </span>
                      <h3 className="text-sm font-bold text-white mt-0.5">
                        Ref: {m.accountReference}
                      </h3>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="truncate">{m.propertyId?.name || 'Property'} ({m.propertyId?.postcode})</span>
                      </div>
                    </div>

                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                      {m.repaymentType?.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Financial Metrics */}
                  <div className="grid grid-cols-2 gap-2 mt-4 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">Outstanding Principal</div>
                      <div className="text-sm font-bold text-rose-300 mt-0.5">
                        {formatGBP(m.outstandingPrincipalBalance)}
                      </div>
                      <div className="text-[9px] text-slate-500">
                        Orig: {formatGBP(m.originalLoanAmount)}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider">Interest Rate</div>
                      <div className="text-sm font-bold text-slate-200 mt-0.5">
                        {m.interestRate}% <span className="text-[10px] font-normal text-slate-400">({m.rateType})</span>
                      </div>
                      <div className="text-[9px] text-slate-500">
                        Monthly: {formatGBP(m.expectedRepaymentAmount)}
                      </div>
                    </div>
                  </div>

                  {/* Dates & Expiries */}
                  <div className="mt-3 space-y-1.5 text-[11px] text-slate-400">
                    {m.fixedRateExpiryDate && (
                      <div className="flex items-center justify-between">
                        <span>Fixed Rate Expiry:</span>
                        <span className={`font-semibold ${isExpiringSoon ? 'text-amber-400 flex items-center gap-1' : 'text-slate-300'}`}>
                          {isExpiringSoon && <AlertTriangle className="w-3 h-3" />}
                          {formatUKDate(m.fixedRateExpiryDate)}
                        </span>
                      </div>
                    )}
                    {m.paymentAccountId && (
                      <div className="flex items-center justify-between">
                        <span>Servicing Account:</span>
                        <span className="text-slate-300 font-medium truncate max-w-[140px]">
                          {m.paymentAccountId.name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-3 border-t border-slate-800 flex items-center gap-2">
                  <button
                    onClick={() => handleOpenPayment(m)}
                    className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition cursor-pointer text-center"
                  >
                    Record Payment
                  </button>
                  <button
                    onClick={() => handleOpenReconcile(m)}
                    className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
                    title="Reconcile with lender statement"
                  >
                    Reconcile
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: New Mortgage Facility */}
      {showFacilityModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h2 className="text-base font-bold text-white">New UK Mortgage Facility</h2>
              <button
                onClick={() => setShowFacilityModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {facilityError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {facilityError}
              </div>
            )}

            <form onSubmit={handleFacilitySubmit} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Linked Property</label>
                <select
                  required
                  value={facilityForm.propertyId}
                  onChange={(e) => setFacilityForm({ ...facilityForm, propertyId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer"
                >
                  <option value="">-- Select Property --</option>
                  {properties.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} ({p.postcode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Lender / Provider Name</label>
                  <input
                    type="text"
                    required
                    value={facilityForm.lenderName}
                    onChange={(e) => setFacilityForm({ ...facilityForm, lenderName: e.target.value })}
                    placeholder="e.g. Paragon Bank"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Mortgage Account Reference</label>
                  <input
                    type="text"
                    required
                    value={facilityForm.accountReference}
                    onChange={(e) => setFacilityForm({ ...facilityForm, accountReference: e.target.value })}
                    placeholder="e.g. 789456123"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Original Loan Amount (£)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="0.01"
                    value={facilityForm.originalLoanAmount}
                    onChange={(e) => setFacilityForm({ ...facilityForm, originalLoanAmount: e.target.value })}
                    placeholder="180000"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Current Principal Balance (£)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={facilityForm.outstandingPrincipalBalance}
                    onChange={(e) => setFacilityForm({ ...facilityForm, outstandingPrincipalBalance: e.target.value })}
                    placeholder="180000"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Interest Rate (%)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={facilityForm.interestRate}
                    onChange={(e) => setFacilityForm({ ...facilityForm, interestRate: e.target.value })}
                    placeholder="4.85"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Rate Type</label>
                  <select
                    value={facilityForm.rateType}
                    onChange={(e) => setFacilityForm({ ...facilityForm, rateType: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer"
                  >
                    <option value="FIXED">Fixed</option>
                    <option value="VARIABLE">Variable</option>
                    <option value="TRACKER">Tracker</option>
                    <option value="STANDARD_VARIABLE">Standard Variable</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Fixed Rate Expiry</label>
                  <input
                    type="date"
                    value={facilityForm.fixedRateExpiryDate}
                    onChange={(e) => setFacilityForm({ ...facilityForm, fixedRateExpiryDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Repayment Arrangement</label>
                  <select
                    value={facilityForm.repaymentType}
                    onChange={(e) => setFacilityForm({ ...facilityForm, repaymentType: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer"
                  >
                    <option value="INTEREST_ONLY">Interest-Only</option>
                    <option value="CAPITAL_REPAYMENT">Capital Repayment</option>
                    <option value="PART_AND_PART">Part and Part</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Monthly Repayment (£)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={facilityForm.expectedRepaymentAmount}
                    onChange={(e) => setFacilityForm({ ...facilityForm, expectedRepaymentAmount: e.target.value })}
                    placeholder="750.00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Mortgage Start Date</label>
                  <input
                    type="date"
                    required
                    value={facilityForm.startDate}
                    onChange={(e) => setFacilityForm({ ...facilityForm, startDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Maturity Date</label>
                  <input
                    type="date"
                    required
                    value={facilityForm.maturityDate}
                    onChange={(e) => setFacilityForm({ ...facilityForm, maturityDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Servicing Bank Account</label>
                <select
                  required
                  value={facilityForm.paymentAccountId}
                  onChange={(e) => setFacilityForm({ ...facilityForm, paymentAccountId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer"
                >
                  <option value="">-- Select Bank Account --</option>
                  {accounts.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name} ({a.bankName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowFacilityModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={facilitySubmitting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {facilitySubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Mortgage</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Record Mortgage Payment (with strict split validation) */}
      {showPaymentModal && selectedMortgage && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-base font-bold text-white">Record Mortgage Payment</h2>
                <p className="text-xs text-indigo-400 mt-0.5">
                  {selectedMortgage.lenderName} · Ref: {selectedMortgage.accountReference}
                </p>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {paymentError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {paymentError}
              </div>
            )}

            <form onSubmit={handlePaymentSubmit} className="mt-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Payment Date</label>
                  <input
                    type="date"
                    required
                    value={paymentForm.paymentDate}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Total Paid from Bank (£)</label>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    value={paymentForm.totalAmountPaid}
                    onChange={(e) => setPaymentForm({ ...paymentForm, totalAmountPaid: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-bold focus:outline-none"
                  />
                </div>
              </div>

              {/* Accounting Split Section */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200">Accounting Component Split</span>
                  <div className={`text-[11px] font-semibold flex items-center gap-1 ${
                    Math.abs(splitDifference) <= 0.01 ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {Math.abs(splitDifference) <= 0.01 ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Balanced (£{enteredSplitSum})</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Unallocated: £{splitDifference}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">
                      Interest Component (£)
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={paymentForm.interestAmount}
                      onChange={(e) => setPaymentForm({ ...paymentForm, interestAmount: e.target.value })}
                      placeholder="0.00"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-100 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500 block mt-0.5">Finance Cost</span>
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">
                      Principal Repayment (£)
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.01"
                      value={paymentForm.principalAmount}
                      onChange={(e) => setPaymentForm({ ...paymentForm, principalAmount: e.target.value })}
                      placeholder="0.00"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-100 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500 block mt-0.5">Reduces Liability</span>
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1">
                      Lender Fees (£)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={paymentForm.feeAmount}
                      onChange={(e) => setPaymentForm({ ...paymentForm, feeAmount: e.target.value })}
                      placeholder="0.00"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-100 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-500 block mt-0.5">Operating Fee</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Paying Bank Account</label>
                <select
                  required
                  value={paymentForm.paymentAccountId}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentAccountId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer"
                >
                  <option value="">-- Select Bank Account --</option>
                  {accounts.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name} ({a.bankName}) · Bal: {formatGBP(a.currentBalance)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Reference / Direct Debit Narration</label>
                  <input
                    type="text"
                    value={paymentForm.paymentReference}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentReference: e.target.value })}
                    placeholder="DD-MORTGAGE"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="isConfirmed"
                    checked={paymentForm.isLenderConfirmed}
                    onChange={(e) => setPaymentForm({ ...paymentForm, isLenderConfirmed: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-950 border-slate-800 cursor-pointer"
                  />
                  <label htmlFor="isConfirmed" className="text-slate-300 cursor-pointer text-[11px]">
                    Confirmed from Lender Statement
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paymentSubmitting || Math.abs(splitDifference) > 0.05}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {paymentSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Post Mortgage Payment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reconcile Statement Balance */}
      {showReconcileModal && selectedMortgage && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-base font-bold text-white">Reconcile Lender Balance</h2>
                <p className="text-xs text-indigo-400 mt-0.5">
                  {selectedMortgage.lenderName} · Ref: {selectedMortgage.accountReference}
                </p>
              </div>
              <button
                onClick={() => setShowReconcileModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {reconcileError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {reconcileError}
              </div>
            )}

            <form onSubmit={handleReconcileSubmit} className="mt-4 space-y-3.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>Current Ledger Principal:</span>
                  <span className="font-bold text-slate-200">
                    {formatGBP(selectedMortgage.outstandingPrincipalBalance)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Last Confirmed Date:</span>
                  <span className="text-slate-300">
                    {formatUKDate(selectedMortgage.lastConfirmedDate)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Confirmed Balance on Statement (£)
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={reconcileForm.confirmedBalance}
                  onChange={(e) => setReconcileForm({ ...reconcileForm, confirmedBalance: e.target.value })}
                  placeholder="e.g. 175420.50"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-bold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Statement Date</label>
                <input
                  type="date"
                  required
                  value={reconcileForm.statementDate}
                  onChange={(e) => setReconcileForm({ ...reconcileForm, statementDate: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Reconciliation Notes</label>
                <textarea
                  rows="2"
                  value={reconcileForm.notes}
                  onChange={(e) => setReconcileForm({ ...reconcileForm, notes: e.target.value })}
                  placeholder="e.g. Verified against annual statement dated 31/12/2026."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowReconcileModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reconcileSubmitting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {reconcileSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Reconciliation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MortgagesPage;
