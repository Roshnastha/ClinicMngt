"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/api-client";
import { fetchPatients } from "@/lib/patients";
import {
  PAYMENT_METHODS,
  bookAppointment,
  toHHMM,
  type Appointment,
  type DailyGrid,
  type PatientMini,
} from "@/lib/schedule";

/**
 * Book Appointment modal — patient selector, therapist selector, date,
 * slot picker (from the grid), payment method and notes. The slot picker
 * disables booked/off slots from the same day's grid so the user gets an
 * immediate warning before submitting; the backend re-checks authoritatively.
 */

export interface BookAppointmentModalProps {
  open: boolean;
  onClose: () => void;
  /** Grid for the selected date (used for the slot picker availability). */
  grid: DailyGrid | null;
  /** Pre-fills from a clicked OPEN cell. */
  prefill?: { therapistId?: string; date?: string; startTime?: string } | null;
  onBooked: (appointment: Appointment) => void;
}

interface PatientPage {
  items: PatientMini[];
}

export function BookAppointmentModal({
  open,
  onClose,
  grid,
  prefill,
  onBooked,
}: BookAppointmentModalProps) {
  const [patients, setPatients] = useState<PatientMini[]>([]);
  const [form, setForm] = useState({
    patient_id: "",
    therapist_id: prefill?.therapistId ?? "",
    date: prefill?.date ?? "",
    start_time: prefill?.startTime ?? "",
    end_time: "",
  });
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load patient options (flat list from the paginated endpoint).
  useEffect(() => {
    if (!open) return;
    api
      .get<PatientPage>("/patients?limit=500")
      .then((page) => setPatients(page.items))
      .catch(() => setPatients([]));
  }, [open]);

  // Hydrate on open / prefill change.
  useEffect(() => {
    if (!open) return;
    setServerError(null);
    setFieldErrors({});
    setForm((f) => ({
      ...f,
      therapist_id: prefill?.therapistId ?? f.therapist_id,
      date: prefill?.date ?? f.date,
      start_time: prefill?.startTime ?? f.start_time,
      end_time: "",
    }));
  }, [open, prefill]);

  const therapistColumns = grid?.therapists ?? [];
  const selectedTherapistId = form.therapist_id;

  // Slot availability for the chosen therapist on the grid's date.
  const slotOptions = useMemo(() => {
    if (!grid) return [];
    const colIdx = grid.therapists.findIndex((c) => c.therapist.id === selectedTherapistId);
    if (colIdx === -1) return [];
    return grid.slots
      .map((slot, rowIdx) => ({ slot, cell: grid.cells[rowIdx][colIdx] }))
      .map(({ slot, cell }) => ({
        start: toHHMM(slot),
        end: toHHMM(cell.slot_end),
        state: cell.state,
      }));
  }, [grid, selectedTherapistId]);

  // End time is derived from the picked slot.
  useEffect(() => {
    if (!grid || !form.start_time || !selectedTherapistId) return;
    const colIdx = grid.therapists.findIndex((c) => c.therapist.id === selectedTherapistId);
    if (colIdx === -1) return;
    const row = grid.slots.findIndex((s) => toHHMM(s) === form.start_time);
    if (row === -1) return;
    setForm((f) => ({ ...f, end_time: toHHMM(grid.cells[row][colIdx].slot_end) }));
  }, [grid, form.start_time, selectedTherapistId]);

  // Client-side warning if the selected slot is not OPEN.
  const slotWarning = useMemo(() => {
    if (!form.start_time || !selectedTherapistId || !grid) return null;
    const colIdx = grid.therapists.findIndex((c) => c.therapist.id === selectedTherapistId);
    const rowIdx = grid.slots.findIndex((s) => toHHMM(s) === form.start_time);
    if (colIdx === -1 || rowIdx === -1) return null;
    const state = grid.cells[rowIdx][colIdx].state;
    if (state === "BOOKED") return "That slot is already booked — pick another.";
    if (state === "THERAPIST_OFF") return "The therapist is off / outside working hours then.";
    return null;
  }, [grid, form.start_time, selectedTherapistId]);

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!form.patient_id) errors.patient_id = "Select a patient.";
    if (!form.therapist_id) errors.therapist_id = "Select a therapist.";
    if (!form.date) errors.date = "Pick a date.";
    if (!form.start_time) errors.start_time = "Pick a time slot.";
    if (slotWarning) errors.start_time = slotWarning;
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;

    setSaving(true);
    try {
      const saved = await bookAppointment({
        patient_id: form.patient_id,
        therapist_id: form.therapist_id,
        date: form.date,
        start_time: form.start_time,
        end_time: form.end_time,
        payment_method: paymentMethod || null,
        notes: notes.trim() || null,
      });
      onBooked(saved);
      onClose();
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 409) {
        setServerError("That slot is no longer available (conflict). Pick another slot.");
      } else if (status === 404) {
        setServerError("Patient or therapist no longer exists.");
      } else {
        setServerError("Could not book the appointment. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  const todayISO = new Date().toISOString().slice(0, 10);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Book Appointment"
      maxWidthClassName="max-w-2xl"
      actions={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="book-form" className="btn-primary" disabled={saving}>
            {saving ? "Booking…" : "Book appointment"}
          </button>
        </>
      }
    >
      <form id="book-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Patient */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary" htmlFor="bm-patient">
              Patient *
            </label>
            <select
              id="bm-patient"
              className="input-field"
              value={form.patient_id}
              onChange={(e) => setForm((f) => ({ ...f, patient_id: e.target.value }))}
            >
              <option value="">Select patient…</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.phone})
                </option>
              ))}
            </select>
            {fieldErrors.patient_id && (
              <p className="mt-1 text-xs text-status-error">{fieldErrors.patient_id}</p>
            )}
          </div>

          {/* Therapist */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary" htmlFor="bm-therapist">
              Therapist *
            </label>
            <select
              id="bm-therapist"
              className="input-field"
              value={form.therapist_id}
              onChange={(e) => setForm((f) => ({ ...f, therapist_id: e.target.value, start_time: "", end_time: "" }))}
            >
              <option value="">Select therapist…</option>
              {therapistColumns.map((c) => (
                <option key={c.therapist.id} value={c.therapist.id}>
                  {c.therapist.name}
                  {c.on_duty ? "" : " (off this day)"}
                </option>
              ))}
            </select>
            {fieldErrors.therapist_id && (
              <p className="mt-1 text-xs text-status-error">{fieldErrors.therapist_id}</p>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary" htmlFor="bm-date">
              Date *
            </label>
            <input
              id="bm-date"
              type="date"
              className="input-field font-mono"
              value={form.date}
              onChange={(e) =>
                setForm((f) => ({ ...f, date: e.target.value, start_time: "", end_time: "" }))
              }
              min={todayISO}
            />
            {fieldErrors.date && (
              <p className="mt-1 text-xs text-status-error">{fieldErrors.date}</p>
            )}
          </div>

          {/* Payment method */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary" htmlFor="bm-pay">
              Payment Method
            </label>
            <select
              id="bm-pay"
              className="input-field"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option value="">Not specified</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Slot picker (from the grid) */}
        <div>
          <span className="mb-1.5 block text-sm font-medium text-text-primary">Time Slot *</span>
          {!grid || !form.date || form.date !== grid.date ? (
            <p className="rounded-lg bg-bg-app px-3 py-2 text-sm text-text-secondary">
              The slot picker shows availability for {grid ? "the selected day" : "…"} — pick a
              slot after choosing a therapist for that date.
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {slotOptions.map((s) => {
                const selected = form.start_time === s.start;
                const disabled = s.state !== "OPEN";
                return (
                  <button
                    key={s.start}
                    type="button"
                    disabled={disabled}
                    onClick={() => setForm((f) => ({ ...f, start_time: s.start }))}
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
          {fieldErrors.start_time && (
            <p className="mt-1 text-xs text-status-error">{fieldErrors.start_time}</p>
          )}
          {slotWarning && !fieldErrors.start_time && (
            <p className="mt-1 text-xs text-status-error" role="alert">
              {slotWarning}
            </p>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary" htmlFor="bm-notes">
            Notes
          </label>
          <textarea
            id="bm-notes"
            rows={2}
            className="input-field resize-none"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Session focus, reminders…"
          />
        </div>

        {/* Server error */}
        {serverError && (
          <div
            className="rounded-lg border border-status-error-soft bg-status-error-soft px-3 py-2 text-sm text-status-error"
            role="alert"
          >
            {serverError}
          </div>
        )}
      </form>
    </Modal>
  );
}
