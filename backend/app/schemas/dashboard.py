"""
Pydantic schemas for the Live Dashboard & Analytics API.

All values are computed in real time from the database — nothing is cached
or hard-coded. The dashboard answers "what is happening right now?" for a
receptionist: who is on duty, who has been seen, what revenue came in, and
how much capacity is still free today.
"""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

# Canonical slot states mirrored from the schedule grid (GridCell.state).
# "OFF" here means "not working that slot" (day off, non-working weekday, or
# outside the effective working window — including override-aware logic).
SLOT_STATES = ("OPEN", "BOOKED", "OFF")


class DashboardStatsResponse(BaseModel):
    """
    The four headline metrics for one operating day.

    * patients_seen_today          – unique patients with a non-cancelled
                                     appointment today (Booked or Completed).
    * therapists_on_duty_today     – therapists working today, override-aware
                                     (explicit day-off / custom-hours wins).
    * revenue_collected_today      – net (amount - discount) summed over
                                     invoices created today AND marked Paid,
                                     plus invoices marked Paid today.
    * open_slots_remaining_today   – OPEN slots still free across every
                                     therapist on duty today.
    """

    patients_seen_today: int = 0
    therapists_on_duty_today: int = 0
    revenue_collected_today: float = 0.0
    open_slots_remaining_today: int = 0


class SlotBreakdown(BaseModel):
    """One slot row in a therapist's day: the time box and its live state."""

    time: str = Field(..., description="Slot start, HH:MM (24h)")
    status: str = Field(..., description="OPEN | BOOKED | OFF")
    patient_name: Optional[str] = Field(
        None, description="Patient occupying the slot (BOOKED only)"
    )


class TherapistCapacity(BaseModel):
    """
    Per-therapist capacity view for one day.

    total_slots / booked_slots / free_slots count only slots inside the
    therapist's effective working window (override-aware). Therapists off
    duty today have all-zero counts and an empty (or all-OFF) breakdown.
    """

    therapist_id: uuid.UUID
    therapist_name: str
    specialty: Optional[str] = None
    on_duty: bool = False
    working_window: Optional[str] = Field(
        None, description='"HH:MM–HH:MM" effective window, None when off duty'
    )
    total_slots: int = 0
    booked_slots: int = 0
    free_slots: int = 0
    utilization: float = Field(
        0.0, ge=0.0, le=1.0, description="booked / total; 0.0 when off duty"
    )
    slots_breakdown: list[SlotBreakdown] = []


class RecentPatientSummary(BaseModel):
    """
    Concise patient card for the "recent patients" table.

    ``updated_at``/``created_at`` let the UI sort or annotate freshness;
    ``assigned_therapist_name`` is flattened for direct table rendering.
    """

    id: uuid.UUID
    name: str
    phone: str
    condition: Optional[str] = None
    assigned_therapist_name: Optional[str] = None
    package: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
