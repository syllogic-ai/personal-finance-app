"""
Script to reset the database by dropping all tables and recreating them.
WARNING: This will delete all data!
"""
from sqlalchemy import inspect
from app.database import engine, Base
from app.models import (
    User, Account, Category, Transaction,
    CategorizationRule, BankConnection
)

def reset_database():
    """Drop all tables and recreate them with the new schema."""
    print("⚠️  WARNING: This will delete all existing data!")
    print("Dropping all existing tables...")
    
    # Drop all tables
    Base.metadata.drop_all(bind=engine)
    print("✓ All tables dropped")
    
    print("\nCreating new tables with updated schema...")
    # Create all tables with new schema
    Base.metadata.create_all(bind=engine)
    print("✓ All tables created successfully!")
    
    print("\nCreated tables:")
    inspector = inspect(engine)
    for table_name in inspector.get_table_names():
        print(f"  - {table_name}")
    
    print("\n✅ Database reset complete! You can now run seed_data.py")

if __name__ == "__main__":
    reset_database()
