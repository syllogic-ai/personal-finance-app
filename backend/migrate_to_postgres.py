"""
Migration script to migrate data from SQLite to PostgreSQL.
This script:
1. Connects to SQLite database
2. Connects to PostgreSQL database
3. Migrates all data, adding system userId for backward compatibility
4. Handles schema differences between old and new models
"""
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from decimal import Decimal
from datetime import datetime

# Old SQLite models (temporary)
from sqlalchemy import Column, String, Boolean, DateTime, Numeric, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declarative_base

# New PostgreSQL models
from app.models import Account, Category, Transaction, User
from app.db_helpers import get_or_create_system_user, SYSTEM_USER_ID
from app.database import engine as pg_engine, SessionLocal as pg_session

# SQLite connection (old database)
sqlite_url = "sqlite:///./finance.db"
sqlite_engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})
sqlite_session = sessionmaker(bind=sqlite_engine)()

# PostgreSQL connection (new database)
pg_db = pg_session()


def migrate_users():
    """Create system user in PostgreSQL if it doesn't exist."""
    print("Migrating users...")
    user = get_or_create_system_user(pg_db)
    print(f"✓ System user created/found: {user.id}")
    return user.id


def migrate_categories(user_id: str):
    """Migrate categories from SQLite to PostgreSQL."""
    print("\nMigrating categories...")
    
    # Query old categories from SQLite
    old_categories = sqlite_engine.execute("""
        SELECT id, name, parent_id, category_type, color, icon, is_system, created_at
        FROM categories
    """).fetchall()
    
    category_id_map = {}  # Map old ID to new ID
    
    for old_cat in old_categories:
        # Check if category already exists
        existing = pg_db.query(Category).filter(
            Category.user_id == user_id,
            Category.name == old_cat[1],
            Category.parent_id == None if old_cat[2] is None else None  # Simplified
        ).first()
        
        if existing:
            category_id_map[str(old_cat[0])] = existing.id
            continue
        
        # Create new category
        new_cat = Category(
            user_id=user_id,
            name=old_cat[1],
            parent_id=None,  # Will update after all categories are created
            category_type=old_cat[3] or "expense",
            color=old_cat[4],
            icon=old_cat[5],
            is_system=bool(old_cat[6]),
            created_at=old_cat[7] if old_cat[7] else datetime.utcnow()
        )
        pg_db.add(new_cat)
        pg_db.flush()
        category_id_map[str(old_cat[0])] = new_cat.id
    
    pg_db.commit()
    
    # Update parent_id references
    for old_cat in old_categories:
        if old_cat[2]:  # Has parent
            new_id = category_id_map.get(str(old_cat[0]))
            parent_id = category_id_map.get(str(old_cat[2]))
            if new_id and parent_id:
                pg_db.query(Category).filter(Category.id == new_id).update({
                    "parent_id": parent_id
                })
    
    pg_db.commit()
    print(f"✓ Migrated {len(category_id_map)} categories")
    return category_id_map


def migrate_accounts(user_id: str):
    """Migrate accounts from SQLite to PostgreSQL."""
    print("\nMigrating accounts...")
    
    old_accounts = sqlite_engine.execute("""
        SELECT id, name, account_type, institution, currency, provider, external_id,
               balance_current, balance_available, is_active, created_at, updated_at
        FROM accounts
    """).fetchall()
    
    account_id_map = {}
    
    for old_acc in old_accounts:
        new_acc = Account(
            user_id=user_id,
            name=old_acc[1],
            account_type=old_acc[2],
            institution=old_acc[3],
            currency=old_acc[4] or "EUR",
            provider=old_acc[5],
            external_id=old_acc[6],
            balance_current=Decimal(str(old_acc[7] or 0)),
            balance_available=Decimal(str(old_acc[8])) if old_acc[8] else None,
            is_active=bool(old_acc[9]),
            created_at=old_acc[10] if old_acc[10] else datetime.utcnow(),
            updated_at=old_acc[11] if old_acc[11] else datetime.utcnow()
        )
        pg_db.add(new_acc)
        pg_db.flush()
        account_id_map[str(old_acc[0])] = new_acc.id
    
    pg_db.commit()
    print(f"✓ Migrated {len(account_id_map)} accounts")
    return account_id_map


def migrate_transactions(user_id: str, account_id_map: dict, category_id_map: dict):
    """Migrate transactions from SQLite to PostgreSQL."""
    print("\nMigrating transactions...")
    
    old_transactions = sqlite_engine.execute("""
        SELECT id, account_id, external_id, transaction_type, amount, currency,
               description, merchant, category_id, booked_at, pending, notes,
               created_at, updated_at
        FROM transactions
    """).fetchall()
    
    migrated_count = 0
    
    for old_txn in old_transactions:
        # Map old account_id to new account_id
        new_account_id = account_id_map.get(str(old_txn[1]))
        if not new_account_id:
            print(f"  ⚠ Skipping transaction {old_txn[0]}: account not found")
            continue
        
        # Map old category_id to new category_id
        new_category_id = None
        if old_txn[8]:  # Has category_id
            new_category_id = category_id_map.get(str(old_txn[8]))
        
        new_txn = Transaction(
            user_id=user_id,
            account_id=new_account_id,
            external_id=old_txn[2],
            transaction_type=old_txn[3],
            amount=Decimal(str(old_txn[4])),
            currency=old_txn[5] or "EUR",
            description=old_txn[6],
            merchant=old_txn[7],
            category_id=new_category_id,  # User-overridden (migrated from old category_id)
            category_system_id=None,  # Will be set by categorization later
            booked_at=old_txn[9],
            pending=bool(old_txn[10]),
            categorization_instructions=None,  # New field
            enrichment_data=None,  # New field
            created_at=old_txn[11] if old_txn[11] else datetime.utcnow(),
            updated_at=old_txn[12] if old_txn[12] else datetime.utcnow()
        )
        pg_db.add(new_txn)
        migrated_count += 1
    
    pg_db.commit()
    print(f"✓ Migrated {migrated_count} transactions")
    return migrated_count


def main():
    """Run the migration."""
    print("=" * 60)
    print("SQLite to PostgreSQL Migration")
    print("=" * 60)
    
    try:
        # Step 1: Create system user
        user_id = migrate_users()
        
        # Step 2: Migrate categories
        category_id_map = migrate_categories(user_id)
        
        # Step 3: Migrate accounts
        account_id_map = migrate_accounts(user_id)
        
        # Step 4: Migrate transactions
        transaction_count = migrate_transactions(user_id, account_id_map, category_id_map)
        
        print("\n" + "=" * 60)
        print("Migration Complete!")
        print("=" * 60)
        print(f"✓ Users: 1 (system user)")
        print(f"✓ Categories: {len(category_id_map)}")
        print(f"✓ Accounts: {len(account_id_map)}")
        print(f"✓ Transactions: {transaction_count}")
        print("\nNote: All data has been assigned to system user.")
        print("When you add authentication, you'll need to reassign data to actual users.")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        pg_db.rollback()
        sys.exit(1)
    finally:
        sqlite_session.close()
        pg_db.close()


if __name__ == "__main__":
    main()
