import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  Building2,
  FileText,
  Mail,
  Phone,
  Calendar,
  X,
  Loader2,
  Edit3,
  Save,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { formatGBP, formatUKDate } from '../utils/formatters.js';
import { tenantsAPI, tenanciesAPI, propertiesAPI, getApiCache } from '../services/api.js';
import { ModalPortal } from '../components/ModalPortal.jsx';
import { TenantDocumentSection } from '../components/TenantDocumentSection.jsx';

export function TenantsPage({ selectedCompany }) {
  const [activeTab, setActiveTab] = useState('agreements'); // 'agreements' | 'directory'

  const cachedTenants = getApiCache('/tenants', { params: { search: '' } });
  const cachedTenancies = getApiCache('/tenancies');
  const cachedProps = getApiCache('/properties');

  const [tenants, setTenants] = useState(cachedTenants?.data?.tenants || []);
  const [tenancies, setTenancies] = useState(cachedTenancies?.data?.tenancies || []);
  const [properties, setProperties] = useState(cachedProps?.data?.properties || []);
  const [loading, setLoading] = useState(!cachedTenants?.data?.tenants?.length);
  const [search, setSearch] = useState('');

  // Add Tenant Modal & Pending Documents
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [tenantSubmitting, setTenantSubmitting] = useState(false);
  const [tenantError, setTenantError] = useState('');
  const [pendingDocuments, setPendingDocuments] = useState([]);
  const [tenantForm, setTenantForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    currentAddress: '',
    postcode: '',
    tenantType: 'INDIVIDUAL',
    companyName: '',
  });

  // Tenant Dashboard / Details Modal
  const [selectedTenantDashboard, setSelectedTenantDashboard] = useState(null);

  // Edit Tenant Modal
  const [editingTenant, setEditingTenant] = useState(null);
  const [editTenantSubmitting, setEditTenantSubmitting] = useState(false);
  const [editTenantError, setEditTenantError] = useState('');
  const [editTenantForm, setEditTenantForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    currentAddress: '',
    postcode: '',
    tenantType: 'INDIVIDUAL',
    companyName: '',
  });

  // Add Tenancy Modal
  const [showTenancyModal, setShowTenancyModal] = useState(false);
  const [tenancySubmitting, setTenancySubmitting] = useState(false);
  const [tenancyError, setTenancyError] = useState('');
  const [tenancyForm, setTenancyForm] = useState({
    tenantId: '',
    propertyId: '',
    unitId: '',
    leaseType: 'AST',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    rentAmount: '',
    rentDueDay: '1',
    depositAmount: '',
  });

  // Edit Tenancy Modal
  const [editingTenancy, setEditingTenancy] = useState(null);
  const [editTenancySubmitting, setEditTenancySubmitting] = useState(false);
  const [editTenancyError, setEditTenancyError] = useState('');
  const [editTenancyForm, setEditTenancyForm] = useState({
    rentAmount: '',
    depositAmount: '',
    startDate: '',
    endDate: '',
    rentDueDay: '1',
    status: 'ACTIVE',
    leaseType: 'AST',
  });

  const loadData = async (force = false) => {
    if ((tenants.length === 0 && tenancies.length === 0) || force) {
      setLoading(true);
    }
    try {
      const [tenantsRes, tenanciesRes, propsRes] = await Promise.all([
        tenantsAPI.getAll({ search }, { forceRefresh: force }),
        tenanciesAPI.getAll({}, { forceRefresh: force }),
        propertiesAPI.getAll({}, { forceRefresh: force }),
      ]);
      if (tenantsRes?.success) setTenants(tenantsRes.data.tenants || []);
      if (tenanciesRes?.success) setTenancies(tenanciesRes.data.tenancies || []);
      if (propsRes?.success) setProperties(propsRes.data.properties || []);
    } catch (err) {
      console.error('Failed to load tenants data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search]);

  const handleOpenAddTenant = () => {
    setTenantError('');
    setPendingDocuments([]);
    setTenantForm({
      fullName: '',
      email: '',
      phone: '',
      currentAddress: '',
      postcode: '',
      tenantType: 'INDIVIDUAL',
      companyName: '',
    });
    setShowTenantModal(true);
  };

  const handleTenantSubmit = async (e) => {
    e.preventDefault();
    setTenantSubmitting(true);
    setTenantError('');

    try {
      const res = await tenantsAPI.create(tenantForm);
      const createdTenant = res?.data?.data || res?.data?.tenant || res?.data || res;
      const createdTenantId = createdTenant?._id;

      // Upload any tenant documents collected in the creation form
      if (createdTenantId && pendingDocuments.length > 0) {
        for (const item of pendingDocuments) {
          if (item.file) {
            try {
              const formData = new FormData();
              formData.append('file', item.file);
              formData.append('documentName', item.documentName);
              formData.append('documentType', item.documentType || 'standard');
              if (item.expiryDate) {
                formData.append('expiryDate', item.expiryDate);
              }
              await tenantsAPI.uploadDocument(createdTenantId, formData);
            } catch (upErr) {
              console.warn(`Failed to upload ${item.documentName}:`, upErr);
            }
          }
        }
      }

      setPendingDocuments([]);
      setShowTenantModal(false);
      await loadData(true);
    } catch (err) {
      setTenantError(err.response?.data?.message || 'Failed to create tenant.');
    } finally {
      setTenantSubmitting(false);
    }
  };

  const handleTenancySubmit = async (e) => {
    e.preventDefault();
    setTenancySubmitting(true);
    setTenancyError('');

    try {
      await tenanciesAPI.create({
        ...tenancyForm,
        rentAmount: Number(tenancyForm.rentAmount),
        depositAmount: Number(tenancyForm.depositAmount) || 0,
        rentDueDay: Number(tenancyForm.rentDueDay) || 1,
      });
      setShowTenancyModal(false);
      loadData(true);
    } catch (err) {
      setTenancyError(err.response?.data?.message || 'Failed to create tenancy lease.');
    } finally {
      setTenancySubmitting(false);
    }
  };

  const handleOpenEditTenant = (ten) => {
    setEditingTenant(ten);
    setEditTenantError('');
    setEditTenantForm({
      fullName: ten.fullName || '',
      email: ten.email || '',
      phone: ten.phone || '',
      currentAddress: ten.currentAddress || '',
      postcode: ten.postcode || '',
      tenantType: ten.tenantType || 'INDIVIDUAL',
      companyName: ten.companyName || '',
    });
  };

  const handleEditTenantSubmit = async (e) => {
    e.preventDefault();
    if (!editingTenant) return;
    setEditTenantSubmitting(true);
    setEditTenantError('');

    try {
      const res = await tenantsAPI.update(editingTenant._id, editTenantForm);
      const updatedTenant = res?.data?.data || res?.data || { ...editingTenant, ...editTenantForm };
      
      // Keep dashboard in sync if open
      if (selectedTenantDashboard && selectedTenantDashboard._id === editingTenant._id) {
        setSelectedTenantDashboard(updatedTenant);
      }

      setEditingTenant(null);
      await loadData(true);
    } catch (err) {
      setEditTenantError(err.response?.data?.message || 'Failed to update tenant details.');
    } finally {
      setEditTenantSubmitting(false);
    }
  };

  const handleOpenEditTenancy = (t) => {
    setEditingTenancy(t);
    setEditTenancyError('');
    setEditTenancyForm({
      rentAmount: String(t.rentAmount ?? ''),
      depositAmount: String(t.depositAmount ?? ''),
      startDate: t.startDate ? new Date(t.startDate).toISOString().slice(0, 10) : '',
      endDate: t.endDate ? new Date(t.endDate).toISOString().slice(0, 10) : '',
      rentDueDay: String(t.rentDueDay || '1'),
      status: t.status || 'ACTIVE',
      leaseType: t.leaseType || 'AST',
    });
  };

  const handleEditTenancySubmit = async (e) => {
    e.preventDefault();
    if (!editingTenancy) return;
    setEditTenancySubmitting(true);
    setEditTenancyError('');

    try {
      await tenanciesAPI.update(editingTenancy._id, {
        ...editTenancyForm,
        rentAmount: Number(editTenancyForm.rentAmount) || 0,
        depositAmount: Number(editTenancyForm.depositAmount) || 0,
        rentDueDay: Number(editTenancyForm.rentDueDay) || 1,
      });
      setEditingTenancy(null);
      loadData();
    } catch (err) {
      setEditTenancyError(err.response?.data?.message || 'Failed to update tenancy agreement.');
    } finally {
      setEditTenancySubmitting(false);
    }
  };

  const selectedPropertyUnits = properties.find((p) => p._id === tenancyForm.propertyId)?.units || [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl dashboard-header-banner">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Tenants &amp; Tenancy Agreements
            </h1>
            {selectedCompany?.name && (
              <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {selectedCompany.name}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl">
            Manage residential ASTs, commercial leases, tenant contact details, and deposit tracking for {selectedCompany?.legalName || selectedCompany?.name || 'portfolio'}.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleOpenAddTenant}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/60 text-xs font-bold transition cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Add Tenant</span>
          </button>

          <button
            onClick={() => {
              setTenancyError('');
              setShowTenancyModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold shadow-lg shadow-indigo-600/25 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Tenancy Lease</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('agreements')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === 'agreements'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Active Leases & Agreements ({tenancies.length})
        </button>
        <button
          onClick={() => setActiveTab('directory')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === 'directory'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Tenant Directory ({tenants.length})
        </button>
      </div>

      {/* Tab: Agreements Table */}
      {activeTab === 'agreements' && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="py-20 flex items-center justify-center text-slate-500 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
              <span className="text-xs">Loading tenancy agreements...</span>
            </div>
          ) : tenancies.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500">
              No tenancy agreements recorded yet. Click "New Tenancy Lease" to link a tenant to a unit.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Ref & Type</th>
                    <th className="py-3 px-4">Tenant (Click for Dashboard)</th>
                    <th className="py-3 px-4">Property & Unit</th>
                    <th className="py-3 px-4">Rent (£)</th>
                    <th className="py-3 px-4">Term Dates</th>
                    <th className="py-3 px-4">Deposit</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {tenancies.map((t) => (
                    <tr key={t._id} className="hover:bg-slate-850/50 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-white">
                        {t.agreementRef}
                        <span className="block text-[10px] font-sans font-normal text-indigo-400">{t.leaseType}</span>
                      </td>
                      <td
                        className="py-3.5 px-4 font-semibold text-slate-200 cursor-pointer hover:text-emerald-400 transition"
                        onClick={() => {
                          const fullTenant =
                            tenants.find((tnt) => tnt._id === (t.tenantId?._id || t.tenantId)) ||
                            t.tenantId;
                          if (fullTenant) setSelectedTenantDashboard(fullTenant);
                        }}
                        title="Click to view tenant dashboard & documents"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{t.tenantId?.fullName}</span>
                          <ExternalLink className="w-3 h-3 text-slate-500" />
                        </div>
                        <span className="block text-[10px] text-slate-500 font-normal">{t.tenantId?.phone}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-300">{t.propertyId?.name || 'Property'}</div>
                        <div className="text-[10px] text-slate-400">
                          {t.unitId?.unitName ? `${t.unitId.unitName} · ` : ''}
                          {t.propertyId?.postcode || t.propertyId?.city || 'UK'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-emerald-400 font-mono">
                        {formatGBP(t.rentAmount)} / mo
                      </td>
                      <td className="py-3.5 px-4 text-[11px] text-slate-400 whitespace-nowrap">
                        {formatUKDate(t.startDate)} – {formatUKDate(t.endDate)}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        {formatGBP(t.depositAmount)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          t.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleOpenEditTenancy(t)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-[11px] font-medium border border-slate-700/60 transition cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3 text-amber-400" />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Tenant Directory */}
      {activeTab === 'directory' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tenants.map((ten) => {
            const tenantAgreements = tenancies.filter(
              (t) => (t.tenantId?._id || t.tenantId) === ten._id
            );
            const primaryAgreement = tenantAgreements[0];

            return (
              <div
                key={ten._id}
                onClick={() => setSelectedTenantDashboard(ten)}
                className="bg-slate-900 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-4 space-y-3 cursor-pointer transition shadow-sm hover:shadow-lg group"
              >
                {/* Header: Name, Type & Edit */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition flex items-center gap-1.5 truncate">
                      <span>{ten.fullName}</span>
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] font-semibold text-slate-400">{ten.tenantType}</span>
                      {primaryAgreement ? (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Active Lease
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Unassigned
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEditTenant(ten);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-[11px] font-medium border border-slate-700/60 transition cursor-pointer"
                      title="Edit tenant details"
                    >
                      <Edit3 className="w-3 h-3 text-amber-400" />
                      <span>Edit</span>
                    </button>
                  </div>
                </div>

                {/* Assigned Property & Lettable Unit */}
                {primaryAgreement ? (
                  <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>Assigned Unit</span>
                      </div>
                      <div className="font-bold text-white truncate mt-0.5">
                        {primaryAgreement.propertyId?.name || 'Property'}
                        {primaryAgreement.unitId?.unitName && (
                          <span className="text-indigo-400 font-medium"> · {primaryAgreement.unitId.unitName}</span>
                        )}
                      </div>
                    </div>
                    {primaryAgreement.rentAmount ? (
                      <div className="text-right shrink-0">
                        <div className="font-mono font-bold text-emerald-400 text-xs">
                          {formatGBP(primaryAgreement.rentAmount)}
                        </div>
                        <div className="text-[9px] text-slate-500 uppercase font-semibold">per month</div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-xs">
                      <Building2 className="w-3.5 h-3.5 shrink-0" />
                      <span>No Unit Assigned</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTenancyForm((prev) => ({
                          ...prev,
                          tenantId: ten._id,
                          propertyId: '',
                          unitId: '',
                          rentAmount: '',
                          depositAmount: '',
                        }));
                        setTenancyError('');
                        setShowTenancyModal(true);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-[10px] shadow-sm transition cursor-pointer"
                    >
                      + Assign Unit
                    </button>
                  </div>
                )}

                {/* Contact Information (Phone, Email, Address) */}
                <div className="space-y-1.5 text-xs text-slate-400">
                  {/* Phone Row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      {ten.phone ? (
                        <span className="text-slate-200 truncate">{ten.phone}</span>
                      ) : (
                        <span className="text-slate-500 italic text-[11px]">No phone recorded</span>
                      )}
                    </div>
                    {!ten.phone && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditTenant(ten);
                        }}
                        className="text-[10px] font-bold text-amber-400 hover:text-amber-300 transition cursor-pointer shrink-0"
                      >
                        + Add Phone
                      </button>
                    )}
                  </div>

                  {/* Email Row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      {ten.email ? (
                        <span className="text-slate-200 truncate" title={ten.email}>
                          {ten.email}
                        </span>
                      ) : (
                        <span className="text-slate-500 italic text-[11px]">No email recorded</span>
                      )}
                    </div>
                    {!ten.email && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditTenant(ten);
                        }}
                        className="text-[10px] font-bold text-amber-400 hover:text-amber-300 transition cursor-pointer shrink-0"
                      >
                        + Add Email
                      </button>
                    )}
                  </div>

                  {/* Address Row */}
                  <div className="flex items-start justify-between gap-2 pt-0.5">
                    <div className="min-w-0 flex-1">
                      {ten.currentAddress ? (
                        <div className="text-[11px] text-slate-400 line-clamp-2">
                          {ten.currentAddress} {ten.postcode && `(${ten.postcode})`}
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-500 italic">No address recorded</div>
                      )}
                    </div>
                    {!ten.currentAddress && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditTenant(ten);
                        }}
                        className="text-[10px] font-bold text-slate-400 hover:text-slate-300 transition cursor-pointer shrink-0"
                      >
                        + Add Address
                      </button>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-emerald-400 font-semibold">
                  <span>View Documents &amp; Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: New Tenant (With Document Upload Option at Bottom) */}
      {showTenantModal && (
        <ModalPortal isOpen={showTenantModal} onClose={() => setShowTenantModal(false)}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 sm:p-6 border-b border-slate-800 shrink-0 bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Add UK Tenant</h2>
                  <p className="text-xs text-slate-400">Record tenant identity, contact details, and collect tenant documents</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTenantModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {tenantError && (
              <div className="mx-5 sm:mx-6 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {tenantError}
              </div>
            )}

            <form onSubmit={handleTenantSubmit} className="flex flex-col flex-1 min-h-0">
              <div className="overflow-y-auto p-5 sm:p-6 space-y-6 flex-1 text-xs">
                {/* 1. Tenant Details Form */}
                <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Tenant Information
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Full Legal Name *</label>
                      <input
                        type="text"
                        required
                        value={tenantForm.fullName}
                        onChange={(e) => setTenantForm({ ...tenantForm, fullName: e.target.value })}
                        placeholder="e.g. John Doe"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Tenant Type</label>
                      <select
                        value={tenantForm.tenantType}
                        onChange={(e) => setTenantForm({ ...tenantForm, tenantType: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer"
                      >
                        <option value="INDIVIDUAL">Individual Tenant</option>
                        <option value="COMPANY">Company / Corporate Let</option>
                        <option value="STUDENT">Student</option>
                      </select>
                    </div>
                  </div>

                  {tenantForm.tenantType === 'COMPANY' && (
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Company Legal Name *</label>
                      <input
                        type="text"
                        required
                        value={tenantForm.companyName}
                        onChange={(e) => setTenantForm({ ...tenantForm, companyName: e.target.value })}
                        placeholder="e.g. Acme Holdings Ltd"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Phone Number *</label>
                      <input
                        type="tel"
                        required
                        value={tenantForm.phone}
                        onChange={(e) => setTenantForm({ ...tenantForm, phone: e.target.value })}
                        placeholder="07123 456789"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Email Address</label>
                      <input
                        type="email"
                        value={tenantForm.email}
                        onChange={(e) => setTenantForm({ ...tenantForm, email: e.target.value })}
                        placeholder="tenant@gmail.com"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-slate-300 font-medium mb-1">Current Residential Address</label>
                      <input
                        type="text"
                        value={tenantForm.currentAddress}
                        onChange={(e) => setTenantForm({ ...tenantForm, currentAddress: e.target.value })}
                        placeholder="e.g. Flat 4, 12 Kensington High Street"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Postcode</label>
                      <input
                        type="text"
                        value={tenantForm.postcode}
                        onChange={(e) => setTenantForm({ ...tenantForm, postcode: e.target.value })}
                        placeholder="W8 4PT"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 uppercase focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Tenant Documents Section (Matching Screenshots) */}
                <TenantDocumentSection
                  pendingDocuments={pendingDocuments}
                  onPendingDocumentsChange={setPendingDocuments}
                />
              </div>

              {/* Modal Footer with Cancel & Save Tenant buttons */}
              <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowTenantModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700/80 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={tenantSubmitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/25 transition cursor-pointer disabled:opacity-50"
                >
                  {tenantSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>{tenantSubmitting ? 'Saving Tenant & Uploading...' : 'Save Tenant'}</span>
                </button>
              </div>
            </form>
          </div>
        </ModalPortal>
      )}

      {/* Modal: Tenant Dashboard & Documents View */}
      {selectedTenantDashboard && (
        <ModalPortal isOpen={Boolean(selectedTenantDashboard)} onClose={() => setSelectedTenantDashboard(null)}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/60 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-black text-sm">
                  {selectedTenantDashboard.fullName?.charAt(0)?.toUpperCase() || 'T'}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-extrabold text-white">
                      {selectedTenantDashboard.fullName}
                    </h2>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      {selectedTenantDashboard.tenantType || 'INDIVIDUAL'}
                    </span>
                    {selectedTenantDashboard.companyName && (
                      <span className="text-xs text-slate-400 font-medium">
                        ({selectedTenantDashboard.companyName})
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Tenant Dashboard · Details, Active Leases &amp; 19 UK Compliance Documents
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleOpenEditTenant(selectedTenantDashboard);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 text-xs font-bold border border-slate-700 transition cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Data</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTenantDashboard(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto p-4 sm:p-6 space-y-6 flex-1 text-xs">
              {/* Top: Tenant Info Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Contact Card */}
                <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Contact Information</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenEditTenant(selectedTenantDashboard)}
                      className="text-[10px] font-bold text-amber-400 hover:text-amber-300 transition cursor-pointer"
                    >
                      Edit Contact Info
                    </button>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-300">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 w-16">Phone:</span>
                      {selectedTenantDashboard.phone ? (
                        <a href={`tel:${selectedTenantDashboard.phone}`} className="font-semibold text-slate-200 hover:text-indigo-400">
                          {selectedTenantDashboard.phone}
                        </a>
                      ) : (
                        <span className="text-slate-500 italic">No phone recorded</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 w-16">Email:</span>
                      {selectedTenantDashboard.email ? (
                        <a href={`mailto:${selectedTenantDashboard.email}`} className="font-semibold text-slate-200 hover:text-indigo-400">
                          {selectedTenantDashboard.email}
                        </a>
                      ) : (
                        <span className="text-slate-500 italic">No email recorded</span>
                      )}
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-slate-500 w-16 shrink-0">Address:</span>
                      <span className="text-slate-300">
                        {selectedTenantDashboard.currentAddress || 'No address specified'}
                        {selectedTenantDashboard.postcode ? ` (${selectedTenantDashboard.postcode})` : ''}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Lease Agreements Card */}
                <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-4 space-y-2.5">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Active Leases &amp; Rentals</span>
                  </div>
                  {(() => {
                    const tenantAgreements = tenancies.filter(
                      (t) =>
                        (t.tenantId?._id || t.tenantId) === selectedTenantDashboard._id
                    );

                    if (tenantAgreements.length === 0) {
                      return (
                        <div className="space-y-2 py-1">
                          <div className="text-xs text-amber-400/90 font-medium">
                            No active lease agreement linked to this tenant yet.
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setTenancyForm((prev) => ({
                                ...prev,
                                tenantId: selectedTenantDashboard._id,
                                propertyId: '',
                                unitId: '',
                                rentAmount: '',
                                depositAmount: '',
                              }));
                              setSelectedTenantDashboard(null);
                              setTenancyError('');
                              setShowTenancyModal(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow-md transition cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Assign Lettable Unit Now</span>
                          </button>
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-2">
                        {tenantAgreements.map((agr) => (
                          <div
                            key={agr._id}
                            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                          >
                            <div>
                              <div className="font-bold text-white flex items-center gap-1.5">
                                <span>{agr.propertyId?.name || 'Property'}</span>
                                {agr.unitId?.unitName && (
                                  <span className="text-indigo-400 font-normal">
                                    · {agr.unitId.unitName}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {formatUKDate(agr.startDate)} – {formatUKDate(agr.endDate)} ({agr.leaseType})
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold font-mono text-emerald-400">
                                {formatGBP(agr.rentAmount)} / mo
                              </div>
                              <div className="text-[10px] font-mono text-slate-400">
                                Dep: {formatGBP(agr.depositAmount)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Bottom: Tenant Documents Section (Full 19 standard documents) */}
              <div className="pt-2">
                <TenantDocumentSection tenantId={selectedTenantDashboard._id} />
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedTenantDashboard(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition cursor-pointer"
              >
                Close Dashboard
              </button>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Modal: New Tenancy Lease */}
      {showTenancyModal && (
        <ModalPortal isOpen={showTenancyModal} onClose={() => setShowTenancyModal(false)}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h2 className="text-base font-bold text-white">Create Tenancy Agreement (AST)</h2>
              <button onClick={() => setShowTenancyModal(false)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {tenancyError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {tenancyError}
              </div>
            )}

            <form onSubmit={handleTenancySubmit} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Select Tenant</label>
                <select
                  required
                  value={tenancyForm.tenantId}
                  onChange={(e) => setTenancyForm({ ...tenancyForm, tenantId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer"
                >
                  <option value="">-- Choose Tenant --</option>
                  {tenants.map((ten) => (
                    <option key={ten._id} value={ten._id}>
                      {ten.fullName} ({ten.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Property</label>
                  <select
                    required
                    value={tenancyForm.propertyId}
                    onChange={(e) => setTenancyForm({ ...tenancyForm, propertyId: e.target.value, unitId: '' })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer"
                  >
                    <option value="">-- Select Property --</option>
                    {properties.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} ({p.postcode})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Lettable Unit</label>
                  <select
                    required
                    disabled={!tenancyForm.propertyId}
                    value={tenancyForm.unitId}
                    onChange={(e) => setTenancyForm({ ...tenancyForm, unitId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer disabled:opacity-50"
                  >
                    <option value="">-- Select Unit --</option>
                    {selectedPropertyUnits.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.unitName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Monthly Rent (£)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="0.01"
                    value={tenancyForm.rentAmount}
                    onChange={(e) => setTenancyForm({ ...tenancyForm, rentAmount: e.target.value })}
                    placeholder="1250.00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-bold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Deposit (£)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={tenancyForm.depositAmount}
                    onChange={(e) => setTenancyForm({ ...tenancyForm, depositAmount: e.target.value })}
                    placeholder="1440.00"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={tenancyForm.startDate}
                    onChange={(e) => setTenancyForm({ ...tenancyForm, startDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={tenancyForm.endDate}
                    onChange={(e) => setTenancyForm({ ...tenancyForm, endDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTenancyModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={tenancySubmitting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold"
                >
                  Save Lease
                </button>
              </div>
            </form>
          </div>
        </ModalPortal>
      )}

      {/* Modal: Edit Tenant */}
      {editingTenant && (
        <ModalPortal isOpen={Boolean(editingTenant)} onClose={() => setEditingTenant(null)}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Edit Tenant Details</h2>
                  <p className="text-[11px] text-slate-400">Modify contact or identity information</p>
                </div>
              </div>
              <button
                onClick={() => setEditingTenant(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editTenantError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {editTenantError}
              </div>
            )}

            <form onSubmit={handleEditTenantSubmit} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Full Legal Name</label>
                <input
                  type="text"
                  required
                  value={editTenantForm.fullName}
                  onChange={(e) => setEditTenantForm({ ...editTenantForm, fullName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Phone Number</label>
                  <input
                    type="tel"
                    required
                    value={editTenantForm.phone}
                    onChange={(e) => setEditTenantForm({ ...editTenantForm, phone: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Tenant Type</label>
                  <select
                    value={editTenantForm.tenantType}
                    onChange={(e) => setEditTenantForm({ ...editTenantForm, tenantType: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer"
                  >
                    <option value="INDIVIDUAL">Individual Tenant</option>
                    <option value="COMPANY">Company / Corporate Let</option>
                    <option value="STUDENT">Student</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Email Address</label>
                <input
                  type="email"
                  value={editTenantForm.email}
                  onChange={(e) => setEditTenantForm({ ...editTenantForm, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              {editTenantForm.tenantType === 'COMPANY' && (
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Company Legal Name</label>
                  <input
                    type="text"
                    value={editTenantForm.companyName}
                    onChange={(e) => setEditTenantForm({ ...editTenantForm, companyName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-slate-300 font-medium mb-1">Current Address</label>
                  <input
                    type="text"
                    value={editTenantForm.currentAddress}
                    onChange={(e) => setEditTenantForm({ ...editTenantForm, currentAddress: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Postcode</label>
                  <input
                    type="text"
                    value={editTenantForm.postcode}
                    onChange={(e) => setEditTenantForm({ ...editTenantForm, postcode: e.target.value })}
                    placeholder="SW1A 1AA"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 uppercase focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTenant(null)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editTenantSubmitting}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {editTenantSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Tenant</span>
                </button>
              </div>
            </form>
          </div>
        </ModalPortal>
      )}

      {/* Modal: Edit Tenancy Lease */}
      {editingTenancy && (
        <ModalPortal isOpen={Boolean(editingTenancy)} onClose={() => setEditingTenancy(null)}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Edit Tenancy Agreement</h2>
                  <p className="text-[11px] text-indigo-400">{editingTenancy.agreementRef}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingTenancy(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editTenancyError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {editTenancyError}
              </div>
            )}

            <form onSubmit={handleEditTenancySubmit} className="mt-4 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <label className="block text-emerald-400 font-bold mb-1">Monthly Rent (£)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editTenancyForm.rentAmount}
                    onChange={(e) => setEditTenancyForm({ ...editTenancyForm, rentAmount: e.target.value })}
                    className="w-full bg-slate-950 border border-emerald-500/30 rounded-lg px-3 py-2 text-emerald-300 font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Deposit Held (£)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editTenancyForm.depositAmount}
                    onChange={(e) => setEditTenancyForm({ ...editTenancyForm, depositAmount: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Rent Due Day (1-28)</label>
                  <input
                    type="number"
                    min="1"
                    max="28"
                    required
                    value={editTenancyForm.rentDueDay}
                    onChange={(e) => setEditTenancyForm({ ...editTenancyForm, rentDueDay: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Lease Status</label>
                  <select
                    value={editTenancyForm.status}
                    onChange={(e) => setEditTenancyForm({ ...editTenancyForm, status: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="EXPIRED">EXPIRED</option>
                    <option value="TERMINATED">TERMINATED</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={editTenancyForm.startDate}
                    onChange={(e) => setEditTenancyForm({ ...editTenancyForm, startDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">End Date</label>
                  <input
                    type="date"
                    required
                    value={editTenancyForm.endDate}
                    onChange={(e) => setEditTenancyForm({ ...editTenancyForm, endDate: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Lease Legal Type</label>
                <select
                  value={editTenancyForm.leaseType}
                  onChange={(e) => setEditTenancyForm({ ...editTenancyForm, leaseType: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none cursor-pointer"
                >
                  <option value="AST">Assured Shorthold Tenancy (AST)</option>
                  <option value="NON_HOUSING">Non-Housing Act Tenancy</option>
                  <option value="COMMERCIAL">Commercial Lease</option>
                  <option value="LICENSE">License to Occupy</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTenancy(null)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editTenancySubmitting}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {editTenancySubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Lease</span>
                </button>
              </div>
            </form>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}

export default TenantsPage;
