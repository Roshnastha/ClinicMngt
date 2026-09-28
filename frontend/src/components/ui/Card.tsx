import type { ReactNode } from "react";

/**
 * Card / Panel — white surface container with ~14px radius, subtle
 * #E4DFD1 border and a soft drop shadow. The base building block for
 * dashboard panels, tables and forms.
 */
export interface CardProps {
  children: ReactNode;
  className?: string;
  /** Padding override, e.g. "p-0" for edge-to-edge tables. Defaults to "p-5". */
  paddingClassName?: string;
}

export function Card({
  children,
  className = "",
  paddingClassName = "p-5",
}: CardProps) {
  return (
    <div
      className={`rounded-card border border-border-custom bg-surface shadow-soft ${paddingClassName} ${className}`}
    >
      {children}
    </div>
  );
}

/** Standard header block for cards: title (Fraunces) + optional actions. */
export function CardHeader({
  title,
  actions,
  className = "",
}: {
  title: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 border-b border-border-custom/70 pb-3 ${className}`}
    >
      <h3 className="font-display text-lg font-semibold text-text-primary">
        {title}
      </h3>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
