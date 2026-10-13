import React, { useState } from 'react';
import {
  Building2,
  ArrowRight,
  ShieldCheck,
  LogOut,
  Search,
  CheckCircle2,
  TrendingUp,
  Landmark,
  Layers,
  Sparkles,
} from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle.jsx';
import pixxLogo from '../assets/logo.png';
import { COMPANIES } from '../config/companies.js';

export function CompanySelectionPage({ user, onSelectCompany, onLogout, onSelectMasterGroup }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [imgErrors, setImgErrors] = useState({});

  const handleImageError = (companyId) => {
    setImgErrors((prev) => ({ ...prev, [companyId]: true }));
  };

  const filteredCompanies = COMPANIES.filter((company) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      company.name.toLowerCase().includes(q) ||
      company.legalName.toLowerCase().includes(q) ||
      company.tagline.toLowerCase().includes(q) ||
      company.registrationNo.toLowerCase().includes(q)
    );
  });

  return (
    <div className="h-screen h-[100dvh] max-h-[100dvh] overflow-hidden bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="h-10 w-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center p-1.5 shadow-md shrink-0">
            <img src={pixxLogo} alt="Pixx Technologies UK" className="h-full w-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-sm sm:text-base tracking-tight text-white">
                PIXX TECHNOLOGIES
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                UK Multi-Company
              </span>
            </div>
            <p className="text-[11px] text-indigo-400 font-semibold -mt-0.5">
              Executive Property Finance &amp; Portfolio Management
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Master Group Action in Header */}
          {onSelectMasterGroup && (
            <button
              onClick={onSelectMasterGroup}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition shadow-sm cursor-pointer"
              title="Open Consolidated Master Dashboard"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Master Group View</span>
            </button>
          )}

          {/* Theme Toggle Button */}
          <ThemeToggle />

          {/* Operator Badge */}
          <div className="hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800 text-xs">
            <div className="w-6 h-6 rounded-lg bg-indigo-500/15 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <div className="text-left">
              <div className="text-slate-200 font-bold leading-tight">{user?.name || 'Administrator'}</div>
              <div className="text-[10px] text-slate-400">{user?.email}</div>
            </div>
          </div>

          {/* Sign Out Button */}
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-600/30 border border-rose-500/20 hover:border-rose-500/40 transition shadow-sm cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content Hub */}
      <main className="flex-1 min-h-0 overflow-y-auto max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col justify-between pb-page-safe">
        <div className="space-y-6 sm:space-y-8">
          {/* Master Consolidated Dashboard Action Banner */}
          {onSelectMasterGroup && (
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-indigo-950/60 border border-emerald-500/30 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-md">
                  <Layers className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-black text-white">
                      Master Group Portfolio Dashboard
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      ALL 6 ENTITIES
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Consolidated view across 48 properties, £99.8k/mo rent roll, and single-click master Excel (.xlsx) &amp; attractive PDF report downloads.
                  </p>
                </div>
              </div>
              <button
                onClick={onSelectMasterGroup}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-600/25 transition cursor-pointer shrink-0 w-full sm:w-auto justify-center"
              >
                <span>Open Master Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Hero Banner */}
          <div className="text-center max-w-3xl mx-auto pt-2 space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-xs font-bold text-indigo-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Six UK Corporate Entities Available</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
              Select Company to Manage
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
              Choose an authorized corporate entity below to access its real-time property valuations,
              mortgage liabilities, rent schedules, and central accounting ledgers.
            </p>

            {/* Quick Search Bar */}
            <div className="pt-2 max-w-md mx-auto">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by company name, entity, or registration..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition shadow-inner"
                />
              </div>
            </div>
          </div>

          {/* 6 Company Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 pt-2">
            {filteredCompanies.map((company) => {
              const hasImgError = imgErrors[company.id];

              return (
                <div
                  key={company.id}
                  onClick={() => onSelectCompany(company)}
                  className="group relative bg-slate-900/90 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-5 sm:p-6 transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-600/15 flex flex-col justify-between cursor-pointer overflow-hidden transform hover:-translate-y-1"
                >
                  {/* Subtle Top Accent Strip */}
                  <div
                    className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                  />

                  {/* Top Section: Logo & Badge */}
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-4">
                      {/* Logo Container */}
                      <div className="w-full h-24 sm:h-28 rounded-xl bg-white border border-slate-200/90 flex items-center justify-center p-3 shadow-sm group-hover:shadow-md transition-shadow overflow-hidden">
                        {!hasImgError && company.logo ? (
                          <img
                            src={company.logo}
                            alt={`${company.name} Logo`}
                            onError={() => handleImageError(company.id)}
                            className="max-h-full max-w-full object-contain filter group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          /* Clean Fallback Placeholder */
                          <div className="flex flex-col items-center justify-center text-center p-2">
                            <Building2 className="w-8 h-8 text-indigo-600 mb-1" />
                            <span className="font-extrabold text-xs text-slate-900 tracking-tight">
                              {company.name}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Company Titles */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="text-lg font-black text-white group-hover:text-indigo-300 transition-colors tracking-tight">
                          {company.name}
                        </h2>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700/80 shrink-0">
                          GBP (£)
                        </span>
                      </div>
                      <div className="text-xs font-bold text-indigo-400">
                        {company.legalName}
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed pt-1">
                        {company.description}
                      </p>
                    </div>

                    {/* Entity Details Strip */}
                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{company.jurisdiction}</span>
                      </div>
                      <div className="font-mono text-slate-500 font-medium">
                        {company.registrationNo}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Action Button */}
                  <div className="mt-5 pt-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectCompany(company);
                      }}
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-800/80 group-hover:bg-gradient-to-r group-hover:from-indigo-600 group-hover:to-indigo-500 text-slate-200 group-hover:text-white font-bold text-xs sm:text-sm border border-slate-700 group-hover:border-indigo-400/40 shadow-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Open Dashboard</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Empty search state */}
          {filteredCompanies.length === 0 && (
            <div className="py-12 text-center border-2 border-dashed border-slate-800 rounded-2xl p-8 max-w-md mx-auto">
              <Building2 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-bold text-white mb-1">No Company Matches</h3>
              <p className="text-xs text-slate-400 mb-4">
                No registered UK company matched "{searchTerm}".
              </p>
              <button
                onClick={() => setSearchTerm('')}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition cursor-pointer"
              >
                Clear Search Filter
              </button>
            </div>
          )}
        </div>

        {/* Footer info note */}
        <footer className="mt-12 pt-6 border-t border-slate-800/80 text-center text-xs text-slate-500 space-y-1">
          <div>
            PIXX Technologies UK Property Finance • Multi-Entity System
          </div>
          <div className="text-[11px] text-slate-600">
            Phase 1: Company Selection &amp; Dedicated Entity Dashboards
          </div>
        </footer>
      </main>
    </div>
  );
}

export default CompanySelectionPage;
