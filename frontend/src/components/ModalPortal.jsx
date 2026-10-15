import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * ModalPortal
 * Renders modal dialogs directly at document.body using React createPortal.
 * This guarantees the modal escapes any parent CSS transforms, perspectives,
 * stacking contexts, and overflow containers (such as MainLayout 3D animations).
 * 
 * Features:
 * - True 100vw x 100vh viewport coverage with backdrop dim and blur.
 * - Prevents background page scrolling while modal is open.
 * - Supports closing on Escape key press.
 * - Supports closing when clicking the backdrop overlay outside the modal card.
 */
export function ModalPortal({
  children,
  isOpen = true,
  onClose,
  className = '',
  closeOnBackdrop = true,
  zIndex = 'z-[9999]',
}) {
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;

    // Prevent content jump when scrollbar disappears
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className={`fixed inset-0 ${zIndex} w-screen h-screen flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-hidden animate-in fade-in duration-150 ${className}`}
      onClick={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
    >
      {children}
    </div>,
    document.body
  );
}

export default ModalPortal;
