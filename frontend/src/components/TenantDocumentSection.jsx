import React, { useState, useEffect } from 'react';
import {
  FileText,
  Upload,
  Eye,
  Trash2,
  Plus,
  Loader2,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  Info,
  X,
  ExternalLink,
} from 'lucide-react';
import {
  TENANT_STANDARD_DOCUMENTS,
  calculateDocumentStatus,
} from '../config/tenantDocumentsConfig.js';
import { tenantsAPI } from '../services/api.js';

export function TenantDocumentSection({
  tenantId,
  onDocumentsChange,
  pendingDocuments = [],
  onPendingDocumentsChange,
}) {
  const [documents, setDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploadingState, setUploadingState] = useState({});
  const [newCustomDocName, setNewCustomDocName] = useState('');
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [editingExpiryDoc, setEditingExpiryDoc] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);

  // Load existing uploaded documents if tenantId is available
  useEffect(() => {
    if (tenantId) {
      loadDocuments();
    }
  }, [tenantId]);

  const loadDocuments = async () => {
    if (!tenantId) return;
    setLoadingDocs(true);
    try {
      const res = await tenantsAPI.getDocuments(tenantId);
      const docs = res?.data?.documents || [];
      setDocuments(docs);
      if (onDocumentsChange) onDocumentsChange(docs);
    } catch (e) {
      console.warn('[Tenant Document Load Error]', e.message);
    } finally {
      setLoadingDocs(false);
    }
  };

  // Find uploaded doc for a standard document name
  const getUploadedStandardDoc = (name) => {
    if (tenantId) {
      return documents.find((d) => d.documentName === name && d.documentType === 'standard');
    }
    return pendingDocuments.find((d) => d.documentName === name && d.documentType === 'standard');
  };

  // Custom documents list
  const customDocuments = tenantId
    ? documents.filter((d) => d.documentType === 'custom')
    : pendingDocuments.filter((d) => d.documentType === 'custom');

  const uploadedStandardCount = TENANT_STANDARD_DOCUMENTS.filter((docItem) => {
    return Boolean(getUploadedStandardDoc(docItem.name));
  }).length;

  // Handle uploading / selecting a file
  const handleFileUpload = async (e, documentName, hasExpiryDate, documentType = 'standard') => {
    const file = e.target.files[0];
    if (!file) return;

    // Reset input value so the same file can be re-selected if needed
    e.target.value = '';

    if (tenantId) {
      // Direct API upload for existing tenant
      setUploadingState((prev) => ({ ...prev, [documentName]: true }));
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('documentName', documentName);
        formData.append('documentType', documentType);

        // Check if expiry date was already entered
        const existingDoc = documents.find((d) => d.documentName === documentName);
        if (existingDoc?.expiryDate) {
          formData.append('expiryDate', existingDoc.expiryDate);
        }

        await tenantsAPI.uploadDocument(tenantId, formData);
        await loadDocuments();
      } catch (err) {
        alert(err.response?.data?.message || err.message || 'Failed to upload document');
      } finally {
        setUploadingState((prev) => ({ ...prev, [documentName]: false }));
      }
    } else {
      // Pending local upload for new tenant creation
      const localUrl = URL.createObjectURL(file);
      const newPendingItem = {
        documentName,
        documentType,
        file,
        originalFileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileUrl: localUrl,
        hasExpiryDate,
        expiryDate: '',
      };

      const updated = [
        ...pendingDocuments.filter((d) => d.documentName !== documentName),
        newPendingItem,
      ];
      if (onPendingDocumentsChange) onPendingDocumentsChange(updated);
    }
  };

  // Handle Expiry Date change
  const handleExpiryDateChange = async (documentName, newDate, docId = null) => {
    if (tenantId && docId) {
      try {
        const formData = new FormData();
        formData.append('expiryDate', newDate || '');
        await tenantsAPI.updateDocument(docId, formData);
        await loadDocuments();
      } catch (err) {
        alert(err.response?.data?.message || err.message || 'Failed to update expiry date');
      }
    } else {
      // Update in pending state
      const updated = pendingDocuments.map((item) => {
        if (item.documentName === documentName) {
          return { ...item, expiryDate: newDate };
        }
        return item;
      });
      if (onPendingDocumentsChange) onPendingDocumentsChange(updated);
    }
  };

  // Handle Document Deletion
  const handleDeleteDocument = async (documentName, docId = null) => {
    if (!window.confirm(`Are you sure you want to remove "${documentName}"?`)) return;

    if (tenantId && docId) {
      setUploadingState((prev) => ({ ...prev, [documentName]: true }));
      try {
        await tenantsAPI.deleteDocument(docId);
        await loadDocuments();
      } catch (err) {
        alert(err.response?.data?.message || err.message || 'Failed to delete document');
      } finally {
        setUploadingState((prev) => ({ ...prev, [documentName]: false }));
      }
    } else {
      const updated = pendingDocuments.filter((d) => d.documentName !== documentName);
      if (onPendingDocumentsChange) onPendingDocumentsChange(updated);
    }
  };

  // Add Custom Document Slot
  const handleAddCustomDocument = () => {
    const trimmed = newCustomDocName.trim();
    if (!trimmed) return;

    const exists = [
      ...TENANT_STANDARD_DOCUMENTS.map((d) => d.name.toLowerCase()),
      ...customDocuments.map((d) => d.documentName.toLowerCase()),
    ].includes(trimmed.toLowerCase());

    if (exists) {
      alert(`A document titled "${trimmed}" already exists.`);
      return;
    }

    if (!tenantId) {
      const updated = [
        ...pendingDocuments,
        {
          documentName: trimmed,
          documentType: 'custom',
          hasExpiryDate: false,
          file: null,
          fileUrl: '',
          originalFileName: '',
        },
      ];
      if (onPendingDocumentsChange) onPendingDocumentsChange(updated);
    }

    setNewCustomDocName('');
    setIsAddingCustom(false);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm space-y-6">
      {/* SECTION HEADER - Matches exact screenshot style */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 mt-0.5">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Tenant Documents</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
              All tenant documents are optional. Documents tagged with{' '}
              <strong className="text-amber-600 dark:text-amber-400">Expiry Date (ED)</strong> support
              expiration tracking and alert notifications.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {tenantId && (
            <button
              type="button"
              onClick={loadDocuments}
              disabled={loadingDocs}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition cursor-pointer"
              title="Refresh tenant documents"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingDocs ? 'animate-spin' : ''}`} />
            </button>
          )}
          <div className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-extrabold text-xs shadow-xs">
            Documents: {uploadedStandardCount}/{TENANT_STANDARD_DOCUMENTS.length}
          </div>
        </div>
      </div>

      {/* 1. STANDARD DOCUMENTS LIST */}
      <div className="space-y-3">
        <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Standard Documents ({TENANT_STANDARD_DOCUMENTS.length} Document Types)
        </div>

        <div className="space-y-2">
          {TENANT_STANDARD_DOCUMENTS.map((docItem) => {
            const uploadedDoc = getUploadedStandardDoc(docItem.name);
            const isUploaded = Boolean(uploadedDoc && (uploadedDoc.fileUrl || uploadedDoc.file));
            const isUploading = uploadingState[docItem.name];
            const expiryStatus = isUploaded && docItem.hasExpiryDate ? calculateDocumentStatus(uploadedDoc?.expiryDate) : null;

            return (
              <div
                key={docItem.name}
                className="p-3 sm:p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 hover:border-slate-300 dark:hover:border-slate-700 transition flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
              >
                {/* Left: Document Name & Badges */}
                <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                  <span className="font-bold text-slate-900 dark:text-white truncate">
                    {docItem.name}
                  </span>

                  {docItem.hasExpiryDate && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                      Expiry Date (ED)
                    </span>
                  )}

                  {isUploaded ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      <span>Uploaded</span>
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-900 dark:text-slate-500">
                      Not Uploaded
                    </span>
                  )}

                  {expiryStatus && uploadedDoc?.expiryDate && (
                    <span className={`px-2 py-0.5 rounded-md text-[10px] border ${expiryStatus.badgeClass}`}>
                      {expiryStatus.status} ({expiryStatus.daysRemaining !== null ? `${expiryStatus.daysRemaining}d` : ''})
                    </span>
                  )}
                </div>

                {/* Right: Date Picker & Upload Button */}
                <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
                  {docItem.hasExpiryDate ? (
                    <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1 text-slate-700 dark:text-slate-200">
                      <Calendar className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <input
                        type="date"
                        value={
                          uploadedDoc?.expiryDate
                            ? new Date(uploadedDoc.expiryDate).toISOString().slice(0, 10)
                            : ''
                        }
                        onChange={(e) =>
                          handleExpiryDateChange(docItem.name, e.target.value, uploadedDoc?._id)
                        }
                        className="bg-transparent text-xs font-medium focus:outline-none cursor-pointer"
                        title="Set Expiry Date"
                      />
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 italic px-2 py-1">
                      No Expiry Date Required
                    </span>
                  )}

                  {/* View Preview Button if uploaded */}
                  {isUploaded && (uploadedDoc?.fileUrl || uploadedDoc?.file) && (
                    <button
                      type="button"
                      onClick={() => {
                        const url = uploadedDoc.fileUrl || URL.createObjectURL(uploadedDoc.file);
                        window.open(url, '_blank');
                      }}
                      className="p-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition cursor-pointer"
                      title="View / Download Document"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Delete Button if uploaded */}
                  {isUploaded && (
                    <button
                      type="button"
                      onClick={() => handleDeleteDocument(docItem.name, uploadedDoc?._id)}
                      disabled={isUploading}
                      className="p-1.5 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-800 transition cursor-pointer"
                      title="Delete document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {/* Upload / Replace Document Button (Green Button matching screenshot) */}
                  <label className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition cursor-pointer shrink-0">
                    {isUploading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    <span>{isUploaded ? 'Replace Document' : 'Upload Document'}</span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, docItem.name, docItem.hasExpiryDate, 'standard')}
                      disabled={isUploading}
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. CUSTOM / ADDITIONAL DOCUMENTS LIST */}
      {customDocuments.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Additional Custom Documents ({customDocuments.length})
          </div>

          <div className="space-y-2">
            {customDocuments.map((customDoc) => {
              const isUploaded = Boolean(customDoc.fileUrl || customDoc.file);
              const isUploading = uploadingState[customDoc.documentName];

              return (
                <div
                  key={customDoc._id || customDoc.documentName}
                  className="p-3 sm:p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 hover:border-slate-300 dark:hover:border-slate-700 transition flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="font-bold text-slate-900 dark:text-white truncate">
                      {customDoc.documentName}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30">
                      Custom
                    </span>
                    {isUploaded ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        <span>Uploaded</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-900 dark:text-slate-500">
                        Pending File
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-start md:self-auto">
                    {/* View */}
                    {isUploaded && (
                      <button
                        type="button"
                        onClick={() => {
                          const url = customDoc.fileUrl || URL.createObjectURL(customDoc.file);
                          window.open(url, '_blank');
                        }}
                        className="p-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition cursor-pointer"
                        title="View / Download"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => handleDeleteDocument(customDoc.documentName, customDoc._id)}
                      className="p-1.5 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-800 transition cursor-pointer"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Upload / Replace */}
                    <label className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition cursor-pointer">
                      {isUploading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      <span>{isUploaded ? 'Replace' : 'Upload'}</span>
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e, customDoc.documentName, false, 'custom')}
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. ADD CUSTOM DOCUMENT BUTTON / INPUT */}
      <div className="pt-2">
        {!isAddingCustom ? (
          <button
            type="button"
            onClick={() => setIsAddingCustom(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs border border-slate-300 dark:border-slate-700 transition cursor-pointer"
          >
            <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>+ Add Another Document</span>
          </button>
        ) : (
          <div className="flex items-center gap-2 max-w-md bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
            <input
              type="text"
              value={newCustomDocName}
              onChange={(e) => setNewCustomDocName(e.target.value)}
              placeholder="e.g. Guarantor Agreement, Reference Letter..."
              className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCustomDocument();
                }
              }}
            />
            <button
              type="button"
              onClick={handleAddCustomDocument}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAddingCustom(false);
                setNewCustomDocName('');
              }}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default TenantDocumentSection;
