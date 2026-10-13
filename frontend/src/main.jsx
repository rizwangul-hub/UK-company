import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// Register Service Worker for PWA (Progressive Web App)
if (
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  (window.location.protocol === 'https:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1')
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('[PWA] Service Worker registered successfully with scope:', registration.scope);
      })
      .catch((error) => {
        console.warn('[PWA] Service Worker registration notice:', error);
      });
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
