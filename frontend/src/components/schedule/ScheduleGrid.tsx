"use client";

import { Badge } from "@/components/ui/Badge";
import { toHHMM, type DailyGrid, type GridCell } from "@/lib/schedule";

/**
 * Daily schedule grid — therapist columns × time-slot rows.
 * Cells: OPEN (interactive), BOOKED (appointment badge), THERAPIST_OFF (muted).
 */

function statusVariant(status: string): "success" | "neutral" | "error" {
  switch (status) {
    case "Booked":
      return "success";
    case "Completed":
      return "neutral";
    default:
      return "error";
  }
}

export interface ScheduleGridProps {
  grid: DailyGrid;
  isLoading: boolean;
  onOpenSlot: (therapistId: string, date: string, startTime: string) => void;
  onOpenAppointment: (appointmentId: string) => void;
}

function OffCell() {
  return (
    <div
      className="h-14 w-full rounded-lg border border-border-custom/40 bg-[repeating-linear-gradient(45deg,#FAF8F2_0px,#FAF8F2_6px,#F3F0E6_6px,#F3F0E6_12px)]"
      title="Therapist off / outside working hours"
    />
  );
}

function BookedCell({ cell, onClick }: { cell: GridCell; onClick: () => void }) {
  const b = cell.booked;
  if (!b) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-14 w-full rounded-lg border px-2 py-1.5 text-left transition-shadow hover:shadow-soft ${
        b.status === "Cancelled"
          ? "border-status-error/30 bg-status-error-soft"
          : "border-tertiary/30 bg-tertiary-soft"
      }`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-xs font-medium text-text-primary">
          {b.patient?.name ?? "—"}
        </span>
        <Badge variant={statusVariant(b.status)}>{b.status}</Badge>
      </div>
      <div className="mt-0.5 truncate font-mono text-[10px] text-text-secondary">
        {b.condition ?? b.notes ?? "—"}
      </div>
    </button>
  );
}

export function ScheduleGrid({ grid, isLoading, onOpenSlot, onOpenAppointment }: ScheduleGridProps) {
  if (isLoading) {
    return (
      <div className="animate-pulse rounded-card border border-border-custom bg-surface p-5">
        <div className="h-6 w-48 rounded bg-border-custom" />
        <div className="mt-4 space-y-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-bg-app" />
          ))}
        </div>
      </div>
    );
  }

  if (grid.therapists.length === 0) {
    return (
      <div className="rounded-card border border-border-custom bg-surface px-5 py-12 text-center">
        <p className="font-display text-lg text-text-primary">No therapists on the roster</p>
        <p className="mt-1 text-sm text-text-secondary">
          Add therapists and set their working hours to start booking.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-border-custom bg-surface shadow-soft">
      <table className="w-full border-separate border-spacing-0">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 w-20 bg-surface px-3 py-3 text-left text-[11px] uppercase tracking-wide text-text-secondary">
              Time
            </th>
            {grid.therapists.map((col) => (
              <th key={col.therapist.id} className="min-w-44 border-b border-border-custom px-3 py-3">
                <div className="font-display text-base font-semibold text-text-primary">
                  {col.therapist.name}
                </div>
                <div className="mt-0.5 flex items-center justify-center gap-2 text-[11px] text-text-secondary">
                  <span>{col.therapist.specialty}</span>
                  {col.on_duty && col.window_start && col.window_end ? (
                    <span className="font-mono">
                      {toHHMM(col.window_start)}–{toHHMM(col.window_end)}
                    </span>
                  ) : (
                    <span className="font-medium text-status-neutral">OFF</span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.slots.map((slot, rowIdx) => (
            <tr key={slot}>
              <th
                scope="row"
                className="sticky left-0 z-10 bg-surface px-3 py-1.5 text-left font-mono text-xs font-medium text-text-secondary"
              >
                {toHHMM(slot)}
              </th>
              {grid.cells[rowIdx].map((cell, colIdx) => {
                const therapistId = grid.therapists[colIdx].therapist.id;
                if (cell.state === "THERAPIST_OFF") {
                  return (
                    <td key={therapistId} className="px-1.5 py-1">
                      <OffCell />
                    </td>
                  );
                }
                if (cell.state === "BOOKED") {
                  return (
                    <td key={therapistId} className="px-1.5 py-1">
                      <BookedCell
                        cell={cell}
                        onClick={() => onOpenAppointment(cell.booked!.appointment_id)}
                      />
                    </td>
                  );
                }
                return (
                  <td key={therapistId} className="px-1.5 py-1">
                    <button
                      type="button"
                      onClick={() => onOpenSlot(therapistId, grid.date, toHHMM(cell.slot_start))}
                      title={`Book ${therapistId ? "" : ""}${toHHMM(cell.slot_start)}–${toHHMM(cell.slot_end)}`}
                      className="h-14 w-full rounded-lg border border-border-custom bg-surface text-xs text-text-secondary transition-colors hover:border-primary/50 hover:bg-primary-soft/50 hover:text-primary-text-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      + {toHHMM(cell.slot_start)}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
