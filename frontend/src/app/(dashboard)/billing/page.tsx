"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { InvoiceTable } from "@/components/billing/InvoiceTable";
import { InvoiceModal } from "@/components/billing/InvoiceModal";
import { InvoicePrintModal } from "@/components/billing/InvoicePrintModal";
import { usePageHeader } from "@/components/layout/page-header-context";
import { useAuth } from "@/lib/auth-context";
import {
  fetchBillingSummary,
  fetchInvoices,
  formatMoney,
  updateInvoice,
  voidInvoice,
  type BillingSummary,
  type Invoice,
} from "@/lib/billing";

/**
 * Billing & Invoices — stat strip (billed/paid/due), status filter tabs,
 * search by invoice # or patient name, create/edit modal, print sheet
 * and admin-only voiding.
 */

const STATUS_TABS = ["All", "Paid", "Due", "Void"] as const;

export default function BillingPage() {
  const { isAdmin } = useAuth();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters
  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusTab, setStatusTab] = useState<(typeof STATUS_TABS)[number]>("All");

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [printing, setPrinting] = useState<string | null>(null);
  const [voiding, setVoiding] = useState<Invoice | null>(null);
  const [voidError, setVoidError] = useState<string | null>(null);

  usePageHeader({
    title: "Billing & Invoices",
    actions: (
      <button
        type="button"
        className="btn-primary"
        onClick={() => {
          setEditing(null);
          setModalOpen(true);
        }}
      >
        + Create Bill
      </button>
    ),
  });

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await fetchInvoices({
        search: appliedSearch || undefined,
        status: statusTab === "All" ? undefined : statusTab,
      });
      setInvoices(data.items);
      setTotal(data.total);
      fetchBillingSummary().then(setSummary).catch(() => setSummary(null));
    } catch {
      setLoadError("Could not load invoices. Is the backend running?");
    } finally {
      setIsLoading(false);
    }
  }, [appliedSearch, statusTab]);

  useEffect(() => {
    load();
  }, [load]);

  // Debounce search (350 ms).
  useEffect(() => {
    const t = setTimeout(() => setAppliedSearch(searchInput.trim() || ""), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const handleSaved = useCallback(() => {
    setModalOpen(false);
    setEditing(null);
    load();
  }, [load]);

  async function handleMarkPaid(invoice: Invoice) {
    try {
      await updateInvoice(invoice.id, { status: "Paid" });
      load();
    } catch {
      setLoadError("Could not mark the invoice as paid.");
    }
  }

  async function handleVoidConfirm(purge: boolean) {
    if (!voiding) return;
    setVoidError(null);
    try {
      await voidInvoice(voiding.id, purge);
      setVoiding(null);
      load();
    } catch (err) {
      const status = (err as { status?: number }).status;
      setVoidError(
        status === 403
          ? "Only administrators can void invoices."
          : "Could not void the invoice. Please try again.",
      );
    }
  }

  return (
    <div className="space-y-6">
      {/* Stat strip */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Billed"
          value={summary ? formatMoney(summary.total_billed) : "—"}
          subtext="all invoices"
          trend="flat"
        />
        <StatCard
          label="Total Paid"
          value={summary ? formatMoney(summary.total_paid) : "—"}
          subtext="settled invoices"
          trend="up"
        />
        <StatCard
          label="Outstanding / Due"
          value={summary ? formatMoney(summary.total_due) : "—"}
          subtext="awaiting payment"
          trend="down"
        />
        <StatCard
          label="Invoices"
          value={total}
          subtext={statusTab === "All" ? "in the ledger" : `filtered: ${statusTab}`}
          trend="flat"
        />
      </section>

      {/* Toolbar + table */}
      <Card paddingClassName="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-border-custom/70 px-5 py-4">
          {/* Status tabs */}
          <div className="flex rounded-lg border border-border-custom bg-bg-app p-0.5">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusTab(tab)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  statusTab === tab
                    ? "bg-primary text-white shadow-sm"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Search */}
          <input
            type="search"
            className="input-field sm:ml-auto sm:max-w-xs"
            placeholder="Search invoice # or patient…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search invoices"
          />
        </div>

        {loadError && (
          <div className="border-b border-status-error-soft bg-status-error-soft px-5 py-3 text-sm text-status-error" role="alert">
            {loadError}
          </div>
        )}

        <InvoiceTable
          invoices={invoices}
          isLoading={isLoading}
          isAdmin={isAdmin}
          emptyMessage={appliedSearch || statusTab !== "All" ? "No matching invoices" : undefined}
          onMarkPaid={handleMarkPaid}
          onPrint={(inv) => setPrinting(inv.id)}
          onVoid={(inv) => {
            setVoidError(null);
            setVoiding(inv);
          }}
        />
      </Card>

      {/* Modals */}
      <InvoiceModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        invoice={editing}
        isAdmin={isAdmin}
        onSaved={handleSaved}
      />

      <InvoicePrintModal
        open={Boolean(printing)}
        onClose={() => setPrinting(null)}
        invoiceId={printing}
      />

      {/* Void confirmation (admin only) */}
      {voiding && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#132420]/60 p-4"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setVoiding(null);
          }}
        >
          <div className="w-full max-w-md rounded-card border border-border-custom bg-surface shadow-soft-lg">
            <div className="border-b border-border-custom/70 px-5 py-4">
              <h2 className="font-display text-xl font-semibold text-text-primary">
                Void invoice
              </h2>
            </div>
            <div className="space-y-3 px-5 py-4">
              <p className="text-sm text-text-primary">
                Void <span className="font-mono font-semibold">{voiding.invoice_number}</span> (
                {formatMoney(voiding.net_amount)})? The record is kept for audit but marked
                as Void.
              </p>
              {!isAdmin && (
                <p className="rounded-lg bg-status-neutral-soft px-3 py-2 text-sm text-status-neutral">
                  Your role does not permit voiding. Ask an administrator.
                </p>
              )}
              {voidError && (
                <p className="rounded-lg bg-status-error-soft px-3 py-2 text-sm text-status-error" role="alert">
                  {voidError}
                </p>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border-custom/70 px-5 py-4">
              <button type="button" className="btn-secondary" onClick={() => setVoiding(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary bg-status-error hover:bg-status-error/90"
                onClick={() => handleVoidConfirm(false)}
              >
                Void invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
