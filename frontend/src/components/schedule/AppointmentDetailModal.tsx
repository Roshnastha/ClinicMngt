"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import {
  fetchDailyGrid,
  formatDayLabel,
  rescheduleAppointment,
  toHHMM,
  updateAppointmentStatus,
  type Appointment,
  type DailyGrid,
} from "@/lib/schedule";

/**
 * Appointment details / reschedule modal — shows the booking context,
 * offers status transitions (Completed / Cancelled), and rescheduling:
 * pick a new date, then an OPEN slot from that day's grid for the same
 * therapist. The backend re-validates conflicts authoritatively (409).
 */

export interface AppointmentDetailModalProps {
  open: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  /** Called after any successful mutation so the page can refresh the grid. */
  onChanged: () => void;
}

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

export function AppointmentDetailModal({
  open,
  onClose,
  appointment,
  onChanged,
}: AppointmentDetailModalProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Reschedule state
  const [rescheduling, setRescheduling] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [dayGrid, setDayGrid] = useState<DailyGrid | null>(null);
  const [gridLoading, setGridLoading] = useState(false);
  const [picked, setPicked] = useState<{ start: string; end: string } | null>(null);

  const loadGrid = useCallback(async (date: string) => {
    setGridLoading(true);
    try {
      setDayGrid(await fetchDailyGrid(date));
    } catch {
      setDayGrid(null);
    } finally {
      setGridLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setError(null);
      setNotice(null);
      setBusy(false);
      setRescheduling(false);
      setNewDate("");
      setDayGrid(null);
      setPicked(null);
    }
  }, [open]);

  useEffect(() => {
    if (rescheduling && newDate) {
      setPicked(null);
      loadGrid(newDate);
    } else {
      setDayGrid(null);
    }
  }, [rescheduling, newDate, loadGrid]);

  if (!appointment) return null;

  async function handleStatus(status: string) {
    setBusy(true);
    setError(null);
    try {
      await updateAppointmentStatus(appointment!.id, status as never);
      onChanged();
      onClose();
    } catch {
      setError("Could not update the status. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // OPEN slots for this appointment's therapist on the chosen date.
  const slotOptions = (() => {
    if (!dayGrid) return [];
    const colIdx = dayGrid.therapists.findIndex(
      (c) => c.therapist.id === appointment!.therapist_id,
    );
    if (colIdx === -1) return [];
    return dayGrid.slots.map((slot, rowIdx) => ({
      start: toHHMM(slot),
      end: toHHMM(dayGrid.cells[rowIdx][colIdx].slot_end),
      state: dayGrid.cells[rowIdx][colIdx].state,
    }));
  })();

  async function handleReschedule() {
    if (!appointment || !picked) return;
    setBusy(true);
    setError(null);
    try {
      await rescheduleAppointment(appointment.id, {
        date: newDate,
        start_time: picked.start,
        end_time: picked.end,
      });
      setRescheduling(false);
      onChanged();
      onClose();
    } catch (err) {
      const status = (err as { status?: number }).status;
      setError(
        status === 409
          ? "That slot is unavailable (booked, off-day, or outside working hours)."
          : "Could not reschedule. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  const todayISO = new Date().toISOString().slice(0, 10);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Appointment Details"
      maxWidthClassName="max-w-lg"
      actions={
        rescheduling ? (
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setRescheduling(false)}
              disabled={busy}
            >
              Back
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={busy || !picked}
              onClick={handleReschedule}
            >
              {busy ? "Moving…" : "Confirm reschedule"}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
              Close
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => setRescheduling(true)}
            >
              Reschedule
            </button>
            {appointment.status !== "Cancelled" && (
              <button
                type="button"
                className="btn-primary"
                disabled={busy}
                onClick={() => handleStatus("Completed")}
              >
                Mark completed
              </button>
            )}
            {appointment.status === "Booked" && (
              <button
                type="button"
                className="btn-secondary border-status-error/40 text-status-error hover:bg-status-error-soft"
                disabled={busy}
                onClick={() => handleStatus("Cancelled")}
              >
                Cancel appointment
              </button>
            )}
          </>
        )
      }
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-xl font-semibold text-text-primary">
              {appointment.patient?.name ?? "Unknown patient"}
            </h3>
            <p className="mt-0.5 font-mono text-sm text-text-secondary">
              {appointment.patient?.phone ?? "—"}
            </p>
          </div>
          <Badge variant={statusVariant(appointment.status)}>{appointment.status}</Badge>
        </div>

        {/* Details grid */}
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-lg border border-border-custom bg-bg-app/50 px-4 py-3 sm:grid-cols-2">
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-text-secondary">Date</dt>
            <dd className="mt-0.5 font-mono text-sm text-text-primary">
              {formatDayLabel(appointment.date)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-text-secondary">Time</dt>
            <dd className="mt-0.5 font-mono text-sm text-text-primary">
              {toHHMM(appointment.start_time)}–{toHHMM(appointment.end_time)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-text-secondary">Therapist</dt>
            <dd className="mt-0.5 text-sm text-text-primary">
              {appointment.therapist?.name ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-text-secondary">Payment</dt>
            <dd className="mt-0.5 text-sm text-text-primary">
              {appointment.payment_method ?? "—"}
            </dd>
          </div>
          {appointment.notes && (
            <div className="sm:col-span-2">
              <dt className="text-[11px] uppercase tracking-wide text-text-secondary">Notes</dt>
              <dd className="mt-0.5 text-sm text-text-primary">{appointment.notes}</dd>
            </div>
          )}
        </dl>

        {/* Reschedule flow */}
        {rescheduling && (
          <div className="space-y-3 rounded-lg border border-primary/30 bg-primary-soft/30 px-4 py-3">
            <p className="text-sm font-medium text-primary-text-soft">
              Reschedule {appointment.therapist?.name ?? "therapist"}
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium text-text-primary" htmlFor="am-date">
                New date
              </label>
              <input
                id="am-date"
                type="date"
                className="input-field font-mono"
                value={newDate}
                min={todayISO}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>

            {newDate && (
              <div>
                <span className="mb-1.5 block text-sm font-medium text-text-primary">
                  Available slots
                </span>
                {gridLoading ? (
                  <p className="text-sm text-text-secondary">Loading availability…</p>
                ) : slotOptions.length === 0 ? (
                  <p className="rounded-lg bg-bg-app px-3 py-2 text-sm text-text-secondary">
                    No open slots for this therapist on that date.
                  </p>
                ) : (
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {slotOptions.map((s) => {
                      const selected = picked?.start === s.start;
                      const disabled = s.state !== "OPEN";
                      return (
                        <button
                          key={s.start}
                          type="button"
                          disabled={disabled}
                          onClick={() => setPicked({ start: s.start, end: s.end })}
                          className={`rounded-lg border px-2 py-1.5 font-mono text-xs transition-colors ${
                            selected
                              ? "border-primary bg-primary text-white"
                              : disabled
                                ? "cursor-not-allowed border-border-custom/40 bg-bg-app text-text-secondary/50 line-through"
                                : "border-border-custom bg-surface text-text-primary hover:border-primary/50 hover:bg-primary-soft/50"
                          }`}
                        >
                          {s.start}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {notice && (
          <p className="rounded-lg bg-status-success-soft px-3 py-2 text-sm text-status-success">
            {notice}
          </p>
        )}
        {error && (
          <p className="rounded-lg bg-status-error-soft px-3 py-2 text-sm text-status-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
