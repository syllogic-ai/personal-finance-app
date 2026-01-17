# Database Monitor - Streamlit App

A Streamlit application for monitoring and exploring your PostgreSQL database.

## Features

- **6 Table Tabs**: View all database tables
  - 👥 Users
  - 💳 Accounts
  - 📁 Categories
  - 💰 Transactions
  - 🎯 Categorization Rules
  - 🏦 Bank Connections

- **Real-time Statistics**: View table counts and metrics
- **Filtering**: Filter data by user, date range, etc.
- **Search**: Search transactions by description or merchant
- **Summary Metrics**: Quick insights for each table

## Installation

Make sure you have Streamlit installed:

```bash
pip install streamlit pandas
```

Or install all requirements:

```bash
pip install -r requirements.txt
```

## Usage

Run the Streamlit app:

```bash
cd backend
streamlit run monitor_db.py
```

The app will open in your browser at `http://localhost:8501`

## Features by Tab

### Users Tab
- View all users
- See user details (email, name, verification status)

### Accounts Tab
- View all accounts
- Filter by user
- See summary metrics (active accounts, total balance, providers, currencies)

### Categories Tab
- View all categories
- Filter by user
- See category counts by type (expense, income, transfer)

### Transactions Tab
- View all transactions
- Filter by user and date range
- Search by description or merchant
- See summary metrics (total amount, income, expenses, categorization rate)

### Categorization Rules Tab
- View all categorization rules
- Filter by user
- See active vs inactive rules

### Bank Connections Tab
- View all bank connections
- Filter by user
- See connection status breakdown

## Database Connection

The app uses the same database configuration as your FastAPI backend:
- Reads from `DATABASE_URL` environment variable
- Uses the same SQLAlchemy models
- Connects to PostgreSQL database

## Notes

- The app is read-only (no data modification)
- Data refreshes when you click the refresh button
- All filters are applied client-side after fetching data
- The connection stays open during the session for performance
