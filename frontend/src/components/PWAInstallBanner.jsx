import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // 0. If embedded in simulator or iframe, don't show native install prompt
    try {
      if (window.self !== window.top) return;
    } catch {
      return;
    }

    // 1. Detect if the app is already running in standalone / installed PWA mode
    let isAppStandalone = false;
    try {
      isAppStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true ||
        document.referrer.includes('android-app://');
    } catch {}

    if (isAppStandalone) {
      setIsStandalone(true);
      return;
    }

    // 2. Capture Chrome / Chromium beforeinstallprompt event
    const handleBeforeInstallPrompt = (e) => {
      // Keep event reference for in-app install trigger
      setDeferredPrompt(e);

      // Check if user previously dismissed prompt in this session
      let dismissed = null;
      try {
        dismissed = sessionStorage.getItem('pwa_prompt_dismissed');
      } catch {}

      if (!dismissed) {
        setShowBanner(true);
      }
    };

    // 3. Detect when app is successfully installed
    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setShowBanner(false);
      setIsStandalone(true);
      console.log('[PWA] UK-Company installed successfully');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    try {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        console.log('[PWA] User accepted the UK-Company install prompt');
      } else {
        console.log('[PWA] User dismissed the UK-Company install prompt');
      }
    } catch (err) {
      console.warn('[PWA] Install prompt error:', err);
    } finally {
      setDeferredPrompt(null);
      setShowBanner(false);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    try {
      sessionStorage.setItem('pwa_prompt_dismissed', 'true');
    } catch {}
  };

  if (isStandalone || !showBanner || !deferredPrompt) {
    return null;
  }

  return (
    <aside
      aria-label="Install UK-Company Progressive Web App"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-md z-50 animate-in slide-in-from-bottom-5 duration-300"
    >
      <div className="bg-slate-900/98 dark:bg-slate-900/98 border border-indigo-500/40 rounded-2xl p-4 shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 text-white ring-1 ring-indigo-500/20">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <img
              src="/icon-192.png"
              alt="UK-Company App Icon"
              className="w-12 h-12 rounded-xl bg-white p-1 object-contain shadow-md border border-indigo-500/40"
            />
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center">
              <Smartphone className="w-2.5 h-2.5 text-white" />
            </div>
          </div>
          <div className="min-w-0">
            <div className="text-sm font-extrabold text-white truncate flex items-center gap-1.5">
              <span>UK-Company</span>
              <span className="px-1.5 py-0.5 bg-indigo-500/25 text-indigo-300 text-[10px] rounded-md border border-indigo-500/30 font-bold uppercase tracking-wider">
                App
              </span>
            </div>
            <div className="text-[11px] text-slate-300 truncate font-medium">
              Install app for fast, fullscreen mobile access
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleInstallClick}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 transition cursor-pointer active:scale-95"
            title="Install UK-Company App"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Install</span>
          </button>
          <button
            onClick={handleDismiss}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            title="Dismiss installation banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default PWAInstallBanner;
