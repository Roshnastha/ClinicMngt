"""
Schedule service layer – the Scheduling & Appointment Grid engine.

Responsibilities:
* therapist availability evaluation (working days, hours, date overrides)
* transactional double-booking prevention (overlap query → 409)
* appointment booking / reschedule / status transitions
* daily grid matrix assembly (therapists as columns, slots as rows)
"""

import uuid
from datetime import date, datetime, time, timedelta, timezone
from typing import Optional, Sequence

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from backend.app.models.appointment import Appointment
from backend.app.models.therapist import Therapist
from backend.app.models.therapist_override import TherapistOverride
from backend.app.schemas.appointment import (
    AppointmentCreate,
    AppointmentReschedule,
    DailyGridResponse,
    GridBookedCell,
    GridCell,
    GridTherapistColumn,
)
from backend.app.schemas.therapist import VALID_DAYS

OPERATING_START = time(7, 0)   # earliest row the grid will render
OPERATING_END = time(21, 0)    # latest row the grid will render

PAYMENT_METHODS = ("Cash", "Card", "UPI", "Insurance")


def _minutes(t: time) -> int:
    return t.hour * 60 + t.minute


def _time_from_minutes(total: int) -> time:
    return time(total // 60, total % 60)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Availability evaluation
# ---------------------------------------------------------------------------


def evaluate_availability(db: Session, therapist: Therapist, day: date) -> dict:
    """
    Evaluate a therapist's availability for one date.

    Returns a dict with:
        on_duty: True when the therapist works that day (override-aware)
        day_off: True when an explicit override marks the date off
        window_start / window_end: effective working window (override hours
        win over standard hours); None when off duty
    """
    override = (
        db.query(TherapistOverride)
        .filter(
            TherapistOverride.therapist_id == therapist.id,
            TherapistOverride.date == day,
        )
        .first()
    )

    if override is not None and override.is_day_off:
        return {"on_duty": False, "day_off": True, "window_start": None, "window_end": None}

    day_name = VALID_DAYS[day.weekday()]  # Monday == 0
    working_days = therapist.working_days or []

    # Effective window: custom override hours beat standard hours. An explicit
    # custom-hours override also puts the therapist on duty for that date
    # (admin deliberately configured work), even on a non-working weekday.
    has_custom_hours = bool(
        override is not None and override.custom_start_time and override.custom_end_time
    )
    works_that_day = day_name in working_days or has_custom_hours

    if has_custom_hours:
        window_start = override.custom_start_time
        window_end = override.custom_end_time
    else:
        window_start = therapist.start_time
        window_end = therapist.end_time

    on_duty = works_that_day and window_start is not None and window_end is not None
    return {
        "on_duty": on_duty,
        "day_off": False,
        "window_start": window_start if on_duty else None,
        "window_end": window_end if on_duty else None,
    }


# ---------------------------------------------------------------------------
# Conflict detection
# ---------------------------------------------------------------------------


def _find_overlap(
    db: Session,
    *,
    therapist_id: uuid.UUID,
    day: date,
    start: time,
    end: time,
    exclude_appointment_id: Optional[uuid.UUID] = None,
) -> Optional[Appointment]:
    """First non-cancelled appointment overlapping the window, if any."""
    query = (
        db.query(Appointment)
        .filter(
            Appointment.therapist_id == therapist_id,
            Appointment.date == day,
            Appointment.status != "Cancelled",
            Appointment.start_time < end,
            Appointment.end_time > start,
        )
    )
    if exclude_appointment_id is not None:
        query = query.filter(Appointment.id != exclude_appointment_id)
    return query.first()


def _raise_conflict(appointment: Appointment) -> None:
    raise HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={
            "message": "The therapist already has an appointment in that time slot.",
            "conflicting_appointment_id": str(appointment.id),
            "conflicting_start_time": appointment.start_time.isoformat(),
            "conflicting_end_time": appointment.end_time.isoformat(),
        },
    )


def _validate_payment_method(payment_method: Optional[str]) -> None:
    if payment_method is not None and payment_method not in PAYMENT_METHODS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"payment_method must be one of {PAYMENT_METHODS}",
        )


def _ensure_patient_exists(db: Session, patient_id: uuid.UUID) -> None:
    from backend.app.models.patient import Patient

    if db.get(Patient, patient_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Patient not found"
        )


def _ensure_therapist_exists(db: Session, therapist_id: uuid.UUID) -> Therapist:
    therapist = db.get(Therapist, therapist_id)
    if therapist is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Therapist not found"
        )
    return therapist


# ---------------------------------------------------------------------------
# Appointment operations
# ---------------------------------------------------------------------------


def get_appointment_or_404(db: Session, appointment_id: uuid.UUID) -> Appointment:
    appointment = (
        db.query(Appointment)
        .options(joinedload(Appointment.patient), joinedload(Appointment.therapist))
        .filter(Appointment.id == appointment_id)
        .first()
    )
    if appointment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Appointment not found"
        )
    return appointment


def book_appointment(db: Session, data: AppointmentCreate) -> Appointment:
    """Book a new appointment with strict double-booking prevention."""
    _ensure_patient_exists(db, data.patient_id)
    therapist = _ensure_therapist_exists(db, data.therapist_id)
    _validate_payment_method(data.payment_method)

    availability = evaluate_availability(db, therapist, data.date)
    if not availability["on_duty"]:
        detail = (
            "Therapist is marked off on this date."
            if availability["day_off"]
            else "Therapist is not scheduled to work at this time."
        )
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)

    window_start = availability["window_start"]
    window_end = availability["window_end"]
    if data.start_time < window_start or data.end_time > window_end:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Requested time is outside the therapist's working hours "
                f"({window_start.strftime('%H:%M')}–{window_end.strftime('%H:%M')})."
            ),
        )

    overlap = _find_overlap(
        db,
        therapist_id=data.therapist_id,
        day=data.date,
        start=data.start_time,
        end=data.end_time,
    )
    if overlap is not None:
        _raise_conflict(overlap)

    appointment = Appointment(
        patient_id=data.patient_id,
        therapist_id=data.therapist_id,
        date=data.date,
        start_time=data.start_time,
        end_time=data.end_time,
        status="Booked",
        payment_method=data.payment_method,
        notes=data.notes,
    )
    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    return appointment


def reschedule_appointment(
    db: Session,
    appointment: Appointment,
    data: AppointmentReschedule,
) -> Appointment:
    """Move an appointment to a new date/time, enforcing all booking rules."""
    therapist = _ensure_therapist_exists(db, appointment.therapist_id)

    availability = evaluate_availability(db, therapist, data.date)
    if not availability["on_duty"]:
        detail = (
            "Therapist is marked off on the requested date."
            if availability["day_off"]
            else "Therapist is not scheduled to work at the requested time."
        )
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)

    window_start = availability["window_start"]
    window_end = availability["window_end"]
    if data.start_time < window_start or data.end_time > window_end:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Requested time is outside the therapist's working hours "
                f"({window_start.strftime('%H:%M')}–{window_end.strftime('%H:%M')})."
            ),
        )

    overlap = _find_overlap(
        db,
        therapist_id=appointment.therapist_id,
        day=data.date,
        start=data.start_time,
        end=data.end_time,
        exclude_appointment_id=appointment.id,
    )
    if overlap is not None:
        _raise_conflict(overlap)

    appointment.date = data.date
    appointment.start_time = data.start_time
    appointment.end_time = data.end_time
    db.commit()
    db.refresh(appointment)
    return appointment


def update_status(db: Session, appointment: Appointment, new_status: str) -> Appointment:
    """Apply a lifecycle status transition."""
    appointment.status = new_status
    db.commit()
    db.refresh(appointment)
    return appointment


def list_appointments(
    db: Session,
    *,
    day: Optional[date] = None,
    therapist_id: Optional[uuid.UUID] = None,
    patient_id: Optional[uuid.UUID] = None,
) -> Sequence[Appointment]:
    """Filtered appointment list (chronological)."""
    query = db.query(Appointment).options(
        joinedload(Appointment.patient), joinedload(Appointment.therapist)
    )
    if day is not None:
        query = query.filter(Appointment.date == day)
    if therapist_id is not None:
        query = query.filter(Appointment.therapist_id == therapist_id)
    if patient_id is not None:
        query = query.filter(Appointment.patient_id == patient_id)
    return query.order_by(Appointment.date, Appointment.start_time).all()


# ---------------------------------------------------------------------------
# Daily grid
# ---------------------------------------------------------------------------


def _grid_slot_minutes(therapists: Sequence[tuple[Therapist, dict]]) -> int:
    """Grid granularity: the finest slot duration among on-duty therapists."""
    durations = [
        t.slot_duration_minutes
        for t, av in therapists
        if av["on_duty"] and t.slot_duration_minutes in (30, 45, 60)
    ]
    return min(durations) if durations else 60


def build_daily_grid(db: Session, day: date) -> DailyGridResponse:
    """
    Assemble the full daily matrix: therapist columns × slot rows.
    States: OPEN | BOOKED (with appointment context) | THERAPIST_OFF.
    """
    therapists = db.query(Therapist).order_by(Therapist.name).all()

    availabilities = [(t, evaluate_availability(db, t, day)) for t in therapists]
    slot_minutes = _grid_slot_minutes(availabilities)

    # Operating window: union of on-duty windows clamped to operating hours.
    starts = [_minutes(av["window_start"]) for _, av in availabilities if av["on_duty"]]
    ends = [_minutes(av["window_end"]) for _, av in availabilities if av["on_duty"]]
    day_start = max(OPERATING_START.hour * 60 + OPERATING_START.minute, min(starts) if starts else 540)
    day_end = min(OPERATING_END.hour * 60 + OPERATING_END.minute, max(ends) if ends else 1020)

    slots: list[time] = []
    cursor = day_start
    while cursor < day_end:
        slots.append(_time_from_minutes(cursor))
        cursor += slot_minutes

    # All non-cancelled appointments for the day, indexed per therapist.
    appointments = (
        db.query(Appointment)
        .options(joinedload(Appointment.patient))
        .filter(Appointment.date == day, Appointment.status != "Cancelled")
        .all()
    )
    by_therapist: dict[uuid.UUID, list[Appointment]] = {}
    for appt in appointments:
        by_therapist.setdefault(appt.therapist_id, []).append(appt)

    columns: list[GridTherapistColumn] = []
    cells: list[list[GridCell]] = []

    for _, (therapist, av) in enumerate(availabilities):
        columns.append(
            GridTherapistColumn(
                therapist={
                    "id": therapist.id,
                    "name": therapist.name,
                    "specialty": therapist.specialty,
                },
                on_duty=av["on_duty"],
                window_start=av["window_start"],
                window_end=av["window_end"],
                day_off=av["day_off"],
            )
        )

    # rows × columns matrix
    for slot in slots:
        slot_end_m = _minutes(slot) + slot_minutes
        row: list[GridCell] = []
        for therapist, av in availabilities:
            if not av["on_duty"]:
                row.append(GridCell(slot_start=slot, slot_end=_time_from_minutes(slot_end_m),
                                    state="THERAPIST_OFF"))
                continue

            window_end = av["window_end"]
            window_start = av["window_start"]
            within = (
                window_start is not None
                and window_end is not None
                and _minutes(window_start) <= _minutes(slot)
                and slot_end_m <= _minutes(window_end)
            )

            booked_cell = None
            if within:
                for appt in by_therapist.get(therapist.id, []):
                    if appt.start_time < _time_from_minutes(slot_end_m) and appt.end_time > slot:
                        patient = appt.patient
                        booked_cell = GridBookedCell(
                            appointment_id=appt.id,
                            patient=(
                                {"id": patient.id, "name": patient.name, "phone": patient.phone}
                                if patient
                                else None
                            ),
                            status=appt.status,
                            condition=patient.condition if patient else None,
                            payment_method=appt.payment_method,
                            notes=appt.notes,
                        )
                        break

            row.append(
                GridCell(
                    slot_start=slot,
                    slot_end=_time_from_minutes(slot_end_m),
                    state="BOOKED" if booked_cell else ("OPEN" if within else "THERAPIST_OFF"),
                    booked=booked_cell,
                )
            )
        cells.append(row)

    return DailyGridResponse(
        date=day,
        slot_minutes=slot_minutes,
        slots=slots,
        therapists=columns,
        cells=cells,
    )
