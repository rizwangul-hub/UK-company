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
  Sparkles,
  Trash2,
  FileUp,
  TrendingUp,
  Eye,
  EyeOff,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle.jsx';
import { BackToPortalButton } from '../components/BackToPortalButton.jsx';
import { useNavigation } from '../context/NavigationContext.jsx';
import pixxLogo from '../assets/logo.png';
import { getPageAnimationClass } from '../utils/pageAnimations.js';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'profit-loss', label: 'Profit & Loss', icon: TrendingUp, badge: 'P&L' },
  { id: 'data-entry', label: 'Data Entry', icon: FileEdit, badge: 'OPS' },
  { id: 'properties', label: 'Properties', icon: Building2 },
  { id: 'appliances', label: 'Appliances & Valet', icon: Sparkles, badge: 'CARE' },
  { id: 'tenants', label: 'Tenants & Leases', icon: Users },
  { id: 'rent', label: 'Rent Invoicing', icon: Receipt },
  { id: 'mortgages', label: 'Mortgage Facilities', icon: Landmark, badge: 'UK' },
  { id: 'accounts', label: 'Bank Accounts', icon: CreditCard },
  { id: 'statement-import', label: 'Bank Statement Import', icon: FileUp, badge: 'IMPORT' },
  { id: 'chart-of-accounts', label: 'Chart of Accounts', icon: ListTree, badge: 'COA' },
  { id: 'ledger', label: 'Central Ledger', icon: Layers },
  { id: 'reports', label: 'Financial Reports', icon: FileSpreadsheet },
  { id: 'recycle-bin', label: 'Recycle Bin', icon: Trash2, badge: 'VOID' },
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
  const {
    sidebarHidden,
    navbarHidden,
    isAllNavHidden,
    toggleSidebar,
    toggleNavbar,
    toggleAllNav,
  } = useNavigation();

  const displayLogo = selectedCompany?.logo || pixxLogo;
  const displayName = selectedCompany?.name || 'PIXX TECHNOLOGIES';
  const displayLegalName = selectedCompany?.legalName || 'UK Property Finance';
  const adminName = user?.name || 'Fahad';
  const adminEmail = user?.email || 'fahad@gmail.com';

  return (
    <div className="h-screen h-[100dvh] max-h-[100dvh] w-full overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col md:flex-row relative">
      {/* Floating Restore Controls when Navbar or Sidebar is Hidden */}
      {(navbarHidden || sidebarHidden) && (
        <div className="fixed top-3 right-4 z-50 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          {navbarHidden && (
            <button
              onClick={toggleNavbar}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-600/95 hover:bg-indigo-600 text-white text-xs font-bold shadow-xl shadow-indigo-600/30 backdrop-blur-md transition-all border border-indigo-400/40 cursor-pointer hover:scale-105 active:scale-95"
              title="Click to show Navbar"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Show Navbar</span>
            </button>
          )}
          {sidebarHidden && (
            <button
              onClick={toggleSidebar}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 hover:bg-slate-800 text-white dark:bg-slate-800/90 dark:hover:bg-slate-700 text-xs font-bold shadow-xl shadow-black/30 backdrop-blur-md transition-all border border-slate-700/60 cursor-pointer hover:scale-105 active:scale-95"
              title="Click to show Sidebar"
            >
              <PanelLeftOpen className="w-3.5 h-3.5 text-indigo-400" />
              <span>Show Sidebar</span>
            </button>
          )}
        </div>
      )}

      {/* Mobile Drawer Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden transition-opacity duration-200"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close navigation menu"
        />
      )}

      {/* Mobile Top Header - Displays Company Brand & Admin Info on Top */}
      <div className={`md:hidden ${navbarHidden ? 'hidden' : 'flex'} items-center justify-between px-3.5 py-2.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 shrink-0`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="animated-logo-box w-12 h-12 rounded-2xl bg-white border-2 border-indigo-500/40 flex items-center justify-center p-1 shadow-md shrink-0">
            <img src={displayLogo} alt={displayName} className="w-full h-full object-contain" />
          </div>
          <div className="truncate min-w-0">
            <span className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white block truncate">
              {displayName}
            </span>
            {/* Admin Name & Email in Mobile Top Header */}
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 truncate">
              <span className="font-bold text-indigo-600 dark:text-indigo-400 truncate">{adminName}</span>
              <span>·</span>
              <span className="truncate">{adminEmail}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Back to Central Portal Button for Mobile */}
          <BackToPortalButton label="← Portal" className="px-2 py-1 text-[11px]" />

          {/* Master Group Dashboard Button for Mobile */}
          {onOpenMasterDashboard && (
            <button
              onClick={onOpenMasterDashboard}
              className="p-2 rounded-xl text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-500/10 transition border border-slate-200 dark:border-slate-800 cursor-pointer"
              title="Open Master Group Dashboard"
            >
              <Layers className="w-4 h-4" />
            </button>
          )}

          {/* Switch Company Button for Mobile */}
          {onSwitchCompany && (
            <button
              onClick={onSwitchCompany}
              className="p-2 rounded-xl text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:bg-indigo-500/10 transition border border-slate-200 dark:border-slate-800 cursor-pointer"
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
            className="p-2 rounded-xl text-rose-500 dark:text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-500/10 transition border border-slate-200 dark:border-slate-800 cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>

          {/* Mobile Menu Hamburger Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Sidebar Navigation - Pure White in Light Mode, Dark Slate in Dark Mode */}
      <aside
        className={`sidebar-layout fixed md:relative top-0 left-0 bottom-0 md:bottom-auto h-screen h-[100dvh] max-h-[100dvh] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-50 shrink-0 transition-all duration-300 ease-in-out shadow-2xl md:shadow-none ${
          sidebarHidden
            ? 'w-0 max-w-0 -translate-x-full md:w-0 md:max-w-0 md:-translate-x-full opacity-0 pointer-events-none p-0 m-0 border-0 overflow-hidden'
            : `w-72 lg:w-80 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`
        }`}
      >
        {/* Mobile Drawer Header with Close Button */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="animated-logo-box w-14 h-14 rounded-2xl bg-white border-2 border-indigo-500/40 flex items-center justify-center p-1.5 shadow-md shrink-0">
              <img src={displayLogo} alt={displayName} className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <div className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white truncate">
                {displayName}
              </div>
              <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold tracking-wider uppercase truncate">
                {displayLegalName}
              </div>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
            title="Close Menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Brand Area for Desktop */}
        <div className="p-4 lg:p-5 border-b border-slate-200 dark:border-slate-800/80 hidden md:flex flex-col gap-2.5 shrink-0 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3.5">
            <div className="animated-logo-box w-16 h-16 rounded-2xl bg-white border-2 border-indigo-500/40 flex items-center justify-center p-1.5 shadow-lg shrink-0">
              <img src={displayLogo} alt={displayName} className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <div className="font-extrabold text-sm lg:text-base tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                <span>{displayName}</span>
              </div>
              <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold tracking-wider uppercase truncate">
                {displayLegalName}
              </div>
            </div>
          </div>

          {/* Quick Actions: Master Group & Switch Company */}
          <div className="grid grid-cols-2 gap-1.5 mt-1">
            {onOpenMasterDashboard && (
              <button
                onClick={onOpenMasterDashboard}
                className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 text-[11px] font-bold transition shadow-xs cursor-pointer truncate"
                title="Open Master Consolidated Dashboard (All 6 Companies)"
              >
                <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate">Master Group</span>
              </button>
            )}
            {onSwitchCompany && (
              <button
                onClick={onSwitchCompany}
                className="flex items-center justify-center gap-1 px-2 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/25 text-[11px] font-bold transition shadow-xs cursor-pointer truncate"
                title="Return to Company Selection screen"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="truncate">Switch Entity</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Actions for Mobile in Drawer */}
        {(onOpenMasterDashboard || onSwitchCompany) && (
          <div className="grid grid-cols-2 gap-2 p-3 border-b border-slate-200 dark:border-slate-800/80 md:hidden shrink-0 bg-white dark:bg-slate-900">
            {onOpenMasterDashboard && (
              <button
                onClick={() => {
                  onOpenMasterDashboard();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 text-xs font-bold transition shadow-xs cursor-pointer truncate"
              >
                <Layers className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="truncate">Master Group</span>
              </button>
            )}
            {onSwitchCompany && (
              <button
                onClick={() => {
                  onSwitchCompany();
                  setMobileMenuOpen(false);
                }}
                className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/25 text-xs font-bold transition shadow-xs cursor-pointer truncate"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <span className="truncate">Switch Entity</span>
              </button>
            )}
          </div>
        )}

        {/* Scrollable Navigation Links */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col justify-between py-2">
          <nav className="px-3.5 space-y-1.5">
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
                  className={`group w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl min-h-[46px] text-sm font-semibold transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-600/25 border border-indigo-400/30'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8.5 h-8.5 rounded-xl flex items-center justify-center transition-all shrink-0 ${
                        isActive
                          ? 'bg-white/20 text-white shadow-sm'
                          : 'bg-indigo-50 text-indigo-600 border border-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-500/20 group-hover:text-indigo-700 dark:group-hover:text-indigo-300'
                      }`}
                    >
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <span className="tracking-tight">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${
                        isActive
                          ? 'bg-white/20 text-white border border-white/30'
                          : 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Software Developer Credits - Bottom of Sidebar */}
          <div className="p-3.5 border-t border-slate-200 dark:border-slate-800/80 mt-auto shrink-0 pb-mobile-safe">
            <div className="p-3 rounded-2xl developer-credit-card flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl developer-icon flex items-center justify-center shrink-0 shadow-sm">
                <Code2 className="w-5 h-5" />
              </div>
              <div className="truncate min-w-0">
                <div className="text-[11px] font-bold developer-title uppercase tracking-wider">
                  Software Developer
                </div>
                <div className="text-sm font-extrabold developer-name tracking-tight truncate">
                  Rizwan Ullah
                </div>
                <div className="text-[10px] developer-org font-medium truncate">
                  PIXX Technologies UK
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-950 overflow-y-auto overflow-x-hidden">
        {/* Top Header Bar for Desktop - Displays Company Brand, Admin Name & Email, Actions, Theme Toggle, Sign Out */}
        <header className={`${navbarHidden ? 'hidden' : 'hidden md:flex'} items-center justify-between px-4 lg:px-6 py-2.5 bg-white/95 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 transition-all duration-200`}>
          <div className="flex items-center gap-3">
            {/* Desktop Sidebar Toggle Button */}
            <button
              onClick={toggleSidebar}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-800 transition border border-slate-200 dark:border-slate-700/80 cursor-pointer shadow-xs"
              title={sidebarHidden ? "Show Sidebar Navigation" : "Hide Sidebar Navigation"}
            >
              {sidebarHidden ? (
                <>
                  <PanelLeftOpen className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="hidden xl:inline">Show Sidebar</span>
                </>
              ) : (
                <>
                  <PanelLeftClose className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden xl:inline">Hide Sidebar</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                {NAV_ITEMS.find((item) => item.id === currentView)?.label || 'System Portal'}
              </span>
              <span className="text-slate-400 dark:text-slate-600">/</span>
              <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                {displayName}
              </span>
              {selectedCompany?.legalName && (
                <>
                  <span className="text-slate-400 dark:text-slate-600 hidden xl:inline">/</span>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 hidden xl:inline">
                    {displayLegalName}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Back to Central Portal Button */}
            <BackToPortalButton />

            {/* Hide Navbar Toggle Button */}
            <button
              onClick={toggleNavbar}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-100 dark:bg-slate-800/80 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-slate-700/80 hover:border-indigo-300 dark:hover:border-indigo-500/40 transition shadow-xs cursor-pointer"
              title="Hide Top Navbar (Click floating button anytime to show again)"
            >
              <EyeOff className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span className="hidden lg:inline">Hide Navbar</span>
            </button>

            {/* Admin Profile Pill on Top Header */}
            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/25">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0 text-left">
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate leading-tight">
                  {adminName}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate leading-tight">
                  {adminEmail}
                </div>
              </div>
            </div>

            {/* Switch Company Action Button */}
            {onSwitchCompany && (
              <button
                onClick={onSwitchCompany}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 dark:hover:text-white bg-indigo-50 dark:bg-indigo-500/15 hover:bg-indigo-100 dark:hover:bg-indigo-600/30 border border-indigo-200 dark:border-indigo-500/30 transition shadow-sm cursor-pointer"
                title="Return to Company Selection screen"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span className="hidden lg:inline">Switch Company</span>
              </button>
            )}

            {/* Top Mood / Theme Change Button */}
            <ThemeToggle />

            {/* Currency & Live Status Badge */}
            <div className="flex items-center gap-2 pl-3 border-l border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-slate-700 dark:text-slate-300">GBP (£) System</span>
            </div>

            {/* Top Right Sign Out Button */}
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-300 bg-slate-100 dark:bg-slate-800/80 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-slate-200 dark:border-slate-700/80 hover:border-rose-300 dark:hover:border-rose-500/40 transition shadow-sm cursor-pointer ml-1"
              title="Sign Out of PIXX UK"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        {/* Dynamic Page Content with View-Specific 3D Animations */}
        <div className="flex-1 pb-page-safe flex flex-col justify-between book-page-perspective">
          <div key={currentView} className={`${getPageAnimationClass(currentView)} min-h-full flex flex-col justify-between flex-1`}>
            <div>{children}</div>

            {/* Standard Footer for Mobile & Responsive Screens */}
            <footer className="mt-8 mb-2 py-3 px-4 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 flex-wrap text-center">
              <span>Software Developer:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">Rizwan Ullah</span>
              <span className="text-slate-300 dark:text-slate-700">·</span>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">PIXX Technologies UK</span>
            </footer>
          </div>
        </div>
      </main>
    </div>
  );
}

export default MainLayout;
