"""
Pydantic schemas for TherapistOverride.
"""

import uuid
from datetime import date, time
from typing import Optional

from pydantic import BaseModel


class TherapistOverrideBase(BaseModel):
    therapist_id: uuid.UUID
    date: date
    is_day_off: bool = False
    custom_start_time: Optional[time] = None
    custom_end_time: Optional[time] = None
    notes: Optional[str] = None


class TherapistOverrideCreate(TherapistOverrideBase):
    pass


class TherapistOverrideRead(TherapistOverrideBase):
    id: uuid.UUID

    model_config = {"from_attributes": True}
