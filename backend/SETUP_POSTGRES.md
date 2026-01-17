# PostgreSQL Setup Guide

## Option 1: Using Docker (Recommended)

1. **Start Docker Desktop** (if not already running)

2. **Start PostgreSQL container:**
   ```bash
   docker-compose up -d db
   ```

3. **Verify it's running:**
   ```bash
   docker ps
   ```

4. **The database is now available at:**
   - Host: `localhost`
   - Port: `5432`
   - Database: `finance_db`
   - User: `financeuser`
   - Password: `financepass`

## Option 2: Local PostgreSQL Installation

1. **Install PostgreSQL** (if not already installed):
   - Windows: Download from https://www.postgresql.org/download/windows/
   - Or use: `winget install PostgreSQL.PostgreSQL`

2. **Create database and user:**
   ```sql
   -- Connect to PostgreSQL as superuser
   psql -U postgres

   -- Create database
   CREATE DATABASE finance_db;

   -- Create user
   CREATE USER financeuser WITH PASSWORD 'financepass';

   -- Grant privileges
   GRANT ALL PRIVILEGES ON DATABASE finance_db TO financeuser;

   -- Connect to the new database
   \c finance_db

   -- Grant schema privileges
   GRANT ALL ON SCHEMA public TO financeuser;
   ```

3. **Update .env file:**
   ```
   DATABASE_URL=postgresql+psycopg://financeuser:financepass@localhost:5432/finance_db
   ```

## Verify Connection

After setting up PostgreSQL, verify the connection:

```bash
cd backend
python -c "from app.database import engine; engine.connect(); print('✓ Database connection successful!')"
```

## Create Tables

The tables will be created automatically when you run the application or seed script:

```bash
cd backend
python seed_data.py
```

This will:
1. Create the system user
2. Create all tables (via SQLAlchemy)
3. Seed with sample data
