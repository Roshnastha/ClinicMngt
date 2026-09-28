"""
Pydantic schemas for Therapist and schedule overrides.

Weekly schedule is stored as a JSON list of weekday names, e.g.
``["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]``.
"""

import uuid
from datetime import date, datetime, time
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator

# ---------------------------------------------------------------------------
# Value objects
# ---------------------------------------------------------------------------

VALID_DAYS = (
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
)

ALLOWED_SLOT_DURATIONS = (30, 45, 60)


class TherapistSummary(BaseModel):
    """Concise therapist info for dropdowns and nested patient responses."""

    id: uuid.UUID
    name: str
    specialty: str

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Nested metric summaries
# ---------------------------------------------------------------------------


class PatientMini(BaseModel):
    """Minimal patient info for roster callouts."""

    id: uuid.UUID
    name: str
    status: str

    model_config = {"from_attributes": True}


class AppointmentToday(BaseModel):
    """One appointment row in the 'booked today' summary."""

    id: uuid.UUID
    start_time: time
    end_time: time
    status: str
    patient: Optional[PatientMini] = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Therapist CRUD schemas
# ---------------------------------------------------------------------------


class TherapistBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    specialty: str = Field(..., min_length=1, max_length=255)
    working_days: list[str] = Field(default_factory=list)
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    slot_duration_minutes: int = 60

    @field_validator("working_days")
    @classmethod
    def validate_working_days(cls, v: list[str]) -> list[str]:
        cleaned: list[str] = []
        for day in v:
            day_title = day.strip().title()
            if day_title not in VALID_DAYS:
                raise ValueError(f"working_days must contain weekday names from {VALID_DAYS}")
            if day_title not in cleaned:
                cleaned.append(day_title)
        # Keep canonical Monday→Sunday order.
        return sorted(cleaned, key=VALID_DAYS.index)

    @field_validator("slot_duration_minutes")
    @classmethod
    def validate_slot_duration(cls, v: int) -> int:
        if v not in ALLOWED_SLOT_DURATIONS:
            raise ValueError(f"slot_duration_minutes must be one of {ALLOWED_SLOT_DURATIONS}")
        return v

    @model_validator(mode="after")
    def validate_hours(self) -> "TherapistBase":
        if (self.start_time is None) != (self.end_time is None):
            raise ValueError("start_time and end_time must be provided together")
        if self.start_time is not None and self.end_time is not None and self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class TherapistCreate(TherapistBase):
    """Body for POST /therapists."""


class TherapistUpdate(BaseModel):
    """Body for PUT /therapists/{id} - all fields optional (partial update)."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    specialty: Optional[str] = Field(None, min_length=1, max_length=255)
    working_days: Optional[list[str]] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    slot_duration_minutes: Optional[int] = None

    @field_validator("working_days")
    @classmethod
    def validate_working_days(cls, v: Optional[list[str]]) -> Optional[list[str]]:
        if v is None:
            return v
        cleaned: list[str] = []
        for day in v:
            day_title = day.strip().title()
            if day_title not in VALID_DAYS:
                raise ValueError(f"working_days must contain weekday names from {VALID_DAYS}")
            if day_title not in cleaned:
                cleaned.append(day_title)
        return sorted(cleaned, key=VALID_DAYS.index)

    @field_validator("slot_duration_minutes")
    @classmethod
    def validate_slot_duration(cls, v: Optional[int]) -> Optional[int]:
        if v is None:
            return v
        if v not in ALLOWED_SLOT_DURATIONS:
            raise ValueError(f"slot_duration_minutes must be one of {ALLOWED_SLOT_DURATIONS}")
        return v

    @model_validator(mode="after")
    def validate_hours(self) -> "TherapistUpdate":
        if self.start_time is not None and self.end_time is not None and self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


# ---------------------------------------------------------------------------
# Override schemas
# ---------------------------------------------------------------------------


class TherapistOverrideCreate(BaseModel):
    """Body for POST /therapists/{id}/overrides (upsert per date)."""

    therapist_id: Optional[uuid.UUID] = None  # ignored in path-based upsert
    date: date
    is_day_off: bool = False
    custom_start_time: Optional[time] = None
    custom_end_time: Optional[time] = None
    notes: Optional[str] = Field(None, max_length=255)

    @model_validator(mode="after")
    def validate_custom_hours(self) -> "TherapistOverrideCreate":
        if self.is_day_off:
            self.custom_start_time = None
            self.custom_end_time = None
        else:
            if (self.custom_start_time is None) != (self.custom_end_time is None):
                raise ValueError("custom_start_time and custom_end_time must be provided together")
            if (
                self.custom_start_time is not None
                and self.custom_end_time is not None
                and self.custom_end_time <= self.custom_start_time
            ):
                raise ValueError("custom_end_time must be after custom_start_time")
        return self


class TherapistOverrideRead(TherapistOverrideCreate):
    id: uuid.UUID
    therapist_id: uuid.UUID

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------


class TherapistResponse(BaseModel):
    """Roster row with calculated metrics."""

    id: uuid.UUID
    name: str
    specialty: str
    working_days: list[str] = []
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    slot_duration_minutes: int
    weekly_hours: float
    active_patients_count: int
    appointments_today: list[AppointmentToday] = []
    appointments_today_count: int = 0
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TherapistListResponse(BaseModel):
    """Paginated therapist listing envelope."""

    items: list[TherapistResponse]
    total: int


class TherapistDetailResponse(TherapistResponse):
    """Single therapist profile with default schedule + date overrides."""

    overrides: list[TherapistOverrideRead] = []
