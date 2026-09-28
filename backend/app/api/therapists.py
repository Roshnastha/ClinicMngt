"""
Therapists API router - roster management and schedule configuration.

* GET    /therapists                                roster with metrics (any authed user)
* POST   /therapists                                create (admin only)
* GET    /therapists/{id}                           profile + default schedule
* PUT    /therapists/{id}                           update schedule/details (admin only)
* DELETE /therapists/{id}?action=unassign|cancel    delete/deactivate (admin only)
* POST   /therapists/{id}/overrides                 upsert per-date override (admin only)
* GET    /therapists/{id}/overrides                 list overrides in a date range
"""

import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_active_admin, get_current_user
from backend.app.core.database import get_db
from backend.app.models.user import User
from backend.app.schemas.therapist import (
    TherapistCreate,
    TherapistDetailResponse,
    TherapistListResponse,
    TherapistOverrideCreate,
    TherapistOverrideRead,
    TherapistResponse,
    TherapistUpdate,
)
from backend.app.services import therapist_service

router = APIRouter(prefix="/therapists", tags=["Therapists"])


@router.get("", response_model=TherapistListResponse)
async def list_therapists(
    search: Optional[str] = Query(None, description="Case-insensitive name/specialty match"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Roster with calculated metrics (weekly hours, active patients, today's bookings)."""
    items = therapist_service.list_therapists(db, search=search)
    return TherapistListResponse(items=items, total=len(items))


@router.post("", response_model=TherapistResponse, status_code=status.HTTP_201_CREATED)
async def create_therapist(
    payload: TherapistCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin),
):
    """Create a therapist with default weekly schedule (admin only)."""
    therapist = therapist_service.create_therapist(db, payload)
    return therapist_service.to_response(db, therapist)


@router.get("/{therapist_id}", response_model=TherapistDetailResponse)
async def get_therapist(
    therapist_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Single therapist profile with default schedule and date overrides."""
    therapist = therapist_service.get_therapist_or_404(db, therapist_id)
    response = therapist_service.to_response(db, therapist)
    overrides = therapist_service.list_overrides(db, therapist_id)
    return TherapistDetailResponse(
        **response.model_dump(),
        overrides=[TherapistOverrideRead.model_validate(o) for o in overrides],
    )


@router.put("/{therapist_id}", response_model=TherapistResponse)
async def update_therapist(
    therapist_id: uuid.UUID,
    payload: TherapistUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin),
):
    """Update therapist details and regular working hours (admin only)."""
    therapist = therapist_service.get_therapist_or_404(db, therapist_id)
    updated = therapist_service.update_therapist(db, therapist, payload)
    return therapist_service.to_response(db, updated)


@router.delete("/{therapist_id}")
async def delete_therapist(
    therapist_id: uuid.UUID,
    action: Optional[str] = Query(
        None,
        description="With upcoming bookings: 'cancel' cancels them and deactivates; "
        "'unassign' removes appointments and hard-deletes.",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin),
):
    """
    Delete or deactivate a therapist (admin only).

    Without ``action`` the endpoint returns **409 Conflict** when upcoming
    booked appointments exist, so the UI can prompt for a resolution.
    """
    therapist = therapist_service.get_therapist_or_404(db, therapist_id)
    result = therapist_service.delete_therapist(db, therapist, action=action)
    return JSONResponse(status_code=status.HTTP_200_OK, content=result)


@router.post(
    "/{therapist_id}/overrides",
    response_model=TherapistOverrideRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_override(
    therapist_id: uuid.UUID,
    payload: TherapistOverrideCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin),
):
    """Add or update a specific-date schedule override (day off or custom hours)."""
    therapist = therapist_service.get_therapist_or_404(db, therapist_id)
    override = therapist_service.upsert_override(db, therapist, payload)
    return override


@router.get("/{therapist_id}/overrides", response_model=list[TherapistOverrideRead])
async def list_overrides(
    therapist_id: uuid.UUID,
    start_date: Optional[date] = Query(None, alias="start_date"),
    end_date: Optional[date] = Query(None, alias="end_date"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List schedule overrides for a therapist, optionally within a date range."""
    therapist_service.get_therapist_or_404(db, therapist_id)
    return therapist_service.list_overrides(db, therapist_id, start_date, end_date)
