import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  FileText,
  AlertTriangle,
  Clock,
  Plus,
  Upload,
  Download,
  Trash2,
  RefreshCw,
  Search,
  ExternalLink,
  History,
  Building,
  CheckCircle2,
  AlertCircle,
  Calendar,
  X,
  FileSpreadsheet,
  FileCode,
  Layers,
  Flame,
  Zap,
  Tag,
  ChevronRight,
  Send,
  Mail,
  Eye,
  Loader2,
} from 'lucide-react';
import { formatUKDate } from '../utils/formatters.js';
import { complianceAPI } from '../services/api.js';
import { ModalPortal } from './ModalPortal.jsx';

export const COMPLIANCE_CATEGORIES = [
  { id: 'ALL', label: 'All Documents', icon: Layers, countKey: 'all' },
  { id: 'INSURANCE', label: 'Insurance Documents', icon: ShieldCheck, subtext: 'Building & contents policies' },
  { id: 'SAFETY_COMPLIANCE', label: 'Safety & Compliance', icon: Flame, subtext: 'Gas CP12, EICR, EPC, Fire' },
  { id: 'LEGAL_PURCHASE', label: 'Legal & Purchase', icon: FileText, subtext: 'Title deeds, contracts, registry' },
  { id: 'DRAWINGS_STRUCTURAL', label: 'Drawings & Structural', icon: FileCode, subtext: 'Architectural, floor plans, CAD' },
  { id: 'COUNCIL_LICENSING', label: 'Council & Licensing', icon: Building, subtext: 'HMO, selective, planning, notices' },
  { id: 'APPLIANCE_EQUIPMENT', label: 'Appliance & Equipment', icon: Zap, subtext: 'Currys, Care & Repair, boiler' },
];

export function PropertyComplianceSection({ propertyId, propertyName, onRefreshParent }) {
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [linkedApplianceDocs, setLinkedApplianceDocs] = useState([]);
  const [councilApps, setCouncilApps] = useState([]);

  // Modals
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [versionModalDoc, setVersionModalDoc] = useState(null);
  const [historyModalDoc, setHistoryModalDoc] = useState(null);
  const [councilModalOpen, setCouncilModalOpen] = useState(false);
  const [correspondenceModalApp, setCorrespondenceModalApp] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  // Upload Form State
  const [formCategory, setFormCategory] = useState('SAFETY_COMPLIANCE');
  const [formSubCategory, setFormSubCategory] = useState('Gas Safety Certificate (CP12)');
  const [formTitle, setFormTitle] = useState('');
  const [formProvider, setFormProvider] = useState('');
  const [formRefNumber, setFormRefNumber] = useState('');
  const [formIssueDate, setFormIssueDate] = useState('');
  const [formExpiryDate, setFormExpiryDate] = useState('');
  const [formEpcRating, setFormEpcRating] = useState('C');
  const [formNotes, setFormNotes] = useState('');
  const [formIsMissing, setFormIsMissing] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  // Version Renewal Form State
  const [versionFile, setVersionFile] = useState(null);
  const [versionIssueDate, setVersionIssueDate] = useState('');
  const [versionExpiryDate, setVersionExpiryDate] = useState('');
  const [versionProvider, setVersionProvider] = useState('');
  const [versionRefNumber, setVersionRefNumber] = useState('');
  const [versionNotes, setVersionNotes] = useState('');

  // Council Application Form State
  const [councilType, setCouncilType] = useState('HMO_LICENCE');
  const [councilName, setCouncilName] = useState('Local Authority Council');
  const [councilTitle, setCouncilTitle] = useState('');
  const [councilRef, setCouncilRef] = useState('');
  const [councilDeadline, setCouncilDeadline] = useState('');
  const [councilFee, setCouncilFee] = useState('');
  const [councilDesc, setCouncilDesc] = useState('');

  // Council Correspondence Form State
  const [corrSummary, setCorrSummary] = useState('');
  const [corrType, setCorrType] = useState('INCOMING_LETTER');
  const [corrSender, setCorrSender] = useState('');
  const [corrDate, setCorrDate] = useState(new Date().toISOString().slice(0, 10));
  const [corrFile, setCorrFile] = useState(null);

  // Email Notification Quick Status
  const [attachedEmail, setAttachedEmail] = useState('');
  const [emailCheckLoading, setEmailCheckLoading] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState('');

  const loadEmailAlertStatus = async () => {
    try {
      const res = await complianceAPI.getEmailSettings();
      if (res?.success && res.data) {
        setAttachedEmail(res.data.recipientEmail || '');
      }
    } catch (e) {
      // ignore
    }
  };

  const handleRunEmailAlerts = async () => {
    setEmailCheckLoading(true);
    setEmailFeedback('');
    try {
      const res = await complianceAPI.checkExpiryEmailsNow({ forceSend: false });
      if (res?.success) {
        setEmailFeedback(`Expiry check complete! Evaluated: ${res.data?.evaluatedCount || 0} documents. ${res.data?.emailsSent || 0} alert email(s) sent.`);
      }
    } catch (err) {
      setEmailFeedback('Failed to dispatch expiry emails: ' + (err.response?.data?.message || err.message));
    } finally {
      setEmailCheckLoading(false);
    }
  };

  const loadData = async (force = false) => {
    if (!propertyId) return;
    setLoading(true);
    try {
      const [docRes, councilRes] = await Promise.all([
        complianceAPI.getDocuments(propertyId, { category: activeCategory, search: searchQuery, status: statusFilter }, { forceRefresh: force }),
        complianceAPI.getCouncilApplications(propertyId, {}, { forceRefresh: force }),
      ]);

      if (docRes?.success) {
        setDocuments(docRes.data.documents || []);
        setLinkedApplianceDocs(docRes.data.linkedApplianceDocs || []);
      }
      if (councilRes?.success) {
        setCouncilApps(councilRes.data.applications || []);
      }
    } catch (err) {
      console.error('Failed to load compliance records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadEmailAlertStatus();
  }, [propertyId, activeCategory, statusFilter]);

  const allDisplayDocs = [
    ...documents,
    ...(activeCategory === 'ALL' || activeCategory === 'APPLIANCE_EQUIPMENT' ? linkedApplianceDocs : []),
  ];

  // Helper for expiry badges
  const getExpiryBadge = (doc) => {
    if (doc.isMissing) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[10px] font-extrabold uppercase tracking-wider animate-pulse">
          <AlertCircle className="w-3 h-3" />
          Missing Document
        </span>
      );
    }
    if (!doc.expiryDate) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-semibold">
          No Expiry
        </span>
      );
    }

    const nowMs = Date.now();
    const expMs = new Date(doc.expiryDate).getTime();
    const diffDays = Math.ceil((expMs - nowMs) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[10px] font-extrabold">
          <AlertTriangle className="w-3 h-3" />
          Expired ({Math.abs(diffDays)}d ago)
        </span>
      );
    }
    if (diffDays <= 7) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[10px] font-extrabold">
          <Clock className="w-3 h-3" />
          Critical: {diffDays}d left
        </span>
      );
    }
    if (diffDays <= 14) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-bold">
          <Clock className="w-3 h-3" />
          Urgent: {diffDays}d left
        </span>
      );
    }
    if (diffDays <= 45) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-bold">
          <Clock className="w-3 h-3" />
          Priority: {diffDays}d left
        </span>
      );
    }
    if (diffDays <= 60) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-[10px] font-semibold">
          Warning: {diffDays}d left
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold">
        <CheckCircle2 className="w-3 h-3" />
        Valid ({diffDays}d)
      </span>
    );
  };

  // Submit Handler for New Document or Missing Document Item
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setActionError('');
    try {
      const formData = new FormData();
      formData.append('category', formCategory);
      formData.append('subCategory', formSubCategory);
      formData.append('title', formTitle);
      formData.append('provider', formProvider);
      formData.append('referenceNumber', formRefNumber);
      formData.append('issueDate', formIssueDate);
      formData.append('expiryDate', formExpiryDate);
      formData.append('notes', formNotes);
      formData.append('isMissing', String(formIsMissing));
      if (formSubCategory.includes('EPC')) {
        formData.append('epcRating', formEpcRating);
      }
      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      await complianceAPI.createDocument(propertyId, formData);
      setUploadModalOpen(false);
      resetUploadForm();
      loadData(true);
      if (onRefreshParent) onRefreshParent();
    } catch (err) {
      setActionError(err.response?.data?.message || err.message || 'Failed to record document');
    } finally {
      setActionLoading(false);
    }
  };

  const resetUploadForm = () => {
    setFormTitle('');
    setFormProvider('');
    setFormRefNumber('');
    setFormIssueDate('');
    setFormExpiryDate('');
    setFormNotes('');
    setFormIsMissing(false);
    setSelectedFile(null);
  };

  // Submit Handler for Renewing / Uploading New Version
  const handleVersionSubmit = async (e) => {
    e.preventDefault();
    if (!versionModalDoc) return;
    setActionLoading(true);
    setActionError('');
    try {
      const formData = new FormData();
      if (versionFile) formData.append('file', versionFile);
      if (versionIssueDate) formData.append('issueDate', versionIssueDate);
      if (versionExpiryDate) formData.append('expiryDate', versionExpiryDate);
      if (versionProvider) formData.append('provider', versionProvider);
      if (versionRefNumber) formData.append('referenceNumber', versionRefNumber);
      if (versionNotes) formData.append('notes', versionNotes);

      await complianceAPI.uploadVersion(versionModalDoc._id, formData);
      setVersionModalDoc(null);
      setVersionFile(null);
      loadData(true);
      if (onRefreshParent) onRefreshParent();
    } catch (err) {
      setActionError(err.response?.data?.message || err.message || 'Failed to renew document');
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Handler for Council Application
  const handleCouncilSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setActionError('');
    try {
      await complianceAPI.createCouncilApplication(propertyId, {
        applicationType: councilType,
        councilName,
        title: councilTitle,
        applicationReference: councilRef,
        responseDeadline: councilDeadline || null,
        feePaid: Number(councilFee) || 0,
        description: councilDesc,
      });
      setCouncilModalOpen(false);
      setCouncilTitle('');
      setCouncilRef('');
      setCouncilDeadline('');
      setCouncilFee('');
      setCouncilDesc('');
      loadData(true);
    } catch (err) {
      setActionError(err.response?.data?.message || err.message || 'Failed to register council application');
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Handler for Council Correspondence Log
  const handleCorrespondenceSubmit = async (e) => {
    e.preventDefault();
    if (!correspondenceModalApp) return;
    setActionLoading(true);
    setActionError('');
    try {
      const formData = new FormData();
      formData.append('summary', corrSummary);
      formData.append('type', corrType);
      formData.append('senderOrRecipient', corrSender);
      formData.append('date', corrDate);
      if (corrFile) formData.append('file', corrFile);

      await complianceAPI.addCorrespondence(correspondenceModalApp._id, formData);
      setCorrespondenceModalApp(null);
      setCorrSummary('');
      setCorrSender('');
      setCorrFile(null);
      loadData(true);
    } catch (err) {
      setActionError(err.response?.data?.message || err.message || 'Failed to log correspondence');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteDoc = async (id) => {
    if (!window.confirm('Are you sure you want to archive this document record?')) return;
    try {
      await complianceAPI.deleteDocument(id);
      loadData(true);
      if (onRefreshParent) onRefreshParent();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to archive document');
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-7 space-y-6">
      {/* Top Banner & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
              Property Documents &amp; Statutory Compliance Centre
            </h3>
            <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              6 Categories
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl">
            Central repository for insurance schedules, statutory safety certificates, purchase deeds, architectural CAD drawings, council licensing &amp; Currys appliance equipment documents for <strong className="text-slate-200">{propertyName}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => loadData(true)}
            disabled={loading}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-800 transition cursor-pointer shadow-sm"
            title="Refresh documents"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setCouncilModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/60 text-xs font-bold transition cursor-pointer shadow-sm"
          >
            <Building className="w-4 h-4 text-purple-400" />
            <span>Council Application</span>
          </button>

          <button
            onClick={() => {
              setUploadModalOpen(!uploadModalOpen);
              if (!uploadModalOpen) {
                resetUploadForm();
              }
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-sm ${
              uploadModalOpen
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/25'
            }`}
          >
            {uploadModalOpen ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            <span>{uploadModalOpen ? 'Close Form' : 'Upload Document'}</span>
          </button>
        </div>
      </div>

      {/* Attached Email Alert Status Banner */}
      <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
            <Mail className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-white">Automated Expiry Email Notifications</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                attachedEmail
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
              }`}>
                {attachedEmail ? `Alerts sent to: ${attachedEmail}` : 'No email attached yet (Configure in Settings)'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Gas Safety (CP12), EICR, EPC, and Insurance policies automatically trigger renewal warning emails prior to expiration.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={handleRunEmailAlerts}
            disabled={emailCheckLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition cursor-pointer text-xs disabled:opacity-50 shadow-md shadow-indigo-600/20"
          >
            <Send className={`w-3.5 h-3.5 ${emailCheckLoading ? 'animate-spin' : ''}`} />
            <span>{emailCheckLoading ? 'Sending Alerts...' : 'Dispatch Expiry Alerts Now'}</span>
          </button>
        </div>
      </div>

      {emailFeedback && (
        <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{emailFeedback}</span>
          </div>
          <button onClick={() => setEmailFeedback('')} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Property document upload dialog */}
      {uploadModalOpen && (
        <ModalPortal isOpen={uploadModalOpen} onClose={() => setUploadModalOpen(false)}>
          <div className="w-full max-w-4xl max-h-[92vh] overflow-y-auto p-4 sm:p-5 rounded-2xl bg-slate-950 border border-indigo-500/40 shadow-2xl space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
                  <Upload className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-bold text-white">
                  Upload Property Document &amp; Compliance Details
                </h4>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Attach document files and record statutory details (Issue Date, Expiry Deadline, Reference, Provider) for <strong className="text-slate-200">{propertyName}</strong>.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setUploadModalOpen(false)}
              className="self-end sm:self-auto p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Close form"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Pre-fill Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-400 font-semibold mr-1">Quick Fill:</span>
            {[
              { label: '+ Gas Safety CP12', cat: 'SAFETY_COMPLIANCE', type: 'GAS_SAFETY_CP12', title: 'Annual Gas Safety Certificate (CP12)' },
              { label: '+ EICR (5-Year)', cat: 'SAFETY_COMPLIANCE', type: 'EICR', title: '5-Year Electrical Installation Condition Report (EICR)' },
              { label: '+ EPC (10-Year)', cat: 'SAFETY_COMPLIANCE', type: 'EPC', title: 'Energy Performance Certificate (EPC)' },
              { label: '+ Inspection Report', cat: 'OTHER', type: 'INSPECTION_REPORT', title: 'Property Inspection Report' },
              { label: '+ Building Insurance', cat: 'INSURANCE', type: 'BUILDING_INSURANCE', title: 'Building Insurance Policy & Schedule' },
              { label: '+ Title Deed', cat: 'LEGAL_PURCHASE', type: 'TITLE_DEED', title: 'Official Copy of Register of Title' },
              { label: '+ Floor Plan', cat: 'DRAWINGS_STRUCTURAL', type: 'FLOOR_PLAN', title: 'Architectural Floor & Layout Plans' },
            ].map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setFormCategory(preset.cat);
                  setFormSubCategory(preset.type);
                  setFormTitle(preset.title);
                }}
                className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-indigo-600 hover:text-white text-indigo-300 border border-indigo-500/30 transition cursor-pointer font-medium"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {actionError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-bold">
              {actionError}
            </div>
          )}

          <form onSubmit={handleUploadSubmit} className="space-y-3.5 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Column: Classification & Dates */}
              <div className="space-y-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Document Category <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:ring-2 focus:ring-indigo-500 text-xs"
                  >
                    <option value="SAFETY_COMPLIANCE">Safety &amp; Compliance (CP12, EICR, EPC, Fire)</option>
                    <option value="INSURANCE">Insurance Documents (Building &amp; Schedules)</option>
                    <option value="LEGAL_PURCHASE">Legal &amp; Purchase (Deeds, Conveyancing, Contracts)</option>
                    <option value="DRAWINGS_STRUCTURAL">Drawings &amp; Structural (Plans, Elevations, Surveys)</option>
                    <option value="COUNCIL_LICENSING">Council &amp; Licensing (HMO, Planning, Notices)</option>
                    <option value="APPLIANCE_EQUIPMENT">Appliance &amp; Equipment (Warranties &amp; White Goods)</option>
                    <option value="OTHER">Other Property Records</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Certificate / Document Type</label>
                    <input
                      type="text"
                      placeholder="e.g. CP12 / EICR / Policy"
                      value={formSubCategory}
                      onChange={(e) => setFormSubCategory(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      Document Title <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 2026 Gas Safety Certificate"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Issue / Inspection Date</span>
                    </label>
                    <input
                      type="date"
                      value={formIssueDate}
                      onChange={(e) => setFormIssueDate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>Expiry / Renewal Deadline</span>
                    </label>
                    <input
                      type="date"
                      value={formExpiryDate}
                      onChange={(e) => setFormExpiryDate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium text-xs"
                    />
                    <span className="text-[10px] text-slate-500 mt-0.5 block">Alerts start 45 days in advance</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Provider, File Upload, Notes */}
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Provider / Issuing Authority</label>
                    <input
                      type="text"
                      placeholder="e.g. British Gas / Zurich"
                      value={formProvider}
                      onChange={(e) => setFormProvider(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Reference / Policy Number</label>
                    <input
                      type="text"
                      placeholder="e.g. CERT-98214"
                      value={formRefNumber}
                      onChange={(e) => setFormRefNumber(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium text-xs"
                    />
                  </div>
                </div>

                {/* Missing document checkbox */}
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-white text-xs block">Certificate Missing / Not Uploaded?</span>
                    <span className="text-[10px] text-slate-400">Record missing statutory item without uploading file</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={formIsMissing}
                    onChange={(e) => setFormIsMissing(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                  />
                </div>

                {/* File Upload Attachment Box */}
                {!formIsMissing && (
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1 flex items-center justify-between">
                      <span>Attach Document File (PDF, PNG, JPG, DOC)</span>
                      {selectedFile && (
                        <span className="text-[10px] text-emerald-400 font-bold">
                          {(selectedFile.size / 1024).toFixed(1)} KB selected
                        </span>
                      )}
                    </label>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      onChange={(e) => setSelectedFile(e.target.files[0] || null)}
                      className="w-full text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer bg-slate-900 border border-slate-700/80 rounded-xl p-1"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Notes / Renewal Guidance</label>
                  <input
                    type="text"
                    placeholder="e.g. Passed inspection; service certificate on file"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setUploadModalOpen(false)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 flex items-center gap-1.5 cursor-pointer transition disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                <span>Save &amp; Attach Document</span>
              </button>
            </div>
          </form>
        </div>
      </ModalPortal>
    )}

      {/* Category Pills Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {COMPLIANCE_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                  : 'bg-slate-900/90 text-slate-400 hover:text-white hover:bg-slate-850 border border-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active Category Description / Guidance */}
      {activeCategory !== 'ALL' && (
        <div className="p-3.5 rounded-2xl bg-indigo-500/5 border border-indigo-500/15 flex items-center justify-between text-xs text-indigo-300">
          <span className="font-medium">
            Category Scope: <strong>{COMPLIANCE_CATEGORIES.find((c) => c.id === activeCategory)?.label}</strong> — {COMPLIANCE_CATEGORIES.find((c) => c.id === activeCategory)?.subtext}
          </span>
          <span className="text-[11px] text-slate-400 font-semibold">{allDisplayDocs.length} Records</span>
        </div>
      )}

      {/* Council Applications Section (Shown when ALL or COUNCIL_LICENSING is selected) */}
      {(activeCategory === 'ALL' || activeCategory === 'COUNCIL_LICENSING') && councilApps.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Building className="w-4 h-4 text-purple-400" />
              <span>Active Council Licence &amp; Planning Applications ({councilApps.length})</span>
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {councilApps.map((app) => (
              <div key={app._id} className="executive-card p-4 rounded-2xl space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 uppercase">
                      {app.applicationType.replace(/_/g, ' ')}
                    </span>
                    <h5 className="text-sm font-extrabold text-white mt-1.5">{app.title}</h5>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Authority: <strong className="text-slate-300">{app.councilName}</strong> &bull; Ref: {app.applicationReference || 'Pending Ref'}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                      app.status === 'APPROVED'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : app.status === 'AWAITING_COUNCIL'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
                    }`}
                  >
                    {app.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-800/80">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Submitted</span>
                    <span className="font-semibold text-slate-300">{formatUKDate(app.submissionDate)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Response Deadline</span>
                    <span className={`font-bold ${app.responseDeadline && new Date(app.responseDeadline) < new Date() ? 'text-rose-400' : 'text-amber-300'}`}>
                      {formatUKDate(app.responseDeadline) || 'None specified'}
                    </span>
                  </div>
                </div>

                {/* Correspondence timeline summary */}
                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs">
                  <span className="text-slate-400 text-[11px]">
                    {app.correspondence?.length || 0} correspondence logs
                  </span>
                  <button
                    onClick={() => setCorrespondenceModalApp(app)}
                    className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-bold text-xs cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Log Letter / Notice</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Documents Table / Cards */}
      {loading ? (
        <div className="py-16 text-center text-slate-500 space-y-2">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-500" />
          <p className="text-xs">Loading verified property documents...</p>
        </div>
      ) : allDisplayDocs.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-950/40 border border-dashed border-slate-800 space-y-3">
          <FileText className="w-10 h-10 text-slate-600 mx-auto" />
          <div className="text-sm font-bold text-slate-300">No documents in this category</div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Upload certificates, contracts, insurance policies, or architectural drawings to start managing statutory compliance for this property.
          </p>
          <button
            onClick={() => setUploadModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Upload First Document</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {allDisplayDocs.map((doc) => {
            const isApplianceDoc = Boolean(doc.isVirtualLink);
            return (
              <div
                key={doc._id}
                className={`executive-card p-4 sm:p-5 rounded-2xl space-y-3 flex flex-col justify-between ${
                  doc.isMissing ? 'border-rose-500/40 bg-rose-950/10' : ''
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 uppercase tracking-wider truncate max-w-[170px]">
                      {doc.category.replace(/_/g, ' ')}
                    </span>
                    {getExpiryBadge(doc)}
                  </div>

                  <h4 className="text-sm sm:text-base font-extrabold text-white mt-2.5 leading-snug line-clamp-2">
                    {doc.title}
                  </h4>
                  {doc.subCategory && (
                    <div className="text-[11px] text-slate-400 mt-0.5">{doc.subCategory}</div>
                  )}

                  <div className="space-y-1 mt-3 text-xs text-slate-400">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Provider:</span>
                      <span className="font-semibold text-slate-300 truncate max-w-[150px]">{doc.provider || '-'}</span>
                    </div>
                    {doc.referenceNumber && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Reference:</span>
                        <span className="font-mono text-slate-300">{doc.referenceNumber}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Issue Date:</span>
                      <span>{doc.issueDate ? formatUKDate(doc.issueDate) : '-'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Expiry Date:</span>
                      <span className="font-semibold text-white">{doc.expiryDate ? formatUKDate(doc.expiryDate) : 'No Expiry'}</span>
                    </div>
                  </div>

                  {doc.notes && (
                    <p className="text-[11px] text-slate-400 mt-2.5 p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 italic line-clamp-2">
                      {doc.notes}
                    </p>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-1.5">
                    {doc.fileUrl ? (
                      <button
                        type="button"
                        onClick={() => complianceAPI.downloadDocument(doc._id).catch((error) => {
                          console.error('Failed to view property document:', error);
                          window.alert(error.response?.data?.message || 'Unable to open this document. Please try again.');
                        })}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 font-bold transition text-[11px]"
                      >
                        <Eye className="w-3 h-3" />
                        <span>View</span>
                      </button>
                    ) : (
                      <span className="text-[10px] text-rose-400 font-bold">No file</span>
                    )}

                    {!isApplianceDoc && doc.versionHistory && doc.versionHistory.length > 0 && (
                      <button
                        onClick={() => setHistoryModalDoc(doc)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                        title={`View ${doc.versionHistory.length} previous archived versions`}
                      >
                        <History className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {!isApplianceDoc && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setVersionModalDoc(doc);
                          setVersionProvider(doc.provider || '');
                          setVersionRefNumber(doc.referenceNumber || '');
                          setVersionIssueDate(new Date().toISOString().slice(0, 10));
                          setVersionExpiryDate('');
                          setVersionNotes('');
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition text-[11px]"
                        title="Upload renewed certificate version"
                      >
                        <Upload className="w-3 h-3 text-emerald-400" />
                        <span>Renew (v{doc.version + 1})</span>
                      </button>

                      <button
                        onClick={() => handleDeleteDoc(doc._id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 transition"
                        title="Archive document"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 2: Renew / Upload New Version */}
      {versionModalDoc && (
        <ModalPortal isOpen={Boolean(versionModalDoc)} onClose={() => setVersionModalDoc(null)}>
          <div className="executive-card w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-white">
                  Renew Document &bull; Version {versionModalDoc.version + 1}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{versionModalDoc.title}</p>
              </div>
              <button onClick={() => setVersionModalDoc(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              The existing Version {versionModalDoc.version} certificate will be preserved in the audit history. Enter the new renewal certificate details:
            </p>

            <form onSubmit={handleVersionSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">New Certificate File (PDF / Image) *</label>
                <input
                  type="file"
                  required
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setVersionFile(e.target.files[0] || null)}
                  className="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">New Issue Date</label>
                  <input
                    type="date"
                    value={versionIssueDate}
                    onChange={(e) => setVersionIssueDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">New Expiry Date</label>
                  <input
                    type="date"
                    value={versionExpiryDate}
                    onChange={(e) => setVersionExpiryDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Provider</label>
                  <input
                    type="text"
                    value={versionProvider}
                    onChange={(e) => setVersionProvider(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">New Certificate Reference</label>
                  <input
                    type="text"
                    value={versionRefNumber}
                    onChange={(e) => setVersionRefNumber(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setVersionModalDoc(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold shadow-lg shadow-emerald-600/25 flex items-center gap-2"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  <span>Save New Version</span>
                </button>
              </div>
            </form>
          </div>
        </ModalPortal>
      )}

      {/* MODAL 3: Version History Viewer */}
      {historyModalDoc && (
        <ModalPortal isOpen={Boolean(historyModalDoc)} onClose={() => setHistoryModalDoc(null)}>
          <div className="executive-card w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-400" />
                  <span>Version Audit History</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{historyModalDoc.title}</p>
              </div>
              <button onClick={() => setHistoryModalDoc(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-xs">
                <span className="font-extrabold text-indigo-300">Current Version {historyModalDoc.version} (Active)</span>
                <div className="text-slate-300 mt-1">
                  Expiry: {historyModalDoc.expiryDate ? formatUKDate(historyModalDoc.expiryDate) : 'No Expiry'} &bull; Ref: {historyModalDoc.referenceNumber || 'N/A'}
                </div>
              </div>

              {historyModalDoc.versionHistory.map((ver, idx) => (
                <div key={idx} className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200">Version {ver.version} (Archived)</span>
                    <span className="text-[10px] text-slate-500">{formatUKDate(ver.archivedAt)}</span>
                  </div>
                  <div className="text-slate-400">
                    Expiry: {ver.expiryDate ? formatUKDate(ver.expiryDate) : 'N/A'} &bull; Provider: {ver.provider || 'N/A'}
                  </div>
                  {ver.fileUrl && (
                    <button
                      type="button"
                      onClick={() => complianceAPI.downloadDocument(historyModalDoc._id, idx).catch((error) => {
                        console.error('Failed to view historical property document:', error);
                        window.alert(error.response?.data?.message || 'Unable to open this document version. Please try again.');
                      })}
                      className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 font-bold text-[11px] pt-1"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download Historical File ({ver.fileName || 'certificate.pdf'})</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </ModalPortal>
      )}

      {/* MODAL 4: Create Council Application */}
      {councilModalOpen && (
        <ModalPortal isOpen={councilModalOpen} onClose={() => setCouncilModalOpen(false)}>
          <div className="executive-card w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Building className="w-5 h-5 text-purple-400" />
                <span>Register Council Licence or Planning Application</span>
              </h3>
              <button onClick={() => setCouncilModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCouncilSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Application Type</label>
                <select
                  value={councilType}
                  onChange={(e) => setCouncilType(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium"
                >
                  <option value="HMO_LICENCE">HMO Mandatory / Additional Licence</option>
                  <option value="SELECTIVE_LICENCE">Selective Licensing Scheme</option>
                  <option value="PLANNING_PERMISSION">Planning Permission Application</option>
                  <option value="BUILDING_CONTROL">Building Control Full Plans / Notice</option>
                  <option value="CHANGE_OF_USE">Change of Use / Permitted Development</option>
                  <option value="OTHER">Other Council Notice / Consent</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Council / Local Authority Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Westminster City Council / Tower Hamlets"
                  value={councilName}
                  onChange={(e) => setCouncilName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Application Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 5-Year HMO Licence Renewal - 6 Occupants"
                  value={councilTitle}
                  onChange={(e) => setCouncilTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Council Reference No</label>
                  <input
                    type="text"
                    placeholder="e.g. LIC/2026/8941"
                    value={councilRef}
                    onChange={(e) => setCouncilRef(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Response Deadline</label>
                  <input
                    type="date"
                    value={councilDeadline}
                    onChange={(e) => setCouncilDeadline(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCouncilModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold shadow-lg shadow-purple-600/25 flex items-center gap-2"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building className="w-4 h-4" />}
                  <span>Save Application</span>
                </button>
              </div>
            </form>
          </div>
        </ModalPortal>
      )}

      {/* MODAL 5: Log Council Correspondence */}
      {correspondenceModalApp && (
        <ModalPortal isOpen={Boolean(correspondenceModalApp)} onClose={() => setCorrespondenceModalApp(null)}>
          <div className="executive-card w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <Mail className="w-5 h-5 text-purple-400" />
                  <span>Log Council Letter, Email or Inspection Report</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{correspondenceModalApp.title}</p>
              </div>
              <button onClick={() => setCorrespondenceModalApp(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCorrespondenceSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">Communication Type</label>
                <select
                  value={corrType}
                  onChange={(e) => setCorrType(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium"
                >
                  <option value="INCOMING_LETTER">Incoming Letter / Decision Notice</option>
                  <option value="OUTGOING_EMAIL">Outgoing Email / Clarification</option>
                  <option value="INSPECTION_REPORT">Officer Inspection Report</option>
                  <option value="FEE_PAYMENT">Licence Fee Payment Receipt</option>
                  <option value="NOTICE">Statutory Notice</option>
                  <option value="NOTE">File Note / Telephone Record</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Summary / Key Requirements *</label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Council requested proof of tenancy agreement and floor plan by 14 Nov."
                  value={corrSummary}
                  onChange={(e) => setCorrSummary(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Sender / Officer Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Licensing Officer Sarah"
                    value={corrSender}
                    onChange={(e) => setCorrSender(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Date of Communication</label>
                  <input
                    type="date"
                    value={corrDate}
                    onChange={(e) => setCorrDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">Attach Letter / Document (PDF / Image)</label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setCorrFile(e.target.files[0] || null)}
                  className="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-purple-600 file:text-white cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCorrespondenceModalApp(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold shadow-lg shadow-purple-600/25 flex items-center gap-2"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>Record Communication</span>
                </button>
              </div>
            </form>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
export default PropertyComplianceSection;
