"""
Users API router – admin-only endpoints.
"""

from fastapi import APIRouter, Depends

from backend.app.api.deps import get_current_user, get_current_active_admin
from backend.app.models.user import User

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/")
async def list_users(
    current_user: User = Depends(get_current_active_admin),
):
    return {"message": "List users – TODO (admin only)"}


@router.get("/me")
async def read_me(current_user: User = Depends(get_current_user)):
    return {"message": f"Current user {current_user.username}"}


@router.get("/{user_id}")
async def get_user(
    user_id: str,
    current_user: User = Depends(get_current_active_admin),
):
    return {"message": f"Get user {user_id} – TODO (admin only)"}
