import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// Register Service Worker for PWA (Progressive Web App)
// Only register in top-level window (avoids SecurityError in simulators, responsive viewers, or iframes)
const isTopLevelWindow = (() => {
  try {
    return typeof window !== 'undefined' && window.self === window.top;
  } catch {
    return false;
  }
})();

if (
  isTopLevelWindow &&
  'serviceWorker' in navigator &&
  (window.location.protocol === 'https:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1')
) {
  window.addEventListener('load', () => {
    try {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          if (import.meta.env.DEV) {
            console.log('[PWA] Service Worker registered successfully with scope:', registration.scope);
          }
        })
        .catch((error) => {
          // Gracefully suppress sandbox/simulator registration errors
          if (import.meta.env.DEV) {
            console.warn('[PWA] Service Worker registration notice:', error);
          }
        });
    } catch {
      // Ignored in restricted environments
    }
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
