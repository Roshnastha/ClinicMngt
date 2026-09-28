"use client";

import { useCallback, useEffect, useState } from "react";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardHeader } from "@/components/ui/Card";
import { TherapistCapacityView } from "@/components/dashboard/TherapistCapacityView";
import { RecentPatientsTable } from "@/components/dashboard/RecentPatientsTable";
import { usePageHeader } from "@/components/layout/page-header-context";
import {
  fetchDashboardStats,
  fetchRecentPatients,
  fetchTherapistCapacity,
  formatCurrency,
  type DashboardStats,
  type RecentPatientSummary,
  type TherapistCapacity,
} from "@/lib/dashboard";

/**
 * Live Dashboard — computed metrics for today, straight from the API:
 *   1. Stat cards  : patients seen, therapists on duty, revenue, open slots
 *   2. Capacity    : per-therapist booked/free slot breakdown (override-aware)
 *   3. Recent      : last N touched patients → click through to the profile
 *
 * Values refresh with the Retry button; nothing on this page is hard-coded.
 */

export default function DashboardPage() {
  usePageHeader({ title: "Dashboard" });

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [capacities, setCapacities] = useState<TherapistCapacity[]>([]);
  const [recentPatients, setRecentPatients] = useState<RecentPatientSummary[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [s, cap, recent] = await Promise.all([
        fetchDashboardStats(),
        fetchTherapistCapacity(),
        fetchRecentPatients(8),
      ]);
      setStats(s);
      setCapacities(cap);
      setRecentPatients(recent);
    } catch {
      setLoadError("Could not load dashboard metrics. Is the backend running?");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Reload when the retry button is used.
  useEffect(() => {
    load();
  }, [load, reloadTick]);

  const capacityTotals = capacities.reduce(
    (acc, c) => ({
      booked: acc.booked + c.booked_slots,
      total: acc.total + c.total_slots,
    }),
    { booked: 0, total: 0 },
  );

  return (
    <div className="space-y-6">
      {/* Error banner */}
      {loadError && (
        <div
          className="flex items-center justify-between gap-3 rounded-card border border-status-error-soft bg-status-error-soft px-4 py-3"
          role="alert"
        >
          <p className="text-sm text-status-error">{loadError}</p>
          <button
            type="button"
            className="btn-secondary px-3 py-1.5 text-xs"
            onClick={() => setReloadTick((t) => t + 1)}
          >
            Retry
          </button>
        </div>
      )}

      {/* 1 · Key metrics — values in Fraunces, context in IBM Plex Mono */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Patients Seen Today"
          value={stats ? stats.patients_seen_today : "—"}
          subtext="non-cancelled appointments"
          trend="up"
        />
        <StatCard
          label="Therapists On Duty Today"
          value={stats ? stats.therapists_on_duty_today : "—"}
          subtext="override-aware schedule"
          trend="flat"
        />
        <StatCard
          label="Revenue Collected Today"
          value={stats ? formatCurrency(stats.revenue_collected_today) : "—"}
          subtext="paid invoices today"
          trend="up"
        />
        <StatCard
          label="Open Slots Remaining Today"
          value={stats ? stats.open_slots_remaining_today : "—"}
          subtext="across on-duty therapists"
          trend="flat"
        />
      </section>

      {/* 2 · Therapist capacity for today */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold text-text-primary">
              Therapist Capacity — Today
            </h2>
            <p className="mt-0.5 text-sm text-text-secondary">
              {capacityTotals.total > 0
                ? `${capacityTotals.booked} of ${capacityTotals.total} slots booked across the roster`
                : "Slot breakdown per therapist (day-off overrides respected)"}
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary px-3 py-1.5 text-xs"
            onClick={() => setReloadTick((t) => t + 1)}
            disabled={isLoading}
          >
            {isLoading ? "Refreshing…" : "↻ Refresh"}
          </button>
        </div>
        <TherapistCapacityView capacities={capacities} isLoading={isLoading} />
      </section>

      {/* 3 · Recent patients */}
      <section>
        <Card paddingClassName="p-0">
          <div className="px-5 pt-5">
            <CardHeader
              title="Recent Patients"
              actions={
                <span className="font-mono text-xs text-text-secondary">
                  last {recentPatients.length} updated
                </span>
              }
            />
          </div>
          <RecentPatientsTable patients={recentPatients} isLoading={isLoading} />
        </Card>
      </section>
    </div>
  );
}
