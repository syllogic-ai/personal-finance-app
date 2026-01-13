# Personal Finance App

A personal finance management platform for tracking savings, expenses, and investments.

## Quick Start

### Prerequisites
- Docker (for PostgreSQL)
- Python 3.11+
- Node.js 18+

### 1. Start the Database

```bash
docker-compose up -d
```

This starts PostgreSQL on port 5432.

### 2. Setup and Run the Backend

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Seed the database with sample data
python seed_data.py

# Start the API server
uvicorn app.main:app --reload
```

The API is now running at http://localhost:8000

View API docs at http://localhost:8000/docs

### 3. Setup and Run the Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app is now running at http://localhost:3000

## Features

- **Dashboard**: Overview of balances and recent transactions
- **Transactions**: View, filter, search, and categorize transactions
- **Categories**: Manage expense and income categories
- **Settings**: View connected accounts

## Tech Stack

- **Backend**: FastAPI, SQLAlchemy, PostgreSQL
- **Frontend**: Next.js 14, TypeScript, TailwindCSS, TanStack Query
- **Database**: PostgreSQL 15

## Project Structure

```
personal-finance-app/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app
│   │   ├── database.py      # Database config
│   │   ├── models.py        # SQLAlchemy models
│   │   ├── schemas.py       # Pydantic schemas
│   │   └── routes/          # API routes
│   ├── seed_data.py         # Sample data generator
│   └── requirements.txt
├── frontend/
│   ├── app/                 # Next.js pages
│   ├── components/          # React components
│   ├── lib/                 # API client & utilities
│   └── types/               # TypeScript types
└── docker-compose.yml       # PostgreSQL setup
```

## API Endpoints

- `GET /api/accounts` - List all accounts
- `GET /api/categories` - List all categories
- `POST /api/categories` - Create a category
- `GET /api/transactions` - List transactions (with filters)
- `PATCH /api/transactions/{id}/category` - Assign category
- `GET /api/transactions/stats/by-category` - Spending by category
