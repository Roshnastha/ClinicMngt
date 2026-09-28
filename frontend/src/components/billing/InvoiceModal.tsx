"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/api-client";
import {
  PAYMENT_METHODS,
  createInvoice,
  formatMoney,
  updateInvoice,
  type Invoice,
  type PatientMini,
} from "@/lib/billing";

/**
 * Create / Edit invoice modal — patient selector, service description,
 * amount & discount with live Net Amount calculation, payment status and
 * method. Edit mode respects role rules: staff can only change status;
 * payment details require admin (backend enforces, UI communicates).
 */

export interface InvoiceModalProps {
  open: boolean;
  onClose: () => void;
  /** Invoice to edit; omit/null for create mode. */
  invoice?: Invoice | null;
  isAdmin: boolean;
  onSaved: (invoice: Invoice) => void;
}

interface PatientPage {
  items: PatientMini[];
}

const STATUS_OPTIONS = ["Paid", "Due"] as const;

export function InvoiceModal({ open, onClose, invoice, isAdmin, onSaved }: InvoiceModalProps) {
  const isEdit = Boolean(invoice);
  const [patients, setPatients] = useState<PatientMini[]>([]);
  const [form, setForm] = useState({
    patient_id: "",
    service_package: "",
    amount: "",
    discount: "0.00",
    status: "Due",
    payment_method: "",
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Patient options (flat list from the paginated endpoint).
  useEffect(() => {
    if (!open) return;
    api
      .get<PatientPage>("/patients?limit=500")
      .then((page) => setPatients(page.items))
      .catch(() => setPatients([]));
  }, [open]);

  // Hydrate on open.
  useEffect(() => {
    if (!open) return;
    setServerError(null);
    setFieldErrors({});
    if (invoice) {
      setForm({
        patient_id: invoice.patient_id,
        service_package: invoice.service_package,
        amount: invoice.amount,
        discount: invoice.discount,
        status: invoice.status === "Void" ? "Due" : invoice.status,
        payment_method: invoice.payment_method ?? "",
      });
    } else {
      setForm({
        patient_id: "",
        service_package: "",
        amount: "",
        discount: "0.00",
        status: "Due",
        payment_method: "",
      });
    }
  }, [open, invoice]);

  // Live Net Amount = Amount - Discount.
  const netAmount = (() => {
    const a = Number(form.amount);
    const d = Number(form.discount);
    if (Number.isNaN(a) || Number.isNaN(d)) return null;
    return a - d;
  })();

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!form.patient_id) errors.patient_id = "Select a patient.";
    if (!form.service_package.trim()) errors.service_package = "Describe the service or package.";
    const amount = Number(form.amount);
    const discount = Number(form.discount);
    if (!form.amount.trim() || Number.isNaN(amount) || amount <= 0) {
      errors.amount = "Enter an amount greater than zero.";
    }
    if (Number.isNaN(discount) || discount < 0) {
      errors.discount = "Discount cannot be negative.";
    } else if (!Number.isNaN(amount) && amount > 0 && discount > amount) {
      errors.discount = "Discount cannot exceed the amount.";
    }
    if (!STATUS_OPTIONS.includes(form.status as (typeof STATUS_OPTIONS)[number])) {
      errors.status = "Pick Paid or Due.";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;

    setSaving(true);
    try {
      if (isEdit && invoice) {
        // Edit: status for everyone; payment details only included for admins.
        const payload: Record<string, string> = { status: form.status };
        if (isAdmin) {
          payload.discount = form.discount;
          if (form.payment_method) payload.payment_method = form.payment_method;
        }
        const saved = await updateInvoice(invoice.id, payload);
        onSaved(saved);
      } else {
        const saved = await createInvoice({
          patient_id: form.patient_id,
          service_package: form.service_package.trim(),
          amount: form.amount,
          discount: form.discount,
          status: form.status as "Paid" | "Due",
          payment_method: form.payment_method || null,
        });
        onSaved(saved);
      }
      onClose();
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 403) {
        setServerError("Only administrators can edit payment details or void invoices.");
      } else if (status === 404) {
        setServerError("The selected patient no longer exists.");
      } else if (status === 422) {
        setServerError("Invalid invoice data — check the amounts and try again.");
      } else {
        setServerError("Could not save the invoice. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit ${invoice?.invoice_number}` : "Create Bill"}
      maxWidthClassName="max-w-2xl"
      actions={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" form="invoice-form" className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create invoice"}
          </button>
        </>
      }
    >
      <form id="invoice-form" onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Patient */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary" htmlFor="im-patient">
              Patient *
            </label>
            <select
              id="im-patient"
              className="input-field"
              value={form.patient_id}
              disabled={isEdit} // patient link is immutable after creation
              onChange={(e) => set("patient_id", e.target.value)}
            >
              <option value="">Select patient…</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.phone})
                </option>
              ))}
            </select>
            {fieldErrors.patient_id && (
              <p className="mt-1 text-xs text-status-error">{fieldErrors.patient_id}</p>
            )}
          </div>

          {/* Service / Package */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary" htmlFor="im-service">
              Service / Package *
            </label>
            <input
              id="im-service"
              type="text"
              className="input-field"
              value={form.service_package}
              onChange={(e) => set("service_package", e.target.value)}
              placeholder="e.g. 10-Session Rehab"
            />
            {fieldErrors.service_package && (
              <p className="mt-1 text-xs text-status-error">{fieldErrors.service_package}</p>
            )}
          </div>

          {/* Amount */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary" htmlFor="im-amount">
              Amount *
            </label>
            <input
              id="im-amount"
              type="number"
              min="0"
              step="0.01"
              className="input-field font-mono"
              value={form.amount}
              disabled={isEdit} // amount immutable after creation (void + re-bill instead)
              onChange={(e) => set("amount", e.target.value)}
              placeholder="5000.00"
            />
            {fieldErrors.amount && (
              <p className="mt-1 text-xs text-status-error">{fieldErrors.amount}</p>
            )}
          </div>

          {/* Discount */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary" htmlFor="im-discount">
              Discount{isEdit && !isAdmin ? " (admin only)" : ""}
            </label>
            <input
              id="im-discount"
              type="number"
              min="0"
              step="0.01"
              className="input-field font-mono"
              value={form.discount}
              disabled={isEdit && !isAdmin}
              onChange={(e) => set("discount", e.target.value)}
            />
            {fieldErrors.discount && (
              <p className="mt-1 text-xs text-status-error">{fieldErrors.discount}</p>
            )}
          </div>

          {/* Status */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary" htmlFor="im-status">
              Payment Status *
            </label>
            <select
              id="im-status"
              className="input-field"
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {fieldErrors.status && (
              <p className="mt-1 text-xs text-status-error">{fieldErrors.status}</p>
            )}
          </div>

          {/* Payment method */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary" htmlFor="im-pay">
              Payment Method{isEdit && !isAdmin ? " (admin only)" : ""}
            </label>
            <select
              id="im-pay"
              className="input-field"
              value={form.payment_method}
              disabled={isEdit && !isAdmin}
              onChange={(e) => set("payment_method", e.target.value)}
            >
              <option value="">Not specified</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Live net amount */}
        {netAmount !== null && (
          <div className="flex items-center justify-between rounded-lg border border-border-custom bg-bg-app px-4 py-3">
            <span className="text-sm text-text-secondary">Net Amount</span>
            <span
              className={`font-display text-xl font-semibold ${
                netAmount < 0 ? "text-status-error" : "text-text-primary"
              }`}
            >
              {formatMoney(netAmount)}
            </span>
          </div>
        )}

        {isEdit && !isAdmin && (
          <p className="rounded-lg bg-status-neutral-soft px-3 py-2 text-sm text-status-neutral">
            As staff you can update the payment status; discount and payment method changes
            require an administrator.
          </p>
        )}

        {serverError && (
          <div
            className="rounded-lg border border-status-error-soft bg-status-error-soft px-3 py-2 text-sm text-status-error"
            role="alert"
          >
            {serverError}
          </div>
        )}
      </form>
    </Modal>
  );
}
