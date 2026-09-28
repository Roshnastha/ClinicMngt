"""
Alembic env.py – reads DATABASE_URL from .env / environment and auto-detects all models.

Works when run from the backend/ directory (the documented workflow):
    cd backend
    alembic revision --autogenerate -m "Initial migration"
"""

import os
import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import engine_from_config, pool
from alembic import context

# ---------------------------------------------------------------------------
# Path bootstrap: alembic.ini has `prepend_sys_path = .`, which puts the CWD
# (backend/) on sys.path. But all project imports are `from backend.app...`,
# which requires the PARENT of backend/ on sys.path instead. Add it manually.
# ---------------------------------------------------------------------------
BACKEND_DIR = Path(__file__).resolve().parent.parent   # .../clinicmngt/backend
PROJECT_ROOT = BACKEND_DIR.parent                       # .../clinicmngt
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Now the backend package is importable
from backend.app.core.config import get_settings  # noqa: E402
from backend.app.core.database import Base  # noqa: E402, F401 – model registration

# Import all models so Base.metadata knows about them
from backend.app.models import (  # noqa: E402, F401
    Appointment,
    Invoice,
    Patient,
    Therapist,
    TherapistOverride,
    User,
)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
config = context.config

# Load DATABASE_URL: environment variable wins, otherwise .env next to alembic.ini
settings = get_settings()
raw_db_url = os.getenv("DATABASE_URL") or settings.DATABASE_URL
# Env vars may carry a bare postgresql:// URL; pin the dialect to psycopg2.
db_url = raw_db_url.replace("postgresql://", "postgresql+psycopg2://", 1) \
    if raw_db_url.startswith("postgresql://") else raw_db_url
config.set_main_option("sqlalchemy.url", db_url)

# Logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Metadata for autogenerate
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode (generates SQL without connecting)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode (connects to the database)."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
