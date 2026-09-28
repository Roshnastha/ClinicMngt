"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/Badge";
import { TherapistList } from "@/components/therapists/TherapistList";
import { TherapistModal } from "@/components/therapists/TherapistModal";
import { ScheduleOverrideModal } from "@/components/therapists/ScheduleOverrideModal";
import { DeleteTherapistDialog } from "@/components/therapists/DeleteTherapistDialog";
import { usePageHeader } from "@/components/layout/page-header-context";
import { useAuth } from "@/lib/auth-context";
import {
  fetchOverrides,
  fetchTherapists,
  type Therapist,
  type TherapistOverride,
} from "@/lib/therapists";

/**
 * Therapist Roster (Sprint 5) — admin-managed roster with schedule config.
 * Staff get a read-only view; admin actions use the primary #B8763A styling.
 */

export default function TherapistsPage() {
  const { isAdmin } = useAuth();

  // Data state
  const [therapists, setTherapists] = useState<Therapist[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Toolbar state
  const [searchInput, setSearchInput] = useState("");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Therapist | null>(null);
  const [overrideFor, setOverrideFor] = useState<Therapist | null>(null);
  const [existingOverride, setExistingOverride] = useState<TherapistOverride | null>(null);
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [deleting, setDeleting] = useState<Therapist | null>(null);

  usePageHeader({
    title: "Therapist Roster",
    actions: isAdmin ? (
      <button type="button" className="btn-primary" onClick={() => setModalOpen(true)}>
        + Add Therapist
      </button>
    ) : undefined,
  });

  const load = useCallback(async (search?: string) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await fetchTherapists(search);
      setTherapists(data.items);
      setTotal(data.total);
    } catch {
      setLoadError("Could not load therapists. Is the backend running?");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Debounced search (350 ms), mirroring the patients page.
  useEffect(() => {
    const t = setTimeout(() => {
      load(searchInput.trim() || undefined);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // Open the override modal pre-loaded with today's override for this
  // therapist (upsert semantics: one override per date).
  const handleOverride = useCallback(async (t: Therapist) => {
    setOverrideFor(t);
    setExistingOverride(null);
    setOverrideLoading(true);
    try {
      const overrides = await fetchOverrides(t.id);
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
        now.getDate(),
      ).padStart(2, "0")}`;
      setExistingOverride(overrides.find((o) => o.date === today) ?? null);
    } catch {
      setExistingOverride(null);
    } finally {
      setOverrideLoading(false);
    }
  }, []);

  const handleSaved = useCallback(
    (_saved: Therapist) => {
      setModalOpen(false);
      setEditing(null);
      load(searchInput.trim() || undefined);
    },
    [load, searchInput],
  );

  const handleOverrideSaved = useCallback(
    (_saved: TherapistOverride) => {
      setOverrideFor(null);
      setExistingOverride(null);
      load(searchInput.trim() || undefined);
    },
    [load, searchInput],
  );

  const handleDeleted = useCallback(() => {
    setDeleting(null);
    load(searchInput.trim() || undefined);
  }, [load, searchInput]);

  // Summary stats across the roster
  const activeCount = therapists.filter((t) => t.is_active).length;
  const totalHours = therapists.reduce((sum, t) => sum + t.weekly_hours, 0);
  const bookedToday = therapists.reduce((sum, t) => sum + t.appointments_today_count, 0);

  return (
    <div className="space-y-6">
      {/* Restricted notice for STAFF (read-only roster) */}
      {!isAdmin && (
        <div className="flex items-center gap-3 rounded-card border border-border-custom bg-primary-soft/40 px-4 py-3">
          <Badge variant="neutral">Read-only</Badge>
          <p className="text-sm text-text-secondary">
            You are viewing the roster as staff. Only administrators can add, edit or delete
            therapists and configure schedules.
          </p>
        </div>
      )}

      {/* Summary stat cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Therapists" value={total} subtext={`${activeCount} active`} trend="flat" />
        <StatCard
          label="Roster weekly hours"
          value={`${totalHours.toFixed(1)}h`}
          subtext="combined capacity"
          trend="flat"
        />
        <StatCard
          label="Sessions today"
          value={bookedToday}
          subtext="across all therapists"
          trend="up"
        />
        <StatCard
          label="Avg. slot"
          value={
            therapists.length > 0
              ? `${Math.round(
                  therapists.reduce((s, t) => s + t.slot_duration_minutes, 0) / therapists.length,
                )} min`
              : "—"
          }
          subtext="clinic default 60"
          trend="flat"
        />
      </section>

      {/* Toolbar + roster grid */}
      <Card paddingClassName="p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-text-primary">
              Therapist Roster
            </h2>
            <p className="mt-0.5 text-sm text-text-secondary">
              {isLoading
                ? "Loading…"
                : `${total} therapist${total === 1 ? "" : "s"} · schedules & metrics`}
            </p>
          </div>
          <div className="ml-auto">
            <input
              type="search"
              className="input-field sm:max-w-xs"
              placeholder="Search by name or specialty…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Search therapists"
            />
          </div>
        </div>

        {loadError && (
          <div
            className="mb-4 rounded-lg border border-status-error-soft bg-status-error-soft px-3 py-2 text-sm text-status-error"
            role="alert"
          >
            {loadError}
          </div>
        )}

        <TherapistList
          therapists={therapists}
          isLoading={isLoading}
          canManage={isAdmin}
          hasFilters={Boolean(searchInput.trim())}
          onEdit={(t) => {
            setEditing(t);
            setModalOpen(true);
          }}
          onOverride={handleOverride}
          onDelete={(t) => setDeleting(t)}
        />
      </Card>

      {/* Modals */}
      <TherapistModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        therapist={editing}
        onSaved={handleSaved}
      />

      {overrideFor && !overrideLoading && (
        <ScheduleOverrideModal
          open
          onClose={() => {
            setOverrideFor(null);
            setExistingOverride(null);
          }}
          therapist={overrideFor}
          existingOverride={existingOverride}
          onSaved={handleOverrideSaved}
        />
      )}

      <DeleteTherapistDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        therapist={deleting}
        isAdmin={isAdmin}
        onDeleted={handleDeleted}
      />
    </div>
  );
}
