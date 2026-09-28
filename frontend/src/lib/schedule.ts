/**
 * Typed client for the PhysioDesk scheduling & appointment grid API.
 * Mirrors backend/app/schemas/appointment.py.
 */

import { api } from "./api-client";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const APPOINTMENT_STATUSES = ["Booked", "Completed", "Cancelled"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const PAYMENT_METHODS = ["Cash", "Card", "UPI", "Insurance"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type SlotState = "OPEN" | "BOOKED" | "THERAPIST_OFF";

// ---------------------------------------------------------------------------
// Types (mirror backend schemas)
// ---------------------------------------------------------------------------

export interface PatientMini {
  id: string;
  name: string;
  phone: string;
}

export interface TherapistMini {
  id: string;
  name: string;
  specialty: string;
}

export interface Appointment {
  id: string;
  patient_id: string;
  therapist_id: string;
  date: string; // "YYYY-MM-DD"
  start_time: string; // "HH:MM:SS"
  end_time: string;
  status: AppointmentStatus | string;
  payment_method: PaymentMethod | string | null;
  notes: string | null;
  patient: PatientMini | null;
  therapist: TherapistMini | null;
  created_at: string;
  updated_at: string;
}

export interface AppointmentInput {
  patient_id: string;
  therapist_id: string;
  date: string;
  start_time: string; // "HH:MM"
  end_time: string;
  payment_method?: string | null;
  notes?: string | null;
}

export interface RescheduleInput {
  date: string;
  start_time: string;
  end_time: string;
}

export interface GridBookedCell {
  appointment_id: string;
  patient: PatientMini | null;
  status: string;
  condition: string | null;
  payment_method: string | null;
  notes: string | null;
}

export interface GridCell {
  slot_start: string;
  slot_end: string;
  state: SlotState;
  booked: GridBookedCell | null;
}

export interface GridTherapistColumn {
  therapist: TherapistMini;
  on_duty: boolean;
  window_start: string | null;
  window_end: string | null;
  day_off: boolean;
}

export interface DailyGrid {
  date: string;
  slot_minutes: number;
  slots: string[]; // "HH:MM:SS"
  therapists: GridTherapistColumn[];
  cells: GridCell[][]; // [row][column]
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export async function fetchDailyGrid(date: string): Promise<DailyGrid> {
  return api.get<DailyGrid>(`/schedule/grid?date=${date}`);
}

export async function fetchAppointments(filters: {
  date?: string;
  therapist_id?: string;
  patient_id?: string;
} = {}): Promise<Appointment[]> {
  const params = new URLSearchParams();
  if (filters.date) params.set("date", filters.date);
  if (filters.therapist_id) params.set("therapist_id", filters.therapist_id);
  if (filters.patient_id) params.set("patient_id", filters.patient_id);
  const qs = params.toString();
  return api.get<Appointment[]>(`/schedule/appointments${qs ? `?${qs}` : ""}`);
}

export async function fetchAppointment(id: string): Promise<Appointment> {
  return api.get<Appointment>(`/schedule/appointments/${id}`);
}

export async function bookAppointment(payload: AppointmentInput): Promise<Appointment> {
  return api.post<Appointment>("/schedule/appointments", payload);
}

export async function rescheduleAppointment(
  id: string,
  payload: RescheduleInput,
): Promise<Appointment> {
  return api.put<Appointment>(`/schedule/appointments/${id}/reschedule`, payload);
}

export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus,
): Promise<Appointment> {
  return api.patch<Appointment>(`/schedule/appointments/${id}/status`, { status });
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** "14:30:00" → "14:30". */
export function toHHMM(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 5);
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const dateNav = { addDays, toISODate };

/** Pretty label for a date cell, e.g. "Mon, 22 Sep 2026". */
export function formatDayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
