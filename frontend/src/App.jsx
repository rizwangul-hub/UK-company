import React, { useState, useEffect, useCallback } from 'react';
import { MainLayout } from './layouts/MainLayout.jsx';
import { LoginForm } from './components/LoginForm.jsx';
import { SplashScreen } from './components/SplashScreen.jsx';
import { CompanySelectionPage } from './pages/CompanySelectionPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { PropertiesPage } from './pages/PropertiesPage.jsx';
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
import { authAPI } from './services/api.js';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { COMPANIES, getCompanyBySlug } from './config/companies.js';

const MIN_SPLASH_DURATION_MS = 2000;

export function App() {
  const [user, setUser] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [isMasterDashboard, setIsMasterDashboard] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
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
      const view = parts[1] || 'dashboard';
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
    const startTime = Date.now();
    let authenticatedUser = null;

    try {
      const token = localStorage.getItem('token');
      const cachedUser = localStorage.getItem('user');

      if (token && cachedUser) {
        try {
          authenticatedUser = JSON.parse(cachedUser);
          setUser(authenticatedUser);

          const res = await authAPI.getMe();
          if (res?.success && res?.data?.user) {
            authenticatedUser = res.data.user;
            setUser(authenticatedUser);
            localStorage.setItem('user', JSON.stringify(authenticatedUser));
          }
        } catch (authErr) {
          // If token verification failed, clear stale cache
          console.warn('Session verification notice:', authErr);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          localStorage.removeItem('selected_company');
          authenticatedUser = null;
          setUser(null);
        }
      }

      // Sync route based on authentication status
      syncRouteWithState(authenticatedUser);

      // Ensure splash branding is visible for at least MIN_SPLASH_DURATION_MS
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, MIN_SPLASH_DURATION_MS - elapsedTime);
      if (remainingTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, remainingTime));
      }

      // Smooth fade-out transition
      setIsFading(true);
      setTimeout(() => {
        setShowSplash(false);
      }, 500);
    } catch (err) {
      console.error('App initialization error:', err);
      setSplashError(err?.message || 'Failed to initialize application.');
    }
  }, [syncRouteWithState]);

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
      {/* Splash screen displayed on initial app load & browser refresh */}
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
      ) : !selectedCompany ? (
        /* 3. Authenticated State without active company -> Company Selection Screen */
        <CompanySelectionPage
          user={user}
          onSelectCompany={handleSelectCompany}
          onLogout={handleLogout}
          onSelectMasterGroup={() => {
            setIsMasterDashboard(true);
            navigate('/master-dashboard');
          }}
        />
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
          {currentView === 'data-entry' && <DataEntryPage selectedCompany={selectedCompany} />}
          {currentView === 'properties' && <PropertiesPage selectedCompany={selectedCompany} />}
          {currentView === 'tenants' && <TenantsPage selectedCompany={selectedCompany} />}
          {currentView === 'rent' && <RentManagerPage selectedCompany={selectedCompany} />}
          {currentView === 'mortgages' && <MortgagesPage selectedCompany={selectedCompany} />}
          {currentView === 'accounts' && <AccountsPage selectedCompany={selectedCompany} />}
          {currentView === 'chart-of-accounts' && <ChartOfAccountsPage selectedCompany={selectedCompany} />}
          {currentView === 'ledger' && <LedgerPage selectedCompany={selectedCompany} />}
          {currentView === 'reports' && <ReportsPage selectedCompany={selectedCompany} />}
          {currentView === 'settings' && <SettingsPage user={user} selectedCompany={selectedCompany} />}
        </MainLayout>
      )}
    </ThemeProvider>
  );
}

export default App;
