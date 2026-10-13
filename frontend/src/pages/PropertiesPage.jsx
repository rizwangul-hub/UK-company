import React, { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Search,
  MapPin,
  Landmark,
  ShieldAlert,
  ChevronRight,
  ShieldCheck,
  Percent,
  Layers,
  X,
  Loader2,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  FileText,
  DollarSign,
  Receipt,
  TrendingUp,
  Zap,
  Home,
} from 'lucide-react';
import { formatGBP, formatUKDate } from '../utils/formatters.js';
import { propertiesAPI } from '../services/api.js';

export function PropertiesPage({ onSelectProperty, selectedCompany }) {
  const [properties, setProperties] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tenureFilter, setTenureFilter] = useState('');

  // Property Create / Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Property Details Drawer / Modal State
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [detailedPropertyData, setDetailedPropertyData] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailTab, setDetailTab] = useState('overview'); // 'overview' | 'units' | 'compliance' | 'mortgages'

  // Unit Modal State (Inside Property Details)
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [unitSubmitting, setUnitSubmitting] = useState(false);
  const [unitError, setUnitError] = useState('');
  const [unitForm, setUnitForm] = useState({
    unitName: '',
    unitType: 'FLAT',
    floor: 'Ground',
    floorAreaSqFt: '',
    targetRent: '',
    status: 'VACANT',
    notes: '',
  });

  const [formData, setFormData] = useState({
    name: '',
    propertyType: 'Residential',
    contractualRent: '',
    rentFrequency: 'MONTHLY',
    status: 'Available',
    tenantName: '',
    addressLine1: '',
    addressLine2: '',
    city: 'London',
    postcode: '',
    tenure: 'FREEHOLD',
    ownershipEntity: 'Personal',
    purchasePrice: '',
    currentValuation: '',
    epcRating: 'C',
    gasSafetyExpiryDate: '',
    eicrExpiryDate: '',
    notes: '',
  });

  const loadProperties = async () => {
    setLoading(true);
    try {
      const res = await propertiesAPI.getAll({
        search,
        tenure: tenureFilter || undefined,
      });
      if (res?.success) {
        setProperties(res.data.properties || []);
        setSummary(res.data.summary || null);
      }
    } catch (err) {
      console.error('Failed to load properties:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProperties();
  }, [search, tenureFilter]);

  // Open Details Modal
  const handleOpenDetails = async (prop, e) => {
    if (e) e.stopPropagation();
    setSelectedProperty(prop);
    setDetailedPropertyData(prop);
    setDetailTab('overview');
    setLoadingDetails(true);
    if (onSelectProperty) onSelectProperty(prop._id);

    try {
      const res = await propertiesAPI.getById(prop._id);
      if (res?.success && res.data) {
        setDetailedPropertyData(res.data);
      }
    } catch (err) {
      console.error('Failed to load full property details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleCloseDetails = () => {
    setSelectedProperty(null);
    setDetailedPropertyData(null);
    setShowUnitModal(false);
  };

  // Property Create / Edit Handlers
  const handleOpenCreate = () => {
    setEditingProperty(null);
    setFormData({
      name: '',
      propertyType: 'Residential',
      contractualRent: '',
      rentFrequency: 'MONTHLY',
      status: 'Available',
      tenantName: '',
      addressLine1: '',
      addressLine2: '',
      city: 'London',
      postcode: '',
      tenure: 'FREEHOLD',
      ownershipEntity: 'Personal',
      purchasePrice: '',
      currentValuation: '',
      epcRating: 'C',
      gasSafetyExpiryDate: '',
      eicrExpiryDate: '',
      notes: '',
    });
    setFormError('');
    setShowModal(true);
  };

  const handleOpenEdit = (prop, e) => {
    if (e) e.stopPropagation();
    setEditingProperty(prop);
    setFormData({
      name: prop.name || '',
      propertyType: prop.propertyType || 'Residential',
      contractualRent: prop.contractualRent !== undefined && prop.contractualRent !== null ? String(prop.contractualRent) : '',
      rentFrequency: prop.rentFrequency || 'MONTHLY',
      status: prop.status || 'Available',
      tenantName: prop.tenantName || '',
      addressLine1: prop.addressLine1 || '',
      addressLine2: prop.addressLine2 || '',
      city: prop.city || 'London',
      postcode: prop.postcode || '',
      tenure: prop.tenure || 'FREEHOLD',
      ownershipEntity: prop.ownershipEntity || 'Personal',
      purchasePrice: prop.purchasePrice || '',
      currentValuation: prop.currentValuation || '',
      epcRating: prop.compliance?.epcRating || 'C',
      gasSafetyExpiryDate: prop.compliance?.gasSafetyExpiryDate ? prop.compliance.gasSafetyExpiryDate.slice(0, 10) : '',
      eicrExpiryDate: prop.compliance?.eicrExpiryDate ? prop.compliance.eicrExpiryDate.slice(0, 10) : '',
      notes: prop.notes || '',
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError('');

    try {
      const payload = {
        name: formData.name.trim(),
        propertyType: formData.propertyType,
        contractualRent: Number(formData.contractualRent) || 0,
        rentFrequency: formData.rentFrequency,
        status: formData.status,
        tenantName: formData.tenantName.trim(),
        addressLine1: formData.addressLine1.trim(),
        addressLine2: formData.addressLine2.trim(),
        city: formData.city.trim(),
        postcode: formData.postcode.trim().toUpperCase(),
        tenure: formData.tenure,
        ownershipEntity: formData.ownershipEntity.trim(),
        purchasePrice: Number(formData.purchasePrice) || 0,
        currentValuation: Number(formData.currentValuation) || Number(formData.purchasePrice) || 0,
        compliance: {
          epcRating: formData.epcRating,
          gasSafetyExpiryDate: formData.gasSafetyExpiryDate || null,
          eicrExpiryDate: formData.eicrExpiryDate || null,
        },
        notes: formData.notes.trim(),
      };

      if (editingProperty) {
        await propertiesAPI.update(editingProperty._id, payload);
        if (selectedProperty && selectedProperty._id === editingProperty._id) {
          const detailRes = await propertiesAPI.getById(editingProperty._id);
          if (detailRes?.success) setDetailedPropertyData(detailRes.data);
        }
      } else {
        await propertiesAPI.create(payload);
      }

      setShowModal(false);
      loadProperties();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save property.');
    } finally {
      setSubmitting(false);
    }
  };

  // Unit Management Handlers
  const handleOpenAddUnit = () => {
    setEditingUnit(null);
    setUnitForm({
      unitName: '',
      unitType: 'FLAT',
      floor: 'Ground',
      floorAreaSqFt: '',
      targetRent: '',
      status: 'VACANT',
      notes: '',
    });
    setUnitError('');
    setShowUnitModal(true);
  };

  const handleOpenEditUnit = (unit, e) => {
    if (e) e.stopPropagation();
    setEditingUnit(unit);
    setUnitForm({
      unitName: unit.unitName || '',
      unitType: unit.unitType || 'FLAT',
      floor: unit.floor || 'Ground',
      floorAreaSqFt: unit.floorAreaSqFt || '',
      targetRent: unit.targetRent || '',
      status: unit.status || 'VACANT',
      notes: unit.notes || '',
    });
    setUnitError('');
    setShowUnitModal(true);
  };

  const handleUnitSubmit = async (e) => {
    e.preventDefault();
    const propId = selectedProperty?._id || detailedPropertyData?._id;
    if (!propId) return;

    setUnitSubmitting(true);
    setUnitError('');

    try {
      const payload = {
        unitName: unitForm.unitName.trim(),
        unitType: unitForm.unitType,
        floor: unitForm.floor.trim(),
        floorAreaSqFt: Number(unitForm.floorAreaSqFt) || 0,
        targetRent: Number(unitForm.targetRent) || 0,
        status: unitForm.status,
        notes: unitForm.notes.trim(),
      };

      if (editingUnit) {
        await propertiesAPI.updateUnit(propId, editingUnit._id, payload);
      } else {
        await propertiesAPI.addUnit(propId, payload);
      }

      setShowUnitModal(false);
      // Reload details and parent list
      const res = await propertiesAPI.getById(propId);
      if (res?.success) {
        setDetailedPropertyData(res.data);
      }
      loadProperties();
    } catch (err) {
      setUnitError(err.response?.data?.message || 'Failed to save unit.');
    } finally {
      setUnitSubmitting(false);
    }
  };

  const handleDeleteUnit = async (unitId, e) => {
    if (e) e.stopPropagation();
    const propId = selectedProperty?._id || detailedPropertyData?._id;
    if (!propId) return;

    if (!window.confirm('Are you sure you want to archive this unit?')) return;
    try {
      await propertiesAPI.deleteUnit(propId, unitId);
      const res = await propertiesAPI.getById(propId);
      if (res?.success) {
        setDetailedPropertyData(res.data);
      }
      loadProperties();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete unit');
    }
  };

  // Helper styles for EPC
  const getEpcBadgeStyle = (rating) => {
    switch (rating) {
      case 'A': return 'bg-emerald-600 text-white';
      case 'B': return 'bg-emerald-500 text-white';
      case 'C': return 'bg-lime-500 text-slate-950 font-black';
      case 'D': return 'bg-amber-400 text-slate-950 font-black';
      case 'E': return 'bg-orange-500 text-white';
      case 'F': return 'bg-rose-500 text-white';
      case 'G': return 'bg-red-700 text-white';
      default: return 'bg-slate-700 text-slate-300';
    }
  };

  // Helper styles for Statutory Compliance Dates
  const getComplianceStatus = (dateStr) => {
    if (!dateStr) return { status: 'MISSING', label: 'Not Recorded', color: 'text-slate-400 bg-slate-800/80 border-slate-700' };
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      return { status: 'EXPIRED', label: `Expired (${formatUKDate(dateStr)})`, color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' };
    } else if (diffDays <= 30) {
      return { status: 'EXPIRING', label: `Expires in ${diffDays}d (${formatUKDate(dateStr)})`, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
    } else {
      return { status: 'VALID', label: `Valid until ${formatUKDate(dateStr)}`, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
    }
  };

  const propDetail = detailedPropertyData || selectedProperty;
  const unitsList = propDetail?.units || [];
  const mortgagesList = propDetail?.mortgages || [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Properties &amp; Portfolio
            </h1>
            {selectedCompany?.name && (
              <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {selectedCompany.name}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Direct property ownership, contractual rents, tenancy tracking, and mortgage liabilities for {selectedCompany?.legalName || selectedCompany?.name || 'the active portfolio'}.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Property</span>
        </button>
      </div>

      {/* Portfolio Summary KPI Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-medium uppercase tracking-wider">Properties</span>
            <Building2 className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-white mt-1 tabular-nums">
            {summary?.totalProperties || properties.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {summary?.occupiedCount || properties.filter((p) => p.status === 'Occupied' || p.tenantName).length} Occupied · {summary?.availableCount || properties.filter((p) => p.status !== 'Occupied' && !p.tenantName).length} Available
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-medium uppercase tracking-wider">Monthly Rent Roll</span>
            <Receipt className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1 tabular-nums font-display">
            {formatGBP(summary?.totalContractualRent || properties.reduce((s, p) => s + (p.contractualRent || 0), 0))}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Contractual monthly income</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-medium uppercase tracking-wider">Portfolio Valuation</span>
            <TrendingUp className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-white mt-1 tabular-nums font-display">
            {formatGBP(summary?.totalValuation || properties.reduce((s, p) => s + (p.currentValuation || p.purchasePrice || 0), 0))}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Market asset base</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[11px] font-medium uppercase tracking-wider">Mortgage Debt</span>
            <Landmark className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-rose-300 mt-1 tabular-nums font-display">
            {formatGBP(summary?.totalMortgageDebt || properties.reduce((s, p) => s + (p.totalMortgageDebt || 0), 0))}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {properties.reduce((s, p) => s + (p.activeMortgagesCount || 0), 0)} Linked facilities
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by property name, UK postcode, address, town..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={tenureFilter}
            onChange={(e) => setTenureFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none cursor-pointer"
          >
            <option value="">All Tenures</option>
            <option value="FREEHOLD">Freehold</option>
            <option value="LEASEHOLD">Leasehold</option>
            <option value="SHARE_OF_FREEHOLD">Share of Freehold</option>
          </select>
        </div>
      </div>

      {/* Properties Grid */}
      {loading ? (
        <div className="py-20 flex items-center justify-center text-slate-500 gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
          <span className="text-xs">Loading property portfolio...</span>
        </div>
      ) : properties.length === 0 ? (
        <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <Building2 className="w-10 h-10 text-slate-600 mx-auto" />
          <div className="text-sm font-semibold text-slate-300">
            No properties recorded yet for {selectedCompany?.name || 'this company'}
          </div>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Get started by adding your first UK residential, commercial, or HMO property under {selectedCompany?.legalName || selectedCompany?.name || 'this portfolio'}.
          </p>
          <button
            onClick={handleOpenCreate}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-medium cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Property</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map((prop) => (
            <div
              key={prop._id}
              onClick={() => handleOpenDetails(prop)}
              className="bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 transition cursor-pointer flex flex-col justify-between group shadow-sm hover:shadow-xl"
            >
              <div>
                {/* Header & Badges */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-bold text-white group-hover:text-indigo-400 transition truncate flex items-center gap-1.5">
                      <Home className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span className="truncate">{prop.name}</span>
                    </h3>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-1">
                      <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                      <span className="truncate">
                        {prop.addressLine1}
                        {prop.city && !prop.addressLine1?.toLowerCase().includes(prop.city.toLowerCase()) ? `, ${prop.city}` : ''}
                        {prop.postcode ? ` (${prop.postcode})` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        prop.status === 'Occupied'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : prop.status === 'Active'
                          ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                          : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
                      }`}
                    >
                      {prop.status || 'Available'}
                    </span>
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      {prop.propertyType?.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                {/* Contractual Rent Highlight Box */}
                <div className="mt-3.5 p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                      Contractual Rent
                    </span>
                    <div className="text-base font-extrabold text-emerald-400 font-display tabular-nums mt-0.5">
                      {formatGBP(prop.contractualRent || 0)}
                      <span className="text-[11px] font-normal text-slate-400">
                        {' '}/ {prop.rentFrequency === 'ANNUALLY' ? 'yr' : 'mo'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    {prop.tenantName ? (
                      <div className="max-w-[140px]">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                          Tenant
                        </span>
                        <span className="text-xs font-semibold text-slate-200 truncate block mt-0.5" title={prop.tenantName}>
                          {prop.tenantName}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-500 italic">Vacant / Unlet</span>
                    )}
                  </div>
                </div>

                {/* Valuation & Debt Grid */}
                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-800/80 text-xs">
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">Asset Value</div>
                    <div className="text-xs font-bold text-slate-200 mt-0.5 tabular-nums">
                      {formatGBP(prop.currentValuation || prop.purchasePrice)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">Mortgage Debt</div>
                    <div className={`text-xs font-bold mt-0.5 tabular-nums ${prop.totalMortgageDebt > 0 ? 'text-rose-300' : 'text-slate-400'}`}>
                      {prop.totalMortgageDebt > 0 ? formatGBP(prop.totalMortgageDebt) : 'Unencumbered'}
                    </div>
                  </div>
                </div>

                {/* Additional Info Badges */}
                <div className="mt-3 flex items-center gap-2 text-[10px] flex-wrap">
                  {prop.tenure && (
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {prop.tenure.replace('_', ' ')}
                    </span>
                  )}
                  {prop.compliance?.epcRating && (
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      EPC: <span className="font-bold text-indigo-400">{prop.compliance.epcRating}</span>
                    </span>
                  )}
                  {prop.activeMortgagesCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20">
                      {prop.activeMortgagesCount} {prop.activeMortgagesCount === 1 ? 'Mortgage' : 'Mortgages'}
                    </span>
                  )}
                  {prop.totalUnits > 1 && (
                    <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                      {prop.totalUnits} Units
                    </span>
                  )}
                </div>
              </div>

              {/* Action row */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={(e) => handleOpenEdit(prop, e)}
                  className="text-slate-400 hover:text-white transition cursor-pointer text-[11px] py-1 px-1.5 rounded hover:bg-slate-800"
                >
                  Edit Property
                </button>
                <button
                  type="button"
                  onClick={(e) => handleOpenDetails(prop, e)}
                  className="text-indigo-400 hover:text-indigo-300 group-hover:translate-x-0.5 transition flex items-center gap-1 text-[11px] font-semibold cursor-pointer py-1 px-2 rounded-lg hover:bg-indigo-500/10"
                >
                  <span>View Details</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. PROPERTY DETAILS MODAL / DRAWER                                        */}
      {/* ========================================================================= */}
      {selectedProperty && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl my-auto overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 bg-slate-950/70 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shrink-0">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                      {propDetail?.name}
                    </h2>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                      {propDetail?.tenure?.replace('_', ' ')}
                    </span>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                      {propDetail?.propertyType?.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>
                      {propDetail?.addressLine1}
                      {propDetail?.addressLine2 ? `, ${propDetail.addressLine2}` : ''}, {propDetail?.city} ({propDetail?.postcode})
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  onClick={(e) => handleOpenEdit(propDetail, e)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium border border-slate-700 cursor-pointer transition"
                >
                  <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Edit Property</span>
                </button>
                <button
                  onClick={handleCloseDetails}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex items-center gap-2 px-5 sm:px-6 pt-3 border-b border-slate-800/80 bg-slate-950/40 text-xs font-semibold overflow-x-auto">
              <button
                onClick={() => setDetailTab('overview')}
                className={`pb-3 px-2 border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  detailTab === 'overview'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Overview & Financials</span>
              </button>
              <button
                onClick={() => setDetailTab('units')}
                className={`pb-3 px-2 border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  detailTab === 'units'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Lettable Units ({unitsList.length})</span>
              </button>
              <button
                onClick={() => setDetailTab('compliance')}
                className={`pb-3 px-2 border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  detailTab === 'compliance'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Statutory Compliance</span>
              </button>
              <button
                onClick={() => setDetailTab('mortgages')}
                className={`pb-3 px-2 border-b-2 transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  detailTab === 'mortgages'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Landmark className="w-3.5 h-3.5" />
                <span>Mortgages & Debt ({mortgagesList.length})</span>
              </button>
            </div>

            {/* Modal Body / Tab Content */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
              {loadingDetails && (
                <div className="py-8 flex items-center justify-center text-slate-400 gap-2 text-xs">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                  <span>Refreshing real-time property records...</span>
                </div>
              )}

              {/* TAB 1: OVERVIEW & FINANCIALS */}
              {detailTab === 'overview' && (
                <div className="space-y-6">
                  {/* Financial KPI Cards */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4">
                      <div className="text-[11px] font-medium text-slate-400">Current Valuation</div>
                      <div className="text-lg sm:text-xl font-bold text-white mt-1">
                        {formatGBP(propDetail?.currentValuation || propDetail?.purchasePrice)}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">UK Market Appraisal</div>
                    </div>

                    <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4">
                      <div className="text-[11px] font-medium text-slate-400">Purchase Price</div>
                      <div className="text-lg sm:text-xl font-bold text-slate-300 mt-1">
                        {formatGBP(propDetail?.purchasePrice)}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">Historical Cost Basis</div>
                    </div>

                    <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4">
                      <div className="text-[11px] font-medium text-slate-400">Mortgage Liability</div>
                      <div className="text-lg sm:text-xl font-bold text-rose-300 mt-1">
                        {formatGBP(propDetail?.totalMortgageDebt)}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        {mortgagesList.length} Active {mortgagesList.length === 1 ? 'Mortgage' : 'Mortgages'}
                      </div>
                    </div>

                    <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4">
                      <div className="text-[11px] font-medium text-slate-400">Net Portfolio Equity</div>
                      <div className="text-lg sm:text-xl font-bold text-emerald-400 mt-1">
                        {formatGBP(propDetail?.equity)}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">Asset Value − Debt</div>
                    </div>
                  </div>

                  {/* Property Particulars */}
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 space-y-4">
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Property &amp; Tenancy Specifications
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-slate-500 block text-[11px]">Contractual Rent</span>
                        <span className="font-extrabold text-emerald-400 mt-0.5 block text-sm font-display">
                          {formatGBP(propDetail?.contractualRent || 0)}
                          <span className="text-xs font-normal text-slate-400"> / {propDetail?.rentFrequency || 'MONTHLY'}</span>
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Tenancy Status</span>
                        <span className="font-semibold text-slate-200 mt-0.5 block">
                          {propDetail?.status || 'Available'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Current Tenant</span>
                        <span className="font-semibold text-slate-200 mt-0.5 block">
                          {propDetail?.tenantName || 'None (Vacant / Unlet)'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Postal Address</span>
                        <span className="font-semibold text-slate-200 mt-0.5 block">
                          {propDetail?.addressLine1}{propDetail?.city ? `, ${propDetail.city}` : ''} {propDetail?.postcode ? `(${propDetail.postcode})` : ''}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Ownership Entity</span>
                        <span className="font-semibold text-slate-200 mt-0.5 block">
                          {propDetail?.ownershipEntity || 'Personal'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Tenure Type</span>
                        <span className="font-semibold text-slate-200 mt-0.5 block">
                          {propDetail?.tenure?.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">EPC Energy Efficiency</span>
                        <span className="font-semibold text-slate-200 mt-0.5 block">
                          Band {propDetail?.compliance?.epcRating || 'Not Assessed'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Property Category</span>
                        <span className="font-semibold text-slate-200 mt-0.5 block">
                          {propDetail?.propertyType?.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>

                    {propDetail?.notes && (
                      <div className="pt-3 border-t border-slate-800/80 text-xs">
                        <span className="text-slate-500 block text-[11px] mb-1">Notes & Description</span>
                        <p className="text-slate-300 whitespace-pre-wrap">{propDetail.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: LETTABLE UNITS */}
              {detailTab === 'units' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-white">Lettable Units & Flats</h3>
                      <p className="text-xs text-slate-400">
                        Individual lettable spaces, target rent, and occupancy statuses for this property.
                      </p>
                    </div>

                    <button
                      onClick={handleOpenAddUnit}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer transition shadow-md shadow-indigo-600/20 self-start sm:self-auto"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Lettable Unit</span>
                    </button>
                  </div>

                  {unitsList.length === 0 ? (
                    <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-2xl p-10 text-center space-y-3">
                      <Home className="w-9 h-9 text-slate-600 mx-auto" />
                      <div className="text-xs font-semibold text-slate-300">No units configured yet</div>
                      <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                        Add individual flats, apartments, commercial shops, or rooms to manage tenancy leases and rental revenue.
                      </p>
                      <button
                        onClick={handleOpenAddUnit}
                        className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-medium cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add First Unit</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {unitsList.map((unit) => (
                        <div
                          key={unit._id}
                          className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition space-y-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-xs font-bold text-white flex items-center gap-2">
                                <span>{unit.unitName}</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                  unit.status === 'OCCUPIED'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : unit.status === 'MAINTENANCE'
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                    : 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                                }`}>
                                  {unit.status}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400 mt-1">
                                {unit.unitType?.replace(/_/g, ' ')} · {unit.floor || 'Ground'} Floor
                                {unit.floorAreaSqFt ? ` · ${unit.floorAreaSqFt} sq ft` : ''}
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-[10px] text-slate-500 uppercase">Target Rent</div>
                              <div className="text-xs font-bold text-slate-200 mt-0.5">
                                {formatGBP(unit.targetRent)}/mo
                              </div>
                            </div>
                          </div>

                          <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
                            <span className="text-[11px] text-slate-500 truncate max-w-[200px]">
                              {unit.notes || 'No unit notes'}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => handleOpenEditUnit(unit, e)}
                                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                                title="Edit Unit"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => handleDeleteUnit(unit._id, e)}
                                className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                                title="Archive Unit"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: STATUTORY COMPLIANCE */}
              {detailTab === 'compliance' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-white">UK Landlord Statutory Compliance</h3>
                    <p className="text-xs text-slate-400">
                      Mandatory safety certificates and environmental ratings required under UK housing law.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* EPC Card */}
                    <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-300">EPC Energy Rating</span>
                          <span className={`text-xs px-2.5 py-0.5 rounded-lg shadow ${getEpcBadgeStyle(propDetail?.compliance?.epcRating)}`}>
                            Band {propDetail?.compliance?.epcRating || 'N/A'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-2">
                          UK Minimum Energy Efficiency Standard (MEES) requires Band E or higher for private rented tenancies.
                        </p>
                      </div>
                      <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-500">
                        Rating: {propDetail?.compliance?.epcRating || 'Pending Certification'}
                      </div>
                    </div>

                    {/* Gas Safety (CP12) */}
                    {(() => {
                      const gas = getComplianceStatus(propDetail?.compliance?.gasSafetyExpiryDate);
                      return (
                        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3">
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-300">Gas Safety (CP12)</span>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${gas.color}`}>
                                {gas.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-2">
                              Annual Gas Safety Record mandated under Gas Safety (Installation and Use) Regulations 1998.
                            </p>
                          </div>
                          <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-300">
                            {gas.label}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Electrical (EICR) */}
                    {(() => {
                      const eicr = getComplianceStatus(propDetail?.compliance?.eicrExpiryDate);
                      return (
                        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between space-y-3">
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-300">Electrical (EICR)</span>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${eicr.color}`}>
                                {eicr.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-2">
                              5-year Electrical Installation Condition Report mandatory for UK residential rentals since 2020.
                            </p>
                          </div>
                          <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-300">
                            {eicr.label}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* TAB 4: MORTGAGES & DEBT */}
              {detailTab === 'mortgages' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-white">Linked Mortgage Facilities</h3>
                    <p className="text-xs text-slate-400">
                      Active commercial or buy-to-let loans secured against this property.
                    </p>
                  </div>

                  {mortgagesList.length === 0 ? (
                    <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-2xl p-10 text-center space-y-2">
                      <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto" />
                      <div className="text-xs font-semibold text-slate-300">Unencumbered Property</div>
                      <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                        No active mortgage debt or lender charges are secured against this property. 100% equity ownership.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {mortgagesList.map((mtg) => (
                        <div
                          key={mtg._id}
                          className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div>
                            <div className="text-xs font-bold text-white flex items-center gap-2">
                              <Landmark className="w-4 h-4 text-indigo-400" />
                              <span>{mtg.lenderName}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                {mtg.accountReference}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 mt-1">
                              Interest Rate: <span className="text-slate-200 font-semibold">{mtg.interestRate}%</span> · Type: <span className="text-slate-200 font-semibold">{mtg.repaymentType?.replace('_', ' ')}</span>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-[10px] text-slate-500 uppercase">Outstanding Debt</div>
                            <div className="text-sm font-bold text-rose-300 mt-0.5">
                              {formatGBP(mtg.outstandingPrincipalBalance)}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Payment: £{(mtg.monthlyPaymentAmount || 0).toFixed(2)}/mo
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-500 text-[11px]">
                PixxTechnologies UK Property Record · Ref: {propDetail?._id?.toString().slice(-6)}
              </span>
              <button
                onClick={handleCloseDetails}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold cursor-pointer transition"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. ADD / EDIT UNIT SUB-MODAL                                              */}
      {/* ========================================================================= */}
      {showUnitModal && (
        <div className="fixed inset-0 z-60 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">
                {editingUnit ? 'Edit Lettable Unit' : 'Add New Lettable Unit'}
              </h3>
              <button
                onClick={() => setShowUnitModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {unitError && (
              <div className="mt-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {unitError}
              </div>
            )}

            <form onSubmit={handleUnitSubmit} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Unit Identifier / Name *</label>
                <input
                  type="text"
                  required
                  value={unitForm.unitName}
                  onChange={(e) => setUnitForm({ ...unitForm, unitName: e.target.value })}
                  placeholder="e.g. Flat 1, Ground Floor Shop, Studio A"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Unit Type</label>
                  <select
                    value={unitForm.unitType}
                    onChange={(e) => setUnitForm({ ...unitForm, unitType: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer"
                  >
                    <option value="FLAT">Flat / Apartment</option>
                    <option value="STUDIO">Studio</option>
                    <option value="ROOM_HMO">HMO Room</option>
                    <option value="RETAIL_SHOP">Retail Shop</option>
                    <option value="OFFICE">Office Suite</option>
                    <option value="PARKING_SPACE">Parking Bay</option>
                    <option value="STORAGE">Storage Unit</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Floor Level</label>
                  <input
                    type="text"
                    value={unitForm.floor}
                    onChange={(e) => setUnitForm({ ...unitForm, floor: e.target.value })}
                    placeholder="e.g. Ground, 1st, Basement"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Target Rent (£/month)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={unitForm.targetRent}
                    onChange={(e) => setUnitForm({ ...unitForm, targetRent: e.target.value })}
                    placeholder="1250.00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Status</label>
                  <select
                    value={unitForm.status}
                    onChange={(e) => setUnitForm({ ...unitForm, status: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer"
                  >
                    <option value="VACANT">Vacant (Available)</option>
                    <option value="OCCUPIED">Occupied (Let)</option>
                    <option value="MAINTENANCE">Under Maintenance</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Floor Area (sq ft)</label>
                <input
                  type="number"
                  min="0"
                  value={unitForm.floorAreaSqFt}
                  onChange={(e) => setUnitForm({ ...unitForm, floorAreaSqFt: e.target.value })}
                  placeholder="e.g. 550"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Unit Notes</label>
                <input
                  type="text"
                  value={unitForm.notes}
                  onChange={(e) => setUnitForm({ ...unitForm, notes: e.target.value })}
                  placeholder="e.g. South facing balcony, refurbished 2024"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUnitModal(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={unitSubmitting}
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {unitSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingUnit ? 'Save Unit' : 'Create Unit'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. ADD / EDIT PROPERTY MODAL                                              */}
      {/* ========================================================================= */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h2 className="text-base font-bold text-white">
                {editingProperty ? 'Edit UK Property' : 'Add New UK Property'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Property Name / Title</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Richmond Court Apartments"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Property Type</label>
                  <select
                    value={formData.propertyType}
                    onChange={(e) => setFormData({ ...formData, propertyType: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer"
                  >
                    <option value="Residential">Residential</option>
                    <option value="Commercial">Commercial</option>
                    <option value="Shop">Shop / Retail</option>
                    <option value="Flat">Flat / Apartment</option>
                    <option value="FLAT_APARTMENT">Flat (AST)</option>
                    <option value="RESIDENTIAL_TERRACED">Terraced House</option>
                    <option value="RESIDENTIAL_SEMI_DETACHED">Semi-Detached House</option>
                    <option value="RESIDENTIAL_DETACHED">Detached House</option>
                    <option value="COMMERCIAL_RETAIL">Commercial Retail</option>
                    <option value="COMMERCIAL_OFFICE">Office Building</option>
                    <option value="HMO">HMO (Multi Occupancy)</option>
                    <option value="MIXED_USE">Mixed Use</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Tenure</label>
                  <select
                    value={formData.tenure}
                    onChange={(e) => setFormData({ ...formData, tenure: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer"
                  >
                    <option value="FREEHOLD">Freehold</option>
                    <option value="LEASEHOLD">Leasehold</option>
                    <option value="SHARE_OF_FREEHOLD">Share of Freehold</option>
                  </select>
                </div>
              </div>

              {/* Direct Contractual Rent & Tenancy */}
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-3">
                <div className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">
                  Direct Contractual Rent &amp; Tenancy
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Contractual Rent (£)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.contractualRent}
                      onChange={(e) => setFormData({ ...formData, contractualRent: e.target.value })}
                      placeholder="e.g. 1550.00"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-semibold focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Rent Frequency</label>
                    <select
                      value={formData.rentFrequency}
                      onChange={(e) => setFormData({ ...formData, rentFrequency: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer"
                    >
                      <option value="MONTHLY">Monthly</option>
                      <option value="WEEKLY">Weekly</option>
                      <option value="QUARTERLY">Quarterly</option>
                      <option value="ANNUALLY">Annually</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Tenancy Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer"
                    >
                      <option value="Available">Available (Vacant)</option>
                      <option value="Occupied">Occupied (Tenanted)</option>
                      <option value="Active">Active Asset</option>
                      <option value="Under Offer">Under Offer</option>
                      <option value="Maintenance">Under Maintenance</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Tenant Name (if let)</label>
                    <input
                      type="text"
                      value={formData.tenantName}
                      onChange={(e) => setFormData({ ...formData, tenantName: e.target.value })}
                      placeholder="e.g. John Doe / Suavida Ltd"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Address Line 1</label>
                <input
                  type="text"
                  value={formData.addressLine1}
                  onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
                  placeholder="e.g. 14 High Street"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">City / Town</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="London"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">UK Postcode</label>
                  <input
                    type="text"
                    value={formData.postcode}
                    onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                    placeholder="e.g. SW1A 1AA / RM17 5HF"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 uppercase focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Purchase Price (£)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                    placeholder="250000"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Current Valuation (£)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.currentValuation}
                    onChange={(e) => setFormData({ ...formData, currentValuation: e.target.value })}
                    placeholder="280000"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">EPC Rating</label>
                  <select
                    value={formData.epcRating}
                    onChange={(e) => setFormData({ ...formData, epcRating: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer"
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                    <option value="E">E</option>
                    <option value="F">F</option>
                    <option value="G">G</option>
                    <option value="PENDING">Pending</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Gas Safety Expiry</label>
                  <input
                    type="date"
                    value={formData.gasSafetyExpiryDate}
                    onChange={(e) => setFormData({ ...formData, gasSafetyExpiryDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">EICR Expiry</label>
                  <input
                    type="date"
                    value={formData.eicrExpiryDate}
                    onChange={(e) => setFormData({ ...formData, eicrExpiryDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingProperty ? 'Save Changes' : 'Create Property'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PropertiesPage;
