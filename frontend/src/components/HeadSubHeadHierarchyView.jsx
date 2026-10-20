import React, { useState, useEffect, useMemo } from 'react';
import {
  FolderTree,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Edit3,
  Trash2,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  ChevronDown,
  Tag,
  Sparkles,
  Layers,
  Lock,
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
  Receipt,
  Move,
  X,
  Check,
} from 'lucide-react';
import { ModalPortal } from './ModalPortal.jsx';
import { ledgerAPI } from '../services/api.js';
import { formatGBP, formatUKDate } from '../utils/formatters.js';

export function HeadSubHeadHierarchyView({ selectedCompany }) {
  const [hierarchyData, setHierarchyData] = useState({
    heads: [],
    unparented: [],
    totalHeads: 0,
    totalSubHeads: 0,
  });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Search & Type Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Expanded heads map (default: all expanded)
  const [expandedHeads, setExpandedHeads] = useState({});

  // Modals
  const [headModalOpen, setHeadModalOpen] = useState(false);
  const [headModalMode, setHeadModalMode] = useState('CREATE'); // 'CREATE' | 'EDIT'
  const [selectedHead, setSelectedHead] = useState(null);
  const [headForm, setHeadForm] = useState({
    name: '',
    code: '',
    type: 'OPERATING_EXPENSE',
    aliasesText: '',
  });

  const [subHeadModalOpen, setSubHeadModalOpen] = useState(false);
  const [subHeadModalMode, setSubHeadModalMode] = useState('CREATE'); // 'CREATE' | 'EDIT'
  const [selectedSubHead, setSelectedSubHead] = useState(null);
  const [subHeadForm, setSubHeadForm] = useState({
    headId: '',
    name: '',
    code: '',
    type: 'OPERATING_EXPENSE',
    isRentalHead: false,
  });

  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [subHeadToMove, setSubHeadToMove] = useState(null);
  const [targetHeadId, setTargetHeadId] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  // Fetch Category Hierarchy
  const loadHierarchy = async (force = false) => {
    try {
      setLoading(true);
      setErrorMsg('');
      const res = await ledgerAPI.getCategoryHierarchy({}, { forceRefresh: force });
      if (res?.success && res.data) {
        setHierarchyData(res.data);

        // Initialize expanded heads
        const initialExpanded = {};
        (res.data.heads || []).forEach((h) => {
          initialExpanded[h._id] = true;
        });
        setExpandedHeads((prev) => ({ ...initialExpanded, ...prev }));
      }
    } catch (err) {
      console.error('Failed to load category hierarchy:', err);
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to load category hierarchy.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHierarchy();
  }, [selectedCompany]);

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const toggleHeadExpanded = (headId) => {
    setExpandedHeads((prev) => ({ ...prev, [headId]: !prev[headId] }));
  };

  // Filtered Heads
  const filteredHeads = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return (hierarchyData.heads || []).filter((h) => {
      if (typeFilter !== 'ALL' && h.type !== typeFilter) return false;
      if (!q) return true;
      const matchHead = h.name.toLowerCase().includes(q) || (h.code || '').toLowerCase().includes(q);
      const matchChild = (h.subHeads || []).some(
        (s) => s.name.toLowerCase().includes(q) || (s.code || '').toLowerCase().includes(q)
      );
      return matchHead || matchChild;
    });
  }, [hierarchyData.heads, searchQuery, typeFilter]);

  // Open Head Modal (Create or Edit)
  const openHeadModal = (mode = 'CREATE', head = null) => {
    setHeadModalMode(mode);
    setSelectedHead(head);
    setModalError('');
    if (mode === 'EDIT' && head) {
      setHeadForm({
        name: head.name,
        code: head.code || '',
        type: head.type || 'OPERATING_EXPENSE',
        aliasesText: Array.isArray(head.aliases) ? head.aliases.join(', ') : '',
      });
    } else {
      setHeadForm({
        name: '',
        code: '',
        type: 'OPERATING_EXPENSE',
        aliasesText: '',
      });
    }
    setHeadModalOpen(true);
  };

  // Submit Head Form
  const handleHeadSubmit = async (e) => {
    e.preventDefault();
    if (!headForm.name.trim()) {
      setModalError('Head category name is required.');
      return;
    }

    try {
      setSubmitting(true);
      setModalError('');

      const aliases = headForm.aliasesText
        ? headForm.aliasesText.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

      if (headModalMode === 'CREATE') {
        const res = await ledgerAPI.createHeadCategory({
          name: headForm.name.trim(),
          code: headForm.code.trim().toUpperCase() || undefined,
          type: headForm.type,
          aliases,
        });
        if (res?.success) {
          showSuccess(`Head category "${headForm.name}" created successfully.`);
          setHeadModalOpen(false);
          await loadHierarchy(true);
        }
      } else if (headModalMode === 'EDIT' && selectedHead) {
        const res = await ledgerAPI.updateCategoryHierarchy(selectedHead._id, {
          name: headForm.name.trim(),
          code: headForm.code.trim().toUpperCase() || '',
          type: headForm.type,
          aliases,
        });
        if (res?.success) {
          showSuccess(`Head category "${headForm.name}" updated successfully.`);
          setHeadModalOpen(false);
          await loadHierarchy(true);
        }
      }
    } catch (err) {
      setModalError(err.response?.data?.message || err.message || 'Failed to save Head category.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Sub Head Modal (Create or Edit)
  const openSubHeadModal = (mode = 'CREATE', parentHead = null, subHead = null) => {
    setSubHeadModalMode(mode);
    setSelectedSubHead(subHead);
    setModalError('');
    if (mode === 'EDIT' && subHead) {
      setSubHeadForm({
        headId: parentHead?._id || subHead.parentCategoryId || '',
        name: subHead.name,
        code: subHead.code || '',
        type: subHead.type || parentHead?.type || 'OPERATING_EXPENSE',
        isRentalHead: Boolean(subHead.isRentalHead),
      });
    } else {
      setSubHeadForm({
        headId: parentHead?._id || '',
        name: '',
        code: '',
        type: parentHead?.type || 'OPERATING_EXPENSE',
        isRentalHead: Boolean(parentHead?.isRentalHead),
      });
    }
    setSubHeadModalOpen(true);
  };

  // Submit Sub Head Form
  const handleSubHeadSubmit = async (e) => {
    e.preventDefault();
    if (!subHeadForm.name.trim()) {
      setModalError('Sub Head category name is required.');
      return;
    }
    if (!subHeadForm.headId) {
      setModalError('Please select a parent Head category.');
      return;
    }

    try {
      setSubmitting(true);
      setModalError('');

      if (subHeadModalMode === 'CREATE') {
        const res = await ledgerAPI.createSubHeadCategory({
          headId: subHeadForm.headId,
          name: subHeadForm.name.trim(),
          code: subHeadForm.code.trim().toUpperCase() || undefined,
          type: subHeadForm.type,
          isRentalHead: subHeadForm.isRentalHead,
        });
        if (res?.success) {
          showSuccess(`Sub Head category "${subHeadForm.name}" created successfully.`);
          setSubHeadModalOpen(false);
          await loadHierarchy(true);
        }
      } else if (subHeadModalMode === 'EDIT' && selectedSubHead) {
        const res = await ledgerAPI.updateCategoryHierarchy(selectedSubHead._id, {
          name: subHeadForm.name.trim(),
          code: subHeadForm.code.trim().toUpperCase() || '',
          type: subHeadForm.type,
          isRentalHead: subHeadForm.isRentalHead,
          parentCategoryId: subHeadForm.headId,
        });
        if (res?.success) {
          showSuccess(`Sub Head category "${subHeadForm.name}" updated successfully.`);
          setSubHeadModalOpen(false);
          await loadHierarchy(true);
        }
      }
    } catch (err) {
      setModalError(err.response?.data?.message || err.message || 'Failed to save Sub Head category.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Move Modal
  const openMoveModal = (subHead, currentHead) => {
    setSubHeadToMove(subHead);
    setSelectedHead(currentHead);
    setTargetHeadId('');
    setModalError('');
    setMoveModalOpen(true);
  };

  // Submit Move Sub Head
  const handleMoveSubmit = async (e) => {
    e.preventDefault();
    if (!targetHeadId) {
      setModalError('Please select a target Head category.');
      return;
    }

    try {
      setSubmitting(true);
      setModalError('');
      const res = await ledgerAPI.updateCategoryHierarchy(subHeadToMove._id, {
        parentCategoryId: targetHeadId,
      });
      if (res?.success) {
        showSuccess(`Moved Sub Head "${subHeadToMove.name}" and synchronized transactions.`);
        setMoveModalOpen(false);
        await loadHierarchy(true);
      }
    } catch (err) {
      setModalError(err.response?.data?.message || err.message || 'Failed to move Sub Head.');
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Category Active Status
  const handleToggleActive = async (category) => {
    try {
      const nextActive = !category.isActive;
      await ledgerAPI.updateCategoryHierarchy(category._id, { isActive: nextActive });
      showSuccess(`Category "${category.name}" marked as ${nextActive ? 'Active' : 'Inactive'}.`);
      await loadHierarchy(true);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to update category status.');
    }
  };

  // Delete Category
  const handleDeleteCategory = async (category) => {
    if (category.transactionCount > 0) {
      alert(`Cannot delete "${category.name}" because it is currently linked to ${category.transactionCount} transaction(s). You can deactivate it instead.`);
      return;
    }

    const isConfirmed = window.confirm(`Are you sure you want to delete category "${category.name}"?`);
    if (!isConfirmed) return;

    try {
      await ledgerAPI.deleteCategoryHierarchy(category._id);
      showSuccess(`Category "${category.name}" deleted successfully.`);
      await loadHierarchy(true);
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to delete category.');
    }
  };

  const totalTransactionsCount = useMemo(() => {
    return (hierarchyData.heads || []).reduce((sum, h) => sum + (h.transactionCount || 0), 0);
  }, [hierarchyData.heads]);

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="executive-card rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Main Heads</span>
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
              <FolderTree size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black font-display text-slate-900 dark:text-white mt-1 tabular-nums">
            {hierarchyData.totalHeads}
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">
            Authoritative Nominal Groups
          </div>
        </div>

        <div className="executive-card rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Child Sub Heads</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Layers size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black font-display text-slate-900 dark:text-white mt-1 tabular-nums">
            {hierarchyData.totalSubHeads}
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">
            Linked to Specific Heads
          </div>
        </div>

        <div className="executive-card rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Linked Transactions</span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
              <Receipt size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black font-display text-slate-900 dark:text-white mt-1 tabular-nums">
            {totalTransactionsCount}
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">
            Protected ledger postings
          </div>
        </div>

        <div className="executive-card rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Standalone / Unparented</span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <Tag size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black font-display text-slate-900 dark:text-white mt-1 tabular-nums">
            {(hierarchyData.unparented || []).length}
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">
            Flat legacy categories
          </div>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[240px] sm:min-w-[280px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search Head or Sub Head..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="ALL">All Account Types</option>
              <option value="INCOME">Income</option>
              <option value="OPERATING_EXPENSE">Operating Expense</option>
              <option value="FINANCE_COST">Finance Cost</option>
              <option value="TRANSFER">Loan &amp; Transfer</option>
              <option value="CAPITAL_EXPENDITURE">Capital Expenditure</option>
            </select>

            <button
              onClick={() => loadHierarchy(true)}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Refresh hierarchy"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => openHeadModal('CREATE')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/25 transition cursor-pointer"
            >
              <Plus size={14} />
              <span>New Main Head</span>
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="cursor-pointer">&times;</button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="cursor-pointer">&times;</button>
        </div>
      )}

      {/* Hierarchy Cards Tree */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-500 font-bold flex items-center justify-center gap-2">
          <RefreshCw size={18} className="animate-spin text-indigo-600" />
          Loading authoritative Head &amp; Sub Head hierarchy...
        </div>
      ) : filteredHeads.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
          <FolderTree size={36} className="mx-auto text-slate-400 mb-2" />
          <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
            No matching Heads found
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Try adjusting your search query or create a new Head category above.
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredHeads.map((head) => {
            const isExpanded = expandedHeads[head._id] !== false;
            const subHeads = head.subHeads || [];

            return (
              <div
                key={head._id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden"
              >
                {/* Head Card Header */}
                <div className="p-4 sm:p-5 bg-slate-50/70 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleHeadExpanded(head._id)}
                      className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 transition cursor-pointer"
                    >
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-base text-slate-900 dark:text-white">
                          {head.name}
                        </span>
                        {head.code && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-mono font-bold">
                            {head.code}
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-[10px] font-bold text-indigo-700 dark:text-indigo-400">
                          {head.type}
                        </span>
                        {head.aliases && head.aliases.length > 0 && (
                          <span className="text-[10px] text-slate-400 italic">
                            (Aliases: {head.aliases.join(', ')})
                          </span>
                        )}
                        {!head.isActive && (
                          <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 text-[10px] font-bold">
                            Inactive
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {subHeads.length} Sub Head{subHeads.length === 1 ? '' : 's'} &bull;{' '}
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          {head.transactionCount} Transaction{head.transactionCount === 1 ? '' : 's'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Head Action Buttons */}
                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    <button
                      onClick={() => openSubHeadModal('CREATE', head)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 text-xs font-bold transition cursor-pointer"
                      title="Add Sub Head under this Head"
                    >
                      <Plus size={12} />
                      <span>Add Sub Head</span>
                    </button>

                    <button
                      onClick={() => openHeadModal('EDIT', head)}
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                      title="Edit Head"
                    >
                      <Edit3 size={14} />
                    </button>

                    <button
                      onClick={() => handleToggleActive(head)}
                      className={`p-1.5 rounded-lg border transition cursor-pointer ${
                        head.isActive
                          ? 'border-slate-200 dark:border-slate-800 text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                          : 'border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:border-amber-800'
                      }`}
                      title={head.isActive ? 'Deactivate Head' : 'Activate Head'}
                    >
                      <ShieldCheck size={14} />
                    </button>

                    <button
                      onClick={() => handleDeleteCategory(head)}
                      disabled={head.transactionCount > 0}
                      className={`p-1.5 rounded-lg border transition ${
                        head.transactionCount > 0
                          ? 'border-slate-200 dark:border-slate-800 text-slate-300 dark:text-slate-700 cursor-not-allowed opacity-40'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-300 dark:hover:bg-rose-950/40 text-slate-500 cursor-pointer'
                      }`}
                      title={head.transactionCount > 0 ? 'Cannot delete Head with linked transactions' : 'Delete Head'}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Sub Heads Table / List */}
                {isExpanded && (
                  <div className="p-3 sm:p-4">
                    {subHeads.length === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400 italic">
                        No Sub Heads configured under this Head yet. Click "+ Add Sub Head" to add one.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {subHeads.map((sub) => (
                          <div
                            key={sub._id}
                            className={`p-3 rounded-xl border flex flex-col justify-between gap-2 transition ${
                              sub.isActive
                                ? 'bg-slate-50/50 dark:bg-slate-950/30 border-slate-200/80 dark:border-slate-800/80 hover:border-indigo-400'
                                : 'bg-slate-100/50 dark:bg-slate-950/10 border-dashed border-slate-300 dark:border-slate-800 opacity-60'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                                  {sub.name}
                                </div>
                                {sub.code && (
                                  <span className="text-[10px] font-mono text-slate-400">
                                    {sub.code}
                                  </span>
                                )}
                              </div>
                              <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-[10px] font-mono font-bold shrink-0">
                                {sub.transactionCount} tx
                              </span>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-800/60 text-xs">
                              <span className="text-[10px] text-slate-400">
                                {sub.isRentalHead ? 'Rental Head' : 'Standard Head'}
                              </span>

                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => openSubHeadModal('EDIT', head, sub)}
                                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                                  title="Edit Sub Head"
                                >
                                  <Edit3 size={12} />
                                </button>

                                <button
                                  onClick={() => openMoveModal(sub, head)}
                                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-indigo-600 transition cursor-pointer"
                                  title="Move to another Head"
                                >
                                  <Move size={12} />
                                </button>

                                <button
                                  onClick={() => handleToggleActive(sub)}
                                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-emerald-600 transition cursor-pointer"
                                  title={sub.isActive ? 'Deactivate Sub Head' : 'Activate Sub Head'}
                                >
                                  <ShieldCheck size={12} />
                                </button>

                                <button
                                  onClick={() => handleDeleteCategory(sub)}
                                  disabled={sub.transactionCount > 0}
                                  className={`p-1 rounded transition ${
                                    sub.transactionCount > 0
                                      ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed opacity-30'
                                      : 'hover:bg-rose-100 dark:hover:bg-rose-950/40 text-slate-400 hover:text-rose-600 cursor-pointer'
                                  }`}
                                  title={sub.transactionCount > 0 ? 'Cannot delete Sub Head with linked transactions' : 'Delete Sub Head'}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Head Modal (Create/Edit) */}
      {headModalOpen && (
        <ModalPortal isOpen={headModalOpen} onClose={() => setHeadModalOpen(false)} zIndex="z-[9999]">
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <FolderTree size={18} className="text-indigo-600" />
                <span>{headModalMode === 'CREATE' ? 'Add New Main Head' : `Edit Main Head: ${selectedHead?.name}`}</span>
              </h3>
              <button onClick={() => setHeadModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-bold">
                {modalError}
              </div>
            )}

            <form onSubmit={handleHeadSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Head Category Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Admin Expenses"
                  value={headForm.name}
                  onChange={(e) => setHeadForm({ ...headForm, name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Accounting Code (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. HEAD-ADM"
                  value={headForm.code}
                  onChange={(e) => setHeadForm({ ...headForm, code: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono font-medium focus:outline-none focus:border-indigo-500 uppercase"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Financial Account Type
                </label>
                <select
                  value={headForm.type}
                  onChange={(e) => setHeadForm({ ...headForm, type: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="OPERATING_EXPENSE">Operating Expense</option>
                  <option value="INCOME">Income &amp; Rental Revenue</option>
                  <option value="FINANCE_COST">Finance Cost (Mortgages)</option>
                  <option value="TRANSFER">Loan &amp; Transfers</option>
                  <option value="CAPITAL_EXPENDITURE">Capital Expenditure</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Aliases (Comma-separated, for statement import detection)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Admin Expeses, General Office"
                  value={headForm.aliasesText}
                  onChange={(e) => setHeadForm({ ...headForm, aliasesText: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setHeadModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer shadow-md disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : headModalMode === 'CREATE' ? 'Create Head' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Sub Head Modal (Create/Edit) */}
      {subHeadModalOpen && (
        <ModalPortal isOpen={subHeadModalOpen} onClose={() => setSubHeadModalOpen(false)} zIndex="z-[9999]">
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Layers size={18} className="text-emerald-600" />
                <span>{subHeadModalMode === 'CREATE' ? 'Add New Sub Head' : `Edit Sub Head: ${selectedSubHead?.name}`}</span>
              </h3>
              <button onClick={() => setSubHeadModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-bold">
                {modalError}
              </div>
            )}

            <form onSubmit={handleSubHeadSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Parent Head Category <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={subHeadForm.headId}
                  onChange={(e) => setSubHeadForm({ ...subHeadForm, headId: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="">-- Select Parent Head --</option>
                  {(hierarchyData.heads || []).map((h) => (
                    <option key={h._id} value={h._id}>
                      {h.name} ({h.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Sub Head Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Repair and Maintainance"
                  value={subHeadForm.name}
                  onChange={(e) => setSubHeadForm({ ...subHeadForm, name: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Code (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. SUB-REP"
                  value={subHeadForm.code}
                  onChange={(e) => setSubHeadForm({ ...subHeadForm, code: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono font-medium focus:outline-none focus:border-emerald-500 uppercase"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="subHeadRentalHead"
                  checked={subHeadForm.isRentalHead}
                  onChange={(e) => setSubHeadForm({ ...subHeadForm, isRentalHead: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="subHeadRentalHead" className="text-slate-700 dark:text-slate-300 font-semibold cursor-pointer">
                  Is Direct Rental Receipt Head (Income)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSubHeadModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer shadow-md disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : subHeadModalMode === 'CREATE' ? 'Create Sub Head' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* Move Sub Head Modal */}
      {moveModalOpen && (
        <ModalPortal isOpen={moveModalOpen} onClose={() => setMoveModalOpen(false)} zIndex="z-[9999]">
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
                <Move size={18} className="text-indigo-600" />
                <span>Move Sub Head: {subHeadToMove?.name}</span>
              </h3>
              <button onClick={() => setMoveModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-xs">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Moving this Sub Head will update all {subHeadToMove?.transactionCount || 0} associated transactions to reflect the new parent Head hierarchy.
                </span>
              </div>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-bold">
                {modalError}
              </div>
            )}

            <form onSubmit={handleMoveSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Current Parent Head
                </label>
                <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold">
                  {selectedHead?.name} ({selectedHead?.type})
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Target Destination Head <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={targetHeadId}
                  onChange={(e) => setTargetHeadId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-medium focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="">-- Choose New Parent Head --</option>
                  {(hierarchyData.heads || [])
                    .filter((h) => h._id !== selectedHead?._id)
                    .map((h) => (
                      <option key={h._id} value={h._id}>
                        {h.name} ({h.type})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setMoveModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !targetHeadId}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer shadow-md disabled:opacity-50"
                >
                  {submitting ? 'Moving...' : 'Confirm Move & Synchronize'}
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}
    </div>
  );
}

export default HeadSubHeadHierarchyView;
