"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import {
  fetchInvoice,
  formatDate,
  formatMoney,
  type InvoiceDetail,
} from "@/lib/billing";

/**
 * Printable invoice sheet — clean layout optimized for browser printing
 * / PDF export via @media print (only .print-area renders on paper).
 */

function statusVariant(status: string): "success" | "neutral" | "error" {
  switch (status) {
    case "Paid":
      return "success";
    case "Void":
      return "neutral";
    default:
      return "error";
  }
}

export interface InvoicePrintModalProps {
  open: boolean;
  onClose: () => void;
  /** Invoice id to load; the sheet fetches full details (patient background). */
  invoiceId: string | null;
}

export function InvoicePrintModal({ open, onClose, invoiceId }: InvoicePrintModalProps) {
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !invoiceId) {
      setInvoice(null);
      setError(null);
      return;
    }
    let cancelled = false;
    fetchInvoice(invoiceId)
      .then((data) => {
        if (!cancelled) setInvoice(data);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load the invoice.");
      });
    return () => {
      cancelled = true;
    };
  }, [open, invoiceId]);

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invoice"
      maxWidthClassName="max-w-3xl"
      actions={
        <>
          <button type="button" className="btn-secondary print:hidden" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="btn-primary print:hidden"
            onClick={() => window.print()}
          >
            Print / Save PDF
          </button>
        </>
      }
    >
      {error && (
        <p className="rounded-lg bg-status-error-soft px-3 py-2 text-sm text-status-error" role="alert">
          {error}
        </p>
      )}

      {!invoice && !error && <p className="py-8 text-center text-sm text-text-secondary">Loading…</p>}

      {invoice && (
        <div className="print-area bg-white p-2 text-text-primary">
          {/* Clinic header */}
          <div className="flex items-start justify-between border-b-2 border-[#B8763A] pb-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#B8763A] font-display text-lg font-bold text-white"
                >
                  P
                </span>
                <span className="font-display text-2xl font-bold tracking-tight">PhysioDesk</span>
              </div>
              <p className="mt-1.5 text-xs text-[#797365]">
                Physiotherapy &amp; Rehabilitation Clinic
              </p>
            </div>
            <div className="text-right">
              <h2 className="font-display text-xl font-semibold">INVOICE</h2>
              <p className="mt-0.5 font-mono text-sm text-[#1C2622]">{invoice.invoice_number}</p>
              <p className="mt-0.5 font-mono text-xs text-[#797365]">
                {formatDate(invoice.created_at)}
              </p>
            </div>
          </div>

          {/* Patient + status */}
          <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[#797365]">Billed To</p>
              <p className="mt-1 font-display text-lg font-semibold">
                {invoice.patient?.name ?? invoice.patient_name ?? "—"}
              </p>
              {invoice.patient && (
                <p className="font-mono text-xs text-[#797365]">{invoice.patient.phone}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wide text-[#797365]">Status</p>
              <div className="mt-1">
                <Badge variant={statusVariant(invoice.status)}>{invoice.status}</Badge>
              </div>
              {invoice.payment_method && (
                <p className="mt-1.5 text-xs text-[#797365]">
                  Method: <span className="font-medium text-[#1C2622]">{invoice.payment_method}</span>
                </p>
              )}
            </div>
          </div>

          {/* Itemized breakdown */}
          <table className="mt-6 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#E4DFD1] text-left text-[11px] uppercase tracking-wide text-[#797365]">
                <th className="py-2 font-medium">Description</th>
                <th className="py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[#E4DFD1]/60">
                <td className="py-3">{invoice.service_package}</td>
                <td className="py-3 text-right font-mono">{formatMoney(invoice.amount)}</td>
              </tr>
              <tr className="border-b border-[#E4DFD1]/60">
                <td className="py-3 text-[#797365]">Discount</td>
                <td className="py-3 text-right font-mono text-[#B5493B]">
                  −{formatMoney(invoice.discount)}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <td className="pt-3 text-right">
                  <span className="text-sm text-[#797365]">
                    Total {invoice.status === "Paid" ? "Paid" : "Due"}
                  </span>
                </td>
                <td className="pt-3 text-right">
                  <span className="font-display text-2xl font-bold">
                    {formatMoney(invoice.net_amount)}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Footer */}
          <div className="mt-8 border-t border-[#E4DFD1] pt-3 text-[11px] text-[#797365]">
            <p>Thank you for choosing PhysioDesk. This invoice was generated electronically.</p>
            <p className="mt-0.5 font-mono">
              Invoice {invoice.invoice_number} · Issued {formatDate(invoice.created_at)}
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}
