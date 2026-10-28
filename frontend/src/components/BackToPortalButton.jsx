import React from 'react';

/**
 * BackToPortalButton
 * Returns user to the Central PixxTech Portal (https://pixx-tech.vercel.app).
 * Supports standard browser navigation as well as iframe embedded contexts.
 */
export const handleBackToPortal = () => {
  const portalUrl = 'https://pixx-tech.vercel.app';
  try {
    if (window.top && window.top !== window.self) {
      window.top.postMessage('PIXXTECH_RETURN', '*');
      window.top.location.href = portalUrl;
      return;
    }
  } catch (e) {
    try {
      window.parent?.postMessage('PIXXTECH_RETURN', '*');
    } catch (_) {}
  }
  window.location.href = portalUrl;
};

export function BackToPortalButton({ className = '', label = '← PixxTech Portal', title = 'Return to Central PixxTech Portal' }) {
  return (
    <button
      type="button"
      onClick={handleBackToPortal}
      title={title}
      className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 transition-all duration-150 cursor-pointer select-none active:scale-95 ${className}`}
      style={{
        backgroundColor: 'rgba(56, 189, 248, 0.12)',
        border: '1px solid rgba(56, 189, 248, 0.35)',
        color: '#38BDF8',
        fontSize: '12px',
        fontWeight: 600,
        borderRadius: '8px',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.22)';
        e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.55)';
        e.currentTarget.style.color = '#FFFFFF';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(56, 189, 248, 0.12)';
        e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.35)';
        e.currentTarget.style.color = '#38BDF8';
      }}
    >
      <span>{label}</span>
    </button>
  );
}

export default BackToPortalButton;
