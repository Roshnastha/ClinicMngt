/**
 * Typed client for the PhysioDesk billing & invoicing API.
 * Mirrors backend/app/schemas/invoice.py.
 */

import { api } from "./api-client";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const INVOICE_STATUSES = ["Paid", "Due", "Void"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const PAYMENT_METHODS = ["Cash", "Card", "Insurance", "Bank Transfer"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// ---------------------------------------------------------------------------
// Types (mirror backend schemas)
// ---------------------------------------------------------------------------

export interface PatientMini {
  id: string;
  name: string;
  phone: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  patient_id: string;
  patient_name: string | null;
  service_package: string;
  amount: string; // decimal serialized as string
  discount: string;
  net_amount: string;
  status: InvoiceStatus | string;
  payment_method: PaymentMethod | string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceDetail extends Invoice {
  patient: {
    id: string;
    name: string;
    phone: string;
    package: string | null;
  } | null;
}

export interface InvoiceListResponse {
  items: Invoice[];
  total: number;
  skip: number;
  limit: number;
}

export interface InvoiceInput {
  patient_id: string;
  service_package: string;
  amount: string;
  discount: string;
  status: "Paid" | "Due";
  payment_method?: string | null;
}

export interface InvoiceUpdateInput {
  status?: "Paid" | "Due" | "Void";
  payment_method?: string | null;
  discount?: string;
}

export interface BillingSummary {
  total_billed: number;
  total_paid: number;
  total_due: number;
  total_voided: number;
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

export async function fetchInvoices(
  filters: { status?: string; patient_id?: string; search?: string; skip?: number; limit?: number } = {},
): Promise<InvoiceListResponse> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.patient_id) params.set("patient_id", filters.patient_id);
  if (filters.search) params.set("search", filters.search);
  if (filters.skip) params.set("skip", String(filters.skip));
  if (filters.limit) params.set("limit", String(filters.limit));
  const qs = params.toString();
  return api.get<InvoiceListResponse>(`/billing/invoices${qs ? `?${qs}` : ""}`);
}

export async function fetchInvoice(id: string): Promise<InvoiceDetail> {
  return api.get<InvoiceDetail>(`/billing/invoices/${id}`);
}

export async function createInvoice(payload: InvoiceInput): Promise<Invoice> {
  return api.post<Invoice>("/billing/invoices", payload);
}

export async function updateInvoice(
  id: string,
  payload: InvoiceUpdateInput,
): Promise<Invoice> {
  return api.put<Invoice>(`/billing/invoices/${id}`, payload);
}

/** Void (default) or purge (?purge=true) an invoice. Admin-only server-side. */
export async function voidInvoice(id: string, purge = false): Promise<void> {
  return api.delete<void>(`/billing/invoices/${id}${purge ? "?purge=true" : ""}`);
}

export async function fetchBillingSummary(): Promise<BillingSummary> {
  return api.get<BillingSummary>("/billing/summary");
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function formatMoney(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
