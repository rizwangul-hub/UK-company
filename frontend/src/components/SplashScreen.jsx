import React from 'react';
import splashImage from '../assets/loading.png';
import { AlertCircle, RefreshCw } from 'lucide-react';

/**
 * Full-Screen Splash Screen for PIXX Technologies UK Property Finance & Management System
 * 
 * Satisfies:
 * 1. 100vw × 100vh full viewport display without scrollbars or white margins.
 * 2. Fully responsive on desktop, laptop, tablet, and mobile with object-fit: cover.
 * 3. Smooth fade-out transition upon initialization.
 * 4. Error display with retry option if initialization fails.
 */
export function SplashScreen({ isFading, error, onRetry }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading PIXX Technologies UK Property Finance & Management System"
      className={`fixed inset-0 z-[9999] w-screen h-screen m-0 p-0 overflow-hidden bg-slate-950 flex items-center justify-center select-none transition-opacity duration-500 ease-in-out ${
        isFading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background / Main Splash Image */}
      <img
        src={splashImage}
        alt="PIXX Technologies UK Property Finance & Management System"
        className="w-full h-full object-cover object-center pointer-events-none select-none block"
        loading="eager"
        decoding="sync"
      />

      {/* Error & Retry Overlay if initialization fails */}
      {error && (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-10 transition-all duration-300">
          <div className="max-w-md w-full bg-slate-900/90 border border-red-500/30 rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Initialization Error</h3>
              <p className="text-sm text-slate-300 mt-1">
                {error || 'Unable to connect to PIXX Technologies UK system.'}
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={onRetry}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-medium text-sm shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Retry Connection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SplashScreen;
