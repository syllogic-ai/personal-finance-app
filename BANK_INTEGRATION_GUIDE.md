# Bank Integration Guide - Programmatic Transaction Import

This guide explains how to programmatically import transactions from banks using third-party services.

## Current Architecture

Your application uses an **adapter pattern** (`BankAdapter` interface) that makes it easy to add new bank integrations. Currently implemented:

- ✅ **Revolut CSV** - Manual CSV file import
- 🔄 **Plaid** - Ready to implement (adapter created)
- 🔄 **TrueLayer** - Ready to implement (adapter created)

## Third-Party Bank Aggregation Services

### 1. **Plaid** (Recommended for US/UK/EU)

**Best for:** US, Canada, UK, and European banks

**Features:**
- ✅ Real-time transaction sync
- ✅ Automatic account discovery
- ✅ Secure OAuth-based authentication
- ✅ Supports 12,000+ financial institutions
- ✅ Free tier: 100 live items (bank connections)
- ✅ Well-documented API

**Pricing:**
- Free tier: 100 live items
- Paid: $0.30-0.50 per live item/month

**Setup:**
1. Sign up at https://plaid.com
2. Get API keys (Client ID, Secret)
3. Use Plaid Link for user authentication
4. Store access tokens for each user's bank connection

**Installation:**
```bash
pip install plaid-python
```

**Example Usage:**
```python
from app.integrations.plaid_adapter import PlaidAdapter
from app.services.sync_service import SyncService

# After user connects via Plaid Link, you get an access_token
adapter = PlaidAdapter(
    access_token=user_access_token,
    client_id=PLAID_CLIENT_ID,
    secret=PLAID_SECRET,
    environment="production"  # or "sandbox" for testing
)

sync_service = SyncService(db)
result = sync_service.sync_all(adapter, provider='plaid')
```

---

### 2. **TrueLayer** (Best for UK/EU)

**Best for:** UK and European banks (Open Banking)

**Features:**
- ✅ Open Banking compliant (UK/EU)
- ✅ Real-time transaction sync
- ✅ Free tier available
- ✅ Strong in UK market
- ✅ Supports 1000+ banks

**Pricing:**
- Free tier: Limited transactions
- Paid: Based on API calls

**Installation:**
```bash
pip install truelayer-sdk
```

---

### 3. **Yodlee** (Global)

**Best for:** Global coverage, enterprise use

**Features:**
- ✅ 20,000+ financial institutions worldwide
- ✅ Very comprehensive
- ✅ Enterprise-focused

**Pricing:**
- Contact for pricing (typically enterprise-level)

---

### 4. **Tink** (EU)

**Best for:** European banks

**Features:**
- ✅ Strong EU presence
- ✅ Open Banking compliant
- ✅ Good developer experience

---

### 5. **Finicity** (US)

**Best for:** US banks, credit unions

**Features:**
- ✅ Strong US coverage
- ✅ Owned by Mastercard
- ✅ Good for credit unions

---

## Implementation Options

### Option 1: Plaid Integration (Recommended)

**Pros:**
- Most popular and well-documented
- Great developer experience
- Strong US/UK/EU coverage
- Free tier available

**Cons:**
- Requires user to connect via Plaid Link (OAuth flow)
- Not available in all countries

**Steps:**
1. Sign up for Plaid account
2. Get API credentials
3. Implement Plaid Link in frontend (OAuth flow)
4. Store access tokens in database
5. Use `PlaidAdapter` to sync transactions

### Option 2: Direct Bank APIs

**Pros:**
- No third-party fees
- Direct connection

**Cons:**
- Limited availability (most banks don't offer public APIs)
- Each bank requires different implementation
- Complex authentication (OAuth, certificates, etc.)
- Revolut Business API only works for business accounts

**Available Direct APIs:**
- Revolut Business API (business accounts only)
- Some banks offer Open Banking APIs (UK/EU)

### Option 3: Continue with CSV Import

**Pros:**
- Works with any bank
- No API costs
- Simple implementation

**Cons:**
- Manual process (user must export CSV)
- Not real-time
- Requires user action

---

## Recommended Approach

For **personal use** and **small scale**:
- ✅ **Continue with CSV import** (what you have now)
- Add more CSV adapters for other banks if needed

For **production app** with **multiple users**:
- ✅ **Use Plaid** (if in US/UK/EU)
- ✅ **Use TrueLayer** (if in UK/EU)
- Implement OAuth flow for user authentication
- Store access tokens securely
- Set up automatic sync (daily/hourly)

---

## Adding a New Integration

To add a new bank integration:

1. **Create adapter** in `backend/app/integrations/`:
   ```python
   from app.integrations.base import BankAdapter
   
   class MyBankAdapter(BankAdapter):
       def fetch_accounts(self) -> List[AccountData]:
           # Implement account fetching
           pass
       
       def fetch_transactions(self, account_external_id, start_date, end_date):
           # Implement transaction fetching
           pass
   ```

2. **Add sync route** in `backend/app/routes/sync.py`:
   ```python
   @router.post("/mybank/sync")
   def sync_mybank(access_token: str, db: Session = Depends(get_db)):
       adapter = MyBankAdapter(access_token)
       sync_service = SyncService(db)
       return sync_service.sync_all(adapter, provider='mybank')
   ```

3. **Use the same sync service** - it handles:
   - Account creation/updates
   - Transaction deduplication
   - Automatic categorization
   - Database persistence

---

## Security Considerations

When implementing API-based integrations:

1. **Store access tokens securely** (encrypted in database)
2. **Use environment variables** for API keys
3. **Implement token refresh** (if supported)
4. **Handle token expiration** gracefully
5. **Never expose API keys** in frontend code
6. **Use HTTPS** for all API calls

---

## Next Steps

1. **For now:** Continue using CSV import (works great!)
2. **If you want automation:** 
   - Sign up for Plaid (if in supported region)
   - Implement Plaid Link OAuth flow
   - Use the `PlaidAdapter` I created
3. **For other banks:** Create CSV adapters (similar to Revolut)

The adapter pattern makes it easy to add new integrations without changing your core sync logic!

