import React, { useEffect, useRef, useState } from 'react';
import { Building2, LayoutDashboard, Users, Receipt, Landmark, CreditCard, Layers, FileSpreadsheet, FileUp, FileEdit, ListTree, TrendingUp, Sparkles, Settings, Trash2, Search, Menu, X, ArrowRightLeft, ArrowUpRight, ChevronRight, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle.jsx';
import { BackToPortalButton } from '../components/BackToPortalButton.jsx';
import pixxLogo from '../assets/logo.png';
const GROUPS = [
  { label: 'Overview', items: [['dashboard', 'Dashboard', LayoutDashboard], ['profit-loss', 'Profit & loss', TrendingUp]] },
  { label: 'Property management', items: [['properties', 'Properties & units', Building2], ['tenants', 'Tenants & leases', Users], ['rent', 'Rent collection', Receipt], ['appliances', 'Appliances & care', Sparkles]] },
  { label: 'Finance & accounting', items: [['data-entry', 'Record a transaction', FileEdit], ['accounts', 'Bank accounts', CreditCard], ['statement-import', 'Statement imports', FileUp], ['mortgages', 'Mortgages', Landmark], ['ledger', 'Transaction ledger', Layers], ['chart-of-accounts', 'Chart of accounts', ListTree], ['reports', 'Reports & exports', FileSpreadsheet]] },
  { label: 'Workspace', items: [['recycle-bin', 'Recycle bin', Trash2], ['settings', 'Settings', Settings]] },
];
const HELP = { dashboard: 'Your properties, cash flow and priorities in one place.', 'profit-loss': 'Understand income, expenses and portfolio performance.', properties: 'Manage buildings, lettable units and property compliance.', tenants: 'Manage people, leases and essential documents.', rent: 'Keep payments, due dates and arrears in view.', appliances: 'Track appliances, warranties and maintenance.', 'data-entry': 'Record income, expenses and transfers.', accounts: 'Manage company bank and cash accounts.', 'statement-import': 'Import, review and reconcile bank activity.', mortgages: 'Track lending and mortgage repayments.', ledger: 'Review the detail behind every transaction.', 'chart-of-accounts': 'Organise your financial categories.', reports: 'Turn company records into clear, shareable reports.', 'recycle-bin': 'Review and restore removed records.', settings: 'Manage preferences and notifications.' };
export function MainLayout({ user, selectedCompany, onSwitchCompany, onOpenMasterDashboard, currentView, onViewChange, onLogout, children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('pixx_sidebar_collapsed') === 'true'; } catch { return false; } });
  const [query, setQuery] = useState('');
  const sidebarRef = useRef(null);
  const mainRef = useRef(null);
  useEffect(() => { const toggle = () => setCollapsed(value => !value); window.addEventListener('pixx:toggle-sidebar', toggle); return () => window.removeEventListener('pixx:toggle-sidebar', toggle); }, []);
  useEffect(() => {
    try { localStorage.setItem('pixx_sidebar_collapsed', String(collapsed)); } catch { /* Optional preference */ }
    window.dispatchEvent(new CustomEvent('pixx:sidebar-changed', { detail: collapsed }));
  }, [collapsed]);
  useEffect(() => { mainRef.current?.scrollTo(0, 0); }, [currentView]);
  useEffect(() => {
    if (!mobileOpen) return;
    const previousFocus = document.activeElement;
    sidebarRef.current?.querySelector('button')?.focus();
    const handleKey = event => {
      if (event.key === 'Escape') setMobileOpen(false);
      if (event.key !== 'Tab') return;
      const controls = Array.from(sidebarRef.current?.querySelectorAll('button:not(:disabled), input, [tabindex="0"]') || [])
        .filter(element => element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const handleResize = () => { if (window.innerWidth >= 768) setMobileOpen(false); };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', handleResize);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [mobileOpen]);
  const active = GROUPS.flatMap(group => group.items).find(item => item[0] === currentView);
  const navigate = id => { onViewChange(id); setMobileOpen(false); setQuery(''); };
  return <div className={`workspace-shell ${collapsed ? 'is-collapsed' : ''}`}>
    {mobileOpen && <button className="workspace-backdrop" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
    <aside ref={sidebarRef} id="workspace-navigation" className={`workspace-sidebar ${mobileOpen ? 'is-open' : ''}`} aria-label="Main navigation" role={mobileOpen ? 'dialog' : undefined} aria-modal={mobileOpen || undefined}>
      <div className="workspace-brand"><span className="workspace-brand-icon"><Building2 size={23} /></span><div><strong>PIXX <span>PROPERTY</span></strong><small>UK portfolio workspace</small></div><button className="workspace-mobile-close" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X size={20} /></button></div>
      <button className="workspace-company" onClick={onSwitchCompany} disabled={!onSwitchCompany} title="Switch company"><img src={selectedCompany?.logo || pixxLogo} alt="" /><span><small>ACTIVE COMPANY</small><strong>{selectedCompany?.name || 'UK Property Finance'}</strong></span><ArrowRightLeft size={15} /></button>
      <label className="workspace-nav-search"><Search size={15} /><input aria-label="Find a page" placeholder="Find a page…" value={query} onChange={event => setQuery(event.target.value)} /></label>
      <nav className="workspace-nav">{GROUPS.map(group => { const items = group.items.filter(item => item[1].toLowerCase().includes(query.toLowerCase())); return items.length > 0 && <div className="workspace-nav-group" key={group.label}><p>{group.label}</p>{items.map(([id, label, Icon]) => <button key={id} onClick={() => navigate(id)} className={currentView === id ? 'is-active' : ''} aria-current={currentView === id ? 'page' : undefined}><Icon size={18} /><span>{label}</span>{currentView === id && <ChevronRight size={14} />}</button>)}</div>; })}{!GROUPS.some(group => group.items.some(item => item[1].toLowerCase().includes(query.toLowerCase()))) && <p className="workspace-no-results">No pages found. Try rent or reports.</p>}</nav>
      <div className="workspace-sidebar-bottom">{onOpenMasterDashboard && <button className="workspace-group-link" onClick={onOpenMasterDashboard}><Layers size={18} /><span>Group portfolio<small>View all companies</small></span><ArrowUpRight size={16} /></button>}<div className="workspace-profile"><span className="workspace-avatar">{(user?.name || 'A').slice(0, 1).toUpperCase()}</span><span><strong>{user?.name || 'Administrator'}</strong><small>{user?.email || 'Portfolio manager'}</small></span><button onClick={onLogout} aria-label="Sign out" title="Sign out"><LogOut size={17} /></button></div></div>
    </aside>
    <div className="workspace-body" inert={mobileOpen || undefined}><header className="workspace-topbar"><div className="workspace-breadcrumb"><button className="workspace-desktop-toggle" onClick={() => setCollapsed(value => !value)} aria-label={collapsed ? 'Show sidebar' : 'Hide sidebar'}>{collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}</button><button className="workspace-mobile-toggle" onClick={() => setMobileOpen(true)} aria-label="Open navigation" aria-expanded={mobileOpen} aria-controls="workspace-navigation"><Menu size={21} /></button><span>Workspace</span><ChevronRight size={13} /><strong>{active?.[1] || 'Dashboard'}</strong></div><div className="workspace-top-actions"><span className="workspace-currency">GBP · United Kingdom</span><ThemeToggle showLabel={false} /><BackToPortalButton label="Portal" /></div></header>
    <main ref={mainRef} className="workspace-main" id="workspace-content" key={selectedCompany?.id || 'workspace'}><div className="workspace-page-intro"><div><span className="workspace-eyebrow">{selectedCompany?.name || 'YOUR WORKSPACE'}</span><h1>{active?.[1] || 'Dashboard'}</h1><p>{HELP[currentView]}</p></div><button className="workspace-primary-action" onClick={() => navigate(currentView === 'data-entry' ? 'ledger' : 'data-entry')}>{currentView === 'data-entry' ? 'View transactions' : 'Record transaction'}<ArrowUpRight size={16} /></button></div><div className="workspace-content">{children}</div><footer className="workspace-footer"><span>PIXX Property · UK portfolio management</span><span>{selectedCompany?.legalName || 'Property finance workspace'}</span></footer></main></div>
  </div>;
}
