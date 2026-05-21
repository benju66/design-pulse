'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

/* ─────────────────────────────────────────────────────────
 * ModalShell — shared overlay wrapper for all dialog modals.
 *
 * Handles:
 *   ✅ Fixed overlay with bg-slate-900/50 backdrop-blur-sm
 *   ✅ Separate clickable backdrop div (click-outside-to-close)
 *   ✅ z-50 base / z-[60] for nested modals
 *   ✅ Escape key to close (skips when activeElement is input)
 *   ✅ Container: rounded-2xl, shadow-2xl, dark mode, border
 *   ✅ Entrance animation: fade-in + zoom-in-95
 *   ✅ Size presets: sm / md / lg / full
 *   ✅ preventClose override (disables Escape + backdrop click)
 *   ✅ React Portal rendering under document.body (escapes z-index bounds)
 *
 * Does NOT handle:
 *   ❌ Close X button (consumer renders their own in the header)
 *   ❌ Header/footer layout (consumer's children)
 *   ❌ Form state, loading, tabs (consumer's responsibility)
 *   ❌ Focus trapping (not needed yet)
 * ───────────────────────────────────────────────────────── */

const SIZE_CLASSES: Record<ModalShellProps['size'] & string, string> = {
  sm:   'max-w-md',
  md:   'max-w-lg',
  lg:   'max-w-5xl max-h-[90vh]',
  full: 'max-w-7xl max-h-[90vh]',
};

export interface ModalShellProps {
  /** Controls visibility. When false, returns null. */
  isOpen: boolean;
  /** Called when the user dismisses the modal (Escape, backdrop click). */
  onClose: () => void;
  /** Container max-width preset. @default 'sm' */
  size?: 'sm' | 'md' | 'lg' | 'full';
  /** Use z-[60] instead of z-50 — for modals opened from another modal. */
  nested?: boolean;
  /** Allow dismissal by clicking the backdrop overlay. @default true */
  closeOnBackdropClick?: boolean;
  /** Allow dismissal via Escape key. @default true */
  closeOnEscape?: boolean;
  /**
   * Master lock — disables Escape, backdrop click, and should hide
   * the consumer's close button (consumer checks this prop manually).
   * Use during mid-mutation states (e.g. dispatching imports).
   * @default false
   */
  preventClose?: boolean;
  /** Escape hatch for one-off container overrides (e.g. fixed height). */
  className?: string;
  children: React.ReactNode;
}

export function ModalShell({
  isOpen,
  onClose,
  size = 'sm',
  nested = false,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  preventClose = false,
  className,
  children,
}: ModalShellProps) {
  // Hydration safety guard for Next.js SSR
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // ── Escape key handler ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || preventClose || !closeOnEscape) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;

      // Enterprise safety: when the user is typing in an input and presses
      // Escape, they expect to cancel the field edit — NOT close the modal.
      // This matches the PdfImportModal C18 pattern and prevents data loss
      // in inline-editable grids (BulkImportModal, GlobalSettingsModal).
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, preventClose, closeOnEscape]);

  // ── Gate ───────────────────────────────────────────────────────────────────
  if (!isOpen || !mounted) return null;

  const handleBackdropClick = () => {
    if (preventClose || !closeOnBackdropClick) return;
    onClose();
  };

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 flex items-center justify-center p-4',
        nested ? 'z-[60]' : 'z-50',
      )}
    >
      {/* Backdrop — separate div for clean click-outside handling */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={handleBackdropClick}
      />

      {/* Container */}
      <div
        className={cn(
          'relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl',
          'border border-slate-200 dark:border-slate-800',
          'overflow-hidden flex flex-col w-full',
          'animate-in fade-in zoom-in-95 duration-150',
          SIZE_CLASSES[size],
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
