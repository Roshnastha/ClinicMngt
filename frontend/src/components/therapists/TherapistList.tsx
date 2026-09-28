"use client";

import { Badge } from "@/components/ui/Badge";
import {
  formatDays,
  formatHours,
  SHORT_DAYS,
  VALID_DAYS,
  type Therapist,
  type Weekday,
} from "@/lib/therapists";

/**
 * Therapist roster — responsive card grid (one card per therapist).
 * Design-system surfaces with mono numerics for hours/slots.
 */

export interface TherapistListProps {
  therapists: Therapist[];
  isLoading: boolean;
  /** True when the viewer may act (admin); hides action footer otherwise. */
  canManage: boolean;
  /** Search text, used to tailor the empty state. */
  hasFilters?: boolean;
  onEdit: (therapist: Therapist) => void;
  onOverride: (therapist: Therapist) => void;
  onDelete: (therapist: Therapist) => void;
}

/** Day-of-week chips: on = working day (warm), off = muted. */
function DayChips({ days }: { days: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {VALID_DAYS.map((day) => {
        const on = days.includes(day);
        return (
          <span
            key={day}
            title={day}
            className={`flex h-6 w-9 items-center justify-center rounded-md border font-mono text-[10px] font-medium ${
              on
                ? "border-primary/30 bg-primary-soft text-primary-text-soft"
                : "border-border-custom bg-bg-app text-text-secondary/60"
            }`}
          >
            {SHORT_DAYS[day as Weekday]}
          </span>
        );
      })}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-text-secondary">{label}</div>
      <div className="mt-0.5 font-mono text-sm font-medium text-text-primary">{value}</div>
    </div>
  );
}

export function TherapistList({
  therapists,
  isLoading,
  canManage,
  hasFilters,
  onEdit,
  onOverride,
  onDelete,
}: TherapistListProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-52 animate-pulse rounded-card border border-border-custom bg-surface"
          />
        ))}
      </div>
    );
  }

  if (therapists.length === 0) {
    return (
      <div className="rounded-card border border-border-custom bg-surface px-5 py-12 text-center">
        <p className="font-display text-lg text-text-primary">No therapists found</p>
        <p className="mt-1 text-sm text-text-secondary">
          {hasFilters ? "Try adjusting the search." : "Add your first therapist to get started."}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {therapists.map((t) => (
        <article
          key={t.id}
          className="flex flex-col rounded-card border border-border-custom bg-surface shadow-soft transition-shadow hover:shadow-soft-lg"
        >
          {/* Header: name + specialty */}
          <div className="border-b border-border-custom/70 px-5 pt-5 pb-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-display text-lg font-semibold leading-snug text-text-primary">
                {t.name}
              </h3>
              {!t.is_active && <Badge variant="error">Inactive</Badge>}
            </div>
            <p className="mt-0.5 text-sm text-text-secondary">{t.specialty}</p>
          </div>

          {/* Schedule */}
          <div className="space-y-3 px-5 py-4">
            <div>
              <div className="mb-1.5 text-[11px] uppercase tracking-wide text-text-secondary">
                Working days
              </div>
              <DayChips days={t.working_days} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Metric label="Standard hours" value={formatHours(t)} />
              <Metric label="Slot duration" value={`${t.slot_duration_minutes} min`} />
              <Metric label="Weekly hours" value={`${t.weekly_hours.toFixed(1)} h`} />
              <Metric label="Active patients" value={t.active_patients_count} />
            </div>
          </div>

          {/* Today's bookings */}
          <div className="border-t border-border-custom/60 px-5 py-3">
            {t.appointments_today.length === 0 ? (
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wide text-text-secondary">
                  Today
                </span>
                <span className="font-mono text-sm text-text-secondary">No sessions</span>
              </div>
            ) : (
              <details>
                <summary className="flex cursor-pointer list-none items-center justify-between">
                  <span className="text-[11px] uppercase tracking-wide text-text-secondary">
                    Today
                  </span>
                  <span className="font-mono text-sm font-medium text-tertiary">
                    {t.appointments_today_count} booked
                  </span>
                </summary>
                <ul className="mt-2 space-y-1">
                  {t.appointments_today.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between rounded-md bg-bg-app px-2 py-1"
                    >
                      <span className="font-mono text-xs text-text-secondary">
                        {a.start_time.slice(0, 5)}–{a.end_time.slice(0, 5)}
                      </span>
                      <span className="text-xs text-text-primary">
                        {a.patient?.name ?? "—"}
                      </span>
                      <Badge
                        variant={
                          a.status === "Booked" ? "success" : a.status === "Cancelled" ? "error" : "neutral"
                        }
                        uppercase={false}
                      >
                        {a.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>

          {/* Actions */}
          {canManage && (
            <div className="mt-auto flex items-center gap-1.5 border-t border-border-custom/70 px-4 py-3">
              <button
                type="button"
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary-text-soft transition-colors hover:bg-primary-soft"
                onClick={() => onEdit(t)}
              >
                Edit
              </button>
              <button
                type="button"
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary-text-soft transition-colors hover:bg-primary-soft"
                onClick={() => onOverride(t)}
              >
                Schedule Override
              </button>
              <button
                type="button"
                className="ml-auto rounded-lg px-2.5 py-1.5 text-xs font-medium text-status-error transition-colors hover:bg-status-error-soft"
                onClick={() => onDelete(t)}
              >
                Delete
              </button>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
