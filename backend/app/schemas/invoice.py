"""
Pydantic schemas for Billing & Financial Invoicing.

Invoice numbers are auto-generated (INV-YYYY-XXXX); ``net_amount`` is a
computed field (amount - discount). Status lifecycle: Paid | Due | Void.
"""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, computed_field, field_validator

INVOICE_STATUSES = ("Paid", "Due", "Void")
INVOICE_CREATE_STATUSES = ("Paid", "Due")  # Void only via DELETE (void) flow
PAYMENT_METHODS = ("Cash", "Card", "Insurance", "Bank Transfer")


class InvoiceBase(BaseModel):
    patient_id: uuid.UUID
    service_package: str = Field(..., min_length=1, max_length=255)
    amount: Decimal = Field(..., gt=0, max_digits=10, decimal_places=2)
    discount: Decimal = Field(default=Decimal("0.00"), ge=0, max_digits=10, decimal_places=2)
    status: str = "Due"
    payment_method: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in INVOICE_CREATE_STATUSES:
            raise ValueError(f"status must be one of {INVOICE_CREATE_STATUSES}")
        return v

    @field_validator("payment_method")
    @classmethod
    def validate_payment_method(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in PAYMENT_METHODS:
            raise ValueError(f"payment_method must be one of {PAYMENT_METHODS}")
        return v


class InvoiceCreate(InvoiceBase):
    """Body for POST /billing/invoices."""


class InvoiceUpdate(BaseModel):
    """Body for PUT /billing/invoices/{id} - partial; role rules apply."""

    status: Optional[str] = None
    payment_method: Optional[str] = None
    discount: Optional[Decimal] = Field(None, ge=0, max_digits=10, decimal_places=2)

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in INVOICE_STATUSES:
            raise ValueError(f"status must be one of {INVOICE_STATUSES}")
        return v

    @field_validator("payment_method")
    @classmethod
    def validate_payment_method(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in PAYMENT_METHODS:
            raise ValueError(f"payment_method must be one of {PAYMENT_METHODS}")
        return v


class PatientBackground(BaseModel):
    """Patient context embedded in the single-invoice response."""

    id: uuid.UUID
    name: str
    phone: str
    package: Optional[str] = None

    model_config = {"from_attributes": True}


class InvoiceResponse(BaseModel):
    """Invoice row with computed net amount and patient name."""

    id: uuid.UUID
    invoice_number: str
    patient_id: uuid.UUID
    patient_name: Optional[str] = None
    service_package: str
    amount: Decimal
    discount: Decimal
    status: str
    payment_method: Optional[str] = None
    patient: Optional[PatientBackground] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}

    @computed_field  # type: ignore[prop-decorator]
    @property
    def net_amount(self) -> Decimal:
        return (self.amount - self.discount).quantize(Decimal("0.01"))


class InvoiceListResponse(BaseModel):
    """Paginated invoice listing envelope."""

    items: list[InvoiceResponse]
    total: int
    skip: int
    limit: int
