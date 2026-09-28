"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { PatientTable } from "@/components/patients/PatientTable";
import { PatientModal } from "@/components/patients/PatientModal";
import { DeletePatientDialog } from "@/components/patients/DeletePatientDialog";
import { usePageHeader } from "@/components/layout/page-header-context";
import { useAuth } from "@/lib/auth-context";
import { can } from "@/lib/permissions";
import {
  PATIENT_STATUSES,
  Patient,
  PatientFilters,
  TherapistSummary,
  fetchPatients,
  fetchTherapists,
} from "@/lib/patients";

export default function PatientsPage() {
  const { user, isAdmin } = useAuth();

  // UI gating from the permission map (backend still enforces 403).
  const canDeletePatients = isAdmin && can(user?.role, "patient.delete");

  // Data state
  const [patients, setPatients] = useState<Patient[]>([]);
  const [total, setTotal] = useState(0);
  const [therapists, setTherapists] = useState<TherapistSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filter state
  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState<PatientFilters>({});
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [deleting, setDeleting] = useState<Patient | null>(null);

  usePageHeader({
    title: "Patients",
    actions: (
      <button type="button" className="btn-primary" onClick={() => setModalOpen(true)}>
        + Add Patient
      </button>
    ),
  });

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await fetchPatients({ ...filters, skip: page * PAGE_SIZE, limit: PAGE_SIZE });
      setPatients(data.items);
      setTotal(data.total);
    } catch {
      setLoadError("Could not load patients. Is the backend running?");
    } finally {
      setIsLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetchTherapists()
      .then(setTherapists)
      .catch(() => setTherapists([]));
  }, []);

  // Debounce search: update the applied filters 350ms after typing stops.
  useEffect(() => {
    const t = setTimeout(() => {
      const next = searchInput.trim() || undefined;
      setFilters((f) => (f.search === next ? f : { ...f, search: next }));
      setPage(0);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const stats = useMemo(
    () => ({
      total,
      active: patients.filter((p) => p.status === "Active").length,
      onHold: patients.filter((p) => p.status === "On hold").length,
      completed: patients.filter((p) => p.status === "Completed").length,
    }),
    [patients, total],
  );

  const handleSaved = useCallback(
    (_saved: Patient) => {
      setModalOpen(false);
      setEditing(null);
      load();
    },
    [load],
  );

  const handleDeleted = useCallback(
    (_id: string) => {
      setDeleting(null);
      load();
    },
    [load],
  );

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      {/* Summary stat cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total patients" value={stats.total} subtext="in the clinic" trend="flat" />
        <StatCard label="Active" value={stats.active} subtext="currently in treatment" trend="up" />
        <StatCard label="On hold" value={stats.onHold} subtext="paused treatment" trend="flat" />
        <StatCard label="Completed" value={stats.completed} subtext="discharged care" trend="down" />
      </section>

      {/* Toolbar + table */}
      <Card paddingClassName="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-border-custom/70 px-5 py-4">
          {/* Search */}
          <input
            type="search"
            className="input-field sm:max-w-xs"
            placeholder="Search by name or phone…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search patients"
          />

          {/* Therapist filter */}
          <select
            className="input-field sm:max-w-56"
            value={filters.therapist_id ?? ""}
            onChange={(e) => {
              setFilters((f) => ({ ...f, therapist_id: e.target.value || undefined }));
              setPage(0);
            }}
            aria-label="Filter by therapist"
          >
            <option value="">All therapists</option>
            {therapists.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          {/* Status filter */}
          <select
            className="input-field sm:max-w-44"
            value={filters.status ?? ""}
            onChange={(e) => {
              setFilters((f) => ({ ...f, status: e.target.value || undefined }));
              setPage(0);
            }}
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            {PATIENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <div className="ml-auto text-xs text-text-secondary">
            {isLoading ? "Loading…" : `${total} patient${total === 1 ? "" : "s"}`}
          </div>
        </div>

        {loadError && (
          <div className="border-b border-status-error-soft bg-status-error-soft px-5 py-3 text-sm text-status-error">
            {loadError}
          </div>
        )}

        <PatientTable
          patients={patients}
          emptyMessage={searchInput || filters.status || filters.therapist_id ? "No matching patients" : "No patients yet"}
          renderActions={(p) => (
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary-text-soft transition-colors hover:bg-primary-soft"
                onClick={() => {
                  setEditing(p);
                  setModalOpen(true);
                }}
              >
                Edit
              </button>
              {/* Admin-only action — hidden for STAFF (backend enforces 403). */}
              {canDeletePatients && (
                <button
                  type="button"
                  className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-status-error transition-colors hover:bg-status-error-soft"
                  onClick={() => setDeleting(p)}
                >
                  Delete
                </button>
              )}
            </div>
          )}
        />

        {/* Pagination */}
        {!isLoading && total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-border-custom/70 px-5 py-3">
            <span className="font-mono text-xs text-text-secondary">
              Page {page + 1} of {pageCount}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary px-3 py-1.5 text-xs"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                ← Prev
              </button>
              <button
                type="button"
                className="btn-secondary px-3 py-1.5 text-xs"
                disabled={page + 1 >= pageCount}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Modals */}
      <PatientModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        patient={editing}
        onSaved={handleSaved}
      />
      <DeletePatientDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        patient={deleting}
        isAdmin={isAdmin}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
