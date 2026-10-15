import React, { useState, useEffect } from 'react';
import {
  FileText,
  DollarSign,
  AlertTriangle,
  Clock,
  Plus,
  CreditCard,
  Building,
  CheckCircle2,
  AlertCircle,
  Calendar,
  X,
  RefreshCw,
  Search,
  ExternalLink,
  Copy,
  Check,
  ChevronRight,
  Filter,
  Download,
  ShieldCheck,
  Layers,
  Settings,
  HelpCircle,
  TrendingDown,
  ArrowDownRight,
  ArrowUpRight,
  FileSpreadsheet,
} from 'lucide-react';
import { formatGBP, formatUKDate } from '../utils/formatters.js';
import { propertyChargesAPI, accountsAPI } from '../services/api.js';
import { ModalPortal } from './ModalPortal.jsx';

export function PropertyChargesSection({ propertyId, propertyName, companyId, onRefreshParent }) {
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'SERVICE_CHARGE' | 'GROUND_RENT' | 'CONFIG' | 'PAYEE'
  const [loading, setLoading] = useState(true);
  const [ledgerData, setLedgerData] = useState({
    openingBalance: 0,
    entries: [],
    summary: {
      totalDemanded: 0,
      totalPaid: 0,
      currentOutstanding: 0,
      overdueAmount: 0,
      disputedAmount: 0,
      pendingCount: 0,
    },
  });
  const [configs, setConfigs] = useState([]);
  const [payees, setPayees] = useState([]);
  const [accounts, setAccounts] = useState([]);

  // Modals
  const [showDemandModal, setShowDemandModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedDemandForPayment, setSelectedDemandForPayment] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [copiedKey, setCopiedKey] = useState('');

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Demand Form State
  const [demandForm, setDemandForm] = useState({
    chargeType: 'SERVICE_CHARGE',
    payeeId: '',
    payeeName: '',
    demandReference: '',
    invoiceNumber: '',
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: '',
    periodStart: '',
    periodEnd: '',
    amountDemanded: '',
    notes: '',
    file: null,
  });

  // Payment Form State
  const [paymentForm, setPaymentForm] = useState({
    demandId: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    amountPaid: '',
    paymentMethod: 'BANK_TRANSFER',
    accountId: '',
    bankTransactionReference: '',
    notes: '',
    file: null,
  });

  // Config Form State
  const [editingConfigType, setEditingConfigType] = useState('SERVICE_CHARGE');
  const [configForm, setConfigForm] = useState({
    isEnabled: true,
    expectedAmount: '',
    paymentFrequency: 'HALF_YEARLY',
    normalDueDateTerms: '',
    nextExpectedDemandDate: '',
    payeeId: '',
    notes: '',
  });

  // Load Data
  const loadData = async (forceRefresh = false) => {
    if (!propertyId) return;
    setLoading(true);
    setFeedback({ type: '', message: '' });
    try {
      const [ledgerRes, configsRes, payeesRes, accountsRes] = await Promise.all([
        propertyChargesAPI.getPropertyLedger(propertyId, {
          chargeType: activeTab === 'SERVICE_CHARGE' || activeTab === 'GROUND_RENT' ? activeTab : 'ALL',
        }, { forceRefresh }),
        propertyChargesAPI.getPropertyConfigs(propertyId, { forceRefresh }),
        propertyChargesAPI.getPayees({ forceRefresh }),
        accountsAPI.getAll({ forceRefresh }).catch(() => ({ data: { accounts: [] } })),
      ]);

      if (ledgerRes?.success && ledgerRes.data) {
        setLedgerData(ledgerRes.data);
      }
      if (configsRes?.success && configsRes.data) {
        setConfigs(configsRes.data);
      }
      if (payeesRes?.success && payeesRes.data) {
        setPayees(payeesRes.data);
      }
      if (accountsRes?.data?.accounts) {
        setAccounts(accountsRes.data.accounts.filter((a) => a.isActive !== false));
      }
    } catch (err) {
      console.error('Failed to load property charges data:', err);
      setFeedback({ type: 'error', message: 'Failed to load charges ledger data: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [propertyId, activeTab]);

  const copyToClipboard = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2500);
  };

  // Open Demand Modal
  const handleOpenDemandModal = (chargeType = 'SERVICE_CHARGE') => {
    const defaultPayee = payees[0];
    setDemandForm({
      chargeType,
      payeeId: defaultPayee?._id || '',
      payeeName: defaultPayee?.payeeName || defaultPayee?.name || '',
      demandReference: `DEM-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      invoiceNumber: '',
      issueDate: new Date().toISOString().slice(0, 10),
      dueDate: '',
      periodStart: '',
      periodEnd: '',
      amountDemanded: '',
      notes: '',
      file: null,
    });
    setShowDemandModal(true);
  };

  // Submit Demand
  const handleCreateDemand = async (e) => {
    e.preventDefault();
    if (!demandForm.amountDemanded || Number(demandForm.amountDemanded) <= 0) {
      alert('Please enter a valid demand amount.');
      return;
    }
    if (!demandForm.dueDate) {
      alert('Please provide a payment due date.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('propertyId', propertyId);
      formData.append('chargeType', demandForm.chargeType);
      if (demandForm.payeeId) formData.append('payeeId', demandForm.payeeId);
      formData.append('payeeName', demandForm.payeeName || 'Managing Agent');
      formData.append('demandReference', demandForm.demandReference);
      formData.append('invoiceNumber', demandForm.invoiceNumber || '');
      formData.append('issueDate', demandForm.issueDate);
      formData.append('dueDate', demandForm.dueDate);
      if (demandForm.periodStart) formData.append('periodStart', demandForm.periodStart);
      if (demandForm.periodEnd) formData.append('periodEnd', demandForm.periodEnd);
      formData.append('amountDemanded', demandForm.amountDemanded);
      formData.append('notes', demandForm.notes || '');
      if (demandForm.file) formData.append('file', demandForm.file);

      const res = await propertyChargesAPI.createDemand(formData);
      if (res?.success) {
        setShowDemandModal(false);
        setFeedback({ type: 'success', message: 'Demand notice recorded successfully.' });
        loadData(true);
        if (onRefreshParent) onRefreshParent();
      } else {
        alert(res?.message || 'Failed to create demand notice');
      }
    } catch (err) {
      alert(err.message || 'Error recording demand');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Payment Modal
  const handleOpenPaymentModal = (demand = null) => {
    setSelectedDemandForPayment(demand);
    const primaryAccount = accounts.find((a) => a.accountType === 'BANK') || accounts[0];
    const outstanding = demand ? demand.outstandingBalance : '';

    setPaymentForm({
      demandId: demand?._id || '',
      paymentDate: new Date().toISOString().slice(0, 10),
      amountPaid: outstanding !== '' ? String(outstanding) : '',
      paymentMethod: 'BANK_TRANSFER',
      accountId: primaryAccount?._id || '',
      bankTransactionReference: demand ? `PAY-${demand.demandReference}` : '',
      notes: demand ? `Payment for ${demand.demandReference}` : '',
      file: null,
    });
    setShowPaymentModal(true);
  };

  // Submit Payment
  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!paymentForm.demandId) {
      alert('Please select a demand notice to pay.');
      return;
    }
    if (!paymentForm.amountPaid || Number(paymentForm.amountPaid) <= 0) {
      alert('Please enter a valid payment amount.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('demandId', paymentForm.demandId);
      formData.append('paymentDate', paymentForm.paymentDate);
      formData.append('amountPaid', paymentForm.amountPaid);
      formData.append('paymentMethod', paymentForm.paymentMethod);
      if (paymentForm.accountId) formData.append('accountId', paymentForm.accountId);
      formData.append('bankTransactionReference', paymentForm.bankTransactionReference || '');
      formData.append('notes', paymentForm.notes || '');
      if (paymentForm.file) formData.append('file', paymentForm.file);

      const res = await propertyChargesAPI.recordPayment(formData);
      if (res?.success) {
        setShowPaymentModal(false);
        setFeedback({
          type: 'success',
          message: `Payment of £${Number(paymentForm.amountPaid).toFixed(2)} recorded into financial ledger (Voucher: ${res.data?.voucher?.voucherNumber || 'Generated'}).`,
        });
        loadData(true);
        if (onRefreshParent) onRefreshParent();
      } else {
        alert(res?.message || 'Failed to record payment');
      }
    } catch (err) {
      alert(err.message || 'Error recording payment');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Config Modal
  const handleOpenConfigModal = (type = 'SERVICE_CHARGE') => {
    setEditingConfigType(type);
    const existing = configs.find((c) => c.chargeType === type);
    setConfigForm({
      isEnabled: existing ? existing.isEnabled : true,
      expectedAmount: existing?.expectedAmount ? String(existing.expectedAmount) : '',
      paymentFrequency: existing?.paymentFrequency || (type === 'SERVICE_CHARGE' ? 'HALF_YEARLY' : 'ANNUAL'),
      normalDueDateTerms: existing?.normalDueDateTerms || '',
      nextExpectedDemandDate: existing?.nextExpectedDemandDate ? new Date(existing.nextExpectedDemandDate).toISOString().slice(0, 10) : '',
      payeeId: existing?.payeeId?._id || existing?.payeeId || (payees[0]?._id || ''),
      notes: existing?.notes || '',
    });
    setShowConfigModal(true);
  };

  // Submit Config
  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await propertyChargesAPI.updatePropertyConfig(propertyId, editingConfigType, configForm);
      if (res?.success) {
        setShowConfigModal(false);
        setFeedback({ type: 'success', message: `${editingConfigType === 'SERVICE_CHARGE' ? 'Service Charge' : 'Ground Rent'} settings updated.` });
        loadData(true);
      } else {
        alert(res?.message || 'Failed to save configuration');
      }
    } catch (err) {
      alert(err.message || 'Error saving configuration');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter entries
  const filteredEntries = (ledgerData?.entries || []).filter((entry) => {
    if (statusFilter !== 'ALL') {
      if (entry.status !== statusFilter) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchRef = entry.reference?.toLowerCase().includes(q);
      const matchDesc = entry.description?.toLowerCase().includes(q);
      const matchPayee = entry.payeeOrAccount?.toLowerCase().includes(q);
      if (!matchRef && !matchDesc && !matchPayee) return false;
    }
    return true;
  });

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PAID':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Paid</span>;
      case 'PARTIALLY_PAID':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">Partially Paid</span>;
      case 'OVERDUE':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">Overdue</span>;
      case 'DISPUTED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">Disputed</span>;
      case 'RECEIVED':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">Received (Due)</span>;
      case 'DRAFT':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">Draft</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-600">{status}</span>;
    }
  };

  // Primary Payee (e.g. Zircon Holdings Limited)
  const primaryPayee = payees.find((p) => p.payeeName?.toLowerCase().includes('zircon') || p.name?.toLowerCase().includes('zircon')) || payees[0];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
      {/* 1. Header Banner */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300">
              <Building className="w-5 h-5" />
            </span>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Service Charges & Ground Rent Ledger
            </h2>
          </div>
          <p className="text-xs text-slate-300">
            Property-specific demands, payment reconciliation, advance notifications & audit history.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => handleOpenDemandModal('SERVICE_CHARGE')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Record Demand Notice
          </button>
          <button
            onClick={() => handleOpenPaymentModal(null)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow transition-colors"
          >
            <CreditCard className="w-3.5 h-3.5" />
            Record Payment
          </button>
          <button
            onClick={() => loadData(true)}
            className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
            title="Refresh Ledger"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Feedback Notification */}
      {feedback.message && (
        <div className={`px-4 py-2 text-xs flex items-center justify-between ${feedback.type === 'error' ? 'bg-rose-50 text-rose-700 border-b border-rose-200' : 'bg-emerald-50 text-emerald-700 border-b border-emerald-200'}`}>
          <div className="flex items-center gap-2">
            {feedback.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback({ type: '', message: '' })} className="text-slate-400 hover:text-slate-600">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 3. Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-slate-50/60 border-b border-slate-200">
        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5">Total Demanded</span>
          <div className="flex items-baseline justify-between">
            <span className="text-base sm:text-lg font-bold text-slate-900">
              {formatGBP(ledgerData.summary.totalDemanded || 0)}
            </span>
            <span className="text-xs text-slate-400">Total notices</span>
          </div>
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5">Total Paid</span>
          <div className="flex items-baseline justify-between">
            <span className="text-base sm:text-lg font-bold text-emerald-600">
              {formatGBP(ledgerData.summary.totalPaid || 0)}
            </span>
            <span className="text-xs text-emerald-500">Reconciled</span>
          </div>
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5">Current Balance Due</span>
          <div className="flex items-baseline justify-between">
            <span className={`text-base sm:text-lg font-bold ${(ledgerData.summary.currentOutstanding || 0) > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
              {formatGBP(ledgerData.summary.currentOutstanding || 0)}
            </span>
            {(ledgerData.summary.currentOutstanding || 0) > 0 ? (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">Pending</span>
            ) : (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">Clear</span>
            )}
          </div>
        </div>

        <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-0.5">Overdue Demands</span>
          <div className="flex items-baseline justify-between">
            <span className={`text-base sm:text-lg font-bold ${(ledgerData.summary.overdueAmount || 0) > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
              {formatGBP(ledgerData.summary.overdueAmount || 0)}
            </span>
            {(ledgerData.summary.overdueAmount || 0) > 0 ? (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 animate-pulse">Action Req.</span>
            ) : (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">None</span>
            )}
          </div>
        </div>
      </div>

      {/* 4. Tab Navigation Bar */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 bg-white overflow-x-auto">
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'ALL'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Combined Ledger
          </button>
          <button
            onClick={() => setActiveTab('SERVICE_CHARGE')}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'SERVICE_CHARGE'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Service Charges
          </button>
          <button
            onClick={() => setActiveTab('GROUND_RENT')}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'GROUND_RENT'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Ground Rent
          </button>
          <button
            onClick={() => setActiveTab('CONFIG')}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'CONFIG'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Charge Setup & Terms
          </button>
          <button
            onClick={() => setActiveTab('PAYEE')}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'PAYEE'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Payee & Bank Details
          </button>
        </div>

        {/* Quick Config Link */}
        <div className="hidden sm:flex items-center gap-2 py-1.5">
          <button
            onClick={() => handleOpenConfigModal('SERVICE_CHARGE')}
            className="text-[11px] font-semibold text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            Configure Charges
          </button>
        </div>
      </div>

      {/* 5. TAB VIEW: PAYEE & BANK DETAILS */}
      {activeTab === 'PAYEE' && (
        <div className="p-4 sm:p-5 space-y-4">
          <div className="max-w-2xl bg-indigo-50/40 rounded-xl border border-indigo-100 p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-lg bg-indigo-600 text-white">
                  <Building className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {primaryPayee?.payeeName || primaryPayee?.name || 'Zircon Holdings Limited'}
                  </h3>
                  <span className="text-[11px] text-indigo-700 font-semibold">
                    Managing Company / Freeholder Payee
                  </span>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                <ShieldCheck className="w-3 h-3" /> Verified Details
              </span>
            </div>

            <p className="text-xs text-slate-600 mt-2">
              Use these banking credentials when making manual bank transfers or setting up standing orders. All payments should reference the property address and demand reference.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Bank Name</span>
                <span className="text-xs font-bold text-slate-900">
                  {primaryPayee?.bankName || 'Royal Bank of Scotland'}
                </span>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Sort Code</span>
                  <span className="text-xs font-mono font-bold text-slate-900">
                    {primaryPayee?.sortCode || '16-00-63'}
                  </span>
                </div>
                <button
                  onClick={() => copyToClipboard(primaryPayee?.sortCode || '16-00-63', 'sortCode')}
                  className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                  title="Copy Sort Code"
                >
                  {copiedKey === 'sortCode' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Account Number</span>
                  <span className="text-xs font-mono font-bold text-slate-900">
                    {primaryPayee?.accountNumber || '10801788'}
                  </span>
                </div>
                <button
                  onClick={() => copyToClipboard(primaryPayee?.accountNumber || '10801788', 'accountNumber')}
                  className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                  title="Copy Account Number"
                >
                  {copiedKey === 'accountNumber' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Contact Telephone</span>
                <span className="text-xs font-semibold text-slate-900">
                  {primaryPayee?.telephone || '020 3355 5309'}
                </span>
              </div>

              <div className="bg-white p-2.5 rounded-lg border border-slate-200 sm:col-span-2 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Email Address</span>
                  <span className="text-xs font-semibold text-slate-900">
                    {primaryPayee?.email || 'waqas@ilmcapital.co.uk'}
                  </span>
                </div>
                <button
                  onClick={() => copyToClipboard(primaryPayee?.email || 'waqas@ilmcapital.co.uk', 'email')}
                  className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                  title="Copy Email"
                >
                  {copiedKey === 'email' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. TAB VIEW: CONFIGURATION & TERMS */}
      {activeTab === 'CONFIG' && (
        <div className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {['SERVICE_CHARGE', 'GROUND_RENT'].map((type) => {
              const cfg = configs.find((c) => c.chargeType === type);
              const label = type === 'SERVICE_CHARGE' ? 'Service Charge' : 'Ground Rent';
              return (
                <div key={type} className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{label}</h4>
                      <span className="text-[11px] text-slate-500">Property charge parameters</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cfg?.isEnabled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
                      {cfg?.isEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Expected Amount</span>
                      <span className="font-bold text-slate-800">{cfg?.expectedAmount ? formatGBP(cfg.expectedAmount) : 'Not specified'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Frequency</span>
                      <span className="font-bold text-slate-800 capitalize">{cfg?.paymentFrequency?.toLowerCase() || 'Half Yearly'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Payment Terms / Due Dates</span>
                      <span className="text-slate-700">{cfg?.normalDueDateTerms || 'Standard demand notice terms'}</span>
                    </div>
                    {cfg?.nextExpectedDemandDate && (
                      <div className="col-span-2">
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">Next Expected Notice</span>
                        <span className="font-semibold text-indigo-700">{formatUKDate(cfg.nextExpectedDemandDate)}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={() => handleOpenConfigModal(type)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                    >
                      <Settings className="w-3 h-3" />
                      Edit Terms
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 7. TAB VIEW: LEDGER TABLE (COMBINED, SERVICE CHARGE, GROUND RENT) */}
      {(activeTab === 'ALL' || activeTab === 'SERVICE_CHARGE' || activeTab === 'GROUND_RENT') && (
        <div>
          {/* Table Toolbar */}
          <div className="p-3 bg-slate-50/50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-56">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search reference or notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="py-1 px-2 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="RECEIVED">Pending Due</option>
                <option value="OVERDUE">Overdue Only</option>
                <option value="PARTIALLY_PAID">Partially Paid</option>
                <option value="PAID">Paid</option>
                <option value="DISPUTED">Disputed</option>
              </select>
            </div>

            <div className="text-[11px] text-slate-500">
              Showing {filteredEntries.length} transaction entries
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-600 font-semibold text-[11px]">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Reference / Description</th>
                  <th className="py-2.5 px-3">Payee / Account</th>
                  <th className="py-2.5 px-3 text-right">Demanded (Debit)</th>
                  <th className="py-2.5 px-3 text-right">Paid (Credit)</th>
                  <th className="py-2.5 px-3 text-right font-bold">Balance</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="py-8 text-center text-slate-400">
                      <FileText className="w-8 h-8 mx-auto mb-2 text-slate-300 opacity-60" />
                      <p className="text-xs font-semibold text-slate-600">No ledger transactions recorded yet</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Click "Record Demand Notice" to raise a service charge or ground rent bill.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((row) => {
                    const isDemand = row.entryType === 'DEMAND';
                    return (
                      <tr key={row._id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 whitespace-nowrap font-medium text-slate-800">
                          {formatUKDate(row.date)}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${row.chargeType === 'SERVICE_CHARGE' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'}`}>
                            {row.chargeType === 'SERVICE_CHARGE' ? 'Service Charge' : 'Ground Rent'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-900">{row.reference}</div>
                          {row.description && <div className="text-[11px] text-slate-500 truncate max-w-xs">{row.description}</div>}
                          {row.dueDate && isDemand && (
                            <div className="text-[10px] text-slate-400">Due: {formatUKDate(row.dueDate)}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                          {row.payeeOrAccount || '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-900">
                          {row.debitAmount > 0 ? formatGBP(row.debitAmount) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-emerald-600">
                          {row.creditAmount > 0 ? formatGBP(row.creditAmount) : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900 whitespace-nowrap">
                          {formatGBP(row.runningBalance)}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          {getStatusBadge(row.status)}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {row.documentUrl && (
                              <a
                                href={row.documentUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1 text-slate-400 hover:text-indigo-600 rounded transition-colors"
                                title="View Document Notice"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                            {isDemand && row.status !== 'PAID' && row.status !== 'CANCELLED' && (
                              <button
                                onClick={() => handleOpenPaymentModal(row.rawDemand || { _id: row.demandId || row._id, demandReference: row.reference, outstandingBalance: row.debitAmount - (row.creditAmount || 0) })}
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-colors"
                                title="Pay this demand"
                              >
                                <CreditCard className="w-3 h-3" />
                                Pay
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 1: RECORD DEMAND NOTICE
         ========================================================================= */}
      {showDemandModal && (
        <ModalPortal isOpen={showDemandModal} onClose={() => setShowDemandModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-3.5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold">Record Demand Notice / Invoice</h3>
              </div>
              <button
                onClick={() => setShowDemandModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDemand} className="p-5 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">Charge Type</label>
                  <select
                    value={demandForm.chargeType}
                    onChange={(e) => setDemandForm({ ...demandForm, chargeType: e.target.value })}
                    className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 bg-white"
                  >
                    <option value="SERVICE_CHARGE">Service Charge</option>
                    <option value="GROUND_RENT">Ground Rent</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">Payee / Managing Company</label>
                  <select
                    value={demandForm.payeeId}
                    onChange={(e) => {
                      const sel = payees.find((p) => p._id === e.target.value);
                      setDemandForm({
                        ...demandForm,
                        payeeId: e.target.value,
                        payeeName: sel ? (sel.payeeName || sel.name) : demandForm.payeeName,
                      });
                    }}
                    className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 bg-white"
                  >
                    {payees.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.payeeName || p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">Demand Reference *</label>
                  <input
                    type="text"
                    required
                    value={demandForm.demandReference}
                    onChange={(e) => setDemandForm({ ...demandForm, demandReference: e.target.value })}
                    placeholder="e.g. DEM-2026-001"
                    className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">Amount Demanded (£) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={demandForm.amountDemanded}
                    onChange={(e) => setDemandForm({ ...demandForm, amountDemanded: e.target.value })}
                    placeholder="0.00"
                    className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">Issue Date *</label>
                  <input
                    type="date"
                    required
                    value={demandForm.issueDate}
                    onChange={(e) => setDemandForm({ ...demandForm, issueDate: e.target.value })}
                    className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">Due Date *</label>
                  <input
                    type="date"
                    required
                    value={demandForm.dueDate}
                    onChange={(e) => setDemandForm({ ...demandForm, dueDate: e.target.value })}
                    className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">Period Start</label>
                  <input
                    type="date"
                    value={demandForm.periodStart}
                    onChange={(e) => setDemandForm({ ...demandForm, periodStart: e.target.value })}
                    className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">Period End</label>
                  <input
                    type="date"
                    value={demandForm.periodEnd}
                    onChange={(e) => setDemandForm({ ...demandForm, periodEnd: e.target.value })}
                    className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Demand Notice Document (PDF / Image)</label>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(e) => setDemandForm({ ...demandForm, file: e.target.files[0] })}
                  className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Notes / Terms</label>
                <textarea
                  rows="2"
                  value={demandForm.notes}
                  onChange={(e) => setDemandForm({ ...demandForm, notes: e.target.value })}
                  placeholder="Notes, breakdown, or payment instructions..."
                  className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500"
                ></textarea>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDemandModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-1.5 shadow"
                >
                  {submitting ? 'Recording...' : 'Save Demand Notice'}
                </button>
              </div>
            </form>
          </div>
        </ModalPortal>
      )}

      {/* =========================================================================
          MODAL 2: RECORD PAYMENT
         ========================================================================= */}
      {showPaymentModal && (
        <ModalPortal isOpen={showPaymentModal} onClose={() => setShowPaymentModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-3.5 bg-gradient-to-r from-emerald-900 to-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold">Record Service Charge / Ground Rent Payment</h3>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="p-5 space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Target Demand Notice *</label>
                <select
                  required
                  value={paymentForm.demandId}
                  onChange={(e) => {
                    const selRow = ledgerData.entries.find((r) => r.entryType === 'DEMAND' && (r._id === e.target.value || r.demandId === e.target.value));
                    setPaymentForm({
                      ...paymentForm,
                      demandId: e.target.value,
                      amountPaid: selRow ? String(selRow.debitAmount - (selRow.creditAmount || 0)) : paymentForm.amountPaid,
                    });
                  }}
                  className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-500 bg-white"
                >
                  <option value="">Select a demand notice...</option>
                  {ledgerData.entries
                    .filter((r) => r.entryType === 'DEMAND' && r.status !== 'PAID')
                    .map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.reference} ({d.chargeType === 'SERVICE_CHARGE' ? 'SC' : 'GR'}) — Due: {formatUKDate(d.dueDate)} — Demanded: {formatGBP(d.debitAmount)}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">Payment Date *</label>
                  <input
                    type="date"
                    required
                    value={paymentForm.paymentDate}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                    className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">Amount Paid (£) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={paymentForm.amountPaid}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amountPaid: e.target.value })}
                    placeholder="0.00"
                    className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-500 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">Payment Method</label>
                  <select
                    value={paymentForm.paymentMethod}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                    className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-500 bg-white"
                  >
                    <option value="BANK_TRANSFER">Bank Transfer (Faster Payments)</option>
                    <option value="DIRECT_DEBIT">Direct Debit</option>
                    <option value="CARD">Credit / Debit Card</option>
                    <option value="CASH">Cash Float</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">Source Account *</label>
                  <select
                    required
                    value={paymentForm.accountId}
                    onChange={(e) => setPaymentForm({ ...paymentForm, accountId: e.target.value })}
                    className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-500 bg-white"
                  >
                    <option value="">Select bank or cash account...</option>
                    {accounts.map((acc) => (
                      <option key={acc._id} value={acc._id}>
                        {acc.accountName || acc.name} ({acc.accountType}) — Bal: {formatGBP(acc.currentBalance || 0)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Bank Reference / Transaction ID</label>
                <input
                  type="text"
                  value={paymentForm.bankTransactionReference}
                  onChange={(e) => setPaymentForm({ ...paymentForm, bankTransactionReference: e.target.value })}
                  placeholder="e.g. TXN-8947291"
                  className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Proof of Payment Attachment (PDF / Receipt)</label>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(e) => setPaymentForm({ ...paymentForm, file: e.target.files[0] })}
                  className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1.5 shadow"
                >
                  {submitting ? 'Recording...' : 'Record Payment & Deduct Bank'}
                </button>
              </div>
            </form>
          </div>
        </ModalPortal>
      )}

      {/* =========================================================================
          MODAL 3: CHARGE CONFIGURATION
         ========================================================================= */}
      {showConfigModal && (
        <ModalPortal isOpen={showConfigModal} onClose={() => setShowConfigModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold">
                  Configure {editingConfigType === 'SERVICE_CHARGE' ? 'Service Charge' : 'Ground Rent'}
                </h3>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="p-5 space-y-3.5">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Enable Charge</span>
                  <span className="text-[10px] text-slate-500">Track demands and ledgers for this charge</span>
                </div>
                <input
                  type="checkbox"
                  checked={configForm.isEnabled}
                  onChange={(e) => setConfigForm({ ...configForm, isEnabled: e.target.checked })}
                  className="w-4 h-4 text-indigo-600 rounded"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">Expected Amount (£)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={configForm.expectedAmount}
                    onChange={(e) => setConfigForm({ ...configForm, expectedAmount: e.target.value })}
                    placeholder="e.g. 1500.00"
                    className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 font-semibold"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">Payment Frequency</label>
                  <select
                    value={configForm.paymentFrequency}
                    onChange={(e) => setConfigForm({ ...configForm, paymentFrequency: e.target.value })}
                    className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500 bg-white"
                  >
                    <option value="ANNUAL">Annual</option>
                    <option value="HALF_YEARLY">Half Yearly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="ONE_OFF">One-off / Ad hoc</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Normal Due Date Terms</label>
                <input
                  type="text"
                  value={configForm.normalDueDateTerms}
                  onChange={(e) => setConfigForm({ ...configForm, normalDueDateTerms: e.target.value })}
                  placeholder="e.g. Payable 1st January and 1st July"
                  className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">Next Expected Demand Notice Date</label>
                <input
                  type="date"
                  value={configForm.nextExpectedDemandDate}
                  onChange={(e) => setConfigForm({ ...configForm, nextExpectedDemandDate: e.target.value })}
                  className="w-full text-xs py-1.5 px-2.5 rounded-lg border border-slate-300 focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors flex items-center gap-1.5 shadow"
                >
                  {submitting ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}

export default PropertyChargesSection;
