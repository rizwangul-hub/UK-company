import React from 'react';

/**
 * BackToPortalButton
 * Returns user to the Central PixxTech Portal (https://pixxtech.vercel.app).
 * Supports standard browser navigation as well as iframe embedded contexts.
 */
export const handleBackToPortal = () => {
  const PORTAL_URL = 'https://pixxtech.vercel.app';

  // If inside Central Portal iframe, notify parent portal and redirect the main window
  if (window.top && window.top !== window.self) {
    try {
      window.top.postMessage('PIXXTECH_RETURN', '*');
      window.top.location.href = PORTAL_URL;
    } catch (e) {
      window.location.href = PORTAL_URL;
    }
  } else {
    // If opened directly in a browser tab
    window.location.href = PORTAL_URL;
  }
};

export function BackToPortalButton({ className = '', label = '← PixxTech Portal', title = 'Return to Central PixxTech Portal' }) {
  return (
    <button
      type="button"
      onClick={handleBackToPortal}
      title={title}
      className={`inline-flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer select-none active:scale-95 ${className}`}
      style={{
        backgroundColor: 'rgba(56, 189, 248, 0.12)',
        border: '1px solid rgba(56, 189, 248, 0.4)',
        color: '#38BDF8',
        padding: '6px 14px',
        fontSize: '12px',
        fontWeight: 600,
        borderRadius: '8px',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.22)';
        e.currentTarget.style.color = '#FFFFFF';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.12)';
        e.currentTarget.style.color = '#38BDF8';
      }}
    >
      <span>{label}</span>
    </button>
  );
}

export default BackToPortalButton;
