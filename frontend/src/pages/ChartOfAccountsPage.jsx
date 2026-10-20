import React, { useState, useEffect, useMemo } from 'react';
import {
  ListTree,
  Receipt,
  Landmark,
  Coins,
  Percent,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Edit3,
  Trash2,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Building2,
  CreditCard,
  Layers,
  ChevronRight,
  ChevronDown,
  Eye,
  Check,
  X,
  Lock,
  FolderTree,
  CornerDownRight,
  Sparkles,
  Zap,
  Flame,
  Wrench,
  Droplets,
  Tag,
} from 'lucide-react';
import { ledgerAPI, accountsAPI, mortgagesAPI, propertiesAPI, getApiCache } from '../services/api.js';
import { formatGBP, formatUKDate } from '../utils/formatters.js';
import { ModalPortal } from '../components/ModalPortal.jsx';
import { HeadSubHeadHierarchyView } from '../components/HeadSubHeadHierarchyView.jsx';
import { CategoryBackfillReviewView } from '../components/CategoryBackfillReviewView.jsx';
import pixxLogo from '../assets/logo.png';

// Standard UK Property Operational Heads for 1-Click Setup
const STANDARD_PROPERTY_HEADS = [
  { name: 'Electricity Bill', code: 'ELEC', isAllowableTaxDeduction: true },
  { name: 'Gas & Heating', code: 'GAS', isAllowableTaxDeduction: true },
  { name: 'Maintenance & Repairs', code: 'MAINT', isAllowableTaxDeduction: true },
  { name: 'Water & Drainage Rates', code: 'WATER', isAllowableTaxDeduction: true },
  { name: 'Building & Landlord Insurance', code: 'INS', isAllowableTaxDeduction: true },
  { name: 'Council Tax / Void Rates', code: 'CTAX', isAllowableTaxDeduction: true },
  { name: 'Letting & Agent Management Fees', code: 'MGMT', isAllowableTaxDeduction: true },
  { name: 'Cleaning & Waste Disposal', code: 'CLEAN', isAllowableTaxDeduction: true },
];

function getHeadIcon(name = '') {
  const lower = name.toLowerCase();
  if (lower.includes('electric') || lower.includes('power')) return <Zap size={14} className="text-amber-500 shrink-0" />;
  if (lower.includes('gas') || lower.includes('heat') || lower.includes('boiler')) return <Flame size={14} className="text-orange-500 shrink-0" />;
  if (lower.includes('maint') || lower.includes('repair') || lower.includes('fix') || lower.includes('contractor')) return <Wrench size={14} className="text-blue-500 shrink-0" />;
  if (lower.includes('water') || lower.includes('drain')) return <Droplets size={14} className="text-cyan-500 shrink-0" />;
  if (lower.includes('insur')) return <ShieldCheck size={14} className="text-emerald-500 shrink-0" />;
  if (lower.includes('council') || lower.includes('tax') || lower.includes('rate')) return <Landmark size={14} className="text-purple-500 shrink-0" />;
  return <Tag size={14} className="text-rose-500 shrink-0" />;
}

export function ChartOfAccountsPage({ selectedCompany }) {
  const cachedCats = getApiCache('/ledger/categories', { params: { includeInactive: 'true' } });
  const cachedAccs = getApiCache('/accounts');
  const cachedMtgs = getApiCache('/mortgages');
  const cachedProps = getApiCache('/properties');

  const [categories, setCategories] = useState(cachedCats?.data?.categories || []);
  const [accounts, setAccounts] = useState(cachedAccs?.data?.accounts || []);
  const [mortgages, setMortgages] = useState(cachedMtgs?.data?.mortgages || []);
  const [properties, setProperties] = useState(cachedProps?.data?.properties || []);

  const [loading, setLoading] = useState(!cachedCats?.data?.categories?.length && !cachedAccs?.data?.accounts?.length);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Active classification tab: 'ALL' | 'EXPENSE' | 'LIQUIDITY' | 'INCOME' | 'FINANCE'
  const [activeTab, setActiveTab] = useState('EXPENSE');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE'); // 'ALL' | 'ACTIVE' | 'INACTIVE'

  // Sub-filter for expense view: 'ALL' | 'GENERAL' | 'PROPERTY' | 'UNIT' | 'MAIN_HEADS'
  const [expenseFilterScope, setExpenseFilterScope] = useState('ALL');
  const [selectedPropertyFilter, setSelectedPropertyFilter] = useState('');

  // Modal states for creating new items
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createType, setCreateType] = useState('EXPENSE'); // 'EXPENSE' | 'LIQUIDITY' | 'INCOME' | 'MORTGAGE' | 'FINANCE_COST'
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [standardHeadsModalProp, setStandardHeadsModalProp] = useState(null);

  // Forms for creation
  const [expenseForm, setExpenseForm] = useState({
    name: '',
    code: '',
    propertyId: '',
    unitId: '',
    parentCategoryId: '',
    isMainHead: false,
    isAllowableTaxDeduction: true,
    description: '',
  });

  const [liquidityForm, setLiquidityForm] = useState({
    name: '',
    accountType: 'BANK', // 'BANK' | 'CASH'
    bankName: '',
    sortCode: '',
    accountNumber: '',
    openingBalance: '',
    notes: '',
  });

  const [incomeForm, setIncomeForm] = useState({
    name: '',
    code: '',
    propertyId: '',
    isRentalHead: false,
    description: '',
  });

  const [mortgageForm, setMortgageForm] = useState({
    lenderName: '',
    propertyId: '',
    accountReference: '',
    originalLoanAmount: '',
    outstandingPrincipalBalance: '',
    interestRate: '',
    rateType: 'FIXED',
    monthlyPaymentAmount: '',
    termYears: '25',
  });

  // Edit Modal State
  const [editingItem, setEditingItem] = useState(null); // { type: 'CATEGORY'|'ACCOUNT'|'MORTGAGE', data: {...} }
  const [editForm, setEditForm] = useState({});

  // Load all master data records from backend
  const loadAllData = async (force = false) => {
    try {
      if ((!categories.length && !accounts.length) || force) {
        setLoading(true);
      }
      setErrorMsg('');

      const [catsRes, accsRes, mtgsRes, propsRes] = await Promise.all([
        ledgerAPI.getCategories({ includeInactive: 'true' }, { forceRefresh: force }),
        accountsAPI.getAll({}, { forceRefresh: force }),
        mortgagesAPI.getAll({}, { forceRefresh: force }),
        propertiesAPI.getAll({}, { forceRefresh: force }),
      ]);

      if (catsRes?.success) setCategories(catsRes.data?.categories || []);
      if (accsRes?.success) setAccounts(accsRes.data?.accounts || []);
      if (mtgsRes?.success) setMortgages(mtgsRes.data?.mortgages || []);
      if (propsRes?.success) setProperties(propsRes.data?.properties || []);
    } catch (err) {
      console.error('Failed to load Chart of Accounts data:', err);
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to fetch Chart of Accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4500);
  };

  // State for inline sub-head creation per property
  const [inlineSubhead, setInlineSubhead] = useState({});
  const [addingInline, setAddingInline] = useState({});
  const [generatingStandard, setGeneratingStandard] = useState({});

  // 1-Click Standard UK Heads Generator (Electricity, Gas, Maintenance, etc.)
  const handleGenerateStandardHeads = async (prop) => {
    try {
      setGeneratingStandard((prev) => ({ ...prev, [prop._id]: true }));
      const existing = expenseCategories.filter(
        (c) => (c.propertyId?._id || c.propertyId)?.toString() === prop._id.toString()
      );
      const existingNames = new Set(existing.map((c) => c.name.toLowerCase().trim()));

      const missing = STANDARD_PROPERTY_HEADS.filter(
        (std) => !existingNames.has(std.name.toLowerCase().trim())
      );

      if (missing.length === 0) {
        showSuccess(`All standard utility & maintenance heads already exist for "${prop.name}".`);
        return;
      }

      for (const head of missing) {
        await ledgerAPI.createCategory({
          name: head.name,
          code: head.code,
          type: 'OPERATING_EXPENSE',
          propertyId: prop._id,
          isAllowableTaxDeduction: head.isAllowableTaxDeduction,
          description: `Standard ${head.name} allocated to ${prop.name}`,
        });
      }

      showSuccess(`Generated ${missing.length} standard utility & maintenance heads for "${prop.name}".`);
      await loadAllData();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to generate standard heads.');
    } finally {
      setGeneratingStandard((prev) => ({ ...prev, [prop._id]: false }));
    }
  };

  // Inline Quick Add Sub-Head for a Property
  const handleInlineAddSubhead = async (e, propId, propName) => {
    e.preventDefault();
    const name = (inlineSubhead[propId] || '').trim();
    if (!name) return;
    try {
      setAddingInline((prev) => ({ ...prev, [propId]: true }));
      await ledgerAPI.createCategory({
        name,
        type: 'OPERATING_EXPENSE',
        propertyId: propId,
        isAllowableTaxDeduction: true,
        description: `Property sub-head for ${propName}`,
      });
      setInlineSubhead((prev) => ({ ...prev, [propId]: '' }));
      showSuccess(`Sub-head "${name}" created under "${propName}".`);
      await loadAllData();
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to add sub-head.');
    } finally {
      setAddingInline((prev) => ({ ...prev, [propId]: false }));
    }
  };

  // Open Create Modal for specific head
  const handleOpenCreateModal = (type, defaultPropId = '') => {
    setCreateType(type);
    setModalError('');
    if (type === 'EXPENSE') {
      setExpenseForm((prev) => ({
        ...prev,
        propertyId: defaultPropId || prev.propertyId || '',
      }));
    }
    setCreateModalOpen(true);
  };

  // Submit Handler for Creating Items
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setModalError('');

    try {
      if (createType === 'EXPENSE') {
        if (!expenseForm.name.trim()) throw new Error('Expense head name is required.');
        await ledgerAPI.createCategory({
          name: expenseForm.name.trim(),
          code: expenseForm.code ? expenseForm.code.trim().toUpperCase() : '',
          type: 'OPERATING_EXPENSE',
          propertyId: expenseForm.propertyId || null,
          unitId: expenseForm.unitId || null,
          parentCategoryId: expenseForm.parentCategoryId || null,
          isMainHead: Boolean(expenseForm.isMainHead),
          isAllowableTaxDeduction: Boolean(expenseForm.isAllowableTaxDeduction),
          description: expenseForm.description.trim(),
        });
        showSuccess(`Expense head "${expenseForm.name}" created successfully.`);
        setExpenseForm({
          name: '',
          code: '',
          propertyId: expenseForm.propertyId, // keep property selected for convenience
          unitId: '',
          parentCategoryId: '',
          isMainHead: false,
          isAllowableTaxDeduction: true,
          description: '',
        });
      } else if (createType === 'LIQUIDITY') {
        if (!liquidityForm.name.trim()) throw new Error('Account name is required.');
        await accountsAPI.create({
          name: liquidityForm.name.trim(),
          accountType: liquidityForm.accountType,
          bankName: liquidityForm.bankName.trim(),
          sortCode: liquidityForm.sortCode.trim(),
          accountNumber: liquidityForm.accountNumber.trim(),
          openingBalance: Number(liquidityForm.openingBalance) || 0,
          notes: liquidityForm.notes.trim(),
        });
        showSuccess(`${liquidityForm.accountType === 'BANK' ? 'Bank' : 'Cash'} account "${liquidityForm.name}" created successfully.`);
        setLiquidityForm({
          name: '',
          accountType: 'BANK',
          bankName: '',
          sortCode: '',
          accountNumber: '',
          openingBalance: '',
          notes: '',
        });
      } else if (createType === 'INCOME') {
        if (!incomeForm.name.trim()) throw new Error('Income head name is required.');
        await ledgerAPI.createCategory({
          name: incomeForm.name.trim(),
          code: incomeForm.code ? incomeForm.code.trim().toUpperCase() : '',
          type: 'INCOME',
          propertyId: incomeForm.propertyId || null,
          isRentalHead: Boolean(incomeForm.isRentalHead),
          isAllowableTaxDeduction: false,
          description: incomeForm.description.trim(),
        });
        showSuccess(`Income head "${incomeForm.name}" created successfully.`);
        setIncomeForm({ name: '', code: '', propertyId: '', isRentalHead: false, description: '' });
      } else if (createType === 'MORTGAGE') {
        if (!mortgageForm.lenderName.trim()) throw new Error('Lender name is required.');
        if (!mortgageForm.propertyId) throw new Error('Please select a linked property for this mortgage.');
        if (!mortgageForm.accountReference.trim()) throw new Error('Mortgage reference number is required.');

        await mortgagesAPI.create({
          lenderName: mortgageForm.lenderName.trim(),
          propertyId: mortgageForm.propertyId,
          accountReference: mortgageForm.accountReference.trim(),
          originalLoanAmount: Number(mortgageForm.originalLoanAmount) || 0,
          outstandingPrincipalBalance:
            Number(mortgageForm.outstandingPrincipalBalance) || Number(mortgageForm.originalLoanAmount) || 0,
          interestRate: Number(mortgageForm.interestRate) || 0,
          rateType: mortgageForm.rateType,
          expectedRepaymentAmount: Number(mortgageForm.monthlyPaymentAmount) || 0,
          termYears: Number(mortgageForm.termYears) || 25,
        });
        showSuccess(`Mortgage facility "${mortgageForm.lenderName}" created successfully.`);
        setMortgageForm({
          lenderName: '',
          propertyId: '',
          accountReference: '',
          originalLoanAmount: '',
          outstandingPrincipalBalance: '',
          interestRate: '',
          rateType: 'FIXED',
          monthlyPaymentAmount: '',
          termYears: '25',
        });
      }

      setCreateModalOpen(false);
      loadAllData();
    } catch (err) {
      setModalError(err.response?.data?.message || err.message || 'Failed to create item.');
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (type, item) => {
    setEditingItem({ type, data: item });
    setModalError('');
    if (type === 'CATEGORY') {
      setEditForm({
        name: item.name || '',
        code: item.code || '',
        type: item.type,
        propertyId: item.propertyId?._id || item.propertyId || '',
        unitId: item.unitId?._id || item.unitId || '',
        parentCategoryId: item.parentCategoryId?._id || item.parentCategoryId || '',
        isMainHead: Boolean(item.isMainHead),
        isAllowableTaxDeduction: Boolean(item.isAllowableTaxDeduction),
        isRentalHead: Boolean(item.isRentalHead),
        description: item.description || '',
        isActive: item.isActive !== false,
      });
    } else if (type === 'ACCOUNT') {
      setEditForm({
        name: item.name || '',
        accountType: item.accountType || 'BANK',
        bankName: item.bankName || '',
        sortCode: item.sortCode || '',
        accountNumber: item.accountNumber || '',
        currentBalance: item.currentBalance !== undefined ? String(item.currentBalance) : '',
        notes: item.notes || '',
        isActive: item.isActive !== false,
      });
    } else if (type === 'MORTGAGE') {
      setEditForm({
        lenderName: item.lenderName || '',
        accountReference: item.accountReference || '',
        outstandingPrincipalBalance:
          item.outstandingPrincipalBalance !== undefined ? String(item.outstandingPrincipalBalance) : '',
        interestRate: item.interestRate !== undefined ? String(item.interestRate) : '',
        rateType: item.rateType || 'FIXED',
        expectedRepaymentAmount: item.expectedRepaymentAmount !== undefined ? String(item.expectedRepaymentAmount) : '',
        status: item.status || 'ACTIVE',
      });
    }
  };

  // Submit Handler for Editing
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingItem) return;
    setSubmitting(true);
    setModalError('');

    try {
      if (editingItem.type === 'CATEGORY') {
        await ledgerAPI.updateCategory(editingItem.data._id, editForm);
        showSuccess(`Category head "${editForm.name}" updated successfully.`);
      } else if (editingItem.type === 'ACCOUNT') {
        await accountsAPI.update(editingItem.data._id, {
          ...editForm,
          currentBalance: Number(editForm.currentBalance) || 0,
        });
        showSuccess(`Account "${editForm.name}" updated successfully.`);
      } else if (editingItem.type === 'MORTGAGE') {
        await mortgagesAPI.update(editingItem.data._id, {
          ...editForm,
          outstandingPrincipalBalance: Number(editForm.outstandingPrincipalBalance) || 0,
          interestRate: Number(editForm.interestRate) || 0,
          expectedRepaymentAmount: Number(editForm.expectedRepaymentAmount) || 0,
        });
        showSuccess(`Mortgage "${editForm.lenderName}" updated successfully.`);
      }

      setEditingItem(null);
      loadAllData();
    } catch (err) {
      setModalError(err.response?.data?.message || err.message || 'Failed to update item.');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Category
  const handleDeleteCategory = async (cat) => {
    if (!window.confirm(`Are you sure you want to deactivate or remove "${cat.name}"?`)) return;
    try {
      await ledgerAPI.deleteCategory(cat._id);
      showSuccess(`Nominal head "${cat.name}" updated.`);
      loadAllData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete nominal category.');
    }
  };

  // Memoized category classifications
  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'OPERATING_EXPENSE' || c.type === 'CAPITAL_EXPENDITURE'),
    [categories]
  );
  const incomeCategories = useMemo(() => categories.filter((c) => c.type === 'INCOME'), [categories]);
  const financeCostCategories = useMemo(() => categories.filter((c) => c.type === 'FINANCE_COST'), [categories]);

  // Main heads for expense parent dropdowns
  const mainExpenseHeads = useMemo(
    () => expenseCategories.filter((c) => c.isMainHead),
    [expenseCategories]
  );

  // Grouped expense heads by Property and General
  const { generalExpenses, propertyGroupedExpenses, unitExpenses } = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    const matchesSearch = (c) => {
      if (!q) return true;
      const propName = c.propertyId?.name || '';
      const unitName = c.unitId?.unitName || '';
      return (
        c.name.toLowerCase().includes(q) ||
        (c.code && c.code.toLowerCase().includes(q)) ||
        propName.toLowerCase().includes(q) ||
        unitName.toLowerCase().includes(q)
      );
    };

    const matchesStatus = (c) => {
      if (statusFilter === 'ACTIVE') return c.isActive !== false;
      if (statusFilter === 'INACTIVE') return c.isActive === false;
      return true;
    };

    const filtered = expenseCategories.filter((c) => matchesSearch(c) && matchesStatus(c));

    const general = filtered.filter((c) => !c.propertyId);
    const byPropertyMap = new Map();

    properties.forEach((p) => {
      byPropertyMap.set(p._id.toString(), {
        property: p,
        heads: [],
      });
    });

    const unitList = [];

    filtered.forEach((c) => {
      if (c.propertyId) {
        const pId = (c.propertyId._id || c.propertyId).toString();
        if (c.unitId) {
          unitList.push(c);
        } else if (byPropertyMap.has(pId)) {
          byPropertyMap.get(pId).heads.push(c);
        } else {
          // Property might not be active in properties list
          const fallbackProp = typeof c.propertyId === 'object' ? c.propertyId : { name: 'Property Asset', _id: pId };
          byPropertyMap.set(pId, { property: fallbackProp, heads: [c] });
        }
      }
    });

    return {
      generalExpenses: general,
      propertyGroupedExpenses: Array.from(byPropertyMap.values()).filter((g) => g.heads.length > 0 || !q),
      unitExpenses: unitList,
    };
  }, [expenseCategories, properties, searchQuery, statusFilter]);

  // Units list for currently selected property in create modal
  const currentPropertyUnits = useMemo(() => {
    if (!expenseForm.propertyId) return [];
    const p = properties.find((item) => item._id === expenseForm.propertyId);
    return p?.units || [];
  }, [properties, expenseForm.propertyId]);

  // Total summary figures
  const totalLiquiditySum = accounts.reduce((sum, a) => sum + (a.currentBalance || 0), 0);
  const totalMortgageDebtSum = mortgages
    .filter((m) => m.status === 'ACTIVE')
    .reduce((sum, m) => sum + (m.outstandingPrincipalBalance || 0), 0);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl dashboard-header-banner">
        <div>
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl bg-slate-900/90 border border-slate-700/60 flex items-center justify-center p-1.5 shadow-md shrink-0 overflow-hidden">
              <img src={selectedCompany?.logo || pixxLogo} alt={selectedCompany?.name || "Company Logo"} className="h-full w-full object-contain" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  UK Chart of Accounts &amp; Nominal Heads
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-[10px] font-black text-indigo-600 dark:text-indigo-400">
                  COA Hierarchy
                </span>
                {selectedCompany && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {selectedCompany.name} ({selectedCompany.legalName})
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium max-w-3xl">
                Organized master financial hierarchy &bull; Main Property Heads &rarr; Electricity, Gas, Maintenance, Bank Accounts &amp; Mortgages for {selectedCompany?.name || 'active portfolio'}
              </p>
            </div>
          </div>
        </div>

        {/* Quick Create Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleOpenCreateModal('EXPENSE')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-md shadow-rose-600/25 transition cursor-pointer"
          >
            <Plus size={14} />
            <span>New Expense Head</span>
          </button>

          <button
            onClick={() => handleOpenCreateModal('LIQUIDITY')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow-md shadow-indigo-600/25 transition cursor-pointer"
          >
            <Plus size={14} />
            <span>Bank / Cash Account</span>
          </button>

          <button
            onClick={() => handleOpenCreateModal('INCOME')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md shadow-emerald-600/25 transition cursor-pointer"
          >
            <Plus size={14} />
            <span>Income Head</span>
          </button>

          <button
            onClick={() => handleOpenCreateModal('MORTGAGE')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs shadow-md shadow-purple-600/25 transition cursor-pointer"
          >
            <Plus size={14} />
            <span>Mortgage Facility</span>
          </button>

          <button
            onClick={loadAllData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 font-bold text-xs shadow-sm transition cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-indigo-600' : ''} />
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs font-bold flex items-center gap-2">
          <AlertCircle size={16} className="text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 4 Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. Operating Expense Heads */}
        <div
          onClick={() => setActiveTab('EXPENSE')}
          className={`executive-card rounded-2xl p-4 sm:p-5 relative overflow-hidden transition cursor-pointer ${
            activeTab === 'EXPENSE'
              ? 'border-rose-500 ring-2 ring-rose-500/20'
              : 'hover:border-rose-400'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Expense Heads</span>
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
              <Receipt size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black font-display text-slate-900 dark:text-white mt-1 tabular-nums">
            {expenseCategories.length}
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">
            {properties.length} Properties &bull; {mainExpenseHeads.length} Main Heads
          </div>
        </div>

        {/* 2. Bank Accounts & Cash Floats */}
        <div
          onClick={() => setActiveTab('LIQUIDITY')}
          className={`executive-card rounded-2xl p-4 sm:p-5 relative overflow-hidden transition cursor-pointer ${
            activeTab === 'LIQUIDITY'
              ? 'border-indigo-500 ring-2 ring-indigo-500/20'
              : 'hover:border-indigo-400'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Bank &amp; Cash Floats</span>
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Landmark size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black font-display text-slate-900 dark:text-white mt-1 tabular-nums">
            {formatGBP(totalLiquiditySum)}
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">
            {accounts.filter((a) => a.accountType === 'BANK').length} Banks &bull;{' '}
            {accounts.filter((a) => a.accountType === 'CASH').length} Petty Cash
          </div>
        </div>

        {/* 3. Income & Revenue Heads */}
        <div
          onClick={() => setActiveTab('INCOME')}
          className={`executive-card rounded-2xl p-4 sm:p-5 relative overflow-hidden transition cursor-pointer ${
            activeTab === 'INCOME'
              ? 'border-emerald-500 ring-2 ring-emerald-500/20'
              : 'hover:border-emerald-400'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Income &amp; Revenue</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <ArrowDownLeft size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black font-display text-slate-900 dark:text-white mt-1 tabular-nums">
            {incomeCategories.length}
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">
            {incomeCategories.filter((c) => c.isRentalHead).length} Rental &bull;{' '}
            {incomeCategories.filter((c) => !c.isRentalHead).length} Sundry Non-Rent
          </div>
        </div>

        {/* 4. Mortgage Facilities */}
        <div
          onClick={() => setActiveTab('FINANCE')}
          className={`executive-card rounded-2xl p-4 sm:p-5 relative overflow-hidden transition cursor-pointer ${
            activeTab === 'FINANCE'
              ? 'border-purple-500 ring-2 ring-purple-500/20'
              : 'hover:border-purple-400'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Mortgages</span>
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
              <Percent size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black font-display text-slate-900 dark:text-white mt-1 tabular-nums">
            {formatGBP(totalMortgageDebtSum)}
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">
            {mortgages.length} Active Facilities &bull; {financeCostCategories.length} Finance Heads
          </div>
        </div>
      </div>

      {/* Main Tab Navigation & Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Segmented Tab Filter */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'HIERARCHY', label: '★ Head & Sub Head Management', icon: FolderTree },
              { id: 'BACKFILL', label: '★ Category Linker & Backfill', icon: Sparkles },
              { id: 'EXPENSE', label: '1. Expense Heads & Properties', count: expenseCategories.length, icon: Receipt },
              { id: 'LIQUIDITY', label: '2. Bank & Cash Accounts', count: accounts.length, icon: Landmark },
              { id: 'INCOME', label: '3. Other Income Heads', count: incomeCategories.length, icon: ArrowDownLeft },
              { id: 'FINANCE', label: '4. Mortgage Facilities', count: mortgages.length + financeCostCategories.length, icon: Percent },
            ].map((tab) => {
              const Icon = tab.icon;
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Controls */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search name, code, property..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48 sm:w-60"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 font-bold text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* TAB 0A: DEDICATED HEAD & SUB HEAD CATEGORY HIERARCHY MANAGEMENT        */}
      {/* ===================================================================== */}
      {activeTab === 'HIERARCHY' && (
        <HeadSubHeadHierarchyView selectedCompany={selectedCompany} />
      )}

      {/* ===================================================================== */}
      {/* TAB 0B: DEDICATED TRANSACTION LINKER & BACKFILL REVIEW SCREEN          */}
      {/* ===================================================================== */}
      {activeTab === 'BACKFILL' && (
        <CategoryBackfillReviewView
          selectedCompany={selectedCompany}
          onBackfillApplied={() => {
            loadData(true);
          }}
        />
      )}

      {/* ===================================================================== */}
      {/* TAB 1: EXPENSE HEADS WITH PROPERTY & HIERARCHICAL ARRANGEMENT         */}
      {/* ===================================================================== */}
      {activeTab === 'EXPENSE' && (
        <div className="space-y-6">
          {/* Sub-Filter Scope Bar */}
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider mr-1">View Scope:</span>
              <button
                onClick={() => {
                  setExpenseFilterScope('ALL');
                  setSelectedPropertyFilter('');
                }}
                className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer ${
                  expenseFilterScope === 'ALL'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                All Heads ({expenseCategories.length})
              </button>
              <button
                onClick={() => setExpenseFilterScope('PROPERTY')}
                className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                  expenseFilterScope === 'PROPERTY'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Building2 size={13} />
                <span>By Property Heads</span>
              </button>
              <button
                onClick={() => setExpenseFilterScope('GENERAL')}
                className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                  expenseFilterScope === 'GENERAL'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>🌐 General Portfolio Heads</span>
              </button>
              <button
                onClick={() => setExpenseFilterScope('MAIN_HEADS')}
                className={`px-3 py-1 rounded-lg font-bold transition cursor-pointer flex items-center gap-1 ${
                  expenseFilterScope === 'MAIN_HEADS'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Layers size={13} />
                <span>Main Heads Only ({mainExpenseHeads.length})</span>
              </button>
            </div>

            <button
              onClick={() => handleOpenCreateModal('EXPENSE')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-sm cursor-pointer"
            >
              <Plus size={13} />
              <span>+ Add Sub-Head</span>
            </button>
          </div>

          {/* Section A: Property Grouped Expense Heads */}
          {(expenseFilterScope === 'ALL' || expenseFilterScope === 'PROPERTY') && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Building2 size={18} className="text-rose-600" />
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    Property Heads &bull; Dedicated Sub-Heads (Electricity, Gas, Maintenance, etc.)
                  </h3>
                </div>
                <span className="text-xs text-slate-500 font-medium">
                  Each Property functions as a Main Head holding its own individual sub-expenses
                </span>
              </div>

              {properties.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                  <Building2 size={32} className="mx-auto text-slate-400 mb-2" />
                  <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    No properties registered in portfolio yet.
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {properties.map((prop) => {
                    const propHeads = expenseCategories.filter(
                      (c) =>
                        (c.propertyId?._id || c.propertyId)?.toString() === prop._id.toString() &&
                        (statusFilter === 'ALL' || (statusFilter === 'ACTIVE' ? c.isActive : !c.isActive))
                    );

                    return (
                      <div
                        key={prop._id}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3"
                      >
                        {/* Property Main Head Card Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5 gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 flex items-center justify-center font-bold shrink-0">
                              <Building2 size={16} />
                            </div>
                            <div>
                              <div className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                                <span>{prop.name}</span>
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                  Main Property Head
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                                {prop.postcode || prop.city || 'UK'} &bull; {propUnitsCount(prop)} Units &bull; {propHeads.length} Sub-Heads
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 self-end sm:self-auto">
                            <button
                              onClick={() => setStandardHeadsModalProp(prop)}
                              disabled={generatingStandard[prop._id]}
                              className="px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-bold text-[10px] transition cursor-pointer flex items-center gap-1"
                              title="1-Click auto generate standard UK utility and maintenance sub-heads (Electricity, Gas, Maintenance, Water, Insurance, Council Tax)"
                            >
                              <Sparkles size={11} className={generatingStandard[prop._id] ? 'animate-spin' : 'text-amber-500'} />
                              <span>{generatingStandard[prop._id] ? 'Adding...' : '⚡ Standard Heads'}</span>
                            </button>

                            <button
                              onClick={() => handleOpenCreateModal('EXPENSE', prop._id)}
                              className="px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-600 hover:text-white text-rose-700 dark:text-rose-300 font-bold text-[10px] transition cursor-pointer flex items-center gap-1"
                              title={`Add new custom expense sub-head under ${prop.name}`}
                            >
                              <Plus size={11} />
                              <span>+ Sub-Head</span>
                            </button>
                          </div>
                        </div>

                        {/* List of Sub-Heads under this Property */}
                        <div className="space-y-1.5">
                          {propHeads.length === 0 ? (
                            <div className="py-4 text-center text-[11px] text-slate-400 font-medium space-y-1">
                              <div>No sub-heads assigned to this property yet.</div>
                              <div className="flex items-center justify-center gap-2 pt-1">
                                <button
                                  onClick={() => setStandardHeadsModalProp(prop)}
                                  className="text-amber-600 dark:text-amber-400 font-bold hover:underline flex items-center gap-1"
                                >
                                  <Sparkles size={11} /> Auto-Add Electricity, Gas, Maintenance
                                </button>
                                <span>&bull;</span>
                                <button
                                  onClick={() => handleOpenCreateModal('EXPENSE', prop._id)}
                                  className="text-rose-600 font-bold hover:underline"
                                >
                                  Custom Sub-Head
                                </button>
                              </div>
                            </div>
                          ) : (
                            propHeads.map((head) => (
                              <div
                                key={head._id}
                                className={`p-2.5 rounded-xl border flex items-center justify-between transition ${
                                  head.isMainHead
                                    ? 'bg-slate-50 dark:bg-slate-800/60 border-slate-300 dark:border-slate-700'
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <CornerDownRight size={13} className="text-slate-400 shrink-0" />
                                  <div className="p-1 rounded-md bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                    {getHeadIcon(head.name)}
                                  </div>
                                  <div>
                                    <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                                      <span>{head.name}</span>
                                      {head.code && (
                                        <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-1 py-0.2 rounded">
                                          {head.code}
                                        </span>
                                      )}
                                      {head.isMainHead && (
                                        <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200">
                                          Parent Head
                                        </span>
                                      )}
                                      {head.isAllowableTaxDeduction && (
                                        <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                                          HMRC Allowable
                                        </span>
                                      )}
                                    </div>
                                    {head.parentCategoryId && (
                                      <div className="text-[10px] text-slate-400 font-medium">
                                        Parent: {head.parentCategoryId.name || 'Parent Category'}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleOpenEdit('CATEGORY', head)}
                                    className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                                    title="Edit Sub-Head"
                                  >
                                    <Edit3 size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteCategory(head)}
                                    className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 transition cursor-pointer"
                                    title="Deactivate Head"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Inline Rapid Sub-Head Creation Form */}
                        <form
                          onSubmit={(e) => handleInlineAddSubhead(e, prop._id, prop.name)}
                          className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2"
                        >
                          <input
                            type="text"
                            placeholder="Type sub-head (e.g. Electricity, Gas, Cleaning)..."
                            value={inlineSubhead[prop._id] || ''}
                            onChange={(e) => setInlineSubhead({ ...inlineSubhead, [prop._id]: e.target.value })}
                            className="flex-1 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-rose-500 placeholder-slate-400"
                          />
                          <button
                            type="submit"
                            disabled={addingInline[prop._id] || !inlineSubhead[prop._id]?.trim()}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0 cursor-pointer shadow-xs"
                          >
                            {addingInline[prop._id] ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
                            <span>Add</span>
                          </button>
                        </form>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Section B: General / Portfolio Level Expense Heads */}
          {(expenseFilterScope === 'ALL' || expenseFilterScope === 'GENERAL') && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <Layers size={18} className="text-slate-700 dark:text-slate-300" />
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                    🌐 General Portfolio / Company Expense Heads ({generalExpenses.length})
                  </h3>
                </div>
                <button
                  onClick={() => handleOpenCreateModal('EXPENSE')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs transition cursor-pointer"
                >
                  <Plus size={13} />
                  <span>Add General Head</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {generalExpenses.map((head) => (
                  <div
                    key={head._id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300 transition flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                        <span>{head.name}</span>
                        {head.code && (
                          <span className="text-[10px] font-mono text-slate-500 bg-slate-200 dark:bg-slate-700 px-1 py-0.2 rounded">
                            {head.code}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {head.isAllowableTaxDeduction ? 'HMRC Tax Allowable' : 'Standard Expense'} &bull;{' '}
                        {head.isActive ? 'Active' : 'Inactive'}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit('CATEGORY', head)}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                        title="Edit Head"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(head)}
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        title="Deactivate Head"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: BANK & CASH LIQUIDITY ACCOUNTS                                */}
      {/* ===================================================================== */}
      {activeTab === 'LIQUIDITY' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Bank Accounts &amp; Cash-in-Hand Floats ({accounts.length})
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Live double-entry liquidity accounts denominated in GBP (£)
              </p>
            </div>
            <button
              onClick={() => handleOpenCreateModal('LIQUIDITY')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-sm cursor-pointer"
            >
              <Plus size={14} />
              <span>+ Add Bank or Cash Account</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.map((acc) => (
              <div
                key={acc._id}
                className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:border-indigo-400 transition space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                        acc.accountType === 'BANK'
                          ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600'
                          : 'bg-amber-100 dark:bg-amber-950 text-amber-600'
                      }`}
                    >
                      {acc.accountType === 'BANK' ? <Landmark size={18} /> : <Coins size={18} />}
                    </div>
                    <div>
                      <div className="font-extrabold text-sm text-slate-900 dark:text-white">{acc.name}</div>
                      <div className="text-[11px] text-slate-500 font-medium">
                        {acc.accountType === 'BANK'
                          ? `${acc.bankName || 'Bank'} · Sort: ${acc.sortCode || 'N/A'}`
                          : 'Cash Float in Hand'}
                      </div>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      acc.isActive
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {acc.isActive ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-400">Current Balance</div>
                    <div className="text-lg font-black font-display text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {formatGBP(acc.currentBalance)}
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenEdit('ACCOUNT', acc)}
                    className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 font-bold text-xs transition cursor-pointer flex items-center gap-1"
                  >
                    <Edit3 size={13} />
                    <span>Edit</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: OTHER INCOME & REVENUE HEADS                                   */}
      {/* ===================================================================== */}
      {activeTab === 'INCOME' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Income &amp; Revenue Heads ({incomeCategories.length})
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Rental invoicing and sundry non-rent income categories
              </p>
            </div>
            <button
              onClick={() => handleOpenCreateModal('INCOME')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm cursor-pointer"
            >
              <Plus size={14} />
              <span>+ Add Income Head</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {incomeCategories.map((head) => (
              <div
                key={head._id}
                className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-emerald-400 transition flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>{head.name}</span>
                    {head.code && (
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-200 dark:bg-slate-700 px-1 py-0.2 rounded">
                        {head.code}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                    {head.isRentalHead ? '★ Tenancy Rental Billing' : 'Sundry Non-Rent Receipt'}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit('CATEGORY', head)}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                    title="Edit Head"
                  >
                    <Edit3 size={13} />
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(head)}
                    className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                    title="Deactivate Head"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: MORTGAGE FACILITIES & FINANCE HEADS                            */}
      {/* ===================================================================== */}
      {activeTab === 'FINANCE' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
                Mortgage Facilities &amp; Finance Heads ({mortgages.length + financeCostCategories.length})
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Long-term secured debt liabilities, interest rates and Section 24 finance cost heads
              </p>
            </div>
            <button
              onClick={() => handleOpenCreateModal('MORTGAGE')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-sm cursor-pointer"
            >
              <Plus size={14} />
              <span>+ Add Mortgage Facility</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mortgages.map((mtg) => (
              <div
                key={mtg._id}
                className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950 text-purple-600 flex items-center justify-center font-bold">
                      <Percent size={18} />
                    </div>
                    <div>
                      <div className="font-extrabold text-sm text-slate-900 dark:text-white">
                        {mtg.lenderName} ({mtg.accountReference})
                      </div>
                      <div className="text-[11px] text-slate-500 font-medium">
                        Property: {mtg.propertyId?.name || 'Asset'} &bull; Rate: {mtg.interestRate}% ({mtg.rateType})
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                    {mtg.status}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold uppercase text-slate-400">Principal Debt</div>
                    <div className="text-lg font-black font-display text-purple-600 dark:text-purple-400 tabular-nums">
                      {formatGBP(mtg.outstandingPrincipalBalance)}
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenEdit('MORTGAGE', mtg)}
                    className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 text-slate-700 dark:text-slate-200 font-bold text-xs transition cursor-pointer flex items-center gap-1"
                  >
                    <Edit3 size={13} />
                    <span>Edit</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* UNIVERSAL CREATE MODAL                                                */}
      {/* ===================================================================== */}
      {createModalOpen && (
        <ModalPortal isOpen={createModalOpen} onClose={() => setCreateModalOpen(false)} zIndex="z-[9999]">
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600/10 border border-indigo-600/20 text-indigo-600 flex items-center justify-center font-bold">
                  <Plus size={18} />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">
                    Create New Chart of Accounts Head
                  </h2>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Configure hierarchical expense sub-head, bank account, or mortgage
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Type selector */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-slate-100 dark:bg-slate-800/60 p-1.5 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setCreateType('EXPENSE')}
                className={`py-1.5 rounded-lg font-bold transition cursor-pointer text-center ${
                  createType === 'EXPENSE'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Expense Head
              </button>
              <button
                type="button"
                onClick={() => setCreateType('LIQUIDITY')}
                className={`py-1.5 rounded-lg font-bold transition cursor-pointer text-center ${
                  createType === 'LIQUIDITY'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Bank / Cash
              </button>
              <button
                type="button"
                onClick={() => setCreateType('INCOME')}
                className={`py-1.5 rounded-lg font-bold transition cursor-pointer text-center ${
                  createType === 'INCOME'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Income Head
              </button>
              <button
                type="button"
                onClick={() => setCreateType('MORTGAGE')}
                className={`py-1.5 rounded-lg font-bold transition cursor-pointer text-center ${
                  createType === 'MORTGAGE'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Mortgage
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs font-bold flex items-center gap-2">
                <AlertCircle size={15} className="text-rose-600 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs">
              {/* 1. EXPENSE HEAD FORM */}
              {createType === 'EXPENSE' && (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Expense Head Title * (e.g. Electricity, Gas Bill, Maintenance, Repairs)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Electricity, Gas, Property Maintenance, Cleaning, Council Tax"
                      value={expenseForm.name}
                      onChange={(e) => setExpenseForm({ ...expenseForm, name: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                    />
                  </div>

                  {/* Property Main Head Linkage (Key Feature from Pak Expense Tracker) */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Building2 size={15} className="text-rose-600" />
                      <span>Property Association &bull; Scope</span>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Select Property (Optional)
                      </label>
                      <select
                        value={expenseForm.propertyId}
                        onChange={(e) => setExpenseForm({ ...expenseForm, propertyId: e.target.value, unitId: '' })}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                      >
                        <option value="">-- None (General Portfolio Level Expense) --</option>
                        {properties.map((p) => (
                          <option key={p._id} value={p._id}>
                            🏢 {p.name} ({p.postcode || p.city || 'UK'})
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Selecting a property makes this head a dedicated sub-head under that specific property.
                      </p>
                    </div>

                    {expenseForm.propertyId && currentPropertyUnits.length > 0 && (
                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Select Unit Head (Optional)
                        </label>
                        <select
                          value={expenseForm.unitId}
                          onChange={(e) => setExpenseForm({ ...expenseForm, unitId: e.target.value })}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-bold text-slate-900 dark:text-white focus:outline-none"
                        >
                          <option value="">-- Entire Property (All Units) --</option>
                          {currentPropertyUnits.map((u) => (
                            <option key={u._id} value={u._id}>
                              Unit: {u.unitName} ({u.unitType})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Main Head Hierarchy Toggle */}
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                    <label className="flex items-center gap-2 font-bold text-slate-900 dark:text-white cursor-pointer">
                      <input
                        type="checkbox"
                        checked={expenseForm.isMainHead}
                        onChange={(e) =>
                          setExpenseForm({
                            ...expenseForm,
                            isMainHead: e.target.checked,
                            parentCategoryId: e.target.checked ? '' : expenseForm.parentCategoryId,
                          })
                        }
                        className="w-4 h-4 text-rose-600 rounded cursor-pointer"
                      />
                      <span>Create this as a Main Head (e.g. "Property Utilities" or "Building Maintenance")</span>
                    </label>

                    {!expenseForm.isMainHead && mainExpenseHeads.length > 0 && (
                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Select Parent Main Head (Optional)
                        </label>
                        <select
                          value={expenseForm.parentCategoryId}
                          onChange={(e) => setExpenseForm({ ...expenseForm, parentCategoryId: e.target.value })}
                          className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 font-bold text-slate-900 dark:text-white focus:outline-none"
                        >
                          <option value="">-- No parent (top-level subhead) --</option>
                          {mainExpenseHeads.map((m) => (
                            <option key={m._id} value={m._id}>
                              📂 {m.name} {m.propertyId ? `(${m.propertyId.name})` : '(General)'}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Nominal Code
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. EXP-ELEC, EXP-GAS"
                        value={expenseForm.code}
                        onChange={(e) => setExpenseForm({ ...expenseForm, code: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 dark:text-white uppercase focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-col justify-center">
                      <label className="flex items-center gap-2 font-bold text-slate-900 dark:text-white cursor-pointer mt-4">
                        <input
                          type="checkbox"
                          checked={expenseForm.isAllowableTaxDeduction}
                          onChange={(e) =>
                            setExpenseForm({ ...expenseForm, isAllowableTaxDeduction: e.target.checked })
                          }
                          className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                        />
                        <span>HMRC Tax Allowable</span>
                      </label>
                    </div>
                  </div>
                </>
              )}

              {/* 2. BANK OR CASH ACCOUNT FORM */}
              {createType === 'LIQUIDITY' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Account Type *
                      </label>
                      <select
                        value={liquidityForm.accountType}
                        onChange={(e) => setLiquidityForm({ ...liquidityForm, accountType: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-bold text-slate-900 dark:text-white focus:outline-none"
                      >
                        <option value="BANK">Bank Account (GBP)</option>
                        <option value="CASH">Petty Cash in Hand</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Opening Balance (£)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={liquidityForm.openingBalance}
                        onChange={(e) => setLiquidityForm({ ...liquidityForm, openingBalance: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Account Display Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Barclays Current Account, Office Cash Box"
                      value={liquidityForm.name}
                      onChange={(e) => setLiquidityForm({ ...liquidityForm, name: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-bold text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>

                  {liquidityForm.accountType === 'BANK' && (
                    <>
                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Bank Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Barclays, NatWest, Lloyds, HSBC"
                          value={liquidityForm.bankName}
                          onChange={(e) => setLiquidityForm({ ...liquidityForm, bankName: e.target.value })}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Sort Code
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. 20-00-00"
                            value={liquidityForm.sortCode}
                            onChange={(e) => setLiquidityForm({ ...liquidityForm, sortCode: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-slate-900 dark:text-white focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Account Number
                          </label>
                          <input
                            type="text"
                            placeholder="8-digit account number"
                            value={liquidityForm.accountNumber}
                            onChange={(e) => setLiquidityForm({ ...liquidityForm, accountNumber: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-slate-900 dark:text-white focus:outline-none"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              {/* 3. INCOME HEAD FORM */}
              {createType === 'INCOME' && (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Income Head Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Parking & Storage Space Rental, Utility Recharge..."
                      value={incomeForm.name}
                      onChange={(e) => setIncomeForm({ ...incomeForm, name: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-bold text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Select Property (Optional)
                    </label>
                    <select
                      value={incomeForm.propertyId}
                      onChange={(e) => setIncomeForm({ ...incomeForm, propertyId: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-bold text-slate-900 dark:text-white focus:outline-none"
                    >
                      <option value="">-- General Income Head --</option>
                      {properties.map((p) => (
                        <option key={p._id} value={p._id}>
                          🏢 {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Nominal Code
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. INC-PARK"
                        value={incomeForm.code}
                        onChange={(e) => setIncomeForm({ ...incomeForm, code: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 dark:text-white uppercase focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-col justify-center">
                      <label className="flex items-center gap-2 font-bold text-slate-900 dark:text-white cursor-pointer mt-4">
                        <input
                          type="checkbox"
                          checked={incomeForm.isRentalHead}
                          onChange={(e) => setIncomeForm({ ...incomeForm, isRentalHead: e.target.checked })}
                          className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                        />
                        <span>Tenancy Rent Head</span>
                      </label>
                    </div>
                  </div>
                </>
              )}

              {/* 4. MORTGAGE FACILITY FORM */}
              {createType === 'MORTGAGE' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Lender Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Paragon, Nationwide, BM"
                        value={mortgageForm.lenderName}
                        onChange={(e) => setMortgageForm({ ...mortgageForm, lenderName: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-bold text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Account / Loan Ref *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. MTG-LON-992"
                        value={mortgageForm.accountReference}
                        onChange={(e) => setMortgageForm({ ...mortgageForm, accountReference: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Linked Secured Property *
                    </label>
                    <select
                      required
                      value={mortgageForm.propertyId}
                      onChange={(e) => setMortgageForm({ ...mortgageForm, propertyId: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-bold text-slate-900 dark:text-white focus:outline-none"
                    >
                      <option value="">-- Select Secured Asset --</option>
                      {properties.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name} ({p.postcode || 'UK'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Original Loan (£) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="e.g. 150000"
                        value={mortgageForm.originalLoanAmount}
                        onChange={(e) => setMortgageForm({ ...mortgageForm, originalLoanAmount: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Current Principal Debt (£) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="e.g. 145000"
                        value={mortgageForm.outstandingPrincipalBalance}
                        onChange={(e) =>
                          setMortgageForm({ ...mortgageForm, outstandingPrincipalBalance: e.target.value })
                        }
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Interest Rate (%) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        placeholder="e.g. 4.85"
                        value={mortgageForm.interestRate}
                        onChange={(e) => setMortgageForm({ ...mortgageForm, interestRate: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Monthly Payment (£)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="e.g. 650"
                        value={mortgageForm.monthlyPaymentAmount}
                        onChange={(e) =>
                          setMortgageForm({ ...mortgageForm, monthlyPaymentAmount: e.target.value })
                        }
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/20"
                >
                  {submitting && <RefreshCw size={13} className="animate-spin" />}
                  <span>Save to Chart of Accounts</span>
                </button>
              </div>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {/* ===================================================================== */}
      {/* EDIT MODAL                                                            */}
      {/* ===================================================================== */}
      {editingItem && (
        <ModalPortal isOpen={Boolean(editingItem)} onClose={() => setEditingItem(null)} zIndex="z-[9999]">
        <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center">
                  <Edit3 size={15} />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">
                    Edit {editingItem.type === 'CATEGORY' ? 'Nominal Head' : editingItem.type === 'ACCOUNT' ? 'Bank Account' : 'Mortgage'}
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    {editingItem.data?.name || editingItem.data?.lenderName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 text-xs font-bold flex items-center gap-2">
                <AlertCircle size={15} className="text-rose-600 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-3.5 text-xs">
              {editingItem.type === 'CATEGORY' && (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Nominal Head Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-bold text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Property Association
                    </label>
                    <select
                      value={editForm.propertyId || ''}
                      onChange={(e) => setEditForm({ ...editForm, propertyId: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-bold text-slate-900 dark:text-white focus:outline-none"
                    >
                      <option value="">-- General Portfolio Head --</option>
                      {properties.map((p) => (
                        <option key={p._id} value={p._id}>
                          🏢 {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Nominal Code
                    </label>
                    <input
                      type="text"
                      value={editForm.code}
                      onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 dark:text-white uppercase focus:outline-none"
                    />
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">HMRC Allowable Tax Deduction</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={editForm.isAllowableTaxDeduction}
                      onChange={(e) => setEditForm({ ...editForm, isAllowableTaxDeduction: e.target.checked })}
                      className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                    />
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div className="font-bold text-slate-900 dark:text-white">Active Status</div>
                    <input
                      type="checkbox"
                      checked={editForm.isActive}
                      onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                      className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                    />
                  </div>
                </>
              )}

              {editingItem.type === 'ACCOUNT' && (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Account Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-bold text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>

                  {editForm.accountType === 'BANK' && (
                    <>
                      <div>
                        <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Bank Name
                        </label>
                        <input
                          type="text"
                          value={editForm.bankName}
                          onChange={(e) => setEditForm({ ...editForm, bankName: e.target.value })}
                          className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Sort Code
                          </label>
                          <input
                            type="text"
                            value={editForm.sortCode}
                            onChange={(e) => setEditForm({ ...editForm, sortCode: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-slate-900 dark:text-white focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                            Account Number
                          </label>
                          <input
                            type="text"
                            value={editForm.accountNumber}
                            onChange={(e) => setEditForm({ ...editForm, accountNumber: e.target.value })}
                            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-slate-900 dark:text-white focus:outline-none"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <label className="block font-bold text-amber-700 dark:text-amber-400 mb-1">
                      Current Balance (£)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.currentBalance}
                      onChange={(e) => setEditForm({ ...editForm, currentBalance: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-amber-500/30 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>
                </>
              )}

              {editingItem.type === 'MORTGAGE' && (
                <>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Lender Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={editForm.lenderName}
                      onChange={(e) => setEditForm({ ...editForm, lenderName: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-bold text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Outstanding Principal (£)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editForm.outstandingPrincipalBalance}
                        onChange={(e) =>
                          setEditForm({ ...editForm, outstandingPrincipalBalance: e.target.value })
                        }
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Interest Rate (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editForm.interestRate}
                        onChange={(e) => setEditForm({ ...editForm, interestRate: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 font-mono text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-600/20"
                >
                  {submitting && <RefreshCw size={13} className="animate-spin" />}
                  <span>Save Changes</span>
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

// Quick helper to count units of a property safely
function propUnitsCount(property) {
  if (Array.isArray(property.units)) return property.units.length;
  if (typeof property.totalUnits === 'number') return property.totalUnits;
  return 0;
}

export default ChartOfAccountsPage;
