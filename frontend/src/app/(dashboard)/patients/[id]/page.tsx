"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PatientModal } from "@/components/patients/PatientModal";
import { usePageHeader } from "@/components/layout/page-header-context";
import { useAuth } from "@/lib/auth-context";
import { PatientDetail, fetchPatient } from "@/lib/patients";

/**
 * Patient profile — overview card plus session and billing histories.
 * All sections render on one page (no tabs) with Fraunces headers,
 * mono numerics, and status badges per the design system.
 */

function statusVariant(status: string): "success" | "neutral" | "error" {
  switch (status) {
    case "Active":
    case "Paid":
    case "Booked":
    case "Completed":
      return "success";
    case "On hold":
    case "Pending":
    case "Due":
    case "Void":
      return "neutral";
    default:
      return "error";
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMoney(value: number): string {
  return value.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function PatientProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { isAdmin } = useAuth();

  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setPatient(await fetchPatient(params.id));
    } catch {
      setError("Could not load this patient. They may have been removed.");
    } finally {
      setIsLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  usePageHeader({ title: "Patient Profile" });

  // --- Loading / error / empty states --------------------------------------
  if (isLoading) {
    return (
      <Card>
        <p className="text-sm text-text-secondary">Loading profile…</p>
      </Card>
    );
  }

  if (error || !patient) {
    return (
      <Card>
        <p className="text-sm text-status-error">{error ?? "Patient not found."}</p>
        <button type="button" className="btn-secondary mt-4" onClick={() => router.push("/patients")}>
          ← Back to patients
        </button>
        <Link href="/patients" className="ml-2 text-sm text-primary underline">
          All patients
        </Link>
      </Card>
    );
  }

  const infoRows: Array<[string, React.ReactNode]> = [
    ["Full Name", <span className="font-display text-lg">{patient.name}</span>],
    ["Phone", <span className="font-mono text-sm">{patient.phone}</span>],
    ["Age", <span className="font-mono text-sm">{patient.age}</span>],
    ["Gender", patient.gender],
    ["Address", patient.address ?? "—"],
    ["Primary Condition", patient.condition ?? "—"],
    ["Assigned Therapist", patient.assigned_therapist?.name ?? "Unassigned"],
    ["Package", patient.package ?? "—"],
    ["Current Status", <Badge variant={statusVariant(patient.status)}>{patient.status}</Badge>],
  ];

  return (
    <div className="space-y-6">
      {/* Overview panel */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-text-primary">{patient.name}</h2>
            <p className="mt-1 font-mono text-sm text-text-secondary">
              {patient.phone} · {patient.age} yrs · {patient.gender}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <Badge variant={statusVariant(patient.status)}>{patient.status}</Badge>
              {patient.package && (
                <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-primary-text-soft">
                  {patient.package}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary" onClick={() => setEditOpen(true)}>
              Edit profile
            </button>
            <button type="button" className="btn-primary" onClick={() => router.push("/schedule")}>
              Book appointment
            </button>
            <button type="button" className="btn-secondary" onClick={load} aria-label="Refresh profile">
              ⟳ Refresh
            </button>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-4 border-t border-border-custom/70 pt-5 sm:grid-cols-2">
          {infoRows.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-4 sm:justify-start sm:gap-8">
              <dt className="w-36 shrink-0 text-sm text-text-secondary">{label}</dt>
              <dd className="text-sm text-text-primary">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {/* Session history */}
      <Card paddingClassName="p-0">
        <div className="px-5 pt-5">
          <CardHeader title="Session History" />
        </div>
        {patient.session_history.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-text-secondary">No sessions recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border-custom text-xs uppercase tracking-wide text-text-secondary">
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Therapist</th>
                  <th className="px-5 py-3 font-medium">Time</th>
                  <th className="px-5 py-3 font-medium">Notes</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {patient.session_history.map((s) => (
                  <tr key={s.id} className="border-b border-border-custom/60 last:border-0">
                    <td className="px-5 py-3 font-mono text-xs">{formatDate(s.date)}</td>
                    <td className="px-5 py-3">{s.therapist?.name ?? "—"}</td>
                    <td className="px-5 py-3 font-mono text-xs">
                      {s.start_time}–{s.end_time}
                    </td>
                    <td className="px-5 py-3 text-text-secondary">{s.notes ?? "—"}</td>
                    <td className="px-5 py-3">
                      <Badge variant={statusVariant(s.status)}>{s.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Billing history */}
      <Card paddingClassName="p-0">
        <div className="px-5 pt-5">
          <CardHeader title="Billing History" />
        </div>
        {patient.billing_history.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-text-secondary">No invoices yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border-custom text-xs uppercase tracking-wide text-text-secondary">
                  <th className="px-5 py-3 font-medium">Invoice #</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Service Package</th>
                  <th className="px-5 py-3 font-medium text-right">Amount</th>
                  <th className="px-5 py-3 font-medium text-right">Discount</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {patient.billing_history.map((inv) => (
                  <tr key={inv.id} className="border-b border-border-custom/60 last:border-0">
                    <td className="px-5 py-3 font-mono text-xs">{inv.invoice_number}</td>
                    <td className="px-5 py-3 font-mono text-xs">{formatDate(inv.created_at)}</td>
                    <td className="px-5 py-3">{inv.service_package}</td>
                    <td className="px-5 py-3 text-right font-mono text-xs">{formatMoney(inv.amount)}</td>
                    <td className="px-5 py-3 text-right font-mono text-xs">{formatMoney(inv.discount)}</td>
                    <td className="px-5 py-3">
                      <Badge variant={statusVariant(inv.status)}>{inv.status}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button type="button" className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary-text-soft hover:bg-primary-soft">
                        View
                      </button>
                      <button type="button" className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary-text-soft hover:bg-primary-soft">
                        Print
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Edit modal */}
      <PatientModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        patient={patient}
        onSaved={() => {
          setEditOpen(false);
          load();
        }}
      />
    </div>
  );
}
