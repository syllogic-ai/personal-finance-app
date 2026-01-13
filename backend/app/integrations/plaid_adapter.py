"""
Plaid adapter for fetching accounts and transactions via Plaid API.
Requires: pip install plaid-python
"""
from typing import List, Optional
from datetime import datetime, timedelta
from decimal import Decimal

try:
    from plaid.api import plaid_api
    from plaid.model.transactions_get_request import TransactionsGetRequest
    from plaid.model.accounts_get_request import AccountsGetRequest
    from plaid.configuration import Configuration
    from plaid.api_client import ApiClient
    PLAID_AVAILABLE = True
except ImportError:
    PLAID_AVAILABLE = False

from app.integrations.base import BankAdapter, AccountData, TransactionData


class PlaidAdapter(BankAdapter):
    """Adapter for Plaid bank integration."""
    
    def __init__(self, access_token: str, client_id: str, secret: str, environment: str = "sandbox"):
        """
        Initialize Plaid adapter.
        
        Args:
            access_token: Plaid access token for the user's bank connection
            client_id: Plaid client ID
            secret: Plaid secret key
            environment: Plaid environment ('sandbox', 'development', 'production')
        """
        if not PLAID_AVAILABLE:
            raise ImportError("plaid-python is not installed. Run: pip install plaid-python")
        
        self.access_token = access_token
        
        # Configure Plaid client
        configuration = Configuration(
            host=getattr(plaid_api.PlaidEnvironment, environment),
            api_key={
                'clientId': client_id,
                'secret': secret
            }
        )
        api_client = ApiClient(configuration)
        self.client = plaid_api.PlaidApi(api_client)
    
    def fetch_accounts(self) -> List[AccountData]:
        """Fetch all accounts from Plaid."""
        request = AccountsGetRequest(access_token=self.access_token)
        response = self.client.accounts_get(request)
        
        accounts = []
        for account in response.accounts:
            # Map Plaid account types to our format
            account_type_map = {
                'depository': 'checking',
                'credit': 'credit',
                'loan': 'loan',
                'investment': 'investment',
                'other': 'checking'
            }
            
            account_type = account_type_map.get(
                account.type.value if hasattr(account.type, 'value') else str(account.type),
                'checking'
            )
            
            accounts.append(AccountData(
                external_id=account.account_id,
                name=account.name,
                account_type=account_type,
                institution=account.official_name or account.name,
                currency=account.balances.iso_currency_code or 'USD',
                balance_current=Decimal(str(account.balances.current or 0)),
                balance_available=Decimal(str(account.balances.available or 0)) if account.balances.available else None,
                metadata={
                    'plaid_account_id': account.account_id,
                    'mask': account.mask,
                    'subtype': account.subtype.value if hasattr(account.subtype, 'value') else str(account.subtype) if account.subtype else None,
                }
            ))
        
        return accounts
    
    def fetch_transactions(
        self,
        account_external_id: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> List[TransactionData]:
        """Fetch transactions for a specific account."""
        # Default to last 30 days if no dates provided
        if not start_date:
            start_date = datetime.now() - timedelta(days=30)
        if not end_date:
            end_date = datetime.now()
        
        # Plaid requires dates in YYYY-MM-DD format
        start_date_str = start_date.strftime('%Y-%m-%d')
        end_date_str = end_date.strftime('%Y-%m-%d')
        
        request = TransactionsGetRequest(
            access_token=self.access_token,
            start_date=start_date_str,
            end_date=end_date_str,
            account_ids=[account_external_id] if account_external_id != 'all' else None
        )
        
        response = self.client.transactions_get(request)
        transactions = response.transactions
        
        # Handle pagination if needed
        while len(transactions) < response.total_transactions:
            request = TransactionsGetRequest(
                access_token=self.access_token,
                start_date=start_date_str,
                end_date=end_date_str,
                account_ids=[account_external_id] if account_external_id != 'all' else None,
                options={'offset': len(transactions)}
            )
            paginated_response = self.client.transactions_get(request)
            transactions.extend(paginated_response.transactions)
        
        result = []
        for tx in transactions:
            # Skip pending transactions if we only want settled ones
            # (you can modify this logic)
            
            # Determine transaction type
            amount = Decimal(str(tx.amount))
            transaction_type = 'debit' if amount > 0 else 'credit'
            
            # Get merchant name
            merchant = None
            if tx.merchant_name:
                merchant = tx.merchant_name
            elif tx.name:
                # Sometimes merchant info is in the name field
                merchant = tx.name
            
            result.append(TransactionData(
                external_id=tx.transaction_id,
                account_external_id=tx.account_id,
                amount=-amount,  # Plaid uses positive for debits, we use negative
                currency=tx.iso_currency_code or 'USD',
                description=tx.name or tx.merchant_name or 'Transaction',
                merchant=merchant,
                booked_at=datetime.fromisoformat(tx.date.replace('Z', '+00:00')) if 'T' in tx.date else datetime.strptime(tx.date, '%Y-%m-%d'),
                transaction_type=transaction_type,
                pending=tx.pending,
                metadata={
                    'plaid_transaction_id': tx.transaction_id,
                    'category': [c.value if hasattr(c, 'value') else str(c) for c in tx.category] if tx.category else None,
                    'location': {
                        'address': tx.location.address if tx.location else None,
                        'city': tx.location.city if tx.location else None,
                        'country': tx.location.country if tx.location else None,
                    } if tx.location else None,
                }
            ))
        
        return result
    
    def normalize_transaction(self, raw: dict) -> TransactionData:
        """Convert Plaid transaction dict to TransactionData."""
        # This is already handled in fetch_transactions, but implement for interface
        return TransactionData(
            external_id=raw['transaction_id'],
            account_external_id=raw['account_id'],
            amount=Decimal(str(raw['amount'])),
            currency=raw.get('iso_currency_code', 'USD'),
            description=raw.get('name', 'Transaction'),
            merchant=raw.get('merchant_name'),
            booked_at=datetime.fromisoformat(raw['date']),
            transaction_type='debit' if raw['amount'] > 0 else 'credit',
            pending=raw.get('pending', False),
            metadata=raw
        )

