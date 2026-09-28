"""
Pydantic schemas for Patient.

Listing endpoints return flat rows (PatientResponse); the profile endpoint
returns a PatientDetailResponse with nested session and billing history.
"""

import uuid
from datetime import date, datetime, time as dt_time
from typing import Optional

from pydantic import BaseModel, Field, field_validator

from backend.app.schemas.therapist import TherapistSummary  # noqa: F401 – re-exported

# Allowed patient lifecycle statuses.
PATIENT_STATUSES = ("Active", "Completed", "On hold")


# ---------------------------------------------------------------------------
# Nested summaries (TherapistSummary is imported from schemas.therapist)
# ---------------------------------------------------------------------------


class AppointmentSummary(BaseModel):
    """One row of a patient's session history."""

    id: uuid.UUID
    date: date
    start_time: dt_time
    end_time: dt_time
    status: str
    notes: Optional[str] = None
    therapist: Optional[TherapistSummary] = None

    model_config = {"from_attributes": True}


class InvoiceSummary(BaseModel):
    """One row of a patient's billing history."""

    id: uuid.UUID
    invoice_number: str
    service_package: str
    amount: float
    discount: float
    status: str
    payment_method: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Patient schemas
# ---------------------------------------------------------------------------


class PatientBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    phone: str = Field(..., min_length=3, max_length=20)
    age: int = Field(..., ge=0, le=120)
    gender: str = Field(..., max_length=20)
    address: Optional[str] = None
    condition: Optional[str] = None
    assigned_therapist_id: Optional[uuid.UUID] = None
    package: Optional[str] = None
    status: str = "Active"


class PatientCreate(PatientBase):
    """Body for POST /patients."""

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in PATIENT_STATUSES:
            raise ValueError(f"status must be one of {PATIENT_STATUSES}")
        return v


class PatientUpdate(BaseModel):
    """Body for PUT /patients/{id} - all fields optional (partial update)."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    phone: Optional[str] = Field(None, min_length=3, max_length=20)
    age: Optional[int] = Field(None, ge=0, le=120)
    gender: Optional[str] = Field(None, max_length=20)
    address: Optional[str] = None
    condition: Optional[str] = None
    assigned_therapist_id: Optional[uuid.UUID] = None
    package: Optional[str] = None
    status: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in PATIENT_STATUSES:
            raise ValueError(f"status must be one of {PATIENT_STATUSES}")
        return v


class PatientResponse(BaseModel):
    """Flat patient row used by list and create/update responses."""

    id: uuid.UUID
    name: str
    phone: str
    age: int
    gender: str
    address: Optional[str] = None
    condition: Optional[str] = None
    assigned_therapist_id: Optional[uuid.UUID] = None
    package: Optional[str] = None
    status: str
    assigned_therapist: Optional[TherapistSummary] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PatientDetailResponse(PatientResponse):
    """Patient profile with nested session and billing history."""

    session_history: list[AppointmentSummary] = []
    billing_history: list[InvoiceSummary] = []


class PatientListResponse(BaseModel):
    """Paginated patient listing envelope."""

    items: list[PatientResponse]
    total: int
    skip: int
    limit: int
