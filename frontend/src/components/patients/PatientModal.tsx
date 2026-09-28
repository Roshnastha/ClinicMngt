"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  PATIENT_STATUSES,
  Patient,
  PatientInput,
  TherapistSummary,
  createPatient,
  fetchTherapists,
  updatePatient,
} from "@/lib/patients";

/**
 * Add / Edit patient modal — shared form for creating and editing records,
 * with client-side validation, loading and server-error states.
 */

export interface PatientModalProps {
  open: boolean;
  onClose: () => void;
  /** Patient to edit; omit/`null` for create mode. */
  patient?: Patient | null;
  /** Called after a successful create or update with the saved record. */
  onSaved: (patient: Patient) => void;
}

const GENDERS = ["Male", "Female", "Other"] as const;

const PACKAGES = [
  "Pay-as-you-go",
  "10-Session Rehab",
  "15-Session Rehab",
] as const;

interface FormState {
  name: string;
  phone: string;
  age: string;
  gender: string;
  address: string;
  condition: string;
  assigned_therapist_id: string;
  package: string;
  status: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  phone: "",
  age: "",
  gender: "Male",
  address: "",
  condition: "",
  assigned_therapist_id: "",
  package: "Pay-as-you-go",
  status: "Active",
};

export function PatientModal({ open, onClose, patient, onSaved }: PatientModalProps) {
  const isEdit = Boolean(patient);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [therapists, setTherapists] = useState<TherapistSummary[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load therapists once per open; hydrate the form when editing.
  useEffect(() => {
    if (!open) return;
    fetchTherapists()
      .then(setTherapists)
      .catch(() => setTherapists([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setServerError(null);
    setFieldErrors({});
    if (patient) {
      setForm({
        name: patient.name,
        phone: patient.phone,
        age: String(patient.age),
        gender: patient.gender,
        address: patient.address ?? "",
        condition: patient.condition ?? "",
        assigned_therapist_id: patient.assigned_therapist_id ?? "",
        package: patient.package ?? "",
        status: patient.status,
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, patient]);

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = "Full name is required.";
    if (!form.phone.trim()) {
      errors.phone = "Phone number is required.";
    } else if (!/^[+\d][\d\s-]{5,19}$/.test(form.phone.trim())) {
      errors.phone = "Enter a valid phone number.";
    }
    const age = Number(form.age);
    if (!form.age.trim()) {
      errors.age = "Age is required.";
    } else if (!Number.isInteger(age) || age < 0 || age > 120) {
      errors.age = "Age must be a whole number between 0 and 120.";
    }
    if (!form.gender) errors.gender = "Select a gender.";
    if (!form.status || !PATIENT_STATUSES.includes(form.status as never)) {
      errors.status = "Select a status.";
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
      const payload: PatientInput = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        age: Number(form.age),
        gender: form.gender,
        address: form.address.trim() || null,
        condition: form.condition.trim() || null,
        assigned_therapist_id: form.assigned_therapist_id || null,
        package: form.package || null,
        status: form.status,
      };
      const saved = isEdit && patient
        ? await updatePatient(patient.id, payload)
        : await createPatient(payload);
      onSaved(saved);
      onClose();
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 404) {
        setServerError("Assigned therapist no longer exists.");
      } else {
        setServerError("Could not save the patient. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit Patient" : "Add Patient"}
      maxWidthClassName="max-w-2xl"
      actions={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="patient-form" className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Add patient"}
          </button>
        </>
      }
    >
      <form id="patient-form" onSubmit={handleSubmit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Full name */}
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-text-primary" htmlFor="pm-name">
            Full Name *
          </label>
          <input
            id="pm-name"
            type="text"
            className="input-field"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Amit Kumar"
          />
          {fieldErrors.name && <p className="mt-1 text-xs text-status-error">{fieldErrors.name}</p>}
        </div>

        {/* Phone */}
        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary" htmlFor="pm-phone">
            Phone Number *
          </label>
          <input
            id="pm-phone"
            type="tel"
            className="input-field font-mono"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            placeholder="9876543210"
          />
          {fieldErrors.phone && <p className="mt-1 text-xs text-status-error">{fieldErrors.phone}</p>}
        </div>

        {/* Age */}
        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary" htmlFor="pm-age">
            Age *
          </label>
          <input
            id="pm-age"
            type="number"
            min={0}
            max={120}
            className="input-field font-mono"
            value={form.age}
            onChange={(e) => set("age", e.target.value)}
            placeholder="34"
          />
          {fieldErrors.age && <p className="mt-1 text-xs text-status-error">{fieldErrors.age}</p>}
        </div>

        {/* Gender */}
        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary" htmlFor="pm-gender">
            Gender *
          </label>
          <select
            id="pm-gender"
            className="input-field"
            value={form.gender}
            onChange={(e) => set("gender", e.target.value)}
          >
            {GENDERS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary" htmlFor="pm-status">
            Status *
          </label>
          <select
            id="pm-status"
            className="input-field"
            value={form.status}
            onChange={(e) => set("status", e.target.value)}
          >
            {PATIENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {fieldErrors.status && <p className="mt-1 text-xs text-status-error">{fieldErrors.status}</p>}
        </div>

        {/* Address */}
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-text-primary" htmlFor="pm-address">
            Address
          </label>
          <input
            id="pm-address"
            type="text"
            className="input-field"
            value={form.address}
            onChange={(e) => set("address", e.target.value)}
            placeholder="Street, city"
          />
        </div>

        {/* Condition */}
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-text-primary" htmlFor="pm-condition">
            Condition / Diagnosis
          </label>
          <input
            id="pm-condition"
            type="text"
            className="input-field"
            value={form.condition}
            onChange={(e) => set("condition", e.target.value)}
            placeholder="e.g. Lower Back Pain"
          />
        </div>

        {/* Therapist */}
        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary" htmlFor="pm-therapist">
            Assigned Therapist
          </label>
          <select
            id="pm-therapist"
            className="input-field"
            value={form.assigned_therapist_id}
            onChange={(e) => set("assigned_therapist_id", e.target.value)}
          >
            <option value="">Unassigned</option>
            {therapists.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} — {t.specialty}
              </option>
            ))}
          </select>
        </div>

        {/* Package */}
        <div>
          <label className="mb-1 block text-sm font-medium text-text-primary" htmlFor="pm-package">
            Package
          </label>
          <select
            id="pm-package"
            className="input-field"
            value={form.package}
            onChange={(e) => set("package", e.target.value)}
          >
            {PACKAGES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {/* Server error / submission feedback */}
        {serverError && (
          <div className="sm:col-span-2 rounded-lg border border-status-error-soft bg-status-error-soft px-3 py-2 text-sm text-status-error" role="alert">
            {serverError}
          </div>
        )}
      </form>
    </Modal>
  );
}
