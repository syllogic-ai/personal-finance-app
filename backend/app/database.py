"""
Database configuration for PostgreSQL using SQLAlchemy.
This mirrors the Drizzle schema.ts structure from the frontend.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from pydantic_settings import BaseSettings
import os
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    """
    Database settings. Defaults to PostgreSQL.
    SQLite support has been removed - PostgreSQL is required.
    """
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://financeuser:financepass@localhost:5433/finance_db"
    )

    class Config:
        env_file = ".env"
        extra = "ignore"  # Allow extra fields in .env file


settings = Settings()

# Configure database URL - ensure PostgreSQL format
db_url = settings.database_url
if db_url.startswith("postgresql://"):
    db_url = db_url.replace("postgresql://", "postgresql+psycopg://", 1)

# Validate that we're using PostgreSQL (SQLite no longer supported)
if db_url.startswith("sqlite"):
    raise ValueError(
        "SQLite is no longer supported. Please use PostgreSQL. "
        "Set DATABASE_URL to a PostgreSQL connection string, e.g.: "
        "postgresql+psycopg://user:password@localhost:5432/finance_db"
    )

# Create engine with PostgreSQL-specific settings
engine = create_engine(
    db_url,
    pool_pre_ping=True,  # Verify connections before using
    pool_size=10,
    max_overflow=20,
    echo=False  # Set to True for SQL query logging
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """
    Dependency for FastAPI to get database session.
    Yields a database session and ensures it's closed after use.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
