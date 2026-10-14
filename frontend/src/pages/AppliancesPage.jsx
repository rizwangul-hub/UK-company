import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Plus,
  Search,
  Filter,
  Building2,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Phone,
  FileText,
  Upload,
  Download,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Edit3,
  Trash2,
  CheckSquare,
  Square,
  UserCheck,
  Wrench,
  BookOpen,
  Info,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Receipt,
  CreditCard,
  MapPin,
  Bell,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { formatGBP, formatUKDate } from '../utils/formatters.js';
import { appliancesAPI, propertiesAPI, triggerBlobDownload } from '../services/api.js';
import ApplianceModal from '../components/ApplianceModal.jsx';
import { APPLIANCE_ICONS, APPLIANCE_TYPE_TITLES } from '../components/PropertyAppliancesSection.jsx';

export function AppliancesPage({ selectedCompany }) {
  const [activeTab, setActiveTab] = useState('appliances'); // 'appliances' | 'receipts' | 'reminders' | 'calendar' | 'tasks' | 'access' | 'currys'
  const [appliances, setAppliances] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [properties, setProperties] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [currysContacts, setCurrysContacts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter States
  const [search, setSearch] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [careFilter, setCareFilter] = useState('ALL'); // 'ALL' | 'COVERED' | 'NOT_COVERED' | 'PENDING_LOCATION'
  const [valetFilter, setValetFilter] = useState('ALL'); // 'ALL' | 'DUE' | 'BOOKED' | 'COMPLETED'
  const [reminderDays, setReminderDays] = useState(90);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppliance, setEditingAppliance] = useState(null);
  const [uploadModalAppliance, setUploadModalAppliance] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadDocType, setUploadDocType] = useState('PURCHASE_RECEIPT');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Quick Assign Property Modal
  const [assignModalAppliance, setAssignModalAppliance] = useState(null);
  const [selectedAssignPropertyId, setSelectedAssignPropertyId] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [assigning, setAssigning] = useState(false);

  // Create Supplier Receipt Modal
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptForm, setReceiptForm] = useState({
    supplier: 'Currys',
    branch: '',
    receiptNumber: '',
    receiptDate: new Date().toISOString().slice(0, 10),
    totalAmountDueGBP: '',
    cardPaymentGBP: '',
    hasMandate: false,
    monthlyInstalmentGBP: '',
    numberOfInstalments: '10',
    notes: '',
  });

  // Task Modal
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    priority: 'HIGH',
    dueDate: '',
    propertyId: '',
    notes: '',
  });

  const loadData = async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);

    try {
      const [appRes, propRes, taskRes, contactRes, receiptRes, remRes] = await Promise.all([
        appliancesAPI.getAll({}, { forceRefresh: force }),
        propertiesAPI.getAll({}, { forceRefresh: force }),
        appliancesAPI.getTasks({ forceRefresh: force }),
        appliancesAPI.getCurrysContacts({ forceRefresh: force }),
        appliancesAPI.getReceipts({ forceRefresh: force }),
        appliancesAPI.getReminders({ days: reminderDays }, { forceRefresh: force }),
      ]);

      if (appRes?.success) {
        setAppliances(appRes.data?.appliances || appRes.data || []);
      }
      if (propRes?.success) setProperties(propRes.data?.properties || []);
      if (taskRes?.success) setTasks(taskRes.data || []);
      if (contactRes?.success) setCurrysContacts(contactRes.data || null);
      if (receiptRes?.success) setReceipts(receiptRes.data || []);
      if (remRes?.success) setReminders(remRes.data?.reminders || []);
    } catch (err) {
      console.error('Failed to load appliances & maintenance data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCompany?.id, reminderDays]);

  // Filtered Appliances
  const filteredAppliances = useMemo(() => {
    return appliances.filter((item) => {
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = item.name?.toLowerCase().includes(q);
        const matchBrand = item.brand?.toLowerCase().includes(q);
        const matchModel = item.modelNumber?.toLowerCase().includes(q);
        const matchSerial = item.serialNumber?.toLowerCase().includes(q);
        const matchItemCode = item.itemCode?.toLowerCase().includes(q);
        const matchRef = item.serviceAgreement?.agreementReference?.toLowerCase().includes(q);
        const matchProp = item.propertyId?.name?.toLowerCase().includes(q);
        if (!matchName && !matchBrand && !matchModel && !matchSerial && !matchItemCode && !matchRef && !matchProp) return false;
      }
      // Property
      if (propertyFilter && item.propertyId?._id !== propertyFilter && item.propertyId !== propertyFilter) {
        return false;
      }
      // Supplier (Currys / Howdens / other)
      if (supplierFilter && !item.supplier?.toLowerCase().includes(supplierFilter.toLowerCase())) {
        return false;
      }
      // Type
      if (typeFilter && item.applianceType !== typeFilter) {
        return false;
      }
      // Care Filter
      if (careFilter === 'COVERED' && !item.serviceAgreement?.hasAgreement && !item.currysCareAndRepair?.hasPlan) return false;
      if (careFilter === 'NOT_COVERED' && (item.serviceAgreement?.hasAgreement || item.currysCareAndRepair?.hasPlan)) return false;
      if (careFilter === 'PENDING_LOCATION' && item.propertyAssignmentStatus !== 'PENDING_VERIFICATION') return false;
      // Valet Status
      if (valetFilter === 'DUE' && item.squeakyCleanValet?.eligibilityStatus !== 'DUE') return false;
      if (valetFilter === 'BOOKED' && item.squeakyCleanValet?.eligibilityStatus !== 'BOOKED') return false;
      if (valetFilter === 'COMPLETED' && item.squeakyCleanValet?.eligibilityStatus !== 'COMPLETED') return false;

      return true;
    });
  }, [appliances, search, propertyFilter, supplierFilter, typeFilter, careFilter, valetFilter]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = appliances.length;
    const covered = appliances.filter((a) => a.serviceAgreement?.hasAgreement || a.currysCareAndRepair?.hasPlan).length;
    const pendingLocation = appliances.filter((a) => a.propertyAssignmentStatus === 'PENDING_VERIFICATION' || !a.propertyId).length;
    const valetDue = appliances.filter(
      (a) => a.squeakyCleanValet?.eligibilityStatus === 'DUE' || a.squeakyCleanValet?.eligibilityStatus === 'BOOKING_REQUIRED'
    ).length;
    const totalReceipts = receipts.length;
    const activeReminders = reminders.length;

    return { total, covered, pendingLocation, valetDue, totalReceipts, activeReminders };
  }, [appliances, receipts, reminders]);

  // Handlers
  const handleOpenAdd = () => {
    setEditingAppliance(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (app) => {
    setEditingAppliance(app);
    setIsModalOpen(true);
  };

  const handleDeleteAppliance = async (id) => {
    if (!window.confirm('Are you sure you want to delete this appliance record?')) {
      return;
    }
    try {
      await appliancesAPI.delete(id);
      loadData(true);
    } catch (err) {
      console.error('Failed to delete appliance:', err);
      alert('Delete failed: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleQuickUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile || !uploadModalAppliance) return;
    setUploading(true);
    setUploadError('');

    try {
      const data = new FormData();
      data.append('file', uploadFile);
      data.append('title', `${uploadModalAppliance.supplier || 'Currys'} Document - ${uploadModalAppliance.name}`);
      data.append('docType', uploadDocType);

      await appliancesAPI.uploadDocument(uploadModalAppliance._id, data);
      setUploadModalAppliance(null);
      setUploadFile(null);
      loadData(true);
    } catch (err) {
      console.error('Upload document error:', err);
      setUploadError(err.response?.data?.message || err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Property Assignment Handler
  const handleAssignPropertySubmit = async (e) => {
    e.preventDefault();
    if (!assignModalAppliance || !selectedAssignPropertyId) return;

    setAssigning(true);
    try {
      await appliancesAPI.assignProperty(assignModalAppliance._id, {
        propertyId: selectedAssignPropertyId,
        notes: assignNotes,
      });
      setAssignModalAppliance(null);
      setSelectedAssignPropertyId('');
      setAssignNotes('');
      loadData(true);
    } catch (err) {
      console.error('Failed to assign property:', err);
      alert('Assign failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setAssigning(false);
    }
  };

  // Task Status Toggle
  const handleToggleTaskStatus = async (task) => {
    const statusCycle = {
      PENDING: 'IN_PROGRESS',
      IN_PROGRESS: 'COMPLETED',
      WAITING_FOR_PROVIDER: 'COMPLETED',
      COMPLETED: 'PENDING',
      BLOCKED: 'IN_PROGRESS',
    };
    const nextStatus = statusCycle[task.status] || 'PENDING';

    try {
      await appliancesAPI.updateTask(task._id, { status: nextStatus });
      setTasks((prev) =>
        prev.map((t) => (t._id === task._id ? { ...t, status: nextStatus } : t))
      );
    } catch (err) {
      console.error('Failed to update task status:', err);
      alert('Could not update task status');
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!taskForm.title.trim()) return;

    try {
      const res = await appliancesAPI.createTask({
        ...taskForm,
        assignedTo: '',
        companyId: selectedCompany?.id,
      });
      if (res?.success) {
        setShowTaskModal(false);
        setTaskForm({
          title: '',
          description: '',
          priority: 'HIGH',
          dueDate: '',
          propertyId: '',
          notes: '',
        });
        loadData(true);
      }
    } catch (err) {
      console.error('Failed to create task:', err);
      alert('Create task failed: ' + (err.response?.data?.message || err.message));
    }
  };

  // Create Supplier Receipt Submit
  const handleCreateReceiptSubmit = async (e) => {
    e.preventDefault();
    if (!receiptForm.receiptNumber.trim() || !receiptForm.totalAmountDueGBP) return;

    try {
      await appliancesAPI.createReceipt({
        supplier: receiptForm.supplier.trim() || 'Currys',
        branch: receiptForm.branch.trim(),
        receiptNumber: receiptForm.receiptNumber.trim(),
        receiptDate: receiptForm.receiptDate,
        totalAmountDueGBP: Number(receiptForm.totalAmountDueGBP) || 0,
        paymentInformation: {
          method: receiptForm.hasMandate ? 'SPLIT_CARD_DIRECT_DEBIT' : 'CARD',
          cardPaymentGBP: Number(receiptForm.cardPaymentGBP) || Number(receiptForm.totalAmountDueGBP) || 0,
          directDebitMandate: {
            hasMandate: receiptForm.hasMandate,
            monthlyInstalmentGBP: Number(receiptForm.monthlyInstalmentGBP) || 0,
            numberOfInstalments: Number(receiptForm.numberOfInstalments) || 10,
            totalMandateGBP: (Number(receiptForm.monthlyInstalmentGBP) || 0) * (Number(receiptForm.numberOfInstalments) || 10),
          },
          notes: receiptForm.notes,
        },
        financialLedgerStatus: 'SOURCE_RECORD_ONLY',
        notes: receiptForm.notes,
      });
      setShowReceiptModal(false);
      setReceiptForm({
        supplier: 'Currys',
        branch: '',
        receiptNumber: '',
        receiptDate: new Date().toISOString().slice(0, 10),
        totalAmountDueGBP: '',
        cardPaymentGBP: '',
        hasMandate: false,
        monthlyInstalmentGBP: '',
        numberOfInstalments: '10',
        notes: '',
      });
      loadData(true);
    } catch (err) {
      console.error('Failed to create supplier receipt:', err);
      alert('Record receipt failed: ' + (err.response?.data?.message || err.message));
    }
  };

  // Export CSV of Appliances & Valet Registers
  const handleExportCSV = () => {
    if (appliances.length === 0) {
      alert('No appliances available to export.');
      return;
    }
    const headers = [
      'Property',
      'Location Status',
      'Appliance Name',
      'Category',
      'Brand',
      'Model Number',
      'Serial Number',
      'Supplier',
      'Supplier Item Code',
      'Purchase Date',
      'Purchase Price (£)',
      'Care Services Charge (£)',
      'Care Plan Agreement Ref',
      'Plan Duration (Yrs)',
      'Agreement End Date',
      'Valet Eligibility',
      'Valet Next Due Date',
      'Documents Count',
    ];

    const rows = appliances.map((a) => [
      `"${a.propertyId?.name || 'Unassigned Property'}"`,
      `"${a.propertyAssignmentStatus || 'ASSIGNED'}"`,
      `"${a.name || ''}"`,
      `"${APPLIANCE_TYPE_TITLES[a.applianceType] || a.applianceType}"`,
      `"${a.brand || ''}"`,
      `"${a.modelNumber || ''}"`,
      `"${a.serialNumber || 'UNVERIFIED'}"`,
      `"${a.supplier || ''}"`,
      `"${a.itemCode || ''}"`,
      `"${a.purchaseDate ? a.purchaseDate.substring(0, 10) : ''}"`,
      `"${a.purchasePrice || 0}"`,
      `"${a.careServicesChargeGBP || a.serviceAgreement?.chargeGBP || 0}"`,
      `"${a.serviceAgreement?.agreementReference || a.currysCareAndRepair?.planReferenceNumber || ''}"`,
      `"${a.serviceAgreement?.durationYears || 5}"`,
      `"${a.serviceAgreement?.endDate ? a.serviceAgreement.endDate.substring(0, 10) : ''}"`,
      `"${a.squeakyCleanValet?.eligibilityStatus || 'NOT_VERIFIED'}"`,
      `"${a.squeakyCleanValet?.nextValetDueDate ? a.squeakyCleanValet.nextValetDueDate.substring(0, 10) : ''}"`,
      `"${a.documents?.length || 0}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const filename = `${selectedCompany?.slug || 'company'}_appliances_and_contracts_${new Date().toISOString().slice(0, 10)}.csv`;
    triggerBlobDownload(blob, filename);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 page-anim-scale-pop">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl dashboard-header-banner">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-indigo-400" />
              <span>Appliances, Warranties &amp; Contracts</span>
            </h1>
            {selectedCompany?.name && (
              <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {selectedCompany.name}
              </span>
            )}
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Currys &amp; Howdens
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl">
            Complete property equipment register, supplier master invoices, decoupled warranties, Currys Care &amp; Repair agreements, and annual Squeaky Clean Valets for {selectedCompany?.legalName || selectedCompany?.name || 'this portfolio'}.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer shadow-sm"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700/60 text-slate-200 hover:text-white hover:bg-slate-800 text-xs font-bold transition cursor-pointer shadow-sm"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export Register</span>
          </button>

          <button
            onClick={() => setShowReceiptModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-indigo-500/40 text-indigo-300 hover:text-white hover:bg-indigo-600/20 text-xs font-bold transition cursor-pointer shadow-sm"
          >
            <Receipt className="w-4 h-4 text-indigo-400" />
            <span>Record Supplier Invoice</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold shadow-lg shadow-indigo-600/25 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Appliance</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="executive-card rounded-2xl p-4 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Equipment</span>
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="font-display text-xl sm:text-2xl font-extrabold text-white tracking-tight tabular-nums">
            {metrics.total}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">{properties.length} Properties</div>
        </div>

        <div className="executive-card rounded-2xl p-4 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Pending Location</span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="font-display text-xl sm:text-2xl font-extrabold text-amber-400 tracking-tight tabular-nums">
            {metrics.pendingLocation}
          </div>
          <div className="text-[11px] text-amber-400/80 mt-1">Needs physical check</div>
        </div>

        <div className="executive-card rounded-2xl p-4 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Care &amp; Repair</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="font-display text-xl sm:text-2xl font-extrabold text-emerald-400 tracking-tight tabular-nums">
            {metrics.covered}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Currys 5-Yr / Service</div>
        </div>

        <div className="executive-card rounded-2xl p-4 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Master Invoices</span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="font-display text-xl sm:text-2xl font-extrabold text-blue-300 tracking-tight tabular-nums">
            {metrics.totalReceipts}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Currys &amp; Howdens</div>
        </div>

        <div className="executive-card rounded-2xl p-4 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Annual Valet Due</span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="font-display text-xl sm:text-2xl font-extrabold text-amber-300 tracking-tight tabular-nums">
            {metrics.valetDue}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Currys Squeaky Clean</div>
        </div>

        <div className="executive-card rounded-2xl p-4 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Expiry Alerts</span>
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
              <Bell className="w-4 h-4" />
            </div>
          </div>
          <div className="font-display text-xl sm:text-2xl font-extrabold text-rose-400 tracking-tight tabular-nums">
            {metrics.activeReminders}
          </div>
          <div className="text-[11px] text-rose-400/80 mt-1">Within 90 Days</div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('appliances')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'appliances'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Appliances Register ({appliances.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('receipts')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'receipts'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Receipt className="w-3.5 h-3.5 text-blue-400" />
          <span>Supplier Invoices &amp; Master Receipts ({receipts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('reminders')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'reminders'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Bell className="w-3.5 h-3.5 text-rose-400" />
          <span>Warranty &amp; Expiry Reminders ({reminders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('calendar')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'calendar'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Valet Schedule</span>
        </button>

        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'tasks'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Wrench className="w-3.5 h-3.5" />
          <span>Action Checklist ({tasks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('access')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'access'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>Tenant Notices</span>
        </button>

        <button
          onClick={() => setActiveTab('currys')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'currys'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Phone className="w-3.5 h-3.5 text-amber-400" />
          <span>Currys Directory</span>
        </button>
      </div>

      {/* TAB 1: APPLIANCES REGISTER */}
      {activeTab === 'appliances' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by appliance, brand, model, serial, item code, or agreement ref..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={propertyFilter}
                onChange={(e) => setPropertyFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Properties ({properties.length})</option>
                {properties.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </select>

              <select
                value={supplierFilter}
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Suppliers</option>
                <option value="Currys">Currys Only</option>
                <option value="Howdens">Howdens Only</option>
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Categories</option>
                {Object.entries(APPLIANCE_TYPE_TITLES).map(([key, label]) => (
                  <option key={key} value={key}>
                    {APPLIANCE_ICONS[key]} {label}
                  </option>
                ))}
              </select>

              <select
                value={careFilter}
                onChange={(e) => setCareFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">Care Plan: All</option>
                <option value="COVERED">Covered Plans</option>
                <option value="PENDING_LOCATION">Pending Location</option>
                <option value="NOT_COVERED">Standard Only</option>
              </select>

              <select
                value={valetFilter}
                onChange={(e) => setValetFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">Valet: All</option>
                <option value="DUE">Valet Due</option>
                <option value="BOOKED">Booked</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>
          </div>

          {/* Appliances Table */}
          {loading ? (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-400 mb-3" />
              <span>Loading appliance records...</span>
            </div>
          ) : filteredAppliances.length === 0 ? (
            <div className="bg-slate-900/90 border border-dashed border-slate-800 rounded-2xl p-12 text-center space-y-3">
              <Sparkles className="w-10 h-10 text-slate-600 mx-auto" />
              <div className="text-sm font-bold text-slate-300">No appliances match filter</div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No appliance records matched your filter criteria. Click "Add Appliance" or check the Supplier Invoices tab.
              </p>
            </div>
          ) : (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="text-[10px] uppercase tracking-wider text-slate-400 bg-slate-950/80 border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-3.5">Appliance</th>
                      <th className="py-3 px-3.5">Property Location</th>
                      <th className="py-3 px-3.5">Model &amp; Serial</th>
                      <th className="py-3 px-3.5">Care &amp; Repair Plan</th>
                      <th className="py-3 px-3.5">Valet Status</th>
                      <th className="py-3 px-3.5">Purchase / Cost</th>
                      <th className="py-3 px-3.5">Receipt Link</th>
                      <th className="py-3 px-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {filteredAppliances.map((app) => {
                      const icon = APPLIANCE_ICONS[app.applianceType] || '🔌';
                      const isPendingLocation = app.propertyAssignmentStatus === 'PENDING_VERIFICATION' || !app.propertyId;
                      const hasCarePlan = app.serviceAgreement?.hasAgreement || app.currysCareAndRepair?.hasPlan;
                      const valetStatus = app.squeakyCleanValet?.eligibilityStatus || 'NOT_VERIFIED';

                      return (
                        <tr key={app._id} className="hover:bg-slate-850/50 transition">
                          <td className="py-3 px-3.5">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{icon}</span>
                              <div>
                                <div className="font-bold text-white flex items-center gap-1.5">
                                  <span>{app.name}</span>
                                </div>
                                <span className="text-[10px] text-slate-500">
                                  {APPLIANCE_TYPE_TITLES[app.applianceType] || app.applianceType}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-3.5">
                            {isPendingLocation ? (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>Pending Verification</span>
                                </span>
                                <div>
                                  <button
                                    onClick={() => {
                                      setAssignModalAppliance(app);
                                      setSelectedAssignPropertyId('');
                                      setAssignNotes('');
                                    }}
                                    className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                                  >
                                    Assign to Property &rarr;
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="flex items-center gap-1.5 font-medium text-slate-200">
                                  <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                  <span className="truncate max-w-[140px]">
                                    {app.propertyId?.name || 'Property'}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-500 truncate max-w-[140px]">
                                  {app.propertyId?.postcode || app.propertyId?.city || 'UK'}
                                </div>
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3.5">
                            <div className="font-medium text-slate-200">
                              {app.brand || 'Unbranded'} {app.modelNumber || ''}
                            </div>
                            <div className="text-[10px] mt-0.5 space-y-0.5">
                              {app.serialNumber ? (
                                <span className="font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                                  S/N: {app.serialNumber}
                                </span>
                              ) : (
                                <span className="text-rose-400 font-semibold bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                                  S/N Unverified
                                </span>
                              )}
                              {app.itemCode && (
                                <span className="text-[9px] text-slate-500 block">
                                  Item Code: {app.itemCode}
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-3.5">
                            {hasCarePlan ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                  <ShieldCheck className="w-3 h-3" />
                                  <span>{app.serviceAgreement?.durationYears || 5}-Year Care Plan</span>
                                </span>
                                {(app.serviceAgreement?.agreementReference || app.currysCareAndRepair?.planReferenceNumber) && (
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    Ref: {app.serviceAgreement?.agreementReference || app.currysCareAndRepair?.planReferenceNumber}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] font-medium text-slate-500">
                                Standard Warranty
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-3.5">
                            <span
                              className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                valetStatus === 'DUE'
                                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                  : valetStatus === 'BOOKED'
                                  ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                                  : valetStatus === 'COMPLETED'
                                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                  : valetStatus === 'ELIGIBLE'
                                  ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}
                            >
                              {valetStatus.replace('_', ' ')}
                            </span>
                            {app.squeakyCleanValet?.nextValetDueDate && (
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                Due: {formatUKDate(app.squeakyCleanValet.nextValetDueDate)}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3.5">
                            <div className="font-bold text-white tabular-nums">
                              {formatGBP(app.purchasePrice || 0)}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {app.supplier || 'Currys'}
                            </div>
                            {app.careServicesChargeGBP > 0 && (
                              <div className="text-[9px] text-amber-400/90 font-medium">
                                +{formatGBP(app.careServicesChargeGBP)} Care
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-3.5">
                            {app.supplierReceiptId ? (
                              <div className="text-[10px] text-indigo-300 font-medium">
                                <span>{app.supplierReceiptId.supplier} #{app.supplierReceiptId.receiptNumber}</span>
                              </div>
                            ) : app.documents && app.documents.length > 0 ? (
                              <a
                                href={app.documents[0].url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-400 hover:text-indigo-300"
                              >
                                <FileText className="w-3 h-3" />
                                <span>{app.documents.length} File{app.documents.length > 1 ? 's' : ''}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            ) : (
                              <button
                                onClick={() => setUploadModalAppliance(app)}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 hover:text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 cursor-pointer"
                              >
                                <Upload className="w-3 h-3" />
                                <span>Attach Receipt</span>
                              </button>
                            )}
                          </td>

                          <td className="py-3 px-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isPendingLocation && (
                                <button
                                  onClick={() => {
                                    setAssignModalAppliance(app);
                                    setSelectedAssignPropertyId('');
                                    setAssignNotes('');
                                  }}
                                  className="p-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 transition cursor-pointer"
                                  title="Assign to Property"
                                >
                                  <MapPin className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => setUploadModalAppliance(app)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                                title="Upload Receipt / Document"
                              >
                                <Upload className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleOpenEdit(app)}
                                className="p-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 transition cursor-pointer"
                                title="Edit Appliance"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteAppliance(app._id)}
                                className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 transition cursor-pointer"
                                title="Delete Appliance"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SUPPLIER RECEIPTS & INVOICES */}
      {activeTab === 'receipts' && (
        <div className="space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-indigo-400" />
                  <span>Master Supplier Invoices &amp; Verified Purchase Receipts</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Single master receipts covering multiple appliances without creating duplicate records or unverified bank payments.
                </p>
              </div>

              <button
                onClick={() => setShowReceiptModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Record Supplier Invoice</span>
              </button>
            </div>

            {receipts.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No supplier receipts recorded.
              </div>
            ) : (
              <div className="space-y-4">
                {receipts.map((r) => {
                  const pay = r.paymentInformation || {};

                  return (
                    <div
                      key={r._id}
                      className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center text-lg font-bold">
                            🧾
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-white text-sm">
                                {r.supplier} — Receipt #{r.receiptNumber}
                              </span>
                              {r.branch && (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
                                  Branch: {r.branch}
                                </span>
                              )}
                              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                                Verified Source Record
                              </span>
                            </div>
                            <span className="text-xs text-slate-400 mt-0.5 block">
                              Receipt Date: {formatUKDate(r.receiptDate)}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-[10px] text-slate-400 uppercase font-semibold">Total Amount Due</div>
                          <div className="text-lg font-black text-white tabular-nums font-display">
                            {formatGBP(r.totalAmountDueGBP)}
                          </div>
                        </div>
                      </div>

                      {/* Payment Terms Breakdown Strip */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/60">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Card Settlement</span>
                          <span className="text-sm font-bold text-slate-200 mt-0.5 block">
                            {formatGBP(pay.cardPaymentGBP || 0)}
                          </span>
                          <span className="text-[10px] text-slate-500">Upfront payment</span>
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Direct Debit Mandate</span>
                          {pay.directDebitMandate?.hasMandate ? (
                            <div>
                              <span className="text-sm font-bold text-amber-400 mt-0.5 block">
                                {pay.directDebitMandate.numberOfInstalments} × {formatGBP(pay.directDebitMandate.monthlyInstalmentGBP)}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                Total: {formatGBP(pay.directDebitMandate.totalMandateGBP)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 mt-0.5 block">No Instalment Mandate</span>
                          )}
                        </div>

                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Financial Ledger Status</span>
                          <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30 mt-1">
                            SOURCE_RECORD_ONLY (Unposted)
                          </span>
                          <span className="text-[10px] text-slate-500 block mt-0.5">Zero double-counting</span>
                        </div>
                      </div>

                      {/* Linked Appliances Covered */}
                      <div className="space-y-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                          Covered Appliances on This Receipt ({r.linkedAppliances?.length || 0})
                        </span>

                        {r.linkedAppliances && r.linkedAppliances.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {r.linkedAppliances.map((item) => (
                              <div
                                key={item._id}
                                className="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between"
                              >
                                <div>
                                  <span className="font-bold text-white text-xs block">{item.name}</span>
                                  <span className="text-[10px] text-slate-400">
                                    {item.propertyId?.name ? `Location: ${item.propertyId.name}` : 'Location: Pending Verification'}
                                  </span>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs font-extrabold text-slate-200 block">
                                    {formatGBP(item.purchasePrice)}
                                  </span>
                                  {item.careServicesChargeGBP > 0 && (
                                    <span className="text-[10px] text-amber-400 block">
                                      +{formatGBP(item.careServicesChargeGBP)} Care
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500 italic p-2">
                            No individual appliances linked yet.
                          </div>
                        )}
                      </div>

                      {r.notes && (
                        <p className="text-xs text-slate-400 italic border-t border-slate-800/60 pt-2">
                          "{r.notes}"
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: WARRANTY & EXPIRY REMINDERS */}
      {activeTab === 'reminders' && (
        <div className="space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Bell className="w-4 h-4 text-rose-400" />
                  <span>Warranty, Care Contract &amp; Service Reminders</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Proactive tracking of expiring warranties, service plans, missing documents, and unassigned property locations.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-semibold">Look Ahead:</span>
                <select
                  value={reminderDays}
                  onChange={(e) => setReminderDays(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                >
                  <option value="30">Next 30 Days</option>
                  <option value="60">Next 60 Days</option>
                  <option value="90">Next 90 Days</option>
                </select>
              </div>
            </div>

            {reminders.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <span>All warranties and care plans are up to date within the selected window.</span>
              </div>
            ) : (
              <div className="space-y-2.5">
                {reminders.map((rem, i) => {
                  const isUrgent = rem.severity === 'URGENT';
                  const isHigh = rem.severity === 'HIGH';

                  return (
                    <div
                      key={i}
                      className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isUrgent
                          ? 'bg-rose-500/10 border-rose-500/30'
                          : isHigh
                          ? 'bg-amber-500/10 border-amber-500/30'
                          : 'bg-slate-950/60 border-slate-800'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {isUrgent ? (
                            <AlertTriangle className="w-4 h-4 text-rose-400" />
                          ) : (
                            <Clock className="w-4 h-4 text-amber-400" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white text-xs">{rem.title}</span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                isUrgent
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                  : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              }`}
                            >
                              {rem.severity}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{rem.message}</p>
                        </div>
                      </div>

                      {rem.dueDate && (
                        <div className="text-right text-[11px] text-slate-400 shrink-0">
                          <div>Expiry / Due</div>
                          <div className="text-slate-200 font-bold">{formatUKDate(rem.dueDate)}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: VALET & SERVICE CALENDAR */}
      {activeTab === 'calendar' && (
        <div className="space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-400" />
                  <span>Annual Squeaky Clean Valet Schedule</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Currys Care &amp; Repair includes an annual valet service for household washing machines, tumble dryers, dishwashers, cookers, and fridges.
                </p>
              </div>
              <a
                href="tel:03448006080"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold hover:bg-amber-500/20 transition cursor-pointer self-start sm:self-auto"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Book Valet: 0344 800 6080</span>
              </a>
            </div>

            {appliances.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No appliances registered to display valet schedules.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {appliances.map((app) => {
                  const valet = app.squeakyCleanValet;
                  const isDue = valet?.eligibilityStatus === 'DUE';
                  const isBooked = valet?.eligibilityStatus === 'BOOKED';

                  return (
                    <div
                      key={app._id}
                      className={`p-4 rounded-xl border transition ${
                        isDue
                          ? 'bg-amber-500/5 border-amber-500/30'
                          : isBooked
                          ? 'bg-blue-500/5 border-blue-500/30'
                          : 'bg-slate-950/60 border-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{APPLIANCE_ICONS[app.applianceType] || '🔌'}</span>
                          <div>
                            <span className="font-bold text-white text-xs block">{app.name}</span>
                            <span className="text-[10px] text-slate-400">
                              {app.propertyId?.name || 'Pending Location'}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                            valet?.eligibilityStatus === 'DUE'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : valet?.eligibilityStatus === 'BOOKED'
                              ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                              : valet?.eligibilityStatus === 'COMPLETED'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {valet?.eligibilityStatus || 'NOT VERIFIED'}
                        </span>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-800/60 space-y-1 text-xs">
                        <div className="flex justify-between text-slate-400 text-[11px]">
                          <span>Next Valet Due:</span>
                          <span className="font-semibold text-slate-200">
                            {valet?.nextValetDueDate ? formatUKDate(valet.nextValetDueDate) : 'Not Scheduled'}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-400 text-[11px]">
                          <span>Last Completed:</span>
                          <span className="text-slate-300">
                            {valet?.lastValetDate ? formatUKDate(valet.lastValetDate) : 'None'}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 pt-2 flex items-center justify-between">
                        <button
                          onClick={() => handleOpenEdit(app)}
                          className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 cursor-pointer flex items-center gap-1"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Update Valet Record</span>
                        </button>

                        <a
                          href="tel:03448006080"
                          className="text-[10px] font-bold text-amber-400 hover:text-amber-300 cursor-pointer flex items-center gap-1"
                        >
                          <Phone className="w-2.5 h-2.5" />
                          <span>Call Currys</span>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: ACTION CHECKLIST */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-indigo-400" />
                  <span>Appliance Maintenance &amp; Audit Responsibilities</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Interactive operational action checklist for property appliance registers, Currys Care validation, and valet coordination.
                </p>
              </div>

              <button
                onClick={() => setShowTaskModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Task Item</span>
              </button>
            </div>

            {/* Tasks List */}
            {tasks.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No tasks available.
              </div>
            ) : (
              <div className="space-y-2.5">
                {tasks.map((task) => {
                  const isDone = task.status === 'COMPLETED';
                  const isInProg = task.status === 'IN_PROGRESS';

                  return (
                    <div
                      key={task._id}
                      className={`p-3.5 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isDone
                          ? 'bg-emerald-950/20 border-emerald-500/20 opacity-75'
                          : isInProg
                          ? 'bg-blue-950/20 border-blue-500/30'
                          : 'bg-slate-950/60 border-slate-800/80'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => handleToggleTaskStatus(task)}
                          className="mt-0.5 text-slate-400 hover:text-white transition cursor-pointer"
                          title="Click to cycle task status"
                        >
                          {isDone ? (
                            <CheckSquare className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-500" />
                          )}
                        </button>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-xs font-bold ${
                                isDone ? 'text-slate-400 line-through' : 'text-white'
                              }`}
                            >
                              {task.title}
                            </span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                task.priority === 'URGENT'
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                  : task.priority === 'HIGH'
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}
                            >
                              {task.priority}
                            </span>
                            {task.assignedTo && (
                              <span className="text-[10px] text-indigo-400 font-semibold">
                                Assignee: {task.assignedTo}
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-400 max-w-2xl">
                            {task.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                        <button
                          onClick={() => handleToggleTaskStatus(task)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                            isDone
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : isInProg
                              ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
                          }`}
                        >
                          {task.status.replace('_', ' ')}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: TENANT NOTICES */}
      {activeTab === 'access' && (
        <div className="space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-indigo-400" />
                <span>Tenant Access Notices &amp; Valet Visit Logs</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Under UK Tenancy Law (Housing Act 1988), landlords must serve at least 24 hours' written notice before engineers or cleaners enter the premises for appliance maintenance.
              </p>
            </div>

            {appliances.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No appliances registered.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {appliances.map((app) => {
                  const notice = app.tenantAccessNotice;
                  const status = notice?.accessStatus || 'NOT_NOTIFIED';

                  return (
                    <div
                      key={app._id}
                      className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-white text-xs flex items-center gap-1.5">
                            <span>{APPLIANCE_ICONS[app.applianceType] || '🔌'}</span>
                            <span>{app.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-400">
                            Property: {app.propertyId?.name || 'Pending Location'}
                          </span>
                        </div>

                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                            status === 'TENANT_CONFIRMED'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : status === 'NOTICE_SENT'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {status.replace(/_/g, ' ')}
                        </span>
                      </div>

                      <div className="flex items-center justify-end">
                        <button
                          onClick={() => handleOpenEdit(app)}
                          className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 cursor-pointer"
                        >
                          Update Notice Details &rarr;
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 7: CURRYS DIRECTORY & GUIDE */}
      {activeTab === 'currys' && (
        <div className="space-y-5">
          <div className="bg-gradient-to-r from-slate-900 to-indigo-950/40 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-2xl">
                📞
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Currys Care &amp; Repair Official Directory</h3>
                <p className="text-xs text-slate-400">
                  Direct phone lines and customer support extracted from official Currys Care &amp; Repair documentation.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Customer Service &amp; Valet Booking</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">Standard Line</span>
                </div>
                <div className="text-xl font-extrabold text-amber-400 font-mono">
                  0344 800 6080
                </div>
                <p className="text-[11px] text-slate-400">
                  Call to report an appliance breakdown, book an annual Squeaky Clean Valet, or check active plan status.
                </p>
                <a
                  href="tel:03448006080"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-400 hover:text-indigo-300 pt-1"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call 0344 800 6080</span>
                </a>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">7-Day Fix Claim Hotline</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold">Freephone Guarantee</span>
                </div>
                <div className="text-xl font-extrabold text-indigo-400 font-mono">
                  0800 0121 909
                </div>
                <p className="text-[11px] text-slate-400">
                  Call if a repair has taken more than 7 days from engineer visit to claim a brand new replacement.
                </p>
                <a
                  href="tel:08000121909"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-400 hover:text-indigo-300 pt-1"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call 0800 0121 909</span>
                </a>
              </div>
            </div>

            {/* Official Care & Repair Key Inclusions from Leaflet */}
            <div className="mt-4 pt-4 border-t border-slate-800 space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Brochure Policy Benefits &amp; Key Inclusions</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>7 Day Fix Promise</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    If repair takes more than 7 calendar days from engineer visit, request an immediate replacement.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Replacement Guarantee</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    If unrepairable, receive a Currys gift card for equivalent spec product. If &gt;2 breakdowns, request a replacement regardless of whether faults are related.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>£0 Parts, Labour &amp; Call Outs</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    100% covered. Zero repair bills, no charges even if no fault found. Free delivery, installation &amp; recycling if replacement needed.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    <span>Annual Squeaky Clean Valet</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Annual deep clean included for eligible household appliances (washing machines, dryers, dishwashers, cookers, fridges/freezers).
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>24/7 Tech &amp; Fault Support</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Call 0800 0121 909 anytime for technical assistance, fault logging, or replacement authorization.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1">
                  <div className="font-bold text-white flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span>Official Portal &amp; Post</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    currys.co.uk/careandrepair · Postal: Currys Care Services, PO Box 194, Cramlington, NE23 0DA.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Add/Edit Appliance Modal */}
      <ApplianceModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingAppliance={editingAppliance}
        onSuccess={() => loadData(true)}
      />

      {/* Quick Assign Property Modal */}
      {assignModalAppliance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-400" />
                <span>Confirm Property Assignment</span>
              </h3>
              <button
                onClick={() => setAssignModalAppliance(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Appliance: <span className="font-bold text-white">{assignModalAppliance.name}</span>
            </p>
            <p className="text-[11px] text-slate-400">
              Select the property where this appliance is physically located once confirmed.
            </p>

            <form onSubmit={handleAssignPropertySubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Target Property *</label>
                <select
                  required
                  value={selectedAssignPropertyId}
                  onChange={(e) => setSelectedAssignPropertyId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Select Property...</option>
                  {properties.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name} ({p.postcode || p.city})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Confirmation Notes (Optional)</label>
                <textarea
                  rows="2"
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  placeholder="e.g. Verified installed in Ground Floor Kitchen"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAssignModalAppliance(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigning || !selectedAssignPropertyId}
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {assigning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Assignment</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Supplier Receipt Modal */}
      {showReceiptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-indigo-400" />
                <span>Record Master Supplier Invoice / Receipt</span>
              </h3>
              <button
                onClick={() => setShowReceiptModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] text-slate-400">
              Master supplier receipts are stored strictly as source records without generating unverified financial transactions.
            </p>

            <form onSubmit={handleCreateReceiptSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Supplier *</label>
                  <input
                    type="text"
                    required
                    value={receiptForm.supplier}
                    onChange={(e) => setReceiptForm({ ...receiptForm, supplier: e.target.value })}
                    placeholder="e.g. Currys, Howdens"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Branch / Store</label>
                  <input
                    type="text"
                    value={receiptForm.branch}
                    onChange={(e) => setReceiptForm({ ...receiptForm, branch: e.target.value })}
                    placeholder="e.g. 2234 Chingford"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Receipt / Invoice Number *</label>
                  <input
                    type="text"
                    required
                    value={receiptForm.receiptNumber}
                    onChange={(e) => setReceiptForm({ ...receiptForm, receiptNumber: e.target.value })}
                    placeholder="e.g. 159485"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Receipt Date *</label>
                  <input
                    type="date"
                    required
                    value={receiptForm.receiptDate}
                    onChange={(e) => setReceiptForm({ ...receiptForm, receiptDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Total Amount Due (£) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={receiptForm.totalAmountDueGBP}
                    onChange={(e) => setReceiptForm({ ...receiptForm, totalAmountDueGBP: e.target.value })}
                    placeholder="e.g. 682.35"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Card Payment Amount (£)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={receiptForm.cardPaymentGBP}
                    onChange={(e) => setReceiptForm({ ...receiptForm, cardPaymentGBP: e.target.value })}
                    placeholder="e.g. 498.15"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <label className="flex items-center gap-2 text-slate-300 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={receiptForm.hasMandate}
                    onChange={(e) => setReceiptForm({ ...receiptForm, hasMandate: e.target.checked })}
                    className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
                  />
                  <span>Includes Direct Debit Instalment Mandate</span>
                </label>

                {receiptForm.hasMandate && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-slate-400 text-[11px] mb-1">Monthly Instalment (£)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={receiptForm.monthlyInstalmentGBP}
                        onChange={(e) => setReceiptForm({ ...receiptForm, monthlyInstalmentGBP: e.target.value })}
                        placeholder="e.g. 18.42"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 text-[11px] mb-1">Number of Instalments</label>
                      <input
                        type="number"
                        value={receiptForm.numberOfInstalments}
                        onChange={(e) => setReceiptForm({ ...receiptForm, numberOfInstalments: e.target.value })}
                        placeholder="e.g. 10"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Notes / Item Details</label>
                <textarea
                  rows="2"
                  value={receiptForm.notes}
                  onChange={(e) => setReceiptForm({ ...receiptForm, notes: e.target.value })}
                  placeholder="Includes delivery, discounts, Care Services charges..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowReceiptModal(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition cursor-pointer"
                >
                  Record Source Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Upload Modal */}
      {uploadModalAppliance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-indigo-400" />
                <span>Upload Currys / Howdens Document</span>
              </h3>
              <button
                onClick={() => setUploadModalAppliance(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Appliance: <span className="font-bold text-white">{uploadModalAppliance.name}</span>
            </p>

            {uploadError && (
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {uploadError}
              </div>
            )}

            <form onSubmit={handleQuickUploadSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Document Category</label>
                <select
                  value={uploadDocType}
                  onChange={(e) => setUploadDocType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="PURCHASE_RECEIPT">Supplier Purchase Receipt / Invoice</option>
                  <option value="CARE_REPAIR_AGREEMENT">Care &amp; Repair Plan Agreement</option>
                  <option value="EXTENDED_WARRANTY_CERT">Extended Warranty Certificate</option>
                  <option value="MANUFACTURER_WARRANTY_DOC">Manufacturer Warranty Documentation</option>
                  <option value="SERVICE_CONTRACT">Service &amp; Maintenance Contract</option>
                  <option value="TERMS_AND_CONDITIONS">Terms and Conditions</option>
                  <option value="INSTALLATION_DOC">Installation Document</option>
                  <option value="REPAIR_INVOICE">Repair Invoice &amp; Service Report</option>
                  <option value="VALET_REPORT">Squeaky Clean Valet Report</option>
                  <option value="OTHER">Other Document</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Select File (PDF, PNG, JPG)</label>
                <input
                  type="file"
                  required
                  accept=".pdf,image/png,image/jpeg,image/webp"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setUploadModalAppliance(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !uploadFile}
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {uploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Attach Document</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Wrench className="w-4 h-4 text-indigo-400" />
                <span>Add Maintenance Task</span>
              </h3>
              <button
                onClick={() => setShowTaskModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  placeholder="e.g. Audit kitchen appliances and match receipts"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Description</label>
                <textarea
                  rows="2"
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  placeholder="Details of the physical audit, booking, or receipt match..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Priority</label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="URGENT">Urgent</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Due Date</label>
                  <input
                    type="date"
                    value={taskForm.dueDate}
                    onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition cursor-pointer"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AppliancesPage;
