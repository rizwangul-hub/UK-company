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
  X,
  Loader2,
  Edit3,
  Calendar,
  DollarSign,
  Receipt,
  TrendingUp,
  Home,
  ArrowLeft,
  User,
  Mail,
  Phone,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  CreditCard,
} from 'lucide-react';
import { formatGBP, formatUKDate } from '../utils/formatters.js';
import { propertiesAPI, getApiCache } from '../services/api.js';
import PropertyAppliancesSection from '../components/PropertyAppliancesSection.jsx';

export function PropertiesPage({ onSelectProperty, selectedCompany }) {
  const initialCache = getApiCache('/properties', {
    params: {
      search: '',
      tenure: undefined,
    },
  });
  const [properties, setProperties] = useState(initialCache?.data?.properties || []);
  const [summary, setSummary] = useState(initialCache?.data?.summary || null);
  const [loading, setLoading] = useState(!initialCache?.data?.properties);
  const [search, setSearch] = useState('');
  const [tenureFilter, setTenureFilter] = useState('');

  // Property Create / Edit Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Property Dedicated Dashboard State
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [detailedPropertyData, setDetailedPropertyData] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

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

  const loadProperties = async (forceRefresh = false) => {
    if (properties.length === 0 || forceRefresh) {
      setLoading(true);
    }
    try {
      const res = await propertiesAPI.getAll({
        search,
        tenure: tenureFilter || undefined,
      }, { forceRefresh });
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

  // Open Property Dashboard
  const handleOpenDetails = async (prop, e) => {
    if (e) e.stopPropagation();
    setSelectedProperty(prop);
    setDetailedPropertyData(prop);
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

  const handleRefreshDetails = async () => {
    const id = selectedProperty?._id || detailedPropertyData?._id;
    if (!id) return;
    setLoadingDetails(true);
    try {
      const res = await propertiesAPI.getById(id);
      if (res?.success && res.data) {
        setDetailedPropertyData(res.data);
      }
    } catch (err) {
      console.error('Failed to refresh property details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Close Property Dashboard & return to Portfolio list
  const handleCloseDetails = () => {
    setSelectedProperty(null);
    setDetailedPropertyData(null);
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
      ownershipEntity: selectedCompany?.name || 'Personal',
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
      ownershipEntity: prop.ownershipEntity || selectedCompany?.name || 'Personal',
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
          if (detailRes?.success && detailRes.data) {
            setDetailedPropertyData(detailRes.data);
          }
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
    if (!dateStr) return { status: 'MISSING', label: 'Not Recorded', color: 'text-slate-400', badge: 'bg-slate-800 text-slate-400 border-slate-700' };
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((d - now) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      return { status: 'EXPIRED', label: `Expired (${formatUKDate(dateStr)})`, color: 'text-rose-400', badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
    } else if (diffDays <= 30) {
      return { status: 'EXPIRING SOON', label: `Expires in ${diffDays}d (${formatUKDate(dateStr)})`, color: 'text-amber-400', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
    } else {
      return { status: 'VALID', label: `Valid until ${formatUKDate(dateStr)}`, color: 'text-emerald-400', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
    }
  };

  const propDetail = detailedPropertyData || selectedProperty;
  const mortgagesList = propDetail?.mortgages || [];
  const schedulesList = propDetail?.schedules || [];
  const transactionsList = propDetail?.recentTransactions || [];

  // =========================================================================
  // VIEW 1: FULL DEDICATED PROPERTY DASHBOARD
  // =========================================================================
  if (selectedProperty) {
    const ltvVal = propDetail?.ltv || 0;
    const grossYieldVal = propDetail?.grossYield || 0;
    const annualRentVal = propDetail?.annualRent || ((propDetail?.contractualRent || 0) * (propDetail?.rentFrequency === 'ANNUALLY' ? 1 : 12));
    const gasStatus = getComplianceStatus(propDetail?.compliance?.gasSafetyExpiryDate);
    const eicrStatus = getComplianceStatus(propDetail?.compliance?.eicrExpiryDate);

    return (
      <div key={`property-detail-${selectedProperty._id || 'view'}`} className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 page-anim-slide-right">
        {/* Navigation Breadcrumb Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <button
              onClick={handleCloseDetails}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold transition cursor-pointer shadow-sm"
              title="Return to properties portfolio list"
            >
              <ArrowLeft className="w-4 h-4 text-slate-400" />
              <span>Back to Properties</span>
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
              <span>Properties</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
              <span className="text-white font-semibold">{propDetail?.name}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <button
              onClick={handleRefreshDetails}
              disabled={loadingDetails}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 transition cursor-pointer disabled:opacity-50"
              title="Refresh property data"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${loadingDetails ? 'animate-spin text-indigo-400' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={(e) => handleOpenEdit(propDetail, e)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Property</span>
            </button>
          </div>
        </div>

        {/* Property Hero Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-7 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
                    {propDetail?.name}
                  </h1>
                  <div className="text-xs sm:text-sm text-slate-400 flex items-center gap-1.5 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>
                      {propDetail?.addressLine1}
                      {propDetail?.addressLine2 ? `, ${propDetail.addressLine2}` : ''}
                      {propDetail?.city ? `, ${propDetail.city}` : ''}
                      {propDetail?.postcode ? ` (${propDetail.postcode})` : ''}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status and Classification Badges */}
              <div className="flex items-center gap-2 pt-2 flex-wrap">
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                    propDetail?.status === 'Occupied'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : propDetail?.status === 'Active'
                      ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                      : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
                  }`}
                >
                  {propDetail?.status || 'Available'}
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {propDetail?.propertyType?.replace(/_/g, ' ')}
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {propDetail?.tenure?.replace(/_/g, ' ')}
                </span>
                {propDetail?.ownershipEntity && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-400 border border-slate-700/80">
                    Entity: {propDetail.ownershipEntity}
                  </span>
                )}
                {propDetail?.compliance?.epcRating && (
                  <span className={`text-[11px] font-black px-2 py-0.5 rounded-lg shadow-sm ${getEpcBadgeStyle(propDetail.compliance.epcRating)}`}>
                    EPC {propDetail.compliance.epcRating}
                  </span>
                )}
              </div>
            </div>

            {/* Quick Hero Financial Pill */}
            <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 sm:p-5 flex items-center justify-between sm:justify-start gap-6 self-start lg:self-auto shrink-0 w-full sm:w-auto">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider block">
                  Contractual Rent
                </span>
                <div className="text-xl sm:text-2xl font-extrabold text-emerald-400 font-display tabular-nums mt-0.5">
                  {formatGBP(propDetail?.contractualRent || 0)}
                  <span className="text-xs font-normal text-slate-400">
                    {' '}/ {propDetail?.rentFrequency === 'ANNUALLY' ? 'yr' : 'mo'}
                  </span>
                </div>
              </div>
              <div className="h-9 w-px bg-slate-800" />
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider block">
                  Current Valuation
                </span>
                <div className="text-xl sm:text-2xl font-extrabold text-white font-display tabular-nums mt-0.5">
                  {formatGBP(propDetail?.currentValuation || propDetail?.purchasePrice || 0)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 6 Executive Financial KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] font-semibold uppercase tracking-wider">Monthly Rent</span>
              <Receipt className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-lg sm:text-xl font-black text-emerald-400 mt-1 tabular-nums font-display">
              {formatGBP(propDetail?.contractualRent || 0)}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">{formatGBP(annualRentVal)} / year</div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] font-semibold uppercase tracking-wider">Asset Valuation</span>
              <TrendingUp className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-lg sm:text-xl font-black text-white mt-1 tabular-nums font-display">
              {formatGBP(propDetail?.currentValuation || propDetail?.purchasePrice || 0)}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Appraisal basis</div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] font-semibold uppercase tracking-wider">Mortgage Debt</span>
              <Landmark className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-lg sm:text-xl font-black text-rose-300 mt-1 tabular-nums font-display">
              {formatGBP(propDetail?.totalMortgageDebt || 0)}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {mortgagesList.length} Active {mortgagesList.length === 1 ? 'Mortgage' : 'Mortgages'}
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] font-semibold uppercase tracking-wider">Net Equity</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-lg sm:text-xl font-black text-emerald-400 mt-1 tabular-nums font-display">
              {formatGBP(propDetail?.equity || 0)}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Asset Value − Debt</div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] font-semibold uppercase tracking-wider">Loan-to-Value</span>
              <Percent className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-lg sm:text-xl font-black text-indigo-300 mt-1 tabular-nums font-display">
              {ltvVal}%
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {ltvVal === 0 ? 'Unencumbered' : ltvVal < 60 ? 'Low Gearing' : ltvVal <= 75 ? 'Moderate' : 'High Gearing'}
            </div>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[10px] font-semibold uppercase tracking-wider">Gross Yield</span>
              <DollarSign className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-lg sm:text-xl font-black text-amber-300 mt-1 tabular-nums font-display">
              {grossYieldVal}%
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Annual Rent / Value</div>
          </div>
        </div>

        {/* Core Insights 4-Card Module Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Module 1: Tenancy & Rent Roll */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Tenancy &amp; Rent Roll</h3>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  propDetail?.status === 'Occupied' || propDetail?.tenantName
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {propDetail?.status === 'Occupied' || propDetail?.tenantName ? 'Occupied / Tenanted' : 'Vacant / Unlet'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60">
                <span className="text-[11px] text-slate-500 block font-medium">Current Tenant</span>
                <span className="text-sm font-bold text-slate-200 mt-1 block truncate">
                  {propDetail?.tenancy?.tenantId?.fullName || propDetail?.tenantName || 'No Active Tenant'}
                </span>
                {(propDetail?.tenancy?.tenantId?.email || propDetail?.tenancy?.tenantId?.phone) && (
                  <div className="mt-2 space-y-1 text-[11px] text-slate-400 border-t border-slate-800/60 pt-2">
                    {propDetail.tenancy.tenantId.email && (
                      <div className="flex items-center gap-1.5 truncate">
                        <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="truncate">{propDetail.tenancy.tenantId.email}</span>
                      </div>
                    )}
                    {propDetail.tenancy.tenantId.phone && (
                      <div className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                        <span>{propDetail.tenancy.tenantId.phone}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60">
                <span className="text-[11px] text-slate-500 block font-medium">Rent Terms</span>
                <span className="text-sm font-extrabold text-emerald-400 font-display mt-1 block">
                  {formatGBP(propDetail?.contractualRent || 0)}
                  <span className="text-xs font-normal text-slate-400">
                    {' '}/ {propDetail?.rentFrequency || 'MONTHLY'}
                  </span>
                </span>
                <div className="mt-2 text-[11px] text-slate-400 border-t border-slate-800/60 pt-2">
                  Due Day: <span className="text-slate-300 font-semibold">{propDetail?.tenancy?.rentDueDay || 1}st of month</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60">
                <span className="text-[11px] text-slate-500 block font-medium">Agreement Reference</span>
                <span className="text-xs font-semibold text-slate-300 mt-1 block">
                  {propDetail?.tenancy?.agreementReference || 'Direct Tenancy Record'}
                </span>
                <div className="mt-1 text-[11px] text-slate-500">
                  Status: <span className="text-slate-400">{propDetail?.tenancy?.status || 'Active'}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60">
                <span className="text-[11px] text-slate-500 block font-medium">Agreement Term</span>
                <span className="text-xs font-semibold text-slate-300 mt-1 block">
                  {propDetail?.tenancy?.startDate ? formatUKDate(propDetail.tenancy.startDate) : 'Open'}
                  {' → '}
                  {propDetail?.tenancy?.endDate ? formatUKDate(propDetail.tenancy.endDate) : 'Rolling Periodic'}
                </span>
                <div className="mt-1 text-[11px] text-slate-500">
                  Deposit: <span className="text-slate-300 font-semibold">{formatGBP(propDetail?.tenancy?.depositAmount || 0)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Module 2: UK Statutory Compliance */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">UK Statutory Compliance</h3>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Mandatory Landlord Standards</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* EPC Rating */}
              <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-400">EPC Energy</span>
                    <span className={`text-xs px-2 py-0.5 rounded font-black shadow-sm ${getEpcBadgeStyle(propDetail?.compliance?.epcRating)}`}>
                      Band {propDetail?.compliance?.epcRating || 'N/A'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">
                    UK MEES standard requires Band E minimum.
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-800/60 text-[10px] text-slate-400 font-medium">
                  {propDetail?.compliance?.epcRating && propDetail.compliance.epcRating <= 'E' ? 'Legally Compliant' : 'Review Required'}
                </div>
              </div>

              {/* Gas Safety CP12 */}
              <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-400">Gas Safety (CP12)</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${gasStatus.badge}`}>
                      {gasStatus.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">
                    Annual statutory gas inspection check.
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-800/60 text-[10px] text-slate-300 font-medium truncate">
                  {gasStatus.label}
                </div>
              </div>

              {/* Electrical EICR */}
              <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-3.5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-400">Electrical (EICR)</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${eicrStatus.badge}`}>
                      {eicrStatus.status}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2">
                    5-year mandatory wiring certificate.
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-800/60 text-[10px] text-slate-300 font-medium truncate">
                  {eicrStatus.label}
                </div>
              </div>
            </div>

            {propDetail?.notes && (
              <div className="pt-2 border-t border-slate-800/80 text-xs">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">Property Notes</span>
                <p className="text-slate-300 text-xs whitespace-pre-wrap">{propDetail.notes}</p>
              </div>
            )}
          </div>

          {/* Module 3: Mortgages & Financing */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Mortgage &amp; Financing Liabilities</h3>
              </div>
              <span className="text-xs font-bold text-rose-300">
                {formatGBP(propDetail?.totalMortgageDebt || 0)} Total Debt
              </span>
            </div>

            {mortgagesList.length === 0 ? (
              <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-2xl p-6 text-center space-y-2">
                <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto" />
                <div className="text-xs font-bold text-slate-200">100% Unencumbered Asset</div>
                <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                  No active mortgage liabilities or lender charges are secured against this property. Full unencumbered equity retained.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {mortgagesList.map((mtg) => (
                  <div
                    key={mtg._id}
                    className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <span>{mtg.lenderName}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {mtg.accountReference}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Rate: <span className="text-slate-200 font-semibold">{mtg.interestRate}%</span> · Type: <span className="text-slate-200 font-semibold">{mtg.repaymentType?.replace('_', ' ')}</span>
                        {mtg.paymentAccountId?.name && (
                          <span> · Serviced from {mtg.paymentAccountId.name}</span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-slate-500 uppercase font-medium">Outstanding Principal</div>
                      <div className="text-sm font-bold text-rose-300 tabular-nums">
                        {formatGBP(mtg.outstandingPrincipalBalance)}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Monthly: {formatGBP(mtg.monthlyPaymentAmount)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Module 4: Property Particulars & Legal Title */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Particulars &amp; Legal Title</h3>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">HMRC &amp; Land Registry Specs</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Tenure Type</span>
                <span className="text-xs font-bold text-slate-200 mt-1 block">
                  {propDetail?.tenure?.replace(/_/g, ' ') || 'Freehold'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Ownership Entity</span>
                <span className="text-xs font-bold text-slate-200 mt-1 block">
                  {propDetail?.ownershipEntity || selectedCompany?.name || 'Personal'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Historical Cost Basis</span>
                <span className="text-xs font-bold text-slate-300 mt-1 block tabular-nums">
                  {formatGBP(propDetail?.purchasePrice || 0)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Current Valuation</span>
                <span className="text-xs font-bold text-white mt-1 block tabular-nums">
                  {formatGBP(propDetail?.currentValuation || propDetail?.purchasePrice || 0)}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 text-xs">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-1">Official Postal Address</span>
              <p className="text-slate-200 font-medium">
                {propDetail?.addressLine1}
                {propDetail?.addressLine2 ? `, ${propDetail.addressLine2}` : ''}
                {propDetail?.city ? `, ${propDetail.city}` : ''}
                {propDetail?.postcode ? ` - ${propDetail.postcode}` : ''}
              </p>
            </div>
          </div>
        </div>

        {/* Module 5: Rent Billing & Schedule History Register */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-400" />
                <span>Rent Billing &amp; Schedule Register</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Contractual rent billing records and payment reconciliation for this property.
              </p>
            </div>
            <span className="text-[11px] text-slate-500">
              {schedulesList.length} Records
            </span>
          </div>

          {schedulesList.length === 0 ? (
            <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-500">
              No rent billing schedules generated for this property yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-[10px] uppercase tracking-wider text-slate-400 bg-slate-950/80 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Billing Month</th>
                    <th className="py-2.5 px-3">Due Date</th>
                    <th className="py-2.5 px-3 text-right">Rent Due</th>
                    <th className="py-2.5 px-3 text-right">Collected</th>
                    <th className="py-2.5 px-3 text-right">Outstanding</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {schedulesList.map((sched) => {
                    const balance = Math.max(0, (sched.amountDue || 0) - (sched.amountPaid || 0));
                    return (
                      <tr key={sched._id} className="hover:bg-slate-850/50 transition">
                        <td className="py-2.5 px-3 font-semibold text-white">{sched.billingMonth}</td>
                        <td className="py-2.5 px-3 text-slate-400">{formatUKDate(sched.dueDate)}</td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-200">{formatGBP(sched.amountDue)}</td>
                        <td className="py-2.5 px-3 text-right font-medium text-emerald-400">{formatGBP(sched.amountPaid)}</td>
                        <td className={`py-2.5 px-3 text-right font-bold ${balance > 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                          {formatGBP(balance)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              sched.status === 'PAID'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : sched.status === 'OVERDUE'
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                : sched.status === 'PARTIALLY_PAID'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            {sched.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Module 6: Recent Financial Operations Ledger */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-indigo-400" />
                <span>Recent Financial Operations</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Income receipts and operational expenses posted to this property.
              </p>
            </div>
            <span className="text-[11px] text-slate-500">
              {transactionsList.length} Transactions
            </span>
          </div>

          {transactionsList.length === 0 ? (
            <div className="bg-slate-950/60 border border-dashed border-slate-800 rounded-2xl p-8 text-center text-xs text-slate-500">
              No financial operations recorded for this property yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-[10px] uppercase tracking-wider text-slate-400 bg-slate-950/80 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Account</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {transactionsList.map((tx) => {
                    const isIncome = tx.direction === 'IN' || tx.type === 'RENT_RECEIPT' || tx.type === 'OTHER_INCOME';
                    return (
                      <tr key={tx._id} className="hover:bg-slate-850/50 transition">
                        <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">{formatUKDate(tx.transactionDate)}</td>
                        <td className="py-2.5 px-3 font-medium text-white max-w-xs truncate">{tx.description || 'Property Transaction'}</td>
                        <td className="py-2.5 px-3 text-slate-400">{tx.categoryId?.name || tx.type}</td>
                        <td className="py-2.5 px-3 text-slate-400">{tx.accountId?.name || 'Bank Account'}</td>
                        <td className={`py-2.5 px-3 text-right font-bold tabular-nums ${isIncome ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {isIncome ? '+' : '-'} {formatGBP(tx.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Module 7: Appliances, Currys Warranties & Squeaky Clean Valet */}
        <PropertyAppliancesSection
          propertyId={propDetail?._id}
          propertyName={propDetail?.name}
          appliances={detailedPropertyData?.appliances || []}
          onRefresh={handleRefreshDetails}
        />

        {/* Modal for editing property details */}
        {showModal && renderEditModal()}
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: PORTFOLIO PROPERTIES GRID (DEFAULT LIST VIEW)
  // =========================================================================
  return (
    <div key="properties-grid-list" className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 page-anim-book-flip">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Properties
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
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
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
                  <span>Open Full Dashboard</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Property Modal */}
      {showModal && renderEditModal()}
    </div>
  );

  // Helper function to render modal in both views
  function renderEditModal() {
    return (
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl my-8">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <h2 className="text-base font-bold text-white">
              {editingProperty ? 'Edit Property Particulars' : 'Add New Property'}
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
                    placeholder="e.g. John Doe"
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
                  placeholder="e.g. SW1A 1AA"
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

            <div>
              <label className="block text-slate-300 font-medium mb-1">Ownership Entity</label>
              <input
                type="text"
                value={formData.ownershipEntity}
                onChange={(e) => setFormData({ ...formData, ownershipEntity: e.target.value })}
                placeholder="e.g. Suavida Properties Ltd"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Notes / Description</label>
              <textarea
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Any special notes or description..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
              />
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
    );
  }
}

export default PropertiesPage;
