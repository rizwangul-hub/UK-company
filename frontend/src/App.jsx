import React, { useState, useEffect, useCallback } from 'react';
import { MainLayout } from './layouts/MainLayout.jsx';
import { LoginForm } from './components/LoginForm.jsx';
import { SplashScreen } from './components/SplashScreen.jsx';
import { CompanySelectionPage } from './pages/CompanySelectionPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { PropertiesPage } from './pages/PropertiesPage.jsx';
import { AppliancesPage } from './pages/AppliancesPage.jsx';
import { TenantsPage } from './pages/TenantsPage.jsx';
import { RentManagerPage } from './pages/RentManagerPage.jsx';
import { MortgagesPage } from './pages/MortgagesPage.jsx';
import { AccountsPage } from './pages/AccountsPage.jsx';
import { LedgerPage } from './pages/LedgerPage.jsx';
import { ReportsPage } from './pages/ReportsPage.jsx';
import { SettingsPage } from './pages/SettingsPage.jsx';
import { DataEntryPage } from './pages/DataEntryPage.jsx';
import { ChartOfAccountsPage } from './pages/ChartOfAccountsPage.jsx';
import { GroupPortfolioDashboard } from './pages/GroupPortfolioDashboard.jsx';
import { RecycleBinPage } from './pages/RecycleBinPage.jsx';
import { StatementImportPage } from './pages/StatementImportPage.jsx';
import { ProfitLossPage } from './pages/ProfitLossPage.jsx';
import { authAPI, clearApiCache } from './services/api.js';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { NavigationProvider } from './context/NavigationContext.jsx';
import { PWAInstallBanner } from './components/PWAInstallBanner.jsx';
import { COMPANIES, getCompanyBySlug } from './config/companies.js';

// Synchronous initial state helpers for 0ms initial render
const getInitialAuthState = () => {
  try {
    const token = localStorage.getItem('token');
    const cachedUser = localStorage.getItem('user');
    if (token && cachedUser) {
      return JSON.parse(cachedUser);
    }
  } catch (e) {
    // Ignore parse error
  }
  return null;
};

const getInitialCompanyState = () => {
  if (typeof window === 'undefined') return null;
  const path = window.location.pathname;
  if (path.startsWith('/company/')) {
    const slug = path.replace(/^\/company\//, '').split('/')[0];
    return getCompanyBySlug(slug) || null;
  }
  const cachedCompanySlug = localStorage.getItem('selected_company');
  if (cachedCompanySlug) {
    return getCompanyBySlug(cachedCompanySlug) || null;
  }
  return null;
};

const getInitialViewState = () => {
  if (typeof window === 'undefined') return 'dashboard';
  const path = window.location.pathname;
  if (path.startsWith('/company/')) {
    const parts = path.replace(/^\/company\//, '').split('/');
    const rawView = parts[1] || 'dashboard';
    if (rawView.startsWith('statement-impor') || rawView === 'import' || rawView === 'bank-statement-import') {
      return 'statement-import';
    }
    return rawView;
  }
  return 'dashboard';
};

const getInitialMasterDashboardState = () => {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname;
  return path === '/master-dashboard' || path === '/group-portfolio';
};

export function App() {
  const [user, setUser] = useState(getInitialAuthState);
  const [selectedCompany, setSelectedCompany] = useState(getInitialCompanyState);
  const [currentView, setCurrentView] = useState(getInitialViewState);
  const [isMasterDashboard, setIsMasterDashboard] = useState(getInitialMasterDashboardState);
  // Logged-in users load directly without artificial splash delay
  const [showSplash, setShowSplash] = useState(() => !getInitialAuthState());
  const [isFading, setIsFading] = useState(false);
  const [splashError, setSplashError] = useState(null);

  // Helper to push browser URL without full reload
  const navigate = useCallback((path, replace = false) => {
    if (window.location.pathname !== path) {
      if (replace) {
        window.history.replaceState({}, '', path);
      } else {
        window.history.pushState({}, '', path);
      }
    }
  }, []);

  // Synchronize route pathname with application state
  const syncRouteWithState = useCallback((currentUser) => {
    if (!currentUser) {
      setSelectedCompany(null);
      return;
    }

    const path = window.location.pathname;

    // Master Consolidated Dashboard route
    if (path === '/master-dashboard' || path === '/group-portfolio') {
      setIsMasterDashboard(true);
      setSelectedCompany(null);
      return;
    }

    // Check if path is a dedicated company route: /company/:slug or /company/:slug/:view
    if (path.startsWith('/company/')) {
      const parts = path.replace(/^\/company\//, '').split('/');
      const slug = parts[0];
      const rawView = parts[1] || 'dashboard';
      const view =
        rawView.startsWith('statement-impor') || rawView === 'import' || rawView === 'bank-statement-import'
          ? 'statement-import'
          : rawView;
      const matchedCompany = getCompanyBySlug(slug);

      if (matchedCompany) {
        setIsMasterDashboard(false);
        setSelectedCompany(matchedCompany);
        setCurrentView(view);
        localStorage.setItem('selected_company', matchedCompany.slug);
        return;
      } else {
        // Unknown company slug -> redirect to selection screen
        setIsMasterDashboard(false);
        navigate('/company-selection', true);
        setSelectedCompany(null);
        return;
      }
    }

    // Company selection screen route
    if (path === '/company-selection' || path === '/select-company') {
      setIsMasterDashboard(false);
      setSelectedCompany(null);
      return;
    }

    // Root path '/' or fallback:
    // If logged in, check if user had a previously selected company
    const cachedCompanySlug = localStorage.getItem('selected_company');
    const cachedCompany = cachedCompanySlug ? getCompanyBySlug(cachedCompanySlug) : null;

    if (cachedCompany) {
      setIsMasterDashboard(false);
      setSelectedCompany(cachedCompany);
      setCurrentView('dashboard');
      navigate(`/company/${cachedCompany.slug}`, true);
    } else {
      setIsMasterDashboard(false);
      setSelectedCompany(null);
      navigate('/company-selection', true);
    }
  }, [navigate]);

  // Initialize application and authentication state
  const initApp = useCallback(async () => {
    setSplashError(null);
    let authenticatedUser = user;

    try {
      const token = localStorage.getItem('token');
      const cachedUser = localStorage.getItem('user');

      if (token && cachedUser) {
        try {
          const parsedUser = authenticatedUser || JSON.parse(cachedUser);
          if (!user) setUser(parsedUser);

          // Silently verify or refresh session in the background
          const res = await authAPI.getMe();
          if (res?.success && res?.data?.user) {
            authenticatedUser = res.data.user;
            setUser(authenticatedUser);
            localStorage.setItem('user', JSON.stringify(authenticatedUser));
          }
        } catch (authErr) {
          console.warn('Session verification notice:', authErr);
          if (authErr?.response?.status === 401) {
            clearApiCache();
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('selected_company');
            authenticatedUser = null;
            setUser(null);
          }
        }
      }

      // Sync route based on authentication status
      syncRouteWithState(authenticatedUser);

      // Smooth fade-out of splash if it was active
      setIsFading(true);
      setTimeout(() => {
        setShowSplash(false);
      }, 150);
    } catch (err) {
      console.error('App initialization error:', err);
      setSplashError(err?.message || 'Failed to initialize application.');
    }
  }, [user, syncRouteWithState]);

  useEffect(() => {
    initApp();

    // Listen to browser Back / Forward buttons (popstate)
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path.startsWith('/company/')) {
        const parts = path.replace(/^\/company\//, '').split('/');
        const slug = parts[0];
        const view = parts[1] || 'dashboard';
        const matchedCompany = getCompanyBySlug(slug);
        if (matchedCompany) {
          setSelectedCompany(matchedCompany);
          setCurrentView(view);
          localStorage.setItem('selected_company', matchedCompany.slug);
        } else {
          setSelectedCompany(null);
        }
      } else if (path === '/company-selection' || path === '/select-company') {
        setSelectedCompany(null);
      }
    };
    window.addEventListener('popstate', handlePopState);

    const handleLogoutEvent = () => {
      clearApiCache();
      setUser(null);
      setSelectedCompany(null);
      setCurrentView('dashboard');
      localStorage.removeItem('selected_company');
      navigate('/');
    };
    window.addEventListener('auth:logout', handleLogoutEvent);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('auth:logout', handleLogoutEvent);
    };
  }, [initApp, navigate]);

  // Action: Switch view within active company
  const handleViewChange = (newView) => {
    setCurrentView(newView);
    if (selectedCompany) {
      const targetPath = newView === 'dashboard' ? `/company/${selectedCompany.slug}` : `/company/${selectedCompany.slug}/${newView}`;
      navigate(targetPath);
    }
  };

  // Action: Successful login
  const handleLoginSuccess = (authenticatedUser) => {
    clearApiCache();
    setUser(authenticatedUser);
    setSelectedCompany(null);
    setIsMasterDashboard(false);
    setCurrentView('dashboard');
    localStorage.removeItem('selected_company');
    navigate('/company-selection');
  };

  // Action: Select a company
  const handleSelectCompany = (company) => {
    setIsMasterDashboard(false);
    setSelectedCompany(company);
    setCurrentView('dashboard');
    localStorage.setItem('selected_company', company.slug);
    navigate(`/company/${company.slug}`);
  };

  // Action: Switch company (return to company selection screen)
  const handleSwitchCompany = () => {
    setIsMasterDashboard(false);
    setSelectedCompany(null);
    setCurrentView('dashboard');
    localStorage.removeItem('selected_company');
    navigate('/company-selection');
  };

  // Action: Log out
  const handleLogout = () => {
    clearApiCache();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('selected_company');
    setUser(null);
    setSelectedCompany(null);
    setIsMasterDashboard(false);
    setCurrentView('dashboard');
    navigate('/');
  };

  return (
    <ThemeProvider>
      <NavigationProvider>
        {/* Splash screen displayed on cold initial loads */}
      {showSplash && (
        <SplashScreen
          isFading={isFading}
          error={splashError}
          onRetry={initApp}
        />
      )}

      {/* 1. Unauthenticated State -> Must not access selection screen or company dashboards */}
      {!user ? (
        <LoginForm onLoginSuccess={handleLoginSuccess} />
      ) : isMasterDashboard ? (
        /* 2. Master All-Companies Portfolio Dashboard */
        <div key="master-dashboard-view" className="book-page-perspective h-full w-full overflow-x-hidden">
          <div className="page-anim-zoom-3d h-full w-full">
            <GroupPortfolioDashboard
              user={user}
              onSelectCompany={(company) => {
                setIsMasterDashboard(false);
                handleSelectCompany(company);
              }}
              onSwitchToSingleCompany={() => {
                setIsMasterDashboard(false);
                if (selectedCompany) {
                  navigate(`/company/${selectedCompany.slug}`);
                } else {
                  setSelectedCompany(null);
                  navigate('/company-selection');
                }
              }}
            />
          </div>
        </div>
      ) : !selectedCompany ? (
        /* 3. Authenticated State without active company -> Company Selection Screen */
        <div key="company-selection-view" className="book-page-perspective h-full w-full overflow-x-hidden">
          <div className="page-anim-slide-bottom h-full w-full">
            <CompanySelectionPage
              user={user}
              onSelectCompany={handleSelectCompany}
              onLogout={handleLogout}
              onSelectMasterGroup={() => {
                setIsMasterDashboard(true);
                navigate('/master-dashboard');
              }}
            />
          </div>
        </div>
      ) : (
        /* 4. Authenticated State with selected company -> Independent Company Dashboard */
        <MainLayout
          key={selectedCompany.id}
          user={user}
          selectedCompany={selectedCompany}
          onSwitchCompany={handleSwitchCompany}
          onOpenMasterDashboard={() => {
            setIsMasterDashboard(true);
            navigate('/master-dashboard');
          }}
          currentView={currentView}
          onViewChange={handleViewChange}
          onLogout={handleLogout}
        >
          {currentView === 'dashboard' && (
            <DashboardPage
              onNavigate={handleViewChange}
              selectedCompany={selectedCompany}
            />
          )}
          {currentView === 'profit-loss' && <ProfitLossPage selectedCompany={selectedCompany} />}
          {currentView === 'data-entry' && <DataEntryPage selectedCompany={selectedCompany} />}
          {currentView === 'properties' && <PropertiesPage selectedCompany={selectedCompany} />}
          {currentView === 'appliances' && <AppliancesPage selectedCompany={selectedCompany} />}
          {currentView === 'tenants' && <TenantsPage selectedCompany={selectedCompany} />}
          {currentView === 'rent' && <RentManagerPage selectedCompany={selectedCompany} />}
          {currentView === 'mortgages' && <MortgagesPage selectedCompany={selectedCompany} />}
          {currentView === 'accounts' && <AccountsPage selectedCompany={selectedCompany} />}
          {currentView === 'statement-import' && <StatementImportPage selectedCompany={selectedCompany} />}
          {currentView === 'chart-of-accounts' && <ChartOfAccountsPage selectedCompany={selectedCompany} />}
          {currentView === 'ledger' && <LedgerPage selectedCompany={selectedCompany} />}
          {currentView === 'reports' && <ReportsPage selectedCompany={selectedCompany} />}
          {currentView === 'recycle-bin' && <RecycleBinPage selectedCompany={selectedCompany} />}
          {currentView === 'settings' && <SettingsPage user={user} selectedCompany={selectedCompany} />}
          {![
            'dashboard',
            'profit-loss',
            'data-entry',
            'properties',
            'appliances',
            'tenants',
            'rent',
            'mortgages',
            'accounts',
            'statement-import',
            'chart-of-accounts',
            'ledger',
            'reports',
            'recycle-bin',
            'settings',
          ].includes(currentView) && (
            <DashboardPage
              onNavigate={handleViewChange}
              selectedCompany={selectedCompany}
            />
          )}
        </MainLayout>
      )}

        {/* Progressive Web App (PWA) Native Installation Prompt Banner */}
        <PWAInstallBanner />
      </NavigationProvider>
    </ThemeProvider>
  );
}

export default App;
