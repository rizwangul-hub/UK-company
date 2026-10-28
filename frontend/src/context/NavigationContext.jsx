import React, { createContext, useContext, useState, useEffect } from 'react';

const NavigationContext = createContext({
  sidebarHidden: false,
  navbarHidden: false,
  isAllNavHidden: false,
  toggleSidebar: () => {},
  toggleNavbar: () => {},
  toggleAllNav: () => {},
  setSidebarHidden: () => {},
  setNavbarHidden: () => {},
  showAllNav: () => {},
  hideAllNav: () => {},
});

export function NavigationProvider({ children }) {
  const [sidebarHidden, setSidebarHidden] = useState(() => {
    try {
      return localStorage.getItem('pixx_sidebar_hidden') === 'true';
    } catch {
      return false;
    }
  });

  const [navbarHidden, setNavbarHidden] = useState(() => {
    try {
      return localStorage.getItem('pixx_navbar_hidden') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('pixx_sidebar_hidden', String(sidebarHidden));
    } catch {
      // ignore storage access errors
    }
  }, [sidebarHidden]);

  useEffect(() => {
    try {
      localStorage.setItem('pixx_navbar_hidden', String(navbarHidden));
    } catch {
      // ignore storage access errors
    }
  }, [navbarHidden]);

  const toggleSidebar = () => setSidebarHidden((prev) => !prev);
  const toggleNavbar = () => setNavbarHidden((prev) => !prev);

  const isAllNavHidden = sidebarHidden && navbarHidden;

  const toggleAllNav = () => {
    if (isAllNavHidden) {
      setSidebarHidden(false);
      setNavbarHidden(false);
    } else {
      setSidebarHidden(true);
      setNavbarHidden(true);
    }
  };

  const showAllNav = () => {
    setSidebarHidden(false);
    setNavbarHidden(false);
  };

  const hideAllNav = () => {
    setSidebarHidden(true);
    setNavbarHidden(true);
  };

  return (
    <NavigationContext.Provider
      value={{
        sidebarHidden,
        navbarHidden,
        isAllNavHidden,
        toggleSidebar,
        toggleNavbar,
        toggleAllNav,
        setSidebarHidden,
        setNavbarHidden,
        showAllNav,
        hideAllNav,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return context;
}
