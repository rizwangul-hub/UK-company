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
} from 'lucide-react';
import { formatGBP, formatUKDate } from '../utils/formatters.js';
import { tenantsAPI, tenanciesAPI, propertiesAPI, getApiCache } from '../services/api.js';

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

  // Add Tenant Modal
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [tenantSubmitting, setTenantSubmitting] = useState(false);
  const [tenantError, setTenantError] = useState('');
  const [tenantForm, setTenantForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    currentAddress: '',
    postcode: '',
    tenantType: 'INDIVIDUAL',
    companyName: '',
  });

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

  const handleTenantSubmit = async (e) => {
    e.preventDefault();
    setTenantSubmitting(true);
    setTenantError('');

    try {
      await tenantsAPI.create(tenantForm);
      setShowTenantModal(false);
      loadData();
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
      loadData();
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
      await tenantsAPI.update(editingTenant._id, editTenantForm);
      setEditingTenant(null);
      loadData();
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
            onClick={() => {
              setTenantError('');
              setShowTenantModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/60 text-xs font-bold transition cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4 text-indigo-400" />
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
                    <th className="py-3 px-4">Tenant</th>
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
                      <td className="py-3.5 px-4 font-semibold text-slate-200">
                        {t.tenantId?.fullName}
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
          {tenants.map((ten) => (
            <div key={ten._id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">{ten.fullName}</h3>
                  <div className="text-[10px] text-slate-400">{ten.tenantType}</div>
                </div>
                <button
                  onClick={() => handleOpenEditTenant(ten)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-[11px] font-medium border border-slate-700/60 transition cursor-pointer"
                >
                  <Edit3 className="w-3 h-3 text-amber-400" />
                  <span>Edit</span>
                </button>
              </div>
              <div className="space-y-1 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>{ten.phone}</span>
                </div>
                {ten.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>{ten.email}</span>
                  </div>
                )}
                {ten.currentAddress && (
                  <div className="text-[11px] text-slate-500 pt-1">
                    {ten.currentAddress} {ten.postcode && `(${ten.postcode})`}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: New Tenant */}
      {showTenantModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h2 className="text-base font-bold text-white">Add UK Tenant</h2>
              <button onClick={() => setShowTenantModal(false)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            {tenantError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {tenantError}
              </div>
            )}

            <form onSubmit={handleTenantSubmit} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={tenantForm.fullName}
                  onChange={(e) => setTenantForm({ ...tenantForm, fullName: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Phone</label>
                  <input
                    type="text"
                    required
                    value={tenantForm.phone}
                    onChange={(e) => setTenantForm({ ...tenantForm, phone: e.target.value })}
                    placeholder="07123 456789"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={tenantForm.email}
                    onChange={(e) => setTenantForm({ ...tenantForm, email: e.target.value })}
                    placeholder="tenant@gmail.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTenantModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={tenantSubmitting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold"
                >
                  Create Tenant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Tenancy Lease */}
      {showTenancyModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
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
        </div>
      )}

      {/* Modal: Edit Tenant */}
      {editingTenant && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
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
        </div>
      )}

      {/* Modal: Edit Tenancy Lease */}
      {editingTenancy && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
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
        </div>
      )}
    </div>
  );
}

export default TenantsPage;
