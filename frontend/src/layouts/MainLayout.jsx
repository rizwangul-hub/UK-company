import React, { useState } from 'react';
import {
  LayoutDashboard,
  Building2,
  Users,
  Receipt,
  Landmark,
  FileSpreadsheet,
  Settings,
  LogOut,
  Menu,
  X,
  CreditCard,
  Layers,
  ArrowRightLeft,
  Calendar,
  ShieldCheck,
  FileEdit,
  Code2,
  ListTree,
} from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle.jsx';
import pixxLogo from '../assets/logo.png';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'data-entry', label: 'Data Entry', icon: FileEdit, badge: 'OPS' },
  { id: 'properties', label: 'Properties & Units', icon: Building2 },
  { id: 'tenants', label: 'Tenants & Leases', icon: Users },
  { id: 'rent', label: 'Rent Invoicing', icon: Receipt },
  { id: 'mortgages', label: 'Mortgage Facilities', icon: Landmark, badge: 'UK' },
  { id: 'accounts', label: 'Bank Accounts', icon: CreditCard },
  { id: 'chart-of-accounts', label: 'Chart of Accounts', icon: ListTree, badge: 'COA' },
  { id: 'ledger', label: 'Central Ledger', icon: Layers },
  { id: 'reports', label: 'Financial Reports', icon: FileSpreadsheet },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function MainLayout({
  user,
  selectedCompany,
  onSwitchCompany,
  onOpenMasterDashboard,
  currentView,
  onViewChange,
  onLogout,
  children,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const displayLogo = selectedCompany?.logo || pixxLogo;
  const displayName = selectedCompany?.name || 'PIXX TECHNOLOGIES';
  const displayLegalName = selectedCompany?.legalName || 'UK Property Finance';

  return (
    <div className="h-screen w-full overflow-hidden bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800 sticky top-0 z-40 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center p-1 shadow-sm shrink-0 overflow-hidden">
            <img src={displayLogo} alt={displayName} className="w-full h-full object-contain" />
          </div>
          <div className="truncate">
            <span className="font-extrabold text-sm tracking-tight text-white block truncate">{displayName}</span>
            <span className="text-[10px] block text-indigo-400 font-semibold -mt-0.5 truncate">{displayLegalName}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Master Group Dashboard Button for Mobile */}
          {onOpenMasterDashboard && (
            <button
              onClick={onOpenMasterDashboard}
              className="p-2 rounded-xl text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition border border-slate-800 cursor-pointer"
              title="Open Master Group Dashboard"
            >
              <Layers className="w-4 h-4" />
            </button>
          )}
          {/* Switch Company Button for Mobile */}
          {onSwitchCompany && (
            <button
              onClick={onSwitchCompany}
              className="p-2 rounded-xl text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition border border-slate-800 cursor-pointer"
              title="Switch Company"
            >
              <ArrowRightLeft className="w-4 h-4" />
            </button>
          )}
          {/* Top Mood / Theme Change Button for Mobile */}
          <ThemeToggle showLabel={false} />
          {/* Top Right Sign Out Button for Mobile */}
          <button
            onClick={onLogout}
            className="p-2 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition border border-slate-800 cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Sidebar Navigation - Strictly Fixed & Stuck on Left Side */}
      <aside
        className={`fixed md:relative top-0 left-0 h-screen w-72 lg:w-80 bg-slate-900/95 md:bg-slate-900 border-r border-slate-800 flex flex-col z-50 shrink-0 transition-transform duration-200 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Area */}
        <div className="p-4 lg:p-5 border-b border-slate-800/80 hidden md:flex flex-col gap-2.5">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200/90 flex items-center justify-center p-1.5 shadow-md shrink-0 overflow-hidden">
              <img src={displayLogo} alt={displayName} className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <div className="font-extrabold text-sm lg:text-base tracking-tight text-white flex items-center gap-1.5 truncate">
                <span>{displayName}</span>
              </div>
              <div className="text-[11px] text-indigo-400 font-semibold tracking-wider uppercase truncate">
                {displayLegalName}
              </div>
            </div>
          </div>

          {/* Quick Actions: Master Group & Switch Company */}
          <div className="grid grid-cols-2 gap-1.5 mt-1">
            {onOpenMasterDashboard && (
              <button
                onClick={onOpenMasterDashboard}
                className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 hover:text-white border border-emerald-500/30 text-[11px] font-bold transition shadow-xs cursor-pointer truncate"
                title="Open Master Consolidated Dashboard (All 6 Companies)"
              >
                <Layers className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">Master Group</span>
              </button>
            )}
            {onSwitchCompany && (
              <button
                onClick={onSwitchCompany}
                className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 hover:text-white border border-indigo-500/25 text-[11px] font-bold transition shadow-xs cursor-pointer truncate"
                title="Return to Company Selection screen"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="truncate">Switch Entity</span>
              </button>
            )}
          </div>
        </div>

        {/* Currency & Operator Card */}
        <div className="mx-3.5 my-3.5 p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
              <ShieldCheck className="w-4.5 h-4.5" />
            </div>
            <div className="truncate">
              <div className="text-sm font-semibold text-slate-100 truncate">{user?.name || 'Operator'}</div>
              <div className="text-xs text-slate-400 truncate">{user?.email}</div>
            </div>
          </div>
          <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
            GBP £
          </span>
        </div>

        {/* Navigation Links with Enlarged Heights and Widths */}
        <nav className="flex-1 px-3.5 py-2 space-y-2 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onViewChange(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`group w-full flex items-center justify-between px-3.5 py-3 rounded-2xl min-h-[52px] text-sm font-semibold transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-600/25 border border-indigo-400/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80 border border-transparent hover:border-slate-800'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                      isActive
                        ? 'bg-white/20 text-white shadow-sm'
                        : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 group-hover:bg-indigo-500/20 group-hover:text-indigo-300 group-hover:border-indigo-500/40'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="tracking-tight">{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${
                      isActive
                        ? 'bg-white/20 text-white border border-white/30'
                        : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Software Developer Credits on Left Side of Sidebar */}
        <div className="p-3.5 border-t border-slate-800/80 mt-auto">
          <div className="p-3 rounded-2xl developer-credit-card bg-slate-100 dark:bg-gradient-to-br dark:from-slate-950 dark:via-indigo-950/20 dark:to-slate-950 border border-slate-200 dark:border-indigo-500/20 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 shadow-sm">
              <Code2 className="w-5 h-5" />
            </div>
            <div className="truncate min-w-0">
              <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                Software Developer
              </div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
                Rizwan Ullah
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">
                PIXX Technologies UK
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-950 overflow-y-auto">
        {/* Top Header Bar for Desktop with Company Brand, Switch Company, Mood Change & Sign Out */}
        <header className="hidden md:flex items-center justify-between px-6 py-2.5 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-white border border-slate-200/80 flex items-center justify-center p-1 shadow-xs overflow-hidden">
              <img src={displayLogo} alt={displayName} className="h-full w-full object-contain" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-indigo-400">
                {NAV_ITEMS.find((item) => item.id === currentView)?.label || 'System Portal'}
              </span>
              <span className="text-slate-600">/</span>
              <span className="text-xs font-extrabold text-white">
                {displayName}
              </span>
              {selectedCompany?.legalName && (
                <>
                  <span className="text-slate-600 hidden xl:inline">/</span>
                  <span className="text-xs font-medium text-slate-400 hidden xl:inline">
                    {displayLegalName}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Switch Company Action Button */}
            {onSwitchCompany && (
              <button
                onClick={onSwitchCompany}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-300 hover:text-white bg-indigo-500/15 hover:bg-indigo-600/30 border border-indigo-500/30 hover:border-indigo-500/50 transition shadow-sm cursor-pointer"
                title="Return to Company Selection screen"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden lg:inline">Switch Company</span>
              </button>
            )}

            {/* Top Mood / Theme Change Button */}
            <ThemeToggle />

            {/* Currency & Live Status Badge */}
            <div className="flex items-center gap-2 pl-3 border-l border-slate-800 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-medium text-slate-300">GBP (£) System</span>
            </div>

            {/* Top Right Sign Out Button */}
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-rose-300 bg-slate-800/80 hover:bg-rose-950/40 border border-slate-700/80 hover:border-rose-500/40 transition shadow-sm cursor-pointer ml-1"
              title="Sign Out of PIXX UK"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}

export default MainLayout;
