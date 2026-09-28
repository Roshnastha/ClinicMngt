"""
Re-export the declarative Base so Alembic and other modules can import from one place.
"""

from backend.app.core.database import Base  # noqa: F401
