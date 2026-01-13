# Personal Finance Platform - Complete Specification

## Project Overview

A comprehensive personal finance management platform for tracking savings, expenses, and investments across multiple sources with automated categorization and analytics.

**Core Value Proposition:** Unified financial visibility with intelligent categorization and portfolio tracking across all asset types.

---

## 1. Functional Requirements

### 1.1 Savings & Banking

**Multi-Bank Integration**
- Support multiple bank account connections
- Import transactions from various sources (Revolut, others via Plaid/TrueLayer)
- Automatic transaction synchronization
- Deduplication of transactions across sources
- Support for checking, savings, and credit accounts

**Transaction Management**
- View all transactions across accounts
- Filter by date range, account, category, amount
- Search by description or merchant
- Manual transaction entry for cash/offline payments
- Transaction notes and tags

### 1.2 Expense Tracking & Categorization

**Automatic Categorization**
- Rule-based categorization engine
- Pattern matching (keyword/regex)
- Merchant-based auto-assignment
- Machine learning categorization (future)

**Category Management**
- Hierarchical category structure (parent/child)
- Default category templates (groceries, transport, utilities, etc.)
- Custom category creation
- Category rules management UI
- Bulk recategorization

**Manual Categorization**
- Review uncategorized transactions
- Quick-assign interface
- Split transactions across categories
- Create rules from manual assignments

**Analytics**
- Spending by category over time
- Month-over-month comparisons
- Budget vs. actual tracking
- Top merchants/categories
- Trend analysis and forecasting
- Cashflow visualization (income vs. expenses)

### 1.3 Investment Portfolio

**Asset Types Supported**
- Stocks (individual equities)
- ETFs (exchange-traded funds)
- Cryptocurrency
- Real estate holdings
- Corporate investments (private equity, bonds)

**Portfolio Management**
- Current valuation of all holdings
- Cost basis tracking
- Realized/unrealized gains
- Portfolio allocation by asset type
- Performance metrics (total return, annualized return)
- Dividend/income tracking

**Data Integration**
- Manual position entry
- API integration for market prices (stocks/ETFs/crypto)
- Automatic valuation updates
- Transaction history (buys, sells, dividends)

**Analytics**
- Portfolio composition breakdown
- Asset allocation charts
- Performance over time
- Benchmark comparisons
- Risk metrics (concentration, volatility)

---

## 2. Technical Architecture

### 2.1 System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Next.js Frontend                      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │  Dashboard   │ │ Transactions │ │  Portfolio   │   │
│  └──────────────┘ └──────────────┘ └──────────────┘   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │ Categories   │ │  Analytics   │ │   Settings   │   │
│  └──────────────┘ └──────────────┘ └──────────────┘   │
└─────────────────────┬───────────────────────────────────┘
                      │ REST API / GraphQL
┌─────────────────────▼───────────────────────────────────┐
│                  FastAPI Backend                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │              API Layer (Routes)                   │  │
│  │  /transactions  /categories  /investments        │  │
│  │  /analytics     /accounts    /sync               │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │           Domain & Service Layer                  │  │
│  │  - Transaction Service    - Category Service     │  │
│  │  - Investment Service     - Analytics Service    │  │
│  │  - Bank Sync Service      - Portfolio Service    │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │            Integration Layer                      │  │
│  │  - Revolut Adapter    - Plaid Adapter            │  │
│  │  - Market Data APIs   - Crypto APIs              │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│              PostgreSQL Database                        │
│  - accounts           - transactions                    │
│  - categories         - categorization_rules            │
│  - investments        - positions                       │
│  - market_prices      - portfolio_snapshots             │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│         Background Worker (Celery + Redis)              │
│  - Bank transaction sync (scheduled/on-demand)          │
│  - Market price updates (15min/hourly)                  │
│  - Auto-categorization processing                       │
│  - Portfolio valuation calculations                     │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Technology Stack

**Backend**
- **Framework:** FastAPI (async, type-safe, OpenAPI)
- **ORM:** SQLAlchemy 2.0 (typed, modern)
- **Database:** PostgreSQL 15+ (JSONB, window functions)
- **Migrations:** Alembic
- **Background Jobs:** Celery + Redis
- **Validation:** Pydantic v2
- **Testing:** pytest, pytest-asyncio
- **API Documentation:** Auto-generated via FastAPI

**Frontend**
- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **State Management:** TanStack Query (server state) + Zustand (UI state)
- **Data Visualization:** Recharts, Chart.js
- **Tables:** TanStack Table
- **Forms:** React Hook Form + Zod
- **Styling:** TailwindCSS + shadcn/ui
- **Icons:** Lucide React

**Infrastructure & DevOps**
- **Containerization:** Docker + Docker Compose
- **Process Management:** Supervisor (for local deployment)
- **Task Queue:** Redis (Celery broker)
- **Logging:** Structured JSON logs (Python `logging`)

---

## 3. Database Schema

### 3.1 Core Tables

**accounts**
```sql
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL, -- checking, savings, credit, investment
    institution VARCHAR(255), -- Bank name or broker
    currency CHAR(3) DEFAULT 'EUR',
    provider VARCHAR(50), -- revolut, plaid, manual
    external_id VARCHAR(255), -- Provider's account ID
    balance_current DECIMAL(15,2),
    balance_available DECIMAL(15,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(provider, external_id)
);
```

**transactions**
```sql
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    external_id VARCHAR(255), -- Provider's transaction ID
    transaction_type VARCHAR(20), -- debit, credit, transfer
    amount DECIMAL(15,2) NOT NULL,
    currency CHAR(3) DEFAULT 'EUR',
    description TEXT,
    merchant VARCHAR(255),
    category_id UUID REFERENCES categories(id),
    booked_at TIMESTAMP NOT NULL,
    pending BOOLEAN DEFAULT false,
    metadata JSONB, -- Flexible storage for provider-specific data
    notes TEXT, -- User notes
    tags TEXT[], -- User tags
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(account_id, external_id)
);

CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_transactions_booked_at ON transactions(booked_at DESC);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_transactions_merchant ON transactions(merchant);
```

**categories**
```sql
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    parent_id UUID REFERENCES categories(id),
    category_type VARCHAR(20) DEFAULT 'expense', -- expense, income, transfer
    color VARCHAR(7), -- Hex color for UI
    icon VARCHAR(50), -- Icon identifier
    is_system BOOLEAN DEFAULT false, -- Prevent deletion of defaults
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(name, parent_id)
);

CREATE INDEX idx_categories_parent ON categories(parent_id);
```

**categorization_rules**
```sql
CREATE TABLE categorization_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    rule_type VARCHAR(20), -- keyword, regex, merchant, amount_range
    pattern TEXT NOT NULL,
    priority INTEGER DEFAULT 0, -- Higher = applied first
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_rules_priority ON categorization_rules(priority DESC);
CREATE INDEX idx_rules_category ON categorization_rules(category_id);
```

### 3.2 Investment Tables

**investments**
```sql
CREATE TABLE investments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES accounts(id),
    asset_type VARCHAR(50) NOT NULL, -- stock, etf, crypto, real_estate, corporate
    symbol VARCHAR(50), -- Ticker symbol (if applicable)
    name VARCHAR(255) NOT NULL,
    description TEXT,
    metadata JSONB, -- Asset-specific data
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(account_id, symbol) WHERE symbol IS NOT NULL
);

CREATE INDEX idx_investments_type ON investments(asset_type);
```

**positions**
```sql
CREATE TABLE positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investment_id UUID REFERENCES investments(id) ON DELETE CASCADE,
    quantity DECIMAL(20,8) NOT NULL,
    cost_basis DECIMAL(15,2) NOT NULL, -- Total purchase cost
    acquired_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_positions_investment ON positions(investment_id);
```

**investment_transactions**
```sql
CREATE TABLE investment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investment_id UUID REFERENCES investments(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20), -- buy, sell, dividend, split, transfer
    quantity DECIMAL(20,8),
    price_per_unit DECIMAL(15,2),
    total_amount DECIMAL(15,2),
    fees DECIMAL(15,2) DEFAULT 0,
    currency CHAR(3) DEFAULT 'EUR',
    executed_at TIMESTAMP NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_inv_txn_investment ON investment_transactions(investment_id);
CREATE INDEX idx_inv_txn_executed ON investment_transactions(executed_at DESC);
```

**market_prices**
```sql
CREATE TABLE market_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investment_id UUID REFERENCES investments(id) ON DELETE CASCADE,
    price DECIMAL(15,2) NOT NULL,
    currency CHAR(3) DEFAULT 'EUR',
    source VARCHAR(50), -- API source
    recorded_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(investment_id, recorded_at)
);

CREATE INDEX idx_prices_investment ON market_prices(investment_id);
CREATE INDEX idx_prices_recorded ON market_prices(recorded_at DESC);
```

**portfolio_snapshots**
```sql
CREATE TABLE portfolio_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    total_value DECIMAL(15,2) NOT NULL,
    allocation JSONB, -- Asset type breakdown
    snapshot_date DATE NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 4. Backend Project Structure

```
backend/
├── app/
│   ├── api/
│   │   ├── deps.py                    # Dependency injection
│   │   └── routes/
│   │       ├── accounts.py            # Account CRUD
│   │       ├── transactions.py        # Transaction management
│   │       ├── categories.py          # Category & rules
│   │       ├── investments.py         # Investment CRUD
│   │       ├── portfolio.py           # Portfolio analytics
│   │       ├── analytics.py           # Financial analytics
│   │       └── sync.py                # Bank/market sync triggers
│   │
│   ├── core/
│   │   ├── config.py                  # Settings (Pydantic BaseSettings)
│   │   ├── logging.py                 # Logging configuration
│   │   └── security.py                # Auth (future)
│   │
│   ├── domain/
│   │   ├── accounts/
│   │   │   ├── models.py              # SQLAlchemy models
│   │   │   ├── schemas.py             # Pydantic schemas
│   │   │   └── service.py             # Business logic
│   │   │
│   │   ├── transactions/
│   │   │   ├── models.py
│   │   │   ├── schemas.py
│   │   │   └── service.py
│   │   │
│   │   ├── categories/
│   │   │   ├── models.py
│   │   │   ├── schemas.py
│   │   │   ├── service.py
│   │   │   └── categorizer.py         # Categorization engine
│   │   │
│   │   ├── investments/
│   │   │   ├── models.py
│   │   │   ├── schemas.py
│   │   │   └── service.py
│   │   │
│   │   ├── portfolio/
│   │   │   ├── service.py             # Valuation & analytics
│   │   │   └── calculator.py          # Returns, allocation
│   │   │
│   │   └── analytics/
│   │       ├── service.py             # Cross-domain analytics
│   │       └── queries.py             # Complex SQL queries
│   │
│   ├── integrations/
│   │   ├── base.py                    # Abstract interfaces
│   │   │
│   │   ├── banks/
│   │   │   ├── revolut/
│   │   │   │   ├── client.py
│   │   │   │   ├── mapper.py
│   │   │   │   └── sync.py
│   │   │   └── plaid/
│   │   │       ├── client.py
│   │   │       ├── mapper.py
│   │   │       └── sync.py
│   │   │
│   │   └── market_data/
│   │       ├── alpha_vantage.py       # Stock/ETF prices
│   │       ├── coinbase.py            # Crypto prices
│   │       └── manual.py              # Real estate/corporate
│   │
│   ├── db/
│   │   ├── base.py                    # SQLAlchemy declarative base
│   │   └── session.py                 # Session management
│   │
│   └── main.py                        # FastAPI app initialization
│
├── worker/
│   ├── celery_app.py                  # Celery configuration
│   └── tasks/
│       ├── bank_sync.py               # Transaction import tasks
│       ├── market_data.py             # Price update tasks
│       ├── categorization.py          # Auto-categorization
│       └── portfolio.py               # Valuation snapshots
│
├── alembic/
│   ├── env.py
│   └── versions/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── conftest.py
│
├── requirements.txt
├── Dockerfile
└── docker-compose.yml
```

---

## 5. Frontend Project Structure

```
frontend/
├── app/
│   ├── (auth)/                        # Future: auth routes
│   │
│   ├── dashboard/
│   │   └── page.tsx                   # Overview page
│   │
│   ├── transactions/
│   │   ├── page.tsx                   # Transaction list
│   │   └── [id]/
│   │       └── page.tsx               # Transaction detail
│   │
│   ├── categories/
│   │   ├── page.tsx                   # Category management
│   │   └── rules/
│   │       └── page.tsx               # Categorization rules
│   │
│   ├── portfolio/
│   │   ├── page.tsx                   # Portfolio overview
│   │   └── [id]/
│   │       └── page.tsx               # Investment detail
│   │
│   ├── analytics/
│   │   ├── expenses/
│   │   │   └── page.tsx               # Expense analytics
│   │   └── portfolio/
│   │       └── page.tsx               # Investment analytics
│   │
│   ├── settings/
│   │   ├── accounts/
│   │   │   └── page.tsx               # Account management
│   │   └── integrations/
│   │       └── page.tsx               # API connections
│   │
│   ├── layout.tsx                     # Root layout
│   └── page.tsx                       # Landing/redirect
│
├── components/
│   ├── ui/                            # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── table.tsx
│   │   └── ...
│   │
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── NavBar.tsx
│   │
│   ├── transactions/
│   │   ├── TransactionTable.tsx
│   │   ├── TransactionFilters.tsx
│   │   ├── CategoryAssigner.tsx
│   │   └── TransactionForm.tsx
│   │
│   ├── categories/
│   │   ├── CategoryTree.tsx
│   │   ├── RuleBuilder.tsx
│   │   └── CategoryForm.tsx
│   │
│   ├── portfolio/
│   │   ├── PortfolioSummary.tsx
│   │   ├── AllocationChart.tsx
│   │   ├── PositionTable.tsx
│   │   └── PerformanceChart.tsx
│   │
│   └── analytics/
│       ├── CashflowChart.tsx
│       ├── SpendingByCategory.tsx
│       ├── TrendChart.tsx
│       └── MetricCard.tsx
│
├── lib/
│   ├── api/
│   │   ├── client.ts                  # Axios/fetch wrapper
│   │   ├── transactions.ts            # Transaction endpoints
│   │   ├── categories.ts
│   │   ├── investments.ts
│   │   └── analytics.ts
│   │
│   ├── hooks/
│   │   ├── useTransactions.ts         # TanStack Query hooks
│   │   ├── useCategories.ts
│   │   ├── usePortfolio.ts
│   │   └── useAnalytics.ts
│   │
│   ├── utils/
│   │   ├── formatters.ts              # Currency, date formatting
│   │   ├── calculations.ts            # Returns, percentages
│   │   └── validators.ts
│   │
│   └── stores/
│       └── ui-store.ts                # Zustand for UI state
│
├── types/
│   ├── transaction.ts
│   ├── category.ts
│   ├── investment.ts
│   └── api.ts
│
├── public/
├── styles/
│   └── globals.css
│
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 6. API Design

### 6.1 Accounts

```
GET    /api/accounts                   # List all accounts
GET    /api/accounts/{id}              # Get account details
POST   /api/accounts                   # Create account (manual)
PATCH  /api/accounts/{id}              # Update account
DELETE /api/accounts/{id}              # Delete account
GET    /api/accounts/{id}/balance      # Get current balance
```

### 6.2 Transactions

```
GET    /api/transactions               # List with filters
  ?account_id=uuid
  &from=2024-01-01
  &to=2024-12-31
  &category_id=uuid
  &uncategorized=true
  &search=text
  &page=1
  &limit=50

GET    /api/transactions/{id}          # Get transaction detail
POST   /api/transactions               # Create manual transaction
PATCH  /api/transactions/{id}          # Update transaction
DELETE /api/transactions/{id}          # Delete transaction
PATCH  /api/transactions/{id}/category # Assign category
POST   /api/transactions/bulk-categorize # Bulk categorization
```

### 6.3 Categories

```
GET    /api/categories                 # Get category tree
GET    /api/categories/{id}            # Get category details
POST   /api/categories                 # Create category
PATCH  /api/categories/{id}            # Update category
DELETE /api/categories/{id}            # Delete category

GET    /api/categories/rules           # List categorization rules
POST   /api/categories/rules           # Create rule
PATCH  /api/categories/rules/{id}      # Update rule
DELETE /api/categories/rules/{id}      # Delete rule
POST   /api/categories/rules/apply     # Apply rules to transactions
```

### 6.4 Investments

```
GET    /api/investments                # List all investments
GET    /api/investments/{id}           # Get investment details
POST   /api/investments                # Add investment
PATCH  /api/investments/{id}           # Update investment
DELETE /api/investments/{id}           # Delete investment

GET    /api/investments/{id}/positions # Get positions
POST   /api/investments/{id}/positions # Add position
PATCH  /api/positions/{id}             # Update position
DELETE /api/positions/{id}             # Delete position

GET    /api/investments/{id}/transactions # Investment transactions
POST   /api/investments/{id}/transactions # Record transaction

GET    /api/investments/{id}/prices    # Price history
POST   /api/investments/prices/refresh # Trigger price update
```

### 6.5 Portfolio

```
GET    /api/portfolio/summary          # Current valuation
GET    /api/portfolio/allocation       # Asset allocation breakdown
GET    /api/portfolio/performance      # Performance metrics
  ?period=1M|3M|6M|1Y|YTD|ALL

GET    /api/portfolio/history          # Historical snapshots
  ?from=2024-01-01
  &to=2024-12-31
```

### 6.6 Analytics

```
GET    /api/analytics/cashflow         # Income vs expenses
  ?from=2024-01-01
  &to=2024-12-31
  &granularity=day|week|month

GET    /api/analytics/spending/category # Spending by category
  ?from=2024-01-01
  &to=2024-12-31

GET    /api/analytics/spending/trends  # Trend analysis
GET    /api/analytics/net-worth        # Net worth over time
GET    /api/analytics/top-merchants    # Top spending merchants
```

### 6.7 Sync

```
POST   /api/sync/banks/{provider}      # Trigger bank sync
  - provider: revolut, plaid

GET    /api/sync/status/{job_id}       # Check sync status
POST   /api/sync/market-prices         # Trigger price refresh
GET    /api/sync/history               # Sync history log
```

---

## 7. Background Jobs

### 7.1 Celery Tasks

**Bank Synchronization**
```python
@celery.task
def sync_revolut_transactions(account_id: str, start_date: str, end_date: str):
    """Fetch and import Revolut transactions"""
    
@celery.task
def sync_all_accounts():
    """Sync all connected accounts (scheduled daily)"""
```

**Market Data Updates**
```python
@celery.task
def update_stock_prices():
    """Update stock/ETF prices (scheduled hourly)"""
    
@celery.task
def update_crypto_prices():
    """Update crypto prices (scheduled every 15min)"""
    
@celery.task
def update_investment_price(investment_id: str):
    """Update single investment price on-demand"""
```

**Categorization**
```python
@celery.task
def auto_categorize_transactions():
    """Apply rules to uncategorized transactions (scheduled hourly)"""
    
@celery.task
def categorize_transaction(transaction_id: str):
    """Categorize single transaction"""
```

**Portfolio Calculations**
```python
@celery.task
def calculate_portfolio_snapshot():
    """Create daily portfolio snapshot (scheduled EOD)"""
    
@celery.task
def recalculate_cost_basis(investment_id: str):
    """Recalculate cost basis after transaction"""
```

### 7.2 Celery Configuration

```python
# worker/celery_app.py
from celery import Celery
from celery.schedules import crontab

celery_app = Celery('finance_worker', broker='redis://localhost:6379/0')

celery_app.conf.beat_schedule = {
    'sync-accounts-daily': {
        'task': 'worker.tasks.sync_all_accounts',
        'schedule': crontab(hour=2, minute=0),  # 2 AM daily
    },
    'update-stock-prices-hourly': {
        'task': 'worker.tasks.update_stock_prices',
        'schedule': crontab(minute=0),  # Every hour
    },
    'update-crypto-prices-15min': {
        'task': 'worker.tasks.update_crypto_prices',
        'schedule': crontab(minute='*/15'),  # Every 15 minutes
    },
    'auto-categorize-hourly': {
        'task': 'worker.tasks.auto_categorize_transactions',
        'schedule': crontab(minute=30),  # Every hour at :30
    },
    'portfolio-snapshot-daily': {
        'task': 'worker.tasks.calculate_portfolio_snapshot',
        'schedule': crontab(hour=23, minute=0),  # 11 PM daily
    },
}
```

---

## 8. Key Features & User Flows

### 8.1 Dashboard View

**Components:**
- Net worth card (total assets - total liabilities)
- Monthly cashflow chart (income vs expenses)
- Portfolio value chart (last 30 days)
- Recent transactions list (latest 10)
- Spending by category (pie chart, current month)
- Quick actions (add transaction, sync accounts)

### 8.2 Transaction Management Flow

1. User navigates to Transactions page
2. View all transactions in sortable/filterable table
3. Filter by date range, account, category, or search
4. Click "Uncategorized" filter to review unassigned transactions
5. Select transaction → assign category via dropdown
6. Option to "Create rule from this assignment"
7. Bulk select multiple transactions → bulk categorize

### 8.3 Categorization Rule Creation

1. Navigate to Categories > Rules
2. Click "Create Rule"
3. Select category to assign
4. Choose rule type: keyword, merchant, or amount range
5. Enter pattern (e.g., "UBER*", "Starbucks", ">100")
6. Set priority (higher = applied first)
7. Save rule
8. Click "Apply to Existing Transactions" to backfill

### 8.4 Investment Entry Flow

1. Navigate to Portfolio
2. Click "Add Investment"
3. Select asset type (stock, ETF, crypto, real estate, corporate)
4. Enter details:
   - Name/symbol (auto-complete for stocks/ETFs)
   - Account (if applicable)
   - Initial position (quantity, cost basis, date)
5. System fetches current price for marketable securities
6. Investment appears in portfolio with current valuation

### 8.5 Portfolio Analytics

1. Portfolio overview shows:
   - Total value
   - Total gain/loss ($ and %)
   - Asset allocation (pie chart)
2. Performance chart shows historical value
3. Position table shows each holding with:
   - Current value
   - Cost basis
   - Gain/loss
   - % of portfolio
4. Click investment → detailed view with:
   - Transaction history
   - Price chart
   - Performance metrics

---

## 9. Integration Strategy

### 9.1 Bank Integration Architecture

**Adapter Pattern:**
```python
# integrations/base.py
class BankAdapter(ABC):
    @abstractmethod
    async def fetch_accounts(self) -> List[AccountData]:
        pass
    
    @abstractmethod
    async def fetch_transactions(
        self, 
        account_id: str, 
        start_date: date, 
        end_date: date
    ) -> List[TransactionData]:
        pass
    
    @abstractmethod
    def normalize_transaction(self, raw: dict) -> TransactionData:
        pass
```

**Canonical Transaction Model:**
```python
class TransactionData(BaseModel):
    external_id: str
    account_external_id: str
    amount: Decimal
    currency: str
    description: str
    merchant: Optional[str]
    booked_at: datetime
    transaction_type: str  # debit, credit
    metadata: dict  # Provider-specific extras
```

### 9.2 Market Data Integration

**Pricing Providers:**
- **Stocks/ETFs:** Alpha Vantage, Yahoo Finance API
- **Crypto:** CoinGecko, Coinbase API
- **Real Estate:** Manual entry (no API)
- **Corporate:** Manual entry

**Price Update Strategy:**
- Stocks/ETFs: Hourly during market hours, EOD otherwise
- Crypto: Every 15 minutes
- Manual assets: On-demand user update

---

## 10. Analytics Implementation

### 10.1 Cashflow Analysis

**SQL Query Pattern:**
```sql
SELECT 
    DATE_TRUNC('month', booked_at) as month,
    SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income,
    SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as expenses,
    SUM(amount) as net
FROM transactions
WHERE booked_at BETWEEN :start_date AND :end_date
GROUP BY month
ORDER BY month;
```

### 10.2 Category Spending

**Hierarchical Aggregation:**
```sql
WITH RECURSIVE category_tree AS (
    -- Base case: top-level categories
    SELECT 
        id,
        name,
        parent_id,
        ARRAY[id] as path,
        name as full_path
    FROM categories
    WHERE parent_id IS NULL
    
    UNION ALL
    
    -- Recursive case: child categories
    SELECT 
        c.id,
        c.name,
        c.parent_id,
        ct.path || c.id,
        ct.full_path || ' > ' || c.name
    FROM categories c
    JOIN category_tree ct ON c.parent_id = ct.id
)
SELECT 
    ct.full_path,
    COUNT(t.id) as transaction_count,
    SUM(ABS(t.amount)) as total_spent
FROM category_tree ct
LEFT JOIN transactions t ON t.category_id = ct.id
WHERE t.booked_at BETWEEN :start_date AND :end_date
GROUP BY ct.full_path, ct.path
ORDER BY total_spent DESC;
```