"use client";

import { Badge } from "@/components/ui/Badge";
import { formatUtilization, type SlotBreakdown, type TherapistCapacity } from "@/lib/dashboard";

/**
 * Therapist capacity section — one card per therapist on duty today.
 *
 * Each card shows booked vs. free slots for today as a progress bar plus an
 * interactive mini slot grid (mono time labels; BOOKED slots carry the
 * patient name; OFF slots are hatched/muted). Off-duty therapists render as
 * a muted card so the grid shape stays stable.
 */

// ---------------------------------------------------------------------------
// Mini slot grid
// ---------------------------------------------------------------------------

function SlotChip({ slot }: { slot: SlotBreakdown }) {
  const isBooked = slot.status === "BOOKED";
  const isOpen = slot.status === "OPEN";

  const styles = isBooked
    ? "border-tertiary/40 bg-tertiary-soft text-text-primary"
    : isOpen
      ? "border-primary/30 bg-primary-soft/60 text-primary-text-soft"
      : "border-border-custom/40 bg-bg-app text-text-secondary/60 line-through";

  return (
    <div
      title={
        isBooked
          ? `${slot.time} — ${slot.patient_name ?? "Booked"}`
          : isOpen
            ? `${slot.time} — Open`
            : `${slot.time} — Off duty`
      }
      className={`rounded-md border px-2 py-1.5 text-center transition-colors ${styles}`}
    >
      <div className="font-mono text-[11px] font-medium leading-none">{slot.time}</div>
      {isBooked && slot.patient_name ? (
        <div className="mt-1 truncate text-[10px] leading-none opacity-80">{slot.patient_name}</div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Capacity card
// ---------------------------------------------------------------------------

function CapacityCard({ capacity }: { capacity: TherapistCapacity }) {
  const { utilization, booked_slots, total_slots, free_slots } = capacity;

  return (
    <article className="flex flex-col rounded-card border border-border-custom bg-surface shadow-soft transition-shadow hover:shadow-soft-lg">
      {/* Header: name + duty badge */}
      <div className="flex items-start justify-between gap-2 border-b border-border-custom/70 px-5 pb-4 pt-4">
        <div className="min-w-0">
          <h3 className="truncate font-display text-base font-semibold leading-snug text-text-primary">
            {capacity.therapist_name}
          </h3>
          <p className="mt-0.5 truncate text-xs text-text-secondary">
            {capacity.specialty ?? "—"}
            {capacity.working_window ? (
              <span className="ml-2 font-mono">{capacity.working_window}</span>
            ) : null}
          </p>
        </div>
        <Badge variant={capacity.on_duty ? "success" : "neutral"}>
          {capacity.on_duty ? "On duty" : "Off today"}
        </Badge>
      </div>

      {capacity.on_duty ? (
        <div className="space-y-4 px-5 py-4">
          {/* Utilization progress bar */}
          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-[11px] uppercase tracking-wide text-text-secondary">
                Utilization
              </span>
              <span className="font-mono text-sm font-medium text-text-primary">
                {formatUtilization(utilization)}
                <span className="ml-1.5 text-xs text-text-secondary">
                  ({booked_slots}/{total_slots})
                </span>
              </span>
            </div>
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-bg-app"
              role="progressbar"
              aria-valuenow={Math.round(utilization * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${capacity.therapist_name} slot utilization`}
            >
              <div
                className="h-full rounded-full bg-tertiary transition-[width] duration-500"
                style={{ width: `${Math.round(utilization * 100)}%` }}
              />
            </div>
          </div>

          {/* Numbers strip */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-bg-app px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-text-secondary">Total</div>
              <div className="font-mono text-sm font-semibold text-text-primary">{total_slots}</div>
            </div>
            <div className="rounded-lg bg-tertiary-soft px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-status-success">Booked</div>
              <div className="font-mono text-sm font-semibold text-status-success">
                {booked_slots}
              </div>
            </div>
            <div className="rounded-lg bg-primary-soft px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-primary-text-soft">Free</div>
              <div className="font-mono text-sm font-semibold text-primary-text-soft">
                {free_slots}
              </div>
            </div>
          </div>

          {/* Mini slot grid */}
          {capacity.slots_breakdown.length > 0 ? (
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
              {capacity.slots_breakdown.map((slot) => (
                <SlotChip key={slot.time} slot={slot} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-secondary">No bookable slots configured.</p>
          )}
        </div>
      ) : (
        <div className="px-5 py-6 text-center">
          <p className="text-sm text-text-secondary">
            Not scheduled today
            {capacity.slots_breakdown.some((s) => s.status === "OFF")
              ? " — day off or outside working hours."
              : "."}
          </p>
        </div>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Section
// ---------------------------------------------------------------------------

export interface TherapistCapacityViewProps {
  capacities: TherapistCapacity[];
  isLoading: boolean;
}

export function TherapistCapacityView({ capacities, isLoading }: TherapistCapacityViewProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-56 animate-pulse rounded-card border border-border-custom bg-surface"
          />
        ))}
      </div>
    );
  }

  if (capacities.length === 0) {
    return (
      <div className="rounded-card border border-border-custom bg-surface px-5 py-10 text-center">
        <p className="font-display text-lg text-text-primary">No therapists on the roster</p>
        <p className="mt-1 text-sm text-text-secondary">
          Add therapists and set working hours to see capacity here.
        </p>
      </div>
    );
  }

  const onDutyFirst = [...capacities].sort(
    (a, b) => Number(b.on_duty) - Number(a.on_duty) || b.utilization - a.utilization,
  );

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {onDutyFirst.map((c) => (
        <CapacityCard key={c.therapist_id} capacity={c} />
      ))}
    </div>
  );
}
