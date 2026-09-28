"""
Dashboard API router – live metrics for the operator home screen.

* GET /dashboard/stats              headline numbers for today
* GET /dashboard/therapist-capacity per-therapist slot breakdown for today
* GET /dashboard/recent-patients    last N touched patient records

All three endpoints require a valid access token (any role): receptionists
need the live numbers, and none of them leak anything the roster/schedule
endpoints don't already expose.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_user
from backend.app.core.database import get_db
from backend.app.models.user import User
from backend.app.schemas.dashboard import (
    DashboardStatsResponse,
    RecentPatientSummary,
    TherapistCapacity,
)
from backend.app.services import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=DashboardStatsResponse)
async def get_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Headline metrics for today, computed live:

    * patients seen (non-cancelled appointments today)
    * therapists on duty (override-aware)
    * revenue collected today (net, Paid invoices created/marked today)
    * open slots remaining across on-duty therapists
    """
    return dashboard_service.get_dashboard_stats(db)


@router.get("/therapist-capacity", response_model=list[TherapistCapacity])
async def get_therapist_capacity(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Capacity breakdown per therapist for today: total / booked / free slots,
    utilization, and a per-slot OPEN | BOOKED | OFF timeline with patient
    names on booked slots. Override-aware (day off & custom hours).
    """
    return dashboard_service.get_therapist_capacity(db)


@router.get(
    "/recent-patients",
    response_model=list[RecentPatientSummary],
)
async def get_recent_patients(
    limit: int = Query(
        dashboard_service.RECENT_PATIENTS_LIMIT,
        ge=1,
        le=50,
        description="How many recent patients to return (1–50)",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """The last ``limit`` patients added or updated (most recent first)."""
    return dashboard_service.get_recent_patients(db, limit=limit)
