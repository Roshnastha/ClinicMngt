"""
Patient service layer.

Encapsulates patient business logic: filtered listing, CRUD, and profile
assembly (session + billing history) so the API layer stays thin.
"""

import uuid
from typing import Optional, Sequence

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from backend.app.models.appointment import Appointment
from backend.app.models.invoice import Invoice
from backend.app.models.patient import Patient
from backend.app.models.therapist import Therapist
from backend.app.schemas.patient import PATIENT_STATUSES, PatientResponse


def list_patients(
    db: Session,
    *,
    search: Optional[str] = None,
    therapist_id: Optional[uuid.UUID] = None,
    status_filter: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
) -> tuple[Sequence[Patient], int]:
    """List patients with optional filters and pagination.

    Args:
        search: Case-insensitive substring match on name or phone (ILIKE).
        therapist_id: Only patients assigned to this therapist.
        status_filter: Only patients with this lifecycle status.
        skip, limit: Pagination window.

    Returns:
        (rows, total) where total is the count before pagination.
    """
    query = db.query(Patient)

    if search:
        like = f"%{search}%"
        query = query.filter(or_(Patient.name.ilike(like), Patient.phone.ilike(like)))

    if therapist_id is not None:
        query = query.filter(Patient.assigned_therapist_id == therapist_id)

    if status_filter:
        if status_filter not in PATIENT_STATUSES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid status filter; expected one of {PATIENT_STATUSES}",
            )
        query = query.filter(Patient.status == status_filter)

    total = query.count()

    query = query.options(joinedload(Patient.assigned_therapist))
    query = query.order_by(Patient.created_at.desc())
    if skip:
        query = query.offset(skip)
    if limit is not None:
        query = query.limit(limit)

    return query.all(), total


def get_patient_or_404(db: Session, patient_id: uuid.UUID) -> Patient:
    """Fetch a patient or raise 404."""
    patient = db.get(Patient, patient_id)
    if patient is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient not found",
        )
    return patient


def to_response_dict(patient: Patient) -> dict:
    """Serialise a Patient ORM row into a PatientResponse-compatible dict."""
    return PatientResponse.model_validate(patient).model_dump(mode="json")


def _ensure_therapist_exists(db: Session, therapist_id: Optional[uuid.UUID]) -> None:
    """Raise 404 if a non-null assigned therapist id does not exist."""
    if therapist_id is None:
        return
    if db.get(Therapist, therapist_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assigned therapist not found",
        )


def create_patient(db: Session, data) -> Patient:
    """Create a patient from a PatientCreate schema."""
    _ensure_therapist_exists(db, data.assigned_therapist_id)
    patient = Patient(**data.model_dump())
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return patient


def update_patient(db: Session, patient: Patient, data) -> Patient:
    """Apply a PatientUpdate (partial) to a patient."""
    changes = data.model_dump(exclude_unset=True)
    if "assigned_therapist_id" in changes:
        _ensure_therapist_exists(db, changes["assigned_therapist_id"])
    for field, value in changes.items():
        setattr(patient, field, value)
    db.commit()
    db.refresh(patient)
    return patient


def delete_patient(db: Session, patient: Patient) -> None:
    """Remove a patient record and unlink their history.

    Appointments and invoices reference patients with non-nullable FKs, so
    the dependent rows are removed first (matching the UI's "delete and
    unlink appointment and invoice history" promise) before the patient.
    """
    db.query(Appointment).filter(Appointment.patient_id == patient.id).delete(
        synchronize_session=False
    )
    db.query(Invoice).filter(Invoice.patient_id == patient.id).delete(
        synchronize_session=False
    )
    db.delete(patient)
    db.commit()


def get_patient_detail(db: Session, patient_id: uuid.UUID):
    """Fetch the patient profile plus session and billing histories."""
    patient = get_patient_or_404(db, patient_id)

    sessions = (
        db.query(Appointment)
        .options(joinedload(Appointment.therapist))
        .filter(Appointment.patient_id == patient_id)
        .order_by(Appointment.date.desc(), Appointment.start_time.desc())
        .all()
    )

    invoices = (
        db.query(Invoice)
        .filter(Invoice.patient_id == patient_id)
        .order_by(Invoice.created_at.desc())
        .all()
    )

    return patient, sessions, invoices
