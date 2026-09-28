"""
Dashboard service layer – live metrics computed straight from the database.

Everything here is real-time and non-hard-coded: the four headline stats,
per-therapist capacity (override-aware via ``schedule_service``), and the
recent-patients feed. The dashboard deliberately reuses
``schedule_service.evaluate_availability`` so "on duty" means exactly the
same thing on the dashboard as it does in the booking engine.
"""

import uuid
from datetime import date, datetime, time, timezone
from typing import Sequence

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from backend.app.models.appointment import Appointment
from backend.app.models.invoice import Invoice
from backend.app.models.patient import Patient
from backend.app.models.therapist import Therapist
from backend.app.schemas.dashboard import (
    DashboardStatsResponse,
    RecentPatientSummary,
    SlotBreakdown,
    TherapistCapacity,
)
from backend.app.services.schedule_service import evaluate_availability

# Number of rows in the "recent patients" feed.
RECENT_PATIENTS_LIMIT = 8


def _minutes(t: time) -> int:
    return t.hour * 60 + t.minute


def _time_from_minutes(total: int) -> time:
    return time(total // 60, total % 60)


def _hhmm(t: time) -> str:
    return t.strftime("%H:%M")


def _today(db: Session) -> date:
    """
    The clinic's operating day.

    A single query against a datetimes-tz-aware table (invoices.created_at)
    gives us "now" in database time, which keeps the dashboard consistent
    with appointment/invoice timestamps even if the app server's clock
    drifts from the DB server's. Falls back to the app server clock when
    the table is empty (e.g. fresh installs).
    """
    now = db.query(func.now()).scalar()
    if isinstance(now, datetime):
        if now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)
        return now.date()
    return datetime.now(timezone.utc).date()


# ---------------------------------------------------------------------------
# Headline stats
# ---------------------------------------------------------------------------


def get_dashboard_stats(db: Session) -> DashboardStatsResponse:
    """
    Compute the four headline metrics for today, all in real time.

    Definitions (matching the sprint spec):
    * patients_seen_today – distinct patients with a Booked/Completed
      (i.e. non-cancelled) appointment today.
    * therapists_on_duty_today – override-aware active therapists today.
    * revenue_collected_today – net amount (amount - discount) of invoices
      that were created today AND are Paid, plus invoices marked Paid today
      regardless of creation date (late payments still count as collected
      today). The union of both sets is summed once.
    * open_slots_remaining_today – OPEN slots left across all on-duty
      therapists today.
    """
    today = _today(db)

    # Distinct patients seen today (Booked or Completed → not Cancelled).
    patients_seen = (
        db.query(func.count(func.distinct(Appointment.patient_id)))
        .filter(
            Appointment.date == today,
            Appointment.status != "Cancelled",
        )
        .scalar()
    ) or 0

    # On-duty therapists: override-aware availability, active profiles only.
    therapists = (
        db.query(Therapist).filter(Therapist.is_active.is_(True)).order_by(Therapist.name).all()
    )
    availabilities = [(t, evaluate_availability(db, t, today)) for t in therapists]
    on_duty = [(t, av) for t, av in availabilities if av["on_duty"]]

    # Revenue collected today = union(invoices created today & Paid,
    #                                 invoices marked Paid today).
    # An invoice updated to Paid today has updated_at >= today 00:00 and
    # status Paid; created-today Paid invoices satisfy the first branch.
    created_today = (
        db.query(Invoice.id).filter(
            func.date(Invoice.created_at) == today,
            Invoice.status == "Paid",
        )
    )
    paid_today = (
        db.query(Invoice.id).filter(
            Invoice.status == "Paid",
            func.date(Invoice.updated_at) >= today,
        )
    )
    revenue_net = (
        db.query(func.coalesce(func.sum(Invoice.amount - Invoice.discount), 0.0))
        .filter(Invoice.id.in_(created_today.union(paid_today).subquery()))
        .scalar()
    )

    # Open slots remaining: per on-duty therapist, count window slots minus
    # the non-cancelled appointments overlapping each slot.
    open_slots = 0
    appointments = (
        db.query(Appointment)
        .filter(Appointment.date == today, Appointment.status != "Cancelled")
        .all()
    )
    appts_by_therapist: dict[uuid.UUID, list[Appointment]] = {}
    for appt in appointments:
        appts_by_therapist.setdefault(appt.therapist_id, []).append(appt)

    for therapist, av in on_duty:
        open_slots += _count_open_slots(
            av["window_start"],
            av["window_end"],
            therapist.slot_duration_minutes,
            appts_by_therapist.get(therapist.id, []),
        )

    return DashboardStatsResponse(
        patients_seen_today=int(patients_seen),
        therapists_on_duty_today=len(on_duty),
        revenue_collected_today=round(float(revenue_net or 0), 2),
        open_slots_remaining_today=open_slots,
    )


def _count_open_slots(
    window_start: time | None,
    window_end: time | None,
    slot_minutes: int,
    appointments: Sequence[Appointment],
) -> int:
    """
    Count OPEN (unbooked) slots in one therapist's effective window.

    A slot is OPEN when no non-cancelled appointment overlaps it. Slots
    partially covered by an irregular appointment still count as booked
    (conservative, matches the visual grid behaviour).
    """
    if window_start is None or window_end is None:
        return 0

    start_m = _minutes(window_start)
    end_m = _minutes(window_end)
    if end_m <= start_m:
        return 0

    slot_minutes = slot_minutes if slot_minutes in (30, 45, 60) else 60

    open_count = 0
    cursor = start_m
    while cursor + slot_minutes <= end_m:
        slot_start = _time_from_minutes(cursor)
        slot_end = _time_from_minutes(cursor + slot_minutes)
        overlap = any(
            appt.start_time < slot_end and appt.end_time > slot_start
            for appt in appointments
        )
        if not overlap:
            open_count += 1
        cursor += slot_minutes
    return open_count


# ---------------------------------------------------------------------------
# Therapist capacity
# ---------------------------------------------------------------------------


def get_therapist_capacity(db: Session) -> list[TherapistCapacity]:
    """
    Per-therapist capacity breakdown for today (override-aware).

    Each therapist's effective window (override hours beat standard hours;
    explicit day-off overrides mark them off) is chopped into their configured
    slot length. Every slot is classified:
      * BOOKED – a non-cancelled appointment overlaps it (patient name attached)
      * OPEN   – free to book
      * OFF    – outside the effective working window
    """
    today = _today(db)

    therapists = (
        db.query(Therapist).filter(Therapist.is_active.is_(True)).order_by(Therapist.name).all()
    )
    appointments = (
        db.query(Appointment)
        .options(joinedload(Appointment.patient))
        .filter(Appointment.date == today, Appointment.status != "Cancelled")
        .all()
    )
    appts_by_therapist: dict[uuid.UUID, list[Appointment]] = {}
    for appt in appointments:
        appts_by_therapist.setdefault(appt.therapist_id, []).append(appt)

    capacities: list[TherapistCapacity] = []
    for therapist in therapists:
        av = evaluate_availability(db, therapist, today)
        window_start: time | None = av["window_start"]
        window_end: time | None = av["window_end"]
        slot_minutes = therapist.slot_duration_minutes if therapist.slot_duration_minutes in (30, 45, 60) else 60

        slots: list[SlotBreakdown] = []
        total = booked = 0

        if av["on_duty"] and window_start is not None and window_end is not None:
            my_appts = appts_by_therapist.get(therapist.id, [])
            cursor = _minutes(window_start)
            end_m = _minutes(window_end)
            while cursor + slot_minutes <= end_m:
                slot_start = _time_from_minutes(cursor)
                slot_end = _time_from_minutes(cursor + slot_minutes)

                hit = next(
                    (
                        appt
                        for appt in my_appts
                        if appt.start_time < slot_end and appt.end_time > slot_start
                    ),
                    None,
                )
                if hit is not None:
                    booked += 1
                    slots.append(
                        SlotBreakdown(
                            time=_hhmm(slot_start),
                            status="BOOKED",
                            patient_name=hit.patient.name if hit.patient else None,
                        )
                    )
                else:
                    slots.append(
                        SlotBreakdown(time=_hhmm(slot_start), status="OPEN", patient_name=None)
                    )
                total += 1
                cursor += slot_minutes

        capacities.append(
            TherapistCapacity(
                therapist_id=therapist.id,
                therapist_name=therapist.name,
                specialty=therapist.specialty,
                on_duty=bool(av["on_duty"]),
                working_window=(
                    f"{_hhmm(window_start)}–{_hhmm(window_end)}"
                    if av["on_duty"] and window_start is not None and window_end is not None
                    else None
                ),
                total_slots=total,
                booked_slots=booked,
                free_slots=total - booked,
                utilization=(booked / total) if total else 0.0,
                slots_breakdown=slots,
            )
        )
    return capacities


# ---------------------------------------------------------------------------
# Recent patients
# ---------------------------------------------------------------------------


def get_recent_patients(db: Session, limit: int = RECENT_PATIENTS_LIMIT) -> list[RecentPatientSummary]:
    """
    The last ``limit`` patients added or updated (most recent first).

    Ordered by updated_at so edits (status change, re-assignment, new
    package) surface a record again — the feed answers "who did we last
    touch?" rather than strictly "who is newest?".
    """
    rows = (
        db.query(Patient)
        .options(joinedload(Patient.assigned_therapist))
        .order_by(Patient.updated_at.desc(), Patient.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        RecentPatientSummary(
            id=p.id,
            name=p.name,
            phone=p.phone,
            condition=p.condition,
            assigned_therapist_name=p.assigned_therapist.name if p.assigned_therapist else None,
            package=p.package,
            status=p.status,
            created_at=p.created_at,
            updated_at=p.updated_at,
        )
        for p in rows
    ]
