"""
Billing API router – invoices, payments and financial records.

* GET    /billing/invoices          list + status/patient/search filters
* POST   /billing/invoices          generate a new invoice (numbered)
* GET    /billing/invoices/{id}     single invoice with patient background
* PUT    /billing/invoices/{id}     update (staff: status; admin: payment details)
* DELETE /billing/invoices/{id}     void (soft, default) or purge (?purge=true)
* GET    /billing/summary           stat-strip totals
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_user
from backend.app.core.database import get_db
from backend.app.models.user import User
from backend.app.schemas.invoice import (
    InvoiceCreate,
    InvoiceListResponse,
    InvoiceResponse,
    InvoiceUpdate,
)
from backend.app.services import billing_service

router = APIRouter(prefix="/billing", tags=["Billing"])


@router.get("/invoices", response_model=InvoiceListResponse)
async def list_invoices(
    status_filter: Optional[str] = Query(None, alias="status", description="Paid | Due | Void"),
    patient_id: Optional[uuid.UUID] = Query(None, alias="patient_id"),
    search: Optional[str] = Query(None, description="Invoice number or patient name"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List invoices with filters and pagination (newest first)."""
    rows, total = billing_service.list_invoices(
        db,
        status_filter=status_filter,
        patient_id=patient_id,
        search=search,
        skip=skip,
        limit=limit,
    )
    items = [InvoiceResponse.model_validate(billing_service.to_response(inv)) for inv in rows]
    return InvoiceListResponse(items=items, total=total, skip=skip, limit=limit)


@router.post("/invoices", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_invoice(
    payload: InvoiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a new invoice (sequential INV-YYYY-XXXX number)."""
    invoice = billing_service.create_invoice(db, payload)
    return InvoiceResponse.model_validate(billing_service.to_response(invoice))


@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch one invoice with the patient background."""
    invoice = billing_service.get_invoice_or_404(db, invoice_id)
    data = billing_service.to_response(invoice)
    if invoice.patient is not None:
        data["patient"] = invoice.patient
    return InvoiceResponse.model_validate(data)


@router.put("/invoices/{invoice_id}", response_model=InvoiceResponse)
async def update_invoice(
    invoice_id: uuid.UUID,
    payload: InvoiceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update an invoice.

    Staff may change the lifecycle status only (e.g. mark Due → Paid);
    payment details (payment_method, discount) are admin-only.
    """
    invoice = billing_service.get_invoice_or_404(db, invoice_id)
    updated = billing_service.update_invoice(db, invoice, payload, current_user.role)
    return InvoiceResponse.model_validate(billing_service.to_response(updated))


@router.delete("/invoices/{invoice_id}")
async def void_or_delete_invoice(
    invoice_id: uuid.UUID,
    purge: bool = Query(False, description="Hard-delete instead of voiding (admin only)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Void an invoice (admin only): the record is kept for audit with status
    Void. Pass ?purge=true to remove it permanently instead (204).
    """
    invoice = billing_service.get_invoice_or_404(db, invoice_id)
    billing_service.ensure_can_void(current_user.role)

    if purge:
        billing_service.delete_invoice(db, invoice)
        return None
    voided = billing_service.void_invoice(db, invoice)
    return InvoiceResponse.model_validate(billing_service.to_response(voided))


@router.get("/summary")
async def billing_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Stat-strip totals: billed / paid / outstanding (due) / voided."""
    return billing_service.billing_summary(db)
