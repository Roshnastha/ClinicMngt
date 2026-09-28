import type { ReactNode } from "react";
import { Card } from "./Card";

/**
 * Stat card — key metric tile.
 *  - Value/number in Fraunces (font-display)
 *  - Label in Inter (font-body)
 *  - Trend/context subtext in IBM Plex Mono (font-mono)
 */
export interface StatCardProps {
  label: string;
  /** The metric value — numeric or short text. */
  value: ReactNode;
  /** Trend or context line, e.g. "+12% vs last week". */
  subtext?: ReactNode;
  /** Trend direction, colours the arrow/subtext. */
  trend?: "up" | "down" | "flat";
  /** Optional trailing badge (e.g. status). */
  badge?: ReactNode;
  className?: string;
}

const TREND_STYLES: Record<NonNullable<StatCardProps["trend"]>, string> = {
  up: "text-tertiary",
  down: "text-status-error",
  flat: "text-text-secondary",
};

const TREND_ARROW: Record<NonNullable<StatCardProps["trend"]>, string> = {
  up: "▲",
  down: "▼",
  flat: "—",
};

export function StatCard({
  label,
  value,
  subtext,
  trend,
  badge,
  className = "",
}: StatCardProps) {
  return (
    <Card className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="font-body text-sm text-text-secondary">{label}</span>
        {badge}
      </div>
      <div className="font-display text-3xl font-semibold leading-tight text-text-primary">
        {value}
      </div>
      {subtext ? (
        <div
          className={`font-mono text-xs ${
            trend ? TREND_STYLES[trend] : "text-text-secondary"
          }`}
        >
          {trend ? `${TREND_ARROW[trend]} ` : ""}
          {subtext}
        </div>
      ) : null}
    </Card>
  );
}
