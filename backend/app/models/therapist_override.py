"""
TherapistOverride ORM model – per-date schedule overrides.
"""

import uuid
from datetime import date, datetime, time, timezone
from typing import Optional

from sqlalchemy import String, Boolean, Date, Time, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.core.database import Base


class TherapistOverride(Base):
    __tablename__ = "therapist_overrides"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    therapist_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("therapists.id"), nullable=False
    )
    date: Mapped[date] = mapped_column(Date, nullable=False)
    is_day_off: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    custom_start_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    custom_end_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Relationships
    therapist: Mapped["Therapist"] = relationship("Therapist", back_populates="overrides")
