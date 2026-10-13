import React, { useState, useEffect } from 'react';
import {
  X,
  Loader2,
  Sparkles,
  ShieldCheck,
  Calendar,
  DollarSign,
  Tag,
  Upload,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Phone,
  ExternalLink,
} from 'lucide-react';
import { appliancesAPI } from '../services/api.js';

export const APPLIANCE_TYPES = [
  { id: 'WASHING_MACHINE', label: 'Washing Machine' },
  { id: 'WASHER_DRYER', label: 'Washer Dryer' },
  { id: 'TUMBLE_DRYER', label: 'Tumble Dryer' },
  { id: 'DISHWASHER', label: 'Dishwasher' },
  { id: 'COOKER_OVEN_HOB', label: 'Cooker, Oven & Hob' },
  { id: 'FRIDGE_FREEZER', label: 'Fridge Freezer' },
  { id: 'FRIDGE', label: 'Larder Fridge' },
  { id: 'FREEZER', label: 'Freezer' },
  { id: 'BOILER', label: 'Boiler / Water Heater' },
  { id: 'OTHER', label: 'Other Domestic Equipment' },
];

export function ApplianceModal({
  isOpen,
  onClose,
  propertyId,
  propertyName,
  editingAppliance,
  onSuccess,
}) {
  const [activeTab, setActiveTab] = useState('general'); // 'general' | 'care' | 'valet' | 'receipt'
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [receiptFile, setReceiptFile] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    applianceType: 'WASHING_MACHINE',
    brand: '',
    modelNumber: '',
    serialNumber: '',
    supplier: 'Currys',
    purchasePrice: '',
    purchaseDate: '',
    installationDate: '',
    hasWarranty: true,
    warrantyExpiryDate: '',
    isWarrantyVerified: false,
    warrantyProvider: 'Manufacturer',
    hasCarePlan: false,
    planType: 'PAY_MONTHLY',
    planDuration: 'MONTHLY_ROLLING',
    planReferenceNumber: '',
    planStartDate: '',
    planEndDate: '',
    monthlyFeeGBP: '',
    isPlanVerified: false,
    valetStatus: 'NOT_VERIFIED',
    nextValetDueDate: '',
    bookingReference: '',
    bookedAppointmentDate: '',
    serviceNotes: '',
    isPropertyAssignedVerified: true,
    notes: '',
  });

  useEffect(() => {
    if (editingAppliance) {
      setFormData({
        name: editingAppliance.name || '',
        applianceType: editingAppliance.applianceType || 'WASHING_MACHINE',
        brand: editingAppliance.brand || '',
        modelNumber: editingAppliance.modelNumber || '',
        serialNumber: editingAppliance.serialNumber || '',
        supplier: editingAppliance.supplier || 'Currys',
        purchasePrice: editingAppliance.purchasePrice !== undefined ? String(editingAppliance.purchasePrice) : '',
        purchaseDate: editingAppliance.purchaseDate ? editingAppliance.purchaseDate.slice(0, 10) : '',
        installationDate: editingAppliance.installationDate ? editingAppliance.installationDate.slice(0, 10) : '',
        hasWarranty: editingAppliance.hasWarranty !== undefined ? editingAppliance.hasWarranty : true,
        warrantyExpiryDate: editingAppliance.warrantyExpiryDate ? editingAppliance.warrantyExpiryDate.slice(0, 10) : '',
        isWarrantyVerified: !!editingAppliance.isWarrantyVerified,
        warrantyProvider: editingAppliance.warrantyProvider || 'Manufacturer',
        hasCarePlan: !!editingAppliance.currysCareAndRepair?.hasPlan,
        planType: editingAppliance.currysCareAndRepair?.planType || 'PAY_MONTHLY',
        planDuration: editingAppliance.currysCareAndRepair?.planDuration || 'MONTHLY_ROLLING',
        planReferenceNumber: editingAppliance.currysCareAndRepair?.planReferenceNumber || '',
        planStartDate: editingAppliance.currysCareAndRepair?.planStartDate ? editingAppliance.currysCareAndRepair.planStartDate.slice(0, 10) : '',
        planEndDate: editingAppliance.currysCareAndRepair?.planEndDate ? editingAppliance.currysCareAndRepair.planEndDate.slice(0, 10) : '',
        monthlyFeeGBP: editingAppliance.currysCareAndRepair?.monthlyFeeGBP ? String(editingAppliance.currysCareAndRepair.monthlyFeeGBP) : '',
        isPlanVerified: !!editingAppliance.currysCareAndRepair?.isPlanVerified,
        valetStatus: editingAppliance.squeakyCleanValet?.eligibilityStatus || 'NOT_VERIFIED',
        nextValetDueDate: editingAppliance.squeakyCleanValet?.nextValetDueDate ? editingAppliance.squeakyCleanValet.nextValetDueDate.slice(0, 10) : '',
        bookingReference: editingAppliance.squeakyCleanValet?.bookingReference || '',
        bookedAppointmentDate: editingAppliance.squeakyCleanValet?.bookedAppointmentDate ? editingAppliance.squeakyCleanValet.bookedAppointmentDate.slice(0, 10) : '',
        serviceNotes: editingAppliance.squeakyCleanValet?.serviceNotes || '',
        isPropertyAssignedVerified: editingAppliance.isPropertyAssignedVerified !== undefined ? editingAppliance.isPropertyAssignedVerified : true,
        notes: editingAppliance.notes || '',
      });
    } else {
      setFormData({
        name: '',
        applianceType: 'WASHING_MACHINE',
        brand: '',
        modelNumber: '',
        serialNumber: '',
        supplier: 'Currys',
        purchasePrice: '',
        purchaseDate: '',
        installationDate: '',
        hasWarranty: true,
        warrantyExpiryDate: '',
        isWarrantyVerified: false,
        warrantyProvider: 'Manufacturer',
        hasCarePlan: false,
        planType: 'PAY_MONTHLY',
        planDuration: 'MONTHLY_ROLLING',
        planReferenceNumber: '',
        planStartDate: '',
        planEndDate: '',
        monthlyFeeGBP: '',
        isPlanVerified: false,
        valetStatus: 'NOT_VERIFIED',
        nextValetDueDate: '',
        bookingReference: '',
        bookedAppointmentDate: '',
        serviceNotes: '',
        isPropertyAssignedVerified: true,
        notes: '',
      });
      setReceiptFile(null);
    }
    setErrorMsg('');
    setActiveTab('general');
  }, [editingAppliance, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setErrorMsg('Appliance name is required');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const payload = {
        propertyId,
        name: formData.name.trim(),
        applianceType: formData.applianceType,
        brand: formData.brand.trim(),
        modelNumber: formData.modelNumber.trim(),
        serialNumber: formData.serialNumber.trim(),
        supplier: formData.supplier.trim() || 'Currys',
        purchasePrice: Number(formData.purchasePrice) || 0,
        purchaseDate: formData.purchaseDate || null,
        installationDate: formData.installationDate || null,
        hasWarranty: formData.hasWarranty,
        warrantyExpiryDate: formData.warrantyExpiryDate || null,
        isWarrantyVerified: formData.isWarrantyVerified,
        warrantyProvider: formData.warrantyProvider.trim(),
        currysCareAndRepair: {
          hasPlan: formData.hasCarePlan,
          planType: formData.hasCarePlan ? formData.planType : 'NOT_APPLICABLE',
          planDuration: formData.hasCarePlan ? formData.planDuration : 'MONTHLY_ROLLING',
          planReferenceNumber: formData.planReferenceNumber.trim(),
          planStartDate: formData.planStartDate || null,
          planEndDate: formData.planEndDate || null,
          monthlyFeeGBP: Number(formData.monthlyFeeGBP) || 0,
          isPlanVerified: formData.isPlanVerified,
        },
        squeakyCleanValet: {
          eligibilityStatus: formData.valetStatus,
          nextValetDueDate: formData.nextValetDueDate || null,
          bookingReference: formData.bookingReference.trim(),
          bookedAppointmentDate: formData.bookedAppointmentDate || null,
          appointedServiceProvider: 'Currys',
          serviceNotes: formData.serviceNotes.trim(),
        },
        isPropertyAssignedVerified: formData.isPropertyAssignedVerified,
        notes: formData.notes.trim(),
      };

      let savedAppliance = null;
      if (editingAppliance) {
        const res = await appliancesAPI.update(editingAppliance._id, payload);
        savedAppliance = res?.data;
      } else {
        const res = await appliancesAPI.create(payload);
        savedAppliance = res?.data;
      }

      // If a receipt file was selected, upload it immediately
      if (receiptFile && savedAppliance?._id) {
        try {
          const uploadData = new FormData();
          uploadData.append('file', receiptFile);
          uploadData.append('title', `${formData.supplier || 'Currys'} Receipt - ${formData.name}`);
          uploadData.append('docType', 'PURCHASE_RECEIPT');
          await appliancesAPI.uploadDocument(savedAppliance._id, uploadData);
        } catch (uploadErr) {
          console.warn('Receipt upload notice:', uploadErr);
        }
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to save appliance:', err);
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to save appliance');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl my-6 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-white">
                {editingAppliance ? 'Edit Appliance Record' : 'Register Property Appliance'}
              </h2>
              <p className="text-xs text-slate-400">
                Property: <span className="text-indigo-400 font-semibold">{propertyName || 'Selected Property'}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/80 px-4 text-xs font-semibold overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`px-3 py-2.5 border-b-2 cursor-pointer transition whitespace-nowrap ${
              activeTab === 'general'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            1. Equipment Details
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('care')}
            className={`px-3 py-2.5 border-b-2 cursor-pointer transition whitespace-nowrap ${
              activeTab === 'care'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            2. Currys Care &amp; Repair Plan
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('valet')}
            className={`px-3 py-2.5 border-b-2 cursor-pointer transition whitespace-nowrap ${
              activeTab === 'valet'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            3. Squeaky Clean Valet
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('receipt')}
            className={`px-3 py-2.5 border-b-2 cursor-pointer transition whitespace-nowrap ${
              activeTab === 'receipt'
                ? 'border-indigo-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            4. Purchase Receipt &amp; Docs
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: General Appliance Details */}
          {activeTab === 'general' && (
            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Appliance Category <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={formData.applianceType}
                    onChange={(e) => setFormData({ ...formData, applianceType: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    {APPLIANCE_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Appliance Description / Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Bosch Serie 4 Washing Machine"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Brand / Make</label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="e.g. Bosch, Beko, Samsung"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Model Number</label>
                  <input
                    type="text"
                    value={formData.modelNumber}
                    onChange={(e) => setFormData({ ...formData, modelNumber: e.target.value })}
                    placeholder="e.g. WAN28201GB"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Serial Number</label>
                  <input
                    type="text"
                    value={formData.serialNumber}
                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                    placeholder="e.g. 48201994801"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                  {!formData.serialNumber && (
                    <span className="text-[10px] text-amber-400 mt-1 block">
                      ⚠️ Serial number unverified until recorded
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Supplier / Store</label>
                  <input
                    type="text"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    placeholder="Currys"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Purchase Price (£ GBP)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Purchase Date</label>
                  <input
                    type="date"
                    value={formData.purchaseDate}
                    onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isPropertyAssignedVerified"
                    checked={formData.isPropertyAssignedVerified}
                    onChange={(e) => setFormData({ ...formData, isPropertyAssignedVerified: e.target.checked })}
                    className="rounded border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="isPropertyAssignedVerified" className="text-slate-300 font-semibold cursor-pointer">
                    Verified physical assignment to {propertyName}
                  </label>
                </div>
                <p className="text-[11px] text-slate-400 pl-5">
                  Confirm that this specific serial number/unit has been physically verified at this property address.
                </p>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Appliance Notes</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Installation notes, location in property (e.g. Kitchen, Utility room)..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          {/* TAB 2: Currys Care & Repair Plan */}
          {activeTab === 'care' && (
            <div className="space-y-3.5 text-xs">
              <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-white text-sm">Currys Care &amp; Repair Plan</h4>
                  <p className="text-slate-300 text-[11px] mt-0.5">
                    Official Care &amp; Repair includes 7-Day Fix Promise, breakdown cover with £0 excess, 24/7 tech support, and an annual Squeaky Clean Valet for household appliances.
                  </p>
                  <div className="mt-2 text-[10px] text-indigo-300 flex items-center gap-3">
                    <span>📞 Care Line: 0344 800 6080</span>
                    <span>📞 24/7 Fault: 0800 0121 909</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                <input
                  type="checkbox"
                  id="hasCarePlan"
                  checked={formData.hasCarePlan}
                  onChange={(e) => setFormData({ ...formData, hasCarePlan: e.target.checked })}
                  className="rounded border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                />
                <label htmlFor="hasCarePlan" className="text-white font-bold cursor-pointer">
                  Appliance is covered by Currys Care &amp; Repair plan
                </label>
              </div>

              {formData.hasCarePlan && (
                <div className="space-y-3 p-3.5 rounded-2xl bg-slate-950/40 border border-slate-800">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Plan Billing Type</label>
                      <select
                        value={formData.planType}
                        onChange={(e) => setFormData({ ...formData, planType: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                      >
                        <option value="PAY_MONTHLY">Pay Monthly (Continuous rolling plan)</option>
                        <option value="PAY_UPFRONT">Pay Upfront (Prepaid 2, 3 or 5 Years)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Plan Duration</label>
                      <select
                        value={formData.planDuration}
                        onChange={(e) => setFormData({ ...formData, planDuration: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                      >
                        <option value="MONTHLY_ROLLING">Monthly Rolling</option>
                        <option value="2_YEARS">2 Years Upfront</option>
                        <option value="3_YEARS">3 Years Upfront</option>
                        <option value="5_YEARS">5 Years Upfront</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Plan Policy / Ref #</label>
                      <input
                        type="text"
                        value={formData.planReferenceNumber}
                        onChange={(e) => setFormData({ ...formData, planReferenceNumber: e.target.value })}
                        placeholder="e.g. CR-993821"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Plan Start Date</label>
                      <input
                        type="date"
                        value={formData.planStartDate}
                        onChange={(e) => setFormData({ ...formData, planStartDate: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">Plan End / Renewal Date</label>
                      <input
                        type="date"
                        value={formData.planEndDate}
                        onChange={(e) => setFormData({ ...formData, planEndDate: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="isPlanVerified"
                      checked={formData.isPlanVerified}
                      onChange={(e) => setFormData({ ...formData, isPlanVerified: e.target.checked })}
                      className="rounded border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                    />
                    <label htmlFor="isPlanVerified" className="text-slate-300 font-semibold cursor-pointer">
                      Plan policy document has been physically inspected &amp; verified
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Squeaky Clean Valet */}
          {activeTab === 'valet' && (
            <div className="space-y-3.5 text-xs">
              <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800">
                <h4 className="font-bold text-white text-xs mb-1">Annual Squeaky Clean Valet Entitlement</h4>
                <p className="text-slate-400 text-[11px]">
                  Currys provides an annual deep clean and descaling service for covered Washing Machines, Dryers, Dishwashers, Cookers, and Fridges.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Valet Eligibility Status</label>
                  <select
                    value={formData.valetStatus}
                    onChange={(e) => setFormData({ ...formData, valetStatus: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="NOT_VERIFIED">Not Verified (Pending receipt/plan review)</option>
                    <option value="NOT_ELIGIBLE">Not Eligible</option>
                    <option value="ELIGIBLE">Eligible (Under Care &amp; Repair Plan)</option>
                    <option value="DUE">Annual Valet Due</option>
                    <option value="BOOKING_REQUIRED">Booking Required</option>
                    <option value="BOOKED">Booked (Appointment Confirmed)</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Next Expected Valet Date</label>
                  <input
                    type="date"
                    value={formData.nextValetDueDate}
                    onChange={(e) => setFormData({ ...formData, nextValetDueDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Currys Booking Reference</label>
                  <input
                    type="text"
                    value={formData.bookingReference}
                    onChange={(e) => setFormData({ ...formData, bookingReference: e.target.value })}
                    placeholder="e.g. CURRYS-VAL-88219"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Confirmed Appointment Date</label>
                  <input
                    type="date"
                    value={formData.bookedAppointmentDate}
                    onChange={(e) => setFormData({ ...formData, bookedAppointmentDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Service Notes / Tenant Access</label>
                <textarea
                  rows={2}
                  value={formData.serviceNotes}
                  onChange={(e) => setFormData({ ...formData, serviceNotes: e.target.value })}
                  placeholder="Notes from engineer, parts used, tenant access instructions..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          {/* TAB 4: Purchase Receipt Upload */}
          {activeTab === 'receipt' && (
            <div className="space-y-3.5 text-xs">
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-dashed border-slate-800 text-center space-y-2">
                <Upload className="w-8 h-8 text-indigo-400 mx-auto" />
                <div className="text-white font-bold">Attach Purchase Receipt / Invoice</div>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  Upload PDF, PNG, or JPEG receipt from Currys to document appliance purchase date and warranty eligibility.
                </p>
                <input
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/webp"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer pt-2"
                />
                {receiptFile && (
                  <div className="text-xs text-emerald-400 font-medium">
                    ✓ Selected: {receiptFile.name} ({(receiptFile.size / 1024).toFixed(1)} KB)
                  </div>
                )}
              </div>

              {editingAppliance?.documents?.length > 0 && (
                <div className="space-y-2 pt-2">
                  <h4 className="text-slate-300 font-semibold">Existing Attached Documents ({editingAppliance.documents.length})</h4>
                  <div className="space-y-1.5">
                    {editingAppliance.documents.map((doc) => (
                      <div
                        key={doc._id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                          <span className="truncate">{doc.title}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                            {doc.docType}
                          </span>
                        </div>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 font-semibold ml-2 shrink-0"
                        >
                          <span>View</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-lg shadow-indigo-600/20"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{editingAppliance ? 'Update Appliance' : 'Save Appliance Record'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ApplianceModal;
