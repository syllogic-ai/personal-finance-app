# Migration Guide: SQLite/Alembic to PostgreSQL with Drizzle Schema Alignment

## Overview

This migration aligns the Python backend with the TypeScript Drizzle schema (`frontend/lib/db/schema.ts`) and migrates from SQLite to PostgreSQL.

## Key Changes

### 1. Database Engine
- **From**: SQLite (`finance.db`)
- **To**: PostgreSQL (local or remote)
- **Connection**: Uses `DATABASE_URL` environment variable

### 2. Schema Changes

#### Multi-Tenancy Support
- All tables now require `user_id` field
- Backend uses a "system" user for backward compatibility
- When authentication is added, data will need to be reassigned to actual users

#### New Fields
- **Accounts**: Added `last_synced_at`
- **Transactions**: 
  - Added `category_system_id` (AI-assigned category, separate from user-overridden)
  - Added `categorization_instructions` (user instructions for AI)
  - Added `enrichment_data` (JSONB for merchant enrichment)
  - Removed `notes` field (can be added back if needed)

#### New Tables
- `categorization_rules` - User-defined categorization rules
- `bank_connections` - GoCardless/Nordigen bank connections
- `users` - BetterAuth user table (minimal model for FK relationships)

### 3. Model Updates
- Models now match Drizzle schema structure exactly
- Added proper indexes and unique constraints
- Updated relationships to handle new foreign keys

## Migration Steps

### Step 1: Set Up PostgreSQL

1. Install PostgreSQL locally or use a remote instance
2. Create database:
```sql
CREATE DATABASE finance_db;
CREATE USER financeuser WITH PASSWORD 'financepass';
GRANT ALL PRIVILEGES ON DATABASE finance_db TO financeuser;
```

3. Update `.env` file:
```env
DATABASE_URL=postgresql+psycopg://financeuser:financepass@localhost:5432/finance_db
```

### Step 2: Run Migration Script

```bash
cd backend
python migrate_to_postgres.py
```

This will:
- Create system user in PostgreSQL
- Migrate all categories
- Migrate all accounts
- Migrate all transactions
- Map old IDs to new UUIDs

### Step 3: Update Route Files

All route files need to be updated to:
1. Filter by `user_id` (use `get_user_id()` helper)
2. Handle new field names (`category_system_id` vs `category_id`)
3. Update queries to use new relationships

**Example update needed:**
```python
# OLD
categories = db.query(Category).all()

# NEW
from app.db_helpers import get_user_id
user_id = get_user_id()  # Get from auth context in future
categories = db.query(Category).filter(Category.user_id == user_id).all()
```

### Step 4: Update Category Matcher

The `category_matcher.py` needs updates to:
- Use `category_system_id` for AI-assigned categories
- Keep `category_id` for user-overridden categories
- Filter categories by `user_id`

### Step 5: Remove SQLite Support

- Remove `finance.db` file (after migration)
- Remove SQLite-specific code from `database.py` (already done)
- Update documentation

## Breaking Changes

1. **User ID Required**: All queries must filter by `user_id`
2. **Category Fields**: `category_id` vs `category_system_id` distinction
3. **PostgreSQL Only**: SQLite no longer supported
4. **New Tables**: Need to handle `categorization_rules` and `bank_connections`

## Next Steps

1. ✅ Models updated to match Drizzle schema
2. ✅ Database connection updated for PostgreSQL
3. ✅ Migration script created
4. ⏳ Update all route files (accounts, categories, transactions, analytics, sync)
5. ⏳ Update category_matcher.py
6. ⏳ Update seed_data.py to use new schema
7. ⏳ Add authentication middleware to get real user_id
8. ⏳ Test all endpoints

## Notes

- The migration uses a "system" user for backward compatibility
- When you add authentication, you'll need to reassign data to actual users
- The Drizzle schema is the source of truth - SQLAlchemy models mirror it
- Alembic can still be used for migrations, but schema changes should originate from Drizzle
