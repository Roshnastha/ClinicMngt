"""
Therapist service layer.

Covers roster CRUD, calculated metrics (weekly hours, active patients,
appointments today), schedule overrides (per-date upsert), and the
delete/deactivate flow that protects existing appointments.
"""

import uuid
from datetime import date
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from backend.app.models.appointment import Appointment
from backend.app.models.patient import Patient
from backend.app.models.therapist import Therapist
from backend.app.models.therapist_override import TherapistOverride
from backend.app.schemas.therapist import (
    AppointmentToday,
    TherapistCreate,
    TherapistOverrideCreate,
    TherapistResponse,
    TherapistUpdate,
    VALID_DAYS,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _normalize_days(raw) -> list[str]:
    """working_days is stored as JSON; coerce to a canonical list of day names."""
    if not raw:
        return []
    days: list[str] = []
    for day in list(raw):
        title = str(day).strip().title()
        if title in VALID_DAYS and title not in days:
            days.append(title)
    return sorted(days, key=VALID_DAYS.index)


def _weekly_hours(therapist: Therapist) -> float:
    """len(working_days) * (end - start) in hours."""
    days = _normalize_days(therapist.working_days)
    if not days or therapist.start_time is None or therapist.end_time is None:
        return 0.0
    start_min = therapist.start_time.hour * 60 + therapist.start_time.minute
    end_min = therapist.end_time.hour * 60 + therapist.end_time.minute
    return round(len(days) * max(0, end_min - start_min) / 60.0, 2)


def _appointments_today(db: Session, therapist_id: uuid.UUID):
    """Non-cancelled appointments scheduled for today (chronological)."""
    today = date.today()
    return (
        db.query(Appointment)
        .options(joinedload(Appointment.patient))
        .filter(
            Appointment.therapist_id == therapist_id,
            Appointment.date == today,
            Appointment.status != "Cancelled",
        )
        .order_by(Appointment.start_time)
        .all()
    )


def _active_patients_count(db: Session, therapist_id: uuid.UUID) -> int:
    return (
        db.query(func.count(Patient.id))
        .filter(
            Patient.assigned_therapist_id == therapist_id,
            Patient.status == "Active",
        )
        .scalar()
        or 0
    )


def to_response(db: Session, therapist: Therapist) -> TherapistResponse:
    """Serialize a Therapist row with computed roster metrics."""
    todays = _appointments_today(db, therapist.id)
    return TherapistResponse(
        id=therapist.id,
        name=therapist.name,
        specialty=therapist.specialty,
        working_days=_normalize_days(therapist.working_days),
        start_time=therapist.start_time,
        end_time=therapist.end_time,
        slot_duration_minutes=therapist.slot_duration_minutes,
        weekly_hours=_weekly_hours(therapist),
        active_patients_count=_active_patients_count(db, therapist.id),
        appointments_today=[AppointmentToday.model_validate(a) for a in todays],
        appointments_today_count=len(todays),
        is_active=therapist.is_active,
        created_at=therapist.created_at,
        updated_at=therapist.updated_at,
    )


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------


def list_therapists(db: Session, search: Optional[str] = None) -> list[TherapistResponse]:
    """Roster with calculated metrics, alphabetical by name."""
    query = db.query(Therapist)
    if search:
        like = f"%{search}%"
        query = query.filter(or_(Therapist.name.ilike(like), Therapist.specialty.ilike(like)))
    return [to_response(db, t) for t in query.order_by(Therapist.name).all()]


def get_therapist_or_404(db: Session, therapist_id: uuid.UUID) -> Therapist:
    therapist = db.get(Therapist, therapist_id)
    if therapist is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Therapist not found")
    return therapist


def create_therapist(db: Session, data: TherapistCreate) -> Therapist:
    therapist = Therapist(**data.model_dump())
    db.add(therapist)
    db.commit()
    db.refresh(therapist)
    return therapist


def update_therapist(db: Session, therapist: Therapist, data: TherapistUpdate) -> Therapist:
    updates = data.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(therapist, field, value)

    # Cross-field hours check for partial updates: the payload may only send
    # one endpoint of the working window, so validate against the merged state.
    if ("start_time" in updates or "end_time" in updates) and (
        therapist.start_time is not None
        and therapist.end_time is not None
        and therapist.end_time <= therapist.start_time
    ):
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="end_time must be after start_time",
        )

    db.commit()
    db.refresh(therapist)
    return therapist


# ---------------------------------------------------------------------------
# Delete / deactivate flow
# ---------------------------------------------------------------------------


def _upcoming_booked_count(db: Session, therapist_id: uuid.UUID) -> int:
    today = date.today()
    return (
        db.query(func.count(Appointment.id))
        .filter(
            Appointment.therapist_id == therapist_id,
            Appointment.date >= today,
            Appointment.status == "Booked",
        )
        .scalar()
        or 0
    )


def _assigned_patients_count(db: Session, therapist_id: uuid.UUID) -> int:
    return (
        db.query(func.count(Patient.id))
        .filter(Patient.assigned_therapist_id == therapist_id)
        .scalar()
        or 0
    )


def _unassign_patients(db: Session, therapist_id: uuid.UUID) -> int:
    count = _assigned_patients_count(db, therapist_id)
    db.query(Patient).filter(Patient.assigned_therapist_id == therapist_id).update(
        {Patient.assigned_therapist_id: None}, synchronize_session=False
    )
    return count


def delete_therapist(db: Session, therapist: Therapist, action: Optional[str] = None) -> dict:
    """
    Delete or deactivate a therapist, protecting existing bookings.

    * no action, no upcoming booked appointments → hard delete (removes the
      therapist, their overrides and appointment history, unassigns patients)
    * no action, upcoming booked appointments    → 409 conflict with counts
    * action="cancel"                            → cancel upcoming bookings,
      unassign patients, deactivate (history preserved)
    * action="unassign"                          → remove appointments and
      hard delete everything
    """
    upcoming = _upcoming_booked_count(db, therapist.id)
    assigned = _assigned_patients_count(db, therapist.id)

    if action not in (None, "cancel", "unassign"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="action must be 'unassign' or 'cancel'",
        )

    if action is None and upcoming > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": (
                    "Therapist has upcoming booked appointments. "
                    "Retry with action=cancel (cancel & deactivate) or "
                    "action=unassign (remove appointments & delete)."
                ),
                "upcoming_appointments": upcoming,
                "assigned_patients": assigned,
            },
        )

    if action == "cancel":
        # Cancel upcoming bookings and deactivate; keep all history rows.
        today = date.today()
        cancelled = (
            db.query(Appointment)
            .filter(
                Appointment.therapist_id == therapist.id,
                Appointment.date >= today,
                Appointment.status == "Booked",
            )
            .update({Appointment.status: "Cancelled"}, synchronize_session=False)
        )
        unassigned = _unassign_patients(db, therapist.id)
        therapist.is_active = False
        db.commit()
        return {
            "status": "deactivated",
            "cancelled_appointments": cancelled,
            "unassigned_patients": unassigned,
        }

    # Hard delete path (explicit unassign, or no conflicts).
    removed_appointments = (
        db.query(Appointment)
        .filter(Appointment.therapist_id == therapist.id)
        .delete(synchronize_session=False)
    )
    db.query(TherapistOverride).filter(
        TherapistOverride.therapist_id == therapist.id
    ).delete(synchronize_session=False)
    unassigned = _unassign_patients(db, therapist.id)
    db.delete(therapist)
    db.commit()
    return {
        "status": "deleted",
        "removed_appointments": removed_appointments,
        "unassigned_patients": unassigned,
    }


# ---------------------------------------------------------------------------
# Schedule overrides
# ---------------------------------------------------------------------------


def upsert_override(
    db: Session, therapist: Therapist, data: TherapistOverrideCreate
) -> TherapistOverride:
    """Create or update the override for one specific date."""
    existing = (
        db.query(TherapistOverride)
        .filter(
            TherapistOverride.therapist_id == therapist.id,
            TherapistOverride.date == data.date,
        )
        .first()
    )
    if existing is not None:
        existing.is_day_off = data.is_day_off
        existing.custom_start_time = data.custom_start_time
        existing.custom_end_time = data.custom_end_time
        existing.notes = data.notes
    else:
        existing = TherapistOverride(
            therapist_id=therapist.id,
            date=data.date,
            is_day_off=data.is_day_off,
            custom_start_time=data.custom_start_time,
            custom_end_time=data.custom_end_time,
            notes=data.notes,
        )
        db.add(existing)
    db.commit()
    db.refresh(existing)
    return existing


def list_overrides(
    db: Session,
    therapist_id: uuid.UUID,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> list[TherapistOverride]:
    """List overrides for a therapist, optionally within a date range."""
    query = db.query(TherapistOverride).filter(TherapistOverride.therapist_id == therapist_id)
    if start_date is not None:
        query = query.filter(TherapistOverride.date >= start_date)
    if end_date is not None:
        query = query.filter(TherapistOverride.date <= end_date)
    return query.order_by(TherapistOverride.date).all()
