/**
 * Typed client for the PhysioDesk live dashboard & analytics API.
 * Mirrors backend/app/schemas/dashboard.py.
 */

import { api } from "./api-client";

// ---------------------------------------------------------------------------
// Types (mirror backend schemas)
// ---------------------------------------------------------------------------

export type SlotStatus = "OPEN" | "BOOKED" | "OFF";

export interface DashboardStats {
  patients_seen_today: number;
  therapists_on_duty_today: number;
  revenue_collected_today: number;
  open_slots_remaining_today: number;
}

export interface SlotBreakdown {
  time: string; // "HH:MM"
  status: SlotStatus;
  patient_name: string | null;
}

export interface TherapistCapacity {
  therapist_id: string;
  therapist_name: string;
  specialty: string | null;
  on_duty: boolean;
  working_window: string | null; // "HH:MM–HH:MM"
  total_slots: number;
  booked_slots: number;
  free_slots: number;
  /** booked / total in [0, 1]; 0 when off duty */
  utilization: number;
  slots_breakdown: SlotBreakdown[];
}

export interface RecentPatientSummary {
  id: string;
  name: string;
  phone: string;
  condition: string | null;
  assigned_therapist_name: string | null;
  package: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export async function fetchDashboardStats(): Promise<DashboardStats> {
  return api.get<DashboardStats>("/dashboard/stats");
}

export async function fetchTherapistCapacity(): Promise<TherapistCapacity[]> {
  return api.get<TherapistCapacity[]>("/dashboard/therapist-capacity");
}

export async function fetchRecentPatients(limit = 8): Promise<RecentPatientSummary[]> {
  return api.get<RecentPatientSummary[]>(`/dashboard/recent-patients?limit=${limit}`);
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Revenue in the invoice currency, mono-friendly. */
export function formatCurrency(value: number): string {
  if (Number.isNaN(value)) return "—";
  return value.toLocaleString("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Compact percent for the utilization bar, e.g. "63%". */
export function formatUtilization(value: number): string {
  return `${Math.round(value * 100)}%`;
}
