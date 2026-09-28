"""
Billing service layer – invoicing, numbering engine and role rules.

Role rules implemented here (configurable, per spec):
* STAFF may list, view, create (generate) and mark Paid.
* ADMIN-only: Voiding (DELETE), editing payment details (payment_method /
  discount edits on existing invoices) — enforced via ``ensure_can_*``.
"""

import uuid
from datetime import date
from decimal import Decimal
from typing import Optional, Sequence

from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from backend.app.models.invoice import Invoice
from backend.app.models.patient import Patient
from backend.app.schemas.invoice import InvoiceCreate, InvoiceUpdate

VOID_STATUS = "Void"


# ---------------------------------------------------------------------------
# Invoice numbering engine
# ---------------------------------------------------------------------------


def _next_invoice_number(db: Session) -> str:
    """
    Sequential invoice number in the form INV-YYYY-XXXX.

    Uses MAX(number) per year rather than a counter table: simple, and safe
    under normal low-concurrency clinic usage. A unique index backs it up.
    """
    year = date.today().year
    prefix = f"INV-{year}-"
    like = f"{prefix}%"

    last = (
        db.query(Invoice.invoice_number)
        .filter(Invoice.invoice_number.ilike(like))
        .order_by(Invoice.invoice_number.desc())
        .first()
    )

    next_seq = 1
    if last is not None:
        try:
            next_seq = int(last[0].rsplit("-", 1)[1]) + 1
        except (IndexError, ValueError):
            next_seq = 1

    # Guard against collisions if rows were manually numbered.
    existing = {
        row[0]
        for row in db.query(Invoice.invoice_number).filter(Invoice.invoice_number.ilike(like)).all()
    }
    candidate = f"{prefix}{next_seq:04d}"
    while candidate in existing:
        next_seq += 1
        candidate = f"{prefix}{next_seq:04d}"
    return candidate


def _ensure_patient_exists(db: Session, patient_id: uuid.UUID) -> None:
    if db.get(Patient, patient_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found")


def get_invoice_or_404(db: Session, invoice_id: uuid.UUID) -> Invoice:
    invoice = (
        db.query(Invoice)
        .options(joinedload(Invoice.patient))
        .filter(Invoice.id == invoice_id)
        .first()
    )
    if invoice is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
    return invoice


# ---------------------------------------------------------------------------
# Serialization helpers
# ---------------------------------------------------------------------------


def to_response(invoice: Invoice) -> dict:
    """Serialize one invoice with the patient name resolved."""
    patient = invoice.patient
    return {
        "id": invoice.id,
        "invoice_number": invoice.invoice_number,
        "patient_id": invoice.patient_id,
        "patient_name": patient.name if patient is not None else None,
        "service_package": invoice.service_package,
        "amount": str(invoice.amount),
        "discount": str(invoice.discount),
        "net_amount": str((invoice.amount - invoice.discount).quantize(Decimal("0.01"))),
        "status": invoice.status,
        "payment_method": invoice.payment_method,
        "created_at": invoice.created_at,
        "updated_at": invoice.updated_at,
    }


# ---------------------------------------------------------------------------
# Role rules (configurable)
# ---------------------------------------------------------------------------

# Editable-by-staff fields on an existing invoice; everything else is
# admin-only (payment details + discount adjustments).
STAFF_EDITABLE_FIELDS = {"status"}


def ensure_can_void(user_role: str) -> None:
    """Voiding invoices is admin-only."""
    if user_role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can void invoices.",
        )


def ensure_can_edit(user_role: str, changes: dict) -> None:
    """
    Gate invoice edits by role.

    Staff may only change lifecycle status (e.g. mark a Due invoice Paid).
    Sensitive payment details (payment_method, discount) require an admin.
    """
    sensitive = set(changes) - STAFF_EDITABLE_FIELDS
    if user_role != "ADMIN" and sensitive:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Only administrators can edit payment details "
                f"({', '.join(sorted(sensitive))})."
            ),
        )


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------


def list_invoices(
    db: Session,
    *,
    status_filter: Optional[str] = None,
    patient_id: Optional[uuid.UUID] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
) -> tuple[Sequence[Invoice], int]:
    """Filtered invoice list; total counted before pagination."""
    query = db.query(Invoice)

    if status_filter:
        if status_filter not in ("Paid", "Due", "Void"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="status filter must be Paid, Due or Void",
            )
        query = query.filter(Invoice.status == status_filter)

    if patient_id is not None:
        query = query.filter(Invoice.patient_id == patient_id)

    if search:
        like = f"%{search}%"
        patient_ids = [
            row[0]
            for row in db.query(Patient.id).filter(Patient.name.ilike(like)).all()
        ]
        conditions = [Invoice.invoice_number.ilike(like)]
        if patient_ids:
            conditions.append(Invoice.patient_id.in_(patient_ids))
        query = query.filter(or_(*conditions))

    total = query.count()
    query = query.options(joinedload(Invoice.patient)).order_by(Invoice.created_at.desc())
    if skip:
        query = query.offset(skip)
    if limit is not None:
        query = query.limit(limit)
    return query.all(), total


def create_invoice(db: Session, data: InvoiceCreate) -> Invoice:
    """Generate a new invoice with an auto-assigned sequential number."""
    _ensure_patient_exists(db, data.patient_id)
    invoice = Invoice(
        invoice_number=_next_invoice_number(db),
        patient_id=data.patient_id,
        service_package=data.service_package,
        amount=data.amount,
        discount=data.discount,
        status=data.status,
        payment_method=data.payment_method,
    )
    db.add(invoice)
    db.commit()
    db.refresh(invoice)
    return invoice


def update_invoice(db: Session, invoice: Invoice, data: InvoiceUpdate, user_role: str) -> Invoice:
    """Partial update; staff may only touch lifecycle status."""
    changes = data.model_dump(exclude_unset=True)
    ensure_can_edit(user_role, changes)

    if changes.get("status") == VOID_STATUS:
        # Voiding goes through the dedicated DELETE (void) endpoint.
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail='Use DELETE /billing/invoices/{id} to void an invoice.',
        )

    if "discount" in changes and invoice.amount is not None:
        if Decimal(str(changes["discount"])) > invoice.amount:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Discount cannot exceed the invoice amount.",
            )
    for field, value in changes.items():
        setattr(invoice, field, value)
    db.commit()
    db.refresh(invoice)
    return invoice


def void_invoice(db: Session, invoice: Invoice) -> Invoice:
    """Soft-void: keeps the row for audit but marks it Void."""
    invoice.status = VOID_STATUS
    db.commit()
    db.refresh(invoice)
    return invoice


def delete_invoice(db: Session, invoice: Invoice) -> None:
    """Hard delete (admin-only in the API layer)."""
    db.delete(invoice)
    db.commit()


def billing_summary(db: Session) -> dict:
    """Totals for the stat strip: billed / paid / outstanding."""
    rows = (
        db.query(Invoice.status, func.sum(Invoice.amount - Invoice.discount))
        .group_by(Invoice.status)
        .all()
    )
    totals = {s: float(net or 0) for s, net in rows}
    billed = sum(totals.values())
    return {
        "total_billed": round(billed, 2),
        "total_paid": round(totals.get("Paid", 0.0), 2),
        "total_due": round(totals.get("Due", 0.0), 2),
        "total_voided": round(totals.get("Void", 0.0), 2),
    }
