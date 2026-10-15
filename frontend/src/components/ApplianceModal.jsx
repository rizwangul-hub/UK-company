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
  Building2,
  Receipt,
} from 'lucide-react';
import { appliancesAPI, propertiesAPI } from '../services/api.js';
import { ModalPortal } from './ModalPortal.jsx';

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
  propertyId: initialPropertyId,
  propertyName: initialPropertyName,
  editingAppliance,
  onSuccess,
}) {
  const [activeTab, setActiveTab] = useState('general'); // 'general' | 'manufacturer' | 'service' | 'valet' | 'receipt'
  const [properties, setProperties] = useState([]);
  const [receiptsList, setReceiptsList] = useState([]);
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
    itemCode: '',
    purchasePrice: '',
    careServicesChargeGBP: '',
    purchaseDate: '',
    installationDate: '',
    propertyId: initialPropertyId || '',
    isPendingLocation: !initialPropertyId,
    supplierReceiptId: '',

    // 1. Manufacturer Warranty
    mfgProvider: '',
    mfgWarrantyType: 'STANDARD_MANUFACTURER',
    mfgDurationYears: '1',
    mfgStartDate: '',
    mfgExpiryDate: '',
    mfgPolicyNumber: '',
    mfgVerificationStatus: 'NOT_VERIFIED',

    // 2. Extended Warranty
    hasExtWarranty: false,
    extProvider: '',
    extDurationYears: '5',
    extStartDate: '',
    extExpiryDate: '',
    extPolicyNumber: '',

    // 3. Service Agreement (Currys Care & Repair, Howdens Care)
    hasServiceAgreement: false,
    serviceProvider: 'Currys Care & Repair',
    agreementReference: '',
    planType: 'PAY_UPFRONT',
    planDurationYears: '5',
    serviceStartDate: '',
    serviceEndDate: '',
    serviceChargeGBP: '',
    isAgreementVerified: false,

    // 4. Annual Squeaky Clean Valet
    valetStatus: 'NOT_VERIFIED',
    nextValetDueDate: '',
    bookingReference: '',
    bookedAppointmentDate: '',
    serviceNotes: '',
    notes: '',
  });

  useEffect(() => {
    if (isOpen) {
      propertiesAPI.getAll().then((res) => {
        if (res?.success) setProperties(res.data?.properties || []);
      }).catch(() => {});

      appliancesAPI.getReceipts().then((res) => {
        if (res?.success) setReceiptsList(res.data || []);
      }).catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    if (editingAppliance) {
      const mfg = editingAppliance.manufacturerWarranty || {};
      const ext = editingAppliance.extendedWarranty || {};
      const srv = editingAppliance.serviceAgreement || editingAppliance.currysCareAndRepair || {};
      const val = editingAppliance.squeakyCleanValet || {};

      setFormData({
        name: editingAppliance.name || '',
        applianceType: editingAppliance.applianceType || 'WASHING_MACHINE',
        brand: editingAppliance.brand || '',
        modelNumber: editingAppliance.modelNumber || '',
        serialNumber: editingAppliance.serialNumber || '',
        supplier: editingAppliance.supplier || 'Currys',
        itemCode: editingAppliance.itemCode || '',
        purchasePrice: editingAppliance.purchasePrice !== undefined ? String(editingAppliance.purchasePrice) : '',
        careServicesChargeGBP: editingAppliance.careServicesChargeGBP !== undefined ? String(editingAppliance.careServicesChargeGBP) : '',
        purchaseDate: editingAppliance.purchaseDate ? editingAppliance.purchaseDate.slice(0, 10) : '',
        installationDate: editingAppliance.installationDate ? editingAppliance.installationDate.slice(0, 10) : '',
        propertyId: editingAppliance.propertyId?._id || editingAppliance.propertyId || '',
        isPendingLocation: editingAppliance.propertyAssignmentStatus === 'PENDING_VERIFICATION' || !editingAppliance.propertyId,
        supplierReceiptId: editingAppliance.supplierReceiptId?._id || editingAppliance.supplierReceiptId || '',

        mfgProvider: mfg.provider || editingAppliance.brand || '',
        mfgWarrantyType: mfg.warrantyType || 'STANDARD_MANUFACTURER',
        mfgDurationYears: String(mfg.durationYears || 1),
        mfgStartDate: mfg.startDate ? mfg.startDate.slice(0, 10) : (editingAppliance.purchaseDate ? editingAppliance.purchaseDate.slice(0, 10) : ''),
        mfgExpiryDate: mfg.expiryDate ? mfg.expiryDate.slice(0, 10) : (editingAppliance.warrantyExpiryDate ? editingAppliance.warrantyExpiryDate.slice(0, 10) : ''),
        mfgPolicyNumber: mfg.policyNumber || '',
        mfgVerificationStatus: mfg.verificationStatus || 'NOT_VERIFIED',

        hasExtWarranty: !!ext.hasExtendedWarranty || !!editingAppliance.hasExtendedWarranty,
        extProvider: ext.provider || '',
        extDurationYears: String(ext.durationYears || 5),
        extStartDate: ext.startDate ? ext.startDate.slice(0, 10) : '',
        extExpiryDate: ext.expiryDate ? ext.expiryDate.slice(0, 10) : (editingAppliance.extendedWarrantyExpiryDate ? editingAppliance.extendedWarrantyExpiryDate.slice(0, 10) : ''),
        extPolicyNumber: ext.policyNumber || '',

        hasServiceAgreement: !!srv.hasAgreement || !!editingAppliance.currysCareAndRepair?.hasPlan,
        serviceProvider: srv.provider || 'Currys Care & Repair',
        agreementReference: srv.agreementReference || editingAppliance.currysCareAndRepair?.planReferenceNumber || '',
        planType: srv.planType || editingAppliance.currysCareAndRepair?.planType || 'PAY_UPFRONT',
        planDurationYears: String(srv.durationYears || (editingAppliance.currysCareAndRepair?.planDuration === '5_YEARS' ? 5 : 5)),
        serviceStartDate: srv.startDate ? srv.startDate.slice(0, 10) : (editingAppliance.currysCareAndRepair?.planStartDate ? editingAppliance.currysCareAndRepair.planStartDate.slice(0, 10) : ''),
        serviceEndDate: srv.endDate ? srv.endDate.slice(0, 10) : (editingAppliance.currysCareAndRepair?.planEndDate ? editingAppliance.currysCareAndRepair.planEndDate.slice(0, 10) : ''),
        serviceChargeGBP: String(editingAppliance.careServicesChargeGBP || srv.chargeGBP || 0),
        isAgreementVerified: srv.verificationStatus === 'VERIFIED' || !!editingAppliance.currysCareAndRepair?.isPlanVerified,

        valetStatus: val.eligibilityStatus || 'NOT_VERIFIED',
        nextValetDueDate: val.nextValetDueDate ? val.nextValetDueDate.slice(0, 10) : '',
        bookingReference: val.bookingReference || '',
        bookedAppointmentDate: val.bookedAppointmentDate ? val.bookedAppointmentDate.slice(0, 10) : '',
        serviceNotes: val.serviceNotes || '',
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
        itemCode: '',
        purchasePrice: '',
        careServicesChargeGBP: '',
        purchaseDate: '',
        installationDate: '',
        propertyId: initialPropertyId || '',
        isPendingLocation: !initialPropertyId,
        supplierReceiptId: '',

        mfgProvider: '',
        mfgWarrantyType: 'STANDARD_MANUFACTURER',
        mfgDurationYears: '1',
        mfgStartDate: '',
        mfgExpiryDate: '',
        mfgPolicyNumber: '',
        mfgVerificationStatus: 'NOT_VERIFIED',

        hasExtWarranty: false,
        extProvider: '',
        extDurationYears: '5',
        extStartDate: '',
        extExpiryDate: '',
        extPolicyNumber: '',

        hasServiceAgreement: false,
        serviceProvider: 'Currys Care & Repair',
        agreementReference: '',
        planType: 'PAY_UPFRONT',
        planDurationYears: '5',
        serviceStartDate: '',
        serviceEndDate: '',
        serviceChargeGBP: '',
        isAgreementVerified: false,

        valetStatus: 'NOT_VERIFIED',
        nextValetDueDate: '',
        bookingReference: '',
        bookedAppointmentDate: '',
        serviceNotes: '',
        notes: '',
      });
      setReceiptFile(null);
    }
    setErrorMsg('');
    setActiveTab('general');
  }, [editingAppliance, isOpen, initialPropertyId]);

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
      const selectedProp = formData.isPendingLocation ? null : (formData.propertyId || initialPropertyId || null);

      const payload = {
        propertyId: selectedProp,
        propertyAssignmentStatus: selectedProp ? 'ASSIGNED' : 'PENDING_VERIFICATION',
        supplierReceiptId: formData.supplierReceiptId || null,
        name: formData.name.trim(),
        applianceType: formData.applianceType,
        brand: formData.brand.trim(),
        modelNumber: formData.modelNumber.trim(),
        serialNumber: formData.serialNumber.trim(),
        supplier: formData.supplier.trim() || 'Currys',
        itemCode: formData.itemCode.trim(),
        purchasePrice: Number(formData.purchasePrice) || 0,
        careServicesChargeGBP: Number(formData.careServicesChargeGBP) || 0,
        purchaseDate: formData.purchaseDate || null,
        installationDate: formData.installationDate || null,

        // 1. Separate Manufacturer Warranty
        manufacturerWarranty: {
          provider: formData.mfgProvider.trim() || formData.brand.trim(),
          warrantyType: formData.mfgWarrantyType,
          durationYears: Number(formData.mfgDurationYears) || 1,
          startDate: formData.mfgStartDate || formData.purchaseDate || null,
          expiryDate: formData.mfgExpiryDate || null,
          policyNumber: formData.mfgPolicyNumber.trim(),
          verificationStatus: formData.mfgVerificationStatus,
        },

        // 2. Separate Extended Warranty
        extendedWarranty: {
          hasExtendedWarranty: formData.hasExtWarranty,
          provider: formData.extProvider.trim(),
          durationYears: Number(formData.extDurationYears) || 5,
          startDate: formData.extStartDate || null,
          expiryDate: formData.extExpiryDate || null,
          policyNumber: formData.extPolicyNumber.trim(),
          verificationStatus: formData.hasExtWarranty ? 'VERIFIED' : 'NOT_VERIFIED',
        },

        // 3. Separate Service Agreement / Currys Care & Repair
        serviceAgreement: {
          hasAgreement: formData.hasServiceAgreement,
          provider: formData.serviceProvider.trim(),
          agreementReference: formData.agreementReference.trim(),
          planType: formData.planType,
          durationYears: Number(formData.planDurationYears) || 5,
          startDate: formData.serviceStartDate || null,
          endDate: formData.serviceEndDate || null,
          chargeGBP: Number(formData.serviceChargeGBP || formData.careServicesChargeGBP) || 0,
          verificationStatus: formData.isAgreementVerified ? 'VERIFIED' : 'NOT_VERIFIED',
        },

        // 4. Annual Squeaky Clean Valet
        squeakyCleanValet: {
          eligibilityStatus: formData.valetStatus,
          nextValetDueDate: formData.nextValetDueDate || null,
          bookingReference: formData.bookingReference.trim(),
          bookedAppointmentDate: formData.bookedAppointmentDate || null,
          appointedServiceProvider: formData.supplier || 'Currys',
          serviceNotes: formData.serviceNotes.trim(),
        },

        isPropertyAssignedVerified: !formData.isPendingLocation && !!selectedProp,
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

      // Attach file if uploaded
      if (receiptFile && savedAppliance?._id) {
        const fileData = new FormData();
        fileData.append('file', receiptFile);
        fileData.append('title', `${formData.supplier} Receipt - ${formData.name}`);
        fileData.append('docType', 'PURCHASE_RECEIPT');
        await appliancesAPI.uploadDocument(savedAppliance._id, fileData);
      }

      if (onSuccess) onSuccess(savedAppliance);
      onClose();
    } catch (err) {
      console.error('Save appliance failed:', err);
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to save appliance');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalPortal isOpen={true} onClose={onClose}>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                {editingAppliance ? 'Edit Appliance & Contract' : 'Register New Appliance'}
              </h2>
              <p className="text-xs text-slate-400">
                Independent records for equipment, warranties, Currys/Howdens service agreements, and valets.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-4 sm:px-5 border-b border-slate-800 bg-slate-950/50 overflow-x-auto text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`py-3 px-3 font-semibold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'general'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Equipment &amp; Property
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('manufacturer')}
            className={`py-3 px-3 font-semibold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'manufacturer'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Manufacturer Warranty
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('service')}
            className={`py-3 px-3 font-semibold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'service'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Care &amp; Repair / Service Plan
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('valet')}
            className={`py-3 px-3 font-semibold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'valet'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Annual Valet
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('receipt')}
            className={`py-3 px-3 font-semibold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === 'receipt'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Receipt &amp; Documents
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: GENERAL & PROPERTY ASSIGNMENT */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              {/* Location Verification Switch */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-white block">Property Location Assignment</span>
                    <span className="text-[11px] text-slate-400">
                      Receipt source records can remain pending until physical location is confirmed.
                    </span>
                  </div>
                  <label className="flex items-center gap-2 text-slate-300 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isPendingLocation}
                      onChange={(e) => setFormData({ ...formData, isPendingLocation: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
                    />
                    <span className="text-amber-400">Pending Location Verification</span>
                  </label>
                </div>

                {!formData.isPendingLocation && (
                  <div className="pt-2">
                    <label className="block text-slate-300 font-medium mb-1">Assign to Property *</label>
                    <select
                      value={formData.propertyId}
                      onChange={(e) => setFormData({ ...formData, propertyId: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">Select a Property...</option>
                      {properties.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name} ({p.postcode || p.city})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Master Receipt Link */}
              {receiptsList.length > 0 && (
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Link Master Supplier Receipt (Optional)</label>
                  <select
                    value={formData.supplierReceiptId}
                    onChange={(e) => setFormData({ ...formData, supplierReceiptId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Independent / No Master Receipt Linked</option>
                    {receiptsList.map((r) => (
                      <option key={r._id} value={r._id}>
                        {r.supplier} #{r.receiptNumber} ({new Date(r.receiptDate).toLocaleDateString('en-GB')}) — £{r.totalAmountDueGBP?.toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Appliance Name / Title *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. INDESIT IMA864MYT IMEUK"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Appliance Category *</label>
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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Brand / Manufacturer</label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="e.g. INDESIT, LOGIK, BEKO"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Model Number</label>
                  <input
                    type="text"
                    value={formData.modelNumber}
                    onChange={(e) => setFormData({ ...formData, modelNumber: e.target.value })}
                    placeholder="e.g. IMA864MYT IMEUK"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Serial Number</label>
                  <input
                    type="text"
                    value={formData.serialNumber}
                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                    placeholder="Leave empty if unverified"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Supplier / Store</label>
                  <input
                    type="text"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    placeholder="e.g. Currys, Howdens"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Supplier Item Code</label>
                  <input
                    type="text"
                    value={formData.itemCode}
                    onChange={(e) => setFormData({ ...formData, itemCode: e.target.value })}
                    placeholder="e.g. 0000628710"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Purchase Price (£ GBP)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                    placeholder="e.g. 279.00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Purchase Date</label>
                  <input
                    type="date"
                    value={formData.purchaseDate}
                    onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Installation Date</label>
                  <input
                    type="date"
                    value={formData.installationDate}
                    onChange={(e) => setFormData({ ...formData, installationDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Operational Notes</label>
                <textarea
                  rows="2"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Installation location in kitchen, access keys, or specific details..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          {/* TAB 2: MANUFACTURER & EXTENDED WARRANTY */}
          {activeTab === 'manufacturer' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="font-bold text-white block">Standard Manufacturer Warranty</span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Warranty Provider</label>
                    <input
                      type="text"
                      value={formData.mfgProvider}
                      onChange={(e) => setFormData({ ...formData, mfgProvider: e.target.value })}
                      placeholder="e.g. Indesit, Logik, Bosch"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Duration (Years)</label>
                    <select
                      value={formData.mfgDurationYears}
                      onChange={(e) => setFormData({ ...formData, mfgDurationYears: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="1">1 Year</option>
                      <option value="2">2 Years</option>
                      <option value="5">5 Years</option>
                      <option value="10">10 Years</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Expiry Date</label>
                    <input
                      type="date"
                      value={formData.mfgExpiryDate}
                      onChange={(e) => setFormData({ ...formData, mfgExpiryDate: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Policy / Reg Reference</label>
                    <input
                      type="text"
                      value={formData.mfgPolicyNumber}
                      onChange={(e) => setFormData({ ...formData, mfgPolicyNumber: e.target.value })}
                      placeholder="e.g. REG-982144"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Verification Status</label>
                    <select
                      value={formData.mfgVerificationStatus}
                      onChange={(e) => setFormData({ ...formData, mfgVerificationStatus: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="NOT_VERIFIED">Unverified (Pending Doc)</option>
                      <option value="VERIFIED">Verified with Certificate</option>
                      <option value="EXPIRED">Expired</option>
                      <option value="MISSING_DOCS">Missing Documents</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Extended Warranty */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white block">Separate Extended Warranty</span>
                  <label className="flex items-center gap-2 text-slate-300 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.hasExtWarranty}
                      onChange={(e) => setFormData({ ...formData, hasExtWarranty: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
                    />
                    <span>Has Extended Warranty</span>
                  </label>
                </div>

                {formData.hasExtWarranty && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Extended Provider</label>
                      <input
                        type="text"
                        value={formData.extProvider}
                        onChange={(e) => setFormData({ ...formData, extProvider: e.target.value })}
                        placeholder="e.g. Domestic & General, 5-Yr Howdens"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Duration</label>
                      <select
                        value={formData.extDurationYears}
                        onChange={(e) => setFormData({ ...formData, extDurationYears: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                      >
                        <option value="2">2 Years</option>
                        <option value="3">3 Years</option>
                        <option value="5">5 Years</option>
                        <option value="10">10 Years</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Expiry Date</label>
                      <input
                        type="date"
                        value={formData.extExpiryDate}
                        onChange={(e) => setFormData({ ...formData, extExpiryDate: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: CURRYS CARE & REPAIR / SERVICE CONTRACT */}
          {activeTab === 'service' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-amber-300 block">Currys Care &amp; Repair / Service Agreement</span>
                    <span className="text-[11px] text-slate-400">
                      7-day fix promise, zero repair bills for parts/labour, and annual Squeaky Clean Valet entitlement.
                    </span>
                  </div>
                  <label className="flex items-center gap-2 text-slate-300 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.hasServiceAgreement}
                      onChange={(e) => setFormData({ ...formData, hasServiceAgreement: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-amber-600 focus:ring-0"
                    />
                    <span className="text-white">Active Plan</span>
                  </label>
                </div>

                {formData.hasServiceAgreement && (
                  <div className="space-y-3 pt-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-300 font-medium mb-1">Agreement Reference Number *</label>
                        <input
                          type="text"
                          value={formData.agreementReference}
                          onChange={(e) => setFormData({ ...formData, agreementReference: e.target.value })}
                          placeholder="e.g. 1453938413 (from Currys receipt)"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-medium mb-1">Service Plan Provider</label>
                        <input
                          type="text"
                          value={formData.serviceProvider}
                          onChange={(e) => setFormData({ ...formData, serviceProvider: e.target.value })}
                          placeholder="e.g. Currys Care & Repair"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-slate-300 font-medium mb-1">Plan Payment Type</label>
                        <select
                          value={formData.planType}
                          onChange={(e) => setFormData({ ...formData, planType: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        >
                          <option value="PAY_UPFRONT">Pay Upfront</option>
                          <option value="PAY_MONTHLY">Pay Monthly</option>
                          <option value="ANNUAL_CONTRACT">Annual Contract</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-300 font-medium mb-1">Plan Duration</label>
                        <select
                          value={formData.planDurationYears}
                          onChange={(e) => setFormData({ ...formData, planDurationYears: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        >
                          <option value="2">2 Years</option>
                          <option value="3">3 Years</option>
                          <option value="5">5 Years (Currys Standard)</option>
                          <option value="10">10 Years</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-300 font-medium mb-1">Care Services Charge (£)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.careServicesChargeGBP}
                          onChange={(e) => setFormData({ ...formData, careServicesChargeGBP: e.target.value })}
                          placeholder="e.g. 150.00"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-300 font-medium mb-1">Plan Start Date</label>
                        <input
                          type="date"
                          value={formData.serviceStartDate}
                          onChange={(e) => setFormData({ ...formData, serviceStartDate: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-300 font-medium mb-1">Plan End Date</label>
                        <input
                          type="date"
                          value={formData.serviceEndDate}
                          onChange={(e) => setFormData({ ...formData, serviceEndDate: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    <div className="pt-1">
                      <label className="flex items-center gap-2 text-slate-300 font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.isAgreementVerified}
                          onChange={(e) => setFormData({ ...formData, isAgreementVerified: e.target.checked })}
                          className="rounded bg-slate-900 border-slate-700 text-amber-600 focus:ring-0"
                        />
                        <span className="text-amber-400">Verified against source receipt / contract document</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: ANNUAL SQUEAKY CLEAN VALET */}
          {activeTab === 'valet' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 space-y-3">
                <span className="font-bold text-blue-300 block">Annual Squeaky Clean Valet Scheduling</span>
                <p className="text-[11px] text-slate-400">
                  Included each year on qualifying appliances covered by Currys Care &amp; Repair.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Valet Eligibility Status</label>
                    <select
                      value={formData.valetStatus}
                      onChange={(e) => setFormData({ ...formData, valetStatus: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="NOT_VERIFIED">Unverified</option>
                      <option value="ELIGIBLE">Eligible (Under Care Plan)</option>
                      <option value="DUE">Annual Valet Due</option>
                      <option value="BOOKING_REQUIRED">Booking Required</option>
                      <option value="BOOKED">Booked with Currys</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="NOT_ELIGIBLE">Not Eligible</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Next Due Date</label>
                    <input
                      type="date"
                      value={formData.nextValetDueDate}
                      onChange={(e) => setFormData({ ...formData, nextValetDueDate: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Booking Reference</label>
                    <input
                      type="text"
                      value={formData.bookingReference}
                      onChange={(e) => setFormData({ ...formData, bookingReference: e.target.value })}
                      placeholder="e.g. CUR-VAL-8823"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Booked Visit Date</label>
                    <input
                      type="date"
                      value={formData.bookedAppointmentDate}
                      onChange={(e) => setFormData({ ...formData, bookedAppointmentDate: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Valet Service / Engineer Notes</label>
                  <textarea
                    rows="2"
                    value={formData.serviceNotes}
                    onChange={(e) => setFormData({ ...formData, serviceNotes: e.target.value })}
                    placeholder="Completed descaling cycle, flushed condenser vents..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: RECEIPT & DOCUMENTS */}
          {activeTab === 'receipt' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="font-bold text-white block">Attach New Document / Receipt Scan</span>
                <p className="text-[11px] text-slate-400">
                  Upload Currys receipt, Howdens invoice, warranty certificate, or Care &amp; Repair agreement.
                </p>

                <input
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/webp"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
                />
              </div>

              {editingAppliance?.documents && editingAppliance.documents.length > 0 && (
                <div className="space-y-2">
                  <span className="font-bold text-white block">Existing Documents ({editingAppliance.documents.length})</span>
                  <div className="space-y-1.5">
                    {editingAppliance.documents.map((doc) => (
                      <div
                        key={doc._id}
                        className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-indigo-400" />
                          <span className="font-medium text-slate-200">{doc.title}</span>
                          <span className="text-[10px] text-slate-500">({doc.docType})</span>
                        </div>
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
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

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition flex items-center gap-2 shadow-lg shadow-indigo-600/30 cursor-pointer disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{editingAppliance ? 'Save Changes' : 'Register Appliance'}</span>
            </button>
          </div>
        </form>
      </div>
    </ModalPortal>
  );
}

export default ApplianceModal;
