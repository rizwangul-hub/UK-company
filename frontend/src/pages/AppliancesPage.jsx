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
} from 'lucide-react';
import { formatGBP, formatUKDate } from '../utils/formatters.js';
import { appliancesAPI, propertiesAPI, triggerBlobDownload } from '../services/api.js';
import ApplianceModal from '../components/ApplianceModal.jsx';
import { APPLIANCE_ICONS, APPLIANCE_TYPE_TITLES } from '../components/PropertyAppliancesSection.jsx';

export function AppliancesPage({ selectedCompany }) {
  const [activeTab, setActiveTab] = useState('appliances'); // 'appliances' | 'calendar' | 'tasks' | 'access' | 'currys'
  const [appliances, setAppliances] = useState([]);
  const [properties, setProperties] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [currysContacts, setCurrysContacts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter States
  const [search, setSearch] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [careFilter, setCareFilter] = useState('ALL'); // 'ALL' | 'COVERED' | 'NOT_COVERED' | 'UNVERIFIED'
  const [valetFilter, setValetFilter] = useState('ALL'); // 'ALL' | 'DUE' | 'BOOKED' | 'COMPLETED'

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAppliance, setEditingAppliance] = useState(null);
  const [uploadModalAppliance, setUploadModalAppliance] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadDocType, setUploadDocType] = useState('PURCHASE_RECEIPT');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // New Maintenance Task Modal
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
      const [appRes, propRes, taskRes, contactRes] = await Promise.all([
        appliancesAPI.getAll({}, { forceRefresh: force }),
        propertiesAPI.getAll({}, { forceRefresh: force }),
        appliancesAPI.getTasks({ forceRefresh: force }),
        appliancesAPI.getCurrysContacts({ forceRefresh: force }),
      ]);

      if (appRes?.success) setAppliances(appRes.data || []);
      if (propRes?.success) setProperties(propRes.data?.properties || []);
      if (taskRes?.success) setTasks(taskRes.data || []);
      if (contactRes?.success) setCurrysContacts(contactRes.data || null);
    } catch (err) {
      console.error('Failed to load appliances & maintenance data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCompany?.id]);

  // Filtered Appliances
  const filteredAppliances = useMemo(() => {
    return appliances.filter((item) => {
      // Search
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchName = item.name?.toLowerCase().includes(q);
        const matchBrand = item.brand?.toLowerCase().includes(q);
        const matchModel = item.model?.toLowerCase().includes(q);
        const matchSerial = item.serialNumber?.toLowerCase().includes(q);
        const matchProp = item.propertyId?.name?.toLowerCase().includes(q);
        if (!matchName && !matchBrand && !matchModel && !matchSerial && !matchProp) return false;
      }
      // Property
      if (propertyFilter && item.propertyId?._id !== propertyFilter && item.propertyId !== propertyFilter) {
        return false;
      }
      // Type
      if (typeFilter && item.type !== typeFilter) {
        return false;
      }
      // Currys Care
      if (careFilter === 'COVERED' && !item.currysCarePlan?.hasCarePlan) return false;
      if (careFilter === 'NOT_COVERED' && item.currysCarePlan?.hasCarePlan) return false;
      if (careFilter === 'UNVERIFIED' && item.currysCarePlan?.planVerification !== 'NOT_VERIFIED') return false;
      // Valet Status
      if (valetFilter === 'DUE' && item.squeakyCleanValet?.eligibilityStatus !== 'DUE') return false;
      if (valetFilter === 'BOOKED' && item.squeakyCleanValet?.eligibilityStatus !== 'BOOKED') return false;
      if (valetFilter === 'COMPLETED' && item.squeakyCleanValet?.eligibilityStatus !== 'COMPLETED') return false;

      return true;
    });
  }, [appliances, search, propertyFilter, typeFilter, careFilter, valetFilter]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = appliances.length;
    const covered = appliances.filter((a) => a.currysCarePlan?.hasCarePlan).length;
    const valetDue = appliances.filter(
      (a) => a.squeakyCleanValet?.eligibilityStatus === 'DUE' || a.squeakyCleanValet?.eligibilityStatus === 'BOOKED'
    ).length;
    const pendingTasks = tasks.filter((t) => t.status !== 'COMPLETED').length;
    const missingSerial = appliances.filter((a) => !a.serialNumber || a.serialNumber.trim() === '').length;

    return { total, covered, valetDue, pendingTasks, missingSerial };
  }, [appliances, tasks]);

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
    if (!window.confirm('Are you sure you want to delete this appliance? All maintenance and valet records will be permanently removed.')) {
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

  // Maintenance Task Status Toggle
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
        assignedTo: taskForm.assignedTo || '',
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

  // Export CSV of Appliances & Valet Schedules
  const handleExportCSV = () => {
    if (appliances.length === 0) {
      alert('No appliances available to export.');
      return;
    }
    const headers = [
      'Property',
      'Appliance Name',
      'Type',
      'Brand',
      'Model',
      'Serial Number',
      'Supplier',
      'Purchase Date',
      'Purchase Price (£)',
      'Currys Care Plan',
      'Plan Type',
      'Care Plan Ref',
      'Valet Eligibility',
      'Annual Valet Due Date',
      'Last Valet Date',
      'Tenant Notice Status',
      'Documents Count',
    ];

    const rows = appliances.map((a) => [
      `"${a.propertyId?.name || 'Unassigned'}"`,
      `"${a.name || ''}"`,
      `"${APPLIANCE_TYPE_TITLES[a.type] || a.type}"`,
      `"${a.brand || ''}"`,
      `"${a.model || ''}"`,
      `"${a.serialNumber || 'UNVERIFIED'}"`,
      `"${a.supplier || ''}"`,
      `"${a.purchaseDate ? a.purchaseDate.substring(0, 10) : ''}"`,
      `"${a.purchasePrice || 0}"`,
      `"${a.currysCarePlan?.hasCarePlan ? 'YES' : 'NO'}"`,
      `"${a.currysCarePlan?.planType || ''}"`,
      `"${a.currysCarePlan?.planReferenceNumber || ''}"`,
      `"${a.squeakyCleanValet?.eligibilityStatus || 'NOT_VERIFIED'}"`,
      `"${a.squeakyCleanValet?.nextValetDueDate ? a.squeakyCleanValet.nextValetDueDate.substring(0, 10) : ''}"`,
      `"${a.squeakyCleanValet?.lastValetDate ? a.squeakyCleanValet.lastValetDate.substring(0, 10) : ''}"`,
      `"${a.tenantAccessNotice?.status || 'NOT_REQUIRED'}"`,
      `"${a.documents?.length || 0}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const filename = `${selectedCompany?.slug || 'company'}_appliances_and_valet_register_${new Date().toISOString().slice(0, 10)}.csv`;
    triggerBlobDownload(blob, filename);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 page-anim-slide-top">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-indigo-400" />
              <span>Appliances, Warranties &amp; Currys Care</span>
            </h1>
            {selectedCompany?.name && (
              <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {selectedCompany.name}
              </span>
            )}
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Currys Care &amp; Valet
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Complete property appliance register, Currys Care &amp; Repair tracking, Annual Squeaky Clean Valets, and operational maintenance workflow for {selectedCompany?.legalName || selectedCompany?.name || 'this portfolio'}.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-850 transition cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 hover:text-white hover:bg-slate-850 text-xs font-semibold transition cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export Register</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Appliance</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-medium uppercase tracking-wider">Total Appliances</span>
            <Sparkles className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-white mt-1 tabular-nums">
            {metrics.total}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Across {properties.length} properties</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-medium uppercase tracking-wider">Currys Care Plans</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1 tabular-nums">
            {metrics.covered}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {metrics.total > 0 ? `${Math.round((metrics.covered / metrics.total) * 100)}% coverage` : '0% coverage'}
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-medium uppercase tracking-wider">Valets Due</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-400 mt-1 tabular-nums">
            {metrics.valetDue}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Annual Squeaky Clean</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-medium uppercase tracking-wider">Action Tasks</span>
            <Wrench className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-blue-300 mt-1 tabular-nums">
            {metrics.pendingTasks}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Active action items</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-medium uppercase tracking-wider">Unverified Serials</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-rose-400 mt-1 tabular-nums">
            {metrics.missingSerial}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Needs physical check</div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('appliances')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'appliances'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Appliances Register ({appliances.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('calendar')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'calendar'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Valet &amp; Service Calendar</span>
        </button>

        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
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
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'access'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>Tenant Access Notices</span>
        </button>

        <button
          onClick={() => setActiveTab('currys')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
            activeTab === 'currys'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Phone className="w-3.5 h-3.5 text-amber-400" />
          <span>Currys Care Directory</span>
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
                placeholder="Search by appliance name, brand, model, serial number..."
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
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="">All Appliance Types</option>
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
                <option value="ALL">Currys Care: All</option>
                <option value="COVERED">Covered Only</option>
                <option value="NOT_COVERED">No Plan</option>
                <option value="UNVERIFIED">Unverified Only</option>
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

          {/* Appliances Table / Grid */}
          {loading ? (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-400 mb-3" />
              <span>Loading appliance records...</span>
            </div>
          ) : filteredAppliances.length === 0 ? (
            <div className="bg-slate-900/90 border border-dashed border-slate-800 rounded-2xl p-12 text-center space-y-3">
              <Sparkles className="w-10 h-10 text-slate-600 mx-auto" />
              <div className="text-sm font-bold text-slate-300">No appliances found</div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No appliance records matched your filter criteria. Click "Add Appliance" to record a washing machine, fridge freezer, boiler, cooker, or dishwasher.
              </p>
              <button
                onClick={handleOpenAdd}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Register First Appliance</span>
              </button>
            </div>
          ) : (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="text-[10px] uppercase tracking-wider text-slate-400 bg-slate-950/80 border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-3.5">Appliance</th>
                      <th className="py-3 px-3.5">Property</th>
                      <th className="py-3 px-3.5">Model &amp; Serial</th>
                      <th className="py-3 px-3.5">Currys Care Plan</th>
                      <th className="py-3 px-3.5">Valet Status</th>
                      <th className="py-3 px-3.5">Purchase / Cost</th>
                      <th className="py-3 px-3.5">Receipt / Docs</th>
                      <th className="py-3 px-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {filteredAppliances.map((app) => {
                      const icon = APPLIANCE_ICONS[app.type] || '🔌';
                      const hasPlan = app.currysCarePlan?.hasCarePlan;
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
                                  {APPLIANCE_TYPE_TITLES[app.type] || app.type}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-3.5">
                            <div className="flex items-center gap-1.5 font-medium text-slate-200">
                              <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              <span className="truncate max-w-[140px]">
                                {app.propertyId?.name || 'Unassigned Property'}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 truncate max-w-[140px]">
                              {app.propertyId?.city || 'UK'}
                            </div>
                          </td>

                          <td className="py-3 px-3.5">
                            <div className="font-medium text-slate-200">
                              {app.brand || 'Unbranded'} {app.model || ''}
                            </div>
                            <div className="text-[10px] mt-0.5">
                              {app.serialNumber ? (
                                <span className="font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                                  S/N: {app.serialNumber}
                                </span>
                              ) : (
                                <span className="text-rose-400 font-semibold bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20">
                                  S/N Unverified
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-3.5">
                            {hasPlan ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                  <ShieldCheck className="w-3 h-3" />
                                  <span>{app.currysCarePlan.planType?.replace('_', ' ') || 'Covered'}</span>
                                </span>
                                {app.currysCarePlan.planReferenceNumber && (
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    Ref: {app.currysCarePlan.planReferenceNumber}
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
                          </td>

                          <td className="py-3 px-3.5">
                            {app.documents && app.documents.length > 0 ? (
                              <div className="space-y-1">
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
                              </div>
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

      {/* TAB 2: VALET & SERVICE CALENDAR */}
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
              <div className="flex items-center gap-2">
                <a
                  href="tel:03448006080"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold hover:bg-amber-500/20 transition cursor-pointer"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Book Valet: 0344 800 6080</span>
                </a>
              </div>
            </div>

            {appliances.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No appliances registered to display valet schedules.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {appliances.map((app) => {
                  const valet = app.squeakyCleanValet;
                  const isEligible = valet?.eligibilityStatus !== 'NOT_ELIGIBLE';
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
                          <span className="text-xl">{APPLIANCE_ICONS[app.type] || '🔌'}</span>
                          <div>
                            <span className="font-bold text-white text-xs block">{app.name}</span>
                            <span className="text-[10px] text-slate-400">
                              {app.propertyId?.name || 'Property'}
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
                        {valet?.engineerNotes && (
                          <div className="text-[10px] text-slate-400 italic pt-1">
                            "{valet.engineerNotes}"
                          </div>
                        )}
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

      {/* TAB 3: OPERATIONAL ACTION CHECKLIST */}
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
                No tasks available. Seeded maintenance responsibilities will be loaded automatically.
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

                          {task.notes && (
                            <div className="text-[10px] text-slate-500 italic">
                              Note: {task.notes}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Status Toggle & Due Date */}
                      <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                        {task.dueDate && (
                          <div className="text-right text-[10px] text-slate-400">
                            <div>Due Date</div>
                            <div className="text-slate-200 font-medium">{formatUKDate(task.dueDate)}</div>
                          </div>
                        )}

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

      {/* TAB 4: TENANT ACCESS NOTICES */}
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
                  const status = notice?.status || 'NOT_REQUIRED';

                  return (
                    <div
                      key={app._id}
                      className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-white text-xs flex items-center gap-1.5">
                            <span>{APPLIANCE_ICONS[app.type] || '🔌'}</span>
                            <span>{app.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-400">
                            Property: {app.propertyId?.name || 'Unassigned'}
                          </span>
                        </div>

                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                            status === 'ACCESS_CONFIRMED'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : status === 'NOTICE_SERVED'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : status === 'TENANT_RESCHEDULED'
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {status.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/60">
                        <div className="flex justify-between text-slate-400 text-[11px]">
                          <span>Notice Served Date:</span>
                          <span className="text-slate-200 font-medium">
                            {notice?.noticeServedDate ? formatUKDate(notice.noticeServedDate) : 'Not Served'}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-400 text-[11px]">
                          <span>Scheduled Visit Date:</span>
                          <span className="text-slate-200 font-medium">
                            {notice?.scheduledVisitDate ? formatUKDate(notice.scheduledVisitDate) : 'TBD'}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-400 text-[11px]">
                          <span>Time Slot:</span>
                          <span className="text-slate-200 font-medium">{notice?.timeSlot || 'Morning (8am - 12pm)'}</span>
                        </div>
                        {notice?.notes && (
                          <div className="text-[10px] text-slate-400 italic pt-1">
                            Notes: {notice.notes}
                          </div>
                        )}
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

      {/* TAB 5: CURRYS DIRECTORY & GUIDE */}
      {activeTab === 'currys' && (
        <div className="space-y-5">
          {/* Official Hotlines Card */}
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
                  <span className="text-xs font-bold text-white">General Customer Service</span>
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
                  Call if a repair has taken more than 7 days from engineer visit to claim a brand new replacement or voucher.
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
          </div>

          {/* Official Currys Leaflet Breakdown Guide */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                <span>What Is Covered by Currys Care &amp; Repair?</span>
              </h4>
              <ul className="text-xs text-slate-300 space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>7-Day Fix Promise:</strong> If Currys cannot repair your product within 7 days, you can request a brand new replacement.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>No Repair Bills:</strong> Never pay a penny for parts, labour, or call-out charges.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Annual Squeaky Clean Valet:</strong> Included each year on eligible household appliances to keep them running efficiently.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span><strong>Flexible Terms:</strong> Pay monthly rolling or pay upfront for 2, 3, or 5 years.</span>
                </li>
              </ul>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                <span>Official Squeaky Clean Valet Checklists</span>
              </h4>
              <div className="space-y-2 text-xs text-slate-300">
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/60">
                  <span className="font-bold text-white block">🫧 Washing Machines &amp; Washer Dryers:</span>
                  <span className="text-[11px] text-slate-400">
                    Clean inside &amp; outside, soap drawer, door and seal, fluff removal from vents, and full descaling cycle.
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/60">
                  <span className="font-bold text-white block">❄️ Fridges, Freezers &amp; Fridge Freezers:</span>
                  <span className="text-[11px] text-slate-400">
                    Defrost where applicable, dry interior, clean racks, trays, shelves, seals, apply antibacterial protection, check water filters.
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/60">
                  <span className="font-bold text-white block">🍽️ Dishwashers:</span>
                  <span className="text-[11px] text-slate-400">
                    Clean inside/outside, filter clean, check waste blockages, clear food particles from seal, run cleaning cycle.
                  </span>
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

      {/* Quick Upload Modal */}
      {uploadModalAppliance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-indigo-400" />
                <span>Upload Currys Receipt / Document</span>
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
                  <option value="PURCHASE_RECEIPT">Currys Purchase Receipt</option>
                  <option value="CARE_REPAIR_PLAN">Care &amp; Repair Plan Certificate</option>
                  <option value="VALET_REPORT">Squeaky Clean Valet Report</option>
                  <option value="INVOICE">Supplier Invoice</option>
                  <option value="WARRANTY_CERT">Manufacturer Warranty</option>
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

      {/* Add Maintenance Task Modal */}
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
                  placeholder="e.g. Inspect washing machine seals at 24 Old Street"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Description</label>
                <textarea
                  rows="2"
                  value={taskForm.description}
                  onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                  placeholder="Details of the physical check, Currys booking or receipt match..."
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

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Linked Property (Optional)</label>
                <select
                  value={taskForm.propertyId}
                  onChange={(e) => setTaskForm({ ...taskForm, propertyId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">General / All Properties</option>
                  {properties.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                </select>
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
