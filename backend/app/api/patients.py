"""
Patients API router - full CRUD behind authentication.

* GET    /patients           list + search/filter/pagination (any authenticated user)
* POST   /patients           create (any authenticated user)
* GET    /patients/{id}      detail profile incl. session & billing history
* PUT    /patients/{id}      update (any authenticated user)
* DELETE /patients/{id}      admin only
"""

import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_active_admin, get_current_user
from backend.app.core.database import get_db
from backend.app.models.user import User
from backend.app.schemas.patient import (
    AppointmentSummary,
    InvoiceSummary,
    PatientCreate,
    PatientDetailResponse,
    PatientListResponse,
    PatientResponse,
    PatientUpdate,
)
from backend.app.services import patient_service

router = APIRouter(prefix="/patients", tags=["Patients"])


@router.get("", response_model=PatientListResponse)
async def list_patients(
    search: Optional[str] = Query(None, description="Case-insensitive match on name or phone"),
    therapist_id: Optional[uuid.UUID] = Query(None, description="Filter by assigned therapist"),
    status: Optional[str] = Query(
        None,
        description="Filter by lifecycle status: Active | Completed | On hold",
    ),
    skip: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(100, ge=1, le=500, description="Page size"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List patients with optional search, filters, and pagination."""
    items, total = patient_service.list_patients(
        db,
        search=search,
        therapist_id=therapist_id,
        status_filter=status,
        skip=skip,
        limit=limit,
    )
    return PatientListResponse(items=items, total=total, skip=skip, limit=limit)


@router.post("", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
async def create_patient(
    payload: PatientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new patient record."""
    return patient_service.create_patient(db, payload)


@router.get("/{patient_id}", response_model=PatientDetailResponse)
async def get_patient(
    patient_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Fetch the detailed profile for a single patient."""
    patient, sessions, invoices = patient_service.get_patient_detail(db, patient_id)
    return PatientDetailResponse(
        **patient_service.to_response_dict(patient),
        session_history=[AppointmentSummary.model_validate(s) for s in sessions],
        billing_history=[InvoiceSummary.model_validate(i) for i in invoices],
    )


@router.put("/{patient_id}", response_model=PatientResponse)
async def update_patient(
    patient_id: uuid.UUID,
    payload: PatientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update patient details (partial update supported)."""
    patient = patient_service.get_patient_or_404(db, patient_id)
    return patient_service.update_patient(db, patient, payload)


@router.delete("/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_patient(
    patient_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin),
):
    """Remove a patient record (admin only; UI asks for confirmation first)."""
    patient = patient_service.get_patient_or_404(db, patient_id)
    patient_service.delete_patient(db, patient)
    return None
