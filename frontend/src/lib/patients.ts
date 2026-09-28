/**
 * Typed client for the PhysioDesk patients API.
 */

import { api } from "./api-client";

// ---------------------------------------------------------------------------
// Types (mirror backend/app/schemas/patient.py)
// ---------------------------------------------------------------------------

export const PATIENT_STATUSES = ["Active", "Completed", "On hold"] as const;
export type PatientStatus = (typeof PATIENT_STATUSES)[number];

export interface TherapistSummary {
  id: string;
  name: string;
  specialty: string;
}

export interface Patient {
  id: string;
  name: string;
  phone: string;
  age: number;
  gender: string;
  address: string | null;
  condition: string | null;
  assigned_therapist_id: string | null;
  package: string | null;
  status: PatientStatus | string;
  assigned_therapist: TherapistSummary | null;
  created_at: string;
  updated_at: string;
}

export interface PatientDetail extends Patient {
  session_history: SessionSummary[];
  billing_history: InvoiceSummary[];
}

export interface SessionSummary {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  therapist: TherapistSummary | null;
}

export interface InvoiceSummary {
  id: string;
  invoice_number: string;
  service_package: string;
  amount: number;
  discount: number;
  status: string;
  payment_method: string | null;
  created_at: string;
}

export interface PatientListResponse {
  items: Patient[];
  total: number;
  skip: number;
  limit: number;
}

export interface PatientFilters {
  search?: string;
  therapist_id?: string;
  status?: string;
  skip?: number;
  limit?: number;
}

export interface PatientInput {
  name: string;
  phone: string;
  age: number;
  gender: string;
  address?: string | null;
  condition?: string | null;
  assigned_therapist_id?: string | null;
  package?: string | null;
  status: string;
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export async function fetchPatients(filters: PatientFilters = {}): Promise<PatientListResponse> {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.therapist_id) params.set("therapist_id", filters.therapist_id);
  if (filters.status) params.set("status", filters.status);
  if (filters.skip) params.set("skip", String(filters.skip));
  if (filters.limit) params.set("limit", String(filters.limit));
  const qs = params.toString();
  return api.get<PatientListResponse>(`/patients${qs ? `?${qs}` : ""}`);
}

export async function fetchPatient(id: string): Promise<PatientDetail> {
  return api.get<PatientDetail>(`/patients/${id}`);
}

export async function createPatient(payload: PatientInput): Promise<Patient> {
  return api.post<Patient>("/patients", payload);
}

export async function updatePatient(id: string, payload: Partial<PatientInput>): Promise<Patient> {
  return api.put<Patient>(`/patients/${id}`, payload);
}

export async function deletePatient(id: string): Promise<void> {
  return api.delete<void>(`/patients/${id}`);
}

export async function fetchTherapists(): Promise<TherapistSummary[]> {
  // GET /therapists returns an envelope: { items: [...], total }.
  const { items } = await api.get<{ items: TherapistSummary[]; total: number }>("/therapists");
  return items.map((t) => ({ id: t.id, name: t.name, specialty: t.specialty }));
}
