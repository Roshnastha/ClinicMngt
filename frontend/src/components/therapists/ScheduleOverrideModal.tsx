"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { formatHours, upsertOverride, type Therapist, type TherapistOverride } from "@/lib/therapists";

/**
 * Schedule override modal — one specific date: day off or custom hours.
 * Upsert semantics (one override per date). Admin-only on the backend.
 */

export interface ScheduleOverrideModalProps {
  open: boolean;
  onClose: () => void;
  therapist: Therapist;
  /** Existing override for the selected date, when editing. */
  existingOverride?: TherapistOverride | null;
  /** Called after a successful upsert. */
  onSaved: (override: TherapistOverride) => void;
}

interface FormState {
  date: string; // "YYYY-MM-DD"
  mode: "day_off" | "custom";
  custom_start_time: string;
  custom_end_time: string;
  notes: string;
}

function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const EMPTY_FORM: FormState = {
  date: "",
  mode: "day_off",
  custom_start_time: "09:00",
  custom_end_time: "13:00",
  notes: "",
};

export function ScheduleOverrideModal({
  open,
  onClose,
  therapist,
  existingOverride,
  onSaved,
}: ScheduleOverrideModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setServerError(null);
    setFieldErrors({});
    if (existingOverride) {
      setForm({
        date: existingOverride.date,
        mode: existingOverride.is_day_off ? "day_off" : "custom",
        custom_start_time: existingOverride.custom_start_time
          ? existingOverride.custom_start_time.slice(0, 5)
          : "09:00",
        custom_end_time: existingOverride.custom_end_time
          ? existingOverride.custom_end_time.slice(0, 5)
          : "13:00",
        notes: existingOverride.notes ?? "",
      });
    } else {
      setForm({ ...EMPTY_FORM, date: todayISO() });
    }
  }, [open, existingOverride]);

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!form.date) errors.date = "Pick a date.";
    if (form.mode === "custom") {
      if (!form.custom_start_time) errors.custom_start_time = "Start time is required.";
      if (!form.custom_end_time) errors.custom_end_time = "End time is required.";
      if (
        form.custom_start_time &&
        form.custom_end_time &&
        form.custom_end_time <= form.custom_start_time
      ) {
        errors.custom_end_time = "End time must be after start time.";
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;

    setSaving(true);
    try {
      const isDayOff = form.mode === "day_off";
      const saved = await upsertOverride(therapist.id, {
        date: form.date,
        is_day_off: isDayOff,
        custom_start_time: isDayOff ? null : form.custom_start_time,
        custom_end_time: isDayOff ? null : form.custom_end_time,
        notes: form.notes.trim() || null,
      });
      onSaved(saved);
      onClose();
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 403) {
        setServerError("Only admins can manage schedule overrides.");
      } else if (status === 422) {
        setServerError("Invalid schedule — check the times and try again.");
      } else {
        setServerError("Could not save the override. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  const isDayOff = form.mode === "day_off";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Schedule Override"
      maxWidthClassName="max-w-lg"
      actions={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="override-form" className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save override"}
          </button>
        </>
      }
    >
      <form id="override-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Context strip */}
        <p className="rounded-lg bg-bg-app px-3 py-2 text-sm text-text-secondary">
          {therapist.name} · standard hours{" "}
          <span className="font-mono">{formatHours(therapist)}</span>
        </p>

        {/* Date */}
        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary" htmlFor="om-date">
            Date *
          </label>
          <input
            id="om-date"
            type="date"
            className="input-field font-mono"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          />
          {fieldErrors.date && <p className="mt-1 text-xs text-status-error">{fieldErrors.date}</p>}
        </div>

        {/* Mode toggle: Day off ↔ Custom hours */}
        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-text-primary">Type *</legend>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { value: "day_off", label: "Mark as Day Off" },
                { value: "custom", label: "Custom Working Hours" },
              ] as const
            ).map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer select-none items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                  form.mode === opt.value
                    ? "border-primary/40 bg-primary-soft text-primary-text-soft"
                    : "border-border-custom bg-surface text-text-secondary hover:bg-primary-soft/40"
                }`}
              >
                <input
                  type="radio"
                  name="override-mode"
                  className="sr-only"
                  checked={form.mode === opt.value}
                  onChange={() => setForm((f) => ({ ...f, mode: opt.value }))}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </fieldset>

        {/* Custom hours (enabled when not a day off) */}
        <div className={`grid grid-cols-2 gap-4 ${isDayOff ? "opacity-50" : ""}`}>
          <div>
            <label
              className="mb-1 block text-sm font-medium text-text-primary"
              htmlFor="om-start"
            >
              Custom Start
            </label>
            <input
              id="om-start"
              type="time"
              className="input-field font-mono"
              value={form.custom_start_time}
              disabled={isDayOff}
              onChange={(e) => setForm((f) => ({ ...f, custom_start_time: e.target.value }))}
            />
            {fieldErrors.custom_start_time && (
              <p className="mt-1 text-xs text-status-error">{fieldErrors.custom_start_time}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary" htmlFor="om-end">
              Custom End
            </label>
            <input
              id="om-end"
              type="time"
              className="input-field font-mono"
              value={form.custom_end_time}
              disabled={isDayOff}
              onChange={(e) => setForm((f) => ({ ...f, custom_end_time: e.target.value }))}
            />
            {fieldErrors.custom_end_time && (
              <p className="mt-1 text-xs text-status-error">{fieldErrors.custom_end_time}</p>
            )}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary" htmlFor="om-notes">
            Reason / Notes
          </label>
          <textarea
            id="om-notes"
            rows={2}
            maxLength={255}
            className="input-field resize-none"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder="e.g. Conference leave, medical appointment…"
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
