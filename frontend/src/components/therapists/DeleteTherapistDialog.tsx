"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { deleteTherapist, type DeleteConflict, type Therapist } from "@/lib/therapists";

/**
 * Deletion / conflict dialog for therapists.
 *
 * Flow: plain confirm → DELETE; on 409 (upcoming booked appointments) the
 * dialog expands to offer the two backend resolutions —
 *   • action=cancel   → cancel upcoming bookings & deactivate
 *   • action=unassign → remove appointments & hard-delete
 */

export interface DeleteTherapistDialogProps {
  open: boolean;
  onClose: () => void;
  therapist: Therapist | null;
  isAdmin: boolean;
  onDeleted: () => void;
}

export function DeleteTherapistDialog({
  open,
  onClose,
  therapist,
  isAdmin,
  onDeleted,
}: DeleteTherapistDialogProps) {
  const [phase, setPhase] = useState<"confirm" | "conflict">("confirm");
  const [conflict, setConflict] = useState<DeleteConflict | null>(null);
  const [busy, setBusy] = useState<"cancel" | "unassign" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function attempt(action?: "cancel" | "unassign") {
    if (!therapist) return;
    setBusy(action ?? "cancel");
    setError(null);
    try {
      await deleteTherapist(therapist.id, action);
      setPhase("confirm");
      setConflict(null);
      setBusy(null);
      onDeleted();
      onClose();
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 409) {
        // Backend body is { detail: { message, upcoming_appointments, assigned_patients } }.
        const raw = (err as { message?: string }).message ?? "";
        let parsed: DeleteConflict | null = null;
        try {
          const obj = JSON.parse(raw) as { detail?: DeleteConflict } & Partial<DeleteConflict>;
          if (obj?.detail && typeof obj.detail === "object") {
            parsed = obj.detail;
          } else if (obj && typeof obj.message === "string") {
            parsed = obj as DeleteConflict;
          }
        } catch {
          parsed = null;
        }
        setConflict(
          parsed ?? {
            message: "This therapist has upcoming booked appointments.",
            upcoming_appointments: 0,
            assigned_patients: 0,
          },
        );
        setPhase("conflict");
      } else if (status === 403) {
        setError("Only admins can delete therapist records.");
      } else {
        setError("Could not delete the therapist. Please try again.");
      }
    } finally {
      setBusy(null);
    }
  }

  function handleClose() {
    setPhase("confirm");
    setConflict(null);
    setError(null);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={phase === "conflict" ? "Upcoming appointments found" : "Delete therapist"}
      maxWidthClassName="max-w-md"
      actions={
        phase === "conflict" ? (
          <>
            <button type="button" className="btn-secondary" onClick={handleClose} disabled={busy !== null}>
              Keep therapist
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={busy !== null}
              onClick={() => attempt("cancel")}
            >
              {busy === "cancel" ? "Cancelling…" : "Cancel & deactivate"}
            </button>
            <button
              type="button"
              className="btn-secondary border-status-error/40 text-status-error hover:bg-status-error-soft"
              disabled={busy !== null}
              onClick={() => attempt("unassign")}
            >
              {busy === "unassign" ? "Deleting…" : "Unassign & delete"}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn-secondary" onClick={handleClose} disabled={busy !== null}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary bg-status-error hover:bg-status-error/90"
              disabled={busy !== null || !isAdmin}
              onClick={() => attempt()}
            >
              {busy === "cancel" ? "Deleting…" : "Delete"}
            </button>
          </>
        )
      }
    >
      {!therapist ? null : phase === "conflict" && conflict ? (
        <div className="space-y-4">
          <p className="rounded-lg bg-status-neutral-soft px-3 py-2 font-mono text-sm text-status-neutral">
            {conflict.upcoming_appointments} upcoming · {conflict.assigned_patients} assigned
          </p>
          <p className="text-sm text-text-primary">
            <span className="font-semibold">{therapist.name}</span> still has{" "}
            <span className="font-semibold">{conflict.upcoming_appointments}</span> upcoming booked
            appointment{conflict.upcoming_appointments === 1 ? "" : "s"}. Choose how to resolve
            them:
          </p>

          {/* Resolution options */}
          <div className="space-y-2">
            <div className="rounded-lg border border-border-custom bg-surface px-3 py-2.5">
              <p className="text-sm font-medium text-text-primary">Cancel &amp; deactivate</p>
              <p className="mt-0.5 text-xs text-text-secondary">
                Cancels the upcoming bookings and deactivates the profile. Full history is kept.
              </p>
            </div>
            <div className="rounded-lg border border-border-custom bg-surface px-3 py-2.5">
              <p className="text-sm font-medium text-status-error">Unassign &amp; delete</p>
              <p className="mt-0.5 text-xs text-text-secondary">
                Removes the appointments and permanently deletes the therapist, overrides and
                patient assignments.
              </p>
            </div>
          </div>

          {error && (
            <p
              className="rounded-lg bg-status-error-soft px-3 py-2 text-sm text-status-error"
              role="alert"
            >
              {error}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-text-primary">
            You are about to delete <span className="font-semibold">{therapist.name}</span>{" "}
            <span className="font-mono text-xs text-text-secondary">({therapist.specialty})</span>.
          </p>
          <p className="text-sm text-text-secondary">
            If they have upcoming booked appointments you will be asked how to handle them.
          </p>
          {!isAdmin && (
            <p className="rounded-lg bg-status-neutral-soft px-3 py-2 text-sm text-status-neutral">
              Your role does not permit deletion. Ask an administrator.
            </p>
          )}
          {error && (
            <p
              className="rounded-lg bg-status-error-soft px-3 py-2 text-sm text-status-error"
              role="alert"
            >
              {error}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
