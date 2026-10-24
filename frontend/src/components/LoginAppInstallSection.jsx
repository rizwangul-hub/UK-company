import React, { useState, useEffect } from 'react';
import { Smartphone, Download, Share, PlusSquare, MoreVertical, CheckCircle2, X, ExternalLink, Sparkles } from 'lucide-react';
import { ModalPortal } from './ModalPortal.jsx';

export function LoginAppInstallSection() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState('android');

  useEffect(() => {
    // 1. Detect if running in standalone / installed PWA mode
    const isAppStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://');

    setIsStandalone(isAppStandalone);

    // 2. Detect User Agent
    const ua = navigator.userAgent || '';
    const iosDetected = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const androidDetected = /Android/.test(ua);

    setIsIOS(iosDetected);
    setIsAndroid(androidDetected);
    if (iosDetected) {
      setActiveTab('ios');
    } else {
      setActiveTab('android');
    }

    // 3. Listen for Chrome/Chromium beforeinstallprompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      setShowModal(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          setDeferredPrompt(null);
          setIsStandalone(true);
        }
      } catch (err) {
        console.warn('[PWA] Prompt error:', err);
        setShowModal(true);
      }
    } else {
      setShowModal(true);
    }
  };

  // If already running inside standalone app, show clean confirmation badge
  if (isStandalone) {
    return (
      <div className="mt-4 p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl flex items-center justify-center gap-2 text-emerald-400 text-xs font-semibold shadow-lg">
        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
        <span>UK Company Mobile App is Installed &amp; Active</span>
      </div>
    );
  }

  return (
    <>
      {/* Install Card on Login Page */}
      <div className="mt-4 bg-slate-900/90 border border-indigo-500/30 rounded-2xl p-4 shadow-xl backdrop-blur-md transition hover:border-indigo-500/50">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <img
                src="/UK.png"
                alt="UK Company Logo"
                className="w-11 h-11 rounded-xl bg-white p-0.5 object-contain shadow-md border border-indigo-500/30"
              />
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center text-[9px] text-white font-black">
                ✓
              </span>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-white flex items-center gap-1.5 truncate">
                <span>UK Company</span>
                <span className="px-1.5 py-0.5 bg-indigo-500/25 text-indigo-300 text-[10px] rounded-md font-bold border border-indigo-500/30 uppercase tracking-wider">
                  Mobile App
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                Install web view on Android &amp; iPhone
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleInstallClick}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-600 active:scale-95 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/30 transition cursor-pointer"
            >
              {deferredPrompt ? <Download className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5" />}
              <span>Install App</span>
            </button>
          </div>
        </div>

        {/* Small sub-row with info and platform links */}
        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
            <span>Fullscreen · No browser bar · Fast launch</span>
          </span>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer underline flex items-center gap-0.5"
          >
            <span>How to install?</span>
          </button>
        </div>
      </div>

      {/* Installation Instruction Modal */}
      {showModal && (
        <ModalPortal isOpen={showModal} onClose={() => setShowModal(false)}>
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <div
              className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 relative text-slate-100"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Modal Header */}
              <div className="flex items-center gap-3.5">
                <div className="relative shrink-0">
                  <img
                    src="/UK.png"
                    alt="UK Company Logo"
                    className="w-14 h-14 rounded-2xl bg-white p-1 object-contain shadow-lg border border-indigo-500/40"
                  />
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-indigo-600 border-2 border-slate-900 flex items-center justify-center">
                    <Smartphone className="w-3 h-3 text-white" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Install UK Company App</h3>
                  <p className="text-xs text-slate-400">
                    Add the official web view app to your phone
                  </p>
                </div>
              </div>

              {/* Platform Switcher Tabs */}
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('android')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                    activeTab === 'android'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>🤖</span>
                  <span>Android</span>
                  {isAndroid && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('ios')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                    activeTab === 'ios'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>🍎</span>
                  <span>iPhone (iOS)</span>
                  {isIOS && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  )}
                </button>
              </div>

              {/* Tab Content: Android */}
              {activeTab === 'android' && (
                <div className="space-y-3.5 bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4">
                  {deferredPrompt && (
                    <button
                      type="button"
                      onClick={handleInstallClick}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2 cursor-pointer mb-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>One-Click Install on Android</span>
                    </button>
                  )}

                  <div className="text-xs font-semibold text-slate-300">
                    Follow these 3 easy steps in Chrome or your Android browser:
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-bold flex items-center justify-center shrink-0">
                        1
                      </span>
                      <div className="text-slate-300 pt-0.5">
                        Tap the browser menu <strong className="text-white">three dots</strong> (
                        <MoreVertical className="inline w-3.5 h-3.5 text-indigo-400" />) in the top-right corner.
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-bold flex items-center justify-center shrink-0">
                        2
                      </span>
                      <div className="text-slate-300 pt-0.5">
                        Tap <strong className="text-white">"Install app"</strong> or{' '}
                        <strong className="text-white">"Add to Home screen"</strong>.
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-bold flex items-center justify-center shrink-0">
                        3
                      </span>
                      <div className="text-slate-300 pt-0.5">
                        Tap <strong className="text-white">"Install"</strong> to confirm. The{' '}
                        <strong className="text-indigo-300">UK Company</strong> icon will appear on your home screen and app drawer!
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab Content: iPhone (iOS) */}
              {activeTab === 'ios' && (
                <div className="space-y-3.5 bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4">
                  <div className="text-xs font-semibold text-slate-300">
                    Follow these 3 easy steps in <strong className="text-white">Safari</strong> on your iPhone:
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-bold flex items-center justify-center shrink-0">
                        1
                      </span>
                      <div className="text-slate-300 pt-0.5">
                        Tap the <strong className="text-white">Share</strong> button (
                        <Share className="inline w-3.5 h-3.5 text-indigo-400" />) at the bottom or top of your Safari screen.
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-bold flex items-center justify-center shrink-0">
                        2
                      </span>
                      <div className="text-slate-300 pt-0.5">
                        Scroll down the menu and tap{' '}
                        <strong className="text-white">"Add to Home Screen"</strong> (
                        <PlusSquare className="inline w-3.5 h-3.5 text-emerald-400" />).
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-bold flex items-center justify-center shrink-0">
                        3
                      </span>
                      <div className="text-slate-300 pt-0.5">
                        Tap <strong className="text-white">"Add"</strong> in the top-right corner. The{' '}
                        <strong className="text-indigo-300">UK Company</strong> app will appear on your iPhone home screen!
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-500/20 text-[11px] text-indigo-300 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>Launches in fullscreen standalone web view with zero Safari browser tabs!</span>
                  </div>
                </div>
              )}

              {/* Close Action */}
              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-xs transition cursor-pointer"
                >
                  Got It
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}

export default LoginAppInstallSection;
