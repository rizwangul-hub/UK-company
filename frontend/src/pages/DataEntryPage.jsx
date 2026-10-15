import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Receipt,
  FileText,
  ArrowLeftRight,
  TrendingUp,
  Landmark,
  Clock,
  Building2,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Wallet,
  Sparkles,
  Plus,
  Zap,
  Flame,
  Tag,
  Upload,
  ExternalLink,
  Paperclip,
  X,
} from 'lucide-react';
import {
  accountsAPI,
  propertiesAPI,
  ledgerAPI,
  rentAPI,
  mortgagesAPI,
  getApiCache,
} from '../services/api.js';
import { formatGBP, formatUKDate } from '../utils/formatters.js';
import pixxLogo from '../assets/logo.png';
import { ModalPortal } from '../components/ModalPortal.jsx';

// Reusable Receipt / Document Attachment Field
function ReceiptUploadField({ file, setFile, label = "Upload Receipt / Document (Optional)", colorScheme = "indigo" }) {
  const fileInputRef = React.useRef(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const ringColor = {
    indigo: 'border-indigo-500/40 text-indigo-300 bg-indigo-950/30',
    emerald: 'border-emerald-500/40 text-emerald-300 bg-emerald-950/30',
    rose: 'border-rose-500/40 text-rose-300 bg-rose-950/30',
    sky: 'border-sky-500/40 text-sky-300 bg-sky-950/30',
    amber: 'border-amber-500/40 text-amber-300 bg-amber-950/30',
  }[colorScheme] || 'border-indigo-500/40 text-indigo-300 bg-indigo-950/30';

  const inputId = `file-upload-${label.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;

  return (
    <div className="lg:col-span-3 bg-slate-950/60 border border-slate-800 rounded-xl p-3">
      <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <Paperclip className="w-3.5 h-3.5 text-indigo-400" />
          {label}
        </span>
        <span className="text-[10px] text-slate-500 font-normal">PDF, JPG, PNG &bull; Max 10MB</span>
      </label>
      {file ? (
        <div className={`flex items-center justify-between p-2.5 rounded-lg border text-xs ${ringColor}`}>
          <div className="flex items-center gap-2 truncate">
            <FileText className="w-4 h-4 shrink-0" />
            <span className="font-semibold text-slate-200 truncate">{file.name}</span>
            <span className="text-slate-400 text-[10px] shrink-0 font-mono">
              ({(file.size / 1024).toFixed(1)} KB)
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setFile(null);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
            className="p-1 rounded-md hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition ml-2 cursor-pointer"
            title="Remove file"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".pdf,image/png,image/jpeg,image/webp,image/jpg"
            className="hidden"
            id={inputId}
          />
          <label
            htmlFor={inputId}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold cursor-pointer transition shadow-xs"
          >
            <Upload className="w-3.5 h-3.5 text-indigo-400" />
            <span>Choose Receipt / Attachment...</span>
          </label>
          <span className="text-[11px] text-slate-500 italic">No receipt attached</span>
        </div>
      )}
    </div>
  );
}

export function DataEntryPage({ selectedCompany }) {
  const [activeTab, setActiveTab] = useState('recent'); // 'rent' | 'expense' | 'transfer' | 'other' | 'mortgage' | 'recent'
  const [showRentModal, setShowRentModal] = useState(false);
  const [showMortgageModal, setShowMortgageModal] = useState(false);

  const cachedAccs = getApiCache('/accounts');
  const cachedProps = getApiCache('/properties');
  const cachedCats = getApiCache('/ledger/categories');

  // Master Data
  const [accounts, setAccounts] = useState(cachedAccs?.data?.accounts || []);
  const [properties, setProperties] = useState(cachedProps?.data?.properties || []);
  const [categories, setCategories] = useState(cachedCats?.data?.categories || []);
  const [mortgages, setMortgages] = useState([]);
  const [rentSchedules, setRentSchedules] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);

  const [loading, setLoading] = useState(!cachedAccs?.data?.accounts?.length);
  const [submitting, setSubmitting] = useState(false);
  const [generatingSchedules, setGeneratingSchedules] = useState(false);
  const [feedback, setFeedback] = useState({ text: '', type: '' });
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Rent Collection Form State
  const [rentForm, setRentForm] = useState({
    scheduleId: '',
    propertyId: '',
    billingMonth: new Date().toISOString().slice(0, 7),
    amount: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    receivingAccountId: '',
    paymentMethod: 'STANDING_ORDER',
    notes: '',
  });

  // 2. Expense Voucher Form State
  const [expenseForm, setExpenseForm] = useState({
    transactionDate: new Date().toISOString().slice(0, 10),
    accountId: '',
    categoryId: '',
    amount: '',
    propertyId: '',
    unitId: '',
    narration: '',
    reference: '',
  });

  // 3. Internal Transfer Form State
  const [transferForm, setTransferForm] = useState({
    fromAccountId: '',
    toAccountId: '',
    amount: '',
    transferDate: new Date().toISOString().slice(0, 10),
    reference: '',
    narration: '',
  });

  // 4. Other Income Form State
  const [otherIncomeForm, setOtherIncomeForm] = useState({
    transactionDate: new Date().toISOString().slice(0, 10),
    accountId: '',
    categoryId: '',
    amount: '',
    propertyId: '',
    unitId: '',
    receivedFrom: '',
    narration: '',
    reference: '',
  });

  // 5. Mortgage Payment Form State
  const [mortgageForm, setMortgageForm] = useState({
    mortgageId: '',
    paymentDate: new Date().toISOString().slice(0, 10),
    paymentAccountId: '',
    totalAmountPaid: '',
    interestAmount: '',
    principalAmount: '',
    feeAmount: '0',
    paymentReference: '',
    notes: '',
  });

  // Receipt File Attachment States for Forms
  const [rentFile, setRentFile] = useState(null);
  const [expenseFile, setExpenseFile] = useState(null);
  const [transferFile, setTransferFile] = useState(null);
  const [otherIncomeFile, setOtherIncomeFile] = useState(null);
  const [mortgageFile, setMortgageFile] = useState(null);

  // Quick Attach Receipt Modal (from Recent Journal)
  const [attachModalTx, setAttachModalTx] = useState(null);
  const [attachModalFile, setAttachModalFile] = useState(null);
  const [attachModalUploading, setAttachModalUploading] = useState(false);
  const [attachModalError, setAttachModalError] = useState('');

  // Helper to upload receipt file if selected
  const uploadReceiptIfPresent = async (file) => {
    if (!file) return { receiptUrl: '', receiptFilename: '' };
    const formData = new FormData();
    formData.append('file', file);
    const res = await ledgerAPI.uploadReceipt(formData);
    return {
      receiptUrl: res?.data?.url || '',
      receiptFilename: res?.data?.filename || file.name,
    };
  };

  // Load All System Master Data
  const loadData = useCallback(async (force = false) => {
    try {
      if ((!accounts.length && !cachedAccs?.data?.accounts?.length) || force) {
        setLoading(true);
      }
      const companyId = selectedCompany?.slug || selectedCompany?.id || localStorage.getItem('selected_company');
      const params = companyId && companyId !== 'all' ? { companyId } : {};

      const [accRes, propRes, catRes, mtgRes, rentRes, txRes] = await Promise.all([
        accountsAPI.getAll(params).catch(() => ({ data: { accounts: [] } })),
        propertiesAPI.getAll(params).catch(() => ({ data: { properties: [] } })),
        ledgerAPI.getCategories().catch(() => ({ data: { categories: [] } })),
        mortgagesAPI.getAll({ ...params, status: 'ACTIVE' }).catch(() => ({ data: { mortgages: [] } })),
        rentAPI.getSchedules({ ...params, status: 'PENDING,PARTIAL,OVERDUE', minMonth: '2026-10' }).catch(() => ({ data: { schedules: [] } })),
        ledgerAPI.getTransactions({ ...params, limit: 50 }).catch(() => ({ data: { transactions: [] } })),
      ]);

      const accList = accRes?.data?.accounts || accRes?.accounts || [];
      const propList = propRes?.data?.properties || propRes?.properties || [];
      const catList = catRes?.data?.categories || catRes?.categories || [];
      const mtgList = mtgRes?.data?.mortgages || mtgRes?.mortgages || [];
      const schedulesList = rentRes?.data?.schedules || rentRes?.schedules || [];
      const txList = txRes?.data?.transactions || txRes?.transactions || [];

      setAccounts(accList);
      setProperties(propList);
      setCategories(catList);
      setMortgages(mtgList);
      setRentSchedules(schedulesList);
      setRecentTransactions(txList);

      // Pre-select default account if available
      const defaultBank = accList.find((a) => a.accountType === 'BANK')?._id || accList[0]?._id;
      if (defaultBank) {
        setRentForm((prev) => ({ ...prev, receivingAccountId: prev.receivingAccountId || defaultBank }));
        setExpenseForm((prev) => ({ ...prev, accountId: prev.accountId || defaultBank }));
        setOtherIncomeForm((prev) => ({ ...prev, accountId: prev.accountId || defaultBank }));
        setMortgageForm((prev) => ({ ...prev, paymentAccountId: prev.paymentAccountId || defaultBank }));
      }
    } catch (err) {
      console.error('Failed to load data entry master data:', err);
      setFeedback({ text: 'Error loading reference records: ' + err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [selectedCompany]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Unique single properties list for rent collection (no duplicate month rows)
  const uniqueProperties = useMemo(() => {
    const map = new Map();

    // 1. Add from properties master list
    (properties || []).forEach((p) => {
      if (p._id) {
        map.set(String(p._id), {
          _id: String(p._id),
          name: p.name || p.addressLine1 || p.address?.line1 || 'Property',
          tenantName: p.tenantName || '',
          contractualRent: p.contractualRent || 0,
          postcode: p.postcode || '',
        });
      }
    });

    // 2. Add from rentSchedules if any property is not yet in properties list
    (rentSchedules || []).forEach((s) => {
      const p = s.propertyId;
      if (p && p._id && !map.has(String(p._id))) {
        map.set(String(p._id), {
          _id: String(p._id),
          name: p.name || p.addressLine1 || 'Property',
          tenantName: s.tenantId?.fullName || p.tenantName || '',
          contractualRent: p.contractualRent || s.expectedAmount || 0,
          postcode: p.postcode || '',
        });
      }
    });

    // Sort alphabetically by property name
    return Array.from(map.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [properties, rentSchedules]);

  // Handle Single Property Selection for Rent Collection
  const handlePropertySelect = (e) => {
    const pId = e.target.value;
    if (!pId) {
      setRentForm((prev) => ({
        ...prev,
        propertyId: '',
        scheduleId: '',
        amount: '',
        notes: '',
      }));
      return;
    }

    const prop = uniqueProperties.find((p) => p._id === pId) || properties.find((p) => p._id === pId);
    const propName = prop?.name || 'Property';
    const tenantName = prop?.tenantName || '';

    // Check if there is an active invoice schedule for this property and current billingMonth
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthToUse = rentForm.billingMonth || currentMonth;
    const matchingSchedule = rentSchedules.find(
      (s) => String(s.propertyId?._id || s.propertyId) === String(pId) && s.billingMonth === monthToUse
    );

    const amountToUse = matchingSchedule
      ? (matchingSchedule.outstandingAmount || matchingSchedule.expectedAmount)
      : (prop?.contractualRent || '');

    setRentForm((prev) => ({
      ...prev,
      propertyId: pId,
      billingMonth: monthToUse,
      scheduleId: matchingSchedule ? matchingSchedule._id : '',
      amount: amountToUse ? String(amountToUse) : '',
      notes: `Rent for ${propName}${tenantName ? ` (Tenant: ${tenantName})` : ''} - Month: ${monthToUse}`,
    }));
  };

  // Handle Rent Billing Month Change
  const handleBillingMonthChange = (e) => {
    const newMonth = e.target.value;
    setRentForm((prev) => {
      let scheduleIdToUse = '';
      let amountToUse = prev.amount;
      let notesToUse = prev.notes;

      if (prev.propertyId) {
        const prop = uniqueProperties.find((p) => p._id === prev.propertyId) || properties.find((p) => p._id === prev.propertyId);
        // Find if this property has a schedule for the newly selected month
        const matchingSchedule = rentSchedules.find(
          (s) => String(s.propertyId?._id || s.propertyId) === String(prev.propertyId) && s.billingMonth === newMonth
        );

        if (matchingSchedule) {
          scheduleIdToUse = matchingSchedule._id;
          amountToUse = String(matchingSchedule.outstandingAmount || matchingSchedule.expectedAmount || '');
        } else if (prop) {
          amountToUse = prop.contractualRent ? String(prop.contractualRent) : prev.amount;
        }

        if (prop) {
          notesToUse = `Rent for ${prop.name}${prop.tenantName ? ` (Tenant: ${prop.tenantName})` : ''} - Month: ${newMonth}`;
        }
      }

      return {
        ...prev,
        billingMonth: newMonth,
        scheduleId: scheduleIdToUse,
        amount: amountToUse,
        notes: notesToUse,
      };
    });
  };

  // Quick generate monthly invoices for selected billing month
  const handleQuickGenerateSchedules = async () => {
    if (!rentForm.billingMonth) return;
    try {
      setGeneratingSchedules(true);
      const res = await rentAPI.generateMonthlySchedules(rentForm.billingMonth);
      setFeedback({
        text: res?.message || `Generated monthly invoices for ${rentForm.billingMonth}.`,
        type: 'success',
      });
      await loadData();
    } catch (err) {
      setFeedback({
        text: err.response?.data?.message || err.message || 'Failed to generate monthly invoices.',
        type: 'error',
      });
    } finally {
      setGeneratingSchedules(false);
    }
  };

  // Handle attaching a receipt to an existing transaction from the Recent Journal
  const handleAttachReceiptSubmit = async () => {
    if (!attachModalTx || !attachModalFile) return;
    try {
      setAttachModalUploading(true);
      setAttachModalError('');
      const formData = new FormData();
      formData.append('file', attachModalFile);
      const res = await ledgerAPI.attachReceipt(attachModalTx._id, formData);
      if (res?.success) {
        setFeedback({
          text: `Receipt successfully attached to Voucher ${attachModalTx.voucherNo}.`,
          type: 'success',
        });
        setAttachModalTx(null);
        setAttachModalFile(null);
        await loadData();
      }
    } catch (err) {
      setAttachModalError(err.response?.data?.message || err.message || 'Failed to attach receipt.');
    } finally {
      setAttachModalUploading(false);
    }
  };

  const handleRemoveReceipt = async (txId, voucherNo) => {
    if (!window.confirm(`Are you sure you want to remove the receipt attachment for Voucher ${voucherNo}?`)) return;
    try {
      await ledgerAPI.removeReceipt(txId);
      setFeedback({ text: `Receipt attachment removed for Voucher ${voucherNo}.`, type: 'success' });
      await loadData();
    } catch (err) {
      setFeedback({ text: err.response?.data?.message || err.message || 'Failed to remove receipt.', type: 'error' });
    }
  };

  // Submit 1: Rent Payment Receipt
  const handleRentSubmit = async (e) => {
    e.preventDefault();
    if ((!rentForm.scheduleId && !rentForm.propertyId) || !rentForm.amount || !rentForm.receivingAccountId) {
      setFeedback({ text: 'Please select a tenant schedule or property, amount, and receiving bank account.', type: 'error' });
      return;
    }
    if (!rentForm.billingMonth) {
      setFeedback({ text: 'Please select the rent month (billing period).', type: 'error' });
      return;
    }
    try {
      setSubmitting(true);
      setFeedback({ text: '', type: '' });
      let uploadedDoc = { receiptUrl: '', receiptFilename: '' };
      if (rentFile) {
        uploadedDoc = await uploadReceiptIfPresent(rentFile);
      }
      const res = await rentAPI.recordPayment({
        scheduleId: rentForm.scheduleId || undefined,
        propertyId: rentForm.propertyId || undefined,
        billingMonth: rentForm.billingMonth,
        amount: Number(rentForm.amount),
        paymentDate: rentForm.paymentDate,
        receivingAccountId: rentForm.receivingAccountId,
        paymentMethod: rentForm.paymentMethod,
        notes: rentForm.notes,
        receiptUrl: uploadedDoc.receiptUrl || undefined,
        receiptFilename: uploadedDoc.receiptFilename || undefined,
      });

      if (res?.success) {
        setFeedback({
          text: `Rent receipt of ${formatGBP(Number(rentForm.amount))} for ${rentForm.billingMonth} successfully posted into bank account.`,
          type: 'success',
        });
        setRentFile(null);
        setRentForm((prev) => ({
          ...prev,
          scheduleId: '',
          propertyId: '',
          amount: '',
          notes: '',
        }));
        setShowRentModal(false);
        setActiveTab('recent');
        await loadData();
      }
    } catch (err) {
      setFeedback({ text: err.response?.data?.message || err.message || 'Failed to record rent payment.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // Submit 2: Expense Voucher
  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    if (!expenseForm.accountId || !expenseForm.categoryId || !expenseForm.amount || !expenseForm.narration) {
      setFeedback({ text: 'Bank account, expense category, amount, and narration are required.', type: 'error' });
      return;
    }
    try {
      setSubmitting(true);
      setFeedback({ text: '', type: '' });
      let uploadedDoc = { receiptUrl: '', receiptFilename: '' };
      if (expenseFile) {
        uploadedDoc = await uploadReceiptIfPresent(expenseFile);
      }
      const res = await ledgerAPI.recordExpense({
        transactionDate: expenseForm.transactionDate,
        accountId: expenseForm.accountId,
        categoryId: expenseForm.categoryId,
        amount: Number(expenseForm.amount),
        propertyId: expenseForm.propertyId || null,
        unitId: null,
        narration: expenseForm.narration,
        reference: expenseForm.reference,
        periodMonth: expenseForm.transactionDate.slice(0, 7),
        receiptUrl: uploadedDoc.receiptUrl || undefined,
        receiptFilename: uploadedDoc.receiptFilename || undefined,
      });

      if (res?.success) {
        setFeedback({
          text: `Expense voucher of ${formatGBP(Number(expenseForm.amount))} recorded and deducted from bank balance.`,
          type: 'success',
        });
        setExpenseFile(null);
        setExpenseForm((prev) => ({
          ...prev,
          amount: '',
          narration: '',
          reference: '',
        }));
        await loadData();
      }
    } catch (err) {
      setFeedback({ text: err.response?.data?.message || err.message || 'Failed to record expense voucher.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // Submit 3: Internal Transfer
  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (!transferForm.fromAccountId || !transferForm.toAccountId || !transferForm.amount) {
      setFeedback({ text: 'Source account, destination account, and transfer amount are required.', type: 'error' });
      return;
    }
    if (transferForm.fromAccountId === transferForm.toAccountId) {
      setFeedback({ text: 'Source and destination accounts must be different.', type: 'error' });
      return;
    }
    try {
      setSubmitting(true);
      setFeedback({ text: '', type: '' });
      let uploadedDoc = { receiptUrl: '', receiptFilename: '' };
      if (transferFile) {
        uploadedDoc = await uploadReceiptIfPresent(transferFile);
      }
      const res = await accountsAPI.transfer({
        fromAccountId: transferForm.fromAccountId,
        toAccountId: transferForm.toAccountId,
        amount: Number(transferForm.amount),
        transferDate: transferForm.transferDate,
        reference: transferForm.reference,
        narration: transferForm.narration,
        receiptUrl: uploadedDoc.receiptUrl || undefined,
        receiptFilename: uploadedDoc.receiptFilename || undefined,
      });

      if (res?.success) {
        setFeedback({
          text: `Internal transfer of ${formatGBP(Number(transferForm.amount))} executed successfully between accounts.`,
          type: 'success',
        });
        setTransferFile(null);
        setTransferForm((prev) => ({
          ...prev,
          amount: '',
          reference: '',
          narration: '',
        }));
        await loadData();
      }
    } catch (err) {
      setFeedback({ text: err.response?.data?.message || err.message || 'Failed to execute internal transfer.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // Submit 4: Other Income
  const handleOtherIncomeSubmit = async (e) => {
    e.preventDefault();
    if (!otherIncomeForm.accountId || !otherIncomeForm.categoryId || !otherIncomeForm.amount || !otherIncomeForm.narration) {
      setFeedback({ text: 'Receiving account, income category head, amount, and description are required.', type: 'error' });
      return;
    }
    try {
      setSubmitting(true);
      setFeedback({ text: '', type: '' });
      let uploadedDoc = { receiptUrl: '', receiptFilename: '' };
      if (otherIncomeFile) {
        uploadedDoc = await uploadReceiptIfPresent(otherIncomeFile);
      }
      const res = await ledgerAPI.recordIncome({
        transactionDate: otherIncomeForm.transactionDate,
        accountId: otherIncomeForm.accountId,
        categoryId: otherIncomeForm.categoryId,
        amount: Number(otherIncomeForm.amount),
        propertyId: null,
        unitId: null,
        narration: otherIncomeForm.receivedFrom
          ? `${otherIncomeForm.narration} (Received from: ${otherIncomeForm.receivedFrom})`
          : otherIncomeForm.narration,
        reference: otherIncomeForm.reference,
        periodMonth: otherIncomeForm.transactionDate.slice(0, 7),
        receiptUrl: uploadedDoc.receiptUrl || undefined,
        receiptFilename: uploadedDoc.receiptFilename || undefined,
      });

      if (res?.success) {
        setFeedback({
          text: `Income receipt of ${formatGBP(Number(otherIncomeForm.amount))} successfully recorded into bank balance.`,
          type: 'success',
        });
        setOtherIncomeFile(null);
        setOtherIncomeForm((prev) => ({
          ...prev,
          amount: '',
          receivedFrom: '',
          narration: '',
          reference: '',
        }));
        await loadData();
      }
    } catch (err) {
      setFeedback({ text: err.response?.data?.message || err.message || 'Failed to record other income.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // Submit 5: Mortgage Payment
  const handleMortgageSubmit = async (e) => {
    e.preventDefault();
    const total = Number(mortgageForm.totalAmountPaid);
    const interest = Number(mortgageForm.interestAmount);
    const principal = Number(mortgageForm.principalAmount);
    const fee = Number(mortgageForm.feeAmount || 0);

    if (!mortgageForm.mortgageId || !mortgageForm.paymentAccountId || total <= 0) {
      setFeedback({ text: 'Select mortgage facility, paying bank account, and enter payment amount.', type: 'error' });
      return;
    }

    if (Math.abs(interest + principal + fee - total) > 0.05) {
      setFeedback({
        text: `Split mismatch: Interest (£${interest.toFixed(2)}) + Principal (£${principal.toFixed(2)}) + Fee (£${fee.toFixed(2)}) must equal Total Paid (£${total.toFixed(2)}).`,
        type: 'error',
      });
      return;
    }

    try {
      setSubmitting(true);
      setFeedback({ text: '', type: '' });
      let uploadedDoc = { receiptUrl: '', receiptFilename: '' };
      if (mortgageFile) {
        uploadedDoc = await uploadReceiptIfPresent(mortgageFile);
      }
      const res = await mortgagesAPI.recordPayment(mortgageForm.mortgageId, {
        paymentDate: mortgageForm.paymentDate,
        totalAmountPaid: total,
        interestAmount: interest,
        principalAmount: principal,
        feeAmount: fee,
        paymentAccountId: mortgageForm.paymentAccountId,
        paymentReference: mortgageForm.paymentReference,
        notes: mortgageForm.notes,
        receiptUrl: uploadedDoc.receiptUrl || undefined,
        receiptFilename: uploadedDoc.receiptFilename || undefined,
      });

      if (res?.success) {
        setFeedback({
          text: `Mortgage payment of ${formatGBP(total)} posted. Principal debt reduced by ${formatGBP(principal)}.`,
          type: 'success',
        });
        setMortgageFile(null);
        setMortgageForm((prev) => ({
          ...prev,
          totalAmountPaid: '',
          interestAmount: '',
          principalAmount: '',
          feeAmount: '0',
          paymentReference: '',
          notes: '',
        }));
        setShowMortgageModal(false);
        setActiveTab('recent');
        await loadData();
      }
    } catch (err) {
      setFeedback({ text: err.response?.data?.message || err.message || 'Failed to record mortgage payment.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  // Filter Categories & Scope
  const expenseCategories = categories.filter((c) => c.type === 'OPERATING_EXPENSE' || c.type === 'EXPENSE');
  const incomeCategories = categories.filter((c) => c.type === 'INCOME');
  const generalExpenseCategories = expenseCategories.filter((c) => !c.propertyId);

  // Filter Units for Selected Property
  const selectedPropObj = properties.find((p) => p._id === expenseForm.propertyId);
  const selectedPropHeads = expenseCategories.filter(
    (c) => (c.propertyId?._id || c.propertyId)?.toString() === expenseForm.propertyId
  );
  const unitsForExpense = selectedPropObj?.units || [];

  // Quick Add Sub-Head on the fly
  const [showQuickAddCat, setShowQuickAddCat] = useState(false);
  const [quickCatName, setQuickCatName] = useState('');
  const [savingQuickCat, setSavingQuickCat] = useState(false);

  const handleQuickAddCategory = async (e) => {
    e.preventDefault();
    const name = quickCatName.trim();
    if (!name) return;
    try {
      setSavingQuickCat(true);
      const res = await ledgerAPI.createCategory({
        name,
        type: 'OPERATING_EXPENSE',
        propertyId: expenseForm.propertyId || null,
        unitId: expenseForm.unitId || null,
        isAllowableTaxDeduction: true,
        description: `Created from Data Entry Desk${expenseForm.propertyId ? ` for ${selectedPropObj?.name || 'Property'}` : ''}`,
      });
      const created = res.data?.category || res.category;
      setQuickCatName('');
      setShowQuickAddCat(false);
      setFeedback({
        text: `Expense head "${name}" successfully added${expenseForm.propertyId ? ` to ${selectedPropObj?.name || 'Property'}` : ' to Portfolio'} and selected!`,
        type: 'success',
      });
      await loadData();
      if (created?._id) {
        setExpenseForm((prev) => ({ ...prev, categoryId: created._id }));
      }
    } catch (err) {
      setFeedback({ text: err.response?.data?.message || err.message || 'Failed to create category.', type: 'error' });
    } finally {
      setSavingQuickCat(false);
    }
  };

  const handleExpenseCategorySelect = (e) => {
    const catId = e.target.value;
    const catObj = expenseCategories.find((c) => c._id === catId);
    if (catObj?.propertyId) {
      const pId = (catObj.propertyId._id || catObj.propertyId)?.toString();
      if (pId && pId !== expenseForm.propertyId) {
        setExpenseForm((prev) => ({
          ...prev,
          categoryId: catId,
          propertyId: pId,
          unitId: catObj.unitId?._id || catObj.unitId || prev.unitId || '',
        }));
        return;
      }
    }
    setExpenseForm((prev) => ({ ...prev, categoryId: catId }));
  };

  const otherIncomePropObj = properties.find((p) => p._id === otherIncomeForm.propertyId);
  const unitsForOtherIncome = otherIncomePropObj?.units || [];

  // Selected property & tenant helpers for Rent Collection
  const selectedRentProp =
    properties.find((p) => p._id === rentForm.propertyId) ||
    rentSchedules.find((s) => (s.propertyId?._id || s.propertyId) === rentForm.propertyId)?.propertyId;
  const selectedRentSchedule = rentSchedules.find((s) => s._id === rentForm.scheduleId);
  const currentRentPropertyName =
    selectedRentProp?.name ||
    selectedRentSchedule?.propertyId?.name ||
    selectedRentSchedule?.propertyId?.addressLine1 ||
    '';
  const currentRentTenantName =
    selectedRentSchedule?.tenantId?.fullName ||
    selectedRentProp?.tenantName ||
    (selectedRentSchedule?.notes && !selectedRentSchedule.notes.startsWith('Invoice') ? selectedRentSchedule.notes : '') ||
    '';

  // Get all past overdue unpaid schedules for selected property (strictly from October 2026 onwards and strictly before current month)
  const unpaidSchedulesForSelectedProp = useMemo(() => {
    if (!rentForm.propertyId) return [];
    const currentMonth = new Date().toISOString().slice(0, 7);
    return rentSchedules
      .filter((s) => {
        const matchesProp = String(s.propertyId?._id || s.propertyId) === String(rentForm.propertyId);
        const isUnpaid = s.status !== 'PAID';
        const isFromBaseline = (s.billingMonth || '') >= '2026-10';
        const isPastMonth = (s.billingMonth || '') < currentMonth;
        return matchesProp && isUnpaid && isFromBaseline && isPastMonth;
      })
      .sort((a, b) => (a.billingMonth || '').localeCompare(b.billingMonth || ''));
  }, [rentForm.propertyId, rentSchedules]);

  // Filter recent transactions
  const filteredRecent = recentTransactions.filter((tx) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      tx.narration?.toLowerCase().includes(term) ||
      tx.voucherNo?.toLowerCase().includes(term) ||
      tx.reference?.toLowerCase().includes(term) ||
      tx.propertyId?.name?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl dashboard-header-banner">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-slate-900/90 border border-slate-700/60 flex items-center justify-center p-1.5 shadow-sm shrink-0 overflow-hidden">
            <img src={selectedCompany?.logo || pixxLogo} alt={selectedCompany?.name || "Company Logo"} className="h-full w-full object-contain" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[11px] font-black uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                Operational Workspace
              </span>
              {selectedCompany && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {selectedCompany.name} ({selectedCompany.legalName})
                </span>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Data Entry Desk
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-3xl">
              Fast daily transaction entry for Rent Collection, Expense Vouchers, Transfers, Other Receipts, and Mortgages for {selectedCompany?.name || 'the active portfolio'}.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-bold transition cursor-pointer shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Ledger</span>
          </button>
        </div>
      </div>

      {/* Live Bank Accounts Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        {accounts.length === 0 ? (
          <div className="col-span-full p-4 rounded-2xl bg-slate-900/60 border border-dashed border-slate-800 text-center text-xs text-slate-400">
            No bank or cash accounts configured for <strong className="text-slate-300">{selectedCompany?.name || 'this company'}</strong>. Create accounts in the Accounts tab to record transactions.
          </div>
        ) : (
          accounts.map((acc) => (
            <div
              key={acc._id}
              className="executive-card p-3.5 sm:p-4 rounded-2xl flex flex-col justify-between"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider truncate">
                  {acc.name}
                </span>
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 shrink-0">
                  <CreditCard className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="font-display text-base sm:text-lg font-extrabold text-white mt-2 tabular-nums">
                {formatGBP(acc.currentBalance)}
              </div>
              <div className="text-[10px] text-slate-400 mt-1 capitalize">
                {acc.accountType} &bull; {acc.bankName || 'UK Cash'}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Action Feedback Alert */}
      {feedback.text && (
        <div
          className={`p-4 rounded-2xl text-xs sm:text-sm font-semibold flex items-center justify-between border shadow-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
              : 'bg-rose-950/30 border-rose-800/50 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            onClick={() => setFeedback({ text: '', type: '' })}
            className="text-xs opacity-70 hover:opacity-100 ml-4 cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {/* Primary Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800">
        <button
          onClick={() => { setActiveTab('rent'); setShowRentModal(true); setFeedback({ text: '', type: '' }); }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'rent'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>1. Collect Rent</span>
        </button>

        <button
          onClick={() => { setActiveTab('expense'); setFeedback({ text: '', type: '' }); }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'expense'
              ? 'bg-rose-600 text-white shadow-md'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>2. Record Expense</span>
        </button>

        <button
          onClick={() => { setActiveTab('transfer'); setFeedback({ text: '', type: '' }); }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'transfer'
              ? 'bg-sky-600 text-white shadow-md'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <ArrowLeftRight className="w-4 h-4" />
          <span>3. Internal Transfer</span>
        </button>

        <button
          onClick={() => { setActiveTab('other'); setFeedback({ text: '', type: '' }); }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'other'
              ? 'bg-amber-600 text-white shadow-md'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>4. Other Income</span>
        </button>

        <button
          onClick={() => { setActiveTab('mortgage'); setShowMortgageModal(true); setFeedback({ text: '', type: '' }); }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'mortgage'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Landmark className="w-4 h-4" />
          <span>5. Mortgage Payment</span>
        </button>

        <button
          onClick={() => { setActiveTab('recent'); setFeedback({ text: '', type: '' }); }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'recent'
              ? 'bg-slate-700 text-white shadow-md'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>6. Recent Activity</span>
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* TAB 1: COLLECT RENT */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'rent' && showRentModal && (
        <ModalPortal>
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
        <div className="w-full max-w-5xl max-h-[92vh] overflow-y-auto custom-scrollbar">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-7 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 mb-5 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white">
                  Record Tenant Rent Collection
                </h2>
                <p className="text-xs text-slate-400">
                  Deposit rent into bank account and automatically reduce tenant outstanding balance.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleQuickGenerateSchedules}
              disabled={generatingSchedules || !rentForm.billingMonth}
              className="self-start sm:self-auto px-3.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
              title="Generate billing invoices for all properties for this month"
            >
              <Zap className={`w-3.5 h-3.5 ${generatingSchedules ? 'animate-spin' : ''}`} />
              <span>{generatingSchedules ? 'Generating...' : `Generate Invoices (${rentForm.billingMonth})`}</span>
            </button>
            <button
              type="button"
              onClick={() => { setShowRentModal(false); setActiveTab('recent'); }}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              aria-label="Close rent collection form"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleRentSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
                  <span>Rent Month <span className="text-rose-400">*</span></span>
                  <span className="text-[10px] text-slate-400 font-normal">YYYY-MM</span>
                </label>
                <input
                  type="month"
                  value={rentForm.billingMonth}
                  onChange={handleBillingMonthChange}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-medium focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Select Property <span className="text-rose-400">*</span>
                  </label>
                  <span className="text-[11px] text-emerald-400 font-medium">
                    {uniqueProperties.length} propert{uniqueProperties.length === 1 ? 'y' : 'ies'} available
                  </span>
                </div>
                <select
                  value={rentForm.propertyId}
                  onChange={handlePropertySelect}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-medium focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">-- Choose Property for Rent Collection --</option>
                  {uniqueProperties.map((p) => (
                    <option key={p._id} value={p._id}>
                      🏠 {p.name} {p.tenantName ? `• Tenant: ${p.tenantName}` : ''} • Monthly Rent: {formatGBP(p.contractualRent || 0)}
                    </option>
                  ))}
                </select>

                {/* Selected Property Preview Badge */}
                {currentRentPropertyName && (
                  <div className="mt-2.5 p-2.5 rounded-xl bg-slate-950 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <div>
                        <span className="text-slate-400">Selected Property: </span>
                        <span className="font-bold text-white text-sm">{currentRentPropertyName}</span>
                        {currentRentTenantName && (
                          <span className="text-slate-400 ml-2">
                            (Tenant: <span className="text-emerald-300 font-medium">{currentRentTenantName}</span>)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        Period: {rentForm.billingMonth}
                      </span>
                      {rentForm.amount && (
                        <span className="text-[11px] font-mono font-bold text-emerald-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          Due: {formatGBP(Number(rentForm.amount))}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Outstanding Invoiced Overdue Months for this Property (one-click pills) */}
                {unpaidSchedulesForSelectedProp.length > 0 && (
                  <div className="mt-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="flex items-center gap-1.5 text-amber-300 font-bold">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        {unpaidSchedulesForSelectedProp.length} Outstanding Invoiced Month{unpaidSchedulesForSelectedProp.length > 1 ? 's' : ''} on Record:
                      </span>
                      <span className="text-amber-200 font-mono text-[11px]">
                        Total Overdue: {formatGBP(unpaidSchedulesForSelectedProp.reduce((sum, s) => sum + (s.outstandingAmount || 0), 0))}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {unpaidSchedulesForSelectedProp.map((s) => (
                        <button
                          key={s._id}
                          type="button"
                          onClick={() => {
                            setRentForm((prev) => ({
                              ...prev,
                              scheduleId: s._id,
                              billingMonth: s.billingMonth,
                              amount: String(s.outstandingAmount || s.expectedAmount || ''),
                              notes: `Rent for ${currentRentPropertyName || 'Property'} - Month: ${s.billingMonth}`,
                            }));
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition cursor-pointer border ${
                            rentForm.billingMonth === s.billingMonth && rentForm.scheduleId === s._id
                              ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                              : 'bg-slate-900 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
                          }`}
                          title={`Click to set collection to ${s.billingMonth} (${formatGBP(s.outstandingAmount)})`}
                        >
                          {s.billingMonth} &bull; {formatGBP(s.outstandingAmount)} ({s.status})
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Collection Date <span className="text-rose-400">*</span>
                </label>
                <input
                  type="date"
                  value={rentForm.paymentDate}
                  onChange={(e) => setRentForm({ ...rentForm, paymentDate: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-medium focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Amount Received (£) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="e.g. 1250.00"
                  value={rentForm.amount}
                  onChange={(e) => setRentForm({ ...rentForm, amount: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-bold font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Receiving Bank Account <span className="text-rose-400">*</span>
                </label>
                <select
                  value={rentForm.receivingAccountId}
                  onChange={(e) => setRentForm({ ...rentForm, receivingAccountId: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-medium focus:border-emerald-500 focus:outline-none"
                >
                  <option value="">-- Select Receiving Bank --</option>
                  {accounts.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name} ({a.bankName || a.accountType}) &bull; {formatGBP(a.currentBalance)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Payment Method
                </label>
                <select
                  value={rentForm.paymentMethod}
                  onChange={(e) => setRentForm({ ...rentForm, paymentMethod: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-medium focus:border-emerald-500 focus:outline-none"
                >
                  <option value="STANDING_ORDER">Standing Order (Bank Transfer)</option>
                  <option value="DIRECT_DEBIT">Direct Debit</option>
                  <option value="CARD">Debit / Credit Card</option>
                  <option value="CASH">Cash in Hand</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Receipt Narration / Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. October rent payment received via NatWest Standing Order"
                  value={rentForm.notes}
                  onChange={(e) => setRentForm({ ...rentForm, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-medium focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <ReceiptUploadField
                file={rentFile}
                setFile={setRentFile}
                label="Rent Remittance Slip / Bank Transfer Receipt (Optional)"
                colorScheme="emerald"
              />
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md transition disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                <Receipt className="w-4 h-4" />
                <span>{submitting ? 'Posting Receipt...' : 'Post Rent Collection'}</span>
              </button>
            </div>
          </form>
        </div>
        </div>
        </div>
        </ModalPortal>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 2: RECORD EXPENSE */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'expense' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-7 shadow-sm">
          <div className="flex items-center gap-2 pb-4 mb-5 border-b border-slate-800">
            <div className="p-2 rounded-xl bg-rose-500/15 text-rose-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                Record Property Operational Expense
              </h2>
              <p className="text-xs text-slate-400">
                Post repair invoices, insurance, maintenance, agent fees, or council taxes against bank accounts.
              </p>
            </div>
          </div>

          <form onSubmit={handleExpenseSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Expense Date <span className="text-rose-400">*</span>
                </label>
                <input
                  type="date"
                  value={expenseForm.transactionDate}
                  onChange={(e) => setExpenseForm({ ...expenseForm, transactionDate: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-medium focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Disbursing Bank Account <span className="text-rose-400">*</span>
                </label>
                <select
                  value={expenseForm.accountId}
                  onChange={(e) => setExpenseForm({ ...expenseForm, accountId: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-medium focus:border-rose-500 focus:outline-none"
                >
                  <option value="">-- Select Paying Account --</option>
                  {accounts.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name} ({formatGBP(a.currentBalance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Property Allocation (Main Head)
                </label>
                <select
                  value={expenseForm.propertyId}
                  onChange={(e) => setExpenseForm({ ...expenseForm, propertyId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-medium focus:border-rose-500 focus:outline-none"
                >
                  <option value="">-- General / Non-Property Specific --</option>
                  {properties.map((p) => (
                    <option key={p._id} value={p._id}>
                      🏢 {p.name} ({p.postcode || p.city || 'UK'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="relative">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Expense Head (Sub-Head) <span className="text-rose-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowQuickAddCat(!showQuickAddCat)}
                    className="text-[11px] font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={11} />
                    <span>{showQuickAddCat ? 'Cancel' : '+ Add Head'}</span>
                  </button>
                </div>
                <select
                  value={expenseForm.categoryId}
                  onChange={handleExpenseCategorySelect}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-medium focus:border-rose-500 focus:outline-none"
                >
                  <option value="">-- Select Expense Sub-Head --</option>
                  {expenseForm.propertyId ? (
                    <>
                      {selectedPropHeads.length > 0 && (
                        <optgroup label={`🏢 ${selectedPropObj?.name || 'Property'} Sub-Heads (Electricity, Gas, Maintenance, etc.)`}>
                          {selectedPropHeads.map((c) => (
                            <option key={c._id} value={c._id}>
                              {c.name} {c.code ? `(${c.code})` : ''}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {generalExpenseCategories.length > 0 && (
                        <optgroup label="🌐 General Portfolio Expense Heads">
                          {generalExpenseCategories.map((c) => (
                            <option key={c._id} value={c._id}>
                              {c.name} {c.code ? `(${c.code})` : ''}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </>
                  ) : (
                    <>
                      {generalExpenseCategories.length > 0 && (
                        <optgroup label="🌐 General Portfolio Expense Heads">
                          {generalExpenseCategories.map((c) => (
                            <option key={c._id} value={c._id}>
                              {c.name} {c.code ? `(${c.code})` : ''}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {properties.map((p) => {
                        const heads = expenseCategories.filter(
                          (c) => (c.propertyId?._id || c.propertyId)?.toString() === p._id.toString()
                        );
                        if (heads.length === 0) return null;
                        return (
                          <optgroup key={p._id} label={`🏢 ${p.name} Sub-Heads`}>
                            {heads.map((c) => (
                              <option key={c._id} value={c._id}>
                                {c.name} {c.code ? `(${c.code})` : ''}
                              </option>
                            ))}
                          </optgroup>
                        );
                      })}
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Amount (£) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="e.g. 180.00"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-bold font-mono focus:border-rose-500 focus:outline-none"
                />
              </div>

              {/* Quick Add Sub-Head Drawer */}
              {showQuickAddCat && (
                <div className="lg:col-span-3 p-3.5 bg-slate-950/80 border border-rose-500/30 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                      <Plus size={13} />
                      <span>Create New Sub-Head {expenseForm.propertyId ? `under ${selectedPropObj?.name || 'Property'}` : '(General Portfolio)'}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowQuickAddCat(false)}
                      className="text-slate-500 hover:text-white text-xs font-bold cursor-pointer"
                    >
                      ✕ Close
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Electricity Bill, Gas & Heating, Gardening, Pest Control..."
                      value={quickCatName}
                      onChange={(e) => setQuickCatName(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-rose-500"
                    />
                    <button
                      type="button"
                      onClick={handleQuickAddCategory}
                      disabled={savingQuickCat || !quickCatName.trim()}
                      className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    >
                      {savingQuickCat ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
                      <span>Save &amp; Select</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="lg:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Expense Narration / Description <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Boiler repair and gas safety certification by British Gas"
                  value={expenseForm.narration}
                  onChange={(e) => setExpenseForm({ ...expenseForm, narration: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-medium focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Invoice / Reference No.
                </label>
                <input
                  type="text"
                  placeholder="e.g. INV-98412"
                  value={expenseForm.reference}
                  onChange={(e) => setExpenseForm({ ...expenseForm, reference: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-medium focus:border-rose-500 focus:outline-none"
                />
              </div>

              <ReceiptUploadField
                file={expenseFile}
                setFile={setExpenseFile}
                label="Supplier Invoice / Purchase Receipt / Contractor Bill (Optional)"
                colorScheme="rose"
              />
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-md transition disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                <span>{submitting ? 'Recording Expense...' : 'Record Expense Voucher'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 3: INTERNAL TRANSFER */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'transfer' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-7 shadow-sm">
          <div className="flex items-center gap-2 pb-4 mb-5 border-b border-slate-800">
            <div className="p-2 rounded-xl bg-sky-500/15 text-sky-400">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                Execute Internal Bank Transfer
              </h2>
              <p className="text-xs text-slate-400">
                Move cash funds between UK bank accounts with double-entry balance updates.
              </p>
            </div>
          </div>

          <form onSubmit={handleTransferSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Source Account (Credit Outflow) <span className="text-rose-400">*</span>
                </label>
                <select
                  value={transferForm.fromAccountId}
                  onChange={(e) => setTransferForm({ ...transferForm, fromAccountId: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-medium focus:border-sky-500 focus:outline-none"
                >
                  <option value="">-- Choose Paying Account --</option>
                  {accounts.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name} ({formatGBP(a.currentBalance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Destination Account (Debit Inflow) <span className="text-rose-400">*</span>
                </label>
                <select
                  value={transferForm.toAccountId}
                  onChange={(e) => setTransferForm({ ...transferForm, toAccountId: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-medium focus:border-sky-500 focus:outline-none"
                >
                  <option value="">-- Choose Receiving Account --</option>
                  {accounts.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name} ({formatGBP(a.currentBalance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Transfer Amount (£) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="e.g. 5000.00"
                  value={transferForm.amount}
                  onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-bold font-mono focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Transfer Date <span className="text-rose-400">*</span>
                </label>
                <input
                  type="date"
                  value={transferForm.transferDate}
                  onChange={(e) => setTransferForm({ ...transferForm, transferDate: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-medium focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Transfer Reference / Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. TRF-OCT-RESERVE"
                  value={transferForm.reference}
                  onChange={(e) => setTransferForm({ ...transferForm, reference: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-medium focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Reason / Purpose
                </label>
                <input
                  type="text"
                  placeholder="e.g. Transfer to Mortgage Reserve Account"
                  value={transferForm.narration}
                  onChange={(e) => setTransferForm({ ...transferForm, narration: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-medium focus:border-sky-500 focus:outline-none"
                />
              </div>

              <ReceiptUploadField
                file={transferFile}
                setFile={setTransferFile}
                label="Transfer Confirmation / Remittance Voucher / Cheque Scan (Optional)"
                colorScheme="sky"
              />
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm shadow-md transition disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>{submitting ? 'Transferring...' : 'Execute Internal Transfer'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 4: OTHER INCOME */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'other' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-7 shadow-sm">
          <div className="flex items-center gap-2 pb-4 mb-5 border-b border-slate-800">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                Record Other Income / Non-Rent Receipts
              </h2>
              <p className="text-xs text-slate-400">
                Deposit miscellaneous revenue, parking fees, insurance payouts, or director equity into bank account.
              </p>
            </div>
          </div>

          <form onSubmit={handleOtherIncomeSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Receipt Date <span className="text-rose-400">*</span>
                </label>
                <input
                  type="date"
                  value={otherIncomeForm.transactionDate}
                  onChange={(e) => setOtherIncomeForm({ ...otherIncomeForm, transactionDate: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-medium focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Receiving Bank Account <span className="text-rose-400">*</span>
                </label>
                <select
                  value={otherIncomeForm.accountId}
                  onChange={(e) => setOtherIncomeForm({ ...otherIncomeForm, accountId: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-medium focus:border-amber-500 focus:outline-none"
                >
                  <option value="">-- Choose Bank Account --</option>
                  {accounts.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name} ({formatGBP(a.currentBalance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Income Category Head <span className="text-rose-400">*</span>
                </label>
                <select
                  value={otherIncomeForm.categoryId}
                  onChange={(e) => setOtherIncomeForm({ ...otherIncomeForm, categoryId: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-medium focus:border-amber-500 focus:outline-none"
                >
                  <option value="">-- Select Income Category --</option>
                  {incomeCategories.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name} {c.code ? `(${c.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Amount Received (£) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="e.g. 350.00"
                  value={otherIncomeForm.amount}
                  onChange={(e) => setOtherIncomeForm({ ...otherIncomeForm, amount: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-bold font-mono focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Received From (Payer / Party)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Parking space user, Insurance company"
                  value={otherIncomeForm.receivedFrom}
                  onChange={(e) => setOtherIncomeForm({ ...otherIncomeForm, receivedFrom: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-medium focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Reference No.
                </label>
                <input
                  type="text"
                  placeholder="e.g. REC-OTH-0042"
                  value={otherIncomeForm.reference}
                  onChange={(e) => setOtherIncomeForm({ ...otherIncomeForm, reference: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-medium focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Narration / Detail <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Garage space monthly rental fee received"
                  value={otherIncomeForm.narration}
                  onChange={(e) => setOtherIncomeForm({ ...otherIncomeForm, narration: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-medium focus:border-amber-500 focus:outline-none"
                />
              </div>

              <ReceiptUploadField
                file={otherIncomeFile}
                setFile={setOtherIncomeFile}
                label="Income Deposit Slip / Payer Advice / Payment Receipt (Optional)"
                colorScheme="amber"
              />
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-md transition disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                <TrendingUp className="w-4 h-4" />
                <span>{submitting ? 'Posting Income...' : 'Post Other Income'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 5: MORTGAGE PAYMENT */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'mortgage' && showMortgageModal && (
        <ModalPortal>
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
        <div className="w-full max-w-5xl max-h-[92vh] overflow-y-auto custom-scrollbar">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-7 shadow-sm">
          <div className="flex items-center gap-2 pb-4 mb-5 border-b border-slate-800">
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                Record Mortgage Servicing Payment
              </h2>
              <p className="text-xs text-slate-400">
                Split payment between Interest expense (P&L) and Principal repayment (reduces mortgage liability).
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setShowMortgageModal(false); setActiveTab('recent'); }}
              className="ml-auto p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              aria-label="Close mortgage payment form"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleMortgageSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Select Active Mortgage Facility <span className="text-rose-400">*</span>
                </label>
                <select
                  value={mortgageForm.mortgageId}
                  onChange={(e) => {
                    const mId = e.target.value;
                    const mObj = mortgages.find((m) => m._id === mId);
                    setMortgageForm((prev) => ({
                      ...prev,
                      mortgageId: mId,
                      totalAmountPaid: mObj ? String(mObj.expectedRepaymentAmount || '') : '',
                      interestAmount: mObj && mObj.repaymentType === 'INTEREST_ONLY' ? String(mObj.expectedRepaymentAmount || '') : '',
                      principalAmount: mObj && mObj.repaymentType === 'INTEREST_ONLY' ? '0' : '',
                      paymentReference: mObj ? mObj.accountReference : '',
                    }));
                  }}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-medium focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">-- Choose Mortgage Facility --</option>
                  {mortgages.map((m) => (
                    <option key={m._id} value={m._id}>
                      {m.lenderName} &bull; {m.propertyId?.name || 'Property'} &bull; Balance: {formatGBP(m.outstandingPrincipalBalance)} &bull; Monthly: {formatGBP(m.expectedRepaymentAmount)} ({m.repaymentType})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Payment Date <span className="text-rose-400">*</span>
                </label>
                <input
                  type="date"
                  value={mortgageForm.paymentDate}
                  onChange={(e) => setMortgageForm({ ...mortgageForm, paymentDate: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-medium focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Paying Bank Account <span className="text-rose-400">*</span>
                </label>
                <select
                  value={mortgageForm.paymentAccountId}
                  onChange={(e) => setMortgageForm({ ...mortgageForm, paymentAccountId: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-medium focus:border-indigo-500 focus:outline-none"
                >
                  <option value="">-- Choose Paying Bank --</option>
                  {accounts.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name} ({formatGBP(a.currentBalance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Total Cash Deducted (£) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="e.g. 1100.00"
                  value={mortgageForm.totalAmountPaid}
                  onChange={(e) => setMortgageForm({ ...mortgageForm, totalAmountPaid: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-bold font-mono focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Interest Expense Split (£) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 850.00"
                  value={mortgageForm.interestAmount}
                  onChange={(e) => setMortgageForm({ ...mortgageForm, interestAmount: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-bold font-mono focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Principal Reduction (£) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 250.00"
                  value={mortgageForm.principalAmount}
                  onChange={(e) => setMortgageForm({ ...mortgageForm, principalAmount: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-bold font-mono focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Lender Fees / Admin (£)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={mortgageForm.feeAmount}
                  onChange={(e) => setMortgageForm({ ...mortgageForm, feeAmount: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-bold font-mono focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Lender Account Reference
                </label>
                <input
                  type="text"
                  placeholder="e.g. MTG-NW-8492"
                  value={mortgageForm.paymentReference}
                  onChange={(e) => setMortgageForm({ ...mortgageForm, paymentReference: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 font-medium focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <ReceiptUploadField
                file={mortgageFile}
                setFile={setMortgageFile}
                label="Lender Statement / Mortgage Debit Receipt / Bank Advice (Optional)"
                colorScheme="indigo"
              />
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-md transition disabled:opacity-50 cursor-pointer flex items-center gap-2"
              >
                <Landmark className="w-4 h-4" />
                <span>{submitting ? 'Recording Payment...' : 'Record Mortgage Payment'}</span>
              </button>
            </div>
          </form>
        </div>
        </div>
        </div>
        </ModalPortal>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 6: RECENT ENTRIES JOURNAL */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'recent' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-7 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                Recent Operations Journal
              </h2>
              <p className="text-xs text-slate-400">
                Audit feed of all posted vouchers, receipts, and internal bank transfers.
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Voucher #</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Bank Account</th>
                  <th className="py-2.5 px-3">Narration</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3 text-center">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredRecent.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500 font-medium">
                      No matching transaction entries found.
                    </td>
                  </tr>
                ) : (
                  filteredRecent.map((tx) => {
                    const isIncome = tx.direction === 'IN';
                    const isTransfer = tx.transactionType === 'TRANSFER';
                    const isMortgage = tx.transactionType === 'MORTGAGE_PAYMENT';
                    return (
                      <tr key={tx._id} className="hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-3 text-slate-300 font-mono">
                          {formatUKDate(tx.transactionDate)}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-300">
                          {tx.voucherNo}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                              isTransfer
                                ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                                : isMortgage
                                ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                                : isIncome
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            }`}
                          >
                            {tx.transactionType}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {tx.accountId?.name || 'Bank'}
                          {tx.counterAccountId && (
                            <span className="text-slate-500 text-[10px]">
                              {' '}
                              &rarr; {tx.counterAccountId?.name}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300 max-w-xs truncate" title={tx.narration}>
                          {tx.narration}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono font-bold ${
                            isIncome ? 'text-emerald-400' : 'text-slate-100'
                          }`}
                        >
                          {isIncome ? '+' : '-'}
                          {formatGBP(tx.amount)}
                        </td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {tx.receiptUrl ? (
                              <a
                                href={tx.receiptUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/25 text-[10px] font-semibold transition"
                                title={tx.receiptFilename || 'View Receipt'}
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>View</span>
                              </a>
                            ) : (
                              <span className="text-[10px] text-slate-500 italic">None</span>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setAttachModalTx(tx);
                                setAttachModalFile(null);
                                setAttachModalError('');
                              }}
                              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                              title={tx.receiptUrl ? 'Replace or Manage Receipt' : 'Attach Receipt'}
                            >
                              <Paperclip className="w-3.5 h-3.5 text-indigo-400" />
                            </button>
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

      {/* Quick Attach Receipt Modal */}
      {attachModalTx && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Paperclip className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Attach Transaction Receipt</h3>
              </div>
              <button
                type="button"
                onClick={() => setAttachModalTx(null)}
                className="text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-1 bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div>
                <strong className="text-slate-400">Voucher:</strong>{' '}
                <span className="font-mono text-indigo-300 font-bold">{attachModalTx.voucherNo}</span>
              </div>
              <div>
                <strong className="text-slate-400">Date:</strong> {formatUKDate(attachModalTx.transactionDate)}
              </div>
              <div>
                <strong className="text-slate-400">Narration:</strong> {attachModalTx.narration}
              </div>
              <div>
                <strong className="text-slate-400">Amount:</strong> {formatGBP(attachModalTx.amount)}
              </div>
              {attachModalTx.receiptUrl && (
                <div className="pt-2 mt-2 border-t border-slate-800 flex items-center justify-between">
                  <a
                    href={attachModalTx.receiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-400 hover:text-indigo-300 underline inline-flex items-center gap-1 font-semibold"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>View current ({attachModalTx.receiptFilename || 'Document'})</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => handleRemoveReceipt(attachModalTx._id, attachModalTx.voucherNo)}
                    className="text-rose-400 hover:text-rose-300 text-[11px] font-semibold underline cursor-pointer"
                  >
                    Remove attachment
                  </button>
                </div>
              )}
            </div>

            {attachModalError && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs font-semibold">
                {attachModalError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Upload New Document (PDF, JPG, PNG)
              </label>
              <input
                type="file"
                accept=".pdf,image/png,image/jpeg,image/webp,image/jpg"
                onChange={(e) => setAttachModalFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer bg-slate-950 p-2 rounded-xl border border-slate-800"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setAttachModalTx(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!attachModalFile || attachModalUploading}
                onClick={handleAttachReceiptSubmit}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                {attachModalUploading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload &amp; Attach</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataEntryPage;
