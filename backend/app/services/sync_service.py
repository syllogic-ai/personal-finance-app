"""
Service for syncing bank data (accounts and transactions).
"""
from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models import Account, Transaction
from app.integrations.base import BankAdapter, AccountData, TransactionData
from app.services.category_matcher import CategoryMatcher


class SyncService:
    """Service for syncing bank data."""
    
    def __init__(self, db: Session, use_llm_categorization: bool = True):
        self.db = db
        self.category_matcher = CategoryMatcher(db)
        self.use_llm_categorization = use_llm_categorization
    
    def sync_accounts(self, adapter: BankAdapter, provider: str) -> List[Account]:
        """
        Sync accounts from bank adapter to database.
        
        Args:
            adapter: Bank adapter instance
            provider: Provider name (e.g., 'revolut')
            
        Returns:
            List of synced Account objects
        """
        account_data_list = adapter.fetch_accounts()
        synced_accounts = []
        
        for account_data in account_data_list:
            # Check if account already exists
            existing_account = self.db.query(Account).filter(
                and_(
                    Account.provider == provider,
                    Account.external_id == account_data.external_id
                )
            ).first()
            
            if existing_account:
                # Update existing account
                existing_account.name = account_data.name
                existing_account.account_type = account_data.account_type
                existing_account.institution = account_data.institution
                existing_account.currency = account_data.currency
                # Only update balance if provided from CSV (not None), otherwise keep existing or calculate later
                if account_data.balance_current is not None:
                    existing_account.balance_current = account_data.balance_current
                existing_account.balance_available = account_data.balance_available
                existing_account.is_active = True
                synced_accounts.append(existing_account)
            else:
                # Create new account
                # Don't set balance here - it will be calculated from transactions after sync
                new_account = Account(
                    name=account_data.name,
                    account_type=account_data.account_type,
                    institution=account_data.institution,
                    currency=account_data.currency,
                    provider=provider,
                    external_id=account_data.external_id,
                    balance_current=0,  # Will be recalculated from transactions
                    balance_available=account_data.balance_available,
                )
                self.db.add(new_account)
                synced_accounts.append(new_account)
        
        self.db.commit()
        
        # Refresh all accounts
        for account in synced_accounts:
            self.db.refresh(account)
        
        return synced_accounts
    
    def sync_transactions(
        self,
        adapter: BankAdapter,
        account: Account,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> tuple[int, int]:
        """
        Sync transactions for an account.
        
        Args:
            adapter: Bank adapter instance
            account: Account to sync transactions for
            start_date: Optional start date for transaction range
            end_date: Optional end date for transaction range
            
        Returns:
            Tuple of (created_count, updated_count)
        """
        transaction_data_list = adapter.fetch_transactions(
            account.external_id,
            start_date=start_date,
            end_date=end_date,
        )
        
        created_count = 0
        updated_count = 0
        
        for transaction_data in transaction_data_list:
            # Try to auto-categorize the transaction
            category = self.category_matcher.match_category(
                description=transaction_data.description,
                merchant=transaction_data.merchant,
                amount=transaction_data.amount,
                transaction_type=transaction_data.transaction_type,
                use_llm=self.use_llm_categorization
            )
            
            # Check if transaction already exists
            existing_transaction = self.db.query(Transaction).filter(
                and_(
                    Transaction.account_id == account.id,
                    Transaction.external_id == transaction_data.external_id
                )
            ).first()
            
            if existing_transaction:
                # Update existing transaction
                existing_transaction.amount = transaction_data.amount
                existing_transaction.currency = transaction_data.currency
                existing_transaction.description = transaction_data.description
                existing_transaction.merchant = transaction_data.merchant
                existing_transaction.booked_at = transaction_data.booked_at
                existing_transaction.transaction_type = transaction_data.transaction_type
                existing_transaction.pending = transaction_data.pending
                # Only update category if it wasn't already set (preserve user's manual categorization)
                if not existing_transaction.category_id and category:
                    existing_transaction.category_id = category.id
                updated_count += 1
            else:
                # Create new transaction
                new_transaction = Transaction(
                    account_id=account.id,
                    external_id=transaction_data.external_id,
                    transaction_type=transaction_data.transaction_type,
                    amount=transaction_data.amount,
                    currency=transaction_data.currency,
                    description=transaction_data.description,
                    merchant=transaction_data.merchant,
                    booked_at=transaction_data.booked_at,
                    pending=transaction_data.pending,
                    category_id=category.id if category else None,
                )
                self.db.add(new_transaction)
                created_count += 1
        
        self.db.commit()
        
        return (created_count, updated_count)
    
    def sync_all(
        self,
        adapter: BankAdapter,
        provider: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> dict:
        """
        Sync both accounts and transactions.
        
        Returns:
            Dict with sync results
        """
        # Sync accounts first
        accounts = self.sync_accounts(adapter, provider)
        
        # For Revolut, permanently delete old "Revolut default" accounts if they exist
        if provider == 'revolut':
            from app.models import Transaction
            old_default_accounts = self.db.query(Account).filter(
                and_(
                    Account.provider == 'revolut',
                    Account.external_id == 'revolut_default'
                )
            ).all()
            for old_account in old_default_accounts:
                # Delete associated transactions first
                self.db.query(Transaction).filter(Transaction.account_id == old_account.id).delete()
                # Then delete the account
                self.db.delete(old_account)
            if old_default_accounts:
                self.db.commit()
        
        # Sync transactions for each account
        total_created = 0
        total_updated = 0
        
        for account in accounts:
            created, updated = self.sync_transactions(
                adapter,
                account,
                start_date=start_date,
                end_date=end_date,
            )
            total_created += created
            total_updated += updated
        
        # After syncing transactions, update account balance from sum of all transactions
        # This ensures the balance is always accurate based on the transactions in the database
        from sqlalchemy import func
        for account in accounts:
            # Calculate balance from sum of all transactions for this account
            balance_sum = self.db.query(func.sum(Transaction.amount)).filter(
                Transaction.account_id == account.id
            ).scalar() or 0
            account.balance_current = balance_sum
            self.db.commit()
        
        return {
            'accounts_synced': len(accounts),
            'transactions_created': total_created,
            'transactions_updated': total_updated,
        }

