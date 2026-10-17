import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export interface M3DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  maxWidth?: string;
}

export const M3Dialog: React.FC<M3DialogProps> = ({
  isOpen,
  onClose,
  title,
  icon,
  children,
  actions,
  maxWidth = 'max-w-lg',
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5"
    >
      {/* M3 Scrim / Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* M3 Dialog Surface */}
      <div
        className={`relative w-full ${maxWidth} bg-m3-surface-container-high text-m3-on-surface rounded-[28px] shadow-m3-elevation-3 p-5 sm:p-6 z-10 animate-m3-enter border border-m3-outline-variant/20 flex flex-col max-h-[90vh]`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="w-10 h-10 rounded-full bg-m3-primary-container text-m3-on-primary-container flex items-center justify-center shrink-0">
                {icon}
              </div>
            )}
            {title && (
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-m3-on-surface">
                {title}
              </h2>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup dialog"
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-m3-on-surface-variant hover:text-m3-on-surface hover:bg-m3-surface-container rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-2 pr-1 text-xs sm:text-sm text-m3-on-surface-variant">
          {children}
        </div>

        {/* Actions Footer */}
        {actions && (
          <div className="pt-4 mt-2 border-t border-m3-outline-variant/20 flex items-center justify-end gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
