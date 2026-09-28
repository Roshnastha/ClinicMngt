"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Patient, deletePatient } from "@/lib/patients";

/**
 * Delete confirmation dialog — warning modal before permanent removal.
 * Delete is admin-only on the backend; staff see a read-only hint.
 */

export interface DeletePatientDialogProps {
  open: boolean;
  onClose: () => void;
  patient: Patient | null;
  isAdmin: boolean;
  onDeleted: (id: string) => void;
}

export function DeletePatientDialog({
  open,
  onClose,
  patient,
  isAdmin,
  onDeleted,
}: DeletePatientDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!patient) return;
    setDeleting(true);
    setError(null);
    try {
      await deletePatient(patient.id);
      onDeleted(patient.id);
      onClose();
    } catch (err) {
      const status = (err as { status?: number }).status;
      setError(
        status === 403
          ? "Only admins can delete patient records."
          : "Could not delete the patient. Please try again."
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Delete patient"
      maxWidthClassName="max-w-md"
      actions={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={deleting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary bg-status-error hover:bg-status-error/90"
            onClick={handleConfirm}
            disabled={deleting || !isAdmin}
          >
            {deleting ? "Deleting…" : "Delete permanently"}
          </button>
        </>
      }
    >
      {patient ? (
        <div className="space-y-3">
          <p className="text-sm text-text-primary">
            You are about to permanently delete{" "}
            <span className="font-semibold">{patient.name}</span>
            <span className="font-mono text-xs text-text-secondary"> ({patient.phone})</span> and
            unlink their appointment and invoice history.
          </p>
          {!isAdmin && (
            <p className="rounded-lg bg-status-neutral-soft px-3 py-2 text-sm text-status-neutral">
              Your role does not permit deletion. Ask an administrator.
            </p>
          )}
          {error && (
            <p className="rounded-lg bg-status-error-soft px-3 py-2 text-sm text-status-error" role="alert">
              {error}
            </p>
          )}
        </div>
      ) : null}
    </Modal>
  );
}
