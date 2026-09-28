"use client";

import { useRouter } from "next/navigation";
import { Patient } from "@/lib/patients";
import { Badge } from "@/components/ui/Badge";

/**
 * Patients table — design-system surfaces, mono numerics, status badges.
 * Row click navigates to the patient profile; the trailing actions column
 * holds Edit/Delete CTAs.
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

export interface PatientTableProps {
  patients: Patient[];
  /** Rendered in the trailing actions cell of every row. */
  renderActions?: (patient: Patient) => React.ReactNode;
  /** Emphasise empty state message. */
  emptyMessage?: string;
}

export function PatientTable({ patients, renderActions, emptyMessage }: PatientTableProps) {
  const router = useRouter();

  if (patients.length === 0) {
    return (
      <div className="px-5 py-10 text-center">
        <p className="font-display text-lg text-text-primary">
          {emptyMessage ?? "No patients found"}
        </p>
        <p className="mt-1 text-sm text-text-secondary">
          Try adjusting the search or filters.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border-custom text-xs uppercase tracking-wide text-text-secondary">
            <th className="px-5 py-3 font-medium">Name</th>
            <th className="px-5 py-3 font-medium">Phone</th>
            <th className="px-5 py-3 font-medium">Age/Gender</th>
            <th className="px-5 py-3 font-medium">Condition</th>
            <th className="px-5 py-3 font-medium">Therapist</th>
            <th className="px-5 py-3 font-medium">Package</th>
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="px-5 py-3 font-medium text-right">Actions</th>
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
                <span className="font-medium text-text-primary">{p.name}</span>
              </td>
              <td className="px-5 py-3 font-mono text-xs text-text-secondary">{p.phone}</td>
              <td className="px-5 py-3">
                <span className="font-mono text-xs text-text-secondary">
                  {p.age} · {p.gender}
                </span>
              </td>
              <td className="px-5 py-3 text-text-secondary">{p.condition ?? "—"}</td>
              <td className="px-5 py-3 text-text-secondary">
                {p.assigned_therapist?.name ?? "Unassigned"}
              </td>
              <td className="px-5 py-3 text-text-secondary">{p.package ?? "—"}</td>
              <td className="px-5 py-3">
                <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
              </td>
              <td
                className="px-5 py-3 text-right"
                onClick={(e) => e.stopPropagation()}
              >
                {renderActions?.(p)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
