import type { ReactNode } from "react";

/**
 * Status badge — small rounded pill used for Paid/Active/Booked (success),
 * Overdue/Cancelled (error) and Pending/On-hold (neutral) states.
 * Soft background + dark text per the design system.
 */
export type BadgeVariant = "success" | "error" | "neutral";

const VARIANTS: Record<BadgeVariant, { bg: string; text: string }> = {
  success: { bg: "bg-status-success-soft", text: "text-status-success" },
  error: { bg: "bg-status-error-soft", text: "text-status-error" },
  neutral: { bg: "bg-status-neutral-soft", text: "text-status-neutral" },
};

export interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
  /** Uppercase label styling (default), e.g. ADMIN / PAID / OVERDUE. */
  uppercase?: boolean;
}

export function Badge({
  variant = "neutral",
  children,
  className = "",
  uppercase = true,
}: BadgeProps) {
  const v = VARIANTS[variant];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${v.bg} ${v.text} ${
        uppercase ? "uppercase tracking-wide" : ""
      } ${className}`}
    >
      {children}
    </span>
  );
}
