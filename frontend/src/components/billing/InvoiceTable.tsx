"use client";

import { Badge } from "@/components/ui/Badge";
import { formatDate, formatMoney, type Invoice } from "@/lib/billing";

/**
 * Invoices table — design-system surfaces, mono numerics, status badges.
 * Actions: Mark as Paid (staff), Print (opens print sheet), Void (admin).
 */

function statusVariant(status: string): "success" | "neutral" | "error" {
  switch (status) {
    case "Paid":
      return "success";
    case "Void":
      return "neutral";
    default:
      return "error"; // Due / Overdue
  }
}

export interface InvoiceTableProps {
  invoices: Invoice[];
  isLoading: boolean;
  isAdmin: boolean;
  emptyMessage?: string;
  onMarkPaid: (invoice: Invoice) => void;
  onPrint: (invoice: Invoice) => void;
  onVoid: (invoice: Invoice) => void;
}

export function InvoiceTable({
  invoices,
  isLoading,
  isAdmin,
  emptyMessage,
  onMarkPaid,
  onPrint,
  onVoid,
}: InvoiceTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2 p-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-bg-app" />
        ))}
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="px-5 py-10 text-center">
        <p className="font-display text-lg text-text-primary">No invoices found</p>
        <p className="mt-1 text-sm text-text-secondary">
          {emptyMessage ?? "Create a bill or adjust the filters."}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border-custom text-xs uppercase tracking-wide text-text-secondary">
            <th className="px-5 py-3 font-medium">Invoice #</th>
            <th className="px-5 py-3 font-medium">Patient</th>
            <th className="px-5 py-3 font-medium">Date</th>
            <th className="px-5 py-3 font-medium">Service / Package</th>
            <th className="px-5 py-3 font-medium text-right">Amount</th>
            <th className="px-5 py-3 font-medium text-right">Discount</th>
            <th className="px-5 py-3 font-medium text-right">Net</th>
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="px-5 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => (
            <tr
              key={inv.id}
              className={`border-b border-border-custom/60 transition-colors last:border-0 hover:bg-primary-soft/20 ${
                inv.status === "Void" ? "opacity-60" : ""
              }`}
            >
              <td className="px-5 py-3 font-mono text-xs text-text-primary">
                {inv.invoice_number}
              </td>
              <td className="px-5 py-3">
                <span className="font-medium text-text-primary">
                  {inv.patient_name ?? "—"}
                </span>
              </td>
              <td className="px-5 py-3 font-mono text-xs text-text-secondary">
                {formatDate(inv.created_at)}
              </td>
              <td className="px-5 py-3 text-text-secondary">{inv.service_package}</td>
              <td className="px-5 py-3 text-right font-mono text-xs text-text-primary">
                {formatMoney(inv.amount)}
              </td>
              <td className="px-5 py-3 text-right font-mono text-xs text-text-secondary">
                {formatMoney(inv.discount)}
              </td>
              <td className="px-5 py-3 text-right font-mono text-xs font-semibold text-text-primary">
                {formatMoney(inv.net_amount)}
              </td>
              <td className="px-5 py-3">
                <Badge variant={statusVariant(inv.status)}>{inv.status}</Badge>
              </td>
              <td className="px-5 py-3">
                <div className="flex items-center justify-end gap-1">
                  {inv.status === "Due" && (
                    <button
                      type="button"
                      className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-tertiary transition-colors hover:bg-status-success-soft"
                      onClick={() => onMarkPaid(inv)}
                    >
                      Mark Paid
                    </button>
                  )}
                  <button
                    type="button"
                    className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-primary-text-soft transition-colors hover:bg-primary-soft"
                    onClick={() => onPrint(inv)}
                  >
                    Print
                  </button>
                  {inv.status !== "Void" && isAdmin && (
                    <button
                      type="button"
                      className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-status-error transition-colors hover:bg-status-error-soft"
                      onClick={() => onVoid(inv)}
                    >
                      Void
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
