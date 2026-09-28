"""
Authentication endpoints: login, current user, token refresh.
"""

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from backend.app.core.config import get_settings
from backend.app.core.database import get_db
from backend.app.core.security import (
    REFRESH_TOKEN_TYPE,
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from backend.app.api.deps import get_current_user
from backend.app.models.user import User
from backend.app.schemas.auth import (
    LoginRequest,
    MeResponse,
    RefreshRequest,
    TokenResponse,
)

settings = get_settings()

router = APIRouter(prefix="/auth", tags=["Auth"])


def _authenticate(db: Session, identifier: str, password: str) -> User:
    """Find the user by email or username and verify the password."""
    ident = identifier.strip()
    user = (
        db.query(User)
        .filter(
            or_(
                func.lower(User.email) == ident.lower(),
                func.lower(User.username) == ident.lower(),
            )
        )
        .first()
    )
    if user is None or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email/username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def _token_response(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user.id, user.role),
        refresh_token=create_refresh_token(user.id, user.role),
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        role=user.role,
        user=user,
    )


@router.post("/login", response_model=TokenResponse)
async def login(request: Request, db: Session = Depends(get_db)):
    """
    Authenticate with either:

    * JSON body: ``{"username": "<email-or-username>", "password": "..."}``
    * OAuth2 form data (``username`` / ``password`` fields) – used by Swagger UI.
    """
    content_type = request.headers.get("content-type", "")
    identifier: Optional[str] = None
    password: Optional[str] = None

    if content_type.startswith("application/json"):
        try:
            body = await request.json()
            data = LoginRequest.model_validate(body)
            identifier, password = data.username, data.password
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Invalid JSON body; expected {'username', 'password'}",
            )
    else:
        form = await request.form()
        identifier = form.get("username")
        password = form.get("password")
        if not identifier or not password:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Form login requires 'username' and 'password' fields",
            )

    user = _authenticate(db, identifier, password)
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user account",
        )
    return _token_response(user)


@router.get("/me", response_model=MeResponse)
async def read_current_user(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return current_user


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    body: RefreshRequest,
    db: Session = Depends(get_db),
):
    """Issue a fresh access + refresh token pair from a valid refresh token."""
    payload = decode_token(body.refresh_token, expected_type=REFRESH_TOKEN_TYPE)
    if payload is None or not payload.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = UUID(str(payload["sub"]))
    except (ValueError, AttributeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token subject",
        )

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )
    return _token_response(user)
