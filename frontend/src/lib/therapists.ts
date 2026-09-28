/**
 * Typed client for the PhysioDesk therapists API (roster + schedule config).
 * Mirrors backend/app/schemas/therapist.py.
 */

import { api } from "./api-client";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const VALID_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;
export type Weekday = (typeof VALID_DAYS)[number];

export const SHORT_DAYS: Record<Weekday, string> = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
};

export const SLOT_DURATIONS = [30, 45, 60] as const;
export type SlotDuration = (typeof SLOT_DURATIONS)[number];

// ---------------------------------------------------------------------------
// Types (mirror backend schemas)
// ---------------------------------------------------------------------------

export interface AppointmentToday {
  id: string;
  start_time: string; // "HH:MM:SS"
  end_time: string;
  status: string;
  patient: { id: string; name: string; status: string } | null;
}

/** Roster row with calculated metrics. */
export interface Therapist {
  id: string;
  name: string;
  specialty: string;
  working_days: string[];
  start_time: string | null; // "HH:MM:SS"
  end_time: string | null;
  slot_duration_minutes: number;
  weekly_hours: number;
  active_patients_count: number;
  appointments_today: AppointmentToday[];
  appointments_today_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TherapistDetail extends Therapist {
  overrides: TherapistOverride[];
}

export interface TherapistListResponse {
  items: Therapist[];
  total: number;
}

export interface TherapistInput {
  name: string;
  specialty: string;
  working_days: string[];
  start_time: string | null; // "HH:MM" or "HH:MM:SS"
  end_time: string | null;
  slot_duration_minutes: number;
}

export interface TherapistOverride {
  id: string;
  therapist_id: string;
  date: string; // "YYYY-MM-DD"
  is_day_off: boolean;
  custom_start_time: string | null;
  custom_end_time: string | null;
  notes: string | null;
}

export interface TherapistOverrideInput {
  date: string;
  is_day_off: boolean;
  custom_start_time?: string | null;
  custom_end_time?: string | null;
  notes?: string | null;
}

/** 409 conflict payload from DELETE /therapists/{id} without action. */
export interface DeleteConflict {
  message: string;
  upcoming_appointments: number;
  assigned_patients: number;
}

export interface DeleteResult {
  status: "deleted" | "deactivated";
  removed_appointments?: number;
  cancelled_appointments?: number;
  unassigned_patients: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** "14:30:00" → "14:30" for <input type="time"> and display. */
export function toHHMM(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 5);
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export async function fetchTherapists(search?: string): Promise<TherapistListResponse> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : "";
  return api.get<TherapistListResponse>(`/therapists${qs}`);
}

export async function fetchTherapist(id: string): Promise<TherapistDetail> {
  return api.get<TherapistDetail>(`/therapists/${id}`);
}

export async function createTherapist(payload: TherapistInput): Promise<Therapist> {
  return api.post<Therapist>("/therapists", payload);
}

export async function updateTherapist(
  id: string,
  payload: Partial<TherapistInput>,
): Promise<Therapist> {
  return api.put<Therapist>(`/therapists/${id}`, payload);
}

/**
 * DELETE /therapists/{id}. Without `action` the backend answers 409 with a
 * conflict body when upcoming booked appointments exist.
 */
export async function deleteTherapist(
  id: string,
  action?: "unassign" | "cancel",
): Promise<DeleteResult> {
  return api.delete<DeleteResult>(`/therapists/${id}${action ? `?action=${action}` : ""}`);
}

export async function upsertOverride(
  therapistId: string,
  payload: TherapistOverrideInput,
): Promise<TherapistOverride> {
  return api.post<TherapistOverride>(`/therapists/${therapistId}/overrides`, payload);
}

export async function fetchOverrides(
  therapistId: string,
  range?: { start_date?: string; end_date?: string },
): Promise<TherapistOverride[]> {
  const params = new URLSearchParams();
  if (range?.start_date) params.set("start_date", range.start_date);
  if (range?.end_date) params.set("end_date", range.end_date);
  const qs = params.toString();
  return api.get<TherapistOverride[]>(`/therapists/${therapistId}/overrides${qs ? `?${qs}` : ""}`);
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** Compact working-hours label, e.g. "09:00–17:00" or "—". */
export function formatHours(t: Pick<Therapist, "start_time" | "end_time">): string {
  if (!t.start_time || !t.end_time) return "—";
  return `${toHHMM(t.start_time)}–${toHHMM(t.end_time)}`;
}

/** Working-days label, e.g. "Mon–Fri" or "Mon, Wed, Fri". */
export function formatDays(days: string[]): string {
  if (days.length === 0) return "—";
  const short = days
    .map((d) => SHORT_DAYS[d as Weekday])
    .filter(Boolean);
  if (short.length === 7) return "Mon–Sun";
  const consecutive =
    short.length > 1 &&
    short.every((d, i) => {
      if (i === 0) return true;
      const prev = VALID_DAYS.indexOf(days[i - 1] as Weekday);
      const cur = VALID_DAYS.indexOf(days[i] as Weekday);
      return cur === prev + 1;
    });
  if (consecutive) return `${short[0]}–${short[short.length - 1]}`;
  return short.join(", ");
}
