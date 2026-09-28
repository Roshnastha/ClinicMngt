"""
Pydantic schemas for the Scheduling & Appointment Grid engine.

Covers appointment CRUD payloads, status transitions, and the structured
daily-grid matrix (therapists as columns, time slots as rows).
"""

import uuid
from datetime import date, datetime, time as dt_time
from typing import Optional

from pydantic import BaseModel, Field, model_validator

APPOINTMENT_STATUSES = ("Booked", "Completed", "Cancelled")
PAYMENT_METHODS = ("Cash", "Card", "UPI", "Insurance")


class PatientMini(BaseModel):
    """Concise patient info for grid cells."""

    id: uuid.UUID
    name: str
    phone: str

    model_config = {"from_attributes": True}


class TherapistMini(BaseModel):
    """Concise therapist info for grid columns."""

    id: uuid.UUID
    name: str
    specialty: str

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Appointment payloads
# ---------------------------------------------------------------------------


class AppointmentCreate(BaseModel):
    """Body for POST /schedule/appointments."""

    patient_id: uuid.UUID
    therapist_id: uuid.UUID
    date: date
    start_time: dt_time
    end_time: dt_time
    payment_method: Optional[str] = None
    notes: Optional[str] = Field(None, max_length=2000)

    @model_validator(mode="after")
    def validate_window(self) -> "AppointmentCreate":
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class AppointmentReschedule(BaseModel):
    """Body for PUT /schedule/appointments/{id}/reschedule."""

    date: date
    start_time: dt_time
    end_time: dt_time

    @model_validator(mode="after")
    def validate_window(self) -> "AppointmentReschedule":
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class AppointmentStatusUpdate(BaseModel):
    """Body for PATCH /schedule/appointments/{id}/status."""

    status: str

    model_config = {"json_schema_extra": {"examples": [{"status": "Completed"}]}}

    @model_validator(mode="after")
    def validate_status(self) -> "AppointmentStatusUpdate":
        if self.status not in APPOINTMENT_STATUSES:
            raise ValueError(f"status must be one of {APPOINTMENT_STATUSES}")
        return self


class AppointmentResponse(BaseModel):
    """Full appointment row with nested patient/therapist summaries."""

    id: uuid.UUID
    patient_id: uuid.UUID
    therapist_id: uuid.UUID
    date: date
    start_time: dt_time
    end_time: dt_time
    status: str
    payment_method: Optional[str] = None
    notes: Optional[str] = None
    patient: Optional[PatientMini] = None
    therapist: Optional[TherapistMini] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Daily grid matrix
# ---------------------------------------------------------------------------


class GridBookedCell(BaseModel):
    """A BOOKED cell: the appointment plus patient/therapist context."""

    appointment_id: uuid.UUID
    patient: Optional[PatientMini] = None
    status: str
    condition: Optional[str] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None


class GridCell(BaseModel):
    """One therapist × slot cell, labeled OPEN | BOOKED | THERAPIST_OFF."""

    slot_start: dt_time
    slot_end: dt_time
    state: str  # "OPEN" | "BOOKED" | "THERAPIST_OFF"
    booked: Optional[GridBookedCell] = None


class GridTherapistColumn(BaseModel):
    """One therapist column with their availability for the selected date."""

    therapist: TherapistMini
    on_duty: bool  # working day & hours defined (day-off overrides → False)
    window_start: Optional[dt_time] = None  # effective (override-aware) start
    window_end: Optional[dt_time] = None
    day_off: bool  # explicit override day off


class DailyGridResponse(BaseModel):
    """The full schedule matrix for one operating day."""

    date: date
    slot_minutes: int  # grid granularity (min of on-duty therapists' slots)
    slots: list[dt_time]  # ordered row labels (slot start times)
    therapists: list[GridTherapistColumn]
    cells: list[list[GridCell]]  # [row][column] = slot × therapist
