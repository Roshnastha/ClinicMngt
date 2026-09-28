"""add therapist is_active

Revision ID: b7e2a4c1d9f3
Revises: 6dd3b5df5386
Create Date: 2026-09-22

Adds a soft-delete flag so therapists with appointment/billing history can
be deactivated instead of hard-deleted (FK preservation).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "b7e2a4c1d9f3"
down_revision: Union[str, None] = "6dd3b5df5386"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "therapists",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )


def downgrade() -> None:
    op.drop_column("therapists", "is_active")
