"""
Pydantic schemas for authentication.
"""

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class LoginRequest(BaseModel):
    """JSON login body (alternative to the OAuth2 form)."""

    username: str  # email or username
    password: str


class UserPublic(BaseModel):
    id: uuid.UUID
    email: str
    username: str
    full_name: str
    role: str
    is_active: bool

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    refresh_token: Optional[str] = None
    expires_in: int  # access token lifetime in seconds
    role: str
    user: UserPublic


class RefreshRequest(BaseModel):
    refresh_token: str


class MeResponse(UserPublic):
    created_at: datetime
    updated_at: datetime
