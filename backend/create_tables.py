"""
Script to create all database tables based on the current models.
Run this before seed_data.py to ensure tables exist with the correct schema.
"""
from app.database import engine, Base
from app.models import (
    User, Account, Category, Transaction,
    CategorizationRule, BankConnection
)

def create_tables():
    """Create all tables in the database."""
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("✓ Tables created successfully!")
    print("\nCreated tables:")
    print("  - users")
    print("  - accounts")
    print("  - categories")
    print("  - transactions")
    print("  - categorization_rules")
    print("  - bank_connections")

if __name__ == "__main__":
    create_tables()
