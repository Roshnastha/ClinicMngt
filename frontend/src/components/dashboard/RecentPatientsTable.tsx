"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import type { RecentPatientSummary } from "@/lib/dashboard";

/**
 * Recent patients table — the last N patients added/updated, rendered on a
 * white surface card. Clicking a row navigates to the patient profile
 * (/patients/[id]). Status pills + mono timestamps per the design system.
 */

function statusVariant(status: string): "success" | "neutral" | "error" {
  switch (status) {
    case "Active":
      return "success";
    case "On hold":
      return "neutral";
    case "Completed":
    default:
      return "error";
  }
}

/** "2026-09-22T14:05:00" → "22 Sep 14:05" (local time). */
function formatFreshness(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface RecentPatientsTableProps {
  patients: RecentPatientSummary[];
  isLoading: boolean;
}

export function RecentPatientsTable({ patients, isLoading }: RecentPatientsTableProps) {
  const router = useRouter();

  return (
    <div className="overflow-x-auto">
      {isLoading ? (
        <div className="space-y-2 p-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-bg-app" />
          ))}
        </div>
      ) : patients.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="font-display text-lg text-text-primary">No patients yet</p>
          <p className="mt-1 text-sm text-text-secondary">
            Registered patients will appear here as they are added.
          </p>
        </div>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border-custom text-xs uppercase tracking-wide text-text-secondary">
              <th className="px-5 py-3 font-medium">Patient</th>
              <th className="px-5 py-3 font-medium">Condition</th>
              <th className="px-5 py-3 font-medium">Assigned Therapist</th>
              <th className="px-5 py-3 font-medium">Package</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium text-right">Last update</th>
            </tr>
          </thead>
          <tbody>
            {patients.map((p) => (
              <tr
                key={p.id}
                onClick={() => router.push(`/patients/${p.id}`)}
                className="cursor-pointer border-b border-border-custom/60 transition-colors last:border-0 hover:bg-primary-soft/30"
              >
                <td className="px-5 py-3">
                  <div className="font-medium text-text-primary">{p.name}</div>
                  <div className="font-mono text-xs text-text-secondary">{p.phone}</div>
                </td>
                <td className="px-5 py-3 text-text-secondary">{p.condition ?? "—"}</td>
                <td className="px-5 py-3 text-text-secondary">
                  {p.assigned_therapist_name ?? "Unassigned"}
                </td>
                <td className="px-5 py-3 text-text-secondary">{p.package ?? "—"}</td>
                <td className="px-5 py-3">
                  <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
                </td>
                <td className="px-5 py-3 text-right font-mono text-xs text-text-secondary">
                  {formatFreshness(p.updated_at)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
