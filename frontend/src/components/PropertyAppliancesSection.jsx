import React, { useState } from 'react';
import {
  Sparkles,
  ShieldCheck,
  Plus,
  Edit3,
  Trash2,
  Upload,
  ExternalLink,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Phone,
  FileText,
  Loader2,
  X,
} from 'lucide-react';
import { formatGBP, formatUKDate } from '../utils/formatters.js';
import { appliancesAPI } from '../services/api.js';
import ApplianceModal from './ApplianceModal.jsx';

export const APPLIANCE_ICONS = {
  WASHING_MACHINE: '🫧',
  WASHER_DRYER: '🔄',
  TUMBLE_DRYER: '♨️',
  DISHWASHER: '🍽️',
  COOKER_OVEN_HOB: '🍳',
  FRIDGE_FREEZER: '❄️',
  FRIDGE: '🧊',
  FREEZER: '🥶',
  BOILER: '🔥',
  OTHER: '🔌',
};

export const APPLIANCE_TYPE_TITLES = {
  WASHING_MACHINE: 'Washing Machine',
  WASHER_DRYER: 'Washer Dryer',
  TUMBLE_DRYER: 'Tumble Dryer',
  DISHWASHER: 'Dishwasher',
  COOKER_OVEN_HOB: 'Cooker, Oven & Hob',
  FRIDGE_FREEZER: 'Fridge Freezer',
  FRIDGE: 'Larder Fridge',
  FREEZER: 'Freezer',
  BOILER: 'Boiler / Water Heater',
  OTHER: 'General Appliance',
};

export function PropertyAppliancesSection({
  propertyId,
  propertyName,
  appliances = [],
  onRefresh,
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAppliance, setEditingAppliance] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  // Quick upload receipt modal state
  const [uploadModalAppliance, setUploadModalAppliance] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadDocType, setUploadDocType] = useState('PURCHASE_RECEIPT');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handleOpenAdd = () => {
    setEditingAppliance(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (appliance) => {
    setEditingAppliance(appliance);
    setModalOpen(true);
  };

  const handleDelete = async (applianceId) => {
    if (!window.confirm('Are you sure you want to delete this appliance record?')) return;
    setDeletingId(applianceId);
    try {
      await appliancesAPI.delete(applianceId);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to delete appliance:', err);
      alert('Failed to delete appliance record: ' + (err.response?.data?.message || err.message));
    } finally {
      setDeletingId(null);
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
      data.append('title', `${uploadModalAppliance.supplier || 'Currys'} Receipt - ${uploadModalAppliance.name}`);
      data.append('docType', uploadDocType);

      await appliancesAPI.uploadDocument(uploadModalAppliance._id, data);
      setUploadModalAppliance(null);
      setUploadFile(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to upload document:', err);
      setUploadError(err.response?.data?.message || err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const getValetBadge = (valet) => {
    const status = valet?.eligibilityStatus || 'NOT_VERIFIED';
    switch (status) {
      case 'ELIGIBLE':
        return { label: 'Valet Eligible', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30' };
      case 'DUE':
        return { label: 'Annual Valet Due', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
      case 'BOOKING_REQUIRED':
        return { label: 'Booking Required', cls: 'bg-orange-500/15 text-orange-400 border-orange-500/30' };
      case 'BOOKED':
        return { label: 'Valet Booked', cls: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30' };
      case 'COMPLETED':
        return { label: 'Valet Completed', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
      case 'NOT_ELIGIBLE':
        return { label: 'Not Eligible', cls: 'bg-slate-800 text-slate-400 border-slate-700' };
      case 'NOT_VERIFIED':
      default:
        return { label: 'Valet Unverified', cls: 'bg-slate-800 text-slate-400 border-slate-700' };
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-7 space-y-5">
      {/* Section Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-base sm:text-lg font-extrabold text-white">
              Appliances, Warranties &amp; Currys Care
            </h3>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
              {appliances.length} Registered
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Installed white goods register, Currys Care &amp; Repair coverage, receipt attachments, and annual Squeaky Clean Valet schedules.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Currys Leaflet Hotline Callout */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300">
            <Phone className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span>Currys Care Line:</span>
            <a href="tel:03448006080" className="font-bold text-indigo-400 hover:underline">
              0344 800 6080
            </a>
          </div>

          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Appliance</span>
          </button>
        </div>
      </div>

      {/* Appliances List / Cards */}
      {appliances.length === 0 ? (
        <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-2xl p-8 sm:p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto text-xl">
            🫧
          </div>
          <div className="text-sm font-bold text-white">No Appliances Registered Yet</div>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Register washing machines, fridges, cookers, and domestic appliances installed at this property. Attach Currys purchase receipts, track Care &amp; Repair plans, and monitor annual valet eligibility.
          </p>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Register First Appliance</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {appliances.map((item) => {
            const valetBadge = getValetBadge(item.squeakyCleanValet);
            const iconEmoji = APPLIANCE_ICONS[item.applianceType] || '🔌';
            const docsCount = item.documents?.length || 0;
            const hasCarePlan = item.currysCareAndRepair?.hasPlan;

            return (
              <div
                key={item._id}
                className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition space-y-3"
              >
                {/* Card Top: Emoji + Name + Actions */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-lg shrink-0">
                        {iconEmoji}
                      </div>
                      <div className="truncate min-w-0">
                        <h4 className="text-sm font-bold text-white tracking-tight truncate">
                          {item.name}
                        </h4>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 truncate">
                          <span>{item.brand || 'Unbranded'}</span>
                          {item.modelNumber && <span>· Mod: {item.modelNumber}</span>}
                          <span>· {item.supplier || 'Currys'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setUploadModalAppliance(item)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition cursor-pointer"
                        title="Upload Receipt or Invoice"
                      >
                        <Upload className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                        title="Edit Appliance"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(item._id)}
                        disabled={deletingId === item._id}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
                        title="Delete Appliance"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Serial Number & Price Badges */}
                  <div className="flex items-center gap-2 mt-3 flex-wrap text-[11px]">
                    <div className="p-1.5 px-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                      SN:{' '}
                      {item.serialNumber ? (
                        <span className="font-mono text-white font-semibold">{item.serialNumber}</span>
                      ) : (
                        <span className="text-amber-400 font-semibold">Unverified</span>
                      )}
                    </div>
                    {item.purchasePrice > 0 && (
                      <div className="p-1.5 px-2 rounded-lg bg-slate-900 border border-slate-800 text-emerald-400 font-semibold tabular-nums">
                        Cost: {formatGBP(item.purchasePrice)}
                      </div>
                    )}
                    {item.purchaseDate && (
                      <div className="p-1.5 px-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400">
                        Bought: {formatUKDate(item.purchaseDate)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Middle: Care & Repair + Squeaky Clean Valet Status */}
                <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800/80 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400 font-medium">Currys Care &amp; Repair:</span>
                    {hasCarePlan ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        Covered ({item.currysCareAndRepair?.planType?.replace(/_/g, ' ') || 'Plan'})
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-medium">
                        No Plan Verified
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400 font-medium">Squeaky Clean Valet:</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${valetBadge.cls}`}>
                      {valetBadge.label}
                    </span>
                  </div>

                  {item.squeakyCleanValet?.nextValetDueDate && (
                    <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/60 flex items-center justify-between">
                      <span>Next Valet Expected:</span>
                      <span className="text-white font-semibold">
                        {formatUKDate(item.squeakyCleanValet.nextValetDueDate)}
                      </span>
                    </div>
                  )}

                  {item.squeakyCleanValet?.bookingReference && (
                    <div className="text-[11px] text-slate-400 flex items-center justify-between">
                      <span>Booking Ref:</span>
                      <span className="font-mono text-indigo-300 font-semibold">
                        {item.squeakyCleanValet.bookingReference}
                      </span>
                    </div>
                  )}
                </div>

                {/* Card Bottom: Attached Receipts & Docs */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    <span>
                      {docsCount > 0 ? (
                        <span className="text-slate-300 font-semibold">{docsCount} Document{docsCount > 1 ? 's' : ''}</span>
                      ) : (
                        <span className="text-amber-400">No Receipt Attached</span>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {docsCount > 0 ? (
                      <a
                        href={item.documents[0].url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold inline-flex items-center gap-1"
                      >
                        <span>View Receipt</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <button
                        onClick={() => setUploadModalAppliance(item)}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                      >
                        + Upload Receipt
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Add/Edit Appliance Modal */}
      <ApplianceModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        propertyId={propertyId}
        propertyName={propertyName}
        editingAppliance={editingAppliance}
        onSuccess={() => {
          if (onRefresh) onRefresh();
        }}
      />

      {/* Quick Upload Receipt Modal */}
      {uploadModalAppliance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-indigo-400" />
                <span>Upload Receipt / Document</span>
              </h3>
              <button
                onClick={() => setUploadModalAppliance(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
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
    </div>
  );
}

export default PropertyAppliancesSection;
