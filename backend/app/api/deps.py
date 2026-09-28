"""
Shared FastAPI dependencies: JWT authentication and role-based guards.
"""

from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from backend.app.core.config import get_settings
from backend.app.core.database import get_db
from backend.app.core.security import ACCESS_TOKEN_TYPE, decode_token
from backend.app.models.user import User

settings = get_settings()

# tokenUrl points at the login endpoint so Swagger's Authorize dialog works;
# the login endpoint accepts both the OAuth2 form and a JSON body.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_PREFIX}/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Decode the Bearer token, load the user, and validate the token type.

    Raises:
        401 – missing/invalid/expired token, unknown user, inactive account.
    """
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_token(token, expected_type=ACCESS_TOKEN_TYPE)
    if payload is None:
        raise unauthorized

    sub = payload.get("sub")
    if not sub:
        raise unauthorized
    try:
        user_id = UUID(sub)
    except (ValueError, AttributeError):
        raise unauthorized

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise unauthorized

    return user


async def get_current_active_admin(current_user: User = Depends(get_current_user)) -> User:
    """Admin-only guard: 403 for STAFF users."""
    if current_user.role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user doesn't have enough privileges",
        )
    return current_user
