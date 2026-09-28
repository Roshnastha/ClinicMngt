"""
Schedule API router – the Scheduling & Appointment Grid engine.

* GET   /schedule/grid                              daily matrix (all therapists)
* POST  /schedule/appointments                      book (conflict-checked)
* GET   /schedule/appointments/{id}                 single appointment
* PUT   /schedule/appointments/{id}/reschedule      move (conflict-checked)
* PATCH /schedule/appointments/{id}/status          status transition
"""

import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_user
from backend.app.core.database import get_db
from backend.app.models.user import User
from backend.app.schemas.appointment import (
    AppointmentCreate,
    AppointmentReschedule,
    AppointmentResponse,
    AppointmentStatusUpdate,
    DailyGridResponse,
)
from backend.app.services import schedule_service

router = APIRouter(prefix="/schedule", tags=["Schedule"])


@router.get("/grid", response_model=DailyGridResponse)
async def get_grid(
    date: date = Query(..., description="Operating day to render, YYYY-MM-DD"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Full day schedule matrix: therapist columns × time-slot rows."""
    return schedule_service.build_daily_grid(db, date)


@router.post(
    "/appointments",
    response_model=AppointmentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def book_appointment(
    payload: AppointmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Book a new appointment (409 on overlap, off-days or out-of-hours)."""
    appointment = schedule_service.book_appointment(db, payload)
    return schedule_service.get_appointment_or_404(db, appointment.id)


@router.get("/appointments", response_model=list[AppointmentResponse])
async def list_appointments(
    date: Optional[date] = Query(None, alias="date"),
    therapist_id: Optional[uuid.UUID] = Query(None, alias="therapist_id"),
    patient_id: Optional[uuid.UUID] = Query(None, alias="patient_id"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Filtered appointment list (chronological)."""
    rows = schedule_service.list_appointments(
        db, day=date, therapist_id=therapist_id, patient_id=patient_id
    )
    return [
        AppointmentResponse.model_validate(r)
        for r in rows
    ]


@router.get("/appointments/{appointment_id}", response_model=AppointmentResponse)
async def get_appointment(
    appointment_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Single appointment with nested patient/therapist summaries."""
    return schedule_service.get_appointment_or_404(db, appointment_id)


@router.put("/appointments/{appointment_id}/reschedule", response_model=AppointmentResponse)
async def reschedule_appointment(
    appointment_id: uuid.UUID,
    payload: AppointmentReschedule,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Move an appointment to a new date/time (409 on conflicts)."""
    appointment = schedule_service.get_appointment_or_404(db, appointment_id)
    updated = schedule_service.reschedule_appointment(db, appointment, payload)
    return schedule_service.get_appointment_or_404(db, updated.id)


@router.patch("/appointments/{appointment_id}/status", response_model=AppointmentResponse)
async def update_appointment_status(
    appointment_id: uuid.UUID,
    payload: AppointmentStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update appointment status: Booked | Completed | Cancelled."""
    appointment = schedule_service.get_appointment_or_404(db, appointment_id)
    schedule_service.update_status(db, appointment, payload.status)
    return schedule_service.get_appointment_or_404(db, appointment_id)
