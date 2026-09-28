"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  createTherapist,
  SHORT_DAYS,
  SLOT_DURATIONS,
  updateTherapist,
  VALID_DAYS,
  type SlotDuration,
  type Therapist,
  type Weekday,
} from "@/lib/therapists";

/**
 * Add / Edit therapist modal — profile + default weekly schedule.
 * Shared form for create and edit with client-side validation,
 * loading and server-error states. Admin-only on the backend.
 */

export interface TherapistModalProps {
  open: boolean;
  onClose: () => void;
  /** Therapist to edit; omit/`null` for create mode. */
  therapist?: Therapist | null;
  /** Called after a successful create or update with the saved record. */
  onSaved: (therapist: Therapist) => void;
}

interface FormState {
  name: string;
  specialty: string;
  working_days: Weekday[];
  start_time: string; // "HH:MM" ("" = unset)
  end_time: string;
  slot_duration_minutes: SlotDuration;
}

const DEFAULT_WORKING_DAYS: Weekday[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
];

const EMPTY_FORM: FormState = {
  name: "",
  specialty: "",
  working_days: DEFAULT_WORKING_DAYS,
  start_time: "09:00",
  end_time: "17:00",
  slot_duration_minutes: 60,
};

export function TherapistModal({ open, onClose, therapist, onSaved }: TherapistModalProps) {
  const isEdit = Boolean(therapist);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Hydrate the form when opening; reset when creating.
  useEffect(() => {
    if (!open) return;
    setServerError(null);
    setFieldErrors({});
    if (therapist) {
      setForm({
        name: therapist.name,
        specialty: therapist.specialty,
        working_days: (therapist.working_days as Weekday[]) ?? [],
        start_time: therapist.start_time ? therapist.start_time.slice(0, 5) : "",
        end_time: therapist.end_time ? therapist.end_time.slice(0, 5) : "",
        slot_duration_minutes: (SLOT_DURATIONS.includes(
          therapist.slot_duration_minutes as SlotDuration,
        )
          ? therapist.slot_duration_minutes
          : 60) as SlotDuration,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, therapist]);

  function toggleDay(day: Weekday) {
    setForm((f) => ({
      ...f,
      working_days: f.working_days.includes(day)
        ? f.working_days.filter((d) => d !== day)
        : VALID_DAYS.filter((d) => f.working_days.includes(d) || d === day), // keep Mon→Sun order
    }));
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = "Full name is required.";
    if (!form.specialty.trim()) errors.specialty = "Specialty is required.";
    if (form.working_days.length === 0) {
      errors.working_days = "Select at least one working day.";
    }
    if (!form.start_time) errors.start_time = "Start time is required.";
    if (!form.end_time) errors.end_time = "End time is required.";
    if (form.start_time && form.end_time && form.end_time <= form.start_time) {
      errors.end_time = "End time must be after start time.";
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
      const payload = {
        name: form.name.trim(),
        specialty: form.specialty.trim(),
        working_days: form.working_days,
        start_time: form.start_time, // "HH:MM" — FastAPI parses into time
        end_time: form.end_time,
        slot_duration_minutes: form.slot_duration_minutes,
      };
      const saved = isEdit && therapist
        ? await updateTherapist(therapist.id, payload)
        : await createTherapist(payload);
      onSaved(saved);
      onClose();
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 403) {
        setServerError("Only admins can manage therapist records.");
      } else if (status === 409) {
        setServerError("A schedule conflict was detected. Please review and retry.");
      } else {
        setServerError("Could not save the therapist. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Therapist" : "Add Therapist"}
      maxWidthClassName="max-w-2xl"
      actions={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="therapist-form" className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Add therapist"}
          </button>
        </>
      }
    >
      <form id="therapist-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Full name */}
        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary" htmlFor="tm-name">
            Full Name *
          </label>
          <input
            id="tm-name"
            type="text"
            className="input-field"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Dr. Sarah Chen"
          />
          {fieldErrors.name && <p className="mt-1 text-xs text-status-error">{fieldErrors.name}</p>}
        </div>

        {/* Specialty */}
        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary" htmlFor="tm-specialty">
            Specialty *
          </label>
          <input
            id="tm-specialty"
            type="text"
            className="input-field"
            value={form.specialty}
            onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))}
            placeholder="e.g. Sports Injuries"
          />
          {fieldErrors.specialty && (
            <p className="mt-1 text-xs text-status-error">{fieldErrors.specialty}</p>
          )}
        </div>

        {/* Working days */}
        <fieldset>
          <legend className="mb-1.5 block text-sm font-medium text-text-primary">
            Working Days *
          </legend>
          <div className="flex flex-wrap gap-2">
            {VALID_DAYS.map((day) => {
              const checked = form.working_days.includes(day);
              return (
                <label
                  key={day}
                  className={`flex cursor-pointer select-none items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                    checked
                      ? "border-primary/40 bg-primary-soft text-primary-text-soft"
                      : "border-border-custom bg-surface text-text-secondary hover:bg-primary-soft/40"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="accent-[#B8763A]"
                    checked={checked}
                    onChange={() => toggleDay(day)}
                  />
                  {SHORT_DAYS[day]}
                </label>
              );
            })}
          </div>
          {fieldErrors.working_days && (
            <p className="mt-1 text-xs text-status-error">{fieldErrors.working_days}</p>
          )}
        </fieldset>

        {/* Hours + slot duration */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary" htmlFor="tm-start">
              Start Time *
            </label>
            <input
              id="tm-start"
              type="time"
              className="input-field font-mono"
              value={form.start_time}
              onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
            />
            {fieldErrors.start_time && (
              <p className="mt-1 text-xs text-status-error">{fieldErrors.start_time}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary" htmlFor="tm-end">
              End Time *
            </label>
            <input
              id="tm-end"
              type="time"
              className="input-field font-mono"
              value={form.end_time}
              onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
            />
            {fieldErrors.end_time && (
              <p className="mt-1 text-xs text-status-error">{fieldErrors.end_time}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary" htmlFor="tm-slot">
              Slot Duration *
            </label>
            <select
              id="tm-slot"
              className="input-field font-mono"
              value={form.slot_duration_minutes}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  slot_duration_minutes: Number(e.target.value) as SlotDuration,
                }))
              }
            >
              {SLOT_DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d} minutes
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Live weekly-hours preview */}
        {form.start_time && form.end_time && form.end_time > form.start_time && (
          <p className="rounded-lg bg-primary-soft/50 px-3 py-2 text-sm text-primary-text-soft">
            Weekly hours:{" "}
            <span className="font-mono font-medium">
              {(
                form.working_days.length *
                ((Number(form.end_time.slice(0, 2)) * 60 + Number(form.end_time.slice(3, 5)) -
                  Number(form.start_time.slice(0, 2)) * 60 -
                  Number(form.start_time.slice(3, 5))) /
                  60)
              ).toFixed(1)}
              h
            </span>
          </p>
        )}

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
