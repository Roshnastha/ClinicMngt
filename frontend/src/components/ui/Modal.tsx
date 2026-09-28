"use client";

import { useCallback, useEffect, type ReactNode } from "react";

/**
 * Modal dialog shell — centred overlay with dark backdrop, white surface
 * card, header title with close button, and a footer action slot for
 * form modals (save/cancel etc.).
 */
export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  /** Footer actions (buttons). Hidden when omitted. */
  actions?: ReactNode;
  /** Constrain dialog width; defaults to max-w-lg. */
  maxWidthClassName?: string;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  actions,
  maxWidthClassName = "max-w-lg",
}: ModalProps) {
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onKeyDown]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#132420]/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`w-full ${maxWidthClassName} rounded-card border border-border-custom bg-surface shadow-soft-lg`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-custom/70 px-5 py-4">
          <h2 className="font-display text-xl font-semibold text-text-primary">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-primary-soft/60 hover:text-primary-text-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">{children}</div>

        {/* Action slot */}
        {actions ? (
          <div className="flex items-center justify-end gap-2 border-t border-border-custom/70 px-5 py-4">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  );
}
