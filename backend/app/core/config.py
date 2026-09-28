"""
Application configuration loaded from environment variables.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


def _normalize_db_url(url: str) -> str:
    """Pin the SQLAlchemy dialect to psycopg2 (the only driver installed).

    A bare `postgresql://` URL makes SQLAlchemy default to psycopg v3, which
    is not in requirements.txt and would crash on import.
    """
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg2://", 1)
    return url


class Settings(BaseSettings):
    PROJECT_NAME: str = "PhysioDesk"
    API_V1_PREFIX: str = "/api/v1"

    # PostgreSQL
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/physiodesk"

    # Security
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS – comma-separated list of allowed browser origins.
    # 3000 = documented dev port, 3001 = host port used by docker-compose here.
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3001"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def database_url(self) -> str:
        return _normalize_db_url(self.DATABASE_URL)


@lru_cache
def get_settings() -> Settings:
    return Settings()
